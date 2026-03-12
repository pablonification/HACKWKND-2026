import { useNavigate } from 'react-router-dom';

import { triggerHapticFeedback } from '../lib/feedback';
import { STORIES } from '../lib/storyData';
import { useAuthStore } from '../stores/authStore';

import bgLearner from '../../assets/landing/background-learner.png';
import bgElder from '../../assets/landing/background-elder.png';
import imgGardenCard from '../../assets/landing/garden-card.png';
import imgTaviCard from '../../assets/landing/tavi-card.png';
import imgRecordCard from '../../assets/landing/record-card.png';
import imgTranslateCard from '../../assets/landing/translate-card.png';

import './LandingPage.css';

// ── Shared ──────────────────────────────────────────────────────────────────

function SearchIcon() {
  return (
    <svg className="landing-search-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
      <path d="m16.5 16.5 3.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

const BOOKS = STORIES.slice(0, 4).map((story) => ({
  id: story.id,
  title: story.title,
  subtitle: story.author,
  img: story.cover,
}));

const FEATURED_STORY =
  [...STORIES].sort((first, second) => second.progress - first.progress)[0] ?? STORIES[0];

const LEARNER_PULSE = [
  {
    label: 'Stories in progress',
    value: String(STORIES.filter((story) => story.progress > 0).length),
  },
  {
    label: 'Pages ready to read',
    value: String(STORIES.reduce((total, story) => total + story.totalPages, 0)),
  },
  {
    label: 'Activities available',
    value: '5',
  },
] as const;

const ELDER_PULSE = [
  {
    label: 'Archive-ready stories',
    value: String(STORIES.length),
  },
  {
    label: 'Featured folk tales',
    value: String(BOOKS.length),
  },
  {
    label: 'Translation tools',
    value: '2',
  },
] as const;

function BookRow({ label, onSelect }: { label: string; onSelect: (storyId: string) => void }) {
  return (
    <div className="landing-section">
      <h2 className="landing-section-title">{label}</h2>
      <div className="landing-books-wrap">
        <div className="landing-books-bg" />
        <div className="landing-books-row">
          {BOOKS.map((b) => (
            <button
              key={b.id}
              type="button"
              className="landing-book-item"
              onClick={() => onSelect(b.id)}
              aria-label={`Open ${b.title}`}
            >
              <div className="landing-book-cover">
                <img src={b.img} alt={b.title} />
              </div>
              <span className="landing-book-title">{b.title}</span>
              <span className="landing-book-sub">{b.subtitle}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Learner Landing ─────────────────────────────────────────────────────────

function LearnerLanding({
  firstName,
  onNavigate,
}: {
  firstName: string;
  onNavigate: (h: string) => void;
}) {
  return (
    <section className="landing-shell landing-shell--learner">
      {/* Hero */}
      <div className="landing-hero" aria-hidden="true">
        <img src={bgLearner} alt="" draggable={false} />
        <div className="landing-hero-greeting">
          <span>Hello, {firstName}</span>
        </div>
      </div>

      {/* Floating search */}
      <div className="landing-search-wrap">
        <button
          type="button"
          className="landing-search-bar"
          onClick={() => onNavigate('/home/ai')}
          aria-label="Search"
        >
          <SearchIcon />
          <span className="landing-search-placeholder">What would you like to explore today?</span>
        </button>
      </div>

      <div className="landing-card">
        <div className="landing-section">
          <h2 className="landing-section-title">Last Read</h2>
          <button
            type="button"
            className="landing-last-read"
            onClick={() => onNavigate(`/home/stories/${FEATURED_STORY.id}`)}
          >
            <div className="landing-last-read-cover">
              <img src={FEATURED_STORY.cover} alt={FEATURED_STORY.title} />
            </div>
            <div className="landing-last-read-info">
              <span className="landing-last-read-title">{FEATURED_STORY.title}</span>
              <span className="landing-last-read-author">by {FEATURED_STORY.author}</span>
              <div className="landing-last-read-bar" aria-hidden="true">
                <div
                  className="landing-last-read-bar-fill"
                  style={{ width: `${FEATURED_STORY.progress}%` }}
                />
              </div>
              <span className="landing-last-read-pct">
                {FEATURED_STORY.progress > 0
                  ? `${FEATURED_STORY.progress}% complete`
                  : `${FEATURED_STORY.totalPages} pages ready`}
              </span>
              <span className="landing-last-read-cta">Continue reading</span>
            </div>
          </button>
        </div>

        <BookRow
          label="Top Tale This Week"
          onSelect={(storyId) => onNavigate(`/home/stories/${storyId}`)}
        />

        <div className="landing-section">
          <h2 className="landing-section-title">Weekly Taleka Pulse</h2>
          <div className="landing-metrics" role="list">
            {LEARNER_PULSE.map((item) => (
              <article key={item.label} className="landing-metric-card" role="listitem">
                <strong>{item.value}</strong>
                <span>{item.label}</span>
              </article>
            ))}
          </div>
        </div>

        <div className="landing-section">
          <h2 className="landing-section-title">Explore Taleka</h2>
          <div className="landing-action-cards">
            <button
              type="button"
              className="landing-action-card landing-action-card--green"
              onClick={() => onNavigate('/home/garden')}
            >
              <img src={imgGardenCard} alt="" className="landing-action-card-img" />
            </button>
            <button
              type="button"
              className="landing-action-card landing-action-card--blue"
              onClick={() => onNavigate('/home/ai')}
            >
              <img src={imgTaviCard} alt="" className="landing-action-card-img" />
            </button>
            <button
              type="button"
              className="landing-action-card landing-action-card--pink"
              onClick={() => onNavigate('/home/translation')}
            >
              <img src={imgTranslateCard} alt="" className="landing-action-card-img" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Elder Landing ───────────────────────────────────────────────────────────

function ElderLanding({
  firstName: _firstName,
  onNavigate,
}: {
  firstName: string;
  onNavigate: (h: string) => void;
}) {
  return (
    <section className="landing-shell landing-shell--elder">
      {/* Hero */}
      <div className="landing-hero landing-hero--elder" aria-hidden="true">
        <img src={bgElder} alt="" draggable={false} />
      </div>

      {/* Floating search */}
      <div className="landing-search-wrap ">
        <button
          type="button"
          className="landing-search-bar"
          onClick={() => onNavigate('/home/ai')}
          aria-label="Search"
        >
          <SearchIcon />
          <span className="landing-search-placeholder">What would you like to record today?</span>
        </button>
      </div>

      <div className="landing-card">
        <BookRow
          label="Story Archive Highlights"
          onSelect={(storyId) => onNavigate(`/home/stories/${storyId}`)}
        />

        <div className="landing-section">
          <h2 className="landing-section-title">Studio readiness</h2>
          <div className="landing-metrics" role="list">
            {ELDER_PULSE.map((item) => (
              <article key={item.label} className="landing-metric-card" role="listitem">
                <strong>{item.value}</strong>
                <span>{item.label}</span>
              </article>
            ))}
          </div>
        </div>

        <div className="landing-section">
          <h2 className="landing-section-title">Create in Taleka</h2>
          <div className="landing-action-cards">
            <button
              type="button"
              className="landing-action-card"
              onClick={() => onNavigate('/home/studio')}
            >
              <img src={imgRecordCard} alt="" className="landing-action-card-img" />
            </button>
            <button
              type="button"
              className="landing-action-card"
              onClick={() => onNavigate('/home/translation')}
            >
              <img src={imgTranslateCard} alt="" className="landing-action-card-img" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Export ──────────────────────────────────────────────────────────────────

export function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const meta = user?.user_metadata as Record<string, unknown> | undefined;
  const fullName = meta?.full_name as string | undefined;
  const firstName = fullName?.split(' ')[0] || 'there';
  const role = meta?.role as string | undefined;
  const isElder = role === 'elder' || role === 'admin';

  const onNavigate = (href: string) => {
    triggerHapticFeedback('light');
    navigate(href);
  };

  return isElder ? (
    <ElderLanding firstName={firstName} onNavigate={onNavigate} />
  ) : (
    <LearnerLanding firstName={firstName} onNavigate={onNavigate} />
  );
}
