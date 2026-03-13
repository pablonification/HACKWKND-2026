import { IonButton, IonToast } from '@ionic/react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';

import { updatePassword } from '../lib/auth';
import { triggerHapticFeedback } from '../lib/feedback';
import { getStickyHeaderPolicy } from '../lib/stickyRoutePolicy';
import {
  fetchProfileDashboard,
  type ProfileDashboard,
  uploadProfileAvatar,
  updateProfileDetails,
  updateProfilePreferences,
  updatePushNotification,
} from '../lib/profile';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { toAuthErrorMessage } from '../utils/authErrors';
import { validateEmail, validateFullName, validatePassword } from '../utils/authValidation';
import { AppSkeleton } from '../components/ui';

import avatarLearnerImg from '../../assets/profile/avatar-learner.png';
import avatarElderImg from '../../assets/profile/avatar-elder.png';
import levelIconImg from '../../assets/profile/icon-level.png';
import wordsIconImg from '../../assets/profile/icon-words.png';
import storiesIconImg from '../../assets/profile/icon-stories.png';
import elderStatsIconImg from '../../assets/profile/icon-elder-stats.png';
import avatarEditBadgeImg from '../../assets/profile/ui/icon-avatar-edit-badge.svg';
import backBlackImg from '../../assets/profile/ui/icon-back-black.png';
import backWhiteImg from '../../assets/profile/ui/icon-back-white.png';
import chevronImg from '../../assets/profile/ui/icon-chevron-right.png';
import dropdownImg from '../../assets/profile/ui/icon-dropdown.svg';
import editMenuImg from '../../assets/profile/ui/icon-edit-menu.png';
import eyeImg from '../../assets/profile/ui/icon-eye.png';
import logoutMenuImg from '../../assets/profile/ui/icon-logout-menu.png';
import settingsAboutImg from '../../assets/profile/ui/icon-settings-about.svg';
import settingsBellImg from '../../assets/profile/ui/icon-settings-bell.svg';
import settingsChevronImg from '../../assets/profile/ui/icon-settings-chevron.svg';
import settingsGlobeImg from '../../assets/profile/ui/icon-settings-globe.svg';
import settingsLockImg from '../../assets/profile/ui/icon-settings-lock.svg';
import settingsMenuImg from '../../assets/profile/ui/icon-settings-menu.png';
import settingsPrivacyImg from '../../assets/profile/ui/icon-settings-privacy.svg';
import supportMenuImg from '../../assets/profile/ui/icon-support-menu.png';

import './ProfilePage.css';

const APP_VERSION = `Taleka v${import.meta.env.VITE_APP_VERSION ?? '0.0.0'}`;

const APP_LANGUAGE_OPTIONS = ['English', 'Bahasa Melayu', 'Bahasa Indonesia'] as const;
const INDIGENOUS_LANGUAGE_OPTIONS = ['Semai', 'Temiar', 'Jahai', 'Semelai'] as const;

const ABOUT_US_COPY = [
  'Taleka is a digital home for endangered languages.',
  'We believe every language carries stories, identity, and generations of knowledge. Through storytelling, community voices, and AI-powered learning tools, Taleka helps preserve and grow languages that are at risk of disappearing.',
  'Our platform connects elders and learners, transforming oral traditions into interactive learning experiences that live on across generations.',
] as const;

const PRIVACY_COPY = [
  'Last Updated: March 3rd, 2026',
  'Taleka is a language learning and cultural preservation platform.',
  'We respect your privacy.',
] as const;

const PROFILE_ASSETS = {
  avatarLearner: avatarLearnerImg,
  avatarElder: avatarElderImg,
  levelIcon: levelIconImg,
  wordsIcon: wordsIconImg,
  storiesIcon: storiesIconImg,
  elderStatsIcon: elderStatsIconImg,
} as const;

const PROFILE_UI_ASSETS = {
  avatarEditBadge: avatarEditBadgeImg,
  backBlack: backBlackImg,
  backWhite: backWhiteImg,
  chevron: chevronImg,
  dropdown: dropdownImg,
  editMenu: editMenuImg,
  eye: eyeImg,
  logoutMenu: logoutMenuImg,
  settingsAbout: settingsAboutImg,
  settingsBell: settingsBellImg,
  settingsChevron: settingsChevronImg,
  settingsGlobe: settingsGlobeImg,
  settingsLock: settingsLockImg,
  settingsMenu: settingsMenuImg,
  settingsPrivacy: settingsPrivacyImg,
  supportMenu: supportMenuImg,
} as const;

