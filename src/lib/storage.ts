import AsyncStorage from '@react-native-async-storage/async-storage';

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
  await AsyncStorage.setItem(key, JSON.stringify(value));
};

export const getJSON = async <T>(key: string, fallback: T): Promise<T> => {
  const rawValue = await AsyncStorage.getItem(key);

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
  await AsyncStorage.setItem(key, value ? 'true' : 'false');
};

export const getBoolean = async (key: string, fallback = false): Promise<boolean> => {
  const rawValue = await AsyncStorage.getItem(key);

  if (rawValue === null) {
    return fallback;
  }

  return rawValue === 'true';
};
