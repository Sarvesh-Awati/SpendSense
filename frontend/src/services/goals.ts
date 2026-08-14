import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from './api';

export interface CreateGoalInput {
  name: string;
  targetAmount: number;
  currentAmount?: number;
  currency?: string;
  targetDate?: string | null;
}

export interface UpdateGoalInput {
  name?: string;
  targetAmount?: number;
  currentAmount?: number;
  currency?: string;
  targetDate?: string | null;
}

export interface GoalResponse {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  currency: string;
  targetDate: string | null;
  userId: string;
  createdAt: string;
  updatedAt: string;
  progressPercentage: number;
  remainingAmount: number;
  daysRemaining: number | null;
  isCompleted: boolean;
  predictions?: {
    requiredMonthlyContribution: number | null;
    recommendedContribution: number;
    projectedCompletionDate: Date | null;
    completionProbability: 'High' | 'Medium' | 'Low' | null;
  };
}

// REST Requests
export const getGoals = async (): Promise<{ status: string; data: { goals: GoalResponse[] } }> => {
  const response = await api.get('/goals');
  return response.data;
};

export const getGoal = async (id: string): Promise<{ status: string; data: { goal: GoalResponse } }> => {
  const response = await api.get(`/goals/${id}`);
  return response.data;
};

export const createGoal = async (data: CreateGoalInput) => {
  const response = await api.post('/goals', data);
  return response.data;
};

export const updateGoal = async ({ id, data }: { id: string; data: UpdateGoalInput }) => {
  const response = await api.put(`/goals/${id}`, data);
  return response.data;
};

export const deleteGoal = async (id: string) => {
  const response = await api.delete(`/goals/${id}`);
  return response.data;
};

export const contributeGoal = async ({ id, amount }: { id: string; amount: number }) => {
  const response = await api.post(`/goals/${id}/contribute`, { amount });
  return response.data;
};

// React Query Hooks
export const useGoals = () => {
  return useQuery({
    queryKey: ['goals'],
    queryFn: getGoals,
  });
};

export const useGoal = (id: string, enabled = true) => {
  return useQuery({
    queryKey: ['goal', id],
    queryFn: () => getGoal(id),
    enabled: enabled && !!id,
  });
};

export const useCreateGoal = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createGoal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
};

export const useUpdateGoal = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateGoal,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      queryClient.invalidateQueries({ queryKey: ['goal', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
};

export const useDeleteGoal = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteGoal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
};

export const useContributeGoal = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: contributeGoal,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      queryClient.invalidateQueries({ queryKey: ['goal', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
};
