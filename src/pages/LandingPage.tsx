import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { AppSkeleton } from '../components/ui';
import { triggerHapticFeedback } from '../lib/feedback';
import { addExploreEntry } from '../lib/navigationEntry';
import { fetchProfileDashboard } from '../lib/profile';
import { STORIES } from '../lib/storyData';
import { useAuthStore } from '../stores/authStore';

import aiTaviCardImg from '../../assets/home-revised/ai-tavi.png';
import ajengAvatarImg from '../../assets/home-revised/ajeng.png';
import bayuAvatarImg from '../../assets/home-revised/bayu.png';
import elderStudioCardImg from '../../assets/home-revised/elder-studio.png';
import gardenCardImg from '../../assets/home-revised/lang-garden.png';
import translateCardImg from '../../assets/home-revised/translate.png';
import bgLearner from '../../assets/landing/background-learner.png';
import bgElder from '../../assets/landing/background-elder.png';
import rankingFirstAvatarImg from '../../assets/landing/figma/rank-first-avatar.png';
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

function LandingPageSkeleton({ isElder }: { isElder: boolean }) {
  return (
    <section className="landing-shell landing-shell--skeleton" aria-label="Loading home">
      <div className={`landing-skeleton-hero${isElder ? ' landing-skeleton-hero--elder' : ''}`}>
        <AppSkeleton className="app-skeleton--card landing-skeleton-hero-block" />
        {!isElder ? <AppSkeleton className="app-skeleton--pill landing-skeleton-greeting" /> : null}
      </div>

      <div className="landing-search-wrap">
        <div className="landing-search-bar landing-search-bar--skeleton" aria-hidden="true">
          <AppSkeleton className="app-skeleton--circle" width={18} height={18} />
          <AppSkeleton className="app-skeleton--pill" width="68%" height={14} />
        </div>
      </div>

      <div className="landing-card landing-card--skeleton" aria-hidden="true">
        {Array.from({ length: isElder ? 3 : 4 }).map((_, index) => (
          <div key={index} className="landing-section landing-section--skeleton">
            <AppSkeleton className="app-skeleton--pill landing-skeleton-section-title" />
            <div className="landing-skeleton-card">
              <AppSkeleton className="app-skeleton--card landing-skeleton-card-block" />
              <div className="landing-skeleton-lines">
                <AppSkeleton className="app-skeleton--pill" width="84%" height={14} />
                <AppSkeleton className="app-skeleton--pill" width="62%" height={12} />
                <AppSkeleton className="app-skeleton--pill" width="48%" height={12} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

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

const STATIC_WEEKLY_RANKING = [
  {
    id: 'runner-up',
    name: 'Bayu',
    score: '300 WL',
    rank: '2',
    tone: 'second',
    avatarSrc: bayuAvatarImg,
    avatarClassName: 'landing-ranking-avatar-img--bayu',
  },
  {
    id: 'leader',
    score: '527 WL',
    rank: '1',
    tone: 'first',
  },
  {
    id: 'third-place',
    name: 'Ajeng',
    score: '200 WL',
    rank: '3',
    tone: 'third',
    avatarSrc: ajengAvatarImg,
    avatarClassName: 'landing-ranking-avatar-img--ajeng',
  },
] as const;

function WeeklyTalekaRanking({
  leaderName,
  leaderAvatarSrc,
  leaderHasCustomPhoto,
}: {
  leaderName: string;
  leaderAvatarSrc: string;
  leaderHasCustomPhoto: boolean;
}) {
  return (
    <div className="landing-section">
      <h2 className="landing-section-title">Weekly Taleka Ranking</h2>
      <div className="landing-ranking-board">
        <div className="landing-ranking-stage" role="list" aria-label="Weekly ranking">
          {STATIC_WEEKLY_RANKING.map((item) => {
            const isLeader = item.id === 'leader';
            const avatarSrc = isLeader ? leaderAvatarSrc : item.avatarSrc;
            const avatarClassName = isLeader
              ? leaderHasCustomPhoto
                ? 'landing-ranking-avatar-img landing-ranking-avatar-img--leader-photo'
                : 'landing-ranking-avatar-img landing-ranking-avatar-img--leader-fallback'
              : item.avatarClassName;
            const displayName = isLeader ? leaderName : item.name;

            return (
              <article
                key={item.id}
                className={`landing-ranking-podium landing-ranking-podium--${item.tone}`}
                role="listitem"
              >
                <div className="landing-ranking-avatar-wrap" aria-hidden="true">
                  <div
                    className={`landing-ranking-avatar-shell landing-ranking-avatar-shell--${item.tone}`}
                  >
                    <img src={avatarSrc} alt="" className={avatarClassName} />
                  </div>
                </div>
                <div className="landing-ranking-podium-body">
                  <div className="landing-ranking-podium-copy">
                    <span className="landing-ranking-podium-name">{displayName}</span>
                    <span className="landing-ranking-podium-score">{item.score}</span>
                  </div>
                  <span className="landing-ranking-podium-rank">{item.rank}</span>
                </div>
              </article>
            );
          })}
        </div>
        <div className="landing-ranking-message">
          Congratulations, {leaderName}! You achieved 1st place! 🏆
        </div>
      </div>
    </div>
  );
}

function ExploreTalekaCards({ onNavigate }: { onNavigate: (href: string) => void }) {
  return (
    <div className="landing-section">
      <h2 className="landing-section-title">Whats up on Taleka</h2>
      <div className="landing-action-cards">
        <button
          type="button"
          className="landing-action-card"
          onClick={() => onNavigate(addExploreEntry('/home/garden'))}
        >
          <img src={gardenCardImg} alt="" className="landing-action-card-img" />
        </button>

        <button
          type="button"
          className="landing-action-card"
          onClick={() => onNavigate(addExploreEntry('/home/ai'))}
        >
          <img src={aiTaviCardImg} alt="" className="landing-action-card-img" />
        </button>

        <button
          type="button"
          className="landing-action-card"
          onClick={() => onNavigate(addExploreEntry('/home/studio'))}
        >
          <img src={elderStudioCardImg} alt="" className="landing-action-card-img" />
        </button>

        <button
          type="button"
          className="landing-action-card"
          onClick={() => onNavigate(addExploreEntry('/home/translation'))}
        >
          <img src={translateCardImg} alt="" className="landing-action-card-img" />
        </button>
      </div>
    </div>
  );
}

// ── Learner Landing ─────────────────────────────────────────────────────────

function LearnerLanding({
  firstName,
  onNavigate,
  leaderName,
  leaderAvatarSrc,
  leaderHasCustomPhoto,
}: {
  firstName: string;
  onNavigate: (h: string) => void;
  leaderName: string;
  leaderAvatarSrc: string;
  leaderHasCustomPhoto: boolean;
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

        <WeeklyTalekaRanking
          leaderName={leaderName}
          leaderAvatarSrc={leaderAvatarSrc}
          leaderHasCustomPhoto={leaderHasCustomPhoto}
        />

        <ExploreTalekaCards onNavigate={onNavigate} />
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
  const [leaderName, setLeaderName] = useState('You');
  const [leaderAvatarSrc, setLeaderAvatarSrc] = useState(rankingFirstAvatarImg);
  const [leaderHasCustomPhoto, setLeaderHasCustomPhoto] = useState(false);
  const [isProfileLoading, setIsProfileLoading] = useState(true);

  const meta = user?.user_metadata as Record<string, unknown> | undefined;
  const fullName = meta?.full_name as string | undefined;
  const firstName = fullName?.split(' ')[0] || 'there';
  const role = meta?.role as string | undefined;
  const isElder = role === 'elder' || role === 'admin';

  useEffect(() => {
    let cancelled = false;

    const metadataName =
      typeof meta?.full_name === 'string' && meta.full_name.trim()
        ? (meta.full_name.trim().split(/\s+/)[0] ?? 'You')
        : null;
    const metadataAvatar =
      typeof meta?.avatar_url === 'string' && meta.avatar_url.trim()
        ? meta.avatar_url.trim()
        : null;

    setLeaderName(metadataName ?? firstName);
    setLeaderAvatarSrc(metadataAvatar ?? rankingFirstAvatarImg);
    setLeaderHasCustomPhoto(Boolean(metadataAvatar));

    if (!user?.id) {
      setIsProfileLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setIsProfileLoading(true);

    void fetchProfileDashboard({
      userId: user.id,
      fallbackRole: isElder ? 'elder' : 'learner',
    })
      .then((dashboard) => {
        if (cancelled) return;

        const dashboardName = dashboard.profile.fullName.trim().split(/\s+/)[0] ?? firstName;
        setLeaderName(dashboardName || firstName);

        if (dashboard.profile.avatarUrl) {
          setLeaderAvatarSrc(dashboard.profile.avatarUrl);
          setLeaderHasCustomPhoto(true);
        }
      })
      .catch(() => {
        // Keep the landing screen usable even if profile lookup fails.
      })
      .finally(() => {
        if (!cancelled) {
          setIsProfileLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [firstName, isElder, meta?.avatar_url, meta?.full_name, user?.id]);

  const onNavigate = (href: string) => {
    triggerHapticFeedback('light');
    navigate(href);
  };

  if (isProfileLoading) {
    return <LandingPageSkeleton isElder={isElder} />;
  }

  return isElder ? (
    <ElderLanding firstName={firstName} onNavigate={onNavigate} />
  ) : (
    <LearnerLanding
      firstName={firstName}
      onNavigate={onNavigate}
      leaderName={leaderName}
      leaderAvatarSrc={leaderAvatarSrc}
      leaderHasCustomPhoto={leaderHasCustomPhoto}
    />
  );
}
