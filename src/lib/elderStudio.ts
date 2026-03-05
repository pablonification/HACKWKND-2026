import { Directory, Filesystem } from '@capacitor/filesystem';

import type { Database } from '../types/database';
import { getJSON, setJSON, STORAGE_KEYS } from './storage';
import { supabase } from './supabase';

const LOCAL_RECORDINGS_KEY = STORAGE_KEYS.RECORDINGS;
const PENDING_SYNC_KEY = STORAGE_KEYS.PENDING_SYNC;
const LOCAL_AUDIO_DIRECTORY = 'studio-recordings';
const AI_BASE_URL = (import.meta.env.VITE_AI_BASE_URL as string | undefined)?.replace(/\/$/, '');
const RECORDINGS_BUCKET = 'recordings';

export const STUDIO_CULTURAL_TAGS = [
  'forest',
  'hunting',
  'ceremony',
  'food',
  'kinship',
  'daily-life',
] as const;

export type StudioRecordingType = 'word' | 'story' | 'song';
export type StudioSyncStatus = 'local_only' | 'syncing' | 'synced' | 'sync_failed';

export type StudioRecording = {
  id: string;
  uploaderId: string;
  title: string;
  description: string | null;
  translation: string | null;
  transcription: string | null;
  recordingType: StudioRecordingType;
  topicTags: string[];
  durationSeconds: number;
  mimeType: string;
  localFilePath: string;
  storagePath: string | null;
  audioUrl: string | null;
  syncStatus: StudioSyncStatus;
  syncAttempts: number;
  lastSyncError: string | null;
  createdAt: string;
  updatedAt: string;
};

export type StudioRecordingDraftInput = {
  uploaderId: string;
  title: string;
  description?: string | null;
  translation?: string | null;
  transcription?: string | null;
  recordingType: StudioRecordingType;
  topicTags: string[];
  durationSeconds: number;
  mimeType: string;
  audioBlob: Blob;
};

export type StudioSyncResult = {
  synced: number;
  failed: number;
  pending: number;
};

export type StudioPlaybackSource = {
  url: string;
  isObjectUrl: boolean;
};

type RecordingInsert = Database['public']['Tables']['recordings']['Insert'];
type RecordingRow = Database['public']['Tables']['recordings']['Row'];

const AUDIO_EXTENSION_BY_MIME: Record<string, string> = {
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'audio/mpeg': 'mp3',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'audio/webm': 'webm',
};

export const formatRecordingDuration = (durationSeconds: number): string => {
  const totalSeconds = Math.max(0, Math.floor(durationSeconds));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export const formatRelativeTime = (isoDate: string): string => {
  const dateMs = Date.parse(isoDate);
  if (Number.isNaN(dateMs)) {
    return 'just now';
  }

  const diffSeconds = Math.max(1, Math.floor((Date.now() - dateMs) / 1000));
  if (diffSeconds < 60) {
    return `${diffSeconds}s ago`;
  }
  if (diffSeconds < 3600) {
    return `${Math.floor(diffSeconds / 60)}m ago`;
  }
  if (diffSeconds < 86400) {
    return `${Math.floor(diffSeconds / 3600)}h ago`;
  }
  if (diffSeconds < 604800) {
    return `${Math.floor(diffSeconds / 86400)}d ago`;
  }

  return new Date(dateMs).toLocaleDateString();
};

export const normalizeTopicTags = (
  recordingType: StudioRecordingType,
  topicTags: string[],
): string[] => {
  const baseTags = topicTags
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0)
    .map((tag) => tag.toLowerCase());
  return [...new Set([...baseTags, `type:${recordingType}`])];
};

export const upsertStudioRecordingInList = (
  recordings: StudioRecording[],
  nextRecording: StudioRecording,
): StudioRecording[] => {
  const withoutCurrent = recordings.filter((recording) => recording.id !== nextRecording.id);
  return [...withoutCurrent, nextRecording].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );
};

export const mergeStudioRecordings = (
  localRecordings: StudioRecording[],
  remoteRecordings: StudioRecording[],
): StudioRecording[] => {
  const byId = new Map<string, StudioRecording>();

  for (const remote of remoteRecordings) {
    byId.set(remote.id, remote);
  }

  for (const local of localRecordings) {
    const existing = byId.get(local.id);
    if (!existing || local.syncStatus !== 'synced') {
      byId.set(local.id, local);
    }
  }

  return [...byId.values()].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
};

const getAudioExtension = (mimeType: string): string => AUDIO_EXTENSION_BY_MIME[mimeType] ?? 'webm';

