import type { Database } from '../types/database';

type ProfileRole = NonNullable<Database['public']['Tables']['profiles']['Row']['role']>;

export type ProfileProgressInput = {
  role: ProfileRole;
  wordsLearned: number;
  storiesCompleted: number;
  storiesShared: number;
  followerCount: number;
};

export type ProfileProgress = {
  label: string;
  percentToNextLevel: number;
};

type Level = {
  label: string;
  minimumXp: number;
};

const LEVELS: Level[] = [
  { label: 'Seed', minimumXp: 0 },
  { label: 'Sprout', minimumXp: 500 },
  { label: 'Sapling', minimumXp: 1_200 },
  { label: 'Flourish', minimumXp: 2_500 },
  { label: 'Legacy', minimumXp: 4_000 },
];

const clampPercent = (value: number): number => {
  if (value < 0) {
    return 0;
  }

  if (value > 100) {
    return 100;
  }

  return value;
};

const resolveExperience = ({
  role,
  wordsLearned,
  storiesCompleted,
  storiesShared,
  followerCount,
}: ProfileProgressInput): number => {
  if (role === 'elder' || role === 'admin') {
    return storiesShared * 35 + followerCount * 3 + wordsLearned;
  }

  return wordsLearned * 4 + storiesCompleted * 30 + followerCount;
};

const findCurrentLevelIndex = (experience: number): number => {
  for (let index = LEVELS.length - 1; index >= 0; index -= 1) {
    const level = LEVELS[index];
    if (level && experience >= level.minimumXp) {
      return index;
    }
  }

  return 0;
};

export const deriveProfileProgress = (input: ProfileProgressInput): ProfileProgress => {
  const experience = resolveExperience(input);
  const currentLevelIndex = findCurrentLevelIndex(experience);
  const currentLevel = LEVELS[currentLevelIndex]!;
  const nextLevel = LEVELS[currentLevelIndex + 1];

  if (!nextLevel) {
    return {
      label: `Lv. ${currentLevel.label}`,
      percentToNextLevel: 100,
    };
  }

  const segmentSize = nextLevel.minimumXp - currentLevel.minimumXp;
  const segmentProgress = experience - currentLevel.minimumXp;
  const percentToNextLevel = clampPercent(Math.round((segmentProgress / segmentSize) * 100));

  return {
    label: `Lv. ${currentLevel.label}`,
    percentToNextLevel,
  };
};
