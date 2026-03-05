import { IonIcon, IonModal, IonSpinner, IonToast } from '@ionic/react';
import {
  addOutline,
  cloudDoneOutline,
  cloudOfflineOutline,
  cloudUploadOutline,
  micOutline,
  refreshOutline,
  stopCircleOutline,
} from 'ionicons/icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  fetchRemoteStudioRecordings,
  formatRecordingDuration,
  formatRelativeTime,
  getStudioRecordingsForUser,
  getStudioSyncState,
  mergeStudioRecordings,
  retryFailedStudioSync,
  saveStudioRecordingDraft,
  STUDIO_CULTURAL_TAGS,
  syncPendingStudioRecordings,
  upsertStudioRecordingInList,
  type StudioRecording,
  type StudioRecordingType,
} from '../lib/elderStudio';
import { triggerHapticFeedback } from '../lib/feedback';
import { useAuthStore } from '../stores/authStore';

const RECORDING_TYPE_LABEL: Record<StudioRecordingType, string> = {
  word: 'Word',
  story: 'Story',
  song: 'Song',
};

type ToastState = {
  message: string;
  color: 'success' | 'danger' | 'warning' | 'medium';
};

const getMediaRecorderMimeType = (): string => {
  if (typeof MediaRecorder === 'undefined') {
    return 'audio/webm';
  }

  const candidates = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg;codecs=opus'];

  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? 'audio/webm';
};

const normalizeRecorderError = (error: unknown): string => {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError') {
      return 'Microphone access denied. Please allow microphone permission.';
    }
    if (error.name === 'NotFoundError') {
      return 'No microphone detected on this device.';
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Unable to start recording right now.';
};

const statusLabelBySyncStatus: Record<StudioRecording['syncStatus'], string> = {
  local_only: 'Local',
  syncing: 'Syncing',
  synced: 'Synced',
  sync_failed: 'Retry',
};

