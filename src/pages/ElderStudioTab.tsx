import { IonIcon, IonSpinner, IonToast } from '@ionic/react';
import {
  addOutline,
  arrowBackOutline,
  arrowForwardOutline,
  attachOutline,
  checkmarkOutline,
  cloudDoneOutline,
  cloudOfflineOutline,
  cloudUploadOutline,
  closeOutline,
  micOutline,
  pauseOutline,
  playOutline,
  refreshOutline,
  stopCircleOutline,
} from 'ionicons/icons';
import {
  type ChangeEvent,
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import {
  countPendingStudioReview,
  doesStudioRecordingNeedReview,
  fetchRemoteStudioRecordings,
  formatRecordingDuration,
  formatRelativeTime,
  getStudioImportedAudioTitle,
  getStudioRecordingsForUser,
  getStudioSyncState,
  mergeStudioRecordings,
  normalizeStudioImportedAudioMimeType,
  preprocessStudioAudioBlob,
  retryFailedStudioSync,
  saveStudioRecordingDraft,
  STUDIO_AUDIO_FILE_ACCEPT,
  STUDIO_CULTURAL_TAGS,
  syncPendingStudioRecordings,
  upsertStudioRecordingInList,
  type StudioRecording,
  type StudioRecordingType,
} from '../lib/elderStudio';
import { triggerHapticFeedback } from '../lib/feedback';
import { isExploreEntry } from '../lib/navigationEntry';
import {
  buildStudioWaveformBarsFromChannels,
  buildStudioWaveformBarsFromLevels,
  DEFAULT_STUDIO_WAVEFORM_BARS,
} from '../lib/studioWaveform';
import { useEdgeSwipeBack } from '../lib/useEdgeSwipeBack';
import { useAuthStore } from '../stores/authStore';
import micIllustration from '../../assets/studio/mic-illustration.png';
import archiveBook from '../../assets/studio/archive-book.png';
import recorderHero from '../../assets/studio/recorder-hero.png';

const RECORDING_TYPE_LABEL: Record<StudioRecordingType, string> = {
  word: 'Word',
  story: 'Story',
  song: 'Song',
};

type ToastState = {
  message: string;
  color: 'success' | 'danger' | 'warning' | 'medium';
};

type DraftAudioSource = 'recorded' | 'attached';
type StudioFlowStep = 'capture' | 'details';
type WindowWithWebkitAudioContext = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

const PREVIEW_RECORDING_LIMIT = 3;

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

const readAudioDurationSeconds = async (blob: Blob): Promise<number> => {
  if (typeof document === 'undefined') {
    return 0;
  }

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob);
    const audio = document.createElement('audio');

    const cleanup = () => {
      audio.pause();
      audio.removeAttribute('src');
      URL.revokeObjectURL(objectUrl);
    };

    const handleLoadedMetadata = () => {
      const duration = Number.isFinite(audio.duration)
        ? Math.max(1, Math.round(audio.duration))
        : 0;
      cleanup();
      resolve(duration);
    };

    const handleError = () => {
      cleanup();
      reject(new Error('Unable to read the selected audio file.'));
    };

    audio.preload = 'metadata';
    audio.addEventListener('loadedmetadata', handleLoadedMetadata, { once: true });
    audio.addEventListener('error', handleError, { once: true });
    audio.src = objectUrl;
    audio.load();
  });
};

const statusLabelBySyncStatus: Record<StudioRecording['syncStatus'], string> = {
  local_only: 'Local',
  syncing: 'Syncing',
  synced: 'Synced',
  sync_failed: 'Retry',
};

const formatStudioRecorderClock = (seconds: number): string => {
  const safeSeconds = Math.max(0, seconds);
  const hours = Math.floor(safeSeconds / 3600)
    .toString()
    .padStart(2, '0');
  const minutes = Math.floor((safeSeconds % 3600) / 60)
    .toString()
    .padStart(2, '0');
  const remainingSeconds = Math.floor(safeSeconds % 60)
    .toString()
    .padStart(2, '0');

  return `${hours}.${minutes}.${remainingSeconds}`;
};

