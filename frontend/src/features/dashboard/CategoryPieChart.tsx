import React from 'react';
import { PieChart as PieChartIcon } from 'lucide-react';
import { formatCurrency, toFiniteNumber } from '../../utils/formatCurrency';
import Card, { PanelHead } from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';

interface CategoryPieChartProps {
  data: Array<{
    id: string;
    name: string;
    icon: string;
    color: string;
    amount: number;
    percentage: number;
  }>;
  currency: string;
  onAddTransaction?: () => void;
}

/**
 * "Where your money goes".
 *
 * Replaces the previous donut-led panel with a ranked bar list, which reads
 * faster and stays legible at narrow widths. The share bars are scaled against
 * the largest category so the ranking is visible at a glance.
 */
export const CategoryPieChart: React.FC<CategoryPieChartProps> = ({
  data,
  currency,
  onAddTransaction,
}) => {
  const money = (val: number) => formatCurrency(val, currency);
  const top = data.slice(0, 5);
  const largest = top.length > 0 ? Math.max(...top.map((c) => c.amount)) : 1;

  return (
    <Card tone="bare" tier="secondary" className="h-full flex flex-col">
      <PanelHead label="Where your money goes" />

      {top.length === 0 ? (
        <div className="flex-grow flex items-center justify-center">
          <EmptyState
            icon={PieChartIcon}
            title="No spending data yet"
            description="Log your first expense to see where your money goes."
            actionLabel="Add Transaction"
            onAction={onAddTransaction}
            size="compact"
          />
        </div>
      ) : (
        <ul className="mt-5 space-y-4">
          {top.map((cat) => (
            <li key={cat.id}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium truncate text-text-primaryLight dark:text-text-primaryDark">
                  {cat.name}
                </span>
                <span className="flex items-baseline gap-2 shrink-0">
                  <span className="text-sm font-semibold tnum">{money(cat.amount)}</span>
                  <span className="text-[11px] text-text-secondaryLight dark:text-text-secondaryDark tnum w-8 text-right">
                    {toFiniteNumber(cat.percentage)}%
                  </span>
                </span>
              </div>

              <div className="h-1.5 mt-2 w-full rounded-full bg-black/[0.05] dark:bg-white/[0.05] overflow-hidden">
                <div
                  className="h-full rounded-full transition-[width] duration-[900ms] ease-out"
                  style={{
                    width: `${Math.max(3, Math.min(100, (toFiniteNumber(cat.amount) / largest) * 100))}%`,
                    backgroundColor: cat.color,
                  }}
                />
              </div>
            </li>
          ))}

          {data.length > top.length && (
            <li className="text-[11px] text-text-secondaryLight dark:text-text-secondaryDark pt-0.5">
              +{data.length - top.length} more{' '}
              {data.length - top.length === 1 ? 'category' : 'categories'}
            </li>
          )}
        </ul>
      )}
    </Card>
  );
};

export default CategoryPieChart;
