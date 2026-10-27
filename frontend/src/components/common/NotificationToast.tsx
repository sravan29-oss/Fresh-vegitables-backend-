import React, { useEffect, useState } from 'react';
import { Bell, X, Volume2, Sparkles, ExternalLink } from 'lucide-react';
import { playNotificationSound } from '../../utils/notificationSound';
import { Notification } from '../../types';

interface NotificationToastProps {
  notification: Notification | null;
  onClose: () => void;
  onOpenNotifications?: () => void;
}

export const NotificationToast: React.FC<NotificationToastProps> = ({
  notification,
  onClose,
  onOpenNotifications,
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (notification) {
      setIsVisible(true);
      const timer = setTimeout(() => {
        handleDismiss();
      }, 9000); // Auto-dismiss after 9 seconds

      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [notification]);

  if (!notification || !isVisible) return null;

  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  const handleReplayChime = (e: React.MouseEvent) => {
    e.stopPropagation();
    playNotificationSound();
  };

  return (
    <div
      role="alert"
      className="fixed top-5 right-5 z-[9999] max-w-sm sm:max-w-md w-full animate-in fade-in slide-in-from-top-6 duration-300 transition-all pointer-events-auto"
    >
      <div className="bg-slate-900/95 backdrop-blur-xl border-2 border-emerald-500/50 shadow-2xl shadow-emerald-950/60 rounded-3xl p-4 sm:p-5 text-white ring-4 ring-emerald-500/10">
        <div className="flex items-start gap-3.5">
          {/* Glowing Animated Bell Icon */}
          <div className="relative shrink-0 mt-0.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 text-slate-950 font-black flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <Bell className="w-5 h-5 animate-bounce" />
            </div>
            <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-slate-900"></span>
            </span>
          </div>

          {/* Content Body */}
          <div className="flex-1 min-w-0 pr-1">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="inline-flex items-center gap-1 text-[10px] font-black tracking-wider uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                <Sparkles className="w-3 h-3" />
                <span>Admin Announcement</span>
              </span>
              <span className="text-[10px] text-slate-400 font-medium">Just now</span>
            </div>

            <h4 className="text-sm font-black text-white tracking-tight leading-snug line-clamp-1">
              {notification.title}
            </h4>

            <p className="text-xs text-slate-300 mt-1 leading-relaxed line-clamp-2">
              {notification.message}
            </p>

            {/* Bottom Actions */}
            <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between gap-2 text-xs">
              <button
                type="button"
                onClick={handleReplayChime}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-emerald-400 transition-colors"
                title="Replay notification sound"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>Chime</span>
              </button>

              {onOpenNotifications && (
                <button
                  type="button"
                  onClick={() => {
                    handleDismiss();
                    onOpenNotifications();
                  }}
                  className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 px-3 py-1 rounded-xl transition-all"
                >
                  <span>View Details</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Close button */}
          <button
            type="button"
            onClick={handleDismiss}
            className="shrink-0 -mr-1 -mt-1 p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
            title="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
