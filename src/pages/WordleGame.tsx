import { IonSpinner } from '@ionic/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { triggerHapticFeedback } from '../lib/feedback';
import { recordSwipe, updateStreak } from '../lib/gardenSync';
import { useUserLevel } from '../lib/useUserLevel';
import { generateDeck, type VocabCard } from '../lib/vocabData';

import vocabBg from '../../assets/vocab/background.png';

import './WordleGame.css';

const TOTAL_TIME = 180; // seconds per word
const MAX_GUESSES = 4;
const WORD_LEN = 6; // Figma grid is always 6 columns
type TileState = 'empty' | 'filled' | 'correct' | 'present' | 'absent';

interface GuessRow {
  letters: string[];
  states: TileState[];
  committed: boolean;
}

function buildEmptyRow(): GuessRow {
  return {
    letters: Array(WORD_LEN).fill(''),
    states: Array(WORD_LEN).fill('empty' as TileState),
    committed: false,
  };
}

function evaluateGuess(guess: string, answer: string): TileState[] {
  const result: TileState[] = Array(answer.length).fill('absent');
  const answerLetters = answer.toUpperCase().split('');
  const guessLetters = guess.toUpperCase().split('');
  const used = Array(answer.length).fill(false);

  // First pass: correct positions
  for (let i = 0; i < answer.length; i++) {
    if (guessLetters[i] === answerLetters[i]) {
      result[i] = 'correct';
      used[i] = true;
    }
  }
  // Second pass: present but wrong position
  for (let i = 0; i < answer.length; i++) {
    if (result[i] === 'correct') continue;
    const found = answerLetters.findIndex((l, j) => !used[j] && l === guessLetters[i]);
    if (found !== -1) {
      result[i] = 'present';
      used[found] = true;
    }
  }
  return result;
}

