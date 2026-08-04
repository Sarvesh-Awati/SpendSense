import api from './api';

export interface UpdateProfileData {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  profilePictureUrl?: string;
  preferredCurrency?: string;
  language?: string;
  dateFormat?: string;
  timeFormat?: string;
  theme?: string;
  budgetAlerts?: boolean;
  savingsReminders?: boolean;
  subscriptionRenewals?: boolean;
  receiptScanNotifications?: boolean;
  emailNotifications?: boolean;
}

export const updateProfile = async (data: UpdateProfileData) => {
  const response = await api.put('/users/profile', data);
  return response.data;
};

export const changePassword = async (data: any) => {
  const response = await api.post('/users/change-password', data);
  return response.data;
};

export const logoutAllDevices = async () => {
  const response = await api.post('/users/logout-all');
  return response.data;
};

export const exportData = async () => {
  const response = await api.get('/users/export');
  return response.data;
};

export const deleteAccount = async () => {
  const response = await api.delete('/users/account');
  return response.data;
};
