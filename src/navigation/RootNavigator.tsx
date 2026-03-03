import { NavigationContainer, type LinkingOptions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { Session } from '@supabase/supabase-js';

import { AuthScreen } from '../screens/AuthScreen';
import { HomeScreen } from '../screens/HomeScreen';

export type RootStackParamList = {
  Auth: undefined;
  Home: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['taleka://'],
  config: {
    screens: {
      Auth: 'auth',
      Home: 'home',
    },
  },
};

type RootNavigatorProps = {
  session: Session | null;
  onSignOut: () => Promise<void>;
};

export function RootNavigator({ session, onSignOut }: RootNavigatorProps) {
  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          animationDuration: 180,
        }}
      >
        {session ? (
          <Stack.Screen name="Home">
            {() => <HomeScreen session={session} onSignOut={onSignOut} />}
          </Stack.Screen>
        ) : (
          <Stack.Screen name="Auth" component={AuthScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
