import { z } from 'zod';
import { CategoryType } from '@prisma/client';

export const createTransactionSchema = z.object({
  body: z.object({
    amount: z
      .number({ required_error: 'Amount is required' })
      .positive({ message: 'Amount must be a positive number' }),
    description: z.string().trim().optional().nullable(),
    merchant: z.string().trim().optional().nullable(),
    date: z.coerce.date({
      required_error: 'Date is required',
      invalid_type_error: 'Invalid date format',
    }),
    type: z.nativeEnum(CategoryType, {
      required_error: 'Transaction type (INCOME/EXPENSE) is required',
    }),
    paymentMethod: z.string().trim().optional().nullable(),
    categoryId: z
      .string({ required_error: 'Category ID is required' })
      .uuid({ message: 'Category ID must be a valid UUID' }),
    isSubscription: z.boolean().default(false).optional(),
    receiptId: z.string().uuid({ message: 'Receipt ID must be a valid UUID' }).optional().nullable(),
  }),
});

export const updateTransactionSchema = z.object({
  body: z.object({
    amount: z.number().positive({ message: 'Amount must be a positive number' }).optional(),
    currency: z.enum(['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD', 'JPY', 'CNY', 'SGD', 'AED']).optional(),
    description: z.string().trim().optional().nullable(),
    merchant: z.string().trim().optional().nullable(),
    date: z.coerce.date({ invalid_type_error: 'Invalid date format' }).optional(),
    type: z.nativeEnum(CategoryType).optional(),
    paymentMethod: z.string().trim().optional().nullable(),
    categoryId: z.string().uuid({ message: 'Category ID must be a valid UUID' }).optional(),
    isSubscription: z.boolean().optional(),
    receiptId: z.string().uuid({ message: 'Receipt ID must be a valid UUID' }).optional().nullable(),
  }),
});

export const getTransactionsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    search: z.string().optional(),
    categoryId: z.string().uuid().optional(),
    type: z.nativeEnum(CategoryType).optional(),
    isSubscription: z
      .preprocess((val) => {
        if (val === 'true') return true;
        if (val === 'false') return false;
        return val;
      }, z.boolean())
      .optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    sortBy: z.string().default('date'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),
});
