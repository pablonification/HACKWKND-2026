import { Directory, Filesystem } from '@capacitor/filesystem';

import type { Database } from '../types/database';
import { normalizeSemaiKey } from './semaiText';
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

export type StudioTranscriptionCandidate = {
  language: string;
  transcription: string;
  score: number;
  scoreBreakdown: Record<string, number> | null;
};

export type StudioTranscriptionMatch = {
  id: string | null;
  source: string;
  semai: string;
  score: number;
  matchType: 'exact' | 'fuzzy';
  headword: string | null;
  applied: boolean;
};

export type StudioWordReplacement = {
  from: string;
  to: string;
  confidence: number;
  source: string;
};

export type StudioRecording = {
  id: string;
  uploaderId: string;
  title: string;
  description: string | null;
  translation: string | null;
  transcription: string | null;
  rawTranscription: string | null;
  autoTranscription: string | null;
  verifiedTranscription: string | null;
  transcriptionCandidates: StudioTranscriptionCandidate[];
  transcriptionMatch: StudioTranscriptionMatch | null;
  transcriptionWordReplacements: StudioWordReplacement[];
  transcriptionLanguage: string | null;
  autoTranslationMs: string | null;
  verifiedTranslationMs: string | null;
  isVerified: boolean;
  verifiedAt: string | null;
  verifiedBy: string | null;
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

export type PaginationResult<T> = {
  items: T[];
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
};

export type StudioPlaybackSource = {
  url: string;
  isObjectUrl: boolean;
};

export type StudioReviewDraftInput = {
  verifiedTranscription: string;
  verifiedTranslationMs: string | null;
};

export type StudioAiDraft = {
  rawTranscription: string | null;
  autoTranscription: string | null;
  language: string | null;
  candidates: StudioTranscriptionCandidate[];
  transcriptionMatch: StudioTranscriptionMatch | null;
  transcriptionWordReplacements: StudioWordReplacement[];
  requestedLanguages: string[];
  lexiconSource: string | null;
};

type RecordingInsert = Database['public']['Tables']['recordings']['Insert'];
type RecordingRow = Database['public']['Tables']['recordings']['Row'];

const AUDIO_EXTENSION_BY_MIME: Record<string, string> = {
  'audio/mp4': 'm4a',
  'audio/mp4a-latm': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/aac': 'aac',
  'audio/mpeg': 'mp3',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/webm': 'webm',
};

const AUDIO_MIME_BY_EXTENSION: Record<string, string> = {
  aac: 'audio/aac',
  m4a: 'audio/mp4',
  mp3: 'audio/mpeg',
  mp4: 'audio/mp4',
  ogg: 'audio/ogg',
  wav: 'audio/wav',
  wave: 'audio/wav',
  webm: 'audio/webm',
};

export const STUDIO_AUDIO_FILE_ACCEPT =
  '.aac,.m4a,.mp3,.mp4,.ogg,.wav,.wave,.webm,audio/aac,audio/mp4,audio/x-m4a,audio/mpeg,audio/ogg,audio/wav,audio/x-wav,audio/webm';

export const getStudioImportedAudioTitle = (fileName: string): string => {
  const baseName = fileName.split(/[\\/]/).pop() ?? '';
  const withoutExtension = baseName.replace(/\.[^.]+$/, '');
  const normalized = withoutExtension.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return normalized || 'Imported audio';
};

export const normalizeStudioImportedAudioMimeType = (
  mimeType: string,
  fileName: string,
): string => {
  const normalizedMimeType = mimeType.trim().toLowerCase();

  if (normalizedMimeType in AUDIO_EXTENSION_BY_MIME) {
    return normalizedMimeType;
  }

  const extension = fileName.split('.').pop()?.trim().toLowerCase() ?? '';
  return AUDIO_MIME_BY_EXTENSION[extension] ?? (normalizedMimeType || 'audio/webm');
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

export const resolveStudioRecordingTranscription = (recording: StudioRecording): string | null =>
  recording.verifiedTranscription ??
  recording.autoTranscription ??
  recording.rawTranscription ??
  recording.transcription;

export const resolveStudioRecordingTranslation = (recording: StudioRecording): string | null =>
  recording.verifiedTranslationMs ?? recording.autoTranslationMs ?? recording.translation;

export const getStudioReviewDraftTranscription = (recording: StudioRecording): string =>
  recording.verifiedTranscription ??
  recording.autoTranscription ??
  recording.rawTranscription ??
  recording.transcription ??
  '';

export const getStudioReviewDraftMalayTranslation = (recording: StudioRecording): string =>
  recording.verifiedTranslationMs ?? recording.autoTranslationMs ?? recording.translation ?? '';

export const doesStudioRecordingNeedReview = (recording: StudioRecording): boolean =>
  recording.syncStatus === 'synced' && !recording.isVerified;

export const countPendingStudioReview = (recordings: StudioRecording[]): number =>
  recordings.filter(doesStudioRecordingNeedReview).length;

export const canVerifyStudioRecording = (recording: StudioRecording): boolean => {
  const transcript = getStudioReviewDraftTranscription(recording).trim();
  return transcript.length > 0;
};

export const paginateStudioItems = <T>(
  items: T[],
  page: number,
  pageSize: number,
): PaginationResult<T> => {
  const safePageSize = Math.max(1, Math.floor(pageSize));
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize));
  const currentPage = Math.min(Math.max(1, Math.floor(page)), totalPages);
  const startIndex = (currentPage - 1) * safePageSize;

  return {
    items: items.slice(startIndex, startIndex + safePageSize),
    currentPage,
    totalPages,
    totalItems,
    pageSize: safePageSize,
  };
};

