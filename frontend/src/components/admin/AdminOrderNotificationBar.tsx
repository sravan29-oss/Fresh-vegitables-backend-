import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Volume2,
  VolumeX,
  Bell,
  Play,
  X,
  ExternalLink,
  ShoppingBag,
  Check,
  Mail,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { useAdminOrderAlerts } from '../../context/AdminOrderAlertContext';

export const AdminOrderNotificationBar: React.FC = () => {
  const navigate = useNavigate();
  const {
    soundEnabled,
    setSoundEnabled,
    volume,
    setVolume,
    testSound,
    testEmailAlert,
    activeAlerts,
    dismissAlert,
    todayNewOrderCount,
    requestDesktopNotification,
    desktopNotificationPermission,
    isAudioUnlocked,
    unlockAudio,
  } = useAdminOrderAlerts();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [emailTestResult, setEmailTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setIsSettingsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTestEmail = async () => {
    try {
      setIsTestingEmail(true);
      setEmailTestResult(null);
      const res = await testEmailAlert();
      setEmailTestResult(res);
    } catch (err: any) {
      setEmailTestResult({
        success: false,
        message: err.message || 'Failed to trigger test email',
      });
    } finally {
      setIsTestingEmail(false);
    }
  };

  return (
    <>
      {/* ─── Top Bar Controls (Placed inside AdminLayout Header) ─── */}
      <div className="flex items-center gap-2 relative" ref={settingsRef}>
        
        {/* Live New Order Counter Badge */}
        {todayNewOrderCount > 0 && (
          <button
            onClick={() => navigate('/admin/orders')}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-black cursor-pointer hover:bg-emerald-500/25 transition-all shadow-xs"
            title="View today's incoming orders"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            <span>{todayNewOrderCount} New</span>
          </button>
        )}

        {/* Audio Unlocked Status Pill if not yet interacted */}
        {!isAudioUnlocked && (
          <button
            onClick={unlockAudio}
            className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[11px] font-bold hover:bg-amber-500/20 transition-all cursor-pointer"
            title="Click once to enable live audio playback in your browser"
          >
            <Bell className="w-3 h-3 text-amber-400 animate-bounce" />
            <span>Enable Sound</span>
          </button>
        )}

        {/* Audio / Sound Alerts Toggle Button */}
        <button
          onClick={() => setIsSettingsOpen(!isSettingsOpen)}
          className={`h-9 px-3 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs ${
            soundEnabled
              ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-emerald-400'
              : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-500'
          }`}
          title="Order Sound & Notification Settings"
          aria-label="Sound Settings"
        >
          {soundEnabled ? (
            <Volume2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <VolumeX className="w-4 h-4 text-slate-500" />
          )}
          <span className="hidden sm:inline">
            Sound: {soundEnabled ? `${Math.round(volume * 100)}%` : 'Off'}
          </span>
        </button>

        {/* Sound & Notification Settings Dropdown Popover */}
        {isSettingsOpen && (
          <div className="absolute right-0 top-11 w-80 rounded-2xl bg-slate-950 border border-slate-800 p-4 shadow-2xl z-50 text-slate-100 animate-in fade-in slide-in-from-top-2 duration-150 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-emerald-400" />
                <h4 className="font-extrabold text-xs uppercase tracking-wider text-white">
                  Order Alert Settings
                </h4>
              </div>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Chime Sound Toggle Switch */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-white">Chime Sound Alert</p>
                <p className="text-[10.5px] text-slate-400">Plays when new order arrives</p>
              </div>
              <button
                type="button"
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                  soundEnabled ? 'bg-emerald-500' : 'bg-slate-800'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                    soundEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Volume Slider */}
            {soundEnabled && (
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-400 text-[11px]">Volume</span>
                  <span className="text-emerald-400 font-mono font-bold">
                    {Math.round(volume * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>
            )}

            {/* Test Sound Button */}
            <button
              onClick={testSound}
              className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-emerald-400 hover:text-emerald-300 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Test Chime Sound</span>
            </button>

            {/* Email Notification Diagnostic Section */}
            <div className="pt-2 border-t border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-white">Email Notification</p>
                  <p className="text-[10px] text-slate-400">freshvegitables29@gmail.com</p>
                </div>
              </div>

              <button
                onClick={handleTestEmail}
                disabled={isTestingEmail}
                className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-sky-400 hover:text-sky-300 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98 disabled:opacity-50"
              >
                {isTestingEmail ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Mail className="w-3.5 h-3.5" />
                )}
                <span>{isTestingEmail ? 'Verifying SMTP...' : 'Test Email Alert'}</span>
              </button>

              {emailTestResult && (
                <div
                  className={`p-2.5 rounded-xl border text-[11px] leading-relaxed flex items-start gap-2 ${
                    emailTestResult.success
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                  }`}
                >
                  {emailTestResult.success ? (
                    <Check className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                  )}
                  <div className="flex-1">
                    <p className="font-semibold">{emailTestResult.message}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Desktop OS Notification Permission */}
            <div className="pt-2 border-t border-slate-800/80">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-white">Browser Notifications</p>
                  <p className="text-[10px] text-slate-400">Desktop popup alerts</p>
                </div>
                {desktopNotificationPermission === 'granted' ? (
                  <span className="text-[10.5px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1">
                    <Check className="w-3 h-3" /> Enabled
                  </span>
                ) : (
                  <button
                    onClick={requestDesktopNotification}
                    className="text-[10.5px] font-bold text-slate-900 bg-emerald-400 hover:bg-emerald-300 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                  >
                    Enable
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── Floating Toast Alerts for Incoming Orders ─── */}
      <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        {activeAlerts.map((alert) => (
          <div
            key={alert.id}
            className="pointer-events-auto bg-slate-950/95 backdrop-blur-md border-2 border-emerald-500 rounded-2xl p-4 shadow-2xl text-slate-100 animate-in slide-in-from-top-4 duration-300 flex flex-col gap-2.5 shadow-emerald-950/50"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h4 className="font-black text-sm text-white truncate leading-tight">
                    New Order #{alert.order_number}
                  </h4>
                  <p className="text-[11px] text-slate-400 truncate">
                    {alert.customer_name} •{' '}
                    {new Date(alert.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>

              <button
                onClick={() => dismissAlert(alert.id)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer shrink-0"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-between text-xs bg-slate-900 px-3 py-2 rounded-xl border border-slate-800">
              <span className="font-extrabold text-emerald-400 text-sm">
                ₹{alert.total.toFixed(2)}
              </span>
              <span className="text-[10px] font-black uppercase tracking-wider bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full">
                {alert.payment_method} ({alert.payment_status})
              </span>
            </div>

            <div className="flex items-center gap-2 pt-0.5">
              <button
                onClick={() => {
                  dismissAlert(alert.id);
                  navigate(`/admin/orders/${alert.order_id}`);
                }}
                className="flex-1 py-2 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-98"
              >
                <span>View Order Details</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
};
