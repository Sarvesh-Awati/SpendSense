import React, { useState } from 'react';
import { Eye, DollarSign, Calendar, RefreshCw } from 'lucide-react';
import TransactionDetails from '../transactions/TransactionDetails';
import { formatCurrency } from '../../utils/formatCurrency';

interface RecentFeedProps {
  transactions: any[];
}

export const RecentFeed: React.FC<RecentFeedProps> = ({ transactions }) => {
  const [selectedDetails, setSelectedDetails] = useState<any | null>(null);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const formatCurrencyLocal = (amount: number, type: 'INCOME' | 'EXPENSE', currency: string) => {
    const formatted = formatCurrency(amount, currency);
    return type === 'INCOME' ? `+ ${formatted}` : `- ${formatted}`;
  };

  return (
    <div className="bg-white dark:bg-card-dark p-6 rounded-3xl border border-border-light dark:border-border-dark shadow-premium dark:shadow-premium-dark text-left space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="font-outfit text-base font-bold tracking-tight">Recent Activity</h3>
          <p className="text-xs text-text-secondaryLight dark:text-text-secondaryDark mt-0.5">
            Your last 5 ledger entries
          </p>
        </div>
      </div>

      <div className="divide-y divide-border-light/40 dark:divide-border-dark/40">
        {transactions.length === 0 ? (
          <p className="text-xs text-text-secondaryLight dark:text-text-secondaryDark italic py-8 text-center">
            No logged transactions.
          </p>
        ) : (
          transactions.map((tx) => {
            const isIncome = tx.type === 'INCOME';
            const categoryColor = tx.category?.color || '#cbd5e1';
            const categoryName = tx.category?.name || 'Uncategorized';

            return (
              <div
                key={tx.id}
                className="flex items-center justify-between py-3.5 hover:bg-slate-50/40 dark:hover:bg-[#111622]/20 px-2 rounded-xl transition-all group"
              >
                <div className="flex items-center gap-3">
                  {/* Category Indicator Accent */}
                  <div
                    className="w-1.5 h-8 rounded-full"
                    style={{ backgroundColor: categoryColor }}
                  />
                  <div className="text-left">
                    <p className="text-sm font-semibold text-text-primaryLight dark:text-text-primaryDark truncate max-w-[150px]">
                      {tx.merchant || 'Unknown Merchant'}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-text-secondaryLight dark:text-text-secondaryDark">
                      <span className="font-semibold" style={{ color: categoryColor }}>{categoryName}</span>
                      <span>•</span>
                      <span className="flex items-center gap-0.5">
                        <Calendar className="w-2.5 h-2.5" />
                        {formatDate(tx.date)}
                      </span>
                      {tx.isSubscription && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-0.5 text-brand-secondary">
                            <RefreshCw className="w-2.5 h-2.5" />
                            Sub
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span className={`font-semibold font-outfit text-sm ${
                    isIncome ? 'text-finance-income' : 'text-text-primaryLight dark:text-text-primaryDark'
                  }`}>
                    {formatCurrencyLocal(Number(tx.amount), tx.type, tx.currency)}
                  </span>
                  
                  {/* Quick Detail View Trigger */}
                  <button
                    onClick={() => setSelectedDetails(tx)}
                    className="p-1.5 rounded-lg border border-border-light dark:border-border-dark opacity-0 group-hover:opacity-100 bg-white dark:bg-card-dark text-text-secondaryLight hover:text-text-primaryLight dark:hover:text-text-primaryDark transition-all cursor-pointer"
                    title="View Details"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Details Modal Overlay */}
      {selectedDetails && (
        <TransactionDetails
          transaction={selectedDetails}
          onClose={() => setSelectedDetails(null)}
        />
      )}
    </div>
  );
};
export default RecentFeed;
