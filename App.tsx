import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { useFonts } from 'expo-font';

import { RootNavigator } from './src/navigation/RootNavigator';
import { getBoolean, setBoolean, STORAGE_KEYS } from './src/lib/storage';
import { supabase, supabaseConfigError } from './src/lib/supabase';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fontsLoaded, fontsError] = useFonts({
    'Satoshi-Light': require('./assets/fonts/Satoshi-Light.ttf'),
    'Satoshi-Regular': require('./assets/fonts/Satoshi-Regular.ttf'),
    'Satoshi-Medium': require('./assets/fonts/Satoshi-Medium.ttf'),
    'Satoshi-Bold': require('./assets/fonts/Satoshi-Bold.ttf'),
    'Poppins-Regular': require('./assets/fonts/Poppins-Regular.ttf'),
    'Poppins-Medium': require('./assets/fonts/Poppins-Medium.ttf'),
    PlayfairDisplay: require('./assets/fonts/PlayfairDisplay-Variable.ttf'),
  });

  if (fontsError) {
    throw fontsError;
  }

  useEffect(() => {
    let isMounted = true;

    const getSession = async () => {
      const { data } = await supabase.auth.getSession();
      let nextSession = data.session;

      const shouldUseTransientSession = await getBoolean(
        STORAGE_KEYS.AUTH_TRANSIENT_SESSION,
        false,
      );

      if (nextSession && shouldUseTransientSession) {
        await supabase.auth.signOut();
        await setBoolean(STORAGE_KEYS.AUTH_TRANSIENT_SESSION, false);
        nextSession = null;
      }

      if (isMounted) {
        setSession(nextSession);
        setIsLoading(false);
      }
    };

    getSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  if (supabaseConfigError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Supabase setup required</Text>
        <Text style={styles.body}>
          Create a `.env` file from `.env.example` and add your Supabase URL and anon key.
        </Text>
      </View>
    );
  }

  if (isLoading || !fontsLoaded) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1d4ed8" />
        <Text style={styles.body}>{fontsLoaded ? 'Loading session...' : 'Loading assets...'}</Text>
      </View>
    );
  }

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw error;
    }
  };

  return <RootNavigator session={session} onSignOut={handleSignOut} />;
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 24,
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
  },
  body: {
    color: '#334155',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
});
