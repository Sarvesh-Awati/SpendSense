import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCategories } from '../../services/transactions';
import { useAuth } from '../../context/AuthContext';
import {
  currencySymbol,
  FALLBACK_CURRENCY,
  SUPPORTED_CURRENCIES,
} from '../../utils/formatCurrency';
import { Field, Input, Select, Textarea, controlClasses } from '../../components/ui/Field';
import Button from '../../components/ui/Button';
import { Sparkles } from 'lucide-react';

const transactionFormSchema = z.object({
  amount: z.coerce
    .number({ required_error: 'Amount is required' })
    .positive({ message: 'Amount must be a positive number' }),
  type: z.enum(['INCOME', 'EXPENSE'], {
    required_error: 'Transaction type is required',
  }),
  categoryId: z.string().uuid({ message: 'Please select a category' }),
  date: z.string().min(1, { message: 'Date is required' }),
  merchant: z.string().trim().optional().nullable(),
  description: z.string().trim().optional().nullable(),
  paymentMethod: z.string().trim().optional().nullable(),
  isSubscription: z.boolean().default(false),
  currency: z.string().min(1, { message: 'Currency is required' }),
});

type TransactionFormValues = z.infer<typeof transactionFormSchema>;

interface TransactionFormProps {
  initialData?: any;
  onSubmit: (values: any) => void;
  isPending: boolean;
  onCancel: () => void;
}

export const TransactionForm: React.FC<TransactionFormProps> = ({
  initialData,
  onSubmit,
  isPending,
  onCancel,
}) => {
  // Edit mode is signalled by an existing record id. Prefilled create flows
  // (Quick Add, Receipt Scanner) pass initialData without one.
  const isEditMode = Boolean(initialData?.id);

  const { data: categoriesResponse, isLoading: categoriesLoading } = useCategories();
  const categories = categoriesResponse?.data?.categories || [];
  const { user } = useAuth();
  const preferredCurrency = user?.preferredCurrency || FALLBACK_CURRENCY;

  // Format date correctly for HTML date input: YYYY-MM-DD
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
    watch,
    formState: { errors },
  } = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: {
      amount: initialData?.amount ? Number(initialData.amount) : undefined as any,
      type: initialData?.type || 'EXPENSE',
      categoryId: initialData?.categoryId || '',
      date: formatInputDate(initialData?.date),
      merchant: initialData?.merchant || '',
      description: initialData?.description || '',
      paymentMethod: initialData?.paymentMethod || 'Card',
      isSubscription: initialData?.isSubscription || false,
      currency: initialData?.currency || preferredCurrency,
    },
  });

  const transactionType = watch('type');
  // Amount prefix follows the currency the user has selected, not a fixed "$".
  const selectedCurrency = watch('currency');

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-4 text-left">
      {/* Transaction Type Segment */}
      <div className="grid grid-cols-2 gap-3 p-1 rounded-xl bg-slate-100 dark:bg-surface-sunk border border-border-light dark:border-border-dark">
        <label className={`flex items-center justify-center py-3 rounded-lg text-xs font-bold tracking-wider uppercase cursor-pointer transition-all ${
          transactionType === 'EXPENSE'
            ? 'bg-finance-expense text-white shadow'
            : 'text-text-secondaryLight dark:text-text-secondaryDark hover:text-text-primaryLight dark:hover:text-text-primaryDark'
        }`}>
          <input type="radio" value="EXPENSE" className="sr-only" {...register('type')} />
          Expense
        </label>
        <label className={`flex items-center justify-center py-3 rounded-lg text-xs font-bold tracking-wider uppercase cursor-pointer transition-all ${
          transactionType === 'INCOME'
            ? 'bg-finance-income text-white shadow'
            : 'text-text-secondaryLight dark:text-text-secondaryDark hover:text-text-primaryLight dark:hover:text-text-primaryDark'
        }`}>
          <input type="radio" value="INCOME" className="sr-only" {...register('type')} />
          Income
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Amount" error={errors.amount?.message} disabled={isPending}>
          {(ids) => (
            <div className="relative">
              <span
                aria-hidden="true"
                className={`absolute inset-y-0 left-0 pl-3.5 flex items-center justify-center pointer-events-none text-text-secondaryLight/70 dark:text-text-secondaryDark/60 font-medium w-5 ${
                  // Codes like CA$/SGD/AED need a smaller size to fit the slot.
                  currencySymbol(selectedCurrency).length > 1 ? 'text-[11px]' : 'text-base'
                }`}
              >
                {currencySymbol(selectedCurrency)}
              </span>
              <input
                {...ids}
                type="number"
                step="0.01"
                placeholder="0.00"
                className={controlClasses(!!errors.amount, true)}
                {...register('amount')}
              />
            </div>
          )}
        </Field>

        <Field label="Currency" error={errors.currency?.message} disabled={isPending}>
          {(ids) => (
            <Select {...ids} hasError={!!errors.currency} {...register('currency')}>
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Date" error={errors.date?.message} disabled={isPending}>
          {(ids) => <Input {...ids} type="date" hasError={!!errors.date} {...register('date')} />}
        </Field>

        <Field
          label="Category"
          error={errors.categoryId?.message}
          description={categoriesLoading ? 'Loading categories…' : undefined}
          disabled={isPending || categoriesLoading}
        >
          {(ids) => (
            <Select {...ids} hasError={!!errors.categoryId} {...register('categoryId')}>
              <option value="">-- Choose Category --</option>
              {categories
                .filter((cat: any) => cat.type === transactionType)
                .map((cat: any) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
            </Select>
          )}
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Merchant / Payee" disabled={isPending}>
          {(ids) => (
            <Input
              {...ids}
              type="text"
              placeholder="Starbucks, Landlord..."
              {...register('merchant')}
            />
          )}
        </Field>

        <Field label="Payment Method" disabled={isPending}>
          {(ids) => (
            <Select {...ids} {...register('paymentMethod')}>
              <option value="Card">Credit/Debit Card</option>
              <option value="Cash">Cash</option>
              <option value="UPI">UPI / Instant Pay</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="Others">Others</option>
            </Select>
          )}
        </Field>
      </div>

      <Field label="Description / Note" disabled={isPending}>
        {(ids) => (
          <Textarea
            {...ids}
            rows={2}
            placeholder="Add details about this transaction..."
            {...register('description')}
          />
        )}
      </Field>

      {/* Recurring Subscription Toggle */}
      {transactionType === 'EXPENSE' && (
        <div className="flex items-center justify-between p-3 rounded-control border border-border-light dark:border-border-dark bg-slate-50/50 dark:bg-surface-sunk/40">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-brand-secondary" aria-hidden="true" />
            <div className="text-left">
              <p className="text-xs font-bold">Mark as Subscription</p>
              <p className="text-[10px] text-text-secondaryLight dark:text-text-secondaryDark">
                Is this a recurring billing expense?
              </p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              disabled={isPending}
              {...register('isSubscription')}
            />
            <span className="sr-only">Mark as subscription</span>
            <div className="w-9 h-5 bg-slate-200 dark:bg-slate-800 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-primary/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-primary"></div>
          </label>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-3 border-t border-border-light dark:border-border-dark mt-6">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" loading={isPending}>
          {isEditMode ? 'Save Changes' : 'Add Transaction'}
        </Button>
      </div>
    </form>
  );
};
export default TransactionForm;
