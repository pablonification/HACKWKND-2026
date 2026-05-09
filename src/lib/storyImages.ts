import { supabase } from './supabase';

const getAiBaseUrl = () =>
  ((import.meta.env.VITE_AI_BASE_URL as string | undefined) ?? 'http://localhost:8787').replace(
    /\/$/,
    '',
  );

async function callGenerateImage(
  recordingId: string,
  title: string,
  description: string,
  type: 'cover' | 'bg',
): Promise<{ coverUrl?: string; bgUrl?: string }> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const response = await fetch(`${getAiBaseUrl()}/ai/generate-image`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: JSON.stringify({ recordingId, title, description, type }),
  });

  if (!response.ok) {
    const json = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(json.error ?? `Image generation failed (${response.status})`);
  }

  return response.json() as Promise<{ coverUrl?: string; bgUrl?: string }>;
}

export async function generateStoryCover(
  recordingId: string,
  title: string,
  description: string,
): Promise<string> {
  const result = await callGenerateImage(recordingId, title, description, 'cover');
  if (!result.coverUrl) {
    throw new Error('Cover generation returned no URL');
  }
  return result.coverUrl;
}

export async function generateStoryBg(
  recordingId: string,
  title: string,
  description: string,
): Promise<string> {
  const result = await callGenerateImage(recordingId, title, description, 'bg');
  if (!result.bgUrl) {
    throw new Error('Background generation returned no URL');
  }
  return result.bgUrl;
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
