import { IonApp } from '@ionic/react';
import { MemoryRouter } from 'react-router-dom';
import { useEffect } from 'react';

import { AppRouter } from './navigation/AppRouter';
import { supabase } from './lib/supabase';
import { useAuthStore } from './stores/authStore';

export default function App() {
  const { setSession, setLoading } = useAuthStore();

  useEffect(() => {
    // Initialise session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, [setSession, setLoading]);

  return (
    <IonApp>
      <MemoryRouter initialEntries={['/']} initialIndex={0}>
        <AppRouter />
      </MemoryRouter>
    </IonApp>
  );
}
