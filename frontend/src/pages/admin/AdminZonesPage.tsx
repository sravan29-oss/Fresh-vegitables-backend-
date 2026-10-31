import React, { useEffect, useState, useMemo } from 'react';
import {
  MapPin,
  Plus,
  Trash2,
  Edit2,
  Check,
  Truck,
  Clock,
  Building,
  ShieldCheck,
  AlertCircle,
  Save,
  Sliders,
  DollarSign,
  Gift,
  Zap,
  Info,
  RefreshCw,
  Sparkles,
  X,
  Crosshair,
  Compass,
  CheckCircle2,
  Navigation,
  Target,
  Radio,
  Layers,
} from 'lucide-react';
import api from '../../services/api';
import { DeliveryZone, Store, DeliverySettings } from '../../types';
import { useCart } from '../../context/CartContext';
import { notifyLiveUpdate } from '../../services/liveSync';
import {
  InteractiveLocationMap,
  AddressDetails,
} from '../../components/common/InteractiveLocationMap';
import { getRealtimeDeliverySlots } from '../../utils/deliverySlots';

const HYDERABAD_ZONE_PRESETS = [
  { label: 'Champapet Central Hub', name: 'Champapet & Saroornagar Zone', colony: 'Champapet (Raji Reddy Nagar)', pincode: '500059', lat: 17.34457, lng: 78.516972, radius: 5.0 },
  { label: 'KPHB Phase 1–4', name: 'KPHB Colony & Kukatpally Zone', colony: 'KPHB Colony', pincode: '500072', lat: 17.4938, lng: 78.3995, radius: 8.5 },
  { label: 'Madhapur & Hitech', name: 'Madhapur & Cyber Towers Zone', colony: 'Madhapur', pincode: '500081', lat: 17.4474, lng: 78.3762, radius: 10.0 },
  { label: 'Gachibowli DLF', name: 'Gachibowli & Financial District Zone', colony: 'Gachibowli', pincode: '500032', lat: 17.4401, lng: 78.3489, radius: 10.0 },
  { label: 'Kondapur & Botanical', name: 'Kondapur & Silpa Park Zone', colony: 'Kondapur', pincode: '500084', lat: 17.4682, lng: 78.3639, radius: 8.0 },
  { label: 'Jubilee Hills Rd 36', name: 'Jubilee Hills & Film Nagar Zone', colony: 'Jubilee Hills', pincode: '500033', lat: 17.4319, lng: 78.4073, radius: 9.0 },
  { label: 'Banjara Hills Rd 12', name: 'Banjara Hills & Panjagutta Zone', colony: 'Banjara Hills', pincode: '500034', lat: 17.4156, lng: 78.4357, radius: 8.5 },
  { label: 'Miyapur & Allwyn', name: 'Miyapur, Chandanagar & BHEL Zone', colony: 'Miyapur', pincode: '500049', lat: 17.4968, lng: 78.3547, radius: 9.0 },
  { label: 'Pragathi Nagar', name: 'Pragathi Nagar & JNTU Zone', colony: 'Pragathi Nagar', pincode: '500090', lat: 17.5142, lng: 78.3887, radius: 7.5 },
];

interface AdminZonesPageProps {
  initialTab?: 'service_area' | 'settings' | 'zones' | 'stores' | 'slots';
}

