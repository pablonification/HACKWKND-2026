import type { Story, StoryScene } from './storyData';

export const PUBLISHED_STORY_SELECT =
  'id, title, description, cover_url, bg_url, duration_seconds, transcription, verified_transcription, verified_translation_ms, topic_tags' as const;

export type PublishedStoryRow = {
  id: string;
  title: string;
  description: string | null;
  cover_url: string;
  bg_url: string;
  duration_seconds: number | null;
  transcription: string | null;
  verified_transcription: string | null;
  verified_translation_ms: string | null;
  topic_tags: string[] | null;
};

const buildPublishedStoryScenes = (row: PublishedStoryRow): StoryScene[] => {
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
    image: row.bg_url,
    text: paragraph,
    subtitle: translations[index] ?? undefined,
  }));
};

export const publishedStoryRowToStory = (row: PublishedStoryRow): Story => {
  const mins = row.duration_seconds ? Math.max(1, Math.ceil(row.duration_seconds / 60)) : null;
  const scenes = buildPublishedStoryScenes(row);

  return {
    id: row.id,
    title: row.title,
    author: 'Elder Story',
    cover: row.cover_url,
    bg: row.bg_url,
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
