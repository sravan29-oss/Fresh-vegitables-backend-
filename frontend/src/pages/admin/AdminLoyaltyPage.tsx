import React, { useEffect, useState } from 'react';
import {
  Wallet,
  Award,
  Users,
  PlusCircle,
  MinusCircle,
  Search,
  Check,
  ShieldAlert,
} from 'lucide-react';
import api from '../../services/api';

export const AdminLoyaltyPage: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [adjustType, setAdjustType] = useState<'WALLET' | 'POINTS'>('WALLET');
  const [adjustAmount, setAdjustAmount] = useState<number>(50);
  const [adjustReason, setAdjustReason] = useState<string>('Appreciation credit');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const fetchOverview = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/loyalty/admin/overview');
      if (res.data?.data) {
        setData(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load admin loyalty overview', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    try {
      await api.post('/loyalty/admin/adjust', {
        user_id: selectedUser,
        type: adjustType,
        amount: adjustAmount,
        reason: adjustReason,
      });
      setMsg(`Successfully adjusted ${adjustType} for user!`);
      setIsModalOpen(false);
      fetchOverview();
      setTimeout(() => setMsg(null), 3000);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Adjustment failed');
    }
  };

  const metrics = data?.metrics || {
    total_wallets: 2,
    total_wallet_liabilities: 300,
    total_loyalty_accounts: 2,
    total_points_outstanding: 460,
    total_referrals: 1,
    successful_referrals: 1,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-white tracking-tight">
              Loyalty, Wallets &amp; Referrals
            </h1>
            <span className="text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold">
              Phase 15
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Track user wallet liabilities, reward points distribution, and referral attribution.
          </p>
        </div>

        <button
          onClick={() => {
            setSelectedUser(data?.wallets?.[0]?.user_id || '11111111-1111-1111-1111-111111111111');
            setIsModalOpen(true);
          }}
          className="bg-brand-500 hover:bg-brand-400 text-slate-950 font-extrabold text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-brand-500/20"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Manual Adjustment</span>
        </button>
      </div>

      {msg && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs px-4 py-2.5 rounded-xl flex items-center gap-2">
          <Check className="w-4 h-4" />
          <span>{msg}</span>
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Wallet Liabilities</span>
            <Wallet className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-3xl font-black text-white">₹{metrics.total_wallet_liabilities.toFixed(2)}</p>
          <p className="text-[11px] text-slate-400">{metrics.total_wallets} active customer wallets</p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Outstanding Points</span>
            <Award className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-3xl font-black text-white">{metrics.total_points_outstanding} Pts</p>
          <p className="text-[11px] text-slate-400">{metrics.total_loyalty_accounts} loyalty accounts</p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Referral Conversions</span>
            <Users className="w-4 h-4 text-brand-400" />
          </div>
          <p className="text-3xl font-black text-white">{metrics.successful_referrals}</p>
          <p className="text-[11px] text-slate-400">{metrics.total_referrals} total invite codes used</p>
        </div>
      </div>

      {/* Customer Wallets Table */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-3xl p-6 space-y-4">
        <h3 className="font-extrabold text-sm text-white">Customer Wallets &amp; Balance Ledger</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="py-2.5 px-3">User ID</th>
                <th className="py-2.5 px-3">Balance</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Last Activity</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {(data?.wallets || []).map((w: any) => (
                <tr key={w.id} className="hover:bg-slate-900/50">
                  <td className="py-3 px-3 font-mono text-[11px] text-brand-300">{w.user_id}</td>
                  <td className="py-3 px-3 font-black text-white">₹{Number(w.balance).toFixed(2)}</td>
                  <td className="py-3 px-3">
                    <span className="bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded text-[10px] font-bold">
                      ACTIVE
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-400 text-[11px]">
                    {new Date(w.updated_at || w.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <button
                      onClick={() => {
                        setSelectedUser(w.user_id);
                        setIsModalOpen(true);
                      }}
                      className="text-brand-400 hover:underline font-bold text-xs"
                    >
                      Adjust
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Adjustment Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 text-white w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-4">
            <h3 className="font-extrabold text-white text-base">Adjust Customer Rewards</h3>

            <form onSubmit={handleAdjustSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 font-bold mb-1">Customer User ID</label>
                <input
                  type="text"
                  required
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 font-mono text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Adjustment Type</label>
                <select
                  value={adjustType}
                  onChange={(e) => setAdjustType(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                >
                  <option value="WALLET">Wallet Funds (₹ INR)</option>
                  <option value="POINTS">Loyalty Points</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">
                  Amount (Positive to Credit, Negative to Debit)
                </label>
                <input
                  type="number"
                  required
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Audit Reason</label>
                <input
                  type="text"
                  required
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
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
                  className="px-5 py-2 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-black"
                >
                  Confirm Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
