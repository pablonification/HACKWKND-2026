import { useEffect, useState } from 'react';

const MOBILE_BREAKPOINT = 768;

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < MOBILE_BREAKPOINT);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  return isMobile;
}

export function MobileGuard({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile();

  if (isMobile) return <>{children}</>;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100dvh',
        backgroundColor: '#fff9e9',
        padding: '2rem',
        fontFamily: 'Satoshi, Poppins, ui-sans-serif, system-ui, sans-serif',
        textAlign: 'center',
        gap: '0',
      }}
    >
      <img
        src="/assets/logo-final.png"
        alt="Taleka"
        style={{ width: 72, height: 72, objectFit: 'contain', marginBottom: '1.5rem' }}
      />

      <h1
        style={{
          fontSize: '1.5rem',
          fontWeight: 700,
          color: '#1a1a1a',
          margin: '0 0 0.5rem',
          letterSpacing: '-0.02em',
        }}
      >
        Taleka is built for mobile
      </h1>

      <p
        style={{
          fontSize: '1rem',
          color: '#555',
          margin: '0 0 2.5rem',
          maxWidth: 360,
          lineHeight: 1.6,
        }}
      >
        Open this page on your smartphone for the best experience.
      </p>

      <div
        style={{
          backgroundColor: '#fff',
          border: '1px solid #e5ddd0',
          borderRadius: 16,
          padding: '1.25rem 1.5rem',
          maxWidth: 380,
          width: '100%',
          textAlign: 'left',
        }}
      >
        <p
          style={{
            fontSize: '0.8rem',
            fontWeight: 600,
            color: '#2d6a4f',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            margin: '0 0 0.75rem',
          }}
        >
          On this device
        </p>
        <p style={{ fontSize: '0.9rem', color: '#444', margin: '0 0 0.75rem', lineHeight: 1.6 }}>
          Use your browser&apos;s <strong>Toggle device toolbar</strong> to emulate a mobile screen:
        </p>
        <ol
          style={{
            margin: 0,
            paddingLeft: '1.25rem',
            fontSize: '0.875rem',
            color: '#555',
            lineHeight: 1.8,
          }}
        >
          <li>
            Press <kbd style={kbdStyle}>F12</kbd> (or right-click → <em>Inspect</em>)
          </li>
          <li>
            Click the{' '}
            <strong style={{ color: '#1a1a1a' }}>
              <span style={{ fontSize: '1em' }}>⧉</span> Toggle device toolbar
            </strong>{' '}
            icon
          </li>
          <li>Select a phone preset (e.g. iPhone 12 Pro)</li>
          <li>Refresh the page</li>
        </ol>
      </div>
    </div>
  );
}

const kbdStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '1px 6px',
  fontSize: '0.8em',
  fontFamily: 'monospace',
  background: '#f0ebe3',
  border: '1px solid #d5cdc0',
  borderRadius: 4,
  color: '#1a1a1a',
};
