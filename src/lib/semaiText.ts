export const normalizeSemaiText = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[ɔ]/g, 'o')
    .replace(/[ə]/g, 'e')
    .replace(/[ɨ]/g, 'i')
    .replace(/[^a-zA-Z0-9'\s-]/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

export const tokenizeSemaiText = (value: string): string[] =>
  normalizeSemaiText(value)
    .split(/[\s-]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);

export const normalizeSemaiKey = (value: string): string =>
  normalizeSemaiText(value).replace(/[^a-z0-9]+/g, '');
