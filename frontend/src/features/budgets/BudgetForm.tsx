import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCategories } from '../../services/transactions';
import { useAuth } from '../../context/AuthContext';
import {
  FALLBACK_CURRENCY,
  currencySymbol,
} from '../../utils/formatCurrency';
import { Field, Input, Select, controlClasses } from '../../components/ui/Field';
import Button from '../../components/ui/Button';

const budgetFormSchema = z.object({
  amount: z.coerce
    .number({ required_error: 'Amount is required' })
    .positive({ message: 'Budget amount must be a positive number' }),
  startDate: z.string().min(1, { message: 'Start date is required' }),
  endDate: z.string().min(1, { message: 'End date is required' }),
  categoryId: z.string().optional().nullable(),
  currency: z.string().min(1, { message: 'Currency is required' }),
}).refine(
  (data) => data.endDate >= data.startDate,
  {
    message: 'End date must be greater than or equal to start date',
    path: ['endDate'],
  }
);

type BudgetFormValues = z.infer<typeof budgetFormSchema>;

interface BudgetFormProps {
  initialData?: any;
  onSubmit: (values: any) => void;
  isPending: boolean;
  onCancel: () => void;
}

export const BudgetForm: React.FC<BudgetFormProps> = ({
  initialData,
  onSubmit,
  isPending,
  onCancel,
}) => {
  const { data: categoriesResponse, isLoading: categoriesLoading } = useCategories();
  const categories = categoriesResponse?.data?.categories || [];
  const { user } = useAuth();
  const preferredCurrency = user?.preferredCurrency || FALLBACK_CURRENCY;
  /** The account's reporting currency. Not user-selectable here — see below. */
  const accountCurrency = preferredCurrency;

  const formatInputDate = (dateString?: string) => {
    if (!dateString) return new Date().toISOString().split('T')[0];
    const dateObj = new Date(dateString);
    return isNaN(dateObj.getTime())
      ? new Date().toISOString().split('T')[0]
      : dateObj.toISOString().split('T')[0];
  };

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<BudgetFormValues>({
    resolver: zodResolver(budgetFormSchema),
    defaultValues: {
      amount: initialData?.amount ? Number(initialData.amount) : undefined as any,
      startDate: formatInputDate(initialData?.startDate),
      endDate: formatInputDate(
        initialData?.endDate || new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString()
      ),
      categoryId: initialData?.categoryId || '',
      currency: initialData?.currency || preferredCurrency,
    },
  });

  const handleFormSubmit = (values: BudgetFormValues) => {
    // Map empty string category to null for overall budget
    const mappedValues = {
      ...values,
      categoryId: values.categoryId === '' ? null : values.categoryId,
    };
    onSubmit(mappedValues);
  };

  return (
    <form noValidate onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4 text-left">
      <Field label="Budget Scope" disabled={isPending || categoriesLoading}>
        {(ids) => (
          <Select {...ids} {...register('categoryId')}>
            <option value="">Overall Monthly Budget (All Expenses)</option>
            {categories
              .filter((cat: any) => cat.type === 'EXPENSE')
              .map((cat: any) => (
                <option key={cat.id} value={cat.id}>
                  Limit category: {cat.name}
                </option>
              ))}
          </Select>
        )}
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Budget Limit Amount" error={errors.amount?.message} disabled={isPending}>
          {(ids) => (
            <div className="relative">
              {/* Reflects the selected currency, not a fixed dollar glyph. */}
              <span
                aria-hidden="true"
                className={`absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-secondaryLight/60 dark:text-text-secondaryDark/50 ${
                  currencySymbol(accountCurrency).length > 1 ? 'text-[11px]' : 'text-sm'
                }`}
              >
                {currencySymbol(accountCurrency)}
              </span>
              <input
                {...ids}
                type="number"
                step="0.01"
                placeholder="0.00"
                className={`${controlClasses(!!errors.amount, true)}`}
                {...register('amount')}
              />
            </div>
          )}
        </Field>

        {/*
          Read-only, deliberately.

          This was a full currency picker, but the API ignores whatever it
          sends: Budgets are always denominated in the account's reporting
          currency so that limits and converted spend share one unit and no FX
          happens in the maths. Offering a choice that is silently discarded
          told the user they had set EUR when the record was stored in {accountCurrency}.
        */}
        <Field label="Currency">
          {(ids) => (
            <div
              {...ids}
              className={`${controlClasses(false, false)} flex items-center justify-between cursor-not-allowed opacity-80`}
            >
              <span>{accountCurrency}</span>
              <span className="text-xs text-text-secondaryLight dark:text-text-secondaryDark">
                Account currency
              </span>
            </div>
          )}
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Start Date" error={errors.startDate?.message} disabled={isPending}>
          {(ids) => (
            <Input {...ids} type="date" hasError={!!errors.startDate} {...register('startDate')} />
          )}
        </Field>

        <Field label="End Date" error={errors.endDate?.message} disabled={isPending}>
          {(ids) => (
            <Input {...ids} type="date" hasError={!!errors.endDate} {...register('endDate')} />
          )}
        </Field>
      </div>

      <div className="flex justify-end gap-3 pt-3 border-t border-border-light dark:border-border-dark mt-6">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" loading={isPending}>
          {initialData ? 'Save Changes' : 'Setup Budget'}
        </Button>
      </div>
    </form>
  );
};
export default BudgetForm;
