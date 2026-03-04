import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonTabs,
  IonTabBar,
  IonTabButton,
  IonIcon,
  IonLabel,
  IonRouterOutlet,
} from '@ionic/react';
import { Navigate, Route, Routes } from 'react-router-dom';
import {
  micOutline,
  libraryOutline,
  sparklesOutline,
  leafOutline,
  personOutline,
} from 'ionicons/icons';

import { useAuthStore } from '../stores/authStore';
import { supabase } from '../lib/supabase';

// --- Placeholder tab pages ---

function ElderStudioTab() {
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Elder Studio</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
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
      <IonContent className="ion-padding">
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
      <IonContent className="ion-padding">
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
      <IonContent className="ion-padding">
        <p className="text-gray-500">Learn Semai through lessons and practice.</p>
      </IonContent>
    </IonPage>
  );
}

function ProfileTab() {
  const { user } = useAuthStore();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Profile</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <p className="mb-4 text-gray-600">{user?.email ?? 'Guest'}</p>
        <button onClick={() => void handleSignOut()} className="text-sm text-red-500 underline">
          Sign out
        </button>
      </IonContent>
    </IonPage>
  );
}

// --- Main tabbed page ---

export function HomePage() {
  return (
    <IonTabs>
      <IonRouterOutlet>
        <Routes>
          <Route path="studio" element={<ElderStudioTab />} />
          <Route path="archive" element={<SoundArchiveTab />} />
          <Route path="ai" element={<AIHelperTab />} />
          <Route path="garden" element={<LanguageGardenTab />} />
          <Route path="profile" element={<ProfileTab />} />
          <Route path="" element={<Navigate to="garden" replace />} />
        </Routes>
      </IonRouterOutlet>

      <IonTabBar slot="bottom">
        <IonTabButton tab="studio" href="/home/studio">
          <IonIcon icon={micOutline} />
          <IonLabel>Studio</IonLabel>
        </IonTabButton>
        <IonTabButton tab="archive" href="/home/archive">
          <IonIcon icon={libraryOutline} />
          <IonLabel>Archive</IonLabel>
        </IonTabButton>
        <IonTabButton tab="garden" href="/home/garden">
          <IonIcon icon={leafOutline} />
          <IonLabel>Garden</IonLabel>
        </IonTabButton>
        <IonTabButton tab="ai" href="/home/ai">
          <IonIcon icon={sparklesOutline} />
          <IonLabel>AI</IonLabel>
        </IonTabButton>
        <IonTabButton tab="profile" href="/home/profile">
          <IonIcon icon={personOutline} />
          <IonLabel>Profile</IonLabel>
        </IonTabButton>
      </IonTabBar>
    </IonTabs>
  );
}
