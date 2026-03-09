import { IonSpinner } from '@ionic/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { triggerHapticFeedback } from '../lib/feedback';
import { recordSwipe, updateStreak } from '../lib/gardenSync';
import { generateDeck, type VocabCard } from '../lib/vocabData';

import card1Svg from '../../assets/vocab/card 1.svg';
import card2Svg from '../../assets/vocab/card 2.svg';
import card3Svg from '../../assets/vocab/card 3.svg';
import card4Svg from '../../assets/vocab/card 4.svg';
import vocabBg from '../../assets/vocab/background.png';

import './VocabMaster.css';

const CARDS_PER_ROUND = 10;
const SWIPE_THRESHOLD = 80;
const LEVEL = 3;
const CARD_TIMER = 20;

// card1 = front of deck, card4 = furthest back
const CARD_ARTS = [card1Svg, card2Svg, card3Svg, card4Svg];

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

  // Swipe state
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [swipeDir, setSwipeDir] = useState<'left' | 'right' | null>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const mouseDownX = useRef(0);
  const mouseDown = useRef(false);

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

  const advance = useCallback(
    (dir: 'left' | 'right') => {
      if (timerRef.current) clearInterval(timerRef.current);
      triggerHapticFeedback(dir === 'right' ? 'medium' : 'light');
      setSwipeDir(dir);
      setPromoting(true);

      // Fire-and-forget — never blocks the UI
      const currentCard = deck[index];
      void recordSwipe({ wordId: currentCard?.word_id ?? null, known: dir === 'right' });

      setTimeout(() => {
        setSwipeDir(null);
        setDragX(0);
        setFlipped(false);
        setPromoting(false);
        if (index + 1 >= deck.length) {
          setFinished(true);
          if (timerRef.current) clearInterval(timerRef.current);
          void updateStreak();
        } else {
          setIndex((i) => i + 1);
        }
      }, 320);
    },
    [index, deck],
  );

  // Keep ref current so the interval callback can call the latest advance
  useEffect(() => {
    advanceRef.current = advance;
  }, [advance]);

  const handleFlip = useCallback(() => {
    if (dragging) return;
    triggerHapticFeedback('light');
    setFlipped((f) => !f);
  }, [dragging]);

  const handleBack = useCallback(() => {
    triggerHapticFeedback('light');
    navigate('/home/garden', { replace: true });
  }, [navigate]);

  const handleRestart = useCallback(() => {
    setLoading(true);
    setError(null);
    setIndex(0);
    setFlipped(false);
    setFinished(false);
    setDragX(0);
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
    setDragging(false);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;
    if (Math.abs(dx) > Math.abs(dy)) {
      setDragging(true);
      setDragX(dx);
    }
  };
  const onTouchEnd = () => {
    if (Math.abs(dragX) >= SWIPE_THRESHOLD) {
      advance(dragX > 0 ? 'right' : 'left');
    } else {
      setDragX(0);
      setDragging(false);
    }
  };

  // â”€â”€ Mouse drag â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const onMouseDown = (e: React.MouseEvent) => {
    mouseDownX.current = e.clientX;
    mouseDown.current = true;
    setDragging(false);
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!mouseDown.current) return;
    const dx = e.clientX - mouseDownX.current;
    if (Math.abs(dx) > 4) {
      setDragging(true);
      setDragX(dx);
    }
  };
  const onMouseUp = () => {
    mouseDown.current = false;
    if (Math.abs(dragX) >= SWIPE_THRESHOLD) {
      advance(dragX > 0 ? 'right' : 'left');
    } else {
      setDragX(0);
      setDragging(false);
    }
  };

  // â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const card = deck[index];

  const flyX = swipeDir === 'right' ? 420 : swipeDir === 'left' ? -420 : dragX;
  const flyRotate = swipeDir ? (swipeDir === 'right' ? 20 : -20) : dragX * 0.08;
  const baseRotate = 4.277;

  // Rotate card art so each slot cycles through the 4 arts as cards are swiped
  const artAt = (offset: number) => CARD_ARTS[(index + offset) % CARD_ARTS.length];

  if (loading) {
    return (
      <div className="vocab-shell vocab-shell--loading">
        <IonSpinner name="crescent" className="vocab-spinner" />
        <p className="vocab-loading-text">Loading cards</p>
      </div>
    );
  }

  if (error || deck.length === 0) {
    return (
      <div className="vocab-shell vocab-shell--error">
        <p className="vocab-error-text">{error ?? 'No cards available.'}</p>
        <button type="button" className="vocab-btn-primary" onClick={handleRestart}>
          Try Again
        </button>
        <button type="button" className="vocab-btn-text" onClick={handleBack}>
          â† Back to Garden
        </button>
      </div>
    );
  }

  if (finished) {
    return (
      <div className="vocab-shell">
        <div className="vocab-topbar">
          <button type="button" className="vocab-back-btn" onClick={handleBack} aria-label="Back">
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
          </button>
          <span className="vocab-topbar-title">Vocab Master</span>
          <span className="vocab-topbar-spacer" />
        </div>
        <div className="vocab-result-card">
          <p className="vocab-result-emoji">Congrats!</p>
          <h2 className="vocab-result-heading">Round complete!</h2>
          <p className="vocab-result-sub">You reviewed {deck.length} Semai words.</p>
          <button type="button" className="vocab-btn-primary" onClick={handleRestart}>
            Play Again
          </button>
          <button type="button" className="vocab-btn-secondary" onClick={handleBack}>
            Back to Garden
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="vocab-shell">
      {/* Level bar */}
      <div className="vocab-topbar">
        <span className="vocab-level-label">Level {LEVEL}</span>
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

      {/* Progress bar */}
      <div
        className="vocab-progress-bar-track"
        role="progressbar"
        aria-valuenow={countdown}
        aria-valuemax={CARD_TIMER}
      >
        <div
          className={`vocab-progress-bar-fill${countdown <= 5 ? ' vocab-progress-bar-fill--urgent' : ''}`}
          style={{ width: `${(countdown / CARD_TIMER) * 100}%` }}
        />
      </div>

      {/* Stacked deck */}
      <div className="vocab-deck-area">
        {/* Back cards — card4 furthest, card3, card2 */}
        <div
          className={`vocab-card-stack vocab-card-stack--back3 ${promoting ? 'is-promoting' : ''}`}
          aria-hidden="true"
        >
          <img src={artAt(3)} alt="" className="vocab-card-bg" draggable={false} />
        </div>
        <div
          className={`vocab-card-stack vocab-card-stack--back2 ${promoting ? 'is-promoting' : ''}`}
          aria-hidden="true"
        >
          <img src={artAt(2)} alt="" className="vocab-card-bg" draggable={false} />
        </div>
        <div
          className={`vocab-card-stack vocab-card-stack--back1 ${promoting ? 'is-promoting' : ''}`}
          aria-hidden="true"
        >
          <img src={artAt(1)} alt="" className="vocab-card-bg" draggable={false} />
        </div>

        {/* Front card — card1, flippable + swipeable */}
        <div
          className={`vocab-card-flipper ${flipped ? 'is-flipped' : ''} ${swipeDir ? 'is-flying' : ''}`}
          style={{
            transform: `translateX(${flyX}px) rotate(${baseRotate + flyRotate}deg)`,
            opacity: swipeDir ? 0 : 1,
          }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
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
            <button
              type="button"
              className="vocab-sound-btn"
              aria-label="Pronounce word"
              onClick={(e) => {
                e.stopPropagation();
                triggerHapticFeedback('light');
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="31"
                height="31"
                viewBox="0 0 31 31"
                fill="none"
              >
                <circle opacity="0.3" cx="15.5" cy="15.5" r="15.5" fill="white" />
                {/* speaker icon centered: original 16x15 viewBox, translated to center in 31x31 */}
                <g transform="translate(7.5, 8)">
                  <path
                    d="M0.260816 4.81468L0.00240064 8.26989C-0.0331315 8.74498 0.326507 9.16276 0.801598 9.19829L3.393 9.3921L6.02236 12.4466C6.52586 13.0315 7.48783 12.7125 7.54533 11.9437L8.26695 2.29507C8.32445 1.52629 7.42062 1.0678 6.83572 1.5713L3.78062 4.2093L1.18922 4.01548C0.71413 3.97995 0.296348 4.33959 0.260816 4.81468ZM11.7929 7.41444C11.9073 5.88551 11.1244 4.50663 9.89378 3.77181L9.37371 10.7254C10.6993 10.1904 11.6786 8.94336 11.7929 7.41444ZM10.1212 0.731227L10.1083 0.903987C10.0837 1.23223 10.2783 1.53344 10.5716 1.67698C12.7337 2.73337 14.1424 5.03637 13.9524 7.57595C13.7625 10.1155 12.0269 12.1834 9.73178 12.9064C9.41176 13.0041 9.18313 13.2736 9.15858 13.6019L9.14566 13.7746C9.10496 14.3188 9.62073 14.7396 10.1359 14.587C13.1476 13.6917 15.432 11.0221 15.68 7.70515C15.9281 4.38816 14.0662 1.40848 11.2213 0.0751666C10.7351 -0.160978 10.1619 0.187032 10.1212 0.731227Z"
                    fill="white"
                  />
                </g>
              </svg>
            </button>
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
            ></span>
          </>
        )}
      </div>

      {/* Word in use + scenic background */}
      <div className="vocab-bottom-section">
        {card.example_semai && (
          <div className="vocab-word-in-use">
            <p className="vocab-word-in-use__label">Word in use</p>
            <p className="vocab-word-in-use__sentence">
              {card.example_semai.split(new RegExp(`(${card.word})`, 'i')).map((part, i) =>
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
        <div className="vocab-bg-illustration" aria-hidden="true">
          <img src={vocabBg} alt="" draggable={false} />
        </div>
      </div>
    </div>
  );
}
