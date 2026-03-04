import React from 'react';
import { createRoot } from 'react-dom/client';
import { setupIonicReact } from '@ionic/react';

import App from './App';
import { supabaseConfigError } from './lib/supabase';
import './index.css';

setupIonicReact({ mode: 'ios' });

if (supabaseConfigError) {
  throw new Error(supabaseConfigError);
}

const container = document.getElementById('root');
if (!container) throw new Error('Root element not found');

createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
