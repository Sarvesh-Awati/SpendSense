import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from './api';

export interface TransactionFilters {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: string;
  type?: 'INCOME' | 'EXPENSE';
  isSubscription?: boolean;
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface CreateTransactionData {
  amount: number;
  currency?: string;
  description?: string;
  merchant?: string;
  date: string;
  type: 'INCOME' | 'EXPENSE';
  paymentMethod?: string;
  categoryId: string;
  isSubscription?: boolean;
}

export interface UpdateTransactionData extends Partial<CreateTransactionData> {}

/**
 * Shape returned by the transaction endpoints.
 * `amount` is a number: the API serialises Prisma Decimal values before
 * responding, so no client-side coercion is needed.
 */
export interface TransactionRecord {
  id: string;
  amount: number;
  currency: string;
  description: string | null;
  merchant: string | null;
  date: string;
  type: 'INCOME' | 'EXPENSE';
  paymentMethod: string | null;
  isSubscription: boolean;
  userId: string;
  categoryId: string;
  receiptId: string | null;
  createdAt: string;
  updatedAt: string;
  category?: { name: string; icon: string | null; color: string | null } | null;
}

// REST Requests
export const getTransactions = async (filters: TransactionFilters) => {
  const response = await api.get('/transactions', { params: filters });
  return response.data;
};

export const getTransaction = async (id: string) => {
  const response = await api.get(`/transactions/${id}`);
  return response.data;
};

export const createTransaction = async (data: CreateTransactionData) => {
  const response = await api.post('/transactions', data);
  return response.data;
};

export const updateTransaction = async ({ id, data }: { id: string; data: UpdateTransactionData }) => {
  const response = await api.put(`/transactions/${id}`, data);
  return response.data;
};

export const deleteTransaction = async (id: string) => {
  const response = await api.delete(`/transactions/${id}`);
  return response.data;
};

export const getCategories = async () => {
  const response = await api.get('/categories');
  return response.data;
};

// React Query Hooks
export const useTransactions = (filters: TransactionFilters) => {
  return useQuery({
    queryKey: ['transactions', filters],
    queryFn: () => getTransactions(filters),
  });
};

export const useTransaction = (id: string, enabled = true) => {
  return useQuery({
    queryKey: ['transaction', id],
    queryFn: () => getTransaction(id),
    enabled: enabled && !!id,
  });
};

export const useCategories = () => {
  return useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
  });
};

export const useCreateTransaction = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createTransaction,
    onSuccess: () => {
      // Invalidate the transactions list cache to fetch updated ledger items
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
};

export const useUpdateTransaction = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateTransaction,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['transaction', variables.id] });
    },
  });
};

export const useDeleteTransaction = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteTransaction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
};
