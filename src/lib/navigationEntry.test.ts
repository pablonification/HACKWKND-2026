import { describe, expect, it } from 'vitest';

import { addExploreEntry, buildAiSearchParams, isExploreEntry } from './navigationEntry';

describe('navigationEntry', () => {
  it('adds the explore entry marker to plain routes', () => {
    expect(addExploreEntry('/home/garden')).toBe('/home/garden?entry=explore');
  });

  it('preserves existing query params when adding the explore entry marker', () => {
    expect(addExploreEntry('/home/ai?chat=1')).toBe('/home/ai?chat=1&entry=explore');
  });

  it('detects explore entry from search params', () => {
    expect(isExploreEntry(new URLSearchParams('entry=explore'))).toBe(true);
    expect(isExploreEntry(new URLSearchParams('chat=1'))).toBe(false);
  });

  it('preserves the explore marker when building AI search params', () => {
    expect(
      buildAiSearchParams({ chat: '1' }, new URLSearchParams('entry=explore')).toString(),
    ).toBe('chat=1&entry=explore');
  });
});
