import {
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonLabel,
  IonPage,
  IonRouterOutlet,
  IonTabBar,
  IonTabButton,
  IonTabs,
  IonTitle,
  IonToolbar,
  IonToast,
} from '@ionic/react';
import { useState } from 'react';
import { Navigate, Route } from 'react-router-dom';
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
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Elder Studio</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding home-tab-content">
        <p className="text-gray-500">Record and upload audio for the archive.</p>
      </IonContent>
    </IonPage>
  );
}

function SoundArchiveTab() {
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Sound Archive</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding home-tab-content">
        <p className="text-gray-500">Browse and search recordings.</p>
      </IonContent>
    </IonPage>
  );
}

function AIHelperTab() {
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>AI Helper</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding home-tab-content">
        <p className="text-gray-500">Transcribe, translate, and listen.</p>
      </IonContent>
    </IonPage>
  );
}

function LanguageGardenTab() {
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Language Garden</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding home-tab-content">
        <p className="text-gray-500">Learn Semai through lessons and practice.</p>
      </IonContent>
    </IonPage>
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
    <IonPage>
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
    </IonPage>
  );
}

// --- Main tabbed page ---

export function HomePage() {
  return (
    <IonTabs>
      <IonRouterOutlet>
        <Route path="/home/studio" element={<ElderStudioTab />} />
        <Route path="/home/archive" element={<SoundArchiveTab />} />
        <Route path="/home/ai" element={<AIHelperTab />} />
        <Route path="/home/garden" element={<LanguageGardenTab />} />
        <Route path="/home/profile" element={<ProfileTab />} />
        <Route path="/home" element={<Navigate to="/home/garden" replace />} />
        <Route path="/home/*" element={<Navigate to="/home/garden" replace />} />
      </IonRouterOutlet>

      <IonTabBar slot="bottom" className="home-menu">
        <IonTabButton
          tab="studio"
          href="/home/studio"
          className="home-menu-item"
          onClick={() => triggerHapticFeedback('light')}
        >
          <IonIcon icon={micOutline} />
          <IonLabel>Studio</IonLabel>
        </IonTabButton>

        <IonTabButton
          tab="archive"
          href="/home/archive"
          className="home-menu-item"
          onClick={() => triggerHapticFeedback('light')}
        >
          <IonIcon icon={libraryOutline} />
          <IonLabel>Archive</IonLabel>
        </IonTabButton>

        <IonTabButton
          tab="garden"
          href="/home/garden"
          className="home-menu-item"
          onClick={() => triggerHapticFeedback('light')}
        >
          <IonIcon icon={leafOutline} />
          <IonLabel>Garden</IonLabel>
        </IonTabButton>

        <IonTabButton
          tab="ai"
          href="/home/ai"
          className="home-menu-item"
          onClick={() => triggerHapticFeedback('light')}
        >
          <IonIcon icon={sparklesOutline} />
          <IonLabel>AI</IonLabel>
        </IonTabButton>

        <IonTabButton
          tab="profile"
          href="/home/profile"
          className="home-menu-item"
          onClick={() => triggerHapticFeedback('light')}
        >
          <IonIcon icon={personOutline} />
          <IonLabel>Profile</IonLabel>
        </IonTabButton>
      </IonTabBar>
    </IonTabs>
  );
}
