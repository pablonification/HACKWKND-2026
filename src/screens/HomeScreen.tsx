import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Session } from '@supabase/supabase-js';

import { PrimaryButton } from '../components/PrimaryButton';

type HomeScreenProps = {
  session: Session;
  onSignOut: () => Promise<void>;
};

export function HomeScreen({ session, onSignOut }: HomeScreenProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    setErrorMessage(null);
    setIsSigningOut(true);

    try {
      await onSignOut();
    } catch {
      setErrorMessage('Unable to sign out right now. Please try again.');
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome</Text>
      <Text style={styles.subtitle}>{session.user.email ?? 'Authenticated user'}</Text>
      <Text style={styles.body}>
        Auth scaffolding is ready. Next modules can now build on this session state.
      </Text>
      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
      <PrimaryButton
        label={isSigningOut ? 'Signing out...' : 'Sign Out'}
        onPress={handleSignOut}
        disabled={isSigningOut}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 14,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1d4ed8',
  },
  body: {
    textAlign: 'center',
    color: '#334155',
    lineHeight: 22,
    fontSize: 15,
  },
  error: {
    color: '#b91c1c',
    fontSize: 14,
  },
});
