import React, { useState, useEffect } from 'react';
import { Download, X, Sparkles } from 'lucide-react';

export const PWAInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Show prompt if user hasn't dismissed recently
      const dismissed = localStorage.getItem('pwa_prompt_dismissed');
      if (!dismissed) {
        setIsVisible(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      alert('To install Fresh Veggies on your device, tap Share or Menu in your browser and select "Add to Home Screen".');
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsVisible(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem('pwa_prompt_dismissed', 'true');
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:w-96 z-50 animate-slide-up">
      <div className="bg-slate-950/95 text-white border border-brand-500/30 rounded-2xl p-4 shadow-2xl backdrop-blur-xl flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="Fresh Vegetables App"
            className="w-11 h-11 rounded-xl object-cover shadow-lg shadow-brand-500/20 flex-shrink-0 border border-brand-500/30"
          />
          <div>
            <div className="flex items-center gap-1.5 text-brand-300 text-[10px] font-black uppercase tracking-wider">
              <Sparkles className="w-3 h-3" />
              <span>Fast Mobile App</span>
            </div>
            <h4 className="text-xs font-bold text-white leading-tight">Install Fresh Veggies App</h4>
            <p className="text-[11px] text-slate-400">Order faster with 1-tap & live tracking</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleInstall}
            className="bg-brand-500 hover:bg-brand-400 text-slate-950 text-xs font-black px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-md shadow-brand-500/20"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Install</span>
          </button>
          <button
            onClick={handleDismiss}
            className="text-slate-400 hover:text-white p-1 rounded-lg"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
