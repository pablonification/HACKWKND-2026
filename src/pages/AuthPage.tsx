import { IonContent, IonPage, IonToast } from '@ionic/react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import aseanBadge from '../../assets/auth/asean.png';
import topPattern from '../../assets/auth/auth-top-pattern.png';
import appleIcon from '../../assets/auth/icon-apple.png';
import eyeIcon from '../../assets/auth/icon-eye.png';
import facebookIcon from '../../assets/auth/icon-facebook.png';
import googleIcon from '../../assets/auth/icon-google.png';
import landingIllustration from '../../assets/auth/landing-illustration.png';
import { requestPasswordReset, signInWithEmail, signUpWithEmail } from '../lib/auth';
import { triggerHapticFeedback } from '../lib/feedback';
import { removeKey, setBoolean, STORAGE_KEYS } from '../lib/storage';
import { toAuthErrorMessage } from '../utils/authErrors';
import {
  AUTH_ROLES,
  type AuthRole,
  validateEmail,
  validateLoginForm,
  validateSignUpForm,
} from '../utils/authValidation';

import './AuthPage.css';

type AuthMode = 'landing' | 'signin' | 'signup';

type NoticeTone = 'success' | 'medium';

type Notice = {
  message: string;
  tone: NoticeTone;
};

const ROLE_LABELS: Record<AuthRole, string> = {
  learner: 'Learner',
  elder: 'Elder',
};

const SOCIAL_ITEMS = [
  {
    id: 'facebook',
    label: 'Continue with Facebook',
    iconSrc: facebookIcon,
    iconClassName: 'auth-social-icon-facebook',
  },
  {
    id: 'google',
    label: 'Continue with Google',
    iconSrc: googleIcon,
    iconClassName: 'auth-social-icon-google',
  },
  {
    id: 'apple',
    label: 'Continue with Apple',
    iconSrc: appleIcon,
    iconClassName: 'auth-social-icon-apple',
  },
] as const;

