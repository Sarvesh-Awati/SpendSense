import React from 'react';
import { useBudgets } from '../../services/budgets';
import { Link } from 'react-router-dom';
import { PiggyBank, ArrowRight, Loader2 } from 'lucide-react';
import { formatCurrency } from '../../utils/formatCurrency';

export const BudgetSummaryWidget: React.FC = () => {
  const { data: response, isLoading } = useBudgets();
  const budgets = response?.data?.budgets || [];

  const formatCurrencyLocal = (val: number, currency: string) => {
    return formatCurrency(val, currency);
  };

  return (
    <div className="bg-white dark:bg-card-dark p-6 rounded-3xl border border-border-light dark:border-border-dark shadow-premium dark:shadow-premium-dark text-left flex flex-col justify-between space-y-4 h-full">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-outfit text-base font-bold tracking-tight">Active Budgets</h3>
          <p className="text-xs text-text-secondaryLight dark:text-text-secondaryDark mt-0.5">
            Progress of your active spending limits
          </p>
        </div>
        <Link
          to="/budgets"
          className="p-1 rounded-lg hover:bg-slate-50 dark:hover:bg-[#111622] text-brand-primary transition-colors cursor-pointer"
          title="Manage Budgets"
        >
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="space-y-4 flex-grow flex flex-col justify-center">
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-text-secondaryDark" />
          </div>
        ) : budgets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center text-xs text-text-secondaryLight dark:text-text-secondaryDark">
            <PiggyBank className="w-8 h-8 text-slate-500 mb-2 opacity-50" />
            <p className="italic mb-2">No active budgets.</p>
            <Link
              to="/budgets"
              className="text-[10px] text-brand-primary font-bold hover:underline"
            >
              Configure Limits
            </Link>
          </div>
        ) : (
          budgets.slice(0, 3).map((b) => {
            const isOverall = b.categoryId === null;
            const categoryColor = isOverall ? '#10b981' : b.category?.color || '#cbd5e1';
            const progressColor = b.isExceeded
              ? 'bg-finance-expense'
              : b.isWarning
              ? 'bg-amber-500'
              : 'bg-brand-primary';

            return (
              <div key={b.id} className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-text-primaryLight dark:text-text-primaryDark truncate max-w-[150px] flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: categoryColor }} />
                    {isOverall ? 'Overall Monthly' : b.category?.name}
                  </span>
                  <span className="text-[10px] text-text-secondaryLight dark:text-text-secondaryDark">
                    <strong>{formatCurrencyLocal(b.spent, b.currency)}</strong> / {formatCurrencyLocal(b.amount, b.currency)}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-[#111622] overflow-hidden">
                  <div
                    className={`h-full rounded-full ${progressColor} transition-all duration-300`}
                    style={{ width: `${Math.min(100, b.percentageUsed)}%` }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
export default BudgetSummaryWidget;
