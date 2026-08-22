import React, { useEffect } from 'react';
import { useForm as useRHForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { SubscriptionRecord, SubscriptionFrequency } from '../../services/subscriptions';
import { useCategories } from '../../services/transactions';
import { useAuth } from '../../context/AuthContext';
import {
  FALLBACK_CURRENCY,
  SUPPORTED_CURRENCIES,
  currencySymbol,
} from '../../utils/formatCurrency';
import { Field, Input, Select, controlClasses } from '../../components/ui/Field';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  amount: z.number({ invalid_type_error: 'Amount is required' }).positive('Must be greater than 0'),
  frequency: z.nativeEnum(SubscriptionFrequency),
  startDate: z.string().min(1, 'Start date is required'),
  categoryId: z.string().optional().nullable(),
  isActive: z.boolean(),
  currency: z.string().min(1, 'Currency is required'),
});

type FormData = z.infer<typeof schema>;

interface SubscriptionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  initialData?: SubscriptionRecord | null;
  isPending: boolean;
  /** Focus target when the dialog closes; forwarded straight to Modal. */
  returnFocusRef?: React.RefObject<HTMLElement>;
}

export const SubscriptionFormModal: React.FC<SubscriptionFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  isPending,
  returnFocusRef,
}) => {
  const { data: categoriesResponse } = useCategories();
  const categories = categoriesResponse?.data?.categories || [];
  const expenseCategories = categories.filter((c: any) => c.type === 'EXPENSE');

  const { user } = useAuth();
  const preferredCurrency = user?.preferredCurrency || FALLBACK_CURRENCY;

  const { register, handleSubmit, reset, watch, formState: { errors } } = useRHForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      amount: undefined,
      frequency: SubscriptionFrequency.MONTHLY,
      startDate: new Date().toISOString().split('T')[0],
      categoryId: '',
      isActive: true,
      currency: preferredCurrency,
    },
  });

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        reset({
          name: initialData.name,
          amount: initialData.amount,
          frequency: initialData.frequency,
          startDate: initialData.startDate.split('T')[0],
          categoryId: initialData.categoryId || '',
          isActive: initialData.isActive,
          currency: initialData.currency || preferredCurrency,
        });
      } else {
        reset({
          name: '',
          amount: undefined,
          frequency: SubscriptionFrequency.MONTHLY,
          startDate: new Date().toISOString().split('T')[0],
          categoryId: '',
          isActive: true,
          currency: preferredCurrency,
        });
      }
    }
  }, [isOpen, initialData, reset]);

  /**
   * "Uncategorized" is an empty <option>, which submitted `categoryId: ""`.
   * The API accepts a UUID or null (the column is nullable) and rejected the
   * empty string with a 400, so creating an uncategorised subscription always
   * failed. Normalise to null here; every other field is passed through
   * untouched.
   */
  const submitNormalized = (data: FormData) =>
    onSubmit({ ...data, categoryId: data.categoryId ? data.categoryId : null });

  return (
    // The shared Modal owns the overlay, header, close button, focus trap,
    // Escape, focus restoration and scroll lock. The form below is unchanged.
    <Modal
      open={isOpen}
      onClose={onClose}
      returnFocusRef={returnFocusRef}
      title={initialData ? 'Edit Subscription' : 'New Subscription'}
      description={
        initialData ? 'Update recurring payment details' : 'Track a new recurring payment'
      }
      size="md"
    >
      {/* Footer actions stay inside the form so submit still works. */}
      <form noValidate onSubmit={handleSubmit(submitNormalized)} className="space-y-4 text-left">
        <Field label="Name" error={errors.name?.message} disabled={isPending}>
          {(ids) => (
            <Input
              {...ids}
              type="text"
              placeholder="e.g., Netflix, Gym, Spotify"
              hasError={!!errors.name}
              {...register('name')}
            />
          )}
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Amount" error={errors.amount?.message} disabled={isPending}>
            {(ids) => (
              <div className="relative">
                {/* Reflects the selected currency, not a fixed dollar glyph. */}
                <span
                  aria-hidden="true"
                  className={`absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-secondaryLight/60 dark:text-text-secondaryDark/50 ${
                    currencySymbol(watch('currency')).length > 1 ? 'text-[11px]' : 'text-sm'
                  }`}
                >
                  {currencySymbol(watch('currency'))}
                </span>
                <input
                  {...ids}
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  className={controlClasses(!!errors.amount, true)}
                  {...register('amount', { valueAsNumber: true })}
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

        <div className="grid grid-cols-2 gap-4">
          <Field label="Frequency" error={errors.frequency?.message} disabled={isPending}>
            {(ids) => (
              <Select {...ids} hasError={!!errors.frequency} {...register('frequency')}>
                <option value={SubscriptionFrequency.WEEKLY}>Weekly</option>
                <option value={SubscriptionFrequency.MONTHLY}>Monthly</option>
                <option value={SubscriptionFrequency.YEARLY}>Yearly</option>
              </Select>
            )}
          </Field>

          <Field label="Start Date" error={errors.startDate?.message} disabled={isPending}>
            {(ids) => (
              <Input {...ids} type="date" hasError={!!errors.startDate} {...register('startDate')} />
            )}
          </Field>
        </div>

        <Field label="Category" error={errors.categoryId?.message} disabled={isPending}>
          {(ids) => (
            <Select {...ids} hasError={!!errors.categoryId} {...register('categoryId')}>
              <option value="">Uncategorized</option>
              {expenseCategories.map((cat: any) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <div className="flex items-center justify-between p-3 rounded-control border border-border-light dark:border-border-dark bg-slate-50/50 dark:bg-surface-sunk/40 mt-2">
          <div className="text-left">
            <p className="text-xs font-bold">Subscription is Active</p>
            <p className="text-[10px] text-text-secondaryLight dark:text-text-secondaryDark">
              Uncheck to pause tracking this subscription
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              disabled={isPending}
              {...register('isActive')}
            />
            <span className="sr-only">Subscription is active</span>
            <div className="w-9 h-5 bg-slate-200 dark:bg-slate-800 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-primary/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-primary"></div>
          </label>
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t border-border-light dark:border-border-dark mt-6">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" loading={isPending}>
            {initialData ? 'Save Changes' : 'Add Subscription'}
          </Button>
        </div>
        </form>
    </Modal>
  );
};

export default SubscriptionFormModal;
