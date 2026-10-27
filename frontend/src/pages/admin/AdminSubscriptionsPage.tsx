import React, { useEffect, useState } from 'react';
import {
  Calendar,
  Play,
  RotateCcw,
  CheckCircle,
  Clock,
  Layers,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import api from '../../services/api';
import { Subscription } from '../../types';

export const AdminSubscriptionsPage: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultMsg, setResultMsg] = useState<string | null>(null);

  const fetchSubscriptions = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/subscriptions/admin/all');
      if (res.data?.data) {
        setData(res.data.data);
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

  const handleProcessDue = async () => {
    try {
      setIsProcessing(true);
      const res = await api.post('/subscriptions/admin/process-due');
      if (res.data?.data) {
        setResultMsg(res.data.message || 'Recurring orders successfully processed');
        fetchSubscriptions();
        setTimeout(() => setResultMsg(null), 4000);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Processing failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const metrics = data?.metrics || {
    total_subscriptions: 2,
    active_subscriptions: 1,
    paused_subscriptions: 1,
    total_deliveries_fulfilled: 59,
    recurring_revenue: 9911,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-white tracking-tight">Subscriptions &amp; Recurring Orders</h1>
            <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
              Phase 16
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Automated recurring vegetable baskets, scheduled batch order generation, and subscriber retention.
          </p>
        </div>

        <button
          onClick={handleProcessDue}
          disabled={isProcessing}
          className="bg-brand-500 hover:bg-brand-400 text-slate-950 font-extrabold text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-brand-500/20"
        >
          <RotateCcw className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
          <span>{isProcessing ? 'Generating Orders...' : 'Process Due Subscriptions'}</span>
        </button>
      </div>

      {resultMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs px-4 py-3 rounded-2xl flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span>{resultMsg}</span>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Active Subscriptions</span>
          <p className="text-3xl font-black text-emerald-400">{metrics.active_subscriptions}</p>
          <span className="text-[11px] text-slate-400">Out of {metrics.total_subscriptions} enrolled</span>
        </div>

        <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Recurring Revenue</span>
          <p className="text-3xl font-black text-white">₹{metrics.recurring_revenue.toLocaleString()}</p>
          <span className="text-[11px] text-brand-300 font-bold">Predictable monthly run rate</span>
        </div>

        <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Fulfilled Baskets</span>
          <p className="text-3xl font-black text-white">{metrics.total_deliveries_fulfilled}</p>
          <span className="text-[11px] text-slate-400">Delivered on schedule</span>
        </div>

        <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Paused Baskets</span>
          <p className="text-3xl font-black text-amber-400">{metrics.paused_subscriptions}</p>
          <span className="text-[11px] text-slate-400">Temporary customer pause</span>
        </div>
      </div>

      {/* Subscriptions Table */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-3xl p-6 space-y-4">
        <h3 className="font-extrabold text-sm text-white">All Subscriber Accounts</h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="py-2.5 px-3">Subscriber</th>
                <th className="py-2.5 px-3">Title &amp; Frequency</th>
                <th className="py-2.5 px-3">Delivery Slot</th>
                <th className="py-2.5 px-3">Next Scheduled Date</th>
                <th className="py-2.5 px-3">Amount</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {(data?.subscriptions || []).map((sub: Subscription) => (
                <tr key={sub.id} className="hover:bg-slate-900/50">
                  <td className="py-3 px-3 font-mono text-[11px] text-brand-300">
                    {sub.user_id.slice(0, 8)}...
                  </td>
                  <td className="py-3 px-3">
                    <p className="font-bold text-white">{sub.title}</p>
                    <span className="text-[10px] text-slate-400">{sub.frequency}</span>
                  </td>
                  <td className="py-3 px-3">
                    <p className="text-white font-medium">{sub.delivery_day}</p>
                    <span className="text-[10px] text-slate-400">{sub.delivery_time_slot}</span>
                  </td>
                  <td className="py-3 px-3 font-bold text-brand-400">{sub.next_delivery_date}</td>
                  <td className="py-3 px-3 font-black text-white">₹{sub.amount_per_delivery}</td>
                  <td className="py-3 px-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        sub.status === 'ACTIVE'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-amber-500/20 text-amber-400'
                      }`}
                    >
                      {sub.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
