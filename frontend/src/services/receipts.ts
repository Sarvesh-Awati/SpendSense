import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from './api';

export interface ReceiptExtractionResult {
  merchant: string | null;
  amount: number | null;
  date: string | null;
  currency: string | null;
  suggestedCategory: string | null;
  description: string | null;
  confidence: number | null;
}

export interface UploadResponse {
  status: string;
  data: {
    receipt: {
      id: string;
      createdAt: string;
    };
    extraction: ReceiptExtractionResult;
  };
}

export interface ReceiptRecord {
  id: string;
  imageUrl: string;
  rawText: string | null;
  extractedMerchant: string | null;
  extractedAmount: number | null;
  extractedDate: string | null;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

// REST Requests
export const uploadReceipt = async (file: File): Promise<UploadResponse> => {
  const formData = new FormData();
  formData.append('receipt', file);

  const response = await api.post('/receipts/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const getReceipts = async (): Promise<{ status: string; data: { receipts: ReceiptRecord[] } }> => {
  const response = await api.get('/receipts');
  return response.data;
};

export const getReceipt = async (id: string): Promise<{ status: string; data: { receipt: ReceiptRecord } }> => {
  const response = await api.get(`/receipts/${id}`);
  return response.data;
};

export const deleteReceipt = async (id: string) => {
  const response = await api.delete(`/receipts/${id}`);
  return response.data;
};

// React Query Hooks
export const useUploadReceipt = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: uploadReceipt,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
    },
  });
};

export const useReceipts = () => {
  return useQuery({
    queryKey: ['receipts'],
    queryFn: getReceipts,
  });
};

export const useDeleteReceipt = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteReceipt,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
    },
  });
};
