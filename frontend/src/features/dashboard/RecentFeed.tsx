import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Receipt, ArrowDownLeft, ArrowUpRight, RefreshCw } from 'lucide-react';
import TransactionDetails from '../transactions/TransactionDetails';
import { formatCurrency } from '../../utils/formatCurrency';
import Card, { PanelHead } from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';

interface RecentFeedProps {
  transactions: any[];
  onAddTransaction?: () => void;
}

export const RecentFeed: React.FC<RecentFeedProps> = ({ transactions, onAddTransaction }) => {
  const [selectedDetails, setSelectedDetails] = useState<any | null>(null);

  // Relative labels for the two most recent days, absolute beyond that.
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const dayDiff = Math.round((startOf(today) - startOf(date)) / 86_400_000);

    if (dayDiff === 0) return 'Today';
    if (dayDiff === 1) return 'Yesterday';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <Card tone="bare" tier="secondary" className="h-full flex flex-col">
      <PanelHead
        label="Recent Transactions"
        action={
          transactions.length > 0 ? (
            <Link
              to="/transactions"
              className="inline-flex items-center gap-1 py-1.5 -my-1.5 min-h-[26px] text-[11px] font-semibold text-brand-primary hover:gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/50 rounded transition-all"
            >
              View all
              <ArrowRight className="w-3 h-3" aria-hidden="true" />
            </Link>
          ) : undefined
        }
      />

      {transactions.length === 0 ? (
        <div className="flex-grow flex items-center justify-center">
          <EmptyState
            icon={Receipt}
            title="No transactions yet"
            description="Add your first transaction to start tracking."
            actionLabel="Add Transaction"
            onAction={onAddTransaction}
            size="compact"
          />
        </div>
      ) : (
        <ul className="mt-4 -mx-2">
          {transactions.map((tx) => {
            const isIncome = tx.type === 'INCOME';
            const color = tx.category?.color || '#94a3b8';
            const categoryName = tx.category?.name || 'Uncategorized';
            const DirectionIcon = isIncome ? ArrowDownLeft : ArrowUpRight;

            return (
              <li key={tx.id}>
                <button
                  type="button"
                  onClick={() => setSelectedDetails(tx)}
                  className="w-full flex items-center justify-between gap-3 py-3 px-2 rounded-panel text-left hover:bg-black/[0.03] dark:hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40 transition-colors"
                >
                  <span className="flex items-center gap-3 min-w-0">
                    {/* Small circular category token */}
                    <span
                      className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${color}1f`, color }}
                    >
                      <DirectionIcon className="w-4 h-4" aria-hidden="true" />
                    </span>

                    <span className="min-w-0">
                      <span className="block text-sm font-medium truncate text-text-primaryLight dark:text-text-primaryDark">
                        {tx.merchant || tx.description || 'Untitled'}
                      </span>
                      <span className="flex items-center gap-1.5 text-[11px] text-text-secondaryLight dark:text-text-secondaryDark mt-0.5">
                        <span className="truncate max-w-[9rem]">{categoryName}</span>
                        <span aria-hidden="true">·</span>
                        <span className="whitespace-nowrap">{formatDate(tx.date)}</span>
                        {tx.baseCurrency && tx.currency !== tx.baseCurrency && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span
                              className="whitespace-nowrap"
                              title={`Converted at 1 ${tx.currency} = ${tx.exchangeRate} ${tx.baseCurrency}`}
                            >
                              {tx.currency}
                            </span>
                          </>
                        )}
                        {tx.isSubscription && (
                          <RefreshCw className="w-2.5 h-2.5 text-brand-secondary shrink-0" aria-label="Subscription" />
                        )}
                      </span>
                    </span>
                  </span>

                  <span
                    className={`font-outfit text-sm font-semibold tnum whitespace-nowrap shrink-0 ${
                      isIncome ? 'text-brand-primary' : 'text-text-primaryLight dark:text-text-primaryDark'
                    }`}
                  >
                    {isIncome ? '+' : '−'}
                    {formatCurrency(Number(tx.amount), tx.currency)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {selectedDetails && (
        <TransactionDetails transaction={selectedDetails} onClose={() => setSelectedDetails(null)} />
      )}
    </Card>
  );
};

export default RecentFeed;
