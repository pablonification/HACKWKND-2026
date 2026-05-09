import { IonAlert, IonSpinner, IonToast } from '@ionic/react';
import type { CSSProperties, ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import cameraImg from '../../assets/camera.png';
import taviImg from '../../assets/tavi.png';
import {
  coachWithTavi,
  type CoachAnswerLanguage,
  type CoachClientAction,
  type CoachMode,
  type CoachSessionPhase,
  type CoachTurnInput,
  type LearningTrack,
} from '../lib/aiCoach';
import { triggerHapticFeedback } from '../lib/feedback';
import { buildAiSearchParams, isExploreEntry } from '../lib/navigationEntry';
import { getJSON, setJSON } from '../lib/storage';
import {
  appendTaviMessage,
  buildThreadTitle,
  createTaviThread,
  isTaviPersistenceUnavailable,
  listTaviThreads,
  loadTaviMessages,
  renameTaviThread,
  softDeleteTaviThread,
  updateTaviThreadState,
  type TaviThreadSummary,
} from '../lib/taviThreads';
import { useEdgeSwipeBack } from '../lib/useEdgeSwipeBack';
import { useAuthStore } from '../stores/authStore';

import './AiHelperPage.css';

const TAVI_SESSION_STATE_KEY = 'tavi-session-state-v1';

type MessageRole = 'user' | 'tavi';

type Message = {
  id: string;
  role: MessageRole;
  text: string;
  packageEligible?: boolean;
  translation?: string | null;
  translationLabel?: string;
  coachNote?: string | null;
  followUpPrompt?: string | null;
  warning?: string | null;
  mode?: CoachMode;
  answerLanguage?: CoachAnswerLanguage;
  sessionPhase?: CoachSessionPhase;
  track?: LearningTrack;
  loading?: boolean;
};

type PersistedTaviSession = {
  sessionPhase: CoachSessionPhase;
  track: LearningTrack;
};

type RetryPayload = {
  action?: CoachClientAction;
  textOverride: string;
  trackOverride: LearningTrack;
};

const ACTION_LABEL: Record<CoachClientAction, string> = {
  start_session: 'Start Learning',
  continue_session: 'Continue',
  end_session: 'End Session',
  translate_inline: 'Translate Phrase',
  start_easy: 'Start Easy',
  practice_greetings: 'Practice Greetings',
  make_plan: 'Make a Plan',
  slow_down: 'Slow Down',
  explain_first: 'Explain First',
  try_again: 'Try Again',
};

const createId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
};

const getDisplayName = (email: string | undefined, fullName: unknown): string => {
  if (typeof fullName === 'string' && fullName.trim()) {
    return fullName.trim().split(/\s+/)[0] ?? 'Taleka';
  }

  if (typeof email === 'string' && email.trim()) {
    return email.split('@')[0] ?? 'Taleka';
  }

  return 'Taleka';
};

