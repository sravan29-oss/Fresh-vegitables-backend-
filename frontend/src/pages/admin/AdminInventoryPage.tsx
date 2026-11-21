import React, { useState, useEffect, useMemo } from 'react';
import {
  Boxes,
  Search,
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  History,
  Plus,
  Minus,
  RefreshCw,
  Building2,
  DollarSign,
  PackageX,
  X,
  Sliders,
  Filter,
} from 'lucide-react';
import api from '../../services/api';
import { HubInventoryItem, InventorySummary, HubStockMovement, LowStockAlert } from '../../types';

export const AdminInventoryPage: React.FC = () => {
  const [items, setItems] = useState<HubInventoryItem[]>([]);
  const [summary, setSummary] = useState<InventorySummary>({
    total_products: 0,
    total_stock: 0,
    in_stock: 0,
    low_stock: 0,
    out_of_stock: 0,
    total_inventory_value: 0,
  });
  const [alerts, setAlerts] = useState<LowStockAlert[]>([]);
  const [movements, setMovements] = useState<HubStockMovement[]>([]);

  // Filters
  const [selectedHub, setSelectedHub] = useState<string>('all');
  const [stockStatus, setStockStatus] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Stock Adjustment Modal
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<HubInventoryItem | null>(null);
  const [adjustOperation, setAdjustOperation] = useState<'ADD' | 'REDUCE' | 'ADJUST' | 'CORRECTION'>('ADD');
  const [adjustQuantity, setAdjustQuantity] = useState<number>(10);
  const [adjustReason, setAdjustReason] = useState<string>('Daily farm harvest replenishment');
  const [adjustHubId, setAdjustHubId] = useState<string>('hub-champapet');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [adjustError, setAdjustError] = useState('');

  // Threshold Configuration Modal
  const [isThresholdModalOpen, setIsThresholdModalOpen] = useState(false);
  const [newThreshold, setNewThreshold] = useState<number>(5);

  // Movements History Drawer
  const [isMovementsDrawerOpen, setIsMovementsDrawerOpen] = useState(false);
  const [loadingMovements, setLoadingMovements] = useState(false);

  const loadInventory = async () => {
    try {
      setIsLoading(true);
      const params: Record<string, any> = {};
      if (selectedHub && selectedHub !== 'all') params.hub_id = selectedHub;
      if (stockStatus) params.stock_status = stockStatus;
      if (search) params.search = search;

      const [invRes, alertsRes] = await Promise.all([
        api.get('/admin/inventory', { params }),
        api.get('/admin/inventory/alerts', { params: { hub_id: selectedHub } }).catch(() => ({ data: { data: [] } })),
      ]);

      if (invRes.data?.data) {
        const raw = invRes.data.data;
        if (Array.isArray(raw)) {
          setItems(raw);
        } else if (raw.items) {
          setItems(raw.items);
          if (raw.summary) setSummary(raw.summary);
        }
      }

      if (alertsRes.data?.data) {
        setAlerts(alertsRes.data.data);
      }
    } catch (err) {
      console.error('Failed to load inventory', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMovements = async (productId?: string) => {
    try {
      setLoadingMovements(true);
      const params: Record<string, any> = { limit: 50 };
      if (selectedHub && selectedHub !== 'all') params.hub_id = selectedHub;
      if (productId) params.product_id = productId;

      const res = await api.get('/admin/inventory/movements', { params });
      if (res.data?.data) {
        setMovements(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load movements', err);
    } finally {
      setLoadingMovements(false);
    }
  };

  useEffect(() => {
    loadInventory();
  }, [selectedHub, stockStatus]);

  const handleOpenAdjust = (item: HubInventoryItem, op: 'ADD' | 'REDUCE' | 'ADJUST' | 'CORRECTION' = 'ADD') => {
    setSelectedItem(item);
    setAdjustOperation(op);
    setAdjustHubId(item.hub_id || (selectedHub !== 'all' ? selectedHub : 'hub-champapet'));
    setAdjustQuantity(op === 'ADD' ? 10 : op === 'REDUCE' ? 5 : item.stock_quantity);
    setAdjustReason(
      op === 'ADD'
        ? 'Daily farm harvest replenishment'
        : op === 'REDUCE'
        ? 'Quality damage / discard'
        : op === 'CORRECTION'
        ? 'Physical shelf count audit correction'
        : 'Routine stock level calibration'
    );
    setAdjustError('');
    setIsAdjustModalOpen(true);
  };

  const handleOpenThreshold = (item: HubInventoryItem) => {
    setSelectedItem(item);
    setNewThreshold(item.minimum_stock || 5);
    setIsThresholdModalOpen(true);
  };

  const handleSubmitAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    if (adjustOperation === 'CORRECTION' && (!adjustReason || adjustReason.trim().length < 3)) {
      setAdjustError('A detailed reason is mandatory for stock audit corrections.');
      return;
    }

    try {
      setIsSubmitting(true);
      setAdjustError('');

      await api.post('/admin/inventory/update', {
        hub_id: adjustHubId,
        product_id: selectedItem.product_id,
        operation: adjustOperation,
        quantity: Number(adjustQuantity),
        reason: adjustReason,
      });

      setIsAdjustModalOpen(false);
      await loadInventory();
    } catch (err: any) {
      setAdjustError(err.response?.data?.message || 'Failed to update stock');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitThreshold = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    try {
      setIsSubmitting(true);
      await api.patch(`/admin/inventory/${selectedItem.product_id}`, {
        hub_id: selectedItem.hub_id,
        minimum_stock: Number(newThreshold),
      });

      setIsThresholdModalOpen(false);
      await loadInventory();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update threshold');
    } finally {
      setIsSubmitting(false);
    }
  };

  const previewNewStock = useMemo(() => {
    if (!selectedItem) return 0;
    const current = Number(selectedItem.stock_quantity || 0);
    const qty = Number(adjustQuantity || 0);

    if (adjustOperation === 'ADD') return current + qty;
    if (adjustOperation === 'REDUCE') return Math.max(0, current - qty);
    if (adjustOperation === 'ADJUST' || adjustOperation === 'CORRECTION') return Math.max(0, qty);
    return current;
  }, [selectedItem, adjustOperation, adjustQuantity]);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-white tracking-tight">Two-Hub Inventory Management</h1>
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              Live Two-Hub Engine
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Independent stock tracking, batch replenishment, threshold alerts & audit history for Champapet & KPHB Hubs.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              loadMovements();
              setIsMovementsDrawerOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition-all"
          >
            <History className="w-4 h-4 text-emerald-400" />
            Stock Movements Log
          </button>
          <button
            onClick={loadInventory}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800/80">
          <p className="text-[11px] font-semibold text-slate-400">Total Produce</p>
          <p className="text-xl font-black text-white mt-1">{summary.total_products}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Active catalog SKUs</p>
        </div>

        <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800/80">
          <p className="text-[11px] font-semibold text-slate-400">Total Units</p>
          <p className="text-xl font-black text-emerald-400 mt-1">{summary.total_stock}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Physical pack count</p>
        </div>

        <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800/80">
          <p className="text-[11px] font-semibold text-slate-400">In Stock</p>
          <p className="text-xl font-black text-emerald-300 mt-1">{summary.in_stock}</p>
          <p className="text-[10px] text-emerald-500/80 mt-0.5">Healthy supply</p>
        </div>

        <div
          onClick={() => setStockStatus(stockStatus === 'low_stock' ? '' : 'low_stock')}
          className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
            stockStatus === 'low_stock'
              ? 'bg-amber-500/10 border-amber-500/50 shadow-sm'
              : 'bg-slate-950 border-slate-800/80 hover:border-amber-500/30'
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold text-amber-400">Low Stock</p>
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <p className="text-xl font-black text-amber-400 mt-1">{summary.low_stock}</p>
          <p className="text-[10px] text-amber-500/80 mt-0.5">Needs restock</p>
        </div>

        <div
          onClick={() => setStockStatus(stockStatus === 'out_of_stock' ? '' : 'out_of_stock')}
          className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
            stockStatus === 'out_of_stock'
              ? 'bg-rose-500/10 border-rose-500/50 shadow-sm'
              : 'bg-slate-950 border-slate-800/80 hover:border-rose-500/30'
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold text-rose-400">Out of Stock</p>
            <PackageX className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <p className="text-xl font-black text-rose-400 mt-1">{summary.out_of_stock}</p>
          <p className="text-[10px] text-rose-500/80 mt-0.5">Unavailable</p>
        </div>

        <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800/80">
          <p className="text-[11px] font-semibold text-slate-400">Inventory Value</p>
          <p className="text-xl font-black text-white mt-1">₹{summary.total_inventory_value.toLocaleString('en-IN')}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Estimated cost value</p>
        </div>
      </div>

      {/* Low Stock Alerts Banner (if any) */}
      {alerts.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-bold text-amber-300">
              {alerts.length} Produce Items Require Replenishment Attention
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {alerts.slice(0, 6).map((a) => (
              <span
                key={a.alert_key}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-950/80 border border-amber-500/20 text-slate-300 font-medium flex items-center gap-1.5"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <strong className="text-white">{a.product_name}</strong> ({a.current_stock} left @ {a.hub_name.replace('Fresh Vegetables ', '')})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Hub Tabs & Filter Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
        {/* Hub Selector */}
        <div className="inline-flex p-1 bg-slate-950 border border-slate-800 rounded-2xl">
          <button
            onClick={() => setSelectedHub('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              selectedHub === 'all'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            All Fulfillment Hubs
          </button>
          <button
            onClick={() => setSelectedHub('hub-champapet')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              selectedHub === 'hub-champapet'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Building2 className="w-3.5 h-3.5 text-emerald-400" />
            Champapet Hub (5 KM)
          </button>
          <button
            onClick={() => setSelectedHub('hub-kphb')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              selectedHub === 'hub-kphb'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Building2 className="w-3.5 h-3.5 text-emerald-400" />
            KPHB Hub (5 KM)
          </button>
        </div>

        {/* Search & Status Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {['', 'in_stock', 'low_stock', 'out_of_stock'].map((st) => (
            <button
              key={st}
              onClick={() => setStockStatus(st)}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all ${
                stockStatus === st
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {st === '' ? 'All Statuses' : st.replace(/_/g, ' ').toUpperCase()}
            </button>
          ))}

          <div className="relative min-w-[200px]">
            <input
              type="text"
              placeholder="Search by name, SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadInventory()}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 text-white rounded-xl text-xs focus:outline-none focus:border-emerald-500"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          </div>
        </div>
      </div>

      {/* Main Inventory Table */}
      <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="py-20 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
            <RefreshCw className="w-5 h-5 text-emerald-400 animate-spin" />
            Loading live hub stock...
          </div>
        ) : items.length === 0 ? (
          <div className="py-20 text-center text-xs text-slate-400">
            No produce items match the current hub or status criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px] bg-slate-900/50">
                  <th className="py-3.5 px-4">Produce Details</th>
                  <th className="py-3.5 px-4">Assigned Hub</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Price</th>
                  <th className="py-3.5 px-4">Available Stock</th>
                  <th className="py-3.5 px-4">Reserved</th>
                  <th className="py-3.5 px-4">Alert Threshold</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {items.map((item) => (
                  <tr key={`${item.hub_id}-${item.product_id}`} className="hover:bg-slate-900/40 transition-colors">
                    {/* Produce Details */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        {item.product_image ? (
                          <img
                            src={item.product_image}
                            alt={item.product_name}
                            className="w-10 h-10 object-cover rounded-xl border border-slate-800 shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center shrink-0 text-slate-600 border border-slate-800">
                            <Boxes className="w-5 h-5" />
                          </div>
                        )}
                        <div>
                          <p className="font-bold text-white text-sm leading-tight">{item.product_name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-slate-500 font-mono">{item.sku || 'SKU-NONE'}</span>
                            <span className="text-[10px] text-slate-400">• {item.unit}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Assigned Hub */}
                    <td className="py-3.5 px-4">
                      <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        {item.hub_name ? item.hub_name.replace('Fresh Vegetables ', '') : item.hub_id === 'hub-kphb' ? 'KPHB Hub' : 'Champapet Hub'}
                      </span>
                    </td>

                    {/* Category */}
                    <td className="py-3.5 px-4 text-slate-300 font-medium">
                      {item.category_name || 'Fresh Produce'}
                    </td>

                    {/* Price */}
                    <td className="py-3.5 px-4">
                      <span className="text-white font-bold">₹{item.selling_price}</span>
                      <span className="text-[10px] text-slate-500 block">Cost: ₹{item.purchase_price || (item.selling_price * 0.7).toFixed(0)}</span>
                    </td>

                    {/* Available Stock */}
                    <td className="py-3.5 px-4">
                      <span className={`text-base font-black ${
                        item.stock_quantity <= 0
                          ? 'text-rose-400'
                          : item.stock_quantity <= item.minimum_stock
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                      }`}>
                        {item.stock_quantity}
                      </span>
                      <span className="text-[10px] text-slate-500 ml-1">packs</span>
                    </td>

                    {/* Reserved */}
                    <td className="py-3.5 px-4 text-slate-400">
                      {item.reserved_quantity || 0} packs
                    </td>

                    {/* Alert Threshold */}
                    <td className="py-3.5 px-4">
                      <button
                        onClick={() => handleOpenThreshold(item)}
                        className="text-slate-300 hover:text-white font-bold flex items-center gap-1 group text-xs"
                        title="Click to edit alert threshold"
                      >
                        <span>{item.minimum_stock} units</span>
                        <Sliders className="w-3 h-3 text-slate-500 group-hover:text-emerald-400" />
                      </button>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">
                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                          item.status === 'out_of_stock'
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : item.status === 'low_stock'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        }`}
                      >
                        {item.status.replace(/_/g, ' ')}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenAdjust(item, 'ADD')}
                          className="p-1.5 rounded-lg bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white transition-all"
                          title="Add Stock (+)"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenAdjust(item, 'REDUCE')}
                          className="p-1.5 rounded-lg bg-rose-600/20 text-rose-400 hover:bg-rose-600 hover:text-white transition-all"
                          title="Reduce Stock (-)"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenAdjust(item, 'CORRECTION')}
                          className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-white text-[11px] font-bold transition-all"
                          title="Audit Correction"
                        >
                          Correct
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Stock Adjustment Modal */}
      {isAdjustModalOpen && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-base font-black text-white">
                  Stock Adjustment — {selectedItem.product_name}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Fulfillment Hub: <strong className="text-emerald-400">{adjustHubId === 'hub-champapet' ? 'Champapet Hub' : 'KPHB Hub'}</strong>
                </p>
              </div>
              <button
                onClick={() => setIsAdjustModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitAdjustment} className="space-y-4 mt-4">
              {adjustError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold">
                  {adjustError}
                </div>
              )}

              {/* Hub Selection */}
              <div>
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1.5">
                  Target Dispatch Hub
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustHubId('hub-champapet')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all text-left flex items-center gap-2 ${
                      adjustHubId === 'hub-champapet'
                        ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Building2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div>
                      <p className="leading-tight">Champapet Hub</p>
                      <span className="text-[10px] text-slate-500 font-normal">5 KM Service Radius</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAdjustHubId('hub-kphb')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all text-left flex items-center gap-2 ${
                      adjustHubId === 'hub-kphb'
                        ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Building2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div>
                      <p className="leading-tight">KPHB Hub</p>
                      <span className="text-[10px] text-slate-500 font-normal">5 KM Service Radius</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Operation Tabs */}
              <div>
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1.5">
                  Operation Type
                </label>
                <div className="grid grid-cols-4 gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
                  {(['ADD', 'REDUCE', 'ADJUST', 'CORRECTION'] as const).map((op) => (
                    <button
                      key={op}
                      type="button"
                      onClick={() => setAdjustOperation(op)}
                      className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                        adjustOperation === op
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {op}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quantity Input with Live Preview */}
              <div className="grid grid-cols-2 gap-3 items-center">
                <div>
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1.5">
                    {adjustOperation === 'ADD'
                      ? 'Add Units (+)'
                      : adjustOperation === 'REDUCE'
                      ? 'Reduce Units (-)'
                      : 'Set Exact Total Units (=)'}
                  </label>
                  <input
                    type="number"
                    min={adjustOperation === 'REDUCE' || adjustOperation === 'ADD' ? 1 : 0}
                    value={adjustQuantity}
                    onChange={(e) => setAdjustQuantity(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-bold text-sm focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <p className="text-[10px] font-semibold text-slate-400">Stock Result Preview</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-slate-500">{selectedItem.stock_quantity}</span>
                    <span className="text-slate-600">➔</span>
                    <span className={`text-base font-black ${
                      previewNewStock <= 0 ? 'text-rose-400' : 'text-emerald-400'
                    }`}>
                      {previewNewStock} units
                    </span>
                  </div>
                </div>
              </div>

              {/* Mandatory Reason */}
              <div>
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1.5">
                  Audit Reason {adjustOperation === 'CORRECTION' && <span className="text-rose-400">* (Mandatory)</span>}
                </label>
                <textarea
                  rows={2}
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="Explain why this inventory adjustment is being performed..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-emerald-500 resize-none"
                  required={adjustOperation === 'CORRECTION'}
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white shadow-sm transition-all"
                >
                  {isSubmitting ? 'Recording...' : 'Commit Stock Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Threshold Modal */}
      {isThresholdModalOpen && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl relative">
            <h3 className="text-base font-black text-white">Configure Alert Threshold</h3>
            <p className="text-xs text-slate-400 mt-1">
              Minimum units for <strong className="text-white">{selectedItem.product_name}</strong> before triggering low-stock replenishment alert.
            </p>

            <form onSubmit={handleSubmitThreshold} className="space-y-4 mt-4">
              <div>
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1.5">
                  Low Stock Threshold Units
                </label>
                <input
                  type="number"
                  min="1"
                  value={newThreshold}
                  onChange={(e) => setNewThreshold(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-bold text-sm focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsThresholdModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all"
                >
                  Save Threshold
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Movements History Drawer */}
      {isMovementsDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/80 backdrop-blur-xs">
          <div className="w-full max-w-xl bg-slate-900 border-l border-slate-800 h-full p-6 flex flex-col shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-black text-white">Auditable Stock Movement Log</h3>
              </div>
              <button
                onClick={() => setIsMovementsDrawerOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-2.5">
              {loadingMovements ? (
                <div className="py-20 text-center text-xs text-slate-400">Loading audit trail...</div>
              ) : movements.length === 0 ? (
                <div className="py-20 text-center text-xs text-slate-400">No stock movements recorded yet.</div>
              ) : (
                movements.map((m) => (
                  <div key={m.id} className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-sm">{m.product_name || 'Produce Item'}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        m.operation_type === 'ADD' || m.operation_type === 'ORDER_CANCEL_RESTORE'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : m.operation_type === 'REDUCE' || m.operation_type === 'ORDER_DEDUCT'
                          ? 'bg-rose-500/20 text-rose-400'
                          : 'bg-indigo-500/20 text-indigo-400'
                      }`}>
                        {m.operation_type}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-slate-400 text-[11px] mt-1.5">
                      <span>Hub: <strong className="text-slate-300">{m.hub_id === 'hub-kphb' ? 'KPHB' : 'Champapet'}</strong></span>
                      <span>Change: <strong className={m.quantity_changed > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                        {m.quantity_changed > 0 ? `+${m.quantity_changed}` : m.quantity_changed}
                      </strong></span>
                      <span>Stock: {m.previous_stock} ➔ <strong className="text-white">{m.new_stock}</strong></span>
                    </div>

                    <p className="text-[11px] text-slate-500 mt-1 italic">
                      "{m.reason}"
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-slate-600 mt-2 pt-1 border-t border-slate-900">
                      <span>Ref: {m.reference_id || 'manual'}</span>
                      <span>{new Date(m.created_at).toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
