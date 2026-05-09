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

export const DEFAULT_LEARNING_LANGUAGE: LearningLanguage = 'Semai';

export const resolveLearningLanguage = (value: string | null | undefined): LearningLanguage => {
  const matched = LEARNING_LANGUAGE_OPTIONS.find((language) => language === value);
  return matched ?? DEFAULT_LEARNING_LANGUAGE;
};
