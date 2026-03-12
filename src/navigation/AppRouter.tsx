import { IonRouterOutlet } from '@ionic/react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useEffect, useState } from 'react';

import { AppSplashScreen } from '../components/ui';
import { useAuthStore } from '../stores/authStore';
import { AuthPage } from '../pages/AuthPage';
import { HomePage } from '../pages/HomePage';
import { ResetPasswordPage } from '../pages/ResetPasswordPage';

// Must be >= total intro animation duration (T: ~0.85s, aleka: ~1.25s) + dwell time
const SPLASH_MIN_MS = 2400;
const SPLASH_EXIT_MS = 400;

export function AppRouter() {
  const { session, isLoading, isRecoverySession } = useAuthStore();
  const [minTimePassed, setMinTimePassed] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setMinTimePassed(true), SPLASH_MIN_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!isLoading && minTimePassed && showSplash && !exiting) {
      setExiting(true);
      const t = setTimeout(() => setShowSplash(false), SPLASH_EXIT_MS);
      return () => clearTimeout(t);
    }
  }, [isLoading, minTimePassed, showSplash, exiting]);

  return (
    <>
      <IonRouterOutlet>
        <Routes>
          <Route
            path="/auth/reset-password"
            element={
              isRecoverySession ? (
                <ResetPasswordPage />
              ) : (
                <Navigate to={session ? '/home' : '/auth'} replace />
              )
            }
          />
          <Route path="/auth" element={session ? <Navigate to="/home" replace /> : <AuthPage />} />
          <Route
            path="/home/*"
            element={session ? <HomePage /> : <Navigate to="/auth" replace />}
          />
          <Route
            path="/"
            element={session ? <Navigate to="/home" replace /> : <Navigate to="/auth" replace />}
          />
          <Route
            path="*"
            element={session ? <Navigate to="/home" replace /> : <Navigate to="/auth" replace />}
          />
        </Routes>
      </IonRouterOutlet>
      {showSplash && <AppSplashScreen exiting={exiting} />}
    </>
  );
}
