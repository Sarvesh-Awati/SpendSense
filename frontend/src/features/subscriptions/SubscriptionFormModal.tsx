import React, { useEffect } from 'react';
import { useForm as useRHForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Loader2, Calendar, DollarSign, Tag, RefreshCw } from 'lucide-react';
import { SubscriptionRecord, SubscriptionFrequency } from '../../services/subscriptions';
import { useCategories } from '../../services/transactions';
import { useAuth } from '../../context/AuthContext';

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
}

export const SubscriptionFormModal: React.FC<SubscriptionFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  isPending,
}) => {
  const { data: categoriesResponse } = useCategories();
  const categories = categoriesResponse?.data?.categories || [];
  const expenseCategories = categories.filter((c: any) => c.type === 'EXPENSE');

  const { user } = useAuth();
  const preferredCurrency = user?.preferredCurrency || 'USD';

  const { register, handleSubmit, reset, formState: { errors } } = useRHForm<FormData>({
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-md bg-white dark:bg-card-dark rounded-2xl shadow-premium dark:shadow-premium-dark border border-border-light dark:border-border-dark overflow-hidden animate-fade-in-up">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border-light dark:border-border-dark">
          <div>
            <h2 className="font-outfit text-xl font-bold">
              {initialData ? 'Edit Subscription' : 'New Subscription'}
            </h2>
            <p className="text-xs text-text-secondaryLight dark:text-text-secondaryDark mt-1">
              {initialData ? 'Update recurring payment details' : 'Track a new recurring payment'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-[#111622] transition-colors"
          >
            <X className="w-5 h-5 text-text-secondaryLight" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4 text-left">
          
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondaryLight dark:text-text-secondaryDark mb-2">Name</label>
            <input
              type="text"
              {...register('name')}
              placeholder="e.g., Netflix, Gym, Spotify"
              className={`w-full px-4 py-3 rounded-xl border bg-slate-50 dark:bg-[#111622] text-sm focus:outline-none focus:ring-1 transition-all ${
                errors.name
                  ? 'border-finance-expense/30 focus:border-finance-expense focus:ring-finance-expense'
                  : 'border-border-light dark:border-border-dark focus:border-brand-primary focus:ring-brand-primary'
              }`}
            />
            {errors.name && <p className="text-finance-expense text-xs mt-1.5 font-medium">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondaryLight dark:text-text-secondaryDark mb-2">Amount</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-secondaryLight/50 dark:text-text-secondaryDark/40">
                  <DollarSign className="h-4 w-4" />
                </div>
                <input
                  type="number"
                  step="0.01"
                  {...register('amount', { valueAsNumber: true })}
                  placeholder="0.00"
                  className={`w-full pl-11 pr-4 py-3 rounded-xl border bg-slate-50 dark:bg-[#111622] text-sm focus:outline-none focus:ring-1 transition-all ${
                    errors.amount
                      ? 'border-finance-expense/30 focus:border-finance-expense focus:ring-finance-expense'
                      : 'border-border-light dark:border-border-dark focus:border-brand-primary focus:ring-brand-primary'
                  }`}
                />
              </div>
              {errors.amount && <p className="text-finance-expense text-xs mt-1.5 font-medium">{errors.amount.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondaryLight dark:text-text-secondaryDark mb-2">Currency</label>
              <div className="relative">
                <select
                  {...register('currency')}
                  className={`w-full pl-4 pr-10 py-3 rounded-xl border bg-slate-50 dark:bg-[#111622] text-sm focus:outline-none focus:ring-1 transition-all appearance-none ${
                    errors.currency
                      ? 'border-finance-expense/30 focus:border-finance-expense focus:ring-finance-expense'
                      : 'border-border-light dark:border-border-dark focus:border-brand-primary focus:ring-brand-primary'
                  }`}
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
              {errors.currency && <p className="text-finance-expense text-xs mt-1.5 font-medium">{errors.currency.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondaryLight dark:text-text-secondaryDark mb-2">Frequency</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-secondaryLight/50 dark:text-text-secondaryDark/40">
                  <RefreshCw className="h-4 w-4" />
                </div>
                <select
                  {...register('frequency')}
                  className={`w-full pl-11 pr-4 py-3 rounded-xl border bg-slate-50 dark:bg-[#111622] text-sm focus:outline-none focus:ring-1 transition-all appearance-none ${
                    errors.frequency
                      ? 'border-finance-expense/30 focus:border-finance-expense focus:ring-finance-expense'
                      : 'border-border-light dark:border-border-dark focus:border-brand-primary focus:ring-brand-primary'
                  }`}
                >
                  <option value={SubscriptionFrequency.WEEKLY}>Weekly</option>
                  <option value={SubscriptionFrequency.MONTHLY}>Monthly</option>
                  <option value={SubscriptionFrequency.YEARLY}>Yearly</option>
                </select>
              </div>
              {errors.frequency && <p className="text-finance-expense text-xs mt-1.5 font-medium">{errors.frequency.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondaryLight dark:text-text-secondaryDark mb-2">Start Date</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-secondaryLight/50 dark:text-text-secondaryDark/40">
                  <Calendar className="h-4 w-4" />
                </div>
                <input
                  type="date"
                  {...register('startDate')}
                  className={`w-full pl-11 pr-4 py-3 rounded-xl border bg-slate-50 dark:bg-[#111622] text-sm focus:outline-none focus:ring-1 transition-all ${
                    errors.startDate
                      ? 'border-finance-expense/30 focus:border-finance-expense focus:ring-finance-expense'
                      : 'border-border-light dark:border-border-dark focus:border-brand-primary focus:ring-brand-primary'
                  }`}
                />
              </div>
              {errors.startDate && <p className="text-finance-expense text-xs mt-1.5 font-medium">{errors.startDate.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondaryLight dark:text-text-secondaryDark mb-2">Category</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-secondaryLight/50 dark:text-text-secondaryDark/40">
                  <Tag className="h-4 w-4" />
                </div>
                <select
                  {...register('categoryId')}
                  className={`w-full pl-11 pr-4 py-3 rounded-xl border bg-slate-50 dark:bg-[#111622] text-sm focus:outline-none focus:ring-1 transition-all appearance-none ${
                    errors.categoryId
                      ? 'border-finance-expense/30 focus:border-finance-expense focus:ring-finance-expense'
                      : 'border-border-light dark:border-border-dark focus:border-brand-primary focus:ring-brand-primary'
                  }`}
                >
                  <option value="">Uncategorized</option>
                  {expenseCategories.map((cat: any) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              {errors.categoryId && <p className="text-finance-expense text-xs mt-1.5 font-medium">{errors.categoryId.message}</p>}
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl border border-border-light dark:border-border-dark bg-slate-50/50 dark:bg-[#111622]/40 mt-2">
            <div className="text-left">
              <p className="text-xs font-bold">Subscription is Active</p>
              <p className="text-[10px] text-text-secondaryLight dark:text-text-secondaryDark">Uncheck to pause tracking this subscription</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                disabled={isPending}
                {...register('isActive')}
              />
              <div className="w-9 h-5 bg-slate-200 dark:bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-primary"></div>
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-border-light dark:border-border-dark mt-6">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-4 py-3 rounded-xl border border-border-light dark:border-border-dark text-xs font-semibold hover:bg-slate-50 dark:hover:bg-[#111622] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-5 py-3 rounded-xl bg-brand-primary text-white text-xs font-semibold flex items-center gap-1.5 hover:bg-emerald-600 transition-all disabled:opacity-50 disabled:pointer-events-none"
            >
              {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{initialData ? 'Save Changes' : 'Add Subscription'}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};

export default SubscriptionFormModal;
