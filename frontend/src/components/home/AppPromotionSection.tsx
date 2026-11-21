import React, { useState, useEffect } from 'react';
import { Download, Smartphone, CheckCircle2, Bell, Zap, ShieldCheck } from 'lucide-react';

export const AppPromotionSection: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } else {
      // Standard browser guide
      alert(
        'To install the Fresh Vegetables Web App:\n\n' +
        '• On Chrome/Android: Tap the three dots (⋮) in your browser and select "Install app" or "Add to Home screen".\n' +
        '• On iOS/Safari: Tap the Share button (⎋) and select "Add to Home Screen".'
      );
    }
  };

  return (
    <section className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-10">
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-line shadow-soft p-6 sm:p-10 lg:p-12 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* Left Column: Copy & Install Button (7 cols) */}
          <div className="lg:col-span-7 space-y-5">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-leaf-700 bg-sage-100 px-3 py-1 rounded-full border border-leaf-500/20 font-sans inline-block mb-2">
                Mobile Web Experience
              </span>
              <h2 className="font-serif font-bold text-2xl sm:text-3xl lg:text-4xl text-charcoal-900 tracking-tight leading-tight">
                Freshness on the Go
              </h2>
              <p className="text-xs sm:text-sm text-charcoal-500 font-sans mt-1.5 leading-relaxed">
                Enjoy a convenient way to browse fresh produce and manage your orders.
              </p>
            </div>

            <p className="text-xs sm:text-sm text-charcoal-600 font-sans leading-relaxed">
              Install the Fresh Vegetables Progressive Web App on your smartphone for faster daily ordering, instant delivery status updates, and offline grocery catalog browsing.
            </p>

            {/* Concise app highlights */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
              <div className="p-3 rounded-xl bg-cream-50 border border-line flex items-center gap-2.5">
                <Zap className="w-4 h-4 text-forest-900 shrink-0" />
                <span className="text-xs font-semibold text-charcoal-800">1-Tap Checkout</span>
              </div>
              <div className="p-3 rounded-xl bg-cream-50 border border-line flex items-center gap-2.5">
                <Bell className="w-4 h-4 text-forest-900 shrink-0" />
                <span className="text-xs font-semibold text-charcoal-800">Live Order Alerts</span>
              </div>
              <div className="p-3 rounded-xl bg-cream-50 border border-line flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 text-forest-900 shrink-0" />
                <span className="text-xs font-semibold text-charcoal-800">Zero App Store Bloat</span>
              </div>
            </div>

            {/* Install Action */}
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleInstallClick}
                className="btn-pill-primary bg-forest-900 hover:bg-forest-800 text-white font-semibold px-6 py-3 rounded-full text-xs sm:text-sm shadow-soft inline-flex items-center gap-2 min-h-[46px] transition-all active:scale-98 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>{isInstalled ? 'App Installed on Device' : 'Install Fresh Vegetables App'}</span>
              </button>
              <span className="text-xs text-charcoal-400 font-sans">
                Works on Android, iOS &amp; Desktop
              </span>
            </div>
          </div>

          {/* Right Column: Visual App Mockup Card (5 cols) */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="w-full max-w-xs rounded-2xl bg-cream-100/80 border border-line p-5 shadow-soft space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-line">
                <img
                  src="/logo.png"
                  alt="Fresh Vegetables App Logo"
                  className="w-12 h-12 rounded-xl object-cover border border-line shadow-soft"
                />
                <div>
                  <h4 className="font-serif font-bold text-sm text-charcoal-900">Fresh Vegetables</h4>
                  <p className="text-[11px] text-leaf-700 font-semibold">100% Organic Grocery</p>
                </div>
              </div>

              <div className="space-y-2 text-xs text-charcoal-600 font-sans">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-leaf-600" />
                  <span>Morning harvest dispatch notifications</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-leaf-600" />
                  <span>Real-time driver arrival tracking</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-leaf-600" />
                  <span>Save multiple delivery addresses</span>
                </div>
              </div>

              <div className="pt-1 text-center">
                <span className="text-[11px] font-bold text-forest-900 bg-sage-100 border border-leaf-500/20 px-3 py-1 rounded-full inline-block">
                  PWA Ready • Fast &amp; Lightweight
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AppPromotionSection;
