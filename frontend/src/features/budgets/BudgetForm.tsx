import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCategories } from '../../services/transactions';
import { useAuth } from '../../context/AuthContext';
import { Loader2, DollarSign, Calendar, Tag } from 'lucide-react';

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
  const preferredCurrency = user?.preferredCurrency || 'USD';

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
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4 text-left">
      {/* Category Select Dropdown */}
      <div>
        <label htmlFor="categoryId" className="block text-xs font-semibold uppercase tracking-wider text-text-secondaryLight dark:text-text-secondaryDark mb-2">
          Budget Scope
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-secondaryLight/50 dark:text-text-secondaryDark/40">
            <Tag className="w-4 h-4" />
          </div>
          <select
            id="categoryId"
            disabled={isPending || categoriesLoading}
            className="w-full pl-9 pr-3 py-3 rounded-xl border border-border-light dark:border-border-dark bg-slate-50 dark:bg-[#111622] text-sm focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 transition-all appearance-none"
            {...register('categoryId')}
          >
            <option value="">Overall Monthly Budget (All Expenses)</option>
            {categories
              .filter((cat: any) => cat.type === 'EXPENSE')
              .map((cat: any) => (
                <option key={cat.id} value={cat.id}>
                  Limit category: {cat.name}
                </option>
              ))}
          </select>
        </div>
      </div>

      {/* Amount & Currency Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Amount Input */}
        <div>
          <label htmlFor="amount" className="block text-xs font-semibold uppercase tracking-wider text-text-secondaryLight dark:text-text-secondaryDark mb-2">
            Budget Limit Amount
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-secondaryLight/50 dark:text-text-secondaryDark/40">
              <DollarSign className="w-5 h-5" />
            </div>
            <input
              id="amount"
              type="number"
              step="0.01"
              placeholder="0.00"
              disabled={isPending}
              className={`w-full pl-11 pr-4 py-3 rounded-xl border bg-slate-50 dark:bg-[#111622] text-sm focus:outline-none focus:ring-1 transition-all ${
                errors.amount
                  ? 'border-finance-expense/30 focus:border-finance-expense focus:ring-finance-expense'
                  : 'border-border-light dark:border-border-dark focus:border-brand-primary focus:ring-brand-primary'
              }`}
              {...register('amount')}
            />
          </div>
          {errors.amount && (
            <p className="text-xs text-finance-expense mt-1.5 font-medium">{errors.amount.message}</p>
          )}
        </div>

        {/* Currency Dropdown */}
        <div>
          <label htmlFor="currency" className="block text-xs font-semibold uppercase tracking-wider text-text-secondaryLight dark:text-text-secondaryDark mb-2">
            Currency
          </label>
          <div className="relative">
            <select
              id="currency"
              disabled={isPending}
              className={`w-full pl-4 pr-10 py-3 rounded-xl border bg-slate-50 dark:bg-[#111622] text-sm focus:outline-none focus:ring-1 transition-all appearance-none ${
                errors.currency
                  ? 'border-finance-expense/30 focus:border-finance-expense focus:ring-finance-expense'
                  : 'border-border-light dark:border-border-dark focus:border-brand-primary focus:ring-brand-primary'
              }`}
              {...register('currency')}
            >
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
              <option value="INR">INR (₹)</option>
              <option value="CAD">CAD (C$)</option>
              <option value="AUD">AUD (A$)</option>
              <option value="JPY">JPY (¥)</option>
              <option value="CNY">CNY (¥)</option>
              <option value="SGD">SGD (S$)</option>
              <option value="AED">AED (د.إ)</option>
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-text-secondaryLight dark:text-text-secondaryDark">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </div>
          </div>
          {errors.currency && (
            <p className="text-xs text-finance-expense mt-1.5 font-medium">{errors.currency.message}</p>
          )}
        </div>
      </div>

      {/* Date Ranges */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Start Date */}
        <div>
          <label htmlFor="startDate" className="block text-xs font-semibold uppercase tracking-wider text-text-secondaryLight dark:text-text-secondaryDark mb-2">
            Start Date
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-secondaryLight/50 dark:text-text-secondaryDark/40">
              <Calendar className="w-4 h-4" />
            </div>
            <input
              id="startDate"
              type="date"
              disabled={isPending}
              className={`w-full pl-9 pr-3 py-3 rounded-xl border bg-slate-50 dark:bg-[#111622] text-sm focus:outline-none focus:ring-1 transition-all ${
                errors.startDate
                  ? 'border-finance-expense/30 focus:border-finance-expense focus:ring-finance-expense'
                  : 'border-border-light dark:border-border-dark focus:border-brand-primary focus:ring-brand-primary'
              }`}
              {...register('startDate')}
            />
          </div>
          {errors.startDate && (
            <p className="text-xs text-finance-expense mt-1.5 font-medium">{errors.startDate.message}</p>
          )}
        </div>

        {/* End Date */}
        <div>
          <label htmlFor="endDate" className="block text-xs font-semibold uppercase tracking-wider text-text-secondaryLight dark:text-text-secondaryDark mb-2">
            End Date
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-secondaryLight/50 dark:text-text-secondaryDark/40">
              <Calendar className="w-4 h-4" />
            </div>
            <input
              id="endDate"
              type="date"
              disabled={isPending}
              className={`w-full pl-9 pr-3 py-3 rounded-xl border bg-slate-50 dark:bg-[#111622] text-sm focus:outline-none focus:ring-1 transition-all ${
                errors.endDate
                  ? 'border-finance-expense/30 focus:border-finance-expense focus:ring-finance-expense'
                  : 'border-border-light dark:border-border-dark focus:border-brand-primary focus:ring-brand-primary'
              }`}
              {...register('endDate')}
            />
          </div>
          {errors.endDate && (
            <p className="text-xs text-finance-expense mt-1.5 font-medium">{errors.endDate.message}</p>
          )}
        </div>
      </div>

      {/* Buttons */}
      <div className="flex justify-end gap-3 pt-3 border-t border-border-light dark:border-border-dark mt-6">
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="px-4 py-3 rounded-xl border border-border-light dark:border-border-dark text-xs font-semibold hover:bg-slate-50 dark:hover:bg-[#111622] transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="px-5 py-3 rounded-xl bg-brand-primary text-white text-xs font-semibold flex items-center gap-1.5 hover:bg-emerald-600 transition-all disabled:opacity-50"
        >
          {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          <span>{initialData ? 'Save Changes' : 'Setup Budget'}</span>
        </button>
      </div>
    </form>
  );
};
export default BudgetForm;
