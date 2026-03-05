import { Preferences } from '@capacitor/preferences';

export const STORAGE_KEYS = {
  RECORDINGS: 'recordings',
  WORDS: 'words',
  PROGRESS: 'progress',
  PROFILE: 'profile',
  DOWNLOADED_AUDIO: 'downloaded',
  PENDING_SYNC: 'pending-sync',
  SETTINGS: 'settings',
  STREAK: 'streak',
  AUTH_TRANSIENT_SESSION: 'auth-transient-session',
} as const;

export const setJSON = async (key: string, value: unknown): Promise<void> => {
  await Preferences.set({ key, value: JSON.stringify(value) });
};

export const getJSON = async <T>(key: string, fallback: T): Promise<T> => {
  const { value: rawValue } = await Preferences.get({ key });

  if (!rawValue) {
    return fallback;
  }

  try {
    return JSON.parse(rawValue) as T;
  } catch {
    return fallback;
  }
};

export const setBoolean = async (key: string, value: boolean): Promise<void> => {
  await Preferences.set({ key, value: value ? 'true' : 'false' });
};

export const getBoolean = async (key: string, fallback = false): Promise<boolean> => {
  const { value: rawValue } = await Preferences.get({ key });

  if (rawValue === null) {
    return fallback;
  }

  return rawValue === 'true';
};

export const removeKey = async (key: string): Promise<void> => {
  await Preferences.remove({ key });
};
