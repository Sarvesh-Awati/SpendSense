import { useQuery } from '@tanstack/react-query';
import api from './api';

export interface DashboardMetricsResponse {
  status: string;
  data: {
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
      prevMonthlyIncome: number;
      prevMonthlyExpenses: number;
    };
    categorySpending: Array<{
      id: string;
      name: string;
      icon: string;
      color: string;
      amount: number;
      percentage: number;
    }>;
    spendingTrend: Array<{
      date: string;
      income: number;
      expense: number;
    }>;
    topMerchants: Array<{
      merchant: string;
      amount: number;
    }>;
    recentTransactions: any[];
    health?: {
      score: number;
      status: 'Excellent' | 'Good' | 'Fair' | 'Needs Attention';
    };
    quickInsights?: string[];
    subscriptions?: {
      activeCount: number;
      monthlyTotal: number;
      upcomingRenewals: any[];
      topExpensive: any[];
    };
  };
}

export const getDashboardMetrics = async (): Promise<DashboardMetricsResponse> => {
  const response = await api.get('/api/dashboard');
  return response.data;
};

export const useDashboardMetrics = () => {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboardMetrics,
  });
};
