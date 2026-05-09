import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Story } from './storyData';
import {
  applyStoryProgress,
  getLastReadStory,
  saveStoryProgress,
  type StoryProgressEntry,
} from './storyProgress';

vi.mock('@capacitor/preferences', () => {
  const store = new Map<string, string>();
  return {
    Preferences: {
      get: vi.fn(async ({ key }: { key: string }) => ({ value: store.get(key) ?? null })),
      set: vi.fn(async ({ key, value }: { key: string; value: string }) => {
        store.set(key, value);
      }),
      remove: vi.fn(async ({ key }: { key: string }) => {
        store.delete(key);
      }),
      __store: store,
    },
  };
});

const story: Story = {
  id: 'kancil',
  title: 'Kancil & Buaya',
  author: 'Cerite Rakyat',
  cover: '/cover.png',
  bg: '/bg.png',
  duration: '15 min',
  pages: 8,
  genre: 'Fable',
  synopsis: 'A story',
  lastChapter: 'Satu Cerite',
  lastPage: 0,
  totalPages: 8,
  progress: 0,
  scenes: Array.from({ length: 8 }, (_, index) => ({
    image: `/scene-${index}.png`,
    text: `Scene ${index + 1}`,
  })),
};

describe('storyProgress', () => {
  beforeEach(async () => {
    const { Preferences } = await import('@capacitor/preferences');
    (Preferences as unknown as { __store: Map<string, string> }).__store.clear();
  });

  it('saves scene position as percentage progress', async () => {
    const progress = await saveStoryProgress(story, 3);

    expect(progress).toMatchObject({
      storyId: 'kancil',
      currentScene: 3,
      lastPage: 4,
      totalPages: 8,
      progress: 50,
    });
  });

  it('applies stored progress without using catalog placeholder values', () => {
    const progress: StoryProgressEntry = {
      storyId: 'kancil',
      currentScene: 4,
      totalScenes: 8,
      lastPage: 5,
      totalPages: 8,
      progress: 63,
      lastChapter: 'Satu Cerite',
      updatedAt: '2026-05-10T01:00:00.000Z',
    };

    expect(applyStoryProgress({ ...story, progress: 99 }, progress)).toMatchObject({
      progress: 63,
      lastPage: 5,
      totalPages: 8,
    });
  });

  it('selects the most recently updated story as last read', () => {
    const older = {
      storyId: 'kancil',
      currentScene: 0,
      totalScenes: 8,
      lastPage: 1,
      totalPages: 8,
      progress: 13,
      lastChapter: 'Satu Cerite',
      updatedAt: '2026-05-10T01:00:00.000Z',
    };
    const newer = {
      ...older,
      storyId: 'sunbe',
      updatedAt: '2026-05-10T02:00:00.000Z',
    };

    expect(
      getLastReadStory([{ ...story, id: 'sunbe', title: 'Sunbe & Fenyi' }, story], {
        kancil: older,
        sunbe: newer,
      })?.id,
    ).toBe('sunbe');
  });
});
