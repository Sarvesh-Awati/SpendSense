import { useQuery } from '@tanstack/react-query';
import api from './api';

export interface AnalyticsData {
  basic: {
    monthlySpendingTrend: { month: string; amount: number }[];
    incomeVsExpense: { month: string; income: number; expense: number }[];
    categoryComparison: { category: string; name: string; amount: number; percentage: number }[];
    netWorthTrend: { date: string; balance: number }[];
    savingsTrend: { month: string; amount: number }[];
    topMerchants: { merchant: string; amount: number }[];
    largestExpenses: any[];
  };
  averages: {
    dailySpending: number;
    weeklySpending: number;
    transactionAmount: number;
    monthlySavings: number;
  };
  smart: {
    top5Categories: { name: string; amount: number }[];
    top10Merchants: { merchant: string; amount: number }[];
    fastestGrowingCategory: { name: string; growthPercent: number } | null;
    largestTransaction: any | null;
    longestSpendingStreak: number;
    biggestSavingsMonth: { month: string; amount: number } | null;
    mostExpensiveWeekday: { day: string; amount: number } | null;
    mostExpensiveWeekend: { day: string; amount: number } | null;
    mostUsedPaymentMethod: { method: string; count: number } | null;
    highestSpendingDay: { date: string; amount: number } | null;
    highestIncomeMonth: { month: string; amount: number } | null;
  };
  cashFlow: {
    inflow: number;
    outflow: number;
    net: number;
  };
  aiInsights: string[];
}

/**
 * Charts and the AI advisor are now fetched separately.
 *
 * They used to arrive together, which meant a slow Gemini call held the entire
 * page — every chart on it already computed — behind text that occupies one
 * panel at the bottom. `includeInsights=false` tells the server to skip the
 * model entirely, so this request returns as fast as the database allows.
 */
export const ANALYTICS_TIMEOUT_MS = 20_000;

/** The model call is the slow half, and gets its own, longer ceiling. */
export const INSIGHTS_TIMEOUT_MS = 30_000;

export const fetchAnalytics = async (): Promise<{ status: string; data: AnalyticsData }> => {
  const response = await api.get('/analytics', {
    params: { includeInsights: false },
    timeout: ANALYTICS_TIMEOUT_MS,
  });
  return response.data;
};

export const fetchAnalyticsInsights = async (): Promise<string[]> => {
  const response = await api.get('/analytics/insights', { timeout: INSIGHTS_TIMEOUT_MS });
  return response.data?.data?.aiInsights ?? [];
};

export const useAnalytics = () => {
  return useQuery({
    queryKey: ['analytics'],
    queryFn: fetchAnalytics,
    staleTime: 5 * 60 * 1000,
    // React Query retries 3 times by default. Combined with the timeout above
    // that is up to ~80s of spinner before the user is told anything is wrong.
    // One retry still absorbs a transient blip.
    retry: 1,
  });
};

/**
 * AI insights, with their own loading and error state.
 *
 * Kept separate from `useAnalytics` so a model outage degrades one panel
 * instead of the page, and so retrying the advisor does not re-run every
 * aggregate behind the charts. Cached longer than the charts — the advice is
 * qualitative and does not change minute to minute.
 */
export const useAnalyticsInsights = () => {
  return useQuery({
    queryKey: ['analyticsInsights'],
    queryFn: fetchAnalyticsInsights,
    staleTime: 15 * 60 * 1000,
    retry: 1,
  });
};
