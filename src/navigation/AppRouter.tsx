import { IonRouterOutlet } from '@ionic/react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';

import { AppSplashScreen } from '../components/ui';
import { useAuthStore } from '../stores/authStore';
import { AuthPage } from '../pages/AuthPage';
import { HomePage } from '../pages/HomePage';
import { ResetPasswordPage } from '../pages/ResetPasswordPage';

const isNative = Capacitor.isNativePlatform();
const SPLASH_MIN_MS = 1600;
const SPLASH_EXIT_MS = 280;
const NATIVE_OVERLAY_EXIT_MS = 160;

type WebkitLaunchOverlayHandler = {
  postMessage: (message: 'dismiss') => void;
};

declare global {
  interface Window {
    webkit?: {
      messageHandlers?: {
        talekaLaunchOverlay?: WebkitLaunchOverlayHandler;
      };
    };
  }
}

const waitForNextFrame = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });

const dismissNativeLaunchOverlay = () => {
  window.webkit?.messageHandlers?.talekaLaunchOverlay?.postMessage('dismiss');
};

const removeSplashPreload = () => {
  document.getElementById('splash-preload')?.remove();
};

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
      if (isNative) {
        let cancelled = false;

        const completeNativeLaunch = async () => {
          await waitForNextFrame();
          await waitForNextFrame();
          if (cancelled) return;

          await SplashScreen.hide({ fadeOutDuration: 0 });
          if (cancelled) return;

          await waitForNextFrame();
          if (cancelled) return;

          dismissNativeLaunchOverlay();

          window.setTimeout(() => {
            if (cancelled) return;
            removeSplashPreload();
            setShowSplash(false);
          }, NATIVE_OVERLAY_EXIT_MS);
        };

        void completeNativeLaunch();

        return () => {
          cancelled = true;
        };
      }

      setExiting(true);
      const t = setTimeout(() => setShowSplash(false), SPLASH_EXIT_MS);
      return () => clearTimeout(t);
    }
  }, [exiting, isLoading, minTimePassed, showSplash]);

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
      {showSplash && !isNative && <AppSplashScreen exiting={exiting} />}
    </>
  );
}
