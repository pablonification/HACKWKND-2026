import { WEBONARY_GLOSSARY } from './webonaryGlossary.generated.ts';
import { WEBONARY_SENTENCE_EXAMPLES } from './webonarySentenceExamples.generated.ts';

export const SUPPORTED_TRANSLATION_LANGUAGES = ['semai', 'ms', 'en'] as const;

export type TranslationLanguage = (typeof SUPPORTED_TRANSLATION_LANGUAGES)[number];

export type GlossaryEntry = {
  id: string;
  semai: string;
  ms: string;
  en: string;
  category: string;
  source: string;
};

export type SentenceExampleEntry = {
  id: string;
  semai: string;
  ms: string;
  en: string;
  headword: string;
  source: string;
};

// Seeded from docs/final/TUYANG.md Appendix B + expanded MVP terms used in demo.
export const CURATED_SEMAI_GLOSSARY: GlossaryEntry[] = [
  {
    id: 'bobolian',
    semai: 'bobolian',
    ms: 'dukun tradisional',
    en: 'traditional healer',
    category: 'person',
    source: 'TUYANG Appendix B',
  },
  {
    id: 'rumah',
    semai: 'rumah',
    ms: 'rumah',
    en: 'house',
    category: 'building',
    source: 'TUYANG Appendix B',
  },
  {
    id: 'bobohiz',
    semai: 'bobohiz',
    ms: 'arak beras',
    en: 'rice wine',
    category: 'food',
    source: 'TUYANG Appendix B',
  },
  {
    id: 'tong',
    semai: 'tong',
    ms: 'semangat hutan',
    en: 'forest spirit',
    category: 'supernatural',
    source: 'TUYANG Appendix B',
  },
  {
    id: 'hutan',
    semai: 'hutan',
    ms: 'hutan',
    en: 'forest',
    category: 'nature',
    source: 'TUYANG translation MVP',
  },
  {
    id: 'air',
    semai: 'air',
    ms: 'air',
    en: 'water',
    category: 'nature',
    source: 'TUYANG translation MVP',
  },
  {
    id: 'api',
    semai: 'api',
    ms: 'api',
    en: 'fire',
    category: 'nature',
    source: 'TUYANG translation MVP',
  },
  {
    id: 'anak',
    semai: 'anak',
    ms: 'anak',
    en: 'child',
    category: 'family',
    source: 'TUYANG translation MVP',
  },
  {
    id: 'keluarga',
    semai: 'keluarga',
    ms: 'keluarga',
    en: 'family',
    category: 'family',
    source: 'TUYANG translation MVP',
  },
  {
    id: 'terima-kasih',
    semai: 'terima kasih',
    ms: 'terima kasih',
    en: 'thank you',
    category: 'phrase',
    source: 'TUYANG translation MVP',
  },
  {
    id: 'selamat-pagi',
    semai: 'selamat pagi',
    ms: 'selamat pagi',
    en: 'good morning',
    category: 'phrase',
    source: 'TUYANG translation MVP',
  },
  {
    id: 'selamat-malam',
    semai: 'selamat malam',
    ms: 'selamat malam',
    en: 'good night',
    category: 'phrase',
    source: 'TUYANG translation MVP',
  },
  {
    id: 'apa-khabar',
    semai: 'apa khabar',
    ms: 'apa khabar',
    en: 'how are you',
    category: 'phrase',
    source: 'TUYANG translation MVP',
  },
];

const normalizeSemaiKey = (value: string): string =>
  value.trim().replace(/\s+/g, ' ').toLowerCase();

const curatedSemaiTerms = new Set(
  CURATED_SEMAI_GLOSSARY.map((entry) => normalizeSemaiKey(entry.semai)),
);

const deduplicatedWebonaryGlossary = WEBONARY_GLOSSARY.filter(
  (entry) => !curatedSemaiTerms.has(normalizeSemaiKey(entry.semai)),
);

export const SEMAI_GLOSSARY: GlossaryEntry[] = [
  ...CURATED_SEMAI_GLOSSARY,
  ...deduplicatedWebonaryGlossary,
];
export const SEMAI_SENTENCE_EXAMPLES: SentenceExampleEntry[] = WEBONARY_SENTENCE_EXAMPLES;

const isHighPriorityGlossaryEntry = (entry: GlossaryEntry): boolean =>
  normalizeComparable(entry.source).startsWith('tuyang');

