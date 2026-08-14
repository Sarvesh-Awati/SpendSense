import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { isAxiosError } from 'axios';
import api from '../services/api';

export interface UserProfile {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  profilePictureUrl: string | null;
  preferredCurrency: string;
  language: string;
  dateFormat: string;
  timeFormat: string;
  theme: string;
  budgetAlerts: boolean;
  savingsReminders: boolean;
  subscriptionRenewals: boolean;
  receiptScanNotifications: boolean;
  emailNotifications: boolean;
  createdAt: string;
}

interface AuthContextType {
  user: UserProfile | null;
  accessToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (tokens: { accessToken: string; refreshToken: string }, user: UserProfile) => void;
  logout: () => void;
  updateUser: (user: UserProfile) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Logout method (resets states and wipes localStorage)
  const logout = useCallback(async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) {
      try {
        // Path is relative to the axios baseURL ('/api') — do NOT prefix it
        // again, or this resolves to /api/api/auth/logout and 404s, leaving
        // the refresh token live on the server.
        await api.post('/auth/logout', { refreshToken });
      } catch (e) {
        // Silent catch
      }
    }
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    setAccessToken(null);
    setUser(null);
    setIsLoading(false);
  }, []);

  const login = useCallback((tokens: { accessToken: string; refreshToken: string }, userProfile: UserProfile) => {
    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
    localStorage.setItem('user', JSON.stringify(userProfile));
    
    setAccessToken(tokens.accessToken);
    setUser(userProfile);
  }, []);

  const updateUser = useCallback((updatedUser: UserProfile) => {
    localStorage.setItem('user', JSON.stringify(updatedUser));
    setUser(updatedUser);
  }, []);

  // Initialize session on mount
  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = localStorage.getItem('accessToken');
      const storedUser = localStorage.getItem('user');

      if (storedToken && storedUser) {
        setAccessToken(storedToken);
        setUser(JSON.parse(storedUser));
        
        try {
          // Relative to the axios baseURL ('/api'). Prefixing it again would
          // resolve to /api/api/auth/me, 404, and log the user out on every
          // page load despite a perfectly valid session.
          const response = await api.get('/auth/me');
          setUser(response.data.data.user);
          localStorage.setItem('user', JSON.stringify(response.data.data.user));
        } catch (error) {
          // Only a 401 proves the session is actually invalid. A network
          // failure or a 5xx means the backend is unreachable or unwell —
          // keep the cached session rather than ejecting the user.
          if (isAxiosError(error) && error.response?.status === 401) {
            await logout();
          } else {
            console.error('Session verification unavailable, keeping cached session:', error);
          }
        }
      }
      setIsLoading(false);
    };

    initializeAuth();

    // Bind axios interceptor logouts directly to React context updates
    const handleAuthLogoutEvent = () => {
      setAccessToken(null);
      setUser(null);
    };

    window.addEventListener('auth-logout', handleAuthLogoutEvent);
    return () => {
      window.removeEventListener('auth-logout', handleAuthLogoutEvent);
    };
  }, [logout]);

  const value = {
    user,
    accessToken,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
