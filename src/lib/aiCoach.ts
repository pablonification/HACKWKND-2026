import { supabase, supabasePublicAnonKey } from './supabase';
import { type TranslateInput, translateText } from './translate';
import { isLikelyMalay } from './languageDetection';

export type CoachMode = 'learning' | 'direct_help' | 'clarification' | 'unsupported';
export type CoachResponseMode =
  | 'scenario'
  | 'translation'
  | 'conversation'
  | 'word_help'
  | 'sentence_help'
  | 'direct_answer'
  | 'clarification';
export type CoachAnswerLanguage = 'semai' | 'en' | 'ms';
export type CoachSessionPhase = 'idle' | 'onboarding' | 'learning_active';
export type LearningTrack = 'vocabulary_first' | 'daily_conversation' | 'pronunciation';
export type CoachClientAction =
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

export type CoachTurnInput = {
  role: 'user' | 'assistant';
  text: string;
  mode?: CoachMode;
  sessionPhase?: CoachSessionPhase;
  track?: LearningTrack;
};

export type CoachRequest = {
  message: string;
  turns?: CoachTurnInput[];
  clientAction?: CoachClientAction;
  track?: LearningTrack;
};

export type CoachResponse = {
  mode: CoachMode;
  responseMode: CoachResponseMode;
  answerLanguage: CoachAnswerLanguage;
  sessionPhase: CoachSessionPhase;
  track: LearningTrack;
  nextActions: CoachClientAction[];
  mainReply: string;
  translation: string | null;
  coachNote: string | null;
  followUpPrompt: string | null;
  followUpTranslation: string | null;
  pronunciationTip: string | null;
  relatedExample: string | null;
  warning?: string;
  grounded: boolean;
  groundingSource: string[];
  validationPassed: boolean;
  provider: string;
  model?: string;
  meta?: Record<string, unknown>;
};

type RawCoachResponse = {
  mode?: unknown;
  response_mode?: unknown;
  answer_language?: unknown;
  session_phase?: unknown;
  track?: unknown;
  next_actions?: unknown;
  main_reply?: unknown;
  translation?: unknown;
  coach_note?: unknown;
  follow_up_prompt?: unknown;
  follow_up_translation?: unknown;
  pronunciation_tip?: unknown;
  related_example?: unknown;
  warning?: unknown;
  grounded?: unknown;
  grounding_source?: unknown;
  validation_passed?: unknown;
  provider?: unknown;
  model?: unknown;
  meta?: unknown;
};

const GENERIC_EDGE_HTTP_ERROR = 'Edge Function returned a non-2xx status code';
const COACH_FUNCTION_TIMEOUT_MS = 30_000;
const TRANSIENT_RETRY_MAX = 1;
const TRANSIENT_RETRY_BASE_DELAY_MS = 140;
const TRANSIENT_RETRY_JITTER_MS = 160;

const normalizeText = (value: string): string => value.trim().replace(/\s+/g, ' ');

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  return 'Coach request failed. Please try again.';
};

const syncFunctionsAuthFromSession = async (): Promise<void> => {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const token = session?.access_token?.trim();
  if (!token) return;

  const expiresAt = session?.expires_at;
  const isExpired =
    typeof expiresAt === 'number' && Number.isFinite(expiresAt) && expiresAt * 1000 <= Date.now();

  if (isExpired) {
    // Token is already expired — attempt proactive refresh before setting auth
    const { data: refreshData } = await supabase.auth.refreshSession();
    const refreshedToken = refreshData.session?.access_token?.trim();
    if (refreshedToken) {
      supabase.functions.setAuth(refreshedToken);
    }
    // If refresh fails, skip setting auth — the 401 retry path will handle it
    return;
  }

  supabase.functions.setAuth(token);
};

const refreshAndSyncFunctionsAuth = async (): Promise<boolean> => {
  const { data, error } = await supabase.auth.refreshSession();
  if (error) {
    return false;
  }

  const token = data.session?.access_token?.trim();
  if (token) {
    supabase.functions.setAuth(token);
  }

  return Boolean(token);
};

