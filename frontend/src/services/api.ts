import axios from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  const adminToken = localStorage.getItem('admin_token');

  // Check if request is originating from admin UI or targeting admin API
  const isAdminPage = typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');
  const isAdminEndpoint =
    config.url?.startsWith('/admin') ||
    config.url?.includes('/admin') ||
    config.url?.startsWith('/analytics') ||
    (config.url?.startsWith('/delivery') && !config.url?.includes('/delivery/settings')) ||
    config.url?.includes('/status') ||
    (config.url?.startsWith('/cms') && !config.url?.includes('/cms/homepage') && !config.url?.includes('/cms/settings')) ||
    config.url?.startsWith('/zones/admin') ||
    config.url?.startsWith('/coupons/admin') ||
    config.url?.startsWith('/notifications/admin') ||
    config.url?.startsWith('/sellers/admin') ||
    config.url?.startsWith('/audit-logs');

  if (!config.headers.Authorization) {
    if (isAdminPage || isAdminEndpoint) {
      if (adminToken) {
        config.headers.Authorization = `Bearer ${adminToken}`;
      } else if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } else if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    } else if (adminToken) {
      config.headers.Authorization = `Bearer ${adminToken}`;
    }
  }

  // Ensure multipart FormData requests let Axios & browser calculate boundary automatically
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    if (config.headers) {
      delete config.headers['Content-Type'];
    }
  }

  return config;
});

// Response interceptor with automatic token renewal and auto-recovery
let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: any) => void }> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Handle 401 Unauthorized
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      const isRefreshCall = originalRequest.url?.includes('/auth/refresh');
      const isLoginCall = originalRequest.url?.includes('/auth/login');
      if (isRefreshCall || isLoginCall) {
        return Promise.reject(error);
      }

      const refreshToken =
        localStorage.getItem('refresh_token') || localStorage.getItem('admin_refresh_token');

      if (refreshToken) {
        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          })
            .then((token) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              return api(originalRequest);
            })
            .catch((err) => Promise.reject(err));
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
          const res = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
          if (res.data?.data) {
            const newToken = res.data.data.token || res.data.data.accessToken;
            const newRefreshToken = res.data.data.refreshToken;

            if (newToken) {
              const isAdminPage =
                typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');
              if (isAdminPage && localStorage.getItem('admin_token')) {
                localStorage.setItem('admin_token', newToken);
                if (newRefreshToken) localStorage.setItem('admin_refresh_token', newRefreshToken);
              } else {
                localStorage.setItem('token', newToken);
                if (newRefreshToken) localStorage.setItem('refresh_token', newRefreshToken);
              }

              processQueue(null, newToken);
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              return api(originalRequest);
            }
          }
        } catch (refreshErr) {
          processQueue(refreshErr, null);
          // Refresh completely failed, purge dead session so UI does not stay frozen
          localStorage.removeItem('token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('user');
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('auth:expired'));
          }
          return Promise.reject(refreshErr);
        } finally {
          isRefreshing = false;
        }
      } else {
        // No refresh token available; purge dead token so subsequent public requests don't fail
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('auth:expired'));
        }
      }
    }

    return Promise.reject(error);
  }
);

export default api;
