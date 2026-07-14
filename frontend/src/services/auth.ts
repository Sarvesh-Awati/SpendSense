import { useMutation } from '@tanstack/react-query';
import api from './api';

export interface LoginParams {
  email: string;
  password: string;
}

export interface RegisterParams {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

// REST Client requests
export const loginAPI = async (data: LoginParams) => {
  const response = await api.post('/api/auth/login', data);
  return response.data;
};

export const registerAPI = async (data: RegisterParams) => {
  const response = await api.post('/api/auth/register', data);
  return response.data;
};

// React Query mutation wrappers
export const useLoginMutation = (options?: {
  onSuccess?: (data: any) => void;
  onError?: (error: any) => void;
}) => {
  return useMutation({
    mutationFn: loginAPI,
    ...options,
  });
};

export const useRegisterMutation = (options?: {
  onSuccess?: (data: any) => void;
  onError?: (error: any) => void;
}) => {
  return useMutation({
    mutationFn: registerAPI,
    ...options,
  });
};