const renderMarkdownInline = (value: string): ReactNode[] => {
  const nodes: ReactNode[] = [];
  const pattern =
    /(\[([^\]]+)\]\((https?:\/\/[^)\s]+)\))|(`([^`]+)`)|(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(_([^_]+)_)|(~~([^~]+)~~)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null = null;

  while ((match = pattern.exec(value)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(value.slice(lastIndex, match.index));
    }

    if (match[2] && match[3]) {
      nodes.push(
        <a
          key={`link-${match.index}`}
          className="tavi-markdown-link"
          href={match[3]}
          target="_blank"
          rel="noreferrer"
        >
          {match[2]}
        </a>,
      );
    } else if (match[5]) {
      nodes.push(
        <code key={`code-${match.index}`} className="tavi-markdown-code">
          {match[5]}
        </code>,
      );
    } else if (match[7]) {
      nodes.push(
        <strong key={`strong-${match.index}`} className="tavi-markdown-strong">
          {match[7]}
        </strong>,
      );
    } else if (match[9]) {
      nodes.push(
        <em key={`em-asterisk-${match.index}`} className="tavi-markdown-emphasis">
          {match[9]}
        </em>,
      );
    } else if (match[11]) {
      nodes.push(
        <em key={`em-underscore-${match.index}`} className="tavi-markdown-emphasis">
          {match[11]}
        </em>,
      );
    } else if (match[13]) {
      nodes.push(
        <s key={`strike-${match.index}`} className="tavi-markdown-strike">
          {match[13]}
        </s>,
      );
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < value.length) {
    nodes.push(value.slice(lastIndex));
  }

  return nodes;
};

const renderMarkdown = (value: string, keyPrefix: string): ReactNode => {
  const lines = value.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items: ReactNode[] = [];
      let listIndex = index;
      while (listIndex < lines.length && /^[-*]\s+/.test(lines[listIndex].trim())) {
        const itemText = lines[listIndex].trim().replace(/^[-*]\s+/, '');
        items.push(<li key={`${keyPrefix}-li-${listIndex}`}>{renderMarkdownInline(itemText)}</li>);
        listIndex += 1;
      }
      blocks.push(
        <ul key={`${keyPrefix}-ul-${index}`} className="tavi-markdown-list">
          {items}
        </ul>,
      );
      index = listIndex;
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items: ReactNode[] = [];
      let listIndex = index;
      while (listIndex < lines.length && /^\d+\.\s+/.test(lines[listIndex].trim())) {
        const itemText = lines[listIndex].trim().replace(/^\d+\.\s+/, '');
        items.push(<li key={`${keyPrefix}-oli-${listIndex}`}>{renderMarkdownInline(itemText)}</li>);
        listIndex += 1;
      }
      blocks.push(
        <ol
          key={`${keyPrefix}-ol-${index}`}
          className="tavi-markdown-list tavi-markdown-list--ordered"
        >
          {items}
        </ol>,
      );
      index = listIndex;
      continue;
    }

    if (/^>\s+/.test(trimmed)) {
      const quoteLines: string[] = [];
      let quoteIndex = index;
      while (quoteIndex < lines.length && /^>\s+/.test(lines[quoteIndex].trim())) {
        quoteLines.push(lines[quoteIndex].trim().replace(/^>\s+/, ''));
        quoteIndex += 1;
      }
      blocks.push(
        <blockquote key={`${keyPrefix}-quote-${index}`} className="tavi-markdown-quote">
          {quoteLines.map((quoteLine, quoteLineIndex) => (
            <p key={`${keyPrefix}-quote-line-${index}-${quoteLineIndex}`}>
              {renderMarkdownInline(quoteLine)}
            </p>
          ))}
        </blockquote>,
      );
      index = quoteIndex;
      continue;
    }

    const paragraphLines = [trimmed];
    let paragraphIndex = index + 1;
    while (
      paragraphIndex < lines.length &&
      lines[paragraphIndex].trim() &&
      !/^[-*]\s+/.test(lines[paragraphIndex].trim()) &&
      !/^\d+\.\s+/.test(lines[paragraphIndex].trim()) &&
      !/^>\s+/.test(lines[paragraphIndex].trim())
    ) {
      paragraphLines.push(lines[paragraphIndex].trim());
      paragraphIndex += 1;
    }

    blocks.push(
      <p key={`${keyPrefix}-p-${index}`} className="tavi-markdown-paragraph">
        {paragraphLines.map((paragraphLine, paragraphLineIndex) => (
          <span key={`${keyPrefix}-span-${index}-${paragraphLineIndex}`}>
            {paragraphLineIndex > 0 ? <br /> : null}
            {renderMarkdownInline(paragraphLine)}
          </span>
        ))}
      </p>,
    );
    index = paragraphIndex;
  }

  return blocks;
};

function TaviIntro({
  onStart,
  onBack,
  showBackButton,
}: {
  onStart: () => void;
  onBack: () => void;
  showBackButton: boolean;
}) {
  return (
    <div className="tavi-intro">
      <header className="tavi-intro-header">
        {showBackButton ? (
          <button className="tavi-back-button" aria-label="Go back" onClick={onBack}>
            <span className="tavi-back-chevron" aria-hidden="true" />
          </button>
        ) : (
          <span className="tavi-back-button tavi-back-button--spacer" aria-hidden="true" />
        )}
        <span className="tavi-intro-header-pill">Personal AI Buddy</span>
        <div className="tavi-back-button tavi-back-button--spacer" aria-hidden="true" />
      </header>

      <div className="tavi-intro-mascot-wrap">
        <div className="tavi-intro-aura" />
        <img src={taviImg} alt="Tavi the monkey mascot" className="tavi-intro-mascot" />
      </div>

      <div className="tavi-intro-text">
        <h1>
          Meet <span className="tavi-intro-name">Tavi</span>
        </h1>
        <p className="tavi-intro-subtitle">
          Your personal <br /> language companion
        </p>
        <p className="tavi-intro-desc">
          Chat naturally, get grounded answers, and keep practicing Semai one conversation at a
          time.
        </p>
        <button className="tavi-intro-cta" onClick={onStart}>
          Get Started
        </button>
      </div>
    </div>
  );
}

function ChatBubble({
  message,
  onUseFollowUp,
  isSending,
}: {
  message: Message;
  onUseFollowUp: (messageId: string, prompt: string) => void;
  isSending: boolean;
}) {
  const isTavi = message.role === 'tavi';

  if (isTavi) {
    const shouldRenderPackage = Boolean(message.packageEligible);
    return (
      <>
        <div className="tavi-bubble-row tavi-bubble-row--tavi">
          <img src={taviImg} alt="Tavi" className="tavi-bubble-avatar" />

          <div className="tavi-bubble-tavi-stack">
            <div className="tavi-bubble tavi-bubble--tavi-reply">
              {message.loading ? (
                <div className="tavi-bubble-loading">
                  <span />
                  <span />
                  <span />
                </div>
              ) : (
                <div className="tavi-bubble-text">
                  {renderMarkdown(message.text, `${message.id}-main`)}
                </div>
              )}
            </div>

            {!message.loading && shouldRenderPackage && message.translation ? (
              <div className="tavi-bubble tavi-bubble--translation">
                <p className="tavi-bubble-translation-label">
                  {message.translationLabel ?? 'Translation'}
                </p>
                <div className="tavi-bubble-text">
                  {renderMarkdown(message.translation, `${message.id}-translation`)}
                </div>
              </div>
            ) : null}

            {!message.loading && shouldRenderPackage && message.coachNote ? (
              <div className="tavi-bubble tavi-bubble--meta">
                <p className="tavi-bubble-meta-label">Coach note</p>
                <div className="tavi-bubble-text">
                  {renderMarkdown(message.coachNote, `${message.id}-coach-note`)}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {!message.loading && message.followUpPrompt ? (
          <div className="tavi-bubble-row tavi-bubble-row--suggestion">
            <div className="tavi-suggested-reply">
              <span className="tavi-suggested-reply-label">Tap to send</span>
              <button
                type="button"
                className="tavi-bubble-chip"
                disabled={isSending}
                onClick={() => onUseFollowUp(message.id, message.followUpPrompt ?? '')}
              >
                <span>{message.followUpPrompt}</span>
                <span className="tavi-bubble-chip-arrow" aria-hidden="true">
                  +
                </span>
              </button>
            </div>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <div className="tavi-bubble-row tavi-bubble-row--user">
      <div className="tavi-bubble tavi-bubble--user">
        <div className="tavi-bubble-text">{renderMarkdown(message.text, `${message.id}-user`)}</div>
      </div>
    </div>
  );
}

function ThreadDrawer({
  isOpen,
  threads,
  activeThreadId,
  isLoading,
  onClose,
  onNewThread,
  onSelectThread,
  onRenameThread,
  onDeleteThread,
}: {
  isOpen: boolean;
  threads: TaviThreadSummary[];
  activeThreadId: string | null;
  isLoading: boolean;
  onClose: () => void;
  onNewThread: () => void;
  onSelectThread: (threadId: string) => void;
  onRenameThread: (thread: TaviThreadSummary) => void;
  onDeleteThread: (thread: TaviThreadSummary) => void;
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="tavi-thread-drawer" role="dialog" aria-modal="true" aria-label="Chat history">
      <button
        className="tavi-thread-drawer-backdrop"
        aria-label="Close history"
        onClick={onClose}
      />
      <section className="tavi-thread-panel">
        <div className="tavi-thread-panel-header">
          <div>
            <p className="tavi-thread-panel-kicker">Tavi chats</p>
            <h2>History</h2>
          </div>
          <button type="button" className="tavi-thread-close" aria-label="Close" onClick={onClose}>
            x
          </button>
        </div>

        <button type="button" className="tavi-thread-new" onClick={onNewThread}>
          New chat
        </button>

        <div className="tavi-thread-list">
          {isLoading ? <p className="tavi-thread-empty">Loading chats...</p> : null}
          {!isLoading && threads.length === 0 ? (
            <p className="tavi-thread-empty">No saved chats yet.</p>
          ) : null}
          {threads.map((thread) => (
            <div
              key={thread.id}
              className={`tavi-thread-item${thread.id === activeThreadId ? ' is-active' : ''}`}
            >
              <button
                type="button"
                className="tavi-thread-select"
                onClick={() => onSelectThread(thread.id)}
              >
                <span>{thread.title}</span>
                <small>{new Date(thread.lastMessageAt).toLocaleDateString()}</small>
              </button>
              <div className="tavi-thread-actions">
                <button type="button" onClick={() => onRenameThread(thread)}>
                  Rename
                </button>
                <button type="button" onClick={() => onDeleteThread(thread)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function AiHelperPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [threads, setThreads] = useState<TaviThreadSummary[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [isThreadDrawerOpen, setIsThreadDrawerOpen] = useState(false);
  const [threadPendingRename, setThreadPendingRename] = useState<TaviThreadSummary | null>(null);
  const [isThreadLoading, setIsThreadLoading] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [retryPayload, setRetryPayload] = useState<RetryPayload | null>(null);
  const [sessionPhase, setSessionPhase] = useState<CoachSessionPhase>('idle');
  const [track, setTrack] = useState<LearningTrack>('vocabulary_first');
  const [nextActions, setNextActions] = useState<CoachClientAction[]>([
    'start_easy',
    'practice_greetings',
    'make_plan',
    'translate_inline',
  ]);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const activeThreadIdRef = useRef<string | null>(null);
  const hasAutoFocusedChatRef = useRef(false);
  const [isInitialFocusLockActive, setIsInitialFocusLockActive] = useState(true);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const isSendingRef = useRef(false);

  const displayName = useMemo(
    () => getDisplayName(user?.email, user?.user_metadata?.full_name),
    [user?.email, user?.user_metadata?.full_name],
  );
  const fromExplore = isExploreEntry(searchParams);
  const showIntro = searchParams.get('chat') !== '1';
  const chatOuterStyle: CSSProperties & Record<'--tavi-keyboard-offset', string> = {
    '--tavi-keyboard-offset': `${keyboardInset}px`,
  };

  useEffect(() => {
    isSendingRef.current = isSending;
  }, [isSending]);

  useEffect(() => {
    activeThreadIdRef.current = activeThreadId;
  }, [activeThreadId]);

  const refreshThreads = useCallback(async () => {
    if (!user?.id) {
      setThreads([]);
      return [];
    }

    const nextThreads = await listTaviThreads();
    setThreads(nextThreads);
    return nextThreads;
  }, [user?.id]);

  const updateThreadParam = useCallback(
    (threadId: string | null, replace = true) => {
      const nextParams = buildAiSearchParams({ chat: '1' }, searchParams);
      nextParams.delete('new');
      if (threadId) {
        nextParams.set('thread', threadId);
      } else {
        nextParams.delete('thread');
      }
      if (nextParams.toString() === searchParams.toString()) {
        return;
      }
      setSearchParams(nextParams, { replace });
    },
    [searchParams, setSearchParams],
  );

  const updateNewThreadParam = useCallback(() => {
    const nextParams = buildAiSearchParams({ chat: '1' }, searchParams);
    nextParams.delete('thread');
    nextParams.set('new', '1');
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const hydrateThread = useCallback(
    async (thread: TaviThreadSummary) => {
      setIsThreadLoading(true);
      setSendError(null);
      setRetryPayload(null);
      setNotice(null);

      try {
        const persistedMessages = await loadTaviMessages(thread.id);
        setActiveThreadId(thread.id);
        setMessages(
          persistedMessages.map((message) => ({
            id: message.id,
            role: message.role,
            text: message.text,
            packageEligible: message.packageEligible,
            translation: message.translation,
            translationLabel: message.translationLabel ?? undefined,
            coachNote: message.coachNote,
            followUpPrompt: message.followUpPrompt,
            warning: message.warning,
            mode: message.mode ?? undefined,
            answerLanguage: message.answerLanguage ?? undefined,
            sessionPhase: message.sessionPhase ?? undefined,
            track: message.track ?? undefined,
          })),
        );
        setSessionPhase(thread.sessionPhase);
        setTrack(thread.track);
        updateThreadParam(thread.id);
      } catch (error) {
        if (isTaviPersistenceUnavailable(error)) {
          setActiveThreadId(null);
          setMessages([]);
          return;
        }

        const message = error instanceof Error ? error.message : 'Could not load this chat.';
        setNotice(message);
      } finally {
        setIsThreadLoading(false);
      }
    },
    [updateThreadParam],
  );

  const navigateBackFromExplore = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate('/home/landing', { replace: true });
  };

  const edgeSwipeBackHandlers = useEdgeSwipeBack({
    enabled: fromExplore && showIntro,
    onBack: navigateBackFromExplore,
  });

  useEffect(() => {
    void getJSON<PersistedTaviSession>(TAVI_SESSION_STATE_KEY, {
      sessionPhase: 'idle',
      track: 'vocabulary_first',
    }).then((persisted) => {
      setSessionPhase(persisted.sessionPhase);
      setTrack(persisted.track);
    });
  }, []);

  useEffect(() => {
    if (showIntro || !user?.id) {
      return;
    }

    let isCancelled = false;
    setIsThreadLoading(true);

    void listTaviThreads()
      .then(async (nextThreads) => {
        if (isCancelled) {
          return;
        }

        if (isSendingRef.current) {
          setThreads(nextThreads);
          return;
        }

        setThreads(nextThreads);
        const requestedThreadId = searchParams.get('thread');
        if (requestedThreadId && requestedThreadId === activeThreadIdRef.current) {
          return;
        }

        const isDraftThread = searchParams.get('new') === '1';
        if (isDraftThread) {
          setActiveThreadId(null);
          setMessages([]);
          setSessionPhase('idle');
          setTrack('vocabulary_first');
          setNextActions(['start_easy', 'practice_greetings', 'make_plan', 'translate_inline']);
          return;
        }

        const requestedThread = requestedThreadId
          ? nextThreads.find((thread) => thread.id === requestedThreadId)
          : null;
        const threadToLoad = requestedThread ?? nextThreads[0] ?? null;

        if (!threadToLoad) {
          setActiveThreadId(null);
          setMessages([]);
          updateThreadParam(null);
          return;
        }

        const persistedMessages = await loadTaviMessages(threadToLoad.id);
        if (isCancelled) {
          return;
        }

        setActiveThreadId(threadToLoad.id);
        setMessages(
          persistedMessages.map((message) => ({
            id: message.id,
            role: message.role,
            text: message.text,
            packageEligible: message.packageEligible,
            translation: message.translation,
            translationLabel: message.translationLabel ?? undefined,
            coachNote: message.coachNote,
            followUpPrompt: message.followUpPrompt,
            warning: message.warning,
            mode: message.mode ?? undefined,
            answerLanguage: message.answerLanguage ?? undefined,
            sessionPhase: message.sessionPhase ?? undefined,
            track: message.track ?? undefined,
          })),
        );
        setSessionPhase(threadToLoad.sessionPhase);
        setTrack(threadToLoad.track);
        updateThreadParam(threadToLoad.id);
      })
      .catch((error: unknown) => {
        if (isCancelled) {
          return;
        }
        if (isTaviPersistenceUnavailable(error)) {
          setActiveThreadId(null);
          setMessages([]);
          setThreads([]);
          return;
        }
        const message = error instanceof Error ? error.message : 'Could not load chat history.';
        setNotice(message);
      })
      .finally(() => {
        if (!isCancelled) {
          setIsThreadLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [showIntro, user?.id, searchParams, updateThreadParam]);

  useEffect(() => {
    void setJSON(TAVI_SESSION_STATE_KEY, {
      sessionPhase,
      track,
    } satisfies PersistedTaviSession);
  }, [sessionPhase, track]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (showIntro) {
      hasAutoFocusedChatRef.current = false;
      setIsInitialFocusLockActive(true);
      setIsKeyboardOpen(false);
      setKeyboardInset(0);
      return;
    }

    if (hasAutoFocusedChatRef.current) {
      return;
    }

    const focusTimer = window.setTimeout(() => {
      const input = inputRef.current;
      if (!input) {
        return;
      }

      input.focus({ preventScroll: true });
      const currentLength = input.value.length;
      input.setSelectionRange(currentLength, currentLength);
      hasAutoFocusedChatRef.current = true;
    }, 120);

    return () => {
      window.clearTimeout(focusTimer);
    };
  }, [showIntro]);

  useEffect(() => {
    if (
      showIntro ||
      typeof window === 'undefined' ||
      typeof window.visualViewport === 'undefined'
    ) {
      return;
    }

    const viewport = window.visualViewport;
    if (!viewport) {
      return;
    }

    const keyboardThreshold = 120;
    const updateKeyboardState = () => {
      const inset = Math.max(
        0,
        Math.round(window.innerHeight - viewport.height - viewport.offsetTop),
      );
      const keyboardVisible = inset > keyboardThreshold;
      setIsKeyboardOpen(keyboardVisible);
      setKeyboardInset(keyboardVisible ? inset : 0);
    };

    updateKeyboardState();
    const handleViewportChange = () => {
      window.requestAnimationFrame(() => {
        updateKeyboardState();
      });
    };

    viewport.addEventListener('resize', handleViewportChange);
    viewport.addEventListener('scroll', handleViewportChange);

    return () => {
      viewport.removeEventListener('resize', handleViewportChange);
      viewport.removeEventListener('scroll', handleViewportChange);
      setIsKeyboardOpen(false);
      setKeyboardInset(0);
    };
  }, [showIntro]);

  const handleBack = () => {
    triggerHapticFeedback('light');
    if (fromExplore) {
      navigateBackFromExplore();
      return;
    }

    navigate('/home/garden', { replace: true });
  };

  const handleStartChat = async () => {
    triggerHapticFeedback('medium');
    setSearchParams(buildAiSearchParams({ chat: '1' }, searchParams), { replace: true });
  };

  const handleOpenThreads = () => {
    triggerHapticFeedback('light');
    setIsThreadDrawerOpen(true);
    void refreshThreads().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Could not refresh chats.';
      setNotice(message);
    });
  };

  const handleNewThread = () => {
    triggerHapticFeedback('medium');
    activeThreadIdRef.current = null;
    setActiveThreadId(null);
    setMessages([]);
    setSessionPhase('idle');
    setTrack('vocabulary_first');
    setNextActions(['start_easy', 'practice_greetings', 'make_plan', 'translate_inline']);
    setIsThreadDrawerOpen(false);
    updateNewThreadParam();
  };

  const handleSelectThread = (threadId: string) => {
    const thread = threads.find((item) => item.id === threadId);
    if (!thread) {
      return;
    }

    triggerHapticFeedback('light');
    setIsThreadDrawerOpen(false);
    void hydrateThread(thread);
  };

  const handleRenameThread = (thread: TaviThreadSummary) => {
    triggerHapticFeedback('light');
    setThreadPendingRename(thread);
  };

  const handleRenameThreadConfirm = (title: string) => {
    const thread = threadPendingRename;
    setThreadPendingRename(null);

    if (!thread) {
      return;
    }

    const nextTitle = buildThreadTitle(title);
    if (!nextTitle || nextTitle === thread.title) {
      return;
    }

    triggerHapticFeedback('light');
    void renameTaviThread(thread.id, nextTitle)
      .then(async () => {
        await refreshThreads();
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Could not rename chat.';
        setNotice(message);
      });
  };

  const handleDeleteThread = (thread: TaviThreadSummary) => {
    const shouldDelete = window.confirm(`Delete "${thread.title}" from your chat history?`);
    if (!shouldDelete) {
      return;
    }

    triggerHapticFeedback('medium');
    void softDeleteTaviThread(thread.id)
      .then(async () => {
        const nextThreads = await refreshThreads();
        if (activeThreadId !== thread.id) {
          return;
        }

        const nextThread = nextThreads.find((item) => item.id !== thread.id) ?? null;
        if (nextThread) {
          await hydrateThread(nextThread);
          return;
        }

        handleNewThread();
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Could not delete chat.';
        setNotice(message);
      });
  };

  const handleUseFollowUp = (messageId: string, prompt: string) => {
    if (isSending) {
      return;
    }

    setMessages((prev) =>
      prev.map((message) =>
        message.id === messageId ? { ...message, followUpPrompt: null } : message,
      ),
    );
    triggerHapticFeedback('light');
    void handleSend({ textOverride: prompt });
  };

  const buildSessionStartMarker = (
    answerLanguage: CoachAnswerLanguage,
    markerTrack: LearningTrack,
  ): Message => ({
    id: createId(),
    role: 'tavi',
    text:
      answerLanguage === 'ms'
        ? 'Baik, kita mula perlahan-lahan dengan satu item sahaja.'
        : "Great, let's start gently with just one item.",
    mode: 'direct_help',
    sessionPhase: 'learning_active',
    track: markerTrack,
  });

  const buildCoachTurns = (history: Message[]): CoachTurnInput[] =>
    history
      .filter((message) => !message.loading)
      .map((message) => ({
        role: message.role === 'tavi' ? 'assistant' : 'user',
        text: message.text,
        mode: message.mode,
        sessionPhase: message.sessionPhase,
        track: message.track,
      }));

  const handleSend = async (options?: {
    action?: CoachClientAction;
    textOverride?: string;
    trackOverride?: LearningTrack;
  }) => {
    const text = (options?.textOverride ?? inputText).trim();
    const action = options?.action;
    if ((!text && !action) || isSending) {
      return;
    }
    if (action === 'translate_inline' && !text) {
      setNotice('Type the phrase you want to translate, then tap Translate Phrase.');
      inputRef.current?.focus();
      return;
    }

    const requestedTrack = options?.trackOverride ?? track;
    const actionMessage: Record<CoachClientAction, string> = {
      start_session: "Let's go.",
      continue_session: 'Continue.',
      end_session: 'I want to end this session.',
      translate_inline: text,
      start_easy: 'Start with a very easy Semai practice item.',
      practice_greetings: 'Practice basic Semai greetings.',
      make_plan: 'Make me a simple Semai learning plan.',
      slow_down: 'Slow down and guide me gently.',
      explain_first: 'Explain the basics first before practice.',
      try_again: 'Try again, but do not start too fast.',
    };
    const textForRequest = text || (action ? actionMessage[action] : '');
    const renderedUserText =
      text || (action && action !== 'translate_inline' ? ACTION_LABEL[action] : '');
    const shouldRenderUserMessage = Boolean(renderedUserText);
    const previousPhase = sessionPhase;
    const historyForRequest = [
      ...buildCoachTurns(messages),
      ...(shouldRenderUserMessage
        ? [{ role: 'user', text: renderedUserText } as CoachTurnInput]
        : []),
    ];

    const userMessage: Message | null = shouldRenderUserMessage
      ? { id: createId(), role: 'user', text: renderedUserText }
      : null;
    const loadingMessage: Message = {
      id: createId(),
      role: 'tavi',
      text: '',
      loading: true,
    };

    if (!options?.textOverride) {
      setInputText('');
    }

    if (isInitialFocusLockActive) {
      setIsInitialFocusLockActive(false);
    }

    if (shouldRenderUserMessage || action) {
      inputRef.current?.blur();
    }

    setIsSending(true);
    isSendingRef.current = true;
    setSendError(null);
    setRetryPayload(null);
    setNotice(null);
    triggerHapticFeedback('light');
    setMessages((prev) => [
      ...prev.map((message) => ({ ...message, followUpPrompt: null })),
      ...(userMessage ? [userMessage] : []),
      loadingMessage,
    ]);

    try {
      let threadIdForSend = activeThreadId;
      if (user?.id) {
        try {
          if (!threadIdForSend) {
            const newThread = await createTaviThread({
              userId: user.id,
              title: renderedUserText ? buildThreadTitle(renderedUserText) : 'New chat',
              sessionPhase,
              track: requestedTrack,
            });
            threadIdForSend = newThread.id;
            activeThreadIdRef.current = newThread.id;
            setActiveThreadId(newThread.id);
            setThreads((prev) => [newThread, ...prev]);
          }

          if (threadIdForSend && userMessage) {
            await appendTaviMessage({
              threadId: threadIdForSend,
              userId: user.id,
              message: userMessage,
            });
          }
        } catch (error) {
          if (!isTaviPersistenceUnavailable(error)) {
            console.warn('Could not persist Tavi user message:', error);
          }
          threadIdForSend = null;
        }
      }

      const response = await coachWithTavi({
        message: textForRequest,
        turns: historyForRequest,
        clientAction: action,
        track: requestedTrack,
      });

      const translationLabel =
        response.answerLanguage === 'semai' ? 'Translation' : 'Source phrase';
      const didStartSession =
        previousPhase !== 'learning_active' && response.sessionPhase === 'learning_active';
      const semaiVerified = response.meta?.semai_verified === true;
      const serverPackageEligible = response.meta?.package_eligible === true;
      const packageEligible = semaiVerified && serverPackageEligible;
      const markerMessage = didStartSession
        ? buildSessionStartMarker(response.answerLanguage, response.track)
        : null;
      const taviMessage: Message = {
        ...loadingMessage,
        text: response.mainReply,
        packageEligible,
        translation: response.translation,
        translationLabel,
        coachNote: response.coachNote,
        followUpPrompt: response.followUpPrompt,
        warning: response.warning ?? null,
        answerLanguage: response.answerLanguage,
        mode: response.mode,
        sessionPhase: response.sessionPhase,
        track: response.track,
        loading: false,
      };

      setMessages((prev) => {
        const next: Message[] = [];
        for (const message of prev) {
          if (message.id !== loadingMessage.id) {
            next.push(message);
            continue;
          }

          if (markerMessage) {
            next.push(markerMessage);
          }

          next.push(taviMessage);
        }
        return next;
      });
      setSessionPhase(response.sessionPhase);
      setTrack(response.track);
      setNextActions(response.nextActions);

      if (user?.id && threadIdForSend) {
        try {
          if (markerMessage) {
            await appendTaviMessage({
              threadId: threadIdForSend,
              userId: user.id,
              message: markerMessage,
            });
          }

          await appendTaviMessage({
            threadId: threadIdForSend,
            userId: user.id,
            message: taviMessage,
          });
          await updateTaviThreadState({
            threadId: threadIdForSend,
            sessionPhase: response.sessionPhase,
            track: response.track,
            title:
              messages.length === 0 && renderedUserText
                ? buildThreadTitle(renderedUserText)
                : undefined,
          });
          updateThreadParam(threadIdForSend);
          await refreshThreads();
        } catch (error) {
          if (!isTaviPersistenceUnavailable(error)) {
            console.warn('Could not persist Tavi response:', error);
          }
        }
      }

      if (response.provider === 'client-fallback') {
        setNotice('Tavi used grounded fallback content for this reply.');
      }

      triggerHapticFeedback('success');
    } catch (sendError) {
      const message = sendError instanceof Error ? sendError.message : 'Tavi could not respond.';
      setSendError(
        /worker_limit|cpu|timed out|network|fetch|edge function/i.test(message)
          ? 'Tavi is temporarily busy. Your message is kept. Tap Retry.'
          : message,
      );
      setRetryPayload({
        action,
        textOverride: text,
        trackOverride: requestedTrack,
      });
      setMessages((prev) => prev.filter((message) => message.id !== loadingMessage.id));
      if (text) {
        setInputText(text);
      }
      triggerHapticFeedback('error');
    } finally {
      setIsSending(false);
      isSendingRef.current = false;
    }
  };

  const handleRetrySend = () => {
    if (!retryPayload || isSending) {
      return;
    }
    triggerHapticFeedback('light');
    void handleSend(retryPayload);
  };

  const handleQuickAction = (action: CoachClientAction) => {
    triggerHapticFeedback('light');
    if (action === 'translate_inline') {
      void handleSend({ action, trackOverride: track });
      return;
    }

    void handleSend({ action, textOverride: '', trackOverride: track });
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void handleSend();
    }
  };

  const handleAttachMedia = () => {
    setNotice('Voice/camera in AI coach is coming soon.');
    triggerHapticFeedback('light');
  };

  if (showIntro) {
    return (
      <div {...edgeSwipeBackHandlers}>
        <TaviIntro
          onStart={() => void handleStartChat()}
          onBack={handleBack}
          showBackButton={fromExplore}
        />
      </div>
    );
  }

  return (
    <div className="tavi-chat-outer" style={chatOuterStyle}>
      <div className="tavi-chat-shell">
        <header className="tavi-chat-header">
          <button
            className="tavi-back-button"
            aria-label="Go back to intro"
            onClick={() => {
              triggerHapticFeedback('light');
              setSearchParams(buildAiSearchParams({}, searchParams), { replace: true });
            }}
          >
            <span className="tavi-back-chevron" aria-hidden="true" />
          </button>
          <span className="tavi-intro-header-pill">Personal AI Buddy</span>
          <button
            type="button"
            className="tavi-thread-menu-button"
            aria-label="Open chat history"
            onClick={handleOpenThreads}
          >
            <span />
            <span />
            <span />
          </button>
        </header>

        <ThreadDrawer
          isOpen={isThreadDrawerOpen}
          threads={threads}
          activeThreadId={activeThreadId}
          isLoading={isThreadLoading}
          onClose={() => setIsThreadDrawerOpen(false)}
          onNewThread={handleNewThread}
          onSelectThread={handleSelectThread}
          onRenameThread={handleRenameThread}
          onDeleteThread={handleDeleteThread}
        />
        <IonAlert
          isOpen={Boolean(threadPendingRename)}
          header="Rename chat"
          inputs={[
            {
              name: 'title',
              type: 'text',
              value: threadPendingRename?.title ?? '',
              placeholder: 'Chat title',
            },
          ]}
          buttons={[
            {
              text: 'Cancel',
              role: 'cancel',
            },
            {
              text: 'Save',
              role: 'confirm',
              handler: (value: { title?: string }) => {
                handleRenameThreadConfirm(value.title ?? '');
              },
            },
          ]}
          onDidDismiss={() => setThreadPendingRename(null)}
        />

        {isThreadLoading && messages.length === 0 ? (
          <div className="tavi-chat-history-loading">
            <IonSpinner name="crescent" style={{ width: 22, height: 22, color: '#cb403c' }} />
          </div>
        ) : null}

        {!isThreadLoading && messages.length === 0 ? (
          <div className="tavi-chat-greeting">
            <h2 className="tavi-chat-greeting-title">
              Hello, <br />
              <span>{displayName}!</span>
            </h2>
            <p className="tavi-chat-greeting-sub">
              Let&apos;s grow your language journey. Every word you learn keeps a voice alive.
            </p>
          </div>
        ) : null}

        <div
          className="tavi-chat-messages"
          onPointerDown={() => {
            const input = inputRef.current;
            if (!input || isInitialFocusLockActive) {
              return;
            }

            if (document.activeElement === input) {
              input.blur();
            }
          }}
        >
          {messages.map((message) => (
            <ChatBubble
              key={message.id}
              message={message}
              onUseFollowUp={handleUseFollowUp}
              isSending={isSending}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div
          className={`tavi-chat-inputbar${isKeyboardOpen || isInputFocused ? ' is-keyboard-open' : ''}`}
        >
          <button
            type="button"
            className="tavi-chat-inputbar-icon tavi-chat-inputbar-icon--coming-soon"
            aria-label="Attach media"
            onClick={handleAttachMedia}
          >
            <img src={cameraImg} alt="" width={28} height={28} />
          </button>

          <div className="tavi-chat-inputbar-right">
            {sendError ? (
              <div className="tavi-inline-error" role="alert">
                <span>{sendError}</span>
                <button type="button" onClick={handleRetrySend} disabled={isSending}>
                  Retry
                </button>
              </div>
            ) : null}
            <div className="tavi-quick-actions" role="group" aria-label="Coach quick actions">
              {nextActions.map((action) => (
                <button
                  key={action}
                  type="button"
                  className="tavi-quick-action-chip"
                  onClick={() => handleQuickAction(action)}
                  disabled={isSending}
                >
                  {ACTION_LABEL[action]}
                </button>
              ))}
            </div>
            <textarea
              ref={inputRef}
              className="tavi-chat-input"
              placeholder="Write your message here"
              value={inputText}
              rows={1}
              enterKeyHint="send"
              onChange={(event) => setInputText(event.target.value)}
              onFocus={() => {
                setIsInputFocused(true);
                if (sendError) {
                  setSendError(null);
                }
              }}
              onBlur={() => {
                setIsInputFocused(false);
                if (!isInitialFocusLockActive) {
                  return;
                }

                window.setTimeout(() => {
                  const input = inputRef.current;
                  if (!input) {
                    return;
                  }

                  input.focus({ preventScroll: true });
                  const currentLength = input.value.length;
                  input.setSelectionRange(currentLength, currentLength);
                }, 0);
              }}
              onKeyDown={handleKeyDown}
            />
            <button
              type="button"
              className="tavi-chat-inputbar-send"
              onClick={() => void handleSend()}
              disabled={isSending || !inputText.trim()}
              aria-label="Send message"
            >
              {isSending ? (
                <IonSpinner name="crescent" style={{ width: 18, height: 18, color: '#cb403c' }} />
              ) : (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#cb403c"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      <IonToast
        isOpen={Boolean(notice)}
        message={notice ?? ''}
        duration={3200}
        color="warning"
        onDidDismiss={() => setNotice(null)}
      />
    </div>
  );
}
