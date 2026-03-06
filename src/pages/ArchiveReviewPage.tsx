import { IonIcon, IonSpinner, IonToast } from '@ionic/react';
import {
  arrowBackOutline,
  checkmarkOutline,
  pauseOutline,
  playOutline,
  refreshOutline,
  trashOutline,
} from 'ionicons/icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  approveStudioRecordingReview,
  canVerifyStudioRecording,
  countPendingStudioReview,
  deleteStudioRecording,
  doesStudioRecordingNeedReview,
  fetchRemoteStudioRecordings,
  formatRecordingDuration,
  formatRelativeTime,
  getStudioRecordingsForUser,
  getStudioReviewDraftMalayTranslation,
  getStudioReviewDraftTranscription,
  mergeStudioRecordings,
  paginateStudioItems,
  resolveStudioRecordingPlaybackSource,
  retryStudioRecordingTranscription,
  saveStudioRecordingReviewDraft,
  type StudioRecording,
  type StudioRecordingType,
  type StudioTranscriptionMatch,
  type StudioWordReplacement,
} from '../lib/elderStudio';
import { triggerHapticFeedback } from '../lib/feedback';
import { findSemaiDictionaryHints, type SemaiDictionaryHint } from '../lib/semaiDictionary';
import { normalizeSemaiText } from '../lib/semaiText';
import { useAuthStore } from '../stores/authStore';

type ToastState = {
  message: string;
  color: 'success' | 'danger' | 'warning' | 'medium';
};

type ReviewFilter = 'pending' | 'verified';

type ReviewDraftState = {
  verifiedTranscription: string;
  verifiedTranslationMs: string;
};

type ReviewSuggestionState = {
  sentenceMatch: StudioTranscriptionMatch | null;
  wordReplacements: StudioWordReplacement[];
};

type ReviewHelperPanels = {
  alternatives: boolean;
  dictionary: boolean;
  initial: boolean;
};

const REVIEW_PAGE_SIZE = 4;
const REVIEW_FILTER_LABEL: Record<ReviewFilter, string> = {
  pending: 'Need Review',
  verified: 'Verified',
};
const RECORDING_TYPE_LABEL: Record<StudioRecordingType, string> = {
  word: 'Word',
  story: 'Story',
  song: 'Song',
};
const DEFAULT_REVIEW_HELPER_PANELS: ReviewHelperPanels = {
  alternatives: false,
  dictionary: false,
  initial: false,
};

const formatCandidateDraftLabel = (index: number): string => `Draft ${index + 1}`;

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const applyWordReplacementToTranscript = (
  transcript: string,
  replacement: StudioWordReplacement,
): string => {
  const target = replacement.from.trim();
  if (!target) {
    return transcript;
  }

  const nextValue = replacement.to.trim();
  const pattern = target.includes(' ')
    ? new RegExp(escapeRegExp(target), 'i')
    : new RegExp(`\\b${escapeRegExp(target)}\\b`, 'i');

  if (!pattern.test(transcript)) {
    return transcript;
  }

  return transcript.replace(pattern, nextValue);
};

const buildFallbackSuggestions = (hints: SemaiDictionaryHint[]): ReviewSuggestionState => {
  const sentenceHint = hints.find((hint) => hint.kind === 'sentence_example') ?? null;
  const wordReplacements = new Map<string, StudioWordReplacement>();

  for (const hint of hints) {
    if (hint.kind !== 'glossary') {
      continue;
    }

    if (normalizeSemaiText(hint.matchedText) === normalizeSemaiText(hint.semai)) {
      continue;
    }

    const key = `${hint.matchedText}->${hint.semai}`;
    if (!wordReplacements.has(key)) {
      wordReplacements.set(key, {
        from: hint.matchedText,
        to: hint.semai,
        confidence: hint.confidence === 'high' ? 0.85 : 0.65,
        source: hint.source,
      });
    }
  }

  return {
    sentenceMatch: sentenceHint
      ? {
          id: sentenceHint.id,
          source: sentenceHint.source,
          semai: sentenceHint.semai,
          score: sentenceHint.score,
          matchType: sentenceHint.matchType === 'sentence_exact' ? 'exact' : 'fuzzy',
          headword: sentenceHint.headword ?? null,
          applied: sentenceHint.matchType === 'sentence_exact',
        }
      : null,
    wordReplacements: [...wordReplacements.values()],
  };
};

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return 'Unable to complete that review action right now.';
};

