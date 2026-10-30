import React, { useState, useEffect, useCallback } from 'react';
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
  Sliders,
  Home,
  Briefcase,
  AlertTriangle,
} from 'lucide-react';
import api from '../../services/api';
import { DeliveryZone, Address, ServiceabilityState } from '../../types';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import {
  InteractiveLocationMap,
  AddressDetails,
} from './InteractiveLocationMap';
import {
  HYDERABAD_COLONIES,
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
    delivery_radius_km: 5.0,
    delivery_fee: 20.0,
    min_order_amount: 199.0,
    free_delivery_threshold: 499.0,
    estimated_delivery_time: '25–35 mins',
    status: 'ACTIVE',
    latitude: 17.4938,
    longitude: 78.3995,
  },
];

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
  const { user } = useAuth();
  const { checkLocationServiceability, deliverySettings } = useCart();

  const [zones, setZones] = useState<DeliveryZone[]>(DEFAULT_ZONES);
  const [selectedZone, setSelectedZone] = useState<DeliveryZone | null>(null);
  const [selectedColony, setSelectedColony] = useState<string>('KPHB Phase 1');
  const [selectedAddress, setSelectedAddress] = useState<string>(
    'Phase 1, KPHB Main Road, Hyderabad - 500072'
  );
  const [currentCoords, setCurrentCoords] = useState<[number, number]>([17.4938, 78.3995]);
  const [pincodeInput, setPincodeInput] = useState('');
  const [isCheckingPincode, setIsCheckingPincode] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Manual Coordinates Input Tab & State
  const [showManualInputs, setShowManualInputs] = useState(false);
  const [manualLatInput, setManualLatInput] = useState('17.4938');
  const [manualLngInput, setManualLngInput] = useState('78.3995');

  // Customer Saved Addresses
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(false);

  // Live Serviceability Status for the chosen location
  const [serviceCheck, setServiceCheck] = useState<{
    loading: boolean;
    checked: boolean;
    configured: boolean;
    serviceable: boolean;
    distanceKm?: number;
    radiusKm: number;
    message?: string;
  }>({
    loading: false,
    checked: false,
    configured: true,
    serviceable: true,
    radiusKm: deliverySettings?.delivery_radius_km || 5.0,
  });

  // Verify coordinates with backend serviceability endpoint
  const verifyServiceability = useCallback(async (lat: number, lng: number) => {
    setServiceCheck((prev) => ({ ...prev, loading: true }));
    try {
      const res = await api.post('/delivery/check-serviceability', {
        latitude: lat,
        longitude: lng,
      });
      const data = res.data?.data || res.data;
      setServiceCheck({
        loading: false,
        checked: true,
        configured: Boolean(data.configured),
        serviceable: Boolean(data.serviceable),
        distanceKm: data.distanceKm,
        radiusKm: data.radiusKm || 5.0,
        message: data.message,
      });
    } catch (err: any) {
      const resp = err.response?.data;
      setServiceCheck({
        loading: false,
        checked: true,
        configured: resp?.configured !== undefined ? Boolean(resp.configured) : true,
        serviceable: false,
        radiusKm: 5.0,
        message: resp?.message || 'Unable to check delivery availability.',
      });
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';

      // Load cached delivery preferences
      const savedZone = localStorage.getItem('fresh_delivery_zone');
      const savedColony = localStorage.getItem('fresh_delivery_colony');
      const savedAddr = localStorage.getItem('fresh_delivery_address');
      const savedCoords = localStorage.getItem('fresh_delivery_coords');

      let initCoords: [number, number] = [17.4938, 78.3995];

      if (savedCoords) {
        try {
          const parsed = JSON.parse(savedCoords);
          if (parsed.latitude && parsed.longitude) {
            initCoords = [Number(parsed.latitude), Number(parsed.longitude)];
          }
        } catch {}
      } else if (savedZone) {
        try {
          const parsed = JSON.parse(savedZone);
          setSelectedZone(parsed);
          if (parsed.latitude && parsed.longitude) {
            initCoords = [Number(parsed.latitude), Number(parsed.longitude)];
          }
        } catch {}
      }

      setCurrentCoords(initCoords);
      setManualLatInput(initCoords[0].toString());
      setManualLngInput(initCoords[1].toString());

      if (savedColony) setSelectedColony(savedColony);
      if (savedAddr) setSelectedAddress(savedAddr);

      // Verify current location
      verifyServiceability(initCoords[0], initCoords[1]);

      // Fetch active delivery zones
      api
        .get('/zones/active')
        .then((res) => {
          if (res.data?.data && res.data.data.length > 0) {
            setZones(res.data.data);
          }
        })
        .catch(() => {});

      // Fetch saved user addresses if authenticated
      if (user) {
        setIsLoadingAddresses(true);
        api
          .get('/addresses')
          .then((res) => {
            if (res.data?.data) {
              setSavedAddresses(res.data.data);
            }
          })
          .catch(() => {})
          .finally(() => setIsLoadingAddresses(false));
      }
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, user, verifyServiceability]);

  // Handle location change from interactive map
  const handleMapPositionChange = (
    lat: number,
    lng: number,
    details?: AddressDetails
  ) => {
    setCurrentCoords([lat, lng]);
    setManualLatInput(lat.toFixed(6));
    setManualLngInput(lng.toFixed(6));
    setErrorMsg(null);
    setSuccessMsg(null);

    verifyServiceability(lat, lng);

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
      setManualLatInput(found.lat.toString());
      setManualLngInput(found.lng.toString());
      setSelectedColony(found.colony);
      setSelectedAddress(`${found.colony}, Hyderabad - ${found.pincode}`);
      setPincodeInput(found.pincode);

      const matched = zones.find(
        (z) => z.id === found.zoneId || (Array.isArray(z.pincodes) && z.pincodes.includes(found.pincode))
      ) || zones[0];

      setSelectedZone(matched);
      setErrorMsg(null);
      verifyServiceability(found.lat, found.lng);
    }
  };

  // Manual Coordinates Apply
  const handleApplyManualCoords = (e: React.FormEvent) => {
    e.preventDefault();
    const lat = parseFloat(manualLatInput);
    const lng = parseFloat(manualLngInput);

    if (isNaN(lat) || lat < -90 || lat > 90) {
      setErrorMsg('Latitude must be between -90 and 90');
      return;
    }
    if (isNaN(lng) || lng < -180 || lng > 180) {
      setErrorMsg('Longitude must be between -180 and 180');
      return;
    }

    setCurrentCoords([lat, lng]);
    setErrorMsg(null);
    setSuccessMsg(`Coordinates applied: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
    verifyServiceability(lat, lng);
  };

  // Select Saved Address
  const handleSelectSavedAddress = (addr: Address) => {
    if (addr.latitude && addr.longitude) {
      const lat = Number(addr.latitude);
      const lng = Number(addr.longitude);
      setCurrentCoords([lat, lng]);
      setManualLatInput(lat.toString());
      setManualLngInput(lng.toString());
      setSelectedColony(addr.area || addr.city);
      const full = [addr.house_number, addr.street, addr.area, addr.landmark, addr.city, addr.pincode]
        .filter(Boolean)
        .join(', ');
      setSelectedAddress(full);
      setPincodeInput(addr.pincode);
      verifyServiceability(lat, lng);
      setSuccessMsg(`Loaded saved address: ${addr.area || addr.city}`);
    } else {
      setErrorMsg(`Saved address "${addr.area}" has no verified coordinates. Please pick on the map.`);
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
          const lat = Number(data.zone.latitude);
          const lng = Number(data.zone.longitude);
          setCurrentCoords([lat, lng]);
          setManualLatInput(lat.toString());
          setManualLngInput(lng.toString());
          verifyServiceability(lat, lng);
        }
        setSuccessMsg(`Pincode ${pincodeInput} matched zone.`);
      } else {
        setErrorMsg(data?.message || `Pincode ${pincodeInput} is outside express delivery zone.`);
      }
    } catch {
      setErrorMsg('Pincode check error. Please select location on the map.');
    } finally {
      setIsCheckingPincode(false);
    }
  };

  // Final Confirmation
  const handleConfirmLocation = async () => {
    const lat = currentCoords[0];
    const lng = currentCoords[1];

    // Recheck with authoritative backend
    const servResult = await checkLocationServiceability(lat, lng);

    const finalZone = selectedZone || {
      id: 'zone-custom',
      name: selectedColony,
      pincodes: [pincodeInput || '500072'],
      delivery_radius_km: servResult.radiusKm || 5.0,
      delivery_fee: 20.0,
      min_order_amount: 199.0,
      free_delivery_threshold: 499.0,
      estimated_delivery_time: '25–35 mins',
      status: 'ACTIVE',
      latitude: lat,
      longitude: lng,
    };

    localStorage.setItem('fresh_delivery_zone', JSON.stringify(finalZone));
    localStorage.setItem('fresh_delivery_colony', selectedColony);
    localStorage.setItem('fresh_delivery_address', selectedAddress);
    localStorage.setItem('fresh_delivery_coords', JSON.stringify({ latitude: lat, longitude: lng }));

    // Global event for instant reactive update across app
    window.dispatchEvent(
      new CustomEvent('fresh_delivery_location_changed', {
        detail: {
          zone: finalZone,
          colony: selectedColony,
          address: selectedAddress,
          latitude: lat,
          longitude: lng,
          serviceable: servResult.serviceable,
          distanceKm: servResult.distanceKm,
        },
      })
    );

    if (onZoneSelected) {
      onZoneSelected(finalZone, selectedColony);
    }

    if (servResult.serviceable) {
      setSuccessMsg(`Delivering to ${selectedColony}!`);
    } else {
      setErrorMsg(servResult.message || 'Outside delivery zone');
    }

    setTimeout(() => {
      onClose();
    }, 400);
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
        className="bg-[#05180f] border border-emerald-500/40 text-white w-full max-w-4xl rounded-3xl p-4 sm:p-6 shadow-[0_25px_80px_rgba(0,0,0,0.9)] relative space-y-4 my-auto max-h-[94vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Title and Close Button */}
        <div className="flex items-center justify-between pb-3 border-b border-emerald-500/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shadow-inner">
              <MapPin className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-white text-base sm:text-lg tracking-tight">
                  Choose Delivery Location
                </h3>
                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  5 KM Radius
                </span>
              </div>
              <p className="text-xs text-emerald-200/60 mt-0.5">
                Pinpoint your exact location. Delivery is available within 5 km straight-line distance from our hub.
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

        {/* Saved Addresses Quick Picker (if logged in and has addresses) */}
        {savedAddresses.length > 0 && (
          <div className="space-y-1.5 bg-[#03140b] p-3 rounded-2xl border border-emerald-500/20">
            <div className="flex items-center justify-between text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <Home className="w-3.5 h-3.5" />
                Select From Your Saved Addresses
              </span>
              <span className="text-[10px] text-emerald-200/50 lowercase">tap address to verify</span>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1">
              {savedAddresses.map((addr) => {
                const hasCoords = addr.latitude && addr.longitude;
                return (
                  <button
                    key={addr.id}
                    type="button"
                    onClick={() => handleSelectSavedAddress(addr)}
                    className="h-8 px-3 rounded-xl bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-500/30 text-xs font-bold text-emerald-200 hover:text-white flex items-center gap-2 shrink-0 transition-all cursor-pointer"
                  >
                    {addr.address_type === 'work' ? (
                      <Briefcase className="w-3.5 h-3.5 text-teal-400" />
                    ) : (
                      <Home className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                    <span className="truncate max-w-[120px]">{addr.area || addr.city}</span>
                    {hasCoords ? (
                      <span className="text-[9px] bg-emerald-500/30 text-emerald-300 px-1.5 py-0.2 rounded">GPS</span>
                    ) : (
                      <span className="text-[9px] bg-amber-500/30 text-amber-300 px-1.5 py-0.2 rounded">Needs GPS</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Quick Hyderabad Colony Chips */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-emerald-400/80 font-bold uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5" />
              Quick Select Popular Hyderabad Areas
            </span>
            <button
              type="button"
              onClick={() => setShowManualInputs(!showManualInputs)}
              className="text-[10.5px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
            >
              <Sliders className="w-3 h-3" />
              <span>{showManualInputs ? 'Hide Coordinates' : 'Manual Coordinates'}</span>
            </button>
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

        {/* Optional Manual Coordinate Entry Section */}
        {showManualInputs && (
          <form
            onSubmit={handleApplyManualCoords}
            className="p-3 bg-[#03150b] border border-emerald-500/30 rounded-2xl flex flex-wrap items-center gap-3 animate-fade-in text-xs"
          >
            <div className="flex items-center gap-1.5 flex-1 min-w-[130px]">
              <span className="text-slate-400 font-bold">Lat:</span>
              <input
                type="number"
                step="0.000001"
                min="-90"
                max="90"
                value={manualLatInput}
                onChange={(e) => setManualLatInput(e.target.value)}
                placeholder="17.4938"
                className="w-full h-8 px-2.5 rounded-lg bg-[#05180f] border border-emerald-500/40 text-white font-mono text-xs focus:outline-none focus:border-emerald-400"
              />
            </div>
            <div className="flex items-center gap-1.5 flex-1 min-w-[130px]">
              <span className="text-slate-400 font-bold">Lng:</span>
              <input
                type="number"
                step="0.000001"
                min="-180"
                max="180"
                value={manualLngInput}
                onChange={(e) => setManualLngInput(e.target.value)}
                placeholder="78.3995"
                className="w-full h-8 px-2.5 rounded-lg bg-[#05180f] border border-emerald-500/40 text-white font-mono text-xs focus:outline-none focus:border-emerald-400"
              />
            </div>
            <button
              type="submit"
              className="h-8 px-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-lg text-xs cursor-pointer transition-all"
            >
              Apply GPS Pin
            </button>
          </form>
        )}

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
              height="340px"
              showSearchBar={true}
              showDetectLocationBtn={true}
              placeholder="Search colony, area or landmark in Hyderabad..."
            />
            <p className="text-[10px] text-slate-400 text-center">
              💡 Drag the pin or click on the map to select your building or doorstep.
            </p>
          </div>

          {/* Right Sidebar: Serviceability Feedback & Confirmation (5 cols on desktop) */}
          <div className="lg:col-span-5 space-y-3 flex flex-col justify-between">
            {/* Live Serviceability Verdict Banner */}
            <div
              className={`p-3.5 rounded-2xl border transition-all ${
                serviceCheck.loading
                  ? 'bg-slate-900/80 border-slate-700 text-slate-300'
                  : !serviceCheck.configured
                  ? 'bg-amber-950/60 border-amber-500/50 text-amber-200'
                  : serviceCheck.serviceable
                  ? 'bg-emerald-950/70 border-emerald-500/60 text-emerald-200'
                  : 'bg-rose-950/60 border-rose-500/50 text-rose-200'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {serviceCheck.loading ? (
                  <Loader2 className="w-5 h-5 text-slate-400 animate-spin shrink-0 mt-0.5" />
                ) : !serviceCheck.configured ? (
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                ) : serviceCheck.serviceable ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                )}

                <div className="space-y-0.5 min-w-0">
                  <h4 className="font-black text-xs sm:text-sm">
                    {serviceCheck.loading
                      ? 'Checking delivery availability...'
                      : !serviceCheck.configured
                      ? 'Delivery Setup Pending'
                      : serviceCheck.serviceable
                      ? 'Delivery Available at your location'
                      : 'Sorry, we are currently unavailable in your area'}
                  </h4>

                  <p className="text-[11px] leading-relaxed opacity-90">
                    {serviceCheck.loading ? (
                      'Calculating straight-line distance to our delivery hub...'
                    ) : !serviceCheck.configured ? (
                      serviceCheck.message || 'Delivery availability is being configured. Please try again shortly.'
                    ) : serviceCheck.serviceable ? (
                      <span>
                        Your selected location is <strong>{serviceCheck.distanceKm} km</strong> from our delivery hub (within our {serviceCheck.radiusKm} km zone).
                      </span>
                    ) : (
                      <span>
                        Your location is <strong>{serviceCheck.distanceKm} km</strong> away, which exceeds our <strong>5 km delivery zone</strong>. Choose a different location to check availability.
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Selected Location Card */}
            <div className="p-3.5 rounded-2xl bg-[#04150c] border border-emerald-500/25 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                  Selected Address
                </span>
                <span className="text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  {currentCoords[0].toFixed(4)}, {currentCoords[1].toFixed(4)}
                </span>
              </div>

              <div>
                <h4 className="text-sm font-extrabold text-white leading-snug">
                  {selectedColony || 'KPHB Colony'}
                </h4>
                <p className="text-xs text-emerald-200/70 mt-0.5 line-clamp-2">
                  {selectedAddress || 'Hyderabad, Telangana'}
                </p>
              </div>

              <div className="pt-2 border-t border-emerald-500/20 flex items-center justify-between text-xs text-emerald-300 font-bold">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>25–35 mins</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>₹20 Express Delivery</span>
                </div>
              </div>
            </div>

            {/* Explanatory Notice */}
            <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-[10.5px] text-slate-400 leading-normal">
              ℹ️ <strong>Straight-Line Distance:</strong> Our 5 km delivery radius is measured in a direct straight line from our delivery hub to ensure vegetables arrive crisp and farm-fresh.
            </div>

            {errorMsg && (
              <p className="text-[11px] text-rose-400 flex items-center gap-1 pt-0.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{errorMsg}</span>
              </p>
            )}
            {successMsg && (
              <p className="text-[11px] text-emerald-300 font-bold flex items-center gap-1 pt-0.5">
                <Check className="w-3.5 h-3.5 shrink-0" />
                <span>{successMsg}</span>
              </p>
            )}

            {/* Primary Confirm CTA Button */}
            <button
              type="button"
              onClick={handleConfirmLocation}
              className={`w-full h-11 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98 shadow-md ${
                serviceCheck.serviceable
                  ? 'bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 hover:from-emerald-400 hover:via-emerald-500 hover:to-teal-500 text-white shadow-emerald-500/25'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600'
              }`}
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>
                {serviceCheck.serviceable
                  ? `Confirm & Deliver to ${selectedColony.split(',')[0]}`
                  : `Select This Location (Unavailable for Ordering)`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default LocationSelectorModal;
