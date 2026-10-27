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
  ShieldCheck,
  Compass,
  CheckCircle2,
} from 'lucide-react';
import api from '../../services/api';
import { DeliveryZone } from '../../types';
import {
  InteractiveLocationMap,
  AddressDetails,
} from './InteractiveLocationMap';
import {
  HYDERABAD_COLONIES,
  HyderabadArea,
} from '../../data/hyderabadColonies';

interface LocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onZoneSelected?: (zone: DeliveryZone, colonyName?: string) => void;
}

const DEFAULT_ZONES: DeliveryZone[] = [
  {
    id: 'zone-kphb',
    name: 'Kukatpally & KPHB Zone',
    pincodes: ['500072', '500085', '500090', '500018', '500038'],
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
    pincodes: ['500081', '500032', '500084', '500046', '500033', '500034', '500089'],
    delivery_radius_km: 10.0,
    delivery_fee: 25.0,
    min_order_amount: 199.0,
    free_delivery_threshold: 499.0,
    estimated_delivery_time: '25–35 mins',
    status: 'ACTIVE',
    latitude: 17.4474,
    longitude: 78.3762,
  },
  {
    id: 'zone-miyapur',
    name: 'Miyapur, Chandanagar & BHEL',
    pincodes: ['500049', '500050', '500019', '502032'],
    delivery_radius_km: 9.0,
    delivery_fee: 25.0,
    min_order_amount: 249.0,
    free_delivery_threshold: 549.0,
    estimated_delivery_time: '30–40 mins',
    status: 'ACTIVE',
    latitude: 17.4968,
    longitude: 78.3547,
  },
];

// Highlighted popular Hyderabad quick-picker colonies
const POPULAR_QUICK_COLONIES = [
  'KPHB Colony Phase 1',
  'KPHB Colony Phase 3 & 4',
  'Hitech City (Cyber Towers)',
  'Madhapur Main Road',
  'Gachibowli (DLF Cyber City)',
  'Kondapur (Silpa Park & RTO)',
  'Jubilee Hills Road No 36',
  'Miyapur Metro Station & Allwyn',
  'Banjara Hills Road No 12',
  'Pragathi Nagar',
];

