export type StickyPolicy = 'sticky' | 'compact-sticky' | 'non-sticky';

// More specific prefixes must appear before broader ones in each list.
const STICKY_PREFIXES = ['/home/archive/review', '/home/archive', '/home/studio'] as const;

const COMPACT_STICKY_PREFIXES = [
  '/home/stories',
  '/home/profile/settings/about',
  '/home/profile/settings/privacy',
] as const;

const NON_STICKY_PREFIXES = [
  '/home/ai',
  '/home/garden',
  '/home/translation',
  '/home/profile/settings',
  '/home/profile/edit',
  '/home/profile/change-password',
  '/home/levelup',
] as const;

const STORY_DETAIL_PATTERN = /^\/home\/stories\/[^/]+/;

export const getStickyHeaderPolicy = (
  pathname: string,
  searchParams: URLSearchParams,
): StickyPolicy => {
  // Query-param gate: /home/ai?chat=1 is sticky; plain /home/ai falls through to non-sticky
  if (pathname.startsWith('/home/ai') && searchParams.get('chat') === '1') {
    return 'sticky';
  }

  if (STORY_DETAIL_PATTERN.test(pathname)) {
    return 'non-sticky';
  }

  for (const prefix of COMPACT_STICKY_PREFIXES) {
    if (pathname.startsWith(prefix)) {
      return 'compact-sticky';
    }
  }

  for (const prefix of STICKY_PREFIXES) {
    if (pathname.startsWith(prefix)) {
      return 'sticky';
    }
  }

  for (const prefix of NON_STICKY_PREFIXES) {
    if (pathname.startsWith(prefix)) {
      return 'non-sticky';
    }
  }

  return 'non-sticky';
};
