/**
 * Vocab Master data — loads Semai vocabulary from Supabase and returns a shuffled deck.
 */

import { supabase } from './supabase';

export interface VocabCard {
  /** Supabase words.id — real UUID from the DB */
  word_id: string | null;
  word: string;
  definition_en: string;
  definition_ms: string;
  example_semai: string;
  example_en: string;
}

/** How many rows to pull from Supabase per session (large pool to shuffle from). */
const POOL_SIZE = 300;

let cachedPool: VocabCard[] | null = null;

type RawEntry = {
  word: string;
  senses: { definition_en?: string; examples?: { semai?: string; en?: string }[] }[];
};

/** Build a map of semai_word → first example sentence from the local JSON (cheap, one-time). */
async function loadExampleMap(): Promise<Map<string, { semai: string; en: string }>> {
  try {
    const url = new URL('../../docs/plan/source/webonary-semai-parsed.json', import.meta.url).href;
    const res = await fetch(url);
    const raw: RawEntry[] = await res.json();
    const map = new Map<string, { semai: string; en: string }>();
    for (const entry of raw) {
      if (!entry.word) continue;
      for (const sense of entry.senses ?? []) {
        const ex = sense.examples?.[0];
        if (ex?.semai?.trim()) {
          map.set(entry.word.toLowerCase(), { semai: ex.semai.trim(), en: ex.en?.trim() ?? '' });
          break;
        }
      }
    }
    return map;
  } catch {
    return new Map();
  }
}

async function loadPool(): Promise<VocabCard[]> {
  if (cachedPool) return cachedPool;

  // Random offset so each session draws a different slice of the 3 k+ word pool.
  const totalRows = 3304;
  const maxOffset = Math.max(0, totalRows - POOL_SIZE);
  const offset = Math.floor(Math.random() * maxOffset);

  const [supabaseResult, exampleMap] = await Promise.all([
    supabase
      .from('words')
      .select('id, semai_word, english_translation, malay_translation')
      .not('english_translation', 'is', null)
      .range(offset, offset + POOL_SIZE - 1),
    loadExampleMap(),
  ]);

  const { data, error } = supabaseResult;

  if (error || !data) {
    console.error('[vocabData] Failed to load pool from Supabase:', error?.message);
    return [];
  }

  const pool: VocabCard[] = data
    .filter((row) => row.semai_word && row.english_translation)
    .map((row) => {
      const ex = exampleMap.get((row.semai_word as string).toLowerCase());
      return {
        word_id: row.id as string,
        word: row.semai_word as string,
        definition_en: (row.english_translation as string).trim(),
        definition_ms: ((row.malay_translation as string | null) ?? '').trim(),
        example_semai: ex?.semai ?? '',
        example_en: ex?.en ?? '',
      };
    });

  cachedPool = pool;
  return pool;
}

/** Force a fresh fetch on the next generateDeck call (e.g. after a topic unlock). */
export function invalidateVocabCache(): void {
  cachedPool = null;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function generateDeck(count = 5): Promise<VocabCard[]> {
  const pool = await loadPool();
  const filtered = pool.filter((w) => w.word.length <= 20 && w.definition_en.length <= 80);
  return shuffle(filtered).slice(0, count);
}
