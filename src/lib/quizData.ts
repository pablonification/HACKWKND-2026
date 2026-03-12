/**
 * Quiz data utilities — loads Semai vocabulary from Supabase
 * and generates randomised multiple-choice questions.
 */

import { supabase } from './supabase';
import { loadGardenGlossaryWords } from './gardenGlossary';

export interface QuizWord {
  word_id: string | null;
  word: string;
  definition_en: string;
  definition_ms: string;
}

export interface QuizQuestion {
  word_id: string | null;
  semai: string;
  correctAnswer: string;
  choices: string[];
  explanation: string;
}

/** How many rows to pull from Supabase per session. */
const POOL_SIZE = 300;

let cachedPool: QuizWord[] | null = null;

async function loadPool(): Promise<QuizWord[]> {
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

    const pool: QuizWord[] = (data ?? [])
      .filter((row) => row.semai_word && row.english_translation)
      .map((row) => ({
        word_id: row.id as string,
        word: row.semai_word as string,
        definition_en: (row.english_translation as string).trim(),
        definition_ms: ((row.malay_translation as string | null) ?? '').trim(),
      }));

    if (pool.length > 0) {
      cachedPool = pool;
      return pool;
    }
  } catch (error) {
    console.warn('[quizData] Falling back to bundled glossary:', error);
  }

  const pool: QuizWord[] = loadGardenGlossaryWords();
  cachedPool = pool;
  return pool;
}

/** Force a fresh fetch on the next generateQuestions call (e.g. after a topic unlock). */
export function invalidateQuizCache(): void {
  cachedPool = null;
}

/** Fisher-Yates in-place shuffle */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Generate `count` quiz questions from the vocabulary pool.
 * Each question has 4 choices (1 correct + 3 distractors).
 */
export async function generateQuestions(count = 5): Promise<QuizQuestion[]> {
  const pool = await loadPool();

  // Filter to entries with short, readable English definitions
  const filtered = pool.filter(
    (w) => w.definition_en.length <= 60 && !w.definition_en.includes(';'), // avoid compound definitions
  );

  const selected = shuffle([...filtered]).slice(0, count);
  const questions: QuizQuestion[] = [];

  for (const item of selected) {
    const correct = item.definition_en;

    // Pick 3 unique distractors that aren't the correct answer
    const distractors = shuffle(filtered.filter((w) => w.definition_en !== correct))
      .slice(0, 3)
      .map((w) => w.definition_en);

    const choices = shuffle([correct, ...distractors]);

    questions.push({
      word_id: item.word_id,
      semai: item.word,
      correctAnswer: correct,
      choices,
      explanation: `"${item.word}" in Semai means "${correct}".${item.definition_ms ? ` (${item.definition_ms})` : ''}`,
    });
  }

  return questions;
}
