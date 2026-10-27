import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
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
    config.url?.startsWith('/delivery') ||
    config.url?.includes('/status') ||
    config.url?.startsWith('/cms') ||
    config.url?.startsWith('/zones/admin') ||
    config.url?.startsWith('/coupons') ||
    config.url?.startsWith('/notifications/admin') ||
    config.url?.startsWith('/sellers') ||
    config.url?.startsWith('/audit-logs');

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

  return config;
});

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Don't auto-redirect on login check failure
      const isAuthCheck = error.config.url?.includes('/profile');
      if (!isAuthCheck) {
        console.warn('Unauthorized API call');
      }
    }
    return Promise.reject(error);
  }
);

export default api;
