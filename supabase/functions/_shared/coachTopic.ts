type TopicLanguage = 'en' | 'ms';
type CoachTurnInput = {
  role?: 'user' | 'assistant' | string;
  text?: string;
};

const START_CONFIRMATION_ONLY_PATTERNS = [
  /^(let s go|lets go|jom mula|start|start learning)$/i,
  /^(continue|continue learning)$/i,
];

const GREETING_ONLY_PATTERNS = [
  /^(hi+|hello+|hey+|hai+|helo+|hye|yo+|salam|assalamualaikum)$/i,
  /^(good (morning|afternoon|evening|night))$/i,
];

const GENERIC_LEARNING_PATTERNS = [
  /\bi want to learn\b/i,
  /\bteach me\b/i,
  /\bhelp me learn\b/i,
  /\bmahu belajar\b/i,
  /\bnak belajar\b/i,
  /\bingin belajar\b/i,
  /\bbelajar semai\b/i,
];

const normalizeTopicPhrase = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ');

const isGreetingOnlyTopicText = (value: string): boolean =>
  GREETING_ONLY_PATTERNS.some((pattern) => pattern.test(value));

export const extractTopicHint = (value: string): string | null => {
  const normalized = normalizeTopicPhrase(value);
  if (!normalized) {
    return null;
  }

  const startOnlyText = normalized
    .replace(/\b(please|ok|okay|sure|ya|yes|bro|lah)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (
    !startOnlyText ||
    START_CONFIRMATION_ONLY_PATTERNS.some((pattern) => pattern.test(startOnlyText)) ||
    /^let s go$/.test(startOnlyText) ||
    isGreetingOnlyTopicText(startOnlyText)
  ) {
    return null;
  }

  if (/\b(greeting|greetings|sapaan)\b/i.test(normalized)) return 'greetings';
  if (/\bnature|alam|forest|river|tree|mountain\b/i.test(normalized)) return 'nature vocabulary';
  if (/\bfamily|keluarga\b/i.test(normalized)) return 'family vocabulary';
  if (/\bfood|makan|drink|rice|eat\b/i.test(normalized)) return 'food vocabulary';
  if (/\bverb|verbs|action\b/i.test(normalized)) return 'action verbs';
  if (/\b(pronunciation|sebutan)\b/i.test(normalized)) return 'pronunciation practice';
  if (/\b(conversation|dialog|speaking|perbualan)\b/i.test(normalized)) return 'daily conversation';
  if (/\b(vocabulary|vocab|kosa kata|perkataan|words?)\b/i.test(normalized)) return 'vocabulary';

  if (GENERIC_LEARNING_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return null;
  }

  return null;
};

export const inferScenarioTopic = (message: string, turns: CoachTurnInput[]): string | null => {
  const fromMessage = extractTopicHint(message);
  if (fromMessage) {
    return fromMessage;
  }

  for (let index = turns.length - 1; index >= 0; index -= 1) {
    const turn = turns[index];
    if (turn.role !== 'user' || typeof turn.text !== 'string') continue;
    const hint = extractTopicHint(turn.text);
    if (hint) return hint;
  }

  return null;
};

export const topicLabelForLanguage = (
  topic: string | null,
  language: TopicLanguage,
): string | null => {
  if (!topic) return null;

  const dictionary: Record<string, { en: string; ms: string }> = {
    greetings: { en: 'greetings', ms: 'sapaan' },
    'nature vocabulary': { en: 'nature vocabulary', ms: 'kosa kata alam' },
    'family vocabulary': { en: 'family vocabulary', ms: 'kosa kata keluarga' },
    'food vocabulary': { en: 'food vocabulary', ms: 'kosa kata makanan' },
    'daily conversation': { en: 'daily conversation', ms: 'perbualan harian' },
    'pronunciation practice': { en: 'pronunciation practice', ms: 'latihan sebutan' },
    'action verbs': { en: 'action verbs', ms: 'kata kerja' },
    vocabulary: { en: 'vocabulary', ms: 'kosa kata' },
  };

  if (topic in dictionary) {
    return dictionary[topic]?.[language] ?? null;
  }

  return null;
};
