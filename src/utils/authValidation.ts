const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_MIN_LENGTH = 2;
const PASSWORD_MIN_LENGTH = 8;

export const AUTH_ROLES = ['learner', 'elder'] as const;
export type AuthRole = (typeof AUTH_ROLES)[number];

export const validateEmail = (email: string): string | null => {
  if (!email.trim()) {
    return 'Email is required.';
  }

  if (!EMAIL_REGEX.test(email)) {
    return 'Please use a valid email address.';
  }

  return null;
};

export const validatePassword = (password: string): string | null => {
  if (!password) {
    return 'Password is required.';
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }

  return null;
};

export const validateFullName = (fullName: string): string | null => {
  if (!fullName.trim()) {
    return 'Full name is required.';
  }

  if (fullName.trim().length < NAME_MIN_LENGTH) {
    return `Full name must be at least ${NAME_MIN_LENGTH} characters.`;
  }

  return null;
};

export const validateRole = (role: AuthRole | null): string | null => {
  if (!role) {
    return 'Please select your role.';
  }

  return null;
};

export const validateLoginForm = (email: string, password: string): string | null => {
  return validateEmail(email) ?? validatePassword(password);
};

export const validateSignUpForm = (
  fullName: string,
  email: string,
  password: string,
  role: AuthRole | null,
): string | null => {
  return (
    validateFullName(fullName) ??
    validateEmail(email) ??
    validatePassword(password) ??
    validateRole(role)
  );
};
