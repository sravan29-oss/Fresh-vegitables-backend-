import React, { useState, useEffect, useMemo } from 'react';
import {
  Tag,
  Plus,
  Percent,
  Calendar,
  CheckCircle,
  XCircle,
  Trash2,
  RefreshCw,
  Edit,
  Sparkles,
  Building2,
  Users,
  Search,
  History,
  X,
  Clock,
  PauseCircle,
  PlayCircle,
  AlertCircle,
} from 'lucide-react';
import api from '../../services/api';
import { Coupon } from '../../types';

interface CouponSummary {
  total_offers: number;
  active_offers: number;
  scheduled_offers: number;
  expired_offers: number;
  paused_offers: number;
  total_usage_count: number;
  total_discount_value: number;
}

export const AdminCouponsPage: React.FC = () => {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [summary, setSummary] = useState<CouponSummary>({
    total_offers: 0,
    active_offers: 0,
    scheduled_offers: 0,
    expired_offers: 0,
    paused_offers: 0,
    total_usage_count: 0,
    total_discount_value: 0,
  });
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [hubFilter, setHubFilter] = useState<string>('all');
  const [search, setSearch] = useState<string>('');

  // Modal: Create / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    discount_type: 'PERCENTAGE' as 'FLAT' | 'PERCENTAGE',
    discount_value: 10,
    minimum_order_amount: 199,
    maximum_discount: 100 as number | null,
    usage_limit: 500,
    per_customer_limit: 1,
    first_order_only: false,
    applicable_hub_id: '' as string | null,
    start_date: new Date().toISOString().slice(0, 16),
    end_date: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 16),
    status: 'active' as 'active' | 'inactive' | 'paused',
  });
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal: Usage History
  const [isUsageModalOpen, setIsUsageModalOpen] = useState(false);
  const [selectedCouponForUsage, setSelectedCouponForUsage] = useState<Coupon | null>(null);
  const [usageList, setUsageList] = useState<any[]>([]);
  const [loadingUsage, setLoadingUsage] = useState(false);

  const fetchCoupons = async () => {
    try {
      setLoading(true);
      const params: Record<string, any> = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (hubFilter !== 'all') params.hub_id = hubFilter;
      if (search) params.search = search;

      const [couponsRes, summaryRes] = await Promise.all([
        api.get('/coupons/admin/all', { params }),
        api.get('/coupons/admin/summary').catch(() => ({ data: { data: null } })),
      ]);

      if (Array.isArray(couponsRes.data?.data)) {
        setCoupons(couponsRes.data.data);
      } else {
        setCoupons([]);
      }

      if (summaryRes.data?.data) {
        setSummary(summaryRes.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch coupons:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoupons();
  }, [statusFilter, hubFilter]);

  const handleOpenCreate = () => {
    setEditingCoupon(null);
    setFormData({
      code: '',
      name: '',
      description: '',
      discount_type: 'PERCENTAGE',
      discount_value: 10,
      minimum_order_amount: 199,
      maximum_discount: 100,
      usage_limit: 500,
      per_customer_limit: 1,
      first_order_only: false,
      applicable_hub_id: '',
      start_date: new Date().toISOString().slice(0, 16),
      end_date: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 16),
      status: 'active',
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (c: Coupon) => {
    setEditingCoupon(c);
    setFormData({
      code: c.code,
      name: c.name,
      description: c.description || '',
      discount_type: c.discount_type,
      discount_value: c.discount_value,
      minimum_order_amount: c.minimum_order_amount,
      maximum_discount: c.maximum_discount,
      usage_limit: c.usage_limit,
      per_customer_limit: c.per_customer_limit,
      first_order_only: Boolean(c.first_order_only),
      applicable_hub_id: c.applicable_hub_id || '',
      start_date: c.start_date ? new Date(c.start_date).toISOString().slice(0, 16) : '',
      end_date: c.end_date ? new Date(c.end_date).toISOString().slice(0, 16) : '',
      status: c.status,
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code.trim()) {
      setFormError('Coupon code is required');
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError('');

      const payload = {
        ...formData,
        code: formData.code.trim().toUpperCase(),
        applicable_hub_id: formData.applicable_hub_id || null,
        maximum_discount: formData.discount_type === 'PERCENTAGE' ? formData.maximum_discount : null,
      };

      if (editingCoupon) {
        await api.put(`/coupons/admin/${editingCoupon.id}`, payload);
      } else {
        await api.post('/coupons/admin', payload);
      }

      setIsModalOpen(false);
      await fetchCoupons();
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to save coupon');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (coupon: Coupon) => {
    const nextStatus = coupon.status === 'active' ? 'paused' : 'active';
    try {
      setCoupons((prev) =>
        prev.map((c) => (c.id === coupon.id ? { ...c, status: nextStatus } : c))
      );
      await api.patch(`/coupons/admin/${coupon.id}`, { status: nextStatus });
      fetchCoupons();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update coupon status');
      fetchCoupons();
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to permanently delete this coupon? This action cannot be undone.')) return;
    try {
      setCoupons((prev) => prev.filter((c) => c.id !== id));
      await api.delete(`/coupons/admin/${id}`);
      fetchCoupons();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete coupon');
      fetchCoupons();
    }
  };

  const handleOpenUsage = async (coupon: Coupon) => {
    setSelectedCouponForUsage(coupon);
    setIsUsageModalOpen(true);
    try {
      setLoadingUsage(true);
      const res = await api.get(`/coupons/admin/usage/${coupon.id}`);
      setUsageList(res.data?.data || []);
    } catch {
      setUsageList([]);
    } finally {
      setLoadingUsage(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-white tracking-tight">Offers & Coupons Management</h1>
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              Phase 10 Engine
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Create percentage & flat discount campaigns with hub restrictions, first-order rules, usage caps & live redemption audit.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleOpenCreate}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black px-4 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" /> Create Coupon Campaign
          </button>
          <button
            onClick={fetchCoupons}
            className="bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold px-3 py-2.5 rounded-xl border border-slate-800 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
          <p className="text-[11px] font-semibold text-slate-400">Total Campaigns</p>
          <p className="text-xl font-black text-white mt-1">{summary.total_offers}</p>
        </div>

        <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
          <p className="text-[11px] font-semibold text-slate-400">Active Now</p>
          <p className="text-xl font-black text-emerald-400 mt-1">{summary.active_offers}</p>
        </div>

        <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
          <p className="text-[11px] font-semibold text-slate-400">Scheduled</p>
          <p className="text-xl font-black text-indigo-400 mt-1">{summary.scheduled_offers}</p>
        </div>

        <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
          <p className="text-[11px] font-semibold text-slate-400">Paused</p>
          <p className="text-xl font-black text-amber-400 mt-1">{summary.paused_offers}</p>
        </div>

        <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
          <p className="text-[11px] font-semibold text-slate-400">Expired</p>
          <p className="text-xl font-black text-rose-400 mt-1">{summary.expired_offers}</p>
        </div>

        <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
          <p className="text-[11px] font-semibold text-slate-400">Total Redemptions</p>
          <p className="text-xl font-black text-white mt-1">{summary.total_usage_count}</p>
        </div>

        <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
          <p className="text-[11px] font-semibold text-slate-400">Discount Saved</p>
          <p className="text-xl font-black text-emerald-400 mt-1">₹{summary.total_discount_value.toLocaleString('en-IN')}</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Tabs */}
          {['all', 'active', 'paused', 'inactive'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                statusFilter === st
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {st === 'all' ? 'All Campaigns' : st.toUpperCase()}
            </button>
          ))}

          {/* Hub Filter */}
          <select
            value={hubFilter}
            onChange={(e) => setHubFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-950 text-slate-300 border border-slate-800 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">All Hubs (Storewide)</option>
            <option value="hub-champapet">Champapet Hub Only</option>
            <option value="hub-kphb">KPHB Hub Only</option>
          </select>
        </div>

        {/* Search */}
        <div className="relative min-w-[220px]">
          <input
            type="text"
            placeholder="Search code or offer name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchCoupons()}
            className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 text-white rounded-xl text-xs focus:outline-none focus:border-emerald-500"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
        </div>
      </div>

      {/* Coupons Grid */}
      {!loading && coupons.length === 0 ? (
        <div className="text-center py-20 px-4 bg-slate-950/60 rounded-3xl border border-dashed border-slate-800 space-y-3">
          <Tag className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-white">No Coupons Matching Filter</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Try adjusting your status or hub filters, or click &ldquo;Create Coupon Campaign&rdquo; to launch a new promotional discount.
          </p>
          <button
            onClick={handleOpenCreate}
            className="mt-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2 rounded-xl inline-flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-4 h-4" /> Create Coupon Campaign
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {coupons.map((coupon) => {
            const isExpired = coupon.end_date && new Date(coupon.end_date) < new Date();
            return (
              <div
                key={coupon.id}
                className="bg-slate-950 p-5 rounded-3xl border border-slate-800/80 hover:border-slate-700 flex flex-col justify-between space-y-4 transition-all group"
              >
                <div className="space-y-3">
                  {/* Top Bar: Code and Status */}
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-mono font-black text-base px-3 py-1 rounded-xl bg-slate-900 border border-slate-800 text-emerald-400 tracking-wider">
                      {coupon.code}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {isExpired ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          Expired
                        </span>
                      ) : (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            coupon.status === 'active'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}
                        >
                          {coupon.status}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h3 className="font-bold text-white text-sm">{coupon.name}</h3>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                      {coupon.description || 'Promotional vegetable basket discount.'}
                    </p>
                  </div>

                  {/* Badges / Restrictions */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {coupon.discount_type === 'PERCENTAGE'
                        ? `${coupon.discount_value}% OFF${coupon.maximum_discount ? ` (up to ₹${coupon.maximum_discount})` : ''}`
                        : `FLAT ₹${coupon.discount_value} OFF`}
                    </span>

                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-900 text-slate-300 border border-slate-800">
                      Min: ₹{coupon.minimum_order_amount}
                    </span>

                    {coupon.first_order_only && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        1st Order Only
                      </span>
                    )}

                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-900 text-slate-300 border border-slate-800 flex items-center gap-1">
                      <Building2 className="w-3 h-3 text-emerald-400" />
                      {coupon.applicable_hub_id === 'hub-champapet'
                        ? 'Champapet Hub'
                        : coupon.applicable_hub_id === 'hub-kphb'
                        ? 'KPHB Hub'
                        : 'All Hubs'}
                    </span>
                  </div>

                  {/* Usage Progress */}
                  <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/60 space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Total Redemptions</span>
                      <span className="font-bold text-white">
                        {coupon.usage_count} / {coupon.usage_limit || '∞'}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{
                          width: `${Math.min(
                            100,
                            coupon.usage_limit ? (coupon.usage_count / coupon.usage_limit) * 100 : 10
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleStatus(coupon)}
                      className={`text-xs font-bold flex items-center gap-1 transition-colors ${
                        coupon.status === 'active'
                          ? 'text-amber-400 hover:text-amber-300'
                          : 'text-emerald-400 hover:text-emerald-300'
                      }`}
                      title={coupon.status === 'active' ? 'Pause coupon' : 'Activate coupon'}
                    >
                      {coupon.status === 'active' ? (
                        <>
                          <PauseCircle className="w-3.5 h-3.5" /> Pause
                        </>
                      ) : (
                        <>
                          <PlayCircle className="w-3.5 h-3.5" /> Activate
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => handleOpenUsage(coupon)}
                      className="text-xs font-bold text-slate-400 hover:text-white flex items-center gap-1 ml-2"
                      title="View redemptions"
                    >
                      <History className="w-3.5 h-3.5 text-slate-400" /> Usage ({coupon.usage_count})
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(coupon)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 transition-all"
                      title="Edit Campaign"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(coupon.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                      title="Delete Campaign"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="text-base font-black text-white">
                {editingCoupon ? `Edit Campaign: ${editingCoupon.code}` : 'Launch New Coupon Campaign'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 mt-4 text-xs">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 font-semibold">
                  {formError}
                </div>
              )}

              {/* Code & Name */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Coupon Promo Code *</label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. VEG50"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono font-bold focus:outline-none focus:border-emerald-500 uppercase"
                    required
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-300 block mb-1">Campaign Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Weekend Organic Harvest"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="font-bold text-slate-300 block mb-1">Customer Description</label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Appears in checkout coupon card for customer guidance..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>

              {/* Discount Type & Value */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Discount Type</label>
                  <select
                    value={formData.discount_type}
                    onChange={(e) =>
                      setFormData({ ...formData, discount_type: e.target.value as 'FLAT' | 'PERCENTAGE' })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-bold focus:outline-none focus:border-emerald-500"
                  >
                    <option value="PERCENTAGE">PERCENTAGE (%)</option>
                    <option value="FLAT">FLAT (₹)</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-300 block mb-1">
                    {formData.discount_type === 'PERCENTAGE' ? 'Discount Percentage (%)' : 'Flat Discount (₹)'} *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={formData.discount_type === 'PERCENTAGE' ? 100 : 5000}
                    value={formData.discount_value}
                    onChange={(e) => setFormData({ ...formData, discount_value: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-bold focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-300 block mb-1">Max Cap (₹)</label>
                  <input
                    type="number"
                    min="1"
                    disabled={formData.discount_type === 'FLAT'}
                    value={formData.maximum_discount || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        maximum_discount: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    placeholder={formData.discount_type === 'FLAT' ? 'N/A' : 'e.g. 100'}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-bold focus:outline-none focus:border-emerald-500 disabled:opacity-40"
                  />
                </div>
              </div>

              {/* Minimum Order Amount & Usage Caps */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Min Order Cart (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.minimum_order_amount}
                    onChange={(e) => setFormData({ ...formData, minimum_order_amount: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-bold focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-300 block mb-1">Total Usage Limit</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.usage_limit}
                    onChange={(e) => setFormData({ ...formData, usage_limit: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-bold focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-300 block mb-1">Per-User Limit</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={formData.per_customer_limit}
                    onChange={(e) => setFormData({ ...formData, per_customer_limit: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-bold focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>
              </div>

              {/* Hub Restriction & First Order */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Fulfillment Hub Restriction</label>
                  <select
                    value={formData.applicable_hub_id || ''}
                    onChange={(e) => setFormData({ ...formData, applicable_hub_id: e.target.value || null })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-bold focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">All Hubs (No restriction)</option>
                    <option value="hub-champapet">Champapet Hub Only</option>
                    <option value="hub-kphb">KPHB Hub Only</option>
                  </select>
                </div>

                <div className="flex items-center pt-6">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-300">
                    <input
                      type="checkbox"
                      checked={formData.first_order_only}
                      onChange={(e) => setFormData({ ...formData, first_order_only: e.target.checked })}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 bg-slate-950 border-slate-800"
                    />
                    <span>First Order Only (New Customer)</span>
                  </label>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Start Date & Time</label>
                  <input
                    type="datetime-local"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-300 block mb-1">Expiry Date & Time</label>
                  <input
                    type="datetime-local"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="font-bold text-slate-300 block mb-1">Campaign Status</label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      value="active"
                      checked={formData.status === 'active'}
                      onChange={() => setFormData({ ...formData, status: 'active' })}
                    />
                    <span className="text-emerald-400 font-bold">Active</span>
                  </label>

                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      value="paused"
                      checked={formData.status === 'paused'}
                      onChange={() => setFormData({ ...formData, status: 'paused' })}
                    />
                    <span className="text-amber-400 font-bold">Paused</span>
                  </label>

                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      value="inactive"
                      checked={formData.status === 'inactive'}
                      onChange={() => setFormData({ ...formData, status: 'inactive' })}
                    />
                    <span className="text-slate-400 font-bold">Inactive / Draft</span>
                  </label>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-sm transition-all"
                >
                  {isSubmitting ? 'Saving...' : editingCoupon ? 'Update Campaign' : 'Launch Campaign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Usage History Modal */}
      {isUsageModalOpen && selectedCouponForUsage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl p-6 shadow-2xl relative max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
              <div>
                <h3 className="text-base font-black text-white">
                  Redemption History: <span className="text-emerald-400">{selectedCouponForUsage.code}</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Total Redemptions: {selectedCouponForUsage.usage_count}
                </p>
              </div>
              <button
                onClick={() => setIsUsageModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4">
              {loadingUsage ? (
                <div className="py-16 text-center text-xs text-slate-400">Loading redemptions...</div>
              ) : usageList.length === 0 ? (
                <div className="py-16 text-center text-xs text-slate-400">
                  No redemptions recorded yet for this coupon code.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 text-[10px] uppercase font-bold">
                        <th className="py-2.5 px-3">Customer</th>
                        <th className="py-2.5 px-3">Order Number</th>
                        <th className="py-2.5 px-3">Fulfillment Hub</th>
                        <th className="py-2.5 px-3">Discount Saved</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-right">Redeemed At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-medium">
                      {usageList.map((u) => (
                        <tr key={u.id} className="hover:bg-slate-800/30">
                          <td className="py-2.5 px-3">
                            <span className="text-white font-bold">{u.user_name || 'Customer'}</span>
                            <span className="text-[10px] text-slate-500 block">{u.user_email || ''}</span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-emerald-400">
                            {u.order_number || `#${u.order_id?.slice(0, 8)}`}
                          </td>
                          <td className="py-2.5 px-3 text-slate-300">
                            {u.hub_id === 'hub-kphb' ? 'KPHB Hub' : 'Champapet Hub'}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-white">
                            ₹{u.discount_amount}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              u.redemption_status === 'CANCELLED_REFUNDED'
                                ? 'bg-amber-500/20 text-amber-400'
                                : 'bg-emerald-500/20 text-emerald-400'
                            }`}>
                              {u.redemption_status || 'APPLIED'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-400 text-[11px]">
                            {new Date(u.used_at).toLocaleDateString('en-IN')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
