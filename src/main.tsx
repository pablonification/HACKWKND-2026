import React from 'react';
import { createRoot } from 'react-dom/client';
import { setupIonicReact } from '@ionic/react';

import App from './App';
import { MobileGuard } from './components/MobileGuard';
import './index.css';

setupIonicReact({ mode: 'ios' });

const container = document.getElementById('root');
if (!container) throw new Error('Root element not found');

createRoot(container).render(
  <React.StrictMode>
    <MobileGuard>
      <App />
    </MobileGuard>
  </React.StrictMode>,
);
