import { supabase, supabasePublicAnonKey } from './supabase';

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

  const { data, error } = await supabase.functions.invoke<TranslateApiResponse>('ai-translate', {
    headers: {
      // Only pass apikey; omit Authorization so the Supabase SDK forwards
      // the session-aware JWT for authenticated users automatically.
      apikey: supabasePublicAnonKey,
    },
    body: {
      text: normalizedText,
      from,
      to,
    },
  });

  if (error) {
    throw new Error(toErrorMessage(error));
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
