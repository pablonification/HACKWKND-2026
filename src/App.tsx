import { IonApp } from '@ionic/react';
import { BrowserRouter } from 'react-router-dom';
import { useEffect } from 'react';

import { AppRouter } from './navigation/AppRouter';
import { supabase } from './lib/supabase';
import { getBoolean, removeKey, STORAGE_KEYS } from './lib/storage';
import { useAuthStore } from './stores/authStore';

export default function App() {
  const { setSession, setLoading, setRecoverySession } = useAuthStore();

  useEffect(() => {
    const initialiseSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const hasTransientSession = await getBoolean(STORAGE_KEYS.AUTH_TRANSIENT_SESSION, false);
      if (session && hasTransientSession) {
        await supabase.auth.signOut();
        // SIGNED_OUT listener handles removeKey and setSession(null)
        setSession(null);
      } else {
        setSession(session);
      }

      setLoading(false);
    };

    // Initialise session on mount
    void initialiseSession();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        void removeKey(STORAGE_KEYS.AUTH_TRANSIENT_SESSION);
        setRecoverySession(false);
      }
      if (event === 'PASSWORD_RECOVERY') {
        setRecoverySession(true);
      }
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, [setSession, setLoading, setRecoverySession]);

  return (
    <IonApp>
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
    </IonApp>
  );
}
