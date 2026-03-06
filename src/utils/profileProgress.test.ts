import { describe, expect, it } from 'vitest';

import { deriveProfileProgress } from './profileProgress';

describe('deriveProfileProgress', () => {
  it('computes learner progression from learning stats', () => {
    const progress = deriveProfileProgress({
      role: 'learner',
      wordsLearned: 100,
      storiesCompleted: 3,
      storiesShared: 0,
      followerCount: 2,
    });

    expect(progress.label).toBe('Lv. Seed');
    expect(progress.percentToNextLevel).toBe(98);
  });

  it('computes elder progression from contribution stats', () => {
    const progress = deriveProfileProgress({
      role: 'elder',
      wordsLearned: 0,
      storiesCompleted: 0,
      storiesShared: 8,
      followerCount: 73,
    });

    expect(progress.label).toBe('Lv. Seed');
    expect(progress.percentToNextLevel).toBe(100);
  });

  it('caps level progress at 100 percent for top level', () => {
    const progress = deriveProfileProgress({
      role: 'admin',
      wordsLearned: 0,
      storiesCompleted: 0,
      storiesShared: 200,
      followerCount: 300,
    });

    expect(progress.label).toBe('Lv. Legacy');
    expect(progress.percentToNextLevel).toBe(100);
  });
});
