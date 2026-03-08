import { beforeEach, describe, expect, it, vi } from 'vitest';

import { coachWithTavi } from './aiCoach';
import { supabase } from './supabase';

vi.mock('./supabase', () => ({
  supabasePublicAnonKey: 'test-anon-key',
  supabase: {
    auth: {
      getSession: vi.fn(),
      getUser: vi.fn(),
      refreshSession: vi.fn(),
    },
    functions: {
      setAuth: vi.fn(),
      invoke: vi.fn(),
    },
  },
}));

type MockedSupabase = {
  auth: {
    getSession: ReturnType<typeof vi.fn>;
    getUser: ReturnType<typeof vi.fn>;
    refreshSession: ReturnType<typeof vi.fn>;
  };
  functions: {
    setAuth: ReturnType<typeof vi.fn>;
    invoke: ReturnType<typeof vi.fn>;
  };
};

describe('coachWithTavi', () => {
  const mockedSupabase = supabase as unknown as MockedSupabase;

  beforeEach(() => {
    vi.clearAllMocks();
    mockedSupabase.auth.getSession.mockResolvedValue({
      data: { session: { access_token: 'session-token' } },
      error: null,
    });
    mockedSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
    mockedSupabase.auth.refreshSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
  });

  it('returns structured coach data from the edge function', async () => {
    mockedSupabase.functions.invoke.mockResolvedValue({
      data: {
        mode: 'learning',
        response_mode: 'translation',
        answer_language: 'en',
        session_phase: 'learning_active',
        track: 'vocabulary_first',
        next_actions: ['continue_session', 'end_session'],
        main_reply: 'selamat pagi',
        translation: 'good morning',
        coach_note: 'This is a common greeting.',
        follow_up_prompt: 'Try saying it to a friend.',
        grounded: true,
        grounding_source: ['glossary'],
        validation_passed: true,
        provider: 'google-ai-studio',
        model: 'gemini-3.1-flash-lite-preview',
      },
      error: null,
    });

    const result = await coachWithTavi({ message: 'How do I say good morning?' });

    expect(result).toMatchObject({
      mode: 'learning',
      responseMode: 'translation',
      answerLanguage: 'en',
      sessionPhase: 'learning_active',
      track: 'vocabulary_first',
      nextActions: ['continue_session', 'end_session'],
      mainReply: 'selamat pagi',
      translation: 'good morning',
      coachNote: 'This is a common greeting.',
      followUpPrompt: 'Try saying it to a friend.',
      grounded: true,
      groundingSource: ['glossary'],
      provider: 'google-ai-studio',
      model: 'gemini-3.1-flash-lite-preview',
    });
  });

  it('invokes coach without a manual authorization header', async () => {
    mockedSupabase.functions.invoke.mockResolvedValue({
      data: {
        main_reply: 'ok',
        mode: 'direct_help',
        response_mode: 'direct_answer',
        answer_language: 'en',
        grounded: false,
        grounding_source: [],
        validation_passed: true,
        provider: 'google-ai-studio',
      },
      error: null,
    });

    await coachWithTavi({ message: 'What can you help with?' });

    expect(mockedSupabase.functions.invoke).toHaveBeenCalledWith('ai-coach', {
      headers: {
        apikey: 'test-anon-key',
      },
      body: {
        message: 'What can you help with?',
        turns: [],
      },
    });
    expect(mockedSupabase.functions.setAuth).toHaveBeenCalledWith('session-token');
  });

  it('sends client_action and track for deterministic flow controls', async () => {
    mockedSupabase.functions.invoke.mockResolvedValue({
      data: {
        main_reply: 'Session started.',
        mode: 'learning',
        response_mode: 'scenario',
        answer_language: 'semai',
        session_phase: 'learning_active',
        track: 'vocabulary_first',
        next_actions: ['continue_session', 'end_session'],
        grounded: false,
        grounding_source: [],
        validation_passed: true,
        provider: 'google-ai-studio',
      },
      error: null,
    });

    await coachWithTavi({
      message: "Let's go",
      clientAction: 'start_session',
      track: 'vocabulary_first',
      turns: [
        {
          role: 'assistant',
          text: 'Ready when you are.',
          mode: 'direct_help',
          sessionPhase: 'onboarding',
          track: 'vocabulary_first',
        },
      ],
    });

    expect(mockedSupabase.functions.invoke).toHaveBeenCalledWith('ai-coach', {
      headers: {
        apikey: 'test-anon-key',
      },
      body: {
        message: "Let's go",
        client_action: 'start_session',
        track: 'vocabulary_first',
        turns: [
          {
            role: 'assistant',
            text: 'Ready when you are.',
            mode: 'direct_help',
            session_phase: 'onboarding',
            track: 'vocabulary_first',
          },
        ],
      },
    });
  });

  it('throws when the message is empty', async () => {
    await expect(coachWithTavi({ message: '   ' })).rejects.toThrow(
      'Enter a message before sending it to Tavi.',
    );
  });

  it('degrades to local fallback on transient edge 5xx errors', async () => {
    mockedSupabase.functions.invoke.mockResolvedValue({
      data: null,
      error: new Error('Edge Function returned a non-2xx status code'),
      response: new Response(JSON.stringify({ error: 'Gemini request timed out.' }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }),
    });

    const result = await coachWithTavi({ message: 'Help me learn Semai.' });
    expect(result.provider).toBe('client-fallback');
    expect(result.warning).toContain('local fallback');
    expect(mockedSupabase.functions.invoke).toHaveBeenCalledTimes(2);
  });

  it('falls back to grounded local behavior when the coach edge function is unreachable', async () => {
    mockedSupabase.functions.invoke
      .mockResolvedValueOnce({
        data: null,
        error: new Error('Failed to send a request to the Edge Function'),
        response: undefined,
      })
      .mockResolvedValueOnce({
        data: {
          translated_text: 'selamat pagi',
          provider: 'sealion',
          model: 'grounded-translate',
        },
        error: null,
      });

    const result = await coachWithTavi({ message: 'How do I say good morning?' });

    expect(result).toMatchObject({
      mode: 'learning',
      responseMode: 'translation',
      answerLanguage: 'semai',
      mainReply: 'selamat pagi',
      translation: 'good morning',
      grounded: true,
      provider: 'client-fallback',
    });
    expect(mockedSupabase.functions.invoke).toHaveBeenNthCalledWith(2, 'ai-translate', {
      headers: {
        apikey: 'test-anon-key',
        Authorization: 'Bearer session-token',
      },
      body: {
        text: 'good morning',
        from: 'en',
        to: 'semai',
      },
    });
  });

  it('throws when auth is rejected and refresh cannot recover', async () => {
    mockedSupabase.functions.invoke.mockResolvedValueOnce({
      data: null,
      error: new Error('Edge Function returned a non-2xx status code'),
      response: new Response(JSON.stringify({ error: 'Invalid JWT' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
        },
      }),
    });
    mockedSupabase.auth.refreshSession.mockResolvedValue({
      data: { session: null },
      error: new Error('refresh failed'),
    });

    await expect(coachWithTavi({ message: 'Teach me a short Semai greeting.' })).rejects.toThrow(
      'Coach requires an active session. Sign in again and retry.',
    );
  });
});
