import { beforeEach, describe, expect, it, vi } from 'vitest';

import { translateText } from './translate';
import { supabase } from './supabase';

vi.mock('./supabase', () => ({
  supabasePublicAnonKey: 'test-anon-key',
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}));

type MockedSupabase = {
  functions: {
    invoke: ReturnType<typeof vi.fn>;
  };
};

describe('translateText', () => {
  const mockedSupabase = supabase as unknown as MockedSupabase;

  beforeEach(() => {
    vi.clearAllMocks();
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
        Authorization: 'Bearer test-anon-key',
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
    });

    await expect(
      translateText({
        text: 'rumah',
        from: 'semai',
        to: 'ms',
      }),
    ).rejects.toThrow('Function returned 500');
  });
});
