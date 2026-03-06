import { IonButton, IonContent, IonIcon, IonLabel, IonPage, IonToast } from '@ionic/react';
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
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { toAuthErrorMessage } from '../utils/authErrors';
import { ArchiveReviewPage } from './ArchiveReviewPage';
import { ElderStudioTab } from './ElderStudioTab';
import { SoundArchiveTab } from './SoundArchiveTab';

import './HomePage.css';

function TabPlaceholder({ title, description }: { title: string; description: string }) {
  return (
    <section className="home-tab-content ion-padding">
      <h2>{title}</h2>
      <p className="text-gray-500">{description}</p>
    </section>
  );
}

function AIHelperTab() {
  return <TabPlaceholder title="AI Helper" description="Transcribe, translate, and listen." />;
}

function LanguageGardenTab() {
  return (
    <TabPlaceholder
      title="Language Garden"
      description="Learn Semai through lessons and practice."
    />
  );
}

function ProfileTab() {
  const { user } = useAuthStore();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignOut = async () => {
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);
    setError(null);
    triggerHapticFeedback('light');

    try {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) {
        throw signOutError;
      }

      triggerHapticFeedback('success');
    } catch (err) {
      setError(toAuthErrorMessage(err));
      triggerHapticFeedback('error');
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <section className="home-tab-content ion-padding">
      <h2>Profile</h2>
      <p className="mb-4 text-gray-600">{user?.email ?? 'Guest'}</p>
      <IonButton
        color="danger"
        fill="outline"
        onClick={() => void handleSignOut()}
        disabled={isSigningOut}
      >
        {isSigningOut ? 'Signing out...' : 'Sign out'}
      </IonButton>

      <IonToast
        isOpen={Boolean(error)}
        message={error ?? ''}
        duration={3200}
        color="danger"
        onDidDismiss={() => setError(null)}
      />
    </section>
  );
}

export function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const profileWarningFromState =
    (location.state as { profileWarning?: string } | null)?.profileWarning ?? null;
  const [profileWarning, setProfileWarning] = useState<string | null>(profileWarningFromState);

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

  return (
    <IonPage>
      <IonContent fullscreen>
        <div className={`home-shell ${usesStudioSurface ? 'is-studio-surface' : ''}`}>
          <div className={`home-content ${usesStudioSurface ? 'is-studio-surface' : ''}`}>
            <Routes>
              <Route path="studio" element={<ElderStudioTab />} />
              <Route path="archive/review" element={<ArchiveReviewPage />} />
              <Route path="archive" element={<SoundArchiveTab />} />
              <Route path="ai" element={<AIHelperTab />} />
              <Route path="garden" element={<LanguageGardenTab />} />
              <Route path="profile" element={<ProfileTab />} />
              <Route index element={<Navigate to="garden" replace />} />
              <Route path="*" element={<Navigate to="garden" replace />} />
            </Routes>
          </div>

          {!shouldHideMenu ? (
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
