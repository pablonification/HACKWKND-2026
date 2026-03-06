import { vi, describe, it, expect, beforeEach } from 'vitest';
import { transcribeAudio, generateTts } from './ai';
import { supabase } from './supabase';

vi.mock('./supabase', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}));

type MockedFunctions = {
  invoke: ReturnType<typeof vi.fn>;
};

type MockedSupabase = {
  functions: MockedFunctions;
};

describe('ai', () => {
  const mockedSupabase = supabase as unknown as MockedSupabase;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─────────────────────────────────────────────
  // transcribeAudio
  // ─────────────────────────────────────────────
  describe('transcribeAudio', () => {
    it('returns transcription on success', async () => {
      mockedSupabase.functions.invoke.mockResolvedValue({
        data: { transcription: 'bobolian cemam' },
        error: null,
      });

      const result = await transcribeAudio({ audio_url: 'https://example.com/audio.m4a' });

      expect(mockedSupabase.functions.invoke).toHaveBeenCalledWith('ai-transcribe', {
        body: { audio_url: 'https://example.com/audio.m4a' },
      });
      expect(result.transcription).toBe('bobolian cemam');
    });

    it('throws when invoke returns an error', async () => {
      mockedSupabase.functions.invoke.mockResolvedValue({
        data: null,
        error: new Error('Whisper API error: 429 Too Many Requests'),
      });

      await expect(transcribeAudio({ audio_url: 'https://example.com/audio.m4a' })).rejects.toThrow(
        'Whisper API error: 429 Too Many Requests',
      );
    });

    it('throws when data is null but no error object', async () => {
      mockedSupabase.functions.invoke.mockResolvedValue({ data: null, error: null });

      await expect(transcribeAudio({ audio_url: 'https://example.com/audio.m4a' })).rejects.toThrow(
        'No data returned from ai-transcribe',
      );
    });
  });

  // ─────────────────────────────────────────────
  // generateTts
  // ─────────────────────────────────────────────
  describe('generateTts', () => {
    it('returns audio_url on success', async () => {
      mockedSupabase.functions.invoke.mockResolvedValue({
        data: { audio_url: 'https://example.com/pronunciations/tts_123.wav' },
        error: null,
      });

      const result = await generateTts({ text: 'bobolian' });

      expect(mockedSupabase.functions.invoke).toHaveBeenCalledWith('ai-tts', {
        body: { text: 'bobolian' },
      });
      expect(result.audio_url).toBe('https://example.com/pronunciations/tts_123.wav');
    });

    it('passes voice_settings through to the function', async () => {
      mockedSupabase.functions.invoke.mockResolvedValue({
        data: { audio_url: 'https://example.com/pronunciations/tts_456.wav' },
        error: null,
      });

      await generateTts({ text: 'bobolian', voice_settings: { speed: 0.75 } });

      expect(mockedSupabase.functions.invoke).toHaveBeenCalledWith('ai-tts', {
        body: { text: 'bobolian', voice_settings: { speed: 0.75 } },
      });
    });

    it('throws on Coqui TTS error', async () => {
      mockedSupabase.functions.invoke.mockResolvedValue({
        data: null,
        error: new Error('Coqui TTS error: connection refused'),
      });

      await expect(generateTts({ text: 'bobolian' })).rejects.toThrow(
        'Coqui TTS error: connection refused',
      );
    });
  });
});
