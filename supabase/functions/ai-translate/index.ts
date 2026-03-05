declare const Deno: {
  env: {
    get: (name: string) => string | undefined;
  };
  serve: (handler: (request: Request) => Response | Promise<Response>) => void;
};

import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import {
  areGlossaryTermsSatisfied,
  buildGlossaryPrompt,
  buildSentenceExamplesPrompt,
  findExactGlossaryTranslation,
  findExactSentenceExampleTranslation,
  findGlossaryMatches,
  findRelevantSentenceExamples,
  normalizeTranslationText,
  SEMAI_GLOSSARY,
  selectEnforceableGlossaryMatches,
  SUPPORTED_TRANSLATION_LANGUAGES,
  type TranslationLanguage,
  translateWordByWordWithGlossary,
} from '../_shared/translationGlossary.ts';

type TranslationRequest = {
  text: string;
  from: TranslationLanguage;
  to: TranslationLanguage;
};

type ModelUsage = {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
};

type ModelResult = {
  translatedText: string | null;
  provider: string;
  model: string;
  latencyMs: number;
  usage?: ModelUsage;
};

const LANGUAGE_LABELS: Record<TranslationLanguage, string> = {
  semai: 'Semai',
  ms: 'Malay',
  en: 'English',
};

const SEMAI_MODEL = Deno.env.get('HF_SEA_LION_MODEL') ?? 'aisingapore/Gemma-SEA-LION-v4-27B-IT';
const HF_API_TOKEN = Deno.env.get('HF_API_TOKEN') ?? '';

const CEREBRAS_API_KEY = Deno.env.get('CEREBRAS_API_KEY') ?? '';
const CEREBRAS_MODEL = Deno.env.get('CEREBRAS_MODEL') ?? 'zai-glm-4.7';
const CEREBRAS_FALLBACK_MODEL = Deno.env.get('CEREBRAS_FALLBACK_MODEL') ?? 'gpt-oss-120b';
const NO_GUESS_SEMAI_MODE = (Deno.env.get('NO_GUESS_SEMAI_MODE') ?? 'true') !== 'false';

const parseMaxTokens = (value: string | undefined): number => {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed)) {
    return 512;
  }

  if (parsed < 64) {
    return 64;
  }

  if (parsed > 2048) {
    return 2048;
  }

  return parsed;
};

const parseProviderTimeoutMs = (value: string | undefined): number => {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed)) {
    return 12000;
  }

  if (parsed < 1000) {
    return 1000;
  }

  if (parsed > 45000) {
    return 45000;
  }

  return parsed;
};

const MAX_TOKENS = parseMaxTokens(Deno.env.get('TRANSLATION_MAX_TOKENS'));
const PROVIDER_TIMEOUT_MS = parseProviderTimeoutMs(Deno.env.get('TRANSLATION_PROVIDER_TIMEOUT_MS'));

const fetchWithTimeout = async (
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number = PROVIDER_TIMEOUT_MS,
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
      throw new Error(`Provider request timed out after ${timeoutMs}ms.`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};

const KNOWN_SEMAI_TERMS = new Set(
  SEMAI_GLOSSARY.map((entry) => entry.semai.toLowerCase().replace(/^[^a-z]+|[^a-z]+$/g, '')).filter(
    Boolean,
  ),
);

const isTranslationLanguage = (value: unknown): value is TranslationLanguage =>
  typeof value === 'string' &&
  SUPPORTED_TRANSLATION_LANGUAGES.includes(
    value as (typeof SUPPORTED_TRANSLATION_LANGUAGES)[number],
  );

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  return 'Unexpected translation error.';
};

