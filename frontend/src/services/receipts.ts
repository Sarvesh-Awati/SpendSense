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
  /**
   * Distinguishes "the model failed" from "the receipt was blank".
   * Both produce all-null fields, and telling the user their receipt was
   * unreadable when the AI service was simply down sends them off to retype
   * everything instead of retrying.
   */
  extractionStatus: 'EXTRACTED' | 'EMPTY' | 'FAILED';
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

/** Full record, as returned by `GET /receipts/:id`. Includes the image. */
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

/**
 * List projection from `GET /receipts`.
 *
 * `imageUrl` and `rawText` are omitted server-side: images are stored as
 * base64 data URLs, so including them made a list of twenty receipts a
 * multi-megabyte response. Fetch the full record by id when the image is
 * actually needed.
 */
export interface ReceiptSummary {
  id: string;
  extractedMerchant: string | null;
  extractedAmount: number | null;
  extractedDate: string | null;
  createdAt: string;
  updatedAt: string;
  /** Present once this receipt has been filed as a transaction. */
  transaction: { id: string } | null;
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

export const getReceipts = async (): Promise<{ status: string; data: { receipts: ReceiptSummary[] } }> => {
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
