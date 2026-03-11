import { useNavigate, useParams } from 'react-router-dom';
import { triggerHapticFeedback } from '../lib/feedback';
import { STORIES } from '../lib/storyData';

import './StoryDetailPage.css';

// ── Icons ────────────────────────────────────────────────────────────────────

function BackIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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

function TimerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="13" r="8" stroke="#604828" strokeWidth="1.5" />
      <path d="M12 9v4l2.5 2.5" stroke="#604828" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M9 2h6" stroke="#604828" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function PagesIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="2" width="12" height="18" rx="2" stroke="#604828" strokeWidth="1.5" />
      <path d="M8 7h6M8 11h6M8 15h4" stroke="#604828" strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="M16 6h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H8"
        stroke="#604828"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function GenreIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="4" stroke="#604828" strokeWidth="1.5" />
      <path
        d="M4 20c0-4 3.58-7 8-7s8 3 8 7"
        stroke="#604828"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function StoryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const story = STORIES.find((s) => s.id === id);

  if (!story) {
    return (
      <div className="story-detail-page story-detail-not-found">
        <button type="button" className="story-detail-back-btn" onClick={() => navigate(-1)}>
          <BackIcon />
        </button>
        <p>Story not found.</p>
      </div>
    );
  }

  function handleBack() {
    triggerHapticFeedback('light');
    navigate(-1);
  }

  function handleContinue() {
    triggerHapticFeedback('medium');
    if (!story!.scenes || story!.scenes.length === 0) {
      // Story content not yet available — prevent navigating to a dead-end
      return;
    }
    navigate(`/home/stories/${story!.id}/read`);
  }

  const progressPct = Math.min(100, Math.max(0, story.progress));

  return (
    <div className="story-detail-page">
      {/* ── Blurred hero background ── */}
      <div className="story-detail-hero-blur" aria-hidden="true">
        <img src={story.bg} alt="" />
      </div>
      <div className="story-detail-hero-fade" aria-hidden="true" />

      {/* ── Back button ── */}
      <button
        type="button"
        className="story-detail-back-btn"
        onClick={handleBack}
        aria-label="Go back"
      >
        <BackIcon />
      </button>

      {/* ── Book cover + title ── */}
      <div className="story-detail-cover-wrap">
        <div className="story-detail-cover-shadow" />
        <div className="story-detail-cover">
          <img src={story.cover} alt={story.title} />
        </div>
        <div className="story-detail-cover-meta">
          <span className="story-detail-title">{story.title}</span>
          <span className="story-detail-author">{story.author}</span>
        </div>
      </div>

      {/* ── Stats row: Durasi / Pages / Genre ── */}
      <div className="story-detail-stats">
        <div className="story-detail-stat-card">
          <div className="story-detail-stat-label">Durasi</div>
          <div className="story-detail-stat-value">
            <TimerIcon />
            <span>{story.duration}</span>
          </div>
        </div>
        <div className="story-detail-stat-card">
          <div className="story-detail-stat-label">Pages</div>
          <div className="story-detail-stat-value">
            <PagesIcon />
            <span>{story.pages}</span>
          </div>
        </div>
        <div className="story-detail-stat-card">
          <div className="story-detail-stat-label">Genre</div>
          <div className="story-detail-stat-value">
            <GenreIcon />
            <span>{story.genre}</span>
          </div>
        </div>
      </div>

      {/* ── Progress card ── */}
      <div className="story-detail-progress-card">
        <span className="story-detail-progress-chapter">
          {story.progress > 0 ? story.lastChapter : 'Scene 1'}
        </span>
        <div className="story-detail-progress-row">
          <span className="story-detail-progress-page">
            Page <strong>{story.progress > 0 ? story.lastPage : 0}</strong> of {story.totalPages}
          </span>
          <span className="story-detail-progress-pct">{progressPct}%</span>
        </div>
        <div className="story-detail-progress-track">
          <div className="story-detail-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {/* ── Synopsis ── */}
      <div className="story-detail-synopsis-section">
        <h2 className="story-detail-synopsis-heading">Synopsis</h2>
        <p className="story-detail-synopsis-body">
          {story.synopsis.split('\n\n').map((para, i) => (
            <span key={i}>
              {para}
              {i < story.synopsis.split('\n\n').length - 1 && (
                <>
                  <br />
                  <br />
                </>
              )}
            </span>
          ))}
        </p>
      </div>

      {/* ── CTA button ── */}
      <div className="story-detail-cta-wrap">
        <button
          type="button"
          className="story-detail-cta-btn"
          onClick={handleContinue}
          disabled={!story.scenes || story.scenes.length === 0}
        >
          {!story.scenes || story.scenes.length === 0
            ? 'Coming Soon'
            : story.progress > 0
              ? 'Continue Reading'
              : 'Start Reading'}
        </button>
      </div>
    </div>
  );
}
