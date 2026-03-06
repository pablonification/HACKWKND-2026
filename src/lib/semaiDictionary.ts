import rawWebonaryEntries from '../../docs/plan/source/webonary-semai-parsed.json';
import { normalizeSemaiText, tokenizeSemaiText } from './semaiText';

type RawGlossaryEntry = {
  id: string;
  semai: string;
  ms: string;
  category: string;
  source: string;
};

type RawSentenceExampleEntry = {
  id: string;
  semai: string;
  ms: string;
  headword: string;
  source: string;
};

type PreparedGlossaryEntry = RawGlossaryEntry & {
  normalizedSemai: string;
  tokens: string[];
};

type PreparedSentenceExampleEntry = RawSentenceExampleEntry & {
  normalizedSemai: string;
  tokens: string[];
};

type PreparedDictionary = {
  glossaryEntries: PreparedGlossaryEntry[];
  singleWordGlossaryEntries: PreparedGlossaryEntry[];
  glossaryExactMap: Map<string, PreparedGlossaryEntry[]>;
  sentenceExamples: PreparedSentenceExampleEntry[];
  sentenceExactMap: Map<string, PreparedSentenceExampleEntry[]>;
};

type RawWebonarySense = {
  definition_en?: string;
  definition_ms?: string;
  examples?: Array<{
    semai?: string;
    en?: string;
    ms?: string;
  }>;
};

type RawWebonaryEntry = {
  id?: string;
  word?: string;
  words?: string[];
  pos_ms?: string;
  senses?: RawWebonarySense[];
};

export type SemaiDictionaryHint = {
  id: string;
  semai: string;
  ms: string;
  source: string;
  matchedText: string;
  matchType:
    | 'sentence_exact'
    | 'sentence_fuzzy'
    | 'exact'
    | 'phrase_fuzzy'
    | 'token_exact'
    | 'token_fuzzy';
  scope: 'sentence' | 'transcript' | 'token';
  confidence: 'high' | 'medium';
  score: number;
  kind: 'sentence_example' | 'glossary';
  category?: string;
  headword?: string;
};

let dictionaryPromise: Promise<PreparedDictionary> | null = null;

const buildExactMap = <T extends { normalizedSemai: string }>(entries: T[]): Map<string, T[]> => {
  const exactMap = new Map<string, T[]>();

  for (const entry of entries) {
    const current = exactMap.get(entry.normalizedSemai) ?? [];
    current.push(entry);
    exactMap.set(entry.normalizedSemai, current);
  }

  return exactMap;
};

const buildPreparedDictionary = (
  glossaryEntries: RawGlossaryEntry[],
  sentenceExamples: RawSentenceExampleEntry[],
): PreparedDictionary => {
  const dedupedGlossaryEntries = new Map<string, PreparedGlossaryEntry>();
  const dedupedSentenceExamples = new Map<string, PreparedSentenceExampleEntry>();

  for (const entry of glossaryEntries) {
    if (!entry?.semai?.trim() || !entry?.ms?.trim()) {
      continue;
    }

    const normalizedSemai = normalizeSemaiText(entry.semai);
    if (!normalizedSemai) {
      continue;
    }

    const dedupeKey = `${normalizedSemai}::${entry.ms.trim().toLowerCase()}`;
    if (dedupedGlossaryEntries.has(dedupeKey)) {
      continue;
    }

    dedupedGlossaryEntries.set(dedupeKey, {
      ...entry,
      normalizedSemai,
      tokens: tokenizeSemaiText(entry.semai),
    });
  }

  for (const entry of sentenceExamples) {
    if (!entry?.semai?.trim() || !entry?.ms?.trim()) {
      continue;
    }

    const normalizedSemai = normalizeSemaiText(entry.semai);
    if (!normalizedSemai) {
      continue;
    }

    const dedupeKey = `${normalizedSemai}::${entry.ms.trim().toLowerCase()}`;
    if (dedupedSentenceExamples.has(dedupeKey)) {
      continue;
    }

    dedupedSentenceExamples.set(dedupeKey, {
      ...entry,
      normalizedSemai,
      tokens: tokenizeSemaiText(entry.semai),
    });
  }

  const preparedGlossaryEntries = [...dedupedGlossaryEntries.values()];
  const preparedSentenceExamples = [...dedupedSentenceExamples.values()];

  return {
    glossaryEntries: preparedGlossaryEntries,
    singleWordGlossaryEntries: preparedGlossaryEntries.filter((entry) => entry.tokens.length === 1),
    glossaryExactMap: buildExactMap(preparedGlossaryEntries),
    sentenceExamples: preparedSentenceExamples,
    sentenceExactMap: buildExactMap(preparedSentenceExamples),
  };
};

