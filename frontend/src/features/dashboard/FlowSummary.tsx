import React from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { formatCurrency, formatPercent } from '../../utils/formatCurrency';

interface FlowSummaryProps {
  label: string;
  amount: number;
  /** Already passed through safePercentChange — null means "do not render". */
  change?: number | null;
  riseIsGood?: boolean;
  currency: string;
}

/**
 * Inline supporting metric.
 *
 * Deliberately NOT a card: income / expenses / savings are level-3 information
 * and sit directly on the page, separated by whitespace and a hairline rather
 * than by their own containers.
 */
export const FlowSummary: React.FC<FlowSummaryProps> = ({
  label,
  amount,
  change = null,
  riseIsGood = true,
  currency,
}) => {
  const good = change !== null && change > 0 === riseIsGood;

  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold tracking-[0.06em] uppercase text-text-secondaryLight dark:text-text-secondaryDark">
        {label}
      </p>

      <p className="font-outfit text-[26px] sm:text-[28px] leading-tight font-bold tracking-tight tnum mt-2 break-words">
        {formatCurrency(amount, currency)}
      </p>

      <div className="flex items-center gap-1.5 mt-1.5 min-w-0">
        {change !== null && (
          <span
            className={`inline-flex items-center gap-0.5 text-xs font-semibold tnum ${
              good ? 'text-brand-primary' : 'text-finance-expense'
            }`}
          >
            {change > 0 ? (
              <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
            ) : (
              <ArrowDownRight className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            {formatPercent(change)}
          </span>
        )}
        <span className="text-[11px] text-text-secondaryLight dark:text-text-secondaryDark truncate">
          {change !== null ? 'vs last month' : 'this month'}
        </span>
      </div>
    </div>
  );
};

export default FlowSummary;