export function ArchiveReviewPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [recordings, setRecordings] = useState<StudioRecording[]>([]);
  const [filter, setFilter] = useState<ReviewFilter>('pending');
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [drafts, setDrafts] = useState<Record<string, ReviewDraftState>>({});
  const [fallbackSuggestions, setFallbackSuggestions] = useState<
    Record<string, ReviewSuggestionState>
  >({});
  const [helperPanels, setHelperPanels] = useState<Record<string, ReviewHelperPanels>>({});
  const [page, setPage] = useState(1);
  const [transcribingRecordingId, setTranscribingRecordingId] = useState<string | null>(null);
  const [savingRecordingId, setSavingRecordingId] = useState<string | null>(null);
  const [verifyingRecordingId, setVerifyingRecordingId] = useState<string | null>(null);
  const [deletingRecordingId, setDeletingRecordingId] = useState<string | null>(null);
  const [playingRecordingId, setPlayingRecordingId] = useState<string | null>(null);
  const [loadingPlaybackRecordingId, setLoadingPlaybackRecordingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playbackSourceCacheRef = useRef<Map<string, { url: string; expiresAt: number }>>(new Map());
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
        // Local cache keeps review usable while remote refresh fails.
      }

      const merged = mergeStudioRecordings(localRecordings, remoteRecordings);
      setRecordings(merged);
      setDrafts((current) => {
        const nextDrafts = { ...current };
        for (const recording of merged) {
          if (!nextDrafts[recording.id]) {
            nextDrafts[recording.id] = {
              verifiedTranscription: getStudioReviewDraftTranscription(recording),
              verifiedTranslationMs: getStudioReviewDraftMalayTranslation(recording),
            };
          }
        }
        return nextDrafts;
      });
    } catch (error) {
      setToast({
        color: 'danger',
        message: toErrorMessage(error),
      });
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void loadRecordings();
  }, [loadRecordings]);

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

  const reviewableRecordings = useMemo(
    () =>
      recordings
        .filter((recording) => recording.syncStatus === 'synced')
        .filter((recording) =>
          filter === 'pending' ? doesStudioRecordingNeedReview(recording) : recording.isVerified,
        ),
    [filter, recordings],
  );
  const reviewPagination = useMemo(
    () => paginateStudioItems(reviewableRecordings, page, REVIEW_PAGE_SIZE),
    [page, reviewableRecordings],
  );
  const pendingCount = useMemo(() => countPendingStudioReview(recordings), [recordings]);

  useEffect(() => {
    setPage(1);
  }, [filter]);

  useEffect(() => {
    if (page !== reviewPagination.currentPage) {
      setPage(reviewPagination.currentPage);
    }
  }, [page, reviewPagination.currentPage]);

  useEffect(() => {
    let isCancelled = false;

    const loadHints = async () => {
      const nextHints = await Promise.all(
        reviewPagination.items.map(async (recording) => {
          const transcript =
            drafts[recording.id]?.verifiedTranscription ??
            getStudioReviewDraftTranscription(recording);
          const hints = await findSemaiDictionaryHints(transcript);
          return [recording.id, buildFallbackSuggestions(hints.slice(0, 5))] as const;
        }),
      );

      if (isCancelled) {
        return;
      }

      setFallbackSuggestions((current) => ({
        ...current,
        ...Object.fromEntries(nextHints),
      }));
    };

    void loadHints();

    return () => {
      isCancelled = true;
    };
  }, [drafts, reviewPagination.items]);

  const handleBack = () => {
    triggerHapticFeedback('light');
    navigate('/home/archive', { replace: true });
  };

  const getDraftForRecording = (recording: StudioRecording): ReviewDraftState =>
    drafts[recording.id] ?? {
      verifiedTranscription: getStudioReviewDraftTranscription(recording),
      verifiedTranslationMs: getStudioReviewDraftMalayTranslation(recording),
    };

  const updateDraftField = (
    recordingId: string,
    field: keyof ReviewDraftState,
    value: string,
  ): void => {
    setDrafts((current) => ({
      ...current,
      [recordingId]: {
        ...(current[recordingId] ?? { verifiedTranscription: '', verifiedTranslationMs: '' }),
        [field]: value,
      },
    }));
  };

  const getHelperPanels = (recordingId: string): ReviewHelperPanels =>
    helperPanels[recordingId] ?? DEFAULT_REVIEW_HELPER_PANELS;

  const toggleHelperPanel = (recordingId: string, panel: keyof ReviewHelperPanels): void => {
    triggerHapticFeedback('light');
    setHelperPanels((current) => ({
      ...current,
      [recordingId]: {
        ...(current[recordingId] ?? DEFAULT_REVIEW_HELPER_PANELS),
        [panel]: !(current[recordingId] ?? DEFAULT_REVIEW_HELPER_PANELS)[panel],
      },
    }));
  };

  const updateRecording = (updatedRecording: StudioRecording) => {
    setRecordings((current) =>
      current
        .map((recording) => (recording.id === updatedRecording.id ? updatedRecording : recording))
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    );
    setDrafts((current) => ({
      ...current,
      [updatedRecording.id]: {
        verifiedTranscription: getStudioReviewDraftTranscription(updatedRecording),
        verifiedTranslationMs: getStudioReviewDraftMalayTranslation(updatedRecording),
      },
    }));
  };

  const removeRecording = (recordingId: string) => {
    setRecordings((current) =>
      current
        .filter((recording) => recording.id !== recordingId)
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    );
    setDrafts((current) => {
      const nextDrafts = { ...current };
      delete nextDrafts[recordingId];
      return nextDrafts;
    });
    setFallbackSuggestions((current) => {
      const nextSuggestions = { ...current };
      delete nextSuggestions[recordingId];
      return nextSuggestions;
    });
    setHelperPanels((current) => {
      const nextPanels = { ...current };
      delete nextPanels[recordingId];
      return nextPanels;
    });

    const cachedSource = playbackSourceCacheRef.current.get(recordingId);
    if (cachedSource) {
      playbackSourceCacheRef.current.delete(recordingId);
      if (objectUrlsRef.current.has(cachedSource.url)) {
        URL.revokeObjectURL(cachedSource.url);
        objectUrlsRef.current.delete(cachedSource.url);
      }
    }

    if (playingRecordingId === recordingId && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      setPlayingRecordingId(null);
    }
  };

  const handleApplyCandidate = (recordingId: string, transcription: string) => {
    triggerHapticFeedback('light');
    updateDraftField(recordingId, 'verifiedTranscription', transcription);
  };

  const handleApplySentenceMatch = (recordingId: string, match: StudioTranscriptionMatch) => {
    triggerHapticFeedback('light');
    updateDraftField(recordingId, 'verifiedTranscription', match.semai);
    setToast({
      color: 'success',
      message: 'Sentence match copied into the Semai transcript.',
    });
  };

  const handleApplyWordReplacement = (
    recordingId: string,
    replacement: StudioWordReplacement,
    currentTranscript: string,
  ) => {
    triggerHapticFeedback('light');
    const nextTranscript = applyWordReplacementToTranscript(currentTranscript, replacement);
    updateDraftField(recordingId, 'verifiedTranscription', nextTranscript);
    setToast({
      color: 'success',
      message: `Word correction applied: ${replacement.from} -> ${replacement.to}`,
    });
  };

  const handleResetToAiDraft = (recording: StudioRecording) => {
    triggerHapticFeedback('light');
    setDrafts((current) => ({
      ...current,
      [recording.id]: {
        verifiedTranscription: recording.autoTranscription ?? recording.rawTranscription ?? '',
        verifiedTranslationMs: recording.autoTranslationMs ?? '',
      },
    }));
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
      const cached = playbackSourceCacheRef.current.get(recording.id);
      let sourceUrl: string | undefined;
      if (cached && cached.expiresAt > Date.now()) {
        sourceUrl = cached.url;
      } else {
        // Expired or not cached — resolve a fresh signed URL (TTL 600s, cache for 500s).
        const source = await resolveStudioRecordingPlaybackSource(recording);
        sourceUrl = source.url;
        playbackSourceCacheRef.current.set(recording.id, {
          url: source.url,
          expiresAt: Date.now() + 500_000,
        });
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
        message: toErrorMessage(error),
      });
    } finally {
      setLoadingPlaybackRecordingId(null);
    }
  };

  const handleRerunAsr = async (recording: StudioRecording) => {
    if (transcribingRecordingId) {
      return;
    }

    triggerHapticFeedback('light');
    setTranscribingRecordingId(recording.id);
    try {
      const updatedRecording = await retryStudioRecordingTranscription(recording);
      updateRecording(updatedRecording);
      setToast({
        color: 'success',
        message: 'AI draft refreshed.',
      });
    } catch (error) {
      setToast({
        color: 'danger',
        message: toErrorMessage(error),
      });
    } finally {
      setTranscribingRecordingId(null);
    }
  };

  const handleSaveDraft = async (recording: StudioRecording) => {
    if (savingRecordingId) {
      return;
    }

    triggerHapticFeedback('light');
    setSavingRecordingId(recording.id);
    try {
      const draft = getDraftForRecording(recording);
      const updatedRecording = await saveStudioRecordingReviewDraft(recording, {
        verifiedTranscription: draft.verifiedTranscription,
        verifiedTranslationMs: draft.verifiedTranslationMs || null,
      });
      updateRecording(updatedRecording);
      setToast({
        color: 'success',
        message: 'Review draft saved.',
      });
    } catch (error) {
      setToast({
        color: 'danger',
        message: toErrorMessage(error),
      });
    } finally {
      setSavingRecordingId(null);
    }
  };

  const handleApprove = async (recording: StudioRecording) => {
    if (verifyingRecordingId) {
      return;
    }

    if (!user) {
      return;
    }

    triggerHapticFeedback('medium');
    setVerifyingRecordingId(recording.id);
    try {
      const draft = getDraftForRecording(recording);
      const updatedRecording = await approveStudioRecordingReview(
        recording,
        {
          verifiedTranscription: draft.verifiedTranscription,
          verifiedTranslationMs: draft.verifiedTranslationMs || null,
        },
        user.id,
      );
      updateRecording(updatedRecording);
      setToast({
        color: 'success',
        message:
          recording.recordingType === 'word'
            ? draft.verifiedTranslationMs.trim().length > 0
              ? 'Transcript verified. Vocabulary sync runs when this Semai word is new.'
              : 'Transcript verified. Add Malay later if you want it in Language Garden.'
            : 'Recording verified.',
      });
    } catch (error) {
      setToast({
        color: 'danger',
        message: toErrorMessage(error),
      });
    } finally {
      setVerifyingRecordingId(null);
    }
  };

  const handleDeleteRecording = async (recording: StudioRecording) => {
    const confirmed = window.confirm(
      recording.isVerified
        ? 'Delete this recording? This removes it from Sound Archive and the review queue.'
        : 'Delete this recording? This removes the audio and its transcript draft.',
    );

    if (!confirmed) {
      return;
    }

    triggerHapticFeedback('medium');
    setDeletingRecordingId(recording.id);
    try {
      await deleteStudioRecording(recording);
      removeRecording(recording.id);
      setToast({
        color: 'success',
        message: 'Recording deleted.',
      });
    } catch (error) {
      setToast({
        color: 'danger',
        message: toErrorMessage(error),
      });
    } finally {
      setDeletingRecordingId(null);
    }
  };

  return (
    <section className="home-tab-content home-tab-content--studio review-page">
      <div className="review-page-shell">
        <header className="review-page-header">
          <button
            type="button"
            className="review-back-button"
            onClick={handleBack}
            aria-label="Back to sound archive"
          >
            <IonIcon aria-hidden icon={arrowBackOutline} />
          </button>
          <h2>Review Queue</h2>
        </header>

        <section className="review-summary-bar">
          <div className="review-count-pill">
            <strong>{pendingCount}</strong>
            <span>Pending Review</span>
          </div>
          <div className="review-filter-group" role="tablist" aria-label="Review filters">
            {(Object.keys(REVIEW_FILTER_LABEL) as ReviewFilter[]).map((value) => (
              <button
                key={value}
                type="button"
                className={`review-filter-pill ${filter === value ? 'is-active' : ''}`}
                onClick={() => {
                  triggerHapticFeedback('light');
                  setFilter(value);
                }}
              >
                {REVIEW_FILTER_LABEL[value]}
              </button>
            ))}
          </div>
        </section>

        {isLoading ? (
          <div className="studio-loading-state">
            <IonSpinner name="crescent" />
          </div>
        ) : reviewableRecordings.length === 0 ? (
          <div className="studio-empty-state review-empty-state">
            <p>No recordings in this queue.</p>
            <small>Sync new recordings from Elder Studio or switch filters.</small>
          </div>
        ) : (
          <ul className="review-card-list">
            {reviewPagination.items.map((recording) => {
              const draft = getDraftForRecording(recording);
              const fallbackSuggestion = fallbackSuggestions[recording.id] ?? {
                sentenceMatch: null,
                wordReplacements: [],
              };
              const sentenceMatch =
                recording.transcriptionMatch ?? fallbackSuggestion.sentenceMatch;
              const wordReplacements =
                recording.transcriptionWordReplacements.length > 0
                  ? recording.transcriptionWordReplacements
                  : fallbackSuggestion.wordReplacements;
              const sentenceAlreadyApplied =
                sentenceMatch &&
                normalizeSemaiText(draft.verifiedTranscription) ===
                  normalizeSemaiText(sentenceMatch.semai);
              const actionableWordReplacements = sentenceAlreadyApplied ? [] : wordReplacements;
              const canVerify = canVerifyStudioRecording({
                ...recording,
                verifiedTranscription: draft.verifiedTranscription.trim() || null,
                verifiedTranslationMs: draft.verifiedTranslationMs.trim() || null,
              });
              const suggestedDraft =
                recording.autoTranscription ?? recording.rawTranscription ?? '';
              const isSuggestedDraftActive =
                suggestedDraft.trim().length > 0 &&
                normalizeSemaiText(draft.verifiedTranscription) ===
                  normalizeSemaiText(suggestedDraft);
              const panels = getHelperPanels(recording.id);
              const hasInitialTranscript = Boolean(recording.rawTranscription?.trim());
              const hasAlternativeDrafts = recording.transcriptionCandidates.length > 0;
              const hasDictionaryHelp =
                Boolean(sentenceMatch) || actionableWordReplacements.length > 0;

              return (
                <li key={recording.id} className="review-card">
                  <header className="review-card-header">
                    <div>
                      <p className="review-card-title">{recording.title}</p>
                      <p className="review-card-meta">
                        {RECORDING_TYPE_LABEL[recording.recordingType]} •{' '}
                        {formatRecordingDuration(recording.durationSeconds)} •{' '}
                        {formatRelativeTime(recording.createdAt)}
                      </p>
                    </div>
                    <span
                      className={`review-status-pill ${recording.isVerified ? 'is-verified' : 'is-draft'}`}
                    >
                      {recording.isVerified ? 'Verified' : 'Needs Review'}
                    </span>
                  </header>

                  <section className="review-suggested-card">
                    <div className="review-suggested-copy">
                      <span className="review-suggested-label">Suggested Draft</span>
                      <strong>
                        {suggestedDraft || 'No AI suggestion yet. Type the transcript manually.'}
                      </strong>
                      <span>
                        {suggestedDraft
                          ? 'Start from this transcript, then open helper options only if you need to compare or correct it.'
                          : 'Use the final transcript field below to enter the Semai text yourself.'}
                      </span>
                    </div>
                    {suggestedDraft ? (
                      isSuggestedDraftActive ? (
                        <span className="review-applied-pill">Using this</span>
                      ) : (
                        <button
                          type="button"
                          className="review-inline-button"
                          onClick={() => handleApplyCandidate(recording.id, suggestedDraft)}
                        >
                          Use Suggested Draft
                        </button>
                      )
                    ) : null}
                  </section>

                  <label className="review-field">
                    <span>Final Transcript</span>
                    <small className="review-field-hint">
                      Edit this until the Semai transcript is correct. This is what gets verified.
                    </small>
                    <textarea
                      value={draft.verifiedTranscription}
                      onChange={(event) =>
                        updateDraftField(recording.id, 'verifiedTranscription', event.target.value)
                      }
                      rows={4}
                      placeholder="e.g. aber abik abor madeh padeh"
                    />
                  </label>

                  {hasInitialTranscript || hasAlternativeDrafts || hasDictionaryHelp ? (
                    <div className="review-helper-toolbar">
                      {hasAlternativeDrafts ? (
                        <button
                          type="button"
                          className={`review-helper-toggle ${panels.alternatives ? 'is-active' : ''}`}
                          onClick={() => toggleHelperPanel(recording.id, 'alternatives')}
                        >
                          {panels.alternatives ? 'Hide Other AI Drafts' : 'Other AI Drafts'}
                        </button>
                      ) : null}
                      {hasDictionaryHelp ? (
                        <button
                          type="button"
                          className={`review-helper-toggle ${panels.dictionary ? 'is-active' : ''}`}
                          onClick={() => toggleHelperPanel(recording.id, 'dictionary')}
                        >
                          {panels.dictionary ? 'Hide Dictionary Help' : 'Dictionary Help'}
                        </button>
                      ) : null}
                      {hasInitialTranscript ? (
                        <button
                          type="button"
                          className={`review-helper-toggle ${panels.initial ? 'is-active' : ''}`}
                          onClick={() => toggleHelperPanel(recording.id, 'initial')}
                        >
                          {panels.initial ? 'Hide Initial Transcript' : 'Initial Transcript'}
                        </button>
                      ) : null}
                    </div>
                  ) : null}

                  {hasAlternativeDrafts && panels.alternatives ? (
                    <section className="review-support-panel">
                      <div className="review-support-header">
                        <strong>Other AI drafts</strong>
                        <span>Tap one to copy it into Final Transcript.</span>
                      </div>
                      <div className="review-candidate-grid">
                        {recording.transcriptionCandidates.map((candidate, index) => {
                          const isSelected =
                            normalizeSemaiText(draft.verifiedTranscription) ===
                            normalizeSemaiText(candidate.transcription);

                          return (
                            <button
                              key={`${recording.id}-${candidate.language}-${candidate.transcription}`}
                              type="button"
                              className={`review-candidate-chip ${isSelected ? 'is-selected' : ''}`}
                              onClick={() =>
                                handleApplyCandidate(recording.id, candidate.transcription)
                              }
                              aria-label={`Apply ${formatCandidateDraftLabel(index)}`}
                            >
                              <span>{formatCandidateDraftLabel(index)}</span>
                              <strong>{candidate.transcription}</strong>
                              {isSelected ? (
                                <small className="review-candidate-state">
                                  In Final Transcript
                                </small>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  ) : null}

                  {hasDictionaryHelp && panels.dictionary ? (
                    <section className="review-hint-panel">
                      <strong>Dictionary help</strong>
                      {sentenceMatch ? (
                        <div className="review-hint-card">
                          <div className="review-hint-copy">
                            <span className="review-hint-badge">
                              {sentenceMatch.matchType === 'exact'
                                ? 'Exact sentence'
                                : 'Closest sentence'}
                            </span>
                            <strong>{sentenceMatch.semai}</strong>
                            <span>
                              {sentenceMatch.headword
                                ? `Headword: ${sentenceMatch.headword} • `
                                : null}
                              {sentenceMatch.source.replace(/_/g, ' ')}
                            </span>
                          </div>
                          {!sentenceAlreadyApplied ? (
                            <button
                              type="button"
                              className="review-inline-button"
                              onClick={() => handleApplySentenceMatch(recording.id, sentenceMatch)}
                            >
                              Use Sentence
                            </button>
                          ) : (
                            <span className="review-applied-pill">Using this</span>
                          )}
                        </div>
                      ) : null}

                      {actionableWordReplacements.length > 0 ? (
                        <div className="review-word-fix-list">
                          {actionableWordReplacements.map((replacement) => (
                            <div
                              key={`${recording.id}-${replacement.from}-${replacement.to}`}
                              className="review-hint-card"
                            >
                              <div className="review-hint-copy">
                                <span className="review-hint-badge">Word fix</span>
                                <strong>
                                  Change: {replacement.from} {'->'} {replacement.to}
                                </strong>
                                <span>{replacement.source.replace(/_/g, ' ')}</span>
                              </div>
                              <button
                                type="button"
                                className="review-inline-button"
                                onClick={() =>
                                  handleApplyWordReplacement(
                                    recording.id,
                                    replacement,
                                    draft.verifiedTranscription,
                                  )
                                }
                              >
                                Replace Word
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </section>
                  ) : null}

                  {hasInitialTranscript && panels.initial ? (
                    <section className="review-support-panel">
                      <div className="review-support-header">
                        <strong>Initial transcript</strong>
                        <span>First transcription pass before ranking and correction.</span>
                      </div>
                      <p className="review-support-copy">{recording.rawTranscription}</p>
                    </section>
                  ) : null}

                  <label className="review-field">
                    <span>Malay Meaning (Optional)</span>
                    <small className="review-field-hint">
                      Leave this empty if you do not know the meaning yet.
                    </small>
                    <textarea
                      value={draft.verifiedTranslationMs}
                      onChange={(event) =>
                        updateDraftField(recording.id, 'verifiedTranslationMs', event.target.value)
                      }
                      rows={4}
                      placeholder="Add the meaning if you know it"
                    />
                  </label>

                  {recording.recordingType === 'word' ? (
                    <div className="review-vocab-preview">
                      <strong>Vocabulary preview</strong>
                      <span>
                        Semai word: {draft.verifiedTranscription.trim() || 'Pending transcript'}
                      </span>
                      <span>
                        Malay meaning:{' '}
                        {draft.verifiedTranslationMs.trim() ||
                          'Optional. Add meaning manually if you want this word in Language Garden'}
                      </span>
                    </div>
                  ) : null}

                  <div className="review-action-rows">
                    <div className="review-action-row review-action-row--utility">
                      <button
                        type="button"
                        className="review-action-button"
                        onClick={() => void handleTogglePlayback(recording)}
                        disabled={
                          Boolean(loadingPlaybackRecordingId) || Boolean(deletingRecordingId)
                        }
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

                      <button
                        type="button"
                        className="review-action-button"
                        onClick={() => void handleRerunAsr(recording)}
                        disabled={Boolean(transcribingRecordingId) || Boolean(deletingRecordingId)}
                      >
                        <IonIcon aria-hidden icon={refreshOutline} />
                        <span>
                          {transcribingRecordingId === recording.id
                            ? 'Working...'
                            : 'Refresh AI Draft'}
                        </span>
                      </button>

                      <button
                        type="button"
                        className="review-action-button"
                        onClick={() => handleResetToAiDraft(recording)}
                        disabled={Boolean(deletingRecordingId)}
                      >
                        Reset to Suggested Draft
                      </button>

                      <button
                        type="button"
                        className="review-action-button review-action-button--danger"
                        onClick={() => void handleDeleteRecording(recording)}
                        disabled={Boolean(deletingRecordingId)}
                      >
                        <IonIcon aria-hidden icon={trashOutline} />
                        <span>
                          {deletingRecordingId === recording.id
                            ? 'Deleting...'
                            : 'Delete Recording'}
                        </span>
                      </button>
                    </div>

                    <div className="review-action-row review-action-row--commit">
                      <button
                        type="button"
                        className="review-action-button review-action-button--save"
                        onClick={() => void handleSaveDraft(recording)}
                        disabled={Boolean(savingRecordingId) || Boolean(deletingRecordingId)}
                      >
                        {savingRecordingId === recording.id ? 'Saving...' : 'Save Progress'}
                      </button>

                      <button
                        type="button"
                        className="review-action-button review-action-button--verify"
                        onClick={() => void handleApprove(recording)}
                        disabled={
                          !canVerify ||
                          Boolean(verifyingRecordingId) ||
                          Boolean(deletingRecordingId)
                        }
                      >
                        <IonIcon aria-hidden icon={checkmarkOutline} />
                        <span>
                          {verifyingRecordingId === recording.id
                            ? 'Verifying...'
                            : recording.isVerified
                              ? 'Update Verified Transcript'
                              : 'Confirm Transcript'}
                        </span>
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {reviewPagination.totalPages > 1 ? (
          <footer className="review-pagination" aria-label="Review queue pagination">
            <button
              type="button"
              className="studio-pagination-button"
              onClick={() => {
                triggerHapticFeedback('light');
                setPage((current) => Math.max(1, current - 1));
              }}
              disabled={reviewPagination.currentPage <= 1}
            >
              Previous
            </button>
            <span className="studio-pagination-label">
              Page {reviewPagination.currentPage} of {reviewPagination.totalPages}
            </span>
            <button
              type="button"
              className="studio-pagination-button"
              onClick={() => {
                triggerHapticFeedback('light');
                setPage((current) => Math.min(reviewPagination.totalPages, current + 1));
              }}
              disabled={reviewPagination.currentPage >= reviewPagination.totalPages}
            >
              Next
            </button>
          </footer>
        ) : null}
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
