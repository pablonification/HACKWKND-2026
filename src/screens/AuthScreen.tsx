import { useEffect, useMemo, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { requestPasswordReset, signInWithEmail, signUpWithEmail } from '../lib/auth';
import { triggerHapticFeedback } from '../lib/feedback';
import { getBoolean, setBoolean, STORAGE_KEYS } from '../lib/storage';
import type { AuthRole } from '../utils/authValidation';
import { validateEmail, validateLoginForm, validateSignUpForm } from '../utils/authValidation';
import { toAuthErrorMessage } from '../utils/authErrors';

type AuthMode = 'landing' | 'login' | 'register';

type AuthMessage = {
  type: 'error' | 'info';
  text: string;
};

const ROLE_OPTIONS: { label: string; value: AuthRole }[] = [
  { label: 'Learner', value: 'learner' },
  { label: 'Elder', value: 'elder' },
];

const AUTH_ASSETS = {
  topPattern: require('../../assets/auth/auth-top-pattern.png'),
  landingIllustration: require('../../assets/auth/landing-illustration.png'),
  asean: require('../../assets/auth/asean.png'),
  eye: require('../../assets/auth/icon-eye.png'),
  facebook: require('../../assets/auth/icon-facebook.png'),
  google: require('../../assets/auth/icon-google.png'),
  apple: require('../../assets/auth/icon-apple.png'),
} as const;

export function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>('landing');
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerRole, setRegisterRole] = useState<AuthRole | null>(null);
  const [isRoleMenuOpen, setIsRoleMenuOpen] = useState(false);

  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<AuthMessage | null>(null);

  const roleLabel = useMemo(
    () => ROLE_OPTIONS.find((option) => option.value === registerRole)?.label ?? 'Choose your role',
    [registerRole],
  );
  const landingIllustrationStyle = useMemo(() => {
    const width = Math.max(screenWidth - 8, 0);

    return {
      width,
      height: (width * 369) / 385,
    };
  }, [screenWidth]);
  const topAreaPatternStyle = useMemo(
    () => ({
      left: -screenWidth / 2,
      width: screenWidth * 2,
    }),
    [screenWidth],
  );

  const setErrorMessage = (text: string) => setMessage({ type: 'error', text });
  const setInfoMessage = (text: string) => setMessage({ type: 'info', text });
  const clearMessage = () => setMessage(null);

  useEffect(() => {
    let isMounted = true;

    const hydrateRememberMe = async () => {
      const transientSession = await getBoolean(STORAGE_KEYS.AUTH_TRANSIENT_SESSION, false);

      if (isMounted) {
        setRememberMe(!transientSession);
      }
    };

    hydrateRememberMe();

    return () => {
      isMounted = false;
    };
  }, []);

  const switchMode = (nextMode: AuthMode) => {
    clearMessage();
    setIsRoleMenuOpen(false);
    setMode(nextMode);
  };

  const switchModeWithFeedback = (nextMode: AuthMode) => {
    triggerHapticFeedback('light');
    switchMode(nextMode);
  };

  const handleLogin = async () => {
    const normalizedEmail = loginEmail.trim().toLowerCase();
    const validationError = validateLoginForm(normalizedEmail, loginPassword);
    clearMessage();

    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setIsSubmitting(true);

    try {
      await signInWithEmail({
        email: normalizedEmail,
        password: loginPassword,
      });
      await setBoolean(STORAGE_KEYS.AUTH_TRANSIENT_SESSION, !rememberMe);
    } catch (error: unknown) {
      setErrorMessage(toAuthErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async () => {
    const normalizedEmail = registerEmail.trim().toLowerCase();
    const validationError = validateSignUpForm(
      registerName,
      normalizedEmail,
      registerPassword,
      registerRole,
    );
    clearMessage();

    if (validationError) {
      setErrorMessage(validationError);
      return;
    }
    if (!registerRole) {
      setErrorMessage('Please select your role.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await signUpWithEmail({
        fullName: registerName.trim(),
        email: normalizedEmail,
        password: registerPassword,
        role: registerRole,
      });

      if (response.data.session) {
        await setBoolean(STORAGE_KEYS.AUTH_TRANSIENT_SESSION, false);
      } else {
        setInfoMessage('Account created. Confirm your email first, then log in.');
        setMode('login');
        setLoginEmail(normalizedEmail);
        setLoginPassword('');
      }
    } catch (error: unknown) {
      setErrorMessage(toAuthErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    const normalizedEmail = loginEmail.trim().toLowerCase();
    const emailError = validateEmail(normalizedEmail);
    clearMessage();

    if (emailError) {
      setErrorMessage(emailError);
      return;
    }

    setIsSubmitting(true);
    try {
      await requestPasswordReset(normalizedEmail);
      triggerHapticFeedback('success');
      setInfoMessage('Password reset email sent. Check your inbox.');
    } catch (error: unknown) {
      setErrorMessage(toAuthErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSocialPress = (provider: string) => {
    triggerHapticFeedback('light');
    clearMessage();
    setInfoMessage(`${provider} login will be enabled after provider setup in Supabase.`);
  };

  const renderLanding = () => (
    <View style={styles.landingContent}>
      <View style={styles.brandRow}>
        <Text style={styles.brandT}>T</Text>
        <Text style={styles.brandAleka}>aleka</Text>
      </View>

      <View style={styles.landingTextBlock}>
        <Text style={styles.sheetTitle}>Every story keeps a language alive</Text>
        <Text style={styles.sheetSubtitle}>
          Discover endangered languages through real elder voices and interactive folklore.
        </Text>
      </View>

      <Pressable
        onPress={() => switchModeWithFeedback('login')}
        style={({ pressed }) => [
          styles.landingButton,
          pressed ? styles.primaryButtonPressed : null,
        ]}
      >
        <Text style={styles.landingButtonText}>Get started →</Text>
      </Pressable>
    </View>
  );

  const renderLogin = () => (
    <View style={styles.formContent}>
      <View style={styles.headlineBlock}>
        <Text style={styles.formTitle}>Welcome Back</Text>
        <Text style={styles.formSubtitle}>Ready to continue your learning journey?</Text>
      </View>

      <LabeledInput
        label="Email"
        value={loginEmail}
        onChangeText={setLoginEmail}
        placeholder="you@example.com"
        autoCapitalize="none"
        keyboardType="email-address"
        editable={!isSubmitting}
      />

      <LabeledPasswordInput
        label="Password"
        value={loginPassword}
        onChangeText={setLoginPassword}
        placeholder="**********"
        visible={showLoginPassword}
        onToggleVisibility={() => {
          triggerHapticFeedback('light');
          setShowLoginPassword((value) => !value);
        }}
        editable={!isSubmitting}
      />

      <View style={styles.rememberRow}>
        <Pressable
          onPress={() => {
            triggerHapticFeedback('light');
            setRememberMe((value) => !value);
          }}
          style={({ pressed }) => [
            styles.rememberToggle,
            pressed && !isSubmitting ? styles.inlinePressed : null,
          ]}
          disabled={isSubmitting}
        >
          <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
            {rememberMe ? <Text style={styles.checkboxTick}>✓</Text> : null}
          </View>
          <Text style={styles.rememberText}>Remember me</Text>
        </Pressable>

        <Pressable
          onPress={() => {
            triggerHapticFeedback('light');
            void handleForgotPassword();
          }}
          style={({ pressed }) => (pressed && !isSubmitting ? styles.linkPressed : null)}
          disabled={isSubmitting}
        >
          <Text style={styles.linkText}>Forgot password?</Text>
        </Pressable>
      </View>

      <Pressable
        onPress={() => {
          triggerHapticFeedback('medium');
          void handleLogin();
        }}
        style={({ pressed }) => [
          styles.primaryButton,
          pressed && !isSubmitting ? styles.primaryButtonPressed : null,
        ]}
        disabled={isSubmitting}
      >
        <Text style={styles.primaryButtonText}>{isSubmitting ? 'Logging In...' : 'Log In'}</Text>
      </Pressable>

      <SocialAuthSection onPress={handleSocialPress} mode="login" />

      <Pressable
        onPress={() => switchModeWithFeedback('register')}
        style={({ pressed }) => (pressed && !isSubmitting ? styles.linkPressed : null)}
        disabled={isSubmitting}
      >
        <Text style={styles.switchText}>
          <Text style={styles.mutedText}>Don&apos;t have account? </Text>
          <Text style={styles.linkText}>Sign Up</Text>
        </Text>
      </Pressable>
    </View>
  );

  const renderRegister = () => (
    <View style={styles.formContent}>
      <View style={styles.headlineBlock}>
        <Text style={styles.formTitle}>Create Your Account</Text>
        <Text style={styles.formSubtitle}>
          We&apos;re here to help you on your journey of learning.{' '}
          <Text style={styles.bold}>Are you ready?</Text>
        </Text>
      </View>

      <LabeledInput
        label="Full Name"
        value={registerName}
        onChangeText={setRegisterName}
        placeholder="Taleka User"
        editable={!isSubmitting}
      />

      <LabeledInput
        label="Email"
        value={registerEmail}
        onChangeText={setRegisterEmail}
        placeholder="you@example.com"
        autoCapitalize="none"
        keyboardType="email-address"
        editable={!isSubmitting}
      />

      <LabeledPasswordInput
        label="Password"
        value={registerPassword}
        onChangeText={setRegisterPassword}
        placeholder="**********"
        visible={showRegisterPassword}
        onToggleVisibility={() => {
          triggerHapticFeedback('light');
          setShowRegisterPassword((value) => !value);
        }}
        editable={!isSubmitting}
      />

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Role</Text>
        <Pressable
          onPress={() => {
            triggerHapticFeedback('light');
            setIsRoleMenuOpen((value) => !value);
          }}
          style={({ pressed }) => [
            styles.dropdownField,
            pressed && !isSubmitting ? styles.inlinePressed : null,
          ]}
          disabled={isSubmitting}
        >
          <Text style={registerRole ? styles.dropdownValue : styles.dropdownPlaceholder}>
            {roleLabel}
          </Text>
          <Text style={styles.dropdownArrow}>{isRoleMenuOpen ? '▴' : '▾'}</Text>
        </Pressable>
        {isRoleMenuOpen ? (
          <View style={styles.dropdownMenu}>
            {ROLE_OPTIONS.map((option) => (
              <Pressable
                key={option.value}
                onPress={() => {
                  triggerHapticFeedback('light');
                  setRegisterRole(option.value);
                  setIsRoleMenuOpen(false);
                }}
                style={({ pressed }) => [
                  styles.dropdownOption,
                  pressed ? styles.dropdownOptionPressed : null,
                ]}
              >
                <Text style={styles.dropdownOptionText}>{option.label}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      <Pressable
        onPress={() => {
          triggerHapticFeedback('medium');
          void handleRegister();
        }}
        style={({ pressed }) => [
          styles.primaryButton,
          pressed && !isSubmitting ? styles.primaryButtonPressed : null,
        ]}
        disabled={isSubmitting}
      >
        <Text style={styles.primaryButtonText}>{isSubmitting ? 'Creating...' : 'Get Started'}</Text>
      </Pressable>

      <SocialAuthSection onPress={handleSocialPress} mode="register" />

      <Pressable
        onPress={() => switchModeWithFeedback('login')}
        style={({ pressed }) => (pressed && !isSubmitting ? styles.linkPressed : null)}
        disabled={isSubmitting}
      >
        <Text style={styles.switchText}>
          <Text style={styles.mutedText}>Already have an account? </Text>
          <Text style={styles.linkText}>Log In</Text>
        </Text>
      </Pressable>
    </View>
  );

  if (mode === 'landing') {
    return (
      <SafeAreaView style={styles.landingSafeArea}>
        <StatusBar style="dark" />
        <View style={styles.landingScreen}>
          <View style={styles.landingInner}>{renderLanding()}</View>
          <Image
            source={AUTH_ASSETS.landingIllustration}
            style={[styles.landingIllustration, landingIllustrationStyle]}
          />
          <Image source={AUTH_ASSETS.asean} style={styles.landingAseanBadge} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <StatusBar style="light" />
      <View style={styles.topArea}>
        <Image
          source={AUTH_ASSETS.topPattern}
          style={[styles.topAreaPatternImage, topAreaPatternStyle]}
        />
        <Pressable
          onPress={() => switchModeWithFeedback('landing')}
          style={({ pressed }) => [
            styles.backButton,
            pressed && !isSubmitting ? styles.inlinePressed : null,
          ]}
          disabled={isSubmitting}
        >
          <Text style={styles.backChevron}>‹</Text>
          <Text style={styles.backText}>Back</Text>
        </Pressable>
      </View>

      <View style={styles.sheetWrapper}>
        <View style={styles.sheet}>
          <KeyboardAvoidingView
            behavior={Platform.select({ ios: 'padding', android: undefined })}
            style={{ flex: 1 }}
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={[
                styles.sheetScrollContent,
                { paddingBottom: Math.max(30, insets.bottom) },
              ]}
              showsVerticalScrollIndicator={false}
            >
              {message ? (
                <View
                  style={[
                    styles.messageBox,
                    message.type === 'error' ? styles.errorMessageBox : styles.infoMessageBox,
                  ]}
                >
                  <Text
                    style={[
                      styles.messageText,
                      message.type === 'error' ? styles.errorMessageText : styles.infoMessageText,
                    ]}
                  >
                    {message.text}
                  </Text>
                </View>
              ) : null}

              {mode === 'login' ? renderLogin() : null}
              {mode === 'register' ? renderRegister() : null}
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </View>
    </SafeAreaView>
  );
}

type LabeledInputProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  keyboardType?: 'default' | 'email-address';
  editable: boolean;
};

function LabeledInput({
  label,
  value,
  onChangeText,
  placeholder,
  autoCapitalize = 'sentences',
  keyboardType = 'default',
  editable,
}: LabeledInputProps) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#c4c4c4"
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        style={styles.inputField}
        editable={editable}
      />
    </View>
  );
}

type LabeledPasswordInputProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  visible: boolean;
  onToggleVisibility: () => void;
  editable: boolean;
};

function LabeledPasswordInput({
  label,
  value,
  onChangeText,
  placeholder,
  visible,
  onToggleVisibility,
  editable,
}: LabeledPasswordInputProps) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.passwordFieldContainer}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#c4c4c4"
          secureTextEntry={!visible}
          style={styles.passwordInput}
          editable={editable}
        />
        <Pressable
          onPress={onToggleVisibility}
          hitSlop={8}
          style={({ pressed }) => (pressed && editable ? styles.inlinePressed : null)}
        >
          <Image source={AUTH_ASSETS.eye} style={styles.passwordVisibilityIcon} />
        </Pressable>
      </View>
    </View>
  );
}

type SocialAuthSectionProps = {
  mode: 'login' | 'register';
  onPress: (provider: string) => void;
};

function SocialAuthSection({ onPress, mode }: SocialAuthSectionProps) {
  const dividerLabel = mode === 'register' ? 'Or register with' : 'Or login with';

  return (
    <View style={styles.socialSection}>
      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>{dividerLabel}</Text>
        <View style={styles.dividerLine} />
      </View>
      <View style={styles.socialButtonsRow}>
        <Pressable
          style={({ pressed }) => [
            styles.socialButton,
            pressed ? styles.socialButtonPressed : null,
          ]}
          onPress={() => onPress('Facebook')}
        >
          <Image source={AUTH_ASSETS.facebook} style={styles.socialIconFacebook} />
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.socialButton,
            pressed ? styles.socialButtonPressed : null,
          ]}
          onPress={() => onPress('Google')}
        >
          <Image source={AUTH_ASSETS.google} style={styles.socialIconGoogle} />
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.socialButton,
            pressed ? styles.socialButtonPressed : null,
          ]}
          onPress={() => onPress('Apple')}
        >
          <Image source={AUTH_ASSETS.apple} style={styles.socialIconApple} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  landingSafeArea: {
    flex: 1,
    backgroundColor: '#fff9e9',
  },
  landingScreen: {
    flex: 1,
    backgroundColor: '#fff9e9',
  },
  landingInner: {
    flex: 1,
    paddingHorizontal: 30,
    paddingTop: 62,
    zIndex: 2,
  },
  landingIllustration: {
    position: 'absolute',
    right: 0,
    bottom: -40,
    resizeMode: 'contain',
  },
  landingAseanBadge: {
    position: 'absolute',
    width: 45,
    height: 46,
    left: 24,
    bottom: 8,
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#cb403c',
  },
  topArea: {
    height: 170,
    paddingHorizontal: 17,
    paddingTop: 8,
    justifyContent: 'flex-start',
    overflow: 'hidden',
  },
  topAreaPatternImage: {
    position: 'absolute',
    top: 0,
    height: 200,
    bottom: 0,
    opacity: 0.3,
    resizeMode: 'cover',
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  backChevron: {
    color: '#ffffff',
    fontSize: 20,
    lineHeight: 22,
    fontFamily: 'Satoshi-Regular',
  },
  backText: {
    color: '#ffffff',
    fontSize: 16,
    lineHeight: 24,
    fontFamily: 'Satoshi-Medium',
  },
  inlinePressed: {
    opacity: 0.75,
    transform: [{ scale: 0.98 }],
  },
  sheetWrapper: {
    flex: 1,
  },
  sheet: {
    flex: 1,
    backgroundColor: '#fff9e9',
    borderTopLeftRadius: 35,
    borderTopRightRadius: 35,
    paddingHorizontal: 27,
    paddingTop: 34,
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
    elevation: 4,
  },
  sheetScrollContent: {
    paddingBottom: 30,
    gap: 16,
  },
  messageBox: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorMessageBox: {
    backgroundColor: '#fee2e2',
  },
  infoMessageBox: {
    backgroundColor: '#e0f2fe',
  },
  messageText: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Satoshi-Medium',
  },
  errorMessageText: {
    color: '#b91c1c',
  },
  infoMessageText: {
    color: '#0369a1',
  },
  landingContent: {
    gap: 34,
  },
  brandRow: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 0,
  },
  brandT: {
    fontSize: 92,
    color: '#060606',
    lineHeight: 108,
    letterSpacing: 1.85,
    fontFamily: 'PlayfairDisplay',
    fontWeight: '600',
  },
  brandAleka: {
    fontSize: 52,
    color: '#060606',
    lineHeight: 74,
    marginLeft: 1,
    marginBottom: 10,
    fontFamily: 'PlayfairDisplay',
    fontWeight: '600',
  },
  landingTextBlock: {
    gap: 8,
    paddingHorizontal: 6,
  },
  sheetTitle: {
    fontSize: 25,
    lineHeight: 30,
    textAlign: 'center',
    color: '#060606',
    fontFamily: 'Satoshi-Bold',
  },
  sheetSubtitle: {
    textAlign: 'center',
    color: '#999999',
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'Satoshi-Regular',
  },
  landingButton: {
    marginTop: 4,
    height: 31,
    borderRadius: 21,
    backgroundColor: '#cb403c',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 6,
  },
  landingButtonText: {
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 14,
    letterSpacing: 0.28,
    fontFamily: 'Satoshi-Regular',
  },
  formContent: {
    gap: 14,
  },
  headlineBlock: {
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  formTitle: {
    color: '#060606',
    fontSize: 24,
    lineHeight: 34,
    textAlign: 'center',
    fontFamily: 'Satoshi-Bold',
  },
  formSubtitle: {
    color: '#202938',
    fontSize: 14,
    lineHeight: 18,
    textAlign: 'center',
    fontFamily: 'Satoshi-Light',
  },
  bold: {
    fontFamily: 'Satoshi-Medium',
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    color: '#060606',
    fontSize: 12,
    lineHeight: 14,
    fontFamily: 'Satoshi-Medium',
  },
  inputField: {
    height: 43,
    borderRadius: 10,
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 12,
    fontSize: 12,
    lineHeight: 14,
    color: '#111828',
    fontFamily: 'Satoshi-Light',
  },
  passwordFieldContainer: {
    height: 43,
    borderRadius: 10,
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  passwordInput: {
    flex: 1,
    fontSize: 12,
    lineHeight: 14,
    color: '#111828',
    marginRight: 8,
    fontFamily: 'Satoshi-Light',
  },
  passwordVisibilityIcon: {
    width: 16,
    height: 16,
    tintColor: '#cccccc',
  },
  dropdownField: {
    height: 43,
    borderRadius: 10,
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownPlaceholder: {
    color: '#c4c4c4',
    fontSize: 12,
    lineHeight: 14,
    fontFamily: 'Satoshi-Light',
  },
  dropdownValue: {
    color: '#111828',
    fontSize: 12,
    lineHeight: 14,
    fontFamily: 'Satoshi-Light',
  },
  dropdownArrow: {
    color: '#b1b1b1',
    fontSize: 13,
  },
  dropdownMenu: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e4e4e4',
    overflow: 'hidden',
    backgroundColor: '#ffffff',
  },
  dropdownOption: {
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  dropdownOptionPressed: {
    backgroundColor: '#f5f5f5',
  },
  dropdownOptionText: {
    color: '#111828',
    fontSize: 13,
    fontFamily: 'Satoshi-Regular',
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: -2,
  },
  rememberToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#bebebe',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  checkboxChecked: {
    backgroundColor: '#cb403c',
    borderColor: '#cb403c',
  },
  checkboxTick: {
    color: '#ffffff',
    fontSize: 11,
    lineHeight: 12,
    fontFamily: 'Satoshi-Bold',
  },
  rememberText: {
    color: '#a9a9a9',
    fontSize: 11,
    lineHeight: 14,
    fontFamily: 'Satoshi-Medium',
  },
  linkText: {
    color: '#3788c6',
    fontSize: 13,
    lineHeight: 14,
    fontFamily: 'Satoshi-Medium',
  },
  mutedText: {
    color: '#bababa',
    fontSize: 13,
    lineHeight: 14,
    fontFamily: 'Satoshi-Regular',
  },
  primaryButton: {
    height: 39,
    borderRadius: 10,
    backgroundColor: '#cb403c',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  primaryButtonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 14,
    fontFamily: 'Satoshi-Medium',
  },
  socialSection: {
    gap: 11,
    marginTop: 8,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 15,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#bdbdbd',
    maxWidth: 82,
  },
  dividerText: {
    color: '#bababa',
    fontSize: 13,
    lineHeight: 14,
    fontFamily: 'Satoshi-Regular',
  },
  socialButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 15,
  },
  socialButton: {
    width: 80,
    height: 51,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialButtonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  socialIconFacebook: {
    width: 32,
    height: 32,
  },
  socialIconGoogle: {
    width: 31,
    height: 31,
  },
  socialIconApple: {
    width: 28,
    height: 28,
  },
  switchText: {
    textAlign: 'center',
    fontSize: 13,
    marginTop: 2,
    fontFamily: 'Poppins-Medium',
    lineHeight: 24,
  },
  linkPressed: {
    opacity: 0.7,
  },
});
