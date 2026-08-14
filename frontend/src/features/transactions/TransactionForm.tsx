import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCategories } from '../../services/transactions';
import { useAuth } from '../../context/AuthContext';
import { Loader2, DollarSign, Calendar, Tag, CreditCard, Sparkles } from 'lucide-react';

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
  const preferredCurrency = user?.preferredCurrency || 'USD';

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

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 text-left">
      {/* Transaction Type Segment */}
      <div className="grid grid-cols-2 gap-3 p-1 rounded-xl bg-slate-100 dark:bg-[#111622] border border-border-light dark:border-border-dark">
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

      {/* Amount & Currency Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Amount Input */}
        <div>
          <label htmlFor="amount" className="block text-xs font-semibold uppercase tracking-wider text-text-secondaryLight dark:text-text-secondaryDark mb-2">
            Amount
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

      {/* Date & Category Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Date Input */}
        <div>
          <label htmlFor="date" className="block text-xs font-semibold uppercase tracking-wider text-text-secondaryLight dark:text-text-secondaryDark mb-2">
            Date
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-secondaryLight/50 dark:text-text-secondaryDark/40">
              <Calendar className="w-4 h-4" />
            </div>
            <input
              id="date"
              type="date"
              disabled={isPending}
              className={`w-full pl-9 pr-3 py-3 rounded-xl border bg-slate-50 dark:bg-[#111622] text-sm focus:outline-none focus:ring-1 transition-all ${
                errors.date
                  ? 'border-finance-expense/30 focus:border-finance-expense focus:ring-finance-expense'
                  : 'border-border-light dark:border-border-dark focus:border-brand-primary focus:ring-brand-primary'
              }`}
              {...register('date')}
            />
          </div>
          {errors.date && (
            <p className="text-xs text-finance-expense mt-1.5 font-medium">{errors.date.message}</p>
          )}
        </div>

        {/* Category Dropdown */}
        <div>
          <label htmlFor="categoryId" className="block text-xs font-semibold uppercase tracking-wider text-text-secondaryLight dark:text-text-secondaryDark mb-2">
            Category
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-secondaryLight/50 dark:text-text-secondaryDark/40">
              <Tag className="w-4 h-4" />
            </div>
            <select
              id="categoryId"
              disabled={isPending || categoriesLoading}
              className={`w-full pl-9 pr-3 py-3 rounded-xl border bg-slate-50 dark:bg-[#111622] text-sm focus:outline-none focus:ring-1 transition-all appearance-none ${
                errors.categoryId
                  ? 'border-finance-expense/30 focus:border-finance-expense focus:ring-finance-expense'
                  : 'border-border-light dark:border-border-dark focus:border-brand-primary focus:ring-brand-primary'
              }`}
              {...register('categoryId')}
            >
              <option value="">-- Choose Category --</option>
              {categories
                .filter((cat: any) => cat.type === transactionType)
                .map((cat: any) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
            </select>
            {categoriesLoading && (
              <div className="absolute inset-y-0 right-3 flex items-center">
                <Loader2 className="w-4 h-4 animate-spin text-text-secondaryDark" />
              </div>
            )}
          </div>
          {errors.categoryId && (
            <p className="text-xs text-finance-expense mt-1.5 font-medium">{errors.categoryId.message}</p>
          )}
        </div>
      </div>

      {/* Merchant & Payment Method Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Merchant */}
        <div>
          <label htmlFor="merchant" className="block text-xs font-semibold uppercase tracking-wider text-text-secondaryLight dark:text-text-secondaryDark mb-2">
            Merchant / Payee
          </label>
          <input
            id="merchant"
            type="text"
            placeholder="Starbucks, Landlord..."
            disabled={isPending}
            className="w-full px-4 py-3 rounded-xl border border-border-light dark:border-border-dark bg-slate-50 dark:bg-[#111622] text-sm focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 transition-all"
            {...register('merchant')}
          />
        </div>

        {/* Payment Method */}
        <div>
          <label htmlFor="paymentMethod" className="block text-xs font-semibold uppercase tracking-wider text-text-secondaryLight dark:text-text-secondaryDark mb-2">
            Payment Method
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-secondaryLight/50 dark:text-text-secondaryDark/40">
              <CreditCard className="w-4 h-4" />
            </div>
            <select
              id="paymentMethod"
              disabled={isPending}
              className="w-full pl-9 pr-3 py-3 rounded-xl border border-border-light dark:border-border-dark bg-slate-50 dark:bg-[#111622] text-sm focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 transition-all appearance-none"
              {...register('paymentMethod')}
            >
              <option value="Card">Credit/Debit Card</option>
              <option value="Cash">Cash</option>
              <option value="UPI">UPI / Instant Pay</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="Others">Others</option>
            </select>
          </div>
        </div>
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className="block text-xs font-semibold uppercase tracking-wider text-text-secondaryLight dark:text-text-secondaryDark mb-2">
          Description / Note
        </label>
        <textarea
          id="description"
          rows={2}
          placeholder="Add details about this transaction..."
          disabled={isPending}
          className="w-full px-4 py-3 rounded-xl border border-border-light dark:border-border-dark bg-slate-50 dark:bg-[#111622] text-sm focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 transition-all resize-none"
          {...register('description')}
        />
      </div>

      {/* Recurring Subscription Toggle */}
      {transactionType === 'EXPENSE' && (
        <div className="flex items-center justify-between p-3 rounded-xl border border-border-light dark:border-border-dark bg-slate-50/50 dark:bg-[#111622]/40">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-brand-secondary" />
            <div className="text-left">
              <p className="text-xs font-bold">Mark as Subscription</p>
              <p className="text-[10px] text-text-secondaryLight dark:text-text-secondaryDark">Is this a recurring billing expense?</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              disabled={isPending}
              {...register('isSubscription')}
            />
            <div className="w-9 h-5 bg-slate-200 dark:bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-primary"></div>
          </label>
        </div>
      )}

      {/* Action Buttons */}
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
          className="px-5 py-3 rounded-xl bg-brand-primary text-white text-xs font-semibold flex items-center gap-1.5 hover:bg-emerald-600 transition-all disabled:opacity-50 disabled:pointer-events-none"
        >
          {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          <span>{isEditMode ? 'Save Changes' : 'Add Transaction'}</span>
        </button>
      </div>
    </form>
  );
};
export default TransactionForm;