export const normalizeTranslationText = (value: string): string =>
  value.trim().replace(/\s+/g, ' ').replace(/[“”]/g, '"').replace(/[‘’]/g, "'");

const GLOSSARY_ENFORCEMENT_MAX_MATCHES = 8;
const SENTENCE_EXAMPLE_PROMPT_MAX_MATCHES = 3;
const SENTENCE_EXAMPLE_MIN_SCORE = 0.22;

const normalizeComparable = (value: string): string =>
  normalizeTranslationText(value).toLowerCase();

const tokenizeComparable = (value: string): string[] =>
  normalizeComparable(value)
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);

const normalizeSentenceComparable = (value: string): string =>
  normalizeComparable(value)
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const containsTerm = (text: string, term: string): boolean => {
  const normalizedText = normalizeComparable(text);
  const normalizedTerm = normalizeComparable(term);

  if (!normalizedTerm) {
    return false;
  }

  const pattern = new RegExp(`(^|\\b)${escapeRegExp(normalizedTerm)}(?=\\b|$)`, 'i');
  return pattern.test(normalizedText);
};

const LANGUAGE_LABELS: Record<TranslationLanguage, string> = {
  semai: 'Semai',
  ms: 'Malay',
  en: 'English',
};

const computeSentenceSimilarity = (input: string, candidate: string): number => {
  const inputTokens = tokenizeComparable(input);
  const candidateTokens = tokenizeComparable(candidate);

  if (inputTokens.length === 0 || candidateTokens.length === 0) {
    return 0;
  }

  const inputSet = new Set(inputTokens);
  const candidateSet = new Set(candidateTokens);
  const intersectionSize = Array.from(inputSet).filter((token) => candidateSet.has(token)).length;
  const unionSize = new Set([...inputSet, ...candidateSet]).size;

  if (unionSize === 0) {
    return 0;
  }

  let score = intersectionSize / unionSize;
  const normalizedInput = normalizeComparable(input);
  const normalizedCandidate = normalizeComparable(candidate);

  if (
    normalizedInput.length > 0 &&
    normalizedCandidate.length > 0 &&
    (normalizedInput.includes(normalizedCandidate) || normalizedCandidate.includes(normalizedInput))
  ) {
    score += 0.2;
  }

  return Math.min(1, score);
};

export const findExactSentenceExampleTranslation = (
  text: string,
  from: TranslationLanguage,
  to: TranslationLanguage,
  sentenceExamples: SentenceExampleEntry[] = SEMAI_SENTENCE_EXAMPLES,
): string | null => {
  const normalizedText = normalizeSentenceComparable(text);
  const matches = sentenceExamples.filter(
    (entry) =>
      normalizeSentenceComparable(entry[from]) === normalizedText &&
      normalizeComparable(entry[to]).length > 0,
  );

  if (matches.length === 0) {
    return null;
  }

  const uniqueTargets = Array.from(
    new Set(matches.map((entry) => normalizeComparable(entry[to])).filter(Boolean)),
  );

  if (uniqueTargets.length !== 1) {
    return null;
  }

  const bestMatch = matches.find((entry) => normalizeComparable(entry[to]) === uniqueTargets[0]);
  return bestMatch?.[to] ?? null;
};

export const findRelevantSentenceExamples = (
  text: string,
  from: TranslationLanguage,
  to: TranslationLanguage,
  sentenceExamples: SentenceExampleEntry[] = SEMAI_SENTENCE_EXAMPLES,
): SentenceExampleEntry[] => {
  const normalizedText = normalizeComparable(text);
  if (!normalizedText || tokenizeComparable(text).length < 3) {
    return [];
  }

  const ranked = sentenceExamples
    .map((entry) => {
      const sourceText = entry[from];
      const targetText = entry[to];
      if (!normalizeComparable(sourceText) || !normalizeComparable(targetText)) {
        return null;
      }

      return {
        entry,
        score: computeSentenceSimilarity(text, sourceText),
        lengthDelta: Math.abs(sourceText.length - text.length),
      };
    })
    .filter((value): value is { entry: SentenceExampleEntry; score: number; lengthDelta: number } =>
      Boolean(value),
    )
    .filter((value) => value.score >= SENTENCE_EXAMPLE_MIN_SCORE)
    .sort((a, b) => b.score - a.score || a.lengthDelta - b.lengthDelta);

  if (ranked.length === 0) {
    return [];
  }

  return ranked.slice(0, SENTENCE_EXAMPLE_PROMPT_MAX_MATCHES).map((value) => value.entry);
};

