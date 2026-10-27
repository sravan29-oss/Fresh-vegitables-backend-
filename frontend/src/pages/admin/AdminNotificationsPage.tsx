import React, { useState, useEffect } from 'react';
import {
  Bell,
  Send,
  Users,
  Sparkles,
  CheckCircle,
  Clock,
  Radio,
  FileText,
  RefreshCw,
} from 'lucide-react';
import api from '../../services/api';

export const AdminNotificationsPage: React.FC = () => {
  const [title, setTitle] = useState('Weekend Fresh Harvest Sale 🥬');
  const [message, setMessage] = useState('Get 10% OFF on all organic leafy vegetables and hydroponic greens with code FRESH10!');
  const [target, setTarget] = useState('All Customers');
  const [type, setType] = useState('PROMOTION');
  const [sending, setSending] = useState(false);
  const [recentBroadcasts, setRecentBroadcasts] = useState<any[]>([
    {
      id: 'bc01',
      title: 'Monsoon Farm Fresh Arrivals 🌧️',
      message: 'Fresh bitter gourd, ridge gourd, and sweet corn freshly harvested this morning.',
      target: 'All Customers',
      sent_at: '2 hours ago',
      reach: 112,
    },
    {
      id: 'bc02',
      title: 'Your Cart is Waiting! 🛒',
      message: 'Complete your vegetable order and get free express 30-minute delivery.',
      target: 'Returning Customers',
      sent_at: 'Yesterday',
      reach: 48,
    },
  ]);

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSending(true);
      await api.post('/notifications/admin/broadcast', {
        title,
        message,
        target,
        type,
      });

      alert(`Notification broadcast dispatched to ${target}!`);
      setRecentBroadcasts([
        {
          id: `bc_${Date.now()}`,
          title,
          message,
          target,
          sent_at: 'Just now',
          reach: target === 'All Customers' ? 120 : 35,
        },
        ...recentBroadcasts,
      ]);
      setTitle('');
      setMessage('');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to dispatch broadcast');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">Customer Notifications & Broadcasts</h1>
        <p className="text-xs text-slate-400 mt-1">
          Send real-time alerts, order updates, flash sale announcements, and promotional campaign messages
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Create Broadcast Form (7 cols) */}
        <div className="lg:col-span-7 bg-slate-950 p-6 sm:p-8 rounded-3xl border border-slate-800 space-y-6">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-4">
            <Radio className="w-5 h-5 text-brand-400" />
            <h3 className="font-bold text-white text-base">Dispatch Instant Push & In-App Broadcast</h3>
          </div>

          <form onSubmit={handleSendBroadcast} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-300 font-bold mb-1.5">Notification Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Weekend Vegetable Sale 🥬"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white font-bold"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1.5">Notification Message</label>
              <textarea
                rows={3}
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="e.g. Get 10% OFF on selected vegetables today with free home delivery..."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 font-bold mb-1.5">Target Audience</label>
                <select
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white font-bold"
                >
                  <option value="All Customers">All Registered Customers (120+)</option>
                  <option value="New Customers">New Customers (First Order)</option>
                  <option value="Returning Customers">Returning VIP Customers</option>
                  <option value="Inactive Customers">Inactive (No order in 14 days)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1.5">Notification Category</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white"
                >
                  <option value="PROMOTION">Promotional Offer / Discount</option>
                  <option value="ANNOUNCEMENT">Fresh Harvest Arrival</option>
                  <option value="SYSTEM">Service & Delivery Update</option>
                </select>
              </div>
            </div>

            {/* Quick Templates */}
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block mb-2">
                Quick Template Fill:
              </span>
              <div className="flex flex-wrap gap-2">
                {[
                  {
                    t: 'Morning Fresh Greens 🌿',
                    m: 'Fresh Spinach, Coriander, and Methi harvested at sunrise have arrived at our hub!',
                  },
                  {
                    t: 'Weekend Vegetable Sale 🥬',
                    m: 'Save ₹50 on minimum orders of ₹299 this Saturday & Sunday. Use WELCOME50!',
                  },
                  {
                    t: 'Express 30-Min Delivery Active 🛵',
                    m: 'Order now and receive freshly packed produce right before your lunch preparation.',
                  },
                ].map((tpl, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setTitle(tpl.t);
                      setMessage(tpl.m);
                    }}
                    className="text-[11px] font-semibold bg-slate-900 hover:bg-slate-850 text-slate-300 border border-slate-800 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    {tpl.t}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-3">
              <button
                type="submit"
                disabled={sending}
                className="w-full bg-brand-500 hover:bg-brand-400 disabled:bg-slate-800 text-slate-950 font-black py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-brand-500/20 transition-all text-xs"
              >
                <Send className="w-4 h-4" />
                {sending ? 'Broadcasting...' : `Send Broadcast to ${target}`}
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: In-App Preview & History (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Customer Preview Phone Card */}
          <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 space-y-3">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
              Customer Mobile & Bell Preview
            </span>
            <div className="p-4 rounded-2xl bg-white text-slate-900 shadow-xl space-y-2 border border-slate-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-xs text-brand-800">
                  <span>🥬 FreshVeggies App</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-600"></span>
                  <span className="text-[10px] text-slate-400">now</span>
                </div>
              </div>
              <h4 className="font-black text-sm text-slate-900">{title || 'Your Notification Title'}</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                {message || 'Your notification body copy will be received by all subscribed customers here.'}
              </p>
            </div>
          </div>

          {/* Past Broadcasts Log */}
          <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 space-y-4">
            <h3 className="font-bold text-white text-sm flex items-center gap-2 border-b border-slate-800 pb-3">
              <Clock className="w-4 h-4 text-slate-400" /> Recent Notification Dispatches
            </h3>
            <div className="space-y-3 text-xs">
              {recentBroadcasts.map((b) => (
                <div key={b.id} className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                  <div className="flex justify-between items-start">
                    <h5 className="font-bold text-white">{b.title}</h5>
                    <span className="text-[10px] text-slate-500 font-mono">{b.sent_at}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-2">{b.message}</p>
                  <div className="flex justify-between items-center text-[10px] text-slate-500 pt-1 font-semibold">
                    <span>Target: <strong className="text-brand-400">{b.target}</strong></span>
                    <span>Delivered to {b.reach} devices</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default AdminNotificationsPage;
