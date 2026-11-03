import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  MapPin,
  Bell,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  X,
  ChevronRight,
  Loader2,
  Navigation,
} from 'lucide-react';
import api from '../../services/api';
import { DeliveryZone } from '../../types';
import { HYDERABAD_COLONIES } from '../../data/hyderabadColonies';

interface PermissionsPromptModalProps {
  onOpenManualLocation?: () => void;
}

export const PermissionsPromptModal: React.FC<PermissionsPromptModalProps> = ({
  onOpenManualLocation,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    // Only prompt new users who haven't made a choice yet
    const alreadyPrompted = localStorage.getItem('fresh_permissions_prompted');
    if (!alreadyPrompted) {
      // Delay opening slightly so the initial page render is smooth
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem('fresh_permissions_prompted', 'true');
    setIsOpen(false);
  };

  const handleManualPick = () => {
    localStorage.setItem('fresh_permissions_prompted', 'true');
    setIsOpen(false);
    if (onOpenManualLocation) {
      onOpenManualLocation();
    } else {
      window.dispatchEvent(new CustomEvent('fresh_open_location_modal'));
    }
  };

  const handleGrantPermissions = async () => {
    setIsProcessing(true);
    setStatusMessage('Requesting permissions...');

    // 1. Request Notification Permission
    try {
      if ('Notification' in window && Notification.permission === 'default') {
        await Notification.requestPermission();
      }
    } catch (e) {
      // Ignored if blocked
    }

    // 2. Request Geolocation Permission
    if (!navigator.geolocation) {
      handleManualPick();
      return;
    }

    setStatusMessage('Detecting your delivery location...');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const roundedLat = Number(latitude.toFixed(6));
        const roundedLng = Number(longitude.toFixed(6));

        try {
          // Authoritative backend multi-tier reverse geocoding with 5 KM delivery check
          const res = await api.post('/delivery/reverse-geocode', {
            latitude: roundedLat,
            longitude: roundedLng,
          });
          const d = res.data?.data;
          const colony = d?.colony || d?.area || 'Detected Location';
          const fullAddress = d?.formatted_address || `Location (${roundedLat}, ${roundedLng})`;
          const isServiceable = Boolean(d?.serviceability?.serviceable);
          const distanceKm = d?.serviceability?.distanceKm;

          // Fetch active zones
          let matchedZone: DeliveryZone | null = null;
          try {
            const zRes = await api.get('/zones/active');
            if (zRes.data?.data && zRes.data.data.length > 0) {
              matchedZone = zRes.data.data[0];
            }
          } catch {}

          if (!matchedZone) {
            matchedZone = {
              id: 'zone-champapet',
              name: colony,
              pincodes: [d?.pincode || '500059'],
              delivery_radius_km: 5.0,
              delivery_fee: 10,
              min_order_amount: 10,
              free_delivery_threshold: 99,
              estimated_delivery_time: '25–35 mins',
              status: 'ACTIVE',
              latitude: roundedLat,
              longitude: roundedLng,
            };
          }

          if (isServiceable) {
            // Persist user location & coordinates
            localStorage.setItem('fresh_delivery_colony', colony);
            localStorage.setItem('fresh_delivery_address', fullAddress);
            localStorage.setItem('fresh_delivery_zone', JSON.stringify(matchedZone));
            localStorage.setItem('fresh_delivery_coords', JSON.stringify({ latitude: roundedLat, longitude: roundedLng }));
            localStorage.setItem('fresh_delivery_serviceability', JSON.stringify({
              checked: true,
              configured: true,
              serviceable: true,
              distanceKm,
              radiusKm: 5.0,
              message: 'Great! Delivery is available at your location.',
            }));
            localStorage.setItem('fresh_permissions_prompted', 'true');

            // Notify whole app (Header, Checkout, Product Cards, etc.)
            window.dispatchEvent(
              new CustomEvent('fresh_delivery_location_changed', {
                detail: {
                  zone: matchedZone,
                  colony,
                  address: fullAddress,
                  latitude: roundedLat,
                  longitude: roundedLng,
                  serviceable: true,
                  distanceKm,
                },
              })
            );

            setStatusMessage(`Great! Delivery is available at your location (${distanceKm} km).`);
            setTimeout(() => {
              setIsProcessing(false);
              setIsOpen(false);
            }, 800);
          } else {
            // Outside 5 KM: Do not silently save as serviceable!
            localStorage.setItem('fresh_permissions_prompted', 'true');
            setStatusMessage(`Sorry! We are not delivering to your location yet. (${distanceKm} km from hub, max 5 km)`);
            setTimeout(() => {
              setIsProcessing(false);
              setIsOpen(false);
              handleManualPick();
            }, 1200);
          }
        } catch (err) {
          localStorage.setItem('fresh_permissions_prompted', 'true');
          setIsProcessing(false);
          setIsOpen(false);
          handleManualPick();
        }
      },
      (err) => {
        // Geolocation denied or timed out: Never default to Champapet
        setIsProcessing(false);
        localStorage.setItem('fresh_permissions_prompted', 'true');
        handleManualPick();
      },
      { timeout: 15000, enableHighAccuracy: true, maximumAge: 0 }
    );
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in"
    >
      <div
        className="w-full sm:max-w-md bg-[#05180f] border-t sm:border border-emerald-500/35 sm:rounded-3xl rounded-t-3xl p-5 sm:p-6 shadow-2xl text-white space-y-4 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Handle on Mobile */}
        <div className="w-12 h-1 bg-emerald-500/30 rounded-full mx-auto sm:hidden" />

        {/* Header with App Logo & Close Button */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-white font-black text-xl">
                🌿
              </div>
              <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-400 border-2 border-[#05180f] flex items-center justify-center">
                <Sparkles className="w-2.5 h-2.5 text-slate-950" />
              </span>
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-black text-base sm:text-lg text-white tracking-tight">
                  Fresh<span className="text-emerald-400">Vegetables</span>
                </h3>
                <span className="text-[9px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.2 rounded-full">
                  15-Min Express
                </span>
              </div>
              <p className="text-[11.5px] text-emerald-200/60 mt-0.5">
                Hyperlocal Organic Produce Network
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDismiss}
            className="p-1.5 rounded-full bg-emerald-950/80 hover:bg-emerald-900 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Feature Highlights */}
        <div className="space-y-3 pt-1">
          <h4 className="font-black text-sm text-white">
            Enable Location &amp; Order Alerts
          </h4>
          <p className="text-xs text-slate-300 leading-relaxed">
            To ensure your vegetables are organically harvested and delivered in 15–25 minutes, please enable permissions:
          </p>

          <div className="space-y-2 bg-[#082215] border border-emerald-500/20 rounded-2xl p-3">
            <div className="flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                <MapPin className="w-3.5 h-3.5" />
              </div>
              <div>
                <p className="font-extrabold text-xs text-white">Live Geolocation</p>
                <p className="text-[11px] text-emerald-200/70 leading-snug">
                  Pinpoints your exact colony to assign the closest farm dispatch hub.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 pt-2 border-t border-emerald-500/15">
              <div className="w-7 h-7 rounded-xl bg-teal-500/20 border border-teal-500/40 text-teal-300 flex items-center justify-center shrink-0 mt-0.5">
                <Bell className="w-3.5 h-3.5" />
              </div>
              <div>
                <p className="font-extrabold text-xs text-white">Order Status Alerts</p>
                <p className="text-[11px] text-teal-200/70 leading-snug">
                  Real-time notifications when your produce is packed &amp; out for delivery.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-2">
          <button
            type="button"
            onClick={handleGrantPermissions}
            disabled={isProcessing}
            className="w-full h-11 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-98 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition-all cursor-pointer"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{statusMessage || 'Setting up...'}</span>
              </>
            ) : (
              <>
                <Navigation className="w-4 h-4 fill-slate-950" />
                <span>Allow &amp; Detect Location</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleManualPick}
            disabled={isProcessing}
            className="w-full h-9 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-500/25 text-emerald-300 hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <span>Choose Colony Manually</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center justify-center gap-1.5 text-[10px] text-emerald-200/50 pt-1">
          <ShieldCheck className="w-3 h-3 text-emerald-400" />
          <span>Your location is only used for hyperlocal delivery serviceability.</span>
        </div>
      </div>
    </div>,
    document.body
  );
};