export const buildSentenceExamplesPrompt = (
  examples: SentenceExampleEntry[],
  from: TranslationLanguage,
  to: TranslationLanguage,
): string => {
  if (examples.length === 0) {
    return '';
  }

  const fromLabel = LANGUAGE_LABELS[from];
  const toLabel = LANGUAGE_LABELS[to];
  const lines = examples.map(
    (entry) => `- ${fromLabel}: "${entry[from]}" => ${toLabel}: "${entry[to]}"`,
  );

  return `Use these real Webonary sentence examples as guidance when wording is similar:\n${lines.join('\n')}`;
};

const groupBySourceTerm = (
  matches: GlossaryEntry[],
  from: TranslationLanguage,
): Map<string, GlossaryEntry[]> => {
  const grouped = new Map<string, GlossaryEntry[]>();

  for (const entry of matches) {
    const sourceKey = normalizeComparable(entry[from]);
    if (!sourceKey) {
      continue;
    }

    const existing = grouped.get(sourceKey) ?? [];
    grouped.set(sourceKey, [...existing, entry]);
  }

  return grouped;
};

export const selectEnforceableGlossaryMatches = (
  matches: GlossaryEntry[],
  from: TranslationLanguage,
  to: TranslationLanguage,
): GlossaryEntry[] => {
  const highPriorityMatches = matches.filter(isHighPriorityGlossaryEntry);
  const grouped = groupBySourceTerm(highPriorityMatches, from);
  const safePromptEntries: Array<{ entry: GlossaryEntry; sourceLength: number }> = [];

  for (const entries of grouped.values()) {
    const targets = new Set(entries.map((entry) => normalizeComparable(entry[to])));
    if (targets.size !== 1) {
      // Skip ambiguous mappings for strict prompt/enforcement.
      continue;
    }

    const sourceText = normalizeComparable(entries[0][from]);
    safePromptEntries.push({
      entry: entries[0],
      sourceLength: sourceText.length,
    });
  }

  return safePromptEntries
    .sort((a, b) => b.sourceLength - a.sourceLength)
    .slice(0, GLOSSARY_ENFORCEMENT_MAX_MATCHES)
    .map((item) => item.entry);
};

export const findExactGlossaryTranslation = (
  text: string,
  from: TranslationLanguage,
  to: TranslationLanguage,
  glossary: GlossaryEntry[] = SEMAI_GLOSSARY,
): string | null => {
  const normalizedText = normalizeComparable(text);
  const matches = glossary.filter((entry) => normalizeComparable(entry[from]) === normalizedText);

  if (matches.length === 0) {
    return null;
  }

  const uniqueTargets = Array.from(
    new Set(matches.map((entry) => normalizeComparable(entry[to])).filter(Boolean)),
  );

  if (uniqueTargets.length !== 1) {
    return null;
  }

  const bestMatch = matches.find((entry) => normalizeComparable(entry[to]) === uniqueTargets[0]);
  return bestMatch?.[to] ?? null;
};

/** Returns true if the glossary contains ANY entry for the given source text, even if multiple translations exist (polysemous words). */
export const hasGlossaryEntry = (
  text: string,
  from: TranslationLanguage,
  glossary: GlossaryEntry[] = SEMAI_GLOSSARY,
): boolean => {
  const normalizedText = normalizeComparable(text);
  return glossary.some((entry) => normalizeComparable(entry[from]) === normalizedText);
};

/** For polysemous words with multiple translations: returns the first matching translation instead of null. */
export const findFirstGlossaryTranslation = (
  text: string,
  from: TranslationLanguage,
  to: TranslationLanguage,
  glossary: GlossaryEntry[] = SEMAI_GLOSSARY,
): string | null => {
  const normalizedText = normalizeComparable(text);
  const match = glossary.find(
    (entry) =>
      normalizeComparable(entry[from]) === normalizedText &&
      normalizeComparable(entry[to]).length > 0,
  );
  return match?.[to] ?? null;
};

/** Returns all unique translations for a polysemous source word. */
export const findAllGlossaryTranslations = (
  text: string,
  from: TranslationLanguage,
  to: TranslationLanguage,
  glossary: GlossaryEntry[] = SEMAI_GLOSSARY,
): string[] => {
  const normalizedText = normalizeComparable(text);
  const matches = glossary.filter(
    (entry) =>
      normalizeComparable(entry[from]) === normalizedText &&
      normalizeComparable(entry[to]).length > 0,
  );
  return Array.from(new Set(matches.map((entry) => entry[to])));
};

