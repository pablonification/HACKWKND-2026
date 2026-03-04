import { IonRouterOutlet, IonSpinner } from '@ionic/react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { useAuthStore } from '../stores/authStore';
import { AuthPage } from '../pages/AuthPage';
import { HomePage } from '../pages/HomePage';

export function AppRouter() {
  const { session, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <IonSpinner name="crescent" />
      </div>
    );
  }

  return (
    <IonRouterOutlet>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/home/*" element={<HomePage />} />
        <Route
          path="/"
          element={session ? <Navigate to="/home" replace /> : <Navigate to="/auth" replace />}
        />
      </Routes>
    </IonRouterOutlet>
  );
}