const extractEdgeResponseMessage = async (response?: Response): Promise<string | null> => {
  if (!response) {
    return null;
  }

  const readable = typeof response.clone === 'function' ? response.clone() : response;
  const contentType = readable.headers.get('Content-Type') ?? '';

  try {
    if (contentType.includes('application/json')) {
      const payload = (await readable.json()) as Record<string, unknown>;
      const message =
        (typeof payload.error === 'string' && payload.error.trim()) ||
        (typeof payload.message === 'string' && payload.message.trim()) ||
        (typeof payload.msg === 'string' && payload.msg.trim()) ||
        '';

      if (message) {
        return message;
      }
    }

    const text = (await readable.text()).trim();
    return text || null;
  } catch {
    return null;
  }
};

const toFunctionErrorMessage = async (error: unknown, response?: Response): Promise<string> => {
  const responseMessage = await extractEdgeResponseMessage(response);

  if (response?.status === 401) {
    return responseMessage?.includes('Invalid JWT')
      ? 'Coach requires an active session. Sign in again and retry.'
      : responseMessage || 'Coach request was unauthorized.';
  }

  if (responseMessage) {
    return responseMessage;
  }

  if (error instanceof Error && error.message && error.message !== GENERIC_EDGE_HTTP_ERROR) {
    return error.message;
  }

  return toErrorMessage(error);
};

const sleep = async (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> =>
  Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`${label} timed out after ${timeoutMs}ms.`));
      }, timeoutMs);
    }),
  ]);

const shouldRetryTransientFailure = (statusCode: number, message: string): boolean => {
  if (statusCode >= 500) {
    return true;
  }

  return /worker_limit|cpu time exceeded|timed out|temporarily unavailable|network|fetch|cors/i.test(
    message,
  );
};

const invokeCoachFunction = async (body: CoachRequest) =>
  withTimeout(
    supabase.functions.invoke<RawCoachResponse>('ai-coach', {
      headers: {
        apikey: supabasePublicAnonKey,
      },
      body: {
        message: body.message,
        turns: (body.turns ?? []).map((turn) => ({
          role: turn.role,
          text: turn.text,
          mode: turn.mode,
          session_phase: turn.sessionPhase,
          track: turn.track,
        })),
        ...(body.clientAction ? { client_action: body.clientAction } : {}),
        ...(body.track ? { track: body.track } : {}),
      },
    }),
    COACH_FUNCTION_TIMEOUT_MS,
    'Tavi request',
  );

const normalizeNullableString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

const detectAnswerLanguage = (message: string): CoachAnswerLanguage => {
  return isLikelyMalay(message) ? 'ms' : 'en';
};

const inferFallbackPhase = (turns: CoachTurnInput[] = []): CoachSessionPhase => {
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
  }

  return 'idle';
};

