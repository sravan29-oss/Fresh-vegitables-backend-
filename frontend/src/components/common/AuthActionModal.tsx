import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, CheckCircle2, LogOut, ShieldCheck, Sparkles, ArrowRight, X } from 'lucide-react';
import { User } from '../../types';

export interface AuthModalState {
  isOpen: boolean;
  type: 'login_success' | 'logout_confirm' | 'logout_success';
  title?: string;
  message?: string;
  user?: User | null;
  isAdmin?: boolean;
  onConfirm?: () => void;
  onComplete?: () => void;
}

interface AuthActionModalProps {
  modalState: AuthModalState;
  onClose: () => void;
}

export const AuthActionModal: React.FC<AuthActionModalProps> = ({ modalState, onClose }) => {
  const { isOpen, type, user, isAdmin, onConfirm, onComplete, title, message } = modalState;
  const [progress, setProgress] = useState(0);

  // Auto-progress animation for success states
  useEffect(() => {
    if (!isOpen) {
      setProgress(0);
      return;
    }

    if (type === 'login_success' || type === 'logout_success') {
      // Start progress fill
      const timer = setTimeout(() => {
        setProgress(100);
      }, 50);

      const duration = type === 'login_success' ? 1400 : 1200;
      const completeTimer = setTimeout(() => {
        if (onComplete) onComplete();
        onClose();
      }, duration);

      return () => {
        clearTimeout(timer);
        clearTimeout(completeTimer);
      };
    }
  }, [isOpen, type, onComplete, onClose]);

  // Handle ESC key for confirm dialog
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && type === 'logout_confirm') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, type, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget && type === 'logout_confirm') {
          onClose();
        }
      }}
      className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in"
      style={{ minHeight: '100vh', width: '100vw' }}
    >
      {/* ─── 1. LOGIN SUCCESS ANIMATION MODAL ─── */}
      {type === 'login_success' && (
        <div className="relative bg-slate-900 border border-brand-500/40 text-white w-full max-w-md rounded-3xl p-7 shadow-2xl overflow-hidden animate-pop-in text-center space-y-5">
          {/* Ambient Glowing Aura */}
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-brand-500/25 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-emerald-500/25 rounded-full blur-3xl pointer-events-none"></div>

          {/* Sparkles / Confetti Dots */}
          <div className="absolute top-4 right-5 text-brand-400 opacity-70 animate-pulse">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="absolute bottom-5 left-6 text-emerald-400 opacity-60">
            <Sparkles className="w-4 h-4" />
          </div>

          {/* Animated Central Icon with Expanding Radar Waves */}
          <div className="relative mx-auto w-20 h-20 flex items-center justify-center">
            {/* Radar wave 1 */}
            <div className="absolute inset-0 rounded-full bg-brand-500/20 animate-ping-slow"></div>
            {/* Radar wave 2 */}
            <div className="absolute -inset-2 rounded-full border border-brand-500/30 animate-pulse"></div>

            {/* Glowing Icon Base */}
            <div className="relative w-16 h-16 rounded-full bg-gradient-to-tr from-brand-600 to-emerald-400 text-slate-950 flex items-center justify-center shadow-lg shadow-brand-500/40">
              <Check className="w-9 h-9 stroke-[3]" />
            </div>
          </div>

          {/* Heading and Greetings */}
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-brand-500/20 text-brand-300 border border-brand-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse"></span>
              {isAdmin ? '🛡️ Admin Access Granted' : '🌱 Certified Organic Customer'}
            </div>

            <h3 className="text-2xl font-black text-white tracking-tight">
              {title || (isAdmin ? 'Welcome to Admin Hub' : 'Login Successful!')}
            </h3>

            <p className="text-xs text-slate-300">
              {message || (
                <>
                  Welcome back, <strong className="text-brand-300">{user?.name || user?.email || 'Valued Member'}</strong>!
                </>
              )}
            </p>
          </div>

          {/* Progress Loading Bar */}
          <div className="space-y-2 pt-1">
            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-brand-500 to-emerald-400 rounded-full transition-all duration-[1300ms] ease-out"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">
              {isAdmin ? 'Redirecting to Operations Dashboard...' : 'Redirecting to fresh farm store...'}
            </p>
          </div>
        </div>
      )}

      {/* ─── 2. DYNAMIC LOGOUT CONFIRMATION MODAL ─── */}
      {type === 'logout_confirm' && (
        <div className="relative bg-slate-900 border border-slate-700 text-white w-full max-w-md rounded-3xl p-7 shadow-2xl animate-pop-in space-y-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center shadow-inner">
                <LogOut className="w-6 h-6 stroke-[2.2]" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white tracking-tight">
                  {title || 'Sign Out of Account?'}
                </h3>
                <p className="text-xs text-slate-400">
                  {message || 'End your active authenticated session'}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              aria-label="Close"
              className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-2xl text-xs text-slate-300 leading-relaxed">
            Your cart and saved delivery address remain safely stored. You can sign back in anytime to continue shopping fresh organic farm produce.
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-all cursor-pointer"
            >
              Stay Signed In
            </button>
            <button
              type="button"
              onClick={() => {
                if (onConfirm) onConfirm();
              }}
              className="flex-1 py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs transition-all shadow-lg shadow-rose-600/30 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Yes, Sign Out</span>
            </button>
          </div>
        </div>
      )}

      {/* ─── 3. LOGOUT SUCCESS ANIMATION MODAL ─── */}
      {type === 'logout_success' && (
        <div className="relative bg-slate-900 border border-slate-700/80 text-white w-full max-w-md rounded-3xl p-7 shadow-2xl overflow-hidden animate-pop-in text-center space-y-5">
          {/* Ambient Aura */}
          <div className="absolute -top-20 -right-20 w-44 h-44 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none"></div>

          {/* Animated Central Farewell Icon */}
          <div className="relative mx-auto w-18 h-18 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-cyan-500/20 animate-ping-slow"></div>
            <div className="relative w-16 h-16 rounded-full bg-gradient-to-tr from-cyan-600 to-emerald-400 text-slate-950 flex items-center justify-center shadow-lg shadow-cyan-500/30">
              <ShieldCheck className="w-8 h-8 stroke-[2.5]" />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Session Ended Securely
            </div>

            <h3 className="text-xl font-black text-white tracking-tight">
              {title || 'Logged Out Successfully'}
            </h3>

            <p className="text-xs text-slate-300 max-w-xs mx-auto">
              {message || 'Thank you for choosing 100% Certified Organic. See you again soon!'}
            </p>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2 pt-1">
            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400 rounded-full transition-all duration-[1100ms] ease-out"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">Returning to home store...</p>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};
export default AuthActionModal;
