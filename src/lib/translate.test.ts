import { beforeEach, describe, expect, it, vi } from 'vitest';

import { translateText } from './translate';
import { supabase } from './supabase';
import { useAuthStore } from '../stores/authStore';

vi.mock('./supabase', () => ({
  supabasePublicAnonKey: 'test-anon-key',
  supabase: {
    auth: {
      getSession: vi.fn(),
      refreshSession: vi.fn(),
    },
    functions: {
      invoke: vi.fn(),
    },
  },
}));

vi.mock('../stores/authStore', () => ({
  useAuthStore: {
    getState: vi.fn(),
  },
}));

type MockedSupabase = {
  auth: {
    getSession: ReturnType<typeof vi.fn>;
    refreshSession: ReturnType<typeof vi.fn>;
  };
  functions: {
    invoke: ReturnType<typeof vi.fn>;
  };
};

describe('translateText', () => {
  const mockedSupabase = supabase as unknown as MockedSupabase;
  const mockedAuthStore = useAuthStore as unknown as {
    getState: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockedAuthStore.getState.mockReturnValue({
      session: null,
    });
    mockedSupabase.auth.getSession.mockResolvedValue({
      data: { session: { access_token: 'test-access-token' } },
      error: null,
    });
    mockedSupabase.auth.refreshSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
  });

  it('returns translated text from edge function', async () => {
    mockedSupabase.functions.invoke.mockResolvedValue({
      data: { translated_text: 'house', provider: 'sealion' },
      error: null,
    });

    const result = await translateText({
      text: 'rumah',
      from: 'semai',
      to: 'en',
    });

    expect(result).toEqual({
      translatedText: 'house',
      provider: 'sealion',
      model: undefined,
      warning: undefined,
      meta: undefined,
    });
    expect(mockedSupabase.functions.invoke).toHaveBeenCalledWith('ai-translate', {
      headers: {
        apikey: 'test-anon-key',
        Authorization: 'Bearer test-access-token',
      },
      body: {
        text: 'rumah',
        from: 'semai',
        to: 'en',
      },
    });
  });

  it('returns identity translation for same language pair', async () => {
    const result = await translateText({
      text: '  test text  ',
      from: 'en',
      to: 'en',
    });

    expect(result).toEqual({
      translatedText: 'test text',
      provider: 'identity',
      model: undefined,
      warning: undefined,
      meta: undefined,
    });
    expect(mockedSupabase.functions.invoke).not.toHaveBeenCalled();
  });

  it('uses the auth store session token before sdk session lookup', async () => {
    mockedAuthStore.getState.mockReturnValue({
      session: { access_token: 'store-access-token' },
    });
    mockedSupabase.functions.invoke.mockResolvedValue({
      data: { translated_text: 'rumah', provider: 'sealion' },
      error: null,
    });

    await translateText({
      text: 'rumah',
      from: 'semai',
      to: 'ms',
    });

    expect(mockedSupabase.auth.getSession).not.toHaveBeenCalled();
    expect(mockedSupabase.functions.invoke).toHaveBeenCalledWith('ai-translate', {
      headers: {
        apikey: 'test-anon-key',
        Authorization: 'Bearer store-access-token',
      },
      body: {
        text: 'rumah',
        from: 'semai',
        to: 'ms',
      },
    });
  });

  it('throws when text is empty', async () => {
    await expect(
      translateText({
        text: '   ',
        from: 'semai',
        to: 'ms',
      }),
    ).rejects.toThrow('Enter text to translate.');
  });

  it('throws when edge function fails', async () => {
    mockedSupabase.functions.invoke.mockResolvedValue({
      data: null,
      error: new Error('Function returned 500'),
      response: undefined,
    });

    await expect(
      translateText({
        text: 'rumah',
        from: 'semai',
        to: 'ms',
      }),
    ).rejects.toThrow('Function returned 500');
  });

  it('throws when session is missing before invoke', async () => {
    mockedSupabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    mockedSupabase.auth.refreshSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    await expect(
      translateText({
        text: 'rumah',
        from: 'semai',
        to: 'ms',
      }),
    ).rejects.toThrow('Translation requires an active session. Sign in again and retry.');
    expect(mockedSupabase.functions.invoke).not.toHaveBeenCalled();
  });

  it('parses edge function http error responses', async () => {
    mockedSupabase.functions.invoke.mockResolvedValue({
      data: null,
      error: new Error('Edge Function returned a non-2xx status code'),
      response: new Response(
        JSON.stringify({ error: 'Provider request timed out after 12000ms.' }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
    });

    await expect(
      translateText({
        text: 'rumah',
        from: 'semai',
        to: 'ms',
      }),
    ).rejects.toThrow('Provider request timed out after 12000ms.');
  });

  it('refreshes once and retries when the edge function returns 401', async () => {
    mockedSupabase.functions.invoke
      .mockResolvedValueOnce({
        data: null,
        error: new Error('Edge Function returned a non-2xx status code'),
        response: new Response(JSON.stringify({ error: 'Invalid JWT' }), {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
          },
        }),
      })
      .mockResolvedValueOnce({
        data: { translated_text: 'rumah', provider: 'sealion' },
        error: null,
      });
    mockedSupabase.auth.refreshSession.mockResolvedValue({
      data: { session: { access_token: 'refreshed-access-token' } },
      error: null,
    });

    const result = await translateText({
      text: 'rumah',
      from: 'semai',
      to: 'ms',
    });

    expect(result.translatedText).toBe('rumah');
    expect(mockedSupabase.functions.invoke).toHaveBeenNthCalledWith(2, 'ai-translate', {
      headers: {
        apikey: 'test-anon-key',
        Authorization: 'Bearer refreshed-access-token',
      },
      body: {
        text: 'rumah',
        from: 'semai',
        to: 'ms',
      },
    });
  });
});
