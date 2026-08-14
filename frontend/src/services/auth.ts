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

export interface ForgotPasswordParams {
  email: string;
}

export interface ResetPasswordParams {
  token: string;
  password: string;
}

// REST Client requests
export const loginAPI = async (data: LoginParams) => {
  const response = await api.post('/auth/login', data);
  return response.data;
};

export const registerAPI = async (data: RegisterParams) => {
  const response = await api.post('/auth/register', data);
  return response.data;
};

export const forgotPasswordAPI = async (data: ForgotPasswordParams) => {
  const response = await api.post('/auth/forgot-password', data);
  return response.data;
};

export const resetPasswordAPI = async (data: ResetPasswordParams) => {
  const response = await api.post('/auth/reset-password', data);
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

export const useForgotPasswordMutation = (options?: {
  onSuccess?: (data: any) => void;
  onError?: (error: any) => void;
}) => {
  return useMutation({
    mutationFn: forgotPasswordAPI,
    ...options,
  });
};

export const useResetPasswordMutation = (options?: {
  onSuccess?: (data: any) => void;
  onError?: (error: any) => void;
}) => {
  return useMutation({
    mutationFn: resetPasswordAPI,
    ...options,
  });
};

