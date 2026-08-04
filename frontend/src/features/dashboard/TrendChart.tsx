import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { formatCurrency } from '../../utils/formatCurrency';

interface TrendChartProps {
  data: Array<{
    date: string;
    income: number;
    expense: number;
  }>;
  currency: string;
}

export const TrendChart: React.FC<TrendChartProps> = ({ data, currency }) => {
  // Format Y Axis label values
  const formatYAxis = (value: number) => {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency,
      maximumFractionDigits: 0,
      notation: 'compact',
    }).format(value);
  };

  // Format X Axis date keys (e.g. "2026-07-14" to "Jul 14")
  const formatXAxis = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // Custom tooltips inside Recharts graph
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const dateStr = payload[0].payload.date;
      const formattedDate = new Date(dateStr).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });

      return (
        <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl shadow-xl backdrop-blur-md text-left">
          <p className="text-xs font-bold text-slate-400 mb-2">{formattedDate}</p>
          <div className="space-y-1 text-xs">
            <p className="flex justify-between items-center gap-6">
              <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                Income:
              </span>
              <span className="font-bold text-white">{formatCurrency(payload[0].value, currency)}</span>
            </p>
            <p className="flex justify-between items-center gap-6">
              <span className="flex items-center gap-1.5 text-rose-400 font-semibold">
                <span className="w-2 h-2 rounded-full bg-rose-400" />
                Expense:
              </span>
              <span className="font-bold text-white">{formatCurrency(payload[1].value, currency)}</span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white dark:bg-card-dark p-6 rounded-3xl border border-border-light dark:border-border-dark shadow-premium dark:shadow-premium-dark text-left space-y-4">
      <div>
        <h3 className="font-outfit text-base font-bold tracking-tight">Spending Trend</h3>
        <p className="text-xs text-text-secondaryLight dark:text-text-secondaryDark mt-0.5">
          Comparing daily cash inflow and outflow charts for the last 30 days
        </p>
      </div>

      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.15} />
            
            <XAxis
              dataKey="date"
              tickFormatter={formatXAxis}
              tickLine={false}
              axisLine={false}
              style={{ fontSize: '10px', fill: '#94a3b8' }}
              dy={10}
            />
            
            <YAxis
              tickFormatter={formatYAxis}
              tickLine={false}
              axisLine={false}
              style={{ fontSize: '10px', fill: '#94a3b8' }}
            />

            <Tooltip content={<CustomTooltip />} />

            <Legend
              verticalAlign="top"
              height={36}
              iconType="circle"
              iconSize={6}
              wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }}
            />

            <Area
              type="monotone"
              name="Income"
              dataKey="income"
              stroke="#10b981"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorIncome)"
              activeDot={{ r: 4 }}
            />

            <Area
              type="monotone"
              name="Expense"
              dataKey="expense"
              stroke="#ef4444"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorExpense)"
              activeDot={{ r: 4 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
export default TrendChart;
