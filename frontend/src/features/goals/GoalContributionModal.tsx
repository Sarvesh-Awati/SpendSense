import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { currencySymbol, FALLBACK_CURRENCY } from '../../utils/formatCurrency';
import { Field, controlClasses } from '../../components/ui/Field';
import Button from '../../components/ui/Button';

/**
 * Amount only.
 *
 * This form used to collect a contribution date as well, and then throw it
 * away: `POST /goals/:id/contribute` accepts `{ amount }` and nothing else,
 * because contributions are applied as an atomic increment to the goal's
 * balance rather than recorded as dated rows. Asking for a date the system
 * cannot honour is worse than not asking — the user reasonably believes they
 * are backdating a contribution. Restoring the field belongs with a proper
 * append-only contribution ledger, not before it.
 */
const contributionFormSchema = z.object({
  amount: z.coerce
    .number({ required_error: 'Contribution amount is required' })
    .positive({ message: 'Contribution amount must be a positive number' }),
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
    },
  });

  const symbol = currencySymbol(currency);

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-4 text-left">
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
