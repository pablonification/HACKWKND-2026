const EXPLORE_ENTRY = 'explore';
const ENTRY_PARAM = 'entry';

const APP_ORIGIN = 'https://taleka.local';

export const addExploreEntry = (href: string) => {
  const url = new URL(href, APP_ORIGIN);
  url.searchParams.set(ENTRY_PARAM, EXPLORE_ENTRY);
  return `${url.pathname}${url.search}${url.hash}`;
};

export const isExploreEntry = (searchParams: URLSearchParams) =>
  searchParams.get(ENTRY_PARAM) === EXPLORE_ENTRY;

export const buildAiSearchParams = (
  baseParams: Record<string, string>,
  currentParams: URLSearchParams,
) => {
  const nextParams = new URLSearchParams(baseParams);

  if (isExploreEntry(currentParams)) {
    nextParams.set(ENTRY_PARAM, EXPLORE_ENTRY);
  }

  return nextParams;
};
