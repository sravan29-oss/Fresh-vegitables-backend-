import React, { useState, useEffect, useCallback } from 'react';
import {
  CreditCard,
  Banknote,
  RotateCcw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Search,
  Filter,
  DollarSign,
  ArrowUpRight,
  RefreshCw,
  Sliders,
  ShieldCheck,
  Calendar,
  Check,
  TrendingUp,
  Receipt,
  Clock,
  ArrowRight,
  Save,
  Info,
  CheckCircle2,
  Lock,
  Layers,
} from 'lucide-react';
import api from '../../services/api';
import {
  Payment,
  StorePaymentSettings,
  PaymentOverviewMetrics,
  PaymentTransactionLog,
} from '../../types';
import { notifyLiveUpdate } from '../../services/liveSync';

interface AdminPaymentsPageProps {
  initialTab?: 'overview' | 'settings' | 'logs';
}

export const AdminPaymentsPage: React.FC<AdminPaymentsPageProps> = ({ initialTab = 'overview' }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'settings' | 'logs'>(initialTab);

  // Payments and logs state
  const [payments, setPayments] = useState<Payment[]>([]);
  const [transactionsLog, setTransactionsLog] = useState<PaymentTransactionLog[]>([]);
  const [metrics, setMetrics] = useState<PaymentOverviewMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [methodFilter, setMethodFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState<'today' | 'yesterday' | '7days' | '30days' | 'all'>('all');

  // COD Collection Modal State
  const [codModalOrder, setCodModalOrder] = useState<any | null>(null);
  const [codAmount, setCodAmount] = useState<number>(0);
  const [codNotes, setCodNotes] = useState<string>('Cash collected upon home delivery');
  const [codSubmitting, setCodSubmitting] = useState(false);

  // Refund Modal State
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [refundAmount, setRefundAmount] = useState<number>(0);
  const [refundReason, setRefundReason] = useState('Customer cancelled / damaged greens');
  const [refundSubmitting, setRefundSubmitting] = useState(false);

  // Payment Settings State (Admin → Settings → Payment Management)
  const [paymentSettings, setPaymentSettings] = useState<StorePaymentSettings>({
    id: 'global_payment_settings',
    cod_enabled: true,
    cod_message: 'Pay with cash or UPI QR upon delivery',
    cod_min_amount: 0,
    cod_max_amount: 5000,
    cod_fee: 0,
    online_enabled: true,
    online_gateway_name: 'Razorpay / Cards & UPI',
    online_message: 'Pay securely using UPI, Cards, or NetBanking',
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsSavedToast, setSettingsSavedToast] = useState(false);

  // Sync tab with props
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const fetchPaymentData = useCallback(async () => {
    try {
      setLoading(true);
      const [allRes, overviewRes, settingsRes] = await Promise.all([
        api.get('/payments/admin/all').catch(() => null),
        api.get('/payments/admin/overview', { params: { range: dateRange } }).catch(() => null),
        api.get('/payments/settings').catch(() => null),
      ]);

      if (allRes?.data?.data) {
        setPayments(allRes.data.data.payments || []);
        setTransactionsLog(allRes.data.data.transactions_log || []);
      }

      if (overviewRes?.data?.data) {
        setMetrics(overviewRes.data.data);
      }

      if (settingsRes?.data?.data) {
        setPaymentSettings(settingsRes.data.data);
      }
    } catch (err) {
      console.error('Failed to load payment data:', err);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchPaymentData();
  }, [fetchPaymentData]);

  // Save Payment Settings
  const handleSaveSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      setIsSavingSettings(true);
      const res = await api.put('/payments/settings', paymentSettings);
      if (res.data?.data) {
        setPaymentSettings(res.data.data);
        notifyLiveUpdate('payments');
        setSettingsSavedToast(true);
        setTimeout(() => setSettingsSavedToast(false), 3500);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update payment settings');
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Record COD Collection
  const handleOpenCodCollect = (orderId: string, amount: number) => {
    setCodModalOrder({ order_id: orderId, amount });
    setCodAmount(amount);
  };

  const handleSubmitCodCollect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codModalOrder) return;
    try {
      setCodSubmitting(true);
      await api.post('/payments/cod-collect', {
        order_id: codModalOrder.order_id,
        amount: codAmount,
        notes: codNotes,
      });
      setCodModalOrder(null);
      fetchPaymentData();
      notifyLiveUpdate('orders');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to record COD collection');
    } finally {
      setCodSubmitting(false);
    }
  };

  // Process Refund
  const handleOpenRefund = (p: Payment) => {
    setSelectedPayment(p);
    setRefundAmount(p.amount);
  };

  const handleProcessRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPayment) return;
    try {
      setRefundSubmitting(true);
      await api.post(`/payments/${selectedPayment.id}/refund`, {
        amount: refundAmount,
        reason: refundReason,
      });
      setSelectedPayment(null);
      fetchPaymentData();
      notifyLiveUpdate('orders');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Refund failed');
    } finally {
      setRefundSubmitting(false);
    }
  };

  // Filtered Payments
  const filteredPayments = payments.filter((p) => {
    const status = (p.payment_status || '').toUpperCase();
    const method = (p.payment_method || '').toLowerCase();
    const matchStatus = statusFilter === 'ALL' || status === statusFilter;
    const matchMethod = methodFilter === 'ALL' || method === methodFilter.toLowerCase();
    const matchSearch =
      (p.id || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.order_id || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.payment_method || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.gateway_payment_id || '').toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchMethod && matchSearch;
  });

  // Determine current active scenario (1 of 4 combinations)
  const currentScenario =
    paymentSettings.cod_enabled && paymentSettings.online_enabled
      ? 'both'
      : paymentSettings.cod_enabled && !paymentSettings.online_enabled
      ? 'cod_only'
      : !paymentSettings.cod_enabled && paymentSettings.online_enabled
      ? 'online_only'
      : 'neither';

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header and Quick Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Payments &amp; Collections
            </h1>
            <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
              Live Ledger
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Admin-controlled payment channels (COD &amp; Online), verified revenue, and audit history.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchPaymentData()}
            disabled={loading}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all border border-slate-700 flex items-center gap-1.5 text-xs font-bold"
            title="Refresh payment records"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-brand-400' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-black transition-all ${
              activeTab === 'settings'
                ? 'bg-brand-500 text-slate-950 shadow-md shadow-brand-500/20'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Payment Controls</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all ${
            activeTab === 'overview'
              ? 'bg-brand-500 text-slate-950 shadow-md shadow-brand-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>Verified Revenue &amp; Ledger</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all ${
            activeTab === 'settings'
              ? 'bg-brand-500 text-slate-950 shadow-md shadow-brand-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Admin Payment Controls</span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all ${
            activeTab === 'logs'
              ? 'bg-brand-500 text-slate-950 shadow-md shadow-brand-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Audit Trail ({transactionsLog.length})</span>
        </button>
      </div>

      {/* =========================================================================
          TAB 1: VERIFIED REVENUE & LIVE PAYMENTS LEDGER
         ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Date Filter & Reporting Scope */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
              <Calendar className="w-4 h-4 text-brand-400" />
              <span>Revenue Date Filter:</span>
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {[
                { id: 'today', label: 'Today' },
                { id: 'yesterday', label: 'Yesterday' },
                { id: '7days', label: 'Last 7 Days' },
                { id: '30days', label: 'Last 30 Days' },
                { id: 'all', label: 'All Records' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setDateRange(f.id as any)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-xl whitespace-nowrap transition-all ${
                    dateRange === f.id
                      ? 'bg-brand-500 text-slate-950 font-black shadow-xs'
                      : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-850 border border-slate-800'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Key Revenue & Collection KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            {/* Total Verified Revenue */}
            <div className="bg-slate-950/90 border border-emerald-500/30 p-4 sm:p-5 rounded-2xl space-y-1">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <span>Total Verified Revenue</span>
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-black text-emerald-400">
                ₹{(metrics?.total_verified_revenue ?? 0).toLocaleString('en-IN')}
              </div>
              <div className="text-[10px] text-slate-500 font-medium">Actual collected cash + online gateway</div>
            </div>

            {/* COD Collected */}
            <div className="bg-slate-950/90 border border-slate-800 p-4 sm:p-5 rounded-2xl space-y-1">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <span>COD Collected</span>
                <Banknote className="w-4 h-4 text-brand-400" />
              </div>
              <div className="text-2xl font-black text-white">
                ₹{(metrics?.cod_collected?.amount ?? 0).toLocaleString('en-IN')}
              </div>
              <div className="text-[10px] text-slate-500 font-medium">
                {metrics?.cod_collected?.count ?? 0} orders confirmed by staff
              </div>
            </div>

            {/* COD Pending Collection */}
            <div className="bg-slate-950/90 border border-slate-800 p-4 sm:p-5 rounded-2xl space-y-1">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <span>COD Pending Collection</span>
                <Clock className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-black text-amber-400">
                ₹{(metrics?.cod_pending_collection?.amount ?? 0).toLocaleString('en-IN')}
              </div>
              <div className="text-[10px] text-slate-500 font-medium">
                {metrics?.cod_pending_collection?.count ?? 0} orders awaiting doorstep cash
              </div>
            </div>

            {/* Failed & Refunds */}
            <div className="bg-slate-950/90 border border-slate-800 p-4 sm:p-5 rounded-2xl space-y-1">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <span>Failed &amp; Refunds</span>
                <RotateCcw className="w-4 h-4 text-rose-400" />
              </div>
              <div className="text-2xl font-black text-rose-400">
                ₹{(metrics?.refunds?.amount ?? 0).toLocaleString('en-IN')}
              </div>
              <div className="text-[10px] text-slate-500 font-medium">
                {metrics?.refunds?.count ?? 0} refunds • {metrics?.failed_online_payments?.count ?? 0} failed attempts
              </div>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by Payment ID, Order #, or Gateway ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto">
              {/* Method filter */}
              <select
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
              >
                <option value="ALL">All Methods</option>
                <option value="cod">Cash on Delivery (COD)</option>
                <option value="online">Online Cards/NetBanking</option>
                <option value="upi">Instant UPI</option>
              </select>

              {/* Status filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="PAID">Paid / Verified</option>
                <option value="PENDING">Pending</option>
                <option value="AWAITING_COD">Awaiting COD</option>
                <option value="FAILED">Failed</option>
                <option value="REFUNDED">Refunded</option>
              </select>
            </div>
          </div>

          {/* Payments Table & Cards View */}
          <div className="bg-slate-950/90 rounded-3xl border border-slate-800 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Receipt className="w-4 h-4 text-brand-400" />
                <span>Transaction Records ({filteredPayments.length})</span>
              </h3>
              <span className="text-[11px] text-slate-500">Live database ledger</span>
            </div>

            {filteredPayments.length === 0 ? (
              <div className="text-center py-12 text-xs text-slate-500 space-y-1">
                <p>No payment records match your filters.</p>
              </div>
            ) : (
              <>
                {/* Desktop View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px] font-black">
                        <th className="py-2.5 px-3">Payment ID</th>
                        <th className="py-2.5 px-3">Order #</th>
                        <th className="py-2.5 px-3">Method</th>
                        <th className="py-2.5 px-3">Amount</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Gateway Ref</th>
                        <th className="py-2.5 px-3">Timestamp</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-medium text-slate-300">
                      {filteredPayments.map((p) => {
                        const isPaid = (p.payment_status || '').toUpperCase() === 'PAID';
                        const isCod = (p.payment_method || '').toLowerCase() === 'cod';

                        return (
                          <tr key={p.id} className="hover:bg-slate-900/50 transition-colors">
                            <td className="py-3 px-3 font-mono font-bold text-white text-[11px]">
                              {p.id.slice(0, 10)}...
                            </td>
                            <td className="py-3 px-3 font-mono font-bold text-slate-200">
                              #{p.order_id ? p.order_id.slice(0, 8) : 'ORD'}
                            </td>
                            <td className="py-3 px-3">
                              <span className="font-bold uppercase text-[10px] px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800">
                                {p.payment_method}
                              </span>
                            </td>
                            <td className="py-3 px-3 font-mono font-black text-brand-400">
                              ₹{p.amount}
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className={`text-[10px] font-black px-2.5 py-0.5 rounded-full capitalize ${
                                  isPaid
                                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                    : (p.payment_status || '').toUpperCase() === 'FAILED'
                                    ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                                    : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                }`}
                              >
                                {p.payment_status}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-slate-500 font-mono text-[10px] truncate max-w-[120px]">
                              {p.gateway_payment_id || '—'}
                            </td>
                            <td className="py-3 px-3 text-slate-400 text-[11px] whitespace-nowrap">
                              {new Date(p.created_at).toLocaleDateString([], {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </td>
                            <td className="py-3 px-3 text-right space-x-2">
                              {/* If COD and not yet paid, allow recording collection */}
                              {isCod && !isPaid && (
                                <button
                                  onClick={() => handleOpenCodCollect(p.order_id, p.amount)}
                                  className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 px-2.5 py-1 rounded-lg border border-emerald-500/20 transition-all cursor-pointer"
                                >
                                  Collect COD
                                </button>
                              )}

                              {isPaid && (
                                <button
                                  onClick={() => handleOpenRefund(p)}
                                  className="text-[11px] font-bold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 px-2.5 py-1 rounded-lg border border-rose-500/20 transition-all cursor-pointer"
                                >
                                  Refund
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards View */}
                <div className="md:hidden space-y-3">
                  {filteredPayments.map((p) => {
                    const isPaid = (p.payment_status || '').toUpperCase() === 'PAID';
                    const isCod = (p.payment_method || '').toLowerCase() === 'cod';

                    return (
                      <div
                        key={p.id}
                        className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-xs text-white">
                            #{p.order_id ? p.order_id.slice(0, 8) : 'ORD'}
                          </span>
                          <span className="font-mono font-black text-brand-400 text-sm">
                            ₹{p.amount}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span className="uppercase font-bold">{p.payment_method}</span>
                          <span
                            className={`font-black text-[10px] px-2 py-0.5 rounded-full capitalize ${
                              isPaid
                                ? 'bg-emerald-500/15 text-emerald-300'
                                : 'bg-amber-500/15 text-amber-300'
                            }`}
                          >
                            {p.payment_status}
                          </span>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-[11px] text-slate-500">
                          <span>{new Date(p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          <div className="flex items-center gap-2">
                            {isCod && !isPaid && (
                              <button
                                onClick={() => handleOpenCodCollect(p.order_id, p.amount)}
                                className="text-emerald-400 font-bold px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20"
                              >
                                Collect COD
                              </button>
                            )}
                            {isPaid && (
                              <button
                                onClick={() => handleOpenRefund(p)}
                                className="text-rose-400 font-bold px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20"
                              >
                                Refund
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: ADMIN PAYMENT CONTROLS (COD & ONLINE GATEWAY)
         ========================================================================= */}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-3xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="text-[11px] font-black uppercase tracking-wider text-brand-400 flex items-center gap-2">
                  <span>Admin</span>
                  <span>→</span>
                  <span>Settings</span>
                  <span>→</span>
                  <span>Payment Management</span>
                </div>
                <h2 className="text-xl font-black text-white tracking-tight mt-1 flex items-center gap-2.5">
                  <Sliders className="w-5 h-5 text-brand-400" />
                  Admin-Controlled Payment Methods
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Enable or disable Cash on Delivery and Online Payments independently. Changes apply dynamically across customer checkout with backend enforcement.
                </p>
              </div>

              {/* Toast message if saved */}
              {settingsSavedToast && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold shadow-xs animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Payment settings saved live!</span>
                </div>
              )}
            </div>

            {/* Current Active Scenario Box */}
            <div
              className={`p-4 rounded-2xl border text-xs space-y-1.5 transition-all ${
                currentScenario === 'both'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                  : currentScenario === 'cod_only'
                  ? 'bg-brand-500/10 border-brand-500/30 text-brand-200'
                  : currentScenario === 'online_only'
                  ? 'bg-sky-500/10 border-sky-500/30 text-sky-200'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-200'
              }`}
            >
              <div className="font-black flex items-center gap-2 uppercase tracking-wide">
                <ShieldCheck className="w-4 h-4" />
                <span>
                  Active Mode:{' '}
                  {currentScenario === 'both'
                    ? 'Both Payment Methods Active (COD + Online)'
                    : currentScenario === 'cod_only'
                    ? 'Cash on Delivery (COD) Only Active'
                    : currentScenario === 'online_only'
                    ? 'Online Payments Only Active'
                    : 'All Payments Disabled — Checkout Temporarily Paused'}
                </span>
              </div>
              <p className="text-[11px] opacity-90 leading-relaxed">
                {currentScenario === 'both' &&
                  'Customers can choose freely between Cash on Delivery or Instant Online Cards/UPI.'}
                {currentScenario === 'cod_only' &&
                  'Only Cash on Delivery will appear in customer checkout. Online payment options are hidden.'}
                {currentScenario === 'online_only' &&
                  'Only Online Cards & UPI gateway will appear. Cash on Delivery is disabled.'}
                {currentScenario === 'neither' &&
                  'Store checkout displays: “Sorry, we are temporarily not accepting orders. Please check again later.” Orders cannot be placed.'}
              </p>
            </div>
          </div>

          {/* Two Configuration Cards Grid */}
          <form onSubmit={handleSaveSettings} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* ─── CARD A: CASH ON DELIVERY (COD) ─── */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-3xl p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-brand-500/10 text-brand-400 flex items-center justify-center">
                    <Banknote className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white">A. Cash on Delivery (COD)</h3>
                    <p className="text-[11px] text-slate-400">Doorstep cash &amp; UPI collection</p>
                  </div>
                </div>

                {/* Toggle Switch */}
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={paymentSettings.cod_enabled}
                    onChange={(e) =>
                      setPaymentSettings((prev) => ({ ...prev, cod_enabled: e.target.checked }))
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-500"></div>
                </label>
              </div>

              <div className="space-y-4">
                {/* Availability message */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">
                    COD Availability Message (Shown in Checkout)
                  </label>
                  <input
                    type="text"
                    value={paymentSettings.cod_message}
                    onChange={(e) =>
                      setPaymentSettings((prev) => ({ ...prev, cod_message: e.target.value }))
                    }
                    placeholder="Pay with cash or UPI QR upon delivery"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                  />
                </div>

                {/* Min & Max Order Amount Row */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300">
                      Min COD Amount (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={paymentSettings.cod_min_amount}
                      onChange={(e) =>
                        setPaymentSettings((prev) => ({
                          ...prev,
                          cod_min_amount: Number(e.target.value),
                        }))
                      }
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-brand-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300">
                      Max COD Amount (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={paymentSettings.cod_max_amount}
                      onChange={(e) =>
                        setPaymentSettings((prev) => ({
                          ...prev,
                          cod_max_amount: Number(e.target.value),
                        }))
                      }
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-brand-500"
                    />
                  </div>
                </div>

                {/* Optional COD Handling Fee */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">
                    Optional COD Handling Fee (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={paymentSettings.cod_fee}
                    onChange={(e) =>
                      setPaymentSettings((prev) => ({
                        ...prev,
                        cod_fee: Number(e.target.value),
                      }))
                    }
                    placeholder="0"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-brand-500"
                  />
                  <span className="text-[10px] text-slate-500 block">
                    Set to 0 for free COD. Any positive fee will be added automatically to the order total.
                  </span>
                </div>
              </div>

              {/* Status Note */}
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 text-[11px] text-slate-400">
                <span className="font-bold text-slate-300">COD Lifecycle Rule:</span>
                <p className="mt-0.5">
                  When a COD order is placed, it is created with status <code className="text-amber-400 font-mono">awaiting_cod_collection</code>. It is only marked <code className="text-emerald-400 font-mono">cod_collected</code> when confirmed by delivery personnel or admin.
                </p>
              </div>
            </div>

            {/* ─── CARD B: ONLINE PAYMENTS ─── */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-3xl p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white">B. Online Payments</h3>
                    <p className="text-[11px] text-slate-400">Cards, UPI &amp; NetBanking Gateway</p>
                  </div>
                </div>

                {/* Toggle Switch */}
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={paymentSettings.online_enabled}
                    onChange={(e) =>
                      setPaymentSettings((prev) => ({ ...prev, online_enabled: e.target.checked }))
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-500"></div>
                </label>
              </div>

              <div className="space-y-4">
                {/* Gateway Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">
                    Supported Payment Gateway Provider
                  </label>
                  <input
                    type="text"
                    value={paymentSettings.online_gateway_name}
                    onChange={(e) =>
                      setPaymentSettings((prev) => ({
                        ...prev,
                        online_gateway_name: e.target.value,
                      }))
                    }
                    placeholder="Razorpay / Cards & UPI"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                  />
                </div>

                {/* Customer Checkout Message */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">
                    Online Payment Instructions (Checkout)
                  </label>
                  <input
                    type="text"
                    value={paymentSettings.online_message}
                    onChange={(e) =>
                      setPaymentSettings((prev) => ({
                        ...prev,
                        online_message: e.target.value,
                      }))
                    }
                    placeholder="Pay securely using UPI, Cards, or NetBanking"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                  />
                </div>

                {/* Gateway Handling Rules */}
                <div className="space-y-2 pt-1 text-xs">
                  <span className="font-bold text-slate-300 block">Gateway Handling Rules:</span>
                  <div className="space-y-1 text-[11px] text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                      <span><strong>Success:</strong> Verified cryptographically on backend; marks order <code className="text-emerald-400 font-mono">paid</code>.</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                      <span><strong>Failure:</strong> Logs failure attempt; order remains unpaid without capturing funds.</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                      <span><strong>Pending:</strong> Safely awaits provider webhook or explicit customer return verification.</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Note */}
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 text-[11px] text-slate-400">
                <span className="font-bold text-slate-300">Backend Boundary Enforcement:</span>
                <p className="mt-0.5">
                  If online payments are toggled OFF, any client attempt to initiate payment via <code className="text-sky-400 font-mono">POST /api/payments/create</code> is immediately rejected with an HTTP 400 error.
                </p>
              </div>
            </div>

            {/* Save Buttons Section (Full Width) */}
            <div className="md:col-span-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/90 border border-slate-800 p-4 rounded-2xl">
              <div className="text-xs text-slate-400">
                Changes persist centrally in database &amp; configuration files. All customer checkouts receive updates immediately.
              </div>
              <button
                type="submit"
                disabled={isSavingSettings}
                className="bg-brand-500 hover:bg-brand-400 text-slate-950 font-black text-xs px-6 py-3 rounded-xl shadow-lg shadow-brand-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSavingSettings ? 'Enforcing...' : 'Save Payment Settings'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =========================================================================
          TAB 3: ORDER-LEVEL PAYMENT TRANSACTION AUDIT TRAIL
         ========================================================================= */}
      {activeTab === 'logs' && (
        <div className="bg-slate-950/90 rounded-3xl border border-slate-800 p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-brand-400" />
                <span>Payment Audit History &amp; State Transitions</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Immutable chronological log of payment state changes, collections, and refunds
              </p>
            </div>
          </div>

          {transactionsLog.length === 0 ? (
            <div className="text-center py-12 text-xs text-slate-500">
              No transactions recorded in the audit trail yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px] font-black">
                    <th className="py-2.5 px-3">Order ID</th>
                    <th className="py-2.5 px-3">Method</th>
                    <th className="py-2.5 px-3">Amount</th>
                    <th className="py-2.5 px-3">State Transition</th>
                    <th className="py-2.5 px-3">Action By</th>
                    <th className="py-2.5 px-3">Reference / Notes</th>
                    <th className="py-2.5 px-3">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium text-slate-300">
                  {transactionsLog.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-900/50 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-white text-[11px]">
                        #{log.order_id.slice(0, 8)}
                      </td>
                      <td className="py-3 px-3 uppercase text-[10px] font-bold text-slate-400">
                        {log.payment_method}
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-brand-400">
                        ₹{log.amount}
                      </td>
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold">
                          <span className="text-slate-500">{log.previous_status || 'start'}</span>
                          <span className="text-brand-400">→</span>
                          <span className="text-emerald-400 font-black uppercase">{log.new_status}</span>
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-300 text-[11px]">
                        {log.action_by}
                      </td>
                      <td className="py-3 px-3 text-slate-400 text-[11px] truncate max-w-[160px]">
                        {log.notes || log.reference_id || '—'}
                      </td>
                      <td className="py-3 px-3 text-slate-500 font-mono text-[10px] whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── RECORD COD COLLECTION MODAL ─── */}
      {codModalOrder && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Banknote className="w-5 h-5 text-emerald-400" />
                <span>Confirm COD Payment Collection</span>
              </h3>
              <button
                onClick={() => setCodModalOrder(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitCodCollect} className="space-y-4">
              <p className="text-xs text-slate-300">
                You are marking the Cash on Delivery amount as collected for Order{' '}
                <strong className="text-white">#{codModalOrder.order_id.slice(0, 8)}</strong>.
              </p>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Collected Amount (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={codAmount}
                  onChange={(e) => setCodAmount(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-brand-500"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Collection Notes / Reference</label>
                <input
                  type="text"
                  value={codNotes}
                  onChange={(e) => setCodNotes(e.target.value)}
                  placeholder="e.g. Received ₹350 cash at doorstep"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCodModalOrder(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={codSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black transition-all shadow-md"
                >
                  {codSubmitting ? 'Recording...' : 'Confirm Cash Collected'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── PROCESS REFUND MODAL ─── */}
      {selectedPayment && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-rose-400" />
                <span>Process Payment Refund</span>
              </h3>
              <button
                onClick={() => setSelectedPayment(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleProcessRefund} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Refund Amount (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  max={selectedPayment.amount}
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-brand-500"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Reason for Refund</label>
                <input
                  type="text"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="e.g. Order cancelled by customer"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedPayment(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={refundSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white text-xs font-black transition-all shadow-md"
                >
                  {refundSubmitting ? 'Refunding...' : 'Confirm Refund'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