const stripDataUrlPrefix = (data: string): string => {
  const commaIndex = data.indexOf(',');
  return commaIndex >= 0 ? data.slice(commaIndex + 1) : data;
};

const base64ToUint8Array = (base64: string): Uint8Array => {
  const binary = atob(base64.replace(/\s/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

const blobToBase64 = async (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const value = reader.result;
      if (typeof value !== 'string') {
        reject(new Error('Failed to convert blob into base64 string.'));
        return;
      }
      resolve(stripDataUrlPrefix(value));
    };
    reader.onerror = () => reject(new Error('Unable to read audio blob.'));
    reader.readAsDataURL(blob);
  });

const readStudioRecordings = async (): Promise<StudioRecording[]> =>
  getJSON<StudioRecording[]>(LOCAL_RECORDINGS_KEY, []);

const writeStudioRecordings = async (recordings: StudioRecording[]): Promise<void> => {
  await setJSON(LOCAL_RECORDINGS_KEY, recordings);
};

const readPendingSyncQueue = async (): Promise<string[]> => getJSON<string[]>(PENDING_SYNC_KEY, []);

const writePendingSyncQueue = async (queue: string[]): Promise<void> => {
  await setJSON(PENDING_SYNC_KEY, queue);
};

const updateRecording = async (recording: StudioRecording): Promise<void> => {
  const allRecordings = await readStudioRecordings();
  const updatedRecordings = upsertStudioRecordingInList(allRecordings, recording);
  await writeStudioRecordings(updatedRecordings);
};

const enqueueForSync = async (recordingId: string): Promise<void> => {
  const queue = await readPendingSyncQueue();
  if (!queue.includes(recordingId)) {
    queue.push(recordingId);
    await writePendingSyncQueue(queue);
  }
};

const readLocalAudioBlob = async (recording: StudioRecording): Promise<Blob> => {
  const { data } = await Filesystem.readFile({
    path: recording.localFilePath,
    directory: Directory.Data,
  });

  if (typeof data !== 'string') {
    return data;
  }

  const bytes = base64ToUint8Array(stripDataUrlPrefix(data));
  return new Blob([bytes.buffer as ArrayBuffer], { type: recording.mimeType || 'audio/webm' });
};

const toRecordingInsertPayload = (
  recording: StudioRecording,
  storagePath: string,
  transcription: string | null,
): RecordingInsert => ({
  id: recording.id,
  uploader_id: recording.uploaderId,
  title: recording.title,
  description: recording.description,
  audio_url: storagePath,
  duration_seconds: Math.round(recording.durationSeconds),
  language_tag: 'semai',
  topic_tags: normalizeTopicTags(recording.recordingType, recording.topicTags),
  transcription,
  translation: recording.translation,
});

const extractRecordingType = (topicTags: string[] | null): StudioRecordingType => {
  const typeTag = topicTags?.find((tag) => tag.startsWith('type:'));
  if (!typeTag) {
    return 'story';
  }
  const value = typeTag.replace('type:', '').trim();
  if (value === 'word' || value === 'story' || value === 'song') {
    return value;
  }
  return 'story';
};

const sanitizeRemoteTopicTags = (topicTags: string[] | null): string[] =>
  (topicTags ?? []).filter((tag) => !tag.startsWith('type:'));

const normalizeStorageSourcePath = (source: string): string => {
  const trimmed = source.trim().replace(/^\/+/, '');
  if (!trimmed) {
    return '';
  }

  if (trimmed === RECORDINGS_BUCKET) {
    return '';
  }

  if (trimmed.startsWith(`${RECORDINGS_BUCKET}/`)) {
    return trimmed.slice(RECORDINGS_BUCKET.length + 1);
  }

  return trimmed;
};

const fromRemoteRow = (row: RecordingRow): StudioRecording => ({
  id: row.id,
  uploaderId: row.uploader_id,
  title: row.title,
  description: row.description,
  translation: row.translation,
  transcription: row.transcription,
  recordingType: extractRecordingType(row.topic_tags),
  topicTags: sanitizeRemoteTopicTags(row.topic_tags),
  durationSeconds: row.duration_seconds ? Number(row.duration_seconds) : 0,
  mimeType: 'audio/webm',
  localFilePath: '',
  storagePath: row.audio_url,
  audioUrl: row.audio_url,
  syncStatus: 'synced',
  syncAttempts: 0,
  lastSyncError: null,
  createdAt: row.created_at,
  updatedAt: row.updated_at ?? row.created_at,
});

const requestAiTranscription = async (
  audioUrl: string,
  options?: { strict?: boolean },
): Promise<string | null> => {
  const strict = options?.strict ?? false;
  if (!AI_BASE_URL) {
    if (strict) {
      throw new Error('VITE_AI_BASE_URL is not configured.');
    }
    return null;
  }

  let response: Response;
  try {
    response = await fetch(`${AI_BASE_URL}/ai/transcribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ audio_url: audioUrl }),
    });
  } catch (error) {
    if (strict) {
      const reason = error instanceof Error ? error.message : 'connection failed';
      throw new Error(
        `Cannot reach AI helper at ${AI_BASE_URL}. Start it with "npm run ai-helper:dev". (${reason})`,
      );
    }
    return null;
  }

  let payload: { transcription?: unknown; error?: unknown } | null = null;
  try {
    payload = (await response.json()) as { transcription?: unknown; error?: unknown };
  } catch {
    payload = null;
  }

  if (!response.ok) {
    if (strict) {
      const detail =
        payload && typeof payload.error === 'string' ? payload.error : response.statusText;
      throw new Error(`AI helper error (${response.status}): ${detail}`);
    }
    return null;
  }

  if (
    payload &&
    typeof payload.transcription === 'string' &&
    payload.transcription.trim().length > 0
  ) {
    return payload.transcription.trim();
  }

  if (strict) {
    throw new Error('ASR returned an empty transcription. Try a clearer recording and retry.');
  }

  return null;
};

const uploadRecordingToSupabase = async (
  recording: StudioRecording,
): Promise<{ storagePath: string; transcription: string | null }> => {
  const extension = getAudioExtension(recording.mimeType);
  const storagePath = `${recording.uploaderId}/${recording.id}.${extension}`;
  const audioBlob = await readLocalAudioBlob(recording);

  const { error: uploadError } = await supabase.storage
    .from('recordings')
    .upload(storagePath, audioBlob, {
      upsert: true,
      contentType: recording.mimeType,
    });

  if (uploadError) {
    throw new Error(`Storage upload failed: ${uploadError.message}`);
  }

  const aiTranscription = recording.transcription ?? (await requestAiTranscription(storagePath));
  const payload = toRecordingInsertPayload(recording, storagePath, aiTranscription);
  const { error: insertError } = await supabase
    .from('recordings')
    .upsert(payload, { onConflict: 'id' });

  if (insertError) {
    throw new Error(`Recordings upsert failed: ${insertError.message}`);
  }

  return {
    storagePath,
    transcription: aiTranscription,
  };
};

export const getStudioSyncState = (recordings: StudioRecording[], isOnline: boolean) => {
  if (!isOnline) {
    return 'offline' as const;
  }

  if (recordings.some((recording) => recording.syncStatus === 'sync_failed')) {
    return 'error' as const;
  }

  if (recordings.some((recording) => recording.syncStatus !== 'synced')) {
    return 'pending' as const;
  }

  return 'synced' as const;
};

export const getStudioRecordingsForUser = async (
  uploaderId: string,
): Promise<StudioRecording[]> => {
  const localRecordings = await readStudioRecordings();
  return localRecordings
    .filter((recording) => recording.uploaderId === uploaderId)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
};

export const fetchRemoteStudioRecordings = async (
  uploaderId: string,
): Promise<StudioRecording[]> => {
  const { data, error } = await supabase
    .from('recordings')
    .select('*')
    .eq('uploader_id', uploaderId)
    .order('created_at', { ascending: false })
    .limit(24);

  if (error) {
    throw error;
  }

  return ((data ?? []) as RecordingRow[]).map(fromRemoteRow);
};

export const saveStudioRecordingDraft = async (
  draft: StudioRecordingDraftInput,
): Promise<StudioRecording> => {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const extension = getAudioExtension(draft.mimeType);
  const localPath = `${LOCAL_AUDIO_DIRECTORY}/${id}.${extension}`;
  const audioBase64 = await blobToBase64(draft.audioBlob);

  await Filesystem.writeFile({
    path: localPath,
    data: audioBase64,
    directory: Directory.Data,
    recursive: true,
  });

  const recording: StudioRecording = {
    id,
    uploaderId: draft.uploaderId,
    title: draft.title.trim(),
    description: draft.description?.trim() || null,
    translation: draft.translation?.trim() || null,
    transcription: draft.transcription?.trim() || null,
    recordingType: draft.recordingType,
    topicTags: draft.topicTags,
    durationSeconds: draft.durationSeconds,
    mimeType: draft.mimeType,
    localFilePath: localPath,
    storagePath: null,
    audioUrl: null,
    syncStatus: 'local_only',
    syncAttempts: 0,
    lastSyncError: null,
    createdAt: now,
    updatedAt: now,
  };

  await updateRecording(recording);
  await enqueueForSync(recording.id);

  return recording;
};

export const syncPendingStudioRecordings = async (
  uploaderId: string,
): Promise<StudioSyncResult> => {
  const queue = await readPendingSyncQueue();
  if (queue.length === 0) {
    return { synced: 0, failed: 0, pending: 0 };
  }

  let recordings = await readStudioRecordings();
  const nextQueue: string[] = [];
  let synced = 0;
  let failed = 0;

  for (const recordingId of queue) {
    const recording = recordings.find((item) => item.id === recordingId);
    if (!recording) {
      continue;
    }

    if (recording.uploaderId !== uploaderId) {
      nextQueue.push(recordingId);
      continue;
    }

    if (recording.syncStatus === 'synced') {
      continue;
    }

    const syncingRecording: StudioRecording = {
      ...recording,
      syncStatus: 'syncing',
      updatedAt: new Date().toISOString(),
    };

    recordings = upsertStudioRecordingInList(recordings, syncingRecording);
    await writeStudioRecordings(recordings);

    try {
      const { storagePath, transcription } = await uploadRecordingToSupabase(syncingRecording);
      const syncedRecording: StudioRecording = {
        ...syncingRecording,
        storagePath,
        audioUrl: storagePath,
        transcription: transcription ?? syncingRecording.transcription,
        syncStatus: 'synced',
        syncAttempts: syncingRecording.syncAttempts + 1,
        lastSyncError: null,
        updatedAt: new Date().toISOString(),
      };
      recordings = upsertStudioRecordingInList(recordings, syncedRecording);
      synced += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sync failed';
      const failedRecording: StudioRecording = {
        ...syncingRecording,
        syncStatus: 'sync_failed',
        syncAttempts: syncingRecording.syncAttempts + 1,
        lastSyncError: message,
        updatedAt: new Date().toISOString(),
      };
      recordings = upsertStudioRecordingInList(recordings, failedRecording);
      failed += 1;
      nextQueue.push(recordingId);
    }

    await writeStudioRecordings(recordings);
  }

  await writePendingSyncQueue(nextQueue);

  return {
    synced,
    failed,
    pending: nextQueue.length,
  };
};

export const retryFailedStudioSync = async (uploaderId: string): Promise<StudioSyncResult> => {
  const recordings = await getStudioRecordingsForUser(uploaderId);
  const failedRecordingIds = recordings
    .filter((recording) => recording.syncStatus === 'sync_failed')
    .map((recording) => recording.id);

  if (failedRecordingIds.length > 0) {
    const queue = await readPendingSyncQueue();
    const mergedQueue = [...new Set([...queue, ...failedRecordingIds])];
    await writePendingSyncQueue(mergedQueue);
  }

  return syncPendingStudioRecordings(uploaderId);
};

export const retryStudioRecordingTranscription = async (
  recording: StudioRecording,
): Promise<StudioRecording> => {
  const audioSource = recording.storagePath ?? recording.audioUrl;
  if (!audioSource) {
    throw new Error('Recording must be synced before transcription can run.');
  }

  const transcription = await requestAiTranscription(audioSource, { strict: true });
  if (!transcription) {
    throw new Error('AI transcription failed. Check AI helper service and retry.');
  }

  const updatedAt = new Date().toISOString();
  const { error } = await supabase
    .from('recordings')
    .update({
      transcription,
      updated_at: updatedAt,
    })
    .eq('id', recording.id)
    .eq('uploader_id', recording.uploaderId);

  if (error) {
    throw new Error(`Recordings transcription update failed: ${error.message}`);
  }

  const updatedRecording: StudioRecording = {
    ...recording,
    transcription,
    lastSyncError: null,
    updatedAt,
  };

  await updateRecording(updatedRecording);
  return updatedRecording;
};

export const resolveStudioRecordingPlaybackSource = async (
  recording: StudioRecording,
): Promise<StudioPlaybackSource> => {
  const remoteSource = (recording.storagePath ?? recording.audioUrl ?? '').trim();

  if (remoteSource) {
    try {
      const parsed = new URL(remoteSource);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return { url: remoteSource, isObjectUrl: false };
      }
    } catch {
      const path = normalizeStorageSourcePath(remoteSource);
      if (path) {
        const { data, error } = await supabase.storage
          .from(RECORDINGS_BUCKET)
          .createSignedUrl(path, 600);

        if (!error && data?.signedUrl) {
          return { url: data.signedUrl, isObjectUrl: false };
        }
      }
    }
  }

  if (recording.localFilePath) {
    const blob = await readLocalAudioBlob(recording);
    return { url: URL.createObjectURL(blob), isObjectUrl: true };
  }

  throw new Error('Audio playback source is unavailable for this recording.');
};
