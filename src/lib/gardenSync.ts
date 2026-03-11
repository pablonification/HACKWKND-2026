/**
 * Garden / Vocab Master — Supabase sync helpers.
 *
 * Called fire-and-forget from VocabMaster so the UI never blocks on network.
 * All functions silently swallow errors (offline-safe).
 */

import { deriveProfileProgress } from '../utils/profileProgress';
import { supabase } from './supabase';

// ─── Level thresholds (must match profileProgress.ts) ────────────────────────
// XP formula for learners: wordsLearned * 4
// Sprout starts at XP 500  → wordsLearned >= 125
// Sapling starts at XP 1200 → wordsLearned >= 300
// Tree maps to "Sapling" level (level index 2) in the user's journey
export type GameLevelName = 'sprout' | 'sapling' | 'tree';

/** Resolve the LevelUpPage level name from a learner's wordsLearned count. */
export function resolveLevelName(wordsLearned: number): GameLevelName | null {
  if (wordsLearned >= 300) return 'tree';
  if (wordsLearned >= 125) return 'sapling';
  if (wordsLearned >= 1) return 'sprout';
  return null;
}

export interface UserLevelInfo {
  levelName: GameLevelName | null;
  /** e.g. "Lv. Sprout" */
  label: string;
  /** 0–100 */
  percentToNext: number;
  wordsLearned: number;
}

/**
 * Fetch the current learner's words-learned count and derived level info.
 * Returns a sensible default when unauthenticated or offline.
 */
export async function fetchUserLevelInfo(): Promise<UserLevelInfo> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { levelName: null, label: 'Lv. Seed', percentToNext: 0, wordsLearned: 0 };

    const { count } = await supabase
      .from('progress')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gt('mastery_level', 0);

    const wordsLearned = count ?? 0;
    const progress = deriveProfileProgress({
      role: 'learner',
      wordsLearned,
      storiesCompleted: 0,
      storiesShared: 0,
      followerCount: 0,
    });

    return {
      levelName: resolveLevelName(wordsLearned),
      label: progress.label,
      percentToNext: progress.percentToNextLevel,
      wordsLearned,
    };
  } catch {
    return { levelName: null, label: 'Lv. Seed', percentToNext: 0, wordsLearned: 0 };
  }
}

// ─── Spaced repetition intervals (days) ──────────────────────────────────────
// mastery 0→1: next review in 1 day
// mastery 1→2: 3 days, 2→3: 7d, 3→4: 14d, 4→5: 30d, 5: no review needed
const SRS_INTERVALS_DAYS = [1, 3, 7, 14, 30];

function nextReviewAt(masteryLevel: number): string | null {
  if (masteryLevel >= 5) return null; // fully mastered
  const days = SRS_INTERVALS_DAYS[Math.min(masteryLevel, SRS_INTERVALS_DAYS.length - 1)];
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

// ─── Record a single swipe result ────────────────────────────────────────────

export interface SwipeResult {
  /** Supabase words.id — null when card came from local JSON (no DB row yet) */
  wordId: string | null;
  /** true = swiped right ("know it"), false = swiped left or timed out */
  known: boolean;
}

/**
 * Upsert a progress row for the reviewed word.
 * - known: mastery_level++ (max 5)
 * - unknown/timeout: mastery_level resets to 0
 */
// UUID v4 pattern — rejects malformed ids like "g982634fb-..." from the local JSON
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function recordSwipe(result: SwipeResult): Promise<void> {
  if (!result.wordId || !UUID_RE.test(result.wordId)) return; // local-only or malformed id

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // Fetch existing mastery level (if any)
  const { data: existing } = await supabase
    .from('progress')
    .select('id, mastery_level')
    .eq('user_id', user.id)
    .eq('word_id', result.wordId)
    .maybeSingle();

  const currentMastery = existing?.mastery_level ?? 0;
  const newMastery = result.known ? Math.min(currentMastery + 1, 5) : 0;

  await supabase.from('progress').upsert(
    {
      ...(existing?.id ? { id: existing.id } : {}),
      user_id: user.id,
      word_id: result.wordId,
      mastery_level: newMastery,
      last_reviewed_at: new Date().toISOString(),
      next_review_at: nextReviewAt(newMastery),
    },
    { onConflict: 'user_id,word_id' },
  );
}

// ─── Update streak at session end ────────────────────────────────────────────

/**
 * Upsert the user's streak after completing a vocab session.
 * - Same calendar day: no change (already counted today)
 * - Next day: streak++ and update longest if needed
 * - Gap > 1 day: streak resets to 1
 */
export async function updateStreak(): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const today = new Date().toLocaleDateString('en-CA'); // 'YYYY-MM-DD' in local timezone

  const { data: existing } = await supabase
    .from('streaks')
    .select('id, current_streak, longest_streak, last_activity_date')
    .eq('user_id', user.id)
    .maybeSingle();

  // Already updated today — skip
  if (existing?.last_activity_date === today) return;

  const lastDate = existing?.last_activity_date;
  const isConsecutive =
    lastDate != null &&
    (() => {
      const last = new Date(lastDate);
      const now = new Date(today);
      const diffDays = Math.round((now.getTime() - last.getTime()) / 86_400_000);
      return diffDays === 1;
    })();

  const newStreak = isConsecutive ? (existing?.current_streak ?? 0) + 1 : 1;
  const newLongest = Math.max(existing?.longest_streak ?? 0, newStreak);

  await supabase.from('streaks').upsert(
    {
      ...(existing?.id ? { id: existing.id } : {}),
      user_id: user.id,
      current_streak: newStreak,
      longest_streak: newLongest,
      last_activity_date: today,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );
}
