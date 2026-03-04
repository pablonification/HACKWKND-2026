import {
  IonContent,
  IonPage,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonText,
  IonToast,
  IonSelect,
  IonSelectOption,
} from '@ionic/react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { AppButton } from '../components/ui/AppButton';
import { AppInput } from '../components/ui/AppInput';
import { signInWithEmail, signUpWithEmail } from '../lib/auth';
import { triggerHapticFeedback } from '../lib/feedback';
import type { AuthRole } from '../utils/authValidation';
import { validateLoginForm, validateSignUpForm, AUTH_ROLES } from '../utils/authValidation';
import { toAuthErrorMessage } from '../utils/authErrors';

type AuthMode = 'signin' | 'signup';

export function AuthPage() {
  const navigate = useNavigate();

  const [mode, setMode] = useState<AuthMode>('signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<AuthRole | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    const validationError = validateLoginForm(email, password);
    if (validationError) {
      setError(validationError);
      triggerHapticFeedback('error');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await signInWithEmail({ email, password });
      triggerHapticFeedback('success');
      navigate('/home', { replace: true });
    } catch (err) {
      setError(toAuthErrorMessage(err));
      triggerHapticFeedback('error');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    const validationError = validateSignUpForm(fullName, email, password, role);
    if (validationError) {
      setError(validationError);
      triggerHapticFeedback('error');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await signUpWithEmail({ fullName, email, password, role: role! });
      triggerHapticFeedback('success');
      navigate('/home', { replace: true });
    } catch (err) {
      setError(toAuthErrorMessage(err));
      triggerHapticFeedback('error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    triggerHapticFeedback('light');
    if (mode === 'signin') {
      void handleSignIn();
    } else {
      void handleSignUp();
    }
  };

  return (
    <IonPage>
      <IonContent className="ion-padding" fullscreen>
        <div className="flex min-h-full flex-col items-center justify-center gap-6 px-4 py-12">
          {/* Header */}
          <div className="mb-2 text-center">
            <IonText>
              <h1 className="font-display text-4xl font-bold text-[--ion-color-primary]">Tuyang</h1>
              <p className="mt-1 text-sm text-gray-500">Preserving the Semai language</p>
            </IonText>
          </div>

          {/* Mode toggle */}
          <IonSegment
            value={mode}
            onIonChange={(e) => setMode(e.detail.value as AuthMode)}
            className="w-full max-w-xs"
          >
            <IonSegmentButton value="signin">
              <IonLabel>Sign In</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="signup">
              <IonLabel>Sign Up</IonLabel>
            </IonSegmentButton>
          </IonSegment>

          {/* Form */}
          <div className="w-full max-w-xs space-y-2">
            {mode === 'signup' && (
              <AppInput
                label="Full name"
                type="text"
                placeholder="Your name"
                value={fullName}
                onIonInput={(e) => setFullName(String(e.detail.value ?? ''))}
                autocomplete="name"
              />
            )}
            <AppInput
              label="Email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onIonInput={(e) => setEmail(String(e.detail.value ?? ''))}
              autocomplete="email"
              inputmode="email"
            />
            <AppInput
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onIonInput={(e) => setPassword(String(e.detail.value ?? ''))}
              autocomplete={mode === 'signin' ? 'current-password' : 'new-password'}
            />
            {mode === 'signup' && (
              <IonSelect
                label="I am a…"
                value={role}
                onIonChange={(e) => setRole(e.detail.value as AuthRole)}
                interface="action-sheet"
              >
                {AUTH_ROLES.map((r) => (
                  <IonSelectOption key={r} value={r}>
                    {r.charAt(0).toUpperCase() + r.slice(1)}
                  </IonSelectOption>
                ))}
              </IonSelect>
            )}

            <AppButton expand="block" onClick={handleSubmit} loading={loading} className="mt-4">
              {mode === 'signin' ? 'Sign In' : 'Create Account'}
            </AppButton>
          </div>
        </div>
      </IonContent>

      <IonToast
        isOpen={Boolean(error)}
        message={error ?? ''}
        duration={3500}
        color="danger"
        onDidDismiss={() => setError(null)}
      />
    </IonPage>
  );
}