export function ElderStudioTab() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [recordings, setRecordings] = useState<StudioRecording[]>([]);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [recordingType, setRecordingType] = useState<StudioRecordingType>('story');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [translation, setTranslation] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedDuration, setRecordedDuration] = useState(0);
  const [draftBlob, setDraftBlob] = useState<Blob | null>(null);
  const [draftMimeType, setDraftMimeType] = useState('audio/webm');
  const [draftAudioUrl, setDraftAudioUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );
  const [toast, setToast] = useState<ToastState | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const elapsedTimerRef = useRef<number | null>(null);
  const isSyncingRef = useRef(false);

  const stopTimer = useCallback(() => {
    if (elapsedTimerRef.current !== null) {
      window.clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }
  }, []);

  const stopMediaStream = useCallback(() => {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  }, []);

  const discardActiveRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      return;
    }

    recorder.ondataavailable = null;
    recorder.onstop = () => {
      stopMediaStream();
    };
    recorder.stop();
  }, [stopMediaStream]);

  const setDraftAudioPreview = useCallback((blob: Blob) => {
    setDraftAudioUrl((previousUrl) => {
      if (previousUrl) {
        URL.revokeObjectURL(previousUrl);
      }
      return URL.createObjectURL(blob);
    });
  }, []);

  const resetComposerDraft = useCallback(() => {
    setTitle('');
    setDescription('');
    setTranslation('');
    setSelectedTags([]);
    setRecordingType('story');
    setRecordedDuration(0);
    setDraftBlob(null);
    setDraftMimeType('audio/webm');
    setDraftAudioUrl((previousUrl) => {
      if (previousUrl) {
        URL.revokeObjectURL(previousUrl);
      }
      return null;
    });
  }, []);

  const loadRecordings = useCallback(async () => {
    if (!user?.id) {
      setRecordings([]);
      return;
    }

    try {
      const localRecordings = await getStudioRecordingsForUser(user.id);
      let remoteRecordings: StudioRecording[] = [];

      try {
        remoteRecordings = await fetchRemoteStudioRecordings(user.id);
      } catch {
        // Remote fetch failure should not block local-first studio usage.
      }

      setRecordings(mergeStudioRecordings(localRecordings, remoteRecordings));
    } catch (error) {
      setToast({
        color: 'danger',
        message: normalizeRecorderError(error),
      });
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
          message: normalizeRecorderError(error),
        });
      } finally {
        setIsSyncing(false);
        isSyncingRef.current = false;
      }
    },
    [isOnline, loadRecordings, user?.id],
  );

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    void loadRecordings();
    void runSync();
  }, [loadRecordings, runSync, user?.id]);

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
      stopTimer();
      stopMediaStream();
      discardActiveRecording();
      setDraftAudioUrl((previousUrl) => {
        if (previousUrl) {
          URL.revokeObjectURL(previousUrl);
        }
        return null;
      });
    },
    [discardActiveRecording, stopMediaStream, stopTimer],
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

  const handleOpenComposer = () => {
    triggerHapticFeedback('light');
    resetComposerDraft();
    setIsComposerOpen(true);
  };

  const handleCloseComposer = () => {
    if (isRecording) {
      discardActiveRecording();
      stopTimer();
      setIsRecording(false);
    }
    resetComposerDraft();
    setIsComposerOpen(false);
  };

  const handleToggleTag = (tag: string) => {
    triggerHapticFeedback('light');
    setSelectedTags((previous) =>
      previous.includes(tag) ? previous.filter((item) => item !== tag) : [...previous, tag],
    );
  };

  const startRecording = useCallback(async () => {
    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setToast({
        color: 'danger',
        message: 'This device does not support in-app audio recording.',
      });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getMediaRecorderMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

      audioChunksRef.current = [];
      mediaRecorderRef.current = recorder;
      mediaStreamRef.current = stream;
      setDraftMimeType(mimeType || 'audio/webm');
      setRecordedDuration(0);
      setDraftBlob(null);
      setDraftAudioUrl((previousUrl) => {
        if (previousUrl) {
          URL.revokeObjectURL(previousUrl);
        }
        return null;
      });

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, {
          type: mimeType || 'audio/webm',
        });
        setDraftBlob(blob);
        setDraftAudioPreview(blob);
        setDraftMimeType(blob.type || mimeType || 'audio/webm');
        stopMediaStream();
      };

      recorder.start();
      triggerHapticFeedback('light');
      setIsRecording(true);
      elapsedTimerRef.current = window.setInterval(() => {
        setRecordedDuration((previous) => previous + 1);
      }, 1000);
    } catch (error) {
      setToast({
        color: 'danger',
        message: normalizeRecorderError(error),
      });
      triggerHapticFeedback('error');
    }
  }, [setDraftAudioPreview, stopMediaStream]);

  const stopRecording = useCallback(() => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
      return;
    }

    mediaRecorderRef.current.stop();
    stopTimer();
    setIsRecording(false);
    triggerHapticFeedback('light');
  }, [stopTimer]);

  const handleRecordingToggle = () => {
    if (isRecording) {
      stopRecording();
      return;
    }
    void startRecording();
  };

  const handleSaveRecording = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!user?.id) {
      setToast({
        color: 'danger',
        message: 'You need to be signed in to save recordings.',
      });
      return;
    }

    if (!draftBlob) {
      setToast({
        color: 'warning',
        message: 'Please record audio first before saving.',
      });
      triggerHapticFeedback('error');
      return;
    }

    if (!title.trim()) {
      setToast({
        color: 'warning',
        message: 'Please add a title for this recording.',
      });
      triggerHapticFeedback('error');
      return;
    }

    setIsSaving(true);
    triggerHapticFeedback('light');

    try {
      const createdRecording = await saveStudioRecordingDraft({
        uploaderId: user.id,
        title,
        description,
        translation,
        recordingType,
        topicTags: selectedTags,
        durationSeconds: recordedDuration,
        mimeType: draftMimeType || draftBlob.type || 'audio/webm',
        audioBlob: draftBlob,
      });

      setRecordings((current) => upsertStudioRecordingInList(current, createdRecording));
      setToast({
        color: 'success',
        message: 'Saved offline. Sync will run automatically when online.',
      });
      triggerHapticFeedback('success');
      handleCloseComposer();

      if (isOnline) {
        await runSync(true);
      }
    } catch (error) {
      setToast({
        color: 'danger',
        message: normalizeRecorderError(error),
      });
      triggerHapticFeedback('error');
    } finally {
      setIsSaving(false);
    }
  };

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
        message: normalizeRecorderError(error),
      });
    } finally {
      setIsSyncing(false);
      isSyncingRef.current = false;
    }
  };

  const handleOpenAllStories = () => {
    triggerHapticFeedback('light');
    navigate('/home/archive');
  };

  return (
    <section className="home-tab-content home-tab-content--studio">
      <div className="studio-shell">
        <header className="studio-heading-row">
          <h2>Studio</h2>
          <div className={`studio-sync-badge is-${syncBadge.tone}`}>
            {isSyncing ? (
              <IonSpinner name="crescent" />
            ) : (
              <IonIcon aria-hidden icon={syncBadge.icon} />
            )}
            <span>{syncBadge.label}</span>
          </div>
        </header>

        <button
          type="button"
          className="studio-record-card"
          onClick={handleOpenComposer}
          aria-label="Record new story"
        >
          <img
            src="/assets/studio/mic-illustration.png"
            alt=""
            className="studio-record-card-illustration"
          />
          <div className="studio-record-card-copy">
            <span>Record</span>
            <span>New Story</span>
          </div>
          <IonIcon aria-hidden icon={addOutline} className="studio-record-card-plus" />
        </button>

        <p className="studio-subcopy">
          Share your voice, preserve your wisdom for the next generation.
        </p>

        <section className="studio-recent-card" aria-label="My stories">
          <header className="studio-recent-header">
            <h3>My Stories</h3>
            <div className="studio-recent-actions">
              {recordings.length > 4 ? (
                <button type="button" className="studio-link-button" onClick={handleOpenAllStories}>
                  Archive
                </button>
              ) : null}
              <button
                type="button"
                className="studio-sync-button"
                onClick={handleRetrySync}
                disabled={!isOnline || isSyncing}
              >
                <IonIcon aria-hidden icon={refreshOutline} />
                <span>Sync now</span>
              </button>
            </div>
          </header>

          {recordings.length === 0 ? (
            <div className="studio-empty-state">
              <p>No stories yet.</p>
              <small>Tap the purple card to record your first story.</small>
            </div>
          ) : (
            <ul className="studio-recordings-list">
              {recordings.slice(0, 4).map((recording) => (
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
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <IonModal
        isOpen={isComposerOpen}
        onDidDismiss={handleCloseComposer}
        className="studio-composer-modal"
        breakpoints={[0, 0.9]}
        initialBreakpoint={0.9}
      >
        <div className="studio-composer-sheet">
          <header className="studio-composer-header">
            <h3>Record New Story</h3>
            <p>One-tap record, then save locally and sync when connected.</p>
          </header>

          <form className="studio-composer-form" onSubmit={handleSaveRecording}>
            <fieldset className="studio-type-fieldset">
              <legend>Recording Type</legend>
              <div className="studio-type-options">
                {(Object.keys(RECORDING_TYPE_LABEL) as StudioRecordingType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    className={`studio-type-option ${recordingType === type ? 'is-active' : ''}`}
                    onClick={() => {
                      triggerHapticFeedback('light');
                      setRecordingType(type);
                    }}
                  >
                    {RECORDING_TYPE_LABEL[type]}
                  </button>
                ))}
              </div>
            </fieldset>

            <label className="studio-form-field">
              <span>Title</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. Forest story from Tok Bala"
                maxLength={120}
                required
              />
            </label>

            <label className="studio-form-field">
              <span>Notes (Optional)</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Context, meaning, or who this story is for."
                rows={3}
                maxLength={280}
              />
            </label>

            <label className="studio-form-field">
              <span>Translation (Optional)</span>
              <input
                value={translation}
                onChange={(event) => setTranslation(event.target.value)}
                placeholder="Malay or English translation"
                maxLength={180}
              />
            </label>

            <fieldset className="studio-type-fieldset">
              <legend>Cultural Tags</legend>
              <div className="studio-tag-options">
                {STUDIO_CULTURAL_TAGS.map((tag) => {
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      className={`studio-tag-option ${isSelected ? 'is-active' : ''}`}
                      onClick={() => handleToggleTag(tag)}
                    >
                      {tag.replace('-', ' ')}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <section className="studio-recorder-panel">
              <button
                type="button"
                className={`studio-record-toggle ${isRecording ? 'is-recording' : ''}`}
                onClick={handleRecordingToggle}
              >
                <IonIcon icon={isRecording ? stopCircleOutline : micOutline} />
              </button>
              <div className="studio-recorder-copy">
                <p>{isRecording ? 'Recording in progress...' : 'Tap to start recording'}</p>
                <span>{formatRecordingDuration(recordedDuration)}</span>
              </div>
            </section>

            {draftAudioUrl && (
              <audio className="studio-audio-preview" controls src={draftAudioUrl} />
            )}

            <div className="studio-composer-actions">
              <button
                type="button"
                className="studio-action-button is-secondary"
                onClick={handleCloseComposer}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="studio-action-button is-primary"
                disabled={isSaving || !draftBlob}
              >
                {isSaving ? (
                  <>
                    <IonSpinner name="crescent" />
                    <span>Saving...</span>
                  </>
                ) : (
                  'Save Story'
                )}
              </button>
            </div>
          </form>
        </div>
      </IonModal>

      <IonToast
        isOpen={Boolean(toast)}
        message={toast?.message ?? ''}
        color={toast?.color}
        duration={3200}
        onDidDismiss={() => setToast(null)}
      />
    </section>
  );
}
