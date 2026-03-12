import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { AppSkeleton } from '../components/ui';
import { triggerHapticFeedback } from '../lib/feedback';
import { recordSwipe, updateStreak } from '../lib/gardenSync';
import { useUserLevel } from '../lib/useUserLevel';
import { generateDeck, type VocabCard } from '../lib/vocabData';

import card1Svg from '../../assets/vocab/card 1.svg';
import card2Svg from '../../assets/vocab/card 2.svg';
import card3Svg from '../../assets/vocab/card 3.svg';
import card4Svg from '../../assets/vocab/card 4.svg';

import './VocabMaster.css';

const CARDS_PER_ROUND = 10;
const SWIPE_THRESHOLD = 80;
const CARD_TIMER = 20;
const SWIPE_ANIMATION_MS = 380;

// card1 = front of deck, card4 = furthest back
const CARD_ARTS = [card1Svg, card2Svg, card3Svg, card4Svg];

const VocabLoadingSkeleton = () => (
  <div
    className="vocab-shell vocab-shell--loading vocab-shell--skeleton"
    aria-label="Loading vocabulary cards"
  >
    <div className="vocab-topbar">
      <AppSkeleton className="app-skeleton--circle" width={40} height={40} />
      <AppSkeleton className="app-skeleton--pill" width={92} height={14} />
      <AppSkeleton className="app-skeleton--pill" width={58} height={14} />
    </div>

    <div className="vocab-level-bar-row">
      <AppSkeleton className="app-skeleton--pill" width={78} height={14} />
      <AppSkeleton className="app-skeleton--pill" width={40} height={14} />
    </div>
    <div className="vocab-level-bar-track">
      <AppSkeleton width="46%" height="100%" />
    </div>

    <div className="vocab-deck-area vocab-deck-area--skeleton" aria-hidden="true">
      <AppSkeleton className="app-skeleton--card vocab-skeleton-card vocab-skeleton-card--back" />
      <AppSkeleton className="app-skeleton--card vocab-skeleton-card vocab-skeleton-card--mid" />
      <AppSkeleton className="app-skeleton--card vocab-skeleton-card vocab-skeleton-card--front" />
      <div className="vocab-skeleton-copy">
        <AppSkeleton className="app-skeleton--pill" width="52%" height={28} />
        <AppSkeleton className="app-skeleton--pill" width="34%" height={16} />
        <AppSkeleton className="app-skeleton--pill" width="70%" height={18} />
      </div>
    </div>

    <div className="vocab-skeleton-actions" aria-hidden="true">
      <AppSkeleton className="app-skeleton--pill" width="42%" height={48} />
      <AppSkeleton className="app-skeleton--pill" width="42%" height={48} />
    </div>
  </div>
);

