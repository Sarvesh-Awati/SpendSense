import { z } from 'zod';

export const updateProfileSchema = z.object({
  body: z.object({
    firstName: z.string().min(1, 'First name is required').max(50).optional(),
    lastName: z.string().min(1, 'Last name is required').max(50).optional(),
    email: z.string().email('Invalid email address').optional(),
    password: z.string().min(8, 'Password must be at least 8 characters').optional().or(z.literal('')),
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
    newPassword: z.string().min(8, 'New password must be at least 8 characters'),
  }),
});
