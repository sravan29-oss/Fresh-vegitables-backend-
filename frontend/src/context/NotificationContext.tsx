import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';
import { Notification } from '../types';
import { subscribeLiveUpdates } from '../services/liveSync';
import { playNotificationSound, unlockAudioContext } from '../utils/notificationSound';
import { NotificationToast } from '../components/common/NotificationToast';

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  activeToast: Notification | null;
  fetchNotifications: () => Promise<void>;
  markAllAsRead: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  closeToast: () => void;
  triggerLiveNotification: (notif: Notification) => void;
  playChime: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [activeToast, setActiveToast] = useState<Notification | null>(null);
  const lastProcessedIdRef = useRef<string | null>(null);

  // Initialize audio unlock
  useEffect(() => {
    unlockAudioContext();
  }, []);

  const closeToast = useCallback(() => {
    setActiveToast(null);
  }, []);

  const playChime = useCallback(() => {
    playNotificationSound();
  }, []);

  /**
   * Process a newly arrived notification:
   * 1. Check if already processed
   * 2. Play audible notification sound
   * 3. Show floating toast alert on screen
   * 4. Add to notification list & increment unread count
   */
  const triggerLiveNotification = useCallback((notif: Notification) => {
    if (!notif || !notif.id) return;
    if (lastProcessedIdRef.current === notif.id) return;

    lastProcessedIdRef.current = notif.id;
    try {
      localStorage.setItem('fresh_last_notif_id', notif.id);
    } catch {}

    // Play chime sound immediately!
    playNotificationSound();

    // Display floating animated toast on screen!
    setActiveToast(notif);

    // Update notification state
    setNotifications((prev) => {
      const exists = prev.some((n) => n.id === notif.id);
      if (exists) return prev;
      return [notif, ...prev];
    });
    setUnreadCount((c) => c + 1);
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await api.get('/notifications');
      if (res.data?.data) {
        const list: Notification[] = res.data.data.notifications || [];
        setNotifications(list);
        setUnreadCount(res.data.data.unread_count || 0);

        // If initial load and has recent unread broadcast, record baseline
        if (!lastProcessedIdRef.current && list.length > 0) {
          const stored = localStorage.getItem('fresh_last_notif_id');
          lastProcessedIdRef.current = stored || list[0].id;
        }
      }
    } catch {
      // ignore silently for guests
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Mark all read error', err);
    }
  }, []);

  const markAsRead = useCallback(async (id: string) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error('Mark read error', err);
    }
  }, []);

  // 1. Initial fetch on mount
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // 2. Real-time Cross-tab broadcast channel listener
  useEffect(() => {
    const unsubscribe = subscribeLiveUpdates(['notification', 'all'], (type, payload) => {
      if (type === 'notification' && payload) {
        triggerLiveNotification(payload);
      } else {
        fetchNotifications();
      }
    });

    return unsubscribe;
  }, [triggerLiveNotification, fetchNotifications]);

  // 3. Lightweight polling check for new notifications across clients
  useEffect(() => {
    let nextAllowedPollTime = 0;

    const pollInterval = setInterval(async () => {
      // Skip if tab is in the background or backoff is active
      if (typeof document !== 'undefined' && document.hidden) return;
      if (Date.now() < nextAllowedPollTime) return;

      try {
        const res = await api.get('/notifications/latest');
        const latest: Notification | null = res.data?.data;
        if (latest && latest.id) {
          const stored = localStorage.getItem('fresh_last_notif_id');
          if (latest.id !== lastProcessedIdRef.current && latest.id !== stored) {
            // New notification detected from admin!
            triggerLiveNotification(latest);
          }
        }
      } catch (err: any) {
        // If throttled (429) or network issue, back off for 60 seconds
        const status = err?.response?.status;
        nextAllowedPollTime = Date.now() + (status === 429 ? 60000 : 30000);
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(pollInterval);
  }, [triggerLiveNotification]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        activeToast,
        fetchNotifications,
        markAllAsRead,
        markAsRead,
        closeToast,
        triggerLiveNotification,
        playChime,
      }}
    >
      {children}
      {/* Global Toast Alert Display */}
      <NotificationToast
        notification={activeToast}
        onClose={closeToast}
      />
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
