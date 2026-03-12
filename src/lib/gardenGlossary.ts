import { WEBONARY_GLOSSARY } from '../../supabase/functions/_shared/webonaryGlossary.generated.ts';

export interface GardenGlossaryWord {
  word_id: string | null;
  word: string;
  definition_en: string;
  definition_ms: string;
}

let cachedGardenGlossaryWords: GardenGlossaryWord[] | null = null;

export function loadGardenGlossaryWords(): GardenGlossaryWord[] {
  if (cachedGardenGlossaryWords) {
    return cachedGardenGlossaryWords;
  }

  cachedGardenGlossaryWords = WEBONARY_GLOSSARY.filter(
    (entry) => entry.semai.trim().length > 0 && entry.en.trim().length > 0,
  ).map((entry) => ({
    word_id: null,
    word: entry.semai.trim(),
    definition_en: entry.en.trim(),
    definition_ms: entry.ms.trim(),
  }));

  return cachedGardenGlossaryWords;
}
