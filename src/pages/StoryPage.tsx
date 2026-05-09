import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { triggerHapticFeedback } from '../lib/feedback';
import {
  PUBLISHED_STORY_SELECT,
  publishedStoryRowToStory,
  type PublishedStoryRow,
} from '../lib/publishedStory';
import { supabase } from '../lib/supabase';
import { STORIES, type Story } from '../lib/storyData';

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
  const [searchParams] = useSearchParams();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [publishedStories, setPublishedStories] = useState<Story[]>([]);
  const [publishedStoryError, setPublishedStoryError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('recordings')
      .select(PUBLISHED_STORY_SELECT)
      .eq('is_published', true)
      .not('cover_url', 'is', null)
      .not('bg_url', 'is', null)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          console.warn('Failed to load published stories:', error.message);
          setPublishedStoryError('Published stories could not be loaded right now.');
          return;
        }

        if (data) {
          setPublishedStoryError(null);
          setPublishedStories((data as PublishedStoryRow[]).map(publishedStoryRowToStory));
        }
      });
  }, []);

  useEffect(() => {
    if (searchParams.get('focusSearch') !== '1') return;
    window.requestAnimationFrame(() => searchInputRef.current?.focus());
  }, [searchParams]);

  const allStories = [...STORIES, ...publishedStories];

  const filtered = allStories.filter(
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
      <div className="story-header-title">Story</div>

      {/* ── Search bar ── */}
      <div className="story-search-wrap">
        <div className="story-search-bar">
          <SearchIcon />
          <input
            ref={searchInputRef}
            className="story-search-input"
            type="search"
            placeholder="Search Book Title/Author"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {/* ── Section header ── */}
      <div className="story-section-header">
        <span className="story-section-title">Story</span>
      </div>

      {/* ── Grid ── */}
      <div className="story-grid">
        {publishedStoryError ? <p className="story-empty">{publishedStoryError}</p> : null}
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
