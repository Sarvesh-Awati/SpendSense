import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../../context/AuthContext';
import { Loader2, DollarSign, Calendar, Target } from 'lucide-react';

const goalFormSchema = z.object({
  name: z.string().min(1, { message: 'Goal name is required' }),
  targetAmount: z.coerce
    .number({ required_error: 'Target amount is required' })
    .positive({ message: 'Target amount must be a positive number' }),
  currentAmount: z.coerce.number().nonnegative().optional().default(0),
  targetDate: z.string().optional().nullable().refine(
    (val) => {
      if (!val) return true;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return new Date(val) >= today;
    },
    { message: 'Target date must be today or later' }
  ),
  currency: z.string().min(1, { message: 'Currency is required' }),
});

type GoalFormValues = z.infer<typeof goalFormSchema>;

interface GoalFormProps {
  initialData?: any;
  onSubmit: (values: any) => void;
  isPending: boolean;
  onCancel: () => void;
}

export const GoalForm: React.FC<GoalFormProps> = ({
  initialData,
  onSubmit,
  isPending,
  onCancel,
}) => {
  const formatInputDate = (dateString?: string | null) => {
    if (!dateString) return '';
    const dateObj = new Date(dateString);
    return isNaN(dateObj.getTime()) ? '' : dateObj.toISOString().split('T')[0];
  };

  const { user } = useAuth();
  const preferredCurrency = user?.preferredCurrency || 'USD';

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<GoalFormValues>({
    resolver: zodResolver(goalFormSchema),
    defaultValues: {
      name: initialData?.name || '',
      targetAmount: initialData?.targetAmount ? Number(initialData.targetAmount) : undefined as any,
      currentAmount: initialData?.currentAmount ? Number(initialData.currentAmount) : 0,
      targetDate: formatInputDate(initialData?.targetDate),
      currency: initialData?.currency || preferredCurrency,
    },
  });

  const handleFormSubmit = (values: GoalFormValues) => {
    const payload = {
      ...values,
      targetDate: values.targetDate === '' ? null : values.targetDate,
    };
    onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4 text-left">
      {/* Goal Name */}
      <div>
        <label htmlFor="name" className="block text-xs font-semibold uppercase tracking-wider text-text-secondaryLight dark:text-text-secondaryDark mb-2">
          Milestone / Goal Name
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-secondaryLight/50 dark:text-text-secondaryDark/40">
            <Target className="w-4.5 h-4.5" />
          </div>
          <input
            id="name"
            type="text"
            placeholder="e.g. Tesla Model S, Emergency Fund"
            disabled={isPending}
            className={`w-full pl-11 pr-4 py-3 rounded-xl border bg-slate-50 dark:bg-[#111622] text-sm focus:outline-none focus:ring-1 transition-all ${
              errors.name
                ? 'border-finance-expense/30 focus:border-finance-expense focus:ring-finance-expense'
                : 'border-border-light dark:border-border-dark focus:border-brand-primary focus:ring-brand-primary'
            }`}
            {...register('name')}
          />
        </div>
        {errors.name && (
          <p className="text-xs text-finance-expense mt-1.5 font-medium">{errors.name.message}</p>
        )}
      </div>

      {/* Target Amount & Currency */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Target Amount */}
        <div>
          <label htmlFor="targetAmount" className="block text-xs font-semibold uppercase tracking-wider text-text-secondaryLight dark:text-text-secondaryDark mb-2">
            Target Amount Needed
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-secondaryLight/50 dark:text-text-secondaryDark/40">
              <DollarSign className="w-5 h-5" />
            </div>
            <input
              id="targetAmount"
              type="number"
              step="0.01"
              placeholder="0.00"
              disabled={isPending}
              className={`w-full pl-11 pr-4 py-3 rounded-xl border bg-slate-50 dark:bg-[#111622] text-sm focus:outline-none focus:ring-1 transition-all ${
                errors.targetAmount
                  ? 'border-finance-expense/30 focus:border-finance-expense focus:ring-finance-expense'
                  : 'border-border-light dark:border-border-dark focus:border-brand-primary focus:ring-brand-primary'
              }`}
              {...register('targetAmount')}
            />
          </div>
          {errors.targetAmount && (
            <p className="text-xs text-finance-expense mt-1.5 font-medium">{errors.targetAmount.message}</p>
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

      {/* Current Saved Amount (Only show on creation, hide on edit) */}
      {!initialData && (
        <div>
          <label htmlFor="currentAmount" className="block text-xs font-semibold uppercase tracking-wider text-text-secondaryLight dark:text-text-secondaryDark mb-2">
            Initial Saved Amount (Optional)
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-secondaryLight/50 dark:text-text-secondaryDark/40">
              <DollarSign className="w-5 h-5" />
            </div>
            <input
              id="currentAmount"
              type="number"
              step="0.01"
              placeholder="0.00"
              disabled={isPending}
              className={`w-full pl-11 pr-4 py-3 rounded-xl border bg-slate-50 dark:bg-[#111622] text-sm focus:outline-none focus:ring-1 transition-all ${
                errors.currentAmount
                  ? 'border-finance-expense/30 focus:border-finance-expense focus:ring-finance-expense'
                  : 'border-border-light dark:border-border-dark focus:border-brand-primary focus:ring-brand-primary'
              }`}
              {...register('currentAmount')}
            />
          </div>
          {errors.currentAmount && (
            <p className="text-xs text-finance-expense mt-1.5 font-medium">{errors.currentAmount.message}</p>
          )}
        </div>
      )}

      {/* Target Date */}
      <div>
        <label htmlFor="targetDate" className="block text-xs font-semibold uppercase tracking-wider text-text-secondaryLight dark:text-text-secondaryDark mb-2">
          Target Date (Optional)
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-secondaryLight/50 dark:text-text-secondaryDark/40">
            <Calendar className="w-4 h-4" />
          </div>
          <input
            id="targetDate"
            type="date"
            disabled={isPending}
            className={`w-full pl-9 pr-3 py-3 rounded-xl border bg-slate-50 dark:bg-[#111622] text-sm focus:outline-none focus:ring-1 transition-all ${
              errors.targetDate
                ? 'border-finance-expense/30 focus:border-finance-expense focus:ring-finance-expense'
                : 'border-border-light dark:border-border-dark focus:border-brand-primary focus:ring-brand-primary'
            }`}
            {...register('targetDate')}
          />
        </div>
        {errors.targetDate && (
          <p className="text-xs text-finance-expense mt-1.5 font-medium">{errors.targetDate.message}</p>
        )}
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
          <span>{initialData ? 'Save Changes' : 'Create Goal'}</span>
        </button>
      </div>
    </form>
  );
};
export default GoalForm;
