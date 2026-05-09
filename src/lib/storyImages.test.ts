import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./supabase', () => ({
  supabase: {
    auth: { getSession: vi.fn() },
    from: vi.fn(),
  },
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { supabase } from './supabase';
import { generateStoryCover, generateStoryBg, publishRecordingAsStory } from './storyImages';

const mockSession = { access_token: 'test-token' };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(supabase.auth.getSession).mockResolvedValue({
    data: { session: mockSession },
    error: null,
  } as Awaited<ReturnType<typeof supabase.auth.getSession>>);
});

describe('generateStoryCover', () => {
  it('returns coverUrl on success', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ coverUrl: 'https://example.com/cover.png' }),
    });

    const url = await generateStoryCover('rec-1', 'Kancil', 'A story about a deer');

    expect(url).toBe('https://example.com/cover.png');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/ai/generate-image'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          recordingId: 'rec-1',
          title: 'Kancil',
          description: 'A story about a deer',
          type: 'cover',
        }),
      }),
    );
  });

  it('throws when the backend returns an error', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => ({ error: 'OpenRouter error' }),
    });

    await expect(generateStoryCover('rec-1', 'Kancil', '')).rejects.toThrow('OpenRouter error');
  });

  it('throws when response has no coverUrl', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ coverUrl: null }),
    });

    await expect(generateStoryCover('rec-1', 'Kancil', '')).rejects.toThrow('no URL');
  });
});

describe('generateStoryBg', () => {
  it('returns bgUrl on success', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ bgUrl: 'https://example.com/bg.png' }),
    });

    const url = await generateStoryBg('rec-1', 'Kancil', 'A story about a deer');

    expect(url).toBe('https://example.com/bg.png');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/ai/generate-image'),
      expect.objectContaining({
        body: JSON.stringify({
          recordingId: 'rec-1',
          title: 'Kancil',
          description: 'A story about a deer',
          type: 'bg',
        }),
      }),
    );
  });

  it('throws when response has no bgUrl', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ bgUrl: null }),
    });

    await expect(generateStoryBg('rec-1', 'Kancil', '')).rejects.toThrow('no URL');
  });
});

describe('publishRecordingAsStory', () => {
  it('updates the recording with cover_url, bg_url, and is_published=true', async () => {
    const mockEq = vi.fn().mockResolvedValue({ error: null });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
    vi.mocked(supabase.from).mockReturnValue({ update: mockUpdate } as ReturnType<
      typeof supabase.from
    >);

    await publishRecordingAsStory('rec-1', 'https://cover.png', 'https://bg.png');

    expect(supabase.from).toHaveBeenCalledWith('recordings');
    expect(mockUpdate).toHaveBeenCalledWith({
      cover_url: 'https://cover.png',
      bg_url: 'https://bg.png',
      is_published: true,
    });
    expect(mockEq).toHaveBeenCalledWith('id', 'rec-1');
  });

  it('throws when the update fails', async () => {
    const mockEq = vi.fn().mockResolvedValue({ error: { message: 'Update failed' } });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
    vi.mocked(supabase.from).mockReturnValue({ update: mockUpdate } as ReturnType<
      typeof supabase.from
    >);

    await expect(
      publishRecordingAsStory('rec-1', 'https://cover.png', 'https://bg.png'),
    ).rejects.toThrow('Update failed');
  });
});
