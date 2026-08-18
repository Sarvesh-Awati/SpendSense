import React from 'react';
import { Link } from 'react-router-dom';
import { PiggyBank, ArrowRight, Loader2 } from 'lucide-react';
import { useBudgets } from '../../services/budgets';
import { formatCurrency, toFiniteNumber } from '../../utils/formatCurrency';
import Card, { PanelHead } from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';

export const BudgetSummaryWidget: React.FC = () => {
  const { data: response, isLoading } = useBudgets();
  const budgets = response?.data?.budgets || [];

  return (
    <Card tone="bare" tier="secondary" className="h-full flex flex-col">
      <PanelHead
        label="Budgets"
        action={
          budgets.length > 0 ? (
            <Link
              to="/budgets"
              className="inline-flex items-center gap-1 py-1.5 -my-1.5 min-h-[26px] text-[11px] font-semibold text-brand-primary hover:gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/50 rounded transition-all"
            >
              Manage
              <ArrowRight className="w-3 h-3" aria-hidden="true" />
            </Link>
          ) : undefined
        }
      />

      <div className="mt-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-4 h-4 animate-spin text-text-secondaryDark" aria-label="Loading budgets" />
          </div>
        ) : budgets.length === 0 ? (
          <EmptyState
            icon={PiggyBank}
            title="No active budgets"
            description="Set your first spending limit."
            to="/budgets"
            actionLabel="Create Budget"
            size="inline"
          />
        ) : (
          <ul className="mt-5 space-y-5">
            {budgets.slice(0, 3).map((b) => {
              const isOverall = b.categoryId === null;
              const label = isOverall ? 'Overall' : b.category?.name ?? 'Budget';

              // Warning styling only when the data actually warrants it.
              const barColor = b.isExceeded
                ? 'bg-finance-expense'
                : b.isWarning
                ? 'bg-finance-debt'
                : 'bg-brand-primary';
              const pctColor = b.isExceeded
                ? 'text-finance-expense'
                : b.isWarning
                ? 'text-finance-debt'
                : 'text-text-secondaryLight dark:text-text-secondaryDark';

              return (
                <li key={b.id}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-medium truncate text-text-primaryLight dark:text-text-primaryDark">
                      {label}
                    </span>
                    <span className="text-[11px] tnum text-text-secondaryLight dark:text-text-secondaryDark shrink-0">
                      <span className="text-text-primaryLight dark:text-text-primaryDark font-semibold">
                        {formatCurrency(b.spent, b.currency)}
                      </span>
                      {' / '}
                      {formatCurrency(b.amount, b.currency)}
                    </span>
                  </div>

                  <div className="h-1.5 mt-2 w-full rounded-full bg-black/[0.05] dark:bg-white/[0.05] overflow-hidden">
                    <div
                      className={`h-full rounded-full ${barColor} transition-[width] duration-[900ms] ease-out`}
                      style={{ width: `${Math.min(100, Math.max(0, toFiniteNumber(b.percentageUsed)))}%` }}
                    />
                  </div>

                  <p className={`text-[11px] tnum mt-1.5 ${pctColor}`}>
                    {toFiniteNumber(b.percentageUsed)}% used
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
};

export default BudgetSummaryWidget;
