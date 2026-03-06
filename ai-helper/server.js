import { Buffer } from 'node:buffer';
import dns from 'node:dns/promises';
import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { createClient } from '@supabase/supabase-js';
import { CURATED_SEMAI_TERMS } from './semaiLexicon.js';

const DEFAULT_PORT = 8787;
const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_OMNIASR_BASE_URL = 'https://facebook-omniasr-transcriptions.hf.space';
const DEFAULT_OMNIASR_LANGUAGE = 'sea_Latn';
const DEFAULT_RECORDINGS_BUCKET = 'recordings';
const MAX_JSON_BODY_BYTES = 1024 * 1024;
const LEXICON_CACHE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_ENSEMBLE_LANGUAGES = ['sea_Latn', 'mly_Latn', 'ind_Latn', 'eng_Latn'];
const SENTENCE_REVIEW_MIN_SCORE = 0.48;
const SENTENCE_AUTO_SNAP_MIN_SCORE = 0.72;
const SENTENCE_AUTO_SNAP_MARGIN = 0.08;
const SENTENCE_AUTO_SNAP_MIN_OVERLAP = 0.6;
const WORDS_TABLE_SEMAI_COLUMNS = ['semai_word', 'semai'];
const DICTIONARY_FILE_PATH = join(
  process.cwd(),
  'docs',
  'plan',
  'source',
  'webonary-semai-parsed.json',
);

const MIME_BY_EXTENSION = {
  aac: 'audio/aac',
  m4a: 'audio/mp4',
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
  wav: 'audio/wav',
  webm: 'audio/webm',
};

/**
 * Loads key/value pairs from a local `.env` file into `process.env`.
 * Existing process env values are never overwritten.
 * @param {string} filePath
 */
const loadEnvFileIfPresent = (filePath) => {
  if (!existsSync(filePath)) {
    return;
  }

  const content = readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const equalsIndex = trimmed.indexOf('=');
    if (equalsIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, equalsIndex).trim();
    if (!key || process.env[key] !== undefined) {
      continue;
    }

    const rawValue = trimmed.slice(equalsIndex + 1).trim();
    const unquoted =
      (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
      (rawValue.startsWith("'") && rawValue.endsWith("'"))
        ? rawValue.slice(1, -1)
        : rawValue;

    process.env[key] = unquoted;
  }
};

class HttpError extends Error {
  /**
   * @param {number} statusCode
   * @param {string} message
   * @param {string} code
   * @param {unknown} [details]
   */
  constructor(statusCode, message, code, details) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

/**
 * @param {string | undefined} value
 * @param {number} fallback
 */
const parsePositiveInteger = (value, fallback) => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

/**
 * @param {string | undefined} value
 */
const parseCorsOrigins = (value) => {
  const parsed = (value ?? '*')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  return parsed.length > 0 ? parsed : ['*'];
};

/**
 * @param {string} value
 */
const isHttpUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

/**
 * @param {string} filename
 */
export const guessMimeType = (filename) => {
  const extension = filename.split('.').pop()?.toLowerCase() ?? '';
  return MIME_BY_EXTENSION[extension] ?? 'audio/webm';
};

/**
 * @param {string} value
 */
export const sanitizeFilename = (value) => {
  const fallback = 'recording.webm';
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return fallback;
  }

  const safe = trimmed.replace(/[^a-zA-Z0-9._-]/g, '_');
  return safe.length > 0 ? safe : fallback;
};

/**
 * @param {string} audioUrl
 * @param {string} bucketName
 */
export const normalizeStoragePath = (audioUrl, bucketName = DEFAULT_RECORDINGS_BUCKET) => {
  const trimmed = audioUrl.trim().replace(/^\/+/, '');
  if (trimmed.length === 0) {
    return '';
  }

  if (trimmed === bucketName) {
    return '';
  }

  if (trimmed.startsWith(`${bucketName}/`)) {
    return trimmed.slice(bucketName.length + 1);
  }

  return trimmed;
};

/**
 * @param {unknown} payload
 */
export const extractTranscriptionFromPayload = (payload) => {
  if (!payload || typeof payload !== 'object') {
    return '';
  }

  const transcription = Reflect.get(payload, 'transcription');
  if (typeof transcription !== 'string') {
    return '';
  }

  return transcription.trim();
};

export const normalizeLexiconText = (value) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[ɔ]/g, 'o')
    .replace(/[ə]/g, 'e')
    .replace(/[ɨ]/g, 'i')
    .replace(/[^a-zA-Z0-9'\s-]/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

export const tokenizeLexiconText = (value) =>
  normalizeLexiconText(value)
    .split(/[\s-]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);

export const buildAsrLanguageOrder = (primaryLanguage) => {
  const normalizedPrimary = (primaryLanguage ?? '').trim();
  const ordered = [
    ...(normalizedPrimary.length > 0 ? [normalizedPrimary] : []),
    ...DEFAULT_ENSEMBLE_LANGUAGES,
  ];
  return [...new Set(ordered)];
};

export const levenshteinDistance = (left, right) => {
  if (left === right) {
    return 0;
  }

  if (left.length === 0) {
    return right.length;
  }

  if (right.length === 0) {
    return left.length;
  }

  const previous = new Array(right.length + 1).fill(0);
  const current = new Array(right.length + 1).fill(0);

  for (let index = 0; index <= right.length; index += 1) {
    previous[index] = index;
  }

  for (let i = 1; i <= left.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const substitutionCost = left[i - 1] === right[j - 1] ? 0 : 1;
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + substitutionCost,
      );
    }

    for (let j = 0; j <= right.length; j += 1) {
      previous[j] = current[j];
    }
  }

  return previous[right.length];
};

const buildLexicon = (terms) => {
  const phrases = [];
  const tokenSet = new Set();

  for (const rawTerm of terms) {
    const normalizedTerm = normalizeLexiconText(rawTerm);
    if (!normalizedTerm) {
      continue;
    }

    phrases.push(normalizedTerm);
    for (const token of tokenizeLexiconText(normalizedTerm)) {
      tokenSet.add(token);
    }
  }

  const dedupedPhrases = [...new Set(phrases)];

  return {
    phrases: dedupedPhrases,
    multiTokenPhrases: dedupedPhrases
      .map((phrase) => ({
        phrase,
        tokens: tokenizeLexiconText(phrase),
      }))
      .filter((entry) => entry.tokens.length >= 2),
    tokens: [...tokenSet],
    tokenSet,
  };
};

const CURATED_LEXICON = buildLexicon(CURATED_SEMAI_TERMS);

let lexiconCache = {
  expiresAt: 0,
  lexicon: CURATED_LEXICON,
  sentenceEntries: [],
  wordEntries: [],
  source: 'curated',
};

