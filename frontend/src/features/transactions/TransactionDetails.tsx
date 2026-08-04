import React from 'react';
import { Calendar, CreditCard, Tag, Sparkles, RefreshCw, FileText, CheckCircle2, User, X } from 'lucide-react';
import { formatCurrency } from '../../utils/formatCurrency';

interface TransactionDetailsProps {
  transaction: any;
  onClose: () => void;
}

export const TransactionDetails: React.FC<TransactionDetailsProps> = ({
  transaction,
  onClose,
}) => {
  const isIncome = transaction.type === 'INCOME';
  const categoryName = transaction.category?.name || 'Uncategorized';
  const categoryColor = transaction.category?.color || '#cbd5e1';

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrencyLocal = (amount: number, currency: string) => {
    return formatCurrency(amount, currency);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Dark backdrop overlay */}
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal box */}
      <div className="bg-white dark:bg-card-dark rounded-3xl border border-border-light dark:border-border-dark shadow-premium-dark w-full max-w-md relative overflow-hidden animate-slide-up pointer-events-auto text-left">
        {/* Banner with Category Theme */}
        <div className="h-3 w-full" style={{ backgroundColor: categoryColor }} />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-xl border border-border-light dark:border-border-dark bg-white dark:bg-[#111622] text-text-secondaryLight dark:text-text-secondaryDark hover:text-text-primaryLight dark:hover:text-text-primaryDark transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-8">
          {/* Amount Segment */}
          <div className="text-center mb-6">
            <span className="text-[10px] uppercase font-bold tracking-wider text-text-secondaryLight dark:text-text-secondaryDark block mb-1">
              Transaction Amount
            </span>
            <h2 className={`font-outfit text-3xl font-extrabold tracking-tight ${
              isIncome ? 'text-finance-income' : 'text-text-primaryLight dark:text-text-primaryDark'
            }`}>
              {isIncome ? '+' : '-'} {formatCurrencyLocal(Number(transaction.amount), transaction.currency)}
            </h2>
          </div>

          {/* Details list */}
          <div className="space-y-4">
            {/* Merchant */}
            <div className="flex gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-[#111622] flex items-center justify-center text-text-secondaryLight flex-shrink-0">
                <User className="w-4.5 h-4.5" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold tracking-wider text-text-secondaryLight dark:text-text-secondaryDark">Merchant / Payee</p>
                <p className="text-sm font-semibold mt-0.5">{transaction.merchant || 'Unknown'}</p>
              </div>
            </div>

            {/* Category */}
            <div className="flex gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-[#111622] flex items-center justify-center text-text-secondaryLight flex-shrink-0">
                <Tag className="w-4.5 h-4.5" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold tracking-wider text-text-secondaryLight dark:text-text-secondaryDark">Category</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold"
                    style={{
                      backgroundColor: `${categoryColor}15`,
                      color: categoryColor,
                      border: `1px solid ${categoryColor}25`,
                    }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: categoryColor }} />
                    {categoryName}
                  </span>
                </div>
              </div>
            </div>

            {/* Date */}
            <div className="flex gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-[#111622] flex items-center justify-center text-text-secondaryLight flex-shrink-0">
                <Calendar className="w-4.5 h-4.5" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold tracking-wider text-text-secondaryLight dark:text-text-secondaryDark">Date & Time</p>
                <p className="text-sm font-semibold mt-0.5">{formatDate(transaction.date)}</p>
              </div>
            </div>

            {/* Payment Method */}
            <div className="flex gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-[#111622] flex items-center justify-center text-text-secondaryLight flex-shrink-0">
                <CreditCard className="w-4.5 h-4.5" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold tracking-wider text-text-secondaryLight dark:text-text-secondaryDark">Payment Method</p>
                <p className="text-sm font-semibold mt-0.5">{transaction.paymentMethod || 'Card'}</p>
              </div>
            </div>

            {/* Description */}
            {transaction.description && (
              <div className="flex gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-[#111622] flex items-center justify-center text-text-secondaryLight flex-shrink-0">
                  <FileText className="w-4.5 h-4.5" />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-wider text-text-secondaryLight dark:text-text-secondaryDark">Description / Notes</p>
                  <p className="text-xs text-text-secondaryLight dark:text-text-secondaryDark leading-relaxed mt-1 bg-slate-50 dark:bg-[#111622]/50 p-2.5 rounded-lg border border-border-light/40 dark:border-border-dark/40 max-w-[280px]">
                    {transaction.description}
                  </p>
                </div>
              </div>
            )}

            {/* Extra Info Segment (Subscription or Receipt linked) */}
            {(transaction.isSubscription || transaction.receiptId) && (
              <div className="p-4 rounded-2xl border border-border-light dark:border-border-dark bg-slate-50/50 dark:bg-[#111622]/20 flex flex-col gap-2 mt-2">
                {transaction.isSubscription && (
                  <div className="flex items-center gap-2 text-brand-secondary">
                    <RefreshCw className="w-4 h-4" />
                    <span className="text-xs font-semibold">Active Recurring Subscription</span>
                  </div>
                )}
                {transaction.receiptId && (
                  <div className="flex items-center gap-2 text-brand-primary">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="text-xs font-semibold">Matched with Uploaded Receipt</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Close Button */}
          <div className="mt-8 flex justify-end">
            <button
              onClick={onClose}
              className="px-5 py-3 w-full rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#111622] dark:hover:bg-[#1b2234] text-xs font-bold text-center transition-all"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
export default TransactionDetails;
