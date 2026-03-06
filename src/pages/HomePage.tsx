import { IonContent, IonIcon, IonLabel, IonPage, IonToast } from '@ionic/react';
import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import {
  leafOutline,
  libraryOutline,
  micOutline,
  personOutline,
  sparklesOutline,
} from 'ionicons/icons';

import { triggerHapticFeedback } from '../lib/feedback';
import { ArchiveReviewPage } from './ArchiveReviewPage';
import { ElderStudioTab } from './ElderStudioTab';
import { ProfilePage } from './ProfilePage';
import { SoundArchiveTab } from './SoundArchiveTab';
import { TranslatePage } from './TranslatePage';

import './HomePage.css';

function TabPlaceholder({ title, description }: { title: string; description: string }) {
  return (
    <section className="home-tab-content ion-padding">
      <h2>{title}</h2>
      <p className="text-gray-500">{description}</p>
    </section>
  );
}

function LanguageGardenTab() {
  return (
    <TabPlaceholder
      title="Language Garden"
      description="Learn Semai through lessons and practice."
    />
  );
}

export function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const profileWarningFromState =
    (location.state as { profileWarning?: string } | null)?.profileWarning ?? null;
  const [profileWarning, setProfileWarning] = useState<string | null>(profileWarningFromState);
  const isTranslateRoute = location.pathname.startsWith('/home/ai');

  useEffect(() => {
    if (profileWarningFromState) {
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.pathname, navigate, profileWarningFromState]);

  const menuItems = [
    { id: 'studio', label: 'Studio', icon: micOutline, href: '/home/studio' },
    { id: 'archive', label: 'Archive', icon: libraryOutline, href: '/home/archive' },
    { id: 'garden', label: 'Garden', icon: leafOutline, href: '/home/garden' },
    { id: 'ai', label: 'AI', icon: sparklesOutline, href: '/home/ai' },
    { id: 'profile', label: 'Profile', icon: personOutline, href: '/home/profile' },
  ] as const;

  const isActiveTab = (href: string) =>
    location.pathname === href || location.pathname.startsWith(`${href}/`);
  const shouldHideMenu = location.pathname.startsWith('/home/archive/review');
  const usesStudioSurface =
    location.pathname.startsWith('/home/studio') || location.pathname.startsWith('/home/archive');

  const handleMenuNavigate = (href: string) => {
    triggerHapticFeedback('light');

    if (location.pathname !== href) {
      navigate(href, { replace: true });
    }
  };

  const shouldShowTabMenu = !isTranslateRoute && !location.pathname.startsWith('/home/profile/');
  const isProfileRoute = location.pathname.startsWith('/home/profile');

  const ionContentClassName =
    [
      isProfileRoute ? 'home-ion-content-profile' : '',
      isTranslateRoute ? 'home-content-translate-mode' : '',
    ]
      .filter(Boolean)
      .join(' ') || undefined;

  const homeShellClassName = [
    'home-shell',
    isProfileRoute ? 'profile-route' : '',
    isTranslateRoute ? 'is-translate' : '',
    usesStudioSurface ? 'is-studio-surface' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <IonPage>
      <IonContent fullscreen className={ionContentClassName}>
        <div className={homeShellClassName}>
          <div className={`home-content ${usesStudioSurface ? 'is-studio-surface' : ''}`}>
            <Routes>
              <Route path="studio" element={<ElderStudioTab />} />
              <Route path="archive/review" element={<ArchiveReviewPage />} />
              <Route path="archive" element={<SoundArchiveTab />} />
              <Route path="ai" element={<TranslatePage />} />
              <Route path="garden" element={<LanguageGardenTab />} />
              <Route path="profile/*" element={<ProfilePage />} />
              <Route index element={<Navigate to="garden" replace />} />
              <Route path="*" element={<Navigate to="garden" replace />} />
            </Routes>
          </div>

          {shouldShowTabMenu && !shouldHideMenu ? (
            <nav className="home-menu" aria-label="Main">
              {menuItems.map((item) => {
                const active = isActiveTab(item.href);
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`home-menu-item ${active ? 'is-active' : ''}`}
                    onClick={() => handleMenuNavigate(item.href)}
                    aria-current={active ? 'page' : undefined}
                  >
                    <IonIcon icon={item.icon} />
                    <IonLabel>{item.label}</IonLabel>
                  </button>
                );
              })}
            </nav>
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
