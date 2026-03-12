/**
 * useUserLevel — React hook that fetches & refreshes the current user's level info.
 *
 * Returns { label, percentToNext, levelName, wordsLearned } and exposes a
 * `refresh()` function so callers can re-fetch after completing a round.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchUserLevelInfo, type GameLevelName, type UserLevelInfo } from './gardenSync';

const DEFAULT: UserLevelInfo = {
  levelName: null,
  label: 'Lv. Seed',
  percentToNext: 0,
  wordsLearned: 0,
};

export function useUserLevel() {
  const [info, setInfo] = useState<UserLevelInfo>(DEFAULT);
  const prevLevelRef = useRef<GameLevelName | null>(null);

  const refresh = useCallback(async (): Promise<GameLevelName | null> => {
    const next = await fetchUserLevelInfo();
    const prev = prevLevelRef.current;
    prevLevelRef.current = next.levelName;
    setInfo(next);
    // Return the newly reached level only if it changed upward
    if (next.levelName && prev !== null && next.levelName !== prev) {
      return next.levelName;
    }
    return null;
  }, []);

  useEffect(() => {
    void fetchUserLevelInfo().then((data) => {
      prevLevelRef.current = data.levelName;
      setInfo(data);
    });
  }, []);

  return { ...info, refresh };
}
