import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useDashboardMetrics } from '../../services/dashboard';
import { useCreateTransaction } from '../../services/transactions';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui/Toast';
import { safePercentChange } from '../../utils/formatCurrency';
import TransactionForm from '../transactions/TransactionForm';
import HeroBalance from './HeroBalance';
import FlowSummary from './FlowSummary';
import TrendChart from './TrendChart';
import CategoryPieChart from './CategoryPieChart';
import MerchantLeaderboard from './MerchantLeaderboard';
import RecentFeed from './RecentFeed';
import BudgetSummaryWidget from './BudgetSummaryWidget';
import GoalsSummaryWidget from './GoalsSummaryWidget';
import SubscriptionsSummaryWidget from './SubscriptionsSummaryWidget';
import FinancialHealth from './FinancialHealth';
import InsightCard from './InsightCard';
import QuickAdd from './QuickAdd';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: response, isLoading, isError, error, refetch } = useDashboardMetrics();
  const createTransaction = useCreateTransaction();

  const metrics = response?.data;
  const preferredCurrency = user?.preferredCurrency || 'INR';

  const [composerType, setComposerType] = useState<'EXPENSE' | 'INCOME' | null>(null);

  const handleCreate = async (values: any) => {
    try {
      await createTransaction.mutateAsync(values);
      // useCreateTransaction only invalidates ['transactions'], so the dashboard
      // would otherwise serve its 5-minute-stale cache.
      await refetch();
      toast('Transaction added', 'success');
      setComposerType(null);
    } catch (err: any) {
      toast(err?.response?.data?.message || 'Failed to add transaction', 'error');
    }
  };

  const openExpense = () => setComposerType('EXPENSE');
  const openIncome = () => setComposerType('INCOME');

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-12">
        <div className="h-24 w-80 rounded-panel bg-white/5 dark:bg-white/5" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 h-[26rem] rounded-hero bg-white dark:bg-surface-raised" />
          <div className="lg:col-start-9 lg:col-span-4 space-y-6">
            <div className="h-32 rounded-panel bg-white dark:bg-card-dark" />
            <div className="h-32 rounded-panel bg-white dark:bg-card-dark" />
          </div>
        </div>
        <div className="h-[24rem] rounded-hero bg-surface-paper" />
      </div>
    );
  }

  if (isError || !metrics) {
    // 409 = some transactions have no converted amount, so totals would be
    // understated. The API refuses rather than showing an incomplete number.
    const status = (error as any)?.response?.status;
    const reportingBlocked = status === 409;
    const apiMessage = (error as any)?.response?.data?.message;

    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <AlertTriangle className="w-10 h-10 text-finance-expense mb-5" />
        <h2 className="font-outfit font-bold text-2xl mb-2 tracking-tight">
          {reportingBlocked ? 'Totals are temporarily unavailable' : 'Couldn’t load your dashboard'}
        </h2>
        <p className="text-sm text-text-secondaryLight dark:text-text-secondaryDark max-w-sm mb-7">
          {reportingBlocked
            ? apiMessage ||
              'Some transactions could not be converted into your reporting currency, so totals would be incomplete.'
            : 'We couldn’t reach the SpendSense API. Check your connection and try again.'}
        </p>
        <button
          onClick={() => refetch()}
          className="px-6 py-3 bg-brand-primary text-white text-sm font-semibold rounded-full hover:bg-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/60 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  const { summary, comparison, categorySpending, spendingTrend, topMerchants, recentTransactions } =
    metrics;

  // safePercentChange returns null for undefined/NaN/Infinity, and for a zero
  // previous month — the API reports 100 there, which reads as a real +100%.
  const incomeChange = safePercentChange(
    comparison?.incomeChangePercent,
    comparison?.prevMonthlyIncome
  );
  const expenseChange = safePercentChange(
    comparison?.expenseChangePercent,
    comparison?.prevMonthlyExpenses
  );

  return (
    <div className="pb-32">
      {/* ═══ Greeting — integrated into the page, no card ═══ */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-12">
        <div className="min-w-0">
          <p className="text-[15px] text-text-secondaryLight dark:text-text-secondaryDark">
            {greeting()},
          </p>
          <h1 className="font-outfit text-[34px] sm:text-[40px] leading-[1.1] font-bold tracking-[-0.02em] mt-1 truncate">
            {user?.firstName || 'there'}
          </h1>
        </div>

        <div className="text-left sm:text-right shrink-0">
          <p className="text-[15px] text-text-primaryLight dark:text-text-primaryDark font-medium">
            Your financial snapshot
          </p>
          <p className="text-[13px] text-text-secondaryLight dark:text-text-secondaryDark mt-0.5">
            {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            {' · '}
            {/* Totals below are converted into one reporting currency; say so
                explicitly so a mixed-currency figure is never misread. */}
            <span className="font-medium">Reported in {preferredCurrency}</span>
          </p>
        </div>
      </header>

      {/*
        Composition rule: exactly ONE elevated surface (the balance hero).
        Everything else sits directly on the page, separated by hairlines and
        whitespace. Columns are sized to intent, never split evenly.
      */}
      <div className="space-y-10 sm:space-y-14">
        {/* ── Hero: wide surface + lightweight supporting column ── */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch">
          <div className="lg:col-span-8">
            <HeroBalance
              totalBalance={summary.totalBalance}
              monthlySavings={summary.savings}
              savingsRate={summary.savingsRate}
              trend={spendingTrend}
              currency={preferredCurrency}
            />
          </div>

          {/* Not a card — a quiet column held by a single hairline */}
          <aside className="lg:col-span-4 flex flex-col justify-center gap-8 lg:pl-8 lg:border-l border-border-light dark:border-border-dark">
            <p className="text-[11px] font-semibold tracking-[0.06em] uppercase text-text-secondaryLight dark:text-text-secondaryDark">
              This month
            </p>
            <FlowSummary
              label="Income"
              amount={summary.monthlyIncome}
              change={incomeChange}
              riseIsGood
              currency={preferredCurrency}
            />
            <FlowSummary
              label="Expenses"
              amount={summary.monthlyExpenses}
              change={expenseChange}
              riseIsGood={false}
              currency={preferredCurrency}
            />
          </aside>
        </section>

        {/* ── Spending: uses the full content width ── */}
        <section className="pt-10 sm:pt-12 border-t border-border-light dark:border-border-dark">
          <TrendChart
            data={spendingTrend}
            currency={preferredCurrency}
            monthlyExpenses={summary.monthlyExpenses}
            expenseChange={expenseChange}
            onAddTransaction={openExpense}
          />
        </section>

        {/* ── Health (narrow) + Insight (wide) ── */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 pt-10 sm:pt-12 border-t border-border-light dark:border-border-dark">
          {metrics.health && (
            <div className="lg:col-span-4">
              <FinancialHealth score={metrics.health.score} status={metrics.health.status} />
            </div>
          )}
          <div
            className={
              metrics.health
                ? 'lg:col-span-8 lg:pl-12 lg:border-l border-border-light dark:border-border-dark flex items-center'
                : 'lg:col-span-12'
            }
          >
            <InsightCard insights={metrics.quickInsights || []} onAddTransaction={openExpense} />
          </div>
        </section>

        {/* ── Activity (wide) + category breakdown ── */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 pt-10 sm:pt-12 border-t border-border-light dark:border-border-dark items-start">
          <div className="lg:col-span-7 min-w-0">
            <RecentFeed transactions={recentTransactions} onAddTransaction={openExpense} />
          </div>
          <div className="lg:col-span-5 lg:pl-12 lg:border-l border-border-light dark:border-border-dark">
            <CategoryPieChart
              data={categorySpending}
              currency={preferredCurrency}
              onAddTransaction={openExpense}
            />
          </div>
        </section>

        {/* ── Secondary row: four quiet modules across the full width ── */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-10 pt-10 sm:pt-12 border-t border-border-light dark:border-border-dark items-start">
          <BudgetSummaryWidget />
          <GoalsSummaryWidget />
          <MerchantLeaderboard
            merchants={topMerchants}
            currency={preferredCurrency}
            onAddTransaction={openExpense}
          />
          <SubscriptionsSummaryWidget />
        </section>
      </div>

      <QuickAdd onAddExpense={openExpense} onAddIncome={openIncome} />

      {/* ═══ Shared composer — reuses the existing TransactionForm ═══ */}
      {composerType && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={composerType === 'INCOME' ? 'Add income' : 'Add expense'}
        >
          <div
            className="absolute inset-0 bg-[#080B0F]/75 backdrop-blur-sm"
            onClick={() => setComposerType(null)}
          />
          <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-card bg-white dark:bg-surface-raised border border-border-light dark:border-white/[0.06] p-7 shadow-float-dark motion-safe:animate-slide-up">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-outfit text-xl font-bold tracking-tight">
                {composerType === 'INCOME' ? 'Add Income' : 'Add Expense'}
              </h2>
              <button
                onClick={() => setComposerType(null)}
                aria-label="Close"
                className="p-2 rounded-full text-text-secondaryLight hover:bg-black/5 dark:hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/50 transition-colors"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <TransactionForm
              initialData={{
                type: composerType,
                date: new Date().toISOString().split('T')[0],
              }}
              onSubmit={handleCreate}
              isPending={createTransaction.isPending}
              onCancel={() => setComposerType(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
