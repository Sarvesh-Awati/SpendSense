import React from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import Card, { SectionLabel } from '../../components/ui/Card';
import Sparkline from '../../components/ui/Sparkline';
import { formatCurrency, toFiniteNumber } from '../../utils/formatCurrency';
import useCountUp from '../../utils/useCountUp';

interface HeroBalanceProps {
  totalBalance: number;
  /** Net for the current month (income − expenses) — the "Savings" figure. */
  monthlySavings: number;
  /** Savings as a share of income, already computed by the API. */
  savingsRate: number;
  trend: Array<{ date: string; income: number; expense: number }>;
  currency: string;
}

/**
 * The dashboard's visual anchor.
 *
 * Monthly savings is folded in here as supporting detail rather than existing
 * as a fourth equal KPI card — the balance is the headline, savings is its
 * context. Every figure is real: totalBalance, savings and savingsRate all
 * come from GET /api/dashboard, and the trace accumulates the same
 * `spendingTrend` series the main chart uses.
 */
export const HeroBalance: React.FC<HeroBalanceProps> = ({
  totalBalance,
  monthlySavings,
  savingsRate,
  trend,
  currency,
}) => {
  const safeBalance = toFiniteNumber(totalBalance);
  const safeSavings = toFiniteNumber(monthlySavings);
  const safeRate = toFiniteNumber(savingsRate);

  const animated = useCountUp(safeBalance);
  const positive = safeSavings >= 0;

  const series = trend.reduce<number[]>((acc, bucket) => {
    const prev = acc.length > 0 ? acc[acc.length - 1] : 0;
    acc.push(prev + toFiniteNumber(bucket.income) - toFiniteNumber(bucket.expense));
    return acc;
  }, []);

  const hasMovement = series.length > 1 && new Set(series).size > 1;

  return (
    <Card tone="raised" tier="hero" className="relative overflow-hidden h-full flex flex-col">
      {/* Two very low-contrast arcs — the card's only decoration */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 -right-24 w-80 h-80 rounded-full border border-brand-primary/[0.09]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-20 -right-40 w-80 h-80 rounded-full bg-brand-primary/[0.05] blur-3xl"
      />

      <div className="relative">
        <SectionLabel>Total Balance</SectionLabel>

        <p className="font-outfit text-[52px] sm:text-[60px] leading-[1.02] font-bold tracking-[-0.02em] tnum mt-5 break-words">
          {formatCurrency(animated, currency)}
        </p>

        <p className="text-sm text-text-secondaryLight dark:text-text-secondaryDark mt-3">
          All-time net position
        </p>
      </div>

      {/* Savings folded in as supporting context, separated by a hairline */}
      <div className="relative mt-auto pt-10">
        {hasMovement && (
          <Sparkline
            values={series}
            stroke={positive ? '#10b981' : '#f43f5e'}
            className="w-full h-16 mb-6"
            height={48}
          />
        )}

        <div className="flex items-end justify-between gap-4 pt-5 border-t border-white/[0.07] dark:border-white/[0.07]">
          <div className="min-w-0">
            <SectionLabel>{positive ? 'Saved this month' : 'Overspent this month'}</SectionLabel>
            <p className="font-outfit text-xl font-bold tracking-tight tnum mt-1.5">
              {formatCurrency(Math.abs(safeSavings), currency)}
            </p>
          </div>

          <span
            className={`inline-flex items-center gap-1 pl-2 pr-3 py-1.5 rounded-full text-xs font-semibold shrink-0 ${
              positive
                ? 'bg-brand-primary/12 text-brand-primary'
                : 'bg-finance-expense/12 text-finance-expense'
            }`}
          >
            {positive ? (
              <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
            ) : (
              <ArrowDownRight className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            {safeRate > 0 ? `${safeRate}% rate` : positive ? 'On track' : 'Overspent'}
          </span>
        </div>
      </div>
    </Card>
  );
};

export default HeroBalance;
