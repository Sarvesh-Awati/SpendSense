import { z } from 'zod';
import { passwordSchema } from './auth';

/**
 * Profile update schema.
 *
 * SECURITY: `password` and `email` are deliberately NOT accepted here.
 * Both are credentials-grade changes and must go through a flow that
 * re-authenticates the user:
 *   - password -> POST /api/users/change-password (requires currentPassword)
 *   - email    -> not currently supported; requires a verified email-change
 *                 flow before it can be re-introduced.
 * Zod strips unknown keys, so a client sending either field is ignored.
 */
export const updateProfileSchema = z.object({
  body: z.object({
    firstName: z.string().min(1, 'First name is required').max(50).optional(),
    lastName: z.string().min(1, 'Last name is required').max(50).optional(),
    profilePictureUrl: z.string().optional().or(z.literal('')), // Accept base64 or URL
    preferredCurrency: z.enum(['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD', 'JPY', 'CNY', 'SGD', 'AED']).optional(),
    language: z.string().optional(),
    dateFormat: z.string().optional(),
    timeFormat: z.string().optional(),
    theme: z.string().optional(),
    budgetAlerts: z.boolean().optional(),
    savingsReminders: z.boolean().optional(),
    subscriptionRenewals: z.boolean().optional(),
    receiptScanNotifications: z.boolean().optional(),
    emailNotifications: z.boolean().optional(),
  }),
});

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    // Uses the shared policy so every password path enforces identical rules.
    newPassword: passwordSchema,
  }),
});

/**
 * Account deletion is irreversible and cascades to all financial records,
 * so it requires re-authentication rather than a bearer token alone.
 */
export const deleteAccountSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
  }),
});
