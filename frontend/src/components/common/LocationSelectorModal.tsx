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

function calculateHaversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
}

const DEFAULT_ZONES: DeliveryZone[] = [
  {
    id: 'zone-champapet',
    name: 'Champapet & Saroornagar Zone',
    pincodes: ['500059', '500079', '500035', '500060'],
    delivery_radius_km: 5.0,
    delivery_fee: 10.0,
    min_order_amount: 10.0,
    free_delivery_threshold: 99.0,
    estimated_delivery_time: '25–35 mins',
    status: 'ACTIVE',
    latitude: 17.34457,
    longitude: 78.516972,
  },
];

const POPULAR_QUICK_COLONIES = [
  'Champapet Main Road',
  'Raji Reddy Nagar Colony',
  'Saroornagar Lake & HUDA Complex',
  'Santosh Nagar & IS Sadan',
  'Saidabad Colony',
  'Karmanghat Hanuman Temple Area',
  'Dilsukhnagar Metro Station',
  'Kothapet & Chaitanyapuri',
  'KPHB Colony Phase 1',
  'Hitech City (Cyber Towers)',
  'Gachibowli (DLF Cyber City)',
  'Madhapur Main Road',
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
  const [selectedColony, setSelectedColony] = useState<string>(() => localStorage.getItem('fresh_delivery_colony') || '');
  const [selectedAddress, setSelectedAddress] = useState<string>(() => localStorage.getItem('fresh_delivery_address') || '');
  const [currentCoords, setCurrentCoords] = useState<[number, number]>(() => {
    try {
      const saved = localStorage.getItem('fresh_delivery_coords');
      if (saved) {
        const p = JSON.parse(saved);
        if (p.latitude && p.longitude) return [Number(p.latitude), Number(p.longitude)];
      }
    } catch {}
    return [17.34457, 78.516972];
  });
  const [pincodeInput, setPincodeInput] = useState('');
  const [isCheckingPincode, setIsCheckingPincode] = useState(false);
  const [isDetectingGps, setIsDetectingGps] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Manual Coordinates Input Tab & State
  const [showManualInputs, setShowManualInputs] = useState(false);
  const [manualLatInput, setManualLatInput] = useState('17.34457');
  const [manualLngInput, setManualLngInput] = useState('78.516972');

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
    serviceable: false,
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
      const isServ = Boolean(data.serviceable);
      setServiceCheck({
        loading: false,
        checked: true,
        configured: Boolean(data.configured),
        serviceable: isServ,
        distanceKm: data.distanceKm,
        radiusKm: data.radiusKm || 5.0,
        message: data.message || (isServ ? 'Great! Delivery is available at your location.' : 'Sorry! We are not delivering to your location yet.'),
      });
    } catch {
      // Resilient client-side Haversine verification
      const hubLat = deliverySettings?.hub_latitude ? Number(deliverySettings.hub_latitude) : 17.34457;
      const hubLng = deliverySettings?.hub_longitude ? Number(deliverySettings.hub_longitude) : 78.516972;
      const radius = Number(deliverySettings?.delivery_radius_km) || 5.0;
      const distance = calculateHaversineDistanceKm(hubLat, hubLng, Number(lat), Number(lng));
      // Strict comparison: unrounded distance <= 5.0 KM
      const inZone = distance <= radius;

      setServiceCheck({
        loading: false,
        checked: true,
        configured: true,
        serviceable: inZone,
        distanceKm: distance,
        radiusKm: radius,
        message: inZone
          ? 'Great! Delivery is available at your location.'
          : 'Sorry! We are not delivering to your location yet.',
      });
    }
  }, [deliverySettings]);

  // Dedicated Browser GPS Location Detection Handler
  const handleDetectGps = () => {
    if (isDetectingGps) return;

    if (!navigator.geolocation) {
      setErrorMsg('Geolocation is not supported by your browser. Please search your address manually.');
      return;
    }

    setIsDetectingGps(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const lat = Number(latitude.toFixed(6));
          const lng = Number(longitude.toFixed(6));

          setCurrentCoords([lat, lng]);
          setManualLatInput(lat.toString());
          setManualLngInput(lng.toString());

          // Multi-tier server reverse geocoding with authoritative 5 KM check
          let data: any = null;
          try {
            const res = await api.post('/delivery/reverse-geocode', {
              latitude: lat,
              longitude: lng,
            });
            data = res.data?.data;
          } catch (e) {
            // Resilient fallback if reverse-geocode route is deploying: check serviceability directly
            try {
              const servRes = await api.post('/delivery/check-serviceability', {
                latitude: lat,
                longitude: lng,
              });
              const servData = servRes.data?.data || servRes.data;
              data = {
                colony: 'Detected GPS Location',
                formatted_address: `Doorstep Location (${lat.toFixed(4)}, ${lng.toFixed(4)}), Hyderabad`,
                pincode: '',
                serviceability: {
                  configured: servData.configured,
                  serviceable: servData.serviceable,
                  distanceKm: servData.distanceKm,
                  radiusKm: servData.radiusKm || 5.0,
                  message: servData.message,
                },
              };
            } catch (servErr) {
              // Haversine client-side fallback
              const dist = calculateHaversineDistanceKm(17.34457, 78.516972, lat, lng);
              const inZone = dist <= 5.0;
              data = {
                colony: 'Detected GPS Location',
                formatted_address: `Doorstep Location (${lat.toFixed(4)}, ${lng.toFixed(4)}), Hyderabad`,
                pincode: '',
                serviceability: {
                  configured: true,
                  serviceable: inZone,
                  distanceKm: dist,
                  radiusKm: 5.0,
                  message: inZone
                    ? 'Great! Delivery is available at your location.'
                    : 'Sorry! We are not delivering to your location yet.',
                },
              };
            }
          }

          if (data) {
            setSelectedColony(data.colony || data.area || 'Detected Location');
            setSelectedAddress(data.formatted_address || `${lat}, ${lng}`);
            if (data.pincode) setPincodeInput(data.pincode);

            const serv = data.serviceability || {};
            setServiceCheck({
              loading: false,
              checked: true,
              configured: serv.configured !== false,
              serviceable: Boolean(serv.serviceable),
              distanceKm: serv.distanceKm,
              radiusKm: serv.radiusKm || 5.0,
              message: serv.message,
            });

            if (serv.serviceable) {
              setSuccessMsg('Great! Delivery is available at your location.');
            } else {
              setErrorMsg(
                `Sorry! We are not delivering to your location yet. Your location is ${serv.distanceKm} km from our delivery hub (maximum radius: 5.0 KM).`
              );
            }
          }
        } catch (err: any) {
          console.error('GPS reverse geocode error:', err);
          setErrorMsg('Unable to retrieve address for detected location. Please search your address manually.');
        } finally {
          setIsDetectingGps(false);
        }
      },
      (error) => {
        setIsDetectingGps(false);
        let msg = 'Unable to detect your location. Please try again or search manually.';
        if (error.code === error.PERMISSION_DENIED) {
          msg = 'Location permission denied. Please enable location permission in browser settings or search your address manually.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          msg = 'Location unavailable. Please check your GPS / network signal or search manually.';
        } else if (error.code === error.TIMEOUT) {
          msg = 'Location request timed out. Please try again or search manually.';
        }
        setErrorMsg(msg);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  };

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';

      // Load cached delivery preferences
      const savedZone = localStorage.getItem('fresh_delivery_zone');
      const savedColony = localStorage.getItem('fresh_delivery_colony');
      const savedAddr = localStorage.getItem('fresh_delivery_address');
      const savedCoords = localStorage.getItem('fresh_delivery_coords');

      let initCoords: [number, number] = [17.34457, 78.516972];
      let hasSavedLocation = false;

      if (savedCoords) {
        try {
          const parsed = JSON.parse(savedCoords);
          if (parsed.latitude && parsed.longitude) {
            initCoords = [Number(parsed.latitude), Number(parsed.longitude)];
            hasSavedLocation = true;
          }
        } catch {}
      } else if (savedZone) {
        try {
          const parsed = JSON.parse(savedZone);
          setSelectedZone(parsed);
          if (parsed.latitude && parsed.longitude) {
            initCoords = [Number(parsed.latitude), Number(parsed.longitude)];
            hasSavedLocation = true;
          }
        } catch {}
      }

      setCurrentCoords(initCoords);
      setManualLatInput(initCoords[0].toString());
      setManualLngInput(initCoords[1].toString());

      if (savedColony) {
        setSelectedColony(savedColony);
        hasSavedLocation = true;
      }
      if (savedAddr) setSelectedAddress(savedAddr);

      // Verify current location ONLY if customer previously saved a location
      if (hasSavedLocation) {
        verifyServiceability(initCoords[0], initCoords[1]);
      } else {
        setServiceCheck({
          loading: false,
          checked: false,
          configured: true,
          serviceable: false,
          radiusKm: deliverySettings?.delivery_radius_km || 5.0,
        });
      }

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
      ) || null;

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

    // BLOCK COMPLETELY if outside 5.0 KM
    if (!servResult.serviceable) {
      setErrorMsg(
        `Sorry! Delivery is not available at this location. Your location is ${servResult.distanceKm} km away (maximum permitted radius: 5.0 KM). Please select another location within our delivery area.`
      );
      return;
    }

    const finalZone = selectedZone || {
      id: 'zone-champapet',
      name: selectedColony,
      pincodes: [pincodeInput || '500059'],
      delivery_radius_km: servResult.radiusKm || 5.0,
      delivery_fee: 10.0,
      min_order_amount: 10.0,
      free_delivery_threshold: 99.0,
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

    setSuccessMsg(`Delivering to ${selectedColony}!`);

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

        {/* Dedicated "Detect My Location" Action Banner */}
        <div className="bg-gradient-to-r from-emerald-950/90 via-[#042011] to-emerald-950/90 border border-emerald-500/40 rounded-2xl p-3 sm:p-4 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-transform ${
                isDetectingGps
                  ? 'bg-emerald-500/20 text-emerald-300 ring-2 ring-emerald-400/40'
                  : 'bg-gradient-to-br from-emerald-400 to-[#0c831f] text-slate-950 shadow-md shadow-emerald-500/30'
              }`}
            >
              {isDetectingGps ? (
                <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
              ) : (
                <Navigation className="w-5 h-5 text-slate-950 fill-slate-950" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-extrabold text-sm sm:text-base text-white">
                  Detect My Location
                </h4>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                  GPS Auto-Detect
                </span>
              </div>
              <p className="text-xs text-emerald-200/70 mt-0.5">
                {isDetectingGps
                  ? 'Acquiring high-accuracy GPS coordinates & checking 5 km delivery zone...'
                  : 'Get your doorstep address automatically using high-accuracy device GPS'}
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={isDetectingGps}
            onClick={handleDetectGps}
            className="h-10 px-5 rounded-xl font-black text-xs sm:text-sm bg-gradient-to-r from-emerald-400 to-[#0c831f] hover:from-emerald-300 hover:to-[#0a701a] active:scale-98 text-slate-950 shadow-md shadow-emerald-500/30 flex items-center justify-center gap-2 shrink-0 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed transition-all"
            aria-label="Detect My Location"
          >
            {isDetectingGps ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Detecting your location...</span>
              </>
            ) : (
              <>
                <Navigation className="w-4 h-4 fill-slate-950" />
                <span>Detect My Location</span>
              </>
            )}
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
                      : 'Sorry! Delivery is not available at this location.'}
                  </h4>

                  <div className="text-[11px] leading-relaxed opacity-90 space-y-1">
                    {serviceCheck.loading ? (
                      <p>Calculating straight-line distance to our delivery hub...</p>
                    ) : !serviceCheck.configured ? (
                      <p>{serviceCheck.message || 'Delivery availability is being configured. Please try again shortly.'}</p>
                    ) : serviceCheck.serviceable ? (
                      <p>
                        Your selected location is <strong>{serviceCheck.distanceKm} km</strong> from our delivery hub (within our {serviceCheck.radiusKm} km zone).
                      </p>
                    ) : (
                      <>
                        <p className="font-semibold text-rose-200">
                          Your location is <strong>{serviceCheck.distanceKm} km</strong> from our delivery hub (maximum permitted delivery radius: <strong>5.0 KM</strong>).
                        </p>
                        <p className="text-rose-300 font-bold">
                          Please select another location within our delivery area.
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Selected Location Card */}
            <div className={`p-3.5 rounded-2xl border space-y-2 ${
              serviceCheck.checked && !serviceCheck.serviceable
                ? 'bg-[#150608] border-rose-500/40'
                : 'bg-[#04150c] border-emerald-500/25'
            }`}>
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${
                  serviceCheck.checked && !serviceCheck.serviceable ? 'text-rose-400' : 'text-emerald-400'
                }`}>
                  <MapPin className="w-3.5 h-3.5" />
                  Selected Address
                </span>
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                  serviceCheck.checked && !serviceCheck.serviceable
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                }`}>
                  {currentCoords[0].toFixed(4)}, {currentCoords[1].toFixed(4)}
                </span>
              </div>

              <div>
                <h4 className="text-sm font-extrabold text-white leading-snug">
                  {selectedColony || 'No Location Selected'}
                </h4>
                <p className="text-xs text-slate-300 mt-0.5 line-clamp-2">
                  {selectedAddress || 'Click "Detect My Location" or tap a point on the map to set your address'}
                </p>
              </div>

              {/* Only show ETA and charges when SERVICEABLE */}
              {serviceCheck.checked && !serviceCheck.serviceable ? (
                <div className="pt-2 border-t border-rose-500/20 flex items-center justify-between text-xs text-rose-300 font-bold">
                  <div className="flex items-center gap-1.5 text-rose-400">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>Outside 5 KM Delivery Radius</span>
                  </div>
                  <span>{serviceCheck.distanceKm} km from hub</span>
                </div>
              ) : selectedColony && serviceCheck.serviceable ? (
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
              ) : null}
            </div>

            {/* Explanatory Notice */}
            <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-[10.5px] text-slate-400 leading-normal">
              ℹ️ <strong>Straight-Line Distance:</strong> Our 5 km delivery radius is measured in a direct straight line from our Champapet delivery hub to ensure vegetables arrive crisp and farm-fresh.
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

            {/* Primary Confirm CTA Button - Strictly disabled if outside 5 KM or no location selected */}
            <button
              type="button"
              disabled={!serviceCheck.serviceable || serviceCheck.loading || !serviceCheck.checked || !selectedColony}
              onClick={handleConfirmLocation}
              className={`w-full h-11 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all shadow-md ${
                serviceCheck.serviceable && selectedColony
                  ? 'bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 hover:from-emerald-400 hover:via-emerald-500 hover:to-teal-500 text-white shadow-emerald-500/25 cursor-pointer active:scale-98'
                  : 'bg-rose-950/70 border border-rose-700/60 text-rose-300 cursor-not-allowed opacity-80'
              }`}
            >
              {serviceCheck.serviceable && selectedColony ? (
                <>
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>Confirm & Deliver to {selectedColony.split(',')[0]}</span>
                </>
              ) : !selectedColony ? (
                <>
                  <MapPin className="w-4 h-4 stroke-[2.5]" />
                  <span>Please Detect or Pick Your Location</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 stroke-[2.5]" />
                  <span>
                    Delivery Not Available ({serviceCheck.distanceKm !== undefined ? `${serviceCheck.distanceKm} KM` : 'Outside'} • Max 5 KM)
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default LocationSelectorModal;
