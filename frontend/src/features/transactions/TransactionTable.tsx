import React from 'react';
import { Edit2, Trash2, Eye, ArrowUpDown, RefreshCw } from 'lucide-react';
import { formatCurrency } from '../../utils/formatCurrency';

interface TransactionTableProps {
  transactions: any[];
  onViewDetails: (tx: any) => void;
  onEdit: (tx: any) => void;
  onDelete: (tx: any) => void;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  onSort: (field: string) => void;
}

export const TransactionTable: React.FC<TransactionTableProps> = ({
  transactions,
  onViewDetails,
  onEdit,
  onDelete,
  sortBy,
  sortOrder,
  onSort,
}) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatCurrencyLocal = (amount: number, type: 'INCOME' | 'EXPENSE', currency: string) => {
    const formatted = formatCurrency(amount, currency);
    return type === 'INCOME' ? `+ ${formatted}` : `- ${formatted}`;
  };

  return (
    <div className="overflow-x-auto w-full hidden md:block">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-border-light dark:border-border-dark text-text-secondaryLight dark:text-text-secondaryDark text-xs font-bold uppercase tracking-wider">
            <th className="py-4 px-4 cursor-pointer hover:text-text-primaryLight dark:hover:text-text-primaryDark transition-colors" onClick={() => onSort('date')}>
              <span className="flex items-center gap-1">
                Date <ArrowUpDown className="w-3 h-3" />
              </span>
            </th>
            <th className="py-4 px-4">Merchant / Description</th>
            <th className="py-4 px-4">Category</th>
            <th className="py-4 px-4">Method</th>
            <th className="py-4 px-4 cursor-pointer hover:text-text-primaryLight dark:hover:text-text-primaryDark transition-colors" onClick={() => onSort('amount')}>
              <span className="flex items-center gap-1">
                Amount <ArrowUpDown className="w-3 h-3" />
              </span>
            </th>
            <th className="py-4 px-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-light dark:divide-border-dark">
          {transactions.map((tx) => {
            const isIncome = tx.type === 'INCOME';
            const categoryName = tx.category?.name || 'Uncategorized';
            const categoryColor = tx.category?.color || '#cbd5e1';

            return (
              <tr
                key={tx.id}
                className="hover:bg-slate-50/50 dark:hover:bg-card-dark/40 transition-colors group"
              >
                {/* Date */}
                <td className="py-4 px-4 font-medium text-xs">
                  {formatDate(tx.date)}
                </td>

                {/* Description & Merchant */}
                <td className="py-4 px-4">
                  <div className="font-semibold text-text-primaryLight dark:text-text-primaryDark">
                    {tx.merchant || 'Unknown'}
                  </div>
                  {tx.description && (
                    <div className="text-xs text-text-secondaryLight dark:text-text-secondaryDark truncate max-w-xs mt-0.5">
                      {tx.description}
                    </div>
                  )}
                </td>

                {/* Category Badge */}
                <td className="py-4 px-4">
                  <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                    style={{
                      backgroundColor: `${categoryColor}15`,
                      color: categoryColor,
                      border: `1px solid ${categoryColor}25`,
                    }}
                    title={tx.isSubscription ? 'Subscription' : undefined}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: categoryColor }} />
                    {categoryName}
                    {tx.isSubscription && (
                      <RefreshCw className="w-2.5 h-2.5" />
                    )}
                  </span>
                </td>

                {/* Payment Method */}
                <td className="py-4 px-4 text-xs text-text-secondaryLight dark:text-text-secondaryDark">
                  {tx.paymentMethod || 'Card'}
                </td>

                {/* Amount */}
                <td className={`py-4 px-4 font-semibold font-outfit ${
                  isIncome ? 'text-finance-income' : 'text-text-primaryLight dark:text-text-primaryDark'
                }`}>
                  {formatCurrencyLocal(Number(tx.amount), tx.type, tx.currency)}
                </td>

                {/* Action Buttons */}
                <td className="py-4 px-4 text-right">
                  <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onViewDetails(tx)}
                      className="p-1.5 rounded-lg text-text-secondaryLight dark:text-text-secondaryDark hover:bg-slate-100 dark:hover:bg-[#111622] hover:text-text-primaryLight dark:hover:text-text-primaryDark transition-colors"
                      title="View Details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onEdit(tx)}
                      className="p-1.5 rounded-lg text-text-secondaryLight dark:text-text-secondaryDark hover:bg-slate-100 dark:hover:bg-[#111622] hover:text-brand-secondary transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDelete(tx)}
                      className="p-1.5 rounded-lg text-text-secondaryLight dark:text-text-secondaryDark hover:bg-slate-100 dark:hover:bg-[#111622] hover:text-finance-expense transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
export default TransactionTable;
