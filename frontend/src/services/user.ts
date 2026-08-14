import api from './api';

/**
 * Fields the profile endpoint accepts.
 * `password` and `email` are intentionally absent — both are credential
 * changes and require re-authentication. Use `changePassword` for the former;
 * email changes are not currently supported.
 */
export interface UpdateProfileData {
  firstName?: string;
  lastName?: string;
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

export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
}

/**
 * Changing a password revokes every existing session server-side, so the
 * response carries a fresh token pair for this device. Persisting it here
 * keeps the caller signed in; skipping it would log them out on next refresh.
 */
export const changePassword = async (data: ChangePasswordData) => {
  const response = await api.post('/users/change-password', data);

  const tokens = response.data?.data?.tokens;
  if (tokens?.accessToken && tokens?.refreshToken) {
    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
  }

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

/**
 * Account deletion is irreversible, so the server re-authenticates the caller.
 * Axios sends a DELETE body via the `data` option.
 */
export const deleteAccount = async (currentPassword: string) => {
  const response = await api.delete('/users/account', {
    data: { currentPassword },
  });
  return response.data;
};
