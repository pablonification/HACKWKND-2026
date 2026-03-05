import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';

type AuthState = {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  isRecoverySession: boolean;
  setSession: (session: Session | null) => void;
  setLoading: (loading: boolean) => void;
  setRecoverySession: (isRecovery: boolean) => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  isLoading: true,
  isRecoverySession: false,
  setSession: (session) => set({ session, user: session?.user ?? null }),
  setLoading: (isLoading) => set({ isLoading }),
  setRecoverySession: (isRecoverySession) => set({ isRecoverySession }),
}));
