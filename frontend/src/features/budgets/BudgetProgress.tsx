import React from 'react';
import { Edit2, Trash2, Calendar, AlertCircle, AlertTriangle, ShieldCheck } from 'lucide-react';
import { BudgetStatsResponse } from '../../services/budgets';
import { formatCurrency } from '../../utils/formatCurrency';

interface BudgetProgressProps {
  budget: BudgetStatsResponse;
  onEdit: (budget: BudgetStatsResponse) => void;
  onDelete: (budget: BudgetStatsResponse) => void;
}

export const BudgetProgress: React.FC<BudgetProgressProps> = ({
  budget,
  onEdit,
  onDelete,
}) => {
  const isOverall = budget.categoryId === null;
  const title = isOverall ? 'Overall Monthly Budget' : budget.category?.name || 'Category Budget';
  const categoryColor = isOverall ? '#10b981' : budget.category?.color || '#cbd5e1';

  const formatCurrencyLocal = (val: number) => {
    return formatCurrency(val, budget.currency);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: '2-digit',
    });
  };

  // Determine progress color and alerts
  let progressColor = 'bg-brand-primary';
  let cardBorder = 'border-border-light dark:border-border-dark';
  let bannerBg = '';
  let bannerText = '';
  let AlertIcon = null;
  let statusText = '';

  if (budget.isExceeded) {
    progressColor = 'bg-finance-expense';
    cardBorder = 'border-finance-expense/30';
    bannerBg = 'bg-finance-expense/10';
    bannerText = 'text-finance-expense';
    AlertIcon = AlertTriangle;
    statusText = 'Budget Exceeded!';
  } else if (budget.isWarning) {
    progressColor = 'bg-amber-500';
    cardBorder = 'border-amber-500/30';
    bannerBg = 'bg-amber-500/10';
    bannerText = 'text-amber-500';
    AlertIcon = AlertCircle;
    statusText = 'Budget Warning (80% used)';
  } else {
    bannerBg = 'bg-brand-primary/10';
    bannerText = 'text-brand-primary';
    AlertIcon = ShieldCheck;
    statusText = 'Within Budget Limits';
  }

  // Cap progress width at 100% for the visual bar
  const visualPercentage = Math.min(100, budget.percentageUsed);

  return (
    <div className={`p-6 rounded-3xl border ${cardBorder} bg-white dark:bg-card-dark shadow-premium dark:shadow-premium-dark flex flex-col justify-between space-y-4 hover:border-brand-primary/25 transition-all text-left relative overflow-hidden group`}>
      {/* Accent strip */}
      <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: categoryColor }} />

      {/* Header: Title and Actions */}
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-semibold text-text-primaryLight dark:text-text-primaryDark flex items-center gap-1.5">
            {!isOverall && (
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: categoryColor }} />
            )}
            {title}
          </h3>
          <p className="text-[10px] text-text-secondaryLight dark:text-text-secondaryDark mt-1 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            <span>{formatDate(budget.startDate)} - {formatDate(budget.endDate)}</span>
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onEdit(budget)}
            className="p-1.5 rounded-lg border border-border-light dark:border-border-dark text-text-secondaryLight hover:text-brand-secondary hover:bg-slate-50 dark:hover:bg-surface-sunk transition-colors cursor-pointer"
            title="Edit Budget"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(budget)}
            className="p-1.5 rounded-lg border border-border-light dark:border-border-dark text-text-secondaryLight hover:text-finance-expense hover:bg-slate-50 dark:hover:bg-surface-sunk transition-colors cursor-pointer"
            title="Delete Budget"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Progress Value Metrics */}
      <div className="space-y-2">
        <div className="flex justify-between items-end text-xs">
          <span className="text-text-secondaryLight dark:text-text-secondaryDark">
            Spent: <strong className="text-text-primaryLight dark:text-text-primaryDark">{formatCurrencyLocal(budget.spent)}</strong> of {formatCurrencyLocal(budget.amount)}
          </span>
          <span className="font-bold font-outfit text-xs">
            {budget.percentageUsed.toFixed(1)}%
          </span>
        </div>

        {/* Visual Progress Bar */}
        <div className="h-2.5 w-full rounded-full bg-slate-100 dark:bg-surface-sunk border border-border-light/40 dark:border-border-dark/40 overflow-hidden">
          <div
            className={`h-full rounded-full ${progressColor} transition-all duration-500`}
            style={{ width: `${visualPercentage}%` }}
          />
        </div>
      </div>

      {/* Status Warning Banner / Balance Stats */}
      <div className="flex justify-between items-center gap-3 pt-2">
        {/* Remaining amount */}
        <div className="text-left text-xs">
          <p className="text-[10px] text-text-secondaryLight dark:text-text-secondaryDark uppercase font-bold tracking-wider">Remaining</p>
          <p className={`font-bold mt-0.5 ${budget.remaining < 0 ? 'text-finance-expense' : 'text-brand-primary'}`}>
            {formatCurrencyLocal(budget.remaining)}
          </p>
        </div>

        {/* Status indicator badge */}
        <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${bannerBg} ${bannerText}`}>
          <AlertIcon className="w-3.5 h-3.5" />
          <span>{statusText}</span>
        </div>
      </div>

      {/* Predictive Insights */}
      {budget.predictions && (
        <div className="mt-2 pt-3 border-t border-border-light/20 dark:border-border-dark/20 grid grid-cols-2 gap-2 text-xs">
          <div>
            <p className="text-[9px] uppercase font-bold text-text-secondaryLight dark:text-text-secondaryDark">Proj. Spend</p>
            <p className={`font-bold mt-0.5 ${budget.predictions.status !== 'Safe' ? 'text-finance-expense' : 'text-text-primaryLight dark:text-text-primaryDark'}`}>
              {formatCurrencyLocal(budget.predictions.projectedSpend)}
            </p>
          </div>
          <div>
            <p className="text-[9px] uppercase font-bold text-text-secondaryLight dark:text-text-secondaryDark">Daily Target</p>
            <p className="font-bold text-brand-primary mt-0.5">
              {formatCurrencyLocal(budget.predictions.recommendedDailyLimit)}
            </p>
          </div>
          {budget.predictions.suggestedBudgetLimit > budget.amount && (
            <div className="col-span-2 bg-amber-500/10 rounded-lg p-2 mt-1">
              <p className="text-[10px] text-amber-600 dark:text-amber-500 font-medium">
                💡 Suggested limit: <strong>{formatCurrencyLocal(budget.predictions.suggestedBudgetLimit)}</strong>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
export default BudgetProgress;