const getWebonaryHeadwords = (entry: RawWebonaryEntry): string[] => {
  const sourceWords =
    Array.isArray(entry.words) && entry.words.length > 0 ? entry.words : [entry.word];
  return sourceWords
    .map((word) => (typeof word === 'string' ? word.trim() : ''))
    .filter((word) => word.length > 0);
};

const buildRawWebonaryGlossary = (entries: RawWebonaryEntry[]): RawGlossaryEntry[] => {
  const glossaryEntries: RawGlossaryEntry[] = [];

  for (const entry of entries) {
    const headwords = getWebonaryHeadwords(entry);
    const senses = Array.isArray(entry.senses) ? entry.senses : [];

    for (const [senseIndex, sense] of senses.entries()) {
      const definition =
        (typeof sense.definition_ms === 'string' && sense.definition_ms.trim()) ||
        (typeof sense.definition_en === 'string' && sense.definition_en.trim()) ||
        '';

      if (!definition) {
        continue;
      }

      for (const [headwordIndex, headword] of headwords.entries()) {
        glossaryEntries.push({
          id: `${entry.id ?? headword}-${senseIndex}-${headwordIndex}`,
          semai: headword,
          ms: definition,
          category: entry.pos_ms?.trim() || '',
          source: 'webonary_glossary',
        });
      }
    }
  }

  return glossaryEntries;
};

const buildRawWebonarySentenceExamples = (
  entries: RawWebonaryEntry[],
): RawSentenceExampleEntry[] => {
  const sentenceExamples: RawSentenceExampleEntry[] = [];

  for (const entry of entries) {
    const headword = getWebonaryHeadwords(entry)[0] ?? '';
    const senses = Array.isArray(entry.senses) ? entry.senses : [];

    for (const [senseIndex, sense] of senses.entries()) {
      const examples = Array.isArray(sense.examples) ? sense.examples : [];

      for (const [exampleIndex, example] of examples.entries()) {
        const semai = typeof example.semai === 'string' ? example.semai.trim() : '';
        const ms =
          (typeof example.ms === 'string' && example.ms.trim()) ||
          (typeof example.en === 'string' && example.en.trim()) ||
          '';

        if (!semai || !ms) {
          continue;
        }

        sentenceExamples.push({
          id: `${entry.id ?? headword}-${senseIndex}-example-${exampleIndex}`,
          semai,
          ms,
          headword,
          source: 'webonary_sentence',
        });
      }
    }
  }

  return sentenceExamples;
};

const getPreparedDictionary = async (): Promise<PreparedDictionary> => {
  if (!dictionaryPromise) {
    const entries = rawWebonaryEntries as RawWebonaryEntry[];
    dictionaryPromise = Promise.resolve(
      buildPreparedDictionary(
        buildRawWebonaryGlossary(entries),
        buildRawWebonarySentenceExamples(entries),
      ),
    );
  }

  return dictionaryPromise;
};

const levenshteinDistance = (left: string, right: string): number => {
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

  for (let row = 1; row <= left.length; row += 1) {
    current[0] = row;

    for (let column = 1; column <= right.length; column += 1) {
      const substitutionCost = left[row - 1] === right[column - 1] ? 0 : 1;
      current[column] = Math.min(
        previous[column] + 1,
        current[column - 1] + 1,
        previous[column - 1] + substitutionCost,
      );
    }

    for (let column = 0; column <= right.length; column += 1) {
      previous[column] = current[column];
    }
  }

  return previous[right.length];
};

