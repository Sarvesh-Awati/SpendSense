import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import {
  Activity,
  AlertTriangle,
  Award,
  Calendar,
  CalendarDays,
  CreditCard,
  Loader2,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react';
import { useAnalytics, useAnalyticsInsights } from '../../services/analytics';
import { useAuth } from '../../context/AuthContext';
import { toFiniteNumber } from '../../utils/formatCurrency';
import Card, { SectionLabel } from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';

/**
 * Count + noun, agreeing in number. The streak metric previously rendered
 * "1 Days" because the noun was a hardcoded literal.
 */
const pluralize = (count: number, singular: string, plural = `${singular}s`) =>
  `${count} ${count === 1 ? singular : plural}`;

/**
 * A trend line needs at least two points. With fewer, Recharts still draws the
 * axes and grid — which is what produced ~390px of labelled but empty chart.
 */
const MIN_TREND_POINTS = 2;

export const AnalyticsDashboard: React.FC = () => {
  const { user } = useAuth();
  const { data: response, isLoading, isError, error, isFetching, refetch } = useAnalytics();

  /**
   * The advisor is its own query now.
   *
   * It used to ride along inside the analytics payload, so a slow or failing
   * Gemini call held every chart on the page hostage. Split out, the charts
   * render as soon as the aggregates land and this panel resolves — or fails,
   * and offers a retry that re-runs only the model — independently.
   */
  const {
    data: insightsData,
    isLoading: insightsLoading,
    isFetching: insightsFetching,
    isError: insightsError,
    refetch: refetchInsights,
  } = useAnalyticsInsights();
  // Reporting currency for every aggregated figure on this page. Falls back to
  // INR to match the rest of the app (and the User.preferredCurrency default);
  // it previously defaulted to USD, contradicting every other screen.
  const currency = user?.preferredCurrency || 'INR';

  if (isLoading) {
    return (
      <div className="pb-24 animate-pulse">
        <div className="h-9 w-64 rounded-panel bg-black/5 dark:bg-surface-sunk" />
        <div className="mt-12 h-[26rem] rounded-hero bg-white dark:bg-surface-raised" />
        <div className="mt-12 h-56 rounded-panel bg-black/5 dark:bg-surface-sunk" />
      </div>
    );
  }

  if (isError || !response?.data) {
    // The request now carries a 20s ceiling, so a stalled backend surfaces here
    // instead of leaving the page on its skeleton forever.
    const timedOut = (error as any)?.code === 'ECONNABORTED';

    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <AlertTriangle className="w-10 h-10 text-finance-expense mb-5" aria-hidden="true" />
        <h2 className="font-outfit font-bold text-2xl mb-2 tracking-tight">
          {timedOut ? 'Analytics took too long' : 'Couldn’t load your analytics'}
        </h2>
        <p className="text-sm text-text-secondaryLight dark:text-text-secondaryDark max-w-sm mb-7">
          {timedOut
            ? 'The request timed out before your insights came back. This usually clears on a second attempt.'
            : 'We couldn’t retrieve your analytics data. Check your connection and try again.'}
        </p>
        <Button onClick={() => refetch()} loading={isFetching} icon={RefreshCw}>
          Retry
        </Button>
      </div>
    );
  }

  const { basic, averages, smart } = response.data;

  const formatCurrency = (val: number) => {
    // Guard the same way the shared formatter does: undefined/NaN/Infinity
    // would otherwise render as "NaN" on screen.
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(
      toFiniteNumber(val)
    );
  };

  /**
   * Chart axis ticks. Uses the same reporting currency as every other figure
   * on the page — these were previously hardcoded to `$`, so an INR account
   * saw ₹ on the cards and $ on the axes of the same screen.
   * Compact notation keeps the axis narrow (₹1.8K rather than ₹1,800).
   *
   * One fraction digit, not zero: over a narrow domain (say -1,500 to -1,751)
   * whole-number compact notation rounded every tick to the same "-₹2K", so
   * the axis showed four identical labels. Intl still drops a trailing zero,
   * so round values stay "₹2K" rather than "₹2.0K".
   */
  const formatAxisTick = (val: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 1,
      notation: 'compact',
    }).format(toFiniteNumber(val));

  /** Dark pill tooltip, matching the dashboard's trend chart. */
  const ChartTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;

    return (
      <div className="bg-[#12161B] text-white px-3.5 py-2.5 rounded-xl shadow-float-dark">
        <p className="text-[11px] font-medium text-white/60 mb-1.5">{label}</p>
        <div className="space-y-1">
          {payload.map((entry: any) => (
            <p key={entry.dataKey} className="flex justify-between items-center gap-5 text-xs">
              <span className="flex items-center gap-1.5 text-white/70">
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: entry.color || entry.stroke || entry.fill }}
                />
                {entry.name}
              </span>
              <span className="font-semibold tnum">{formatCurrency(entry.value)}</span>
            </p>
          ))}
        </div>
      </div>
    );
  };

  // ── Data thresholds ───────────────────────────────────────────────────────
  // Nothing here alters a figure; each check only decides whether a plot has
  // enough real points to be worth the vertical space.
  const netWorthTrend = basic?.netWorthTrend ?? [];
  const hasNetWorthTrend = netWorthTrend.length >= MIN_TREND_POINTS;

  const flowMonths = basic?.incomeVsExpense ?? [];
  // Months with neither income nor expense contribute two zero-height bars.
  const activeFlowMonths = flowMonths.filter(
    (m) => toFiniteNumber(m?.income) > 0 || toFiniteNumber(m?.expense) > 0
  ).length;
  const hasFlowComparison = activeFlowMonths > 0;

  const streakDays = toFiniteNumber(smart?.longestSpendingStreak);

  const metrics = [
    { label: 'Daily Spending', icon: Calendar, value: formatCurrency(averages?.dailySpending) },
    { label: 'Average Tx Size', icon: CreditCard, value: formatCurrency(averages?.transactionAmount) },
    { label: 'Avg. Monthly Savings', icon: Target, value: formatCurrency(averages?.monthlySavings) },
    { label: 'Longest Streak', icon: Activity, value: pluralize(streakDays, 'Day') },
  ];

  const highlights = [
    {
      key: 'growing',
      icon: TrendingUp,
      label: 'Fastest growing category',
      value: smart?.fastestGrowingCategory?.name ?? null,
      detail: smart?.fastestGrowingCategory
        ? `Up ${toFiniteNumber(smart.fastestGrowingCategory.growthPercent)}% versus last month`
        : 'Needs two months of category history.',
    },
    {
      key: 'highestDay',
      icon: CalendarDays,
      label: 'Highest spending day',
      value: smart?.highestSpendingDay?.date ?? null,
      detail: smart?.highestSpendingDay
        ? `${formatCurrency(smart.highestSpendingDay.amount)} spent`
        : 'No expenses tracked yet.',
    },
    {
      key: 'savings',
      icon: Award,
      label: 'Biggest savings month',
      value: smart?.biggestSavingsMonth?.month ?? null,
      detail: smart?.biggestSavingsMonth
        ? `${formatCurrency(smart.biggestSavingsMonth.amount)} saved`
        : 'No savings months tracked.',
    },
  ];

  const insights = insightsData ?? [];
  const hasInsights = insights.length > 0;
  const insightsPending = insightsLoading || insightsFetching;

  return (
    <div className="pb-24 animate-fade-in text-left">
      <PageHeader
        title="Spending Insights"
        subtitle="Deep heuristic analysis of your financial behavior."
        className="mb-10 sm:mb-12"
        action={
          <p className="text-[13px] text-text-secondaryLight dark:text-text-secondaryDark">
            Reported in{' '}
            <span className="font-semibold text-text-primaryLight dark:text-text-primaryDark">
              {currency}
            </span>
          </p>
        }
      />

      {/*
        Composition rule, matching the dashboard: exactly ONE elevated surface.
        Net worth is the page's headline, so it holds the raised card together
        with the four averages. Everything below sits directly on the page,
        separated by hairlines and whitespace rather than more cards.
      */}
      <div className="space-y-10 sm:space-y-14">
        <Card tone="raised" tier="hero">
          <SectionLabel>Net Worth Trend</SectionLabel>

          {hasNetWorthTrend ? (
            <div className="h-56 sm:h-64 w-full min-w-0 mt-6 -mx-1">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={netWorthTrend} margin={{ top: 8, right: 6, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="analyticsNetWorth" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>

                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                    minTickGap={48}
                    tick={{ fontSize: 11, fill: '#9CA3AF' }}
                    dy={8}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={64}
                    // Fewer ticks over a narrow domain keeps each label distinct.
                    tickCount={4}
                    tick={{ fontSize: 11, fill: '#9CA3AF' }}
                    tickFormatter={formatAxisTick}
                  />
                  <Tooltip
                    content={<ChartTooltip />}
                    cursor={{ stroke: '#94a3b8', strokeOpacity: 0.25, strokeWidth: 1 }}
                  />
                  <Area
                    type="monotone"
                    name="Balance"
                    dataKey="balance"
                    stroke="#10b981"
                    strokeWidth={2.25}
                    fill="url(#analyticsNetWorth)"
                    activeDot={{ r: 4, strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState
              size="inline"
              title="Not enough history for a trend"
              description="Your net worth line appears once there are at least two days of recorded activity."
              to="/transactions"
              actionLabel="Add a transaction"
              className="mt-5 rounded-panel bg-black/[0.02] dark:bg-white/[0.03] px-6 py-5"
            />
          )}

          {/* Averages ride along inside the focal surface rather than forming a
              second row of four cards. */}
          <div className="mt-8 pt-7 border-t border-border-light dark:border-white/[0.06] grid grid-cols-2 lg:grid-cols-4 gap-y-7 gap-x-6">
            {metrics.map(({ label, icon: Icon, value }) => (
              <div key={label} className="min-w-0">
                <div className="flex items-center gap-1.5 text-text-secondaryLight dark:text-text-secondaryDark">
                  <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <p className="text-[11px] font-semibold tracking-[0.06em] uppercase truncate">
                    {label}
                  </p>
                </div>
                <p className="font-outfit text-[22px] sm:text-2xl font-bold tracking-tight tnum mt-2 truncate">
                  {value}
                </p>
              </div>
            ))}
          </div>
        </Card>

        {/* ── Income vs expense: full content width, no card chrome ── */}
        <section className="pt-10 sm:pt-12 border-t border-border-light dark:border-border-dark">
          <SectionLabel>Income vs Expense</SectionLabel>

          {hasFlowComparison ? (
            <>
              <div className="flex items-center gap-3 mt-3">
                {[
                  { label: 'Income', color: '#10b981' },
                  { label: 'Expense', color: '#f43f5e' },
                ].map((item) => (
                  <span
                    key={item.label}
                    className="flex items-center gap-1.5 text-[11px] font-medium text-text-secondaryLight dark:text-text-secondaryDark"
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    {item.label}
                  </span>
                ))}
              </div>

              {/*
                One or two months of bars stranded in the full content width is
                mostly empty plot. Cap the width so the data fills its frame;
                the bars and the figures behind them are unchanged.
              */}
              <div
                className="h-56 sm:h-64 w-full min-w-0 mt-5 -mx-1"
                style={{ maxWidth: flowMonths.length <= 2 ? '32rem' : undefined }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={flowMonths} margin={{ top: 8, right: 6, left: -12, bottom: 0 }}>
                    <XAxis
                      dataKey="month"
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                      minTickGap={24}
                      tick={{ fontSize: 11, fill: '#9CA3AF' }}
                      dy={8}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      width={64}
                      tick={{ fontSize: 11, fill: '#9CA3AF' }}
                      tickFormatter={formatAxisTick}
                    />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(148,163,184,0.12)' }} />
                    <Bar name="Income" dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={32} />
                    <Bar name="Expense" dataKey="expense" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          ) : (
            <EmptyState
              size="inline"
              title="No monthly activity to compare"
              description="Once a month has recorded income or expenses, the comparison appears here."
              to="/transactions"
              actionLabel="Add a transaction"
              className="mt-5 rounded-panel bg-black/[0.02] dark:bg-white/[0.03] px-6 py-5"
            />
          )}
        </section>

        {/* ── Highlights: three quiet columns, hairline separated ── */}
        <section className="pt-10 sm:pt-12 border-t border-border-light dark:border-border-dark">
          <SectionLabel>Highlights</SectionLabel>

          <div className="mt-7 grid grid-cols-1 sm:grid-cols-3 gap-8">
            {highlights.map(({ key, icon: Icon, label, value, detail }, i) => (
              <div
                key={key}
                className={`min-w-0 ${
                  i > 0 ? 'sm:pl-8 sm:border-l border-border-light dark:border-border-dark' : ''
                }`}
              >
                <div className="flex items-center gap-1.5 text-text-secondaryLight dark:text-text-secondaryDark">
                  <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <p className="text-[11px] font-semibold tracking-[0.06em] uppercase truncate">
                    {label}
                  </p>
                </div>

                {value ? (
                  <>
                    <p className="font-outfit text-xl font-bold tracking-tight mt-2.5 truncate">
                      {value}
                    </p>
                    <p className="text-xs text-text-secondaryLight dark:text-text-secondaryDark mt-1 tnum">
                      {detail}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-text-secondaryLight dark:text-text-secondaryDark mt-2.5 leading-relaxed">
                    {detail}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ── AI advisor ── */}
        <section className="pt-10 sm:pt-12 border-t border-border-light dark:border-border-dark">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-text-secondaryLight dark:text-text-secondaryDark">
                <Sparkles className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <SectionLabel>AI Financial Advisor</SectionLabel>
              </div>
              <p className="text-sm text-text-secondaryLight dark:text-text-secondaryDark mt-2.5 max-w-[60ch] leading-relaxed">
                Observations generated from your recent activity.
              </p>
            </div>

            {hasInsights && (
              <Button
                variant="ghost"
                size="sm"
                icon={RefreshCw}
                onClick={() => refetchInsights()}
                loading={insightsPending}
                className="shrink-0"
              >
                Refresh
              </Button>
            )}
          </div>

          {/*
            Three distinct states. The old markup branched only on
            `insights.length > 0`, so an empty array — the shape returned when
            the model call fails — rendered "Generating…" forever, with no way
            to retry and nothing actually in flight.
          */}
          {insightsPending ? (
            <div className="mt-6 flex items-center gap-2.5 text-sm text-text-secondaryLight dark:text-text-secondaryDark">
              <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />
              <span>Analyzing your activity…</span>
            </div>
          ) : hasInsights ? (
            <ul className="mt-4">
              {insights.map((insight, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-3 py-4 border-b border-border-light dark:border-border-dark last:border-b-0"
                >
                  <Target
                    className="w-4 h-4 mt-0.5 shrink-0 text-text-secondaryLight dark:text-text-secondaryDark"
                    aria-hidden="true"
                  />
                  <p className="text-sm leading-relaxed text-text-primaryLight dark:text-text-primaryDark">
                    {insight}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              size="inline"
              title={
                insightsError
                  ? 'Couldn’t reach the advisor'
                  : 'Insights aren’t available right now'
              }
              description={
                insightsError
                  ? 'The insights service didn’t respond. Your charts above are unaffected.'
                  : 'The advisor didn’t return anything for this period. That can happen when there’s little recent activity, or when the service is busy.'
              }
              actionLabel="Try again"
              onAction={() => refetchInsights()}
              className="mt-5 rounded-panel bg-black/[0.02] dark:bg-white/[0.03] px-6 py-5"
            />
          )}
        </section>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
