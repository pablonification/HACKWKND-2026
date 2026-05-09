declare const Deno: {
  env: {
    get: (name: string) => string | undefined;
  };
  serve: (handler: (request: Request) => Response | Promise<Response>) => void;
};

import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import {
  detectCoachAnswerLanguage,
  isExplicitTranslationIntent,
  type CoachIntentResult,
} from '../_shared/coachIntent.ts';
import {
  findExactGlossaryTranslation,
  findExactSentenceExampleTranslation,
  findAllGlossaryTranslations,
  findFirstGlossaryTranslation,
  hasGlossaryEntry,
  SEMAI_GLOSSARY,
  SEMAI_SENTENCE_EXAMPLES,
  type SentenceExampleEntry,
} from '../_shared/translationGlossary.ts';
import {
  buildLearningSeed,
  collectRecentAssistantSemaiTexts,
  isExactVerifiedSemaiInput,
  resolveCoachTranslateDirection,
} from '../_shared/coachGrounding.ts';
import { inferScenarioTopic } from '../_shared/coachTopic.ts';

type TranslationLanguage = 'semai' | 'ms' | 'en';
type SessionPhase = 'idle' | 'onboarding' | 'learning_active';
type LearningTrack = 'vocabulary_first' | 'daily_conversation' | 'pronunciation';
type ClientAction =
  | 'start_session'
  | 'continue_session'
  | 'end_session'
  | 'translate_inline'
  | 'start_easy'
  | 'practice_greetings'
  | 'make_plan'
  | 'slow_down'
  | 'explain_first'
  | 'try_again';

type CoachTurn = {
  role?: unknown;
  text?: unknown;
  mode?: unknown;
  session_phase?: unknown;
  track?: unknown;
};

type CoachRequest = {
  message: string;
  turns: Array<{
    role: 'user' | 'assistant';
    text: string;
    mode?: string;
    sessionPhase?: SessionPhase;
    track?: LearningTrack;
  }>;
  clientAction?: ClientAction;
  track?: LearningTrack;
};

type CoachLlmProvider = 'claude-agent' | 'openrouter' | 'chatgpt-proxy' | 'openai' | 'gemini';

type CoachLlmUsage = {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
};

type CoachLlmResult = {
  text: string;
  usage?: CoachLlmUsage;
  latencyMs: number;
  provider: string;
  model: string;
  attemptedProviders: string[];
};

type GroundedTranslationResult = {
  translatedText: string;
  sourceText: string;
  provider: string;
  model: string;
  warning?: string;
  grounded: boolean;
  groundingSource: string[];
  validationPassed: boolean;
  semaiVerified: boolean;
  semaiSource: 'glossary' | 'sentence_memory' | 'dictionary_fallback' | 'none';
  meta: Record<string, unknown>;
};

type StageTimings = Partial<
  Record<
    | 'parse'
    | 'route'
    | 'planner'
    | 'grounding'
    | 'pedagogy'
    | 'direct_help'
    | 'clarification'
    | 'total',
    number
  >
>;

type RuntimeState = {
  stageTimings: StageTimings;
  degraded: boolean;
  degradeReason: string | null;
  cpuGuardTriggered: boolean;
};

type CoachPayload = {
  mode: string;
  response_mode: string;
  answer_language: string;
  session_phase: SessionPhase;
  track: LearningTrack;
  next_actions: ClientAction[];
  main_reply: string;
  translation: string | null;
  coach_note: string | null;
  follow_up_prompt: string | null;
  follow_up_translation: string | null;
  pronunciation_tip: string | null;
  related_example: string | null;
  warning?: string;
  grounded: boolean;
  grounding_source: string[];
  validation_passed: boolean;
  provider: string;
  model: string;
  meta: Record<string, unknown>;
};

type OrchestrationResult = {
  intent: CoachIntentResult;
  sessionPhase: SessionPhase;
  track: LearningTrack;
  nextActions: ClientAction[];
  provider: string;
  model: string;
};

type VerifiedContext = {
  kind: 'word' | 'sentence';
  semai: string;
  translation: string;
  source: 'glossary' | 'sentence_memory';
};

const sanitizeCoachOutputText = (value: string | null): string | null =>
  value === null ? null : value.replace(/[—–]/g, ',');

const sanitizeCoachPayloadOutput = (payload: CoachPayload): CoachPayload => ({
  ...payload,
  main_reply: sanitizeCoachOutputText(payload.main_reply) ?? '',
  translation: sanitizeCoachOutputText(payload.translation),
  coach_note: sanitizeCoachOutputText(payload.coach_note),
  follow_up_prompt: sanitizeCoachOutputText(payload.follow_up_prompt),
  follow_up_translation: sanitizeCoachOutputText(payload.follow_up_translation),
  pronunciation_tip: sanitizeCoachOutputText(payload.pronunciation_tip),
  related_example: sanitizeCoachOutputText(payload.related_example),
  warning: sanitizeCoachOutputText(payload.warning ?? null) ?? undefined,
});

type FollowUpContext =
  | 'onboarding'
  | 'verified_vocab'
  | 'verified_sentence'
  | 'translation'
  | 'recovery'
  | 'scope_guard'
  | 'end_session'
  | 'direct_help'
  | 'grounding_unavailable'
  | 'safe_practice';

type LlmIntentPayload = {
  mode: 'learning' | 'direct_help' | 'clarification';
  turn_type?:
    | 'scenario_start'
    | 'conversation_continue'
    | 'sentence_help'
    | 'word_help'
    | 'how_to_say'
    | 'direct_answer'
    | 'clarification';
  answer_language?: 'en' | 'ms';
  extracted_text?: string;
  needs_clarification?: boolean;
  confidence?: 'high' | 'low';
  reason?: string;
};

const normalizeCoachProvider = (value: string): CoachLlmProvider | null => {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'claude-agent' || normalized === 'claude' || normalized === 'claude-sdk') {
    return 'claude-agent';
  }
  if (normalized === 'openrouter' || normalized === 'open-router') {
    return 'openrouter';
  }
  if (normalized === 'chatgpt-proxy' || normalized === 'chatgpt' || normalized === 'codex') {
    return 'chatgpt-proxy';
  }
  if (normalized === 'openai' || normalized === 'openai-api') {
    return 'openai';
  }
  if (normalized === 'gemini' || normalized === 'google' || normalized === 'google-ai-studio') {
    return 'gemini';
  }
  return null;
};

const parseCoachProviderOrder = (value?: string): CoachLlmProvider[] => {
  const providers = (value ?? 'claude-agent,gemini')
    .split(',')
    .map(normalizeCoachProvider)
    .filter((provider): provider is CoachLlmProvider => Boolean(provider));
  return providers.length > 0 ? Array.from(new Set(providers)) : ['claude-agent', 'gemini'];
};

const isClientAction = (value: unknown): value is ClientAction =>
  value === 'start_session' ||
  value === 'continue_session' ||
  value === 'end_session' ||
  value === 'translate_inline' ||
  value === 'start_easy' ||
  value === 'practice_greetings' ||
  value === 'make_plan' ||
  value === 'slow_down' ||
  value === 'explain_first' ||
  value === 'try_again';

const OPENAI_COMPAT_API_KEY =
  Deno.env.get('AI_COACH_OPENROUTER_API_KEY') ??
  Deno.env.get('OPENROUTER_API_KEY') ??
  Deno.env.get('AI_COACH_OPENAI_API_KEY') ??
  Deno.env.get('OPENAI_API_KEY') ??
  '';
const OPENAI_COMPAT_MODEL =
  Deno.env.get('AI_COACH_OPENROUTER_MODEL') ??
  Deno.env.get('OPENROUTER_MODEL') ??
  Deno.env.get('AI_COACH_OPENAI_MODEL') ??
  Deno.env.get('OPENAI_MODEL') ??
  'openai/gpt-5.5';
const OPENAI_COMPAT_BASE_URL = (
  Deno.env.get('AI_COACH_OPENROUTER_BASE_URL') ??
  Deno.env.get('OPENROUTER_BASE_URL') ??
  Deno.env.get('AI_COACH_OPENAI_BASE_URL') ??
  Deno.env.get('OPENAI_BASE_URL') ??
  'https://openrouter.ai/api/v1'
).replace(/\/$/, '');
const OPENROUTER_SITE_URL =
  Deno.env.get('AI_COACH_OPENROUTER_SITE_URL') ?? 'https://taleka.tstradio.wtf';
const OPENROUTER_APP_NAME = Deno.env.get('AI_COACH_OPENROUTER_APP_NAME') ?? 'Taleka AI Coach';
const CLAUDE_AGENT_API_KEY =
  Deno.env.get('AI_COACH_CLAUDE_AGENT_API_KEY') ??
  Deno.env.get('CLAUDE_AGENT_GATEWAY_API_KEY') ??
  '';
const CLAUDE_AGENT_MODEL =
  Deno.env.get('AI_COACH_CLAUDE_AGENT_MODEL') ?? Deno.env.get('CLAUDE_AGENT_MODEL') ?? 'sonnet';
const CLAUDE_AGENT_BASE_URL = (
  Deno.env.get('AI_COACH_CLAUDE_AGENT_BASE_URL') ??
  Deno.env.get('CLAUDE_AGENT_GATEWAY_BASE_URL') ??
  ''
).replace(/\/$/, '');
const GEMINI_API_KEY =
  Deno.env.get('GOOGLE_AI_STUDIO_API_KEY') ?? Deno.env.get('GEMINI_API_KEY') ?? '';
const GEMINI_MODEL = Deno.env.get('AI_COACH_GEMINI_MODEL') ?? 'gemini-3.1-flash-lite-preview';
const GEMINI_BASE_URL =
  Deno.env.get('GOOGLE_AI_STUDIO_BASE_URL') ?? 'https://generativelanguage.googleapis.com/v1beta';
const COACH_PROVIDER_ORDER = parseCoachProviderOrder(Deno.env.get('AI_COACH_PROVIDER_ORDER'));
const SUPABASE_ANON_KEY =
  Deno.env.get('SUPABASE_ANON_KEY') ??
  Deno.env.get('SUPABASE_PUBLIC_ANON_KEY') ??
  Deno.env.get('ANON_KEY') ??
  '';
const PROVIDER_TIMEOUT_MS = Number.parseInt(Deno.env.get('AI_COACH_TIMEOUT_MS') ?? '12000', 10);
const PROVIDER_RETRY_COUNT = Math.max(
  0,
  Number.parseInt(Deno.env.get('AI_COACH_PROVIDER_RETRY_COUNT') ?? '1', 10),
);
const PROVIDER_RETRY_DELAY_MS = Math.max(
  0,
  Number.parseInt(Deno.env.get('AI_COACH_PROVIDER_RETRY_DELAY_MS') ?? '900', 10),
);
const AI_TRANSLATE_TIMEOUT_MS = Number.parseInt(
  Deno.env.get('AI_COACH_TRANSLATE_TIMEOUT_MS') ?? '12000',
  10,
);
const MAX_TURNS = 8;
const CPU_GUARD_BUDGET_MS = Number.parseInt(Deno.env.get('AI_COACH_CPU_GUARD_MS') ?? '2200', 10);
const CPU_GUARD_PLANNER_MIN_MS = Number.parseInt(
  Deno.env.get('AI_COACH_CPU_GUARD_PLANNER_MIN_MS') ?? '260',
  10,
);
const CPU_GUARD_DIRECT_MIN_MS = Number.parseInt(
  Deno.env.get('AI_COACH_CPU_GUARD_DIRECT_MIN_MS') ?? '220',
  10,
);
const CPU_GUARD_CLARIFICATION_MIN_MS = Number.parseInt(
  Deno.env.get('AI_COACH_CPU_GUARD_CLARIFICATION_MIN_MS') ?? '160',
  10,
);
const CPU_GUARD_PEDAGOGY_MIN_MS = Number.parseInt(
  Deno.env.get('AI_COACH_PEDAGOGY_MIN_BUDGET_MS') ?? '120',
  10,
);
const PEDAGOGY_CONTEXT_TURNS = Number.parseInt(
  Deno.env.get('AI_COACH_PEDAGOGY_CONTEXT_TURNS') ?? '2',
  10,
);
const COACH_DIRECT_MAX_OUTPUT_TOKENS = Number.parseInt(
  Deno.env.get('AI_COACH_DIRECT_MAX_OUTPUT_TOKENS') ??
    Deno.env.get('AI_COACH_GEMINI_DIRECT_MAX_TOKENS') ??
    '220',
  10,
);
const COACH_PEDAGOGY_MAX_OUTPUT_TOKENS = Number.parseInt(
  Deno.env.get('AI_COACH_PEDAGOGY_MAX_OUTPUT_TOKENS') ??
    Deno.env.get('AI_COACH_GEMINI_PEDAGOGY_MAX_TOKENS') ??
    '150',
  10,
);
const COACH_INTENT_MAX_OUTPUT_TOKENS = Number.parseInt(
  Deno.env.get('AI_COACH_INTENT_MAX_OUTPUT_TOKENS') ??
    Deno.env.get('AI_COACH_GEMINI_INTENT_MAX_TOKENS') ??
    '96',
  10,
);