export function AuthPage() {
  const navigate = useNavigate();

  const [mode, setMode] = useState<AuthMode>('landing');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<AuthRole | null>(null);
  const [rememberMe, setRememberMe] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [loading, setLoading] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  const roleMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!roleMenuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!roleMenuRef.current) {
        return;
      }

      if (event.target instanceof Node && !roleMenuRef.current.contains(event.target)) {
        setRoleMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setRoleMenuOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [roleMenuOpen]);

  const isSignUp = mode === 'signup';
  const isAuthFormMode = mode === 'signin' || mode === 'signup';

  const setModeWithFeedback = (nextMode: AuthMode) => {
    if (mode !== nextMode) {
      triggerHapticFeedback('light');
    }

    setMode(nextMode);
    setRoleMenuOpen(false);
    setError(null);
    setNotice(null);
  };

  const handleSignIn = async () => {
    const validationError = validateLoginForm(email, password);
    if (validationError) {
      setError(validationError);
      triggerHapticFeedback('error');
      return;
    }

    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      await signInWithEmail({ email: email.trim(), password });

      try {
        if (rememberMe) {
          await removeKey(STORAGE_KEYS.AUTH_TRANSIENT_SESSION);
        } else {
          await setBoolean(STORAGE_KEYS.AUTH_TRANSIENT_SESSION, true);
        }
      } catch (preferenceError) {
        console.warn('Failed to persist remember-me preference:', preferenceError);
      }

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
    setNotice(null);

    try {
      const authResponse = await signUpWithEmail({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        role: role!,
      });

      if (authResponse.data.session) {
        triggerHapticFeedback('success');
        navigate('/home', { replace: true });
        return;
      }

      setMode('signin');
      setPassword('');
      setRole(null);
      setNotice({
        tone: 'success',
        message: 'Account created. Check your email to confirm, then log in.',
      });
      triggerHapticFeedback('success');
    } catch (err) {
      setError(toAuthErrorMessage(err));
      triggerHapticFeedback('error');
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (mode === 'signin') {
      void handleSignIn();
      return;
    }

    if (mode === 'signup') {
      void handleSignUp();
    }
  };

  const handleForgotPassword = async () => {
    const validationError = validateEmail(email);
    if (validationError) {
      setError('Enter a valid email first so we can send your reset link.');
      triggerHapticFeedback('error');
      return;
    }

    setIsResettingPassword(true);
    setError(null);
    setNotice(null);

    try {
      await requestPasswordReset(email.trim());
      setNotice({
        tone: 'success',
        message: 'Password reset link sent. Check your inbox.',
      });
      triggerHapticFeedback('success');
    } catch (err) {
      setError(toAuthErrorMessage(err));
      triggerHapticFeedback('error');
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleSocialPress = (providerLabel: string) => {
    setNotice({
      tone: 'medium',
      message: `${providerLabel} sign in is not enabled yet.`,
    });
    triggerHapticFeedback('light');
  };

  const toggleRememberMe = () => {
    setRememberMe((current) => !current);
    triggerHapticFeedback('light');
  };

  const togglePasswordVisibility = () => {
    setPasswordVisible((current) => !current);
    triggerHapticFeedback('light');
  };

  const toggleRoleMenu = () => {
    setRoleMenuOpen((current) => !current);
    triggerHapticFeedback('light');
  };

  const handleRoleSelect = (nextRole: AuthRole) => {
    setRole(nextRole);
    setRoleMenuOpen(false);
    triggerHapticFeedback('medium');
  };

  return (
    <IonPage>
      <IonContent className="auth-content" fullscreen>
        <div className="auth-screen">
          <div className={`auth-device auth-mode-${mode}`}>
            {isAuthFormMode && (
              <>
                <img className="auth-top-pattern" src={topPattern} alt="" />
                <button
                  type="button"
                  className="auth-back-button"
                  onClick={() => setModeWithFeedback('landing')}
                  aria-label="Back"
                >
                  <span className="auth-back-chevron" aria-hidden="true" />
                  <span>Back</span>
                </button>

                <section className="auth-form-card auth-animate-in" key={mode}>
                  <div className={`auth-form-shell ${isSignUp ? 'auth-form-shell-signup' : ''}`}>
                    <header className="auth-heading">
                      <h1>{isSignUp ? 'Create Your Account' : 'Welcome Back'}</h1>
                      <p>
                        {isSignUp
                          ? "We're here to help you on your journey of learning."
                          : 'Ready to continue your learning journey?'}
                        {isSignUp && <strong> Are you ready?</strong>}
                      </p>
                    </header>

                    <form className="auth-form" onSubmit={handleFormSubmit}>
                      {isSignUp && (
                        <label className="auth-field" htmlFor="auth-fullname">
                          <span className="auth-label">Full Name</span>
                          <input
                            id="auth-fullname"
                            className="auth-input"
                            type="text"
                            autoComplete="name"
                            placeholder="Tuyang Surya Putra"
                            value={fullName}
                            onChange={(event) => setFullName(event.target.value)}
                            disabled={loading}
                            required
                          />
                        </label>
                      )}

                      <label className="auth-field" htmlFor="auth-email">
                        <span className="auth-label">Email</span>
                        <input
                          id="auth-email"
                          className="auth-input"
                          type="email"
                          autoComplete="email"
                          inputMode="email"
                          placeholder="tuyang@gmail.com"
                          value={email}
                          onChange={(event) => setEmail(event.target.value)}
                          disabled={loading}
                          required
                        />
                      </label>

                      <label className="auth-field" htmlFor="auth-password">
                        <span className="auth-label">Password</span>
                        <div className="auth-input-wrap">
                          <input
                            id="auth-password"
                            className="auth-input auth-input-password"
                            type={passwordVisible ? 'text' : 'password'}
                            autoComplete={isSignUp ? 'new-password' : 'current-password'}
                            placeholder="**********"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            disabled={loading}
                            required
                          />
                          <button
                            type="button"
                            className="auth-password-toggle"
                            onClick={togglePasswordVisibility}
                            aria-label={passwordVisible ? 'Hide password' : 'Show password'}
                            disabled={loading}
                          >
                            <img src={eyeIcon} alt="" />
                          </button>
                        </div>
                      </label>

                      {!isSignUp && (
                        <div className="auth-meta-row">
                          <button
                            type="button"
                            className="auth-remember"
                            onClick={toggleRememberMe}
                            disabled={loading}
                          >
                            <span
                              className={`auth-checkbox ${rememberMe ? 'is-checked' : ''}`}
                              aria-hidden="true"
                            />
                            <span>Remember me</span>
                          </button>
                          <button
                            type="button"
                            className="auth-forgot"
                            onClick={() => void handleForgotPassword()}
                            disabled={loading || isResettingPassword}
                          >
                            {isResettingPassword ? 'Sending...' : 'Forgot password?'}
                          </button>
                        </div>
                      )}

                      {isSignUp && (
                        <div className="auth-field">
                          <span className="auth-label">Role</span>
                          <div
                            className={`auth-role-dropdown ${roleMenuOpen ? 'is-open' : ''}`}
                            ref={roleMenuRef}
                          >
                            <button
                              type="button"
                              className="auth-role-trigger"
                              onClick={toggleRoleMenu}
                              aria-haspopup="listbox"
                              aria-expanded={roleMenuOpen}
                              disabled={loading}
                            >
                              <span className={role ? '' : 'auth-placeholder'}>
                                {role ? ROLE_LABELS[role] : 'Choose your role'}
                              </span>
                              <span className="auth-role-chevron" aria-hidden="true" />
                            </button>

                            {roleMenuOpen && (
                              <div
                                className="auth-role-options"
                                role="listbox"
                                aria-label="Role options"
                              >
                                {AUTH_ROLES.map((authRole) => (
                                  <button
                                    key={authRole}
                                    type="button"
                                    className={`auth-role-option ${role === authRole ? 'is-selected' : ''}`}
                                    onClick={() => handleRoleSelect(authRole)}
                                    role="option"
                                    aria-selected={role === authRole}
                                  >
                                    {ROLE_LABELS[authRole]}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      <button type="submit" className="auth-submit" disabled={loading}>
                        {loading
                          ? isSignUp
                            ? 'Creating account...'
                            : 'Logging in...'
                          : isSignUp
                            ? 'Get Started'
                            : 'Log In'}
                      </button>
                    </form>

                    <div className="auth-social">
                      <div className="auth-social-divider">
                        <span className="auth-divider-line" />
                        <span>{isSignUp ? 'Or register with' : 'Or login with'}</span>
                        <span className="auth-divider-line" />
                      </div>

                      <div className="auth-social-buttons">
                        {SOCIAL_ITEMS.map((social) => (
                          <button
                            key={social.id}
                            type="button"
                            className="auth-social-button"
                            onClick={() =>
                              handleSocialPress(social.label.replace('Continue with ', ''))
                            }
                            aria-label={social.label}
                          >
                            <img
                              className={social.iconClassName}
                              src={social.iconSrc}
                              alt=""
                              loading="lazy"
                            />
                          </button>
                        ))}
                      </div>

                      <button
                        type="button"
                        className="auth-switch"
                        onClick={() => setModeWithFeedback(isSignUp ? 'signin' : 'signup')}
                      >
                        <span>{isSignUp ? 'Already have an account?' : "Don't have account?"}</span>
                        <strong>{isSignUp ? 'Log In' : 'Sign Up'}</strong>
                      </button>
                    </div>
                  </div>
                </section>
              </>
            )}

            {mode === 'landing' && (
              <section className="auth-landing auth-animate-in" key="landing">
                <div className="auth-landing-core">
                  <div className="auth-landing-brand" aria-label="Taleka">
                    <span className="auth-landing-brand-initial">T</span>
                    <span className="auth-landing-brand-text">aleka</span>
                  </div>

                  <div className="auth-landing-copy">
                    <h1>Every story keeps a language alive</h1>
                    <p>
                      Discover endangered languages through real elder voices and interactive
                      folklore.
                    </p>
                  </div>

                  <button
                    type="button"
                    className="auth-landing-cta"
                    onClick={() => setModeWithFeedback('signin')}
                  >
                    <span>Get started</span>
                    <span aria-hidden="true" className="auth-landing-arrow">
                      →
                    </span>
                  </button>
                </div>

                <img
                  className="auth-landing-illustration"
                  src={landingIllustration}
                  alt="Illustration of Southeast Asian cultural landmarks"
                />
                <img className="auth-landing-badge" src={aseanBadge} alt="ASEAN icon" />
              </section>
            )}
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
        message={notice?.message ?? ''}
        duration={2600}
        color={notice?.tone === 'success' ? 'success' : 'medium'}
        onDidDismiss={() => setNotice(null)}
      />
    </IonPage>
  );
}