export const findGlossaryMatches = (
  text: string,
  from: TranslationLanguage,
  glossary: GlossaryEntry[] = SEMAI_GLOSSARY,
): GlossaryEntry[] => glossary.filter((entry) => containsTerm(text, entry[from]));

export const buildGlossaryPrompt = (
  matches: GlossaryEntry[],
  from: TranslationLanguage,
  to: TranslationLanguage,
): string => {
  if (matches.length === 0) {
    return '';
  }

  const lines = matches.map((entry) => `- "${entry[from]}" => "${entry[to]}"`);
  return `Use this glossary strictly when these source terms appear:\n${lines.join('\n')}`;
};

export const areGlossaryTermsSatisfied = (
  translatedText: string,
  matches: GlossaryEntry[],
  from: TranslationLanguage,
  to: TranslationLanguage,
): boolean => {
  const groupedBySource = groupBySourceTerm(matches, from);

  for (const sourceEntries of groupedBySource.values()) {
    const expectedTargets = Array.from(
      new Set(sourceEntries.map((entry) => normalizeComparable(entry[to])).filter(Boolean)),
    );

    if (expectedTargets.length === 0) {
      continue;
    }

    const hasAnySatisfyingTarget = expectedTargets.some((target) =>
      containsTerm(translatedText, target),
    );
    if (!hasAnySatisfyingTarget) {
      return false;
    }
  }

  return true;
};

export const translateWordByWordWithGlossary = (
  text: string,
  from: TranslationLanguage,
  to: TranslationLanguage,
  glossary: GlossaryEntry[] = SEMAI_GLOSSARY,
): string => {
  // Pre-pass: greedily substitute multi-word glossary phrases (longest-first)
  // before tokenizing, so entries like "selamat pagi" -> "good morning" are matched.
  const multiWordEntries = glossary
    .filter((entry) => /\s/.test(entry[from]))
    .filter((entry) => {
      const matchingEntries = glossary.filter(
        (e) => normalizeComparable(e[from]) === normalizeComparable(entry[from]),
      );
      const uniqueTargets = new Set(
        matchingEntries.map((e) => normalizeComparable(e[to])).filter(Boolean),
      );
      return uniqueTargets.size === 1;
    })
    .sort((a, b) => b[from].length - a[from].length);

  let remaining = text;
  for (const entry of multiWordEntries) {
    const pattern = new RegExp(
      `(^|\\b)${escapeRegExp(normalizeComparable(entry[from]))}(?=\\b|$)`,
      'gi',
    );
    const target = entry[to];
    remaining = remaining.replace(pattern, (matched, prefix) => {
      // Preserve sentence-initial capitalization from the matched phrase
      const firstChar = matched.charAt(prefix.length);
      const startsUpper =
        firstChar === firstChar.toUpperCase() && firstChar !== firstChar.toLowerCase();
      if (startsUpper) {
        return `${prefix}${target.charAt(0).toUpperCase()}${target.slice(1)}`;
      }
      return `${prefix}${target}`;
    });
  }

  // Single-token pass for remaining unmatched words
  const tokens = remaining.split(/(\s+|[.,!?;:])/g);

  return tokens
    .map((token) => {
      if (!token || /^\s+$/.test(token) || /^[.,!?;:]$/.test(token)) {
        return token;
      }

      const match = glossary.find(
        (entry) => normalizeComparable(entry[from]) === normalizeComparable(token),
      );

      if (!match) {
        return token;
      }

      const matchingEntries = glossary.filter(
        (entry) => normalizeComparable(entry[from]) === normalizeComparable(token),
      );
      const uniqueTargets = new Set(
        matchingEntries.map((entry) => normalizeComparable(entry[to])).filter(Boolean),
      );
      const isAmbiguous = uniqueTargets.size !== 1;

      if (isAmbiguous) {
        return token;
      }

      const translated = match[to];
      const startsWithUppercase = token.charAt(0) === token.charAt(0).toUpperCase();
      if (!startsWithUppercase) {
        return translated;
      }

      return `${translated.charAt(0).toUpperCase()}${translated.slice(1)}`;
    })
    .join('');
};
