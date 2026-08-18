import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

/**
 * Where the API lives.
 *
 * Development leaves `VITE_API_URL` unset and falls back to `/api`, which the
 * Vite dev server proxies to localhost:5001 — no configuration needed to run
 * locally. In production the frontend and API are deployed to different hosts
 * (Vercel and Render), so `/api` resolves to the static host and every request
 * 404s; `VITE_API_URL` must point at the API's origin. It is baked in at build
 * time, so changing it requires a rebuild.
 */
export const API_BASE_URL = import.meta.env.VITE_API_URL
  ? `${String(import.meta.env.VITE_API_URL).replace(/\/+$/, '')}/api`
  : '/api';

// Create custom Axios instance
export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (token) {
      prom.resolve(token);
    } else {
      prom.reject(error);
    }
  });
  failedQueue = [];
};

// Request Interceptor: Attach Authorization Bearer Token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('accessToken');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Catch 401 and perform Token Refresh Rotation
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Exit if no request config exists or if error is not a 401 Authorization error
    if (!error.response || error.response.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    // Do not attempt token refresh for auth endpoints that fail with 401.
    // These URLs are relative to the baseURL ('/api'), so they must be matched
    // WITHOUT the prefix — matching '/api/auth/login' never fired.
    const authEntryPoints = ['/auth/login', '/auth/register', '/auth/refresh'];
    if (authEntryPoints.some((path) => originalRequest.url?.includes(path))) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      // Queue the request while refresh is in progress
      return new Promise((resolve, reject) => {
        failedQueue.push({
          resolve: (token: string) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            resolve(api(originalRequest));
          },
          reject: (err: any) => {
            reject(err);
          },
        });
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
      isRefreshing = false;
      logoutUser();
      return Promise.reject(error);
    }

    try {
      /**
       * Deliberately a bare axios call, not `api` — routing this through the
       * instance would re-enter this same interceptor if the refresh itself
       * 401s. It still has to use API_BASE_URL: hardcoding '/api' sent the
       * refresh to the static host in production, so every expired session
       * became a forced logout.
       */
      const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
        refreshToken,
      });

      const { accessToken: newAccessToken, refreshToken: newRefreshToken } = response.data.data.tokens;

      // Update LocalStorage
      localStorage.setItem('accessToken', newAccessToken);
      localStorage.setItem('refreshToken', newRefreshToken);

      // Re-assign bearer authorization header
      if (originalRequest.headers) {
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      }

      processQueue(null, newAccessToken);
      isRefreshing = false;

      // Replay original request
      return api(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      isRefreshing = false;
      logoutUser();
      return Promise.reject(refreshError);
    }
  }
);

function logoutUser() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  
  // Custom event trigger to let AuthContext know it needs to update state
  window.dispatchEvent(new Event('auth-logout'));
  
  if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
    window.location.href = '/login';
  }
}

export default api;
