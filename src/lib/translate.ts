import { supabase, supabasePublicAnonKey } from './supabase';
import { useAuthStore } from '../stores/authStore';

export const TRANSLATION_LANGUAGES = ['semai', 'ms', 'en'] as const;

export type TranslationLanguage = (typeof TRANSLATION_LANGUAGES)[number];

export type TranslateInput = {
  text: string;
  from: TranslationLanguage;
  to: TranslationLanguage;
};

export type TranslateResult = {
  translatedText: string;
  provider: string;
  model?: string;
  warning?: string;
  meta?: {
    latency_ms?: number;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      total_tokens?: number;
    };
    attempted_provider?: string;
    attempted_model?: string;
  };
};

type TranslateApiResponse = {
  translated_text?: unknown;
  provider?: unknown;
  model?: unknown;
  warning?: unknown;
  meta?: unknown;
};

const isTranslationLanguage = (value: string): value is TranslationLanguage =>
  TRANSLATION_LANGUAGES.includes(value as TranslationLanguage);

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  return 'Translation failed. Please try again.';
};

const normalizeText = (value: string): string => value.trim().replace(/\s+/g, ' ');

const GENERIC_EDGE_HTTP_ERROR = 'Edge Function returned a non-2xx status code';

type SessionLike = {
  access_token?: string | null;
};

const getSessionAccessToken = (session: SessionLike | null | undefined): string | null => {
  const value = session?.access_token;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
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
      ? 'Translation requires an active session. Sign in again and retry.'
      : responseMessage || 'Translation requires an active session. Sign in again and retry.';
  }

  if (responseMessage) {
    return responseMessage;
  }

  if (error instanceof Error && error.message && error.message !== GENERIC_EDGE_HTTP_ERROR) {
    return error.message;
  }

  return toErrorMessage(error);
};

const resolveTranslationAccessToken = async (): Promise<string> => {
  const storeToken = getSessionAccessToken(useAuthStore.getState().session);
  if (storeToken) {
    return storeToken;
  }

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw new Error(toErrorMessage(sessionError));
  }

  const sessionToken = getSessionAccessToken(session);
  if (sessionToken) {
    return sessionToken;
  }

  const { data, error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError) {
    throw new Error(toErrorMessage(refreshError));
  }

  const refreshedToken = getSessionAccessToken(data.session);
  if (refreshedToken) {
    return refreshedToken;
  }

  throw new Error('Translation requires an active session. Sign in again and retry.');
};

const invokeTranslateFunction = async (accessToken: string, body: TranslateInput) =>
  supabase.functions.invoke<TranslateApiResponse>('ai-translate', {
    headers: {
      apikey: supabasePublicAnonKey,
      Authorization: `Bearer ${accessToken}`,
    },
    body,
  });

export const translateText = async ({
  text,
  from,
  to,
}: TranslateInput): Promise<TranslateResult> => {
  if (!isTranslationLanguage(from) || !isTranslationLanguage(to)) {
    throw new Error('Unsupported language pair.');
  }

  const normalizedText = normalizeText(text);
  if (!normalizedText) {
    throw new Error('Enter text to translate.');
  }

  if (from === to) {
    return {
      translatedText: normalizedText,
      provider: 'identity',
    };
  }

  let accessToken = await resolveTranslationAccessToken();
  let { data, error, response } = await invokeTranslateFunction(accessToken, {
    text: normalizedText,
    from,
    to,
  });

  if (error && response?.status === 401) {
    const { data: refreshedData, error: refreshError } = await supabase.auth.refreshSession();
    if (!refreshError) {
      const refreshedToken = getSessionAccessToken(refreshedData.session);
      if (refreshedToken && refreshedToken !== accessToken) {
        accessToken = refreshedToken;
        ({ data, error, response } = await invokeTranslateFunction(accessToken, {
          text: normalizedText,
          from,
          to,
        }));
      }
    }
  }

  if (error) {
    throw new Error(await toFunctionErrorMessage(error, response));
  }

  if (!data || typeof data.translated_text !== 'string' || !data.translated_text.trim()) {
    throw new Error('Translation service returned an empty response.');
  }

  return {
    translatedText: data.translated_text.trim(),
    provider: typeof data.provider === 'string' && data.provider ? data.provider : 'unknown',
    model: typeof data.model === 'string' && data.model ? data.model : undefined,
    warning: typeof data.warning === 'string' && data.warning ? data.warning : undefined,
    meta:
      typeof data.meta === 'object' && data.meta !== null
        ? (data.meta as TranslateResult['meta'])
        : undefined,
  };
};
