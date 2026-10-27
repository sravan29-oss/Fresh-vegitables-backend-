// Real-time cross-tab & live update synchronization
export type SyncEventType = 'products' | 'categories' | 'orders' | 'cart' | 'cms' | 'all';

let broadcastChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    broadcastChannel = new BroadcastChannel('fresh_vegetables_live_sync');
  }
} catch {
  // Fallback to window storage
}

/**
 * Trigger an update event across all tabs and windows
 */
export function notifyLiveUpdate(type: SyncEventType = 'all') {
  try {
    if (broadcastChannel) {
      broadcastChannel.postMessage({ type, timestamp: Date.now() });
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('fresh_veg_live_sync', `${type}:${Date.now()}`);
    }
  } catch (err) {
    console.warn('Live sync notification error', err);
  }
}

/**
 * Subscribe to live updates from other tabs / admin changes
 */
export function subscribeLiveUpdates(
  targetTypes: SyncEventType[] | 'all',
  callback: (type: SyncEventType) => void
): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleMessage = (type: SyncEventType) => {
    if (targetTypes === 'all' || targetTypes.includes(type) || type === 'all') {
      callback(type);
    }
  };

  const channelListener = (event: MessageEvent) => {
    if (event.data?.type) {
      handleMessage(event.data.type);
    }
  };

  const storageListener = (event: StorageEvent) => {
    if (event.key === 'fresh_veg_live_sync' && event.newValue) {
      const type = event.newValue.split(':')[0] as SyncEventType;
      handleMessage(type);
    }
  };

  if (broadcastChannel) {
    broadcastChannel.addEventListener('message', channelListener);
  }
  window.addEventListener('storage', storageListener);

  return () => {
    if (broadcastChannel) {
      broadcastChannel.removeEventListener('message', channelListener);
    }
    window.removeEventListener('storage', storageListener);
  };
}
