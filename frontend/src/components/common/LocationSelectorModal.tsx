import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  MapPin,
  X,
  Check,
  Search,
  AlertCircle,
  Clock,
  Truck,
  Navigation,
  Loader2,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import api from '../../services/api';
import { DeliveryZone } from '../../types';

interface LocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onZoneSelected?: (zone: DeliveryZone) => void;
}

const DEFAULT_ZONES: DeliveryZone[] = [
  {
    id: 'zone-kphb',
    name: 'Kukatpally & KPHB Zone',
    pincodes: ['500072', '500085', '500090', '500018'],
    delivery_radius_km: 8.5,
    delivery_fee: 20.0,
    min_order_amount: 199.0,
    free_delivery_threshold: 499.0,
    estimated_delivery_time: '25–35 mins',
    status: 'ACTIVE',
    latitude: 17.4938,
    longitude: 78.3995,
  },
  {
    id: 'zone-hitech',
    name: 'Hitech City, Madhapur & Gachibowli',
    pincodes: ['500081', '500032', '500084', '500046'],
    delivery_radius_km: 10.0,
    delivery_fee: 25.0,
    min_order_amount: 199.0,
    free_delivery_threshold: 499.0,
    estimated_delivery_time: '30–40 mins',
    status: 'ACTIVE',
    latitude: 17.4474,
    longitude: 78.3762,
  },
  {
    id: 'zone-miyapur',
    name: 'Miyapur, Chandanagar & BHEL',
    pincodes: ['500049', '500050', '500019'],
    delivery_radius_km: 9.0,
    delivery_fee: 25.0,
    min_order_amount: 249.0,
    free_delivery_threshold: 549.0,
    estimated_delivery_time: '35–45 mins',
    status: 'ACTIVE',
    latitude: 17.4968,
    longitude: 78.3547,
  },
  {
    id: 'zone-ahmedabad',
    name: 'Ahmedabad Central & Navrangpura',
    pincodes: ['380009', '380015', '380006', '380054'],
    delivery_radius_km: 12.0,
    delivery_fee: 30.0,
    min_order_amount: 299.0,
    free_delivery_threshold: 599.0,
    estimated_delivery_time: '30–40 mins',
    status: 'ACTIVE',
    latitude: 23.0373,
    longitude: 72.5613,
  },
];

