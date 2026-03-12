import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

import { triggerHapticFeedback } from '../lib/feedback';

const AUTO_DISMISS_SECS = 20;

// Level images
import sproutImg from '../../assets/level/sprout.png';
import saplingImg from '../../assets/level/sapling.png';
import treeImg from '../../assets/level/tree.png';

// Level name text SVGs
import sproutText from '../../assets/level/sprout.svg';
import saplingText from '../../assets/level/sapling.svg';
import treeText from '../../assets/level/tree.svg';

import './LevelUpPage.css';

export type LevelName = 'sprout' | 'sapling' | 'tree';

interface LevelConfig {
  img: string;
  text: string;
}

const LEVELS: Record<LevelName, LevelConfig> = {
  sprout: {
    img: sproutImg,
    text: sproutText,
  },
  sapling: {
    img: saplingImg,
    text: saplingText,
  },
  tree: {
    img: treeImg,
    text: treeText,
  },
};

interface LevelUpPageProps {
  /** Which level was just reached. Falls back to location state or 'sprout'. */
  level?: LevelName;
}

export function LevelUpPage({ level: propLevel }: LevelUpPageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const level: LevelName =
    propLevel ?? (location.state as { level?: LevelName } | null)?.level ?? 'sprout';

  const config = LEVELS[level] ?? LEVELS['sprout'];

  const [remaining, setRemaining] = useState(AUTO_DISMISS_SECS);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleHome = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    triggerHapticFeedback('medium');
    navigate('/home/garden', { replace: true });
  }, [navigate]);

  // Auto-dismiss after 20 s
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setRemaining((s) => {
        if (s <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Navigate once countdown hits zero (kept outside setState updater — no side effects in updaters)
  useEffect(() => {
    if (remaining === 0) {
      navigate('/home/garden', { replace: true });
    }
  }, [remaining, navigate]);

  return (
    <div className="levelup-shell">
      {/* Title */}
      <h1 className="levelup-title">Level Up!</h1>

      {/* Level name text (gradient SVG) */}
      <div className="levelup-level-name">
        <img src={config.text} alt={level} className="levelup-level-text-img" draggable={false} />
      </div>

      {/* Glow orb + character illustration */}
      <div className="levelup-illustration-area">
        <div className="levelup-glow" />
        <img
          src={config.img}
          alt={`${level} character`}
          className="levelup-character-img"
          draggable={false}
        />
      </div>

      {/* Back to Garden button */}
      <div className="levelup-footer">
        <button type="button" className="levelup-btn" onClick={handleHome}>
          {/* home icon */}
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M9.02 2.84L3.63 7.04C2.73 7.74 2 9.23 2 10.36V17.77C2 20.09 3.89 21.99 6.21 21.99H17.79C20.11 21.99 22 20.09 22 17.78V10.5C22 9.29 21.19 7.74 20.2 7.05L14.02 2.72C12.62 1.74 10.37 1.79 9.02 2.84Z"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M12 17.99V14.99"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>Back to Garden ({remaining}s)</span>
        </button>
        {/* Countdown progress bar */}
      </div>
    </div>
  );
}
