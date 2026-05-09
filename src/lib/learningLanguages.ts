export const LEARNING_LANGUAGE_OPTIONS = [
  'Tandia',
  'Semai',
  'Mlabri',
  'Chong',
  'Arta',
  'Arem',
  'Kristang',
  'Moken',
] as const;

export type LearningLanguage = (typeof LEARNING_LANGUAGE_OPTIONS)[number];

export const LANGUAGE_COUNTRY: Record<LearningLanguage, string> = {
  Tandia: 'Indonesia',
  Semai: 'Malaysia',
  Mlabri: 'Thailand',
  Chong: 'Cambodia',
  Arta: 'Philippines',
  Arem: 'Vietnam',
  Kristang: 'Singapore',
  Moken: 'Myanmar',
};

// Eagerly bundle all background images so Vite resolves them at build time
const _bgModules = import.meta.glob<string>('../../assets/landing/background/*.png', {
  eager: true,
  import: 'default',
});

function _bg(country: string, role: 'learner' | 'elder'): string {
  const key = `../../assets/landing/background/${country.toLowerCase()}-${role}.png`;
  return _bgModules[key] ?? '';
}

export const LANGUAGE_BG: Record<LearningLanguage, { learner: string; elder: string }> = {
  Tandia: { learner: _bg('indonesia', 'learner'), elder: _bg('indonesia', 'elder') },
  Semai: { learner: _bg('malaysia', 'learner'), elder: _bg('malaysia', 'elder') },
  Mlabri: { learner: _bg('thailand', 'learner'), elder: _bg('thailand', 'elder') },
  Chong: { learner: _bg('cambodia', 'learner'), elder: _bg('cambodia', 'elder') },
  Arta: { learner: _bg('philippines', 'learner'), elder: _bg('philippines', 'elder') },
  Arem: { learner: _bg('vietnam', 'learner'), elder: _bg('vietnam', 'elder') },
  Kristang: { learner: _bg('singapore', 'learner'), elder: _bg('singapore', 'elder') },
  Moken: { learner: _bg('myanmar', 'learner'), elder: _bg('myanmar', 'elder') },
};

export const DEFAULT_LEARNING_LANGUAGE: LearningLanguage = 'Semai';

export const resolveLearningLanguage = (value: string | null | undefined): LearningLanguage => {
  const matched = LEARNING_LANGUAGE_OPTIONS.find((language) => language === value);
  return matched ?? DEFAULT_LEARNING_LANGUAGE;
};
