import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Send,
  Users,
  CheckCircle,
  Clock,
  Radio,
  RefreshCw,
  Volume2,
  AlertTriangle,
  RotateCcw,
  Mail,
  Search,
  ExternalLink,
  Filter,
  Check,
  XCircle,
  AlertCircle,
  Inbox,
  ShoppingBag,
} from 'lucide-react';
import api from '../../services/api';
import { notifyLiveUpdate } from '../../services/liveSync';
import { playNotificationSound, unlockAudioContext } from '../../utils/notificationSound';
import { useNotifications } from '../../context/NotificationContext';

interface OrderNotificationItem {
  id: string;
  order_id: string;
  notification_type: string;
  recipient: string;
  status: 'pending' | 'sent' | 'failed';
  attempts: number;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
  order_number?: string;
  order_total?: number;
  order_status?: string;
  payment_method?: string;
  payment_status?: string;
  customer_name?: string;
  customer_phone?: string;
}

interface SummaryCounts {
  total: number;
  sent: number;
  failed: number;
  pending: number;
}

export const AdminNotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { triggerLiveNotification } = useNotifications();

  // Active Tab
  const [activeTab, setActiveTab] = useState<'outbox' | 'broadcast'>('outbox');

  // Outbox State
  const [notifications, setNotifications] = useState<OrderNotificationItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [summary, setSummary] = useState<SummaryCounts>({ total: 0, sent: 0, failed: 0, pending: 0 });
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [retryFeedback, setRetryFeedback] = useState<{ id: string; success: boolean; message: string } | null>(null);

  // Broadcast State
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

  // Load Notification History
  const fetchNotificationHistory = useCallback(async () => {
    try {
      setLoadingHistory(true);
      setHistoryError(null);
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (typeFilter !== 'all') params.append('type', typeFilter);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());

      const res = await api.get(`/notifications/admin/history?${params.toString()}`);
      if (res.data?.data) {
        setNotifications(res.data.data.notifications || []);
        if (res.data.data.summary) {
          setSummary(res.data.data.summary);
        }
      }
    } catch (err: any) {
      console.error('Failed to load notification history:', err);
      setHistoryError(err.response?.data?.message || err.message || 'Failed to fetch notification history');
    } finally {
      setLoadingHistory(false);
    }
  }, [statusFilter, typeFilter, searchQuery]);

  useEffect(() => {
    if (activeTab === 'outbox') {
      fetchNotificationHistory();
    }
  }, [activeTab, fetchNotificationHistory]);

  // Retry Failed or Pending Notification
  const handleRetry = async (item: OrderNotificationItem) => {
    try {
      setRetryingId(item.id);
      setRetryFeedback(null);
      const res = await api.post(`/notifications/admin/${item.id}/retry`);
      const updated = res.data?.data?.notification;

      setRetryFeedback({
        id: item.id,
        success: true,
        message: 'Notification retry successfully dispatched!',
      });

      if (updated) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, ...updated } : n))
        );
      } else {
        fetchNotificationHistory();
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.message || err.message || 'Retry failed';
      setRetryFeedback({
        id: item.id,
        success: false,
        message: `Retry error: ${errMsg}`,
      });
    } finally {
      setRetryingId(null);
    }
  };

  const handleTestSound = () => {
    unlockAudioContext();
    playNotificationSound();
  };

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      alert('Please enter a notification title and message.');
      return;
    }

    try {
      setSending(true);
      const res = await api.post('/notifications/admin/broadcast', {
        title,
        message,
        target,
        type,
      });

      const newNotif = res.data?.data || {
        id: `bc_${Date.now()}`,
        title,
        message,
        type,
        created_at: new Date().toISOString(),
        is_read: false,
      };

      playNotificationSound();
      notifyLiveUpdate('notification', newNotif);
      triggerLiveNotification(newNotif);

      setRecentBroadcasts([
        {
          id: newNotif.id || `bc_${Date.now()}`,
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

  const formatNotifType = (t: string) => {
    switch (t) {
      case 'admin_email':
        return { label: 'Admin Order Alert', icon: ShoppingBag, color: 'text-sky-400 bg-sky-500/10 border-sky-500/30' };
      case 'customer_confirmed':
        return { label: 'Order Confirmation', icon: CheckCircle, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' };
      case 'customer_order_delivered':
      case 'customer_delivered':
        return { label: 'Order Delivered', icon: Check, color: 'text-teal-400 bg-teal-500/10 border-teal-500/30' };
      case 'customer_cancelled':
        return { label: 'Order Cancelled', icon: XCircle, color: 'text-rose-400 bg-rose-500/10 border-rose-500/30' };
      case 'customer_payment_collected':
        return { label: 'Payment Receipt', icon: CheckCircle, color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' };
      default:
        return { label: t.replace(/_/g, ' '), icon: Mail, color: 'text-slate-400 bg-slate-800 border-slate-700' };
    }
  };

  const formatISTDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <Bell className="w-6 h-6 text-brand-400" /> Notifications &amp; Alerts System
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time admin alerts, transactional email audit history, retry queue, and customer push broadcasts
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleTestSound}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-850 text-amber-300 border border-amber-500/30 text-xs font-bold transition-all shadow-lg shadow-amber-500/10 active:scale-95 cursor-pointer"
          >
            <Volume2 className="w-4 h-4 text-amber-400 animate-bounce" />
            <span>Test Sound Chime 🔔</span>
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('outbox')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
            activeTab === 'outbox'
              ? 'bg-brand-500 text-slate-950 shadow-md shadow-brand-500/20'
              : 'bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
          }`}
        >
          <Inbox className="w-4 h-4" />
          <span>Notification Outbox &amp; Email History</span>
          {summary.failed > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white animate-pulse">
              {summary.failed} failed
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('broadcast')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
            activeTab === 'broadcast'
              ? 'bg-brand-500 text-slate-950 shadow-md shadow-brand-500/20'
              : 'bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
          }`}
        >
          <Radio className="w-4 h-4" />
          <span>Customer Broadcasts &amp; Announcements</span>
        </button>
      </div>

      {/* ──────────────── TAB 1: OUTBOX & NOTIFICATION HISTORY ──────────────── */}
      {activeTab === 'outbox' && (
        <div className="space-y-6">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Dispatched</span>
              <p className="text-2xl font-black text-white mt-1">{summary.total}</p>
              <span className="text-[10px] text-slate-500 mt-0.5 block">Audit log records</span>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-emerald-500/20">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block">Delivered / Sent</span>
                <CheckCircle className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-2xl font-black text-emerald-400 mt-1">{summary.sent}</p>
              <span className="text-[10px] text-emerald-500/80 mt-0.5 block">Delivered successfully</span>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-rose-500/20">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-rose-400 uppercase tracking-wider block">Failed Delivery</span>
                <AlertTriangle className="w-4 h-4 text-rose-400" />
              </div>
              <p className="text-2xl font-black text-rose-400 mt-1">{summary.failed}</p>
              <span className="text-[10px] text-rose-500/80 mt-0.5 block">Eligible for retry</span>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-amber-500/20">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block">Pending Queue</span>
                <Clock className="w-4 h-4 text-amber-400" />
              </div>
              <p className="text-2xl font-black text-amber-400 mt-1">{summary.pending}</p>
              <span className="text-[10px] text-amber-500/80 mt-0.5 block">In transit / queued</span>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex-1 flex flex-col sm:flex-row items-center gap-3">
              {/* Search Bar */}
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search order #, email, or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') fetchNotificationHistory(); }}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                />
              </div>

              {/* Status Filter */}
              <div className="w-full sm:w-auto">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none focus:border-brand-500"
                >
                  <option value="all">All Delivery Statuses</option>
                  <option value="sent">Sent Successfully</option>
                  <option value="failed">Failed Delivery</option>
                  <option value="pending">Pending In Queue</option>
                </select>
              </div>

              {/* Type Filter */}
              <div className="w-full sm:w-auto">
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none focus:border-brand-500"
                >
                  <option value="all">All Notification Types</option>
                  <option value="admin_email">Admin Order Alert</option>
                  <option value="customer_confirmed">Customer Order Confirmation</option>
                  <option value="customer_order_delivered">Customer Order Delivered</option>
                  <option value="customer_cancelled">Customer Cancellation</option>
                  <option value="customer_payment_collected">Customer Payment Receipt</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={fetchNotificationHistory}
                disabled={loadingHistory}
                className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-850 text-slate-300 border border-slate-800 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                title="Refresh Outbox"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingHistory ? 'animate-spin text-brand-400' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Retry Feedback Toast */}
          {retryFeedback && (
            <div
              className={`p-3.5 rounded-2xl border text-xs font-bold flex items-center justify-between ${
                retryFeedback.success
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
              }`}
            >
              <div className="flex items-center gap-2">
                {retryFeedback.success ? (
                  <CheckCircle className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                <span>{retryFeedback.message}</span>
              </div>
              <button
                onClick={() => setRetryFeedback(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* History Error Message */}
          {historyError && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{historyError}</span>
            </div>
          )}

          {/* Notifications Table */}
          <div className="bg-slate-950 rounded-3xl border border-slate-800 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400 font-extrabold uppercase tracking-wider text-[10px]">
                    <th className="py-3.5 px-4">Delivery Status</th>
                    <th className="py-3.5 px-4">Notification Type</th>
                    <th className="py-3.5 px-4">Recipient</th>
                    <th className="py-3.5 px-4">Related Order</th>
                    <th className="py-3.5 px-4">Dispatched / Created</th>
                    <th className="py-3.5 px-4">Attempts / Reason</th>
                    <th className="py-3.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {loadingHistory && notifications.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-brand-400 mb-2" />
                        <p className="font-bold">Loading notification records...</p>
                      </td>
                    </tr>
                  ) : notifications.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500">
                        <Inbox className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                        <p className="font-bold text-sm text-slate-400">No notification records found</p>
                        <p className="text-xs text-slate-500 mt-1">No notifications match your current filter criteria</p>
                      </td>
                    </tr>
                  ) : (
                    notifications.map((item) => {
                      const typeConfig = formatNotifType(item.notification_type);
                      const IconComp = typeConfig.icon;
                      const isFailed = item.status === 'failed';
                      const isSent = item.status === 'sent';
                      const isPending = item.status === 'pending';

                      return (
                        <tr key={item.id} className="hover:bg-slate-900/40 transition-colors">
                          {/* Status Badge */}
                          <td className="py-4 px-4 whitespace-nowrap">
                            {isSent && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                <CheckCircle className="w-3.5 h-3.5" /> Sent
                              </span>
                            )}
                            {isFailed && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                <AlertTriangle className="w-3.5 h-3.5" /> Failed
                              </span>
                            )}
                            {isPending && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                <Clock className="w-3.5 h-3.5 animate-spin" /> Pending
                              </span>
                            )}
                          </td>

                          {/* Type */}
                          <td className="py-4 px-4 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${typeConfig.color}`}>
                              <IconComp className="w-3.5 h-3.5" />
                              <span>{typeConfig.label}</span>
                            </span>
                          </td>

                          {/* Recipient */}
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-1.5">
                              <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                              <span className="font-mono text-slate-200 text-xs break-all">{item.recipient}</span>
                            </div>
                            {item.customer_name && (
                              <span className="text-[11px] text-slate-400 block mt-0.5">
                                {item.customer_name} {item.customer_phone ? `(${item.customer_phone})` : ''}
                              </span>
                            )}
                          </td>

                          {/* Related Order */}
                          <td className="py-4 px-4 whitespace-nowrap">
                            <button
                              onClick={() => navigate(`/admin/orders/${item.order_id}`)}
                              className="font-black text-brand-400 hover:text-brand-300 text-xs flex items-center gap-1 group cursor-pointer"
                              title="View order details"
                            >
                              <span>#{item.order_number || item.order_id.slice(0, 8).toUpperCase()}</span>
                              <ExternalLink className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                            </button>
                            {item.order_total !== undefined && (
                              <span className="text-[11px] text-slate-400 block mt-0.5">
                                ₹{Number(item.order_total).toFixed(2)} • {(item.payment_method || 'cod').toUpperCase()} ({item.payment_status || 'pending'})
                              </span>
                            )}
                          </td>

                          {/* Created / Sent Time */}
                          <td className="py-4 px-4 whitespace-nowrap text-slate-300">
                            <span className="block text-xs font-bold">{formatISTDate(item.created_at)}</span>
                            {item.sent_at && (
                              <span className="text-[10px] text-emerald-400 font-mono block mt-0.5">
                                Sent: {formatISTDate(item.sent_at)}
                              </span>
                            )}
                          </td>

                          {/* Attempts & Failure Reason */}
                          <td className="py-4 px-4 max-w-xs">
                            <span className="text-[11px] font-mono text-slate-400 block">
                              Attempts: <strong className="text-slate-200">{item.attempts}</strong>
                            </span>
                            {item.error_message ? (
                              <p
                                className="text-[11px] text-rose-400 mt-1 line-clamp-2 bg-rose-500/10 p-1.5 rounded-lg border border-rose-500/20 font-mono"
                                title={item.error_message}
                              >
                                {item.error_message}
                              </p>
                            ) : isSent ? (
                              <span className="text-[10px] text-emerald-500 mt-0.5 block">Delivered successfully</span>
                            ) : null}
                          </td>

                          {/* Actions: Retry Dispatch */}
                          <td className="py-4 px-4 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleRetry(item)}
                              disabled={retryingId === item.id}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer shadow-xs active:scale-95 disabled:opacity-50 ${
                                isFailed
                                  ? 'bg-rose-500 hover:bg-rose-400 text-slate-950 font-black shadow-rose-500/20'
                                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                              }`}
                              title="Force re-dispatch notification email"
                            >
                              <RotateCcw className={`w-3.5 h-3.5 ${retryingId === item.id ? 'animate-spin' : ''}`} />
                              <span>{retryingId === item.id ? 'Retrying...' : isFailed ? 'Retry Dispatch' : 'Resend'}</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────── TAB 2: CUSTOMER BROADCASTS ──────────────── */}
      {activeTab === 'broadcast' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Create Broadcast Form (7 cols) */}
          <div className="lg:col-span-7 bg-slate-950 p-6 sm:p-8 rounded-3xl border border-slate-800 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <Radio className="w-5 h-5 text-brand-400 animate-pulse" />
                <h3 className="font-bold text-white text-base">Dispatch Instant In-App Notification &amp; Chime</h3>
              </div>
              <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                Sound &amp; Display Active
              </span>
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
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white font-bold focus:border-brand-500 focus:outline-none"
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
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white focus:border-brand-500 focus:outline-none"
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
                    <option value="SYSTEM">Service &amp; Delivery Update</option>
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
                      className="text-[11px] font-semibold bg-slate-900 hover:bg-slate-850 text-slate-300 border border-slate-800 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
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
                  className="w-full bg-brand-500 hover:bg-brand-400 disabled:bg-slate-800 text-slate-950 font-black py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-brand-500/20 transition-all text-xs active:scale-[0.99] cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  {sending ? 'Broadcasting &amp; Chime...' : `Send Notification with Chime to ${target}`}
                </button>
              </div>
            </form>
          </div>

          {/* Right Column: In-App Live Display Preview & History (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Customer Preview Phone Card */}
            <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
                  Customer Screen Toast &amp; Chime Preview
                </span>
                <button
                  type="button"
                  onClick={() => {
                    unlockAudioContext();
                    playNotificationSound();
                    triggerLiveNotification({
                      id: `preview_${Date.now()}`,
                      title: title || 'Fresh Harvest Arrival 🥬',
                      message: message || 'Fresh vegetables are in stock! Order now.',
                      type: (type as any) || 'PROMOTION',
                      created_at: new Date().toISOString(),
                      is_read: false,
                    });
                  }}
                  className="text-[10px] font-bold text-brand-400 hover:text-brand-300 underline cursor-pointer"
                >
                  Preview Pop-up &amp; Sound
                </button>
              </div>
              
              <div className="p-4 rounded-2xl bg-white text-slate-900 shadow-xl space-y-2 border border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-brand-800">
                    <span>🥬 Fresh Vegetables</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-600"></span>
                    <span className="text-[10px] text-slate-400">now • chime 🔔</span>
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
      )}
    </div>
  );
};

export default AdminNotificationsPage;