const scoreFuzzyMatch = (input: string, candidate: string): number => {
  const maxLength = Math.max(input.length, candidate.length);
  if (maxLength === 0) {
    return 0;
  }

  return 1 - levenshteinDistance(input, candidate) / maxLength;
};

const tokenJaccardSimilarity = (leftTokens: string[], rightTokens: string[]): number => {
  if (leftTokens.length === 0 || rightTokens.length === 0) {
    return 0;
  }

  const leftSet = new Set(leftTokens);
  const rightSet = new Set(rightTokens);
  const intersectionSize = [...leftSet].filter((token) => rightSet.has(token)).length;
  const unionSize = new Set([...leftSet, ...rightSet]).size;

  if (unionSize === 0) {
    return 0;
  }

  return intersectionSize / unionSize;
};

const computeSentenceSimilarity = (input: string, candidate: string): number => {
  const normalizedInput = normalizeSemaiText(input);
  const normalizedCandidate = normalizeSemaiText(candidate);
  if (!normalizedInput || !normalizedCandidate) {
    return 0;
  }

  const inputTokens = tokenizeSemaiText(input);
  const candidateTokens = tokenizeSemaiText(candidate);
  const tokenSimilarity = tokenJaccardSimilarity(inputTokens, candidateTokens);
  const textSimilarity = scoreFuzzyMatch(normalizedInput, normalizedCandidate);

  let score = tokenSimilarity * 0.62 + textSimilarity * 0.38;

  if (
    normalizedInput.includes(normalizedCandidate) ||
    normalizedCandidate.includes(normalizedInput)
  ) {
    score += 0.14;
  }

  return Math.min(1, score);
};

const toHint = (
  entry: PreparedGlossaryEntry | PreparedSentenceExampleEntry,
  matchedText: string,
  matchType: SemaiDictionaryHint['matchType'],
  scope: SemaiDictionaryHint['scope'],
  confidence: SemaiDictionaryHint['confidence'],
  score: number,
  kind: SemaiDictionaryHint['kind'],
): SemaiDictionaryHint => ({
  id: entry.id,
  semai: entry.semai,
  ms: entry.ms,
  source: entry.source,
  matchedText,
  matchType,
  scope,
  confidence,
  score: Number(score.toFixed(4)),
  kind,
  category: 'category' in entry ? entry.category : undefined,
  headword: 'headword' in entry ? entry.headword : undefined,
});

const rankSentenceExampleHints = (
  text: string,
  dictionary: PreparedDictionary,
): SemaiDictionaryHint[] => {
  const normalizedText = normalizeSemaiText(text);
  const transcriptTokens = tokenizeSemaiText(text);
  if (!normalizedText || transcriptTokens.length === 0) {
    return [];
  }

  const hints: SemaiDictionaryHint[] = [];
  const exactExamples = dictionary.sentenceExactMap.get(normalizedText) ?? [];

  for (const example of exactExamples.slice(0, 2)) {
    hints.push(
      toHint(example, example.semai, 'sentence_exact', 'sentence', 'high', 1, 'sentence_example'),
    );
  }

  if (exactExamples.length > 0) {
    return hints;
  }

  const fuzzyExamples = dictionary.sentenceExamples
    .map((entry) => {
      const score = computeSentenceSimilarity(text, entry.semai);
      return {
        entry,
        score,
        lengthDelta: Math.abs(entry.tokens.length - transcriptTokens.length),
      };
    })
    .filter(
      ({ entry, score, lengthDelta }) =>
        entry.normalizedSemai !== normalizedText &&
        score >= 0.34 &&
        lengthDelta <= Math.max(5, transcriptTokens.length),
    )
    .sort((left, right) => right.score - left.score || left.lengthDelta - right.lengthDelta)
    .slice(0, 3);

  for (const candidate of fuzzyExamples) {
    hints.push(
      toHint(
        candidate.entry,
        text.trim(),
        'sentence_fuzzy',
        'sentence',
        candidate.score >= 0.72 ? 'high' : 'medium',
        candidate.score,
        'sentence_example',
      ),
    );
  }

  return hints;
};

