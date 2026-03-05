import { IonIcon, IonSpinner, IonToast } from '@ionic/react';
import {
  cloudDoneOutline,
  cloudOfflineOutline,
  cloudUploadOutline,
  pauseOutline,
  playOutline,
  refreshOutline,
} from 'ionicons/icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  fetchRemoteStudioRecordings,
  formatRecordingDuration,
  formatRelativeTime,
  getStudioRecordingsForUser,
  getStudioSyncState,
  mergeStudioRecordings,
  resolveStudioRecordingPlaybackSource,
  retryStudioRecordingTranscription,
  retryFailedStudioSync,
  syncPendingStudioRecordings,
  upsertStudioRecordingInList,
  type StudioRecording,
  type StudioRecordingType,
} from '../lib/elderStudio';
import { triggerHapticFeedback } from '../lib/feedback';
import { useAuthStore } from '../stores/authStore';

type ToastState = {
  message: string;
  color: 'success' | 'danger' | 'warning' | 'medium';
};

const RECORDING_TYPE_LABEL: Record<StudioRecordingType, string> = {
  word: 'Word',
  story: 'Story',
  song: 'Song',
};

const statusLabelBySyncStatus: Record<StudioRecording['syncStatus'], string> = {
  local_only: 'Local',
  syncing: 'Syncing',
  synced: 'Synced',
  sync_failed: 'Retry',
};

const normalizeErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return 'Unable to load recordings right now.';
};

const toPreviewText = (value: string, maxLength = 140): string => {
  const clean = value.trim();
  if (clean.length <= maxLength) {
    return clean;
  }
  return `${clean.slice(0, maxLength - 1)}…`;
};

