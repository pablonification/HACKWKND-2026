import { IonContent, IonPage, IonToast } from '@ionic/react';
import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { triggerHapticFeedback } from '../lib/feedback';
import { useAuthStore } from '../stores/authStore';
import { ArchiveReviewPage } from './ArchiveReviewPage';
import { AiHelperPage } from './AiHelperPage';
import { ElderStudioTab } from './ElderStudioTab';
import { LanguageGardenTab } from './LanguageGardenTab';
import { VocabMaster } from './VocabMaster';
import { WordleGame } from './WordleGame';
import { LevelUpPage } from './LevelUpPage';
import { ProfilePage } from './ProfilePage';
import { QuizGame } from './QuizGame';
import { SoundArchiveTab } from './SoundArchiveTab';
import { TranslatePage } from './TranslatePage';
import { LandingPage } from './LandingPage';
import { StoryPage } from './StoryPage';
import { StoryDetailPage } from './StoryDetailPage';
import { StoryReadPage } from './StoryReadPage';

import './HomePage.css';

// ── Learner NavBar ──────────────────────────────────────────────────────────

type LearnerTab = 'home' | 'story' | 'garden' | 'ai' | 'profile';

const LEARNER_TABS: { id: LearnerTab; label: string; href: string }[] = [
  { id: 'home', label: 'Home', href: '/home/landing' },
  { id: 'story', label: 'Story', href: '/home/stories' },
  { id: 'garden', label: 'Garden', href: '/home/garden' },
  { id: 'ai', label: 'AI', href: '/home/ai' },
  { id: 'profile', label: 'Profile', href: '/home/profile' },
];

