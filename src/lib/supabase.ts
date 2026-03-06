import { createClient } from '@supabase/supabase-js';

import type { Database } from '../types/database';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseConfigError =
  !supabaseUrl || !supabaseAnonKey
    ? 'Supabase misconfigured: missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variable(s).'
    : null;

if (supabaseConfigError) {
  console.error(supabaseConfigError);
}

const fallbackSupabaseUrl = 'https://example.supabase.co';
const fallbackSupabaseAnonKey = 'missing-supabase-anon-key';

export const isSupabaseConfigured = !supabaseConfigError;
const supabasePublicUrl = supabaseUrl ?? fallbackSupabaseUrl;
export const supabasePublicAnonKey = supabaseAnonKey ?? fallbackSupabaseAnonKey;

export const supabase = createClient<Database>(supabasePublicUrl, supabasePublicAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    // Use URL hash for OAuth/magic-link flows in the browser
    detectSessionInUrl: true,
  },
});
