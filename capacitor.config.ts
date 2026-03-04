import type { CapacitorConfig } from '@capacitor/cli';

const isDev = process.env.CAPACITOR_DEV === 'true';
const devServerUrl = process.env.CAPACITOR_DEV_SERVER_URL;

const config: CapacitorConfig = {
  appId: 'com.tuyang.app',
  appName: 'Tuyang',
  webDir: 'dist',
  ...(isDev && devServerUrl
    ? {
        server: {
          // Run with: CAPACITOR_DEV=true CAPACITOR_DEV_SERVER_URL=http://<your-local-ip>:5173 npm run cap:ios:dev
          url: devServerUrl,
          cleartext: true,
        },
      }
    : {}),
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
    },
  },
};

export default config;