export const AdminZonesPage: React.FC<AdminZonesPageProps> = ({ initialTab = 'service_area' }) => {
  const { fetchDeliverySettings: syncCartDeliverySettings } = useCart();

  // Active Tab
  const [activeTab, setActiveTab] = useState<'service_area' | 'settings' | 'zones' | 'stores' | 'slots'>(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Delivery Zones & Stores State
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<DeliveryZone | null>(null);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Delivery Service Area (5 KM Hub) State
  const [hubName, setHubName] = useState('Fresh Vegetables Central Hub');
  const [hubAddress, setHubAddress] = useState('');
  const [hubLat, setHubLat] = useState<string | number>('');
  const [hubLng, setHubLng] = useState<string | number>('');
  const [hubRadius, setHubRadius] = useState<number>(5.0);
  const [serviceabilityEnabled, setServiceabilityEnabled] = useState<boolean>(true);
  const [isSavingHub, setIsSavingHub] = useState(false);
  const [isLocatingHub, setIsLocatingHub] = useState(false);

  // Serviceability Test Simulator State
  const [testLat, setTestLat] = useState<string>('17.4938');
  const [testLng, setTestLng] = useState<string>('78.3995');
  const [testResult, setTestResult] = useState<any>(null);
  const [isTestingCoord, setIsTestingCoord] = useState(false);

  // Global Delivery Settings State
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [deliverySettings, setDeliverySettings] = useState<DeliverySettings>(() => {
    try {
      const cached = localStorage.getItem('fresh_veg_delivery_settings');
      if (cached) return JSON.parse(cached);
    } catch {}
    return {
      default_delivery_charge: 30,
      free_delivery_threshold: 499,
      min_order_amount: 199,
      enable_free_delivery: true,
      express_delivery_fee: 45,
      estimated_delivery_time: '25–35 mins',
      is_delivery_active: true,
      surge_charge: 0,
    };
  });
  const [savedSettings, setSavedSettings] = useState<DeliverySettings>(deliverySettings);

  // Determine if draft inputs have unsaved changes
  const isDirty =
    Number(deliverySettings.default_delivery_charge) !== Number(savedSettings.default_delivery_charge) ||
    Number(deliverySettings.free_delivery_threshold) !== Number(savedSettings.free_delivery_threshold) ||
    Number(deliverySettings.min_order_amount) !== Number(savedSettings.min_order_amount) ||
    Number(deliverySettings.express_delivery_fee) !== Number(savedSettings.express_delivery_fee) ||
    Number(deliverySettings.surge_charge) !== Number(savedSettings.surge_charge) ||
    String(deliverySettings.estimated_delivery_time || '').trim() !== String(savedSettings.estimated_delivery_time || '').trim() ||
    Boolean(deliverySettings.enable_free_delivery) !== Boolean(savedSettings.enable_free_delivery) ||
    Boolean(deliverySettings.is_delivery_active) !== Boolean(savedSettings.is_delivery_active) ||
    String(deliverySettings.operating_hours_start || '') !== String(savedSettings.operating_hours_start || '') ||
    String(deliverySettings.operating_hours_end || '') !== String(savedSettings.operating_hours_end || '') ||
    Boolean(deliverySettings.express_enabled) !== Boolean(savedSettings.express_enabled) ||
    String(deliverySettings.express_start_time || '') !== String(savedSettings.express_start_time || '') ||
    String(deliverySettings.express_end_time || '') !== String(savedSettings.express_end_time || '') ||
    Boolean(deliverySettings.morning_slot_enabled) !== Boolean(savedSettings.morning_slot_enabled) ||
    String(deliverySettings.morning_slot_start || '') !== String(savedSettings.morning_slot_start || '') ||
    String(deliverySettings.morning_slot_end || '') !== String(savedSettings.morning_slot_end || '') ||
    String(deliverySettings.morning_slot_cutoff || '') !== String(savedSettings.morning_slot_cutoff || '') ||
    Boolean(deliverySettings.evening_slot_enabled) !== Boolean(savedSettings.evening_slot_enabled) ||
    String(deliverySettings.evening_slot_start || '') !== String(savedSettings.evening_slot_start || '') ||
    String(deliverySettings.evening_slot_end || '') !== String(savedSettings.evening_slot_end || '') ||
    String(deliverySettings.evening_slot_cutoff || '') !== String(savedSettings.evening_slot_cutoff || '');

  const handleResetSettings = () => {
    setDeliverySettings(savedSettings);
  };

  // Live Customer Checkout Preview computed in real-time according to IST
  const liveSlotsPreview = useMemo(() => {
    return getRealtimeDeliverySlots(deliverySettings);
  }, [deliverySettings]);

  // Simulator State
  const [simCartAmount, setSimCartAmount] = useState<number>(350);

  // Zone Form State
  const [name, setName] = useState('');
  const [pincodes, setPincodes] = useState('');
  const [fee, setFee] = useState(20);
  const [minOrder, setMinOrder] = useState(199);
  const [freeThreshold, setFreeThreshold] = useState(499);
  const [eta, setEta] = useState('25–35 mins');
  const [zoneLat, setZoneLat] = useState<number>(17.4938);
  const [zoneLng, setZoneLng] = useState<number>(78.3995);
  const [zoneRadius, setZoneRadius] = useState<number>(8.5);
  const [detectedAddress, setDetectedAddress] = useState<string>('KPHB Colony Phase 1, Kukatpally, Hyderabad - 500072');
  const [detectedColony, setDetectedColony] = useState<string>('KPHB Colony');

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [zonesRes, storesRes, settingsRes] = await Promise.all([
        api.get('/zones/admin').catch(() => null),
        api.get('/zones/stores').catch(() => null),
        api.get('/delivery/settings').catch(() => null),
      ]);

      if (zonesRes?.data?.data) setZones(zonesRes.data.data);
      if (storesRes?.data?.data) setStores(storesRes.data.data);
      if (settingsRes?.data?.data) {
        const s = settingsRes.data.data;
        const normalized: DeliverySettings = {
          default_delivery_charge: Number(s.default_delivery_charge),
          free_delivery_threshold: Number(s.free_delivery_threshold),
          min_order_amount: Number(s.min_order_amount),
          enable_free_delivery: Boolean(s.enable_free_delivery),
          express_delivery_fee: Number(s.express_delivery_fee),
          estimated_delivery_time: String(s.estimated_delivery_time || '25–35 mins'),
          is_delivery_active: s.is_delivery_active !== false,
          surge_charge: Number(s.surge_charge || 0),
          hub_name: s.hub_name || 'Fresh Vegetables Central Hub',
          hub_address: s.hub_address || '',
          hub_latitude: s.hub_latitude !== null && s.hub_latitude !== undefined ? Number(s.hub_latitude) : null,
          hub_longitude: s.hub_longitude !== null && s.hub_longitude !== undefined ? Number(s.hub_longitude) : null,
          delivery_radius_km: s.delivery_radius_km ? Number(s.delivery_radius_km) : 5.0,
          serviceability_enabled: s.serviceability_enabled !== false,
          is_hub_configured: Boolean(s.is_hub_configured),
          operating_hours_start: s.operating_hours_start || '07:00',
          operating_hours_end: s.operating_hours_end || '21:30',
          express_enabled: s.express_enabled !== false,
          express_start_time: s.express_start_time || '07:00',
          express_end_time: s.express_end_time || '21:00',
          morning_slot_enabled: s.morning_slot_enabled !== false,
          morning_slot_start: s.morning_slot_start || '07:00',
          morning_slot_end: s.morning_slot_end || '09:00',
          morning_slot_cutoff: s.morning_slot_cutoff || '08:30',
          evening_slot_enabled: s.evening_slot_enabled !== false,
          evening_slot_start: s.evening_slot_start || '17:00',
          evening_slot_end: s.evening_slot_end || '19:00',
          evening_slot_cutoff: s.evening_slot_cutoff || '18:30',
        };
        setDeliverySettings(normalized);
        setSavedSettings(normalized);
        setHubName(normalized.hub_name || 'Fresh Vegetables Central Hub');
        setHubAddress(normalized.hub_address || '');
        setHubLat(normalized.hub_latitude !== null && normalized.hub_latitude !== undefined ? normalized.hub_latitude : '');
        setHubLng(normalized.hub_longitude !== null && normalized.hub_longitude !== undefined ? normalized.hub_longitude : '');
        setHubRadius(normalized.delivery_radius_km || 5.0);
        setServiceabilityEnabled(normalized.serviceability_enabled !== false);
        try {
          localStorage.setItem('fresh_veg_delivery_settings', JSON.stringify(normalized));
        } catch {}
      }
    } catch (err) {
      console.error('Error fetching delivery data', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 4000);
  };

  // ================= SAVE GLOBAL DELIVERY CHARGES =================
  const handleSaveGlobalSettings = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    try {
      setIsSavingSettings(true);
      const payload = {
        default_delivery_charge: Math.max(0, Number(deliverySettings.default_delivery_charge) || 0),
        free_delivery_threshold: Math.max(0, Number(deliverySettings.free_delivery_threshold) || 0),
        min_order_amount: Math.max(0, Number(deliverySettings.min_order_amount) || 0),
        enable_free_delivery: Boolean(deliverySettings.enable_free_delivery),
        express_delivery_fee: Math.max(0, Number(deliverySettings.express_delivery_fee) || 0),
        estimated_delivery_time: String(deliverySettings.estimated_delivery_time || '25–35 mins').trim(),
        surge_charge: Math.max(0, Number(deliverySettings.surge_charge) || 0),
        is_delivery_active: Boolean(deliverySettings.is_delivery_active),
        operating_hours_start: deliverySettings.operating_hours_start || '07:00',
        operating_hours_end: deliverySettings.operating_hours_end || '21:30',
        express_enabled: deliverySettings.express_enabled !== false,
        express_start_time: deliverySettings.express_start_time || '07:00',
        express_end_time: deliverySettings.express_end_time || '21:00',
        morning_slot_enabled: deliverySettings.morning_slot_enabled !== false,
        morning_slot_start: deliverySettings.morning_slot_start || '07:00',
        morning_slot_end: deliverySettings.morning_slot_end || '09:00',
        morning_slot_cutoff: deliverySettings.morning_slot_cutoff || '08:30',
        evening_slot_enabled: deliverySettings.evening_slot_enabled !== false,
        evening_slot_start: deliverySettings.evening_slot_start || '17:00',
        evening_slot_end: deliverySettings.evening_slot_end || '19:00',
        evening_slot_cutoff: deliverySettings.evening_slot_cutoff || '18:30',
      };

      const res = await api.put('/delivery/settings', payload);
      if (res.data?.data) {
        const updated = res.data.data;
        const normalized: DeliverySettings = {
          default_delivery_charge: Number(updated.default_delivery_charge),
          free_delivery_threshold: Number(updated.free_delivery_threshold),
          min_order_amount: Number(updated.min_order_amount),
          enable_free_delivery: Boolean(updated.enable_free_delivery),
          express_delivery_fee: Number(updated.express_delivery_fee),
          estimated_delivery_time: String(updated.estimated_delivery_time || '25–35 mins'),
          is_delivery_active: updated.is_delivery_active !== false,
          surge_charge: Number(updated.surge_charge || 0),
          operating_hours_start: updated.operating_hours_start || '07:00',
          operating_hours_end: updated.operating_hours_end || '21:30',
          express_enabled: updated.express_enabled !== false,
          express_start_time: updated.express_start_time || '07:00',
          express_end_time: updated.express_end_time || '21:00',
          morning_slot_enabled: updated.morning_slot_enabled !== false,
          morning_slot_start: updated.morning_slot_start || '07:00',
          morning_slot_end: updated.morning_slot_end || '09:00',
          morning_slot_cutoff: updated.morning_slot_cutoff || '08:30',
          evening_slot_enabled: updated.evening_slot_enabled !== false,
          evening_slot_start: updated.evening_slot_start || '17:00',
          evening_slot_end: updated.evening_slot_end || '19:00',
          evening_slot_cutoff: updated.evening_slot_cutoff || '18:30',
        };
        setDeliverySettings(normalized);
        setSavedSettings(normalized);
        try {
          localStorage.setItem('fresh_veg_delivery_settings', JSON.stringify(normalized));
        } catch {}

        await syncCartDeliverySettings();
        notifyLiveUpdate('all');
        showToast(`Store delivery charges saved successfully! (₹${normalized.default_delivery_charge} base fee, ₹${normalized.free_delivery_threshold} free threshold)`);
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to update delivery settings', 'error');
    } finally {
      setIsSavingSettings(false);
    }
  };

  // ================= SAVE DELIVERY SERVICE AREA (5 KM HUB) =================
  const handleSaveHubSettings = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    try {
      setIsSavingHub(true);
      let parsedLat: number | null = null;
      let parsedLng: number | null = null;

      if (hubLat !== '' && hubLat !== null && hubLat !== undefined) {
        parsedLat = Number(hubLat);
        if (isNaN(parsedLat) || parsedLat < -90 || parsedLat > 90) {
          showToast('Hub latitude must be a valid number between -90 and 90', 'error');
          setIsSavingHub(false);
          return;
        }
      }

      if (hubLng !== '' && hubLng !== null && hubLng !== undefined) {
        parsedLng = Number(hubLng);
        if (isNaN(parsedLng) || parsedLng < -180 || parsedLng > 180) {
          showToast('Hub longitude must be a valid number between -180 and 180', 'error');
          setIsSavingHub(false);
          return;
        }
      }

      if ((parsedLat !== null && parsedLng === null) || (parsedLat === null && parsedLng !== null)) {
        showToast('Both hub latitude and longitude must be provided together, or both cleared', 'error');
        setIsSavingHub(false);
        return;
      }

      const radius = Number(hubRadius);
      if (isNaN(radius) || radius <= 0 || radius > 100) {
        showToast('Delivery radius must be greater than 0 and within 100 km', 'error');
        setIsSavingHub(false);
        return;
      }

      const payload = {
        ...deliverySettings,
        hub_name: hubName.trim() || 'Fresh Vegetables Central Hub',
        hub_address: hubAddress.trim(),
        hub_latitude: parsedLat,
        hub_longitude: parsedLng,
        delivery_radius_km: radius,
        serviceability_enabled: Boolean(serviceabilityEnabled),
      };

      const res = await api.put('/delivery/settings', payload);
      if (res.data?.data) {
        const updated = res.data.data;
        const normalized: DeliverySettings = {
          ...deliverySettings,
          hub_name: updated.hub_name,
          hub_address: updated.hub_address,
          hub_latitude: updated.hub_latitude !== null && updated.hub_latitude !== undefined ? Number(updated.hub_latitude) : null,
          hub_longitude: updated.hub_longitude !== null && updated.hub_longitude !== undefined ? Number(updated.hub_longitude) : null,
          delivery_radius_km: Number(updated.delivery_radius_km || 5.0),
          serviceability_enabled: Boolean(updated.serviceability_enabled),
          is_hub_configured: Boolean(updated.is_hub_configured),
        };
        setDeliverySettings(normalized);
        setSavedSettings(normalized);
        try {
          localStorage.setItem('fresh_veg_delivery_settings', JSON.stringify(normalized));
        } catch {}

        await syncCartDeliverySettings();
        notifyLiveUpdate('all');

        if (normalized.is_hub_configured) {
          showToast(`Delivery Hub saved & 5 KM geofenced delivery activated! (Radius: ${normalized.delivery_radius_km} km)`);
        } else {
          showToast('Delivery Hub coordinates cleared. Store is now in fail-safe mode (checkout blocked until hub coordinates are set).');
        }
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to update delivery hub settings', 'error');
    } finally {
      setIsSavingHub(false);
    }
  };

  const handleClearHub = async () => {
    if (!window.confirm('Are you sure you want to clear the delivery hub coordinates? The store will enter fail-safe mode (customers will be notified that delivery is being configured, and checkout will be safely paused).')) {
      return;
    }
    setHubLat('');
    setHubLng('');
    try {
      setIsSavingHub(true);
      const res = await api.put('/delivery/settings', {
        ...deliverySettings,
        hub_name: hubName,
        hub_address: hubAddress,
        hub_latitude: null,
        hub_longitude: null,
        delivery_radius_km: hubRadius,
        serviceability_enabled: serviceabilityEnabled,
      });
      if (res.data?.data) {
        const updated = res.data.data;
        setDeliverySettings(updated);
        setSavedSettings(updated);
        await syncCartDeliverySettings();
        notifyLiveUpdate('all');
        showToast('Hub coordinates cleared. Fail-safe mode is now active.');
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to clear hub coordinates', 'error');
    } finally {
      setIsSavingHub(false);
    }
  };

  const handleDetectHubLocation = () => {
    if (!navigator.geolocation) {
      showToast('Geolocation is not supported by your browser', 'error');
      return;
    }
    setIsLocatingHub(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        setHubLat(lat);
        setHubLng(lng);
        setIsLocatingHub(false);
        showToast(`Detected location: ${lat}, ${lng}. Remember to click "Save & Activate 5 KM Service Area"!`);
      },
      (err) => {
        setIsLocatingHub(false);
        showToast(`Location error: ${err.message}`, 'error');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleTestServiceability = async () => {
    const lat = Number(testLat);
    const lng = Number(testLng);
    if (isNaN(lat) || isNaN(lng)) {
      showToast('Please enter valid test latitude and longitude', 'error');
      return;
    }
    try {
      setIsTestingCoord(true);
      setTestResult(null);
      const res = await api.post('/delivery/check-serviceability', {
        latitude: lat,
        longitude: lng,
      });
      setTestResult(res.data?.data);
    } catch (err: any) {
      setTestResult(err.response?.data || { serviceable: false, message: 'Check failed' });
    } finally {
      setIsTestingCoord(false);
    }
  };

  // Ctrl+S / Cmd+S shortcut to save settings immediately
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSaveGlobalSettings();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deliverySettings]);

  // ================= ZONE ACTIONS =================
  const handleMapPositionChange = (lat: number, lng: number, details?: AddressDetails) => {
    setZoneLat(Number(lat.toFixed(6)));
    setZoneLng(Number(lng.toFixed(6)));
    if (details) {
      if (details.fullAddress) setDetectedAddress(details.fullAddress);
      if (details.colony) {
        setDetectedColony(details.colony);
        // Automatically sync zone name if it's default or generated
        setName((prev) => {
          if (!prev || prev.includes('& Surrounding') || prev.includes('Zone')) {
            return `${details.colony} & Surrounding Zone`;
          }
          return prev;
        });
      }
      if (details.pincode) {
        setPincodes((prev) => {
          if (!prev.trim()) return details.pincode!;
          const arr = prev.split(',').map((p) => p.trim());
          if (!arr.includes(details.pincode!)) {
            return `${prev}, ${details.pincode}`;
          }
          return prev;
        });
      }
    }
  };

  const handleSelectPreset = (preset: typeof HYDERABAD_ZONE_PRESETS[0]) => {
    setZoneLat(preset.lat);
    setZoneLng(preset.lng);
    setZoneRadius(preset.radius);
    setName(preset.name);
    setPincodes(preset.pincode);
    setDetectedColony(preset.colony);
    setDetectedAddress(`${preset.colony}, Hyderabad - ${preset.pincode}`);
  };

  const handleSaveZone = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!name.trim()) {
        alert('Please specify a Zone Name');
        return;
      }
      const pinArray = pincodes
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);

      if (pinArray.length === 0) {
        alert('Please provide at least one covered pincode for this zone');
        return;
      }

      const payload = {
        name: name.trim(),
        pincodes: pinArray,
        delivery_fee: Math.max(0, Number(fee) || 0),
        min_order_amount: Math.max(0, Number(minOrder) || 0),
        free_delivery_threshold: Math.max(0, Number(freeThreshold) || 0),
        estimated_delivery_time: eta.trim() || '25–35 mins',
        latitude: Number(zoneLat),
        longitude: Number(zoneLng),
        delivery_radius_km: Math.max(0.5, Number(zoneRadius) || 8.5),
      };

      if (editingZone) {
        await api.put(`/zones/admin/${editingZone.id}`, payload);
        showToast(`Delivery zone "${name}" updated successfully`);
      } else {
        await api.post('/zones/admin', payload);
        showToast(`New delivery zone "${name}" created successfully`);
      }

      setIsModalOpen(false);
      setEditingZone(null);
      await fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to save zone');
    }
  };

  const handleDeleteZone = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this delivery zone?')) return;
    try {
      await api.delete(`/zones/admin/${id}`);
      showToast('Delivery zone removed');
      fetchData();
    } catch (err) {
      alert('Failed to delete delivery zone');
    }
  };

  const openCreate = () => {
    setEditingZone(null);
    setName('Kukatpally & KPHB Zone');
    setPincodes('500072, 500085');
    setFee(20);
    setMinOrder(199);
    setFreeThreshold(499);
    setEta('25–35 mins');
    setZoneLat(17.4938);
    setZoneLng(78.3995);
    setZoneRadius(8.5);
    setDetectedColony('KPHB Colony');
    setDetectedAddress('KPHB Colony Phase 1, Kukatpally, Hyderabad - 500072');
    setIsModalOpen(true);
  };

  const openEdit = (zone: DeliveryZone) => {
    setEditingZone(zone);
    setName(zone.name);
    setPincodes(Array.isArray(zone.pincodes) ? zone.pincodes.join(', ') : String(zone.pincodes || ''));
    setFee(zone.delivery_fee);
    setMinOrder(zone.min_order_amount);
    setFreeThreshold(zone.free_delivery_threshold);
    setEta(zone.estimated_delivery_time);
    setZoneLat(zone.latitude ? Number(zone.latitude) : 17.4474);
    setZoneLng(zone.longitude ? Number(zone.longitude) : 78.3762);
    setZoneRadius(Number(zone.delivery_radius_km) || 8.5);
    setDetectedColony(zone.name);
    setDetectedAddress(`${zone.name}, Hyderabad`);
    setIsModalOpen(true);
  };

  // Live simulation calculations
  const simIsFree = deliverySettings.enable_free_delivery && simCartAmount >= deliverySettings.free_delivery_threshold;
  const simDeliveryCharge = simIsFree ? 0 : (Number(deliverySettings.default_delivery_charge) + Number(deliverySettings.surge_charge || 0));
  const simTotal = simCartAmount + simDeliveryCharge;
  const simShortOfFree = Math.max(0, deliverySettings.free_delivery_threshold - simCartAmount);
  const simShortOfMin = Math.max(0, deliverySettings.min_order_amount - simCartAmount);

  // Total covered pincodes count
  const totalCoveredPincodes = zones.reduce((acc, z) => acc + (z.pincodes?.length || 0), 0);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-white tracking-tight">
              Delivery Charges &amp; Zones
            </h1>
            <span className="text-xs bg-brand-500/20 text-brand-400 border border-brand-500/30 px-2.5 py-0.5 rounded-full font-bold">
              Live Operations
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Manage store-wide delivery charges, free delivery thresholds, minimum order requirements, and zone pincodes.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchData}
            disabled={isLoading}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all border border-slate-700"
            title="Refresh Delivery Charges"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          {activeTab === 'zones' && (
            <button
              onClick={openCreate}
              className="bg-brand-500 hover:bg-brand-400 text-slate-950 font-extrabold text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-brand-500/20"
            >
              <Plus className="w-4 h-4" />
              <span>Add Custom Zone</span>
            </button>
          )}
        </div>
      </div>

      {/* Toast Alert */}
      {msg && (
        <div
          className={`px-4 py-3 rounded-2xl flex items-center gap-2 text-xs font-bold transition-all shadow-lg ${
            msg.type === 'success'
              ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
          }`}
        >
          {msg.type === 'success' ? <Check className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
          <span>{msg.text}</span>
        </div>
      )}

      {/* Quick KPI Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-2xl space-y-1">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            <span>5 KM Hub Status</span>
            <Target className="w-3.5 h-3.5 text-brand-400" />
          </div>
          <div className="text-xl font-black text-white flex items-center gap-2">
            {deliverySettings.is_hub_configured ? (
              <span className="text-emerald-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                Active ({deliverySettings.delivery_radius_km || 5} km)
              </span>
            ) : (
              <span className="text-amber-400 text-base flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-400" />
                Config Pending
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-500 font-medium">
            {deliverySettings.is_hub_configured
              ? `${deliverySettings.hub_name || 'Central Hub'}`
              : 'Checkout safely disabled'}
          </div>
        </div>

        <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-2xl space-y-1">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            <span>Base Delivery Fee</span>
            <Truck className="w-3.5 h-3.5 text-brand-400" />
          </div>
          <div className="text-2xl font-black text-white">
            ₹{deliverySettings.default_delivery_charge}
          </div>
          <div className="text-[11px] text-slate-500 font-medium">Standard customer shipping</div>
        </div>

        <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-2xl space-y-1">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            <span>Free Delivery At</span>
            <Gift className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400">
            ₹{deliverySettings.free_delivery_threshold}+
          </div>
          <div className="text-[11px] text-slate-500 font-medium">
            {deliverySettings.enable_free_delivery ? 'Promotion ACTIVE' : 'Promotion OFF'}
          </div>
        </div>

        <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-2xl space-y-1">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            <span>Active Coverage</span>
            <MapPin className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <div className="text-2xl font-black text-white">
            {zones.length} Zones
          </div>
          <div className="text-[11px] text-slate-500 font-medium">{totalCoveredPincodes} serviceable pincodes</div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('service_area')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap ${
            activeTab === 'service_area'
              ? 'bg-brand-500 text-slate-950 shadow-md shadow-brand-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Target className="w-4 h-4" />
          <span>Delivery Service Area (5 KM Hub)</span>
          {deliverySettings.is_hub_configured ? (
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          ) : (
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('slots')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap ${
            activeTab === 'slots'
              ? 'bg-brand-500 text-slate-950 shadow-md shadow-brand-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Clock className="w-4 h-4 text-emerald-400" />
          <span>Delivery Slots &amp; Store Timings</span>
          <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-black px-1.5 py-0.5 rounded">
            Real-Time IST
          </span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap ${
            activeTab === 'settings'
              ? 'bg-brand-500 text-slate-950 shadow-md shadow-brand-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Store Delivery Charges &amp; Rules</span>
        </button>

        <button
          onClick={() => setActiveTab('zones')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap ${
            activeTab === 'zones'
              ? 'bg-brand-500 text-slate-950 shadow-md shadow-brand-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <MapPin className="w-4 h-4" />
          <span>Pincode &amp; Zone Charges ({zones.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('stores')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap ${
            activeTab === 'stores'
              ? 'bg-brand-500 text-slate-950 shadow-md shadow-brand-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>Fulfillment Hubs ({stores.length})</span>
        </button>
      </div>

      {/* ================= TAB 0: DELIVERY SERVICE AREA (5 KM HUB) ================= */}
      {activeTab === 'service_area' && (
        <div className="space-y-6">
          {/* Header & Status Banner */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-3xl p-6 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="text-[11px] font-black uppercase tracking-wider text-brand-400 flex items-center gap-2">
                  <span>Admin</span>
                  <span>→</span>
                  <span>Settings</span>
                  <span>→</span>
                  <span>Delivery Service Area</span>
                </div>
                <h2 className="text-xl font-black text-white tracking-tight mt-1 flex items-center gap-2.5">
                  <Target className="w-5 h-5 text-brand-400" />
                  Delivery Hub &amp; 5 KM Straight-Line Service Area
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Configure your primary delivery hub coordinates. The backend authoritatively calculates straight-line distance via Haversine formula. Orders beyond {hubRadius || 5} km are automatically blocked from checkout.
                </p>
              </div>

              {/* Status Pill */}
              <div className="shrink-0">
                {deliverySettings.is_hub_configured ? (
                  <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-extrabold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Live 5 KM Geofence Active</span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-extrabold">
                    <AlertCircle className="w-4 h-4 text-amber-400 animate-pulse" />
                    <span>Configuration Pending (Fail-Safe Enforced)</span>
                  </div>
                )}
              </div>
            </div>

            {/* Alert Message for Fail-Safe Mode */}
            {!deliverySettings.is_hub_configured && (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs space-y-1">
                <div className="font-extrabold flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Fail-Safe Protection Active</span>
                </div>
                <p className="text-slate-300">
                  Because delivery hub coordinates are not yet configured, the storefront safely displays:
                  <span className="font-bold text-amber-300 ml-1">
                    “Delivery availability is being configured. Please try again shortly.”
                  </span>
                  {' '}Checkout is safely blocked for all customers until valid coordinates are saved below.
                </p>
              </div>
            )}
          </div>

          {/* Form and Interactive Map Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Form Controls */}
            <div className="lg:col-span-5 bg-slate-950/80 border border-slate-800 rounded-3xl p-6 space-y-5">
              <div className="border-b border-slate-800 pb-3">
                <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                  <Compass className="w-4 h-4 text-brand-400" />
                  Hub Coordinates &amp; Radius Configuration
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Set the latitude and longitude of your dispatch warehouse.
                </p>
              </div>

              <form onSubmit={handleSaveHubSettings} className="space-y-4">
                {/* Hub Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-brand-400" />
                    Delivery Hub Name
                  </label>
                  <input
                    type="text"
                    value={hubName}
                    onChange={(e) => setHubName(e.target.value)}
                    placeholder="e.g. Fresh Vegetables Central Hub"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                    required
                  />
                </div>

                {/* Hub Address */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-brand-400" />
                    Hub Physical Address
                  </label>
                  <textarea
                    rows={2}
                    value={hubAddress}
                    onChange={(e) => setHubAddress(e.target.value)}
                    placeholder="e.g. Plot 42, Phase 1, KPHB Colony, Kukatpally, Hyderabad 500072"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 resize-none"
                  />
                </div>

                {/* Latitude & Longitude */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-300">
                        Latitude
                      </label>
                      <span className="text-[10px] text-slate-500">-90 to 90</span>
                    </div>
                    <input
                      type="number"
                      step="0.000001"
                      value={hubLat}
                      onChange={(e) => setHubLat(e.target.value)}
                      placeholder="e.g. 17.493800"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-brand-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-300">
                        Longitude
                      </label>
                      <span className="text-[10px] text-slate-500">-180 to 180</span>
                    </div>
                    <input
                      type="number"
                      step="0.000001"
                      value={hubLng}
                      onChange={(e) => setHubLng(e.target.value)}
                      placeholder="e.g. 78.399500"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-brand-500"
                    />
                  </div>
                </div>

                {/* Delivery Radius */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <Radio className="w-3.5 h-3.5 text-brand-400" />
                      Delivery Radius (Kilometres)
                    </label>
                    <span className="text-xs font-mono font-extrabold text-brand-400">
                      {hubRadius} km
                    </span>
                  </div>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="50"
                    value={hubRadius}
                    onChange={(e) => setHubRadius(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-brand-500"
                  />
                  {/* Preset quick buttons */}
                  <div className="flex items-center gap-1.5 pt-1">
                    {[3, 5, 8, 10].map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setHubRadius(r)}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border transition-all ${
                          Number(hubRadius) === r
                            ? 'bg-brand-500 text-slate-950 border-brand-400 font-extrabold'
                            : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                        }`}
                      >
                        {r} km {r === 5 && '(Standard)'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Serviceability Enabled Switch */}
                <div className="pt-2">
                  <label className="flex items-start gap-3 p-3 rounded-2xl bg-slate-900/90 border border-slate-800 cursor-pointer hover:border-slate-700 transition-all">
                    <input
                      type="checkbox"
                      checked={serviceabilityEnabled}
                      onChange={(e) => setServiceabilityEnabled(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded text-brand-500 bg-slate-950 border-slate-700 focus:ring-0 cursor-pointer"
                    />
                    <div>
                      <span className="text-xs font-extrabold text-white block">
                        Strict 5 KM Serviceability Enforcement
                      </span>
                      <span className="text-[11px] text-slate-400 block mt-0.5 leading-relaxed">
                        When enabled, backend will strictly reject orders located outside the {hubRadius} km radius from this delivery hub.
                      </span>
                    </div>
                  </label>
                </div>

                {/* Action Buttons */}
                <div className="pt-2 space-y-2">
                  <button
                    type="submit"
                    disabled={isSavingHub}
                    className="w-full bg-brand-500 hover:bg-brand-400 text-slate-950 font-black text-xs py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-brand-500/20 transition-all disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    <span>{isSavingHub ? 'Saving & Enforcing...' : 'Save & Activate 5 KM Service Area'}</span>
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleDetectHubLocation}
                      disabled={isLocatingHub}
                      className="w-full bg-slate-900 hover:bg-slate-850 text-slate-300 font-bold text-xs py-2 rounded-xl flex items-center justify-center gap-1.5 border border-slate-800 transition-all"
                    >
                      <Navigation className={`w-3.5 h-3.5 text-brand-400 ${isLocatingHub ? 'animate-spin' : ''}`} />
                      <span>{isLocatingHub ? 'Detecting...' : 'Use My GPS'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleClearHub}
                      disabled={isSavingHub}
                      className="w-full bg-slate-900 hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 font-bold text-xs py-2 rounded-xl flex items-center justify-center gap-1.5 border border-slate-800 hover:border-rose-900 transition-all"
                      title="Clear hub coordinates to test fail-safe mode"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                      <span>Clear (Test Fail-Safe)</span>
                    </button>
                  </div>
                </div>
              </form>

              {/* Haversine Formula Notice */}
              <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
                <div className="font-extrabold text-slate-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-brand-400" />
                  <span>Authoritative Backend Measurement</span>
                </div>
                <p>
                  The delivery radius is measured in a straight line from this hub using the spherical Haversine formula on the backend. It does not rely on browser client state or road navigation networks.
                </p>
              </div>
            </div>

            {/* Right Column: Interactive Map & Live Tester */}
            <div className="lg:col-span-7 space-y-6">
              {/* Map Container */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-3xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-brand-400" />
                      Hub Interactive Map &amp; Geofence Circle
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Click anywhere on the map or drag the pin to set the delivery hub location. The circle outlines the {hubRadius} km boundary.
                    </p>
                  </div>
                  {hubLat !== '' && hubLng !== '' && (
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                      {Number(hubLat).toFixed(4)}, {Number(hubLng).toFixed(4)}
                    </span>
                  )}
                </div>

                <div className="rounded-2xl overflow-hidden border border-slate-800">
                  <InteractiveLocationMap
                    initialCenter={
                      hubLat !== '' && hubLng !== '' && !isNaN(Number(hubLat)) && !isNaN(Number(hubLng))
                        ? [Number(hubLat), Number(hubLng)]
                        : [17.4474, 78.3762]
                    }
                    markerPosition={
                      hubLat !== '' && hubLng !== '' && !isNaN(Number(hubLat)) && !isNaN(Number(hubLng))
                        ? [Number(hubLat), Number(hubLng)]
                        : null
                    }
                    circleRadiusKm={Number(hubRadius) || 5.0}
                    height="380px"
                    showSearchBar={true}
                    showDetectLocationBtn={true}
                    onPositionChange={(lat, lng, details) => {
                      setHubLat(Number(lat.toFixed(6)));
                      setHubLng(Number(lng.toFixed(6)));
                      if (details?.fullAddress) {
                        setHubAddress(details.fullAddress);
                      }
                    }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                  <span>Pin: Hub Coordinates</span>
                  <span>Green Circle: {hubRadius} KM Straight-Line Service Area</span>
                </div>
              </div>

              {/* Live Serviceability Tester Widget */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-3xl p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-brand-400" />
                    <h3 className="text-xs font-black text-white uppercase tracking-wider">
                      Live Backend Serviceability Verification
                    </h3>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    POST /api/delivery/check-serviceability
                  </span>
                </div>

                <p className="text-[11px] text-slate-400">
                  Test any customer coordinate against the live backend endpoint to verify inside/outside zone distance calculation.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                  <div className="sm:col-span-4 space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Customer Lat</label>
                    <input
                      type="text"
                      value={testLat}
                      onChange={(e) => setTestLat(e.target.value)}
                      placeholder="17.4938"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-brand-500"
                    />
                  </div>
                  <div className="sm:col-span-4 space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Customer Lng</label>
                    <input
                      type="text"
                      value={testLng}
                      onChange={(e) => setTestLng(e.target.value)}
                      placeholder="78.3995"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-brand-500"
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <button
                      type="button"
                      onClick={handleTestServiceability}
                      disabled={isTestingCoord}
                      className="w-full bg-slate-900 hover:bg-slate-800 text-brand-400 font-extrabold text-xs py-2 px-3 rounded-xl border border-brand-500/30 transition-all flex items-center justify-center gap-1.5"
                    >
                      <Crosshair className={`w-3.5 h-3.5 ${isTestingCoord ? 'animate-spin' : ''}`} />
                      <span>{isTestingCoord ? 'Checking...' : 'Test Backend'}</span>
                    </button>
                  </div>
                </div>

                {/* Test Result Display */}
                {testResult && (
                  <div
                    className={`mt-3 p-3.5 rounded-2xl border text-xs font-mono transition-all ${
                      testResult.serviceable
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                        : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold pb-1 mb-1 border-b border-current/20">
                      <span className="flex items-center gap-1.5 font-sans font-black text-xs">
                        {testResult.serviceable ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-rose-400" />
                        )}
                        {testResult.serviceable ? 'SERVICEABLE (Inside 5 KM)' : 'NOT SERVICEABLE (Outside Zone)'}
                      </span>
                      <span>{testResult.distanceKm !== undefined ? `${testResult.distanceKm} km away` : 'N/A'}</span>
                    </div>
                    <div className="text-[11px] font-mono opacity-90 break-words">
                      {JSON.stringify(testResult, null, 2)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB: DELIVERY SLOTS & OPERATING HOURS ================= */}
      {activeTab === 'slots' && (
        <div className="space-y-6">
          {/* Header Card */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-3xl p-6 sm:p-7 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-black text-white tracking-tight flex items-center gap-2.5">
                  <Clock className="w-6 h-6 text-emerald-400" />
                  Delivery Time Slots &amp; Store Timings (Real-Time IST)
                </h3>
                <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                  Configure store daily opening/closing hours and order cutoff windows for Express, Morning, and Evening harvest batches. When customers order at night or past cutoff, checkout automatically displays next-day delivery slots.
                </p>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-2xl text-emerald-400 text-xs font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Active IST Timezone (Asia/Kolkata)</span>
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSaveGlobalSettings} className="space-y-6">
            {/* Store Daily Operating Window */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-3xl p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-brand-400" />
                  <h4 className="text-sm font-bold text-white">Daily Store Operating Hours</h4>
                </div>
                <span className="text-[11px] text-slate-400">Controls same-day customer order acceptance</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300">
                    Store Opening Time (Opens At)
                  </label>
                  <input
                    type="time"
                    value={deliverySettings.operating_hours_start || '07:00'}
                    onChange={(e) =>
                      setDeliverySettings((prev) => ({
                        ...prev,
                        operating_hours_start: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700/80 focus:border-brand-500 rounded-xl font-mono text-sm text-white focus:outline-none"
                  />
                  <span className="text-[11px] text-slate-500">
                    Earliest dispatch window begins at this time.
                  </span>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300">
                    Store Closing Time (Closes At)
                  </label>
                  <input
                    type="time"
                    value={deliverySettings.operating_hours_end || '21:30'}
                    onChange={(e) =>
                      setDeliverySettings((prev) => ({
                        ...prev,
                        operating_hours_end: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700/80 focus:border-brand-500 rounded-xl font-mono text-sm text-white focus:outline-none"
                  />
                  <span className="text-[11px] text-slate-500">
                    Store stops same-day fulfillment after closing time.
                  </span>
                </div>
              </div>
            </div>

            {/* 3 Slot Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Express 30 Mins */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-3xl p-6 space-y-4 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={deliverySettings.express_enabled !== false}
                        onChange={(e) =>
                          setDeliverySettings((prev) => ({
                            ...prev,
                            express_enabled: e.target.checked,
                          }))
                        }
                        className="w-4 h-4 rounded text-amber-500 focus:ring-0 accent-amber-500 cursor-pointer"
                      />
                      <span className="text-sm font-bold text-white flex items-center gap-1.5">
                        <Zap className="w-4 h-4 text-amber-400" />
                        Express 30 Mins
                      </span>
                    </label>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                      deliverySettings.express_enabled !== false
                        ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                        : 'bg-slate-800 text-slate-500'
                    }`}>
                      {deliverySettings.express_enabled !== false ? 'ENABLED' : 'DISABLED'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400">
                    Instant harvest priority delivery dispatched in 15–30 minutes via EV fleet.
                  </p>

                  <div className="space-y-3 pt-1">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">
                        Operational Start Time
                      </label>
                      <input
                        type="time"
                        value={deliverySettings.express_start_time || '07:00'}
                        onChange={(e) =>
                          setDeliverySettings((prev) => ({
                            ...prev,
                            express_start_time: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">
                        Operational Night Cutoff
                      </label>
                      <input
                        type="time"
                        value={deliverySettings.express_end_time || '21:00'}
                        onChange={(e) =>
                          setDeliverySettings((prev) => ({
                            ...prev,
                            express_end_time: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white"
                      />
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400">
                      💡 When ordered at night after cutoff, Express shows as &ldquo;Offline at night&rdquo; and disabled.
                    </div>
                  </div>
                </div>
              </div>

              {/* Morning Slot */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-3xl p-6 space-y-4 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={deliverySettings.morning_slot_enabled !== false}
                        onChange={(e) =>
                          setDeliverySettings((prev) => ({
                            ...prev,
                            morning_slot_enabled: e.target.checked,
                          }))
                        }
                        className="w-4 h-4 rounded text-emerald-500 focus:ring-0 accent-emerald-500 cursor-pointer"
                      />
                      <span className="text-sm font-bold text-white">
                        Morning Harvest Batch
                      </span>
                    </label>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                      deliverySettings.morning_slot_enabled !== false
                        ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                        : 'bg-slate-800 text-slate-500'
                    }`}>
                      {deliverySettings.morning_slot_enabled !== false ? 'ENABLED' : 'DISABLED'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400">
                    Dawn fresh harvest batch delivered directly to customers before work.
                  </p>

                  <div className="space-y-3 pt-1">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1">
                          Slot From
                        </label>
                        <input
                          type="time"
                          value={deliverySettings.morning_slot_start || '07:00'}
                          onChange={(e) =>
                            setDeliverySettings((prev) => ({
                              ...prev,
                              morning_slot_start: e.target.value,
                            }))
                          }
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1">
                          Slot To
                        </label>
                        <input
                          type="time"
                          value={deliverySettings.morning_slot_end || '09:00'}
                          onChange={(e) =>
                            setDeliverySettings((prev) => ({
                              ...prev,
                              morning_slot_end: e.target.value,
                            }))
                          }
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">
                        Same-Day Order Cutoff Time
                      </label>
                      <input
                        type="time"
                        value={deliverySettings.morning_slot_cutoff || '08:30'}
                        onChange={(e) =>
                          setDeliverySettings((prev) => ({
                            ...prev,
                            morning_slot_cutoff: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white"
                      />
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400">
                      💡 After cutoff, automatically rolls over to &ldquo;Tomorrow Morning&rdquo; at checkout.
                    </div>
                  </div>
                </div>
              </div>

              {/* Evening Slot */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-3xl p-6 space-y-4 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={deliverySettings.evening_slot_enabled !== false}
                        onChange={(e) =>
                          setDeliverySettings((prev) => ({
                            ...prev,
                            evening_slot_enabled: e.target.checked,
                          }))
                        }
                        className="w-4 h-4 rounded text-blue-500 focus:ring-0 accent-blue-500 cursor-pointer"
                      />
                      <span className="text-sm font-bold text-white">
                        Evening Harvest Batch
                      </span>
                    </label>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                      deliverySettings.evening_slot_enabled !== false
                        ? 'bg-blue-500/10 text-blue-300 border border-blue-500/20'
                        : 'bg-slate-800 text-slate-500'
                    }`}>
                      {deliverySettings.evening_slot_enabled !== false ? 'ENABLED' : 'DISABLED'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400">
                    Afternoon batch harvested fresh for post-work dinner preparation.
                  </p>

                  <div className="space-y-3 pt-1">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1">
                          Slot From
                        </label>
                        <input
                          type="time"
                          value={deliverySettings.evening_slot_start || '17:00'}
                          onChange={(e) =>
                            setDeliverySettings((prev) => ({
                              ...prev,
                              evening_slot_start: e.target.value,
                            }))
                          }
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1">
                          Slot To
                        </label>
                        <input
                          type="time"
                          value={deliverySettings.evening_slot_end || '19:00'}
                          onChange={(e) =>
                            setDeliverySettings((prev) => ({
                              ...prev,
                              evening_slot_end: e.target.value,
                            }))
                          }
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">
                        Same-Day Order Cutoff Time
                      </label>
                      <input
                        type="time"
                        value={deliverySettings.evening_slot_cutoff || '18:30'}
                        onChange={(e) =>
                          setDeliverySettings((prev) => ({
                            ...prev,
                            evening_slot_cutoff: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white"
                      />
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400">
                      💡 After cutoff, automatically rolls over to &ldquo;Tomorrow Evening&rdquo; at checkout.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Live Checkout Preview Card */}
            <div className="bg-slate-950/90 border border-slate-800 rounded-3xl p-6 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Live Customer Checkout Preview (Right Now in IST)
                </span>
                <span className="text-[11px] text-slate-500">
                  Calculated dynamically from current IST minute
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {liveSlotsPreview.map((s) => (
                  <div
                    key={s.id}
                    className={`p-3.5 rounded-2xl border ${
                      s.available
                        ? 'bg-slate-900/80 border-slate-700 text-white'
                        : 'bg-slate-950 border-slate-800/80 text-slate-500 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold">{s.title}</span>
                      {s.tag && (
                        <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${s.badgeColor}`}>
                          {s.tag}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400 block">{s.sub}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Submit Bar */}
            <div className="flex items-center justify-between gap-4 pt-2">
              <span className="text-xs text-slate-400 flex items-center gap-1.5">
                <Info className="w-4 h-4 text-brand-400 shrink-0" />
                Changes are saved directly to database and sync to customer checkouts instantly.
              </span>
              <div className="flex items-center gap-3">
                {isDirty && (
                  <button
                    type="button"
                    onClick={handleResetSettings}
                    className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-bold transition-all border border-slate-800"
                  >
                    Discard Changes
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isSavingSettings}
                  className={`text-slate-950 font-black text-xs px-6 py-3 rounded-2xl flex items-center gap-2 shadow-xl transition-all disabled:opacity-50 ${
                    isDirty
                      ? 'bg-brand-500 hover:bg-brand-400 shadow-brand-500/30 ring-2 ring-brand-400 animate-pulse'
                      : 'bg-brand-500 hover:bg-brand-400 shadow-brand-500/20'
                  }`}
                >
                  <Save className="w-4 h-4" />
                  <span>{isSavingSettings ? 'Saving...' : 'Save Slots & Timings'}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ================= TAB 1: GLOBAL STORE DELIVERY CHARGES ================= */}
      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Delivery Pricing Form */}
          <div className="lg:col-span-2 bg-slate-950/80 border border-slate-800 rounded-3xl p-6 sm:p-7 space-y-6">
            <div className="flex items-start justify-between border-b border-slate-800/80 pb-4">
              <div>
                <h3 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                  <Truck className="w-5 h-5 text-brand-400" />
                  Store-wide Delivery Pricing Policy
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  These delivery charges apply to all vegetable orders placed across the store, cart drawer, and checkout.
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-brand-400 bg-brand-500/10 px-2.5 py-1 rounded-full border border-brand-500/20">
                <ShieldCheck className="w-3.5 h-3.5" />
                Live Enforced
              </div>
            </div>

            <form onSubmit={handleSaveGlobalSettings} className="space-y-5">
              {/* Charge & Threshold Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300">
                    Standard Base Delivery Fee (₹)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-500 text-sm">₹</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      required
                      value={deliverySettings.default_delivery_charge}
                      onChange={(e) =>
                        setDeliverySettings((prev) => ({
                          ...prev,
                          default_delivery_charge: Number(e.target.value),
                        }))
                      }
                      className="w-full pl-8 pr-4 py-2.5 bg-slate-900 border border-slate-700/80 focus:border-brand-500 rounded-xl font-mono text-sm text-white focus:outline-none"
                    />
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Default fee charged when order total is below free delivery threshold.
                  </span>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300">
                    Free Delivery Order Threshold (₹)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-500 text-sm">₹</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      required
                      value={deliverySettings.free_delivery_threshold}
                      onChange={(e) =>
                        setDeliverySettings((prev) => ({
                          ...prev,
                          free_delivery_threshold: Number(e.target.value),
                        }))
                      }
                      className="w-full pl-8 pr-4 py-2.5 bg-slate-900 border border-slate-700/80 focus:border-emerald-500 rounded-xl font-mono text-sm text-white focus:outline-none"
                    />
                  </div>
                  <span className="text-[11px] text-emerald-400 font-medium">
                    Orders with subtotal at or above this amount automatically get ₹0 delivery!
                  </span>
                </div>
              </div>

              {/* Min Order & Speed ETA Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300">
                    Minimum Order Subtotal (₹)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-500 text-sm">₹</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      required
                      value={deliverySettings.min_order_amount}
                      onChange={(e) =>
                        setDeliverySettings((prev) => ({
                          ...prev,
                          min_order_amount: Number(e.target.value),
                        }))
                      }
                      className="w-full pl-8 pr-4 py-2.5 bg-slate-900 border border-slate-700/80 focus:border-brand-500 rounded-xl font-mono text-sm text-white focus:outline-none"
                    />
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Customers cannot place an order below this amount.
                  </span>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300">
                    Estimated Speed ETA Window
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      placeholder="e.g. 25–35 mins"
                      value={deliverySettings.estimated_delivery_time}
                      onChange={(e) =>
                        setDeliverySettings((prev) => ({
                          ...prev,
                          estimated_delivery_time: e.target.value,
                        }))
                      }
                      className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700/80 focus:border-brand-500 rounded-xl text-sm text-white focus:outline-none"
                    />
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Customer ETA displayed on product and tracking pages.
                  </span>
                </div>
              </div>

              {/* Express & Surge Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300">
                    Express Dispatch Fee (₹)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-500 text-sm">₹</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={deliverySettings.express_delivery_fee}
                      onChange={(e) =>
                        setDeliverySettings((prev) => ({
                          ...prev,
                          express_delivery_fee: Number(e.target.value),
                        }))
                      }
                      className="w-full pl-8 pr-4 py-2.5 bg-slate-900 border border-slate-700/80 focus:border-brand-500 rounded-xl font-mono text-sm text-white focus:outline-none"
                    />
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Priority EV express slot fee.
                  </span>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <span>Peak Surge / Rain Surcharge (₹)</span>
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-500 text-sm">₹</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={deliverySettings.surge_charge}
                      onChange={(e) =>
                        setDeliverySettings((prev) => ({
                          ...prev,
                          surge_charge: Number(e.target.value),
                        }))
                      }
                      className="w-full pl-8 pr-4 py-2.5 bg-slate-900 border border-slate-700/80 focus:border-amber-500 rounded-xl font-mono text-sm text-white focus:outline-none"
                    />
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Temporary weather or peak hour surcharge (set 0 for normal).
                  </span>
                </div>
              </div>

              {/* Toggles */}
              <div className="pt-3 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 cursor-pointer hover:bg-slate-900 transition-all">
                  <input
                    type="checkbox"
                    checked={deliverySettings.enable_free_delivery}
                    onChange={(e) =>
                      setDeliverySettings((prev) => ({
                        ...prev,
                        enable_free_delivery: e.target.checked,
                      }))
                    }
                    className="w-4 h-4 rounded text-brand-500 focus:ring-0 accent-brand-500 cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-bold text-white block">
                      Enable Free Delivery Threshold
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Give customers ₹0 delivery when cart ≥ ₹{deliverySettings.free_delivery_threshold}
                    </span>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 cursor-pointer hover:bg-slate-900 transition-all">
                  <input
                    type="checkbox"
                    checked={deliverySettings.is_delivery_active}
                    onChange={(e) =>
                      setDeliverySettings((prev) => ({
                        ...prev,
                        is_delivery_active: e.target.checked,
                      }))
                    }
                    className="w-4 h-4 rounded text-brand-500 focus:ring-0 accent-brand-500 cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-bold text-white block">
                      Delivery Operations Active
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Toggle store dispatch acceptance on or off
                    </span>
                  </div>
                </label>
              </div>

              {/* Delivery Time Slots & Operating Hours */}
              <div className="pt-6 border-t border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <Clock className="w-4 h-4 text-emerald-400" />
                      Delivery Slots & Operating Hours (Real-Time IST)
                    </h4>
                    <p className="text-xs text-slate-400">
                      Configure operating windows and order cutoff times. Customers ordering at night or past cutoff will automatically see next-day slots.
                    </p>
                  </div>
                </div>

                {/* Operating Hours */}
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200">Store Daily Operating Window</span>
                    <span className="text-[11px] text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20 font-medium">
                      IST (Asia/Kolkata)
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                        Opens At (Start Time)
                      </label>
                      <input
                        type="time"
                        value={deliverySettings.operating_hours_start || '07:00'}
                        onChange={(e) =>
                          setDeliverySettings((prev) => ({
                            ...prev,
                            operating_hours_start: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700/80 focus:border-brand-500 rounded-xl text-xs text-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                        Closes At (End Time)
                      </label>
                      <input
                        type="time"
                        value={deliverySettings.operating_hours_end || '21:30'}
                        onChange={(e) =>
                          setDeliverySettings((prev) => ({
                            ...prev,
                            operating_hours_end: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700/80 focus:border-brand-500 rounded-xl text-xs text-white focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* 3 Slot Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Express 30 Mins Slot */}
                  <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={deliverySettings.express_enabled !== false}
                          onChange={(e) =>
                            setDeliverySettings((prev) => ({
                              ...prev,
                              express_enabled: e.target.checked,
                            }))
                          }
                          className="w-3.5 h-3.5 rounded text-brand-500 accent-brand-500 cursor-pointer"
                        />
                        <span className="text-xs font-bold text-white flex items-center gap-1">
                          <Zap className="w-3 h-3 text-amber-400" />
                          Express 30 Mins
                        </span>
                      </label>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        deliverySettings.express_enabled !== false
                          ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                          : 'bg-slate-800 text-slate-500'
                      }`}>
                        {deliverySettings.express_enabled !== false ? 'Active' : 'Disabled'}
                      </span>
                    </div>

                    <div className="space-y-2 pt-1">
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">Active From</label>
                        <input
                          type="time"
                          value={deliverySettings.express_start_time || '07:00'}
                          onChange={(e) =>
                            setDeliverySettings((prev) => ({
                              ...prev,
                              express_start_time: e.target.value,
                            }))
                          }
                          className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700/80 rounded-lg text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">Active Until (Night Cutoff)</label>
                        <input
                          type="time"
                          value={deliverySettings.express_end_time || '21:00'}
                          onChange={(e) =>
                            setDeliverySettings((prev) => ({
                              ...prev,
                              express_end_time: e.target.value,
                            }))
                          }
                          className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700/80 rounded-lg text-xs text-white"
                        />
                      </div>
                      <p className="text-[10px] text-slate-500 leading-tight">
                        Past cutoff, shows as "Offline at night" and disables instant dispatch.
                      </p>
                    </div>
                  </div>

                  {/* Morning Slot */}
                  <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={deliverySettings.morning_slot_enabled !== false}
                          onChange={(e) =>
                            setDeliverySettings((prev) => ({
                              ...prev,
                              morning_slot_enabled: e.target.checked,
                            }))
                          }
                          className="w-3.5 h-3.5 rounded text-brand-500 accent-brand-500 cursor-pointer"
                        />
                        <span className="text-xs font-bold text-white">
                          Morning Batch
                        </span>
                      </label>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        deliverySettings.morning_slot_enabled !== false
                          ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                          : 'bg-slate-800 text-slate-500'
                      }`}>
                        {deliverySettings.morning_slot_enabled !== false ? 'Active' : 'Disabled'}
                      </span>
                    </div>

                    <div className="space-y-2 pt-1">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1">Slot From</label>
                          <input
                            type="time"
                            value={deliverySettings.morning_slot_start || '07:00'}
                            onChange={(e) =>
                              setDeliverySettings((prev) => ({
                                ...prev,
                                morning_slot_start: e.target.value,
                              }))
                            }
                            className="w-full px-2 py-1.5 bg-slate-950 border border-slate-700/80 rounded-lg text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1">Slot To</label>
                          <input
                            type="time"
                            value={deliverySettings.morning_slot_end || '09:00'}
                            onChange={(e) =>
                              setDeliverySettings((prev) => ({
                                ...prev,
                                morning_slot_end: e.target.value,
                              }))
                            }
                            className="w-full px-2 py-1.5 bg-slate-950 border border-slate-700/80 rounded-lg text-xs text-white"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">Order Cutoff Time</label>
                        <input
                          type="time"
                          value={deliverySettings.morning_slot_cutoff || '08:30'}
                          onChange={(e) =>
                            setDeliverySettings((prev) => ({
                              ...prev,
                              morning_slot_cutoff: e.target.value,
                            }))
                          }
                          className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700/80 rounded-lg text-xs text-white"
                        />
                      </div>
                      <p className="text-[10px] text-slate-500 leading-tight">
                        After cutoff, automatically advances to "Tomorrow Morning".
                      </p>
                    </div>
                  </div>

                  {/* Evening Slot */}
                  <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={deliverySettings.evening_slot_enabled !== false}
                          onChange={(e) =>
                            setDeliverySettings((prev) => ({
                              ...prev,
                              evening_slot_enabled: e.target.checked,
                            }))
                          }
                          className="w-3.5 h-3.5 rounded text-brand-500 accent-brand-500 cursor-pointer"
                        />
                        <span className="text-xs font-bold text-white">
                          Evening Batch
                        </span>
                      </label>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        deliverySettings.evening_slot_enabled !== false
                          ? 'bg-blue-500/10 text-blue-300 border border-blue-500/20'
                          : 'bg-slate-800 text-slate-500'
                      }`}>
                        {deliverySettings.evening_slot_enabled !== false ? 'Active' : 'Disabled'}
                      </span>
                    </div>

                    <div className="space-y-2 pt-1">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1">Slot From</label>
                          <input
                            type="time"
                            value={deliverySettings.evening_slot_start || '17:00'}
                            onChange={(e) =>
                              setDeliverySettings((prev) => ({
                                ...prev,
                                evening_slot_start: e.target.value,
                              }))
                            }
                            className="w-full px-2 py-1.5 bg-slate-950 border border-slate-700/80 rounded-lg text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1">Slot To</label>
                          <input
                            type="time"
                            value={deliverySettings.evening_slot_end || '19:00'}
                            onChange={(e) =>
                              setDeliverySettings((prev) => ({
                                ...prev,
                                evening_slot_end: e.target.value,
                              }))
                            }
                            className="w-full px-2 py-1.5 bg-slate-950 border border-slate-700/80 rounded-lg text-xs text-white"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">Order Cutoff Time</label>
                        <input
                          type="time"
                          value={deliverySettings.evening_slot_cutoff || '18:30'}
                          onChange={(e) =>
                            setDeliverySettings((prev) => ({
                              ...prev,
                              evening_slot_cutoff: e.target.value,
                            }))
                          }
                          className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700/80 rounded-lg text-xs text-white"
                        />
                      </div>
                      <p className="text-[10px] text-slate-500 leading-tight">
                        After cutoff, automatically advances to "Tomorrow Evening".
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-brand-400 shrink-0" />
                  Saves directly to database and updates all online customer checkouts immediately.
                </span>

                <div className="flex items-center gap-3 self-end sm:self-auto">
                  {isDirty && (
                    <button
                      type="button"
                      onClick={handleResetSettings}
                      className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-bold transition-all border border-slate-800 cursor-pointer"
                    >
                      Discard Changes
                    </button>
                  )}

                  <button
                    type="submit"
                    disabled={isSavingSettings}
                    className={`text-slate-950 font-black text-xs px-6 py-3 rounded-2xl flex items-center gap-2 shadow-xl transition-all disabled:opacity-50 cursor-pointer ${
                      isDirty
                        ? 'bg-brand-500 hover:bg-brand-400 shadow-brand-500/30 ring-2 ring-brand-400 animate-pulse'
                        : 'bg-brand-500 hover:bg-brand-400 shadow-brand-500/20'
                    }`}
                  >
                    <Save className="w-4 h-4" />
                    <span>{isSavingSettings ? 'Saving Charges...' : isDirty ? 'Save Delivery Charges *' : 'Save Delivery Charges'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Interactive Live Checkout Simulator */}
          <div className="space-y-4">
            <div className="bg-slate-950/80 border border-slate-800 rounded-3xl p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></div>
                  <h4 className="text-sm font-extrabold text-white">Live Customer Simulator</h4>
                </div>
                <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-900 px-2 py-0.5 rounded">
                  Real-time Preview
                </span>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 flex justify-between">
                  <span>Simulated Cart Subtotal</span>
                  <span className="font-mono text-brand-400 font-extrabold">₹{simCartAmount}</span>
                </label>
                <input
                  type="range"
                  min="50"
                  max="1000"
                  step="25"
                  value={simCartAmount}
                  onChange={(e) => setSimCartAmount(Number(e.target.value))}
                  className="w-full accent-brand-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>₹50</span>
                  <span>₹250</span>
                  <span>₹500</span>
                  <span>₹750</span>
                  <span>₹1000</span>
                </div>
              </div>

              {/* Progress to Free Delivery Bar */}
              {deliverySettings.enable_free_delivery && (
                <div className="bg-slate-900 p-3.5 rounded-2xl border border-slate-800/80 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300 font-bold flex items-center gap-1.5">
                      <Gift className="w-3.5 h-3.5 text-emerald-400" />
                      Free Delivery Goal
                    </span>
                    <span className={simIsFree ? 'text-emerald-400 font-extrabold' : 'text-slate-400 font-bold'}>
                      {simIsFree ? 'Unlocked!' : `Add ₹${simShortOfFree} more`}
                    </span>
                  </div>
                  <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-brand-500 to-emerald-400 transition-all duration-300"
                      style={{
                        width: `${Math.min(100, (simCartAmount / deliverySettings.free_delivery_threshold) * 100)}%`,
                      }}
                    ></div>
                  </div>
                </div>
              )}

              {/* Simulated Customer Receipt */}
              <div className="bg-slate-900/90 rounded-2xl p-4 border border-slate-800 space-y-2.5 text-xs">
                <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 pb-1 border-b border-slate-800">
                  Customer Receipt Breakdown
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Produce Subtotal</span>
                  <span className="font-mono">₹{simCartAmount}</span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span>Delivery Charge</span>
                  <span>
                    {simIsFree ? (
                      <span className="bg-emerald-500/20 text-emerald-400 font-black text-[10px] px-2 py-0.5 rounded-full border border-emerald-500/30">
                        FREE
                      </span>
                    ) : (
                      <span className="font-mono text-brand-400 font-bold">
                        ₹{simDeliveryCharge}
                      </span>
                    )}
                  </span>
                </div>

                {deliverySettings.surge_charge > 0 && !simIsFree && (
                  <div className="flex justify-between text-[11px] text-amber-400">
                    <span>Includes Peak Surge</span>
                    <span className="font-mono">+₹{deliverySettings.surge_charge}</span>
                  </div>
                )}

                <div className="flex justify-between font-black text-sm text-white pt-2 border-t border-slate-800">
                  <span>Customer Pays</span>
                  <span className="font-mono text-brand-400 text-base">₹{simTotal}</span>
                </div>
              </div>

              {/* Status Notice */}
              {simShortOfMin > 0 ? (
                <div className="bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl text-rose-300 text-xs flex items-center gap-2 font-medium">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>Subtotal is below Minimum Order of ₹{deliverySettings.min_order_amount}.</span>
                </div>
              ) : (
                <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl text-emerald-300 text-xs flex items-center gap-2 font-medium">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Valid order! Estimated delivery: {deliverySettings.estimated_delivery_time}</span>
                </div>
              )}
            </div>

            {/* Quick Helper Note */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 text-xs text-slate-400 space-y-1.5">
              <span className="font-bold text-white block">Zone-Specific Overrides:</span>
              <p className="text-[11px] leading-relaxed">
                If an order&apos;s delivery address matches a custom Zone in Tab 2 (e.g. Kukatpally or Hitech City), the zone&apos;s custom delivery fee takes precedence for that pincode!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 2: ZONES & PINCODES ================= */}
      {activeTab === 'zones' && (
        <div className="bg-slate-950/70 border border-slate-800 rounded-3xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-extrabold text-sm text-white">Active Delivery Zones &amp; Custom Fees</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Each zone overrides the default store delivery fee for its specific list of covered pincodes.
              </p>
            </div>
            <button
              onClick={openCreate}
              className="bg-brand-500 hover:bg-brand-400 text-slate-950 font-extrabold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 self-start sm:self-auto shadow-md"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Custom Zone</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2.5 px-3">Zone Name</th>
                  <th className="py-2.5 px-3">Covered Pincodes</th>
                  <th className="py-2.5 px-3">Delivery Fee</th>
                  <th className="py-2.5 px-3">Min Order</th>
                  <th className="py-2.5 px-3">Free Delivery At</th>
                  <th className="py-2.5 px-3">Speed ETA</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {zones.map((zone) => (
                  <tr key={zone.id} className="hover:bg-slate-900/50">
                    <td className="py-3 px-3 font-bold text-white text-sm">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-brand-400 shrink-0" />
                        <div>
                          <span>{zone.name}</span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] text-brand-400 bg-brand-500/10 border border-brand-500/20 px-1.5 py-0.2 rounded font-mono">
                              {zone.latitude ? `${Number(zone.latitude).toFixed(3)}, ${Number(zone.longitude).toFixed(3)}` : '17.493, 78.399'}
                            </span>
                            <span className="text-[10px] text-slate-400 font-semibold">
                              {zone.delivery_radius_km || 8.5} km coverage
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {zone.pincodes.map((pin) => (
                          <span
                            key={pin}
                            className="bg-slate-900 text-slate-300 font-mono px-1.5 py-0.5 rounded text-[10px] border border-slate-800"
                          >
                            {pin}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-3 font-black text-brand-400">₹{zone.delivery_fee}</td>
                    <td className="py-3 px-3 text-slate-300 font-mono">₹{zone.min_order_amount}</td>
                    <td className="py-3 px-3 font-bold text-emerald-400 font-mono">₹{zone.free_delivery_threshold}+</td>
                    <td className="py-3 px-3 text-slate-400">{zone.estimated_delivery_time}</td>
                    <td className="py-3 px-3 text-right space-x-2">
                      <button
                        onClick={() => openEdit(zone)}
                        className="p-1.5 rounded-lg bg-slate-900 text-slate-400 hover:text-white transition-colors"
                        title="Edit Zone"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteZone(zone.id)}
                        className="p-1.5 rounded-lg bg-slate-900 text-slate-400 hover:text-rose-400 transition-colors"
                        title="Delete Zone"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= TAB 3: EXPRESS STORES ================= */}
      {activeTab === 'stores' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {stores.map((st) => (
              <div key={st.id} className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-brand-400 flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5" /> Express Store Hub
                  </span>
                  <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-bold">
                    {st.status}
                  </span>
                </div>
                <h4 className="text-base font-extrabold text-white">{st.name}</h4>
                <p className="text-xs text-slate-400">{st.address}</p>
                <p className="text-[11px] text-slate-500">Phone: {st.phone} • Email: {st.email}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Zone Edit/Create Modal with Interactive Hyderabad Geofence Map */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md animate-fade-in overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 text-white w-full max-w-5xl rounded-3xl p-5 sm:p-7 shadow-2xl space-y-4 my-auto max-h-[92vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-3.5 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-brand-500/15 border border-brand-500/30 flex items-center justify-center text-brand-400 shrink-0">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-lg tracking-tight flex items-center gap-2">
                    <span>{editingZone ? 'Edit Delivery Zone & Map Geofence' : 'Create Custom Delivery Zone with Live Map'}</span>
                    <span className="text-[11px] bg-brand-500/20 text-brand-400 px-2.5 py-0.5 rounded-full font-bold border border-brand-500/30">
                      Hyderabad Coverage
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Select the exact colony, area, or landmark on the map. Adjust coverage radius and order economics.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content Scrollable Area */}
            <div className="overflow-y-auto pr-1 flex-1 space-y-4">
              {/* Quick Select Popular Hyderabad Colony Hubs */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
                  <span className="flex items-center gap-1.5 uppercase tracking-wider text-[10px] text-brand-400 font-black">
                    <Sparkles className="w-3.5 h-3.5" /> Popular Colony Hub Presets
                  </span>
                  <span className="text-slate-500 text-[10.5px]">Click any colony to jump pin &amp; pre-fill</span>
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                  {HYDERABAD_ZONE_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => handleSelectPreset(preset)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border flex items-center gap-1.5 shrink-0 cursor-pointer ${
                        Math.abs(zoneLat - preset.lat) < 0.005 && Math.abs(zoneLng - preset.lng) < 0.005
                          ? 'bg-brand-500 text-slate-950 border-brand-400 font-extrabold shadow-md shadow-brand-500/20'
                          : 'bg-slate-950/70 text-slate-300 border-slate-800 hover:border-brand-500/40 hover:text-white'
                      }`}
                    >
                      <MapPin className="w-3 h-3" />
                      <span>{preset.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Main 2-Column Split: Map on Left, Zone Parameters on Right */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* ── LEFT COLUMN: Interactive Map & Geofence (7 cols) ── */}
                <div className="lg:col-span-7 space-y-3 flex flex-col">
                  {/* Interactive Leaflet Map */}
                  <div className="relative">
                    <InteractiveLocationMap
                      height="290px"
                      initialCenter={[zoneLat, zoneLng]}
                      markerPosition={[zoneLat, zoneLng]}
                      circleRadiusKm={zoneRadius}
                      onPositionChange={handleMapPositionChange}
                      placeholder="Search Hyderabad colony, street, area..."
                      showSearchBar={true}
                      showDetectLocationBtn={true}
                    />
                  </div>

                  {/* Geofence Delivery Radius Slider */}
                  <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Crosshair className="w-3.5 h-3.5 text-brand-400" />
                        <span>Coverage Radius:</span>
                        <span className="text-brand-400 font-black font-mono text-sm">{zoneRadius} km</span>
                      </label>
                      <span className="text-[10px] text-slate-400 font-mono">
                        Diameter: {(zoneRadius * 2).toFixed(1)} km
                      </span>
                    </div>

                    <input
                      type="range"
                      min="1"
                      max="30"
                      step="0.5"
                      value={zoneRadius}
                      onChange={(e) => setZoneRadius(Number(e.target.value))}
                      className="w-full accent-emerald-400 cursor-pointer h-2 bg-slate-800 rounded-lg appearance-none"
                    />

                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <button
                        type="button"
                        onClick={() => setZoneRadius(3.5)}
                        className={`hover:text-brand-400 cursor-pointer ${zoneRadius === 3.5 ? 'text-brand-400 font-bold' : ''}`}
                      >
                        3.5 km
                      </button>
                      <button
                        type="button"
                        onClick={() => setZoneRadius(5)}
                        className={`hover:text-brand-400 cursor-pointer ${zoneRadius === 5 ? 'text-brand-400 font-bold' : ''}`}
                      >
                        5 km
                      </button>
                      <button
                        type="button"
                        onClick={() => setZoneRadius(8.5)}
                        className={`hover:text-brand-400 cursor-pointer ${zoneRadius === 8.5 ? 'text-brand-400 font-bold' : ''}`}
                      >
                        8.5 km (Standard)
                      </button>
                      <button
                        type="button"
                        onClick={() => setZoneRadius(15)}
                        className={`hover:text-brand-400 cursor-pointer ${zoneRadius === 15 ? 'text-brand-400 font-bold' : ''}`}
                      >
                        15 km
                      </button>
                      <button
                        type="button"
                        onClick={() => setZoneRadius(25)}
                        className={`hover:text-brand-400 cursor-pointer ${zoneRadius === 25 ? 'text-brand-400 font-bold' : ''}`}
                      >
                        25 km (Regional)
                      </button>
                    </div>
                  </div>

                  {/* Selected Colony / Center Coordinates Banner */}
                  <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-2xl flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0 flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-brand-500/10 text-brand-400 border border-brand-500/20 flex items-center justify-center shrink-0">
                        <Compass className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase font-black tracking-wider text-slate-400">Epicenter Location</p>
                        <p className="text-white font-bold truncate text-xs">{detectedAddress}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] text-slate-500 font-mono">GPS Coordinates</p>
                      <p className="text-[11px] font-mono font-bold text-brand-400">
                        {zoneLat.toFixed(6)}, {zoneLng.toFixed(6)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* ── RIGHT COLUMN: Zone Form & Financials (5 cols) ── */}
                <form id="zone-form" onSubmit={handleSaveZone} className="lg:col-span-5 space-y-3">
                  <div className="space-y-3 text-xs">
                    <div>
                      <div className="flex items-center justify-between mb-1 gap-2">
                        <label className="text-slate-300 font-bold">Zone Name</label>
                        {detectedColony && (
                          <button
                            type="button"
                            onClick={() => setName(`${detectedColony} & Surrounding Zone`)}
                            className="text-[10px] text-brand-400 hover:text-brand-300 font-bold bg-brand-500/10 border border-brand-500/30 px-2 py-0.5 rounded cursor-pointer"
                            title="Click to apply detected location name"
                          >
                            Use "{detectedColony}"
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Kukatpally & KPHB Zone"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white font-medium focus:outline-none focus:border-brand-500"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-bold mb-1">
                        Covered Pincodes (comma separated)
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="500072, 500085, 500090"
                        value={pincodes}
                        onChange={(e) => setPincodes(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 font-mono text-white focus:outline-none focus:border-brand-500"
                      />
                      <p className="text-[10.5px] text-slate-500 mt-1">
                        Pincodes mapped to this zone for address lookup &amp; dispatch.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-300 font-bold mb-1">Zone Delivery Fee (₹)</label>
                        <input
                          type="number"
                          required
                          min="0"
                          value={fee}
                          onChange={(e) => setFee(Number(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-brand-500"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-300 font-bold mb-1">Minimum Order (₹)</label>
                        <input
                          type="number"
                          required
                          min="0"
                          value={minOrder}
                          onChange={(e) => setMinOrder(Number(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-brand-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-300 font-bold mb-1">Free Delivery At (₹)</label>
                        <input
                          type="number"
                          required
                          min="0"
                          value={freeThreshold}
                          onChange={(e) => setFreeThreshold(Number(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-brand-500"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-300 font-bold mb-1">Speed ETA</label>
                        <input
                          type="text"
                          required
                          value={eta}
                          onChange={(e) => setEta(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-brand-500"
                        />
                      </div>
                    </div>

                    {/* Operational Summary Card */}
                    <div className="p-3 bg-brand-500/10 border border-brand-500/20 rounded-2xl space-y-1 text-[11px] text-slate-300">
                      <p className="font-bold text-brand-300 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Zone Economics Summary
                      </p>
                      <p className="text-slate-400">
                        • Flat fee: <strong className="text-white">₹{fee}</strong> (Free on orders ≥ <strong className="text-emerald-400">₹{freeThreshold}</strong>)
                      </p>
                      <p className="text-slate-400">
                        • Min cart: <strong className="text-white">₹{minOrder}</strong> • Promise: <strong className="text-white">{eta}</strong>
                      </p>
                      <p className="text-slate-400">
                        • Coverage: <strong className="text-white">{zoneRadius} km</strong> radius from epicenter
                      </p>
                    </div>
                  </div>
                </form>
              </div>
            </div>

            {/* Fixed Modal Footer - Always in View */}
            <div className="pt-3 border-t border-slate-800 shrink-0 flex items-center justify-between gap-3 bg-slate-900">
              <div className="text-xs text-slate-400 truncate hidden sm:block">
                <span>Epicenter: <strong className="text-white">{detectedColony || 'Selected Colony'}</strong></span>
                <span className="mx-2">•</span>
                <span>Radius: <strong className="text-emerald-400 font-mono">{zoneRadius} km</strong></span>
              </div>
              <div className="flex items-center gap-2.5 ml-auto">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="zone-form"
                  className="px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-black text-xs cursor-pointer shadow-lg shadow-brand-500/25 flex items-center gap-1.5 transition-all"
                >
                  <Save className="w-4 h-4" />
                  <span>{editingZone ? 'Save Changes' : 'Create Delivery Zone'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
