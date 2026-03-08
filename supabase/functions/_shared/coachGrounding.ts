import {
  findExactGlossaryTranslation,
  findExactSentenceExampleTranslation,
  hasGlossaryEntry,
  normalizeTranslationText,
  type TranslationLanguage,
} from './translationGlossary.ts';
import { inferScenarioTopic } from './coachTopic.ts';

type CoachTurnInput = {
  role?: 'user' | 'assistant' | string;
  text?: string;
};

const normalizeComparable = (value: string): string =>
  normalizeTranslationText(value).toLowerCase();

const CONTROL_ONLY_PATTERNS = [
  /^(continue|continue learning)$/i,
  /^(let(?:'|\s)?s go|lets go|start|start learning|jom mula)$/i,
  /^(i want to end this session|end session|stop session)$/i,
  /^(hi+|hello+|hey+|hai+|helo+|hye|yo+|salam|assalamualaikum)$/i,
  /^(good (morning|afternoon|evening|night))$/i,
];

export const isControlOnlyMessage = (value: string): boolean => {
  const normalized = normalizeComparable(value)
    .replace(/[.!?]+$/g, '')
    .trim();
  if (!normalized) {
    return true;
  }

  return CONTROL_ONLY_PATTERNS.some((pattern) => pattern.test(normalized));
};

export const isExactVerifiedSemaiInput = (value: string): boolean => {
  const normalized = normalizeTranslationText(value);
  if (!normalized) {
    return false;
  }

  // Use hasGlossaryEntry for existence check — this returns true even for
  // polysemous words (e.g. "wig" = banyan tree / shout) that have multiple
  // different translations. findExactGlossaryTranslation returns null for those.
  return Boolean(
    hasGlossaryEntry(normalized, 'semai') ||
    findExactGlossaryTranslation(normalized, 'semai', 'en') ||
    findExactGlossaryTranslation(normalized, 'semai', 'ms') ||
    findExactSentenceExampleTranslation(normalized, 'semai', 'en') ||
    findExactSentenceExampleTranslation(normalized, 'semai', 'ms'),
  );
};

export const buildLearningSeed = ({
  message,
  extractedText,
  turns,
  clientAction,
  track,
}: {
  message: string;
  extractedText?: string;
  turns: CoachTurnInput[];
  clientAction?: string;
  track: 'vocabulary_first' | 'daily_conversation' | 'pronunciation';
}): string => {
  const candidates: string[] = [];

  if (clientAction !== 'continue_session') {
    if (typeof extractedText === 'string' && !isControlOnlyMessage(extractedText)) {
      candidates.push(extractedText);
    }
    if (!isControlOnlyMessage(message)) {
      candidates.push(message);
    }
  }

  for (let index = turns.length - 1; index >= 0; index -= 1) {
    const turn = turns[index];
    if (turn.role !== 'user' || typeof turn.text !== 'string' || isControlOnlyMessage(turn.text)) {
      continue;
    }
    candidates.push(turn.text);
    break;
  }

  if (candidates.length > 0) {
    return candidates[0];
  }

  // For continue sessions with no candidates, try to infer topic from history
  if (clientAction === 'continue_session') {
    const topic = inferScenarioTopic('', turns);
    if (topic) {
      return topic;
    }
  }

  if (track === 'daily_conversation') {
    return 'daily conversation';
  }
  if (track === 'pronunciation') {
    return 'pronunciation practice';
  }

  return 'vocabulary';
};

export const collectRecentAssistantSemaiTexts = (
  turns: CoachTurnInput[],
  limit: number = 100,
): Set<string> => {
  const recent = turns
    .filter((turn) => turn.role === 'assistant' && typeof turn.text === 'string')
    .slice(-limit)
    .map((turn) => normalizeComparable(turn.text ?? ''))
    .filter(Boolean);

  return new Set(recent);
};

export const resolveCoachTranslateDirection = ({
  message,
  answerLanguage,
}: {
  message: string;
  answerLanguage: Exclude<TranslationLanguage, 'semai'>;
}): { from: TranslationLanguage; to: TranslationLanguage; text: string } => {
  const text = normalizeTranslationText(message);

  if (isExactVerifiedSemaiInput(text)) {
    return {
      text,
      from: 'semai',
      to: answerLanguage,
    };
  }

  return {
    text,
    from: answerLanguage,
    to: 'semai',
  };
};
