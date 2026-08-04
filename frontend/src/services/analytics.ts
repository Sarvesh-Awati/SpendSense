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

export const fetchAnalytics = async (): Promise<{ status: string; data: AnalyticsData }> => {
  const response = await api.get('/analytics');
  return response.data;
};

import { useQuery } from '@tanstack/react-query';

export const useAnalytics = () => {
  return useQuery({
    queryKey: ['analytics'],
    queryFn: fetchAnalytics,
    staleTime: 5 * 60 * 1000, 
  });
};