type ToastState = {
  message: string;
  color: 'danger' | 'success' | 'warning';
};

type ProfileRole = ProfileDashboard['profile']['role'];
type VisualRole = 'learner' | 'elder';

type OverviewProps = {
  dashboard: ProfileDashboard;
  onEditProfile: () => void;
  onOpenSettings: () => void;
  onOpenSupport: () => void;
  onSignOut: () => Promise<void>;
  isSigningOut: boolean;
};

type EditProfileProps = {
  dashboard: ProfileDashboard;
  onBack: () => void;
  onSaved: () => Promise<void>;
  onToast: (toast: ToastState) => void;
};

type SettingsProps = {
  dashboard: ProfileDashboard;
  onBack: () => void;
  onOpenChangePassword: () => void;
  onOpenChangeLanguage: () => void;
  onOpenAbout: () => void;
  onOpenPrivacy: () => void;
  onPushPreferenceChanged: (value: boolean) => Promise<void>;
  onToast: (toast: ToastState) => void;
};

type ChangePasswordProps = {
  onBack: () => void;
  onSaved: () => void;
  onToast: (toast: ToastState) => void;
};

type ChangeLanguageProps = {
  dashboard: ProfileDashboard;
  onBack: () => void;
  onSaved: (appLanguage: string, indigenousLanguage: string) => Promise<void>;
  onToast: (toast: ToastState) => void;
};

type InfoScreenProps = {
  title: string;
  lines: readonly string[];
  onBack: () => void;
  includeMission?: boolean;
  includePrivacySections?: boolean;
};

type MenuItemProps = {
  icon: string;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
};

type BackButtonProps = {
  onBack: () => void;
  tone?: 'dark' | 'light';
};

type StatVisual = 'words' | 'stories' | 'elderStories' | 'elderLearners';

type StatCard = {
  label: string;
  value: number;
  visual: StatVisual;
};

const toRoleLabel = (role: ProfileRole) => {
  if (role === 'elder') {
    return 'elder';
  }

  if (role === 'admin') {
    return 'admin';
  }

  return 'learner';
};

const toRoleTitle = (role: ProfileRole) => {
  if (role === 'elder') {
    return 'Elder';
  }

  if (role === 'admin') {
    return 'Admin';
  }

  return 'Learner';
};

const toVisualRole = (role: ProfileRole): VisualRole => {
  if (role === 'learner') {
    return 'learner';
  }

  return 'elder';
};

const getFallbackAvatarAsset = (role: ProfileRole): string => {
  if (toVisualRole(role) === 'elder') {
    return PROFILE_ASSETS.avatarElder;
  }

  return PROFILE_ASSETS.avatarLearner;
};

const getStatCards = (dashboard: ProfileDashboard): StatCard[] => {
  if (dashboard.profile.role === 'elder' || dashboard.profile.role === 'admin') {
    return [
      {
        label: 'Stories Shared',
        value: dashboard.stats.storiesShared,
        visual: 'elderStories',
      },
      {
        label: 'Learners',
        value: dashboard.stats.followerCount,
        visual: 'elderLearners',
      },
    ];
  }

  return [
    {
      label: 'Words Learned',
      value: dashboard.stats.wordsLearned,
      visual: 'words',
    },
    {
      label: 'Stories Completed',
      value: dashboard.stats.storiesCompleted,
      visual: 'stories',
    },
  ];
};

const MenuItem = ({ icon, label, onClick, danger = false, disabled = false }: MenuItemProps) => {
  return (
    <button
      type="button"
      className={`profile-menu-item${danger ? ' profile-menu-item-danger' : ''}`}
      onClick={onClick}
      disabled={disabled}
    >
      <span className="profile-menu-left">
        <img className="profile-menu-icon" src={icon} alt="" aria-hidden="true" />
        <span>{label}</span>
      </span>
      <img
        className="profile-menu-chevron"
        src={PROFILE_UI_ASSETS.chevron}
        alt=""
        aria-hidden="true"
      />
    </button>
  );
};

const BackButton = ({ onBack, tone = 'dark' }: BackButtonProps) => {
  return (
    <button
      type="button"
      className={`profile-back-button${tone === 'light' ? ' profile-back-button-light' : ''}`}
      onClick={onBack}
      aria-label="Go back"
    >
      <img
        className="profile-back-button-icon"
        src={tone === 'light' ? PROFILE_UI_ASSETS.backWhite : PROFILE_UI_ASSETS.backBlack}
        alt=""
        aria-hidden="true"
      />
    </button>
  );
};

