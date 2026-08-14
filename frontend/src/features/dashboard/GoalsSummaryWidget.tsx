import React from 'react';
import { Link } from 'react-router-dom';
import { Target, ArrowRight, Loader2 } from 'lucide-react';
import { useGoals } from '../../services/goals';
import { formatCurrency, toFiniteNumber } from '../../utils/formatCurrency';
import Card, { PanelHead } from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';

export const GoalsSummaryWidget: React.FC = () => {
  const { data: response, isLoading } = useGoals();
  const goals = response?.data?.goals || [];

  return (
    <Card tone="bare" tier="secondary" className="h-full flex flex-col">
      <PanelHead
        label="Savings Goals"
        action={
          goals.length > 0 ? (
            <Link
              to="/goals"
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-primary hover:gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/50 rounded transition-all"
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
            <Loader2 className="w-4 h-4 animate-spin text-text-secondaryDark" aria-label="Loading goals" />
          </div>
        ) : goals.length === 0 ? (
          <EmptyState
            icon={Target}
            title="What are you saving for?"
            description="Create a goal and start tracking your progress."
            to="/goals"
            actionLabel="Create Goal"
            size="inline"
          />
        ) : (
          <ul className="mt-5 space-y-5">
            {goals.slice(0, 3).map((g) => (
              <li key={g.id}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium truncate text-text-primaryLight dark:text-text-primaryDark">
                    {g.name}
                  </span>
                  <span className="text-[11px] tnum text-text-secondaryLight dark:text-text-secondaryDark shrink-0">
                    <span className="text-text-primaryLight dark:text-text-primaryDark font-semibold">
                      {formatCurrency(g.currentAmount, g.currency)}
                    </span>
                    {' / '}
                    {formatCurrency(g.targetAmount, g.currency)}
                  </span>
                </div>

                <div className="h-1.5 mt-2 w-full rounded-full bg-black/[0.05] dark:bg-white/[0.05] overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-[width] duration-[900ms] ease-out ${
                      g.isCompleted ? 'bg-brand-primary' : 'bg-finance-savings'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(0, toFiniteNumber(g.progressPercentage)))}%` }}
                  />
                </div>

                <p className="text-[11px] tnum mt-1.5 text-text-secondaryLight dark:text-text-secondaryDark">
                  {toFiniteNumber(g.progressPercentage)}%
                  {g.daysRemaining !== null && g.daysRemaining > 0 && ` · ${g.daysRemaining} days left`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
};

export default GoalsSummaryWidget;
