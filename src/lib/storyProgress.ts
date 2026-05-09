import { getJSON, setJSON, STORAGE_KEYS } from './storage';
import type { Story } from './storyData';

export interface StoryProgressEntry {
  storyId: string;
  currentScene: number;
  totalScenes: number;
  progress: number;
  lastPage: number;
  totalPages: number;
  lastChapter: string;
  updatedAt: string;
}

type StoryProgressMap = Record<string, StoryProgressEntry>;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const getTotalScenes = (story: Story) => Math.max(1, story.scenes?.length ?? story.totalPages);

export const getStoryProgress = async (): Promise<StoryProgressMap> =>
  getJSON<StoryProgressMap>(STORAGE_KEYS.STORY_PROGRESS, {});

export const getStoryProgressEntry = async (
  storyId: string,
): Promise<StoryProgressEntry | null> => {
  const progress = await getStoryProgress();
  return progress[storyId] ?? null;
};

export const saveStoryProgress = async (
  story: Story,
  currentScene: number,
): Promise<StoryProgressEntry> => {
  const totalScenes = getTotalScenes(story);
  const sceneIndex = clamp(currentScene, 0, totalScenes - 1);
  const lastPage = sceneIndex + 1;
  const entry: StoryProgressEntry = {
    storyId: story.id,
    currentScene: sceneIndex,
    totalScenes,
    progress: Math.round((lastPage / totalScenes) * 100),
    lastPage,
    totalPages: totalScenes,
    lastChapter: story.lastChapter || 'Scene 1',
    updatedAt: new Date().toISOString(),
  };
  const progress = await getStoryProgress();
  await setJSON(STORAGE_KEYS.STORY_PROGRESS, { ...progress, [story.id]: entry });
  return entry;
};

export const applyStoryProgress = (
  story: Story,
  progressEntry: StoryProgressEntry | null | undefined,
): Story => {
  if (!progressEntry || progressEntry.storyId !== story.id) {
    return { ...story, progress: 0, lastPage: 0 };
  }

  const totalPages = getTotalScenes(story);
  const lastPage = clamp(progressEntry.lastPage, 1, totalPages);
  return {
    ...story,
    lastChapter: progressEntry.lastChapter,
    lastPage,
    totalPages,
    progress: clamp(progressEntry.progress, 0, 100),
  };
};

export const getLastReadStory = (stories: Story[], progress: StoryProgressMap): Story | null => {
  const storyById = new Map(stories.map((story) => [story.id, story]));
  const latest = Object.values(progress)
    .filter((entry) => storyById.has(entry.storyId))
    .sort((first, second) => second.updatedAt.localeCompare(first.updatedAt))[0];

  if (!latest) {
    return null;
  }

  const story = storyById.get(latest.storyId);
  return story ? applyStoryProgress(story, latest) : null;
};
