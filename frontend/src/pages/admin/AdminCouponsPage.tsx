import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import api from '../../services/api';
import { Coupon } from '../../types';

export const AdminCouponsPage: React.FC = () => {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    discount_type: 'FLAT' as 'FLAT' | 'PERCENTAGE',
    discount_value: 50,
    minimum_order_amount: 299,
    maximum_discount: 100,
    usage_limit: 500,
    per_customer_limit: 1,
    status: 'active' as 'active' | 'inactive',
  });

  const defaultCoupons: Coupon[] = [
    {
      id: 'coup01',
      code: 'WELCOME50',
      name: 'Welcome Flat ₹50 OFF',
      description: 'Get flat ₹50 discount on your first farm harvest order over ₹299',
      discount_type: 'FLAT',
      discount_value: 50,
      minimum_order_amount: 299,
      maximum_discount: 50,
      usage_limit: 1000,
      usage_count: 84,
      per_customer_limit: 1,
      start_date: new Date('2026-01-01').toISOString(),
      end_date: new Date('2027-12-31').toISOString(),
      status: 'active',
    },
    {
      id: 'coup02',
      code: 'FRESH10',
      name: '10% Seasonal Greens Discount',
      description: 'Enjoy 10% off on all organic vegetables and salad greens',
      discount_type: 'PERCENTAGE',
      discount_value: 10,
      minimum_order_amount: 199,
      maximum_discount: 100,
      usage_limit: 500,
      usage_count: 122,
      per_customer_limit: 2,
      start_date: new Date('2026-01-01').toISOString(),
      end_date: new Date('2027-12-31').toISOString(),
      status: 'active',
    },
    {
      id: 'coup03',
      code: 'VEGGIE100',
      name: 'Mega Harvest ₹100 Savings',
      description: 'Save flat ₹100 on orders above ₹699',
      discount_type: 'FLAT',
      discount_value: 100,
      minimum_order_amount: 699,
      maximum_discount: 100,
      usage_limit: 200,
      usage_count: 47,
      per_customer_limit: 1,
      start_date: new Date('2024-01-01').toISOString(),
      end_date: new Date('2027-12-31').toISOString(),
      status: 'active',
    },
  ];

  const fetchCoupons = async () => {
    try {
      setLoading(true);
      const res = await api.get('/coupons/admin/all');
      if (res.data?.data && res.data.data.length > 0) {
        setCoupons(res.data.data);
      } else {
        setCoupons(defaultCoupons);
      }
    } catch (err) {
      setCoupons(defaultCoupons);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoupons();
  }, []);

  const handleOpenCreate = () => {
    setEditingCoupon(null);
    setFormData({
      code: '',
      name: '',
      description: '',
      discount_type: 'FLAT',
      discount_value: 50,
      minimum_order_amount: 299,
      maximum_discount: 100,
      usage_limit: 500,
      per_customer_limit: 1,
      status: 'active',
    });
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
      status: c.status,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCoupon) {
        await api.put(`/coupons/admin/${editingCoupon.id}`, formData);
        alert('Coupon updated successfully');
      } else {
        await api.post('/coupons/admin', formData);
        alert('Coupon campaign created successfully');
      }
      setIsModalOpen(false);
      fetchCoupons();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to save coupon');
    }
  };

  const handleToggleStatus = async (coupon: Coupon) => {
    const nextStatus = coupon.status === 'active' ? 'inactive' : 'active';
    try {
      await api.put(`/coupons/admin/${coupon.id}`, { status: nextStatus });
      fetchCoupons();
    } catch (err) {
      alert('Failed to update coupon status');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this coupon?')) return;
    try {
      await api.delete(`/coupons/admin/${id}`);
      fetchCoupons();
    } catch (err) {
      alert('Failed to delete coupon');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Coupons, Offers & Promotions</h1>
          <p className="text-xs text-slate-400 mt-1">
            Dynamic checkout discounts, seasonal marketing campaigns, and customer retention incentives
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleOpenCreate}
            className="bg-brand-500 hover:bg-brand-400 text-slate-950 text-xs font-black px-4 py-2.5 rounded-xl flex items-center gap-1.5 shadow-lg shadow-brand-500/20 transition-all"
          >
            <Plus className="w-4 h-4" /> Create Coupon Offer
          </button>
          <button
            onClick={fetchCoupons}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-3.5 py-2.5 rounded-xl border border-slate-700 transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Coupons Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {coupons.map((coupon) => (
          <div
            key={coupon.id}
            className="bg-slate-950 p-6 rounded-3xl border border-slate-800 flex flex-col justify-between space-y-4 hover:border-slate-700 transition-all group"
          >
            <div className="space-y-3">
              <div className="flex justify-between items-start">
                <span className="font-mono font-black text-lg px-3 py-1 rounded-xl bg-slate-900 border border-slate-800 text-brand-400 tracking-wider">
                  {coupon.code}
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    coupon.status === 'active'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-slate-800 text-slate-500'
                  }`}
                >
                  {coupon.status}
                </span>
              </div>

              <div>
                <h3 className="font-bold text-white text-sm">{coupon.name}</h3>
                <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{coupon.description}</p>
              </div>

              <div className="bg-slate-900/60 p-3 rounded-2xl border border-slate-800/80 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-500">Discount:</span>
                  <strong className="text-brand-300 font-bold">
                    {coupon.discount_type === 'PERCENTAGE' ? `${coupon.discount_value}% OFF` : `₹${coupon.discount_value} FLAT OFF`}
                  </strong>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-500">Min Cart Value:</span>
                  <span>₹{coupon.minimum_order_amount}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-500">Redemptions:</span>
                  <span>{coupon.usage_count || 0} / {coupon.usage_limit || '∞'} used</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
              <button
                onClick={() => handleToggleStatus(coupon)}
                className={`font-bold text-[11px] px-3 py-1.5 rounded-lg border transition-all ${
                  coupon.status === 'active'
                    ? 'border-amber-500/20 text-amber-400 hover:bg-amber-500/10'
                    : 'border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10'
                }`}
              >
                {coupon.status === 'active' ? 'Deactivate' : 'Activate'}
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOpenEdit(coupon)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                  title="Edit Coupon"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(coupon.id)}
                  className="p-1.5 text-rose-400 hover:text-rose-300 rounded-lg hover:bg-rose-500/10 transition-colors"
                  title="Delete Coupon"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create / Edit Coupon Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-950 rounded-3xl max-w-lg w-full p-6 sm:p-8 border border-slate-800 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Tag className="w-4 h-4 text-brand-400" />
                {editingCoupon ? `Edit Coupon: ${editingCoupon.code}` : 'Create New Promotional Coupon'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Coupon Code</label>
                  <input
                    type="text"
                    required
                    disabled={!!editingCoupon}
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. SUMMER20"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono uppercase font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Discount Type</label>
                  <select
                    value={formData.discount_type}
                    onChange={(e) => setFormData({ ...formData, discount_type: e.target.value as any })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  >
                    <option value="FLAT">FLAT (₹ OFF)</option>
                    <option value="PERCENTAGE">PERCENTAGE (% OFF)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Campaign Title</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. 20% Off Summer Greens"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Description</label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Terms and eligible products"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Discount Value</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={formData.discount_value}
                    onChange={(e) => setFormData({ ...formData, discount_value: Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Min Cart (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={formData.minimum_order_amount}
                    onChange={(e) => setFormData({ ...formData, minimum_order_amount: Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Max Cap (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={formData.maximum_discount}
                    onChange={(e) => setFormData({ ...formData, maximum_discount: Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Global Usage Limit</label>
                  <input
                    type="number"
                    min={1}
                    value={formData.usage_limit}
                    onChange={(e) => setFormData({ ...formData, usage_limit: Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Per-User Limit</label>
                  <input
                    type="number"
                    min={1}
                    value={formData.per_customer_limit}
                    onChange={(e) => setFormData({ ...formData, per_customer_limit: Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:bg-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-brand-500 hover:bg-brand-400 text-slate-950 font-black px-5 py-2 rounded-xl shadow-lg shadow-brand-500/20"
                >
                  {editingCoupon ? 'Update Coupon' : 'Launch Campaign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default AdminCouponsPage;
