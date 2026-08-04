import React from 'react';
import { ArrowUpRight, ArrowDownRight, Wallet, TrendingUp, TrendingDown, PiggyBank, Sparkles, Percent } from 'lucide-react';
import { formatCurrency } from '../../utils/formatCurrency';

interface StatCardsProps {
  summary: {
    totalBalance: number;
    monthlyIncome: number;
    monthlyExpenses: number;
    savings: number;
    savingsRate: number;
    dailyAverageExpense: number;
  };
  comparison: {
    incomeChangePercent: number;
    expenseChangePercent: number;
  };
  currency: string;
}

export const StatCards: React.FC<StatCardsProps> = ({ summary, comparison, currency }) => {
  const formatCurrencyLocal = (val: number) => {
    return formatCurrency(val, currency);
  };

  const stats = [
    {
      title: 'Total Balance',
      value: formatCurrencyLocal(summary.totalBalance),
      icon: Wallet,
      color: 'text-brand-secondary',
      bgColor: 'bg-brand-secondary/10',
      borderColor: 'border-brand-secondary/20',
      description: 'Cumulative all-time net balance',
    },
    {
      title: 'Monthly Income',
      value: formatCurrencyLocal(summary.monthlyIncome),
      icon: TrendingUp,
      color: 'text-finance-income',
      bgColor: 'bg-finance-income/10',
      borderColor: 'border-finance-income/20',
      trend: comparison.incomeChangePercent,
      description: 'MoM Inflow Inflow Change',
    },
    {
      title: 'Monthly Expenses',
      value: formatCurrencyLocal(summary.monthlyExpenses),
      icon: TrendingDown,
      color: 'text-finance-expense',
      bgColor: 'bg-finance-expense/10',
      borderColor: 'border-finance-expense/20',
      trend: comparison.expenseChangePercent,
      description: 'MoM Outflow Outflow Change',
    },
    {
      title: 'Monthly Savings',
      value: formatCurrencyLocal(summary.savings),
      icon: PiggyBank,
      color: 'text-brand-primary',
      bgColor: 'bg-brand-primary/10',
      borderColor: 'border-brand-primary/20',
      description: `Savings Rate: ${summary.savingsRate}%`,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-left">
      {stats.map((stat, idx) => {
        const Icon = stat.icon;
        const hasTrend = stat.trend !== undefined;
        const isTrendPos = stat.trend ? stat.trend > 0 : false;
        
        return (
          <div
            key={idx}
            className="p-6 rounded-3xl border border-border-light dark:border-border-dark bg-white dark:bg-card-dark shadow-premium dark:shadow-premium-dark flex flex-col justify-between hover:border-brand-primary/25 transition-all relative overflow-hidden group"
          >
            <div className="flex justify-between items-start mb-4">
              <div className={`w-10 h-10 rounded-xl bg-slate-50 dark:bg-[#111622] flex items-center justify-center text-text-primaryLight dark:text-text-primaryDark border border-border-light dark:border-border-dark`}>
                <Icon className="w-5 h-5" />
              </div>

              {hasTrend && (
                <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  isTrendPos
                    ? stat.title.includes('Expenses') 
                      ? 'bg-finance-expense/10 text-finance-expense' // Expense increase is bad (red)
                      : 'bg-finance-income/10 text-finance-income' // Income increase is good (green)
                    : stat.title.includes('Expenses')
                      ? 'bg-finance-income/10 text-finance-income' // Expense decrease is good (green)
                      : 'bg-finance-expense/10 text-finance-expense' // Income decrease is bad (red)
                }`}>
                  {isTrendPos ? (
                    <ArrowUpRight className="w-3 h-3" />
                  ) : (
                    <ArrowDownRight className="w-3 h-3" />
                  )}
                  {Math.abs(stat.trend!).toFixed(1)}%
                </span>
              )}
            </div>

            <div>
              <p className="text-[10px] uppercase font-bold tracking-wider text-text-secondaryLight dark:text-text-secondaryDark">
                {stat.title}
              </p>
              <h3 className="font-outfit text-2xl font-extrabold tracking-tight mt-1">
                {stat.value}
              </h3>
              <p className="text-[10px] text-text-secondaryLight dark:text-text-secondaryDark mt-2 flex items-center gap-1">
                {stat.title.includes('Savings') && <Percent className="w-3 h-3 text-brand-primary" />}
                {!stat.title.includes('Savings') && <Sparkles className="w-3 h-3 text-brand-secondary" />}
                <span>{stat.description}</span>
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};
export default StatCards;
