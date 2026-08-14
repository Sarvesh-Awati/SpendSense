import { z } from 'zod';

/**
 * The single source of truth for password strength across the application.
 * Every endpoint that accepts a NEW password must use this schema so the
 * policy cannot be bypassed by choosing a different code path.
 */
export const passwordSchema = z
  .string({ required_error: 'Password is required' })
  .min(8, { message: 'Password must be at least 8 characters long' })
  .regex(/[a-z]/, { message: 'Password must contain at least one lowercase letter' })
  .regex(/[A-Z]/, { message: 'Password must contain at least one uppercase letter' })
  .regex(/[0-9]/, { message: 'Password must contain at least one number' })
  .regex(/[^a-zA-Z0-9]/, { message: 'Password must contain at least one special character' });

export const registerSchema = z.object({
  body: z.object({
    firstName: z
      .string({ required_error: 'First name is required' })
      .min(1, { message: 'First name cannot be empty' })
      .trim(),
    lastName: z
      .string({ required_error: 'Last name is required' })
      .min(1, { message: 'Last name cannot be empty' })
      .trim(),
    email: z
      .string({ required_error: 'Email is required' })
      .email({ message: 'Must be a valid email address' })
      .toLowerCase()
      .trim(),
    password: passwordSchema,
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z
      .string({ required_error: 'Email is required' })
      .email({ message: 'Must be a valid email address' })
      .toLowerCase()
      .trim(),
    password: z
      .string({ required_error: 'Password is required' })
      .min(1, { message: 'Password cannot be empty' }),
  }),
});

export const refreshSchema = z.object({
  body: z.object({
    refreshToken: z
      .string({ required_error: 'Refresh token is required' })
      .min(1, { message: 'Refresh token cannot be empty' }),
  }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z
      .string({ required_error: 'Email is required' })
      .email({ message: 'Must be a valid email address' })
      .toLowerCase()
      .trim(),
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    token: z
      .string({ required_error: 'Reset token is required' })
      .min(1, { message: 'Reset token cannot be empty' }),
    password: passwordSchema,
  }),
});

