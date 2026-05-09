import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { AppSkeleton } from '../components/ui';
import { LearningLanguageBadge } from '../components/LearningLanguageBadge';
import { withTimeout } from '../lib/asyncTimeout';
import { triggerHapticFeedback } from '../lib/feedback';
import { DEFAULT_LEARNING_LANGUAGE, resolveLearningLanguage } from '../lib/learningLanguages';
import { addExploreEntry } from '../lib/navigationEntry';
import { fetchProfileDashboard } from '../lib/profile';
import { STORIES, type Story } from '../lib/storyData';
import { getLastReadStory, getStoryProgress, type StoryProgressEntry } from '../lib/storyProgress';
import { useAuthStore } from '../stores/authStore';

import aiTaviCardImg from '../../assets/home-revised/ai-tavi.png';
import ajengAvatarImg from '../../assets/home-revised/ajeng.png';
import bayuAvatarImg from '../../assets/home-revised/bayu.png';
import defaultLeaderboardImg from '../../assets/home-revised/default-leaderboard.png';
import gardenCardImg from '../../assets/home-revised/lang-garden.png';
import translateCardImg from '../../assets/home-revised/translate.png';
import bgLearner from '../../assets/landing/background-learner.png';
import bgElder from '../../assets/landing/background-elder.png';

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

function RecordStoryIcon() {
  return (
    <svg className="landing-elder-action-icon" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path
        d="M16 4.5a5.25 5.25 0 0 1 5.25 5.25v5.5a5.25 5.25 0 1 1-10.5 0v-5.5A5.25 5.25 0 0 1 16 4.5Z"
        stroke="currentColor"
        strokeWidth="2.4"
      />
      <path
        d="M7.5 14.5a8.5 8.5 0 0 0 17 0M16 23v4.5M12.25 27.5h7.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2.4"
      />
    </svg>
  );
}

function ReadStoriesIcon() {
  return (
    <svg className="landing-elder-action-icon" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path
        d="M5.5 7.5c0-1.1.9-2 2-2h7.25c1.05 0 2.05.42 2.8 1.16L18 7.1l.45-.44a3.96 3.96 0 0 1 2.8-1.16h3.25c1.1 0 2 .9 2 2v17c0 1.1-.9 2-2 2h-4.25c-.83 0-1.62.33-2.2.91L18 27.46l-.05-.05a3.11 3.11 0 0 0-2.2-.91H7.5c-1.1 0-2-.9-2-2v-17Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="2.2"
      />
      <path
        d="M18 7.1v20.35M10 11h4M10 15h4M22 11h1.5M22 15h1.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2.2"
      />
    </svg>
  );
}

