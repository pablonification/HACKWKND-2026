import { useEffect } from 'react';
import splashFooter from '../../../assets/splash/generated-splash-footer.png';
import splashLogo from '../../../assets/splash/figma-splash-logo.png';
import './AppSplashScreen.css';

type AppSplashScreenProps = {
  exiting?: boolean;
};

export function AppSplashScreen({ exiting = false }: AppSplashScreenProps) {
  useEffect(() => {
    const el = document.getElementById('splash-preload');
    if (el) el.remove();
  }, []);

  return (
    <div
      className={['app-splash-screen', exiting && 'app-splash-screen--exiting']
        .filter(Boolean)
        .join(' ')}
      aria-label="Loading Taleka"
    >
      <div className="app-splash-scene">
        <img className="app-splash-logo" src={splashLogo} alt="" aria-hidden="true" />
        <img className="app-splash-footer" src={splashFooter} alt="" aria-hidden="true" />
      </div>
    </div>
  );
}
