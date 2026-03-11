import { useNavigate } from 'react-router-dom';

import { triggerHapticFeedback } from '../lib/feedback';
import { useAuthStore } from '../stores/authStore';

import bgLearner from '../../assets/landing/background-learner.png';
import bgElder from '../../assets/landing/background-elder.png';
import imgNafiri from '../../assets/landing/nafiri.png';
import imgBoano from '../../assets/landing/boano.png';
import imgSunbeFenyi from '../../assets/landing/sunbe-fenyi.png';
import imgFifineImbo from '../../assets/landing/fifine-imbo.png';
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

const BOOKS = [
  { id: 'nafiri', title: 'Nafiri', subtitle: 'A Myth of th..', img: imgNafiri },
  { id: 'boano', title: 'Boano', subtitle: 'A Legend of..', img: imgBoano },
  { id: 'sunbe', title: 'Sunbe & Fenyi', subtitle: 'The Story of...', img: imgSunbeFenyi },
  { id: 'fifine', title: 'Fifine & Imbo', subtitle: 'The Tale of t..', img: imgFifineImbo },
] as const;

function BookRow({ label }: { label: string }) {
  return (
    <div className="landing-section">
      <h2 className="landing-section-title">{label}</h2>
      <div className="landing-books-wrap">
        <div className="landing-books-bg" />
        <div className="landing-books-row">
          {BOOKS.map((b) => (
            <div key={b.id} className="landing-book-item">
              <div className="landing-book-cover">
                <img src={b.img} alt={b.title} />
              </div>
              <span className="landing-book-title">{b.title}</span>
              <span className="landing-book-sub">{b.subtitle}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Learner Landing ─────────────────────────────────────────────────────────

// TODO: Replace with real leaderboard data fetched from Supabase.
// Showing empty state until real data is available.
const RANKING: { name: string; wl: number; rank: number; color: string; avatar: string }[] = [];

const BAR_HEIGHTS: Record<number, number> = { 1: 154, 2: 116, 3: 85 };

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
          <span className="landing-search-placeholder">What are you gonna do today?</span>
        </button>
      </div>

      {/* Card */}
      <div className="landing-card">
        {/* Last read — TODO: fetch real last-read story and progress from Supabase */}
        <div className="landing-section">
          <h2 className="landing-section-title">Last Read</h2>
          <div className="landing-last-read-empty">
            <span>Start reading a story to see your progress here!</span>
          </div>
        </div>

        {/* Top Tale */}
        <BookRow label="Top Tale This Week" />

        {/* Weekly Ranking */}
        <div className="landing-section">
          <h2 className="landing-section-title">Weekly Taleka Ranking</h2>
          <div className="landing-ranking">
            {RANKING.length === 0 ? (
              <div className="landing-ranking-empty">
                <span>Rankings coming soon. Keep reading to earn WL!</span>
              </div>
            ) : (
              <>
                <div className="landing-ranking-bars">
                  {RANKING.map((r) => (
                    <div key={r.rank} className="landing-ranking-col">
                      <div className="landing-ranking-avatar-wrap">
                        <img src={r.avatar} alt={r.name} className="landing-ranking-avatar" />
                      </div>
                      <div
                        className="landing-ranking-bar"
                        style={{ height: BAR_HEIGHTS[r.rank], background: r.color }}
                      >
                        <div className="landing-ranking-bar-info">
                          <span className="landing-ranking-name">{r.name}</span>
                          <span className="landing-ranking-wl">{r.wl} WL</span>
                        </div>
                        <span className="landing-ranking-num">{r.rank}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="landing-ranking-note">
                  🏆 {RANKING[0]?.name} is leading this week!
                </div>
              </>
            )}
          </div>
        </div>

        {/* Whats up */}
        <div className="landing-section">
          <h2 className="landing-section-title">Whats up on Taleka</h2>
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
          <span className="landing-search-placeholder">What are you gonna do today?</span>
        </button>
      </div>

      {/* Card */}
      <div className="landing-card">
        {/* Top Record */}
        <BookRow label="Top Record This Week" />

        {/* Whats up */}
        <div className="landing-section">
          <h2 className="landing-section-title">Whats up on Taleka</h2>
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