const parseCandidate = (value: unknown): StudioTranscriptionCandidate | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const language = Reflect.get(value, 'language');
  const transcription = Reflect.get(value, 'transcription');
  const score = Reflect.get(value, 'score');
  const scoreBreakdown = Reflect.get(value, 'scoreBreakdown');

  if (typeof language !== 'string' || typeof transcription !== 'string') {
    return null;
  }

  return {
    language,
    transcription,
    score: typeof score === 'number' ? score : 0,
    scoreBreakdown:
      scoreBreakdown && typeof scoreBreakdown === 'object'
        ? (scoreBreakdown as Record<string, number>)
        : null,
  };
};

const isStudioCandidate = (
  candidate: StudioTranscriptionCandidate | null,
): candidate is StudioTranscriptionCandidate => Boolean(candidate);

const parseTranscriptionMatch = (value: unknown): StudioTranscriptionMatch | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const semai = Reflect.get(value, 'semai');
  const source = Reflect.get(value, 'source');
  const score = Reflect.get(value, 'score');
  const matchType = Reflect.get(value, 'match_type') ?? Reflect.get(value, 'matchType');
  const headword = Reflect.get(value, 'headword');
  const id = Reflect.get(value, 'id');
  const applied = Reflect.get(value, 'applied');

  if (typeof semai !== 'string' || typeof source !== 'string') {
    return null;
  }

  if (matchType !== 'exact' && matchType !== 'fuzzy') {
    return null;
  }

  return {
    id: typeof id === 'string' ? id : null,
    source,
    semai,
    score: typeof score === 'number' ? score : 0,
    matchType,
    headword: typeof headword === 'string' ? headword : null,
    applied: applied === true,
  };
};

const parseWordReplacement = (value: unknown): StudioWordReplacement | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const from = Reflect.get(value, 'from');
  const to = Reflect.get(value, 'to');
  const confidence = Reflect.get(value, 'confidence');
  const source = Reflect.get(value, 'source');

  if (typeof from !== 'string' || typeof to !== 'string' || typeof source !== 'string') {
    return null;
  }

  return {
    from,
    to,
    confidence: typeof confidence === 'number' ? confidence : 0,
    source,
  };
};

const isStudioWordReplacement = (
  replacement: StudioWordReplacement | null,
): replacement is StudioWordReplacement => Boolean(replacement);