export function SoundArchiveTab() {
  const aiBaseUrl = import.meta.env.VITE_AI_BASE_URL as string | undefined;
  const isAiHelperConfigured = Boolean(aiBaseUrl && aiBaseUrl.trim().length > 0);
  const { user } = useAuthStore();
  const [recordings, setRecordings] = useState<StudioRecording[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [transcribingRecordingId, setTranscribingRecordingId] = useState<string | null>(null);
  const [playingRecordingId, setPlayingRecordingId] = useState<string | null>(null);
  const [loadingPlaybackRecordingId, setLoadingPlaybackRecordingId] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );
  const [toast, setToast] = useState<ToastState | null>(null);
  const isSyncingRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playbackSourceCacheRef = useRef<Map<string, string>>(new Map());
  const objectUrlsRef = useRef<Set<string>>(new Set());

  const loadRecordings = useCallback(async () => {
    if (!user?.id) {
      setRecordings([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const localRecordings = await getStudioRecordingsForUser(user.id);
      let remoteRecordings: StudioRecording[] = [];

      try {
        remoteRecordings = await fetchRemoteStudioRecordings(user.id);
      } catch {
        // Keep local archive usable even when remote read fails.
      }

      setRecordings(mergeStudioRecordings(localRecordings, remoteRecordings));
    } catch (error) {
      setToast({
        color: 'danger',
        message: normalizeErrorMessage(error),
      });
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  const runSync = useCallback(
    async (announce = false) => {
      if (!user?.id || !isOnline || isSyncingRef.current) {
        return;
      }

      isSyncingRef.current = true;
      setIsSyncing(true);
      try {
        const result = await syncPendingStudioRecordings(user.id);
        await loadRecordings();

        if (announce) {
          if (result.synced > 0) {
            setToast({
              color: 'success',
              message: `Synced ${result.synced} recording${result.synced > 1 ? 's' : ''}.`,
            });
          } else if (result.pending > 0 || result.failed > 0) {
            setToast({
              color: 'warning',
              message: 'Some recordings are still waiting to sync.',
            });
          }
        }
      } catch (error) {
        setToast({
          color: 'danger',
          message: normalizeErrorMessage(error),
        });
      } finally {
        setIsSyncing(false);
        isSyncingRef.current = false;
      }
    },
    [isOnline, loadRecordings, user?.id],
  );

  useEffect(() => {
    void loadRecordings();
  }, [loadRecordings]);

  useEffect(() => {
    void runSync();
  }, [runSync]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      void runSync(true);
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [runSync]);

  useEffect(
    () => () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }

      for (const objectUrl of objectUrlsRef.current) {
        URL.revokeObjectURL(objectUrl);
      }
      objectUrlsRef.current.clear();
      playbackSourceCacheRef.current.clear();
    },
    [],
  );

  const syncState = useMemo(() => {
    if (isSyncing) {
      return 'syncing' as const;
    }
    return getStudioSyncState(recordings, isOnline);
  }, [isOnline, isSyncing, recordings]);

  const syncBadge = useMemo(() => {
    if (syncState === 'syncing') {
      return { icon: cloudUploadOutline, label: 'Syncing', tone: 'pending' };
    }
    if (syncState === 'offline') {
      return { icon: cloudOfflineOutline, label: 'Offline', tone: 'offline' };
    }
    if (syncState === 'error') {
      return { icon: cloudUploadOutline, label: 'Needs Retry', tone: 'error' };
    }
    if (syncState === 'pending') {
      return { icon: cloudUploadOutline, label: 'Pending Sync', tone: 'pending' };
    }
    return { icon: cloudDoneOutline, label: 'Synced', tone: 'success' };
  }, [syncState]);

  const handleRetrySync = async () => {
    if (!user?.id || isSyncing) {
      return;
    }

    triggerHapticFeedback('light');
    setIsSyncing(true);
    isSyncingRef.current = true;

    try {
      const result = await retryFailedStudioSync(user.id);
      await loadRecordings();
      if (result.synced > 0) {
        setToast({
          color: 'success',
          message: `Retried successfully. ${result.synced} recording${result.synced > 1 ? 's' : ''} synced.`,
        });
      } else {
        setToast({
          color: 'warning',
          message: 'No recording synced yet. Keep your connection active and retry.',
        });
      }
    } catch (error) {
      setToast({
        color: 'danger',
        message: normalizeErrorMessage(error),
      });
    } finally {
      setIsSyncing(false);
      isSyncingRef.current = false;
    }
  };

  const handleRetryTranscription = async (recording: StudioRecording) => {
    if (transcribingRecordingId) {
      return;
    }

    triggerHapticFeedback('light');
    setTranscribingRecordingId(recording.id);
    try {
      const updatedRecording = await retryStudioRecordingTranscription(recording);
      setRecordings((current) => upsertStudioRecordingInList(current, updatedRecording));
      setToast({
        color: 'success',
        message: 'Transcription updated.',
      });
    } catch (error) {
      setToast({
        color: 'danger',
        message: normalizeErrorMessage(error),
      });
    } finally {
      setTranscribingRecordingId(null);
    }
  };

  const handleTogglePlayback = async (recording: StudioRecording) => {
    triggerHapticFeedback('light');

    if (!audioRef.current) {
      const audio = new Audio();
      audio.preload = 'none';
      audio.addEventListener('ended', () => {
        setPlayingRecordingId(null);
      });
      audioRef.current = audio;
    }

    const audio = audioRef.current;
    if (playingRecordingId === recording.id && !audio.paused) {
      audio.pause();
      setPlayingRecordingId(null);
      return;
    }

    setLoadingPlaybackRecordingId(recording.id);
    try {
      let sourceUrl = playbackSourceCacheRef.current.get(recording.id);
      if (!sourceUrl) {
        const source = await resolveStudioRecordingPlaybackSource(recording);
        sourceUrl = source.url;
        playbackSourceCacheRef.current.set(recording.id, source.url);
        if (source.isObjectUrl) {
          objectUrlsRef.current.add(source.url);
        }
      }

      if (audio.src !== sourceUrl) {
        audio.src = sourceUrl;
      }
      await audio.play();
      setPlayingRecordingId(recording.id);
    } catch (error) {
      setPlayingRecordingId(null);
      setToast({
        color: 'danger',
        message: normalizeErrorMessage(error),
      });
    } finally {
      setLoadingPlaybackRecordingId(null);
    }
  };

  return (
    <section className="home-tab-content home-tab-content--studio">
      <div className="studio-shell studio-shell--archive">
        <header className="studio-heading-row">
          <h2>Sound Archive</h2>
          <div className={`studio-sync-badge is-${syncBadge.tone}`}>
            {isSyncing ? (
              <IonSpinner name="crescent" />
            ) : (
              <IonIcon aria-hidden icon={syncBadge.icon} />
            )}
            <span>{syncBadge.label}</span>
          </div>
        </header>
        <p className="studio-subcopy">
          Browse all synced recordings from Elder Studio. Latest uploads appear here automatically.
        </p>
        {!isAiHelperConfigured ? (
          <p className="studio-subcopy studio-subcopy--warning">
            AI Helper base URL is not configured, so automatic transcription is disabled.
          </p>
        ) : null}

        <section
          className="studio-recent-card studio-recent-card--full"
          aria-label="Sound archive recordings"
        >
          <header className="studio-recent-header">
            <h3>Recordings ({recordings.length})</h3>
            <button
              type="button"
              className="studio-sync-button"
              onClick={handleRetrySync}
              disabled={!isOnline || isSyncing}
            >
              <IonIcon aria-hidden icon={refreshOutline} />
              <span>Sync now</span>
            </button>
          </header>

          {isLoading ? (
            <div className="studio-loading-state">
              <IonSpinner name="crescent" />
            </div>
          ) : recordings.length === 0 ? (
            <div className="studio-empty-state">
              <p>No recordings yet.</p>
              <small>Open Elder Studio and save your first recording.</small>
            </div>
          ) : (
            <ul className="studio-recordings-list studio-recordings-list--full">
              {recordings.map((recording) => (
                <li key={recording.id} className="studio-recording-item">
                  <header className="studio-recording-header">
                    <div className="studio-recording-main">
                      <p className="studio-recording-title">{recording.title}</p>
                      <p className="studio-recording-meta">
                        {RECORDING_TYPE_LABEL[recording.recordingType]} •{' '}
                        {formatRecordingDuration(recording.durationSeconds)} •{' '}
                        {formatRelativeTime(recording.createdAt)}
                      </p>
                    </div>
                    <span
                      className={`studio-recording-status is-${recording.syncStatus.replace('_', '-')}`}
                    >
                      {statusLabelBySyncStatus[recording.syncStatus]}
                    </span>
                  </header>

                  {recording.transcription ? (
                    <p className="studio-recording-transcript">
                      <strong>Transcript:</strong> {toPreviewText(recording.transcription)}
                    </p>
                  ) : null}
                  {recording.translation ? (
                    <p className="studio-recording-translation">
                      <strong>Translation:</strong> {toPreviewText(recording.translation)}
                    </p>
                  ) : null}
                  {!recording.transcription && recording.syncStatus === 'synced' ? (
                    <p className="studio-recording-note">No AI transcript yet.</p>
                  ) : null}
                  {recording.lastSyncError ? (
                    <p className="studio-recording-error">{recording.lastSyncError}</p>
                  ) : null}

                  {recording.syncStatus === 'synced' ||
                  Boolean(recording.localFilePath) ||
                  Boolean(recording.storagePath) ||
                  Boolean(recording.audioUrl) ? (
                    <footer className="studio-recording-footer">
                      <button
                        type="button"
                        className="studio-recording-action-button"
                        onClick={() => void handleTogglePlayback(recording)}
                        disabled={Boolean(loadingPlaybackRecordingId)}
                      >
                        {loadingPlaybackRecordingId === recording.id ? (
                          'Loading...'
                        ) : (
                          <>
                            <IonIcon
                              aria-hidden
                              icon={
                                playingRecordingId === recording.id ? pauseOutline : playOutline
                              }
                            />
                            <span>{playingRecordingId === recording.id ? 'Pause' : 'Play'}</span>
                          </>
                        )}
                      </button>

                      {recording.syncStatus === 'synced' &&
                      (recording.storagePath || recording.audioUrl) ? (
                        <button
                          type="button"
                          className="studio-recording-action-button"
                          onClick={() => void handleRetryTranscription(recording)}
                          disabled={Boolean(transcribingRecordingId)}
                        >
                          {transcribingRecordingId === recording.id
                            ? 'Working...'
                            : recording.transcription
                              ? 'Re-run ASR'
                              : 'Transcribe'}
                        </button>
                      ) : null}
                    </footer>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <IonToast
        isOpen={Boolean(toast)}
        message={toast?.message ?? ''}
        duration={3200}
        color={toast?.color ?? 'medium'}
        onDidDismiss={() => setToast(null)}
      />
    </section>
  );
}
