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
 * The whole analytics payload — including the Gemini-generated `aiInsights` —
 * is produced server-side in a single request, so a slow or stalled model call
 * holds the entire response open. With no ceiling the page sat on its skeleton
 * (and the advisor on "Generating…") indefinitely. 20s is well above a healthy
 * response and still bounded; axios rejects with code `ECONNABORTED` after it.
 *
 * This is a client-side request timeout only — the API contract is unchanged.
 */
export const ANALYTICS_TIMEOUT_MS = 20_000;

export const fetchAnalytics = async (): Promise<{ status: string; data: AnalyticsData }> => {
  const response = await api.get('/analytics', { timeout: ANALYTICS_TIMEOUT_MS });
  return response.data;
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
