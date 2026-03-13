import type { CapacitorConfig } from '@capacitor/cli';

const isDev = process.env.CAPACITOR_DEV === 'true';
const devServerUrl = process.env.CAPACITOR_DEV_SERVER_URL;

const config: CapacitorConfig = {
  appId: 'com.taleka.app',
  appName: 'Taleka',
  webDir: 'dist',
  backgroundColor: '#fff9e9',
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
      backgroundColor: '#fff9e9',
      launchAutoHide: false,
      showSpinner: false,
    },
  },
};

export default config;
