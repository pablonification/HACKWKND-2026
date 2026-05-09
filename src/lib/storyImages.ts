import { supabase } from './supabase';

export type GeneratedStoryVisuals = {
  coverUrl: string;
  bgUrl: string;
};

export async function generateStoryVisuals(
  recordingId: string,
  title: string,
  description: string,
): Promise<GeneratedStoryVisuals> {
  const { data, error } = await supabase.functions.invoke('generate-story-cover', {
    body: { recordingId, title, description },
  });

  if (error) {
    throw new Error((error as { message?: string }).message ?? 'Image generation failed');
  }

  const result = data as { coverUrl?: string | null; bgUrl?: string | null };
  if (!result?.coverUrl || !result?.bgUrl) {
    throw new Error('Image generation returned incomplete data');
  }

  return { coverUrl: result.coverUrl, bgUrl: result.bgUrl };
}

export async function publishRecordingAsStory(
  recordingId: string,
  coverUrl: string,
  bgUrl: string,
): Promise<void> {
  const { error } = await supabase
    .from('recordings')
    .update({ cover_url: coverUrl, bg_url: bgUrl, is_published: true })
    .eq('id', recordingId);

  if (error) {
    throw new Error(error.message ?? 'Failed to publish story');
  }
}
