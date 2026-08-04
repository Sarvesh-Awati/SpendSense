import { z } from 'zod';

export const createBudgetSchema = z.object({
  body: z.object({
    amount: z
      .number({ required_error: 'Amount is required' })
      .positive({ message: 'Budget amount must be a positive number' }),
    currency: z.enum(['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD', 'JPY', 'CNY', 'SGD', 'AED']).optional(),
    startDate: z.coerce.date({
      required_error: 'Start date is required',
      invalid_type_error: 'Invalid start date format',
    }),
    endDate: z.coerce.date({
      required_error: 'End date is required',
      invalid_type_error: 'Invalid end date format',
    }),
    categoryId: z
      .string()
      .uuid({ message: 'Category ID must be a valid UUID' })
      .optional()
      .nullable(),
  }),
}).refine(
  (data) => data.body.endDate >= data.body.startDate,
  {
    message: 'End date must be greater than or equal to start date',
    path: ['body', 'endDate'],
  }
);

export const updateBudgetSchema = z.object({
  body: z.object({
    amount: z.number().positive({ message: 'Budget amount must be a positive number' }).optional(),
    currency: z.enum(['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD', 'JPY', 'CNY', 'SGD', 'AED']).optional(),
    startDate: z.coerce.date({ invalid_type_error: 'Invalid start date format' }).optional(),
    endDate: z.coerce.date({ invalid_type_error: 'Invalid end date format' }).optional(),
    categoryId: z
      .string()
      .uuid({ message: 'Category ID must be a valid UUID' })
      .optional()
      .nullable(),
  }),
}).refine(
  (data) => {
    if (data.body.startDate && data.body.endDate) {
      return data.body.endDate >= data.body.startDate;
    }
    return true;
  },
  {
    message: 'End date must be greater than or equal to start date',
    path: ['body', 'endDate'],
  }
);