const cleanModelOutput = (value: string): string =>
  value
    .replace(/^translation\s*[:-]\s*/i, '')
    .replace(/^```[a-zA-Z]*\n?/i, '')
    .replace(/```$/i, '')
    .replace(/^["']|["']$/g, '')
    .trim();

const normalizeComparable = (value: string): string =>
  normalizeTranslationText(value).toLowerCase();

const containsTerm = (text: string, term: string): boolean => {
  const normalizedText = normalizeComparable(text);
  const normalizedTerm = normalizeComparable(term);

  if (!normalizedTerm) {
    return false;
  }

  const escaped = normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(^|\\b)${escaped}(?=\\b|$)`, 'i');
  return pattern.test(normalizedText);
};

const buildSystemPrompt = (): string =>
  [
    'You are a translation assistant for Semai, Malay, and English.',
    'Semai is an Aslian language that may include Malay loanwords and cultural terms.',
    'Never invent fake Semai words. If uncertain, keep wording conservative and close to known forms.',
    'Preserve cultural terms when no direct equivalent exists (e.g., bobolian, bobohiz, tong).',
    'Return only translated text with no explanation, no alternatives, and no labels.',
  ].join(' ');

const buildUserPrompt = ({
  text,
  from,
  to,
  glossaryPrompt,
  sentenceExamplesPrompt,
}: TranslationRequest & { glossaryPrompt: string; sentenceExamplesPrompt: string }): string => {
  const sections = [
    glossaryPrompt,
    sentenceExamplesPrompt,
    'Few-shot examples:',
    'Semai -> English: bobolian pergi ke hutan => traditional healer goes to the forest',
    'Malay -> English: dia makan nasi => he eats rice',
    'English -> Semai: the child is at home => anak ada di rumah',
    `Translate from ${LANGUAGE_LABELS[from]} to ${LANGUAGE_LABELS[to]}.`,
    'Return only translated text.',
    `Text: ${text}`,
  ];

  return sections.filter(Boolean).join('\n');
};

const extractOpenAiStyleUsage = (payload: unknown): ModelUsage | undefined => {
  if (typeof payload !== 'object' || payload === null || !('usage' in payload)) {
    return undefined;
  }

  const usage = payload.usage as Record<string, unknown>;
  const input = usage.prompt_tokens ?? usage.input_tokens;
  const output = usage.completion_tokens ?? usage.output_tokens;
  const total = usage.total_tokens;

  const usageOutput: ModelUsage = {};

  if (typeof input === 'number') {
    usageOutput.input_tokens = input;
  }

  if (typeof output === 'number') {
    usageOutput.output_tokens = output;
  }

  if (typeof total === 'number') {
    usageOutput.total_tokens = total;
  }

  return Object.keys(usageOutput).length > 0 ? usageOutput : undefined;
};

const extractFirstChoiceText = (payload: unknown): string => {
  if (typeof payload !== 'object' || payload === null || !('choices' in payload)) {
    return '';
  }

  const choices = payload.choices as Array<{ message?: { content?: unknown } }> | undefined;
  const content = choices?.[0]?.message?.content;
  return typeof content === 'string' ? content : '';
};

const extractProviderErrorMessage = (payload: unknown, fallback: string): string => {
  if (typeof payload !== 'object' || payload === null || !('error' in payload)) {
    return fallback;
  }

  const errorValue = (payload as { error?: unknown }).error;
  if (typeof errorValue === 'string' && errorValue.trim()) {
    return errorValue;
  }

  if (
    typeof errorValue === 'object' &&
    errorValue !== null &&
    'message' in errorValue &&
    typeof (errorValue as { message?: unknown }).message === 'string'
  ) {
    return String((errorValue as { message?: unknown }).message);
  }

  return fallback;
};

const extractProviderErrorCode = (payload: unknown): string | null => {
  if (typeof payload !== 'object' || payload === null || !('code' in payload)) {
    return null;
  }

  const code = (payload as { code?: unknown }).code;
  return typeof code === 'string' && code.trim() ? code : null;
};

const requestCerebrasTranslation = async (
  request: TranslationRequest & { glossaryPrompt: string; sentenceExamplesPrompt: string },
  model: string,
): Promise<ModelResult> => {
  const startedAt = Date.now();
  const response = await fetchWithTimeout('https://api.cerebras.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${CEREBRAS_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_completion_tokens: MAX_TOKENS,
      messages: [
        {
          role: 'system',
          content: buildSystemPrompt(),
        },
        {
          role: 'user',
          content: buildUserPrompt(request),
        },
      ],
    }),
  });

  const payload = (await response.json()) as unknown;

  if (!response.ok) {
    const message = extractProviderErrorMessage(
      payload,
      `Cerebras request failed (${response.status})`,
    );
    const code = extractProviderErrorCode(payload);
    const withCode = code ? `${message} [code:${code}]` : message;
    throw new Error(withCode);
  }

  const translatedText = cleanModelOutput(extractFirstChoiceText(payload));

  return {
    translatedText: translatedText || null,
    provider: 'cerebras',
    model,
    latencyMs: Date.now() - startedAt,
    usage: extractOpenAiStyleUsage(payload),
  };
};

const translateWithCerebras = async (
  request: TranslationRequest & { glossaryPrompt: string; sentenceExamplesPrompt: string },
): Promise<ModelResult | null> => {
  if (!CEREBRAS_API_KEY) {
    return null;
  }

  try {
    return await requestCerebrasTranslation(request, CEREBRAS_MODEL);
  } catch (primaryError) {
    const message = toErrorMessage(primaryError);
    const fallbackModel = CEREBRAS_FALLBACK_MODEL.trim();
    const shouldRetryWithFallbackModel =
      message.includes('[code:model_not_found]') &&
      fallbackModel.length > 0 &&
      fallbackModel !== CEREBRAS_MODEL;

    if (!shouldRetryWithFallbackModel) {
      throw primaryError;
    }

    return await requestCerebrasTranslation(request, fallbackModel);
  }
};

const translateWithSeaLion = async (
  request: TranslationRequest & { glossaryPrompt: string; sentenceExamplesPrompt: string },
): Promise<ModelResult | null> => {
  if (!HF_API_TOKEN) {
    return null;
  }

  const startedAt = Date.now();
  const response = await fetchWithTimeout('https://router.huggingface.co/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${HF_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: SEMAI_MODEL,
      temperature: 0.2,
      max_tokens: MAX_TOKENS,
      messages: [
        {
          role: 'system',
          content: buildSystemPrompt(),
        },
        {
          role: 'user',
          content: buildUserPrompt(request),
        },
      ],
    }),
  });

  const payload = (await response.json()) as unknown;

  if (!response.ok) {
    const message = extractProviderErrorMessage(
      payload,
      `SEA-LION API request failed (${response.status})`,
    );
    throw new Error(message);
  }

  const translatedText = cleanModelOutput(extractFirstChoiceText(payload));

  return {
    translatedText: translatedText || null,
    provider: 'sealion',
    model: SEMAI_MODEL,
    latencyMs: Date.now() - startedAt,
    usage: extractOpenAiStyleUsage(payload),
  };
};

const assessSemaiConfidenceWarning = (
  request: TranslationRequest,
  translatedText: string,
  glossaryMatches: Array<{ semai: string }>,
): string | undefined => {
  if (request.to !== 'semai') {
    return undefined;
  }

  const normalizedInput = normalizeComparable(request.text);
  const normalizedOutput = normalizeComparable(translatedText);

  if (normalizedOutput === normalizedInput) {
    return 'Low confidence: output is very close to the source text. Review Semai translation.';
  }

  const tokens = normalizedOutput
    .split(/[^a-z]+/)
    .map((token) => token.trim())
    .filter(Boolean);

  const knownCount = tokens.filter((token) => KNOWN_SEMAI_TERMS.has(token)).length;
  const hasGlossaryAnchor = glossaryMatches.some((entry) =>
    containsTerm(translatedText, entry.semai),
  );

  if (knownCount === 0 && !hasGlossaryAnchor) {
    return 'Low confidence: Semai output may be uncertain. Please validate with a language reviewer.';
  }

  return undefined;
};

const parseRequest = async (request: Request): Promise<TranslationRequest> => {
  const body = (await request.json()) as {
    text?: unknown;
    from?: unknown;
    to?: unknown;
  };

  if (typeof body.text !== 'string') {
    throw new Error('The `text` field is required.');
  }

  const text = normalizeTranslationText(body.text);
  if (!text) {
    throw new Error('The `text` field cannot be empty.');
  }

  if (!isTranslationLanguage(body.from) || !isTranslationLanguage(body.to)) {
    throw new Error('Unsupported language pair. Use semai, ms, or en.');
  }

  return {
    text,
    from: body.from,
    to: body.to,
  };
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed.' });
  }

  let payload: TranslationRequest;
  try {
    payload = await parseRequest(request);
  } catch (parseError) {
    return jsonResponse(400, { error: toErrorMessage(parseError) });
  }

  if (payload.from === payload.to) {
    return jsonResponse(200, {
      translated_text: payload.text,
      provider: 'identity',
      model: 'identity',
      meta: {
        latency_ms: 0,
      },
    });
  }

  const exactGlossaryTranslation = findExactGlossaryTranslation(
    payload.text,
    payload.from,
    payload.to,
  );
  if (exactGlossaryTranslation) {
    return jsonResponse(200, {
      translated_text: exactGlossaryTranslation,
      provider: 'glossary',
      model: 'glossary-exact',
      meta: {
        latency_ms: 0,
      },
    });
  }

  const exactSentenceExampleTranslation = findExactSentenceExampleTranslation(
    payload.text,
    payload.from,
    payload.to,
  );
  if (exactSentenceExampleTranslation) {
    return jsonResponse(200, {
      translated_text: exactSentenceExampleTranslation,
      provider: 'sentence-memory',
      model: 'webonary-example-exact',
      meta: {
        latency_ms: 0,
      },
    });
  }

  const glossaryMatches = findGlossaryMatches(payload.text, payload.from);
  const enforceableGlossaryMatches = selectEnforceableGlossaryMatches(
    glossaryMatches,
    payload.from,
    payload.to,
  );
  const glossaryPrompt = buildGlossaryPrompt(enforceableGlossaryMatches, payload.from, payload.to);
  const sentenceExampleMatches = findRelevantSentenceExamples(
    payload.text,
    payload.from,
    payload.to,
  );
  const sentenceExamplesPrompt = buildSentenceExamplesPrompt(
    sentenceExampleMatches,
    payload.from,
    payload.to,
  );

  let modelResult: ModelResult | null = null;

  try {
    modelResult = await translateWithCerebras({
      ...payload,
      glossaryPrompt,
      sentenceExamplesPrompt,
    });
  } catch (cerebrasError) {
    console.error('Cerebras translation failed:', cerebrasError);
  }

  if (!modelResult?.translatedText) {
    try {
      modelResult = await translateWithSeaLion({
        ...payload,
        glossaryPrompt,
        sentenceExamplesPrompt,
      });
    } catch (seaLionError) {
      console.error('SEA-LION translation failed:', seaLionError);
    }
  }

  if (modelResult?.translatedText) {
    if (
      enforceableGlossaryMatches.length > 0 &&
      !areGlossaryTermsSatisfied(
        modelResult.translatedText,
        enforceableGlossaryMatches,
        payload.from,
        payload.to,
      )
    ) {
      return jsonResponse(200, {
        translated_text: translateWordByWordWithGlossary(payload.text, payload.from, payload.to),
        provider: 'glossary-fallback',
        model: 'glossary-word-by-word',
        warning:
          'Model output did not preserve required glossary terms. Returned glossary-enforced fallback translation.',
        meta: {
          latency_ms: modelResult.latencyMs,
          usage: modelResult.usage,
        },
      });
    }

    const semaiWarning = assessSemaiConfidenceWarning(
      payload,
      modelResult.translatedText,
      glossaryMatches,
    );

    if (NO_GUESS_SEMAI_MODE && semaiWarning) {
      return jsonResponse(200, {
        translated_text: translateWordByWordWithGlossary(payload.text, payload.from, payload.to),
        provider: 'safety-fallback',
        model: 'glossary-word-by-word',
        warning: `${semaiWarning} Returned grounded glossary fallback instead of uncertain model output.`,
        meta: {
          latency_ms: modelResult.latencyMs,
          usage: modelResult.usage,
          attempted_provider: modelResult.provider,
          attempted_model: modelResult.model,
        },
      });
    }

    return jsonResponse(200, {
      translated_text: modelResult.translatedText,
      provider: modelResult.provider,
      model: modelResult.model,
      warning: semaiWarning,
      meta: {
        latency_ms: modelResult.latencyMs,
        usage: modelResult.usage,
      },
    });
  }

  const fallback = translateWordByWordWithGlossary(payload.text, payload.from, payload.to);
  const fallbackWarning =
    payload.to === 'semai' && normalizeComparable(fallback) === normalizeComparable(payload.text)
      ? 'Using fallback dictionary and confidence is low for Semai output. Review with a language keeper.'
      : 'Using offline fallback dictionary because model providers are unavailable.';

  return jsonResponse(200, {
    translated_text: fallback,
    provider: 'fallback',
    model: 'glossary-word-by-word',
    warning: fallbackWarning,
    meta: {
      latency_ms: 0,
    },
  });
});
