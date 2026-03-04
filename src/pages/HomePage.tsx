import {
  IonContent,
  IonButton,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonIcon,
  IonLabel,
  IonToast,
} from '@ionic/react';
import { useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import {
  micOutline,
  libraryOutline,
  sparklesOutline,
  leafOutline,
  personOutline,
} from 'ionicons/icons';

import { useAuthStore } from '../stores/authStore';
import { triggerHapticFeedback } from '../lib/feedback';
import { supabase } from '../lib/supabase';
import { toAuthErrorMessage } from '../utils/authErrors';

import './HomePage.css';

// --- Placeholder tab pages ---

function ElderStudioTab() {
  return (
    <>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Elder Studio</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding home-tab-content">
        <p className="text-gray-500">Record and upload audio for the archive.</p>
      </IonContent>
    </>
  );
}

function SoundArchiveTab() {
  return (
    <>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Sound Archive</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding home-tab-content">
        <p className="text-gray-500">Browse and search recordings.</p>
      </IonContent>
    </>
  );
}

function AIHelperTab() {
  return (
    <>
      <IonHeader>
        <IonToolbar>
          <IonTitle>AI Helper</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding home-tab-content">
        <p className="text-gray-500">Transcribe, translate, and listen.</p>
      </IonContent>
    </>
  );
}

function LanguageGardenTab() {
  return (
    <>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Language Garden</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding home-tab-content">
        <p className="text-gray-500">Learn Semai through lessons and practice.</p>
      </IonContent>
    </>
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
    <>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Profile</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding home-tab-content">
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
      </IonContent>
    </>
  );
}

// --- Main tabbed page ---

export function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { id: 'studio', label: 'Studio', icon: micOutline, href: '/home/studio' },
    { id: 'archive', label: 'Archive', icon: libraryOutline, href: '/home/archive' },
    { id: 'garden', label: 'Garden', icon: leafOutline, href: '/home/garden' },
    { id: 'ai', label: 'AI', icon: sparklesOutline, href: '/home/ai' },
    { id: 'profile', label: 'Profile', icon: personOutline, href: '/home/profile' },
  ] as const;

  const isActiveTab = (href: string) =>
    location.pathname === href || location.pathname.startsWith(`${href}/`);

  const handleMenuNavigate = (href: string) => {
    triggerHapticFeedback('light');

    if (location.pathname !== href) {
      navigate(href);
    }
  };

  return (
    <div className="home-shell">
      <div className="home-content">
        <Routes>
          <Route path="studio" element={<ElderStudioTab />} />
          <Route path="archive" element={<SoundArchiveTab />} />
          <Route path="ai" element={<AIHelperTab />} />
          <Route path="garden" element={<LanguageGardenTab />} />
          <Route path="profile" element={<ProfileTab />} />
          <Route index element={<Navigate to="garden" replace />} />
          <Route path="*" element={<Navigate to="garden" replace />} />
        </Routes>
      </div>

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
    </div>
  );
}
