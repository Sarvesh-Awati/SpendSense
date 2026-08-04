import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from './api';

export interface CreateBudgetInput {
  amount: number;
  currency?: string;
  startDate: string;
  endDate: string;
  categoryId?: string | null;
}

export interface UpdateBudgetInput {
  amount?: number;
  currency?: string;
  startDate?: string;
  endDate?: string;
  categoryId?: string | null;
}

export interface BudgetStatsResponse {
  id: string;
  amount: number;
  currency: string;
  startDate: string;
  endDate: string;
  userId: string;
  categoryId: string | null;
  category: {
    name: string;
    icon: string | null;
    color: string | null;
  } | null;
  spent: number;
  remaining: number;
  percentageUsed: number;
  isWarning: boolean;
  isExceeded: boolean;
  predictions?: {
    projectedSpend: number;
    recommendedDailyLimit: number;
    suggestedBudgetLimit: number;
    status: 'Safe' | 'At Risk' | 'Exceeded';
  };
}

// REST Requests
export const getBudgets = async (): Promise<{ status: string; data: { budgets: BudgetStatsResponse[] } }> => {
  const response = await api.get('/api/budgets');
  return response.data;
};

export const getBudget = async (id: string): Promise<{ status: string; data: { budget: BudgetStatsResponse } }> => {
  const response = await api.get(`/api/budgets/${id}`);
  return response.data;
};

export const createBudget = async (data: CreateBudgetInput) => {
  const response = await api.post('/api/budgets', data);
  return response.data;
};

export const updateBudget = async ({ id, data }: { id: string; data: UpdateBudgetInput }) => {
  const response = await api.put(`/api/budgets/${id}`, data);
  return response.data;
};

export const deleteBudget = async (id: string) => {
  const response = await api.delete(`/api/budgets/${id}`);
  return response.data;
};

// React Query Hooks
export const useBudgets = () => {
  return useQuery({
    queryKey: ['budgets'],
    queryFn: getBudgets,
  });
};

export const useBudget = (id: string, enabled = true) => {
  return useQuery({
    queryKey: ['budget', id],
    queryFn: () => getBudget(id),
    enabled: enabled && !!id,
  });
};

export const useCreateBudget = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createBudget,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      // Invalidate dashboard queries since overall metrics can change
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
};

export const useUpdateBudget = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateBudget,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: ['budget', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
};

export const useDeleteBudget = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteBudget,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
};