/** Pick a Semai word that is exactly 6 letters (matches the fixed 6-column grid). */
function pickWordleWord(cards: VocabCard[]): VocabCard | null {
  const pool = cards.filter((c) => c.word && /^[a-zA-Z]{6}$/.test(c.word.trim()));
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60)
    .toString()
    .padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export function WordleGame() {
  const navigate = useNavigate();

  const [currentCard, setCurrentCard] = useState<VocabCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [guesses, setGuesses] = useState<GuessRow[]>(() =>
    Array.from({ length: MAX_GUESSES }, buildEmptyRow),
  );
  const [currentRow, setCurrentRow] = useState(0);
  const [currentCol, setCurrentCol] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [revealingRow, setRevealingRow] = useState<number | null>(null);
  const [shakeRow, setShakeRow] = useState<number | null>(null);

  // Per-word countdown timer
  const [countdown, setCountdown] = useState(TOTAL_TIME);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Load deck ────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    generateDeck(60)
      .then((cards) => {
        if (cancelled) return;
        const pick = pickWordleWord(cards);
        if (!pick) {
          setError('No suitable words found.');
          setLoading(false);
          return;
        }
        setCurrentCard(pick);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setError('Failed to load words.');
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Timer ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (loading || gameOver) return;
    setCountdown(TOTAL_TIME);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timerRef.current!);
          setGameOver(true);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, currentCard]);

  // ── User level (for progress bar) ───────────────────────────────────────
  const { label: levelLabel, percentToNext: levelPercent, refresh: refreshLevel } = useUserLevel();

  useEffect(() => {
    if (gameOver && timerRef.current) clearInterval(timerRef.current);
  }, [gameOver]);

  useEffect(() => {
    if (!gameOver) return;
    const t = setTimeout(() => {
      void updateStreak();
      void refreshLevel().then((newLevel) => {
        if (newLevel) {
          navigate(`/home/levelup`, { replace: true, state: { level: newLevel } });
        } else {
          navigate('/home/garden', { replace: true });
        }
      });
    }, 900);
    return () => clearTimeout(t);
  }, [gameOver, refreshLevel, navigate]);

  // ── Input handling ────────────────────────────────────────────────────────────
  const commitGuess = useCallback(() => {
    if (!currentCard || revealingRow !== null) return;
    const word = currentCard.word.trim().toUpperCase().slice(0, WORD_LEN);
    const row = guesses[currentRow];

    // Must fill all 6 columns
    if (row.letters.some((l) => l === '')) {
      setShakeRow(currentRow);
      setTimeout(() => setShakeRow(null), 500);
      return;
    }

    const states = evaluateGuess(row.letters.join(''), word);
    const newGuesses = guesses.map((g, i) =>
      i === currentRow ? { ...g, states, committed: true } : g,
    );
    setGuesses(newGuesses);
    setRevealingRow(currentRow);

    const isWin = states.every((s) => s === 'correct');
    const isLastRow = currentRow + 1 >= MAX_GUESSES;

    setTimeout(
      () => {
        setRevealingRow(null);
        if (isWin) {
          triggerHapticFeedback('success');
          void recordSwipe({ wordId: currentCard.word_id ?? null, known: true });
          setWon(true);
          setGameOver(true);
        } else if (isLastRow) {
          triggerHapticFeedback('light');
          void recordSwipe({ wordId: currentCard.word_id ?? null, known: false });
          setGameOver(true);
        } else {
          setCurrentRow((r) => r + 1);
          setCurrentCol(0);
          triggerHapticFeedback('light');
        }
      },
      WORD_LEN * 120 + 80,
    );
  }, [currentCard, guesses, currentRow, revealingRow]);

  const handleKey = useCallback(
    (key: string) => {
      if (gameOver || revealingRow !== null || !currentCard) return;

      if (key === 'ENTER') {
        commitGuess();
        return;
      }
      if (key === '⌫' || key === 'BACKSPACE') {
        if (currentCol === 0) return;
        const newCol = currentCol - 1;
        setGuesses((prev) =>
          prev.map((g, i) => {
            if (i !== currentRow) return g;
            const letters = [...g.letters];
            letters[newCol] = '';
            return { ...g, letters };
          }),
        );
        setCurrentCol(newCol);
        return;
      }
      if (/^[A-Z]$/.test(key) && currentCol < WORD_LEN) {
        setGuesses((prev) =>
          prev.map((g, i) => {
            if (i !== currentRow) return g;
            const letters = [...g.letters];
            letters[currentCol] = key;
            return { ...g, letters };
          }),
        );
        setCurrentCol((c) => c + 1);
      }
    },
    [gameOver, revealingRow, currentCard, currentRow, currentCol, commitGuess],
  );

  // Physical keyboard support
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Enter') {
        handleKey('ENTER');
        return;
      }
      if (e.key === 'Backspace') {
        handleKey('BACKSPACE');
        return;
      }
      const upper = e.key.toUpperCase();
      if (/^[A-Z]$/.test(upper)) handleKey(upper);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleKey]);

  // ── Navigation ────────────────────────────────────────────────────────────────
  const handleBack = useCallback(() => {
    triggerHapticFeedback('light');
    navigate('/home/garden', { replace: true });
  }, [navigate]);

  // ── Loading / Error ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="vocab-shell vocab-shell--loading">
        <IonSpinner name="crescent" className="vocab-spinner" />
        <p className="vocab-loading-text">Loading words…</p>
      </div>
    );
  }

  if (error || !currentCard) {
    return (
      <div className="vocab-shell vocab-shell--error">
        <p className="vocab-error-text">{error ?? 'No words available.'}</p>
        <button type="button" className="vocab-btn-primary" onClick={handleBack}>
          Back to Garden
        </button>
      </div>
    );
  }

  // ── Main game ─────────────────────────────────────────────────────────────────
  const isUrgent = countdown <= 15;

  return (
    <div className="vocab-shell wordle-shell">
      {/* Topbar */}
      <div className="vocab-topbar">
        <button
          type="button"
          className="wordle-back-btn"
          onClick={handleBack}
          aria-label="Back to Garden"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
          >
            <path
              d="M20 11H7.83L13.42 5.41L12 4L4 12L12 20L13.41 18.59L7.83 13H20V11Z"
              fill="#604828"
            />
          </svg>
        </button>
        <span className="vocab-level-label">{levelLabel}</span>
        <span className={`vocab-timer${isUrgent ? ' vocab-timer--urgent' : ''}`}>
          <svg
            width="14"
            height="14"
            viewBox="0 -4 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
            <path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          {formatTime(countdown)}
        </span>
      </div>

      {/* Level progress bar */}
      <div className="wordle-level-bar-row">
        <span className="wordle-level-label"> Progress </span>
        <span className="wordle-level-pct">{levelPercent}%</span>
      </div>
      <div
        className="wordle-level-bar-track"
        role="progressbar"
        aria-valuenow={levelPercent}
        aria-valuemax={100}
        aria-label={`${levelLabel} progress`}
      >
        <div className="wordle-level-bar-fill" style={{ width: `${levelPercent}%` }} />
      </div>

      {/* WORDLE title */}
      <div className="wordle-title" aria-hidden="true">
        {'WORDLE'.split('').map((ch, i) => (
          <span key={i} className="wordle-title-letter">
            {ch}
          </span>
        ))}
      </div>

      {/* Clue card — layered shadow card + frosted card */}
      <div className="wordle-clue-wrapper">
        <div className="wordle-clue-shadow" aria-hidden="true" />
        <div className="wordle-clue-card">
          <p className="wordle-clue-text">{currentCard.definition_en}</p>
        </div>
      </div>

      {/* Grid — always 6 columns × 4 rows */}
      <div className="wordle-grid" aria-label="Wordle grid">
        {guesses.map((row, ri) =>
          Array.from({ length: WORD_LEN }).map((_, ci) => {
            const letter = row.letters[ci] ?? '';
            const isRevealing = revealingRow === ri;
            const delay = isRevealing ? `${ci * 120}ms` : '0ms';
            const state: TileState = row.committed ? row.states[ci] : letter ? 'filled' : 'empty';
            const isCurrent = !row.committed && ri === currentRow && ci === currentCol - 1;
            return (
              <div
                key={`${ri}-${ci}`}
                className={[
                  'wordle-tile',
                  `wordle-tile--${state}`,
                  row.committed ? 'is-flipped' : '',
                  isCurrent ? 'is-current' : '',
                  shakeRow === ri ? 'is-shaking' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                style={{ animationDelay: delay, transitionDelay: row.committed ? delay : '0ms' }}
                aria-label={letter || 'empty'}
              >
                <div className="wordle-tile-shadow" aria-hidden="true" />
                <span className="wordle-tile-letter">{letter}</span>
              </div>
            );
          }),
        )}
      </div>

      {/* Answer reveal — shown when player runs out of guesses without winning */}
      {gameOver && !won && currentCard && (
        <p className="wordle-answer-reveal">
          The word was: <strong>{currentCard.word.trim().toUpperCase()}</strong>
        </p>
      )}

      {/* Bottom scenic illustration */}
      <div className="wordle-bottom" aria-hidden="true">
        <div className="wordle-bottom-fade" />
        <div className="wordle-bottom-fade wordle-bottom-fade--2" />
        <div className="wordle-bottom-fade wordle-bottom-fade--3" />
        <img src={vocabBg} alt="" className="wordle-bottom-img" draggable={false} />
      </div>
    </div>
  );
}
