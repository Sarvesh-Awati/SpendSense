import React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { ArrowDownRight, ArrowUpRight, ArrowRight, LineChart as LineChartIcon } from 'lucide-react';
import { formatCurrency, formatPercent } from '../../utils/formatCurrency';
import Card, { SectionLabel } from '../../components/ui/Card';

interface TrendChartProps {
  data: Array<{ date: string; income: number; expense: number }>;
  currency: string;
  /** Month total + MoM change, both already computed by the API. */
  monthlyExpenses: number;
  expenseChange: number | null;
  onAddTransaction?: () => void;
}

/**
 * Spending overview.
 *
 * Rendered on the warm paper surface so it reads as a light panel floating on
 * the charcoal canvas. Chrome is stripped back deliberately: no grid, no
 * Y axis, sparse X labels — the line carries the information.
 */
export const TrendChart: React.FC<TrendChartProps> = ({
  data,
  currency,
  monthlyExpenses,
  expenseChange,
  onAddTransaction,
}) => {
  // A trend needs more than one data point. With fewer active days than this
  // the plot is an empty rectangle, so we collapse to a compact state instead.
  const MIN_ACTIVE_DAYS = 3;
  const activeDays = data.filter((d) => d.income > 0 || d.expense > 0).length;
  const hasTrend = activeDays >= MIN_ACTIVE_DAYS;

  const formatXAxis = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const dateStr = payload[0].payload.date;

    return (
      <div className="bg-[#12161B] text-white px-3.5 py-2.5 rounded-xl shadow-float-dark">
        <p className="text-[11px] font-medium text-white/60 mb-1.5">
          {new Date(dateStr).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
          })}
        </p>
        <div className="space-y-1">
          {payload.map((entry: any) => (
            <p key={entry.dataKey} className="flex justify-between items-center gap-5 text-xs">
              <span className="flex items-center gap-1.5 text-white/70">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: entry.stroke }} />
                {entry.name}
              </span>
              <span className="font-semibold tnum">{formatCurrency(entry.value, currency)}</span>
            </p>
          ))}
        </div>
      </div>
    );
  };

  const down = expenseChange !== null && expenseChange < 0;

  return (
    <Card tone="bare" tier="secondary" className="h-full flex flex-col">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <SectionLabel>Spending Overview</SectionLabel>

          <p className="font-outfit text-[40px] sm:text-[48px] leading-tight font-bold tracking-tight tnum mt-4 break-words">
            {formatCurrency(monthlyExpenses, currency)}
          </p>

          <div className="flex items-center gap-1.5 mt-1.5">
            {expenseChange !== null && (
              <span
                className={`inline-flex items-center gap-0.5 text-xs font-semibold tnum ${
                  down ? 'text-brand-primary' : 'text-finance-expense'
                }`}
              >
                {down ? (
                  <ArrowDownRight className="w-3.5 h-3.5" aria-hidden="true" />
                ) : (
                  <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
                )}
                {formatPercent(expenseChange)}
              </span>
            )}
            <span className="text-[11px] text-text-secondaryLight dark:text-text-secondaryDark">
              {expenseChange !== null ? 'vs last month' : 'this month'}
            </span>
          </div>
        </div>

        {hasTrend && (
          <div className="flex items-center gap-3 shrink-0 pt-1">
            {[
              { label: 'In', color: '#10b981' },
              { label: 'Out', color: '#f43f5e' },
            ].map((item) => (
              <span key={item.label} className="flex items-center gap-1.5 text-[11px] font-medium text-text-secondaryLight dark:text-text-secondaryDark">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: item.color }} />
                {item.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {hasTrend ? (
        <div className="h-48 sm:h-56 w-full min-w-0 mt-8 -mx-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 6, right: 6, left: 6, bottom: 0 }}>
              <defs>
                <linearGradient id="heroIncome" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="heroExpense" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.16} />
                  <stop offset="100%" stopColor="#f43f5e" stopOpacity={0} />
                </linearGradient>
              </defs>

              <XAxis
                dataKey="date"
                tickFormatter={formatXAxis}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                minTickGap={56}
                tick={{ fontSize: 11, fill: '#9CA3AF' }}
                dy={10}
              />

              <YAxis hide domain={[0, (max: number) => (max > 0 ? max * 1.35 : 1)]} />

              <Tooltip
                content={<CustomTooltip />}
                cursor={{ stroke: '#12161B', strokeOpacity: 0.15, strokeWidth: 1 }}
              />

              <Area
                type="monotone"
                name="In"
                dataKey="income"
                stroke="#10b981"
                strokeWidth={2.25}
                fill="url(#heroIncome)"
                activeDot={{ r: 4, strokeWidth: 2, stroke: '#F7F7F4' }}
              />
              <Area
                type="monotone"
                name="Out"
                dataKey="expense"
                stroke="#f43f5e"
                strokeWidth={2.25}
                fill="url(#heroExpense)"
                activeDot={{ r: 4, strokeWidth: 2, stroke: '#F7F7F4' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        // Wide, short band: uses the full section width without reserving the
        // vertical space a real plot would need.
        <div className="mt-7 w-full flex flex-col sm:flex-row sm:items-center gap-5 py-6 px-6 sm:px-7 rounded-card bg-black/[0.02] dark:bg-white/[0.025]">
          <span className="w-11 h-11 rounded-full bg-black/5 dark:bg-white/[0.05] flex items-center justify-center shrink-0">
            <LineChartIcon
              className="w-5 h-5 text-text-secondaryLight dark:text-text-secondaryDark"
              aria-hidden="true"
            />
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-text-primaryLight dark:text-text-primaryDark">
              {activeDays === 0 ? 'No spending activity yet' : 'Not enough activity yet'}
            </p>
            <p className="text-xs text-text-secondaryLight dark:text-text-secondaryDark mt-1 leading-relaxed max-w-[62ch]">
              {activeDays === 0
                ? 'Add your first transaction to start building your spending history.'
                : 'Add a few transactions to see your spending trend and understand where your money goes.'}
            </p>
          </div>

          <button
            type="button"
            onClick={onAddTransaction}
            className="shrink-0 self-start sm:self-auto inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-semibold bg-brand-primary/12 text-brand-primary hover:bg-brand-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/50 transition-colors"
          >
            Add Transaction
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      )}
    </Card>
  );
};

export default TrendChart;
