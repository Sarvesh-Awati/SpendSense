import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from './api';

export enum SubscriptionFrequency {
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY',
}

export interface CreateSubscriptionInput {
  name: string;
  amount: number;
  currency?: string;
  frequency: SubscriptionFrequency;
  startDate: string;
  isActive?: boolean;
  categoryId?: string | null;
}

export interface UpdateSubscriptionInput {
  name?: string;
  amount?: number;
  currency?: string;
  frequency?: SubscriptionFrequency;
  startDate?: string;
  isActive?: boolean;
  categoryId?: string | null;
}

export interface SubscriptionRecord {
  id: string;
  name: string;
  amount: number;
  currency: string;
  frequency: SubscriptionFrequency;
  startDate: string;
  nextRenewal: string;
  isActive: boolean;
  categoryId: string | null;
  category: {
    name: string;
    icon: string;
    color: string;
  } | null;
  daysUntilRenewal: number;
  monthlyEquivalentCost: number;
  annualCost: number;
}

// REST Requests
export const getSubscriptions = async (): Promise<{ status: string; data: { subscriptions: SubscriptionRecord[] } }> => {
  const response = await api.get('/subscriptions');
  return response.data;
};

export const getSubscription = async (id: string): Promise<{ status: string; data: { subscription: SubscriptionRecord } }> => {
  const response = await api.get(`/subscriptions/${id}`);
  return response.data;
};

export const createSubscription = async (data: CreateSubscriptionInput) => {
  const response = await api.post('/subscriptions', data);
  return response.data;
};

export const updateSubscription = async ({ id, data }: { id: string; data: UpdateSubscriptionInput }) => {
  const response = await api.put(`/subscriptions/${id}`, data);
  return response.data;
};

export const deleteSubscription = async (id: string) => {
  const response = await api.delete(`/subscriptions/${id}`);
  return response.data;
};

// React Query Hooks
export const useSubscriptions = () => {
  return useQuery({
    queryKey: ['subscriptions'],
    queryFn: getSubscriptions,
  });
};

export const useSubscription = (id: string) => {
  return useQuery({
    queryKey: ['subscription', id],
    queryFn: () => getSubscription(id),
    enabled: !!id,
  });
};

export const useCreateSubscription = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createSubscription,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
};

export const useUpdateSubscription = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateSubscription,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['subscription', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
};

export const useDeleteSubscription = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteSubscription,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
};
