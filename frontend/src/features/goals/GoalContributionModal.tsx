import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, DollarSign, Calendar } from 'lucide-react';

const contributionFormSchema = z.object({
  amount: z.coerce
    .number({ required_error: 'Contribution amount is required' })
    .positive({ message: 'Contribution amount must be a positive number' }),
  date: z.string().min(1, { message: 'Date is required' }),
});

type ContributionFormValues = z.infer<typeof contributionFormSchema>;

interface GoalContributionModalProps {
  onSubmit: (values: any) => void;
  isPending: boolean;
  onCancel: () => void;
}

export const GoalContributionModal: React.FC<GoalContributionModalProps> = ({
  onSubmit,
  isPending,
  onCancel,
}) => {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ContributionFormValues>({
    resolver: zodResolver(contributionFormSchema),
    defaultValues: {
      amount: undefined as any,
      date: new Date().toISOString().split('T')[0],
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 text-left">
      {/* Amount */}
      <div>
        <label htmlFor="amount" className="block text-xs font-semibold uppercase tracking-wider text-text-secondaryLight dark:text-text-secondaryDark mb-2">
          Savings Contribution Amount
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

      {/* Date */}
      <div>
        <label htmlFor="date" className="block text-xs font-semibold uppercase tracking-wider text-text-secondaryLight dark:text-text-secondaryDark mb-2">
          Contribution Date
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-secondaryLight/50 dark:text-text-secondaryDark/40">
            <Calendar className="w-4 h-4" />
          </div>
          <input
            id="date"
            type="date"
            disabled={isPending}
            className="w-full pl-9 pr-3 py-3 rounded-xl border border-border-light dark:border-border-dark bg-slate-50 dark:bg-[#111622] text-sm focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 transition-all"
            {...register('date')}
          />
        </div>
        {errors.date && (
          <p className="text-xs text-finance-expense mt-1.5 font-medium">{errors.date.message}</p>
        )}
      </div>

      {/* Action Controls */}
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
          <span>Contribute Funds</span>
        </button>
      </div>
    </form>
  );
};
export default GoalContributionModal;
