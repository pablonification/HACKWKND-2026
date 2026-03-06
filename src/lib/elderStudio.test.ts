import { describe, expect, it } from 'vitest';

import {
  canVerifyStudioRecording,
  countPendingStudioReview,
  doesStudioRecordingNeedReview,
  formatRecordingDuration,
  getStudioImportedAudioTitle,
  getStudioReviewDraftMalayTranslation,
  getStudioReviewDraftTranscription,
  mergeStudioRecordings,
  normalizeStudioImportedAudioMimeType,
  normalizeTopicTags,
  paginateStudioItems,
  removeStudioRecordingFromList,
  resolveStudioRecordingTranscription,
  resolveStudioRecordingTranslation,
  upsertStudioRecordingInList,
  type StudioRecording,
} from './elderStudio';

const createRecording = (overrides: Partial<StudioRecording> = {}): StudioRecording => ({
  id: overrides.id ?? 'rec-1',
  uploaderId: overrides.uploaderId ?? 'user-1',
  title: overrides.title ?? 'Test Recording',
  description: overrides.description ?? null,
  translation: overrides.translation ?? null,
  transcription: overrides.transcription ?? null,
  rawTranscription: overrides.rawTranscription ?? null,
  autoTranscription: overrides.autoTranscription ?? null,
  verifiedTranscription: overrides.verifiedTranscription ?? null,
  transcriptionCandidates: overrides.transcriptionCandidates ?? [],
  transcriptionMatch: overrides.transcriptionMatch ?? null,
  transcriptionWordReplacements: overrides.transcriptionWordReplacements ?? [],
  transcriptionLanguage: overrides.transcriptionLanguage ?? null,
  autoTranslationMs: overrides.autoTranslationMs ?? null,
  verifiedTranslationMs: overrides.verifiedTranslationMs ?? null,
  isVerified: overrides.isVerified ?? false,
  verifiedAt: overrides.verifiedAt ?? null,
  verifiedBy: overrides.verifiedBy ?? null,
  recordingType: overrides.recordingType ?? 'story',
  topicTags: overrides.topicTags ?? ['forest'],
  durationSeconds: overrides.durationSeconds ?? 12,
  mimeType: overrides.mimeType ?? 'audio/webm',
  localFilePath: overrides.localFilePath ?? 'studio-recordings/rec-1.webm',
  storagePath: overrides.storagePath ?? null,
  audioUrl: overrides.audioUrl ?? null,
  syncStatus: overrides.syncStatus ?? 'local_only',
  syncAttempts: overrides.syncAttempts ?? 0,
  lastSyncError: overrides.lastSyncError ?? null,
  createdAt: overrides.createdAt ?? '2026-03-05T10:00:00.000Z',
  updatedAt: overrides.updatedAt ?? '2026-03-05T10:00:00.000Z',
});

describe('elderStudio helpers', () => {
  it('normalizes tags and appends recording type marker', () => {
    expect(normalizeTopicTags('story', [' Forest ', 'forest', 'Ceremony'])).toEqual([
      'forest',
      'ceremony',
      'type:story',
    ]);
  });

  it('upserts recording and keeps list sorted by created_at descending', () => {
    const older = createRecording({
      id: 'older',
      createdAt: '2026-03-05T08:00:00.000Z',
      title: 'Older',
    });
    const newest = createRecording({
      id: 'newest',
      createdAt: '2026-03-05T11:00:00.000Z',
      title: 'Newest',
    });

    const result = upsertStudioRecordingInList([older], newest);

    expect(result.map((item) => item.id)).toEqual(['newest', 'older']);
  });

  it('removes a deleted recording from the local list', () => {
    const first = createRecording({ id: 'first' });
    const second = createRecording({ id: 'second' });

    expect(removeStudioRecordingFromList([first, second], 'first').map((item) => item.id)).toEqual([
      'second',
    ]);
  });

  it('prefers local unsynced entries when merging with remote list', () => {
    const remote = createRecording({
      id: 'shared',
      title: 'Remote Title',
      syncStatus: 'synced',
      storagePath: 'user-1/shared.webm',
    });
    const localUnsynced = createRecording({
      id: 'shared',
      title: 'Local Draft Title',
      syncStatus: 'sync_failed',
    });

    const merged = mergeStudioRecordings([localUnsynced], [remote]);

    expect(merged).toHaveLength(1);
    expect(merged[0]?.title).toBe('Local Draft Title');
    expect(merged[0]?.syncStatus).toBe('sync_failed');
  });

  it('formats recording duration in mm:ss format', () => {
    expect(formatRecordingDuration(0)).toBe('0:00');
    expect(formatRecordingDuration(7)).toBe('0:07');
    expect(formatRecordingDuration(89)).toBe('1:29');
  });

  it('derives clean draft titles and imported mime types from audio files', () => {
    expect(getStudioImportedAudioTitle('folder/abah_story-final.m4a')).toBe('abah story final');
    expect(getStudioImportedAudioTitle('   ')).toBe('Imported audio');

    expect(normalizeStudioImportedAudioMimeType('', 'bobolian.m4a')).toBe('audio/mp4');
    expect(normalizeStudioImportedAudioMimeType('audio/x-wav', 'bobolian.wav')).toBe('audio/x-wav');
    expect(normalizeStudioImportedAudioMimeType('', 'unknown.bin')).toBe('audio/webm');
  });

  it('prefers verified and auto draft values when resolving review content', () => {
    const recording = createRecording({
      transcription: 'legacy transcript',
      rawTranscription: 'raw transcript',
      autoTranscription: 'auto transcript',
      verifiedTranscription: 'verified transcript',
      translation: 'legacy translation',
      autoTranslationMs: 'auto ms',
      verifiedTranslationMs: 'verified ms',
    });

    expect(resolveStudioRecordingTranscription(recording)).toBe('verified transcript');
    expect(resolveStudioRecordingTranslation(recording)).toBe('verified ms');
    expect(getStudioReviewDraftTranscription(recording)).toBe('verified transcript');
    expect(getStudioReviewDraftMalayTranslation(recording)).toBe('verified ms');
  });

  it('tracks pending review and verification gating', () => {
    const story = createRecording({
      syncStatus: 'synced',
      autoTranscription: 'cerita',
    });
    const word = createRecording({
      id: 'word-1',
      syncStatus: 'synced',
      recordingType: 'word',
      autoTranscription: 'abah',
      verifiedTranslationMs: null,
    });

    expect(doesStudioRecordingNeedReview(story)).toBe(true);
    expect(countPendingStudioReview([story, word])).toBe(2);
    expect(canVerifyStudioRecording(story)).toBe(true);
    expect(canVerifyStudioRecording(word)).toBe(true);
  });

  it('paginates recordings safely and clamps out-of-range pages', () => {
    const recordings = Array.from({ length: 7 }, (_, index) =>
      createRecording({ id: `rec-${index + 1}` }),
    );

    const pageOne = paginateStudioItems(recordings, 1, 3);
    const pageThree = paginateStudioItems(recordings, 99, 3);

    expect(pageOne.items).toHaveLength(3);
    expect(pageOne.totalPages).toBe(3);
    expect(pageOne.currentPage).toBe(1);
    expect(pageThree.items).toHaveLength(1);
    expect(pageThree.currentPage).toBe(3);
  });
});
