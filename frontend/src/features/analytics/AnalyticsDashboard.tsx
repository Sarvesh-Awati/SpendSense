import React from 'react';
import { useAnalytics } from '../../services/analytics';
import { useAuth } from '../../context/AuthContext';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, AlertTriangle, Activity, Target, Zap, DollarSign, Calendar, CreditCard, Award, ArrowUp, ArrowDown } from 'lucide-react';

export const AnalyticsDashboard: React.FC = () => {
  const { user } = useAuth();
  const { data: response, isLoading, isError } = useAnalytics();
  const currency = user?.preferredCurrency || 'USD';

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 w-48 bg-slate-100 dark:bg-[#111622] rounded-xl mb-6"></div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1,2,3,4].map(i => <div key={i} className="h-32 bg-slate-100 dark:bg-[#111622] rounded-2xl"></div>)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <div className="h-96 bg-slate-100 dark:bg-[#111622] rounded-3xl"></div>
          <div className="h-96 bg-slate-100 dark:bg-[#111622] rounded-3xl"></div>
        </div>
      </div>
    );
  }

  if (isError || !response?.data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertTriangle className="w-14 h-14 text-finance-expense mb-4" />
        <h2 className="font-outfit font-bold text-xl mb-2">Failed to load Analytics</h2>
        <p className="text-text-secondaryLight dark:text-text-secondaryDark">We couldn't retrieve your deep analytics data.</p>
      </div>
    );
  }

  const { basic, averages, smart, cashFlow } = response.data;
  
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(val);
  };

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#f43f5e', '#14b8a6'];

  return (
    <div className="space-y-8 pb-10 animate-fade-in text-left">
      <div>
        <h1 className="font-outfit text-3xl font-bold tracking-tight">Spending Insights</h1>
        <p className="text-text-secondaryLight dark:text-text-secondaryDark mt-1">Deep heuristic analysis of your financial behavior.</p>
      </div>

      {/* Top Smart Averages */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="p-6 rounded-3xl border border-border-light dark:border-border-dark bg-white dark:bg-card-dark shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-sm font-semibold text-text-secondaryLight dark:text-text-secondaryDark">Daily Spending</h3>
            <Calendar className="w-5 h-5 text-brand-primary" />
          </div>
          <p className="text-2xl font-bold font-outfit">{formatCurrency(averages.dailySpending)}</p>
        </div>
        <div className="p-6 rounded-3xl border border-border-light dark:border-border-dark bg-white dark:bg-card-dark shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-sm font-semibold text-text-secondaryLight dark:text-text-secondaryDark">Average Tx Size</h3>
            <CreditCard className="w-5 h-5 text-blue-500" />
          </div>
          <p className="text-2xl font-bold font-outfit">{formatCurrency(averages.transactionAmount)}</p>
        </div>
        <div className="p-6 rounded-3xl border border-border-light dark:border-border-dark bg-white dark:bg-card-dark shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-sm font-semibold text-text-secondaryLight dark:text-text-secondaryDark">Avg. Monthly Savings</h3>
            <Target className="w-5 h-5 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold font-outfit">{formatCurrency(averages.monthlySavings)}</p>
        </div>
        <div className="p-6 rounded-3xl border border-border-light dark:border-border-dark bg-white dark:bg-card-dark shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-sm font-semibold text-text-secondaryLight dark:text-text-secondaryDark">Longest Streak</h3>
            <Activity className="w-5 h-5 text-amber-500" />
          </div>
          <p className="text-2xl font-bold font-outfit">{smart.longestSpendingStreak} Days</p>
        </div>
      </div>

      {/* Main Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Net Worth Area Chart */}
        <div className="p-6 rounded-3xl border border-border-light dark:border-border-dark bg-white dark:bg-card-dark shadow-sm">
          <h3 className="text-lg font-bold font-outfit mb-6">Net Worth Trend</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={basic.netWorthTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorNetWorth" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                  formatter={(value: number) => [formatCurrency(value), 'Balance']} 
                />
                <Area type="monotone" dataKey="balance" stroke="#10b981" fillOpacity={1} fill="url(#colorNetWorth)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Income vs Expense Bar Chart */}
        <div className="p-6 rounded-3xl border border-border-light dark:border-border-dark bg-white dark:bg-card-dark shadow-sm">
          <h3 className="text-lg font-bold font-outfit mb-6">Income vs Expense</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={basic.incomeVsExpense} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                  formatter={(value: number) => formatCurrency(value)} 
                />
                <Bar dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="expense" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Smart Insights Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="p-6 rounded-3xl border border-border-light dark:border-border-dark bg-gradient-to-br from-indigo-500/10 to-purple-500/10 dark:from-indigo-500/20 dark:to-purple-500/20 shadow-sm border-indigo-200 dark:border-indigo-900/50">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-indigo-500 rounded-xl text-white"><ArrowUp className="w-5 h-5" /></div>
            <h3 className="font-semibold text-text-primaryLight dark:text-white">Fastest Growing</h3>
          </div>
          {smart.fastestGrowingCategory ? (
            <>
              <p className="text-3xl font-bold font-outfit text-indigo-700 dark:text-indigo-400">{smart.fastestGrowingCategory.name}</p>
              <p className="text-sm font-medium mt-1 text-indigo-600/80 dark:text-indigo-400/80">+{smart.fastestGrowingCategory.growthPercent}% vs last month</p>
            </>
          ) : (
            <p className="text-sm text-text-secondaryLight dark:text-text-secondaryDark">Not enough data to calculate.</p>
          )}
        </div>

        <div className="p-6 rounded-3xl border border-border-light dark:border-border-dark bg-gradient-to-br from-rose-500/10 to-orange-500/10 dark:from-rose-500/20 dark:to-orange-500/20 shadow-sm border-rose-200 dark:border-rose-900/50">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-rose-500 rounded-xl text-white"><Calendar className="w-5 h-5" /></div>
            <h3 className="font-semibold text-text-primaryLight dark:text-white">Highest Spending Day</h3>
          </div>
          {smart.highestSpendingDay ? (
            <>
              <p className="text-3xl font-bold font-outfit text-rose-700 dark:text-rose-400">{smart.highestSpendingDay.date}</p>
              <p className="text-sm font-medium mt-1 text-rose-600/80 dark:text-rose-400/80">{formatCurrency(smart.highestSpendingDay.amount)} spent</p>
            </>
          ) : (
            <p className="text-sm text-text-secondaryLight dark:text-text-secondaryDark">No expenses tracked yet.</p>
          )}
        </div>

        <div className="p-6 rounded-3xl border border-border-light dark:border-border-dark bg-gradient-to-br from-emerald-500/10 to-teal-500/10 dark:from-emerald-500/20 dark:to-teal-500/20 shadow-sm border-emerald-200 dark:border-emerald-900/50">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-emerald-500 rounded-xl text-white"><Award className="w-5 h-5" /></div>
            <h3 className="font-semibold text-text-primaryLight dark:text-white">Biggest Savings</h3>
          </div>
          {smart.biggestSavingsMonth ? (
            <>
              <p className="text-3xl font-bold font-outfit text-emerald-700 dark:text-emerald-400">{smart.biggestSavingsMonth.month}</p>
              <p className="text-sm font-medium mt-1 text-emerald-600/80 dark:text-emerald-400/80">{formatCurrency(smart.biggestSavingsMonth.amount)} saved</p>
            </>
          ) : (
            <p className="text-sm text-text-secondaryLight dark:text-text-secondaryDark">No savings months tracked.</p>
          )}
        </div>
      </div>

      {/* AI Insights Section */}
      <div className="p-6 rounded-3xl border border-border-light dark:border-border-dark bg-white dark:bg-card-dark shadow-sm mt-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-violet-500/20">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold font-outfit text-text-primaryLight dark:text-white">AI Financial Advisor</h2>
            <p className="text-sm text-text-secondaryLight dark:text-text-secondaryDark">Personalized insights powered by Gemini 2.0</p>
          </div>
        </div>
        
        {response.data.aiInsights && response.data.aiInsights.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {response.data.aiInsights.map((insight, idx) => (
              <div key={idx} className="flex items-start gap-3 p-4 rounded-xl bg-slate-50 dark:bg-[#111622] border border-slate-100 dark:border-[#1a2235]">
                <div className="mt-0.5 text-violet-500"><Target className="w-5 h-5" /></div>
                <p className="text-sm font-medium leading-relaxed text-text-primaryLight dark:text-text-primaryDark">{insight}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center bg-slate-50 dark:bg-[#111622] rounded-2xl border border-dashed border-slate-200 dark:border-[#1a2235]">
            <p className="text-text-secondaryLight dark:text-text-secondaryDark font-medium">Generating your personalized financial insights...</p>
          </div>
        )}
      </div>

    </div>
  );
};

export default AnalyticsDashboard;
