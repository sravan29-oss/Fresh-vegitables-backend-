import React, { useEffect, useState } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  Pause,
  Play,
  SkipForward,
  XCircle,
  Plus,
  Sparkles,
  Check,
  AlertCircle,
  Layers,
} from 'lucide-react';
import api from '../../services/api';
import { Subscription } from '../../types';
import { SEOHead } from '../../components/common/SEOHead';

export const SubscriptionsPage: React.FC = () => {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // New subscription form state
  const [newTitle, setNewTitle] = useState('Weekly Farm Harvest Basket');
  const [frequency, setFrequency] = useState<'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY'>('WEEKLY');
  const [deliveryDay, setDeliveryDay] = useState('Sunday');
  const [deliverySlot, setDeliverySlot] = useState('06:00 AM - 08:00 AM');
  const [amount, setAmount] = useState(499);

  const fetchSubscriptions = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/subscriptions');
      if (res.data?.data) {
        setSubscriptions(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load subscriptions', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const handleUpdateStatus = async (
    id: string,
    status: 'ACTIVE' | 'PAUSED' | 'SKIPPED' | 'CANCELLED'
  ) => {
    try {
      const res = await api.patch(`/subscriptions/${id}/status`, { status });
      if (res.data?.data) {
        setSubscriptions((prev) =>
          prev.map((s) => (s.id === id ? res.data.data : s))
        );
        showToast(res.data.message || `Subscription status updated to ${status}`);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update subscription');
    }
  };

  const handleCreateSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        title: newTitle,
        frequency,
        delivery_day: deliveryDay,
        delivery_time_slot: deliverySlot,
        amount_per_delivery: amount,
        payment_method: 'wallet',
        address_summary: 'Primary Delivery Address',
        items: [
          { product_name: 'Farm Fresh Tomatoes', quantity: 2, unit: '1kg' },
          { product_name: 'Crisp Green Spinach', quantity: 2, unit: '250g' },
          { product_name: 'Pahadi Potatoes', quantity: 2, unit: '1kg' },
        ],
      };

      const res = await api.post('/subscriptions', payload);
      if (res.data?.data) {
        setSubscriptions((prev) => [res.data.data, ...prev]);
        setIsModalOpen(false);
        showToast('Subscribed successfully! Next harvest scheduled.');
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create subscription');
    }
  };

  const showToast = (message: string) => {
    setMsg(message);
    setTimeout(() => setMsg(null), 3000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in pb-24">
      <SEOHead title="My Recurring Subscriptions — Fresh Vegetables" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 text-emerald-800 border border-emerald-500/20 px-3 py-1 rounded-full text-xs font-bold mb-2">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>Save 10% Extra On Every Recurring Delivery</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            My Subscriptions &amp; Recurring Orders
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Automate weekly vegetable combos, daily salad greens, and essential native roots.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-brand-500 hover:bg-brand-400 text-slate-950 font-black text-xs px-5 py-3 rounded-2xl flex items-center gap-2 shadow-xl shadow-brand-500/20 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Recurring Harvest</span>
        </button>
      </div>

      {msg && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 text-xs px-4 py-3 rounded-2xl flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>{msg}</span>
        </div>
      )}

      {/* Subscriptions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {subscriptions.map((sub) => {
          const isActive = sub.status === 'ACTIVE';
          return (
            <div
              key={sub.id}
              className={`p-6 sm:p-7 rounded-3xl glass-card border transition-all flex flex-col justify-between space-y-6 ${
                isActive ? 'border-brand-200 shadow-xl' : 'border-slate-200 opacity-70'
              }`}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full ${
                      isActive
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {sub.status} • {sub.frequency}
                  </span>
                  <span className="text-lg font-black text-slate-900">
                    ₹{sub.amount_per_delivery} <span className="text-xs text-slate-400 font-normal">/delivery</span>
                  </span>
                </div>

                <div>
                  <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">
                    {sub.title}
                  </h3>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-2">
                    <span className="flex items-center gap-1 font-bold text-slate-800">
                      <Clock className="w-3.5 h-3.5 text-brand-600" /> Every {sub.delivery_day}
                    </span>
                    <span>Slot: {sub.delivery_time_slot}</span>
                  </div>
                </div>

                {/* Items in basket */}
                <div className="bg-slate-50 p-4 rounded-2xl space-y-2 border border-slate-100">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Vegetable Basket Items ({sub.items.length})
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {sub.items.map((it, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 text-slate-700 font-medium truncate">
                        <span className="w-1.5 h-1.5 rounded-full bg-brand-500 flex-shrink-0"></span>
                        <span className="truncate">{it.product_name}</span>
                        <span className="text-slate-400 text-[11px] font-normal">({it.quantity} {it.unit})</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="text-xs text-slate-500 flex items-center justify-between border-t border-slate-100 pt-3">
                  <span>Next Scheduled Harvest:</span>
                  <span className="font-extrabold text-brand-700 bg-brand-50 px-2.5 py-1 rounded-lg">
                    {sub.next_delivery_date}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-wrap gap-2">
                {isActive ? (
                  <>
                    <button
                      onClick={() => handleUpdateStatus(sub.id, 'PAUSED')}
                      className="bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 transition-colors"
                    >
                      <Pause className="w-3.5 h-3.5" />
                      <span>Pause</span>
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(sub.id, 'SKIPPED')}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 transition-colors"
                    >
                      <SkipForward className="w-3.5 h-3.5" />
                      <span>Skip Next Delivery</span>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleUpdateStatus(sub.id, 'ACTIVE')}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 transition-colors"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Resume Subscription</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    if (window.confirm('Cancel this recurring subscription?')) {
                      handleUpdateStatus(sub.id, 'CANCELLED');
                    }
                  }}
                  className="ml-auto text-rose-600 hover:bg-rose-50 text-xs font-bold px-3 py-2 rounded-xl transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Subscription Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-white border border-slate-200 text-slate-900 w-full max-w-lg rounded-3xl p-6 sm:p-8 shadow-2xl relative space-y-4">
            <h3 className="text-xl font-black text-slate-900 tracking-tight">
              Start Farm Harvest Subscription
            </h3>
            <p className="text-xs text-slate-500">
              Never run out of crisp greens. Pause or skip deliveries anytime with 0 fees.
            </p>

            <form onSubmit={handleCreateSubscription} className="space-y-4 text-xs pt-2">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Subscription Title</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Frequency</label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-medium"
                  >
                    <option value="WEEKLY">Weekly (Recommended)</option>
                    <option value="DAILY">Daily Fresh Greens</option>
                    <option value="BIWEEKLY">Every 2 Weeks</option>
                    <option value="MONTHLY">Monthly Pantry Restock</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Preferred Day</label>
                  <select
                    value={deliveryDay}
                    onChange={(e) => setDeliveryDay(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-medium"
                  >
                    <option value="Sunday">Sunday Morning</option>
                    <option value="Monday">Monday Morning</option>
                    <option value="Wednesday">Wednesday Morning</option>
                    <option value="Friday">Friday Morning</option>
                    <option value="Everyday">Everyday</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Time Slot</label>
                <input
                  type="text"
                  value={deliverySlot}
                  onChange={(e) => setDeliverySlot(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900"
                />
              </div>

              <div className="p-3 bg-emerald-50 rounded-xl text-emerald-800 text-[11px] leading-relaxed">
                Includes curated: 2kg Farm Red Tomatoes, 500g Crisp Palak, 2kg Pahadi Potatoes + bonus fresh coriander bunch!
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-black shadow-md shadow-brand-500/20"
                >
                  Confirm Subscription (₹{amount})
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