const LEARNING_END_PATTERNS = [
  /\b(stop|end|finish|quit|done|exit)\b/i,
  /\b(that'?s all|enough for today|thanks(?: you)? so much)\b/i,
  /\b(berhenti|tamat|cukup|terima kasih)\b/i,
];

const LEARNING_START_CONFIRM_PATTERNS = [
  /\b(let'?s go|start now|i'?m ready|ready now|begin now)\b/i,
  /\b(jom|mula sekarang|saya sedia)\b/i,
];

const LEARNING_GOAL_PATTERNS = [
  /\b(i want to learn|learn semai|help me learn|teach me semai)\b/i,
  /\b(saya mahu belajar|belajar semai|ajar saya)\b/i,
];

const SPECIFIC_PRACTICE_PATTERNS = [
  /\b(greeting|greetings|hello|daily conversation|conversation|sentence|phrase|pronunciation|vocabulary|word)\b/i,
  /\b(sapaan|ayat|frasa|sebutan|kosa kata|perkataan|perbualan)\b/i,
];

const FRUSTRATION_PATTERNS = [
  /\b(bruh|huh|confus(?:ed|ing)|don'?t understand|i do not understand)\b/i,
  /\b(don'?t start|do not start|too fast|slow down|explain first|not immediately)\b/i,
  /\b(tak faham|keliru|jangan mula|perlahan|terangkan dulu)\b/i,
];

const LEARNING_ADVICE_PATTERNS = [
  /\b(advice|tips?|plan|roadmap|how to get better|how can i improve|where should i start)\b/i,
  /\b(nasihat|petua|rancangan|cara.*baik|mula dari mana)\b/i,
];

const VERIFIED_SEMAI_PROVIDERS = new Set([
  'glossary',
  'sentence-memory',
  'glossary-fallback',
  'safety-fallback',
  'fallback',
]);

const normalizeTranslationText = (value: string): string =>
  value.trim().replace(/\s+/g, ' ').replace(/[“”]/g, '"').replace(/[‘’]/g, "'");

const cleanModelOutput = (value: string): string =>
  value
    .replace(/^translation\s*[:-]\s*/i, '')
    .replace(/^```[a-zA-Z]*\n?/i, '')
    .replace(/```$/i, '')
    .replace(/^["']|["']$/g, '')
    .trim();

const normalizeComparable = (value: string): string =>
  normalizeTranslationText(value).toLowerCase();

const tokenizeComparable = (value: string): string[] =>
  normalizeComparable(value)
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);

const countTokenOverlap = (source: string, targetTokens: string[]): number => {
  if (targetTokens.length === 0) {
    return 0;
  }
  const sourceTokens = new Set(tokenizeComparable(source));
  return targetTokens.filter((token) => sourceTokens.has(token)).length;
};

const mapProviderToSemaiSource = (
  provider: string,
): 'glossary' | 'sentence_memory' | 'dictionary_fallback' | 'none' => {
  if (provider === 'glossary') {
    return 'glossary';
  }
  if (provider === 'sentence-memory') {
    return 'sentence_memory';
  }
  if (
    provider === 'glossary-fallback' ||
    provider === 'safety-fallback' ||
    provider === 'fallback'
  ) {
    return 'dictionary_fallback';
  }
  return 'none';
};

const truncateText = (value: string, maxChars: number): string => {
  if (value.length <= maxChars) {
    return value;
  }
  return `${value.slice(0, Math.max(1, maxChars - 1))}...`;
};

const markStageTiming = (runtime: RuntimeState, stage: keyof StageTimings, ms: number): void => {
  runtime.stageTimings[stage] = Math.max(0, Math.round(ms));
};

const remainingBudgetMs = (requestStartedAtMs: number): number =>
  CPU_GUARD_BUDGET_MS - (Date.now() - requestStartedAtMs);

const setDegraded = (
  runtime: RuntimeState,
  reason: string,
  options?: { cpuGuard?: boolean },
): void => {
  runtime.degraded = true;
  if (!runtime.degradeReason) {
    runtime.degradeReason = reason;
  }
  if (options?.cpuGuard) {
    runtime.cpuGuardTriggered = true;
  }
};

const applyMalayNormalization = (value: string): string =>
  value
    .replace(/\baku\b/gi, 'saya')
    .replace(/\bingin\b/gi, 'mahu')
    .replace(/\bkamu\b/gi, 'anda')
    .replace(/\bgimana\b/gi, 'bagaimana')
    .replace(/\bbilang\b/gi, 'cakap')
    .replace(/\bnggak\b/gi, 'tidak')
    .replace(/\baja\b/gi, 'sahaja');

const withLanguageNormalization = (answerLanguage: 'en' | 'ms', value: string): string =>
  answerLanguage === 'ms' ? applyMalayNormalization(value) : value;

const buildRuntimeMeta = (
  runtime: RuntimeState,
  extras?: Record<string, unknown>,
): Record<string, unknown> => ({
  ...(extras ?? {}),
  degraded: runtime.degraded,
  degrade_reason: runtime.degradeReason,
  cpu_guard_triggered: runtime.cpuGuardTriggered,
  stage_timings_ms: runtime.stageTimings,
});

const fetchWithTimeout = async (
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number = PROVIDER_TIMEOUT_MS,
  timeoutLabel: string = 'Request',
): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`${timeoutLabel} timed out after ${timeoutMs}ms.`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const parseRequest = async (request: Request): Promise<CoachRequest> => {
  const body = (await request.json()) as {
    message?: unknown;
    turns?: CoachTurn[];
    client_action?: unknown;
    track?: unknown;
  };

  if (typeof body.message !== 'string') {
    throw new Error('The `message` field is required.');
  }

  const message = normalizeTranslationText(body.message);
  if (!message) {
    throw new Error('The `message` field cannot be empty.');
  }

  const parsedTurns: CoachRequest['turns'] = [];
  if (Array.isArray(body.turns)) {
    for (const turn of body.turns) {
      const role = turn?.role === 'assistant' ? 'assistant' : turn?.role === 'user' ? 'user' : null;
      const text = typeof turn?.text === 'string' ? normalizeTranslationText(turn.text) : '';
      if (!role || !text) {
        continue;
      }

      const mode = typeof turn?.mode === 'string' ? turn.mode : undefined;
      const sessionPhase =
        turn?.session_phase === 'idle' ||
        turn?.session_phase === 'onboarding' ||
        turn?.session_phase === 'learning_active'
          ? turn.session_phase
          : undefined;
      const track =
        turn?.track === 'vocabulary_first' ||
        turn?.track === 'daily_conversation' ||
        turn?.track === 'pronunciation'
          ? turn.track
          : undefined;

      parsedTurns.push({ role, text, mode, sessionPhase, track });
    }
  }

  return {
    message,
    turns: parsedTurns.slice(-MAX_TURNS),
    clientAction: isClientAction(body.client_action) ? body.client_action : undefined,
    track:
      body.track === 'vocabulary_first' ||
      body.track === 'daily_conversation' ||
      body.track === 'pronunciation'
        ? body.track
        : undefined,
  };
};

const inferSessionState = (turns: CoachRequest['turns']): SessionPhase => {
  for (let index = turns.length - 1; index >= 0; index -= 1) {
    const turn = turns[index];
    if (turn.role !== 'assistant') {
      continue;
    }

    if (turn.sessionPhase) {
      return turn.sessionPhase;
    }

    if (turn.mode === 'learning') {
      return 'learning_active';
    }
    if (turn.mode === 'clarification') {
      return 'onboarding';
    }
    if (turn.mode === 'direct_help') {
      return 'idle';
    }
  }
  return 'idle';
};

const inferTrack = (turns: CoachRequest['turns'], requestTrack?: LearningTrack): LearningTrack => {
  if (requestTrack) {
    return requestTrack;
  }

  for (let index = turns.length - 1; index >= 0; index -= 1) {
    const turn = turns[index];
    if (turn.role === 'assistant' && turn.track) {
      return turn.track;
    }
  }
  return 'vocabulary_first';
};

const buildConversationContext = (
  turns: CoachRequest['turns'],
  maxTurns: number = MAX_TURNS,
  maxCharsPerTurn: number = 140,
): string =>
  turns
    .slice(-maxTurns)
    .map(
      (turn) =>
        `${turn.role === 'assistant' ? 'Tavi' : 'User'}: ${truncateText(turn.text, maxCharsPerTurn)}`,
    )
    .join('\n');

const findLatestVerifiedContext = (
  turns: CoachRequest['turns'],
  answerLanguage: 'en' | 'ms',
): VerifiedContext | null => {
  for (let index = turns.length - 1; index >= 0; index -= 1) {
    const turn = turns[index];
    if (turn.role !== 'assistant') {
      continue;
    }

    const text = normalizeTranslationText(turn.text);
    if (!text) {
      continue;
    }

    const glossaryTranslation =
      findExactGlossaryTranslation(text, 'semai', answerLanguage) ??
      findFirstGlossaryTranslation(text, 'semai', answerLanguage);
    if (glossaryTranslation) {
      return {
        kind: 'word',
        semai: text,
        translation: glossaryTranslation,
        source: 'glossary',
      };
    }

    const sentenceTranslation = findExactSentenceExampleTranslation(text, 'semai', answerLanguage);
    if (sentenceTranslation) {
      return {
        kind: 'sentence',
        semai: text,
        translation: sentenceTranslation,
        source: 'sentence_memory',
      };
    }
  }

  return null;
};

const pickPrompt = (prompts: string[], request: CoachRequest): string => {
  const seed = request.turns.reduce((total, turn, index) => {
    const text = normalizeTranslationText(turn.text);
    return total + text.length + index * 11;
  }, normalizeTranslationText(request.message).length);
  const selected = prompts[Math.abs(seed) % prompts.length] ?? prompts[0] ?? '';

  if (
    prompts.length > 1 &&
    normalizeTranslationText(selected).toLowerCase() ===
      normalizeTranslationText(request.message).toLowerCase()
  ) {
    return prompts[(Math.abs(seed) + 1) % prompts.length] ?? selected;
  }

  return selected;
};

const buildContextualFollowUpPrompt = (
  context: FollowUpContext,
  answerLanguage: 'en' | 'ms',
  request: CoachRequest,
  verifiedContext?: VerifiedContext | null,
): string | null => {
  const en: Record<FollowUpContext, string[]> = {
    onboarding: [
      'Make me a simple learning plan.',
      'Start with greetings.',
      'Teach me one easy word.',
    ],
    verified_vocab: [
      'Explain this word more simply.',
      'Give me a memory tip.',
      'Give me a safe practice task.',
      'Show me another easy word.',
    ],
    verified_sentence: [
      'Break this down simply.',
      'Help me understand the meaning.',
      'Show me another verified item.',
    ],
    translation: [
      'Break this down simply.',
      'Help me understand the meaning.',
      'Show me another verified item.',
    ],
    recovery: ['Explain it slower.', 'Start over with one word.', 'Just give me the basics.'],
    scope_guard: [
      'Show me something verified instead.',
      'Try a shorter phrase.',
      'Help me choose a safe practice.',
    ],
    end_session: ['Continue learning later.'],
    direct_help: [
      'Start with one easy word.',
      'Make me a simple learning plan.',
      'Help me choose what to learn next.',
    ],
    grounding_unavailable: [
      'Show me something verified instead.',
      'Try a shorter phrase.',
      'Help me choose a safe practice.',
    ],
    safe_practice: [
      'Show me another easy word.',
      'Explain this word more simply.',
      'Help me choose what to learn next.',
    ],
  };
  const ms: Record<FollowUpContext, string[]> = {
    onboarding: [
      'Buatkan saya pelan belajar yang ringkas.',
      'Mula dengan sapaan.',
      'Ajar saya satu perkataan mudah.',
    ],
    verified_vocab: [
      'Terangkan perkataan ini dengan lebih mudah.',
      'Beri saya tip ingatan.',
      'Beri saya latihan yang selamat.',
      'Tunjukkan satu lagi perkataan mudah.',
    ],
    verified_sentence: [
      'Terangkan ini dengan ringkas.',
      'Bantu saya faham maksudnya.',
      'Tunjukkan satu lagi item yang disahkan.',
    ],
    translation: [
      'Terangkan ini dengan ringkas.',
      'Bantu saya faham maksudnya.',
      'Tunjukkan satu lagi item yang disahkan.',
    ],
    recovery: [
      'Terangkan dengan lebih perlahan.',
      'Mula semula dengan satu perkataan.',
      'Beri saya asas sahaja.',
    ],
    scope_guard: [
      'Tunjukkan sesuatu yang disahkan.',
      'Cuba frasa yang lebih ringkas.',
      'Bantu saya pilih latihan selamat.',
    ],
    end_session: ['Sambung belajar nanti.'],
    direct_help: [
      'Mula dengan satu perkataan mudah.',
      'Buatkan saya pelan belajar yang ringkas.',
      'Bantu saya pilih topik seterusnya.',
    ],
    grounding_unavailable: [
      'Tunjukkan sesuatu yang disahkan.',
      'Cuba frasa yang lebih ringkas.',
      'Bantu saya pilih latihan selamat.',
    ],
    safe_practice: [
      'Tunjukkan satu lagi perkataan mudah.',
      'Terangkan perkataan ini dengan lebih mudah.',
      'Bantu saya pilih topik seterusnya.',
    ],
  };

  const promptSet = answerLanguage === 'ms' ? ms : en;
  void verifiedContext;
  return pickPrompt([...promptSet[context]], request);
};

const isGreetingOnlyPrompt = (message: string): boolean =>
  /^(hi+|hello+|hey+|hai+|helo+|hye|yo+|salam|assalamualaikum)[\s!,.?]*$/i.test(message.trim());

const isOutOfScopeNonLanguageRequest = (message: string): boolean => {
  const normalized = normalizeComparable(message);
  const asksForExternalTask =
    /\b(help|make|build|create|write|code|implement|generate|solve|calculate|debug|fix|design|explain|tutorial)\b/.test(
      normalized,
    );
  const externalDomain =
    /\b(python|javascript|typescript|java|html|css|react|calculator|app|website|api|server|database|sql|math|homework|essay|email|resume|business|marketing)\b/.test(
      normalized,
    );
  const promptInjection =
    /\b(ignore|forget|override|bypass|disregard|reveal|show|print|dump|leak)\b/.test(normalized) &&
    /\b(instruction|instructions|prompt|system|developer|policy|rules|secret|secrets|hidden|previous)\b/.test(
      normalized,
    );

  return promptInjection || (asksForExternalTask && externalDomain);
};

const isLearningExitIntent = (message: string): boolean =>
  LEARNING_END_PATTERNS.some((pattern) => pattern.test(message));

const isLearningStartConfirmation = (message: string): boolean =>
  LEARNING_START_CONFIRM_PATTERNS.some((pattern) => pattern.test(message));

const isLearningGoalIntent = (message: string): boolean =>
  LEARNING_GOAL_PATTERNS.some((pattern) => pattern.test(message));

const isSpecificPracticeIntent = (message: string): boolean =>
  SPECIFIC_PRACTICE_PATTERNS.some((pattern) => pattern.test(message));

const isInterestingWordPracticeIntent = (message: string): boolean =>
  /\b(interesting|random|simple|easy|new|some|another|verified)\b/i.test(message) &&
  /\b(semai\s+)?(word|vocabulary|vocab|perkataan|kosa kata)\b/i.test(message);

const isVocabularyPracticeIntent = (message: string): boolean =>
  /\b(semai\s+)?(word|words|vocabulary|vocab|perkataan|kosa kata)\b/i.test(message) &&
  /\b(give|start|practice|drill|today|daily|basic|basics|focus|throw|ajar|latih|mula|hari ini)\b/i.test(
    message,
  );

const isSpecificPracticeStartIntent = (message: string): boolean =>
  isSpecificPracticeIntent(message) &&
  /\b(teach|practice|start|learn|try|ajar|latih|mula|belajar)\b/i.test(message);

const isLearningAdviceIntent = (message: string): boolean =>
  LEARNING_ADVICE_PATTERNS.some((pattern) => pattern.test(message));

const isFrustrationIntent = (message: string): boolean =>
  FRUSTRATION_PATTERNS.some((pattern) => pattern.test(message));

const isLearningNextStepIntent = (message: string): boolean =>
  /\b(next|another|more|new)\b/i.test(message) &&
  /\b(sentence|sentences|example|examples|phrase|phrases|practice)\b/i.test(message);

const isUnsafeSentenceGenerationRequest = (message: string): boolean => {
  const normalized = normalizeComparable(message);
  return (
    /\b(use|using|make|create|write|give|show)\b/.test(normalized) &&
    /\b(word|this word|it|[a-z]+)\b/.test(normalized) &&
    /\b(sentence|sentences|ayat)\b/.test(normalized)
  );
};

const isUnsupportedExampleRequest = (message: string): boolean =>
  /\b(more|another|many|list|examples?)\b/i.test(message) &&
  /\b(greeting|greetings|hello|sapaan)\b/i.test(message);

const isExplainCurrentFollowUpIntent = (message: string): boolean =>
  /\b(explain|break\s+down|understand|meaning|simple|simply|jelaskan|terangkan|maksud)\b/i.test(
    message,
  ) && /\b(this|current|that|word|phrase|item|ini|itu|perkataan|frasa)\b/i.test(message);

const isMemoryTipFollowUpIntent = (message: string): boolean =>
  /\b(memory\s+tip|remember|memor(?:y|ize)|hafal|ingat)\b/i.test(message);

const isSafePracticeFollowUpIntent = (message: string): boolean =>
  /\b(safe\s+practice|practice\s+task|practice\s+safely|latihan\s+selamat|latihan\s+mudah)\b/i.test(
    message,
  );

const isSafeAlternativeFollowUpIntent = (message: string): boolean =>
  /\b(something\s+verified|verified\s+instead|choose\s+a\s+safe\s+practice|shorter\s+phrase|lebih\s+ringkas|disahkan)\b/i.test(
    message,
  );

const isContinueLaterFollowUpIntent = (message: string): boolean =>
  /\b(continue\s+learning\s+later|sambung\s+belajar)\b/i.test(message);

// Deterministic check for generic sentence/example requests like "sentence please",
// "give me a sentence in semai", "ayat contoh". Avoids relying on LLM classification.
const isSentenceRequestIntent = (message: string): boolean => {
  if (isExplicitTranslationIntent(message)) {
    return false;
  }
  // "sentence", "phrase", "ayat", "frasa" are strong signals on their own
  if (/\b(sentence|sentences|phrase|phrases|ayat|frasa)\b/i.test(message)) {
    return true;
  }
  // "example" / "contoh" need Semai/learning context to avoid false positives
  if (
    /\b(example|examples|contoh)\b/i.test(message) &&
    /\b(semai|learn|practice|belajar|latih)\b/i.test(message)
  ) {
    return true;
  }
  return false;
};
const isSemaiVerificationQuestion = (message: string): boolean =>
  /\b(is that correct|is this correct|correct\?|betul ke|betulkah|adakah .* betul|right\?)\b/i.test(
    message,
  );

const parseGeminiText = (payload: unknown): string => {
  if (typeof payload !== 'object' || payload === null || !('candidates' in payload)) {
    return '';
  }

  const candidates = (
    payload as { candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }> }
  ).candidates;
  const text =
    candidates?.[0]?.content?.parts
      ?.map((part) => (typeof part.text === 'string' ? part.text : ''))
      .join('\n') ?? '';
  return cleanModelOutput(text);
};

const parseGeminiUsage = (payload: unknown): CoachLlmUsage | undefined => {
  if (typeof payload !== 'object' || payload === null || !('usageMetadata' in payload)) {
    return undefined;
  }
  const usage = (payload as { usageMetadata?: CoachLlmUsage }).usageMetadata;
  return usage && typeof usage === 'object' ? usage : undefined;
};

const parseOpenAICompatibleText = (payload: unknown): string => {
  if (typeof payload !== 'object' || payload === null) {
    return '';
  }

  if ('output_text' in payload && typeof payload.output_text === 'string') {
    return cleanModelOutput(payload.output_text);
  }

  const responsesOutput = (
    payload as {
      output?: Array<{
        content?: Array<{
          text?: unknown;
          type?: unknown;
        }>;
      }>;
    }
  ).output;
  const responseText =
    responsesOutput
      ?.flatMap((item) => item.content ?? [])
      .map((content) => (typeof content.text === 'string' ? content.text : ''))
      .filter(Boolean)
      .join('\n') ?? '';
  if (responseText) {
    return cleanModelOutput(responseText);
  }

  const chatChoices = (
    payload as {
      choices?: Array<{
        message?: {
          content?: unknown;
        };
      }>;
    }
  ).choices;
  const chatText =
    chatChoices
      ?.map((choice) => (typeof choice.message?.content === 'string' ? choice.message.content : ''))
      .filter(Boolean)
      .join('\n') ?? '';
  return cleanModelOutput(chatText);
};

const parseOpenAICompatibleUsage = (payload: unknown): CoachLlmUsage | undefined => {
  if (typeof payload !== 'object' || payload === null || !('usage' in payload)) {
    return undefined;
  }
  const usage = (payload as { usage?: CoachLlmUsage }).usage;
  return usage && typeof usage === 'object' ? usage : undefined;
};

const getCoachLlmDefaultMaxOutputTokens = (responseMimeType?: 'application/json'): number =>
  responseMimeType ? COACH_PEDAGOGY_MAX_OUTPUT_TOKENS : COACH_DIRECT_MAX_OUTPUT_TOKENS;

const callOpenAICompatibleProvider = async (
  provider: 'claude-agent' | 'openrouter' | 'chatgpt-proxy' | 'openai',
  prompt: string,
  systemInstruction: string,
  responseMimeType?: 'application/json',
  maxOutputTokens?: number,
): Promise<CoachLlmResult | null> => {
  const apiKey = provider === 'claude-agent' ? CLAUDE_AGENT_API_KEY : OPENAI_COMPAT_API_KEY;
  const model = provider === 'claude-agent' ? CLAUDE_AGENT_MODEL : OPENAI_COMPAT_MODEL;
  const baseUrl = provider === 'claude-agent' ? CLAUDE_AGENT_BASE_URL : OPENAI_COMPAT_BASE_URL;
  if (!apiKey || !baseUrl) {
    return null;
  }

  const promptText = responseMimeType
    ? `${prompt}\n\nReturn only valid compact JSON. Do not wrap it in Markdown.`
    : prompt;
  const tokenBudget = maxOutputTokens ?? getCoachLlmDefaultMaxOutputTokens(responseMimeType);
  const usesChatCompletions =
    provider === 'claude-agent' || provider === 'openrouter' || provider === 'chatgpt-proxy';
  const endpoint = usesChatCompletions ? 'chat/completions' : 'responses';
  const requestBody = usesChatCompletions
    ? {
        model,
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: promptText },
        ],
        max_tokens: tokenBudget,
      }
    : {
        model,
        instructions: systemInstruction,
        input: [
          {
            role: 'user',
            content: [{ type: 'input_text', text: promptText }],
          },
        ],
        max_output_tokens: tokenBudget,
      };

  const startedAt = Date.now();
  const response = await fetchWithTimeout(
    `${baseUrl}/${endpoint}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...(provider === 'openrouter'
          ? {
              'HTTP-Referer': OPENROUTER_SITE_URL,
              'X-Title': OPENROUTER_APP_NAME,
            }
          : {}),
      },
      body: JSON.stringify(requestBody),
    },
    PROVIDER_TIMEOUT_MS,
    provider === 'claude-agent'
      ? 'Claude Agent SDK gateway request'
      : provider === 'openrouter'
        ? 'OpenRouter request'
        : provider === 'chatgpt-proxy'
          ? 'ChatGPT proxy request'
          : 'OpenAI request',
  );

  const payload = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    const message =
      typeof payload === 'object' && payload !== null && 'error' in payload
        ? JSON.stringify((payload as { error?: unknown }).error)
        : `${provider === 'claude-agent' ? 'Claude Agent SDK gateway' : provider === 'openrouter' ? 'OpenRouter' : provider === 'chatgpt-proxy' ? 'ChatGPT proxy' : 'OpenAI'} request failed (${response.status})`;
    throw new Error(message);
  }

  return {
    text: parseOpenAICompatibleText(payload),
    usage: parseOpenAICompatibleUsage(payload),
    latencyMs: Date.now() - startedAt,
    provider,
    model,
    attemptedProviders: [],
  };
};

const callGemini = async (
  prompt: string,
  systemInstruction: string,
  responseMimeType?: 'application/json',
  maxOutputTokens?: number,
): Promise<CoachLlmResult | null> => {
  if (!GEMINI_API_KEY) {
    return null;
  }

  const startedAt = Date.now();
  const response = await fetchWithTimeout(
    `${GEMINI_BASE_URL}/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemInstruction }],
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: responseMimeType ? 0.2 : 0.45,
          topP: 0.9,
          maxOutputTokens: maxOutputTokens ?? getCoachLlmDefaultMaxOutputTokens(responseMimeType),
          ...(responseMimeType ? { responseMimeType } : {}),
        },
      }),
    },
    PROVIDER_TIMEOUT_MS,
    'Gemini request',
  );

  const payload = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    const message =
      typeof payload === 'object' && payload !== null && 'error' in payload
        ? JSON.stringify((payload as { error?: unknown }).error)
        : `Gemini request failed (${response.status})`;
    throw new Error(message);
  }

  return {
    text: parseGeminiText(payload),
    usage: parseGeminiUsage(payload),
    latencyMs: Date.now() - startedAt,
    provider: 'google-ai-studio',
    model: GEMINI_MODEL,
    attemptedProviders: [],
  };
};

