import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { API_BASE_URL } from '../services/api';
import { subscribeLiveUpdates, notifyLiveUpdate } from '../services/liveSync';

export interface NewOrderAlert {
  id: string;
  order_id: string;
  order_number: string;
  total: number;
  customer_name: string;
  customer_phone?: string;
  payment_method: string;
  payment_status: string;
  order_status: string;
  items_count?: number;
  created_at: string;
  timestamp: number;
}

interface AdminOrderAlertContextType {
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  volume: number;
  setVolume: (vol: number) => void;
  isAudioUnlocked: boolean;
  unlockAudio: () => Promise<void>;
  testSound: () => void;
  activeAlerts: NewOrderAlert[];
  dismissAlert: (id: string) => void;
  clearAllAlerts: () => void;
  todayNewOrderCount: number;
  requestDesktopNotification: () => Promise<void>;
  desktopNotificationPermission: NotificationPermission | 'unsupported';
}

const AdminOrderAlertContext = createContext<AdminOrderAlertContextType | undefined>(undefined);

// Web Audio API Synthesizer: Professional Quick-Commerce 2-Tone Chime
function playProfessionalChime(volume = 0.8): AudioContext | null {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return null;

    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    const clampedVol = Math.max(0.05, Math.min(1.0, volume));
    masterGain.gain.setValueAtTime(clampedVol, now);
    masterGain.connect(ctx.destination);

    // Tone 1: 587.33 Hz (D5 - Bright clear chime base)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now);
    // Envelope for Tone 1
    gain1.gain.setValueAtTime(0.0, now);
    gain1.gain.linearRampToValueAtTime(0.7, now + 0.015);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    osc1.connect(gain1);
    gain1.connect(masterGain);
    osc1.start(now);
    osc1.stop(now + 0.6);

    // Tone 2: 880.00 Hz (A5 - High harmonic chime finish, delayed by 110ms)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(880.00, now + 0.11);
    // Envelope for Tone 2
    gain2.gain.setValueAtTime(0.0, now);
    gain2.gain.setValueAtTime(0.0, now + 0.11);
    gain2.gain.linearRampToValueAtTime(0.85, now + 0.125);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
    osc2.connect(gain2);
    gain2.connect(masterGain);
    osc2.start(now + 0.11);
    osc2.stop(now + 0.9);

    // Tone 3: Harmonic sparkle (1174.66 Hz - D6)
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(1174.66, now + 0.14);
    gain3.gain.setValueAtTime(0.0, now);
    gain3.gain.setValueAtTime(0.0, now + 0.14);
    gain3.gain.linearRampToValueAtTime(0.35, now + 0.155);
    gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
    osc3.connect(gain3);
    gain3.connect(masterGain);
    osc3.start(now + 0.14);
    osc3.stop(now + 0.7);

    return ctx;
  } catch (err) {
    console.warn('[AdminOrderAlert] AudioContext playback note:', err);
    return null;
  }
}

