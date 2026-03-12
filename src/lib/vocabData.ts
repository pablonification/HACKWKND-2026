/**
 * Vocab Master data — loads Semai vocabulary from Supabase and returns a shuffled deck.
 */

import { supabase } from './supabase';
import { loadGardenGlossaryWords } from './gardenGlossary';

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

async function loadPool(): Promise<VocabCard[]> {
  if (cachedPool) return cachedPool;

  try {
    // Query the actual row count so the random offset never exceeds the table size.
    const { count } = await supabase
      .from('words')
      .select('id', { count: 'exact', head: true })
      .not('english_translation', 'is', null);
    const totalRows = count ?? POOL_SIZE;
    const maxOffset = Math.max(0, totalRows - POOL_SIZE);
    const offset = Math.floor(Math.random() * (maxOffset + 1));

    const { data, error } = await supabase
      .from('words')
      .select('id, semai_word, english_translation, malay_translation')
      .not('english_translation', 'is', null)
      .range(offset, offset + POOL_SIZE - 1);

    if (error) {
      throw error;
    }

    const pool: VocabCard[] = (data ?? [])
      .filter((row) => row.semai_word && row.english_translation)
      .map((row) => ({
        word_id: row.id as string,
        word: row.semai_word as string,
        definition_en: (row.english_translation as string).trim(),
        definition_ms: ((row.malay_translation as string | null) ?? '').trim(),
        example_semai: '',
        example_en: '',
      }));

    if (pool.length > 0) {
      cachedPool = pool;
      return pool;
    }
  } catch (error) {
    console.warn('[vocabData] Falling back to bundled glossary:', error);
  }

  const pool = loadGardenGlossaryWords().map((row) => ({
    ...row,
    example_semai: '',
    example_en: '',
  }));
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
