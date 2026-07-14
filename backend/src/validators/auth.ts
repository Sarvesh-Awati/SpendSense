import { z } from 'zod';

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
    password: z
      .string({ required_error: 'Password is required' })
      .min(8, { message: 'Password must be at least 8 characters long' })
      .regex(/[a-z]/, { message: 'Password must contain at least one lowercase letter' })
      .regex(/[A-Z]/, { message: 'Password must contain at least one uppercase letter' })
      .regex(/[0-9]/, { message: 'Password must contain at least one number' })
      .regex(/[^a-zA-Z0-9]/, { message: 'Password must contain at least one special character' }),
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
