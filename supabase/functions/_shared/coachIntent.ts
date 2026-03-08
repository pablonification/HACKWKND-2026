type TranslationLanguage = 'semai' | 'ms' | 'en';

export type CoachMode = 'learning' | 'direct_help' | 'clarification' | 'unsupported';
export type CoachTurnType =
  | 'scenario_start'
  | 'conversation_continue'
  | 'how_to_say'
  | 'word_help'
  | 'sentence_help'
  | 'direct_answer'
  | 'clarification';

export type CoachResponseMode =
  | 'scenario'
  | 'translation'
  | 'conversation'
  | 'word_help'
  | 'sentence_help'
  | 'direct_answer'
  | 'clarification';

export type CoachAnswerLanguage = 'en' | 'ms' | 'semai';

export type CoachIntentResult = {
  mode: CoachMode;
  turnType: CoachTurnType;
  responseMode: CoachResponseMode;
  answerLanguage: CoachAnswerLanguage;
  sourceLanguage?: TranslationLanguage;
  targetLanguage?: TranslationLanguage;
  extractedText?: string;
  needsClarification: boolean;
  confidence: 'high' | 'low';
  reason: string;
};

const normalizeText = (value: string): string => value.trim().replace(/\s+/g, ' ');

const hasAnyPattern = (text: string, patterns: RegExp[]): boolean =>
  patterns.some((pattern) => pattern.test(text));

const extractQuotedText = (value: string): string | null => {
  const quoteMatch = value.match(/["“”'‘’]([^"“”'‘’]{1,180})["“”'‘’]/);
  return quoteMatch?.[1]?.trim() || null;
};

const cleanupExtractedText = (value: string): string =>
  value
    .replace(/\b(mean|maksud)\b$/i, '')
    .replace(/\bplease\b$/i, '')
    .trim();

const MALAY_HINTS = [
  /\b(saya|mahu|ingin|ajar|belajar|bahasa|hari ini|tolong|boleh|maksud|terjemah|ayat|perkataan)\b/i,
  /\b(dalam bahasa semai|ke bahasa semai|apa maksud)\b/i,
];

const SCENARIO_START_PATTERNS = [
  /\bteach me\b/i,
  /\bi want to learn\b/i,
  /\blet'?s practice\b/i,
  /\bstart (a|my)?\s*(short )?(daily )?(conversation|lesson)\b/i,
  /\bajar saya\b/i,
  /\bsaya mahu belajar\b/i,
  /\bmulakan\b/i,
];

const HOW_TO_SAY_PATTERNS = [
  /\bhow do i say\b/i,
  /\bhow to say\b/i,
  /\btranslate\b/i,
  /\bbagaimana (nak )?cakap\b/i,
  /\bmacam mana nak cakap\b/i,
  /\bterjemah(?:kan)?\b/i,
];

const SENTENCE_REQUEST_PATTERNS = [/\b(sentence|phrase|ayat|frasa)\b/i];
const SENTENCE_REVIEW_PATTERNS = [
  /\b(check|fix|improve|correct|grammar|betulkan|semak|perbaiki)\b/i,
];

const WORD_HELP_PATTERNS = [
  /\bwhat does\b/i,
  /\bwhat is the meaning of\b/i,
  /\bapa maksud\b/i,
  /\bmaksud\b/i,
];

const CONVERSATION_CONTINUE_PATTERNS = [
  /\bcontinue\b/i,
  /\bnext reply\b/i,
  /\banother response\b/i,
  /\breply to\b/i,
  /\bnext sentence\b/i,
  /\bsambung\b/i,
  /\blagi satu\b/i,
  /\bseterusnya\b/i,
];

const DIRECT_HELP_PATTERNS = [
  /\bwhy\b/i,
  /\bhow does\b/i,
  /\bwhat does this feature\b/i,
  /\bbug\b/i,
  /\bbroken\b/i,
  /\bissue\b/i,
  /\bproblem\b/i,
  /\bkenapa\b/i,
  /\bmasalah\b/i,
  /\bralat\b/i,
  /\berror\b/i,
];

