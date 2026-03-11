import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { triggerHapticFeedback } from '../lib/feedback';
import { STORIES } from '../lib/storyData';
import cloudOverlayUp from '../../assets/story/cloud-overlay-up.png';
import cloudOverlayDown from '../../assets/story/cloud-overlay-down.png';

import './StoryReadPage.css';

// ── Back chevron ─────────────────────────────────────────────────────────────
function BackIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M13 18l-6-6 6-6"
        stroke="#604828"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── Swipe double-arrow hint ───────────────────────────────────────────────────
function SwipeArrow() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 9l6 6 6-6"
        stroke="#604828"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        transform="rotate(-90 12 12)"
      />
      <path
        d="M2 9l6 6 6-6"
        stroke="#604828"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        transform="rotate(-90 8 12)"
      />
    </svg>
  );
}

// ── Render text with an optional highlighted (underlined) word ────────────────
function StoryText({ text, highlightWord }: { text: string; highlightWord?: string }) {
  if (!highlightWord) {
    return (
      <p className="story-read-text">
        {text.split('\n').map((line, i, arr) => (
          <span key={i}>
            {line}
            {i < arr.length - 1 && <br />}
          </span>
        ))}
      </p>
    );
  }

  // For each line, highlight the first occurrence of highlightWord
  return (
    <p className="story-read-text">
      {text.split('\n').map((line, lineIdx, lines) => {
        const idx = line.toLowerCase().indexOf(highlightWord.toLowerCase());
        let content: React.ReactNode;
        if (idx !== -1) {
          const matched = line.slice(idx, idx + highlightWord.length);
          content = (
            <>
              {line.slice(0, idx)}
              <span className="story-read-highlight">
                <span className="story-read-highlight-bg" />
                <span className="story-read-highlight-word">{matched}</span>
              </span>
              {line.slice(idx + highlightWord.length)}
            </>
          );
        } else {
          content = line;
        }
        return (
          <span key={lineIdx}>
            {content}
            {lineIdx < lines.length - 1 && <br />}
          </span>
        );
      })}
    </p>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function StoryReadPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const story = STORIES.find((s) => s.id === id);

  const [currentScene, setCurrentScene] = useState(0);

  // Touch swipe state
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  // Keyboard / swipe navigation for desktop testing
  useEffect(() => {
    if (!story || !story.scenes || story.scenes.length === 0) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentScene, story]);

  if (!story || !story.scenes || story.scenes.length === 0) {
    return (
      <div className="story-read-missing">
        <button type="button" onClick={() => navigate(-1)} className="story-read-back-btn">
          <BackIcon />
        </button>
        <p>Story not found or has no scenes.</p>
      </div>
    );
  }

  const scenes = story.scenes;
  const scene = scenes[currentScene];
  const isLast = currentScene === scenes.length - 1;

  function goNext() {
    if (isLast) {
      // End of story — go back to detail page
      triggerHapticFeedback('medium');
      navigate(`/home/stories/${id}`, { replace: false });
      return;
    }
    triggerHapticFeedback('light');
    setCurrentScene((c) => Math.min(c + 1, scenes.length - 1));
  }

  function goPrev() {
    if (currentScene === 0) return;
    triggerHapticFeedback('light');
    setCurrentScene((c) => Math.max(c - 1, 0));
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;
    // Only trigger if horizontal swipe > 40px and dominant axis is horizontal
    if (Math.abs(dx) < 40 || Math.abs(dy) > Math.abs(dx) * 0.8) return;
    // Prevent the browser-synthesised click that follows touchend from double-firing goNext
    e.preventDefault();
    if (dx < 0) goNext();
    else goPrev();
  }

  return (
    <div
      className="story-read-root"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClick={goNext}
    >
      <div className="story-read-scene">
        {/* ── Full-screen scene image ── */}
        <div className="story-read-scene-img-wrap">
          <img src={scene.image} alt="" className="story-read-scene-img" draggable={false} />
        </div>

        {/* ── Top cloud overlay ── */}
        <img
          src={cloudOverlayUp}
          alt=""
          className="story-read-cloud-top"
          aria-hidden="true"
          draggable={false}
        />

        {/* ── Bottom cloud overlay ── */}
        <img
          src={cloudOverlayDown}
          alt=""
          className="story-read-cloud-bottom"
          aria-hidden="true"
          draggable={false}
        />

        {/* ── Top header: title + author ── */}
        <div className="story-read-header">
          <button
            type="button"
            className="story-read-back-btn"
            onClick={(e) => {
              e.stopPropagation();
              triggerHapticFeedback('light');
              navigate(-1);
            }}
            aria-label="Back"
          >
            <BackIcon />
          </button>

          <div className="story-read-title-block">
            <span className="story-read-title">{story.title}</span>
            <span className="story-read-author">by {story.author}</span>
          </div>
        </div>

        {/* ── Bottom text block ── */}
        <div className="story-read-text-area">
          <div className="story-read-content-center">
            <StoryText text={scene.text} highlightWord={scene.highlightWord} />
          </div>
        </div>

        {/* ── Swipe hint (or "Finish" on last scene) ── */}
        <div className="story-read-swipe-hint" aria-hidden="true">
          {isLast ? (
            <span className="story-read-finish-hint">Tap to finish</span>
          ) : (
            <>
              <span>Swipe</span>
              <SwipeArrow />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
