import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { formatCurrency } from '../../utils/formatCurrency';

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
}

export const CategoryPieChart: React.FC<CategoryPieChartProps> = ({ data, currency }) => {
  const formatCurrencyLocal = (val: number) => {
    return formatCurrency(val, currency);
  };

  // If no category distributions are present, render a placeholder layout
  const isEmpty = data.length === 0;
  const chartData = isEmpty
    ? [{ name: 'No Transactions', amount: 1, color: '#475569' }]
    : data;

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const dataInfo = payload[0].payload;
      return (
        <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-xl shadow-xl backdrop-blur-md text-left text-xs">
          <p className="flex items-center gap-1.5 font-bold text-white mb-1">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: dataInfo.color }} />
            {dataInfo.name}
          </p>
          <p className="text-slate-300">
            Spent: <span className="font-bold text-white">{formatCurrencyLocal(dataInfo.amount)}</span>
          </p>
          {!isEmpty && (
            <p className="text-slate-400">
              Share: <span className="font-bold text-white">{dataInfo.percentage}%</span>
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white dark:bg-card-dark p-6 rounded-3xl border border-border-light dark:border-border-dark shadow-premium dark:shadow-premium-dark text-left flex flex-col justify-between space-y-4 h-full">
      <div>
        <h3 className="font-outfit text-base font-bold tracking-tight">Category Distribution</h3>
        <p className="text-xs text-text-secondaryLight dark:text-text-secondaryDark mt-0.5">
          Distribution share of this month's expenses
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
        {/* Recharts Pie Donut Chart */}
        <div className="h-44 w-full relative flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip content={<CustomTooltip />} />
              <Pie
                data={chartData}
                dataKey="amount"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={75}
                paddingAngle={isEmpty ? 0 : 3}
                stroke="none"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>

          {/* Centered Total Marker */}
          {!isEmpty && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[10px] text-text-secondaryLight dark:text-text-secondaryDark uppercase font-bold tracking-wider">
                Total Expenses
              </span>
              <span className="text-sm font-extrabold font-outfit mt-0.5">
                {formatCurrencyLocal(data.reduce((acc, cat) => acc + cat.amount, 0))}
              </span>
            </div>
          )}
        </div>

        {/* Categories Legend List */}
        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
          {isEmpty ? (
            <p className="text-xs text-text-secondaryLight dark:text-text-secondaryDark italic py-4">
              Log expenses in transactions to see breakdown.
            </p>
          ) : (
            data.slice(0, 5).map((cat) => (
              <div key={cat.id} className="flex justify-between items-center text-xs">
                <span className="flex items-center gap-2 truncate max-w-[130px]">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                  <span className="font-semibold truncate text-text-primaryLight dark:text-text-primaryDark">
                    {cat.name}
                  </span>
                </span>
                <div className="text-right">
                  <p className="font-bold">{formatCurrencyLocal(cat.amount)}</p>
                  <p className="text-[10px] text-text-secondaryLight dark:text-text-secondaryDark">
                    {cat.percentage}%
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
export default CategoryPieChart;
