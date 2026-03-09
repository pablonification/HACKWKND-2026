import { IonSpinner } from '@ionic/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { triggerHapticFeedback } from '../lib/feedback';
import { recordSwipe, updateStreak } from '../lib/gardenSync';
import { generateQuestions, type QuizQuestion } from '../lib/quizData';

import './QuizGame.css';

// ─── Types ───────────────────────────────────────────────────────────────────

type ChoiceState = 'idle' | 'correct' | 'wrong';

// ─── Constants ───────────────────────────────────────────────────────────────

const QUESTIONS_PER_ROUND = 5;
const AUTO_ADVANCE_MS = 3000;

// ─── Component ───────────────────────────────────────────────────────────────

export function QuizGame() {
  const navigate = useNavigate();

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Current question index
  const [current, setCurrent] = useState(0);

  // Which choice the user tapped (null = not answered yet)
  const [selected, setSelected] = useState<string | null>(null);

  // Score
  const [score, setScore] = useState(0);

  // Finished flag (all questions answered)
  const [finished, setFinished] = useState(false);

  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load questions on mount ──────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    generateQuestions(QUESTIONS_PER_ROUND)
      .then((q) => {
        if (!cancelled) {
          setQuestions(q);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('Quiz load error:', err);
          setError('Failed to load quiz questions. Please try again.');
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Cleanup timer on unmount ─────────────────────────────────────────────
  useEffect(
    () => () => {
      if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
    },
    [],
  );

  // ── Handlers ────────────────────────────────────────────────────────────
  const handleChoice = useCallback(
    (choice: string) => {
      if (selected !== null) return; // already answered

      const q = questions[current];
      const isCorrect = choice === q.correctAnswer;

      setSelected(choice);

      // Fire-and-forget backend sync — never blocks the UI
      void recordSwipe({ wordId: q.word_id, known: isCorrect });

      if (isCorrect) {
        triggerHapticFeedback('medium');
        setScore((s) => s + 1);
      } else {
        triggerHapticFeedback('medium');
      }

      // Auto-advance after a short delay
      autoAdvanceTimer.current = setTimeout(() => {
        if (current + 1 >= questions.length) {
          setFinished(true);
          void updateStreak();
        } else {
          setCurrent((c) => c + 1);
          setSelected(null);
        }
      }, AUTO_ADVANCE_MS);
    },
    [selected, questions, current],
  );

  const handleNext = useCallback(() => {
    if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
    if (current + 1 >= questions.length) {
      setFinished(true);
      void updateStreak();
    } else {
      setCurrent((c) => c + 1);
      setSelected(null);
    }
  }, [current, questions.length]);

  const handleRestart = useCallback(() => {
    setLoading(true);
    setError(null);
    setScore(0);
    setCurrent(0);
    setSelected(null);
    setFinished(false);

    generateQuestions(QUESTIONS_PER_ROUND)
      .then((q) => {
        setQuestions(q);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Quiz reload error:', err);
        setError('Failed to load quiz questions. Please try again.');
        setLoading(false);
      });
  }, []);

  const handleBack = useCallback(() => {
    triggerHapticFeedback('light');
    navigate('/home/garden', { replace: true });
  }, [navigate]);

  // ── Choice state helper ──────────────────────────────────────────────────
  const getChoiceState = (choice: string): ChoiceState => {
    if (selected === null) return 'idle';
    const q = questions[current];
    if (choice === q.correctAnswer) return 'correct';
    if (choice === selected) return 'wrong';
    return 'idle';
  };

  // ─── Render: Loading ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="quiz-shell quiz-shell--loading">
        <IonSpinner name="crescent" className="quiz-spinner" />
        <p className="quiz-loading-text">Loading quiz…</p>
      </div>
    );
  }

  // ─── Render: Error ────────────────────────────────────────────────────────
  if (error || questions.length === 0) {
    return (
      <div className="quiz-shell quiz-shell--error">
        <p className="quiz-error-text">{error ?? 'No questions available.'}</p>
        <button type="button" className="quiz-btn-retry" onClick={handleRestart}>
          Try Again
        </button>
        <button type="button" className="quiz-btn-back-text" onClick={handleBack}>
          ← Back to Garden
        </button>
      </div>
    );
  }

  // ─── Render: Finished ─────────────────────────────────────────────────────
  if (finished) {
    const perfect = score === questions.length;
    return (
      <div className="quiz-shell">
        {/* Header */}
        <div className="quiz-topbar">
          <button
            type="button"
            className="quiz-back-btn"
            onClick={handleBack}
            aria-label="Back to Garden"
          >
            <span className="quiz-back-icon" aria-hidden="true">
              ←
            </span>
          </button>
          <span className="quiz-topbar-title">Quiz</span>
          <span className="quiz-topbar-spacer" aria-hidden="true" />
        </div>

        <div className="quiz-result-card">
          <p className="quiz-result-emoji">
            {perfect ? '🎉' : score >= questions.length / 2 ? '👍' : '📚'}
          </p>
          <h2 className="quiz-result-heading">{perfect ? 'Perfect score!' : 'Round complete!'}</h2>
          <p className="quiz-result-score">
            {score} / {questions.length} correct
          </p>
          <button type="button" className="quiz-btn-primary" onClick={handleRestart}>
            Play Again
          </button>
          <button type="button" className="quiz-btn-secondary" onClick={handleBack}>
            Back to Garden
          </button>
        </div>
      </div>
    );
  }

  // ─── Render: Question ─────────────────────────────────────────────────────
  const q = questions[current];
  const answered = selected !== null;

  return (
    <div className="quiz-shell">
      {/* Top bar */}
      <div className="quiz-topbar">
        <button
          type="button"
          className="quiz-back-btn"
          onClick={handleBack}
          aria-label="Back to Garden"
        >
          <span className="quiz-back-icon" aria-hidden="true">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
            >
              <path
                d="M20 11H7.83L13.42 5.41L12 4L4 12L12 20L13.41 18.59L7.83 13H20V11Z"
                fill="#604828"
              />
            </svg>
          </span>
        </button>
        <span className="quiz-topbar-title">Quiz</span>
        <span className="quiz-topbar-spacer" aria-hidden="true" />
      </div>

      {/* Progress */}
      <p className="quiz-progress">
        Quiz {current + 1} out of {questions.length}
      </p>

      {/* Question */}
      <h1 className="quiz-question">
        The word &ldquo;<strong>{q.semai}</strong>&rdquo; in Semai means…
      </h1>

      {/* Choices card */}
      <div className="quiz-choices-card">
        <ul className="quiz-choices-list" role="list">
          {q.choices.map((choice) => {
            const state = getChoiceState(choice);
            return (
              <li key={choice}>
                <button
                  type="button"
                  className={`quiz-choice quiz-choice--${state}`}
                  onClick={() => handleChoice(choice)}
                  disabled={answered}
                  aria-pressed={selected === choice}
                >
                  <span
                    className={`quiz-choice-radio ${state !== 'idle' ? `quiz-choice-radio--${state}` : ''}`}
                    aria-hidden="true"
                  />
                  <span className="quiz-choice-label">{choice}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Nav dots + Next button */}
      <div className="quiz-nav-row">
        <span className="quiz-nav-spacer" aria-hidden="true" />

        <div className="quiz-dots" aria-hidden="true">
          {questions.map((_, i) => (
            <span key={i} className={`quiz-dot ${i === current ? 'quiz-dot--active' : ''}`} />
          ))}
        </div>

        <button
          type="button"
          className={`quiz-next-btn ${answered ? 'quiz-next-btn--visible' : ''}`}
          onClick={handleNext}
          aria-label="Next question"
          tabIndex={answered ? 0 : -1}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
          >
            <path
              d="M9 18L15 12L9 6"
              stroke="#595959"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
      </div>

      {/* Answer reveal card — hidden until answered */}
      {answered && (
        <div className="quiz-reveal-card" role="status" aria-live="polite">
          <div className="quiz-reveal-header">
            <span className="quiz-reveal-bulb" aria-hidden="true">
              💡
            </span>
            <p className="quiz-reveal-correct">
              Correct Answer: <strong>{q.correctAnswer}</strong>
            </p>
          </div>
          <p className="quiz-reveal-explanation">{q.explanation}</p>
        </div>
      )}
    </div>
  );
}