const ProfileLoadingSkeleton = () => (
  <section
    className="profile-screen profile-loading-shell profile-screen-enter"
    aria-label="Loading profile"
  >
    <div className="profile-hero">
      <div className="profile-avatar-block">
        <div className="profile-loading-avatar profile-loading-shimmer" />
      </div>
      <div className="profile-loading-line profile-loading-name profile-loading-shimmer" />
      <div className="profile-loading-line profile-loading-subtitle profile-loading-shimmer" />
    </div>

    <div className="profile-cards">
      <article className="profile-level-card">
        <AppSkeleton className="profile-loading-level" />
      </article>

      <div className="profile-loading-stats" aria-hidden="true">
        {Array.from({ length: 4 }).map((_, index) => (
          <AppSkeleton key={index} className="profile-loading-stat" />
        ))}
      </div>

      <div className="profile-loading-menu" aria-hidden="true">
        {Array.from({ length: 4 }).map((_, index) => (
          <AppSkeleton key={index} className="profile-loading-menu-item" />
        ))}
      </div>
    </div>
  </section>
);

const ProfileSubHeader = ({ title, onBack }: { title: string; onBack: () => void }) => {
  return (
    <header className="profile-subheader">
      <BackButton onBack={onBack} />
      <h2>{title}</h2>
    </header>
  );
};

const ProfileOverviewScreen = ({
  dashboard,
  onEditProfile,
  onOpenSettings,
  onOpenSupport,
  onSignOut,
  isSigningOut,
}: OverviewProps) => {
  const roleLabel = toRoleLabel(dashboard.profile.role);
  const visualRole = toVisualRole(dashboard.profile.role);
  const statCards = getStatCards(dashboard);

  return (
    <section className="profile-screen profile-overview-screen profile-screen-enter">
      <div className="profile-hero">
        <div className="profile-avatar-block">
          <div className={`profile-avatar profile-avatar-${visualRole}`}>
            {dashboard.profile.avatarUrl ? (
              <img
                className="profile-avatar-custom"
                src={dashboard.profile.avatarUrl}
                alt={dashboard.profile.fullName}
              />
            ) : (
              <div className="profile-avatar-art" aria-hidden="true">
                <img
                  className={`profile-avatar-fallback profile-avatar-fallback-${visualRole}`}
                  src={getFallbackAvatarAsset(dashboard.profile.role)}
                  alt=""
                />
              </div>
            )}
          </div>

          <button
            type="button"
            className="profile-avatar-edit-badge"
            onClick={onEditProfile}
            aria-label="Edit profile"
          >
            <img src={PROFILE_UI_ASSETS.avatarEditBadge} alt="" aria-hidden="true" />
          </button>
        </div>

        <h2>{dashboard.profile.fullName}</h2>
        <p>
          You&apos;re a <em>{roleLabel}</em>
        </p>
      </div>

      <div className="profile-cards">
        <article className="profile-level-card">
          <div className="profile-level-icon-wrap" aria-hidden="true">
            <div className="profile-level-icon">
              <img src={PROFILE_ASSETS.levelIcon} alt="" />
            </div>
          </div>

          <div className="profile-level-copy">
            <div className="profile-level-card-top">
              <span>{dashboard.level.label}</span>
              <span>{dashboard.level.progressPercent}%</span>
            </div>

            <div
              className="profile-level-progress"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={dashboard.level.progressPercent}
            >
              <span style={{ width: `${dashboard.level.progressPercent}%` }} />
            </div>
          </div>
        </article>

        <div className="profile-stats-grid">
          {statCards.map((card) => (
            <article key={card.label} className="profile-stat-card">
              <div
                className={`profile-stat-art profile-stat-art-${card.visual}`}
                aria-hidden="true"
              >
                <img
                  src={
                    card.visual === 'elderStories' || card.visual === 'elderLearners'
                      ? PROFILE_ASSETS.elderStatsIcon
                      : card.visual === 'words'
                        ? PROFILE_ASSETS.wordsIcon
                        : PROFILE_ASSETS.storiesIcon
                  }
                  alt=""
                />
              </div>

              <div className="profile-stat-copy">
                <strong>{card.value}</strong>
                <span>{card.label}</span>
              </div>
            </article>
          ))}
        </div>

        <div className="profile-menu" role="navigation" aria-label="Profile options">
          <MenuItem
            icon={PROFILE_UI_ASSETS.editMenu}
            label="Edit Profile"
            onClick={onEditProfile}
          />
          <MenuItem
            icon={PROFILE_UI_ASSETS.settingsMenu}
            label="Settings"
            onClick={onOpenSettings}
          />
          <MenuItem icon={PROFILE_UI_ASSETS.supportMenu} label="Support" onClick={onOpenSupport} />
          <MenuItem
            icon={PROFILE_UI_ASSETS.logoutMenu}
            label={isSigningOut ? 'Signing out...' : 'Log Out'}
            onClick={() => void onSignOut()}
            danger
            disabled={isSigningOut}
          />
        </div>
      </div>
    </section>
  );
};

