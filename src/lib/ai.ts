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
    /** 0–1. How consistent the voice sounds across generations. Default: 0.5 */
    stability?: number;
    /** 0–1. How closely the voice matches the original. Default: 0.75 */
    similarity_boost?: number;
    /** 0–1. Speaking style exaggeration (v2 models only). Default: 0 */
    style?: number;
    /** Boosts speaker clarity. Default: true */
    use_speaker_boost?: boolean;
    /** 0.7–1.2. Controls speaking speed. Default: 1.0 */
    speed?: number;
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
 * Generate TTS audio for a given text using ElevenLabs TTS.
 * The audio is uploaded to the pronunciations bucket and the public URL is returned.
 * @param payload - { text, voice_settings? }
 */
export const generateTts = async (payload: TtsPayload): Promise<TtsResult> => {
  return invokeEdgeFunction<TtsResult>('ai-tts', payload);
};
