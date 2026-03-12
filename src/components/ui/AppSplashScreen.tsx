import { useEffect, useState } from 'react';
import { TalekaWordmark } from './TalekaWordmark';
import './AppSplashScreen.css';

type AppSplashScreenProps = {
  exiting?: boolean;
};

export function AppSplashScreen({ exiting = false }: AppSplashScreenProps) {
  const [revealStarted, setRevealStarted] = useState(false);

  // Remove the HTML preload overlay now that the React splash is mounted.
  // The preload div in index.html prevents cream flash on iOS between
  // native splash dismissal and this component's first render.
  useEffect(() => {
    const el = document.getElementById('splash-preload');
    if (el) el.remove();
  }, []);

  useEffect(() => {
    let timeoutId: number | null = null;
    let rafA = 0;
    let rafB = 0;

    rafA = window.requestAnimationFrame(() => {
      rafB = window.requestAnimationFrame(() => {
        timeoutId = window.setTimeout(() => setRevealStarted(true), 120);
      });
    });

    return () => {
      window.cancelAnimationFrame(rafA);
      window.cancelAnimationFrame(rafB);
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };
  }, []);

  return (
    <div
      className={['app-splash-screen', exiting && 'app-splash-screen--exiting']
        .filter(Boolean)
        .join(' ')}
      aria-label="Loading Taleka"
    >
      {/* Wordmark — ZERO animation on text. Always rendered with
          final color so the Playfair "T" glyph is never distorted. */}
      <div className="app-splash-center">
        <TalekaWordmark className="app-splash-wordmark" />
      </div>

      {/* Cream overlay that fades out to reveal the wordmark.
          This element gets GPU-composited, but the text underneath
          stays CPU-rendered with correct glyph shapes. */}
      <div
        className={['app-splash-reveal', revealStarted && 'app-splash-reveal--running']
          .filter(Boolean)
          .join(' ')}
        aria-hidden="true"
      />
    </div>
  );
}