const AMBIGUOUS_SHORT_PATTERNS = [/^help$/i, /^tolong$/i, /^today$/i, /^hari ini$/i, /^practice$/i];

const LEARNING_LANGUAGE_PATTERNS = [/\bsemai\b/i, /\bbahasa\b/i];
const LEARNING_ONBOARD_PATTERNS = [
  /\b(learn|study|practice|start|begin|journey|teach me)\b/i,
  /\b(belajar|latih|mula|mulakan|ajar saya)\b/i,
  /\b(help me|can you help)\b/i,
];

const removeLeadIn = (value: string, patterns: RegExp[]): string => {
  let next = value.trim();

  for (const pattern of patterns) {
    next = next.replace(pattern, '').trim();
  }

  return next
    .replace(/^(me|please|ini|itu|this|that)\b[:\s-]*/i, '')
    .replace(/\b(in|to|ke|dalam)\s+(semai|english|malay|en|ms)\b/gi, '')
    .replace(/^[\s:,-]+|[\s?.!]+$/g, '')
    .trim();
};

export const detectCoachAnswerLanguage = (message: string): CoachAnswerLanguage => {
  const normalized = normalizeText(message);

  if (!normalized) {
    return 'en';
  }

  const malayScore = MALAY_HINTS.reduce(
    (total, pattern) => total + (pattern.test(normalized) ? 1 : 0),
    0,
  );

  return malayScore > 0 ? 'ms' : 'en';
};

export const isExplicitTranslationIntent = (message: string): boolean =>
  hasAnyPattern(normalizeText(message), HOW_TO_SAY_PATTERNS);

