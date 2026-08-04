import React from 'react';
import { Edit2, Trash2, Eye, Calendar, CreditCard, RefreshCw } from 'lucide-react';
import { formatCurrency } from '../../utils/formatCurrency';

interface TransactionCardProps {
  tx: any;
  onViewDetails: (tx: any) => void;
  onEdit: (tx: any) => void;
  onDelete: (tx: any) => void;
}

export const TransactionCard: React.FC<TransactionCardProps> = ({
  tx,
  onViewDetails,
  onEdit,
  onDelete,
}) => {
  const isIncome = tx.type === 'INCOME';
  const categoryName = tx.category?.name || 'Uncategorized';
  const categoryColor = tx.category?.color || '#cbd5e1';

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: '2-digit',
    });
  };

  const formatCurrencyLocal = (amount: number, type: 'INCOME' | 'EXPENSE', currency: string) => {
    const formatted = formatCurrency(amount, currency);
    return type === 'INCOME' ? `+ ${formatted}` : `- ${formatted}`;
  };

  return (
    <div className="md:hidden p-5 rounded-2xl border border-border-light dark:border-border-dark bg-white dark:bg-card-dark shadow-premium dark:shadow-premium-dark relative overflow-hidden flex flex-col gap-4">
      {/* Category Accent Line */}
      <div className="absolute top-0 left-0 w-1.5 h-full" style={{ backgroundColor: categoryColor }} />

      {/* Header segment: Merchant & Amount */}
      <div className="flex justify-between items-start pl-2">
        <div className="text-left">
          <h3 className="font-semibold text-text-primaryLight dark:text-text-primaryDark truncate max-w-[180px]">
            {tx.merchant || 'Unknown Merchant'}
          </h3>
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold mt-1"
            style={{
              backgroundColor: `${categoryColor}15`,
              color: categoryColor,
              border: `1px solid ${categoryColor}25`,
            }}
          >
            {categoryName}
            {tx.isSubscription && (
              <RefreshCw className="w-2 h-2" />
            )}
          </span>
        </div>

        <div className={`font-semibold font-outfit text-md ${
          isIncome ? 'text-finance-income' : 'text-text-primaryLight dark:text-text-primaryDark'
        }`}>
          {formatCurrencyLocal(Number(tx.amount), tx.type, tx.currency)}
        </div>
      </div>

      {/* Body segment: Date and Method */}
      <div className="flex flex-wrap gap-4 pl-2 text-xs text-text-secondaryLight dark:text-text-secondaryDark border-t border-border-light/40 dark:border-border-dark/40 pt-3">
        <div className="flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5" />
          <span>{formatDate(tx.date)}</span>
        </div>
        <div className="flex items-center gap-1">
          <CreditCard className="w-3.5 h-3.5" />
          <span>{tx.paymentMethod || 'Card'}</span>
        </div>
      </div>

      {/* Footer segment: Actions */}
      <div className="flex justify-end gap-2 border-t border-border-light/40 dark:border-border-dark/40 pt-3">
        <button
          onClick={() => onViewDetails(tx)}
          className="flex items-center justify-center p-2 rounded-xl border border-border-light dark:border-border-dark text-text-secondaryLight dark:text-text-secondaryDark hover:bg-slate-50 dark:hover:bg-[#111622] transition-colors"
          title="Details"
        >
          <Eye className="w-4 h-4" />
        </button>
        <button
          onClick={() => onEdit(tx)}
          className="flex items-center justify-center p-2 rounded-xl border border-border-light dark:border-border-dark text-brand-secondary hover:bg-slate-50 dark:hover:bg-[#111622] transition-colors"
          title="Edit"
        >
          <Edit2 className="w-4 h-4" />
        </button>
        <button
          onClick={() => onDelete(tx)}
          className="flex items-center justify-center p-2 rounded-xl border border-border-light dark:border-border-dark text-finance-expense hover:bg-slate-50 dark:hover:bg-[#111622] transition-colors"
          title="Delete"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
export default TransactionCard;
