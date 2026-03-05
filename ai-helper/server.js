import { Buffer } from 'node:buffer';
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

  return {
    phrases: [...new Set(phrases)],
    tokens: [...tokenSet],
    tokenSet,
  };
};

const CURATED_LEXICON = buildLexicon(CURATED_SEMAI_TERMS);

let lexiconCache = {
  expiresAt: 0,
  lexicon: CURATED_LEXICON,
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

const findBestLexiconReplacement = (token, lexiconTokens) => {
  if (token.length < 4) {
    return token;
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
    return token;
  }

  const threshold = token.length >= 7 ? 2 : 1;
  if (bestDistance > threshold) {
    return token;
  }

  if (secondBestDistance <= bestDistance) {
    return token;
  }

  return bestToken;
};

export const applyLexiconCorrections = (transcription, lexicon) => {
  const normalized = normalizeLexiconText(transcription);
  if (!normalized) {
    return '';
  }

  const corrected = tokenizeLexiconText(normalized).map((token) =>
    findBestLexiconReplacement(token, lexicon.tokens),
  );

  return corrected.join(' ').trim();
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
      dictionaryScore * 0.65 + consensusScore * 0.32 + primaryLanguageBoost + shortTextPenalty;

    return {
      ...candidate,
      score: finalScore,
      scoreBreakdown: {
        dictionary: Number(dictionaryScore.toFixed(4)),
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

/**
 * @param {ReturnType<typeof buildRuntimeConfig>} config
 */
const loadRecordingTermsFromSupabase = async (config) => {
  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
    return [];
  }

  try {
    const supabase = createSupabaseServiceClient(config);
    const { data, error } = await supabase
      .from('recordings')
      .select('title,transcription')
      .order('created_at', { ascending: false })
      .limit(300);

    if (error || !Array.isArray(data)) {
      return [];
    }

    const collected = [];
    for (const row of data) {
      if (!row || typeof row !== 'object') {
        continue;
      }

      const title = Reflect.get(row, 'title');
      if (typeof title === 'string' && title.trim().length > 0) {
        collected.push(title);
      }

      const transcription = Reflect.get(row, 'transcription');
      if (typeof transcription === 'string' && transcription.trim().length > 0) {
        collected.push(transcription);
      }
    }

    return collected;
  } catch (error) {
    console.warn('[ai-helper] unable to load recording terms for lexicon:', error);
    return [];
  }
};

/**
 * @param {ReturnType<typeof buildRuntimeConfig>} config
 */
const getSemaiRuntimeLexicon = async (config) => {
  const now = Date.now();
  if (lexiconCache.expiresAt > now) {
    return lexiconCache;
  }

  const [webonaryTerms, wordsTerms, recordingTerms] = await Promise.all([
    Promise.resolve(tryLoadWebonaryDictionaryTerms()),
    loadSemaiWordsFromSupabase(config),
    loadRecordingTermsFromSupabase(config),
  ]);

  const mergedTerms = mergeUniqueTerms(
    CURATED_SEMAI_TERMS,
    webonaryTerms,
    wordsTerms,
    recordingTerms,
  );
  const nextLexicon = mergedTerms.length > 0 ? buildLexicon(mergedTerms) : CURATED_LEXICON;

  lexiconCache = {
    expiresAt: now + LEXICON_CACHE_TTL_MS,
    lexicon: nextLexicon,
    source: mergedTerms.length > 0 ? 'curated+runtime' : 'curated',
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
  const payload = await readJsonBody(request);
  const audioUrl = payload?.audio_url;

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
  const correctedTranscription = applyLexiconCorrections(
    winner.transcription,
    runtimeLexicon.lexicon,
  );

  sendJson(
    response,
    200,
    {
      transcription: correctedTranscription || winner.transcription,
      raw_transcription: winner.transcription,
      provider: 'omniasr',
      language: winner.language,
      candidates: selected?.scored.map((candidate) => ({
        language: candidate.language,
        transcription: candidate.transcription,
        score: Number(candidate.score.toFixed(4)),
        scoreBreakdown: candidate.scoreBreakdown,
      })),
      requestedLanguages: languageOrder,
      lexiconSource: runtimeLexicon.source,
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
