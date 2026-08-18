import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../../context/AuthContext';
import {
  FALLBACK_CURRENCY,
  currencySymbol,
} from '../../utils/formatCurrency';
import { Field, Input, controlClasses } from '../../components/ui/Field';
import Button from '../../components/ui/Button';
import { Target } from 'lucide-react';

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
  const preferredCurrency = user?.preferredCurrency || FALLBACK_CURRENCY;
  /** The account's reporting currency. Not user-selectable here — see below. */
  const accountCurrency = preferredCurrency;

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
      <Field label="Milestone / Goal Name" error={errors.name?.message} disabled={isPending}>
        {(ids) => (
          <Input
            {...ids}
            type="text"
            placeholder="e.g. Tesla Model S, Emergency Fund"
            icon={Target}
            hasError={!!errors.name}
            {...register('name')}
          />
        )}
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Target Amount Needed" error={errors.targetAmount?.message} disabled={isPending}>
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
                className={controlClasses(!!errors.targetAmount, true)}
                {...register('targetAmount')}
              />
            </div>
          )}
        </Field>

        {/*
          Read-only, deliberately.

          This was a full currency picker, but the API ignores whatever it
          sends: Goals are always denominated in the account's reporting
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

      {/* Only offered at creation time; editing a goal uses the contribute flow. */}
      {!initialData && (
        <Field
          label="Initial Saved Amount (Optional)"
          error={errors.currentAmount?.message}
          disabled={isPending}
        >
          {(ids) => (
            <div className="relative">
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
                className={controlClasses(!!errors.currentAmount, true)}
                {...register('currentAmount')}
              />
            </div>
          )}
        </Field>
      )}

      <Field label="Target Date (Optional)" error={errors.targetDate?.message} disabled={isPending}>
        {(ids) => (
          <Input {...ids} type="date" hasError={!!errors.targetDate} {...register('targetDate')} />
        )}
      </Field>

      <div className="flex justify-end gap-3 pt-3 border-t border-border-light dark:border-border-dark mt-6">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" loading={isPending}>
          {initialData ? 'Save Changes' : 'Create Goal'}
        </Button>
      </div>
    </form>
  );
};
export default GoalForm;
