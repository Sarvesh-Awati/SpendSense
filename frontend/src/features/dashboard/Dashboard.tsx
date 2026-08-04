import React from 'react';
import { useDashboardMetrics } from '../../services/dashboard';
import { useAuth } from '../../context/AuthContext';
import StatCards from './StatCards';
import TrendChart from './TrendChart';
import CategoryPieChart from './CategoryPieChart';
import MerchantLeaderboard from './MerchantLeaderboard';
import RecentFeed from './RecentFeed';
import BudgetSummaryWidget from './BudgetSummaryWidget';
import GoalsSummaryWidget from './GoalsSummaryWidget';
import SubscriptionsSummaryWidget from './SubscriptionsSummaryWidget';
import FinancialHealth from './FinancialHealth';
import { AlertTriangle, Calendar, Sparkles } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { data: response, isLoading, isError, refetch } = useDashboardMetrics();
  const metrics = response?.data;
  const preferredCurrency = user?.preferredCurrency || 'USD';

  // Format current calendar month header (e.g. "July, 2026")
  const getCurrentMonthLabel = () => {
    return new Date().toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse text-left">
        {/* Banner Skeleton */}
        <div className="border-b border-border-light dark:border-border-dark pb-6">
          <div className="h-9 bg-slate-100 dark:bg-[#111622] rounded-xl w-64" />
          <div className="h-4 bg-slate-100 dark:bg-[#111622] rounded-lg w-96 mt-2" />
        </div>

        {/* Stats Grid Skeletons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="p-6 rounded-3xl border border-border-light dark:border-border-dark bg-white dark:bg-card-dark h-36" />
          ))}
        </div>

        {/* Charts Grid Skeletons */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 p-6 rounded-3xl border border-border-light dark:border-border-dark bg-white dark:bg-card-dark h-80" />
          <div className="p-6 rounded-3xl border border-border-light dark:border-border-dark bg-white dark:bg-card-dark h-80" />
        </div>

        {/* Lists Grid Skeletons */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 p-6 rounded-3xl border border-border-light dark:border-border-dark bg-white dark:bg-card-dark h-80" />
          <div className="p-6 rounded-3xl border border-border-light dark:border-border-dark bg-white dark:bg-card-dark h-80" />
        </div>
      </div>
    );
  }

  if (isError || !metrics) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertTriangle className="w-14 h-14 text-finance-expense mb-4" />
        <h2 className="font-outfit font-bold text-xl mb-2">Failed to load Dashboard metrics</h2>
        <p className="text-sm text-text-secondaryLight dark:text-text-secondaryDark max-w-md mb-6">
          There was an error communicating with our analytical database. Please verify your connection and try again.
        </p>
        <button
          onClick={() => refetch()}
          className="px-5 py-3 bg-brand-primary text-white text-xs font-semibold rounded-xl hover:bg-emerald-600 transition-colors"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  const { summary, comparison, categorySpending, spendingTrend, topMerchants, recentTransactions } = metrics;

  return (
    <div className="space-y-6 text-left animate-fade-in">
      {/* Welcome & Time Range Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border-light dark:border-border-dark pb-6">
        <div>
          <h1 className="font-outfit text-3xl font-bold tracking-tight flex items-center gap-2">
            Overview <Sparkles className="w-6 h-6 text-brand-secondary" />
          </h1>
          <p className="text-sm text-text-secondaryLight dark:text-text-secondaryDark mt-1">
            Real-time analytics snapshot of your personal finance health.
          </p>
        </div>

        {/* Date Selector Indicator */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border-light dark:border-border-dark bg-white dark:bg-card-dark text-xs font-semibold text-text-secondaryLight dark:text-text-secondaryDark shadow-sm">
          <Calendar className="w-4 h-4 text-brand-primary" />
          <span>Period: <strong>{getCurrentMonthLabel()}</strong></span>
        </div>
      </div>

      {/* Financial Health Banner */}
      {metrics.health && (
        <FinancialHealth 
          score={metrics.health.score} 
          status={metrics.health.status} 
          insights={metrics.quickInsights || []} 
        />
      )}

      {/* Metrics Stat Cards */}
      <StatCards summary={summary} comparison={comparison} currency={preferredCurrency} />

      {/* Charts Grid Layer: Trend line (2/3) and Category Pie (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <TrendChart data={spendingTrend} currency={preferredCurrency} />
        </div>
        <div>
          <CategoryPieChart data={categorySpending} currency={preferredCurrency} />
        </div>
      </div>

      {/* Lists Grid Layer: Recent Feed (2/3) and Merchant Leaderboard (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RecentFeed transactions={recentTransactions} />
        </div>
        <div className="space-y-6">
          <MerchantLeaderboard merchants={topMerchants} currency={preferredCurrency} />
          <BudgetSummaryWidget />
          <GoalsSummaryWidget />
          <SubscriptionsSummaryWidget />
        </div>
      </div>
    </div>
  );
};
export default Dashboard;
