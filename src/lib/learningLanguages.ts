import cambodiaFlag from '../../assets/flags/cambodia.svg';
import indonesiaFlag from '../../assets/flags/indonesia.svg';
import malaysiaFlag from '../../assets/flags/malaysia.svg';
import myanmarFlag from '../../assets/flags/myanmar.svg';
import philippinesFlag from '../../assets/flags/philippines.svg';
import singaporeFlag from '../../assets/flags/singapore.svg';
import thailandFlag from '../../assets/flags/thailand.svg';
import vietnamFlag from '../../assets/flags/vietnam.svg';

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

// Eagerly bundle all landing background images so Vite resolves them at build time.
const backgroundModules = import.meta.glob<string>('../../assets/landing/background/*.png', {
  eager: true,
  import: 'default',
});

function getLandingBackground(country: string, role: 'learner' | 'elder'): string {
  const key = `../../assets/landing/background/${country.toLowerCase()}-${role}.png`;
  return backgroundModules[key] ?? '';
}

export const LANGUAGE_BG: Record<LearningLanguage, { learner: string; elder: string }> = {
  Tandia: {
    learner: getLandingBackground('indonesia', 'learner'),
    elder: getLandingBackground('indonesia', 'elder'),
  },
  Semai: {
    learner: getLandingBackground('malaysia', 'learner'),
    elder: getLandingBackground('malaysia', 'elder'),
  },
  Mlabri: {
    learner: getLandingBackground('thailand', 'learner'),
    elder: getLandingBackground('thailand', 'elder'),
  },
  Chong: {
    learner: getLandingBackground('cambodia', 'learner'),
    elder: getLandingBackground('cambodia', 'elder'),
  },
  Arta: {
    learner: getLandingBackground('philippines', 'learner'),
    elder: getLandingBackground('philippines', 'elder'),
  },
  Arem: {
    learner: getLandingBackground('vietnam', 'learner'),
    elder: getLandingBackground('vietnam', 'elder'),
  },
  Kristang: {
    learner: getLandingBackground('singapore', 'learner'),
    elder: getLandingBackground('singapore', 'elder'),
  },
  Moken: {
    learner: getLandingBackground('myanmar', 'learner'),
    elder: getLandingBackground('myanmar', 'elder'),
  },
};

export const DEFAULT_LEARNING_LANGUAGE: LearningLanguage = 'Semai';

export type LearningLanguageMetadata = {
  language: LearningLanguage;
  country: string;
  flagSrc: string;
};

export const LEARNING_LANGUAGE_METADATA: Record<LearningLanguage, LearningLanguageMetadata> = {
  Tandia: { language: 'Tandia', country: 'Indonesia', flagSrc: indonesiaFlag },
  Semai: { language: 'Semai', country: 'Malaysia', flagSrc: malaysiaFlag },
  Mlabri: { language: 'Mlabri', country: 'Thailand', flagSrc: thailandFlag },
  Chong: { language: 'Chong', country: 'Cambodia', flagSrc: cambodiaFlag },
  Arta: { language: 'Arta', country: 'Philippines', flagSrc: philippinesFlag },
  Arem: { language: 'Arem', country: 'Vietnam', flagSrc: vietnamFlag },
  Kristang: { language: 'Kristang', country: 'Singapore', flagSrc: singaporeFlag },
  Moken: { language: 'Moken', country: 'Myanmar', flagSrc: myanmarFlag },
};

export const resolveLearningLanguage = (value: string | null | undefined): LearningLanguage => {
  const matched = LEARNING_LANGUAGE_OPTIONS.find((language) => language === value);
  return matched ?? DEFAULT_LEARNING_LANGUAGE;
};

export const getLearningLanguageMetadata = (
  value: string | null | undefined,
): LearningLanguageMetadata => LEARNING_LANGUAGE_METADATA[resolveLearningLanguage(value)];