const tryLoadWebonaryDictionaryTerms = () => {
  if (!existsSync(DICTIONARY_FILE_PATH)) {
    return [];
  }

  try {
    const raw = readFileSync(DICTIONARY_FILE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    const collectedTerms = [];

    for (const entry of parsed) {
      if (!entry || typeof entry !== 'object') {
        continue;
      }

      const word = Reflect.get(entry, 'word');
      if (typeof word === 'string' && word.trim().length > 0) {
        collectedTerms.push(word);
      }

      const words = Reflect.get(entry, 'words');
      if (Array.isArray(words)) {
        for (const token of words) {
          if (typeof token === 'string' && token.trim().length > 0) {
            collectedTerms.push(token);
          }
        }
      }

      const senses = Reflect.get(entry, 'senses');
      if (!Array.isArray(senses)) {
        continue;
      }

      for (const sense of senses) {
        const examples = Reflect.get(sense, 'examples');
        if (!Array.isArray(examples)) {
          continue;
        }

        for (const example of examples) {
          const semaiSentence = Reflect.get(example, 'semai');
          if (typeof semaiSentence === 'string' && semaiSentence.trim().length > 0) {
            collectedTerms.push(semaiSentence);
          }
        }
      }
    }

    return collectedTerms;
  } catch (error) {
    console.warn('[ai-helper] unable to parse Webonary dictionary:', error);
    return [];
  }
};

const buildTokenSetFromRows = (rows, column) => {
  if (!Array.isArray(rows) || rows.length === 0) {
    return [];
  }

  return rows
    .map((row) => (row && typeof row === 'object' ? Reflect.get(row, column) : null))
    .filter((value) => typeof value === 'string' && value.trim().length > 0);
};

export const buildVerifiedRecordingTermsFromRows = (rows) => {
  if (!Array.isArray(rows) || rows.length === 0) {
    return [];
  }

  return rows
    .flatMap((row) => {
      if (!row || typeof row !== 'object') {
        return [];
      }

      const isVerified = Reflect.get(row, 'is_verified') === true;
      if (!isVerified) {
        return [];
      }

      const verified = Reflect.get(row, 'verified_transcription');
      if (typeof verified === 'string' && verified.trim().length > 0) {
        return [verified];
      }

      const fallback = Reflect.get(row, 'transcription');
      if (typeof fallback === 'string' && fallback.trim().length > 0) {
        return [fallback];
      }

      return [];
    })
    .filter((value) => typeof value === 'string' && value.trim().length > 0);
};

const buildWordEntriesFromTerms = (terms, source = 'dictionary') =>
  Array.isArray(terms)
    ? terms
        .map((term, index) => {
          const normalizedText = normalizeLexiconText(term);
          if (!normalizedText) {
            return null;
          }

          return {
            id: `${source}-${index}-${normalizedText}`,
            text: normalizedText,
            normalizedText,
            tokens: tokenizeLexiconText(normalizedText),
            source,
          };
        })
        .filter(Boolean)
    : [];

const buildUniqueWordEntries = (...entrySets) => {
  const merged = new Map();

  for (const entrySet of entrySets) {
    for (const entry of entrySet) {
      if (!entry?.normalizedText) {
        continue;
      }

      if (!merged.has(entry.normalizedText)) {
        merged.set(entry.normalizedText, entry);
      }
    }
  }

  return [...merged.values()];
};

const buildUniqueSentenceEntries = (...entrySets) => {
  const merged = new Map();

  for (const entrySet of entrySets) {
    for (const entry of entrySet) {
      if (!entry?.normalizedText) {
        continue;
      }

      const key = `${entry.source}:${entry.normalizedText}`;
      if (!merged.has(key)) {
        merged.set(key, entry);
      }
    }
  }

  return [...merged.values()];
};

const buildVerifiedRecordingSentenceEntries = (rows) => {
  if (!Array.isArray(rows) || rows.length === 0) {
    return [];
  }

  return rows
    .map((row, index) => {
      if (!row || typeof row !== 'object' || Reflect.get(row, 'is_verified') !== true) {
        return null;
      }

      const id = Reflect.get(row, 'id');
      const rawText =
        Reflect.get(row, 'verified_transcription') ?? Reflect.get(row, 'transcription') ?? null;
      if (typeof rawText !== 'string' || rawText.trim().length === 0) {
        return null;
      }

      const normalizedText = normalizeLexiconText(rawText);
      const tokens = tokenizeLexiconText(rawText);
      if (!normalizedText || tokens.length < 2) {
        return null;
      }

      return {
        id: typeof id === 'string' ? id : `verified-recording-${index}`,
        text: normalizedText,
        normalizedText,
        tokens,
        source: 'verified_recording',
        headword: null,
      };
    })
    .filter(Boolean);
};

const buildVerifiedWordEntries = (rows) => {
  if (!Array.isArray(rows) || rows.length === 0) {
    return [];
  }

  return rows
    .map((row, index) => {
      if (!row || typeof row !== 'object') {
        return null;
      }

      const rawText = Reflect.get(row, 'semai_word') ?? Reflect.get(row, 'semai') ?? null;
      if (typeof rawText !== 'string' || rawText.trim().length === 0) {
        return null;
      }

      const normalizedText = normalizeLexiconText(rawText);
      if (!normalizedText) {
        return null;
      }

      const id = Reflect.get(row, 'id');
      return {
        id: typeof id === 'string' ? id : `verified-word-${index}`,
        text: normalizedText,
        normalizedText,
        tokens: tokenizeLexiconText(normalizedText),
        source: 'verified_word',
      };
    })
    .filter(Boolean);
};

const buildVerifiedPhraseEntriesFromWords = (rows) =>
  buildVerifiedWordEntries(rows)
    .filter((entry) => entry.tokens.length >= 2)
    .map((entry) => ({
      id: entry.id,
      text: entry.text,
      normalizedText: entry.normalizedText,
      tokens: entry.tokens,
      source: 'verified_phrase',
      headword: null,
    }));

const tryLoadWebonarySentenceEntries = () => {
  if (!existsSync(DICTIONARY_FILE_PATH)) {
    return [];
  }

  try {
    const raw = readFileSync(DICTIONARY_FILE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    const entries = [];

    for (const entry of parsed) {
      if (!entry || typeof entry !== 'object') {
        continue;
      }

      const headword =
        typeof Reflect.get(entry, 'word') === 'string' ? Reflect.get(entry, 'word').trim() : '';
      const senses = Reflect.get(entry, 'senses');
      if (!Array.isArray(senses)) {
        continue;
      }

      for (const sense of senses) {
        const examples = Reflect.get(sense, 'examples');
        if (!Array.isArray(examples)) {
          continue;
        }

        for (let index = 0; index < examples.length; index += 1) {
          const example = examples[index];
          const semaiSentence = Reflect.get(example, 'semai');
          if (typeof semaiSentence !== 'string' || semaiSentence.trim().length === 0) {
            continue;
          }

          const normalizedText = normalizeLexiconText(semaiSentence);
          const tokens = tokenizeLexiconText(semaiSentence);
          if (!normalizedText || tokens.length < 2) {
            continue;
          }

          entries.push({
            id: `${headword || 'sentence'}-${index}-${normalizedText}`,
            text: normalizedText,
            normalizedText,
            tokens,
            source: 'webonary_sentence',
            headword: headword || null,
          });
        }
      }
    }

    return entries;
  } catch (error) {
    console.warn('[ai-helper] unable to parse Webonary sentence corpus:', error);
    return [];
  }
};

const getSentenceSourcePriority = (source) => {
  if (source === 'webonary_sentence') {
    return 0;
  }
  if (source === 'verified_recording') {
    return 1;
  }
  return 2;
};

const getSentenceSourceBoost = (source) => {
  if (source === 'webonary_sentence') {
    return 0.04;
  }
  if (source === 'verified_recording') {
    return 0.02;
  }
  return 0.01;
};

const mergeUniqueTerms = (...termSets) => {
  const merged = new Set();

  for (const termSet of termSets) {
    for (const term of termSet) {
      const normalized = normalizeLexiconText(term);
      if (normalized.length > 0) {
        merged.add(normalized);
      }
    }
  }

  return [...merged];
};

const tokenJaccardSimilarity = (leftTokens, rightTokens) => {
  if (leftTokens.length === 0 || rightTokens.length === 0) {
    return 0;
  }

  const leftSet = new Set(leftTokens);
  const rightSet = new Set(rightTokens);
  const unionSize = new Set([...leftSet, ...rightSet]).size;
  if (unionSize === 0) {
    return 0;
  }

  const intersectionSize = [...leftSet].filter((token) => rightSet.has(token)).length;
  return intersectionSize / unionSize;
};

const fuzzyTokenMatchScore = (token, lexiconTokens) => {
  if (lexiconTokens.length === 0) {
    return 0;
  }

  if (token.length < 4) {
    return 0;
  }

  let minimumDistance = Number.POSITIVE_INFINITY;
  for (const lexiconToken of lexiconTokens) {
    const distance = levenshteinDistance(token, lexiconToken);
    if (distance < minimumDistance) {
      minimumDistance = distance;
    }

    if (minimumDistance === 0) {
      return 1;
    }
  }

  const threshold = token.length >= 7 ? 2 : 1;
  if (minimumDistance <= threshold) {
    return minimumDistance === 1 ? 0.75 : 0.55;
  }

  return 0;
};

const scoreFuzzyMatch = (input, candidate) => {
  const maxLength = Math.max(input.length, candidate.length);
  if (maxLength === 0) {
    return 0;
  }

  return 1 - levenshteinDistance(input, candidate) / maxLength;
};

const inspectLexiconMatch = (token, lexiconTokens) => {
  if (token.length < 4) {
    return null;
  }

  let bestToken = token;
  let bestDistance = Number.POSITIVE_INFINITY;
  let secondBestDistance = Number.POSITIVE_INFINITY;

  for (const lexiconToken of lexiconTokens) {
    const distance = levenshteinDistance(token, lexiconToken);
    if (distance < bestDistance) {
      secondBestDistance = bestDistance;
      bestDistance = distance;
      bestToken = lexiconToken;
      continue;
    }

    if (distance < secondBestDistance) {
      secondBestDistance = distance;
    }
  }

  if (bestDistance === 0) {
    return null;
  }

  const threshold = token.length >= 7 ? 2 : 1;
  if (bestDistance > threshold) {
    return null;
  }

  if (secondBestDistance <= bestDistance) {
    return null;
  }

  return {
    bestToken,
    bestDistance,
    secondBestDistance,
  };
};

const buildSemaiPhoneticKey = (value) =>
  normalizeLexiconText(value)
    .replace(/'/g, '')
    .replace(/dj/g, 'j')
    .replace(/sy/g, 's')
    .replace(/kh/g, 'h')
    .replace(/([aeiou])\1+/g, '$1');

const buildCandidateTokenPools = (rankedCandidates, lexicon) =>
  Array.isArray(rankedCandidates)
    ? rankedCandidates.map((candidate, index) => ({
        score:
          typeof candidate?.score === 'number' && Number.isFinite(candidate.score)
            ? Math.max(0.1, candidate.score)
            : Math.max(0.1, 1 - index * 0.1),
        tokens: prepareCandidateTokens(candidate?.transcription ?? '', lexicon),
      }))
    : [];

const computeCandidateTokenSupport = (token, candidatePools, { phonetic = false } = {}) => {
  if (!Array.isArray(candidatePools) || candidatePools.length === 0) {
    return 0;
  }

  const normalizedToken = normalizeLexiconText(token);
  if (!normalizedToken) {
    return 0;
  }

  const targetPhoneticKey = phonetic ? buildSemaiPhoneticKey(normalizedToken) : null;
  const totalWeight = candidatePools.reduce((sum, candidate) => sum + candidate.score, 0);
  if (totalWeight <= 0) {
    return 0;
  }

  let matchedWeight = 0;

  for (const candidate of candidatePools) {
    const hasMatch = candidate.tokens.some((candidateToken) => {
      if (candidateToken === normalizedToken) {
        return true;
      }

      if (!phonetic) {
        return false;
      }

      return buildSemaiPhoneticKey(candidateToken) === targetPhoneticKey;
    });

    if (hasMatch) {
      matchedWeight += candidate.score;
    }
  }

  return matchedWeight / totalWeight;
};

export const applyLexiconCorrections = (transcription, lexicon, rankedCandidates = []) => {
  const normalized = normalizeLexiconText(transcription);
  if (!normalized) {
    return '';
  }

  const candidatePools = buildCandidateTokenPools(rankedCandidates, lexicon);
  const corrected = tokenizeLexiconText(normalized).map((token) => {
    const match = inspectLexiconMatch(token, lexicon.tokens);
    if (!match) {
      return token;
    }

    const exactConsensus = computeCandidateTokenSupport(token, candidatePools);
    const replacementConsensus = computeCandidateTokenSupport(match.bestToken, candidatePools, {
      phonetic: true,
    });
    const strongOriginalConsensus =
      exactConsensus >= (match.bestDistance === 1 ? 0.9 : 0.72) &&
      exactConsensus > replacementConsensus + 0.15;

    if (strongOriginalConsensus) {
      return token;
    }

    if (match.bestDistance === 1) {
      return exactConsensus >= 0.8 && replacementConsensus < exactConsensus
        ? token
        : match.bestToken;
    }

    const isPhoneticNearMatch =
      buildSemaiPhoneticKey(token) === buildSemaiPhoneticKey(match.bestToken);
    const weakOriginalConsensus = exactConsensus < 0.45;

    if (isPhoneticNearMatch && weakOriginalConsensus) {
      return match.bestToken;
    }

    return token;
  });

  return corrected.join(' ').trim();
};

const prepareCandidateTokens = (transcription, lexicon) => {
  void lexicon;
  return tokenizeLexiconText(transcription);
};

const substitutionCost = (leftToken, rightToken) => {
  if (leftToken === rightToken) {
    return 0;
  }

  if (buildSemaiPhoneticKey(leftToken) === buildSemaiPhoneticKey(rightToken)) {
    return 0.25;
  }

  const distance = levenshteinDistance(leftToken, rightToken);
  if (distance <= 1) {
    return 0.4;
  }
  if (distance <= 2) {
    return 0.75;
  }

  return 1;
};

const alignTokensToPivot = (pivotTokens, candidateTokens) => {
  const rowCount = pivotTokens.length + 1;
  const columnCount = candidateTokens.length + 1;
  const costs = Array.from({ length: rowCount }, () => new Array(columnCount).fill(0));
  const pointers = Array.from({ length: rowCount }, () => new Array(columnCount).fill(''));

  for (let row = 1; row < rowCount; row += 1) {
    costs[row][0] = row;
    pointers[row][0] = 'up';
  }

  for (let column = 1; column < columnCount; column += 1) {
    costs[0][column] = column;
    pointers[0][column] = 'left';
  }

  for (let row = 1; row < rowCount; row += 1) {
    for (let column = 1; column < columnCount; column += 1) {
      const diagonal =
        costs[row - 1][column - 1] +
        substitutionCost(pivotTokens[row - 1], candidateTokens[column - 1]);
      const up = costs[row - 1][column] + 1;
      const left = costs[row][column - 1] + 1;

      const minimum = Math.min(diagonal, up, left);
      costs[row][column] = minimum;

      if (minimum === diagonal) {
        pointers[row][column] = 'diag';
      } else if (minimum === up) {
        pointers[row][column] = 'up';
      } else {
        pointers[row][column] = 'left';
      }
    }
  }

  const aligned = new Array(pivotTokens.length).fill(null);
  let row = pivotTokens.length;
  let column = candidateTokens.length;

  while (row > 0 || column > 0) {
    const pointer = pointers[row]?.[column] ?? '';
    if (pointer === 'diag') {
      aligned[row - 1] = candidateTokens[column - 1] ?? null;
      row -= 1;
      column -= 1;
      continue;
    }

    if (pointer === 'up') {
      aligned[row - 1] = null;
      row -= 1;
      continue;
    }

    column -= 1;
  }

  const nonNullCount = aligned.filter(Boolean).length;
  return {
    aligned,
    coverage: pivotTokens.length > 0 ? nonNullCount / pivotTokens.length : 0,
  };
};

const buildVoteWeight = (token, candidate, pivotToken, lexicon) => {
  let weight = candidate.score;

  if (lexicon.tokenSet.has(token)) {
    weight += 0.16;
  }

  if (buildSemaiPhoneticKey(token) === buildSemaiPhoneticKey(pivotToken)) {
    weight += 0.12;
  }

  if (token === pivotToken) {
    weight += 0.06;
  }

  return weight;
};

export const mergeAsrCandidateTokens = (rankedCandidates, lexicon) => {
  if (!Array.isArray(rankedCandidates) || rankedCandidates.length === 0) {
    return null;
  }

  const pivot = rankedCandidates[0];
  const pivotTokens = prepareCandidateTokens(pivot.transcription, lexicon);
  if (pivotTokens.length === 0) {
    return null;
  }

  const alignments = rankedCandidates.map((candidate) => ({
    candidate,
    ...alignTokensToPivot(pivotTokens, prepareCandidateTokens(candidate.transcription, lexicon)),
  }));

  const averageCoverage =
    alignments.reduce((sum, item) => sum + item.coverage, 0) / Math.max(alignments.length, 1);

  const mergedTokens = pivotTokens.map((pivotToken, index) => {
    const tokenWeights = new Map();

    for (const alignment of alignments) {
      const candidateToken = alignment.aligned[index] ?? null;
      if (!candidateToken) {
        continue;
      }

      const voteWeight = buildVoteWeight(candidateToken, alignment.candidate, pivotToken, lexicon);
      tokenWeights.set(candidateToken, (tokenWeights.get(candidateToken) ?? 0) + voteWeight);
    }

    if (tokenWeights.size === 0) {
      return pivotToken;
    }

    const rankedTokens = [...tokenWeights.entries()].sort((left, right) => right[1] - left[1]);
    return rankedTokens[0]?.[0] ?? pivotToken;
  });

  const mergedText = mergedTokens.join(' ').trim();
  const mergedCoverage = scoreDictionaryCoverage(
    normalizeLexiconText(mergedText),
    tokenizeLexiconText(mergedText),
    lexicon,
  );
  const pivotCoverage = scoreDictionaryCoverage(
    normalizeLexiconText(pivot.transcription),
    tokenizeLexiconText(pivot.transcription),
    lexicon,
  );

  const usePivotFallback = averageCoverage < 0.6 || mergedCoverage < pivotCoverage;

  return {
    averageCoverage,
    mergedText: usePivotFallback ? pivot.transcription : mergedText,
    pivotText: pivot.transcription,
    usedFallback: usePivotFallback,
  };
};

const scoreDictionaryCoverage = (normalizedText, tokens, lexicon) => {
  if (tokens.length === 0) {
    return 0;
  }

  let tokenScoreTotal = 0;
  for (const token of tokens) {
    if (lexicon.tokenSet.has(token)) {
      tokenScoreTotal += 1;
      continue;
    }

    tokenScoreTotal += fuzzyTokenMatchScore(token, lexicon.tokens);
  }

  const tokenCoverageScore = tokenScoreTotal / tokens.length;
  const phraseMatches = lexicon.phrases.filter(
    (phrase) => phrase.includes(' ') && normalizedText.includes(phrase),
  ).length;
  const phraseBonus = Math.min(0.4, phraseMatches * 0.15);

  return tokenCoverageScore + phraseBonus;
};

const scoreClosestPhraseSupport = (normalizedText, tokens, lexicon) => {
  if (!normalizedText || tokens.length < 2 || !Array.isArray(lexicon.multiTokenPhrases)) {
    return 0;
  }

  let bestScore = 0;

  for (const candidatePhrase of lexicon.multiTokenPhrases) {
    const tokenLengthDelta = Math.abs(candidatePhrase.tokens.length - tokens.length);
    if (tokenLengthDelta > Math.max(5, Math.ceil(tokens.length * 0.75))) {
      continue;
    }

    const tokenSimilarity = tokenJaccardSimilarity(tokens, candidatePhrase.tokens);
    if (tokenSimilarity < 0.18) {
      continue;
    }

    const maxLength = Math.max(normalizedText.length, candidatePhrase.phrase.length);
    const textSimilarity =
      maxLength > 0
        ? 1 - levenshteinDistance(normalizedText, candidatePhrase.phrase) / maxLength
        : 0;

    let score = tokenSimilarity * 0.68 + textSimilarity * 0.32;
    if (
      normalizedText.includes(candidatePhrase.phrase) ||
      candidatePhrase.phrase.includes(normalizedText)
    ) {
      score += 0.12;
    }

    if (score > bestScore) {
      bestScore = score;
    }
  }

  return Math.min(1, bestScore);
};

const scoreTokenSequenceSimilarity = (leftTokens, rightTokens) => {
  const maxLength = Math.max(leftTokens.length, rightTokens.length);
  if (maxLength === 0) {
    return 0;
  }

  let scoreTotal = 0;
  for (let index = 0; index < maxLength; index += 1) {
    const leftToken = leftTokens[index];
    const rightToken = rightTokens[index];

    if (!leftToken || !rightToken) {
      continue;
    }

    if (leftToken === rightToken) {
      scoreTotal += 1;
      continue;
    }

    if (buildSemaiPhoneticKey(leftToken) === buildSemaiPhoneticKey(rightToken)) {
      scoreTotal += 0.82;
      continue;
    }

    const distance = levenshteinDistance(leftToken, rightToken);
    if (distance === 1) {
      scoreTotal += 0.72;
      continue;
    }

    if (distance === 2) {
      scoreTotal += 0.45;
    }
  }

  return scoreTotal / maxLength;
};

const scoreSentenceMatch = (normalizedText, tokens, sentenceEntry) => {
  const tokenOverlap = Math.max(
    tokenJaccardSimilarity(tokens, sentenceEntry.tokens),
    scoreTokenSequenceSimilarity(tokens, sentenceEntry.tokens),
  );
  const textSimilarity = scoreFuzzyMatch(normalizedText, sentenceEntry.normalizedText);
  let score =
    tokenOverlap * 0.62 + textSimilarity * 0.38 + getSentenceSourceBoost(sentenceEntry.source);

  if (
    normalizedText.includes(sentenceEntry.normalizedText) ||
    sentenceEntry.normalizedText.includes(normalizedText)
  ) {
    score += 0.14;
  }

  return {
    score: Math.min(1, score),
    tokenOverlap,
    lengthDelta: Math.abs(tokens.length - sentenceEntry.tokens.length),
  };
};

export const getTopSentenceMatch = (transcription, sentenceEntries, recordingType) => {
  const normalizedText = normalizeLexiconText(transcription);
  const tokens = tokenizeLexiconText(transcription);
  if (!normalizedText || tokens.length === 0 || !Array.isArray(sentenceEntries)) {
    return null;
  }

  const eligibleEntries = sentenceEntries.filter((entry) =>
    recordingType === 'word' ? true : entry.tokens.length >= 2,
  );

  const exactMatches = eligibleEntries
    .filter((entry) => entry.normalizedText === normalizedText)
    .sort(
      (left, right) =>
        getSentenceSourcePriority(left.source) - getSentenceSourcePriority(right.source),
    );

  if (exactMatches.length > 0) {
    const exact = exactMatches[0];
    return {
      best: {
        id: exact.id,
        source: exact.source,
        semai: exact.text,
        score: 1,
        matchType: 'exact',
        headword: exact.headword,
        tokenOverlap: 1,
        applied: true,
      },
      ranked: [
        {
          id: exact.id,
          source: exact.source,
          semai: exact.text,
          score: 1,
          matchType: 'exact',
          headword: exact.headword,
          tokenOverlap: 1,
        },
      ],
    };
  }

  const ranked = eligibleEntries
    .map((entry) => {
      const metrics = scoreSentenceMatch(normalizedText, tokens, entry);
      return {
        id: entry.id,
        source: entry.source,
        semai: entry.text,
        score: metrics.score,
        matchType: 'fuzzy',
        headword: entry.headword,
        tokenOverlap: metrics.tokenOverlap,
        lengthDelta: metrics.lengthDelta,
      };
    })
    .filter(
      (entry) =>
        entry.score >= SENTENCE_REVIEW_MIN_SCORE &&
        entry.tokenOverlap >= 0.34 &&
        entry.lengthDelta <= Math.max(5, tokens.length),
    )
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.lengthDelta - right.lengthDelta ||
        getSentenceSourcePriority(left.source) - getSentenceSourcePriority(right.source),
    );

  if (ranked.length === 0) {
    return null;
  }

  const best = ranked[0];
  const runnerUp = ranked[1] ?? null;
  const shouldSnap =
    best.score >= SENTENCE_AUTO_SNAP_MIN_SCORE &&
    best.tokenOverlap >= SENTENCE_AUTO_SNAP_MIN_OVERLAP &&
    (!runnerUp || best.score - runnerUp.score >= SENTENCE_AUTO_SNAP_MARGIN);

  return {
    best: {
      ...best,
      applied: shouldSnap,
    },
    ranked,
  };
};

const buildLexiconWordEntries = (lexicon) =>
  Array.isArray(lexicon?.tokens)
    ? lexicon.tokens.map((token, index) => ({
        id: `dictionary-${index}-${token}`,
        text: token,
        normalizedText: token,
        tokens: [token],
        source: 'dictionary',
      }))
    : [];

const inspectWordEntryMatch = (token, wordEntries) => {
  if (token.length < 4) {
    return null;
  }

  let bestEntry = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  let secondBestDistance = Number.POSITIVE_INFINITY;

  for (const wordEntry of wordEntries) {
    const distance = levenshteinDistance(token, wordEntry.normalizedText);
    if (distance < bestDistance) {
      secondBestDistance = bestDistance;
      bestDistance = distance;
      bestEntry = wordEntry;
      continue;
    }

    if (distance < secondBestDistance) {
      secondBestDistance = distance;
    }
  }

  if (!bestEntry || bestDistance === 0) {
    return null;
  }

  const threshold = token.length >= 7 ? 2 : 1;
  if (bestDistance > threshold || secondBestDistance <= bestDistance) {
    return null;
  }

  return {
    bestEntry,
    bestDistance,
    secondBestDistance,
  };
};

export const buildWordReplacementResult = (transcription, wordEntries, rankedCandidates = []) => {
  const normalized = normalizeLexiconText(transcription);
  if (!normalized) {
    return {
      correctedText: '',
      replacements: [],
    };
  }

  const candidatePools = buildCandidateTokenPools(rankedCandidates, {});
  const baseWordEntries = Array.isArray(wordEntries) && wordEntries.length > 0 ? wordEntries : [];
  const replacements = [];
  const seenReplacementKeys = new Set();

  const correctedTokens = tokenizeLexiconText(normalized).map((token) => {
    const match = inspectWordEntryMatch(token, baseWordEntries);
    if (!match) {
      return token;
    }

    const exactConsensus = computeCandidateTokenSupport(token, candidatePools);
    const replacementConsensus = computeCandidateTokenSupport(
      match.bestEntry.normalizedText,
      candidatePools,
      {
        phonetic: true,
      },
    );
    const strongOriginalConsensus =
      exactConsensus >= (match.bestDistance === 1 ? 0.9 : 0.72) &&
      exactConsensus > replacementConsensus + 0.15;

    if (strongOriginalConsensus) {
      return token;
    }

    let nextToken = token;

    if (match.bestDistance === 1) {
      nextToken =
        exactConsensus >= 0.8 && replacementConsensus < exactConsensus
          ? token
          : match.bestEntry.normalizedText;
    } else {
      const isPhoneticNearMatch =
        buildSemaiPhoneticKey(token) === buildSemaiPhoneticKey(match.bestEntry.normalizedText);
      const weakOriginalConsensus = exactConsensus < 0.45;
      nextToken =
        isPhoneticNearMatch && weakOriginalConsensus ? match.bestEntry.normalizedText : token;
    }

    if (nextToken !== token) {
      const replacementKey = `${token}->${match.bestEntry.text}`;
      if (!seenReplacementKeys.has(replacementKey)) {
        seenReplacementKeys.add(replacementKey);
        replacements.push({
          from: token,
          to: match.bestEntry.text,
          confidence: Number(Math.max(replacementConsensus, 0.55).toFixed(2)),
          source: match.bestEntry.source,
        });
      }
    }

    return nextToken;
  });

  return {
    correctedText: correctedTokens.join(' ').trim(),
    replacements,
  };
};

export const chooseBestAsrCandidate = (candidates, lexicon, languageOrder) => {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return null;
  }

  const normalizedCandidates = candidates
    .map((candidate) => {
      const normalizedText = normalizeLexiconText(candidate.transcription ?? '');
      if (!normalizedText) {
        return null;
      }

      const tokens = tokenizeLexiconText(normalizedText);
      return {
        ...candidate,
        normalizedText,
        tokens,
      };
    })
    .filter(Boolean);

  if (normalizedCandidates.length === 0) {
    return null;
  }

  const scoredCandidates = normalizedCandidates.map((candidate) => {
    const dictionaryScore = scoreDictionaryCoverage(
      candidate.normalizedText,
      candidate.tokens,
      lexicon,
    );
    const phraseSupportScore = scoreClosestPhraseSupport(
      candidate.normalizedText,
      candidate.tokens,
      lexicon,
    );

    const consensusScores = normalizedCandidates
      .filter((other) => other.language !== candidate.language)
      .map((other) => {
        const maxLength = Math.max(candidate.normalizedText.length, other.normalizedText.length);
        const textSimilarity =
          maxLength > 0
            ? 1 - levenshteinDistance(candidate.normalizedText, other.normalizedText) / maxLength
            : 0;
        const tokenSimilarity = tokenJaccardSimilarity(candidate.tokens, other.tokens);
        return textSimilarity * 0.6 + tokenSimilarity * 0.4;
      });

    const consensusScore =
      consensusScores.length > 0
        ? consensusScores.reduce((sum, score) => sum + score, 0) / consensusScores.length
        : 0;

    const shortTextPenalty = candidate.tokens.length <= 1 ? -0.08 : 0;
    const primaryLanguageBoost = candidate.language === languageOrder[0] ? 0.03 : 0;
    const finalScore =
      dictionaryScore * 0.48 +
      phraseSupportScore * 0.22 +
      consensusScore * 0.27 +
      primaryLanguageBoost +
      shortTextPenalty;

    return {
      ...candidate,
      score: finalScore,
      scoreBreakdown: {
        dictionary: Number(dictionaryScore.toFixed(4)),
        phraseSupport: Number(phraseSupportScore.toFixed(4)),
        consensus: Number(consensusScore.toFixed(4)),
        primaryBoost: Number(primaryLanguageBoost.toFixed(4)),
        shortPenalty: Number(shortTextPenalty.toFixed(4)),
        total: Number(finalScore.toFixed(4)),
      },
    };
  });

  scoredCandidates.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    return languageOrder.indexOf(left.language) - languageOrder.indexOf(right.language);
  });

  return {
    best: scoredCandidates[0],
    scored: scoredCandidates,
  };
};