const EditProfileScreen = ({ dashboard, onBack, onSaved, onToast }: EditProfileProps) => {
  const navigate = useNavigate();
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [fullName, setFullName] = useState(dashboard.profile.fullName);
  const [email, setEmail] = useState(dashboard.profile.email);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const visualRole = toVisualRole(dashboard.profile.role);

  useEffect(() => {
    setFullName(dashboard.profile.fullName);
    setEmail(dashboard.profile.email);
  }, [dashboard.profile.email, dashboard.profile.fullName]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const validationError = validateFullName(fullName) ?? validateEmail(email);
    if (validationError) {
      onToast({ message: validationError, color: 'danger' });
      triggerHapticFeedback('error');
      return;
    }

    setIsSaving(true);
    triggerHapticFeedback('light');

    try {
      const didUpdate = await updateProfileDetails({
        userId: dashboard.profile.id,
        fullName: fullName.trim(),
        email: email.trim(),
      });
      if (didUpdate) {
        await onSaved();
        onToast({ message: 'Profile updated successfully.', color: 'success' });
        triggerHapticFeedback('success');
      }
      navigate('/home/profile', { replace: true });
    } catch (error) {
      onToast({ message: toAuthErrorMessage(error), color: 'danger' });
      triggerHapticFeedback('error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarSelection = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    if (isUploadingAvatar) {
      return;
    }

    setIsUploadingAvatar(true);
    triggerHapticFeedback('light');

    try {
      await uploadProfileAvatar({
        userId: dashboard.profile.id,
        file,
        currentAvatarUrl: dashboard.profile.avatarUrl,
      });

      await onSaved();
      onToast({ message: 'Profile photo updated.', color: 'success' });
      triggerHapticFeedback('success');
    } catch (error) {
      onToast({ message: toAuthErrorMessage(error), color: 'danger' });
      triggerHapticFeedback('error');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  return (
    <section className="profile-screen profile-subscreen profile-screen-enter">
      <ProfileSubHeader title="Edit Profile" onBack={onBack} />

      <form className="profile-form profile-form-edit" onSubmit={handleSubmit}>
        <div className="profile-edit-avatar-block">
          <div className={`profile-avatar profile-avatar-editing profile-avatar-${visualRole}`}>
            {dashboard.profile.avatarUrl ? (
              <img
                className="profile-avatar-custom"
                src={dashboard.profile.avatarUrl}
                alt={dashboard.profile.fullName}
              />
            ) : (
              <div className="profile-avatar-art" aria-hidden="true">
                <img
                  className={`profile-avatar-fallback profile-avatar-fallback-${visualRole}`}
                  src={getFallbackAvatarAsset(dashboard.profile.role)}
                  alt=""
                />
              </div>
            )}
          </div>

          <button
            type="button"
            className="profile-avatar-edit-badge profile-avatar-edit-badge-edit"
            onClick={() => avatarInputRef.current?.click()}
            disabled={isUploadingAvatar}
            aria-label="Change avatar"
          >
            <img src={PROFILE_UI_ASSETS.avatarEditBadge} alt="" aria-hidden="true" />
          </button>
        </div>

        <input
          ref={avatarInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleAvatarSelection}
          className="profile-file-input"
        />

        <label className="profile-field">
          <span>Full Name</span>
          <input
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            autoComplete="name"
            disabled={isSaving}
            required
          />
        </label>

        <label className="profile-field">
          <span>Email</span>
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            autoComplete="email"
            disabled={isSaving}
            required
          />
        </label>

        <div className="profile-field">
          <span>Password</span>
          <button
            type="button"
            className="profile-field-button"
            onClick={() => navigate('/home/profile/settings/password')}
          >
            <span>**********</span>
            <img src={PROFILE_UI_ASSETS.eye} alt="" aria-hidden="true" />
          </button>
        </div>

        <label className="profile-field">
          <span>Role</span>
          <input value={toRoleTitle(dashboard.profile.role)} readOnly />
        </label>

        <button
          type="submit"
          className="profile-primary-button"
          disabled={isSaving || isUploadingAvatar}
        >
          {isSaving ? 'Saving...' : isUploadingAvatar ? 'Uploading...' : 'Save Profile'}
        </button>
      </form>
    </section>
  );
};

const SettingsScreen = ({
  dashboard,
  onBack,
  onOpenChangePassword,
  onOpenChangeLanguage,
  onOpenAbout,
  onOpenPrivacy,
  onPushPreferenceChanged,
  onToast,
}: SettingsProps) => {
  const [isUpdatingPush, setIsUpdatingPush] = useState(false);

  const togglePushNotifications = async () => {
    if (isUpdatingPush) {
      return;
    }

    const nextValue = !dashboard.profile.pushNotificationsEnabled;
    setIsUpdatingPush(true);
    triggerHapticFeedback('light');

    try {
      await onPushPreferenceChanged(nextValue);
      onToast({
        message: `Push notifications ${nextValue ? 'enabled' : 'disabled'}.`,
        color: 'success',
      });
      triggerHapticFeedback('success');
    } catch (error) {
      onToast({ message: toAuthErrorMessage(error), color: 'danger' });
      triggerHapticFeedback('error');
    } finally {
      setIsUpdatingPush(false);
    }
  };

  return (
    <section className="profile-screen profile-settings-screen profile-screen-enter">
      <div className="profile-settings-hero">
        <BackButton tone="light" onBack={onBack} />
        <h2>Settings</h2>
      </div>

      <div className="profile-settings-card">
        <div className="profile-settings-list">
          <button type="button" className="profile-settings-row" onClick={onOpenChangePassword}>
            <span className="profile-settings-row-left">
              <img src={PROFILE_UI_ASSETS.settingsLock} alt="" aria-hidden="true" />
              <span>Change password</span>
            </span>
            <img src={PROFILE_UI_ASSETS.settingsChevron} alt="" aria-hidden="true" />
          </button>

          <button
            type="button"
            className="profile-settings-row profile-settings-row-toggle"
            role="switch"
            aria-checked={dashboard.profile.pushNotificationsEnabled}
            onClick={() => void togglePushNotifications()}
            disabled={isUpdatingPush}
          >
            <span className="profile-settings-row-left">
              <img src={PROFILE_UI_ASSETS.settingsBell} alt="" aria-hidden="true" />
              <span>Push notifications</span>
            </span>

            <span
              className={`profile-toggle ${dashboard.profile.pushNotificationsEnabled ? 'is-on' : ''}`}
              aria-hidden="true"
            >
              <span className="profile-toggle-thumb" />
            </span>
          </button>

          <button type="button" className="profile-settings-row" onClick={onOpenChangeLanguage}>
            <span className="profile-settings-row-left">
              <img src={PROFILE_UI_ASSETS.settingsGlobe} alt="" aria-hidden="true" />
              <span>Change language</span>
            </span>
            <img src={PROFILE_UI_ASSETS.settingsChevron} alt="" aria-hidden="true" />
          </button>

          <button type="button" className="profile-settings-row" onClick={onOpenAbout}>
            <span className="profile-settings-row-left">
              <img src={PROFILE_UI_ASSETS.settingsAbout} alt="" aria-hidden="true" />
              <span>About us</span>
            </span>
            <img src={PROFILE_UI_ASSETS.settingsChevron} alt="" aria-hidden="true" />
          </button>

          <button type="button" className="profile-settings-row" onClick={onOpenPrivacy}>
            <span className="profile-settings-row-left">
              <img src={PROFILE_UI_ASSETS.settingsPrivacy} alt="" aria-hidden="true" />
              <span>Privacy policy</span>
            </span>
            <img src={PROFILE_UI_ASSETS.settingsChevron} alt="" aria-hidden="true" />
          </button>
        </div>

        <p>{APP_VERSION}</p>
      </div>
    </section>
  );
};

const ChangePasswordScreen = ({ onBack, onSaved, onToast }: ChangePasswordProps) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!currentPassword) {
      onToast({ message: 'Current password is required.', color: 'danger' });
      triggerHapticFeedback('error');
      return;
    }

    const validationError = validatePassword(newPassword);
    if (validationError) {
      onToast({ message: validationError, color: 'danger' });
      triggerHapticFeedback('error');
      return;
    }

    if (confirmPassword !== newPassword) {
      onToast({ message: 'Passwords do not match.', color: 'danger' });
      triggerHapticFeedback('error');
      return;
    }

    if (newPassword === currentPassword) {
      onToast({
        message: 'New password must be different from the current password.',
        color: 'danger',
      });
      triggerHapticFeedback('error');
      return;
    }

    setIsSaving(true);
    triggerHapticFeedback('light');

    try {
      await updatePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      onToast({ message: 'Password updated successfully.', color: 'success' });
      triggerHapticFeedback('success');
      onSaved();
    } catch (error) {
      onToast({ message: toAuthErrorMessage(error), color: 'danger' });
      triggerHapticFeedback('error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="profile-screen profile-subscreen profile-screen-enter">
      <ProfileSubHeader title="Change Password" onBack={onBack} />

      <form className="profile-form profile-form-subpage" onSubmit={handleSubmit}>
        <label className="profile-field">
          <span>Current Password</span>
          <div className="profile-password-field">
            <input
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              type={showCurrentPassword ? 'text' : 'password'}
              autoComplete="current-password"
              disabled={isSaving}
              required
            />
            <button
              type="button"
              onClick={() => setShowCurrentPassword((value) => !value)}
              aria-label={showCurrentPassword ? 'Hide current password' : 'Show current password'}
            >
              <img src={PROFILE_UI_ASSETS.eye} alt="" aria-hidden="true" />
            </button>
          </div>
        </label>

        <label className="profile-field">
          <span>New Password</span>
          <div className="profile-password-field">
            <input
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              type={showNewPassword ? 'text' : 'password'}
              autoComplete="new-password"
              disabled={isSaving}
              required
            />
            <button
              type="button"
              onClick={() => setShowNewPassword((value) => !value)}
              aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
            >
              <img src={PROFILE_UI_ASSETS.eye} alt="" aria-hidden="true" />
            </button>
          </div>
        </label>

        <label className="profile-field">
          <span>Confirm New Password</span>
          <div className="profile-password-field">
            <input
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              type={showConfirmPassword ? 'text' : 'password'}
              autoComplete="new-password"
              disabled={isSaving}
              required
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((value) => !value)}
              aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
            >
              <img src={PROFILE_UI_ASSETS.eye} alt="" aria-hidden="true" />
            </button>
          </div>
        </label>

        <button type="submit" className="profile-primary-button" disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Password'}
        </button>
      </form>
    </section>
  );
};

const ChangeLanguageScreen = ({ dashboard, onBack, onSaved, onToast }: ChangeLanguageProps) => {
  const [appLanguage, setAppLanguage] = useState(dashboard.profile.appLanguage);
  const [indigenousLanguage, setIndigenousLanguage] = useState(
    dashboard.profile.indigenousLanguage,
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setAppLanguage(dashboard.profile.appLanguage);
    setIndigenousLanguage(dashboard.profile.indigenousLanguage);
  }, [dashboard.profile.appLanguage, dashboard.profile.indigenousLanguage]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const isUnchanged =
      appLanguage === dashboard.profile.appLanguage &&
      indigenousLanguage === dashboard.profile.indigenousLanguage;

    if (isUnchanged) {
      onToast({ message: 'No changes to save.', color: 'warning' });
      return;
    }

    setIsSaving(true);
    triggerHapticFeedback('light');
    try {
      await onSaved(appLanguage, indigenousLanguage);
      onToast({ message: 'Language preferences updated.', color: 'success' });
      triggerHapticFeedback('success');
    } catch (error) {
      onToast({ message: toAuthErrorMessage(error), color: 'danger' });
      triggerHapticFeedback('error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="profile-screen profile-subscreen profile-screen-enter">
      <ProfileSubHeader title="Change Language" onBack={onBack} />

      <form className="profile-form profile-form-subpage" onSubmit={handleSubmit}>
        <label className="profile-field">
          <span>App Language</span>
          <div className="profile-select-wrap">
            <select
              value={appLanguage}
              onChange={(event) => setAppLanguage(event.target.value)}
              disabled={isSaving}
            >
              {APP_LANGUAGE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <img src={PROFILE_UI_ASSETS.dropdown} alt="" aria-hidden="true" />
          </div>
        </label>

        <label className="profile-field">
          <span>Indigenous Language</span>
          <div className="profile-select-wrap">
            <select
              value={indigenousLanguage}
              onChange={(event) => setIndigenousLanguage(event.target.value)}
              disabled={isSaving}
            >
              {INDIGENOUS_LANGUAGE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <img src={PROFILE_UI_ASSETS.dropdown} alt="" aria-hidden="true" />
          </div>
        </label>

        <button type="submit" className="profile-primary-button" disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Languages'}
        </button>
      </form>
    </section>
  );
};

const InfoScreen = ({
  title,
  lines,
  onBack,
  includeMission = false,
  includePrivacySections = false,
}: InfoScreenProps) => {
  const location = useLocation();
  const stickyPolicy = getStickyHeaderPolicy(
    location.pathname,
    new URLSearchParams(location.search),
  );
  const isCompactSticky = stickyPolicy === 'compact-sticky';

  return (
    <section className="profile-screen profile-info-screen profile-screen-enter">
      <div className={`profile-info-header${isCompactSticky ? ' is-compact-sticky' : ''}`}>
        <div className="profile-info-header-inner">
          <BackButton onBack={onBack} tone="light" />
          <h2>{title}</h2>
        </div>
      </div>

      <article className="profile-info-content">
        {lines.map((line) => {
          if (line.startsWith('Last Updated: ')) {
            return (
              <p key={line}>
                <span>Last Updated: </span>
                <strong>{line.replace('Last Updated: ', '')}</strong>
              </p>
            );
          }

          return <p key={line}>{line}</p>;
        })}

        {includeMission && (
          <>
            <p>Taleka is built to:</p>
            <ul>
              <li>Preserve cultural stories</li>
              <li>Support community-led language revival</li>
              <li>Make learning accessible on low-bandwidth devices</li>
              <li>Empower the next generation to keep their language alive</li>
            </ul>
            <h3>Our Mission</h3>
            <p>
              To preserve and revitalize endangered languages by connecting elders and learners
              through storytelling, community knowledge, and accessible AI-powered learning tools.
            </p>
            <h3>Our Vision</h3>
            <p>
              We envision a world where endangered languages are not only preserved, but actively
              spoken, learned, and celebrated powered by community voices and responsible
              technology.
            </p>
            <p>Languages are more than words.</p>
            <p>They are memory, identity, and belonging.</p>
            <p>At Taleka, we help them grow.</p>
          </>
        )}

        {includePrivacySections && (
          <>
            <h3>What We Collect</h3>
            <ul>
              <li>Account information (name, email)</li>
              <li>Learning progress and AI conversations</li>
              <li>Audio/video recordings uploaded by users</li>
              <li>Basic device and usage data</li>
            </ul>
            <h3>How We Use It</h3>
            <ul>
              <li>To provide learning features</li>
              <li>To generate AI responses and feedback</li>
              <li>To store and organize cultural stories</li>
              <li>To improve app performance</li>
            </ul>
            <p>We do not sell your personal data.</p>
            <h3>Your Rights</h3>
            <p>You may edit your profile or request account and content deletion at any time.</p>
            <p>
              Contact: <strong>taleka@gmail.com</strong>
            </p>
            <p>By using Taleka, you agree to this policy.</p>
          </>
        )}
      </article>
    </section>
  );
};

const parseMetadataRole = (value: unknown): ProfileRole | undefined => {
  if (value === 'learner' || value === 'elder' || value === 'admin') {
    return value;
  }

  return undefined;
};

export function ProfilePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const [dashboard, setDashboard] = useState<ProfileDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const fallbackRole = useMemo(
    () => parseMetadataRole((user?.user_metadata as Record<string, unknown> | undefined)?.role),
    [user?.user_metadata],
  );

  const refreshProfile = useCallback(async () => {
    if (!user) {
      setDashboard(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const nextDashboard = await fetchProfileDashboard({
        userId: user.id,
        fallbackRole,
      });
      setDashboard(nextDashboard);
    } catch (error) {
      setDashboard(null);
      setToast({ message: toAuthErrorMessage(error), color: 'danger' });
    } finally {
      setIsLoading(false);
    }
  }, [fallbackRole, user]);

  // Initial load
  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);

  // Re-fetch whenever the user returns to the profile overview tab from
  // another tab (e.g. after a VocabMaster session). Sub-routes like /edit
  // or /settings are intentionally excluded — they use onSaved callbacks.
  const isProfileOverview = location.pathname === '/home/profile';
  useEffect(() => {
    if (isProfileOverview && dashboard !== null) {
      void refreshProfile();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isProfileOverview]);

  const handleSignOut = async () => {
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);
    triggerHapticFeedback('light');

    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }

      triggerHapticFeedback('success');
    } catch (error) {
      setToast({ message: toAuthErrorMessage(error), color: 'danger' });
      triggerHapticFeedback('error');
    } finally {
      setIsSigningOut(false);
    }
  };

  const openSupport = () => {
    triggerHapticFeedback('light');
    window.location.href = 'mailto:taleka@gmail.com?subject=Taleka%20Support';
  };

  const navigateBackToProfile = () => {
    triggerHapticFeedback('light');
    navigate('/home/profile');
  };

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (isLoading && !dashboard) {
    return <ProfileLoadingSkeleton />;
  }

  if (!dashboard) {
    return (
      <div className="profile-loading profile-loading-error">
        <p>Unable to load profile right now.</p>
        <IonButton
          onClick={() => {
            triggerHapticFeedback('light');
            void refreshProfile();
          }}
        >
          Retry
        </IonButton>
      </div>
    );
  }

  return (
    <>
      <Routes>
        <Route
          index
          element={
            <ProfileOverviewScreen
              dashboard={dashboard}
              onEditProfile={() => {
                triggerHapticFeedback('light');
                navigate('/home/profile/edit');
              }}
              onOpenSettings={() => {
                triggerHapticFeedback('light');
                navigate('/home/profile/settings');
              }}
              onOpenSupport={openSupport}
              onSignOut={handleSignOut}
              isSigningOut={isSigningOut}
            />
          }
        />
        <Route
          path="edit"
          element={
            <EditProfileScreen
              dashboard={dashboard}
              onBack={navigateBackToProfile}
              onSaved={refreshProfile}
              onToast={setToast}
            />
          }
        />
        <Route
          path="settings"
          element={
            <SettingsScreen
              dashboard={dashboard}
              onBack={navigateBackToProfile}
              onOpenChangePassword={() => {
                triggerHapticFeedback('light');
                navigate('/home/profile/settings/password');
              }}
              onOpenChangeLanguage={() => {
                triggerHapticFeedback('light');
                navigate('/home/profile/settings/language');
              }}
              onOpenAbout={() => {
                triggerHapticFeedback('light');
                navigate('/home/profile/settings/about');
              }}
              onOpenPrivacy={() => {
                triggerHapticFeedback('light');
                navigate('/home/profile/settings/privacy');
              }}
              onPushPreferenceChanged={async (value) => {
                await updatePushNotification({
                  userId: dashboard.profile.id,
                  pushNotificationsEnabled: value,
                });
                await refreshProfile();
              }}
              onToast={setToast}
            />
          }
        />
        <Route
          path="settings/password"
          element={
            <ChangePasswordScreen
              onBack={() => {
                triggerHapticFeedback('light');
                navigate('/home/profile/settings');
              }}
              onSaved={() => {
                navigate('/home/profile/settings', { replace: true });
              }}
              onToast={setToast}
            />
          }
        />
        <Route
          path="settings/language"
          element={
            <ChangeLanguageScreen
              dashboard={dashboard}
              onBack={() => {
                triggerHapticFeedback('light');
                navigate('/home/profile/settings');
              }}
              onSaved={async (appLanguage, indigenousLanguage) => {
                await updateProfilePreferences({
                  userId: dashboard.profile.id,
                  appLanguage,
                  indigenousLanguage,
                  pushNotificationsEnabled: dashboard.profile.pushNotificationsEnabled,
                });
                await refreshProfile();
                navigate('/home/profile/settings', { replace: true });
              }}
              onToast={setToast}
            />
          }
        />
        <Route
          path="settings/about"
          element={
            <InfoScreen
              title="About Us"
              lines={ABOUT_US_COPY}
              onBack={() => {
                triggerHapticFeedback('light');
                navigate('/home/profile/settings');
              }}
              includeMission
            />
          }
        />
        <Route
          path="settings/privacy"
          element={
            <InfoScreen
              title="Privacy Policy"
              lines={PRIVACY_COPY}
              onBack={() => {
                triggerHapticFeedback('light');
                navigate('/home/profile/settings');
              }}
              includePrivacySections
            />
          }
        />
        <Route path="*" element={<Navigate to="/home/profile" replace />} />
      </Routes>

      <IonToast
        isOpen={Boolean(toast)}
        message={toast?.message ?? ''}
        color={toast?.color}
        duration={2800}
        onDidDismiss={() => setToast(null)}
      />
    </>
  );
}
