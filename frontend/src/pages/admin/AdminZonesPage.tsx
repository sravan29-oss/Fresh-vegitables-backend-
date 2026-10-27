import React, { useEffect, useState } from 'react';
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
} from 'lucide-react';
import api from '../../services/api';
import { DeliveryZone, Store, DeliverySettings } from '../../types';
import { useCart } from '../../context/CartContext';

export const AdminZonesPage: React.FC = () => {
  const { fetchDeliverySettings: syncCartDeliverySettings } = useCart();

  // Active Tab
  const [activeTab, setActiveTab] = useState<'settings' | 'zones' | 'stores'>('settings');

  // Delivery Zones & Stores State
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<DeliveryZone | null>(null);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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

  // String-based input states so typing and backspacing are silky smooth
  const [chargeInput, setChargeInput] = useState<string>(() => String(deliverySettings.default_delivery_charge));
  const [thresholdInput, setThresholdInput] = useState<string>(() => String(deliverySettings.free_delivery_threshold));
  const [minOrderInput, setMinOrderInput] = useState<string>(() => String(deliverySettings.min_order_amount));
  const [expressFeeInput, setExpressFeeInput] = useState<string>(() => String(deliverySettings.express_delivery_fee));
  const [surgeInput, setSurgeInput] = useState<string>(() => String(deliverySettings.surge_charge || 0));
  const [etaInput, setEtaInput] = useState<string>(() => deliverySettings.estimated_delivery_time || '25–35 mins');
  const [enableFreeDelivery, setEnableFreeDelivery] = useState<boolean>(() => deliverySettings.enable_free_delivery !== false);
  const [isDeliveryActive, setIsDeliveryActive] = useState<boolean>(() => deliverySettings.is_delivery_active !== false);

  // Dynamic effective values for calculations & live simulation
  const effectiveCharge = chargeInput === '' ? 0 : Math.max(0, Number(chargeInput));
  const effectiveThreshold = thresholdInput === '' ? 0 : Math.max(0, Number(thresholdInput));
  const effectiveMinOrder = minOrderInput === '' ? 0 : Math.max(0, Number(minOrderInput));
  const effectiveExpressFee = expressFeeInput === '' ? 0 : Math.max(0, Number(expressFeeInput));
  const effectiveSurge = surgeInput === '' ? 0 : Math.max(0, Number(surgeInput));

  // Determine if draft inputs have unsaved changes
  const isDirty =
    chargeInput !== String(deliverySettings.default_delivery_charge) ||
    thresholdInput !== String(deliverySettings.free_delivery_threshold) ||
    minOrderInput !== String(deliverySettings.min_order_amount) ||
    expressFeeInput !== String(deliverySettings.express_delivery_fee) ||
    surgeInput !== String(deliverySettings.surge_charge || 0) ||
    etaInput.trim() !== String(deliverySettings.estimated_delivery_time || '').trim() ||
    enableFreeDelivery !== deliverySettings.enable_free_delivery ||
    isDeliveryActive !== deliverySettings.is_delivery_active;

  const handleResetSettings = () => {
    setChargeInput(String(deliverySettings.default_delivery_charge));
    setThresholdInput(String(deliverySettings.free_delivery_threshold));
    setMinOrderInput(String(deliverySettings.min_order_amount));
    setExpressFeeInput(String(deliverySettings.express_delivery_fee));
    setSurgeInput(String(deliverySettings.surge_charge || 0));
    setEtaInput(deliverySettings.estimated_delivery_time || '25–35 mins');
    setEnableFreeDelivery(deliverySettings.enable_free_delivery !== false);
    setIsDeliveryActive(deliverySettings.is_delivery_active !== false);
  };

  // Simulator State
  const [simCartAmount, setSimCartAmount] = useState<number>(350);

  // Zone Form State
  const [name, setName] = useState('');
  const [pincodes, setPincodes] = useState('');
  const [fee, setFee] = useState(20);
  const [minOrder, setMinOrder] = useState(199);
  const [freeThreshold, setFreeThreshold] = useState(499);
  const [eta, setEta] = useState('25–35 mins');

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
        };
        setDeliverySettings(normalized);
        try {
          localStorage.setItem('fresh_veg_delivery_settings', JSON.stringify(normalized));
        } catch {}
        setChargeInput(String(normalized.default_delivery_charge));
        setThresholdInput(String(normalized.free_delivery_threshold));
        setMinOrderInput(String(normalized.min_order_amount));
        setExpressFeeInput(String(normalized.express_delivery_fee));
        setSurgeInput(String(normalized.surge_charge));
        setEtaInput(normalized.estimated_delivery_time);
        setEnableFreeDelivery(normalized.enable_free_delivery);
        setIsDeliveryActive(normalized.is_delivery_active);
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
    if (e) e.preventDefault();
    try {
      setIsSavingSettings(true);
      const payload = {
        default_delivery_charge: effectiveCharge,
        free_delivery_threshold: effectiveThreshold,
        min_order_amount: effectiveMinOrder,
        enable_free_delivery: Boolean(enableFreeDelivery),
        express_delivery_fee: effectiveExpressFee,
        estimated_delivery_time: etaInput.trim(),
        surge_charge: effectiveSurge,
        is_delivery_active: Boolean(isDeliveryActive),
      };

      const res = await api.put('/delivery/settings', payload);
      if (res.data?.data) {
        const updated = res.data.data;
        setDeliverySettings(updated);
        try {
          localStorage.setItem('fresh_veg_delivery_settings', JSON.stringify(updated));
        } catch {}
        setChargeInput(String(updated.default_delivery_charge));
        setThresholdInput(String(updated.free_delivery_threshold));
        setMinOrderInput(String(updated.min_order_amount));
        setExpressFeeInput(String(updated.express_delivery_fee));
        setSurgeInput(String(updated.surge_charge || 0));
        setEtaInput(updated.estimated_delivery_time);
        setEnableFreeDelivery(updated.enable_free_delivery);
        setIsDeliveryActive(updated.is_delivery_active);

        await syncCartDeliverySettings();
        showToast(`Store delivery charges saved successfully! (₹${updated.default_delivery_charge} base fee, ₹${updated.free_delivery_threshold} free threshold)`);
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to update delivery settings', 'error');
    } finally {
      setIsSavingSettings(false);
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
  }, [
    effectiveCharge,
    effectiveThreshold,
    effectiveMinOrder,
    effectiveExpressFee,
    effectiveSurge,
    etaInput,
    enableFreeDelivery,
    isDeliveryActive,
  ]);

  // ================= ZONE ACTIONS =================
  const handleSaveZone = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        name,
        pincodes: pincodes.split(',').map((p) => p.trim()).filter(Boolean),
        delivery_fee: fee,
        min_order_amount: minOrder,
        free_delivery_threshold: freeThreshold,
        estimated_delivery_time: eta,
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
      fetchData();
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
    setName('');
    setPincodes('500072, 500085');
    setFee(20);
    setMinOrder(199);
    setFreeThreshold(499);
    setEta('25–35 mins');
    setIsModalOpen(true);
  };

  const openEdit = (zone: DeliveryZone) => {
    setEditingZone(zone);
    setName(zone.name);
    setPincodes(zone.pincodes.join(', '));
    setFee(zone.delivery_fee);
    setMinOrder(zone.min_order_amount);
    setFreeThreshold(zone.free_delivery_threshold);
    setEta(zone.estimated_delivery_time);
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
            <span>Minimum Order</span>
            <DollarSign className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-white">
            ₹{deliverySettings.min_order_amount}
          </div>
          <div className="text-[11px] text-slate-500 font-medium">Lowest checkout subtotal</div>
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
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all ${
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
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all ${
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
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all ${
            activeTab === 'stores'
              ? 'bg-brand-500 text-slate-950 shadow-md shadow-brand-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>Fulfillment Hubs ({stores.length})</span>
        </button>
      </div>

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

              {/* Submit Button */}
              <div className="pt-4 flex items-center justify-between">
                <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-brand-400 shrink-0" />
                  Saves directly to database and updates all online customer checkouts immediately.
                </span>

                <button
                  type="submit"
                  disabled={isSavingSettings}
                  className="bg-brand-500 hover:bg-brand-400 active:scale-98 text-slate-950 font-black text-xs px-6 py-3 rounded-2xl flex items-center gap-2 shadow-xl shadow-brand-500/20 transition-all disabled:opacity-50 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSavingSettings ? 'Saving Charges...' : 'Save Delivery Charges'}</span>
                </button>
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
                        <span>{zone.name}</span>
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

      {/* Zone Edit/Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 text-white w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-4">
            <h3 className="font-extrabold text-white text-base">
              {editingZone ? 'Edit Delivery Zone' : 'Create Custom Delivery Zone'}
            </h3>

            <form onSubmit={handleSaveZone} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-400 font-bold mb-1">Zone Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kukatpally & KPHB Zone"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">
                  Covered Pincodes (comma separated)
                </label>
                <input
                  type="text"
                  required
                  placeholder="500072, 500085, 500090"
                  value={pincodes}
                  onChange={(e) => setPincodes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 font-mono text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Zone Delivery Fee (₹)</label>
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
                  <label className="block text-slate-400 font-bold mb-1">Minimum Order (₹)</label>
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
                  <label className="block text-slate-400 font-bold mb-1">Free Delivery At (₹)</label>
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
                  <label className="block text-slate-400 font-bold mb-1">Estimated Speed ETA</label>
                  <input
                    type="text"
                    required
                    value={eta}
                    onChange={(e) => setEta(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-black cursor-pointer"
                >
                  Save Delivery Zone
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
