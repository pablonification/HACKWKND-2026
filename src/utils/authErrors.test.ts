import { describe, expect, it } from 'vitest';

import { toAuthErrorMessage } from './authErrors';

describe('toAuthErrorMessage', () => {
  it('normalizes Supabase signup rate-limit errors', () => {
    const error = Object.assign(new Error('Email rate limit exceeded'), { status: 429 });

    expect(toAuthErrorMessage(error)).toBe(
      'Too many sign-up attempts right now. Please wait a minute, then try again.',
    );
  });

  it('normalizes textual too-many-requests errors', () => {
    expect(toAuthErrorMessage(new Error('Too many requests'))).toBe(
      'Too many sign-up attempts right now. Please wait a minute, then try again.',
    );
  });
});
