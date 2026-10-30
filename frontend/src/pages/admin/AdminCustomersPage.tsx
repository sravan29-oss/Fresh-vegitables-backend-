import React, { useState, useEffect } from 'react';
import {
  Search,
  Users,
  Mail,
  Phone,
  ShoppingBag,
  IndianRupee,
  Wallet,
  PlusCircle,
  MinusCircle,
  X,
  CheckCircle,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
} from 'lucide-react';
import api from '../../services/api';

export const AdminCustomersPage: React.FC = () => {
  const [customers, setCustomers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Wallet Management Modal state
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [actionType, setActionType] = useState<'CREDIT' | 'DEBIT'>('CREDIT');
  const [amount, setAmount] = useState<string>('100');
  const [reason, setReason] = useState<string>('Promotional bonus credit');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadCustomers = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/admin/customers', { params: { search } });
      if (res.data?.data) {
        setCustomers(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load customers', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadCustomers();
  };

  const openWalletModal = (customer: any) => {
    setSelectedCustomer(customer);
    setActionType('CREDIT');
    setAmount('100');
    setReason('Customer wallet credit');
    setFeedback(null);
    setIsWalletModalOpen(true);
  };

  const handleWalletSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setFeedback({ type: 'error', message: 'Please enter a valid amount greater than ₹0.' });
      return;
    }

    const currentBalance = Number(selectedCustomer.wallet_balance || 0);
    if (actionType === 'DEBIT' && numAmount > currentBalance) {
      setFeedback({
        type: 'error',
        message: `Cannot deduct ₹${numAmount.toFixed(2)}. Available balance is only ₹${currentBalance.toFixed(2)}.`,
      });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    const adjustmentAmount = actionType === 'CREDIT' ? numAmount : -numAmount;

    try {
      await api.post('/loyalty/admin/adjust', {
        user_id: selectedCustomer.id,
        type: 'WALLET',
        amount: adjustmentAmount,
        reason: reason.trim() || (actionType === 'CREDIT' ? 'Admin wallet bonus' : 'Admin wallet debit'),
      });

      const newBalance = currentBalance + adjustmentAmount;

      // Update state locally immediately
      setCustomers((prev) =>
        prev.map((c) => (c.id === selectedCustomer.id ? { ...c, wallet_balance: newBalance } : c))
      );
      setSelectedCustomer((prev: any) => (prev ? { ...prev, wallet_balance: newBalance } : null));

      setFeedback({
        type: 'success',
        message: `Successfully ${actionType === 'CREDIT' ? 'added' : 'deducted'} ₹${numAmount.toFixed(2)} ${actionType === 'CREDIT' ? 'to' : 'from'} ${selectedCustomer.name}'s wallet. New balance: ₹${newBalance.toFixed(2)}`,
      });

      // Refetch full list
      loadCustomers();

      setTimeout(() => {
        setIsWalletModalOpen(false);
        setFeedback(null);
      }, 1800);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to update customer wallet balance.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const parsedAmount = parseFloat(amount) || 0;
  const currentBal = Number(selectedCustomer?.wallet_balance || 0);
  const calculatedNewBalance =
    actionType === 'CREDIT' ? currentBal + parsedAmount : Math.max(0, currentBal - parsedAmount);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Registered Customers</h1>
          <p className="text-xs text-slate-400 mt-1">
            Directory of customer households, wallet balances, and spending records
          </p>
        </div>

        <button
          onClick={loadCustomers}
          className="self-start sm:self-center px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold flex items-center gap-1.5 border border-slate-800 transition-all cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      <form onSubmit={handleSearchSubmit} className="max-w-md">
        <div className="relative">
          <input
            type="text"
            placeholder="Search by customer name, email, or mobile..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-800 text-white rounded-xl text-xs focus:outline-none focus:border-brand-500"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        </div>
      </form>

      <div className="bg-slate-950 rounded-3xl border border-slate-800 overflow-hidden shadow-sm">
        {isLoading && customers.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400">Loading customers...</div>
        ) : customers.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400">No customers found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px] bg-slate-900/40">
                  <th className="py-3.5 px-4">Customer</th>
                  <th className="py-3.5 px-4">Contact</th>
                  <th className="py-3.5 px-4">Wallet Balance</th>
                  <th className="py-3.5 px-4">Orders Placed</th>
                  <th className="py-3.5 px-4">Total Spent</th>
                  <th className="py-3.5 px-4">Joined Date</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {customers.map((c) => {
                  const walletBal = Number(c.wallet_balance || 0);
                  return (
                    <tr key={c.id} className="hover:bg-slate-900/60 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-brand-500/10 text-brand-400 font-black flex items-center justify-center text-xs">
                            {c.name ? c.name.charAt(0).toUpperCase() : 'U'}
                          </div>
                          <div>
                            <p className="font-bold text-white text-sm">{c.name || 'Anonymous User'}</p>
                            <p className="text-[11px] text-slate-400">{c.email || 'No email provided'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-300 font-mono text-[11px]">
                        {c.mobile || '—'}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-mono font-bold text-xs bg-slate-900/90 border-slate-800">
                          <Wallet className={`w-3.5 h-3.5 ${walletBal > 0 ? 'text-emerald-400' : 'text-slate-500'}`} />
                          <span className={walletBal > 0 ? 'text-emerald-400 font-black' : 'text-slate-400'}>
                            ₹{walletBal.toFixed(2)}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="bg-slate-800 text-slate-200 font-bold px-2.5 py-0.5 rounded-full text-[11px]">
                          {c.order_count || 0} orders
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-black text-brand-400">
                        ₹{parseFloat(c.total_spent || 0).toFixed(0)}
                      </td>
                      <td className="py-3.5 px-4 text-slate-400">
                        {new Date(c.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-emerald-400/10 text-emerald-400">
                          {c.status || 'Active'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => openWalletModal(c)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600/15 hover:bg-emerald-600 text-emerald-400 hover:text-white font-black text-[11px] transition-all cursor-pointer border border-emerald-500/30"
                          title={`Add funds or manage wallet for ${c.name}`}
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                          <span>Add Money</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Manage Customer Wallet Modal ─── */}
      {isWalletModalOpen && selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 text-white w-full max-w-lg rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 relative">
            <button
              type="button"
              onClick={() => setIsWalletModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Wallet className="w-4 h-4" />
                </div>
                <h3 className="font-black text-white text-lg">Manage Customer Wallet</h3>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Credit or debit funds directly into customer's live wallet ledger
              </p>
            </div>

            {/* Customer Info Card */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <p className="font-extrabold text-sm text-white">{selectedCustomer.name}</p>
                <p className="text-xs text-slate-400 mt-0.5">{selectedCustomer.mobile || selectedCustomer.email}</p>
                <p className="text-[10px] text-slate-500 font-mono mt-0.5">ID: {selectedCustomer.id}</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Current Balance</span>
                <p className="text-xl font-black text-white font-mono">
                  ₹{Number(selectedCustomer.wallet_balance || 0).toFixed(2)}
                </p>
              </div>
            </div>

            {feedback && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
                  feedback.type === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                }`}
              >
                {feedback.type === 'success' ? (
                  <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                )}
                <span>{feedback.message}</span>
              </div>
            )}

            <form onSubmit={handleWalletSubmit} className="space-y-4">
              {/* Action Type Toggle */}
              <div>
                <label className="block text-slate-400 font-bold text-xs mb-1.5">Action</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setActionType('CREDIT');
                      setReason('Customer wallet bonus');
                    }}
                    className={`py-2 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                      actionType === 'CREDIT'
                        ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-600/30'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
                    <span>+ Add Funds (Credit)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActionType('DEBIT');
                      setReason('Manual wallet adjustment');
                    }}
                    className={`py-2 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                      actionType === 'DEBIT'
                        ? 'bg-rose-600 text-white border-rose-500 shadow-md shadow-rose-600/30'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    <ArrowDownRight className="w-4 h-4 stroke-[2.5]" />
                    <span>- Deduct Funds (Debit)</span>
                  </button>
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div>
                <label className="block text-slate-400 font-bold text-xs mb-1.5">Quick Presets</label>
                <div className="flex flex-wrap gap-2">
                  {[50, 100, 200, 500, 1000].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setAmount(preset.toString())}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-bold transition-all cursor-pointer ${
                        amount === preset.toString()
                          ? 'bg-brand-500 text-slate-950 border-brand-400'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      {actionType === 'CREDIT' ? '+' : '-'}₹{preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount Input */}
              <div>
                <label className="block text-slate-400 font-bold text-xs mb-1.5">
                  Amount (₹ INR) <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full pl-8 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl font-mono text-white text-sm font-bold focus:outline-none focus:border-brand-500"
                    placeholder="Enter amount"
                  />
                </div>
              </div>

              {/* Reason / Note */}
              <div>
                <label className="block text-slate-400 font-bold text-xs mb-1.5">Audit Reason / Note</label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-brand-500"
                  placeholder="e.g. Promotional bonus, Offline refund, Goodwill credit"
                />
              </div>

              {/* Balance Impact Preview */}
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-between text-xs">
                <span className="text-slate-400">Balance After Update:</span>
                <span
                  className={`font-mono font-black text-sm ${
                    actionType === 'CREDIT' ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  ₹{calculatedNewBalance.toFixed(2)}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsWalletModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || parsedAmount <= 0}
                  className={`px-5 py-2.5 rounded-xl font-black text-xs flex items-center gap-2 transition-all cursor-pointer shadow-lg ${
                    actionType === 'CREDIT'
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/25'
                      : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/25'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Updating Wallet...</span>
                    </>
                  ) : (
                    <>
                      <Wallet className="w-3.5 h-3.5" />
                      <span>
                        Confirm {actionType === 'CREDIT' ? 'Credit (+₹' : 'Debit (-₹'}
                        {parsedAmount.toFixed(0)})
                      </span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCustomersPage;
