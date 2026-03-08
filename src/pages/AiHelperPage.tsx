import { IonSpinner, IonToast } from '@ionic/react';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

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
import { getBoolean, getJSON, setBoolean, setJSON } from '../lib/storage';
import { useAuthStore } from '../stores/authStore';

import './AiHelperPage.css';

const TAVI_INTRO_SEEN_KEY = 'tavi-intro-seen';
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

const PHASE_LABEL: Record<CoachSessionPhase, string> = {
  idle: 'Idle',
  onboarding: 'Onboarding',
  learning_active: 'Learning',
};

const ACTION_LABEL: Record<CoachClientAction, string> = {
  start_session: 'Start Learning',
  continue_session: 'Continue',
  end_session: 'End Session',
  translate_inline: 'Translate Phrase',
};

const createId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
};

const getDisplayName = (email: string | undefined, fullName: unknown): string => {
  if (typeof fullName === 'string' && fullName.trim()) {
    return fullName.trim().split(/\s+/)[0] ?? 'Tuyang';
  }

  if (typeof email === 'string' && email.trim()) {
    return email.split('@')[0] ?? 'Tuyang';
  }

  return 'Tuyang';
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

function TaviIntro({ onStart, onBack }: { onStart: () => void; onBack: () => void }) {
  return (
    <div className="tavi-intro">
      <header className="tavi-intro-header">
        <button className="tavi-back-button" aria-label="Go back" onClick={onBack}>
          <span className="tavi-back-chevron" aria-hidden="true" />
        </button>
        <span className="tavi-intro-header-pill">Personal AI Buddy</span>
        <div style={{ width: 36 }} />
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
      </div>

      <div className="tavi-intro-footer">
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
}: {
  message: Message;
  onUseFollowUp: (prompt: string) => void;
}) {
  const isTavi = message.role === 'tavi';

  if (isTavi) {
    const shouldRenderPackage = Boolean(message.packageEligible);
    return (
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

          {!message.loading && shouldRenderPackage && message.followUpPrompt ? (
            <button
              type="button"
              className="tavi-bubble-chip"
              onClick={() => onUseFollowUp(message.followUpPrompt ?? '')}
            >
              {message.followUpPrompt}
            </button>
          ) : null}

          {!message.loading && message.warning ? (
            <div className="tavi-bubble-warning">
              {renderMarkdown(message.warning, `${message.id}-warning`)}
            </div>
          ) : null}
        </div>
      </div>
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

export function AiHelperPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [showIntro, setShowIntro] = useState<boolean | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [retryPayload, setRetryPayload] = useState<RetryPayload | null>(null);
  const [sessionPhase, setSessionPhase] = useState<CoachSessionPhase>('idle');
  const [track, setTrack] = useState<LearningTrack>('vocabulary_first');
  const [nextActions, setNextActions] = useState<CoachClientAction[]>([
    'start_session',
    'translate_inline',
  ]);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const displayName = useMemo(
    () => getDisplayName(user?.email, user?.user_metadata?.full_name),
    [user?.email, user?.user_metadata?.full_name],
  );

  useEffect(() => {
    void getBoolean(TAVI_INTRO_SEEN_KEY, false).then((seen) => {
      setShowIntro(!seen);
    });
    void getJSON<PersistedTaviSession>(TAVI_SESSION_STATE_KEY, {
      sessionPhase: 'idle',
      track: 'vocabulary_first',
    }).then((persisted) => {
      setSessionPhase(persisted.sessionPhase);
      setTrack(persisted.track);
    });
  }, []);

  useEffect(() => {
    void setJSON(TAVI_SESSION_STATE_KEY, {
      sessionPhase,
      track,
    } satisfies PersistedTaviSession);
  }, [sessionPhase, track]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleBack = () => {
    triggerHapticFeedback('light');
    navigate('/home/garden', { replace: true });
  };

  const handleStartChat = async () => {
    triggerHapticFeedback('medium');
    await setBoolean(TAVI_INTRO_SEEN_KEY, true);
    setShowIntro(false);
  };

  const handleUseFollowUp = (prompt: string) => {
    setInputText(prompt);
    inputRef.current?.focus();
    triggerHapticFeedback('light');
  };

  const buildSessionStartMarker = (
    answerLanguage: CoachAnswerLanguage,
    markerTrack: LearningTrack,
  ): Message => ({
    id: createId(),
    role: 'tavi',
    text:
      answerLanguage === 'ms'
        ? 'Baik, sesi pembelajaran bermula sekarang.'
        : 'Great. Your learning session starts now.',
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
    };
    const textForRequest = text || (action ? actionMessage[action] : '');
    const shouldRenderUserMessage = Boolean(text);
    const previousPhase = sessionPhase;

    const userMessage: Message | null = shouldRenderUserMessage
      ? { id: createId(), role: 'user', text }
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
    setIsSending(true);
    setSendError(null);
    setRetryPayload(null);
    setNotice(null);
    triggerHapticFeedback('light');
    setMessages((prev) => [...prev, ...(userMessage ? [userMessage] : []), loadingMessage]);

    try {
      const response = await coachWithTavi({
        message: textForRequest,
        turns: [
          ...buildCoachTurns(messages),
          ...(shouldRenderUserMessage ? [{ role: 'user', text } as CoachTurnInput] : []),
        ],
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

      setMessages((prev) => {
        const next: Message[] = [];
        for (const message of prev) {
          if (message.id !== loadingMessage.id) {
            next.push(message);
            continue;
          }

          if (didStartSession) {
            next.push(buildSessionStartMarker(response.answerLanguage, response.track));
          }

          next.push({
            ...message,
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
          });
        }
        return next;
      });
      setSessionPhase(response.sessionPhase);
      setTrack(response.track);
      setNextActions(response.nextActions);

      if (response.warning) {
        setNotice(response.warning);
      } else if (response.provider === 'client-fallback') {
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
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  };

  const handleAttachMedia = () => {
    setNotice('Voice/camera in AI coach is coming soon.');
    triggerHapticFeedback('light');
  };

  if (showIntro === null) {
    return (
      <div className="tavi-loading-screen">
        <IonSpinner name="crescent" />
      </div>
    );
  }

  if (showIntro) {
    return <TaviIntro onStart={() => void handleStartChat()} onBack={handleBack} />;
  }

  return (
    <div className="tavi-chat-outer">
      <div className="tavi-chat-shell">
        <header className="tavi-chat-header">
          <button
            className="tavi-back-button"
            aria-label="Go back to intro"
            onClick={() => {
              triggerHapticFeedback('light');
              setShowIntro(true);
            }}
          >
            <span className="tavi-back-chevron" aria-hidden="true" />
          </button>
          <span className="tavi-intro-header-pill">Personal AI Buddy</span>
          <span className={`tavi-session-badge tavi-session-badge--${sessionPhase}`}>
            {PHASE_LABEL[sessionPhase]}
          </span>
        </header>

        {messages.length === 0 ? (
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

        <div className="tavi-chat-messages">
          {messages.map((message) => (
            <ChatBubble key={message.id} message={message} onUseFollowUp={handleUseFollowUp} />
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="tavi-chat-inputbar">
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
              onChange={(event) => setInputText(event.target.value)}
              onFocus={() => {
                if (sendError) {
                  setSendError(null);
                }
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
