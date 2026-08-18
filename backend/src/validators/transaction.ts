import { z } from 'zod';
import { CategoryType } from '@prisma/client';

/**
 * Shared currency enum. Previously `currency` was declared on the update schema
 * but omitted from create, so Zod stripped it and every new transaction was
 * silently stored as the INR default regardless of what the client sent.
 */
const currencySchema = z.enum(['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD', 'JPY', 'CNY', 'SGD', 'AED'], {
  errorMap: () => ({ message: 'Unsupported currency code' }),
});

export const createTransactionSchema = z.object({
  body: z.object({
    amount: z
      .number({ required_error: 'Amount is required' })
      .positive({ message: 'Amount must be a positive number' }),
    currency: currencySchema.optional(),
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
    currency: currencySchema.optional(),
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

/**
 * Columns a client may sort by.
 *
 * This was previously an open `z.string()`, so `?sortBy=<anything>` reached
 * Prisma as an orderBy key and failed the request. An allowlist keeps the
 * surface to columns that actually exist and are meaningful to order on.
 */
export const TRANSACTION_SORT_FIELDS = [
  'date',
  'amount',
  'createdAt',
  'merchant',
  'type',
] as const;

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
    minAmount: z.coerce.number().nonnegative().optional(),
    maxAmount: z.coerce.number().nonnegative().optional(),
    sortBy: z
      .enum(TRANSACTION_SORT_FIELDS, {
        errorMap: () => ({
          message: `sortBy must be one of: ${TRANSACTION_SORT_FIELDS.join(', ')}`,
        }),
      })
      .default('date'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),
}).refine(
  (data) =>
    data.query.minAmount === undefined ||
    data.query.maxAmount === undefined ||
    data.query.maxAmount >= data.query.minAmount,
  { message: 'maxAmount must be greater than or equal to minAmount', path: ['query', 'maxAmount'] }
);
