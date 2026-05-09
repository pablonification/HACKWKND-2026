import type { Story, StoryScene } from './storyData';

export const PUBLISHED_STORY_SELECT =
  'id, title, description, cover_url, bg_url, duration_seconds, transcription, verified_transcription, verified_translation_ms, topic_tags' as const;

export type PublishedStoryRow = {
  id: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  bg_url: string | null;
  duration_seconds: number | null;
  transcription: string | null;
  verified_transcription: string | null;
  verified_translation_ms: string | null;
  topic_tags: string[] | null;
};

const buildPublishedStoryScenes = (row: PublishedStoryRow, bgUrl: string): StoryScene[] => {
  const rawText = row.verified_transcription ?? row.transcription ?? '';
  const paragraphs = rawText
    .split(/\n\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const translations = (row.verified_translation_ms ?? '')
    .split(/\n\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return paragraphs.map((paragraph, index) => ({
    image: bgUrl,
    text: paragraph,
    subtitle: translations[index] ?? undefined,
  }));
};

export const publishedStoryRowToStory = (row: PublishedStoryRow): Story => {
  const mins = row.duration_seconds ? Math.max(1, Math.ceil(row.duration_seconds / 60)) : null;
  const coverUrl = row.cover_url;
  const bgUrl = row.bg_url;
  if (!coverUrl || !bgUrl) {
    throw new Error('Published stories require cover and background images.');
  }

  const scenes = buildPublishedStoryScenes(row, bgUrl);

  return {
    id: row.id,
    title: row.title,
    author: 'Elder Story',
    cover: coverUrl,
    bg: bgUrl,
    duration: mins ? `${mins} min` : '-',
    pages: Math.max(1, scenes.length),
    genre: row.topic_tags?.[0] ?? 'Semai Story',
    synopsis:
      row.description ??
      row.verified_transcription ??
      row.transcription ??
      'A recorded Semai story.',
    lastChapter: 'Chapter 1',
    lastPage: 1,
    totalPages: Math.max(1, scenes.length),
    progress: 0,
    scenes,
  };
};
