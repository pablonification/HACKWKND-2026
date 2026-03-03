import { requestPasswordReset, signInWithEmail, signUpWithEmail } from './auth';
import { supabase } from './supabase';

jest.mock('./supabase', () => ({
  supabase: {
    from: jest.fn(),
    auth: {
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      resetPasswordForEmail: jest.fn(),
    },
  },
}));

type MockedSupabase = {
  from: jest.Mock;
  auth: {
    signInWithPassword: jest.Mock;
    signUp: jest.Mock;
    resetPasswordForEmail: jest.Mock;
  };
};

describe('auth', () => {
  const mockedSupabase = supabase as unknown as MockedSupabase;
  const mockUpsert = jest.fn();
  const mockMaybeSingle = jest.fn();
  const mockEq = jest.fn(() => ({ maybeSingle: mockMaybeSingle }));
  const mockSelect = jest.fn(() => ({ eq: mockEq }));
  const originalRedirectTo = process.env.EXPO_PUBLIC_PASSWORD_RESET_REDIRECT_TO;
  const originalScheme = process.env.EXPO_PUBLIC_APP_SCHEME;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedSupabase.from.mockReturnValue({
      select: mockSelect,
      upsert: mockUpsert,
    });
    delete process.env.EXPO_PUBLIC_PASSWORD_RESET_REDIRECT_TO;
    delete process.env.EXPO_PUBLIC_APP_SCHEME;
  });

  afterAll(() => {
    if (typeof originalRedirectTo === 'undefined') {
      delete process.env.EXPO_PUBLIC_PASSWORD_RESET_REDIRECT_TO;
    } else {
      process.env.EXPO_PUBLIC_PASSWORD_RESET_REDIRECT_TO = originalRedirectTo;
    }

    if (typeof originalScheme === 'undefined') {
      delete process.env.EXPO_PUBLIC_APP_SCHEME;
    } else {
      process.env.EXPO_PUBLIC_APP_SCHEME = originalScheme;
    }
  });

  it('uses metadata role during sign-in when profile does not exist yet', async () => {
    mockedSupabase.auth.signInWithPassword.mockResolvedValue({
      data: {
        user: {
          id: 'user-1',
          email: 'learner@example.com',
          user_metadata: {
            full_name: 'Learner Name',
            role: 'learner',
          },
        },
      },
      error: null,
    });
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockUpsert.mockResolvedValue({ error: null });

    await signInWithEmail({ email: 'learner@example.com', password: 'password123' });

    const upsertPayload = mockUpsert.mock.calls[0]?.[0] as Record<string, unknown>;

    expect(upsertPayload.id).toBe('user-1');
    expect(upsertPayload.email).toBe('learner@example.com');
    expect(upsertPayload.full_name).toBe('Learner Name');
    expect(upsertPayload.username).toBe('learner');
    expect(upsertPayload.role).toBe('learner');
  });

  it('does not overwrite existing profile role during sign-in sync', async () => {
    mockedSupabase.auth.signInWithPassword.mockResolvedValue({
      data: {
        user: {
          id: 'user-1',
          email: 'admin@example.com',
          user_metadata: {
            full_name: 'Admin Name',
            role: 'learner',
          },
        },
      },
      error: null,
    });
    mockMaybeSingle.mockResolvedValue({ data: { id: 'user-1' }, error: null });
    mockUpsert.mockResolvedValue({ error: null });

    await signInWithEmail({ email: 'admin@example.com', password: 'password123' });

    const upsertPayload = mockUpsert.mock.calls[0]?.[0] as Record<string, unknown>;

    expect(upsertPayload.id).toBe('user-1');
    expect(upsertPayload).not.toHaveProperty('role');
  });

  it('still writes role on sign-up profile upsert', async () => {
    mockedSupabase.auth.signUp.mockResolvedValue({
      data: {
        session: { access_token: 'token' },
        user: { id: 'user-2', email: 'elder@example.com' },
      },
      error: null,
    });
    mockUpsert.mockResolvedValue({ error: null });

    await signUpWithEmail({
      fullName: 'Elder Name',
      email: 'elder@example.com',
      password: 'password123',
      role: 'elder',
    });

    const upsertPayload = mockUpsert.mock.calls[0]?.[0] as Record<string, unknown>;

    expect(upsertPayload.role).toBe('elder');
  });

  it('sends password reset email with deep-link redirect', async () => {
    mockedSupabase.auth.resetPasswordForEmail.mockResolvedValue({ error: null });

    await requestPasswordReset('user@example.com');

    expect(mockedSupabase.auth.resetPasswordForEmail).toHaveBeenCalledWith('user@example.com', {
      redirectTo: 'taleka://auth/reset-password',
    });
  });

  it('uses configured reset redirect when provided', async () => {
    process.env.EXPO_PUBLIC_PASSWORD_RESET_REDIRECT_TO = 'myapp://reset';
    mockedSupabase.auth.resetPasswordForEmail.mockResolvedValue({ error: null });

    await requestPasswordReset('user@example.com');

    expect(mockedSupabase.auth.resetPasswordForEmail).toHaveBeenCalledWith('user@example.com', {
      redirectTo: 'myapp://reset',
    });
  });
});