export function VocabMaster() {
  const navigate = useNavigate();

  const [deck, setDeck] = useState<VocabCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [finished, setFinished] = useState(false);

  // Per-card countdown timer
  const [countdown, setCountdown] = useState(CARD_TIMER);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const advanceRef = useRef<((dir: 'left' | 'right') => void) | null>(null);

  // ── User level (for progress bar) ───────────────────────────────────────
  const { label: levelLabel, percentToNext: levelPercent, refresh: refreshLevel } = useUserLevel();

  // Swipe state
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [swipeDir, setSwipeDir] = useState<'left' | 'right' | null>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const mouseDownX = useRef(0);
  const mouseDown = useRef(false);
  const dragXRef = useRef(0);

  // Load deck
  useEffect(() => {
    let cancelled = false;
    generateDeck(CARDS_PER_ROUND)
      .then((d) => {
        if (!cancelled) {
          setDeck(d);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('Failed to load cards.');
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Reset and start countdown whenever the card index changes
  useEffect(() => {
    if (loading || finished) return;
    setCountdown(CARD_TIMER);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timerRef.current!);
          advanceRef.current?.('left');
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [loading, finished, index]);

  const [promoting, setPromoting] = useState(false);
  const [resetting, setResetting] = useState(false);

  const advance = useCallback(
    (dir: 'left' | 'right') => {
      if (timerRef.current) clearInterval(timerRef.current);
      triggerHapticFeedback(dir === 'right' ? 'medium' : 'light');
      setDragging(false);
      setSwipeDir(dir);
      setPromoting(true);

      // Fire-and-forget — never blocks the UI
      const currentCard = deck[index];
      void recordSwipe({ wordId: currentCard?.word_id ?? null, known: dir === 'right' });

      setTimeout(() => {
        // Disable transitions so the flipper teleports to center instantly
        setResetting(true);
        setSwipeDir(null);
        setDragX(0);
        dragXRef.current = 0;
        setDragging(false);
        setFlipped(false);
        setPromoting(false);
        if (index + 1 >= deck.length) {
          if (timerRef.current) clearInterval(timerRef.current);
          void updateStreak();
          void refreshLevel().then((newLevel) => {
            if (newLevel) {
              navigate(`/home/levelup`, { replace: true, state: { level: newLevel } });
            } else {
              setFinished(true);
            }
          });
          setResetting(false);
        } else {
          setIndex((i) => i + 1);
          // Re-enable transitions on the next frame so future drags/swipes animate
          requestAnimationFrame(() => {
            setResetting(false);
          });
        }
      }, SWIPE_ANIMATION_MS);
    },
    [index, deck, refreshLevel, navigate],
  );

  // Keep ref current so the interval callback can call the latest advance
  useEffect(() => {
    advanceRef.current = advance;
  }, [advance]);

  const handleFlip = useCallback(() => {
    if (dragging || promoting || swipeDir) return;
    triggerHapticFeedback('light');
    setFlipped((f) => !f);
  }, [dragging, promoting, swipeDir]);

  const handleBack = useCallback(() => {
    triggerHapticFeedback('light');
    navigate('/home/garden', { replace: true });
  }, [navigate]);

  const handleRestart = useCallback(() => {
    triggerHapticFeedback('light');
    setLoading(true);
    setError(null);
    setIndex(0);
    setFlipped(false);
    setFinished(false);
    setDragX(0);
    dragXRef.current = 0;
    setSwipeDir(null);
    setCountdown(CARD_TIMER);
    generateDeck(CARDS_PER_ROUND)
      .then((d) => {
        setDeck(d);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load cards.');
        setLoading(false);
      });
  }, []);

  // â”€â”€ Touch handlers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    dragXRef.current = 0;
    setDragging(false);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;
    if (Math.abs(dx) > Math.abs(dy)) {
      setDragging(true);
      dragXRef.current = dx;
      setDragX(dx);
    }
  };
  const onTouchEnd = () => {
    if (promoting) return;
    const dx = dragXRef.current;
    if (Math.abs(dx) >= SWIPE_THRESHOLD) {
      advance(dx > 0 ? 'right' : 'left');
    } else {
      dragXRef.current = 0;
      setDragX(0);
      setDragging(false);
    }
  };

  // â”€â”€ Mouse drag â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const onMouseDown = (e: React.MouseEvent) => {
    mouseDownX.current = e.clientX;
    mouseDown.current = true;
    dragXRef.current = 0;
    setDragging(false);
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!mouseDown.current) return;
    const dx = e.clientX - mouseDownX.current;
    if (Math.abs(dx) > 4) {
      setDragging(true);
      dragXRef.current = dx;
      setDragX(dx);
    }
  };
  const onMouseUp = () => {
    mouseDown.current = false;
    if (promoting) return;
    const dx = dragXRef.current;
    if (Math.abs(dx) >= SWIPE_THRESHOLD) {
      advance(dx > 0 ? 'right' : 'left');
    } else {
      dragXRef.current = 0;
      setDragX(0);
      setDragging(false);
    }
  };

  // â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const card = deck[index];
  const roundProgress = deck.length > 0 ? Math.min(index + 1, deck.length) : 0;

  const flyX = swipeDir === 'right' ? 420 : swipeDir === 'left' ? -420 : dragX;
  const flyRotate = swipeDir ? (swipeDir === 'right' ? 20 : -20) : dragX * 0.08;
  const baseRotate = 4.277;

  // Rotate card art so each slot cycles through the 4 arts as cards are swiped
  const artAt = (offset: number) => CARD_ARTS[(index + offset) % CARD_ARTS.length];

  if (loading) {
    return <VocabLoadingSkeleton />;
  }

  if (error || deck.length === 0) {
    return (
      <div className="vocab-shell vocab-shell--error">
        <p className="vocab-error-text">{error ?? 'No cards available.'}</p>
        <button type="button" className="vocab-btn-primary" onClick={handleRestart}>
          Try Again
        </button>
        <button type="button" className="vocab-btn-text" onClick={handleBack}>
          Back to Garden
        </button>
      </div>
    );
  }

  return (
    <div className="vocab-shell">
      {/* Level bar */}
      <div className="vocab-topbar">
        <button
          type="button"
          className="vocab-back-btn"
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
        <span className={`vocab-timer${countdown <= 5 ? ' vocab-timer--urgent' : ''}`}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
            <path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          {countdown}s
        </span>
      </div>

      {/* Level progress bar */}
      <div className="vocab-level-bar-row">
        <span className="vocab-level-label">{levelLabel}</span>
        <span className="vocab-level-pct">{levelPercent}%</span>
      </div>
      <div
        className="vocab-level-bar-track"
        role="progressbar"
        aria-valuenow={levelPercent}
        aria-valuemax={100}
        aria-label={`${levelLabel} progress`}
      >
        <div className="vocab-level-bar-fill" style={{ width: `${levelPercent}%` }} />
      </div>

      {/* Stacked deck */}
      <div className={`vocab-deck-area ${promoting ? 'is-promoting' : ''}`}>
        {/* Back cards — card4 furthest, card3, card2 */}
        <div
          className={`vocab-card-stack vocab-card-stack--back3 ${promoting ? 'is-promoting' : ''} ${resetting ? 'is-resetting' : ''}`}
          aria-hidden="true"
        >
          <img src={artAt(3)} alt="" className="vocab-card-bg" draggable={false} />
        </div>
        <div
          className={`vocab-card-stack vocab-card-stack--back2 ${promoting ? 'is-promoting' : ''} ${resetting ? 'is-resetting' : ''}`}
          aria-hidden="true"
        >
          <img src={artAt(2)} alt="" className="vocab-card-bg" draggable={false} />
        </div>
        <div
          className={`vocab-card-stack vocab-card-stack--back1 ${promoting ? 'is-promoting' : ''} ${resetting ? 'is-resetting' : ''}`}
          aria-hidden="true"
        >
          <img src={artAt(1)} alt="" className="vocab-card-bg" draggable={false} />
        </div>

        {/* Front card — card1, flippable + swipeable */}
        <div
          className={[
            'vocab-card-flipper',
            dragging ? 'is-dragging' : '',
            resetting ? 'is-resetting' : '',
            flipped ? 'is-flipped' : '',
            swipeDir ? 'is-flying' : '',
            swipeDir ? `is-flying--${swipeDir}` : '',
          ]
            .filter(Boolean)
            .join(' ')}
          style={{
            transform: `translateX(${flyX}px) rotate(${baseRotate + flyRotate}deg)`,
          }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onClick={handleFlip}
          role="button"
          tabIndex={0}
          aria-label={flipped ? 'Tap to see Semai word' : 'Tap to reveal meaning'}
          onKeyDown={(e) => e.key === 'Enter' && handleFlip()}
        >
          {/* Front face â€” Semai word */}
          <div className="vocab-card-face vocab-card-face--front">
            <img src={artAt(0)} alt="" className="vocab-card-bg" draggable={false} />
            <div className="vocab-card-content">
              <p className="vocab-card-word">{card.word}</p>
              <p className="vocab-card-phonetic">/{card.word}/</p>
              <p className="vocab-card-definition-preview">{card.definition_en}</p>
            </div>
          </div>

          {/* Back face â€” definition */}
          <div className="vocab-card-face vocab-card-face--back">
            <img
              src={artAt(0)}
              alt=""
              className="vocab-card-bg vocab-card-bg--back"
              draggable={false}
            />
            <div className="vocab-card-content">
              <p className="vocab-card-label">Meaning</p>
              <p className="vocab-card-definition">{card.definition_en}</p>
              {card.definition_ms ? (
                <p className="vocab-card-definition-ms">{card.definition_ms}</p>
              ) : null}
            </div>
          </div>
        </div>

        {/* Swipe hint labels */}
        {dragging && (
          <>
            <span
              className={`vocab-swipe-hint vocab-swipe-hint--know ${dragX > 30 ? 'is-visible' : ''}`}
            >
              Know it âœ“
            </span>
            <span
              className={`vocab-swipe-hint vocab-swipe-hint--review ${dragX < -30 ? 'is-visible' : ''}`}
            >
              Review ✗
            </span>
          </>
        )}
      </div>

      {/* Word in use */}
      <div className="vocab-bottom-section">
        {card.example_semai && (
          <div className="vocab-word-in-use">
            <p className="vocab-word-in-use__label">Word in use</p>
            <p className="vocab-word-in-use__sentence">
              {card.example_semai
                .split(new RegExp(`(${card.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'i'))
                .map((part, i) =>
                  part.toLowerCase() === card.word.toLowerCase() ? (
                    <strong key={i} className="vocab-word-in-use__highlight">
                      {part}
                    </strong>
                  ) : (
                    part
                  ),
                )}
            </p>
          </div>
        )}

        <div className="vocab-practice-panel" aria-label="Vocabulary practice guide">
          <div className="vocab-practice-card">
            <p className="vocab-practice-eyebrow">Round progress</p>
            <div className="vocab-practice-progress-row">
              <strong className="vocab-practice-progress-value">
                {roundProgress}/{deck.length}
              </strong>
              <span className="vocab-practice-progress-copy">cards reviewed</span>
            </div>
            <div className="vocab-practice-progress-track" aria-hidden="true">
              <div
                className="vocab-practice-progress-fill"
                style={{ width: `${deck.length ? (roundProgress / deck.length) * 100 : 0}%` }}
              />
            </div>
          </div>

          <div className="vocab-practice-card">
            <p className="vocab-practice-eyebrow">Quick guide</p>
            <ul className="vocab-practice-list" role="list">
              <li>Tap the card to flip and reveal the meaning.</li>
              <li>Swipe right if you know it.</li>
              <li>Swipe left if you want to review it again.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
