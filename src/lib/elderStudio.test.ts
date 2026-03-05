import { describe, expect, it } from 'vitest';

import {
  formatRecordingDuration,
  mergeStudioRecordings,
  normalizeTopicTags,
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
});