export const LocationSelectorModal: React.FC<LocationModalProps> = ({
  isOpen,
  onClose,
  onZoneSelected,
}) => {
  const [zones, setZones] = useState<DeliveryZone[]>(DEFAULT_ZONES);
  const [selectedZone, setSelectedZone] = useState<DeliveryZone | null>(null);
  const [selectedColony, setSelectedColony] = useState<string>('KPHB Phase 1');
  const [selectedAddress, setSelectedAddress] = useState<string>(
    'Phase 1, KPHB Main Road, Hyderabad - 500072'
  );
  const [currentCoords, setCurrentCoords] = useState<[number, number]>([
    17.4938, 78.3995,
  ]);
  const [pincodeInput, setPincodeInput] = useState('');
  const [isCheckingPincode, setIsCheckingPincode] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';

      // Fetch active delivery zones
      api
        .get('/zones/active')
        .then((res) => {
          if (res.data?.data && res.data.data.length > 0) {
            setZones(res.data.data);
          }
        })
        .catch(() => {});

      // Load cached delivery preferences
      const savedZone = localStorage.getItem('fresh_delivery_zone');
      const savedColony = localStorage.getItem('fresh_delivery_colony');
      const savedAddr = localStorage.getItem('fresh_delivery_address');

      if (savedZone) {
        try {
          const parsed = JSON.parse(savedZone);
          setSelectedZone(parsed);
          if (parsed.latitude && parsed.longitude) {
            setCurrentCoords([parsed.latitude, parsed.longitude]);
          }
        } catch (e) {}
      } else {
        setSelectedZone(DEFAULT_ZONES[0]);
      }

      if (savedColony) setSelectedColony(savedColony);
      if (savedAddr) setSelectedAddress(savedAddr);
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Handle location change from interactive map
  const handleMapPositionChange = (
    lat: number,
    lng: number,
    details?: AddressDetails
  ) => {
    setCurrentCoords([lat, lng]);
    setErrorMsg(null);

    if (details) {
      if (details.colony) setSelectedColony(details.colony);
      if (details.fullAddress) setSelectedAddress(details.fullAddress);
      if (details.pincode) setPincodeInput(details.pincode);

      if (details.matchedZone) {
        setSelectedZone(details.matchedZone);
      }
    }
  };

  // Quick picker click
  const handleQuickColonyClick = (colonyName: string) => {
    const found = HYDERABAD_COLONIES.find((c) => c.name === colonyName);
    if (found) {
      setCurrentCoords([found.lat, found.lng]);
      setSelectedColony(found.colony);
      setSelectedAddress(`${found.colony}, Hyderabad - ${found.pincode}`);
      setPincodeInput(found.pincode);

      const matched = zones.find(
        (z) => z.id === found.zoneId || (Array.isArray(z.pincodes) && z.pincodes.includes(found.pincode))
      ) || zones[0];

      setSelectedZone(matched);
      setErrorMsg(null);
    }
  };

  // Direct Pincode Search
  const handlePincodeSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pincodeInput.trim()) return;

    try {
      setIsCheckingPincode(true);
      setErrorMsg(null);
      setSuccessMsg(null);

      const res = await api.post('/zones/check-pincode', {
        pincode: pincodeInput.trim(),
      });
      const data = res.data?.data;

      if (data?.serviceable && data?.zone) {
        setSelectedZone(data.zone);
        if (data.zone.latitude && data.zone.longitude) {
          setCurrentCoords([data.zone.latitude, data.zone.longitude]);
        }
        setSuccessMsg(`Pincode ${pincodeInput} is serviceable!`);
      } else {
        // Fallback local check
        const local = zones.find(
          (z) => Array.isArray(z.pincodes) && z.pincodes.includes(pincodeInput.trim())
        );
        if (local) {
          setSelectedZone(local);
          setSuccessMsg(`Pincode matched: ${local.name}`);
        } else {
          setErrorMsg(
            data?.message || `Pincode ${pincodeInput} is outside current express zone.`
          );
        }
      }
    } catch (err: any) {
      const local = zones.find(
        (z) => Array.isArray(z.pincodes) && z.pincodes.includes(pincodeInput.trim())
      );
      if (local) {
        setSelectedZone(local);
      } else {
        setErrorMsg('Pincode not currently serviceable. Expanding to your area soon!');
      }
    } finally {
      setIsCheckingPincode(false);
    }
  };

  // Final Confirmation
  const handleConfirmLocation = () => {
    const finalZone = selectedZone || DEFAULT_ZONES[0];
    localStorage.setItem('fresh_delivery_zone', JSON.stringify(finalZone));
    localStorage.setItem('fresh_delivery_colony', selectedColony);
    localStorage.setItem('fresh_delivery_address', selectedAddress);

    if (onZoneSelected) {
      onZoneSelected(finalZone, selectedColony);
    }

    setSuccessMsg(`Delivering to ${selectedColony}!`);
    setTimeout(() => {
      onClose();
    }, 450);
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-fade-in overflow-y-auto"
      style={{ minHeight: '100vh', width: '100vw' }}
    >
      <div
        className="bg-[#05180f] border border-emerald-500/40 text-white w-full max-w-4xl rounded-3xl p-5 sm:p-6 shadow-[0_25px_80px_rgba(0,0,0,0.9)] relative space-y-4 my-auto max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Title, Live Status and Close Button */}
        <div className="flex items-center justify-between pb-3.5 border-b border-emerald-500/20">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shadow-inner">
              <MapPin className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-white text-base sm:text-lg tracking-tight">
                  Choose Exact Delivery Colony &amp; Area
                </h3>
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Hyderabad Live Maps
                </span>
              </div>
              <p className="text-xs text-emerald-200/60 mt-0.5">
                Search or move pin to your building, colony, or road for fast 30-min farm delivery
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close location selector"
            className="w-9 h-9 rounded-full bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 hover:text-white flex items-center justify-center transition-all border border-emerald-500/30 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Hyderabad Colony Chips Carousel */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-emerald-400/80 font-bold uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5" />
              Quick Select Popular Colonies
            </span>
            <span className="text-[10px] text-emerald-200/50 lowercase">tap any area to pinpoint</span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1">
            {POPULAR_QUICK_COLONIES.map((colName) => {
              const isSelected = selectedColony.toLowerCase().includes(colName.toLowerCase().split(' ')[0]);
              return (
                <button
                  key={colName}
                  type="button"
                  onClick={() => handleQuickColonyClick(colName)}
                  className={`h-7 px-3 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 shrink-0 ${
                    isSelected
                      ? 'bg-emerald-500 text-slate-950 shadow-md font-black ring-2 ring-emerald-400'
                      : 'bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-200 border border-emerald-500/25'
                  }`}
                >
                  <MapPin className="w-3 h-3 text-emerald-400" />
                  <span>{colName}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ─── Interactive Map & Details Split Container ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          
          {/* Interactive Map Section (7 cols on desktop) */}
          <div className="lg:col-span-7 space-y-2">
            <InteractiveLocationMap
              initialCenter={currentCoords}
              markerPosition={currentCoords}
              onPositionChange={handleMapPositionChange}
              zones={zones}
              selectedZoneId={selectedZone?.id}
              height="350px"
              showSearchBar={true}
              showDetectLocationBtn={true}
              placeholder="Search colony (e.g. KPHB, Madhapur, DLF Gachibowli, Kondapur...)"
            />
          </div>

          {/* Right Sidebar: Location Intel & Confirmation (5 cols on desktop) */}
          <div className="lg:col-span-5 space-y-3.5 flex flex-col justify-between">
            
            {/* Selected Location Card */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/60 to-[#071f14] border border-emerald-500/35 space-y-2 shadow-inner">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Exact Delivery Area
                </span>
                <span className="text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  {pincodeInput || '500072'}
                </span>
              </div>

              <div>
                <h4 className="text-base font-extrabold text-white leading-snug">
                  {selectedColony || 'KPHB Colony Phase 1'}
                </h4>
                <p className="text-xs text-emerald-200/70 mt-0.5 line-clamp-2">
                  {selectedAddress || 'Phase 1, KPHB Main Road, Hyderabad'}
                </p>
              </div>

              <div className="pt-2 border-t border-emerald-500/20 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-emerald-300 font-bold">
                  <Clock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{selectedZone?.estimated_delivery_time || '25–35 mins'}</span>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-300 font-bold">
                  <Truck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>₹{selectedZone?.delivery_fee || 20} Delivery</span>
                </div>
              </div>
            </div>

            {/* Matched Zone Badge & Policy */}
            <div className="p-3.5 rounded-2xl bg-[#04150c] border border-emerald-500/25 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Assigned Hub Zone:</span>
                <span className="font-extrabold text-white">{selectedZone?.name || 'Kukatpally & KPHB Zone'}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Free Delivery Above:</span>
                <span className="font-bold text-emerald-300">₹{selectedZone?.free_delivery_threshold || 499}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Min Order Requirement:</span>
                <span className="font-bold text-slate-300">₹{selectedZone?.min_order_amount || 199}</span>
              </div>
            </div>

            {/* Direct Pincode Lookup Fallback */}
            <form onSubmit={handlePincodeSearch} className="space-y-1">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-emerald-400/80">
                Or Verify by Hyderabad Pincode
              </label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  maxLength={6}
                  placeholder="e.g. 500072, 500081, 500049"
                  value={pincodeInput}
                  onChange={(e) => setPincodeInput(e.target.value)}
                  className="w-full h-9 pl-3 pr-20 text-xs bg-[#04150c] border border-emerald-500/25 rounded-xl text-white font-mono placeholder:text-slate-500 focus:outline-none focus:border-emerald-400"
                />
                <button
                  type="submit"
                  disabled={isCheckingPincode}
                  className="absolute right-1 h-7 px-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[11px] flex items-center gap-1 transition-all cursor-pointer"
                >
                  {isCheckingPincode ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Check'}
                </button>
              </div>

              {errorMsg && (
                <p className="text-[11px] text-rose-400 flex items-center gap-1 pt-0.5">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <span>{errorMsg}</span>
                </p>
              )}
              {successMsg && (
                <p className="text-[11px] text-emerald-300 font-bold flex items-center gap-1 pt-0.5">
                  <Check className="w-3 h-3 shrink-0" />
                  <span>{successMsg}</span>
                </p>
              )}
            </form>

            {/* Primary Confirm CTA Button */}
            <button
              type="button"
              onClick={handleConfirmLocation}
              className="w-full h-12 rounded-2xl bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 hover:from-emerald-400 hover:via-emerald-500 hover:to-teal-500 text-white font-black text-sm flex items-center justify-center gap-2 shadow-[0_6px_25px_rgba(16,185,129,0.4)] transition-all cursor-pointer active:scale-98"
            >
              <Check className="w-4.5 h-4.5 stroke-[2.5]" />
              <span>Confirm &amp; Deliver to {selectedColony.split(',')[0]}</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default LocationSelectorModal;
