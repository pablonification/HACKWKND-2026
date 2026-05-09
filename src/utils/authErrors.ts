const FALLBACK_AUTH_ERROR = 'Something went wrong. Please try again.';

const getErrorStatus = (error: unknown): number | null => {
  if (!error || typeof error !== 'object') {
    return null;
  }

  const status = (error as { status?: unknown }).status;
  return typeof status === 'number' ? status : null;
};

export const toAuthErrorMessage = (error: unknown): string => {
  if (!(error instanceof Error)) {
    return FALLBACK_AUTH_ERROR;
  }

  const message = error.message.toLowerCase();
  const status = getErrorStatus(error);

  if (status === 429 || message.includes('rate limit') || message.includes('too many requests')) {
    return 'Too many sign-up attempts right now. Please wait a minute, then try again.';
  }

  if (message.includes('invalid login credentials')) {
    return 'Email or password is incorrect.';
  }

  if (message.includes('email not confirmed')) {
    return 'Please confirm your email first, then sign in.';
  }

  if (message.includes('already registered')) {
    return 'An account with this email already exists.';
  }

  if (message.includes('password should be at least')) {
    return 'Password must be at least 8 characters.';
  }

  if (message.includes('network')) {
    return 'Network error. Please check your connection and try again.';
  }

  return error.message || FALLBACK_AUTH_ERROR;
};
