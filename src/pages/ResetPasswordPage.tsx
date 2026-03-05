import { IonContent, IonPage, IonToast } from '@ionic/react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import topPattern from '../../assets/auth/auth-top-pattern.png';
import eyeIcon from '../../assets/auth/icon-eye.png';
import { updatePasswordWithRecovery } from '../lib/auth';
import { triggerHapticFeedback } from '../lib/feedback';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { toAuthErrorMessage } from '../utils/authErrors';
import { validatePassword } from '../utils/authValidation';

import './AuthPage.css';

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const { setRecoverySession } = useAuthStore();
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
      }
    };
  }, []);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const togglePasswordVisible = () => {
    setPasswordVisible((current) => !current);
    triggerHapticFeedback('light');
  };

  const toggleConfirmPasswordVisible = () => {
    setConfirmPasswordVisible((current) => !current);
    triggerHapticFeedback('light');
  };

  const handleBack = async () => {
    triggerHapticFeedback('light');
    await supabase.auth.signOut().catch(() => undefined);
    setRecoverySession(false);
    navigate('/auth', { replace: true });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      triggerHapticFeedback('error');
      return;
    }

    if (password !== confirmPassword) {
      setError('Password confirmation does not match.');
      triggerHapticFeedback('error');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      await updatePasswordWithRecovery({ newPassword: password });
      triggerHapticFeedback('success');
      setNotice('Password updated. Redirecting...');
      redirectTimerRef.current = setTimeout(() => {
        navigate('/home', { replace: true });
        setRecoverySession(false);
      }, 1500);
    } catch (err) {
      setError(toAuthErrorMessage(err));
      triggerHapticFeedback('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <IonPage>
      <IonContent className="auth-content" fullscreen>
        <div className="auth-screen">
          <div className="auth-device auth-mode-signin">
            <img className="auth-top-pattern" src={topPattern} alt="" />
            <button
              type="button"
              className="auth-back-button"
              onClick={() => void handleBack()}
              aria-label="Back"
            >
              <span className="auth-back-chevron" aria-hidden="true" />
              <span>Back</span>
            </button>

            <section className="auth-form-card auth-animate-in" key="reset-password">
              <div className="auth-form-shell">
                <header className="auth-heading">
                  <h1>Set New Password</h1>
                  <p>Choose a secure password for your account.</p>
                </header>

                <form className="auth-form" onSubmit={handleSubmit}>
                  <label className="auth-field" htmlFor="auth-reset-password">
                    <span className="auth-label">New Password</span>
                    <div className="auth-input-wrap">
                      <input
                        id="auth-reset-password"
                        className="auth-input auth-input-password"
                        type={passwordVisible ? 'text' : 'password'}
                        autoComplete="new-password"
                        placeholder="**********"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        disabled={isSubmitting}
                        required
                      />
                      <button
                        type="button"
                        className="auth-password-toggle"
                        onClick={togglePasswordVisible}
                        aria-label={passwordVisible ? 'Hide password' : 'Show password'}
                        disabled={isSubmitting}
                      >
                        <img src={eyeIcon} alt="" />
                      </button>
                    </div>
                  </label>

                  <label className="auth-field" htmlFor="auth-reset-password-confirm">
                    <span className="auth-label">Confirm New Password</span>
                    <div className="auth-input-wrap">
                      <input
                        id="auth-reset-password-confirm"
                        className="auth-input auth-input-password"
                        type={confirmPasswordVisible ? 'text' : 'password'}
                        autoComplete="off"
                        placeholder="**********"
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        disabled={isSubmitting}
                        required
                      />
                      <button
                        type="button"
                        className="auth-password-toggle"
                        onClick={toggleConfirmPasswordVisible}
                        aria-label={confirmPasswordVisible ? 'Hide password' : 'Show password'}
                        disabled={isSubmitting}
                      >
                        <img src={eyeIcon} alt="" />
                      </button>
                    </div>
                  </label>

                  <button type="submit" className="auth-submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Updating password...' : 'Update Password'}
                  </button>
                </form>
              </div>
            </section>
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

      <IonToast
        isOpen={Boolean(notice)}
        message={notice ?? ''}
        duration={2200}
        color="success"
        onDidDismiss={() => setNotice(null)}
      />
    </IonPage>
  );
}