export const findSemaiDictionaryHints = async (text: string): Promise<SemaiDictionaryHint[]> => {
  const normalizedText = normalizeSemaiText(text);
  if (!normalizedText) {
    return [];
  }

  const dictionary = await getPreparedDictionary();
  const transcriptTokens = tokenizeSemaiText(text);
  const hints = rankSentenceExampleHints(text, dictionary);
  const seenHintKeys = new Set(
    hints.map((hint) => `${hint.kind}:${hint.id}:${hint.matchType}:${hint.matchedText}`),
  );

  const addHint = (hint: SemaiDictionaryHint) => {
    const hintKey = `${hint.kind}:${hint.id}:${hint.matchType}:${hint.matchedText}`;
    if (seenHintKeys.has(hintKey)) {
      return;
    }

    seenHintKeys.add(hintKey);
    hints.push(hint);
  };

  if (transcriptTokens.length > 0 && transcriptTokens.length <= 4) {
    const fuzzyPhraseCandidates = dictionary.glossaryEntries
      .filter((entry) => Math.abs(entry.tokens.length - transcriptTokens.length) <= 1)
      .map((entry) => ({
        entry,
        score: scoreFuzzyMatch(normalizedText, entry.normalizedSemai),
      }))
      .filter(({ score }) => score >= 0.68)
      .sort((left, right) => right.score - left.score)
      .slice(0, 3);

    for (const candidate of fuzzyPhraseCandidates) {
      if (candidate.entry.normalizedSemai === normalizedText) {
        continue;
      }

      addHint(
        toHint(
          candidate.entry,
          text.trim(),
          'phrase_fuzzy',
          'transcript',
          candidate.score >= 0.82 ? 'high' : 'medium',
          candidate.score,
          'glossary',
        ),
      );
    }
  }

  const uniqueTokens = [...new Set(transcriptTokens)];

  for (const token of uniqueTokens) {
    if (token.length < 4) {
      continue;
    }

    const fuzzyTokenCandidates = dictionary.singleWordGlossaryEntries
      .map((entry) => ({
        entry,
        score: scoreFuzzyMatch(token, entry.normalizedSemai),
      }))
      .filter(({ score }) => score >= (token.length >= 7 ? 0.68 : 0.74))
      .sort((left, right) => right.score - left.score)
      .slice(0, 2);

    const [bestCandidate, secondCandidate] = fuzzyTokenCandidates;
    if (!bestCandidate) {
      continue;
    }

    if (secondCandidate && Math.abs(bestCandidate.score - secondCandidate.score) < 0.06) {
      continue;
    }

    addHint(
      toHint(
        bestCandidate.entry,
        token,
        'token_fuzzy',
        'token',
        bestCandidate.score >= 0.84 ? 'high' : 'medium',
        bestCandidate.score,
        'glossary',
      ),
    );
  }

  const actionableHints = hints.filter((hint) => {
    if (hint.kind === 'sentence_example') {
      return true;
    }

    const normalizedMatchedText = normalizeSemaiText(hint.matchedText);
    return normalizedMatchedText !== normalizeSemaiText(hint.semai);
  });

  return actionableHints.sort((left, right) => {
    const priority = {
      sentence_exact: 0,
      sentence_fuzzy: 1,
      exact: 2,
      phrase_fuzzy: 3,
      token_exact: 4,
      token_fuzzy: 5,
    } as const;

    if (priority[left.matchType] !== priority[right.matchType]) {
      return priority[left.matchType] - priority[right.matchType];
    }

    return right.score - left.score;
  });
};
