import React, { useState, useEffect, useCallback, useId } from 'react';
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
  Building2,
  Info,
} from 'lucide-react';
import api from '../../services/api';
import { DeliveryZone, Address } from '../../types';
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

// Authorized Fulfillment Hub Definitions
const HUBS = [
  {
    id: 'hub-champapet',
    code: 'champapet',
    name: 'Champapet Fulfillment Hub',
    lat: 17.34457,
    lng: 78.516972,
    radiusKm: 5.0,
  },
  {
    id: 'hub-kphb',
    code: 'kphb',
    name: 'KPHB Fulfillment Hub',
    lat: 17.48942,
    lng: 78.397227,
    radiusKm: 5.0,
  },
];

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
  {
    id: 'zone-kphb',
    name: 'KPHB & Kukatpally Zone',
    pincodes: ['500072', '500085', '500090', '500018'],
    delivery_radius_km: 5.0,
    delivery_fee: 10.0,
    min_order_amount: 10.0,
    free_delivery_threshold: 99.0,
    estimated_delivery_time: '25–35 mins',
    status: 'ACTIVE',
    latitude: 17.48942,
    longitude: 78.397227,
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
  const modalTitleId = useId();
  const { user } = useAuth();
  const { checkLocationServiceability, deliverySettings } = useCart();

  const [zones, setZones] = useState<DeliveryZone[]>(DEFAULT_ZONES);
  const [selectedZone, setSelectedZone] = useState<DeliveryZone | null>(null);

  // Customer verified location states - NEVER default to hub coordinates as customer location
  const [hasVerifiedCoords, setHasVerifiedCoords] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('fresh_delivery_coords');
      if (saved) {
        const p = JSON.parse(saved);
        return Boolean(p.latitude && p.longitude);
      }
    } catch {}
    return false;
  });

  const [selectedColony, setSelectedColony] = useState<string>(
    () => localStorage.getItem('fresh_delivery_colony') || ''
  );
  const [selectedAddress, setSelectedAddress] = useState<string>(
    () => localStorage.getItem('fresh_delivery_address') || ''
  );

  const [currentCoords, setCurrentCoords] = useState<[number, number]>(() => {
    try {
      const saved = localStorage.getItem('fresh_delivery_coords');
      if (saved) {
        const p = JSON.parse(saved);
        if (p.latitude && p.longitude) return [Number(p.latitude), Number(p.longitude)];
      }
    } catch {}
    // Hyderabad city geographical center for initial map camera (NOT treated as customer coordinates)
    return [17.3850, 78.4867];
  });

  const [pincodeInput, setPincodeInput] = useState('');
  const [isCheckingPincode, setIsCheckingPincode] = useState(false);
  const [isDetectingGps, setIsDetectingGps] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Manual Coordinates Input Tab & State
  const [showManualInputs, setShowManualInputs] = useState(false);
  const [manualLatInput, setManualLatInput] = useState('17.344570');
  const [manualLngInput, setManualLngInput] = useState('78.516972');

  // Customer Saved Addresses
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(false);

  // Live Serviceability Status across both fulfillment hubs
  const [serviceCheck, setServiceCheck] = useState<{
    loading: boolean;
    checked: boolean;
    configured: boolean;
    serviceable: boolean;
    distanceKm?: number;
    radiusKm: number;
    message?: string;
    assignedHubId?: string;
    assignedHubCode?: string;
    assignedHubName?: string;
    assignedHubAddress?: string;
    isPaused?: boolean;
    pauseReason?: string;
  }>({
    loading: false,
    checked: false,
    configured: true,
    serviceable: false,
    radiusKm: deliverySettings?.delivery_radius_km || 5.0,
  });

  // Verify customer coordinates with backend authoritative multi-hub serviceability endpoint
  const verifyServiceability = useCallback(
    async (lat: number, lng: number) => {
      setServiceCheck((prev) => ({ ...prev, loading: true, checked: true }));
      try {
        const res = await api.post('/delivery/check-serviceability', {
          latitude: lat,
          longitude: lng,
        });
        const data = res.data?.data || res.data;
        const isServ = Boolean(data.serviceable);
        const isPaused = Boolean(data.is_paused || data.assignedHub?.is_paused);

        setServiceCheck({
          loading: false,
          checked: true,
          configured: Boolean(data.configured),
          serviceable: isServ && !isPaused,
          distanceKm: data.distanceKm,
          radiusKm: data.radiusKm || 5.0,
          message:
            data.message ||
            (isServ
              ? 'Great! Delivery is available at your location.'
              : 'Sorry! We are not delivering to your location yet.'),
          assignedHubId: data.assigned_hub_id || data.assignedHub?.id,
          assignedHubCode: data.assigned_hub_code || data.assignedHub?.hub_code,
          assignedHubName: data.assigned_hub_name || data.hubName || data.assignedHub?.name,
          assignedHubAddress: data.assigned_hub_address || data.hubAddress || data.assignedHub?.address,
          isPaused,
          pauseReason: data.pause_reason || data.assignedHub?.pause_reason,
        });

        if (isServ && !isPaused) {
          setErrorMsg(null);
        } else if (isPaused) {
          setErrorMsg(data.pause_reason || `Deliveries from ${data.assigned_hub_name || 'hub'} are temporarily paused.`);
        } else {
          setErrorMsg(
            `Sorry! This location is ${data.distanceKm} km from our nearest hub (${data.assigned_hub_name || 'Champapet/KPHB'}). Maximum delivery radius is 5.0 KM.`
          );
        }
      } catch {
        // Resilient client-side Haversine verification against BOTH active hubs
        const toRad = (d: number) => (d * Math.PI) / 180;
        let minDist = Infinity;
        let matchedHub = HUBS[0];

        for (const h of HUBS) {
          const dLat = toRad(Number(lat) - h.lat);
          const dLon = toRad(Number(lng) - h.lng);
          const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(h.lat)) * Math.cos(toRad(Number(lat))) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
          const dist = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          if (dist < minDist) {
            minDist = dist;
            matchedHub = h;
          }
        }
        const dist = Number(minDist.toFixed(2));
        const inZone = dist <= 5.0;

        setServiceCheck({
          loading: false,
          checked: true,
          configured: true,
          serviceable: inZone,
          distanceKm: dist,
          radiusKm: 5.0,
          message: inZone
            ? `Great! Delivery is available at your location (${dist} km from ${matchedHub.name}).`
            : `Sorry! Location is ${dist} km away (maximum radius: 5.0 KM from ${matchedHub.name}).`,
          assignedHubId: matchedHub.id,
          assignedHubCode: matchedHub.code,
          assignedHubName: matchedHub.name,
          assignedHubAddress: '',
        });

        if (!inZone) {
          setErrorMsg(
            `Sorry! This location is ${dist} km from ${matchedHub.name}. Maximum delivery radius is 5.0 KM.`
          );
        } else {
          setErrorMsg(null);
        }
      }
    },
    [deliverySettings]
  );

  // Dedicated High-Accuracy Browser GPS Detection Handler (Rule 8: One-shot, no background tracking)
  const handleDetectGps = () => {
    if (isDetectingGps) return;

    if (!navigator.geolocation) {
      setErrorMsg('Geolocation is not supported by your browser. Please tap your location on the map below.');
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

          // Set verified coordinates
          setCurrentCoords([lat, lng]);
          setHasVerifiedCoords(true);
          setManualLatInput(lat.toString());
          setManualLngInput(lng.toString());

          // Multi-tier server reverse geocoding with 5 KM multi-hub check
          let data: any = null;
          try {
            const res = await api.post('/delivery/reverse-geocode', {
              latitude: lat,
              longitude: lng,
            });
            data = res.data?.data;
          } catch {
            // Direct serviceability check fallback
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
                serviceability: servData,
              };
            } catch {
              // Haversine fallback across both hubs
              const distChamp = calculateHaversineDistanceKm(17.34457, 78.516972, lat, lng);
              const distKphb = calculateHaversineDistanceKm(17.48942, 78.397227, lat, lng);
              const minD = Math.min(distChamp, distKphb);
              const hubName = distChamp <= distKphb ? 'Champapet Fulfillment Hub' : 'KPHB Fulfillment Hub';
              const inZone = minD <= 5.0;

              data = {
                colony: 'Detected GPS Location',
                formatted_address: `Doorstep Location (${lat.toFixed(4)}, ${lng.toFixed(4)}), Hyderabad`,
                pincode: '',
                serviceability: {
                  configured: true,
                  serviceable: inZone,
                  distanceKm: minD,
                  radiusKm: 5.0,
                  assigned_hub_name: hubName,
                  message: inZone
                    ? `Great! Delivery is available at your location (${minD} km from ${hubName}).`
                    : `Sorry! Location is ${minD} km from ${hubName} (maximum radius: 5.0 KM).`,
                },
              };
            }
          }

          if (data) {
            setSelectedColony(data.colony || data.area || 'Detected Location');
            setSelectedAddress(data.formatted_address || `${lat}, ${lng}`);
            if (data.pincode) setPincodeInput(data.pincode);

            const serv = data.serviceability || {};
            const isServ = Boolean(serv.serviceable);
            const isPaused = Boolean(serv.is_paused);

            setServiceCheck({
              loading: false,
              checked: true,
              configured: serv.configured !== false,
              serviceable: isServ && !isPaused,
              distanceKm: serv.distanceKm,
              radiusKm: serv.radiusKm || 5.0,
              message: serv.message,
              assignedHubName: serv.assigned_hub_name || serv.hubName,
              assignedHubCode: serv.assigned_hub_code,
              assignedHubId: serv.assigned_hub_id,
              isPaused,
              pauseReason: serv.pause_reason,
            });

            if (isServ && !isPaused) {
              setSuccessMsg(`GPS verified! Within 5.0 KM of ${serv.assigned_hub_name || 'fulfillment hub'}.`);
            } else if (isPaused) {
              setErrorMsg(serv.pause_reason || 'Deliveries from this fulfillment hub are temporarily paused.');
            } else {
              setErrorMsg(
                `Outside 5.0 KM zone: Your location is ${serv.distanceKm} km from our nearest hub (${serv.assigned_hub_name || 'delivery hub'}). Delivery is available up to 5.0 KM.`
              );
            }
          }
        } catch {
          setErrorMsg('Unable to retrieve address for detected coordinates. Please tap your building on the map.');
        } finally {
          setIsDetectingGps(false);
        }
      },
      (error) => {
        setIsDetectingGps(false);
        let msg = 'Unable to detect your location. Please tap your building on the map below.';
        if (error.code === error.PERMISSION_DENIED) {
          msg = 'Location permission was denied. You can easily tap or drag the pin on the map below to select your doorstep.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          msg = 'Device location unavailable. Please tap your building or search your colony on the map.';
        } else if (error.code === error.TIMEOUT) {
          msg = 'GPS request timed out. Please tap your building on the map below.';
        }
        setErrorMsg(msg);
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      }
    );
  };

  // Keyboard accessibility: Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Load cached delivery preferences and saved addresses when modal opens
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';

      const savedZone = localStorage.getItem('fresh_delivery_zone');
      const savedColony = localStorage.getItem('fresh_delivery_colony');
      const savedAddr = localStorage.getItem('fresh_delivery_address');
      const savedCoords = localStorage.getItem('fresh_delivery_coords');

      let hasSavedCoords = false;
      let initCoords: [number, number] = [17.3850, 78.4867];

      if (savedCoords) {
        try {
          const parsed = JSON.parse(savedCoords);
          if (parsed.latitude && parsed.longitude) {
            initCoords = [Number(parsed.latitude), Number(parsed.longitude)];
            hasSavedCoords = true;
          }
        } catch {}
      }

      if (hasSavedCoords) {
        setCurrentCoords(initCoords);
        setHasVerifiedCoords(true);
        setManualLatInput(initCoords[0].toString());
        setManualLngInput(initCoords[1].toString());
        if (savedColony) setSelectedColony(savedColony);
        if (savedAddr) setSelectedAddress(savedAddr);
        verifyServiceability(initCoords[0], initCoords[1]);
      } else {
        // Customer has not yet verified a location: do NOT default coords to hub
        setHasVerifiedCoords(false);
        setServiceCheck({
          loading: false,
          checked: false,
          configured: true,
          serviceable: false,
          radiusKm: deliverySettings?.delivery_radius_km || 5.0,
        });
      }

      if (savedZone) {
        try {
          setSelectedZone(JSON.parse(savedZone));
        } catch {}
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
  }, [isOpen, user, verifyServiceability, deliverySettings]);

  // Handle manual position changes from interactive map pin or search
  const handleMapPositionChange = (
    lat: number,
    lng: number,
    details?: AddressDetails
  ) => {
    setCurrentCoords([lat, lng]);
    setHasVerifiedCoords(true);
    setManualLatInput(lat.toFixed(6));
    setManualLngInput(lng.toFixed(6));
    setErrorMsg(null);
    setSuccessMsg(null);

    verifyServiceability(lat, lng);

    if (details) {
      if (details.colony) setSelectedColony(details.colony);
      if (details.fullAddress) setSelectedAddress(details.fullAddress);
      if (details.pincode) setPincodeInput(details.pincode);
      if (details.matchedZone) setSelectedZone(details.matchedZone);
    }
  };

  // Quick colony click
  const handleQuickColonyClick = (colonyName: string) => {
    const found = HYDERABAD_COLONIES.find((c) => c.name === colonyName);
    if (found) {
      setCurrentCoords([found.lat, found.lng]);
      setHasVerifiedCoords(true);
      setManualLatInput(found.lat.toString());
      setManualLngInput(found.lng.toString());
      setSelectedColony(found.colony);
      setSelectedAddress(`${found.colony}, Hyderabad - ${found.pincode}`);
      setPincodeInput(found.pincode);

      const matched =
        zones.find(
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
    setHasVerifiedCoords(true);
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
      setHasVerifiedCoords(true);
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
      setErrorMsg(`Saved address "${addr.area || addr.city}" requires a verified map pin. Please tap your location on the map.`);
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
          setHasVerifiedCoords(true);
          setManualLatInput(lat.toString());
          setManualLngInput(lng.toString());
          verifyServiceability(lat, lng);
        }
        setSuccessMsg(`Pincode ${pincodeInput} matched delivery zone.`);
      } else {
        setErrorMsg(data?.message || `Pincode ${pincodeInput} is outside our 5.0 KM express delivery zones.`);
      }
    } catch {
      setErrorMsg('Pincode check error. Please select your building on the map.');
    } finally {
      setIsCheckingPincode(false);
    }
  };

  // Final Confirmation: Strictly gated by verified coordinates and backend serviceability
  const handleConfirmLocation = async () => {
    if (!hasVerifiedCoords) {
      setErrorMsg('Please detect your GPS location or tap your building on the map first.');
      return;
    }

    const lat = currentCoords[0];
    const lng = currentCoords[1];

    // Authoritative recheck
    const servResult = await checkLocationServiceability(lat, lng);

    if (!servResult.serviceable) {
      setErrorMsg(
        `Delivery is not available at this location. Your location is ${servResult.distanceKm} km away (maximum permitted radius: 5.0 KM from our nearest fulfillment hub).`
      );
      return;
    }

    const finalZone = selectedZone || {
      id: serviceCheck.assignedHubCode === 'kphb' ? 'zone-kphb' : 'zone-champapet',
      name: selectedColony || serviceCheck.assignedHubName || 'Verified Delivery Zone',
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
    localStorage.setItem('fresh_delivery_colony', selectedColony || 'Selected Location');
    localStorage.setItem('fresh_delivery_address', selectedAddress || `${lat}, ${lng}`);
    localStorage.setItem('fresh_delivery_coords', JSON.stringify({ latitude: lat, longitude: lng }));

    // Global reactive event
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
          assignedHubName: serviceCheck.assignedHubName,
        },
      })
    );

    if (onZoneSelected) {
      onZoneSelected(finalZone, selectedColony);
    }

    setSuccessMsg(`Delivering fresh to ${selectedColony}!`);

    setTimeout(() => {
      onClose();
    }, 350);
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={modalTitleId}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-5 bg-ink-900/70 backdrop-blur-sm animate-fade-in overflow-y-auto"
      style={{ minHeight: '100vh', width: '100vw' }}
    >
      <div
        className="bg-surface border border-line text-ink-900 w-full max-w-4xl rounded-3xl p-4 sm:p-6 shadow-2xl relative space-y-4 my-auto max-h-[94vh] overflow-y-auto transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-line">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sage-100 border border-leaf-500/20 text-forest-700 flex items-center justify-center shadow-xs">
              <MapPin className="w-5 h-5 text-forest-700" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 id={modalTitleId} className="font-serif font-black text-ink-900 text-base sm:text-lg tracking-tight">
                  Choose Delivery Location
                </h3>
                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider bg-sage-100 text-forest-800 border border-leaf-500/20 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-leaf-500 animate-pulse"></span>
                  Two-Hub 5.0 KM Delivery
                </span>
              </div>
              <p className="text-xs text-ink-500 mt-0.5">
                Orders are dispatched fresh within 5 km straight-line radius of our <strong>Champapet</strong> and <strong>KPHB</strong> hubs.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close location selector"
            className="w-9 h-9 rounded-full bg-cream-100 hover:bg-cream-200 text-ink-600 hover:text-ink-900 flex items-center justify-center transition-colors border border-line cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* GPS Auto-Detect Banner */}
        <div className="bg-gradient-to-r from-cream-100 via-cream-50 to-sage-50 border border-leaf-500/20 rounded-2xl p-3 sm:p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-transform ${
                isDetectingGps
                  ? 'bg-sage-100 text-forest-700 ring-2 ring-leaf-400'
                  : 'bg-forest-900 text-cream-50 shadow-soft'
              }`}
            >
              {isDetectingGps ? (
                <Loader2 className="w-5 h-5 animate-spin text-forest-700" />
              ) : (
                <Navigation className="w-5 h-5 text-cream-50 fill-cream-50" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-serif font-bold text-sm sm:text-base text-ink-900">
                  Detect My Location
                </h4>
                <span className="text-[10px] bg-sage-100 text-forest-800 font-bold px-2 py-0.5 rounded-full border border-leaf-500/20">
                  Device GPS
                </span>
              </div>
              <p className="text-xs text-ink-600 mt-0.5">
                {isDetectingGps
                  ? 'Acquiring high-accuracy device GPS & checking Champapet and KPHB hubs...'
                  : 'Auto-detect your doorstep address using precise device geolocation'}
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={isDetectingGps}
            onClick={handleDetectGps}
            className="h-10 px-5 rounded-xl font-bold text-xs sm:text-sm bg-forest-900 hover:bg-forest-800 text-cream-50 shadow-soft flex items-center justify-center gap-2 shrink-0 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed transition-all"
            aria-label="Detect My Location"
          >
            {isDetectingGps ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-cream-50" />
                <span>Locating...</span>
              </>
            ) : (
              <>
                <Navigation className="w-4 h-4 fill-cream-50 text-cream-50" />
                <span>Detect My Location</span>
              </>
            )}
          </button>
        </div>

        {/* Saved Addresses Quick Picker (if logged in and has addresses) */}
        {savedAddresses.length > 0 && (
          <div className="space-y-1.5 bg-cream-50 p-3 rounded-2xl border border-line">
            <div className="flex items-center justify-between text-[11px] font-bold text-forest-800 uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <Home className="w-3.5 h-3.5" />
                Select From Your Saved Addresses
              </span>
              <span className="text-[10px] text-ink-400 lowercase">tap to verify coords</span>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1">
              {savedAddresses.map((addr) => {
                const hasCoords = addr.latitude && addr.longitude;
                return (
                  <button
                    key={addr.id}
                    type="button"
                    onClick={() => handleSelectSavedAddress(addr)}
                    className="h-8 px-3 rounded-xl bg-surface hover:bg-cream-100 border border-line text-xs font-bold text-ink-700 hover:text-ink-900 flex items-center gap-2 shrink-0 transition-all cursor-pointer shadow-xs"
                  >
                    {addr.address_type === 'work' ? (
                      <Briefcase className="w-3.5 h-3.5 text-leaf-600" />
                    ) : (
                      <Home className="w-3.5 h-3.5 text-forest-700" />
                    )}
                    <span className="truncate max-w-[130px]">{addr.area || addr.city}</span>
                    {hasCoords ? (
                      <span className="text-[9px] bg-sage-100 text-forest-800 px-1.5 py-0.5 rounded border border-leaf-500/20 font-bold">
                        GPS
                      </span>
                    ) : (
                      <span className="text-[9px] bg-marigold-100 text-marigold-800 px-1.5 py-0.5 rounded border border-marigold-200 font-bold">
                        Needs Pin
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Quick Hyderabad Area Chips */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-forest-800 font-bold uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-leaf-600" />
              Quick Select Popular Hyderabad Areas
            </span>
            <button
              type="button"
              onClick={() => setShowManualInputs(!showManualInputs)}
              className="text-[10.5px] font-bold text-forest-700 hover:text-forest-900 flex items-center gap-1 cursor-pointer"
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
                      ? 'bg-forest-900 text-cream-50 shadow-soft font-bold'
                      : 'bg-cream-100 hover:bg-cream-200 text-ink-700 border border-line'
                  }`}
                >
                  <MapPin className="w-3 h-3 text-leaf-600" />
                  <span>{colName}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Optional Manual Coordinate Input Section */}
        {showManualInputs && (
          <form
            onSubmit={handleApplyManualCoords}
            className="p-3 bg-cream-50 border border-line rounded-2xl flex flex-wrap items-center gap-3 animate-fade-in text-xs"
          >
            <div className="flex items-center gap-1.5 flex-1 min-w-[130px]">
              <span className="text-ink-600 font-bold">Lat:</span>
              <input
                type="number"
                step="0.000001"
                min="-90"
                max="90"
                value={manualLatInput}
                onChange={(e) => setManualLatInput(e.target.value)}
                placeholder="17.344570"
                className="w-full h-8 px-2.5 rounded-lg bg-surface border border-line text-ink-900 font-mono text-xs focus:outline-none focus:border-forest-700"
              />
            </div>
            <div className="flex items-center gap-1.5 flex-1 min-w-[130px]">
              <span className="text-ink-600 font-bold">Lng:</span>
              <input
                type="number"
                step="0.000001"
                min="-180"
                max="180"
                value={manualLngInput}
                onChange={(e) => setManualLngInput(e.target.value)}
                placeholder="78.516972"
                className="w-full h-8 px-2.5 rounded-lg bg-surface border border-line text-ink-900 font-mono text-xs focus:outline-none focus:border-forest-700"
              />
            </div>
            <button
              type="submit"
              className="h-8 px-3.5 bg-forest-900 hover:bg-forest-800 text-cream-50 font-bold rounded-lg text-xs cursor-pointer transition-colors"
            >
              Apply Coordinates
            </button>
          </form>
        )}

        {/* Interactive Map & Serviceability Container */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Map Column (7 cols) */}
          <div className="lg:col-span-7 space-y-2">
            <div className="rounded-2xl overflow-hidden border border-line shadow-xs">
              <InteractiveLocationMap
                initialCenter={currentCoords}
                markerPosition={hasVerifiedCoords ? currentCoords : null}
                onPositionChange={handleMapPositionChange}
                zones={zones}
                selectedZoneId={selectedZone?.id}
                height="340px"
                showSearchBar={true}
                showDetectLocationBtn={true}
                placeholder="Search colony, area or landmark in Hyderabad..."
              />
            </div>
            <p className="text-[11px] text-ink-500 text-center flex items-center justify-center gap-1">
              <Info className="w-3.5 h-3.5 text-forest-700 shrink-0" />
              <span>Click anywhere on the map or drag the pin to set your exact doorstep address.</span>
            </p>
          </div>

          {/* Serviceability & Details Column (5 cols) */}
          <div className="lg:col-span-5 space-y-3 flex flex-col justify-between">
            {/* Live Serviceability Feedback Banner */}
            <div
              className={`p-3.5 rounded-2xl border transition-all ${
                serviceCheck.loading
                  ? 'bg-cream-100 border-line text-ink-700'
                  : !serviceCheck.configured
                  ? 'bg-marigold-50 border-marigold-200 text-marigold-900'
                  : serviceCheck.isPaused
                  ? 'bg-marigold-50 border-marigold-300 text-marigold-900'
                  : serviceCheck.serviceable
                  ? 'bg-sage-50 border-leaf-500/30 text-forest-900'
                  : 'bg-tomato-50 border-tomato-200 text-tomato-900'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {serviceCheck.loading ? (
                  <Loader2 className="w-5 h-5 text-ink-500 animate-spin shrink-0 mt-0.5" />
                ) : !serviceCheck.configured ? (
                  <AlertTriangle className="w-5 h-5 text-marigold-600 shrink-0 mt-0.5" />
                ) : serviceCheck.isPaused ? (
                  <AlertTriangle className="w-5 h-5 text-marigold-600 shrink-0 mt-0.5" />
                ) : serviceCheck.serviceable ? (
                  <CheckCircle2 className="w-5 h-5 text-forest-700 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-tomato-600 shrink-0 mt-0.5" />
                )}

                <div className="space-y-0.5 min-w-0">
                  <h4 className="font-serif font-bold text-xs sm:text-sm">
                    {serviceCheck.loading
                      ? 'Checking delivery availability...'
                      : !hasVerifiedCoords
                      ? 'Location Pin Required'
                      : !serviceCheck.configured
                      ? 'Delivery Setup Pending'
                      : serviceCheck.isPaused
                      ? 'Hub Temporarily Paused'
                      : serviceCheck.serviceable
                      ? 'Delivery Available at your location'
                      : 'Outside 5.0 KM Delivery Area'}
                  </h4>

                  <div className="text-[11px] leading-relaxed space-y-1">
                    {serviceCheck.loading ? (
                      <p>Calculating straight-line distance to Champapet and KPHB hubs...</p>
                    ) : !hasVerifiedCoords ? (
                      <p>Please click "Detect My Location" or tap a point on the map to set your address.</p>
                    ) : serviceCheck.isPaused ? (
                      <p>{serviceCheck.pauseReason || 'Deliveries from this fulfillment hub are temporarily paused. Orders will resume shortly.'}</p>
                    ) : serviceCheck.serviceable ? (
                      <p>
                        Your address is <strong>{serviceCheck.distanceKm} km</strong> from{' '}
                        <strong>{serviceCheck.assignedHubName || 'Fulfillment Hub'}</strong> (within 5.0 KM limit).
                      </p>
                    ) : (
                      <>
                        <p className="font-semibold text-tomato-800">
                          Your location is <strong>{serviceCheck.distanceKm} km</strong> from our nearest hub (
                          {serviceCheck.assignedHubName || 'Champapet / KPHB'}). Maximum delivery radius is{' '}
                          <strong>5.0 KM</strong>.
                        </p>
                        <p className="text-tomato-700">
                          Please select another location within our delivery area.
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Selected Location Card */}
            <div
              className={`p-3.5 rounded-2xl border space-y-2 ${
                serviceCheck.checked && !serviceCheck.serviceable
                  ? 'bg-tomato-50/50 border-tomato-200'
                  : 'bg-surface border-line'
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                    serviceCheck.checked && !serviceCheck.serviceable ? 'text-tomato-700' : 'text-forest-800'
                  }`}
                >
                  <MapPin className="w-3.5 h-3.5" />
                  Selected Address
                </span>
                {hasVerifiedCoords && (
                  <span
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                      serviceCheck.checked && !serviceCheck.serviceable
                        ? 'bg-tomato-100 text-tomato-800 border-tomato-200'
                        : 'bg-sage-100 text-forest-800 border-leaf-500/20'
                    }`}
                  >
                    {currentCoords[0].toFixed(4)}, {currentCoords[1].toFixed(4)}
                  </span>
                )}
              </div>

              <div>
                <h4 className="text-sm font-serif font-bold text-ink-900 leading-snug">
                  {selectedColony || (hasVerifiedCoords ? 'Pinned Location' : 'No Location Selected')}
                </h4>
                <p className="text-xs text-ink-500 mt-0.5 line-clamp-2">
                  {selectedAddress || 'Click "Detect My Location" or tap a point on the map to set your address'}
                </p>
              </div>

              {/* Status footer */}
              {serviceCheck.checked && !serviceCheck.serviceable ? (
                <div className="pt-2 border-t border-tomato-200 flex items-center justify-between text-xs text-tomato-800 font-bold">
                  <div className="flex items-center gap-1.5 text-tomato-700">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>Outside 5.0 KM Radius</span>
                  </div>
                  <span>{serviceCheck.distanceKm} km from nearest hub</span>
                </div>
              ) : hasVerifiedCoords && serviceCheck.serviceable ? (
                <div className="pt-2 border-t border-line flex items-center justify-between text-xs text-forest-800 font-bold">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-leaf-600" />
                    <span>25–35 mins</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-leaf-600" />
                    <span>Express Delivery</span>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Explanatory Two-Hub Notice */}
            <div className="p-2.5 rounded-xl bg-cream-50 border border-line text-[11px] text-ink-600 leading-normal space-y-1">
              <div className="flex items-center gap-1 font-bold text-ink-800">
                <Building2 className="w-3.5 h-3.5 text-forest-700" />
                <span>Two-Hub Organic Delivery Model:</span>
              </div>
              <p>
                • <strong>Champapet Hub</strong> (South/East): 5.0 KM max radius<br />
                • <strong>KPHB Hub</strong> (West/North): 5.0 KM max radius
              </p>
            </div>

            {errorMsg && (
              <p className="text-[11px] text-tomato-700 font-medium flex items-center gap-1 pt-0.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-tomato-600" />
                <span>{errorMsg}</span>
              </p>
            )}
            {successMsg && (
              <p className="text-[11px] text-forest-700 font-bold flex items-center gap-1 pt-0.5">
                <Check className="w-3.5 h-3.5 shrink-0 text-leaf-600" />
                <span>{successMsg}</span>
              </p>
            )}

            {/* Confirm Location CTA Button */}
            <button
              type="button"
              disabled={
                !hasVerifiedCoords ||
                !serviceCheck.serviceable ||
                serviceCheck.loading ||
                !serviceCheck.checked ||
                Boolean(serviceCheck.isPaused)
              }
              onClick={handleConfirmLocation}
              className={`w-full h-11 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-soft ${
                hasVerifiedCoords && serviceCheck.serviceable && !serviceCheck.isPaused
                  ? 'bg-forest-900 hover:bg-forest-800 text-cream-50 cursor-pointer active:scale-98'
                  : 'bg-cream-200 border border-line text-ink-400 cursor-not-allowed opacity-80 shadow-none'
              }`}
            >
              {!hasVerifiedCoords ? (
                <>
                  <MapPin className="w-4 h-4 stroke-[2.5]" />
                  <span>Please Detect or Pick Your Location</span>
                </>
              ) : serviceCheck.loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying Delivery Zone...</span>
                </>
              ) : serviceCheck.isPaused ? (
                <>
                  <AlertTriangle className="w-4 h-4 stroke-[2.5]" />
                  <span>Deliveries Temporarily Paused</span>
                </>
              ) : serviceCheck.serviceable ? (
                <>
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>Confirm & Deliver to {selectedColony ? selectedColony.split(',')[0] : 'This Address'}</span>
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