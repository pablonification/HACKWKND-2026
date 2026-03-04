import { IonRouterOutlet, IonSpinner } from '@ionic/react';
import { Navigate, Route } from 'react-router-dom';

import { useAuthStore } from '../stores/authStore';
import { AuthPage } from '../pages/AuthPage';
import { HomePage } from '../pages/HomePage';
import { ResetPasswordPage } from '../pages/ResetPasswordPage';

export function AppRouter() {
  const { session, isLoading, isRecoverySession } = useAuthStore();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <IonSpinner name="crescent" />
      </div>
    );
  }

  return (
    <IonRouterOutlet>
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
      <Route path="/home/*" element={session ? <HomePage /> : <Navigate to="/auth" replace />} />
      <Route
        path="/"
        element={session ? <Navigate to="/home" replace /> : <Navigate to="/auth" replace />}
      />
      <Route
        path="*"
        element={session ? <Navigate to="/home" replace /> : <Navigate to="/auth" replace />}
      />
    </IonRouterOutlet>
  );
}
