import React from 'react';
import { useGoals } from '../../services/goals';
import { Link } from 'react-router-dom';
import { Target, ArrowRight, Loader2 } from 'lucide-react';
import { formatCurrency } from '../../utils/formatCurrency';

export const GoalsSummaryWidget: React.FC = () => {
  const { data: response, isLoading } = useGoals();
  const goals = response?.data?.goals || [];

  const formatCurrencyLocal = (val: number, currency: string) => {
    return formatCurrency(val, currency);
  };

  return (
    <div className="bg-white dark:bg-card-dark p-6 rounded-3xl border border-border-light dark:border-border-dark shadow-premium dark:shadow-premium-dark text-left flex flex-col justify-between space-y-4 h-full">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-outfit text-base font-bold tracking-tight">Savings Goals</h3>
          <p className="text-xs text-text-secondaryLight dark:text-text-secondaryDark mt-0.5">
            Milestones and accumulation progress
          </p>
        </div>
        <Link
          to="/goals"
          className="p-1 rounded-lg hover:bg-slate-50 dark:hover:bg-[#111622] text-brand-primary transition-colors cursor-pointer"
          title="Manage Goals"
        >
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="space-y-4 flex-grow flex flex-col justify-center">
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-text-secondaryDark" />
          </div>
        ) : goals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center text-xs text-text-secondaryLight dark:text-text-secondaryDark font-medium">
            <Target className="w-8 h-8 text-slate-500 mb-2 opacity-50" />
            <p className="italic mb-2">No active savings targets.</p>
            <Link to="/goals" className="text-[10px] text-brand-primary font-bold hover:underline">
              Create Savings Goal
            </Link>
          </div>
        ) : (
          goals.slice(0, 3).map((g) => {
            const isCompleted = g.remainingAmount <= 0;
            const progressColor = isCompleted ? 'bg-brand-primary' : 'bg-brand-secondary';

            return (
              <div key={g.id} className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-text-primaryLight dark:text-text-primaryDark truncate max-w-[150px]">
                    {g.name}
                  </span>
                  <span className="text-[10px] text-text-secondaryLight dark:text-text-secondaryDark">
                    <strong>{formatCurrencyLocal(g.currentAmount, g.currency)}</strong> / {formatCurrencyLocal(g.targetAmount, g.currency)}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-[#111622] overflow-hidden">
                  <div
                    className={`h-full rounded-full ${progressColor} transition-all duration-300`}
                    style={{ width: `${Math.min(100, g.progressPercentage)}%` }}
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
export default GoalsSummaryWidget;
