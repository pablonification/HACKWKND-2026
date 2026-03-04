import { createClient } from '@supabase/supabase-js';

import type { Database } from '../types/database';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseConfigError =
  !supabaseUrl || !supabaseAnonKey ? 'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY' : null;

export const supabase = createClient<Database>(
  supabaseUrl ?? 'https://example.supabase.co',
  supabaseAnonKey ?? 'public-anon-key',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      // Use URL hash for OAuth/magic-link flows in the browser
      detectSessionInUrl: true,
    },
  },
);