const coerceStudioRecording = (recording: Partial<StudioRecording>): StudioRecording => ({
  id: recording.id ?? crypto.randomUUID(),
  uploaderId: recording.uploaderId ?? '',
  title: recording.title ?? 'Untitled recording',
  description: recording.description ?? null,
  translation: recording.translation ?? null,
  transcription: recording.transcription ?? null,
  rawTranscription: recording.rawTranscription ?? null,
  autoTranscription: recording.autoTranscription ?? null,
  verifiedTranscription: recording.verifiedTranscription ?? null,
  transcriptionCandidates: Array.isArray(recording.transcriptionCandidates)
    ? recording.transcriptionCandidates.map(parseCandidate).filter(isStudioCandidate)
    : [],
  transcriptionMatch: parseTranscriptionMatch(recording.transcriptionMatch) ?? null,
  transcriptionWordReplacements: Array.isArray(recording.transcriptionWordReplacements)
    ? recording.transcriptionWordReplacements
        .map(parseWordReplacement)
        .filter(isStudioWordReplacement)
    : [],
  transcriptionLanguage: recording.transcriptionLanguage ?? null,
  autoTranslationMs: recording.autoTranslationMs ?? null,
  verifiedTranslationMs: recording.verifiedTranslationMs ?? null,
  isVerified: Boolean(recording.isVerified),
  verifiedAt: recording.verifiedAt ?? null,
  verifiedBy: recording.verifiedBy ?? null,
  recordingType: recording.recordingType ?? 'story',
  topicTags: recording.topicTags ?? [],
  durationSeconds: recording.durationSeconds ?? 0,
  mimeType: recording.mimeType ?? 'audio/webm',
  localFilePath: recording.localFilePath ?? '',
  storagePath: recording.storagePath ?? null,
  audioUrl: recording.audioUrl ?? null,
  syncStatus: recording.syncStatus ?? 'local_only',
  syncAttempts: recording.syncAttempts ?? 0,
  lastSyncError: recording.lastSyncError ?? null,
  createdAt: recording.createdAt ?? new Date().toISOString(),
  updatedAt: recording.updatedAt ?? recording.createdAt ?? new Date().toISOString(),
});

export const upsertStudioRecordingInList = (
  recordings: StudioRecording[],
  nextRecording: StudioRecording,
): StudioRecording[] => {
  const normalizedRecording = coerceStudioRecording(nextRecording);
  const withoutCurrent = recordings.filter((recording) => recording.id !== normalizedRecording.id);
  return [...withoutCurrent, normalizedRecording].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );
};

export const removeStudioRecordingFromList = (
  recordings: StudioRecording[],
  recordingId: string,
): StudioRecording[] => recordings.filter((recording) => recording.id !== recordingId);

