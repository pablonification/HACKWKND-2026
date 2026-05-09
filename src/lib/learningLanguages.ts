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
