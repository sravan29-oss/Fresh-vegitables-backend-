import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';
import { User } from '../types';
import { AuthActionModal, AuthModalState } from '../components/common/AuthActionModal';

interface AuthContextType {
  user: User | null;
  adminUser: User | null;
  isLoading: boolean;
  login: (token: string, user: User, refreshToken?: string) => void;
  adminLogin: (token: string, user: User, refreshToken?: string) => void;
  logout: () => void;
  adminLogout: () => void;
  updateUser: (user: User) => void;
  // Dynamic Auth Animation Popups
  authModal: AuthModalState;
  showLoginSuccess: (user: User, isAdmin?: boolean, onComplete?: () => void) => void;
  showLogoutConfirm: (onConfirm: () => void) => void;
  showLogoutSuccess: (isAdmin?: boolean, onComplete?: () => void) => void;
  closeAuthModal: () => void;
}

const initialModalState: AuthModalState = {
  isOpen: false,
  type: 'login_success',
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const savedUser = localStorage.getItem('user');
      if (savedUser) return JSON.parse(savedUser);
      const savedAdmin = localStorage.getItem('admin_user');
      if (savedAdmin) {
        const a = JSON.parse(savedAdmin);
        return {
          id: a.id,
          name: a.name,
          email: a.email,
          mobile: '9876543210',
          role: a.role || 'admin',
        };
      }
      return null;
    } catch {
      return null;
    }
  });

  const [adminUser, setAdminUser] = useState<User | null>(() => {
    try {
      const savedAdmin = localStorage.getItem('admin_user');
      return savedAdmin ? JSON.parse(savedAdmin) : null;
    } catch {
      return null;
    }
  });

  const [isLoading, setIsLoading] = useState(false);
  const [authModal, setAuthModal] = useState<AuthModalState>(initialModalState);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('token');
      const refreshToken = localStorage.getItem('refresh_token');
      const adminToken = localStorage.getItem('admin_token');
      const isAdminPage = typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');

      if (adminToken) {
        try {
          const savedAdmin = localStorage.getItem('admin_user');
          if (savedAdmin && !adminUser) {
            setAdminUser(JSON.parse(savedAdmin));
          }
        } catch {
          // ignore
        }
      }

      if (token && !isAdminPage) {
        try {
          const res = await api.get('/auth/profile', {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.data?.data) {
            setUser(res.data.data);
            localStorage.setItem('user', JSON.stringify(res.data.data));
          }
        } catch (error: any) {
          if (error?.response?.status === 401 || error?.response?.status === 404) {
            if (refreshToken) {
              try {
                const refreshRes = await api.post('/auth/refresh', { refreshToken });
                if (refreshRes.data?.data) {
                  const d = refreshRes.data.data;
                  localStorage.setItem('token', d.token || d.accessToken);
                  if (d.refreshToken) localStorage.setItem('refresh_token', d.refreshToken);
                  if (d.user) {
                    setUser(d.user);
                    localStorage.setItem('user', JSON.stringify(d.user));
                    setIsLoading(false);
                    return;
                  }
                }
              } catch {}
            }
            localStorage.removeItem('token');
            localStorage.removeItem('refresh_token');
            localStorage.removeItem('user');
            setUser(null);
          }
        }
      }

      setIsLoading(false);
    };

    initAuth();

    const handleAuthExpired = () => {
      localStorage.removeItem('token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      setUser(null);
    };
    window.addEventListener('auth:expired', handleAuthExpired);
    return () => window.removeEventListener('auth:expired', handleAuthExpired);
  }, []);

  const login = (token: string, userData: User, refreshToken?: string) => {
    localStorage.setItem('token', token);
    if (refreshToken) {
      localStorage.setItem('refresh_token', refreshToken);
    }
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const adminLogin = (token: string, adminData: User, refreshToken?: string) => {
    localStorage.setItem('admin_token', token);
    if (refreshToken) {
      localStorage.setItem('admin_refresh_token', refreshToken);
    }
    localStorage.setItem('admin_user', JSON.stringify(adminData));
    setAdminUser(adminData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const adminLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_refresh_token');
    localStorage.removeItem('admin_user');
    setAdminUser(null);
  };

  const updateUser = (updated: User) => {
    setUser(updated);
    localStorage.setItem('user', JSON.stringify(updated));
  };

  // Auth animation popup triggers
  const showLoginSuccess = (targetUser: User, isAdmin = false, onComplete?: () => void) => {
    setAuthModal({
      isOpen: true,
      type: 'login_success',
      user: targetUser,
      isAdmin,
      onComplete,
    });
  };

  const showLogoutConfirm = (onConfirm: () => void) => {
    setAuthModal({
      isOpen: true,
      type: 'logout_confirm',
      onConfirm: () => {
        closeAuthModal();
        onConfirm();
      },
    });
  };

  const showLogoutSuccess = (isAdmin = false, onComplete?: () => void) => {
    setAuthModal({
      isOpen: true,
      type: 'logout_success',
      isAdmin,
      onComplete,
    });
  };

  const closeAuthModal = () => {
    setAuthModal(initialModalState);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        adminUser,
        isLoading,
        login,
        adminLogin,
        logout,
        adminLogout,
        updateUser,
        authModal,
        showLoginSuccess,
        showLogoutConfirm,
        showLogoutSuccess,
        closeAuthModal,
      }}
    >
      {children}
      <AuthActionModal modalState={authModal} onClose={closeAuthModal} />
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