/**
 * @param {NodeJS.ProcessEnv} env
 */
export const buildRuntimeConfig = (env = process.env) => {
  const rawOmniBaseUrl = env.OMNIASR_BASE_URL ?? DEFAULT_OMNIASR_BASE_URL;
  const omniBaseUrl = rawOmniBaseUrl.replace(/\/$/, '');

  const corsOrigins = parseCorsOrigins(env.AI_HELPER_CORS_ORIGINS);

  return {
    port: parsePositiveInteger(env.AI_HELPER_PORT ?? env.PORT, DEFAULT_PORT),
    timeoutMs: parsePositiveInteger(env.OMNIASR_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
    omniBaseUrl,
    omniLanguage: env.OMNIASR_LANGUAGE?.trim() || DEFAULT_OMNIASR_LANGUAGE,
    recordingsBucket: env.SUPABASE_RECORDINGS_BUCKET?.trim() || DEFAULT_RECORDINGS_BUCKET,
    supabaseUrl: (env.SUPABASE_URL ?? env.VITE_SUPABASE_URL ?? '').trim(),
    supabaseServiceRoleKey: (env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim(),
    corsOrigins,
    allowAnyCorsOrigin: corsOrigins.includes('*'),
  };
};

/**
 * @param {string} origin
 * @param {ReturnType<typeof buildRuntimeConfig>} config
 */
const resolveCorsOrigin = (origin, config) => {
  if (config.allowAnyCorsOrigin) {
    return '*';
  }

  if (origin && config.corsOrigins.includes(origin)) {
    return origin;
  }

  return '';
};

/**
 * @param {import('node:http').ServerResponse} response
 * @param {import('node:http').IncomingMessage} request
 * @param {ReturnType<typeof buildRuntimeConfig>} config
 */
const setCorsHeaders = (response, request, config) => {
  const requestOrigin = request.headers.origin ?? '';
  const corsOrigin = resolveCorsOrigin(requestOrigin, config);

  if (corsOrigin) {
    response.setHeader('Access-Control-Allow-Origin', corsOrigin);
  }
  if (!config.allowAnyCorsOrigin) {
    response.setHeader('Vary', 'Origin');
  }

  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

/**
 * @param {import('node:http').IncomingMessage} request
 */
const readJsonBody = async (request) => {
  const chunks = [];
  let totalBytes = 0;

  for await (const chunk of request) {
    const bufferChunk = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += bufferChunk.length;

    if (totalBytes > MAX_JSON_BODY_BYTES) {
      throw new HttpError(413, 'Request body is too large.', 'request_too_large');
    }

    chunks.push(bufferChunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  try {
    const body = Buffer.concat(chunks).toString('utf8');
    return JSON.parse(body);
  } catch {
    throw new HttpError(400, 'Invalid JSON payload.', 'invalid_json');
  }
};

/**
 * @param {import('node:http').ServerResponse} response
 * @param {number} statusCode
 * @param {unknown} payload
 * @param {import('node:http').IncomingMessage} request
 * @param {ReturnType<typeof buildRuntimeConfig>} config
 */
const sendJson = (response, statusCode, payload, request, config) => {
  setCorsHeaders(response, request, config);
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(payload));
};

/**
 * @param {string} url
 * @param {RequestInit} options
 * @param {number} timeoutMs
 */
const fetchWithTimeout = async (url, options, timeoutMs) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new HttpError(504, 'Upstream ASR request timed out.', 'upstream_timeout');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

/**
 * @param {string} sourceUrl
 */
const filenameFromHttpUrl = (sourceUrl) => {
  try {
    const { pathname } = new URL(sourceUrl);
    const maybeName = pathname.split('/').pop() ?? '';
    return sanitizeFilename(maybeName);
  } catch {
    return 'recording.webm';
  }
};

/**
 * @param {string} sourceUrl
 * @param {ReturnType<typeof buildRuntimeConfig>} config
 */
const downloadFromHttpUrl = async (sourceUrl, config) => {
  // Block SSRF: reject private, loopback, and link-local addresses.
  const parsed = new URL(sourceUrl);
  const hostname = parsed.hostname;
  const BLOCKED_PATTERNS = [
    /^localhost$/i,
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
    /^169\.254\./,
    /^0\./,
    /^\[::1\]$/,
    /^\[fc/i,
    /^\[fd/i,
    /^\[fe80:/i,
    /^\[::ffff:/i,
  ];
  if (BLOCKED_PATTERNS.some((pattern) => pattern.test(hostname))) {
    throw new HttpError(
      400,
      'audio_url must not point to a private or loopback address.',
      'blocked_url',
    );
  }

  // DNS rebinding protection: resolve hostname and verify the resolved IP
  // is not private before issuing the actual HTTP request.
  const isPrivateIp = (ip) => {
    if (ip === '127.0.0.1' || ip === '::1') return true;
    const parts = ip.split('.');
    if (parts.length === 4) {
      const [a, b] = parts.map(Number);
      if (a === 10) return true;
      if (a === 172 && b >= 16 && b <= 31) return true;
      if (a === 192 && b === 168) return true;
      if (a === 169 && b === 254) return true;
      if (a === 0) return true;
      if (a === 127) return true;
    }
    // IPv6 private ranges
    const lower = ip.toLowerCase();
    if (
      lower.startsWith('fc') ||
      lower.startsWith('fd') ||
      lower.startsWith('fe80:') ||
      lower.startsWith('::ffff:')
    )
      return true;
    return false;
  };
  try {
    const { address } = await dns.lookup(hostname);
    if (isPrivateIp(address)) {
      throw new HttpError(400, 'audio_url resolved to a private address.', 'blocked_url');
    }
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(400, `Could not resolve hostname: ${hostname}`, 'blocked_url');
  }

  const response = await fetchWithTimeout(sourceUrl, { method: 'GET' }, config.timeoutMs);

  if (!response.ok) {
    throw new HttpError(
      502,
      `Failed to download source audio (status ${response.status}).`,
      'source_download_failed',
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  const mimeType = response.headers.get('content-type')?.split(';')[0] || 'audio/webm';

  return {
    bytes: new Uint8Array(arrayBuffer),
    mimeType,
    filename: filenameFromHttpUrl(sourceUrl),
  };
};

/**
 * @param {ReturnType<typeof buildRuntimeConfig>} config
 */
const createSupabaseServiceClient = (config) => {
  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
    throw new HttpError(
      500,
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for this request.',
      'missing_supabase_credentials',
    );
  }

  return createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
};

/**
 * @param {string} storagePath
 * @param {ReturnType<typeof buildRuntimeConfig>} config
 */
const downloadFromSupabaseStorage = async (storagePath, config) => {
  const normalizedPath = normalizeStoragePath(storagePath, config.recordingsBucket);
  if (!normalizedPath) {
    throw new HttpError(400, 'audio_url storage path is empty.', 'invalid_audio_url');
  }

  const supabase = createSupabaseServiceClient(config);
  const { data, error } = await supabase.storage
    .from(config.recordingsBucket)
    .download(normalizedPath);

  if (error || !data) {
    throw new HttpError(
      502,
      `Failed to read audio from storage path "${normalizedPath}".`,
      'storage_download_failed',
      { message: error?.message ?? 'Unknown error' },
    );
  }

  const arrayBuffer = await data.arrayBuffer();

  return {
    bytes: new Uint8Array(arrayBuffer),
    mimeType: data.type || guessMimeType(normalizedPath),
    filename: sanitizeFilename(normalizedPath.split('/').pop() ?? 'recording.webm'),
  };
};

/**
 * @param {string} audioSource
 * @param {ReturnType<typeof buildRuntimeConfig>} config
 */
const downloadAudioSource = async (audioSource, config) => {
  if (isHttpUrl(audioSource)) {
    return downloadFromHttpUrl(audioSource, config);
  }
  return downloadFromSupabaseStorage(audioSource, config);
};

/**
 * @param {ReturnType<typeof buildRuntimeConfig>} config
 */
const loadSemaiWordsFromSupabase = async (config) => {
  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
    return [];
  }

  const supabase = createSupabaseServiceClient(config);

  for (const column of WORDS_TABLE_SEMAI_COLUMNS) {
    const { data, error } = await supabase.from('words').select(column).limit(5000);
    if (error) {
      const message = error.message ?? '';
      if (message.includes('does not exist')) {
        continue;
      }

      console.warn(`[ai-helper] unable to load words dictionary (${column}):`, error);
      return [];
    }

    return buildTokenSetFromRows(data, column);
  }

  return [];
};

const loadSemaiWordRowsFromSupabase = async (config) => {
  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
    return [];
  }

  const supabase = createSupabaseServiceClient(config);
  const { data, error } = await supabase.from('words').select('id,semai_word,semai').limit(5000);

  if (error) {
    console.warn('[ai-helper] unable to load words rows:', error);
    return [];
  }

  return Array.isArray(data) ? data : [];
};

/**
 * @param {ReturnType<typeof buildRuntimeConfig>} config
 */
const loadVerifiedRecordingsFromSupabase = async (config) => {
  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
    return [];
  }

  const supabase = createSupabaseServiceClient(config);
  const { data, error } = await supabase
    .from('recordings')
    .select('id,verified_transcription,transcription,is_verified')
    .eq('is_verified', true)
    .limit(5000);

  if (error) {
    console.warn('[ai-helper] unable to load verified recording corpus:', error);
    return [];
  }

  return Array.isArray(data) ? data : [];
};

/**
 * @param {ReturnType<typeof buildRuntimeConfig>} config
 */
const getSemaiRuntimeLexicon = async (config) => {
  const now = Date.now();
  if (lexiconCache.expiresAt > now) {
    return lexiconCache;
  }

  const [webonaryTerms, webonarySentenceEntries, wordsTerms, wordRows, verifiedRecordingRows] =
    await Promise.all([
      Promise.resolve(tryLoadWebonaryDictionaryTerms()),
      Promise.resolve(tryLoadWebonarySentenceEntries()),
      loadSemaiWordsFromSupabase(config),
      loadSemaiWordRowsFromSupabase(config),
      loadVerifiedRecordingsFromSupabase(config),
    ]);

  const verifiedRecordingTerms = buildVerifiedRecordingTermsFromRows(verifiedRecordingRows);
  const verifiedWordEntries = buildVerifiedWordEntries(wordRows);
  const verifiedRecordingSentenceEntries =
    buildVerifiedRecordingSentenceEntries(verifiedRecordingRows);
  const verifiedPhraseEntries = buildVerifiedPhraseEntriesFromWords(wordRows);

  const mergedTerms = mergeUniqueTerms(
    CURATED_SEMAI_TERMS,
    webonaryTerms,
    wordsTerms,
    verifiedRecordingTerms,
  );
  const nextLexicon = mergedTerms.length > 0 ? buildLexicon(mergedTerms) : CURATED_LEXICON;

  lexiconCache = {
    expiresAt: now + LEXICON_CACHE_TTL_MS,
    lexicon: nextLexicon,
    sentenceEntries: buildUniqueSentenceEntries(
      webonarySentenceEntries,
      verifiedRecordingSentenceEntries,
      verifiedPhraseEntries,
    ),
    wordEntries: buildUniqueWordEntries(
      buildWordEntriesFromTerms(CURATED_SEMAI_TERMS, 'dictionary'),
      buildWordEntriesFromTerms(webonaryTerms, 'dictionary'),
      verifiedWordEntries,
    ),
    source:
      mergedTerms.length > 0 ? 'curated+webonary+verified_words+verified_recordings' : 'curated',
  };

  return lexiconCache;
};

/**
 * @param {{ bytes: Uint8Array; mimeType: string; filename: string }} audioFile
 * @param {ReturnType<typeof buildRuntimeConfig>} config
 * @param {string} language
 */
const requestOmniAsrTranscription = async (audioFile, config, language) => {
  const formData = new FormData();
  const blob = new Blob([audioFile.bytes], { type: audioFile.mimeType });

  formData.set('media', blob, audioFile.filename);
  formData.set('language', language);

  const response = await fetchWithTimeout(
    `${config.omniBaseUrl}/transcribe`,
    { method: 'POST', body: formData },
    config.timeoutMs,
  );

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  const transcription = extractTranscriptionFromPayload(payload);
  if (!response.ok && transcription.length === 0) {
    const providerError =
      payload && typeof payload === 'object' && typeof payload.error === 'string'
        ? payload.error
        : `OmniASR request failed with status ${response.status}.`;

    throw new HttpError(502, providerError, 'omniasr_failed', {
      providerStatus: response.status,
      providerPayload: payload,
    });
  }

  return transcription;
};

/**
 * @param {{ bytes: Uint8Array; mimeType: string; filename: string }} audioFile
 * @param {ReturnType<typeof buildRuntimeConfig>} config
 * @param {string[]} languages
 */
const requestOmniAsrEnsemble = async (audioFile, config, languages) => {
  const candidates = [];
  const errors = [];

  for (const language of languages) {
    try {
      const transcription = await requestOmniAsrTranscription(audioFile, config, language);
      if (transcription.trim().length > 0) {
        candidates.push({
          language,
          transcription,
          error: null,
        });
      }
    } catch (error) {
      errors.push({
        language,
        error: error instanceof Error ? error.message : 'Unknown ASR error',
      });
    }
  }

  if (candidates.length > 0) {
    return candidates;
  }

  const firstError = errors[0];
  if (firstError) {
    throw new HttpError(502, firstError.error, 'omniasr_failed', { errors });
  }

  throw new HttpError(502, 'All OmniASR ensemble requests failed.', 'omniasr_failed');
};

/**
 * @param {import('node:http').IncomingMessage} request
 * @param {import('node:http').ServerResponse} response
 * @param {ReturnType<typeof buildRuntimeConfig>} config
 * @param {URL} requestUrl
 */
const handleHealth = async (request, response, config, requestUrl) => {
  const deep = requestUrl.searchParams.get('deep') === '1';
  const ensembleLanguages = buildAsrLanguageOrder(config.omniLanguage);
  const payload = {
    status: 'ok',
    service: 'ai-helper',
    provider: 'omniasr',
    language: config.omniLanguage,
    ensembleLanguages,
    ensemble_languages: ensembleLanguages,
    omniBaseUrl: config.omniBaseUrl,
    timestamp: new Date().toISOString(),
  };

  if (deep) {
    try {
      const upstreamResponse = await fetchWithTimeout(
        `${config.omniBaseUrl}/health`,
        { method: 'GET' },
        Math.min(config.timeoutMs, 10_000),
      );

      payload.omniHealthStatus = upstreamResponse.status;
      if (upstreamResponse.ok) {
        payload.omniHealth = await upstreamResponse.json();
      } else {
        payload.status = 'degraded';
      }
    } catch (error) {
      payload.status = 'degraded';
      payload.omniHealthError =
        error instanceof Error ? error.message : 'Unknown upstream health error';
    }
  }

  sendJson(response, payload.status === 'ok' ? 200 : 503, payload, request, config);
};

/**
 * @param {import('node:http').IncomingMessage} request
 * @param {import('node:http').ServerResponse} response
 * @param {ReturnType<typeof buildRuntimeConfig>} config
 */
const handleTranscribe = async (request, response, config) => {
  // Require a valid Supabase session JWT in Authorization header.
  const authHeader = request.headers['authorization'] ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) {
    throw new HttpError(401, 'Authorization header with Bearer token is required.', 'unauthorized');
  }
  const supabaseAuth = createSupabaseServiceClient(config);
  const {
    data: { user },
    error: authError,
  } = await supabaseAuth.auth.getUser(token);
  if (authError || !user) {
    throw new HttpError(401, 'Invalid or expired authentication token.', 'unauthorized');
  }

  const payload = await readJsonBody(request);
  const audioUrl = payload?.audio_url;
  const recordingType =
    payload?.recording_type === 'word' || payload?.recording_type === 'song'
      ? payload.recording_type
      : 'story';

  if (typeof audioUrl !== 'string' || audioUrl.trim().length === 0) {
    throw new HttpError(
      400,
      'audio_url is required and must be a non-empty string.',
      'invalid_audio_url',
    );
  }

  const audioFile = await downloadAudioSource(audioUrl.trim(), config);
  const languageOrder = buildAsrLanguageOrder(config.omniLanguage);
  const candidates = await requestOmniAsrEnsemble(audioFile, config, languageOrder);
  const runtimeLexicon = await getSemaiRuntimeLexicon(config);
  const selected = chooseBestAsrCandidate(candidates, runtimeLexicon.lexicon, languageOrder);
  const fallbackCandidate = candidates.find(
    (candidate) => candidate.language === config.omniLanguage,
  );
  const winner = selected?.best ?? fallbackCandidate ?? candidates[0];
  const rankedCandidates =
    selected?.scored ??
    candidates.map((candidate, index) => ({
      ...candidate,
      score: Math.max(0.1, 1 - index * 0.1),
    }));
  const mergedDraft = mergeAsrCandidateTokens(rankedCandidates, runtimeLexicon.lexicon);
  const baseDraftText = mergedDraft?.mergedText ?? winner.transcription;
  const sentenceMatchResult = getTopSentenceMatch(
    baseDraftText,
    runtimeLexicon.sentenceEntries,
    recordingType,
  );
  const wordCorrectionResult = sentenceMatchResult?.best?.applied
    ? {
        correctedText: sentenceMatchResult.best.semai,
        replacements: [],
      }
    : buildWordReplacementResult(
        baseDraftText,
        runtimeLexicon.wordEntries.length > 0
          ? runtimeLexicon.wordEntries
          : buildLexiconWordEntries(runtimeLexicon.lexicon),
        rankedCandidates,
      );
  const autoTranscription =
    sentenceMatchResult?.best?.applied === true
      ? sentenceMatchResult.best.semai
      : wordCorrectionResult.correctedText || baseDraftText;

  sendJson(
    response,
    200,
    {
      transcription: autoTranscription || winner.transcription,
      raw_transcription: winner.transcription,
      auto_transcription: autoTranscription || winner.transcription,
      transcription_match: sentenceMatchResult?.best
        ? {
            id: sentenceMatchResult.best.id,
            source: sentenceMatchResult.best.source,
            semai: sentenceMatchResult.best.semai,
            score: Number(sentenceMatchResult.best.score.toFixed(4)),
            match_type: sentenceMatchResult.best.matchType,
            headword: sentenceMatchResult.best.headword ?? null,
            applied: sentenceMatchResult.best.applied === true,
          }
        : null,
      transcription_word_replacements: wordCorrectionResult.replacements,
      provider: 'omniasr',
      language: winner.language,
      candidates: rankedCandidates.map((candidate) => ({
        language: candidate.language,
        transcription: candidate.transcription,
        score: Number(candidate.score.toFixed(4)),
        scoreBreakdown: candidate.scoreBreakdown ?? null,
      })),
      requestedLanguages: languageOrder,
      requested_languages: languageOrder,
      lexiconSource: runtimeLexicon.source,
      lexicon_source: runtimeLexicon.source,
      merge: mergedDraft
        ? {
            average_coverage: Number(mergedDraft.averageCoverage.toFixed(4)),
            used_fallback: mergedDraft.usedFallback,
          }
        : null,
    },
    request,
    config,
  );
};

/**
 * @param {unknown} error
 */
const toErrorPayload = (error) => {
  if (error instanceof HttpError) {
    return {
      statusCode: error.statusCode,
      body: {
        error: error.message,
        code: error.code,
        details: error.details,
      },
    };
  }

  const message = error instanceof Error ? error.message : 'Unknown server error';
  return {
    statusCode: 500,
    body: {
      error: message,
      code: 'internal_error',
    },
  };
};

/**
 * @param {ReturnType<typeof buildRuntimeConfig>} [config]
 */
export const createAiHelperServer = (config = buildRuntimeConfig()) =>
  createServer(async (request, response) => {
    const requestUrl = new URL(request.url ?? '/', 'http://localhost');
    const method = (request.method ?? 'GET').toUpperCase();

    if (method === 'OPTIONS') {
      setCorsHeaders(response, request, config);
      response.statusCode = 204;
      response.end();
      return;
    }

    try {
      if (method === 'GET' && requestUrl.pathname === '/health') {
        await handleHealth(request, response, config, requestUrl);
        return;
      }

      if (method === 'POST' && requestUrl.pathname === '/ai/transcribe') {
        await handleTranscribe(request, response, config);
        return;
      }

      sendJson(response, 404, { error: 'Endpoint not found.', code: 'not_found' }, request, config);
    } catch (error) {
      const { statusCode, body } = toErrorPayload(error);
      console.error('[ai-helper] request failed:', error);
      sendJson(response, statusCode, body, request, config);
    }
  });

const isMainModule = () => {
  if (!process.argv[1]) {
    return false;
  }
  return pathToFileURL(process.argv[1]).href === import.meta.url;
};

if (isMainModule()) {
  loadEnvFileIfPresent(join(process.cwd(), '.env'));
  const config = buildRuntimeConfig();
  const server = createAiHelperServer(config);

  server.listen(config.port, () => {
    console.log(
      `[ai-helper] listening on http://localhost:${config.port} (provider: ${config.omniBaseUrl}, language: ${config.omniLanguage})`,
    );
  });
}
