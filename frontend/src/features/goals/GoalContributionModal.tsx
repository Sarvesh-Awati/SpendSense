import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { currencySymbol, FALLBACK_CURRENCY } from '../../utils/formatCurrency';
import { Field, Input, controlClasses } from '../../components/ui/Field';
import Button from '../../components/ui/Button';

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
  /**
   * The goal's own currency. Contributions are recorded against the goal, so
   * the amount field must show that goal's symbol — it previously showed a
   * fixed "$" regardless of the goal's currency.
   */
  currency?: string;
}

export const GoalContributionModal: React.FC<GoalContributionModalProps> = ({
  onSubmit,
  isPending,
  onCancel,
  currency = FALLBACK_CURRENCY,
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

  const symbol = currencySymbol(currency);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 text-left">
      <Field
        label="Savings Contribution Amount"
        error={errors.amount?.message}
        disabled={isPending}
      >
        {(ids) => (
          <div className="relative">
            <span
              aria-hidden="true"
              className={`absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-secondaryLight/60 dark:text-text-secondaryDark/50 ${
                symbol.length > 1 ? 'text-[11px]' : 'text-sm'
              }`}
            >
              {symbol}
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

      <Field label="Contribution Date" error={errors.date?.message} disabled={isPending}>
        {(ids) => <Input {...ids} type="date" hasError={!!errors.date} {...register('date')} />}
      </Field>

      <div className="flex justify-end gap-3 pt-3 border-t border-border-light dark:border-border-dark mt-6">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" loading={isPending}>
          Contribute Funds
        </Button>
      </div>
    </form>
  );
};

export default GoalContributionModal;
