import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { triggerHapticFeedback } from '../lib/feedback';
import { STORIES } from '../lib/storyData';
import { getStickyHeaderPolicy } from '../lib/stickyRoutePolicy';

import './StoryPage.css';

function SearchIcon() {
  return (
    <svg className="story-search-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
      <path d="m16.5 16.5 3.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function StoryPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState('');

  const stickyPolicy = getStickyHeaderPolicy(
    location.pathname,
    new URLSearchParams(location.search),
  );
  const isCompactSticky = stickyPolicy === 'compact-sticky';

  const filtered = STORIES.filter(
    (s) =>
      s.title.toLowerCase().includes(query.toLowerCase()) ||
      s.author.toLowerCase().includes(query.toLowerCase()),
  );

  function handleCardPress(id: string) {
    triggerHapticFeedback('light');
    navigate(`/home/stories/${id}`);
  }

  return (
    <div className="story-page">
      {/* ── Red header arc ── */}
      <div className="story-header-arc" aria-hidden="true" />

      {/* ── Title in header ── */}
      <div className={isCompactSticky ? 'story-top-area is-compact-sticky' : 'story-top-area'}>
        <div className="story-header-title">Story</div>

        {/* ── Search bar ── */}
        <div className="story-search-wrap">
          <div className="story-search-bar">
            <SearchIcon />
            <input
              className="story-search-input"
              type="search"
              placeholder="Search Book Title/Author"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* ── Section header ── */}
      <div className="story-section-header">
        <span className="story-section-title">Story</span>
      </div>

      {/* ── Grid ── */}
      <div className="story-grid">
        {filtered.length === 0 ? (
          <p className="story-empty">No stories found for "{query}"</p>
        ) : (
          filtered.map((s) => (
            <button
              type="button"
              key={s.id}
              className="story-card"
              onClick={() => handleCardPress(s.id)}
            >
              <div className="story-card-cover">
                <img src={s.cover} alt={s.title} />
              </div>
              <span className="story-card-title">{s.title}</span>
              <span className="story-card-author">{s.author}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
