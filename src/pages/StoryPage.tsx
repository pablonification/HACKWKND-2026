import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { triggerHapticFeedback } from '../lib/feedback';
import { supabase } from '../lib/supabase';
import { STORIES, type Story, type StoryScene } from '../lib/storyData';

import './StoryPage.css';

function SearchIcon() {
  return (
    <svg className="story-search-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
      <path d="m16.5 16.5 3.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

type PublishedRow = {
  id: string;
  title: string;
  description: string | null;
  cover_url: string;
  bg_url: string;
  duration_seconds: number | null;
  transcription: string | null;
  verified_transcription: string | null;
  verified_translation_ms: string | null;
  topic_tags: string[] | null;
};

function buildScenes(row: PublishedRow): StoryScene[] {
  const rawText = row.verified_transcription ?? row.transcription ?? '';
  const paragraphs = rawText
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const translations = (row.verified_translation_ms ?? '')
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  return paragraphs.map((para, i) => ({
    image: row.bg_url,
    text: para,
    subtitle: translations[i] ?? undefined,
  }));
}

function rowToStory(row: PublishedRow): Story {
  const mins = row.duration_seconds ? Math.max(1, Math.ceil(row.duration_seconds / 60)) : null;
  const scenes = buildScenes(row);
  return {
    id: row.id,
    title: row.title,
    author: 'Elder Story',
    cover: row.cover_url,
    bg: row.bg_url,
    duration: mins ? `${mins} min` : '—',
    pages: Math.max(1, scenes.length),
    genre: row.topic_tags?.[0] ?? 'Semai Story',
    synopsis:
      row.description ??
      row.verified_transcription ??
      row.transcription ??
      'A recorded Semai story.',
    lastChapter: 'Chapter 1',
    lastPage: 1,
    totalPages: Math.max(1, scenes.length),
    progress: 0,
    scenes,
  };
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function StoryPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [publishedStories, setPublishedStories] = useState<Story[]>([]);

  useEffect(() => {
    supabase
      .from('recordings')
      .select(
        'id, title, description, cover_url, bg_url, duration_seconds, transcription, verified_transcription, verified_translation_ms, topic_tags',
      )
      .eq('is_published', true)
      .not('cover_url', 'is', null)
      .not('bg_url', 'is', null)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) {
          setPublishedStories((data as PublishedRow[]).map(rowToStory));
        }
      });
  }, []);

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