const BOOKS = STORIES.slice(0, 4).map((story) => ({
  id: story.id,
  title: story.title,
  subtitle: story.author,
  img: story.cover,
}));

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
      {label ? <h2 className="landing-section-title">{label}</h2> : null}
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
                    className={`landing-ranking-avatar-shell landing-ranking-avatar-shell--${item.tone}${isLeader && leaderHasCustomPhoto ? ' landing-ranking-avatar-shell--clipped' : ''}`}
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
          <span className="landing-action-card-fallback" aria-hidden="true">
            Garden
          </span>
          <img src={gardenCardImg} alt="" className="landing-action-card-img" />
        </button>

        <button
          type="button"
          className="landing-action-card"
          onClick={() => onNavigate(addExploreEntry('/home/ai'))}
        >
          <span className="landing-action-card-fallback" aria-hidden="true">
            AI Helper
          </span>
          <img src={aiTaviCardImg} alt="" className="landing-action-card-img" />
        </button>

        <button
          type="button"
          className="landing-action-card"
          onClick={() => onNavigate(addExploreEntry('/home/translation'))}
        >
          <span className="landing-action-card-fallback" aria-hidden="true">
            Translate
          </span>
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
  onOpenLanguageSettings,
  learningLanguage,
  leaderName,
  leaderAvatarSrc,
  leaderHasCustomPhoto,
  lastReadStory,
}: {
  firstName: string;
  onNavigate: (h: string) => void;
  onOpenLanguageSettings: () => void;
  learningLanguage: string;
  leaderName: string;
  leaderAvatarSrc: string;
  leaderHasCustomPhoto: boolean;
  lastReadStory: Story | null;
}) {
  return (
    <section className="landing-shell landing-shell--learner">
      {/* Hero */}
      <div className="landing-hero">
        <img src={bgLearner} alt="" draggable={false} />
        <div className="landing-hero-greeting">
          <span>Hello, {firstName}</span>
        </div>
        <LearningLanguageBadge
          language={learningLanguage}
          variant="home"
          className="landing-learning-language-badge"
          onClick={onOpenLanguageSettings}
        />
      </div>

      {/* Floating search */}
      <div className="landing-search-wrap">
        <button
          type="button"
          className="landing-search-bar"
          onClick={() => onNavigate('/home/stories?focusSearch=1')}
          aria-label="Search"
        >
          <SearchIcon />
          <span className="landing-search-placeholder">Search stories by title or author</span>
        </button>
      </div>

      <div className="landing-card">
        {lastReadStory ? (
          <div className="landing-section">
            <h2 className="landing-section-title">Last Read</h2>
            <button
              type="button"
              className="landing-last-read"
              onClick={() => onNavigate(`/home/stories/${lastReadStory.id}/read`)}
            >
              <div className="landing-last-read-cover">
                <img src={lastReadStory.cover} alt={lastReadStory.title} />
              </div>
              <div className="landing-last-read-info">
                <span className="landing-last-read-title">{lastReadStory.title}</span>
                <span className="landing-last-read-author">by {lastReadStory.author}</span>
                <div className="landing-last-read-bar" aria-hidden="true">
                  <div
                    className="landing-last-read-bar-fill"
                    style={{ width: `${lastReadStory.progress}%` }}
                  />
                </div>
                <span className="landing-last-read-pct">{lastReadStory.progress}% complete</span>
                <span className="landing-last-read-cta">Continue reading</span>
              </div>
            </button>
          </div>
        ) : null}

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
  firstName,
  onNavigate,
}: {
  firstName: string;
  onNavigate: (h: string) => void;
}) {
  return (
    <section className="landing-shell landing-shell--elder">
      <div className="landing-hero landing-hero--elder" aria-hidden="true">
        <img src={bgElder} alt="" draggable={false} />
      </div>

      <div className="landing-card landing-card--elder-simple">
        <header className="landing-elder-welcome">
          <span>Welcome, {firstName}</span>
          <h1>What would you like to do today?</h1>
          <p>Choose one clear step. You can record a story or read stories from Taleka.</p>
        </header>

        <div className="landing-elder-actions" role="list">
          <button
            type="button"
            className="landing-elder-action landing-elder-action--record"
            onClick={() => onNavigate('/home/studio')}
          >
            <span className="landing-elder-action-icon-wrap">
              <RecordStoryIcon />
            </span>
            <span className="landing-elder-action-copy">
              <strong>Record a Story</strong>
              <span>Save your voice for the next generation.</span>
            </span>
          </button>

          <button
            type="button"
            className="landing-elder-action landing-elder-action--story"
            onClick={() => onNavigate('/home/stories')}
          >
            <span className="landing-elder-action-icon-wrap">
              <ReadStoriesIcon />
            </span>
            <span className="landing-elder-action-copy">
              <strong>Read Stories</strong>
              <span>Open the Taleka story collection.</span>
            </span>
          </button>
        </div>

        <div className="landing-section">
          <h2 className="landing-section-title landing-section-title--elder">Story Highlights</h2>
          <BookRow onSelect={(storyId) => onNavigate(`/home/stories/${storyId}`)} label="" />
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
  const [leaderAvatarSrc, setLeaderAvatarSrc] = useState(defaultLeaderboardImg);
  const [leaderHasCustomPhoto, setLeaderHasCustomPhoto] = useState(false);
  const [learningLanguage, setLearningLanguage] = useState(DEFAULT_LEARNING_LANGUAGE);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [storyProgress, setStoryProgress] = useState<Record<string, StoryProgressEntry>>({});

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
    setLeaderAvatarSrc(metadataAvatar ?? defaultLeaderboardImg);
    setLeaderHasCustomPhoto(Boolean(metadataAvatar));
    setLearningLanguage(DEFAULT_LEARNING_LANGUAGE);

    if (!user?.id) {
      setIsProfileLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setIsProfileLoading(true);

    void withTimeout(
      fetchProfileDashboard({
        userId: user.id,
        fallbackRole: isElder ? 'elder' : 'learner',
      }),
      8000,
      'Timed out while loading the landing profile.',
    )
      .then((dashboard) => {
        if (cancelled) return;

        const dashboardName = dashboard.profile.fullName.trim().split(/\s+/)[0] ?? firstName;
        setLeaderName(dashboardName || firstName);

        if (dashboard.profile.avatarUrl) {
          setLeaderAvatarSrc(dashboard.profile.avatarUrl);
          setLeaderHasCustomPhoto(true);
        }
        setLearningLanguage(resolveLearningLanguage(dashboard.profile.indigenousLanguage));
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

  useEffect(() => {
    let cancelled = false;

    void getStoryProgress().then((progress) => {
      if (!cancelled) {
        setStoryProgress(progress);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const onNavigate = (href: string) => {
    triggerHapticFeedback('light');
    navigate(href);
  };

  const openLanguageSettingsFromHome = () => {
    triggerHapticFeedback('light');
    navigate('/home/profile/settings/language', {
      state: { languageSettingsEntry: 'home' },
    });
  };

  if (isProfileLoading) {
    return <LandingPageSkeleton isElder={isElder} />;
  }

  const lastReadStory = getLastReadStory(STORIES, storyProgress);

  return isElder ? (
    <ElderLanding firstName={firstName} onNavigate={onNavigate} />
  ) : (
    <LearnerLanding
      firstName={firstName}
      onNavigate={onNavigate}
      onOpenLanguageSettings={openLanguageSettingsFromHome}
      learningLanguage={learningLanguage}
      leaderName={leaderName}
      leaderAvatarSrc={leaderAvatarSrc}
      leaderHasCustomPhoto={leaderHasCustomPhoto}
      lastReadStory={lastReadStory}
    />
  );
}