export const mergeStudioRecordings = (
  localRecordings: StudioRecording[],
  remoteRecordings: StudioRecording[],
): StudioRecording[] => {
  const byId = new Map<string, StudioRecording>();

  for (const remote of remoteRecordings.map(coerceStudioRecording)) {
    byId.set(remote.id, remote);
  }

  for (const local of localRecordings.map(coerceStudioRecording)) {
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

const clampSample = (value: number): number => {
  if (value > 1) {
    return 1;
  }
  if (value < -1) {
    return -1;
  }
  return value;
};

const encodeWaveFile = (samples: Float32Array, sampleRate: number): Blob => {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeString = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  for (let index = 0; index < samples.length; index += 1) {
    const sample = clampSample(samples[index] ?? 0);
    view.setInt16(44 + index * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
};

const trimSilence = (samples: Float32Array, threshold: number): Float32Array => {
  let start = 0;
  let end = samples.length - 1;

  while (start < samples.length && Math.abs(samples[start] ?? 0) < threshold) {
    start += 1;
  }

  while (end > start && Math.abs(samples[end] ?? 0) < threshold) {
    end -= 1;
  }

  return samples.slice(start, end + 1);
};

export const preprocessStudioAudioBlob = async (
  blob: Blob,
): Promise<{ blob: Blob; mimeType: string }> => {
  if (typeof window === 'undefined' || typeof window.AudioContext === 'undefined') {
    return { blob, mimeType: blob.type || 'audio/webm' };
  }

  const context = new window.AudioContext();

  try {
    const arrayBuffer = await blob.arrayBuffer();
    const decoded = await context.decodeAudioData(arrayBuffer.slice(0));
    const monoSamples = new Float32Array(decoded.length);

    for (let channel = 0; channel < decoded.numberOfChannels; channel += 1) {
      const channelData = decoded.getChannelData(channel);
      for (let index = 0; index < channelData.length; index += 1) {
        monoSamples[index] += channelData[index] / decoded.numberOfChannels;
      }
    }

    let peak = 0;
    for (let index = 0; index < monoSamples.length; index += 1) {
      peak = Math.max(peak, Math.abs(monoSamples[index] ?? 0));
    }

    const normalizedSamples = peak > 0 ? monoSamples.map((sample) => sample / peak) : monoSamples;
    const trimmedSamples = trimSilence(normalizedSamples, 0.015);

    if (trimmedSamples.length === 0) {
      return { blob, mimeType: blob.type || 'audio/webm' };
    }

    const wavBlob = encodeWaveFile(trimmedSamples, decoded.sampleRate);
    return {
      blob: wavBlob,
      mimeType: 'audio/wav',
    };
  } catch {
    return { blob, mimeType: blob.type || 'audio/webm' };
  } finally {
    await context.close();
  }
};

const readStudioRecordings = async (): Promise<StudioRecording[]> => {
  const stored = await getJSON<Partial<StudioRecording>[]>(LOCAL_RECORDINGS_KEY, []);
  return stored.map(coerceStudioRecording);
};

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

const deleteLocalAudioFile = async (localFilePath: string): Promise<void> => {
  if (!localFilePath) {
    return;
  }

  try {
    await Filesystem.deleteFile({
      path: localFilePath,
      directory: Directory.Data,
    });
  } catch {
    // Missing local files should not block record deletion.
  }
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

const toRemoteCandidatePayload = (candidates: StudioTranscriptionCandidate[]): unknown[] =>
  candidates.map((candidate) => ({
    language: candidate.language,
    transcription: candidate.transcription,
    score: candidate.score,
    scoreBreakdown: candidate.scoreBreakdown,
  }));

const toRemoteTranscriptionMatchPayload = (
  match: StudioTranscriptionMatch | null,
): Record<string, unknown> | null =>
  match
    ? {
        id: match.id,
        source: match.source,
        semai: match.semai,
        score: match.score,
        match_type: match.matchType,
        headword: match.headword,
        applied: match.applied,
      }
    : null;

const toRemoteWordReplacementPayload = (
  replacements: StudioWordReplacement[],
): Record<string, unknown>[] =>
  replacements.map((replacement) => ({
    from: replacement.from,
    to: replacement.to,
    confidence: replacement.confidence,
    source: replacement.source,
  }));

const buildResolvedTranscriptValue = (
  recording: StudioRecording,
  aiDraft?: StudioAiDraft | null,
): string | null =>
  recording.verifiedTranscription ??
  aiDraft?.autoTranscription ??
  aiDraft?.rawTranscription ??
  recording.autoTranscription ??
  recording.rawTranscription ??
  recording.transcription;

const buildResolvedTranslationValue = (
  recording: StudioRecording,
  autoTranslationMs: string | null,
): string | null =>
  recording.verifiedTranslationMs ??
  autoTranslationMs ??
  recording.autoTranslationMs ??
  recording.translation;

const buildTranscriptMirrorValue = (
  recording: StudioRecording,
  nextVerifiedTranscription: string | null,
): string | null =>
  nextVerifiedTranscription ??
  recording.autoTranscription ??
  recording.rawTranscription ??
  (recording.verifiedTranscription ? null : recording.transcription);

const buildTranslationMirrorValue = (
  recording: StudioRecording,
  nextVerifiedTranslationMs: string | null,
): string | null =>
  nextVerifiedTranslationMs ??
  recording.autoTranslationMs ??
  (recording.verifiedTranslationMs ? null : recording.translation);

const toRecordingInsertPayload = (
  recording: StudioRecording,
  storagePath: string,
  aiDraft: StudioAiDraft | null,
  autoTranslationMs: string | null,
): RecordingInsert => ({
  id: recording.id,
  uploader_id: recording.uploaderId,
  title: recording.title,
  description: recording.description,
  audio_url: storagePath,
  duration_seconds: Math.round(recording.durationSeconds),
  language_tag: 'semai',
  topic_tags: normalizeTopicTags(recording.recordingType, recording.topicTags),
  transcription: buildResolvedTranscriptValue(recording, aiDraft),
  translation: buildResolvedTranslationValue(recording, autoTranslationMs),
  raw_transcription: aiDraft?.rawTranscription ?? recording.rawTranscription,
  auto_transcription: aiDraft?.autoTranscription ?? recording.autoTranscription,
  verified_transcription: recording.verifiedTranscription,
  transcription_candidates: aiDraft
    ? toRemoteCandidatePayload(aiDraft.candidates)
    : recording.transcriptionCandidates,
  transcription_match: aiDraft
    ? toRemoteTranscriptionMatchPayload(aiDraft.transcriptionMatch)
    : toRemoteTranscriptionMatchPayload(recording.transcriptionMatch),
  transcription_word_replacements: aiDraft
    ? toRemoteWordReplacementPayload(aiDraft.transcriptionWordReplacements)
    : toRemoteWordReplacementPayload(recording.transcriptionWordReplacements),
  transcription_language: aiDraft?.language ?? recording.transcriptionLanguage,
  auto_translation_ms: autoTranslationMs ?? recording.autoTranslationMs,
  verified_translation_ms: recording.verifiedTranslationMs,
  is_verified: recording.isVerified,
  verified_at: recording.verifiedAt,
  verified_by: recording.verifiedBy,
});

const fromRemoteRow = (row: RecordingRow): StudioRecording =>
  coerceStudioRecording({
    id: row.id,
    uploaderId: row.uploader_id,
    title: row.title,
    description: row.description,
    translation: row.translation,
    transcription: row.transcription,
    rawTranscription: row.raw_transcription,
    autoTranscription: row.auto_transcription,
    verifiedTranscription: row.verified_transcription,
    transcriptionCandidates: Array.isArray(row.transcription_candidates)
      ? row.transcription_candidates.map(parseCandidate).filter(isStudioCandidate)
      : [],
    transcriptionMatch: parseTranscriptionMatch(row.transcription_match),
    transcriptionWordReplacements: Array.isArray(row.transcription_word_replacements)
      ? row.transcription_word_replacements
          .map(parseWordReplacement)
          .filter(isStudioWordReplacement)
      : [],
    transcriptionLanguage: row.transcription_language,
    autoTranslationMs: row.auto_translation_ms,
    verifiedTranslationMs: row.verified_translation_ms,
    isVerified: row.is_verified,
    verifiedAt: row.verified_at,
    verifiedBy: row.verified_by,
    recordingType: extractRecordingType(row.topic_tags),
    topicTags: sanitizeRemoteTopicTags(row.topic_tags),
    durationSeconds: row.duration_seconds ? Number(row.duration_seconds) : 0,
    mimeType: 'audio/wav',
    localFilePath: '',
    storagePath: row.audio_url,
    audioUrl: row.audio_url,
    syncStatus: 'synced',
    syncAttempts: 0,
    lastSyncError: null,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at,
  });

const parseAiDraft = (payload: Record<string, unknown> | null): StudioAiDraft | null => {
  if (!payload) {
    return null;
  }

  const autoTranscription = payload.auto_transcription ?? payload.transcription;
  const rawTranscription = payload.raw_transcription;
  const language = payload.language;
  const requestedLanguages = payload.requested_languages ?? payload.requestedLanguages;
  const lexiconSource = payload.lexicon_source ?? payload.lexiconSource;
  const candidates = Array.isArray(payload.candidates)
    ? payload.candidates.map(parseCandidate).filter(isStudioCandidate)
    : [];
  const transcriptionMatch = parseTranscriptionMatch(
    payload.transcription_match ?? payload.transcriptionMatch,
  );
  const replacementPayload =
    payload.transcription_word_replacements ?? payload.transcriptionWordReplacements;
  const transcriptionWordReplacements = Array.isArray(replacementPayload)
    ? replacementPayload.map(parseWordReplacement).filter(isStudioWordReplacement)
    : [];

  if (typeof autoTranscription !== 'string' && typeof rawTranscription !== 'string') {
    return null;
  }

  return {
    rawTranscription:
      typeof rawTranscription === 'string' && rawTranscription.trim().length > 0
        ? rawTranscription.trim()
        : null,
    autoTranscription:
      typeof autoTranscription === 'string' && autoTranscription.trim().length > 0
        ? autoTranscription.trim()
        : null,
    language: typeof language === 'string' ? language : null,
    candidates,
    transcriptionMatch,
    transcriptionWordReplacements,
    requestedLanguages: Array.isArray(requestedLanguages)
      ? requestedLanguages.filter((value): value is string => typeof value === 'string')
      : [],
    lexiconSource: typeof lexiconSource === 'string' ? lexiconSource : null,
  };
};

const requestAiTranscription = async (
  audioUrl: string,
  options?: { strict?: boolean; recordingType?: StudioRecordingType },
): Promise<StudioAiDraft | null> => {
  const strict = options?.strict ?? false;
  if (!AI_BASE_URL) {
    if (strict) {
      throw new Error('VITE_AI_BASE_URL is not configured.');
    }
    return null;
  }

  let response: Response;
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token ?? '';
    response = await fetch(`${AI_BASE_URL}/ai/transcribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({
        audio_url: audioUrl,
        recording_type: options?.recordingType ?? 'story',
      }),
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

  let payload: Record<string, unknown> | null = null;
  try {
    payload = (await response.json()) as Record<string, unknown>;
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

  const draft = parseAiDraft(payload);
  if (draft) {
    return draft;
  }

  if (strict) {
    throw new Error('ASR returned an empty transcription. Try a clearer recording and retry.');
  }

  return null;
};

const buildRecordingWithDraftUpdate = (
  recording: StudioRecording,
  aiDraft: StudioAiDraft | null,
): StudioRecording =>
  coerceStudioRecording({
    ...recording,
    transcription: buildResolvedTranscriptValue(recording, aiDraft),
    translation: buildResolvedTranslationValue(recording, null),
    rawTranscription: aiDraft?.rawTranscription ?? recording.rawTranscription,
    autoTranscription: aiDraft?.autoTranscription ?? recording.autoTranscription,
    transcriptionCandidates: aiDraft?.candidates ?? recording.transcriptionCandidates,
    transcriptionMatch: aiDraft?.transcriptionMatch ?? recording.transcriptionMatch,
    transcriptionWordReplacements:
      aiDraft?.transcriptionWordReplacements ?? recording.transcriptionWordReplacements,
    transcriptionLanguage: aiDraft?.language ?? recording.transcriptionLanguage,
  });

const uploadRecordingToSupabase = async (
  recording: StudioRecording,
): Promise<{
  storagePath: string;
  aiDraft: StudioAiDraft | null;
}> => {
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

  const aiDraft = await requestAiTranscription(storagePath, {
    recordingType: recording.recordingType,
  });
  const payload = toRecordingInsertPayload(recording, storagePath, aiDraft, null);
  const { error: insertError } = await supabase
    .from('recordings')
    .upsert(payload, { onConflict: 'id' });

  if (insertError) {
    throw new Error(`Recordings upsert failed: ${insertError.message}`);
  }

  return {
    storagePath,
    aiDraft,
  };
};

const syncVerifiedWordToWords = async (recording: StudioRecording): Promise<void> => {
  if (recording.recordingType !== 'word') {
    return;
  }

  const verifiedTranscription = recording.verifiedTranscription?.trim() ?? '';
  const verifiedTranslationMs = recording.verifiedTranslationMs?.trim() ?? '';
  if (!verifiedTranscription || !verifiedTranslationMs) {
    return;
  }

  const semaiKey = normalizeSemaiKey(verifiedTranscription);
  if (!semaiKey) {
    return;
  }

  const { data, error } = await supabase
    .from('words')
    .select('id')
    .eq('semai_key', semaiKey)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Words lookup failed: ${error.message}`);
  }

  if (data?.id) {
    return;
  }

  const normalizedTopicTags = normalizeTopicTags(recording.recordingType, recording.topicTags);
  const category =
    recording.topicTags.find((tag) => tag.trim().length > 0) ?? recording.recordingType;

  const { error: insertError } = await supabase.from('words').insert({
    semai: verifiedTranscription,
    semai_word: verifiedTranscription,
    semai_key: semaiKey,
    meaning_ms: verifiedTranslationMs,
    malay_translation: verifiedTranslationMs,
    meaning_en: null,
    english_translation: null,
    pronunciation_url: recording.audioUrl ?? recording.storagePath,
    topic_tags: normalizedTopicTags,
    category,
    elder_id: recording.uploaderId,
    created_by: recording.uploaderId,
  });

  if (insertError) {
    throw new Error(`Words insert failed: ${insertError.message}`);
  }
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
    .order('created_at', { ascending: false });

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
  const manualTranslation = draft.translation?.trim() || null;

  await Filesystem.writeFile({
    path: localPath,
    data: audioBase64,
    directory: Directory.Data,
    recursive: true,
  });

  const recording = coerceStudioRecording({
    id,
    uploaderId: draft.uploaderId,
    title: draft.title.trim(),
    description: draft.description?.trim() || null,
    translation: manualTranslation,
    transcription: draft.transcription?.trim() || null,
    rawTranscription: null,
    autoTranscription: null,
    verifiedTranscription: null,
    transcriptionCandidates: [],
    transcriptionMatch: null,
    transcriptionWordReplacements: [],
    transcriptionLanguage: null,
    autoTranslationMs: null,
    verifiedTranslationMs: manualTranslation,
    isVerified: false,
    verifiedAt: null,
    verifiedBy: null,
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
  });

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

    const syncingRecording = coerceStudioRecording({
      ...recording,
      syncStatus: 'syncing',
      updatedAt: new Date().toISOString(),
    });

    recordings = upsertStudioRecordingInList(recordings, syncingRecording);
    await writeStudioRecordings(recordings);

    try {
      const { storagePath, aiDraft } = await uploadRecordingToSupabase(syncingRecording);
      const syncedRecording = coerceStudioRecording({
        ...buildRecordingWithDraftUpdate(syncingRecording, aiDraft),
        storagePath,
        audioUrl: storagePath,
        syncStatus: 'synced',
        syncAttempts: syncingRecording.syncAttempts + 1,
        lastSyncError: null,
        updatedAt: new Date().toISOString(),
      });
      recordings = upsertStudioRecordingInList(recordings, syncedRecording);
      synced += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sync failed';
      const failedRecording = coerceStudioRecording({
        ...syncingRecording,
        syncStatus: 'sync_failed',
        syncAttempts: syncingRecording.syncAttempts + 1,
        lastSyncError: message,
        updatedAt: new Date().toISOString(),
      });
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

  const aiDraft = await requestAiTranscription(audioSource, {
    strict: true,
    recordingType: recording.recordingType,
  });
  if (!aiDraft?.autoTranscription && !aiDraft?.rawTranscription) {
    throw new Error('AI transcription failed. Check AI helper service and retry.');
  }

  const updatedAt = new Date().toISOString();
  const updatedRecording = coerceStudioRecording({
    ...buildRecordingWithDraftUpdate(recording, aiDraft),
    updatedAt,
  });

  const { data: rows, error } = await supabase
    .from('recordings')
    .update({
      transcription: resolveStudioRecordingTranscription(updatedRecording),
      translation: resolveStudioRecordingTranslation(updatedRecording),
      raw_transcription: updatedRecording.rawTranscription,
      auto_transcription: updatedRecording.autoTranscription,
      transcription_candidates: toRemoteCandidatePayload(updatedRecording.transcriptionCandidates),
      transcription_match: toRemoteTranscriptionMatchPayload(updatedRecording.transcriptionMatch),
      transcription_word_replacements: toRemoteWordReplacementPayload(
        updatedRecording.transcriptionWordReplacements,
      ),
      transcription_language: updatedRecording.transcriptionLanguage,
      updated_at: updatedAt,
    })
    .eq('id', recording.id)
    .eq('uploader_id', recording.uploaderId)
    .select('id');

  if (error) {
    throw new Error(`Recordings transcription update failed: ${error.message}`);
  }

  if (!rows || rows.length === 0) {
    throw new Error('Recordings transcription update failed: no rows were updated.');
  }

  await updateRecording(updatedRecording);
  return updatedRecording;
};

export const saveStudioRecordingReviewDraft = async (
  recording: StudioRecording,
  draft: StudioReviewDraftInput,
): Promise<StudioRecording> => {
  const updatedAt = new Date().toISOString();
  const nextVerifiedTranscription = draft.verifiedTranscription.trim() || null;
  const nextVerifiedTranslationMs = draft.verifiedTranslationMs?.trim() || null;
  const updatedRecording = coerceStudioRecording({
    ...recording,
    verifiedTranscription: nextVerifiedTranscription,
    verifiedTranslationMs: nextVerifiedTranslationMs,
    transcription: buildTranscriptMirrorValue(recording, nextVerifiedTranscription),
    translation: buildTranslationMirrorValue(recording, nextVerifiedTranslationMs),
    updatedAt,
  });

  const { data: rows, error } = await supabase
    .from('recordings')
    .update({
      verified_transcription: nextVerifiedTranscription,
      verified_translation_ms: nextVerifiedTranslationMs,
      transcription: updatedRecording.transcription,
      translation: updatedRecording.translation,
      updated_at: updatedAt,
    })
    .eq('id', recording.id)
    .eq('uploader_id', recording.uploaderId)
    .select('id');

  if (error) {
    throw new Error(`Recordings review draft update failed: ${error.message}`);
  }

  if (!rows || rows.length === 0) {
    throw new Error('Recordings review draft update failed: no rows were updated.');
  }

  if (updatedRecording.isVerified) {
    await syncVerifiedWordToWords(updatedRecording);
  }

  await updateRecording(updatedRecording);
  return updatedRecording;
};

export const approveStudioRecordingReview = async (
  recording: StudioRecording,
  draft: StudioReviewDraftInput,
  reviewerId: string,
): Promise<StudioRecording> => {
  const verifiedTranscription = draft.verifiedTranscription.trim();
  const verifiedTranslationMs = draft.verifiedTranslationMs?.trim() || null;

  if (!verifiedTranscription) {
    throw new Error('Transcript is required before verification.');
  }

  const updatedAt = new Date().toISOString();
  const verifiedAt = new Date().toISOString();
  const updatedRecording = coerceStudioRecording({
    ...recording,
    transcription: verifiedTranscription,
    translation: buildTranslationMirrorValue(recording, verifiedTranslationMs),
    verifiedTranscription,
    verifiedTranslationMs,
    isVerified: true,
    verifiedAt,
    verifiedBy: reviewerId,
    updatedAt,
  });

  const { data: rows, error } = await supabase
    .from('recordings')
    .update({
      transcription: verifiedTranscription,
      translation: resolveStudioRecordingTranslation(updatedRecording),
      verified_transcription: verifiedTranscription,
      verified_translation_ms: verifiedTranslationMs,
      is_verified: true,
      verified_at: verifiedAt,
      verified_by: reviewerId,
      updated_at: updatedAt,
    })
    .eq('id', recording.id)
    .eq('uploader_id', recording.uploaderId)
    .select('id');

  if (error) {
    throw new Error(`Recordings verification failed: ${error.message}`);
  }

  if (!rows || rows.length === 0) {
    throw new Error(
      'Recordings verification failed: no rows were updated. You may not have permission to verify this recording.',
    );
  }

  await syncVerifiedWordToWords(updatedRecording);
  await updateRecording(updatedRecording);
  return updatedRecording;
};

export const deleteStudioRecording = async (recording: StudioRecording): Promise<void> => {
  const remoteSource = normalizeStorageSourcePath(
    recording.storagePath ?? recording.audioUrl ?? '',
  );
  const shouldDeleteRemote =
    recording.syncStatus !== 'local_only' ||
    Boolean(recording.storagePath) ||
    Boolean(recording.audioUrl);

  if (shouldDeleteRemote) {
    const { error: deleteError } = await supabase
      .from('recordings')
      .delete()
      .eq('id', recording.id)
      .eq('uploader_id', recording.uploaderId);

    if (deleteError) {
      throw new Error(`Recordings delete failed: ${deleteError.message}`);
    }

    if (remoteSource) {
      await supabase.storage.from(RECORDINGS_BUCKET).remove([remoteSource]);
    }
  }

  await deleteLocalAudioFile(recording.localFilePath);

  const [allRecordings, pendingQueue] = await Promise.all([
    readStudioRecordings(),
    readPendingSyncQueue(),
  ]);

  await Promise.all([
    writeStudioRecordings(removeStudioRecordingFromList(allRecordings, recording.id)),
    writePendingSyncQueue(pendingQueue.filter((queuedId) => queuedId !== recording.id)),
  ]);
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