export const AdminOrderAlertProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();

  // Sound preferences (persisted in localStorage)
  const [soundEnabled, setSoundEnabledState] = useState<boolean>(() => {
    const saved = localStorage.getItem('fresh_admin_sound_enabled');
    return saved !== null ? saved === 'true' : true;
  });

  const [volume, setVolumeState] = useState<number>(() => {
    const saved = localStorage.getItem('fresh_admin_sound_volume');
    return saved !== null ? parseFloat(saved) : 0.85;
  });

  const [isAudioUnlocked, setIsAudioUnlocked] = useState<boolean>(false);
  const [activeAlerts, setActiveAlerts] = useState<NewOrderAlert[]>([]);
  const [todayNewOrderCount, setTodayNewOrderCount] = useState<number>(0);
  const [desktopNotificationPermission, setDesktopNotificationPermission] = useState<
    NotificationPermission | 'unsupported'
  >(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'unsupported';
  });

  // Track seen order IDs to prevent duplicate alerts (Deduplication engine)
  const seenOrderIdsRef = useRef<Set<string>>(new Set());
  const isInitialSyncDoneRef = useRef<boolean>(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  const setSoundEnabled = (enabled: boolean) => {
    setSoundEnabledState(enabled);
    localStorage.setItem('fresh_admin_sound_enabled', String(enabled));
  };

  const setVolume = (vol: number) => {
    const clamped = Math.max(0.1, Math.min(1.0, vol));
    setVolumeState(clamped);
    localStorage.setItem('fresh_admin_sound_volume', String(clamped));
  };

  // Unlock audio context on user gesture (respects browser autoplay policy)
  const unlockAudio = useCallback(async () => {
    try {
      if (!audioContextRef.current) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          audioContextRef.current = new AudioContextClass();
        }
      }
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      setIsAudioUnlocked(true);
    } catch (e) {
      console.warn('Could not unlock audio context:', e);
    }
  }, []);

  // Test sound button handler
  const testSound = useCallback(() => {
    unlockAudio();
    playProfessionalChime(volume);
  }, [unlockAudio, volume]);

  // Request browser desktop notification permission
  const requestDesktopNotification = useCallback(async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const perm = await Notification.requestPermission();
        setDesktopNotificationPermission(perm);
      } catch (err) {
        console.warn('Desktop notification request error:', err);
      }
    }
  }, []);

  const dismissAlert = (id: string) => {
    setActiveAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  const clearAllAlerts = () => {
    setActiveAlerts([]);
  };

  // Process a genuine incoming new order
  const handleIncomingOrder = useCallback(
    (order: any, isInitialSeed = false) => {
      const orderId = order.order_id || order.id;
      if (!orderId) return;

      // 1. Deduplication check: if we already saw this order, SKIP completely!
      if (seenOrderIdsRef.current.has(orderId)) {
        return;
      }
      seenOrderIdsRef.current.add(orderId);

      // If this is the initial page load seed, simply populate the seen set without alerting!
      if (isInitialSeed || !isInitialSyncDoneRef.current) {
        return;
      }

      console.log(`[AdminOrderAlert] 🔔 New order arrived: #${order.order_number || orderId.slice(0, 8)}`);

      // 2. Play notification sound (if enabled)
      if (soundEnabled) {
        try {
          playProfessionalChime(volume);
        } catch (soundErr) {
          console.warn('[AdminOrderAlert] Audio playback prevented by browser:', soundErr);
        }
      }

      // 3. Increment new order count
      setTodayNewOrderCount((prev) => prev + 1);

      // 4. Construct alert object
      const alertItem: NewOrderAlert = {
        id: `alert_${orderId}_${Date.now()}`,
        order_id: orderId,
        order_number: order.order_number || orderId.slice(0, 8).toUpperCase(),
        total: Number(order.total || 0),
        customer_name: order.customer_name || order.address_snapshot?.full_name || 'Customer',
        customer_phone: order.customer_phone || order.address_snapshot?.phone || '',
        payment_method: String(order.payment_method || 'cod').toUpperCase(),
        payment_status: String(order.payment_status || 'pending').toUpperCase(),
        order_status: String(order.order_status || 'pending').toUpperCase(),
        items_count: order.items_count || order.items?.length || 1,
        created_at: order.created_at || new Date().toISOString(),
        timestamp: Date.now(),
      };

      // Add to visible floating banner queue (max 5 alerts)
      setActiveAlerts((prev) => [alertItem, ...prev.slice(0, 4)]);

      // 5. Native OS Desktop Notification
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        try {
          const notif = new Notification(`🛒 New Order #${alertItem.order_number} Received!`, {
            body: `₹${alertItem.total.toFixed(2)} from ${alertItem.customer_name} (${alertItem.payment_method})`,
            icon: '/logo.png',
            tag: `order_${orderId}`,
          });
          notif.onclick = () => {
            window.focus();
            navigate(`/admin/orders/${orderId}`);
          };
        } catch (e) {
          console.warn('Native notification failed:', e);
        }
      }
    },
    [soundEnabled, volume, navigate]
  );

  // 1. Initial Sync: Load existing orders into seenOrderIdsRef so NO SOUND is played on page load
  useEffect(() => {
    let isMounted = true;

    async function initialSync() {
      try {
        const token = localStorage.getItem('admin_token');
        if (!token) return;

        const res = await api.get('/orders/admin/recent-alerts');
        if (res.data?.data && Array.isArray(res.data.data)) {
          res.data.data.forEach((ord: any) => {
            const id = ord.order_id || ord.id;
            if (id) seenOrderIdsRef.current.add(id);
          });
        }
      } catch (err) {
        console.warn('[AdminOrderAlert] Initial alerts sync note:', err);
      } finally {
        if (isMounted) {
          isInitialSyncDoneRef.current = true;
        }
      }
    }

    initialSync();

    // Auto-unlock audio on first user click anywhere in admin panel
    const handleFirstInteraction = () => {
      unlockAudio();
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };
    window.addEventListener('click', handleFirstInteraction);
    window.addEventListener('keydown', handleFirstInteraction);

    return () => {
      isMounted = false;
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };
  }, [unlockAudio]);

  // 2. Real-time Connection: Server-Sent Events (SSE) Stream
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimeout: any = null;
    let isCancelled = false;

    const connectSSE = () => {
      const adminToken = localStorage.getItem('admin_token');
      if (!adminToken) return;

      const sseUrl = `${API_BASE_URL}/orders/admin/live-stream?token=${encodeURIComponent(adminToken)}`;

      try {
        eventSource = new EventSource(sseUrl);

        eventSource.addEventListener('new_order', (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data);
            handleIncomingOrder(data);
          } catch (err) {
            console.warn('[AdminOrderAlert] SSE payload parse error:', err);
          }
        });

        eventSource.addEventListener('handshake', () => {
          // Connected cleanly
        });

        eventSource.onerror = () => {
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          if (!isCancelled) {
            // Reconnect backoff after 5 seconds
            reconnectTimeout = setTimeout(connectSSE, 5000);
          }
        };
      } catch (err) {
        console.warn('[AdminOrderAlert] EventSource connection note:', err);
        if (!isCancelled) {
          reconnectTimeout = setTimeout(connectSSE, 10000);
        }
      }
    };

    connectSSE();

    // 3. Fallback Authenticated Polling (Runs every 15 seconds to ensure zero missed orders)
    const pollInterval = setInterval(async () => {
      const adminToken = localStorage.getItem('admin_token');
      if (!adminToken) return;

      try {
        const res = await api.get('/orders/admin/recent-alerts');
        if (res.data?.data && Array.isArray(res.data.data)) {
          res.data.data.forEach((ord: any) => {
            const id = ord.order_id || ord.id;
            if (id && !seenOrderIdsRef.current.has(id)) {
              handleIncomingOrder(ord);
            }
          });
        }
      } catch (err) {
        // Silent polling failure fallback
      }
    }, 15000);

    // 4. Cross-tab synchronization via liveSync
    const unsubscribeSync = subscribeLiveUpdates(['orders'], (type, payload) => {
      if (payload && (payload.order_id || payload.id)) {
        handleIncomingOrder(payload);
      }
    });

    return () => {
      isCancelled = true;
      if (eventSource) eventSource.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      clearInterval(pollInterval);
      unsubscribeSync();
    };
  }, [handleIncomingOrder]);

  return (
    <AdminOrderAlertContext.Provider
      value={{
        soundEnabled,
        setSoundEnabled,
        volume,
        setVolume,
        isAudioUnlocked,
        unlockAudio,
        testSound,
        activeAlerts,
        dismissAlert,
        clearAllAlerts,
        todayNewOrderCount,
        requestDesktopNotification,
        desktopNotificationPermission,
      }}
    >
      {children}
    </AdminOrderAlertContext.Provider>
  );
};

export const useAdminOrderAlerts = () => {
  const context = useContext(AdminOrderAlertContext);
  if (!context) {
    throw new Error('useAdminOrderAlerts must be used within an AdminOrderAlertProvider');
  }
  return context;
};