export const classifyCoachIntent = (message: string): CoachIntentResult => {
  const normalized = normalizeText(message);
  const answerLanguage = detectCoachAnswerLanguage(normalized);
  const hasLearningLanguage = hasAnyPattern(normalized, LEARNING_LANGUAGE_PATTERNS);
  const explicitTranslationIntent = isExplicitTranslationIntent(normalized);

  if (!normalized || normalized.length < 4 || hasAnyPattern(normalized, AMBIGUOUS_SHORT_PATTERNS)) {
    return {
      mode: 'clarification',
      turnType: 'clarification',
      responseMode: 'clarification',
      answerLanguage,
      needsClarification: true,
      confidence: 'high',
      reason: 'Input is too short or ambiguous.',
    };
  }

  if (hasAnyPattern(normalized, DIRECT_HELP_PATTERNS) && !explicitTranslationIntent) {
    return {
      mode: 'direct_help',
      turnType: 'direct_answer',
      responseMode: 'direct_answer',
      answerLanguage,
      needsClarification: false,
      confidence: 'high',
      reason: 'Detected product or troubleshooting question.',
    };
  }

  if (hasAnyPattern(normalized, WORD_HELP_PATTERNS)) {
    const extractedText =
      cleanupExtractedText(
        extractQuotedText(normalized) || removeLeadIn(normalized, WORD_HELP_PATTERNS),
      ) || undefined;

    return {
      mode: extractedText ? 'learning' : 'clarification',
      turnType: extractedText ? 'word_help' : 'clarification',
      responseMode: extractedText ? 'word_help' : 'clarification',
      answerLanguage,
      sourceLanguage: 'semai',
      targetLanguage: answerLanguage,
      extractedText,
      needsClarification: !extractedText,
      confidence: extractedText ? 'high' : 'low',
      reason: extractedText ? 'Detected word meaning request.' : 'Word request missing focus text.',
    };
  }

  if (explicitTranslationIntent) {
    const extractedText =
      cleanupExtractedText(
        extractQuotedText(normalized) || removeLeadIn(normalized, HOW_TO_SAY_PATTERNS),
      ) || undefined;
    const wantsEnglish = /\b(to|in)\s+(english|en)\b/i.test(normalized);
    const wantsMalay = /\b(to|in|ke|dalam)\s+(malay|ms|bahasa melayu)\b/i.test(normalized);
    const targetLanguage: TranslationLanguage = wantsEnglish ? 'en' : wantsMalay ? 'ms' : 'semai';

    return {
      mode: extractedText ? 'learning' : 'clarification',
      turnType: extractedText ? 'how_to_say' : 'clarification',
      responseMode: extractedText ? 'translation' : 'clarification',
      answerLanguage: targetLanguage === 'semai' ? answerLanguage : targetLanguage,
      sourceLanguage: targetLanguage === 'semai' ? answerLanguage : 'semai',
      targetLanguage,
      extractedText,
      needsClarification: !extractedText,
      confidence: extractedText ? 'high' : 'low',
      reason: extractedText
        ? 'Detected translation or how-to-say request.'
        : 'Translation request missing source text.',
    };
  }

  if (hasAnyPattern(normalized, CONVERSATION_CONTINUE_PATTERNS)) {
    return {
      mode: 'learning',
      turnType: 'conversation_continue',
      responseMode: 'conversation',
      answerLanguage,
      sourceLanguage: answerLanguage,
      targetLanguage: 'semai',
      extractedText: normalized,
      needsClarification: false,
      confidence: 'low',
      reason: 'Detected follow-up conversation practice request.',
    };
  }

  if (hasAnyPattern(normalized, SENTENCE_REQUEST_PATTERNS) && !explicitTranslationIntent) {
    const reviewRequest = hasAnyPattern(normalized, SENTENCE_REVIEW_PATTERNS);
    const extractedText = reviewRequest
      ? cleanupExtractedText(
          extractQuotedText(normalized) || removeLeadIn(normalized, SENTENCE_REVIEW_PATTERNS),
        ) || undefined
      : undefined;

    return {
      mode: reviewRequest && !extractedText ? 'clarification' : 'learning',
      turnType: reviewRequest && !extractedText ? 'clarification' : 'sentence_help',
      responseMode: reviewRequest && !extractedText ? 'clarification' : 'sentence_help',
      answerLanguage,
      sourceLanguage: answerLanguage,
      targetLanguage: 'semai',
      extractedText,
      needsClarification: reviewRequest && !extractedText,
      confidence: reviewRequest ? (extractedText ? 'high' : 'low') : 'high',
      reason:
        reviewRequest && !extractedText
          ? 'Sentence review request missing focus text.'
          : reviewRequest
            ? 'Detected sentence-level Semai review request.'
            : 'Detected request for a Semai practice sentence.',
    };
  }

  if (
    hasAnyPattern(normalized, SCENARIO_START_PATTERNS) ||
    (hasLearningLanguage && hasAnyPattern(normalized, LEARNING_ONBOARD_PATTERNS))
  ) {
    return {
      mode: 'learning',
      turnType: 'scenario_start',
      responseMode: 'scenario',
      answerLanguage,
      sourceLanguage: answerLanguage,
      targetLanguage: 'semai',
      needsClarification: false,
      confidence: hasAnyPattern(normalized, SCENARIO_START_PATTERNS) ? 'high' : 'low',
      reason: 'Detected lesson or practice start request.',
    };
  }

  if (hasLearningLanguage) {
    return {
      mode: 'learning',
      turnType: 'scenario_start',
      responseMode: 'scenario',
      answerLanguage,
      sourceLanguage: answerLanguage,
      targetLanguage: 'semai',
      needsClarification: false,
      confidence: 'low',
      reason: 'Detected Semai learning intent and defaulted to coach onboarding.',
    };
  }

  return {
    mode: 'direct_help',
    turnType: 'direct_answer',
    responseMode: 'direct_answer',
    answerLanguage,
    needsClarification: false,
    confidence: 'low',
    reason: 'Defaulted to direct help response in the user language.',
  };
};
