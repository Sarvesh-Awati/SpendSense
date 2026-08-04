import React from 'react';
import { Edit2, Trash2, Calendar, Trophy, Coins } from 'lucide-react';
import { GoalResponse } from '../../services/goals';
import GoalProgressBar from './GoalProgressBar';
import { formatCurrency } from '../../utils/formatCurrency';

interface GoalCardProps {
  goal: GoalResponse;
  onEdit: (goal: GoalResponse) => void;
  onDelete: (goal: GoalResponse) => void;
  onContribute: (goal: GoalResponse) => void;
}

export const GoalCard: React.FC<GoalCardProps> = ({
  goal,
  onEdit,
  onDelete,
  onContribute,
}) => {
  const formatCurrencyLocal = (val: number, currency: string) => {
    return formatCurrency(val, currency);
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return 'No timeline';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const isCompleted = goal.isCompleted;

  return (
    <div className={`p-6 rounded-3xl border ${isCompleted ? 'border-brand-primary/30 bg-emerald-50/10 dark:bg-emerald-950/5' : 'border-border-light dark:border-border-dark bg-white dark:bg-card-dark'} shadow-premium dark:shadow-premium-dark flex flex-col justify-between space-y-4 hover:border-brand-primary/20 transition-all text-left relative overflow-hidden group`}>
      {/* Accent Top line */}
      <div className={`absolute top-0 left-0 w-full h-1 ${isCompleted ? 'bg-brand-primary' : 'bg-brand-secondary'}`} />

      {/* Completion Trophy Banner */}
      {isCompleted && (
        <div className="absolute top-0 right-0 bg-brand-primary text-white text-[8px] font-bold uppercase tracking-widest px-3 py-1 rounded-bl-xl flex items-center gap-1 shadow">
          <Trophy className="w-2.5 h-2.5" /> Reached!
        </div>
      )}

      {/* Header: Title and Actions */}
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-bold font-outfit text-lg text-text-primaryLight dark:text-text-primaryDark flex items-center gap-1.5 truncate max-w-[200px]">
            {goal.name}
          </h3>
          <p className="text-[10px] text-text-secondaryLight dark:text-text-secondaryDark mt-1 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            <span>Target: {formatDate(goal.targetDate)}</span>
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onEdit(goal)}
            className="p-1.5 rounded-lg border border-border-light dark:border-border-dark text-text-secondaryLight hover:text-brand-secondary hover:bg-slate-50 dark:hover:bg-[#111622] transition-colors cursor-pointer"
            title="Edit Goal"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(goal)}
            className="p-1.5 rounded-lg border border-border-light dark:border-border-dark text-text-secondaryLight hover:text-finance-expense hover:bg-slate-50 dark:hover:bg-[#111622] transition-colors cursor-pointer"
            title="Delete Goal"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Progress Value Metrics */}
      <div className="space-y-2">
        <div className="flex justify-between items-end text-xs">
          <span className="text-text-secondaryLight dark:text-text-secondaryDark">
            Saved: <strong className="text-text-primaryLight dark:text-text-primaryDark">{formatCurrencyLocal(goal.currentAmount, goal.currency)}</strong> of {formatCurrencyLocal(goal.targetAmount, goal.currency)}
          </span>
          <span className="font-bold font-outfit text-xs">
            {goal.progressPercentage.toFixed(1)}%
          </span>
        </div>

        {/* Progress bar */}
        <GoalProgressBar percentage={goal.progressPercentage} isCompleted={isCompleted} />
      </div>

      {/* Footer Metrics */}
      <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-border-light/20 dark:border-border-dark/20">
        <div>
          <p className="text-[9px] uppercase tracking-wider text-text-secondaryLight dark:text-text-secondaryDark font-bold">Remaining</p>
          <p className={`font-bold mt-0.5 ${isCompleted ? 'text-brand-primary' : 'text-text-primaryLight dark:text-text-primaryDark'}`}>
            {formatCurrencyLocal(goal.remainingAmount, goal.currency)}
          </p>
        </div>
        <div>
          <p className="text-[9px] uppercase tracking-wider text-text-secondaryLight dark:text-text-secondaryDark font-bold">Days Left</p>
          <p className="font-bold text-text-primaryLight dark:text-text-primaryDark mt-0.5">
            {goal.daysRemaining !== null ? `${goal.daysRemaining} days` : 'No limit'}
          </p>
        </div>
      </div>

      {/* Predictive Insights */}
      {goal.predictions && !isCompleted && (
        <div className="bg-slate-50 dark:bg-[#111622] rounded-xl p-3 space-y-2 border border-slate-100 dark:border-[#1a2235]">
          {goal.predictions.requiredMonthlyContribution && (
            <div className="flex justify-between items-center text-xs">
              <span className="text-text-secondaryLight dark:text-text-secondaryDark">Required / mo</span>
              <span className="font-bold text-text-primaryLight dark:text-text-primaryDark">{formatCurrencyLocal(goal.predictions.requiredMonthlyContribution, goal.currency)}</span>
            </div>
          )}
          {goal.predictions.projectedCompletionDate && (
            <div className="flex justify-between items-center text-xs">
              <span className="text-text-secondaryLight dark:text-text-secondaryDark">Projected</span>
              <span className="font-bold text-brand-primary">{formatDate(goal.predictions.projectedCompletionDate.toString())}</span>
            </div>
          )}
          {goal.predictions.completionProbability && (
            <div className="flex justify-between items-center text-xs">
              <span className="text-text-secondaryLight dark:text-text-secondaryDark">Probability</span>
              <span className={`font-bold ${
                goal.predictions.completionProbability === 'High' ? 'text-emerald-500' :
                goal.predictions.completionProbability === 'Medium' ? 'text-amber-500' :
                'text-rose-500'
              }`}>{goal.predictions.completionProbability}</span>
            </div>
          )}
        </div>
      )}

      {/* Add Contribution button */}
      {!isCompleted && (
        <button
          onClick={() => onContribute(goal)}
          className="w-full mt-2 py-2 rounded-xl bg-brand-primary/10 border border-brand-primary/15 hover:bg-brand-primary/20 text-brand-primary text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
        >
          <Coins className="w-4 h-4" />
          <span>Add Contribution</span>
        </button>
      )}
    </div>
  );
};
export default GoalCard;
