import { z } from 'zod';

export const createGoalSchema = z.object({
  body: z.object({
    name: z
      .string({ required_error: 'Goal name is required' })
      .min(1, { message: 'Goal name cannot be empty' }),
    targetAmount: z
      .number({ required_error: 'Target amount is required' })
      .positive({ message: 'Target amount must be a positive number' }),
    currentAmount: z.number().nonnegative().optional().default(0),
    currency: z.enum(['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD', 'JPY', 'CNY', 'SGD', 'AED']).optional(),
    targetDate: z.coerce
      .date({ invalid_type_error: 'Invalid target date format' })
      .optional()
      .nullable()
      .refine(
        (val) => {
          if (!val) return true;
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          return val >= today;
        },
        { message: 'Target date must be today or later' }
      ),
  }),
});

export const updateGoalSchema = z.object({
  body: z.object({
    name: z.string().min(1, { message: 'Goal name cannot be empty' }).optional(),
    targetAmount: z
      .number()
      .positive({ message: 'Target amount must be a positive number' })
      .optional(),
    currentAmount: z.number().nonnegative().optional(),
    currency: z.enum(['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD', 'JPY', 'CNY', 'SGD', 'AED']).optional(),
    targetDate: z.coerce
      .date({ invalid_type_error: 'Invalid target date format' })
      .optional()
      .nullable()
      .refine(
        (val) => {
          if (!val) return true;
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          return val >= today;
        },
        { message: 'Target date must be today or later' }
      ),
  }),
});

export const contributeGoalSchema = z.object({
  body: z.object({
    amount: z
      .number({ required_error: 'Contribution amount is required' })
      .positive({ message: 'Contribution amount must be a positive number' }),
  }),
});
