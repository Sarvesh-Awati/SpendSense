import React from 'react';

interface GoalProgressBarProps {
  percentage: number;
  isCompleted?: boolean;
}

export const GoalProgressBar: React.FC<GoalProgressBarProps> = ({
  percentage,
  isCompleted = false,
}) => {
  const cappedPercentage = Math.min(100, Math.max(0, percentage));
  const activeColor = isCompleted ? 'bg-brand-primary' : 'bg-brand-secondary';

  return (
    <div className="space-y-1">
      <div className="h-2.5 w-full rounded-full bg-slate-100 dark:bg-[#111622] border border-border-light/40 dark:border-border-dark/40 overflow-hidden">
        <div
          className={`h-full rounded-full ${activeColor} transition-all duration-500 ease-out`}
          style={{ width: `${cappedPercentage}%` }}
        />
      </div>
    </div>
  );
};
export default GoalProgressBar;
