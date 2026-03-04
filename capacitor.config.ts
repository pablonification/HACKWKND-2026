import type { CapacitorConfig } from '@capacitor/cli';

const isDev = process.env.CAPACITOR_DEV === 'true';

const config: CapacitorConfig = {
  appId: 'com.tuyang.app',
  appName: 'Tuyang',
  webDir: 'dist',
  ...(isDev && {
    server: {
      // Point the native shell to your local Vite dev server for live reload.
      // IMPORTANT: replace the IP below with your own machine's local IP.
      // Find it with: ipconfig getifaddr en0  (Mac) or hostname -I (Linux)
      // Run with: CAPACITOR_DEV=true npm run cap:ios:dev
      url: 'http://10.5.35.140:5173',
      cleartext: true,
    },
  }),
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
    },
  },
};

export default config;
