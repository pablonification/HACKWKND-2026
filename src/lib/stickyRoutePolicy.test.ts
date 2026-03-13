import { describe, expect, it } from 'vitest';

import { getStickyHeaderPolicy, type StickyPolicy } from './stickyRoutePolicy';

const params = (search = '') => new URLSearchParams(search);

const expectPolicy = (pathname: string, search: string, policy: StickyPolicy) => {
  expect(getStickyHeaderPolicy(pathname, params(search))).toBe(policy);
};

const exactNonStickyRoutes: Array<[string, string, string]> = [
  ['AI intro', '/home/ai', ''],
  ['Garden landing', '/home/garden', ''],
  ['Translate landing', '/home/translation', ''],
  ['Story detail', '/home/stories/abc123', ''],
  ['Story read', '/home/stories/abc123/read', ''],
  ['Profile settings', '/home/profile/settings', ''],
  ['Profile edit', '/home/profile/edit', ''],
  ['Change password', '/home/profile/change-password', ''],
  ['Garden quiz', '/home/garden/quiz', ''],
  ['Garden vocab', '/home/garden/vocab', ''],
  ['Garden wordle', '/home/garden/wordle', ''],
  ['Level up', '/home/levelup', ''],
];

const prefixedNonStickyRoutes: Array<[string, string, string]> = [
  ['AI intro prefix', '/home/ai/welcome', ''],
  ['Garden prefix', '/home/garden/leaderboard', ''],
  ['Translate prefix', '/home/translation/history', ''],
  ['Story detail prefix', '/home/stories/abc123/notes', ''],
  ['Story read prefix', '/home/stories/abc123/read/page-2', ''],
  ['Profile settings prefix', '/home/profile/settings/notifications', ''],
  ['Profile edit prefix', '/home/profile/edit/avatar', ''],
  ['Change password prefix', '/home/profile/change-password/confirm', ''],
  ['Garden quiz prefix', '/home/garden/quiz/results', ''],
  ['Garden vocab prefix', '/home/garden/vocab/session', ''],
  ['Garden wordle prefix', '/home/garden/wordle/stats', ''],
  ['Level up prefix', '/home/levelup/streaks', ''],
];

const tabMenuGuardRoutes: Array<[string, string, string]> = [
  ['Translate route', '/home/translation', ''],
  ['Story detail route', '/home/stories/abc123', ''],
  ['Story read route', '/home/stories/abc123/read', ''],
  ['Profile settings route', '/home/profile/settings', ''],
  ['Profile edit route', '/home/profile/edit', ''],
  ['Change password route', '/home/profile/change-password', ''],
  ['Garden quiz route', '/home/garden/quiz', ''],
  ['Garden vocab route', '/home/garden/vocab', ''],
  ['Garden wordle route', '/home/garden/wordle', ''],
  ['Level up route', '/home/levelup', ''],
];

describe('getStickyHeaderPolicy', () => {
  describe('sticky routes', () => {
    it.each([
      ['/home/archive', ''],
      ['/home/archive/review', ''],
      ['/home/archive/review/123', ''],
      ['/home/studio', ''],
      ['/home/studio/save', ''],
      ['/home/ai', 'chat=1'],
    ])('returns sticky for %s%s', (pathname, search) => {
      expectPolicy(pathname, search, 'sticky');
    });
  });

  describe('compact-sticky routes', () => {
    it.each([
      ['/home/stories', ''],
      ['/home/profile/settings/about', ''],
      ['/home/profile/settings/privacy', ''],
    ])('returns compact-sticky for %s', (pathname) => {
      expectPolicy(pathname, '', 'compact-sticky');
    });
  });

  describe('non-sticky excluded routes', () => {
    it.each(exactNonStickyRoutes)('keeps %s route %s non-sticky', (_label, pathname, search) => {
      expectPolicy(pathname, search, 'non-sticky');
    });
  });

  describe('non-sticky excluded route prefixes', () => {
    it.each(prefixedNonStickyRoutes)('keeps %s route %s non-sticky', (_label, pathname, search) => {
      expectPolicy(pathname, search, 'non-sticky');
    });
  });

  describe('tab menu visibility invariants', () => {
    it.each(tabMenuGuardRoutes)(
      'keeps %s %s non-sticky so HomePage tab-menu guards stay route-owned',
      (_label, pathname, search) => {
        expectPolicy(pathname, search, 'non-sticky');
      },
    );
  });

  describe('AI chat query-param gate', () => {
    it.each([
      ['/home/ai', 'chat=1'],
      ['/home/ai/thread', 'chat=1'],
      ['/home/ai', 'source=home&chat=1'],
    ])('returns sticky for %s when %s includes chat=1', (pathname, search) => {
      expectPolicy(pathname, search, 'sticky');
    });

    it.each([
      ['/home/ai', ''],
      ['/home/ai', 'chat=0'],
      ['/home/ai', 'chat=true'],
      ['/home/ai/thread', ''],
      ['/home/ai/thread', 'source=home'],
    ])('returns non-sticky for %s when %s does not include chat=1', (pathname, search) => {
      expectPolicy(pathname, search, 'non-sticky');
    });
  });

  describe('prefix ordering — specific before broad', () => {
    it('archive/review is sticky (more specific than archive)', () => {
      expectPolicy('/home/archive/review', '', 'sticky');
    });

    it('profile/settings/about is compact-sticky (more specific than profile/settings)', () => {
      expectPolicy('/home/profile/settings/about', '', 'compact-sticky');
    });

    it('profile/settings base is non-sticky', () => {
      expectPolicy('/home/profile/settings', '', 'non-sticky');
    });

    it('stories base is compact-sticky', () => {
      expectPolicy('/home/stories', '', 'compact-sticky');
    });

    it('story detail overrides stories prefix to non-sticky', () => {
      expectPolicy('/home/stories/my-story', '', 'non-sticky');
    });
  });
});
