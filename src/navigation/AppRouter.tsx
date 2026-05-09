import { IonRouterOutlet } from '@ionic/react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';

import { AppSplashScreen } from '../components/ui';
import { withTimeout } from '../lib/asyncTimeout';
import { fetchOnboardingStatus } from '../lib/profile';
import { useAuthStore } from '../stores/authStore';
import { AuthPage } from '../pages/AuthPage';
import { HomePage } from '../pages/HomePage';
import { OnboardingPage } from '../pages/OnboardingPage';
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
  const [onboardingState, setOnboardingState] = useState<{
    isLoading: boolean;
    completed: boolean | null;
  }>({
    isLoading: false,
    completed: null,
  });

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

          removeSplashPreload();
          dismissNativeLaunchOverlay();

          window.setTimeout(() => {
            if (cancelled) return;
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

  useEffect(() => {
    if (!session?.user.id) {
      setOnboardingState({ isLoading: false, completed: null });
      return;
    }

    let cancelled = false;
    setOnboardingState((current) => ({
      isLoading: true,
      completed: current.completed,
    }));

    void withTimeout(
      fetchOnboardingStatus({
        userId: session.user.id,
        fallbackRole:
          session.user.user_metadata?.role === 'elder' ||
          session.user.user_metadata?.role === 'admin'
            ? session.user.user_metadata.role
            : 'learner',
      }),
      8000,
      'Timed out while resolving onboarding status.',
    )
      .then((status) => {
        if (!cancelled) {
          setOnboardingState({ isLoading: false, completed: status.completed });
        }
      })
      .catch((error) => {
        console.warn('Failed to resolve onboarding status:', error);
        if (!cancelled) {
          setOnboardingState({ isLoading: false, completed: true });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [session?.user.id, session?.user.user_metadata?.role]);

  const needsOnboarding =
    Boolean(session) && !onboardingState.isLoading && onboardingState.completed === false;
  const hasResolvedProtectedState = !isLoading && (!session || !onboardingState.isLoading);

  if (!hasResolvedProtectedState) {
    return <>{showSplash && !isNative && <AppSplashScreen exiting={exiting} />}</>;
  }

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
          <Route
            path="/auth"
            element={
              session ? (
                <Navigate to={needsOnboarding ? '/onboarding' : '/home'} replace />
              ) : (
                <AuthPage />
              )
            }
          />
          <Route
            path="/onboarding"
            element={
              session ? (
                needsOnboarding ? (
                  <OnboardingPage
                    onCompleted={() =>
                      setOnboardingState({
                        isLoading: false,
                        completed: true,
                      })
                    }
                  />
                ) : (
                  <Navigate to="/home" replace />
                )
              ) : (
                <Navigate to="/auth" replace />
              )
            }
          />
          <Route
            path="/home/*"
            element={
              session ? (
                needsOnboarding ? (
                  <Navigate to="/onboarding" replace />
                ) : (
                  <HomePage />
                )
              ) : (
                <Navigate to="/auth" replace />
              )
            }
          />
          <Route
            path="/"
            element={
              session ? (
                <Navigate to={needsOnboarding ? '/onboarding' : '/home'} replace />
              ) : (
                <Navigate to="/auth" replace />
              )
            }
          />
          <Route
            path="*"
            element={
              session ? (
                <Navigate to={needsOnboarding ? '/onboarding' : '/home'} replace />
              ) : (
                <Navigate to="/auth" replace />
              )
            }
          />
        </Routes>
      </IonRouterOutlet>
      {showSplash && !isNative && <AppSplashScreen exiting={exiting} />}
    </>
  );
}
