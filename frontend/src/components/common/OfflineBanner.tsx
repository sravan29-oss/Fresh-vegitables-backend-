import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi, RefreshCw } from 'lucide-react';

export const OfflineBanner: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });
  const [showRestored, setShowRestored] = useState<boolean>(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowRestored(true);
      const timer = setTimeout(() => {
        setShowRestored(false);
      }, 3500);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowRestored(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline && !showRestored) return null;

  if (showRestored) {
    return (
      <aside
        aria-live="polite"
        className="bg-emerald-900/95 text-emerald-100 text-xs font-semibold py-2 px-4 text-center sticky top-0 z-50 shadow-md backdrop-blur-md flex items-center justify-center gap-2 transition-all duration-300"
      >
        <Wifi className="w-4 h-4 text-emerald-300 flex-shrink-0 animate-pulse" />
        <span>Connection restored! Fresh prices and real-time inventory are active.</span>
      </aside>
    );
  }

  return (
    <aside
      role="alert"
      aria-live="assertive"
      className="bg-amber-950/95 text-amber-200 text-xs font-medium py-2.5 px-4 text-center sticky top-0 z-50 shadow-lg backdrop-blur-md flex items-center justify-center gap-2 border-b border-amber-600/30"
    >
      <WifiOff className="w-4 h-4 text-amber-400 flex-shrink-0" />
      <span className="font-semibold text-amber-100">You are currently offline.</span>
      <span className="hidden sm:inline text-amber-200/90">
        You can safely browse previously loaded harvest items. Placing orders and live tracking require an internet connection.
      </span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="ml-2 inline-flex items-center gap-1 bg-amber-800/80 hover:bg-amber-700/80 text-amber-100 px-2 py-0.5 rounded text-[11px] font-bold transition-colors cursor-pointer"
        aria-label="Retry connection"
      >
        <RefreshCw className="w-3 h-3" />
        <span>Retry</span>
      </button>
    </aside>
  );
};