const inferFallbackTrack = (
  turns: CoachTurnInput[] = [],
  requestTrack?: LearningTrack,
): LearningTrack => {
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

const defaultFallbackNextActions = (phase: CoachSessionPhase): CoachClientAction[] => {
  if (phase === 'learning_active') {
    return ['continue_session', 'translate_inline', 'end_session'];
  }

  return ['start_easy', 'practice_greetings', 'make_plan', 'translate_inline'];
};

const defaultClientNextActions = (phase: CoachSessionPhase): CoachClientAction[] =>
  defaultFallbackNextActions(phase);

const pickClientFollowUpPrompt = (
  phase: CoachSessionPhase,
  responseMode: CoachResponseMode,
  answerLanguage: CoachAnswerLanguage,
): string => {
  const useMalay = answerLanguage === 'ms';
  if (responseMode === 'scenario' || responseMode === 'word_help') {
    return useMalay ? 'Beri saya tip ingatan.' : 'Give me a memory tip.';
  }
  if (responseMode === 'sentence_help' || responseMode === 'translation') {
    return useMalay ? 'Terangkan ini dengan ringkas.' : 'Break this down simply.';
  }
  if (phase === 'learning_active') {
    return useMalay ? 'Beri saya latihan yang selamat.' : 'Give me a safe practice task.';
  }
  return useMalay ? 'Buatkan saya pelan belajar yang ringkas.' : 'Make me a simple learning plan.';
};

type FallbackCoachIntent = {
  mode: CoachMode;
  responseMode: CoachResponseMode;
  answerLanguage: CoachAnswerLanguage;
  sessionPhase: CoachSessionPhase;
  track: LearningTrack;
  nextActions: CoachClientAction[];
  text: string;
  verifiedFallbackWord?: boolean;
  translate?: TranslateInput;
};

const mapFallbackSemaiSource = (
  provider?: string,
): 'glossary' | 'sentence_memory' | 'dictionary_fallback' | 'none' => {
  if (provider === 'glossary') return 'glossary';
  if (provider === 'sentence-memory') return 'sentence_memory';
  if (
    provider === 'glossary-fallback' ||
    provider === 'safety-fallback' ||
    provider === 'fallback'
  ) {
    return 'dictionary_fallback';
  }
  return 'none';
};

const buildVerifiedClientFallbackWord = (
  intent: FallbackCoachIntent,
  warning: string,
): CoachResponse => ({
  mode: 'learning',
  responseMode: 'scenario',
  answerLanguage: 'semai',
  sessionPhase: 'learning_active',
  track: intent.track,
  nextActions: defaultFallbackNextActions('learning_active'),
  mainReply: 'abat',
  translation: 'cloth',
  coachNote:
    'This is a verified Webonary word. Say it once, then connect it to one object you know.',
  followUpPrompt: pickClientFollowUpPrompt('learning_active', 'scenario', intent.answerLanguage),
  followUpTranslation: null,
  pronunciationTip: null,
  relatedExample: null,
  warning,
  grounded: true,
  groundingSource: ['glossary', 'client-fallback'],
  validationPassed: true,
  provider: 'client-fallback',
  model: 'abat-cloth',
  meta: {
    reason: 'edge_unavailable_verified_word_fallback',
    semai_verified: true,
    semai_source: 'glossary',
    package_eligible: true,
    selected_id: 'abat-cloth',
    selected_source: 'glossary',
  },
});

const extractPromptFocus = (message: string, patterns: RegExp[]): string => {
  let next = message.trim();

  for (const pattern of patterns) {
    next = next.replace(pattern, '').trim();
  }

  return next
    .replace(/\b(mean|maksud)\b$/i, '')
    .replace(/\b(in|to|ke|dalam)\s+(semai|english|malay|en|ms|bahasa melayu)\b/gi, '')
    .replace(/^[\s:,-]+|[\s?.!]+$/g, '')
    .trim();
};

const buildFallbackSentenceSeed = (
  message: string,
  answerLanguage: CoachAnswerLanguage,
): string => {
  const lower = message.toLowerCase();
  const useMalay = answerLanguage === 'ms';

  if (lower.includes('morning') || lower.includes('hello') || lower.includes('greet')) {
    return useMalay ? 'Selamat pagi, saya sihat hari ini.' : 'Good morning, I feel well today.';
  }

  if (lower.includes('family') || lower.includes('keluarga')) {
    return useMalay ? 'Keluarga saya tinggal di kampung.' : 'My family lives in the village.';
  }

  if (lower.includes('food') || lower.includes('eat') || lower.includes('makan')) {
    return useMalay ? 'Saya mahu makan bersama keluarga saya.' : 'I want to eat with my family.';
  }

  return useMalay ? 'Saya sedang belajar bahasa Semai hari ini.' : 'I am learning Semai today.';
};

const FALLBACK_LEARNING_END_PATTERNS = [
  /\b(stop|end|finish|quit|done|exit)\b/i,
  /\b(that'?s all|enough for today|thanks(?: you)? so much)\b/i,
  /\b(berhenti|tamat|cukup|terima kasih)\b/i,
];

const FALLBACK_START_CONFIRM_PATTERNS = [
  /\b(let'?s go|start now|i'?m ready|ready now|begin now)\b/i,
  /\b(jom|mula sekarang|saya sedia)\b/i,
];

const FALLBACK_FRUSTRATION_PATTERNS = [
  /\b(bruh|huh|confus(?:ed|ing)|don'?t understand|i do not understand)\b/i,
  /\b(don'?t start|do not start|too fast|slow down|explain first|not immediately)\b/i,
  /\b(tak faham|keliru|jangan mula|perlahan|terangkan dulu)\b/i,
];

const FALLBACK_ADVICE_PATTERNS = [
  /\b(advice|tips?|plan|roadmap|how to get better|how can i improve|where should i start)\b/i,
  /\b(nasihat|petua|rancangan|cara.*baik|mula dari mana)\b/i,
];

const FALLBACK_VERIFIED_VOCAB_PATTERNS = [
  /\b(interesting|random|simple|easy|new|some|another|verified)\b.*\b(semai\s+)?(word|vocabulary|vocab)\b/i,
  /\b(semai\s+)?(word|vocabulary|vocab)\b.*\b(interesting|random|simple|easy|new|some|another|verified)\b/i,
  /\b(semai\s+)?(word|words|vocabulary|vocab)\b.*\b(give|start|practice|drill|today|daily|basic|basics|focus|throw)\b/i,
  /\b(give|start|practice|drill|today|daily|basic|basics|focus|throw)\b.*\b(semai\s+)?(word|words|vocabulary|vocab)\b/i,
  /\b(show|give)\b.*\b(something\s+verified|verified\s+instead)\b/i,
];

const FALLBACK_CONTEXT_HELP_PATTERNS = [
  /\b(explain|break\s+down|understand|meaning|memory\s+tip|remember|safe\s+practice|practice\s+task)\b/i,
  /\b(jelaskan|terangkan|maksud|tip\s+ingatan|latihan\s+selamat)\b/i,
];

const isFallbackOutOfScopeRequest = (message: string): boolean => {
  const normalized = message.toLowerCase().replace(/\s+/g, ' ');
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

const classifyFallbackIntent = (request: CoachRequest): FallbackCoachIntent => {
  const normalized = request.message.trim();
  const answerLanguage = detectAnswerLanguage(normalized);
  const sessionPhase = inferFallbackPhase(request.turns);
  const track = inferFallbackTrack(request.turns, request.track);

  if (!normalized) {
    return {
      mode: 'clarification',
      responseMode: 'clarification',
      answerLanguage,
      sessionPhase,
      track,
      nextActions: defaultFallbackNextActions(sessionPhase),
      text:
        answerLanguage === 'ms'
          ? 'Boleh jelaskan sedikit lagi apa yang anda mahu belajar?'
          : 'Can you say a bit more about what you want to learn?',
    };
  }

  const endRequested =
    request.clientAction === 'end_session' ||
    FALLBACK_LEARNING_END_PATTERNS.some((pattern) => pattern.test(normalized));
  if (endRequested) {
    return {
      mode: 'direct_help',
      responseMode: 'direct_answer',
      answerLanguage,
      sessionPhase: 'idle',
      track,
      nextActions: defaultFallbackNextActions('idle'),
      text:
        answerLanguage === 'ms'
          ? 'Baik, kita tamatkan sesi belajar dulu. Bila-bila nak sambung, beritahu saya.'
          : 'Great, we can stop the study session here. Tell me anytime when you want to continue.',
    };
  }

  if (isFallbackOutOfScopeRequest(normalized)) {
    return {
      mode: 'direct_help',
      responseMode: 'direct_answer',
      answerLanguage,
      sessionPhase: sessionPhase === 'idle' ? 'onboarding' : sessionPhase,
      track,
      nextActions: defaultFallbackNextActions(
        sessionPhase === 'idle' ? 'onboarding' : sessionPhase,
      ),
      text:
        answerLanguage === 'ms'
          ? 'Saya tidak boleh bantu tugasan itu di sini. Saya boleh bantu dengan **pembelajaran Semai**, terjemahan berasas, atau latihan ringkas.'
          : 'I cannot help with that task here. I can help with **Semai learning**, grounded translation, or short practice.',
    };
  }

  const recoveryRequested =
    request.clientAction === 'slow_down' ||
    request.clientAction === 'explain_first' ||
    request.clientAction === 'try_again' ||
    FALLBACK_FRUSTRATION_PATTERNS.some((pattern) => pattern.test(normalized));
  if (recoveryRequested) {
    return {
      mode: 'direct_help',
      responseMode: 'direct_answer',
      answerLanguage,
      sessionPhase: 'onboarding',
      track,
      nextActions: ['slow_down', 'explain_first', 'try_again', 'end_session'],
      text:
        answerLanguage === 'ms'
          ? 'Maaf, saya mula terlalu cepat. Kita boleh perlahan: saya boleh terangkan asas dulu, buat pelan ringkas, atau mula dengan latihan yang sangat mudah.'
          : 'Sorry, I moved too fast. We can slow down: I can explain the basics first, make a simple plan, or start with a very easy practice.',
    };
  }

  if (FALLBACK_CONTEXT_HELP_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return {
      mode: 'direct_help',
      responseMode: 'direct_answer',
      answerLanguage,
      sessionPhase,
      track,
      nextActions: defaultFallbackNextActions(sessionPhase),
      text:
        answerLanguage === 'ms'
          ? 'Kita boleh buat ini dengan selamat: semak maksud item terakhir, ulang perlahan, dan jangan bina ayat baharu tanpa contoh yang disahkan.'
          : 'We can do this safely: review the last item meaning, repeat it slowly, and do not build a new sentence unless we have a verified example.',
    };
  }

  if (
    request.clientAction === 'make_plan' ||
    FALLBACK_ADVICE_PATTERNS.some((pattern) => pattern.test(normalized))
  ) {
    return {
      mode: 'direct_help',
      responseMode: 'direct_answer',
      answerLanguage,
      sessionPhase: 'onboarding',
      track,
      nextActions: defaultFallbackNextActions('onboarding'),
      text:
        answerLanguage === 'ms'
          ? 'Boleh. Pilih satu fokus kecil, ulang sedikit setiap hari, dan semak makna sebelum berlatih. Kita boleh mula dengan sapaan, frasa harian, sebutan, atau kosa kata.'
          : 'Yes. Choose one small focus, practice a little daily, and check meaning before speaking. We can start with greetings, daily phrases, pronunciation, or vocabulary.',
    };
  }

  if (FALLBACK_VERIFIED_VOCAB_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return {
      mode: 'learning',
      responseMode: 'scenario',
      answerLanguage: 'semai',
      sessionPhase: 'learning_active',
      track,
      nextActions: defaultFallbackNextActions('learning_active'),
      text: 'verified Semai vocabulary word',
      verifiedFallbackWord: true,
      translate: {
        text: 'verified Semai vocabulary word',
        from: answerLanguage === 'ms' ? 'ms' : 'en',
        to: 'semai',
      },
    };
  }

  const explicitTranslate =
    request.clientAction === 'translate_inline' ||
    /how do i say|how to say|translate|bagaimana .*cakap|macam mana nak cakap|terjemah/i.test(
      normalized,
    );
  if (explicitTranslate) {
    const focus = extractPromptFocus(normalized, [
      /\bhow do i say\b/i,
      /\bhow to say\b/i,
      /\btranslate\b/i,
      /\bbagaimana (nak )?cakap\b/i,
      /\bmacam mana nak cakap\b/i,
      /\bterjemah(?:kan)?\b/i,
    ]);
    return {
      mode: 'learning',
      responseMode: 'translation',
      answerLanguage: 'semai',
      sessionPhase,
      track,
      nextActions: defaultFallbackNextActions(sessionPhase),
      text: focus || normalized,
      translate: {
        text: focus || normalized,
        from: answerLanguage === 'ms' ? 'ms' : 'en',
        to: 'semai',
      },
    };
  }

  const startRequested =
    request.clientAction === 'start_session' ||
    request.clientAction === 'start_easy' ||
    request.clientAction === 'practice_greetings' ||
    FALLBACK_START_CONFIRM_PATTERNS.some((pattern) => pattern.test(normalized));
  if (sessionPhase !== 'learning_active' && startRequested) {
    const scenarioSeed =
      request.clientAction === 'practice_greetings'
        ? answerLanguage === 'ms'
          ? 'Hai, saya mahu belajar sapaan asas hari ini.'
          : 'Hello, I want to learn a basic greeting today.'
        : answerLanguage === 'ms'
          ? 'Hai, saya mahu belajar bahasa Semai hari ini.'
          : 'Hello, I want to learn Semai today.';

    return {
      mode: 'learning',
      responseMode: 'scenario',
      answerLanguage: 'semai',
      sessionPhase: 'learning_active',
      track,
      nextActions: defaultFallbackNextActions('learning_active'),
      text: scenarioSeed,
      translate: {
        text: scenarioSeed,
        from: answerLanguage === 'ms' ? 'ms' : 'en',
        to: 'semai',
      },
    };
  }

  if (/what does|what is the meaning of|apa maksud|maksud/i.test(normalized)) {
    const focus = extractPromptFocus(normalized, [
      /\bwhat does\b/i,
      /\bwhat is the meaning of\b/i,
      /\bapa maksud\b/i,
      /\bmaksud\b/i,
    ]);

    return {
      mode: 'learning',
      responseMode: 'word_help',
      answerLanguage,
      sessionPhase: 'learning_active',
      track,
      nextActions: defaultFallbackNextActions('learning_active'),
      text: focus || normalized,
      translate: {
        text: focus || normalized,
        from: 'semai',
        to: answerLanguage === 'ms' ? 'ms' : 'en',
      },
    };
  }

  if (
    /\b(sentence|sentences|phrase|phrases|example|examples|ayat|frasa|contoh)\b/i.test(
      normalized,
    ) &&
    !/\bhow do i say|how to say|translate|terjemah\b/i.test(normalized)
  ) {
    const sentenceSeed = buildFallbackSentenceSeed(normalized, answerLanguage);
    return {
      mode: 'learning',
      responseMode: 'sentence_help',
      answerLanguage: 'semai',
      sessionPhase: 'learning_active',
      track,
      nextActions: defaultFallbackNextActions('learning_active'),
      text: sentenceSeed,
      translate: {
        text: sentenceSeed,
        from: answerLanguage === 'ms' ? 'ms' : 'en',
        to: 'semai',
      },
    };
  }

  if (
    /teach me|i want to learn|let'?s practice|ajar saya|saya mahu belajar|mulakan/i.test(normalized)
  ) {
    return {
      mode: 'direct_help',
      responseMode: 'direct_answer',
      answerLanguage,
      sessionPhase: 'onboarding',
      track,
      nextActions: defaultFallbackNextActions('onboarding'),
      text:
        answerLanguage === 'ms'
          ? 'Boleh. Saya boleh bantu anda belajar Semai langkah demi langkah. Mahu mula dengan sapaan, frasa harian, sebutan, atau kosa kata mudah?'
          : 'Absolutely. I can help you learn Semai step by step. Do you want to start with greetings, daily phrases, pronunciation, or simple vocabulary?',
    };
  }

  return {
    mode: sessionPhase === 'learning_active' ? 'learning' : 'direct_help',
    responseMode: sessionPhase === 'learning_active' ? 'conversation' : 'direct_answer',
    answerLanguage,
    sessionPhase,
    track,
    nextActions: defaultFallbackNextActions(sessionPhase),
    text:
      sessionPhase === 'learning_active'
        ? normalized
        : answerLanguage === 'ms'
          ? 'Saya boleh bantu pembelajaran Semai. Jika anda mahu mula sesi belajar, taip “Jom mula.”'
          : 'I can help with Semai learning. If you want to start a study session, type “Let’s go.”',
    translate:
      sessionPhase === 'learning_active'
        ? {
            text: normalized,
            from: answerLanguage === 'ms' ? 'ms' : 'en',
            to: 'semai',
          }
        : undefined,
  };
};

const fallbackCoachWithTavi = async (request: CoachRequest): Promise<CoachResponse> => {
  const intent = classifyFallbackIntent(request);

  if (!intent.translate) {
    return {
      mode: intent.mode,
      responseMode: intent.responseMode,
      answerLanguage: intent.answerLanguage,
      sessionPhase: intent.sessionPhase,
      track: intent.track,
      nextActions: intent.nextActions,
      mainReply: intent.text,
      translation: null,
      coachNote: null,
      followUpPrompt: pickClientFollowUpPrompt(
        intent.sessionPhase,
        intent.responseMode,
        intent.answerLanguage,
      ),
      followUpTranslation: null,
      pronunciationTip: null,
      relatedExample: null,
      warning: 'Using local fallback because the ai-coach edge function is unavailable.',
      grounded: false,
      groundingSource: ['client-fallback'],
      validationPassed: true,
      provider: 'client-fallback',
      model: 'local-rules',
      meta: {
        reason: 'edge_unavailable',
        semai_verified: false,
        semai_source: 'none',
        package_eligible: false,
      },
    };
  }

  if (intent.verifiedFallbackWord) {
    return buildVerifiedClientFallbackWord(
      intent,
      'Using a verified Webonary fallback word because the ai-coach edge function is unavailable.',
    );
  }

  const translationResult = await translateText(intent.translate);
  const sourcePhrase = intent.translate.text.trim();
  const semaiSource = mapFallbackSemaiSource(translationResult.provider);
  const semaiVerified = semaiSource !== 'none' || intent.responseMode === 'translation';

  if (
    semaiSource === 'none' &&
    intent.responseMode !== 'translation' &&
    intent.translate.to === 'semai'
  ) {
    if (intent.responseMode === 'scenario' || intent.responseMode === 'sentence_help') {
      return buildVerifiedClientFallbackWord(
        intent,
        'Using a verified Webonary fallback word because model providers are unavailable.',
      );
    }

    return {
      mode: 'direct_help',
      responseMode: 'direct_answer',
      answerLanguage: intent.answerLanguage,
      sessionPhase: intent.sessionPhase,
      track: intent.track,
      nextActions: defaultFallbackNextActions(intent.sessionPhase),
      mainReply:
        intent.answerLanguage === 'ms'
          ? 'Saya belum dapat jumpa padanan Semai yang disahkan untuk permintaan itu. Cuba frasa yang lebih ringkas atau pilih Start Easy.'
          : 'I could not find a verified Semai match for that request. Try a shorter phrase or choose Start Easy.',
      translation: null,
      coachNote: null,
      followUpPrompt:
        intent.answerLanguage === 'ms'
          ? 'Tunjukkan sesuatu yang disahkan.'
          : 'Show me something verified instead.',
      followUpTranslation: null,
      pronunciationTip: null,
      relatedExample: null,
      warning:
        'Using local fallback because the ai-coach edge function is unavailable. No unverified Semai card was shown.',
      grounded: false,
      groundingSource: ['client-fallback'],
      validationPassed: false,
      provider: 'client-fallback',
      model: translationResult.model ?? translationResult.provider,
      meta: {
        ...(translationResult.meta ?? {}),
        reason: 'edge_unavailable_unverified_translation_blocked',
        semai_verified: false,
        semai_source: 'none',
        package_eligible: false,
      },
    };
  }

  return {
    mode: intent.mode,
    responseMode: intent.responseMode,
    answerLanguage: intent.translate.to === 'semai' ? 'semai' : intent.answerLanguage,
    sessionPhase: intent.sessionPhase,
    track: intent.track,
    nextActions: intent.nextActions,
    mainReply: translationResult.translatedText,
    translation: sourcePhrase,
    coachNote:
      intent.responseMode === 'word_help'
        ? 'Start with the meaning. Do not make a sentence until we have a verified example.'
        : 'Read this once, then try typing it again from memory.',
    followUpPrompt: pickClientFollowUpPrompt(
      intent.sessionPhase,
      intent.responseMode,
      intent.answerLanguage,
    ),
    followUpTranslation: null,
    pronunciationTip: null,
    relatedExample: null,
    warning:
      'Using local fallback because the ai-coach edge function is unavailable. Translation is still grounded.',
    grounded: true,
    groundingSource: ['translate-edge', 'client-fallback'],
    validationPassed: semaiVerified,
    provider: 'client-fallback',
    model: translationResult.model ?? translationResult.provider,
    meta: {
      ...(translationResult.meta ?? {}),
      semai_verified: semaiVerified,
      semai_source: semaiSource,
      package_eligible: semaiVerified,
    },
  };
};
export const coachWithTavi = async ({
  message,
  turns = [],
  clientAction,
  track,
}: CoachRequest): Promise<CoachResponse> => {
  const normalizedMessage = normalizeText(message);
  if (!normalizedMessage) {
    throw new Error('Enter a message before sending it to Tavi.');
  }

  await syncFunctionsAuthFromSession();

  let { data, error, response } = await invokeCoachFunction({
    message: normalizedMessage,
    turns,
    clientAction,
    track,
  });

  if (error && response?.status === 401) {
    const hasRefreshedToken = await refreshAndSyncFunctionsAuth();
    if (hasRefreshedToken) {
      ({ data, error, response } = await invokeCoachFunction({
        message: normalizedMessage,
        turns,
        clientAction,
        track,
      }));
    }
  }

  if (error) {
    const initialMessage = await toFunctionErrorMessage(error, response);
    const initialStatusCode = response?.status ?? 0;
    if (shouldRetryTransientFailure(initialStatusCode, initialMessage)) {
      for (let attempt = 0; attempt < TRANSIENT_RETRY_MAX; attempt += 1) {
        const jitterMs = Math.floor(Math.random() * TRANSIENT_RETRY_JITTER_MS);
        await sleep(TRANSIENT_RETRY_BASE_DELAY_MS + jitterMs);
        ({ data, error, response } = await invokeCoachFunction({
          message: normalizedMessage,
          turns,
          clientAction,
          track,
        }));
        if (!error) {
          break;
        }
      }
    }
  }

  if (error) {
    const message = await toFunctionErrorMessage(error, response);
    const statusCode = response?.status ?? 0;
    const isAuthError = statusCode === 401 || statusCode === 403;
    const isRecoverableEdgeFailure =
      !statusCode ||
      statusCode >= 500 ||
      /worker_limit|cpu time exceeded/i.test(message) ||
      /failed to send a request to the edge function/i.test(message) ||
      /network/i.test(message) ||
      /fetch/i.test(message) ||
      /cors/i.test(message);

    if (!isAuthError && isRecoverableEdgeFailure) {
      try {
        return await fallbackCoachWithTavi({
          message: normalizedMessage,
          turns,
          clientAction,
          track,
        });
      } catch {
        throw new Error(message);
      }
    }

    throw new Error(message);
  }

  if (!data || typeof data.main_reply !== 'string' || !data.main_reply.trim()) {
    throw new Error('Coach returned an empty response.');
  }

  const sessionPhase: CoachSessionPhase =
    data.session_phase === 'idle' ||
    data.session_phase === 'onboarding' ||
    data.session_phase === 'learning_active'
      ? data.session_phase
      : 'idle';
  const trackValue: LearningTrack =
    data.track === 'vocabulary_first' ||
    data.track === 'daily_conversation' ||
    data.track === 'pronunciation'
      ? data.track
      : 'vocabulary_first';
  const nextActions = Array.isArray(data.next_actions)
    ? data.next_actions.filter(
        (value): value is CoachClientAction =>
          value === 'start_session' ||
          value === 'continue_session' ||
          value === 'end_session' ||
          value === 'translate_inline' ||
          value === 'start_easy' ||
          value === 'practice_greetings' ||
          value === 'make_plan' ||
          value === 'slow_down' ||
          value === 'explain_first' ||
          value === 'try_again',
      )
    : [];

  return {
    mode: (data.mode as CoachMode | undefined) ?? 'direct_help',
    responseMode: (data.response_mode as CoachResponseMode | undefined) ?? 'direct_answer',
    answerLanguage: (data.answer_language as CoachAnswerLanguage | undefined) ?? 'en',
    sessionPhase,
    track: trackValue,
    nextActions: nextActions.length > 0 ? nextActions : defaultClientNextActions(sessionPhase),
    mainReply: data.main_reply.trim(),
    translation: normalizeNullableString(data.translation),
    coachNote: normalizeNullableString(data.coach_note),
    followUpPrompt: normalizeNullableString(data.follow_up_prompt),
    followUpTranslation: normalizeNullableString(data.follow_up_translation),
    pronunciationTip: normalizeNullableString(data.pronunciation_tip),
    relatedExample: normalizeNullableString(data.related_example),
    warning: normalizeNullableString(data.warning) ?? undefined,
    grounded: Boolean(data.grounded),
    groundingSource: Array.isArray(data.grounding_source)
      ? data.grounding_source.filter((value): value is string => typeof value === 'string')
      : [],
    validationPassed: data.validation_passed !== false,
    provider: typeof data.provider === 'string' && data.provider ? data.provider : 'unknown',
    model: typeof data.model === 'string' && data.model ? data.model : undefined,
    meta:
      typeof data.meta === 'object' && data.meta !== null
        ? (data.meta as Record<string, unknown>)
        : undefined,
  };
};