const IconHome = ({ active }: { active: boolean }) =>
  active ? (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9.02 2.84L3.63 7.04C2.73 7.74 2 9.23 2 10.36v7.41C2 19.92 3.08 21 4.23 21h15.54C20.92 21 22 19.92 22 17.77V10.5c0-1.19-.81-2.74-1.8-3.42l-6.18-4.33c-1.4-.98-3.65-.93-5 .09Z"
        fill="#B14602"
      />
      <path
        d="M12 17v-3"
        stroke="#fff"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ) : (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9.02 2.84L3.63 7.04C2.73 7.74 2 9.23 2 10.36v7.41C2 19.92 3.08 21 4.23 21h15.54C20.92 21 22 19.92 22 17.77V10.5c0-1.19-.81-2.74-1.8-3.42l-6.18-4.33c-1.4-.98-3.65-.93-5 .09Z"
        stroke="#9DB2CE"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M12 17v-3"
        stroke="#9DB2CE"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

const IconStory = ({ active }: { active: boolean }) =>
  active ? (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M21.8184 0C23.0182 0.000104326 23.9998 1.05867 24 2.35254V17.6475C23.9998 18.9413 23.0182 19.9999 21.8184 20H2.18164C0.981845 19.9999 0.000202554 18.9413 0 17.6475V2.35254C0.000203398 1.05867 0.981846 0.000104466 2.18164 0H21.8184ZM13.0908 1.76465V18.2354H22.3633V1.76465H13.0908ZM20.7275 14.1172H14.1816V12.9414H20.7275V14.1172ZM20.7275 11.1768H14.1816V10H20.7275V11.1768ZM20.7275 8.23535H14.1816V7.05859H20.7275V8.23535Z"
        fill="#B14602"
      />
    </svg>
  ) : (
    <svg width="24" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M21.8182 0H2.18182C0.981818 0 0 1.05882 0 2.35294V17.6471C0 18.9412 0.981818 20 2.18182 20H21.8182C23.0182 20 24 18.9412 24 17.6471V2.35294C24 1.05882 23.0182 0 21.8182 0ZM1.63636 18.2353V1.76471H10.9091V18.2353H1.63636ZM22.3636 18.2353H13.0909V1.76471H17.4545H22.3636V18.2353ZM14.1818 7.05882H17.4545H20.7273V8.23529H14.1818V7.05882ZM14.1818 10H20.7273V11.1765H14.1818V10ZM14.1818 12.9412H20.7273V14.1176H14.1818V12.9412Z"
        fill="#9DB2CE"
      />
    </svg>
  );

const IconGarden = ({ active }: { active: boolean }) =>
  active ? (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <g clipPath="url(#clip0_371_12761)">
        <path
          d="M11.5 23V10.7403M8.66612 23H14.3339M18.2163 12.1747C18.4553 12.6936 18.5803 13.2466 18.5847 13.8052C18.5847 14.9432 18.0622 16.0346 17.1322 16.8393C16.2021 17.644 14.9407 18.0961 13.6254 18.0961C12.8886 18.0935 12.162 17.9468 11.5 17.667C10.838 17.9468 10.1114 18.0935 9.37459 18.0961C8.0593 18.0961 6.79789 17.644 5.86784 16.8393C4.93779 16.0346 4.41529 14.9432 4.41529 13.8052C4.41971 13.2466 4.54466 12.6936 4.7837 12.1747C4.1375 11.7111 3.63878 11.1125 3.33476 10.4355C3.03075 9.75854 2.93151 9.02562 3.04644 8.30617C3.16138 7.58673 3.48668 6.90458 3.99155 6.32435C4.49641 5.74411 5.16412 5.28499 5.93142 4.99048C6.17729 3.86835 6.86813 2.85567 7.88474 2.12716C8.90136 1.39865 10.18 1 11.5 1C12.82 1 14.0986 1.39865 15.1153 2.12716C16.1319 2.85567 16.8227 3.86835 17.0686 4.99048C17.8359 5.28499 18.5036 5.74411 19.0085 6.32435C19.5133 6.90458 19.8386 7.58673 19.9536 8.30617C20.0685 9.02562 19.9693 9.75854 19.6652 10.4355C19.3612 11.1125 18.8625 11.7111 18.2163 12.1747Z"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M7.23802 3.09782C9.26166 0.893525 12.7383 0.893525 14.762 3.09782C15.2235 3.60055 15.7811 4.00567 16.4018 4.28925C19.1236 5.53269 20.1979 8.8392 18.7269 11.445C18.3914 12.0393 18.1784 12.6948 18.1005 13.3727C17.759 16.3455 14.9463 18.3891 12.0135 17.7952C11.3446 17.6598 10.6554 17.6598 9.98651 17.7952C7.05369 18.3891 4.241 16.3455 3.8995 13.3727C3.82161 12.6948 3.60862 12.0393 3.27312 11.445C1.80205 8.8392 2.8764 5.53269 5.59815 4.28925C6.21889 4.00567 6.7765 3.60055 7.23802 3.09782Z"
          fill="white"
        />
      </g>
      <defs>
        <clipPath id="clip0_371_12761">
          <rect width="24" height="24" fill="white" />
        </clipPath>
      </defs>
    </svg>
  ) : (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path
        d="M12.0003 22.9999V10.7402M8.99942 23H15.0006M19.1114 12.1747C19.3645 12.6936 19.4968 13.2466 19.5015 13.8052C19.5015 14.9432 18.9482 16.0346 17.9635 16.8393C16.9787 17.644 15.6431 18.0961 14.2504 18.0961C13.4703 18.0935 12.701 17.9468 12 17.667C11.299 17.9468 10.5297 18.0935 9.74956 18.0961C8.35691 18.0961 7.02129 17.644 6.03653 16.8393C5.05178 16.0346 4.49855 14.9432 4.49855 13.8052C4.50323 13.2466 4.63552 12.6936 4.88862 12.1747C4.20441 11.7111 3.67635 11.1125 3.35445 10.4355C3.03256 9.75854 2.92748 9.02561 3.04917 8.30617C3.17087 7.58673 3.51531 6.90458 4.04987 6.32435C4.58444 5.74411 5.29142 5.28499 6.10386 4.99048C6.36419 3.86835 7.09567 2.85567 8.17208 2.12716C9.2485 1.39865 10.6023 1 12 1C13.3977 1 14.7515 1.39865 15.8279 2.12716C16.9043 2.85567 17.6358 3.86835 17.8961 4.99048C18.7086 5.28499 19.4156 5.74411 19.9501 6.32435C20.4847 6.90458 20.8291 7.58673 20.9508 8.30617C21.0725 9.02561 20.9674 9.75854 20.6456 10.4355C20.3237 11.1125 19.7956 11.7111 19.1114 12.1747Z"
        stroke="#9DB2CE"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

const IconAI = ({ active }: { active: boolean }) =>
  active ? (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="#B14602" aria-hidden="true">
      <path d="M9.80078 4.95117C10.3058 4.95117 10.7543 5.2921 10.9141 5.79688L12.6357 11.2393L17.7998 13.0527C18.2788 13.2211 18.6015 13.6935 18.6016 14.2256C18.6016 14.7577 18.2788 15.23 17.7998 15.3984L12.6357 17.2129L10.9141 22.6543C10.7543 23.1592 10.3059 23.5 9.80078 23.5C9.29578 23.4999 8.8472 23.1592 8.6875 22.6543L6.9668 17.2129L1.80273 15.3984C1.32356 15.2301 1 14.7578 1 14.2256C1.00009 13.6934 1.32362 13.221 1.80273 13.0527L6.9668 11.2393L8.6875 5.79688C8.84724 5.2921 9.29584 4.95128 9.80078 4.95117ZM9.79785 15.4697C9.79839 15.5035 9.80078 15.5394 9.80078 15.5771V15.4697H9.79785ZM19.1885 0.5C19.4914 0.5 19.7605 0.704157 19.8564 1.00684L20.7725 3.90137L23.5186 4.86621C23.806 4.96721 24 5.25098 24 5.57031C23.9998 5.88946 23.8059 6.17247 23.5186 6.27344L20.7725 7.23828L19.8564 10.1328C19.7605 10.4356 19.4914 10.6396 19.1885 10.6396C18.8856 10.6395 18.6164 10.4356 18.5205 10.1328L17.6055 7.23828L14.8594 6.27344C14.572 6.17249 14.3781 5.88949 14.3779 5.57031C14.3779 5.25096 14.5719 4.9672 14.8594 4.86621L17.6055 3.90137L18.5205 1.00684C18.6164 0.704162 18.8857 0.500135 19.1885 0.5Z" />
    </svg>
  ) : (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M9.80102 4.95161C10.3061 4.95161 10.7545 5.2922 10.9143 5.79714L12.6356 11.2388L17.7997 13.0527C18.2788 13.221 18.602 13.6936 18.602 14.2258C18.602 14.7581 18.2788 15.2306 17.7997 15.3989L12.6356 17.2128L10.9143 22.6545C10.7545 23.1594 10.3061 23.5 9.80102 23.5C9.29593 23.5 8.8475 23.1594 8.68777 22.6545L6.96643 17.2128L1.80239 15.3989C1.32321 15.2306 1 14.7581 1 14.2258C1 13.6936 1.32321 13.221 1.80239 13.0527L6.96642 11.2388L8.68777 5.79714C8.8475 5.2922 9.29593 4.95161 9.80102 4.95161ZM9.80102 6.64165L8.5 12C8.3832 12.3692 8.10824 12.659 7.75783 12.7821L3 14.2258L7.75783 15.7179C8.10824 15.841 8.3832 16.1308 8.5 16.5L9.80102 21.7804L10.7578 16.5C10.8746 16.1308 11.1496 15.841 11.5 15.7179L16.5 14.2258L12 12.6074C11.6496 12.4844 11.3746 12.1946 11.2578 11.8254L9.80102 6.64165Z"
        fill="#9DB2CE"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M19.1888 0.5C19.4918 0.5 19.7609 0.704351 19.8567 1.00731L20.7722 3.90135L23.5186 4.86603C23.8061 4.96702 24 5.25054 24 5.56989C24 5.88924 23.8061 6.17277 23.5186 6.27375L20.7722 7.23843L19.8567 10.1325C19.7609 10.4354 19.4918 10.6398 19.1888 10.6398C18.8857 10.6398 18.6167 10.4354 18.5208 10.1325L17.6054 7.23843L14.859 6.27375C14.5715 6.17277 14.3776 5.88924 14.3776 5.56989C14.3776 5.25054 14.5715 4.96702 14.859 4.86603L17.6054 3.90135L18.5208 1.00731C18.6167 0.704351 18.8857 0.5 19.1888 0.5Z"
        fill="#9DB2CE"
      />
    </svg>
  );

const IconProfile = ({ active }: { active: boolean }) =>
  active ? (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 12c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5ZM20.59 22c0-3.87-3.85-7-8.59-7s-8.59 3.13-8.59 7"
        fill="#B14602"
      />
    </svg>
  ) : (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 12c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5ZM20.59 22c0-3.87-3.85-7-8.59-7s-8.59 3.13-8.59 7"
        stroke="#9DB2CE"
        strokeWidth="1.5"
        fill="none"
      />
    </svg>
  );

function NavNotchBg() {
  return (
    <svg
      className="learner-nav-bg"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="17 -20 390 113"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d="
          M212,
          -23
          C220,-22 228,-23 242,
          -12
          C250,-2 255,-2 281,-2
          H382
          C406,0 408,3 408,6
          V60
          C408,63 398,75 384,75
          H40
          C17,63 17,63 6,60
          V6
          C17,3 19,0 60,-2
          H143
          C169,-2 174,-2 183,
          -12
          C193,-22 206,-23 212,
          -23
          Z
        "
        fill="white"
      />
    </svg>
  );
}

function LearnerNavBar({
  activeTab,
  onNavigate,
}: {
  activeTab: LearnerTab | null;
  onNavigate: (href: string) => void;
}) {
  const sides = LEARNER_TABS.filter((t) => t.id !== 'garden');

  return (
    <nav className="learner-nav" aria-label="Main">
      {/* Notched white background shape */}
      <NavNotchBg />

      {/* Left side: Home, Story */}
      <div className="learner-nav-side learner-nav-left">
        {sides.slice(0, 2).map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              className={`learner-nav-item ${active ? 'is-active' : ''}`}
              onClick={() => onNavigate(tab.href)}
              aria-current={active ? 'page' : undefined}
            >
              {tab.id === 'home' && <IconHome active={active} />}
              {tab.id === 'story' && <IconStory active={active} />}
              <span className="learner-nav-label">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Center: Garden elevated circle */}
      <div className="learner-nav-center">
        <button
          type="button"
          className={`learner-nav-garden-btn ${activeTab === 'garden' ? 'is-active' : ''}`}
          onClick={() => onNavigate('/home/garden')}
          aria-current={activeTab === 'garden' ? 'page' : undefined}
          aria-label="Garden"
        >
          <IconGarden active={activeTab === 'garden'} />
        </button>
        <span
          className={`learner-nav-label learner-nav-garden-label ${activeTab === 'garden' ? 'is-active' : ''}`}
        >
          Garden
        </span>
      </div>

      {/* Right side: AI, Profile */}
      <div className="learner-nav-side learner-nav-right">
        {sides.slice(2).map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              className={`learner-nav-item ${active ? 'is-active' : ''}`}
              onClick={() => onNavigate(tab.href)}
              aria-current={active ? 'page' : undefined}
            >
              {tab.id === 'ai' && <IconAI active={active} />}
              {tab.id === 'profile' && <IconProfile active={active} />}
              <span className="learner-nav-label">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

// ── Elder NavBar ───────────────────────────────────────────────────────────

type ElderTab = 'home' | 'record' | 'profile';

const IconMic = ({ active }: { active: boolean }) => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4Z"
      fill={active ? 'white' : 'none'}
      stroke={active ? 'white' : '#9DB2CE'}
      strokeWidth="1.5"
    />
    <path
      d="M5 10a7 7 0 0 0 14 0M12 17v4M9 21h6"
      stroke={active ? 'white' : '#9DB2CE'}
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

function resolveElderTab(pathname: string): ElderTab {
  if (pathname.startsWith('/home/studio')) return 'record';
  if (pathname.startsWith('/home/profile')) return 'profile';
  if (pathname.startsWith('/home/landing')) return 'home';
  return 'home';
}

function ElderNavBar({
  activeTab,
  onNavigate,
}: {
  activeTab: ElderTab;
  onNavigate: (href: string) => void;
}) {
  return (
    <nav className="learner-nav elder-nav" aria-label="Main">
      <NavNotchBg />

      {/* Left: Home */}
      <div className="learner-nav-side learner-nav-left">
        <button
          type="button"
          className={`learner-nav-item ${activeTab === 'home' ? 'is-active' : ''}`}
          onClick={() => onNavigate('/home/landing')}
          aria-current={activeTab === 'home' ? 'page' : undefined}
        >
          <IconHome active={activeTab === 'home'} />
          <span className="learner-nav-label">Home</span>
        </button>
      </div>

      {/* Center: Record elevated circle */}
      <div className="learner-nav-center">
        <button
          type="button"
          className={`learner-nav-garden-btn ${activeTab === 'record' ? 'is-active' : ''}`}
          onClick={() => onNavigate('/home/studio')}
          aria-current={activeTab === 'record' ? 'page' : undefined}
          aria-label="Record"
        >
          <IconMic active={true} />
        </button>
        <span
          className={`learner-nav-label learner-nav-garden-label ${activeTab === 'record' ? 'is-active' : ''}`}
        >
          Record
        </span>
      </div>

      {/* Right: Profile */}
      <div className="learner-nav-side learner-nav-right">
        <button
          type="button"
          className={`learner-nav-item ${activeTab === 'profile' ? 'is-active' : ''}`}
          onClick={() => onNavigate('/home/profile')}
          aria-current={activeTab === 'profile' ? 'page' : undefined}
        >
          <IconProfile active={activeTab === 'profile'} />
          <span className="learner-nav-label">Profile</span>
        </button>
      </div>
    </nav>
  );
}

function resolveUserRole(
  user: ReturnType<typeof useAuthStore.getState>['user'],
): 'learner' | 'elder' | 'admin' | null {
  const raw = (user?.user_metadata as Record<string, unknown> | undefined)?.role;
  if (raw === 'learner' || raw === 'elder' || raw === 'admin') return raw;
  return null;
}

function resolveLearnerTab(pathname: string): LearnerTab | null {
  if (pathname.startsWith('/home/landing')) return 'home';
  if (pathname.startsWith('/home/garden')) return 'garden';
  if (pathname.startsWith('/home/stories')) return 'story';
  if (pathname.startsWith('/home/archive')) return 'story';
  if (pathname.startsWith('/home/ai')) return 'ai';
  if (pathname.startsWith('/home/profile')) return 'profile';
  return 'home';
}

export function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();

  const userRole = resolveUserRole(user);
  const isLearner = userRole === 'learner' || userRole === null; // default to learner
  const isElder = userRole === 'elder';

  const profileWarningFromState =
    (location.state as { profileWarning?: string } | null)?.profileWarning ?? null;
  const [profileWarning, setProfileWarning] = useState<string | null>(profileWarningFromState);
  const isTranslateRoute = location.pathname.startsWith('/home/translation');

  useEffect(() => {
    if (profileWarningFromState) {
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.pathname, navigate, profileWarningFromState]);

  const shouldHideMenu = location.pathname.startsWith('/home/archive/review');
  const usesStudioSurface =
    location.pathname.startsWith('/home/studio') || location.pathname.startsWith('/home/archive');

  const handleMenuNavigate = (href: string) => {
    triggerHapticFeedback('light');
    if (location.pathname !== href) {
      navigate(href, { replace: true });
    }
  };

  const isProfileRoute = location.pathname.startsWith('/home/profile');
  const isLandingRoute =
    location.pathname.startsWith('/home/landing') || location.pathname === '/home';
  const isQuizRoute =
    location.pathname.startsWith('/home/garden/quiz') ||
    location.pathname.startsWith('/home/garden/vocab') ||
    location.pathname.startsWith('/home/garden/wordle') ||
    location.pathname.startsWith('/home/levelup');
  const isGardenRoute = location.pathname.startsWith('/home/garden') && !isQuizRoute;
  const isStoryDetailRoute = /^\/home\/stories\/[^/]+/.test(location.pathname);
  const isAiChatRoute =
    location.pathname.startsWith('/home/ai') &&
    new URLSearchParams(location.search).get('chat') === '1';

  const shouldShowTabMenu =
    !isTranslateRoute &&
    !location.pathname.startsWith('/home/profile/') &&
    !isQuizRoute &&
    !isStoryDetailRoute &&
    !isAiChatRoute;

  const ionContentClassName =
    [
      isProfileRoute ? 'home-ion-content-profile' : '',
      isTranslateRoute ? 'home-content-translate-mode' : '',
      isGardenRoute ? 'home-content-garden-mode' : '',
      isQuizRoute ? 'home-content-quiz-mode' : '',
      isLandingRoute ? 'home-content-landing-mode' : '',
    ]
      .filter(Boolean)
      .join(' ') || undefined;

  const homeShellClassName = [
    'home-shell',
    isProfileRoute ? 'profile-route' : '',
    isTranslateRoute ? 'is-translate' : '',
    isGardenRoute ? 'is-garden' : '',
    isLandingRoute ? 'is-landing' : '',
    isQuizRoute ? 'is-quiz' : '',
    usesStudioSurface ? 'is-studio-surface' : '',
    isLearner ? 'is-learner' : '',
    isElder ? 'is-elder' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const activeTab = resolveLearnerTab(location.pathname);

  return (
    <IonPage>
      <IonContent fullscreen className={ionContentClassName}>
        <div className={homeShellClassName}>
          <div className={`home-content ${usesStudioSurface ? 'is-studio-surface' : ''}`}>
            <Routes>
              <Route path="studio" element={<ElderStudioTab />} />
              <Route path="archive/review" element={<ArchiveReviewPage />} />
              <Route path="archive" element={<SoundArchiveTab />} />
              <Route path="ai" element={<AiHelperPage />} />
              <Route path="translation" element={<TranslatePage showBackButton={false} />} />
              <Route path="garden/quiz" element={<QuizGame />} />
              <Route path="garden/vocab" element={<VocabMaster />} />
              <Route path="garden/wordle" element={<WordleGame />} />
              <Route path="levelup" element={<LevelUpPage />} />
              <Route path="stories/:id/read" element={<StoryReadPage />} />
              <Route path="stories/:id" element={<StoryDetailPage />} />
              <Route path="stories" element={<StoryPage />} />
              <Route path="landing" element={<LandingPage />} />
              <Route path="garden" element={<LanguageGardenTab />} />
              <Route path="profile/*" element={<ProfilePage />} />
              <Route index element={<Navigate to="landing" replace />} />
              <Route path="*" element={<Navigate to="landing" replace />} />
            </Routes>
          </div>

          {shouldShowTabMenu && !shouldHideMenu ? (
            isLearner ? (
              <LearnerNavBar activeTab={activeTab} onNavigate={handleMenuNavigate} />
            ) : (
              <ElderNavBar
                activeTab={resolveElderTab(location.pathname)}
                onNavigate={handleMenuNavigate}
              />
            )
          ) : null}
        </div>

        <IonToast
          isOpen={Boolean(profileWarning)}
          message={profileWarning ?? ''}
          duration={3200}
          color="warning"
          onDidDismiss={() => setProfileWarning(null)}
        />
      </IonContent>
    </IonPage>
  );
}
