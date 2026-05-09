import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./supabase', () => ({
  supabase: {
    functions: { invoke: vi.fn() },
    from: vi.fn(),
  },
}));

import { supabase } from './supabase';
import { generateStoryVisuals, publishRecordingAsStory } from './storyImages';

describe('generateStoryVisuals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns coverUrl and bgUrl on success', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { coverUrl: 'https://example.com/cover.png', bgUrl: 'https://example.com/bg.png' },
      error: null,
    });

    const result = await generateStoryVisuals('rec-1', 'Kancil', 'A story about a deer');

    expect(result).toEqual({
      coverUrl: 'https://example.com/cover.png',
      bgUrl: 'https://example.com/bg.png',
    });
    expect(supabase.functions.invoke).toHaveBeenCalledWith('generate-story-cover', {
      body: { recordingId: 'rec-1', title: 'Kancil', description: 'A story about a deer' },
    });
  });

  it('throws when the function returns an error', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: null,
      error: { message: 'Edge function error' },
    });

    await expect(generateStoryVisuals('rec-1', 'Kancil', '')).rejects.toThrow(
      'Edge function error',
    );
  });

  it('throws when response is missing URLs', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { coverUrl: null, bgUrl: null },
      error: null,
    });

    await expect(generateStoryVisuals('rec-1', 'Kancil', '')).rejects.toThrow('incomplete data');
  });
});

describe('publishRecordingAsStory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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
