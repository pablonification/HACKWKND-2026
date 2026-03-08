export const MALAY_HINT_TOKENS = [
  'saya',
  'mahu',
  'ingin',
  'ajar',
  'belajar',
  'bahasa',
  'boleh',
  'maksud',
  'terjemah',
  'ayat',
  'perkataan',
] as const;

export const isLikelyMalay = (text: string): boolean => {
  const normalized = text.toLowerCase();
  return MALAY_HINT_TOKENS.some((hint) => normalized.includes(hint));
};
