import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { completeProfileOnboarding, fetchOnboardingStatus } from './profile';
import { supabase } from './supabase';

vi.mock('./supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getUser: vi.fn(),
    },
  },
}));

type MockedSupabase = {
  from: ReturnType<typeof vi.fn>;
};

describe('profile onboarding', () => {
  const mockedSupabase = supabase as unknown as MockedSupabase;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reads onboarding completion status from an existing profile', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'user-1',
        role: 'elder',
        onboarding_completed: false,
      },
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    mockedSupabase.from.mockReturnValue({ select });

    await expect(
      fetchOnboardingStatus({ userId: 'user-1', fallbackRole: 'learner' }),
    ).resolves.toEqual({
      completed: false,
      role: 'elder',
    });

    expect(mockedSupabase.from).toHaveBeenCalledWith('profiles');
    expect(select).toHaveBeenCalledWith('id,role,onboarding_completed');
    expect(eq).toHaveBeenCalledWith('id', 'user-1');
  });

  it('persists onboarding responses and selected language community', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-09T10:30:00.000Z'));

    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq });
    mockedSupabase.from.mockReturnValue({ update });

    const responses = {
      purpose: ['learn-language'],
      cultureConnection: ['stories-folktales'],
      familiarity: 'new',
      country: 'Malaysia',
      languageCommunity: 'Semai',
    };

    await completeProfileOnboarding({ userId: 'user-1', responses });

    expect(mockedSupabase.from).toHaveBeenCalledWith('profiles');
    expect(update).toHaveBeenCalledWith({
      onboarding_completed: true,
      onboarding_completed_at: '2026-05-09T10:30:00.000Z',
      onboarding_responses: responses,
      indigenous_language: 'Semai',
    });
    expect(eq).toHaveBeenCalledWith('id', 'user-1');
  });
});
