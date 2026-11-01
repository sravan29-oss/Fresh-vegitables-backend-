import React, { useEffect, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { Sparkles } from 'lucide-react';

const STORAGE_KEY = 'fvo_splash_screen_shown';

export const SplashScreen: React.FC = () => {
  const location = useLocation();
  const [visible, setVisible] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);

  // Check whether to show the splash screen
  useEffect(() => {
    // 1. Never show on admin, checkout, or order completion paths
    const path = location.pathname.toLowerCase();
    if (
      path.startsWith('/admin') ||
      path.startsWith('/checkout') ||
      path.startsWith('/order-success') ||
      path.startsWith('/orders')
    ) {
      return;
    }

    // 2. Only show once per browser session
    try {
      const alreadyShown = sessionStorage.getItem(STORAGE_KEY);
      if (alreadyShown === '1') {
        return;
      }
    } catch {
      // sessionStorage unavailable (incognito/security restricted)
    }

    // 3. User is on their first session visit
    setVisible(true);

    // 4. Respect prefers-reduced-motion accessibility setting
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const splashDuration = prefersReducedMotion ? 600 : 1300;
    const fadeOutDuration = 350;

    const timer = setTimeout(() => {
      handleDismiss();
    }, splashDuration);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        handleDismiss();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [location.pathname]);

  const handleDismiss = useCallback(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, '1');
    } catch {}

    setIsFadingOut(true);
    setTimeout(() => {
      setVisible(false);
    }, 380);
  }, []);

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Fresh Vegetables Organic Intro"
      onClick={handleDismiss}
      className={`fixed inset-0 z-[99999] flex flex-col items-center justify-center overflow-hidden cursor-pointer select-none transition-all duration-380 ease-out ${
        isFadingOut
          ? 'opacity-0 scale-[1.02] pointer-events-none'
          : 'opacity-100 scale-100'
      }`}
      style={{
        background: 'radial-gradient(circle at 50% 42%, #064e3b 0%, #022c22 55%, #011710 100%)',
      }}
    >
      <style>{`
        @keyframes splashDiscFloat {
          0%, 100% {
            transform: perspective(1200px) translateY(0px) rotateY(-8deg) rotateX(6deg);
          }
          50% {
            transform: perspective(1200px) translateY(-14px) rotateY(8deg) rotateX(-4deg);
          }
        }

        @keyframes splashShadowPulse {
          0%, 100% {
            transform: scale(1);
            opacity: 0.55;
          }
          50% {
            transform: scale(0.82);
            opacity: 0.28;
          }
        }

        @keyframes splashSheenSweep {
          0% {
            transform: translateX(-160%) rotate(35deg);
            opacity: 0;
          }
          20% {
            opacity: 0.65;
          }
          80% {
            transform: translateX(180%) rotate(35deg);
            opacity: 0.65;
          }
          100% {
            transform: translateX(180%) rotate(35deg);
            opacity: 0;
          }
        }

        @keyframes splashTextReveal {
          0% {
            opacity: 0;
            transform: translateY(18px);
            filter: blur(4px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
            filter: blur(0);
          }
        }

        @keyframes splashPulseGlow {
          0%, 100% {
            transform: scale(0.95);
            opacity: 0.4;
          }
          50% {
            transform: scale(1.15);
            opacity: 0.7;
          }
        }

        .splash-disc-animation {
          animation: splashDiscFloat 3.2s ease-in-out infinite;
          transform-style: preserve-3d;
          will-change: transform;
        }

        .splash-shadow-animation {
          animation: splashShadowPulse 3.2s ease-in-out infinite;
          will-change: transform, opacity;
        }

        .splash-sheen-animation {
          animation: splashSheenSweep 2.2s cubic-bezier(0.16, 1, 0.3, 1) infinite;
        }

        .splash-text-animation {
          animation: splashTextReveal 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.25s both;
        }

        .splash-tagline-animation {
          animation: splashTextReveal 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.42s both;
        }

        .splash-ambient-glow {
          animation: splashPulseGlow 3.6s ease-in-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .splash-disc-animation,
          .splash-shadow-animation,
          .splash-sheen-animation,
          .splash-text-animation,
          .splash-tagline-animation,
          .splash-ambient-glow {
            animation: none !important;
            transform: none !important;
            opacity: 1 !important;
          }
        }
      `}</style>

      {/* Ambient Organic Light Glow */}
      <div className="absolute w-72 h-72 sm:w-96 sm:h-96 rounded-full bg-emerald-500/20 blur-3xl pointer-events-none splash-ambient-glow" />

      {/* Center 3D Stage */}
      <div className="relative flex flex-col items-center justify-center px-4 z-10">
        
        {/* 3D Perspective Box */}
        <div className="relative w-36 h-36 sm:w-44 sm:h-44 flex items-center justify-center">
          
          {/* Ground Contact Shadow */}
          <div
            className="absolute -bottom-6 w-32 sm:w-40 h-8 rounded-[100%] bg-emerald-950/90 blur-md splash-shadow-animation pointer-events-none"
          />

          {/* 3D Badge Disc with Extruded Depth Layers */}
          <div className="relative w-32 h-32 sm:w-40 sm:h-40 splash-disc-animation">
            
            {/* 3D Extrusion Layer 3 (Deepest Back Layer) */}
            <div
              className="absolute inset-0 rounded-full bg-emerald-950 border-2 border-emerald-900/60 shadow-2xl"
              style={{
                transform: 'translateZ(-14px)',
              }}
            />

            {/* 3D Extrusion Layer 2 (Middle Bevel Rim) */}
            <div
              className="absolute inset-0 rounded-full bg-emerald-900/90 border border-emerald-700/60"
              style={{
                transform: 'translateZ(-8px)',
              }}
            />

            {/* 3D Extrusion Layer 1 (Front Gold/Emerald Ring Rim) */}
            <div
              className="absolute -inset-1 rounded-full bg-gradient-to-br from-emerald-400 via-emerald-600 to-teal-800 p-[3px] shadow-[0_12px_30px_rgba(0,0,0,0.5),inset_0_2px_4px_rgba(255,255,255,0.4)]"
              style={{
                transform: 'translateZ(-2px)',
              }}
            >
              <div className="w-full h-full rounded-full bg-emerald-950/60" />
            </div>

            {/* Front Face: The Authentic Brand Logo with Specular Sheen */}
            <div
              className="absolute inset-0 rounded-full overflow-hidden bg-white shadow-[inset_0_2px_4px_rgba(255,255,255,0.7),0_15px_35px_rgba(0,0,0,0.4)] ring-2 ring-emerald-400/50"
              style={{
                transform: 'translateZ(4px)',
              }}
            >
              <img
                src="/logo.png"
                alt="Fresh Vegetables Organic Logo"
                className="w-full h-full object-cover rounded-full"
                width={160}
                height={160}
                loading="eager"
                draggable={false}
              />

              {/* Specular Light Reflection Sweep */}
              <div
                className="absolute -inset-full bg-gradient-to-r from-transparent via-white/50 to-transparent pointer-events-none splash-sheen-animation"
              />
            </div>
          </div>
        </div>

        {/* Brand Text Section */}
        <div className="mt-7 sm:mt-9 text-center space-y-2">
          {/* Main Brand Title */}
          <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight splash-text-animation drop-shadow-[0_4px_16px_rgba(0,0,0,0.6)]">
            Fresh<span className="text-emerald-400">Vegetables</span>{' '}
            <span className="text-emerald-300 font-extrabold uppercase text-lg sm:text-2xl tracking-wide px-2 py-0.5 rounded-lg bg-emerald-900/60 border border-emerald-500/40 inline-block align-middle ml-1 shadow-xs">
              Organic
            </span>
          </h1>

          {/* Tagline */}
          <div className="flex items-center justify-center gap-2 splash-tagline-animation">
            <span className="w-6 sm:w-10 h-[1px] bg-gradient-to-r from-transparent to-emerald-400/60" />
            <p className="text-[11px] sm:text-xs font-black uppercase tracking-[0.24em] text-emerald-200/90 flex items-center gap-1.5 drop-shadow-sm">
              <Sparkles className="w-3 h-3 text-emerald-300 animate-pulse" />
              <span>Freshness at Your Doorstep</span>
              <Sparkles className="w-3 h-3 text-emerald-300 animate-pulse" />
            </p>
            <span className="w-6 sm:w-10 h-[1px] bg-gradient-to-l from-transparent to-emerald-400/60" />
          </div>
        </div>

        {/* Micro Tap to Skip Hint */}
        <div className="mt-8 sm:mt-10 opacity-60 hover:opacity-100 transition-opacity">
          <span className="text-[10px] font-bold text-emerald-300/70 uppercase tracking-widest px-3 py-1 rounded-full bg-emerald-950/40 border border-emerald-800/40">
            Tap anywhere to skip
          </span>
        </div>
      </div>
    </div>
  );
};

export default SplashScreen;
