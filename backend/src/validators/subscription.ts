import { z } from 'zod';
import { SubscriptionFrequency } from '@prisma/client';

export const createSubscriptionSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required'),
    amount: z.number().positive('Amount must be greater than 0'),
    currency: z.enum(['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD', 'JPY', 'CNY', 'SGD', 'AED']).optional(),
    frequency: z.nativeEnum(SubscriptionFrequency, {
      errorMap: () => ({ message: 'Invalid frequency' }),
    }),
    startDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
      message: 'Invalid start date format',
    }),
    categoryId: z.string().uuid('Invalid category ID').optional().nullable(),
    isActive: z.boolean().optional(),
  }),
});

export const updateSubscriptionSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required').optional(),
    amount: z.number().positive('Amount must be greater than 0').optional(),
    currency: z.enum(['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD', 'JPY', 'CNY', 'SGD', 'AED']).optional(),
    frequency: z.nativeEnum(SubscriptionFrequency).optional(),
    startDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
      message: 'Invalid start date format',
    }).optional(),
    categoryId: z.string().uuid('Invalid category ID').optional().nullable(),
    isActive: z.boolean().optional(),
  }),
});