const callCoachLlm = async (
  prompt: string,
  systemInstruction: string,
  responseMimeType?: 'application/json',
  maxOutputTokens?: number,
  isUsableText?: (text: string) => boolean,
): Promise<CoachLlmResult | null> => {
  const attemptedProviders: string[] = [];
  const errors: string[] = [];

  for (const provider of COACH_PROVIDER_ORDER) {
    const hasKey =
      provider === 'gemini'
        ? Boolean(GEMINI_API_KEY)
        : provider === 'claude-agent'
          ? Boolean(CLAUDE_AGENT_API_KEY && CLAUDE_AGENT_BASE_URL)
          : Boolean(OPENAI_COMPAT_API_KEY);
    if (!hasKey) {
      continue;
    }

    const providerLabel = provider === 'gemini' ? 'google-ai-studio' : provider;
    const maxAttempts = PROVIDER_RETRY_COUNT + 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const attemptLabel = attempt === 1 ? providerLabel : `${providerLabel} retry ${attempt - 1}`;
      attemptedProviders.push(attemptLabel);

      try {
        const result =
          provider === 'gemini'
            ? await callGemini(prompt, systemInstruction, responseMimeType, maxOutputTokens)
            : await callOpenAICompatibleProvider(
                provider,
                prompt,
                systemInstruction,
                responseMimeType,
                maxOutputTokens,
              );
        if (!result?.text) {
          errors.push(`${attemptLabel}: empty response`);
          if (attempt < maxAttempts && PROVIDER_RETRY_DELAY_MS > 0) {
            await sleep(PROVIDER_RETRY_DELAY_MS);
          }
          continue;
        }
        if (isUsableText && !isUsableText(result.text)) {
          errors.push(`${attemptLabel}: unusable response`);
          if (attempt < maxAttempts && PROVIDER_RETRY_DELAY_MS > 0) {
            await sleep(PROVIDER_RETRY_DELAY_MS);
          }
          continue;
        }
        return {
          ...result,
          attemptedProviders,
        };
      } catch (error) {
        errors.push(`${attemptLabel}: ${String(error)}`);
        if (attempt < maxAttempts && PROVIDER_RETRY_DELAY_MS > 0) {
          await sleep(PROVIDER_RETRY_DELAY_MS);
        }
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Coach LLM providers failed: ${errors.join(' | ')}`);
  }

  return null;
};

const translateGroundedText = async ({
  text,
  from,
  to,
  requestBaseUrl,
  forwardAuthorization,
  forwardApiKey,
  runtime,
}: {
  text: string;
  from: TranslationLanguage;
  to: TranslationLanguage;
  requestBaseUrl: string;
  forwardAuthorization?: string;
  forwardApiKey?: string;
  runtime: RuntimeState;
}): Promise<GroundedTranslationResult> => {
  const startedAt = Date.now();
  const base = requestBaseUrl.replace(/\/$/, '');
  const endpoint = `${base}/functions/v1/ai-translate`;

  const callAiTranslate = async (authorization?: string): Promise<Response> => {
    const resolvedApiKey =
      (typeof forwardApiKey === 'string' && forwardApiKey.trim()) || SUPABASE_ANON_KEY;
    const resolvedAuthorization =
      (typeof authorization === 'string' && authorization.trim()) ||
      (resolvedApiKey ? `Bearer ${resolvedApiKey}` : '');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (resolvedApiKey) {
      headers.apikey = resolvedApiKey;
    }
    if (resolvedAuthorization) {
      headers.Authorization = resolvedAuthorization;
    }

    return fetchWithTimeout(
      endpoint,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ text, from, to }),
      },
      AI_TRANSLATE_TIMEOUT_MS,
      'ai-translate request',
    );
  };

  const forwardedAuth =
    typeof forwardAuthorization === 'string' && forwardAuthorization.trim().length > 0
      ? forwardAuthorization.trim()
      : undefined;

  try {
    let response = await callAiTranslate(forwardedAuth);
    if ((response.status === 401 || response.status === 403) && forwardedAuth) {
      response = await callAiTranslate(undefined);
    }

    const payload = (await response.json().catch(() => null)) as {
      translated_text?: unknown;
      provider?: unknown;
      model?: unknown;
      warning?: unknown;
      error?: unknown;
      meta?: unknown;
    } | null;

    if (
      !response.ok ||
      !payload ||
      typeof payload.translated_text !== 'string' ||
      !payload.translated_text.trim()
    ) {
      const payloadMessage =
        payload && typeof payload.warning === 'string' && payload.warning.trim()
          ? payload.warning.trim()
          : payload && typeof payload.error === 'string' && payload.error.trim()
            ? payload.error.trim()
            : null;
      const detail = payloadMessage ?? `ai-translate request failed (${response.status})`;
      throw new Error(detail);
    }

    const translatedText = normalizeTranslationText(payload.translated_text);
    const provider =
      typeof payload.provider === 'string' && payload.provider.trim()
        ? payload.provider.trim()
        : 'ai-translate';
    const model =
      typeof payload.model === 'string' && payload.model.trim() ? payload.model.trim() : provider;
    const warning =
      typeof payload.warning === 'string' && payload.warning.trim()
        ? payload.warning.trim()
        : undefined;
    const outputEqualsInput = normalizeComparable(translatedText) === normalizeComparable(text);
    const lowConfidenceWarning = Boolean(warning && /low confidence|uncertain/i.test(warning));
    const providerSemaiSource = mapProviderToSemaiSource(provider);
    const verifiedProvider =
      providerSemaiSource !== 'none' && VERIFIED_SEMAI_PROVIDERS.has(provider);
    const semaiVerified =
      verifiedProvider &&
      !lowConfidenceWarning &&
      (from === 'semai' || (to === 'semai' && !outputEqualsInput));
    const semaiSource = semaiVerified ? providerSemaiSource : 'none';
    const grounded = from === 'semai' || to === 'semai' ? semaiVerified : true;

    if (!grounded) {
      setDegraded(runtime, 'grounding_unavailable');
    }

    markStageTiming(runtime, 'grounding', Date.now() - startedAt);

    return {
      translatedText,
      sourceText: normalizeTranslationText(text),
      provider,
      model,
      warning,
      grounded,
      groundingSource: [provider, 'ai-translate'],
      validationPassed: grounded,
      semaiVerified,
      semaiSource,
      meta: {
        latency_ms: Date.now() - startedAt,
        source: 'ai-translate',
        output_equals_input: outputEqualsInput,
        ...(typeof payload.meta === 'object' && payload.meta !== null ? payload.meta : {}),
      },
    };
  } catch (error) {
    markStageTiming(runtime, 'grounding', Date.now() - startedAt);
    const message = error instanceof Error ? error.message : 'Grounded translation failed.';
    if (/timed out/i.test(message)) {
      setDegraded(runtime, 'timeout');
    } else {
      setDegraded(runtime, 'grounding_unavailable');
    }

    const exactFallbackTranslation =
      findExactGlossaryTranslation(text, from, to) ??
      findExactSentenceExampleTranslation(text, from, to);
    const translatedText = normalizeTranslationText(exactFallbackTranslation ?? text);
    const sourceText = normalizeTranslationText(text);
    const hasDictionaryFallback = Boolean(
      exactFallbackTranslation && translatedText.trim().length > 0,
    );
    const requiresSemaiVerification = from === 'semai' || to === 'semai';
    const semaiVerified = hasDictionaryFallback && requiresSemaiVerification;

    return {
      translatedText,
      sourceText,
      provider: hasDictionaryFallback ? 'dictionary-fallback' : 'ai-translate-unavailable',
      model: hasDictionaryFallback ? 'dictionary-exact' : 'ai-translate-unavailable',
      warning: message,
      grounded: !requiresSemaiVerification || semaiVerified,
      groundingSource: hasDictionaryFallback
        ? ['dictionary_fallback', 'ai-translate']
        : ['ai-translate'],
      validationPassed: !requiresSemaiVerification || semaiVerified,
      semaiVerified,
      semaiSource: semaiVerified ? 'dictionary_fallback' : 'none',
      meta: {
        latency_ms: Date.now() - startedAt,
        source: hasDictionaryFallback ? 'dictionary_fallback' : 'ai-translate',
        fallback_applied: hasDictionaryFallback,
        error: message,
      },
    };
  }
};

type VerifiedLearningCandidate = {
  id: string;
  semai: string;
  translation: string;
  source: 'glossary' | 'sentence_memory';
  score: number;
};

const BEGINNER_GLOSSARY_PRIORITY: Record<string, number> = {
  'abat-cloth': 90,
  'abei-mother': 88,
  'abek-father': 86,
  'darat-forest': 82,
  'jeres-jungle': 80,
  'abor-expression-for-greetings-meaning-be-well-or-be-safe': 76,
  'teal-raise-a-hand-as-a-sign-of-greetings-from-afar': 70,
};

const GREETING_GLOSSARY_PRIORITY: Record<string, number> = {
  'abor-expression-for-greetings-meaning-be-well-or-be-safe': 95,
  'teal-raise-a-hand-as-a-sign-of-greetings-from-afar': 86,
};

const isCleanBeginnerGlossaryText = (entry: {
  semai: string;
  translation: string;
  category?: string;
}): boolean => {
  const semai = normalizeComparable(entry.semai);
  const translation = normalizeComparable(entry.translation);

  if (!semai || !translation) {
    return false;
  }

  if (semai.length > 18 || semai.split(/\s+/).length > 2) {
    return false;
  }

  if (translation.length > 64 || /[()[\];]/.test(entry.translation)) {
    return false;
  }

  return true;
};

const DEFAULT_TRACK_CATEGORIES: Record<LearningTrack, string[]> = {
  vocabulary_first: ['nature', 'family', 'food', 'phrase'],
  daily_conversation: ['phrase', 'family', 'person'],
  pronunciation: ['phrase', 'nature', 'family'],
};

const inferLearningCategories = (
  message: string,
  track: LearningTrack,
  topicHint?: string,
): string[] => {
  const normalized = normalizeComparable(message);
  const categories = new Set<string>(DEFAULT_TRACK_CATEGORIES[track]);

  // Prioritize categories derived from the topic hint (e.g., from onboarding selection)
  if (topicHint) {
    const normalizedHint = topicHint.toLowerCase();
    if (/nature/.test(normalizedHint)) categories.add('nature');
    if (/family/.test(normalizedHint)) categories.add('family');
    if (/food/.test(normalizedHint)) categories.add('food');
    if (/greet/.test(normalizedHint)) categories.add('phrase');
    if (/conversation/.test(normalizedHint)) categories.add('phrase');
    if (/pronunciation/.test(normalizedHint)) categories.add('phrase');
    if (/action|verb/.test(normalizedHint)) categories.add('verb');
  }

  if (/\bnature|alam|forest|river|tree|mountain|air|water\b/i.test(normalized)) {
    categories.add('nature');
  }
  if (/\bfamily|keluarga|child|anak|mother|father\b/i.test(normalized)) {
    categories.add('family');
  }
  if (/\bfood|makan|drink|rice|eat\b/i.test(normalized)) {
    categories.add('food');
  }
  if (
    /\bgreet|greeting|greetings|hello|morning|night|apa khabar|terima kasih\b/i.test(normalized)
  ) {
    categories.add('phrase');
  }
  if (/\bpronunciation|sebutan|repeat\b/i.test(normalized)) {
    categories.add('phrase');
  }

  return Array.from(categories);
};

const mapGrammarToSemanticCategory = (grammarCategory: string): string[] => {
  const cat = grammarCategory.toLowerCase();
  if (cat === 'kata nama') return ['nature', 'family', 'food'];
  if (cat === 'kata kerja') return ['phrase', 'verb'];
  if (cat === 'kata sifat') return ['nature'];
  if (cat === 'kata keterangan') return ['phrase'];
  if (cat === 'kata seru') return ['phrase'];
  return ['phrase']; // default: treat unknown grammar categories as phrase
};

const buildGlossaryCandidates = (
  message: string,
  answerLanguage: 'en' | 'ms',
  categories: string[],
): VerifiedLearningCandidate[] => {
  const tokens = tokenizeComparable(message);
  const categorySet = new Set(categories.map((value) => value.toLowerCase()));
  const wantsGreeting = /\b(greet|greeting|greetings|hello|morning|night|thank|sapaan)\b/i.test(
    message,
  );

  return SEMAI_GLOSSARY.filter((entry) => normalizeComparable(entry.semai).length > 0)
    .map((entry) => {
      let score = 0;
      const mappedCategories = mapGrammarToSemanticCategory(entry.category);
      const categoryMatch =
        categorySet.has(entry.category.toLowerCase()) ||
        mappedCategories.some((c) => categorySet.has(c));
      if (categoryMatch) {
        score += 4;
      }

      const semaiNorm = normalizeComparable(entry.semai);
      const msNorm = normalizeComparable(entry.ms);
      const meaningNorm = normalizeComparable(`${entry.id} ${entry.en} ${entry.ms}`);
      if (
        wantsGreeting &&
        /\b(greet|greeting|greetings|good morning|good night|thank you|apa khabar|selamat pagi|selamat malam|terima kasih)\b/i.test(
          meaningNorm,
        )
      ) {
        score += 24;
      }
      if (semaiNorm.length > 0 && msNorm.length > 0 && semaiNorm !== msNorm) {
        score += 3;
      }

      const translation = answerLanguage === 'ms' ? entry.ms : entry.en;
      const cleanBeginnerText = isCleanBeginnerGlossaryText({
        semai: entry.semai,
        translation,
        category: entry.category,
      });
      if (cleanBeginnerText) {
        score += 12;
      } else {
        score -= 14;
      }
      if (entry.category.toLowerCase() === 'kata nama') {
        score += 6;
      }
      score += BEGINNER_GLOSSARY_PRIORITY[entry.id] ?? 0;
      if (wantsGreeting) {
        score += GREETING_GLOSSARY_PRIORITY[entry.id] ?? 0;
      }
      score += countTokenOverlap(`${entry.semai} ${entry.en} ${entry.ms}`, tokens) * 3;
      return {
        id: entry.id,
        semai: entry.semai,
        translation,
        source: 'glossary' as const,
        score,
      };
    })
    .filter((entry) => entry.translation.trim().length > 0)
    .sort((a, b) => b.score - a.score);
};

const buildSentenceCandidates = (
  message: string,
  answerLanguage: 'en' | 'ms',
): VerifiedLearningCandidate[] => {
  const tokens = tokenizeComparable(message);
  return SEMAI_SENTENCE_EXAMPLES.map((entry: SentenceExampleEntry) => {
    const score =
      countTokenOverlap(`${entry.semai} ${entry.en} ${entry.ms} ${entry.headword}`, tokens) * 4 +
      (entry.source.toLowerCase().includes('webonary') ? 1 : 0);
    return {
      id: entry.id,
      semai: entry.semai,
      translation: answerLanguage === 'ms' ? entry.ms : entry.en,
      source: 'sentence_memory' as const,
      score,
    };
  })
    .filter(
      (entry) => normalizeComparable(entry.semai).length > 0 && entry.translation.trim().length > 0,
    )
    .sort((a, b) => b.score - a.score);
};

const pickVerifiedLearningCandidate = (
  intent: CoachIntentResult,
  message: string,
  turns: CoachRequest['turns'],
  track: LearningTrack,
  topicHint?: string,
): VerifiedLearningCandidate | null => {
  const answerLanguage = intent.answerLanguage === 'ms' ? 'ms' : 'en';
  const contextMessage = buildLearningSeed({
    message,
    extractedText: intent.extractedText,
    turns,
    clientAction: intent.turnType === 'conversation_continue' ? 'continue_session' : undefined,
    track,
  });
  const categories = inferLearningCategories(contextMessage, track, topicHint);
  const recentAssistantSemai = collectRecentAssistantSemaiTexts(turns);
  const glossaryCandidates = buildGlossaryCandidates(
    contextMessage,
    answerLanguage,
    categories,
  ).slice(0, 20);
  const sentenceCandidates = buildSentenceCandidates(contextMessage, answerLanguage).slice(0, 20);

  const normalizedTopicHint = normalizeComparable(topicHint ?? '');
  const topicRequestsConversation = /\bconversation\b/.test(normalizedTopicHint);
  const shouldUseSentencePriority =
    intent.turnType === 'sentence_help' ||
    (intent.turnType === 'scenario_start'
      ? topicRequestsConversation || (!normalizedTopicHint && track === 'daily_conversation')
      : track === 'daily_conversation');

  const prioritized = shouldUseSentencePriority
    ? [...sentenceCandidates, ...glossaryCandidates]
    : [...glossaryCandidates, ...sentenceCandidates];

  if (prioritized.length === 0) {
    return null;
  }
  const unseenCandidate = prioritized.find(
    (candidate) => !recentAssistantSemai.has(normalizeComparable(candidate.semai)),
  );
  return unseenCandidate ?? prioritized[0];
};

const buildTranslationTask = (
  intent: CoachIntentResult,
  message: string,
  _turns: CoachRequest['turns'],
): { text: string; from: TranslationLanguage; to: TranslationLanguage } | null => {
  if (intent.mode !== 'learning') {
    return null;
  }

  if (
    intent.turnType === 'scenario_start' ||
    intent.turnType === 'conversation_continue' ||
    intent.turnType === 'sentence_help'
  ) {
    return null;
  }

  if (intent.turnType === 'how_to_say') {
    return {
      text: intent.extractedText ?? message,
      from: intent.sourceLanguage ?? (intent.answerLanguage === 'ms' ? 'ms' : 'en'),
      to: intent.targetLanguage ?? 'semai',
    };
  }

  if (intent.turnType === 'word_help') {
    const wordText =
      typeof intent.extractedText === 'string' && isExactVerifiedSemaiInput(intent.extractedText)
        ? intent.extractedText
        : message;
    return {
      text: wordText,
      from: 'semai',
      to: intent.targetLanguage ?? (intent.answerLanguage === 'ms' ? 'ms' : 'en'),
    };
  }

  return null;
};

const parseTranslationFocus = (message: string): string =>
  message
    .replace(
      /\b(how do i say|how to say|translate|terjemah(?:kan)?|bagaimana (nak )?cakap|macam mana nak cakap)\b/gi,
      '',
    )
    .replace(/["“”'‘’]/g, '')
    .replace(/^[\s:,-]+|[\s?.!]+$/g, '')
    .trim();

const defaultNextActions = (phase: SessionPhase): ClientAction[] => {
  if (phase === 'learning_active') {
    return ['continue_session', 'translate_inline', 'end_session'];
  }
  return ['start_easy', 'practice_greetings', 'make_plan', 'translate_inline'];
};

const recoveryNextActions = (): ClientAction[] => [
  'slow_down',
  'explain_first',
  'try_again',
  'end_session',
];

const parseLlmIntentJson = (value: string): LlmIntentPayload | null => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    const mode =
      parsed.mode === 'learning' || parsed.mode === 'direct_help' || parsed.mode === 'clarification'
        ? parsed.mode
        : null;
    if (!mode) return null;

    const turnType =
      parsed.turn_type === 'scenario_start' ||
      parsed.turn_type === 'conversation_continue' ||
      parsed.turn_type === 'sentence_help' ||
      parsed.turn_type === 'word_help' ||
      parsed.turn_type === 'how_to_say' ||
      parsed.turn_type === 'direct_answer' ||
      parsed.turn_type === 'clarification'
        ? parsed.turn_type
        : undefined;
    const answerLanguage =
      parsed.answer_language === 'ms' || parsed.answer_language === 'en'
        ? parsed.answer_language
        : undefined;
    const extractedText =
      typeof parsed.extracted_text === 'string' && parsed.extracted_text.trim()
        ? parsed.extracted_text.trim().slice(0, 220)
        : undefined;
    const needsClarification =
      typeof parsed.needs_clarification === 'boolean' ? parsed.needs_clarification : undefined;
    const confidence =
      parsed.confidence === 'high' || parsed.confidence === 'low' ? parsed.confidence : undefined;
    const reason =
      typeof parsed.reason === 'string' && parsed.reason.trim() ? parsed.reason.trim() : undefined;
    return {
      mode,
      turn_type: turnType,
      answer_language: answerLanguage,
      extracted_text: extractedText,
      needs_clarification: needsClarification,
      confidence,
      reason,
    };
  } catch {
    return null;
  }
};

const createDefaultIntent = (message: string): CoachIntentResult => ({
  mode: 'direct_help',
  turnType: 'direct_answer',
  responseMode: 'direct_answer',
  answerLanguage: detectCoachAnswerLanguage(message),
  needsClarification: false,
  confidence: 'low',
  reason: 'Defaulted to direct help.',
});

const buildPrimaryIntentPrompt = (
  request: CoachRequest,
  currentPhase: SessionPhase,
  track: LearningTrack,
  explicitTranslationIntent: boolean,
): string =>
  [
    'Return valid JSON only with keys: mode, turn_type, answer_language, extracted_text, needs_clarification, confidence, reason.',
    'Allowed mode values: learning, direct_help, clarification.',
    'Allowed turn_type values: scenario_start, conversation_continue, sentence_help, word_help, how_to_say, direct_answer, clarification.',
    `Current session phase: ${currentPhase}. Current learning track: ${track}.`,
    'Policy: learning mode for Semai-learning goals, direct_help for broad help/product questions, clarification only when prompt is too vague.',
    `Hard rule: explicit_translation_intent=${explicitTranslationIntent}. If false, do NOT output turn_type=how_to_say.`,
    request.clientAction ? `Client action: ${request.clientAction}` : '',
    'If phase=idle and user broadly asks to learn Semai, return mode=direct_help turn_type=direct_answer so Tavi can offer options first.',
    'Use learning scenario_start only when the user asks for a specific practice topic or chose a practice action.',
    'If the user seems frustrated, confused, or asks to slow down, return mode=direct_help turn_type=direct_answer.',
    'If user asks for a sentence example, return mode=learning turn_type=sentence_help.',
    'If phase=learning_active and user keeps practicing, prefer conversation_continue/sentence_help/word_help.',
    request.turns.length > 0
      ? `Recent context:\n${buildConversationContext(request.turns, 5, 110)}`
      : '',
    `User message: ${request.message}`,
  ]
    .filter(Boolean)
    .join('\n\n');

const resolveIntentWithPlanner = async (
  request: CoachRequest,
  currentPhase: SessionPhase,
  track: LearningTrack,
  runtime: RuntimeState,
  requestStartedAtMs: number,
): Promise<OrchestrationResult> => {
  const baseIntent = createDefaultIntent(request.message);
  const answerLanguage = detectCoachAnswerLanguage(request.message);
  const plannerAnswerLanguage: 'en' | 'ms' = answerLanguage === 'ms' ? 'ms' : 'en';
  const provider = 'rules';
  const model = 'phase-rules';

  if (isGreetingOnlyPrompt(request.message)) {
    return {
      intent: {
        ...baseIntent,
        reason: 'Greeting-only prompt; return conversational greeting.',
      },
      sessionPhase: 'idle',
      track,
      nextActions: defaultNextActions('idle'),
      provider,
      model,
    };
  }

  if (isOutOfScopeNonLanguageRequest(request.message)) {
    return {
      intent: {
        ...baseIntent,
        mode: 'direct_help',
        turnType: 'direct_answer',
        responseMode: 'direct_answer',
        answerLanguage,
        needsClarification: false,
        confidence: 'high',
        reason: 'scope_guard_out_of_scope: User asked for a non-Semai task or prompt injection.',
      },
      sessionPhase: currentPhase === 'idle' ? 'onboarding' : currentPhase,
      track,
      nextActions: defaultNextActions(currentPhase === 'idle' ? 'onboarding' : currentPhase),
      provider,
      model,
    };
  }

  if (request.clientAction === 'end_session' || isLearningExitIntent(request.message)) {
    return {
      intent: {
        ...baseIntent,
        reason: 'Detected request to close the current learning session.',
        confidence: 'high',
      },
      sessionPhase: 'idle',
      track,
      nextActions: defaultNextActions('idle'),
      provider,
      model,
    };
  }

  const explicitRecoveryRequested =
    request.clientAction === 'slow_down' ||
    request.clientAction === 'explain_first' ||
    request.clientAction === 'try_again' ||
    isFrustrationIntent(request.message);
  if (explicitRecoveryRequested && !isVocabularyPracticeIntent(request.message)) {
    return {
      intent: {
        ...baseIntent,
        mode: 'direct_help',
        turnType: 'direct_answer',
        responseMode: 'direct_answer',
        answerLanguage,
        needsClarification: false,
        confidence: 'high',
        reason: 'recovery: User is confused or wants the coach to slow down.',
      },
      sessionPhase: 'onboarding',
      track,
      nextActions: recoveryNextActions(),
      provider,
      model,
    };
  }

  if (isContinueLaterFollowUpIntent(request.message)) {
    return {
      intent: {
        ...baseIntent,
        mode: 'direct_help',
        turnType: 'direct_answer',
        responseMode: 'direct_answer',
        answerLanguage,
        needsClarification: false,
        confidence: 'high',
        reason: 'onboarding: User wants to continue learning later.',
      },
      sessionPhase: 'onboarding',
      track,
      nextActions: defaultNextActions('onboarding'),
      provider,
      model,
    };
  }

  if (isExplainCurrentFollowUpIntent(request.message)) {
    const verifiedContext = findLatestVerifiedContext(
      request.turns,
      answerLanguage === 'ms' ? 'ms' : 'en',
    );
    return {
      intent: {
        ...baseIntent,
        mode: 'direct_help',
        turnType: 'direct_answer',
        responseMode: 'direct_answer',
        answerLanguage,
        needsClarification: false,
        confidence: 'high',
        reason:
          verifiedContext?.kind === 'sentence'
            ? 'follow_up_translation_help'
            : 'follow_up_explain_current',
      },
      sessionPhase: currentPhase === 'idle' ? 'onboarding' : currentPhase,
      track,
      nextActions: defaultNextActions(currentPhase === 'idle' ? 'onboarding' : currentPhase),
      provider,
      model,
    };
  }

  if (isMemoryTipFollowUpIntent(request.message)) {
    return {
      intent: {
        ...baseIntent,
        mode: 'direct_help',
        turnType: 'direct_answer',
        responseMode: 'direct_answer',
        answerLanguage,
        needsClarification: false,
        confidence: 'high',
        reason: 'follow_up_memory_tip',
      },
      sessionPhase: currentPhase === 'idle' ? 'onboarding' : currentPhase,
      track,
      nextActions: defaultNextActions(currentPhase === 'idle' ? 'onboarding' : currentPhase),
      provider,
      model,
    };
  }

  if (isSafePracticeFollowUpIntent(request.message)) {
    return {
      intent: {
        ...baseIntent,
        mode: 'direct_help',
        turnType: 'direct_answer',
        responseMode: 'direct_answer',
        answerLanguage,
        needsClarification: false,
        confidence: 'high',
        reason: 'follow_up_safe_practice',
      },
      sessionPhase: currentPhase === 'idle' ? 'onboarding' : currentPhase,
      track,
      nextActions: defaultNextActions(currentPhase === 'idle' ? 'onboarding' : currentPhase),
      provider,
      model,
    };
  }

  if (isSafeAlternativeFollowUpIntent(request.message)) {
    if (/\b(something\s+verified|verified\s+instead|disahkan)\b/i.test(request.message)) {
      return {
        intent: {
          mode: 'learning',
          turnType: 'scenario_start',
          responseMode: 'scenario',
          answerLanguage,
          sourceLanguage: answerLanguage,
          targetLanguage: 'semai',
          extractedText: 'safe verified Semai vocabulary item',
          needsClarification: false,
          confidence: 'high',
          reason: 'User chose a safe verified alternative.',
        },
        sessionPhase: 'learning_active',
        track,
        nextActions: defaultNextActions('learning_active'),
        provider,
        model,
      };
    }

    return {
      intent: {
        ...baseIntent,
        mode: 'direct_help',
        turnType: 'direct_answer',
        responseMode: 'direct_answer',
        answerLanguage,
        needsClarification: false,
        confidence: 'high',
        reason: 'scope_guard: User chose a safer verified alternative.',
      },
      sessionPhase: currentPhase === 'idle' ? 'onboarding' : currentPhase,
      track,
      nextActions: defaultNextActions(currentPhase === 'idle' ? 'onboarding' : currentPhase),
      provider,
      model,
    };
  }

  if (request.clientAction === 'make_plan' || isLearningAdviceIntent(request.message)) {
    return {
      intent: {
        ...baseIntent,
        mode: 'direct_help',
        turnType: 'direct_answer',
        responseMode: 'direct_answer',
        answerLanguage,
        needsClarification: false,
        confidence: 'high',
        reason: 'onboarding_plan: User asked for Semai learning advice or a plan.',
      },
      sessionPhase: 'onboarding',
      track,
      nextActions: defaultNextActions('onboarding'),
      provider,
      model,
    };
  }

  const sentenceExampleRequested = isSentenceRequestIntent(request.message);
  if (
    (isUnsafeSentenceGenerationRequest(request.message) && !sentenceExampleRequested) ||
    (isUnsupportedExampleRequest(request.message) && !sentenceExampleRequested)
  ) {
    return {
      intent: {
        ...baseIntent,
        mode: 'direct_help',
        turnType: 'direct_answer',
        responseMode: 'direct_answer',
        answerLanguage,
        needsClarification: false,
        confidence: 'high',
        reason: isUnsupportedExampleRequest(request.message)
          ? 'scope_guard: User asked for more greeting examples than the verified set supports.'
          : 'scope_guard: User asked Tavi to construct a Semai sentence from a word.',
      },
      sessionPhase: currentPhase === 'idle' ? 'onboarding' : currentPhase,
      track,
      nextActions:
        currentPhase === 'learning_active'
          ? defaultNextActions('learning_active')
          : defaultNextActions('onboarding'),
      provider,
      model,
    };
  }

  if (
    isInterestingWordPracticeIntent(request.message) ||
    isVocabularyPracticeIntent(request.message)
  ) {
    return {
      intent: {
        mode: 'learning',
        turnType: 'scenario_start',
        responseMode: 'scenario',
        answerLanguage,
        sourceLanguage: answerLanguage,
        targetLanguage: 'semai',
        extractedText: 'easy interesting Semai vocabulary word',
        needsClarification: false,
        confidence: 'high',
        reason: 'User explicitly asked for verified Semai vocabulary practice.',
      },
      sessionPhase: 'learning_active',
      track,
      nextActions: defaultNextActions('learning_active'),
      provider,
      model,
    };
  }

  if (request.clientAction === 'start_easy' || request.clientAction === 'practice_greetings') {
    return {
      intent: {
        mode: 'learning',
        turnType: 'scenario_start',
        responseMode: 'scenario',
        answerLanguage,
        sourceLanguage: answerLanguage,
        targetLanguage: 'semai',
        extractedText:
          request.clientAction === 'practice_greetings' ? 'basic greetings' : 'easy beginner item',
        needsClarification: false,
        confidence: 'high',
        reason:
          request.clientAction === 'practice_greetings'
            ? 'User explicitly chose greeting practice.'
            : 'User explicitly chose an easy practice start.',
      },
      sessionPhase: 'learning_active',
      track,
      nextActions: defaultNextActions('learning_active'),
      provider,
      model,
    };
  }

  const explicitTranslationIntent = isExplicitTranslationIntent(request.message);
  if (explicitTranslationIntent || request.clientAction === 'translate_inline') {
    const direction = resolveCoachTranslateDirection({
      message: parseTranslationFocus(request.message) || request.message,
      answerLanguage: plannerAnswerLanguage,
    });
    return {
      intent: {
        mode: 'learning',
        turnType: direction.from === 'semai' ? 'word_help' : 'how_to_say',
        responseMode: direction.from === 'semai' ? 'word_help' : 'translation',
        answerLanguage,
        sourceLanguage: direction.from,
        targetLanguage: direction.to,
        extractedText: direction.text,
        needsClarification: false,
        confidence: 'high',
        reason: 'Explicit translation request inside coach.',
      },
      sessionPhase: currentPhase,
      track,
      nextActions: defaultNextActions(currentPhase),
      provider,
      model,
    };
  }

  if (currentPhase === 'learning_active' && isLearningNextStepIntent(request.message)) {
    return {
      intent: {
        mode: 'learning',
        turnType: 'sentence_help',
        responseMode: 'sentence_help',
        answerLanguage,
        sourceLanguage: answerLanguage,
        targetLanguage: 'semai',
        extractedText: request.message,
        needsClarification: false,
        confidence: 'high',
        reason: 'User asked for the next grounded practice sentence.',
      },
      sessionPhase: 'learning_active',
      track,
      nextActions: defaultNextActions('learning_active'),
      provider,
      model,
    };
  }

  // Deterministic: generic sentence/example request, any phase.
  // Covers "sentence please", "give me a sentence in semai example", etc.
  // that the LLM planner sometimes misclassifies as direct_help.
  if (isSentenceRequestIntent(request.message)) {
    return {
      intent: {
        mode: 'learning',
        turnType: 'sentence_help',
        responseMode: 'sentence_help',
        answerLanguage,
        sourceLanguage: answerLanguage,
        targetLanguage: 'semai',
        extractedText: request.message,
        needsClarification: false,
        confidence: 'high',
        reason: 'Detected sentence or example request deterministically.',
      },
      sessionPhase: 'learning_active',
      track,
      nextActions: defaultNextActions('learning_active'),
      provider,
      model,
    };
  }

  if (
    (currentPhase === 'idle' || currentPhase === 'onboarding') &&
    isSpecificPracticeStartIntent(request.message)
  ) {
    return {
      intent: {
        mode: 'learning',
        turnType: 'scenario_start',
        responseMode: 'scenario',
        answerLanguage,
        sourceLanguage: answerLanguage,
        targetLanguage: 'semai',
        extractedText: request.message,
        needsClarification: false,
        confidence: 'high',
        reason: 'Detected specific practice topic; starting grounded lesson.',
      },
      sessionPhase: 'learning_active',
      track,
      nextActions: defaultNextActions('learning_active'),
      provider,
      model,
    };
  }

  if (
    (currentPhase === 'idle' || currentPhase === 'onboarding') &&
    isLearningGoalIntent(request.message) &&
    !isSpecificPracticeIntent(request.message)
  ) {
    return {
      intent: {
        ...baseIntent,
        mode: 'direct_help',
        turnType: 'direct_answer',
        responseMode: 'direct_answer',
        answerLanguage,
        needsClarification: false,
        confidence: 'high',
        reason: 'onboarding: Broad Semai learning goal needs coaching options before practice.',
      },
      sessionPhase: 'onboarding',
      track,
      nextActions: defaultNextActions('onboarding'),
      provider,
      model,
    };
  }

  if (currentPhase === 'idle' && isLearningGoalIntent(request.message)) {
    return {
      intent: {
        mode: 'learning',
        turnType: 'scenario_start',
        responseMode: 'scenario',
        answerLanguage,
        sourceLanguage: answerLanguage,
        targetLanguage: 'semai',
        needsClarification: false,
        confidence: 'high',
        reason: 'Learning goal detected; starting learning session directly.',
      },
      sessionPhase: 'learning_active',
      track,
      nextActions: defaultNextActions('learning_active'),
      provider,
      model,
    };
  }

  // Deterministic: bare Semai word during active learning session.
  // Catches polysemous words (e.g. "wig" = banyan tree / shout) that
  // isExplicitTranslationIntent misses and the LLM misclassifies as direct_help.
  if (currentPhase === 'learning_active' && hasGlossaryEntry(request.message, 'semai')) {
    return {
      intent: {
        mode: 'learning',
        turnType: 'word_help',
        responseMode: 'word_help',
        answerLanguage,
        sourceLanguage: 'semai',
        targetLanguage: answerLanguage === 'ms' ? 'ms' : 'en',
        extractedText: request.message,
        needsClarification: false,
        confidence: 'high',
        reason: 'Bare Semai glossary word detected during active learning session.',
      },
      sessionPhase: 'learning_active',
      track,
      nextActions: defaultNextActions('learning_active'),
      provider,
      model,
    };
  }

  const startConfirmed =
    request.clientAction === 'start_session' || isLearningStartConfirmation(request.message);
  if (currentPhase === 'onboarding' && startConfirmed) {
    return {
      intent: {
        mode: 'learning',
        turnType: 'scenario_start',
        responseMode: 'scenario',
        answerLanguage,
        sourceLanguage: answerLanguage,
        targetLanguage: 'semai',
        needsClarification: false,
        confidence: 'high',
        reason: 'User confirmed start session.',
      },
      sessionPhase: 'learning_active',
      track,
      nextActions: defaultNextActions('learning_active'),
      provider,
      model,
    };
  }

  if (remainingBudgetMs(requestStartedAtMs) <= CPU_GUARD_PLANNER_MIN_MS) {
    setDegraded(runtime, 'cpu_guard_planner_skip', { cpuGuard: true });
    return {
      intent: {
        ...baseIntent,
        reason:
          currentPhase === 'learning_active'
            ? 'Planner skipped due to CPU guard while learning is active.'
            : 'Planner skipped due to CPU guard; using deterministic direct help.',
      },
      sessionPhase: currentPhase,
      track,
      nextActions: defaultNextActions(currentPhase),
      provider: 'rules',
      model: 'planner-cpu-guard',
    };
  }

  const plannerStartedAtMs = Date.now();
  try {
    const generated = await callCoachLlm(
      buildPrimaryIntentPrompt(request, currentPhase, track, explicitTranslationIntent),
      'You are the intent orchestrator for a Semai language coach. Return compact JSON only.',
      'application/json',
      COACH_INTENT_MAX_OUTPUT_TOKENS,
      (text) => Boolean(parseLlmIntentJson(text)),
    );
    markStageTiming(runtime, 'planner', Date.now() - plannerStartedAtMs);

    const plannerProvider = generated?.text ? generated.provider : provider;
    const plannerModel = generated?.text ? generated.model : model;
    const parsed = parseLlmIntentJson(generated?.text ?? '');
    if (!parsed) {
      setDegraded(runtime, 'planner_invalid_json');
      return {
        intent: {
          ...baseIntent,
          reason: 'Planner output invalid, used deterministic default.',
        },
        sessionPhase: currentPhase,
        track,
        nextActions: defaultNextActions(currentPhase),
        provider: 'rules',
        model: 'planner-fallback',
      };
    }

    const plannedLanguage = parsed.answer_language ?? answerLanguage;
    const resolvedTurnType = parsed.turn_type ?? 'direct_answer';
    const resolvedMode = parsed.mode;
    const needsClarification = parsed.needs_clarification ?? resolvedMode === 'clarification';
    const confidence = parsed.confidence ?? 'low';
    const reason = parsed.reason ?? 'LLM primary classifier result.';

    if (
      resolvedMode === 'clarification' ||
      needsClarification ||
      resolvedTurnType === 'clarification'
    ) {
      return {
        intent: {
          ...baseIntent,
          mode: 'clarification',
          turnType: 'clarification',
          responseMode: 'clarification',
          answerLanguage: plannedLanguage,
          needsClarification: true,
          confidence,
          reason,
        },
        sessionPhase: currentPhase === 'learning_active' ? 'learning_active' : 'onboarding',
        track,
        nextActions: defaultNextActions(
          currentPhase === 'learning_active' ? 'learning_active' : currentPhase,
        ),
        provider: plannerProvider,
        model: plannerModel,
      };
    }

    if (
      currentPhase === 'idle' &&
      resolvedMode === 'learning' &&
      resolvedTurnType !== 'how_to_say'
    ) {
      if (resolvedTurnType !== 'sentence_help' && !isSpecificPracticeIntent(request.message)) {
        return {
          intent: {
            ...baseIntent,
            mode: 'direct_help',
            turnType: 'direct_answer',
            responseMode: 'direct_answer',
            answerLanguage: plannedLanguage,
            needsClarification: false,
            confidence,
            reason:
              'onboarding: Planner saw broad learning intent; offering choices before practice.',
          },
          sessionPhase: 'onboarding',
          track,
          nextActions: defaultNextActions('onboarding'),
          provider: plannerProvider,
          model: plannerModel,
        };
      }

      return {
        intent: {
          ...baseIntent,
          mode: 'learning',
          turnType: resolvedTurnType === 'sentence_help' ? 'sentence_help' : 'scenario_start',
          responseMode: resolvedTurnType === 'sentence_help' ? 'sentence_help' : 'scenario',
          answerLanguage: plannedLanguage,
          sourceLanguage: plannedLanguage,
          targetLanguage: 'semai',
          needsClarification: false,
          confidence: 'high',
          reason: 'Learning goal detected; starting learning session directly.',
        },
        sessionPhase: 'learning_active',
        track,
        nextActions: defaultNextActions('learning_active'),
        provider: plannerProvider,
        model: plannerModel,
      };
    }

    if (resolvedMode === 'direct_help' || resolvedTurnType === 'direct_answer') {
      return {
        intent: {
          ...baseIntent,
          answerLanguage: plannedLanguage,
          reason,
          confidence,
        },
        sessionPhase: currentPhase,
        track,
        nextActions: defaultNextActions(currentPhase),
        provider: plannerProvider,
        model: plannerModel,
      };
    }

    const learningTurn =
      resolvedTurnType === 'word_help'
        ? 'word_help'
        : resolvedTurnType === 'sentence_help'
          ? 'sentence_help'
          : currentPhase === 'learning_active'
            ? 'conversation_continue'
            : 'scenario_start';

    const plannerWordHelpText =
      resolvedTurnType === 'word_help'
        ? typeof parsed.extracted_text === 'string' &&
          isExactVerifiedSemaiInput(parsed.extracted_text)
          ? parsed.extracted_text
          : isExactVerifiedSemaiInput(request.message)
            ? request.message
            : (parsed.extracted_text ?? request.message)
        : parsed.extracted_text;

    return {
      intent: {
        ...baseIntent,
        mode: 'learning',
        turnType: learningTurn,
        responseMode:
          learningTurn === 'conversation_continue'
            ? 'conversation'
            : learningTurn === 'word_help'
              ? 'word_help'
              : learningTurn === 'sentence_help'
                ? 'sentence_help'
                : 'scenario',
        answerLanguage: plannedLanguage,
        sourceLanguage: learningTurn === 'word_help' ? 'semai' : plannedLanguage,
        targetLanguage: learningTurn === 'word_help' ? plannedLanguage : 'semai',
        extractedText:
          learningTurn === 'conversation_continue'
            ? request.message
            : learningTurn === 'word_help'
              ? plannerWordHelpText
              : parsed.extracted_text,
        needsClarification: false,
        confidence,
        reason,
      },
      sessionPhase: 'learning_active',
      track,
      nextActions: defaultNextActions('learning_active'),
      provider: plannerProvider,
      model: plannerModel,
    };
  } catch (error) {
    markStageTiming(runtime, 'planner', Date.now() - plannerStartedAtMs);
    setDegraded(runtime, /timed out/i.test(String(error)) ? 'timeout' : 'planner_error');
    return {
      intent: {
        ...baseIntent,
        reason:
          currentPhase === 'learning_active'
            ? 'Planner unavailable while learning is active.'
            : 'Planner unavailable; using deterministic direct help fallback.',
      },
      sessionPhase: currentPhase,
      track,
      nextActions: defaultNextActions(currentPhase),
      provider: 'rules',
      model: 'planner-fallback',
    };
  }
};

const applySessionPolicy = (
  request: CoachRequest,
  intent: CoachIntentResult,
  sessionPhase: SessionPhase,
): CoachIntentResult => {
  if (request.clientAction === 'end_session' || isLearningExitIntent(request.message)) {
    return {
      ...intent,
      mode: 'direct_help',
      turnType: 'direct_answer',
      responseMode: 'direct_answer',
      answerLanguage: detectCoachAnswerLanguage(request.message),
      needsClarification: false,
      confidence: 'high',
      reason: 'Detected request to close the current learning session.',
    };
  }

  if (sessionPhase !== 'learning_active') {
    return intent;
  }

  const detectedAnswerLanguage = detectCoachAnswerLanguage(request.message);
  if (
    request.clientAction !== 'continue_session' &&
    request.clientAction !== 'translate_inline' &&
    isExactVerifiedSemaiInput(request.message)
  ) {
    return {
      ...intent,
      mode: 'learning',
      turnType: 'word_help',
      responseMode: 'word_help',
      answerLanguage: detectedAnswerLanguage,
      sourceLanguage: 'semai',
      targetLanguage: detectedAnswerLanguage === 'ms' ? 'ms' : 'en',
      extractedText: request.message,
      needsClarification: false,
      confidence: 'high',
      reason: 'Detected exact verified Semai input during active learning.',
    };
  }

  if (request.clientAction === 'continue_session' && intent.mode !== 'learning') {
    return {
      ...intent,
      mode: 'learning',
      turnType: 'conversation_continue',
      responseMode: 'conversation',
      sourceLanguage: detectCoachAnswerLanguage(request.message),
      targetLanguage: 'semai',
      extractedText: request.message,
      needsClarification: false,
      confidence: 'high',
      reason: 'Continue-session action requested.',
    };
  }

  return intent;
};

const buildPedagogyFallback = (
  intent: CoachIntentResult,
  request: CoachRequest,
): Pick<
  CoachPayload,
  | 'coach_note'
  | 'follow_up_prompt'
  | 'follow_up_translation'
  | 'pronunciation_tip'
  | 'related_example'
> => {
  const answerLanguage = intent.answerLanguage === 'ms' ? 'ms' : 'en';
  const followUpContext: FollowUpContext =
    intent.responseMode === 'translation' || intent.turnType === 'how_to_say'
      ? 'translation'
      : intent.turnType === 'sentence_help' || intent.responseMode === 'sentence_help'
        ? 'verified_sentence'
        : 'verified_vocab';
  const fallbackFollowUpPrompt = buildContextualFollowUpPrompt(
    followUpContext,
    answerLanguage,
    request,
    findLatestVerifiedContext(request.turns, answerLanguage),
  );

  if (intent.turnType === 'scenario_start') {
    return {
      coach_note:
        'Start with the meaning and sound. Do not make a sentence until we have a verified example.',
      follow_up_prompt: fallbackFollowUpPrompt,
      follow_up_translation: null,
      pronunciation_tip: null,
      related_example: null,
    };
  }

  if (intent.turnType === 'word_help') {
    return {
      coach_note:
        'Focus on the key meaning first. I will not invent a sentence unless we have a verified example.',
      follow_up_prompt: fallbackFollowUpPrompt,
      follow_up_translation: null,
      pronunciation_tip: null,
      related_example: null,
    };
  }

  return {
    coach_note: 'Read the verified line once. Do not rewrite it as a new Semai sentence.',
    follow_up_prompt: fallbackFollowUpPrompt,
    follow_up_translation: null,
    pronunciation_tip: null,
    related_example: null,
  };
};

const buildVerifiedLearningTranslationResult = (
  request: CoachRequest,
  intent: CoachIntentResult,
  track: LearningTrack,
): GroundedTranslationResult | null => {
  const topicHint = inferScenarioTopic(request.message, request.turns) ?? undefined;
  const candidate = pickVerifiedLearningCandidate(
    intent,
    request.message,
    request.turns,
    track,
    topicHint,
  );
  if (!candidate) {
    return null;
  }

  return {
    translatedText: normalizeTranslationText(candidate.semai),
    sourceText: candidate.translation,
    provider: candidate.source === 'sentence_memory' ? 'sentence-memory' : 'glossary',
    model: candidate.id,
    grounded: true,
    groundingSource: [candidate.source],
    validationPassed: true,
    semaiVerified: true,
    semaiSource: candidate.source,
    meta: {
      selected_id: candidate.id,
      selected_source: candidate.source,
    },
  };
};

const buildPedagogyPrompt = (
  intent: CoachIntentResult,
  message: string,
  translationResult: GroundedTranslationResult,
  turns: CoachRequest['turns'],
): string => {
  const answerLanguageLabel = intent.answerLanguage === 'ms' ? 'Malay' : 'English';
  const verifiedSemaiSurface =
    intent.sourceLanguage === 'semai'
      ? translationResult.sourceText
      : translationResult.translatedText;
  return [
    'Return valid JSON only with keys: coach_note, follow_up_prompt, follow_up_translation, pronunciation_tip, related_example.',
    'Keep each field short and practical for a beginner.',
    'Do not generate or invent any Semai words in these fields.',
    'Do not ask the user to create, rewrite, or use a Semai word in a new sentence.',
    'Do not use em dashes or en dashes. Use commas, periods, or parentheses instead.',
    'For follow_up_prompt, write a varied complete user message that is safe to paste into the input, such as "Show me one more verified Semai vocabulary word" or "Give me a different easy Semai vocabulary word."',
    'Do not write follow_up_prompt as a question like "Want one more...?" because the UI copies it into the user input.',
    `If you mention Semai at all, you may only use this exact verified surface form: ${verifiedSemaiSurface}`,
    'Use only the explanation language requested for the rest of the text.',
    `User message: ${message}`,
    `Intent: ${intent.turnType}`,
    `Answer language for explanations: ${answerLanguageLabel}`,
    `Main reply: ${translationResult.translatedText}`,
    translationResult.warning ? `Translation warning: ${translationResult.warning}` : '',
    turns.length > 0
      ? `Recent context:\n${buildConversationContext(turns, PEDAGOGY_CONTEXT_TURNS, 90)}`
      : '',
  ]
    .filter(Boolean)
    .join('\n\n');
};

const extractMarkedPhrases = (value: string): string[] => {
  const matches = value.matchAll(/"([^"\n]+)"|'([^'\n]+)'|\*\*([^*\n]+)\*\*|\*([^*\n]+)\*/g);
  return Array.from(matches)
    .map((match) => match[1] ?? match[2] ?? match[3] ?? match[4] ?? '')
    .map((item) => normalizeTranslationText(item))
    .filter(Boolean);
};

const containsUnexpectedSemaiInPedagogy = (
  pedagogy: {
    coach_note: string | null;
    follow_up_prompt: string | null;
  },
  allowedSemaiPhrases: string[],
): boolean => {
  const allowed = new Set(
    allowedSemaiPhrases.map((value) => normalizeTranslationText(value)).filter(Boolean),
  );

  const fields = [pedagogy.coach_note ?? '', pedagogy.follow_up_prompt ?? ''];
  for (const field of fields) {
    for (const phrase of extractMarkedPhrases(field)) {
      if (allowed.has(phrase) || isExactVerifiedSemaiInput(phrase)) {
        continue;
      }
      return true;
    }
  }

  return false;
};

const isUnsafePedagogyFollowUp = (value: string | null): boolean =>
  Boolean(
    value &&
    /\b(use|using|write|make|create|try|reply|rewrite|construct)\b/i.test(value) &&
    /\b(sentence|phrase|ayat|frasa|word|perkataan)\b/i.test(value),
  );

const parsePedagogyJson = (
  value: string,
): {
  coach_note: string | null;
  follow_up_prompt: string | null;
  follow_up_translation: string | null;
  pronunciation_tip: string | null;
  related_example: string | null;
} | null => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    const followUpPrompt =
      typeof parsed.follow_up_prompt === 'string' && parsed.follow_up_prompt.trim()
        ? parsed.follow_up_prompt.trim()
        : null;
    return {
      coach_note:
        typeof parsed.coach_note === 'string' && parsed.coach_note.trim()
          ? parsed.coach_note.trim()
          : null,
      follow_up_prompt: isUnsafePedagogyFollowUp(followUpPrompt) ? null : followUpPrompt,
      follow_up_translation:
        typeof parsed.follow_up_translation === 'string' && parsed.follow_up_translation.trim()
          ? parsed.follow_up_translation.trim()
          : null,
      pronunciation_tip:
        typeof parsed.pronunciation_tip === 'string' && parsed.pronunciation_tip.trim()
          ? parsed.pronunciation_tip.trim()
          : null,
      related_example:
        typeof parsed.related_example === 'string' && parsed.related_example.trim()
          ? parsed.related_example.trim()
          : null,
    };
  } catch {
    return null;
  }
};

const buildDirectHelpFallback = (
  answerLanguage: 'en' | 'ms',
  request: CoachRequest,
  reason: string,
  sessionPhase: SessionPhase,
  track: LearningTrack,
  nextActions: ClientAction[],
  orchestration: { provider: string; model: string },
  runtime: RuntimeState,
): CoachPayload => {
  const verifiedContext = findLatestVerifiedContext(request.turns, answerLanguage);
  const mainReply = reason.includes('close the current learning session')
    ? answerLanguage === 'ms'
      ? '**Baik.** Kita tamatkan sesi belajar sekarang. Bila-bila mahu sambung, beritahu saya.'
      : '**Great.** We can end here. Whenever you want to continue, just tell me.'
    : reason.includes('follow_up_explain_current') && verifiedContext?.kind === 'word'
      ? answerLanguage === 'ms'
        ? `Perkataan terakhir bermaksud **"${verifiedContext.translation}"**. Fokus pada maksud dahulu, kemudian sebut perlahan sekali.`
        : `That last word means **"${verifiedContext.translation}"**. Focus on the meaning first, then say it slowly once.`
      : reason.includes('follow_up_translation_help') && verifiedContext
        ? answerLanguage === 'ms'
          ? `Maksud item terakhir ialah **"${verifiedContext.translation}"**. Semak satu bahagian kecil pada satu masa.`
          : `The last verified item means **"${verifiedContext.translation}"**. Check one small part at a time.`
        : reason.includes('follow_up_memory_tip') && verifiedContext
          ? answerLanguage === 'ms'
            ? `**Tip ingatan:** kaitkan maksud "${verifiedContext.translation}" dengan satu gambar sebenar. Semak maksud dahulu, bukan ayat baharu.`
            : `**Memory tip:** connect "${verifiedContext.translation}" to one real image. Check the meaning first, not a new sentence.`
          : reason.includes('follow_up_safe_practice')
            ? answerLanguage === 'ms'
              ? '**Latihan selamat:** tutup terjemahan, cuba ingat maksudnya, kemudian semak semula.'
              : '**Safe practice:** cover the translation, recall the meaning, then check it again.'
            : reason.includes('recovery:')
              ? answerLanguage === 'ms'
                ? '**Maaf, saya terlalu cepat.** Kita boleh perlahan: asas dulu, pelan ringkas, atau latihan mudah.'
                : '**Sorry, I moved too fast.** We can slow down: basics first, a simple plan, or one easy practice.'
              : reason.includes('onboarding_plan')
                ? answerLanguage === 'ms'
                  ? '**Pelan ringkas:** pilih satu fokus kecil, ulang sedikit setiap hari, dan semak makna sebelum berlatih.'
                  : '**Simple plan:** pick one small focus, practice a little daily, and check meaning before speaking.'
                : reason.includes('scope_guard_out_of_scope')
                  ? answerLanguage === 'ms'
                    ? 'Saya tidak boleh bantu tugasan itu di sini. Saya boleh bantu dengan **pembelajaran Semai**, terjemahan berasas, atau latihan ringkas.'
                    : 'I cannot help with that task here. I can help with **Semai learning**, grounded translation, or short practice.'
                  : reason.includes('scope_guard')
                    ? answerLanguage === 'ms'
                      ? 'Saya boleh bantu, tetapi hanya dengan **kandungan Semai yang disahkan**. Pilih item kamus atau frasa yang lebih ringkas.'
                      : 'I can help, but only with **verified Semai content**. Choose a dictionary item or try a shorter phrase.'
                    : reason.includes('onboarding:')
                      ? answerLanguage === 'ms'
                        ? '**Boleh.** Mahu mula dengan sapaan, frasa harian, sebutan, atau kosa kata mudah?'
                        : '**Absolutely.** Want to start with greetings, daily phrases, pronunciation, or simple vocabulary?'
                      : answerLanguage === 'ms'
                        ? '**Hai!** Saya boleh bantu pembelajaran Semai, terjemahan berasas, dan latihan ringkas.'
                        : '**Hi.** I can help with Semai coaching, grounded translation, and short practice.';
  const followUpContext: FollowUpContext = reason.includes('close the current learning session')
    ? 'end_session'
    : reason.includes('scope_guard')
      ? 'scope_guard'
      : reason.includes('recovery:')
        ? 'recovery'
        : reason.includes('follow_up_safe_practice') || reason.includes('follow_up_')
          ? 'safe_practice'
          : reason.includes('onboarding:') || reason.includes('onboarding_plan')
            ? 'onboarding'
            : 'direct_help';

  return {
    mode: 'direct_help',
    response_mode: 'direct_answer',
    answer_language: answerLanguage,
    session_phase: sessionPhase,
    track,
    next_actions: nextActions,
    main_reply: mainReply,
    translation: null,
    coach_note: null,
    follow_up_prompt: buildContextualFollowUpPrompt(
      followUpContext,
      answerLanguage,
      request,
      verifiedContext,
    ),
    follow_up_translation: null,
    pronunciation_tip: null,
    related_example: null,
    grounded: false,
    grounding_source: [],
    validation_passed: true,
    provider: 'fallback',
    model: 'direct-help-fallback',
    meta: buildRuntimeMeta(runtime, {
      reason: 'fallback',
      policy_reason: reason,
      orchestration_provider: orchestration.provider,
      orchestration_model: orchestration.model,
      package_eligible: false,
    }),
  };
};

const buildDirectHelpPayload = async (
  request: CoachRequest,
  intent: CoachIntentResult,
  sessionPhase: SessionPhase,
  track: LearningTrack,
  nextActions: ClientAction[],
  orchestration: { provider: string; model: string },
  runtime: RuntimeState,
  requestStartedAtMs: number,
): Promise<CoachPayload> => {
  const answerLanguage = intent.answerLanguage === 'ms' ? 'ms' : 'en';
  const context = buildConversationContext(request.turns, 4, 110);

  if (intent.reason.includes('follow_up_')) {
    return buildDirectHelpFallback(
      answerLanguage,
      request,
      intent.reason,
      sessionPhase,
      track,
      nextActions,
      orchestration,
      runtime,
    );
  }

  if (intent.reason.includes('Greeting-only prompt')) {
    return buildDirectHelpFallback(
      answerLanguage,
      request,
      intent.reason,
      sessionPhase,
      track,
      nextActions,
      orchestration,
      runtime,
    );
  }

  if (intent.reason.includes('scope_guard_out_of_scope')) {
    return buildDirectHelpFallback(
      answerLanguage,
      request,
      intent.reason,
      sessionPhase,
      track,
      nextActions,
      orchestration,
      runtime,
    );
  }

  if (remainingBudgetMs(requestStartedAtMs) <= CPU_GUARD_DIRECT_MIN_MS) {
    setDegraded(runtime, 'cpu_guard_direct_skip', { cpuGuard: true });
    return buildDirectHelpFallback(
      answerLanguage,
      request,
      intent.reason,
      sessionPhase,
      track,
      nextActions,
      orchestration,
      runtime,
    );
  }

  const directStartedAtMs = Date.now();
  const directFollowUpContext: FollowUpContext = intent.reason.includes(
    'close the current learning session',
  )
    ? 'end_session'
    : intent.reason.includes('scope_guard')
      ? 'scope_guard'
      : intent.reason.includes('recovery:')
        ? 'recovery'
        : intent.reason.includes('onboarding:') || intent.reason.includes('onboarding_plan')
          ? 'onboarding'
          : 'direct_help';
  const followUpPrompt = buildContextualFollowUpPrompt(
    directFollowUpContext,
    answerLanguage,
    request,
    findLatestVerifiedContext(request.turns, answerLanguage),
  );

  const prompt = [
    `Answer in ${answerLanguage === 'ms' ? 'Malay' : 'English'}.`,
    'Use a warm, concise coaching tone.',
    'Keep it to 1 short paragraph, or 2 very short paragraphs only when needed.',
    'Use lightweight Markdown when helpful: **bold** for the key idea and *italic* for gentle emphasis.',
    'You may use a short bullet list only for options or a plan. Use at most 3 bullets.',
    'Do not use emoji or Markdown headings.',
    'Do not use em dashes or en dashes. Use commas, periods, or parentheses instead.',
    'Do not auto-translate user input unless explicit translation intent exists.',
    'Do not write, quote, validate, or invent any Semai words or Semai sentences in this reply.',
    'For broad learning requests, act like a buddy: orient the user, explain useful options, and ask what they want to try before teaching a word.',
    'For advice or plan requests, give practical study guidance without Semai words.',
    'For frustration or correction, apologize briefly, slow down, and offer a calmer next step.',
    'If Routing reason starts with scope_guard, explain that Tavi cannot invent Semai sentences or list examples unless they are verified; offer a verified dictionary item or translation instead.',
    'If the user wants Semai content, ask them to choose a practice action or request a grounded practice item explicitly.',
    'For out-of-scope prompts, do not answer the external task at all. State the boundary briefly and redirect to Semai coaching.',
    answerLanguage === 'ms' ? 'Use Malay Malaysia register. Avoid Indonesian wording.' : '',
    `Routing reason: ${intent.reason}`,
    context ? `Recent context:\n${context}` : '',
    `User message: ${request.message}`,
  ]
    .filter(Boolean)
    .join('\n\n');

  try {
    const generated = await callCoachLlm(
      prompt,
      'You are Tavi, a helpful Semai coach inside a language-learning app.',
      undefined,
      sessionPhase === 'learning_active'
        ? Math.min(150, COACH_DIRECT_MAX_OUTPUT_TOKENS)
        : Math.min(135, COACH_DIRECT_MAX_OUTPUT_TOKENS),
    );
    markStageTiming(runtime, 'direct_help', Date.now() - directStartedAtMs);

    if (generated?.text) {
      const normalizedReply = withLanguageNormalization(answerLanguage, generated.text);
      const policyReason = isSemaiVerificationQuestion(request.message)
        ? `${intent.reason} User asked to verify Semai; use safe fallback unless grounded.`
        : intent.reason;
      return {
        mode: 'direct_help',
        response_mode: 'direct_answer',
        answer_language: answerLanguage,
        session_phase: sessionPhase,
        track,
        next_actions: nextActions,
        main_reply: normalizedReply,
        translation: null,
        coach_note: null,
        follow_up_prompt: followUpPrompt,
        follow_up_translation: null,
        pronunciation_tip: null,
        related_example: null,
        grounded: false,
        grounding_source: [],
        validation_passed: true,
        provider: generated.provider,
        model: generated.model,
        meta: buildRuntimeMeta(runtime, {
          latency_ms: generated.latencyMs,
          usage: generated.usage,
          attempted_providers: generated.attemptedProviders,
          reason: policyReason,
          orchestration_provider: orchestration.provider,
          orchestration_model: orchestration.model,
          package_eligible: false,
        }),
      };
    }
  } catch (error) {
    markStageTiming(runtime, 'direct_help', Date.now() - directStartedAtMs);
    setDegraded(runtime, /timed out/i.test(String(error)) ? 'timeout' : 'provider_error');
  }

  return buildDirectHelpFallback(
    answerLanguage,
    request,
    intent.reason,
    sessionPhase,
    track,
    nextActions,
    orchestration,
    runtime,
  );
};

const buildClarificationPayload = async (
  request: CoachRequest,
  answerLanguage: 'en' | 'ms',
  sessionPhase: SessionPhase,
  track: LearningTrack,
  nextActions: ClientAction[],
  orchestration: { provider: string; model: string },
  runtime: RuntimeState,
  requestStartedAtMs: number,
): Promise<CoachPayload> => {
  if (remainingBudgetMs(requestStartedAtMs) <= CPU_GUARD_CLARIFICATION_MIN_MS) {
    setDegraded(runtime, 'cpu_guard_clarification_skip', { cpuGuard: true });
    return {
      mode: 'clarification',
      response_mode: 'clarification',
      answer_language: answerLanguage,
      session_phase: sessionPhase,
      track,
      next_actions: nextActions,
      main_reply:
        answerLanguage === 'ms'
          ? 'Boleh jelaskan sedikit lagi fokus anda: dialog harian, kosa kata, atau sebutan?'
          : 'Could you clarify your focus: daily conversation, vocabulary, or pronunciation?',
      translation: null,
      coach_note: null,
      follow_up_prompt: buildContextualFollowUpPrompt('onboarding', answerLanguage, request, null),
      follow_up_translation: null,
      pronunciation_tip: null,
      related_example: normalizeTranslationText(request.message),
      grounded: false,
      grounding_source: [],
      validation_passed: true,
      provider: 'rules',
      model: 'clarification-cpu-guard',
      meta: buildRuntimeMeta(runtime, {
        reason: 'ambiguous_prompt',
        orchestration_provider: orchestration.provider,
        orchestration_model: orchestration.model,
        package_eligible: false,
      }),
    };
  }

  const clarificationStartedAtMs = Date.now();
  const prompt = [
    `Answer in ${answerLanguage === 'ms' ? 'Malay' : 'English'}.`,
    'Ask one short, friendly clarifying question.',
    'Do not repeat the same canned wording.',
    answerLanguage === 'ms' ? 'Use Malay Malaysia register. Avoid Indonesian wording.' : '',
    `User message: ${request.message}`,
  ]
    .filter(Boolean)
    .join('\n\n');

  try {
    const generated = await callCoachLlm(
      prompt,
      'You are Tavi, a conversational Semai coach. Return one concise question only.',
      undefined,
      72,
    );
    markStageTiming(runtime, 'clarification', Date.now() - clarificationStartedAtMs);

    if (generated?.text) {
      return {
        mode: 'clarification',
        response_mode: 'clarification',
        answer_language: answerLanguage,
        session_phase: sessionPhase,
        track,
        next_actions: nextActions,
        main_reply: withLanguageNormalization(answerLanguage, generated.text),
        translation: null,
        coach_note: null,
        follow_up_prompt: buildContextualFollowUpPrompt(
          'onboarding',
          answerLanguage,
          request,
          null,
        ),
        follow_up_translation: null,
        pronunciation_tip: null,
        related_example: normalizeTranslationText(request.message),
        grounded: false,
        grounding_source: [],
        validation_passed: true,
        provider: generated.provider,
        model: generated.model,
        meta: buildRuntimeMeta(runtime, {
          reason: 'ambiguous_prompt',
          latency_ms: generated.latencyMs,
          usage: generated.usage,
          attempted_providers: generated.attemptedProviders,
          orchestration_provider: orchestration.provider,
          orchestration_model: orchestration.model,
          package_eligible: false,
        }),
      };
    }
  } catch (error) {
    markStageTiming(runtime, 'clarification', Date.now() - clarificationStartedAtMs);
    setDegraded(runtime, /timed out/i.test(String(error)) ? 'timeout' : 'provider_error');
  }

  return {
    mode: 'clarification',
    response_mode: 'clarification',
    answer_language: answerLanguage,
    session_phase: sessionPhase,
    track,
    next_actions: nextActions,
    main_reply:
      answerLanguage === 'ms'
        ? 'Baik, bahagian mana anda mahu mula: dialog harian, kosa kata, atau sebutan?'
        : 'Sure, where do you want to begin: daily conversation, vocabulary, or pronunciation?',
    translation: null,
    coach_note: null,
    follow_up_prompt: buildContextualFollowUpPrompt('onboarding', answerLanguage, request, null),
    follow_up_translation: null,
    pronunciation_tip: null,
    related_example: normalizeTranslationText(request.message),
    grounded: false,
    grounding_source: [],
    validation_passed: true,
    provider: 'rules',
    model: 'clarification-fallback',
    meta: buildRuntimeMeta(runtime, {
      reason: 'ambiguous_prompt',
      orchestration_provider: orchestration.provider,
      orchestration_model: orchestration.model,
      package_eligible: false,
    }),
  };
};

const buildGroundingUnavailablePayload = (
  request: CoachRequest,
  intent: CoachIntentResult,
  sessionPhase: SessionPhase,
  track: LearningTrack,
  nextActions: ClientAction[],
  translationResult: GroundedTranslationResult,
  orchestration: { provider: string; model: string },
  runtime: RuntimeState,
): CoachPayload => {
  const answerLanguage = intent.answerLanguage === 'ms' ? 'ms' : 'en';
  const baseReply =
    answerLanguage === 'ms'
      ? 'Saya belum jumpa padanan Semai yang disahkan dalam kamus untuk permintaan ini. Cuba frasa yang lebih ringkas atau konteks yang lebih jelas.'
      : 'I could not find a verified Semai match in the dictionary for this request. Try a shorter phrase or clearer context.';

  return {
    mode: 'direct_help',
    response_mode: 'direct_answer',
    answer_language: answerLanguage,
    session_phase: sessionPhase,
    track,
    next_actions: nextActions,
    main_reply: baseReply,
    translation: null,
    coach_note: null,
    follow_up_prompt: buildContextualFollowUpPrompt(
      'grounding_unavailable',
      answerLanguage,
      request,
      null,
    ),
    follow_up_translation: null,
    pronunciation_tip: null,
    related_example: null,
    warning:
      translationResult.warning ??
      (answerLanguage === 'ms'
        ? 'Tiada ayat Semai disahkan, jadi blok Semai tidak dipaparkan.'
        : 'No verified Semai output was found, so the Semai block was not shown.'),
    grounded: false,
    grounding_source: translationResult.groundingSource,
    validation_passed: false,
    provider: translationResult.provider,
    model: translationResult.model,
    meta: buildRuntimeMeta(runtime, {
      reason: intent.reason,
      degrade_reason: runtime.degradeReason ?? 'grounding_unavailable',
      orchestration_provider: orchestration.provider,
      orchestration_model: orchestration.model,
      package_eligible: false,
      semai_verified: false,
      semai_source: 'none',
      grounding_meta: translationResult.meta,
      source_text: request.message,
    }),
  };
};

const buildLearningPayload = async (
  request: CoachRequest,
  intent: CoachIntentResult,
  sessionPhase: SessionPhase,
  track: LearningTrack,
  nextActions: ClientAction[],
  orchestration: { provider: string; model: string },
  runtime: RuntimeState,
  requestStartedAtMs: number,
  requestBaseUrl: string,
  forwardAuthorization?: string,
  forwardApiKey?: string,
): Promise<CoachPayload> => {
  const translationTask = buildTranslationTask(intent, request.message, request.turns);

  // word_help: direct glossary/sentence lookup for the exact word the user typed,
  // bypassing the random candidate picker which returns unrelated words.
  let translationResult: GroundedTranslationResult | null = null;

  if (intent.turnType === 'word_help' && translationTask) {
    const directGlossary = findExactGlossaryTranslation(
      translationTask.text,
      translationTask.from,
      translationTask.to,
    );
    const directSentence =
      directGlossary === null
        ? findExactSentenceExampleTranslation(
            translationTask.text,
            translationTask.from,
            translationTask.to,
          )
        : null;
    const directTranslation = directGlossary ?? directSentence;

    if (directTranslation) {
      translationResult = {
        translatedText: directTranslation,
        sourceText: translationTask.text,
        provider: directGlossary ? 'glossary' : 'sentence-memory',
        model: 'exact-lookup',
        grounded: true,
        groundingSource: [directGlossary ? 'glossary' : 'sentence_memory'],
        validationPassed: true,
        semaiVerified: true,
        semaiSource: directGlossary ? 'glossary' : 'sentence_memory',
        meta: { lookup: 'exact', source_text: translationTask.text },
      };
    } else {
      // Polysemous word check: findExactGlossaryTranslation returns null when
      // multiple different translations exist (e.g. "wig" = banyan tree / shout).
      // Use findAllGlossaryTranslations to present all meanings.
      const allTranslations = findAllGlossaryTranslations(
        translationTask.text,
        translationTask.from,
        translationTask.to,
      );
      if (allTranslations.length > 0) {
        const combined = allTranslations.join('; ');
        translationResult = {
          translatedText: combined,
          sourceText: translationTask.text,
          provider: 'glossary',
          model: 'exact-lookup-multi',
          grounded: true,
          groundingSource: ['glossary'],
          validationPassed: true,
          semaiVerified: true,
          semaiSource: 'glossary',
          meta: {
            lookup: 'exact-multi',
            source_text: translationTask.text,
            meanings_count: allTranslations.length,
          },
        };
      } else {
        // No glossary match at all — fall through to AI translation service
        translationResult = await translateGroundedText({
          ...translationTask,
          requestBaseUrl,
          forwardAuthorization,
          forwardApiKey,
          runtime,
        });
      }
    }
  } else if (intent.turnType === 'how_to_say') {
    translationResult = translationTask
      ? await translateGroundedText({
          ...translationTask,
          requestBaseUrl,
          forwardAuthorization,
          forwardApiKey,
          runtime,
        })
      : null;
  } else {
    translationResult = buildVerifiedLearningTranslationResult(request, intent, track);
  }

  if (!translationResult) {
    return buildGroundingUnavailablePayload(
      request,
      intent,
      sessionPhase,
      track,
      nextActions,
      {
        translatedText: '',
        sourceText: '',
        provider: 'none',
        model: 'none',
        grounded: false,
        groundingSource: [],
        validationPassed: false,
        semaiVerified: false,
        semaiSource: 'none',
        meta: {},
      },
      orchestration,
      runtime,
    );
  }

  const semaiSurface =
    translationTask?.from === 'semai' || intent.sourceLanguage === 'semai'
      ? 'source'
      : intent.targetLanguage === 'semai'
        ? 'target'
        : 'none';
  const requiresGroundedSemai = semaiSurface !== 'none';
  if (requiresGroundedSemai && !translationResult.semaiVerified) {
    return buildGroundingUnavailablePayload(
      request,
      intent,
      sessionPhase,
      track,
      nextActions,
      translationResult,
      orchestration,
      runtime,
    );
  }

  const packageEligible =
    sessionPhase === 'learning_active' ||
    request.clientAction === 'translate_inline' ||
    intent.turnType === 'how_to_say' ||
    intent.turnType === 'sentence_help' ||
    intent.turnType === 'word_help';
  if (!packageEligible) {
    return buildDirectHelpPayload(
      request,
      {
        ...intent,
        mode: 'direct_help',
        turnType: 'direct_answer',
        responseMode: 'direct_answer',
        needsClarification: false,
        confidence: 'high',
        reason: 'Language package blocked outside learning/translate mode.',
      },
      sessionPhase,
      track,
      nextActions,
      orchestration,
      runtime,
      requestStartedAtMs,
    );
  }

  const fallbackPedagogy = buildPedagogyFallback(intent, request);
  let pedagogy = fallbackPedagogy;
  let coachProvider = 'rules-fallback';
  let coachModel = 'pedagogy-fallback';
  let coachAttemptedProviders: string[] = [];

  const isInlineTranslationTurn =
    request.clientAction === 'translate_inline' || intent.turnType === 'how_to_say';
  if (isInlineTranslationTurn) {
    coachProvider = 'rules';
    coachModel = 'translation-fastpath';
  } else if (remainingBudgetMs(requestStartedAtMs) > CPU_GUARD_PEDAGOGY_MIN_MS) {
    const pedagogyStartedAtMs = Date.now();
    try {
      const generated = await callCoachLlm(
        buildPedagogyPrompt(intent, request.message, translationResult, request.turns),
        'You are Tavi, a patient Semai learning coach. Return compact JSON only.',
        'application/json',
        COACH_PEDAGOGY_MAX_OUTPUT_TOKENS,
        (text) => Boolean(parsePedagogyJson(text)),
      );
      markStageTiming(runtime, 'pedagogy', Date.now() - pedagogyStartedAtMs);

      const parsed = parsePedagogyJson(generated?.text ?? '');
      if (parsed && generated) {
        const nextPedagogy = {
          coach_note: fallbackPedagogy.coach_note,
          follow_up_prompt: fallbackPedagogy.follow_up_prompt,
          follow_up_translation: parsed.follow_up_translation,
          pronunciation_tip: parsed.pronunciation_tip,
          related_example: parsed.related_example,
        };
        if (
          !containsUnexpectedSemaiInPedagogy(nextPedagogy, [
            translationResult.translatedText,
            translationResult.sourceText,
          ])
        ) {
          coachProvider = generated.provider;
          coachModel = generated.model;
          coachAttemptedProviders = generated.attemptedProviders;
          pedagogy = nextPedagogy;
        } else {
          setDegraded(runtime, 'pedagogy_unverified_semai');
        }
      }
    } catch (error) {
      markStageTiming(runtime, 'pedagogy', Date.now() - pedagogyStartedAtMs);
      setDegraded(runtime, /timed out/i.test(String(error)) ? 'timeout' : 'provider_error');
    }
  } else {
    setDegraded(runtime, 'cpu_guard_pedagogy_skip', { cpuGuard: true });
  }

  const answerLanguage = semaiSurface === 'none' ? intent.answerLanguage : 'semai';
  const mainReply =
    semaiSurface === 'source' ? translationResult.sourceText : translationResult.translatedText;
  const translationText =
    semaiSurface === 'source'
      ? translationResult.translatedText
      : translationResult.sourceText || intent.extractedText || request.message;
  return {
    mode: intent.mode,
    response_mode: intent.responseMode,
    answer_language: answerLanguage,
    session_phase: sessionPhase,
    track,
    next_actions: nextActions,
    main_reply: mainReply,
    translation: translationText,
    coach_note: pedagogy.coach_note,
    follow_up_prompt: pedagogy.follow_up_prompt,
    follow_up_translation: pedagogy.follow_up_translation,
    pronunciation_tip: pedagogy.pronunciation_tip,
    related_example: pedagogy.related_example,
    warning: translationResult.warning,
    grounded: translationResult.grounded,
    grounding_source: translationResult.groundingSource,
    validation_passed: translationResult.validationPassed,
    provider: translationResult.provider,
    model: translationResult.model,
    meta: buildRuntimeMeta(runtime, {
      ...translationResult.meta,
      reason: intent.reason,
      turn_type: intent.turnType,
      coach_provider: coachProvider,
      coach_model: coachModel,
      coach_attempted_providers: coachAttemptedProviders,
      orchestration_provider: orchestration.provider,
      orchestration_model: orchestration.model,
      semai_verified: translationResult.semaiVerified,
      semai_source: translationResult.semaiSource,
      package_eligible: translationResult.semaiVerified,
      semai_surface: semaiSurface,
    }),
  };
};

Deno.serve(async (request) => {
  const requestStartedAtMs = Date.now();
  const runtime: RuntimeState = {
    stageTimings: {},
    degraded: false,
    degradeReason: null,
    cpuGuardTriggered: false,
  };
  const requestBaseUrl = (Deno.env.get('SUPABASE_URL') ?? new URL(request.url).origin).replace(
    /\/$/,
    '',
  );
  const requestAuthorization = request.headers.get('Authorization') ?? undefined;
  const requestApiKey = request.headers.get('apikey') ?? SUPABASE_ANON_KEY ?? undefined;

  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed.' });
  }

  let payload: CoachRequest;
  const parseStartedAtMs = Date.now();
  try {
    payload = await parseRequest(request);
    markStageTiming(runtime, 'parse', Date.now() - parseStartedAtMs);
  } catch (parseError) {
    markStageTiming(runtime, 'parse', Date.now() - parseStartedAtMs);
    return jsonResponse(400, {
      error: parseError instanceof Error ? parseError.message : 'Invalid request.',
    });
  }

  const routeStartedAtMs = Date.now();
  const currentPhase = inferSessionState(payload.turns);
  const track = inferTrack(payload.turns, payload.track);
  const orchestration = await resolveIntentWithPlanner(
    payload,
    currentPhase,
    track,
    runtime,
    requestStartedAtMs,
  );
  markStageTiming(runtime, 'route', Date.now() - routeStartedAtMs);

  const intent = applySessionPolicy(payload, orchestration.intent, orchestration.sessionPhase);
  const responsePhase =
    intent.mode === 'direct_help' && intent.reason.includes('close the current learning session')
      ? 'idle'
      : orchestration.sessionPhase;

  try {
    let payloadResponse: CoachPayload;
    if (intent.mode === 'clarification' || intent.needsClarification) {
      payloadResponse = await buildClarificationPayload(
        payload,
        intent.answerLanguage === 'ms' ? 'ms' : 'en',
        responsePhase,
        orchestration.track,
        orchestration.nextActions,
        {
          provider: orchestration.provider,
          model: orchestration.model,
        },
        runtime,
        requestStartedAtMs,
      );
    } else if (intent.mode === 'learning') {
      payloadResponse = await buildLearningPayload(
        payload,
        intent,
        responsePhase,
        orchestration.track,
        orchestration.nextActions,
        {
          provider: orchestration.provider,
          model: orchestration.model,
        },
        runtime,
        requestStartedAtMs,
        requestBaseUrl,
        requestAuthorization,
        requestApiKey,
      );
    } else {
      payloadResponse = await buildDirectHelpPayload(
        payload,
        intent,
        responsePhase,
        orchestration.track,
        orchestration.nextActions,
        {
          provider: orchestration.provider,
          model: orchestration.model,
        },
        runtime,
        requestStartedAtMs,
      );
    }

    markStageTiming(runtime, 'total', Date.now() - requestStartedAtMs);
    payloadResponse.meta = {
      ...payloadResponse.meta,
      stage_timings_ms: runtime.stageTimings,
      degraded: runtime.degraded,
      degrade_reason: runtime.degradeReason,
      cpu_guard_triggered: runtime.cpuGuardTriggered,
    };
    if (typeof payloadResponse.meta.semai_verified !== 'boolean') {
      payloadResponse.meta.semai_verified = false;
    }
    if (
      payloadResponse.meta.semai_source !== 'glossary' &&
      payloadResponse.meta.semai_source !== 'sentence_memory' &&
      payloadResponse.meta.semai_source !== 'dictionary_fallback'
    ) {
      payloadResponse.meta.semai_source = 'none';
    }
    if (typeof payloadResponse.meta.package_eligible !== 'boolean') {
      payloadResponse.meta.package_eligible = false;
    }
    if (payloadResponse.meta.semai_verified !== true) {
      payloadResponse.meta.package_eligible = false;
      if (payloadResponse.answer_language === 'semai') {
        payloadResponse.answer_language = intent.answerLanguage === 'ms' ? 'ms' : 'en';
      }
    }
    return jsonResponse(200, sanitizeCoachPayloadOutput(payloadResponse));
  } catch (error) {
    markStageTiming(runtime, 'total', Date.now() - requestStartedAtMs);
    const message = error instanceof Error ? error.message : 'Unexpected coach error.';
    const classified = /timed out/i.test(message)
      ? 'timeout'
      : /grounded|translation/i.test(message)
        ? 'grounding_unavailable'
        : 'provider_error';
    setDegraded(runtime, classified, { cpuGuard: classified === 'timeout' });
    console.error('ai-coach request failed:', error);
    return jsonResponse(500, {
      error: message,
      meta: {
        degraded: true,
        degrade_reason: runtime.degradeReason,
        cpu_guard_triggered: runtime.cpuGuardTriggered,
        stage_timings_ms: runtime.stageTimings,
      },
    });
  }
});
