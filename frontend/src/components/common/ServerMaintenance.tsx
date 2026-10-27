import React, { useState } from 'react';
import { RefreshCw, Wrench, Leaf, ServerOff, ShieldAlert } from 'lucide-react';

interface ServerMaintenanceProps {
  onRetry?: () => Promise<void> | void;
  message?: string;
  isRetrying?: boolean;
}

export const ServerMaintenance: React.FC<ServerMaintenanceProps> = ({
  onRetry,
  message = "We’re experiencing a temporary technical issue. Our team is working to restore the service. We’ll be back soon. Thank you for your patience.",
  isRetrying: externalRetrying = false,
}) => {
  const [internalRetrying, setInternalRetrying] = useState(false);
  const isRetrying = externalRetrying || internalRetrying;

  const handleRetry = async () => {
    if (!onRetry || isRetrying) return;
    try {
      setInternalRetrying(true);
      await Promise.resolve(onRetry());
    } finally {
      setInternalRetrying(false);
    }
  };

  return (
    <div
      data-testid="server-maintenance-screen"
      className="min-h-[60vh] flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12 animate-fade-in"
    >
      <div className="max-w-xl w-full text-center space-y-8 glass-card-3d p-8 sm:p-12 rounded-3xl border border-white/60 bg-white/80 backdrop-blur-xl shadow-2xl relative overflow-hidden">
        {/* Organic decorative backdrop accents */}
        <div className="absolute -top-16 -right-16 w-44 h-44 bg-brand-200/40 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-44 h-44 bg-emerald-200/40 rounded-full blur-3xl pointer-events-none" />

        {/* Maintenance Icon Illustration */}
        <div className="relative mx-auto w-24 h-24 rounded-3xl bg-gradient-to-tr from-brand-600 via-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-xl shadow-brand-500/30">
          <Wrench className="w-10 h-10 transform -rotate-12 animate-pulse" />
          <div className="absolute -bottom-2 -right-2 bg-amber-400 text-slate-950 p-2 rounded-xl shadow-lg border-2 border-white">
            <ServerOff className="w-5 h-5" />
          </div>
        </div>

        {/* Heading & Friendly Descriptive Message */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100/80 text-emerald-800 text-xs font-extrabold uppercase tracking-wider">
            <Leaf className="w-3.5 h-3.5" />
            <span>Farm Tech Status</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Server Under Maintenance
          </h1>

          <p className="text-sm sm:text-base text-slate-600 max-w-md mx-auto leading-relaxed">
            {message}
          </p>
        </div>

        {/* Retry Button and Status */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          {onRetry && (
            <button
              onClick={handleRetry}
              disabled={isRetrying}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-brand-600 to-emerald-600 text-white font-extrabold text-sm shadow-lg shadow-brand-600/30 hover:from-brand-500 hover:to-emerald-500 transition-all transform active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
              <span>{isRetrying ? 'Checking Connection...' : 'Retry Connection'}</span>
            </button>
          )}

          <a
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3.5 rounded-2xl glass-card border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50 transition-colors"
          >
            Go to Home
          </a>
        </div>

        {/* Quick Helper Note */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-center gap-2 text-xs text-slate-400">
          <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
          <span>Your cart and active orders are safely preserved.</span>
        </div>
      </div>
    </div>
  );
};

export default ServerMaintenance;
