import { IonSpinner, IonToast } from '@ionic/react';
import { useEffect, useRef, useState } from 'react';

import taviImg from '../../assets/tavi.png';
import cameraImg from '../../assets/camera.png';
import { triggerHapticFeedback } from '../lib/feedback';
import { setBoolean } from '../lib/storage';
import { toAuthErrorMessage } from '../utils/authErrors';

import './AiHelperPage.css';

const TAVI_INTRO_SEEN_KEY = 'tavi-intro-seen';

type MessageRole = 'user' | 'tavi';

interface Message {
  id: string;
  role: MessageRole;
  text: string;
  translation?: string;
  loading?: boolean;
}

function TaviIntro({ onStart }: { onStart: () => void }) {
  return (
    <div className="tavi-intro">
      {/* Header */}
      <header className="tavi-intro-header">
        <button className="tavi-back-button" aria-label="Go back" onClick={() => {/* navigate back or close */}}>
        <span className="tavi-intro-header-pill">Personal AI Buddy</span>
        <div style={{ width: 36 }} />
      </header>

      {/* Mascot with aura */}
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
          Chat naturally, improve your pronunciation, and build confidence. One conversation at a
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

function ChatBubble({ message }: { message: Message }) {
  const isTavi = message.role === 'tavi';

  if (isTavi) {
    return (
      <div className="tavi-bubble-row tavi-bubble-row--tavi">
        <img src={taviImg} alt="Tavi" className="tavi-bubble-avatar" />

        <div className="tavi-bubble-tavi-stack">
          {/* Red reply bubble */}
          <div className="tavi-bubble tavi-bubble--tavi-reply">
            {message.loading ? (
              <div className="tavi-bubble-loading">
                <span />
                <span />
                <span />
              </div>
            ) : (
              <p className="tavi-bubble-text">{message.text}</p>
            )}
          </div>

          {/* White translation bubble */}
          {!message.loading && message.translation && (
            <div className="tavi-bubble tavi-bubble--translation">
              <p className="tavi-bubble-translation-label">Translation:</p>
              <p className="tavi-bubble-text">{message.translation}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="tavi-bubble-row tavi-bubble-row--user">
      <div className="tavi-bubble tavi-bubble--user">
        <p className="tavi-bubble-text">{message.text}</p>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function AiHelperPage() {
  const [showIntro, setShowIntro] = useState<boolean | null>(null); // null = loading
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // Check if intro has been seen
  useEffect(() => {
    // TODO: restore persistence — always show for UI development
    setShowIntro(true);
    // void getBoolean(TAVI_INTRO_SEEN_KEY, false).then((seen) => {
    //   setShowIntro(!seen);
    // });
  }, []);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleStartChat = async () => {
    triggerHapticFeedback('medium');
    await setBoolean(TAVI_INTRO_SEEN_KEY, true);
    setShowIntro(false);
  };

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || isSending) return;

    setInputText('');
    setIsSending(true);
    triggerHapticFeedback('light');

    // Add user message
    const userMsg: Message = { id: Date.now().toString(), role: 'user', text };
    // Add Tavi loading bubble
    const taviId = (Date.now() + 1).toString();
    const taviLoadingMsg: Message = { id: taviId, role: 'tavi', text: '', loading: true };

    setMessages((prev) => [...prev, userMsg, taviLoadingMsg]);

    try {
      // Echo the input back as Tavi's reply + translation
      await new Promise((r) => setTimeout(r, 600));
      triggerHapticFeedback('success');

      setMessages((prev) =>
        prev.map((m) => (m.id === taviId ? { ...m, text, translation: text, loading: false } : m)),
      );
    } catch (err) {
      triggerHapticFeedback('error');
      setError(toAuthErrorMessage(err));
      setMessages((prev) => prev.filter((m) => m.id !== taviId));
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  // Loading state while checking storage
  if (showIntro === null) {
    return (
      <div className="tavi-loading-screen">
        <IonSpinner name="crescent" />
      </div>
    );
  }

  if (showIntro) {
    return <TaviIntro onStart={() => void handleStartChat()} />;
  }

  return (
    <div className="tavi-chat-outer">
      <div className="tavi-chat-shell">
        {/* Header */}
        <header className="tavi-chat-header">
          <button
            className="tavi-back-button"
            aria-label="Go back"
            onClick={() => setShowIntro(true)}
          >
            <span className="tavi-back-chevron" aria-hidden="true" />
          </button>
          <span className="tavi-intro-header-pill">Personal AI Buddy</span>
          <div style={{ width: 36 }} />
        </header>

        {/* Greeting shown when no messages yet */}
        {messages.length === 0 && (
          <div className="tavi-chat-greeting">
            <h2 className="tavi-chat-greeting-title">
              Hello, <br />
              <span>Tuyang!</span>
            </h2>
            <p className="tavi-chat-greeting-sub">
              Let's grow your language journey. Every word you learn keeps a voice alive.
            </p>
          </div>
        )}

        {/* Messages */}
        <div className="tavi-chat-messages">
          {messages.map((msg) => (
            <ChatBubble key={msg.id} message={msg} />
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input bar */}
        <div className="tavi-chat-inputbar">
          <button className="tavi-chat-inputbar-icon" aria-label="Attach media">
            <img src={cameraImg} alt="" width={28} height={28} />
          </button>

          <div className="tavi-chat-inputbar-right">
            <textarea
              ref={inputRef}
              className="tavi-chat-input"
              placeholder="Write your message here"
              value={inputText}
              rows={1}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button
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
        isOpen={Boolean(error)}
        message={error ?? ''}
        duration={3200}
        color="danger"
        onDidDismiss={() => setError(null)}
      />
    </div>
  );
}