export const LocationSelectorModal: React.FC<LocationModalProps> = ({
  isOpen,
  onClose,
  onZoneSelected,
}) => {
  const [pincodeInput, setPincodeInput] = useState('');
  const [zones, setZones] = useState<DeliveryZone[]>(DEFAULT_ZONES);
  const [selectedZone, setSelectedZone] = useState<DeliveryZone | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Prevent background body scrolling when modal is open
      document.body.style.overflow = 'hidden';

      // Load active delivery zones from backend
      api
        .get('/zones/active')
        .then((res) => {
          if (res.data?.data && res.data.data.length > 0) {
            setZones(res.data.data);
          }
        })
        .catch(() => {});

      const saved = localStorage.getItem('fresh_delivery_zone');
      if (saved) {
        try {
          setSelectedZone(JSON.parse(saved));
        } catch (e) {}
      }
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const selectZone = (zone: DeliveryZone, message?: string) => {
    setSelectedZone(zone);
    localStorage.setItem('fresh_delivery_zone', JSON.stringify(zone));
    if (onZoneSelected) onZoneSelected(zone);
    if (message) {
      setSuccessMsg(message);
      setTimeout(() => {
        setSuccessMsg(null);
        onClose();
      }, 700);
    } else {
      setTimeout(() => onClose(), 400);
    }
  };

  // GPS Current Location Detection
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setErrorMsg('Geolocation is not supported by your browser.');
      return;
    }

    setIsDetectingLocation(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsDetectingLocation(false);
        const { latitude, longitude } = position.coords;

        // Calculate closest zone using Haversine distance
        const R = 6371; // km
        const toRad = (d: number) => (d * Math.PI) / 180;
        let bestZone = zones[0] || DEFAULT_ZONES[0];
        let minDistance = Infinity;

        for (const zone of zones) {
          if (zone.latitude && zone.longitude) {
            const dLat = toRad(zone.latitude - latitude);
            const dLng = toRad(zone.longitude - longitude);
            const a =
              Math.sin(dLat / 2) ** 2 +
              Math.cos(toRad(latitude)) * Math.cos(toRad(zone.latitude)) * Math.sin(dLng / 2) ** 2;
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            const distance = R * c;

            if (distance < minDistance) {
              minDistance = distance;
              bestZone = zone;
            }
          }
        }

        selectZone(bestZone, `GPS Located! Selected ${bestZone.name}`);
      },
      (err) => {
        setIsDetectingLocation(false);
        if (err.code === err.PERMISSION_DENIED) {
          setErrorMsg('Location permission denied. Please enter your pincode or choose your area below.');
        } else if (err.code === err.TIMEOUT) {
          // Fallback to primary express hub
          selectZone(DEFAULT_ZONES[1], 'Auto-selected express delivery hub (Hitech City)');
        } else {
          // Fallback gracefully
          selectZone(DEFAULT_ZONES[1], 'Auto-selected express delivery hub');
        }
      },
      {
        timeout: 9000,
        enableHighAccuracy: true,
      }
    );
  };

  const handleCheckPincode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pincodeInput.trim()) return;

    try {
      setIsChecking(true);
      setErrorMsg(null);
      setSuccessMsg(null);
      const res = await api.post('/zones/check-pincode', { pincode: pincodeInput.trim() });
      const data = res.data?.data;

      if (data?.serviceable && data?.zone) {
        selectZone(data.zone, `Pincode ${pincodeInput.trim()} serviceable! Zone: ${data.zone.name}`);
      } else {
        setErrorMsg(data?.message || `Pincode ${pincodeInput.trim()} is outside our current express zone.`);
      }
    } catch (err: any) {
      // Local fallback lookup
      const found = zones.find((z) => z.pincodes.includes(pincodeInput.trim()));
      if (found) {
        selectZone(found, `Pincode found in ${found.name}!`);
      } else {
        setErrorMsg(err.response?.data?.message || 'Pincode not currently serviceable. Expanding soon!');
      }
    } finally {
      setIsChecking(false);
    }
  };

  if (!isOpen) return null;

  // Use createPortal to mount directly on document.body so that header backdrop-filter
  // never clips or traps the modal viewport position.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 bg-slate-950/85 backdrop-blur-md animate-fade-in overflow-y-auto"
      style={{ minHeight: '100vh', width: '100vw' }}
    >
      <div
        className="bg-slate-900 border border-slate-700/80 text-white w-full max-w-lg rounded-3xl p-6 shadow-2xl relative space-y-5 my-auto max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Title and Close Button */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-brand-500/20 text-brand-400 border border-brand-500/30 flex items-center justify-center shadow-inner">
              <MapPin className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-lg tracking-tight">Select Delivery Location</h3>
              <p className="text-xs text-slate-400">Accurate delivery fees, express farm store & live ETA</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close location selector"
            className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-all shadow-sm"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* PROMINENT "USE CURRENT LOCATION" BUTTON */}
        <button
          type="button"
          onClick={handleUseCurrentLocation}
          disabled={isDetectingLocation}
          className="w-full flex items-center justify-between p-3.5 bg-gradient-to-r from-brand-600/25 via-emerald-600/20 to-slate-800/40 hover:from-brand-600/35 hover:via-emerald-600/30 border border-brand-500/50 hover:border-brand-400 rounded-2xl group transition-all shadow-md shadow-brand-500/10 cursor-pointer"
        >
          <div className="flex items-center gap-3.5 text-left">
            <div className="w-11 h-11 rounded-xl bg-brand-500 text-slate-950 flex items-center justify-center shadow-lg shadow-brand-500/30 group-hover:scale-105 transition-transform flex-shrink-0 font-bold">
              {isDetectingLocation ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Navigation className="w-5 h-5 fill-current" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm text-white group-hover:text-brand-300 transition-colors">
                  Use Current Location
                </span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-black px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  GPS Detect
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                {isDetectingLocation ? 'Detecting your coordinates...' : 'Pinpoint nearest farm hub & fastest ETA'}
              </p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-white group-hover:translate-x-1 transition-all flex-shrink-0" />
        </button>

        {/* Divider */}
        <div className="relative flex items-center justify-center">
          <div className="border-t border-slate-800 w-full"></div>
          <span className="bg-slate-900 px-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider absolute">
            or enter pincode
          </span>
        </div>

        {/* Pincode Search Input */}
        <form onSubmit={handleCheckPincode} className="space-y-2">
          <div className="relative flex items-center">
            <input
              type="text"
              value={pincodeInput}
              onChange={(e) => setPincodeInput(e.target.value)}
              placeholder="e.g. 500081, 500072, 500049..."
              maxLength={6}
              className="w-full bg-slate-950 border border-slate-700 hover:border-slate-600 rounded-2xl pl-4 pr-28 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all font-mono"
            />
            <button
              type="submit"
              disabled={isChecking}
              className="absolute right-1.5 bg-brand-500 hover:bg-brand-400 text-slate-950 text-xs font-black px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-md shadow-brand-500/20 disabled:opacity-50 cursor-pointer"
            >
              {isChecking ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Checking...</span>
                </>
              ) : (
                <>
                  <Search className="w-3.5 h-3.5" />
                  <span>Check</span>
                </>
              )}
            </button>
          </div>

          {errorMsg && (
            <div className="flex items-center gap-2 text-rose-400 text-xs pt-1 px-1">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-center gap-2 text-emerald-400 text-xs pt-1 px-1 font-bold">
              <Check className="w-4 h-4 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}
        </form>

        {/* Selected Zone Pill if set */}
        {selectedZone && (
          <div className="p-3.5 bg-brand-500/10 border border-brand-500/35 rounded-2xl flex items-center justify-between shadow-inner">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase font-black text-brand-400 tracking-wider">
                  Currently Selected Zone
                </span>
                <Sparkles className="w-3 h-3 text-brand-400" />
              </div>
              <p className="text-sm font-black text-white">{selectedZone.name}</p>
              <p className="text-xs text-brand-200">
                Delivery: ₹{selectedZone.delivery_fee} • Free on ₹{selectedZone.free_delivery_threshold}+ • ETA: {selectedZone.estimated_delivery_time}
              </p>
            </div>
            <div className="w-8 h-8 rounded-full bg-brand-500 text-slate-950 flex items-center justify-center font-black shadow-lg shadow-brand-500/30 flex-shrink-0">
              <Check className="w-5 h-5 stroke-[2.5]" />
            </div>
          </div>
        )}

        {/* Available Popular Zones List */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-400 uppercase tracking-wider">
              Popular Delivery Zones
            </span>
            <span className="text-[11px] text-slate-500">Fast 30-min express fulfillment</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto pr-1">
            {zones.map((zone) => {
              const isSelected = selectedZone?.id === zone.id;
              return (
                <button
                  key={zone.id}
                  onClick={() => selectZone(zone, `Selected ${zone.name}`)}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-brand-500/20 border-brand-400 text-white shadow-md shadow-brand-500/10 ring-1 ring-brand-400/50'
                      : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-950'
                  }`}
                >
                  <p className="font-bold text-xs text-white leading-tight">{zone.name}</p>
                  <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-400">
                    <span className="flex items-center gap-1 font-semibold text-brand-300">
                      <Truck className="w-3 h-3 text-brand-400" /> ₹{zone.delivery_fee}
                    </span>
                    <span className="flex items-center gap-1 font-semibold text-emerald-300">
                      <Clock className="w-3 h-3 text-emerald-400" /> {zone.estimated_delivery_time}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default LocationSelectorModal;
