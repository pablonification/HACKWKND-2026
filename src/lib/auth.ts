import type { AuthResponse, User } from '@supabase/supabase-js';

import type { Database } from '../types/database';
import type { AuthRole } from '../utils/authValidation';
import { supabase } from './supabase';

type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];

type SignInPayload = {
  email: string;
  password: string;
};

type SignUpPayload = {
  fullName: string;
  email: string;
  password: string;
  role: AuthRole;
};

const toRole = (value: unknown): AuthRole | null => {
  if (value === 'learner' || value === 'elder') {
    return value;
  }

  return null;
};

const toName = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const toUsername = (email: string | null): string | null => {
  if (!email) {
    return null;
  }

  const [localPart] = email.split('@');
  return localPart ? localPart.slice(0, 32) : null;
};

const upsertProfile = async ({
  userId,
  email,
  fullName,
  role,
}: {
  userId: string;
  email: string | null;
  fullName: string | null;
  role: AuthRole | null;
}) => {
  const profilePayload: ProfileInsert = {
    id: userId,
    email,
    full_name: fullName,
    username: toUsername(email),
    role: role ?? 'learner',
  };

  const { error } = await supabase.from('profiles').upsert(profilePayload, { onConflict: 'id' });

  if (error) {
    throw error;
  }
};

const syncProfileFromUser = async (user: User | null) => {
  if (!user) {
    return;
  }

  const metadata = user.user_metadata as Record<string, unknown> | null;
  const fullName = toName(metadata?.full_name);
  const role = toRole(metadata?.role);

  await upsertProfile({
    userId: user.id,
    email: user.email ?? null,
    fullName,
    role,
  });
};

export const signInWithEmail = async ({
  email,
  password,
}: SignInPayload): Promise<AuthResponse> => {
  const authResponse = await supabase.auth.signInWithPassword({ email, password });

  if (authResponse.error) {
    throw authResponse.error;
  }

  try {
    await syncProfileFromUser(authResponse.data.user);
  } catch {
    // Profile sync should not block successful sign-in.
  }

  return authResponse;
};

export const signUpWithEmail = async ({
  fullName,
  email,
  password,
  role,
}: SignUpPayload): Promise<AuthResponse> => {
  const authResponse = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        role,
      },
    },
  });

  if (authResponse.error) {
    throw authResponse.error;
  }

  if (authResponse.data.session && authResponse.data.user) {
    try {
      await upsertProfile({
        userId: authResponse.data.user.id,
        email: authResponse.data.user.email ?? null,
        fullName,
        role,
      });
    } catch {
      // If profile policy/migration is not ready yet, auth should still succeed.
    }
  }

  return authResponse;
};

export const requestPasswordReset = async (email: string) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email);

  if (error) {
    throw error;
  }
};
