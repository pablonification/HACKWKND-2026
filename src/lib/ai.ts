import { supabase } from '@/lib/supabase';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface TranscribePayload {
  audio_url: string;
}

export interface TranscribeResult {
  transcription: string;
}

export interface TtsPayload {
  text: string;
  voice_settings?: {
    speed?: number;
    pitch?: number;
  };
}

export interface TtsResult {
  audio_url: string;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/**
 * Invoke a Supabase Edge Function and throw on any error.
 * Mirrors the throw-on-error pattern used throughout auth.ts.
 */
async function invokeEdgeFunction<TOutput>(functionName: string, body: unknown): Promise<TOutput> {
  const { data, error } = await supabase.functions.invoke<TOutput>(functionName, {
    body: body as Record<string, unknown>,
  });
  if (error) throw error;
  if (!data) throw new Error(`No data returned from ${functionName}`);
  return data;
}

// ─────────────────────────────────────────────
// AI Helper Service Functions
// ─────────────────────────────────────────────

/**
 * Transcribe a Semai audio recording to text using OpenAI Whisper.
 * @param payload - { audio_url } — public URL of the audio file in Supabase Storage
 */
export const transcribeAudio = async (payload: TranscribePayload): Promise<TranscribeResult> => {
  return invokeEdgeFunction<TranscribeResult>('ai-transcribe', payload);
};

/**
 * Generate TTS audio for a given text using Coqui TTS.
 * The audio is uploaded to the pronunciations bucket and the public URL is returned.
 * @param payload - { text, voice_settings? }
 */
export const generateTts = async (payload: TtsPayload): Promise<TtsResult> => {
  return invokeEdgeFunction<TtsResult>('ai-tts', payload);
};