const formatDraftSize = (blob: Blob | null): string => {
  if (!blob) {
    return '0 MB';
  }

  const megabytes = blob.size / (1024 * 1024);
  if (megabytes >= 10) {
    return `${megabytes.toFixed(1)} MB`;
  }
  return `${megabytes.toFixed(2)} MB`;
};

export function ElderStudioTab() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuthStore();
  const fromExplore = isExploreEntry(searchParams);
  const [recordings, setRecordings] = useState<StudioRecording[]>([]);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [flowStep, setFlowStep] = useState<StudioFlowStep>('capture');
  const [recordingType, setRecordingType] = useState<StudioRecordingType>('story');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [translation, setTranslation] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isDraftPreviewPlaying, setIsDraftPreviewPlaying] = useState(false);
  const [recordedDuration, setRecordedDuration] = useState(0);
  const [draftBlob, setDraftBlob] = useState<Blob | null>(null);
  const [draftMimeType, setDraftMimeType] = useState('audio/webm');
  const [draftAudioUrl, setDraftAudioUrl] = useState<string | null>(null);
  const [draftSource, setDraftSource] = useState<DraftAudioSource | null>(null);
  const [draftFileName, setDraftFileName] = useState<string | null>(null);
  const [waveformBars, setWaveformBars] = useState<number[]>(() => [
    ...DEFAULT_STUDIO_WAVEFORM_BARS,
  ]);
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const draftPreviewAudioRef = useRef<HTMLAudioElement | null>(null);
  const liveWaveformFrameRef = useRef<number | null>(null);
  const liveWaveformAudioContextRef = useRef<AudioContext | null>(null);

  const resetWaveformBars = useCallback(() => {
    setWaveformBars([...DEFAULT_STUDIO_WAVEFORM_BARS]);
  }, []);

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

  const stopLiveWaveformSampling = useCallback(() => {
    if (liveWaveformFrameRef.current !== null) {
      window.cancelAnimationFrame(liveWaveformFrameRef.current);
      liveWaveformFrameRef.current = null;
    }

    const audioContext = liveWaveformAudioContextRef.current;
    liveWaveformAudioContextRef.current = null;
    if (audioContext && audioContext.state !== 'closed') {
      void audioContext.close().catch(() => undefined);
    }
  }, []);

  const deriveWaveformBarsFromBlob = useCallback(async (blob: Blob): Promise<number[]> => {
    if (typeof window === 'undefined' || blob.size === 0) {
      return [...DEFAULT_STUDIO_WAVEFORM_BARS];
    }

    const AudioContextConstructor =
      window.AudioContext ?? (window as WindowWithWebkitAudioContext).webkitAudioContext;
    if (!AudioContextConstructor) {
      return [...DEFAULT_STUDIO_WAVEFORM_BARS];
    }

    const audioContext = new AudioContextConstructor();

    try {
      const arrayBuffer = await blob.arrayBuffer();
      const decodedAudio = await audioContext.decodeAudioData(arrayBuffer.slice(0));
      const channels = Array.from({ length: decodedAudio.numberOfChannels }, (_, index) =>
        decodedAudio.getChannelData(index),
      );

      return buildStudioWaveformBarsFromChannels(channels, decodedAudio.length);
    } catch {
      return [...DEFAULT_STUDIO_WAVEFORM_BARS];
    } finally {
      if (audioContext.state !== 'closed') {
        await audioContext.close().catch(() => undefined);
      }
    }
  }, []);

  const startLiveWaveformSampling = useCallback(
    async (stream: MediaStream) => {
      if (typeof window === 'undefined') {
        return;
      }

      const AudioContextConstructor =
        window.AudioContext ?? (window as WindowWithWebkitAudioContext).webkitAudioContext;
      if (!AudioContextConstructor) {
        resetWaveformBars();
        return;
      }

      stopLiveWaveformSampling();

      const audioContext = new AudioContextConstructor();
      liveWaveformAudioContextRef.current = audioContext;

      try {
        await audioContext.resume();
      } catch {
        // Resume failures should not block recording.
      }

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.76;

      const sourceNode = audioContext.createMediaStreamSource(stream);
      sourceNode.connect(analyser);

      const frequencyData = new Uint8Array(analyser.frequencyBinCount);

      const sampleFrame = () => {
        analyser.getByteFrequencyData(frequencyData);
        setWaveformBars(buildStudioWaveformBarsFromLevels(frequencyData));
        liveWaveformFrameRef.current = window.requestAnimationFrame(sampleFrame);
      };

      sampleFrame();
    },
    [resetWaveformBars, stopLiveWaveformSampling],
  );

  const stopDraftPreview = useCallback(() => {
    const audio = draftPreviewAudioRef.current;
    if (!audio) {
      setIsDraftPreviewPlaying(false);
      return;
    }

    audio.pause();
    audio.src = '';
    draftPreviewAudioRef.current = null;
    setIsDraftPreviewPlaying(false);
  }, []);

  const discardActiveRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      return;
    }

    recorder.ondataavailable = null;
    recorder.onstop = () => {
      stopMediaStream();
      stopLiveWaveformSampling();
    };
    recorder.stop();
  }, [stopLiveWaveformSampling, stopMediaStream]);

  const setDraftAudioPreview = useCallback(
    (blob: Blob) => {
      stopDraftPreview();
      setDraftAudioUrl((previousUrl) => {
        if (previousUrl) {
          URL.revokeObjectURL(previousUrl);
        }
        return URL.createObjectURL(blob);
      });
    },
    [stopDraftPreview],
  );

  const clearDraftAudio = useCallback(() => {
    stopDraftPreview();
    stopLiveWaveformSampling();
    setRecordedDuration(0);
    setDraftBlob(null);
    setDraftMimeType('audio/webm');
    setDraftSource(null);
    setDraftFileName(null);
    resetWaveformBars();
    setDraftAudioUrl((previousUrl) => {
      if (previousUrl) {
        URL.revokeObjectURL(previousUrl);
      }
      return null;
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [resetWaveformBars, stopDraftPreview, stopLiveWaveformSampling]);

  const resetComposerDraft = useCallback(() => {
    setTitle('');
    setDescription('');
    setTranslation('');
    setSelectedTags([]);
    setRecordingType('story');
    clearDraftAudio();
  }, [clearDraftAudio]);

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
      stopDraftPreview();
      stopLiveWaveformSampling();
      discardActiveRecording();
      setDraftAudioUrl((previousUrl) => {
        if (previousUrl) {
          URL.revokeObjectURL(previousUrl);
        }
        return null;
      });
    },
    [
      discardActiveRecording,
      stopDraftPreview,
      stopLiveWaveformSampling,
      stopMediaStream,
      stopTimer,
    ],
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

  const pendingReviewCount = useMemo(() => countPendingStudioReview(recordings), [recordings]);
  const previewRecordings = useMemo(
    () => recordings.slice(0, PREVIEW_RECORDING_LIMIT),
    [recordings],
  );
  const draftFileSizeLabel = useMemo(() => formatDraftSize(draftBlob), [draftBlob]);

  const navigateBackFromExplore = useCallback(() => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate('/home/landing', { replace: true });
  }, [navigate]);

  const edgeSwipeBackHandlers = useEdgeSwipeBack({
    enabled: fromExplore,
    onBack: navigateBackFromExplore,
  });

  const handleOpenComposer = () => {
    triggerHapticFeedback('light');
    resetComposerDraft();
    setFlowStep('capture');
    setIsComposerOpen(true);
  };

  const handleCloseComposer = useCallback(() => {
    if (isRecording) {
      discardActiveRecording();
      stopTimer();
      setIsRecording(false);
    }
    resetComposerDraft();
    setFlowStep('capture');
    setIsComposerOpen(false);
  }, [discardActiveRecording, isRecording, resetComposerDraft, stopTimer]);

  const handleFlowBack = () => {
    triggerHapticFeedback('light');
    if (flowStep === 'details') {
      setFlowStep('capture');
      return;
    }
    handleCloseComposer();
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
      stopDraftPreview();
      clearDraftAudio();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getMediaRecorderMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

      audioChunksRef.current = [];
      mediaRecorderRef.current = recorder;
      mediaStreamRef.current = stream;
      setDraftMimeType(mimeType || 'audio/webm');
      setRecordedDuration(0);

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
        setDraftSource('recorded');
        setDraftFileName(null);
        setDraftMimeType(blob.type || mimeType || 'audio/webm');
        stopMediaStream();
        stopLiveWaveformSampling();
      };

      recorder.start();
      void startLiveWaveformSampling(stream);
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
  }, [
    clearDraftAudio,
    setDraftAudioPreview,
    startLiveWaveformSampling,
    stopDraftPreview,
    stopLiveWaveformSampling,
    stopMediaStream,
  ]);

  const stopRecording = useCallback(() => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
      return;
    }

    mediaRecorderRef.current.stop();
    stopLiveWaveformSampling();
    stopTimer();
    setIsRecording(false);
    triggerHapticFeedback('light');
  }, [stopLiveWaveformSampling, stopTimer]);

  const handleOpenFilePicker = () => {
    if (isRecording || isSaving) {
      return;
    }

    triggerHapticFeedback('light');
    fileInputRef.current?.click();
  };

  const handleAttachAudio = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const selectedFile = event.target.files?.[0];
      event.target.value = '';

      if (!selectedFile) {
        return;
      }

      if (isRecording) {
        setToast({
          color: 'warning',
          message: 'Stop the current recording before attaching another audio file.',
        });
        triggerHapticFeedback('error');
        return;
      }

      try {
        stopDraftPreview();
        const durationSeconds = await readAudioDurationSeconds(selectedFile);
        setDraftBlob(selectedFile);
        setDraftAudioPreview(selectedFile);
        setDraftMimeType(
          normalizeStudioImportedAudioMimeType(selectedFile.type, selectedFile.name),
        );
        setDraftSource('attached');
        setDraftFileName(selectedFile.name);
        setRecordedDuration(durationSeconds);
        setTitle((currentTitle) =>
          currentTitle.trim().length > 0
            ? currentTitle
            : getStudioImportedAudioTitle(selectedFile.name),
        );
        setToast({
          color: 'success',
          message:
            'Audio attached. Review it, then continue to save it through the normal sync flow.',
        });
        triggerHapticFeedback('success');
      } catch (error) {
        setToast({
          color: 'danger',
          message: normalizeRecorderError(error),
        });
        triggerHapticFeedback('error');
      }
    },
    [isRecording, setDraftAudioPreview, stopDraftPreview],
  );

  const handleDraftPlaybackToggle = useCallback(async () => {
    if (!draftAudioUrl || isRecording) {
      return;
    }

    try {
      let audio = draftPreviewAudioRef.current;
      if (!audio) {
        audio = new Audio(draftAudioUrl);
        audio.preload = 'metadata';
        audio.addEventListener('ended', () => {
          setIsDraftPreviewPlaying(false);
        });
        draftPreviewAudioRef.current = audio;
      }

      if (audio.src !== draftAudioUrl) {
        audio.src = draftAudioUrl;
      }

      if (!audio.paused) {
        audio.pause();
        setIsDraftPreviewPlaying(false);
        triggerHapticFeedback('light');
        return;
      }

      await audio.play();
      setIsDraftPreviewPlaying(true);
      triggerHapticFeedback('light');
    } catch (error) {
      setToast({
        color: 'danger',
        message: normalizeRecorderError(error),
      });
      triggerHapticFeedback('error');
    }
  }, [draftAudioUrl, isRecording]);

  useEffect(() => {
    stopDraftPreview();
  }, [draftAudioUrl, stopDraftPreview]);

  useEffect(() => {
    if (isRecording) {
      return;
    }

    if (!draftBlob) {
      resetWaveformBars();
      return;
    }

    let isCancelled = false;

    const syncWaveformBars = async () => {
      const nextBars = await deriveWaveformBarsFromBlob(draftBlob);
      if (!isCancelled) {
        setWaveformBars(nextBars);
      }
    };

    void syncWaveformBars();

    return () => {
      isCancelled = true;
    };
  }, [deriveWaveformBarsFromBlob, draftBlob, isRecording, resetWaveformBars]);

  const draftAudioSummary = useMemo(() => {
    if (isRecording) {
      return {
        title: 'Recording in progress',
        detail: 'Tap stop when the story is complete.',
      };
    }

    if (draftSource === 'attached') {
      return {
        title: 'Attached audio ready',
        detail: draftFileName
          ? `${draftFileName} • ${formatRecordingDuration(recordedDuration)}`
          : formatRecordingDuration(recordedDuration),
      };
    }

    if (draftSource === 'recorded') {
      return {
        title: 'Recording ready',
        detail: `Captured ${formatRecordingDuration(recordedDuration)} of audio.`,
      };
    }

    return {
      title: 'Tap the center control to start recording',
      detail: 'You can also attach an existing audio file for testing.',
    };
  }, [draftFileName, draftSource, isRecording, recordedDuration]);

  const handleProceedToDetails = () => {
    if (!draftBlob || isRecording) {
      return;
    }

    triggerHapticFeedback('success');
    setFlowStep('details');
  };

  const handleDiscardDraft = () => {
    triggerHapticFeedback('light');

    if (isRecording) {
      discardActiveRecording();
      stopLiveWaveformSampling();
      stopTimer();
      setIsRecording(false);
      clearDraftAudio();
      return;
    }

    if (draftBlob) {
      clearDraftAudio();
      return;
    }

    handleCloseComposer();
  };

  const handleCapturePrimaryAction = () => {
    if (isRecording) {
      stopRecording();
      return;
    }

    if (draftBlob) {
      void handleDraftPlaybackToggle();
      return;
    }

    void startRecording();
  };

  const handleSaveRecording = async (event: FormEvent<HTMLFormElement>) => {
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
      setFlowStep('capture');
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
      const processedAudio = await preprocessStudioAudioBlob(draftBlob);
      const createdRecording = await saveStudioRecordingDraft({
        uploaderId: user.id,
        title,
        description,
        translation,
        recordingType,
        topicTags: selectedTags,
        durationSeconds: recordedDuration,
        mimeType: processedAudio.mimeType || draftMimeType || draftBlob.type || 'audio/webm',
        audioBlob: processedAudio.blob,
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

  const capturePrimaryIcon = isRecording
    ? stopCircleOutline
    : draftBlob
      ? isDraftPreviewPlaying
        ? pauseOutline
        : playOutline
      : micOutline;

  const capturePrimaryLabel = isRecording
    ? 'Stop recording'
    : draftBlob
      ? isDraftPreviewPlaying
        ? 'Pause preview'
        : 'Play preview'
      : 'Start recording';

  return (
    <section className="home-tab-content home-tab-content--studio" {...edgeSwipeBackHandlers}>
      <div className="studio-shell studio-shell--landing">
        <header className="studio-heading-row studio-heading-row--studio-home">
          {fromExplore ? (
            <button
              type="button"
              className="studio-back-button studio-back-button--home"
              onClick={() => {
                triggerHapticFeedback('light');
                navigateBackFromExplore();
              }}
              aria-label="Back to home"
            >
              <IonIcon aria-hidden icon={arrowBackOutline} />
            </button>
          ) : null}
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
          className="studio-hero-card"
          onClick={handleOpenComposer}
          aria-label="Record new story"
        >
          <img src={micIllustration} alt="" className="studio-hero-illustration" />
          <div className="studio-hero-copy">
            <h3>
              <span>Record</span>
              <span>New Story</span>
            </h3>
            <p>Share your voice, preserve your wisdom for the next generation.</p>
            <span className="studio-hero-action">
              <span>Record Now</span>
              <IonIcon aria-hidden icon={arrowForwardOutline} />
            </span>
          </div>
          <IonIcon aria-hidden icon={addOutline} className="studio-hero-plus" />
        </button>

        <p className="studio-subcopy studio-subcopy--landing">
          Share your voice, preserve your wisdom for next generation
        </p>

        {pendingReviewCount > 0 ? (
          <div className="studio-review-banner">
            <div>
              <strong>{pendingReviewCount} recordings need review</strong>
              <span>Open Archive to verify the Semai transcript. Malay is optional.</span>
            </div>
            <button
              type="button"
              className="studio-review-banner-button"
              onClick={handleOpenAllStories}
            >
              Review
            </button>
          </div>
        ) : null}

        <section className="studio-archive-preview" aria-label="Sounds archive preview">
          <header className="studio-archive-preview-header">
            <div className="studio-archive-preview-copy">
              <h3>
                <em>Sounds</em>
                <span>Archive</span>
              </h3>
              <button
                type="button"
                className="studio-sync-chip"
                onClick={handleRetrySync}
                disabled={!isOnline || isSyncing}
              >
                <IonIcon aria-hidden icon={refreshOutline} />
                <span>Sync now</span>
              </button>
            </div>
            <img src={archiveBook} alt="" className="studio-archive-preview-illustration" />
          </header>

          {recordings.length === 0 ? (
            <div className="studio-empty-state studio-empty-state--archive">
              <p>No stories yet.</p>
              <small>Tap the purple card to record or attach your first audio sample.</small>
            </div>
          ) : (
            <ul className="studio-archive-preview-list">
              {previewRecordings.map((recording) => (
                <li key={recording.id} className="studio-archive-preview-item">
                  <header className="studio-recording-header studio-recording-header--preview">
                    <div className="studio-recording-main">
                      <p className="studio-recording-title studio-recording-title--light">
                        {recording.title}
                      </p>
                      <p className="studio-recording-meta studio-recording-meta--light">
                        {RECORDING_TYPE_LABEL[recording.recordingType]} •{' '}
                        {formatRecordingDuration(recording.durationSeconds)} •{' '}
                        {formatRelativeTime(recording.createdAt)}
                      </p>
                    </div>
                    <span
                      className={`studio-recording-status ${recording.syncStatus === 'synced' ? 'is-synced' : 'is-local-only'}`}
                    >
                      {statusLabelBySyncStatus[recording.syncStatus]}
                    </span>
                  </header>
                  <p className="studio-recording-note studio-recording-note--light">
                    {doesStudioRecordingNeedReview(recording)
                      ? 'Needs Semai transcript review before this recording becomes trusted language data.'
                      : 'Semai transcript verified and ready to support the trusted language corpus.'}
                  </p>
                </li>
              ))}
            </ul>
          )}

          <div className="studio-archive-preview-footer">
            <button
              type="button"
              className="studio-link-button studio-link-button--ghost"
              onClick={handleOpenAllStories}
            >
              Open Sound Archive
            </button>
          </div>
        </section>
      </div>

      {isComposerOpen ? (
        <div className="studio-flow-screen" role="dialog" aria-modal="true">
          <input
            ref={fileInputRef}
            className="studio-hidden-file-input"
            type="file"
            accept={STUDIO_AUDIO_FILE_ACCEPT}
            onChange={handleAttachAudio}
          />

          {flowStep === 'capture' ? (
            <div className="studio-flow-shell studio-flow-shell--capture">
              <header className="studio-flow-header">
                <button type="button" className="studio-flow-back-button" onClick={handleFlowBack}>
                  <IonIcon aria-hidden icon={arrowBackOutline} />
                </button>
                <h2>Voice Record</h2>
                <button
                  type="button"
                  className="studio-flow-utility-button"
                  onClick={handleOpenFilePicker}
                  disabled={isRecording || isSaving}
                >
                  <IonIcon aria-hidden icon={attachOutline} />
                  <span>{draftSource === 'attached' ? 'Replace' : 'Attach'}</span>
                </button>
              </header>

              <div className="studio-capture-hero">
                <div
                  className={`studio-capture-orb ${isRecording ? 'is-recording' : ''} ${draftBlob ? 'is-ready' : ''}`}
                >
                  <img src={recorderHero} alt="" className="studio-capture-orb-image" />
                </div>
                <p className="studio-capture-clock">
                  {formatStudioRecorderClock(recordedDuration)}
                </p>
              </div>

              <div
                className={`studio-waveform-shell ${isRecording ? 'is-live' : ''}`}
                aria-hidden="true"
              >
                {waveformBars.map((height, index) => (
                  <span
                    key={index}
                    className={`studio-waveform-bar ${index >= 15 && index <= 20 ? 'is-highlight' : ''}`}
                    style={{ ['--studio-bar-height' as string]: `${Math.round(height * 100)}%` }}
                  />
                ))}
              </div>

              <div className="studio-capture-status-card">
                <strong>{draftAudioSummary.title}</strong>
                <span>{draftAudioSummary.detail}</span>
                <div className="studio-type-options studio-type-options--capture">
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
              </div>

              <div className="studio-capture-controls">
                <button
                  type="button"
                  className="studio-capture-control studio-capture-control--danger"
                  onClick={handleDiscardDraft}
                  aria-label={draftBlob || isRecording ? 'Discard current audio' : 'Close recorder'}
                >
                  <IonIcon aria-hidden icon={closeOutline} />
                </button>
                <button
                  type="button"
                  className={`studio-capture-control studio-capture-control--primary ${isRecording ? 'is-recording' : ''}`}
                  onClick={handleCapturePrimaryAction}
                  aria-label={capturePrimaryLabel}
                >
                  <IonIcon aria-hidden icon={capturePrimaryIcon} />
                </button>
                <button
                  type="button"
                  className="studio-capture-control studio-capture-control--success"
                  onClick={handleProceedToDetails}
                  disabled={!draftBlob || isRecording}
                  aria-label="Continue to save details"
                >
                  <IonIcon aria-hidden icon={checkmarkOutline} />
                </button>
              </div>

              <p className="studio-capture-hint">
                {draftBlob
                  ? 'Use the green check to continue and save this recording into the archive.'
                  : 'Tap attach if you want to test STT with an existing audio file from your device.'}
              </p>
            </div>
          ) : (
            <div className="studio-flow-shell studio-flow-shell--details">
              <form className="studio-save-form" onSubmit={handleSaveRecording}>
                <header className="studio-flow-header">
                  <button
                    type="button"
                    className="studio-flow-back-button"
                    onClick={handleFlowBack}
                  >
                    <IonIcon aria-hidden icon={arrowBackOutline} />
                  </button>
                  <h2>Save Your Story</h2>
                  <span className="studio-flow-header-spacer" aria-hidden="true" />
                </header>

                <section className="studio-save-preview-card">
                  <div className="studio-save-preview-head">
                    <div>
                      <p>{draftSource === 'attached' ? 'Attached Audio' : 'New Recording'}</p>
                      <strong>{formatRecordingDuration(recordedDuration)}</strong>
                    </div>
                    <span>{draftFileSizeLabel}</span>
                  </div>
                  <div className="studio-save-waveform">
                    {waveformBars.map((height, index) => (
                      <span
                        key={`summary-${index}`}
                        className="studio-save-waveform-bar"
                        style={{
                          ['--studio-bar-height' as string]: `${Math.round(height * 100)}%`,
                        }}
                      />
                    ))}
                  </div>
                </section>

                <fieldset className="studio-type-fieldset studio-type-fieldset--inline">
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

                <label className="studio-form-field studio-form-field--figma">
                  <span>Title of The Story</span>
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="e.g. Bawang Putih Bawang Merah"
                    maxLength={120}
                    required
                  />
                </label>

                <label className="studio-form-field studio-form-field--figma">
                  <span>Description</span>
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="e.g. Add context, who is speaking, or what this story means."
                    rows={5}
                    maxLength={280}
                  />
                </label>

                <div className="studio-save-extra-grid">
                  <label className="studio-form-field studio-form-field--figma">
                    <span>Malay Notes (Optional)</span>
                    <input
                      value={translation}
                      onChange={(event) => setTranslation(event.target.value)}
                      placeholder="Optional meaning to carry into review"
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
                </div>

                {draftAudioUrl ? (
                  <div className="studio-audio-inline-actions">
                    <button
                      type="button"
                      className="studio-recording-action-button"
                      onClick={() => void handleDraftPlaybackToggle()}
                    >
                      <IonIcon
                        aria-hidden
                        icon={isDraftPreviewPlaying ? pauseOutline : playOutline}
                      />
                      <span>{isDraftPreviewPlaying ? 'Pause Preview' : 'Preview Audio'}</span>
                    </button>
                    <span className="studio-audio-inline-meta">
                      {draftSource === 'attached' && draftFileName
                        ? draftFileName
                        : 'Recorded audio ready for archive'}
                    </span>
                  </div>
                ) : null}

                <footer className="studio-save-footer">
                  <button
                    type="submit"
                    className="studio-save-button"
                    disabled={isSaving || !draftBlob}
                  >
                    {isSaving ? (
                      <>
                        <IonSpinner name="crescent" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      'Save to Archive'
                    )}
                  </button>
                  <button
                    type="button"
                    className="studio-discard-link"
                    onClick={handleCloseComposer}
                  >
                    Discard Recording
                  </button>
                </footer>
              </form>
            </div>
          )}
        </div>
      ) : null}

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
