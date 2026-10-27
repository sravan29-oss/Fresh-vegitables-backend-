import React, { useEffect, useState } from 'react';
import {
  Store,
  Plus,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  TrendingUp,
  Percent,
  Check,
  Building,
} from 'lucide-react';
import api from '../../services/api';
import { Seller, SellerPayout } from '../../types';

export const AdminSellersPage: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);
  const [selectedSeller, setSelectedSeller] = useState<Seller | null>(null);
  const [payoutAmount, setPayoutAmount] = useState<number>(10000);
  const [msg, setMsg] = useState<string | null>(null);

  // New seller form state
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('Hyderabad');
  const [commission, setCommission] = useState(10);

  const fetchSellers = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/sellers');
      if (res.data?.data) {
        setData(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load sellers', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSellers();
  }, []);

  const handleVerify = async (id: string, status: 'VERIFIED' | 'REJECTED') => {
    try {
      await api.patch(`/sellers/${id}/verify`, { status });
      showToast(`Seller marked as ${status}`);
      fetchSellers();
    } catch (err) {
      alert('Verification status update failed');
    }
  };

  const handleCreateSeller = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post('/sellers', {
        business_name: businessName,
        owner_name: ownerName,
        phone,
        city,
        commission_percentage: commission,
      });
      if (res.data?.data) {
        setIsAddModalOpen(false);
        showToast('New seller partner onboarded');
        fetchSellers();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create seller');
    }
  };

  const handleDisbursePayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSeller) return;
    try {
      const res = await api.post('/sellers/payouts', {
        seller_id: selectedSeller.id,
        amount: payoutAmount,
      });
      if (res.data?.data) {
        setIsPayoutModalOpen(false);
        showToast('Seller payout disbursed via NEFT simulation');
        fetchSellers();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Payout failed');
    }
  };

  const showToast = (message: string) => {
    setMsg(message);
    setTimeout(() => setMsg(null), 3000);
  };

  const metrics = data?.metrics || {
    total_sellers: 3,
    active_sellers: 3,
    verified_sellers: 2,
    total_payouts_disbursed: 41400,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-white tracking-tight">
              Seller &amp; Supplier Partners
            </h1>
            <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
              Phase 17
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Local farmers collective, multi-supplier onboarding, automated commission splitting, and vendor payouts.
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="bg-brand-500 hover:bg-brand-400 text-slate-950 font-extrabold text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-brand-500/20"
        >
          <Plus className="w-4 h-4" />
          <span>Onboard Farmer / Seller</span>
        </button>
      </div>

      {msg && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs px-4 py-2.5 rounded-xl flex items-center gap-2">
          <Check className="w-4 h-4" />
          <span>{msg}</span>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Sellers</span>
          <p className="text-3xl font-black text-white">{metrics.total_sellers}</p>
          <span className="text-[11px] text-emerald-400 font-bold">{metrics.verified_sellers} Verified</span>
        </div>

        <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Disbursed Payouts</span>
          <p className="text-3xl font-black text-emerald-400">₹{metrics.total_payouts_disbursed.toLocaleString()}</p>
          <span className="text-[11px] text-slate-400">Net after platform commission</span>
        </div>

        <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Avg Commission</span>
          <p className="text-3xl font-black text-brand-400">8%–10%</p>
          <span className="text-[11px] text-slate-400">Configured per vendor</span>
        </div>

        <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Marketplace Mode</span>
          <p className="text-xl font-black text-white mt-2">Active Ready</p>
          <span className="text-[11px] text-brand-300">Split fulfillment enabled</span>
        </div>
      </div>

      {/* Sellers List Table */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-3xl p-6 space-y-4">
        <h3 className="font-extrabold text-sm text-white">Registered Farmers &amp; Vendors</h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="py-2.5 px-3">Farm / Business</th>
                <th className="py-2.5 px-3">Owner &amp; City</th>
                <th className="py-2.5 px-3">Commission</th>
                <th className="py-2.5 px-3">Pending Payout</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {(data?.sellers || []).map((s: Seller) => (
                <tr key={s.id} className="hover:bg-slate-900/50">
                  <td className="py-3 px-3">
                    <p className="font-bold text-white text-sm">{s.business_name}</p>
                    <span className="text-[10px] text-slate-400">{s.phone}</span>
                  </td>
                  <td className="py-3 px-3">
                    <p className="text-slate-300 font-medium">{s.owner_name}</p>
                    <span className="text-[10px] text-slate-400">{s.city}, {s.state}</span>
                  </td>
                  <td className="py-3 px-3 font-mono font-bold text-brand-400">
                    {s.commission_percentage}%
                  </td>
                  <td className="py-3 px-3 font-mono font-bold text-white">
                    ₹{(s.pending_payout || 0).toLocaleString()}
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        s.verification_status === 'VERIFIED'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-amber-500/20 text-amber-400'
                      }`}
                    >
                      {s.verification_status}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right space-x-2">
                    {s.verification_status === 'PENDING' ? (
                      <button
                        onClick={() => handleVerify(s.id, 'VERIFIED')}
                        className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 px-2.5 py-1 rounded text-xs font-bold"
                      >
                        Verify
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setSelectedSeller(s);
                          setPayoutAmount(s.pending_payout || 10000);
                          setIsPayoutModalOpen(true);
                        }}
                        className="bg-brand-500/20 text-brand-400 hover:bg-brand-500/30 px-2.5 py-1 rounded text-xs font-bold"
                      >
                        Pay Out
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Onboard Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 text-white w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-4">
            <h3 className="font-extrabold text-white text-base">Onboard Farm / Supplier Partner</h3>

            <form onSubmit={handleCreateSeller} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-400 font-bold mb-1">Farm / Business Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Purandar Organic Agro Collective"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Farmer / Owner Name</label>
                <input
                  type="text"
                  required
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Phone</label>
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">City</label>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Platform Commission (%)</label>
                <input
                  type="number"
                  required
                  value={commission}
                  onChange={(e) => setCommission(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-black"
                >
                  Confirm Onboarding
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Disburse Payout Modal */}
      {isPayoutModalOpen && selectedSeller && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 text-white w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-4">
            <h3 className="font-extrabold text-white text-base">Disburse Seller Payout</h3>
            <p className="text-xs text-slate-400">
              Vendor: <strong className="text-white">{selectedSeller.business_name}</strong>
            </p>

            <form onSubmit={handleDisbursePayout} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 font-bold mb-1">Gross Sales Amount (₹)</label>
                <input
                  type="number"
                  required
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono text-sm"
                />
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1.5 text-[11px]">
                <div className="flex justify-between text-slate-400">
                  <span>Gross Sales:</span>
                  <span>₹{payoutAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-brand-400">
                  <span>Platform Commission ({selectedSeller.commission_percentage}%):</span>
                  <span>-₹{((payoutAmount * selectedSeller.commission_percentage) / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-white font-bold border-t border-slate-800 pt-1">
                  <span>Net Farmer Disbursal:</span>
                  <span>
                    ₹{(payoutAmount - (payoutAmount * selectedSeller.commission_percentage) / 100).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsPayoutModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black"
                >
                  Disburse NEFT Payout
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
