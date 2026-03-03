import {
  validateEmail,
  validateFullName,
  validateLoginForm,
  validatePassword,
  validateRole,
  validateSignUpForm,
} from './authValidation';

describe('authValidation', () => {
  it('rejects empty email', () => {
    expect(validateEmail('')).toBe('Email is required.');
  });

  it('rejects malformed email', () => {
    expect(validateEmail('bad-email')).toBe('Please use a valid email address.');
  });

  it('accepts valid email', () => {
    expect(validateEmail('user@example.com')).toBeNull();
  });

  it('rejects short password', () => {
    expect(validatePassword('1234567')).toBe('Password must be at least 8 characters.');
  });

  it('accepts valid login form values', () => {
    expect(validateLoginForm('user@example.com', '12345678')).toBeNull();
  });

  it('rejects empty full name', () => {
    expect(validateFullName('')).toBe('Full name is required.');
  });

  it('rejects missing role', () => {
    expect(validateRole(null)).toBe('Please select your role.');
  });

  it('accepts valid sign up form values', () => {
    expect(validateSignUpForm('Taleka User', 'user@example.com', '12345678', 'learner')).toBeNull();
  });
});
