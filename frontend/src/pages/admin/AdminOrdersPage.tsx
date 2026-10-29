import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Search,
  Eye,
  Filter,
  CheckCircle2,
  Truck,
  X,
  Clock,
  Phone,
  MapPin,
  Copy,
  Check,
  ExternalLink,
  MessageCircle,
  RotateCw,
  ShoppingBag,
  Sparkles,
  CheckCheck,
  XCircle,
  CreditCard,
  AlertCircle,
  Calendar,
  ChevronRight,
  ArrowUpDown,
  SlidersHorizontal,
  Navigation,
  DollarSign,
  PackageCheck,
  UserCheck,
  Mail,
} from 'lucide-react';
import api from '../../services/api';
import { Order, OrderItem } from '../../types';
import { notifyLiveUpdate } from '../../services/liveSync';

interface OrderSummary {
  total_orders: number;
  new_orders: number;
  confirmed_orders: number;
  preparing_orders: number;
  out_for_delivery_orders: number;
  delivered_orders: number;
  cancelled_orders: number;
  pending_payments: number;
  total_revenue: number;
}

export const AdminOrdersPage: React.FC = () => {
  // Orders and summary state
  const [orders, setOrders] = useState<Order[]>([]);
  const [summary, setSummary] = useState<OrderSummary | null>(null);
  const [isLoadingOrders, setIsLoadingOrders] = useState<boolean>(true);
  const [isLoadingSummary, setIsLoadingSummary] = useState<boolean>(true);
  const [totalCount, setTotalCount] = useState<number>(0);

  // Filters and controls
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [paymentFilter, setPaymentFilter] = useState<string>('');
  const [localityFilter, setLocalityFilter] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('newest');
  const [searchInput, setSearchInput] = useState<string>('');
  const [activeSearch, setActiveSearch] = useState<string>('');
  const [activeFilterCard, setActiveFilterCard] = useState<string | null>(null);

  // Modal, Drawer & Interaction state
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState<boolean>(false);
  const [orderToCancel, setOrderToCancel] = useState<Order | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isResendingEmail, setIsResendingEmail] = useState<boolean>(false);
  const [resendEmailMsg, setResendEmailMsg] = useState<{ id: string; success: boolean; text: string } | null>(null);

  const { id: paramOrderId } = useParams<{ id?: string }>();
  const navigate = useNavigate();

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 4000);
  };

  // Auto-open modal if URL has order ID parameter (e.g. from automated email link)
  useEffect(() => {
    if (paramOrderId) {
      const found = orders.find((o) => o.id === paramOrderId || o.order_number === paramOrderId);
      if (found) {
        setSelectedOrder(found);
        setIsDetailDrawerOpen(true);
      } else {
        api.get(`/orders/admin/${paramOrderId}`)
          .then((res) => {
            if (res.data?.data) {
              setSelectedOrder(res.data.data);
              setIsDetailDrawerOpen(true);
            }
          })
          .catch((err) => {
            console.warn('Could not load order by ID from URL param:', err);
          });
      }
    }
  }, [paramOrderId, orders]);

  // Resend order alert email handler
  const handleResendEmail = async (orderId: string) => {
    try {
      setIsResendingEmail(true);
      setResendEmailMsg(null);
      const res = await api.post(`/orders/admin/${orderId}/resend-email`);
      const msg = res.data?.message || 'Order alert email sent to freshvegitables29@gmail.com!';
      showToast('success', msg);
      setResendEmailMsg({ id: orderId, success: true, text: msg });
      setSelectedOrder((prev: any) =>
        prev && prev.id === orderId
          ? { ...prev, admin_email_sent: true, admin_email_error: null }
          : prev
      );
    } catch (err: any) {
      const errMsg = err.response?.data?.message || 'Failed to send email alert. Check SMTP configuration.';
      showToast('error', errMsg);
      setResendEmailMsg({ id: orderId, success: false, text: errMsg });
    } finally {
      setIsResendingEmail(false);
    }
  };

  // 1. Fetch Order Summary Metrics
  const fetchSummary = useCallback(async () => {
    try {
      setIsLoadingSummary(true);
      const params: Record<string, string> = {};
      if (dateFilter === 'today') {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        params.startDate = start.toISOString();
      } else if (dateFilter === '7days') {
        const start = new Date(Date.now() - 7 * 86400000);
        params.startDate = start.toISOString();
      } else if (dateFilter === '30days') {
        const start = new Date(Date.now() - 30 * 86400000);
        params.startDate = start.toISOString();
      }

      const res = await api.get('/orders/admin/summary', { params });
      if (res.data?.data) {
        setSummary(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch order summary metrics', err);
    } finally {
      setIsLoadingSummary(false);
    }
  }, [dateFilter]);

  // 2. Fetch Orders List
  const fetchOrders = useCallback(async () => {
    try {
      setIsLoadingOrders(true);
      const params: Record<string, any> = {
        limit: 100,
        sort: sortBy,
      };

      if (statusFilter) params.status = statusFilter;
      if (paymentFilter) params.payment_status = paymentFilter;
      if (localityFilter) params.locality = localityFilter;
      if (activeSearch) params.search = activeSearch;

      if (dateFilter === 'today') {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        params.startDate = start.toISOString();
      } else if (dateFilter === '7days') {
        const start = new Date(Date.now() - 7 * 86400000);
        params.startDate = start.toISOString();
      } else if (dateFilter === '30days') {
        const start = new Date(Date.now() - 30 * 86400000);
        params.startDate = start.toISOString();
      }

      const res = await api.get('/orders/admin/all', { params });
      if (res.data?.data) {
        setOrders(res.data.data);
        setTotalCount(res.data.pagination?.total ?? res.data.data.length);
      } else {
        setOrders([]);
        setTotalCount(0);
      }
    } catch (err) {
      console.error('Failed to fetch orders', err);
      setOrders([]);
      setTotalCount(0);
    } finally {
      setIsLoadingOrders(false);
    }
  }, [statusFilter, paymentFilter, localityFilter, dateFilter, sortBy, activeSearch]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Handle Search Submission
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveSearch(searchInput.trim());
  };

  const handleClearFilters = () => {
    setStatusFilter('');
    setPaymentFilter('');
    setLocalityFilter('');
    setDateFilter('all');
    setSortBy('newest');
    setSearchInput('');
    setActiveSearch('');
    setActiveFilterCard(null);
  };

  const hasActiveFilters = useMemo(() => {
    return Boolean(
      statusFilter ||
      paymentFilter ||
      localityFilter ||
      dateFilter !== 'all' ||
      activeSearch ||
      sortBy !== 'newest'
    );
  }, [statusFilter, paymentFilter, localityFilter, dateFilter, activeSearch, sortBy]);

  // Card click filter handler
  const handleCardClick = (cardKey: string, statusVal?: string, paymentVal?: string) => {
    if (activeFilterCard === cardKey) {
      // Toggle off
      setActiveFilterCard(null);
      setStatusFilter('');
      setPaymentFilter('');
    } else {
      setActiveFilterCard(cardKey);
      if (statusVal !== undefined) setStatusFilter(statusVal);
      if (paymentVal !== undefined) setPaymentFilter(paymentVal);
    }
  };

  // Clipboard copy helper
  const handleCopy = (text: string, fieldKey: string, label: string = 'Copied') => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldKey);
    showToast('success', `${label} copied to clipboard!`);
    setTimeout(() => setCopiedField(null), 2500);
  };

  // Google Maps address & coordinates helpers
  const getCoordinates = (order: Order): { lat: number; lng: number } | null => {
    const addr = order.address_snapshot || order.delivery_address;
    if (!addr) return null;
    const lat = Number(addr.latitude);
    const lng = Number(addr.longitude);
    if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
      return { lat, lng };
    }
    return null;
  };

  const getFormattedAddress = (order: Order): string => {
    const addr = order.address_snapshot || order.delivery_address;
    if (!addr) return 'Customer doorstep address';
    if (typeof addr === 'string') return addr;
    const parts = [
      addr.house_number,
      addr.street,
      addr.area,
      addr.landmark ? `Near ${addr.landmark}` : null,
      addr.city,
      addr.state,
      addr.pincode,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : 'Delivery address on record';
  };

  const getGoogleMapsUrl = (order: Order): string => {
    const coords = getCoordinates(order);
    if (coords) {
      return `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}`;
    }
    const formatted = getFormattedAddress(order);
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(formatted)}`;
  };

  // Update order status handler
  const handleUpdateStatus = async (orderId: string, newStatus: string, newPaymentStatus?: string) => {
    try {
      setIsUpdatingStatus(true);
      const payload: Record<string, string> = { order_status: newStatus };
      if (newPaymentStatus) {
        payload.payment_status = newPaymentStatus;
      }

      await api.patch(`/orders/admin/${orderId}/status`, payload);
      
      // Update local state smoothly
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? {
                ...o,
                order_status: newStatus as any,
                ...(newPaymentStatus ? { payment_status: newPaymentStatus as any } : {}),
              }
            : o
        )
      );

      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder((prev) =>
          prev
            ? {
                ...prev,
                order_status: newStatus as any,
                ...(newPaymentStatus ? { payment_status: newPaymentStatus as any } : {}),
              }
            : null
        );
      }

      fetchSummary();
      notifyLiveUpdate('orders');
      showToast('success', `Order status updated to "${newStatus.replace(/_/g, ' ').toUpperCase()}"`);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to update order status';
      showToast('error', msg);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Confirm cancel order handler
  const handleConfirmCancel = async () => {
    if (!orderToCancel) return;
    try {
      setIsUpdatingStatus(true);
      await api.patch(`/orders/admin/${orderToCancel.id}/status`, {
        order_status: 'cancelled',
        notes: cancelReason ? `Cancelled by admin: ${cancelReason}` : 'Cancelled by admin',
      });

      setOrderToCancel(null);
      setCancelReason('');
      fetchOrders();
      fetchSummary();
      notifyLiveUpdate('orders');
      showToast('success', 'Order has been cancelled and stock has been restored.');
      if (selectedOrder && selectedOrder.id === orderToCancel.id) {
        setSelectedOrder((prev) => (prev ? { ...prev, order_status: 'cancelled' } : null));
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to cancel order';
      showToast('error', msg);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Open order details drawer
  const openOrderDetails = (order: Order) => {
    setSelectedOrder(order);
    setIsDetailDrawerOpen(true);
  };

  // Status visual badge styling
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return {
          label: 'New Order',
          bg: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
          dot: 'bg-amber-400',
        };
      case 'confirmed':
        return {
          label: 'Confirmed',
          bg: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
          dot: 'bg-blue-400',
        };
      case 'preparing':
      case 'packed':
        return {
          label: 'Preparing',
          bg: 'bg-purple-500/10 border-purple-500/30 text-purple-400',
          dot: 'bg-purple-400',
        };
      case 'out_for_delivery':
        return {
          label: 'Out for Delivery',
          bg: 'bg-sky-500/10 border-sky-500/30 text-sky-400',
          dot: 'bg-sky-400',
        };
      case 'delivered':
        return {
          label: 'Delivered',
          bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
          dot: 'bg-emerald-400',
        };
      case 'cancelled':
        return {
          label: 'Cancelled',
          bg: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
          dot: 'bg-rose-400',
        };
      default:
        return {
          label: status,
          bg: 'bg-slate-800 border-slate-700 text-slate-300',
          dot: 'bg-slate-400',
        };
    }
  };

  const getPaymentStatusBadge = (paymentStatus: string) => {
    switch (paymentStatus) {
      case 'paid':
        return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400';
      case 'pending':
        return 'bg-amber-500/10 border-amber-500/30 text-amber-400';
      case 'failed':
        return 'bg-rose-500/10 border-rose-500/30 text-rose-400';
      case 'refunded':
        return 'bg-purple-500/10 border-purple-500/30 text-purple-400';
      default:
        return 'bg-slate-800 border-slate-700 text-slate-300';
    }
  };

  // Workflow stages sequence
  const workflowStages = [
    { id: 'pending', label: '1. New Order', action: 'Confirm Order', nextStatus: 'confirmed' },
    { id: 'confirmed', label: '2. Confirmed', action: 'Start Preparing', nextStatus: 'preparing' },
    { id: 'preparing', label: '3. Preparing & Packed', action: 'Dispatch for Delivery', nextStatus: 'out_for_delivery' },
    { id: 'out_for_delivery', label: '4. Out for Delivery', action: 'Mark as Delivered', nextStatus: 'delivered' },
    { id: 'delivered', label: '5. Delivered', action: null, nextStatus: null },
  ];

  const getStageIndex = (status: string) => {
    if (status === 'pending') return 0;
    if (status === 'confirmed') return 1;
    if (status === 'preparing' || status === 'packed') return 2;
    if (status === 'out_for_delivery') return 3;
    if (status === 'delivered') return 4;
    return -1;
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      {toastMsg && (
        <div
          className={`fixed top-4 right-4 z-50 p-4 rounded-2xl text-xs font-bold border shadow-2xl transition-all flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-4 duration-200 ${
            toastMsg.type === 'success'
              ? 'bg-slate-900 border-emerald-500/40 text-emerald-300 shadow-emerald-950/40'
              : 'bg-slate-900 border-rose-500/40 text-rose-300 shadow-rose-950/40'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {toastMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{toastMsg.text}</span>
          </div>
          <button
            onClick={() => setToastMsg(null)}
            className="text-slate-400 hover:text-white ml-2 text-sm font-black p-1 hover:bg-slate-800 rounded-lg transition-colors"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black text-white tracking-tight">Orders & Deliveries</h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live Hub
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time delivery management, Google Maps dispatch, customer communication & status controls
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={() => {
              fetchSummary();
              fetchOrders();
            }}
            disabled={isLoadingOrders || isLoadingSummary}
            className="px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white font-bold text-xs flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isLoadingOrders ? 'animate-spin text-emerald-400' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* 8 Dashboard Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {/* 1. Total Orders */}
        <div
          onClick={() => handleCardClick('total')}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group ${
            activeFilterCard === 'total'
              ? 'bg-slate-900 border-emerald-500 shadow-md shadow-emerald-950/20 ring-1 ring-emerald-500/40'
              : 'bg-slate-950 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total</span>
            <div className="p-1.5 rounded-lg bg-slate-800 text-slate-300 group-hover:scale-105 transition-transform">
              <ShoppingBag className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            {isLoadingSummary ? (
              <div className="h-6 w-12 bg-slate-800 animate-pulse rounded" />
            ) : (
              <p className="text-xl font-black text-white tracking-tight">{summary?.total_orders ?? 0}</p>
            )}
            <p className="text-[9px] font-semibold text-slate-500 mt-0.5">All time orders</p>
          </div>
        </div>

        {/* 2. New Orders */}
        <div
          onClick={() => handleCardClick('new', 'pending')}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group ${
            activeFilterCard === 'new'
              ? 'bg-slate-900 border-amber-500 shadow-md shadow-amber-950/20 ring-1 ring-amber-500/40'
              : 'bg-slate-950 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">New</span>
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 group-hover:scale-105 transition-transform">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            {isLoadingSummary ? (
              <div className="h-6 w-12 bg-slate-800 animate-pulse rounded" />
            ) : (
              <p className="text-xl font-black text-amber-400 tracking-tight">{summary?.new_orders ?? 0}</p>
            )}
            <p className="text-[9px] font-semibold text-amber-500/70 mt-0.5">Needs confirmation</p>
          </div>
        </div>

        {/* 3. Confirmed Orders */}
        <div
          onClick={() => handleCardClick('confirmed', 'confirmed')}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group ${
            activeFilterCard === 'confirmed'
              ? 'bg-slate-900 border-blue-500 shadow-md shadow-blue-950/20 ring-1 ring-blue-500/40'
              : 'bg-slate-950 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Confirmed</span>
            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 group-hover:scale-105 transition-transform">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            {isLoadingSummary ? (
              <div className="h-6 w-12 bg-slate-800 animate-pulse rounded" />
            ) : (
              <p className="text-xl font-black text-blue-400 tracking-tight">{summary?.confirmed_orders ?? 0}</p>
            )}
            <p className="text-[9px] font-semibold text-blue-500/70 mt-0.5">Ready for packing</p>
          </div>
        </div>

        {/* 4. Being Prepared */}
        <div
          onClick={() => handleCardClick('preparing', 'preparing')}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group ${
            activeFilterCard === 'preparing'
              ? 'bg-slate-900 border-purple-500 shadow-md shadow-purple-950/20 ring-1 ring-purple-500/40'
              : 'bg-slate-950 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">Preparing</span>
            <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400 group-hover:scale-105 transition-transform">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            {isLoadingSummary ? (
              <div className="h-6 w-12 bg-slate-800 animate-pulse rounded" />
            ) : (
              <p className="text-xl font-black text-purple-400 tracking-tight">{summary?.preparing_orders ?? 0}</p>
            )}
            <p className="text-[9px] font-semibold text-purple-500/70 mt-0.5">Packing produce</p>
          </div>
        </div>

        {/* 5. Out for Delivery */}
        <div
          onClick={() => handleCardClick('out_for_delivery', 'out_for_delivery')}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group ${
            activeFilterCard === 'out_for_delivery'
              ? 'bg-slate-900 border-sky-500 shadow-md shadow-sky-950/20 ring-1 ring-sky-500/40'
              : 'bg-slate-950 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-sky-400 uppercase tracking-wider">On Route</span>
            <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400 group-hover:scale-105 transition-transform">
              <Truck className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            {isLoadingSummary ? (
              <div className="h-6 w-12 bg-slate-800 animate-pulse rounded" />
            ) : (
              <p className="text-xl font-black text-sky-400 tracking-tight">{summary?.out_for_delivery_orders ?? 0}</p>
            )}
            <p className="text-[9px] font-semibold text-sky-500/70 mt-0.5">Delivery in progress</p>
          </div>
        </div>

        {/* 6. Delivered Orders */}
        <div
          onClick={() => handleCardClick('delivered', 'delivered')}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group ${
            activeFilterCard === 'delivered'
              ? 'bg-slate-900 border-emerald-500 shadow-md shadow-emerald-950/20 ring-1 ring-emerald-500/40'
              : 'bg-slate-950 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Delivered</span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:scale-105 transition-transform">
              <CheckCheck className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            {isLoadingSummary ? (
              <div className="h-6 w-12 bg-slate-800 animate-pulse rounded" />
            ) : (
              <p className="text-xl font-black text-emerald-400 tracking-tight">{summary?.delivered_orders ?? 0}</p>
            )}
            <p className="text-[9px] font-semibold text-emerald-500/70 mt-0.5">Completed orders</p>
          </div>
        </div>

        {/* 7. Cancelled Orders */}
        <div
          onClick={() => handleCardClick('cancelled', 'cancelled')}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group ${
            activeFilterCard === 'cancelled'
              ? 'bg-slate-900 border-rose-500 shadow-md shadow-rose-950/20 ring-1 ring-rose-500/40'
              : 'bg-slate-950 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">Cancelled</span>
            <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 group-hover:scale-105 transition-transform">
              <XCircle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            {isLoadingSummary ? (
              <div className="h-6 w-12 bg-slate-800 animate-pulse rounded" />
            ) : (
              <p className="text-xl font-black text-rose-400 tracking-tight">{summary?.cancelled_orders ?? 0}</p>
            )}
            <p className="text-[9px] font-semibold text-rose-500/70 mt-0.5">Stock returned</p>
          </div>
        </div>

        {/* 8. Pending Payments */}
        <div
          onClick={() => handleCardClick('pending_payment', undefined, 'pending')}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group ${
            activeFilterCard === 'pending_payment'
              ? 'bg-slate-900 border-amber-500 shadow-md shadow-amber-950/20 ring-1 ring-amber-500/40'
              : 'bg-slate-950 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Pending Pay</span>
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 group-hover:scale-105 transition-transform">
              <CreditCard className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            {isLoadingSummary ? (
              <div className="h-6 w-12 bg-slate-800 animate-pulse rounded" />
            ) : (
              <p className="text-xl font-black text-amber-400 tracking-tight">{summary?.pending_payments ?? 0}</p>
            )}
            <p className="text-[9px] font-semibold text-amber-500/70 mt-0.5">COD / awaiting</p>
          </div>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="bg-slate-950 p-4 rounded-3xl border border-slate-800 shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
          {/* Search form */}
          <form onSubmit={handleSearchSubmit} className="relative flex-1">
            <input
              type="text"
              placeholder="Search by order # (e.g. ORD-...), customer name, mobile number..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-9 pr-20 py-2.5 bg-slate-900 border border-slate-800 text-white placeholder-slate-500 rounded-2xl text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
            />
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            {searchInput && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput('');
                  setActiveSearch('');
                }}
                className="absolute right-14 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white p-1"
              >
                ✕
              </button>
            )}
            <button
              type="submit"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-[11px] font-bold transition-all"
            >
              Search
            </button>
          </form>

          {/* Filters Row */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setActiveFilterCard(null);
              }}
              className="px-3 py-2 bg-slate-900 border border-slate-800 text-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="">All Statuses</option>
              <option value="pending">New / Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="preparing">Being Prepared</option>
              <option value="out_for_delivery">Out for Delivery</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>

            {/* Payment Status Filter */}
            <select
              value={paymentFilter}
              onChange={(e) => {
                setPaymentFilter(e.target.value);
                setActiveFilterCard(null);
              }}
              className="px-3 py-2 bg-slate-900 border border-slate-800 text-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="">All Payments</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
            </select>

            {/* Locality Filter */}
            <select
              value={localityFilter}
              onChange={(e) => setLocalityFilter(e.target.value)}
              className="px-3 py-2 bg-slate-900 border border-slate-800 text-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="">All Localities</option>
              <option value="KPHB">KPHB Colony</option>
              <option value="Kukatpally">Kukatpally</option>
              <option value="Miyapur">Miyapur</option>
              <option value="Madhapur">Madhapur</option>
              <option value="Hitech City">Hitech City</option>
              <option value="Gachibowli">Gachibowli</option>
              <option value="Ahmedabad">Ahmedabad</option>
            </select>

            {/* Date Range Filter */}
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-3 py-2 bg-slate-900 border border-slate-800 text-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="all">All Dates</option>
              <option value="today">Today</option>
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
            </select>

            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 bg-slate-900 border border-slate-800 text-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="amount_high">Amount: High to Low</option>
              <option value="amount_low">Amount: Low to High</option>
            </select>

            {/* Clear Filters Button */}
            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 font-bold text-xs transition-colors flex items-center gap-1.5"
              >
                <X className="w-3.5 h-3.5" />
                <span>Clear Filters</span>
              </button>
            )}
          </div>
        </div>

        {/* Results Count & Active Filter Indicator */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
          <div className="flex items-center gap-2">
            <span>
              Showing <strong className="text-white">{orders.length}</strong> of{' '}
              <strong className="text-white">{totalCount}</strong> orders
            </span>
            {hasActiveFilters && (
              <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium">
                Filtered view active
              </span>
            )}
          </div>
          {summary?.total_revenue !== undefined && (
            <span className="font-semibold">
              Live Total Revenue:{' '}
              <strong className="text-emerald-400 font-bold">₹{Number(summary.total_revenue).toLocaleString('en-IN')}</strong>
            </span>
          )}
        </div>
      </div>

      {/* Orders Table Container */}
      <div className="bg-slate-950 rounded-3xl border border-slate-800 overflow-hidden shadow-sm">
        {isLoadingOrders ? (
          <div className="p-8 space-y-4">
            {[1, 2, 3, 4, 5].map((idx) => (
              <div key={idx} className="flex items-center gap-4 animate-pulse">
                <div className="w-24 h-5 bg-slate-800 rounded" />
                <div className="w-32 h-5 bg-slate-800 rounded" />
                <div className="w-28 h-5 bg-slate-800 rounded" />
                <div className="w-40 h-5 bg-slate-800 rounded flex-1" />
                <div className="w-20 h-5 bg-slate-800 rounded" />
                <div className="w-28 h-8 bg-slate-800 rounded-xl" />
              </div>
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="py-20 px-4 text-center">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mb-4 shadow-inner">
              <ShoppingBag className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-white">
              {hasActiveFilters ? 'No orders match your filter criteria' : 'No orders yet'}
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 leading-relaxed">
              {hasActiveFilters
                ? 'Try adjusting your search terms or clearing current status, locality, and date filters.'
                : 'Customer orders will appear here in real-time as soon as they place an order.'}
            </p>
            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="mt-4 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors inline-flex items-center gap-1.5"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reset All Filters</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px] bg-slate-900/40">
                  <th className="py-3.5 px-4">Order ID & Date</th>
                  <th className="py-3.5 px-4">Customer</th>
                  <th className="py-3.5 px-4">Mobile & Call</th>
                  <th className="py-3.5 px-4">Delivery Locality</th>
                  <th className="py-3.5 px-4">Total</th>
                  <th className="py-3.5 px-4">Payment</th>
                  <th className="py-3.5 px-4">Order Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {orders.map((o) => {
                  const customerName = o.customer_name || o.address_snapshot?.full_name || 'Customer';
                  const mobile = o.customer_mobile || o.address_snapshot?.phone || '';
                  const statusInfo = getStatusBadge(o.order_status);
                  const addr = o.address_snapshot || o.delivery_address;
                  const localityText =
                    typeof addr === 'object' && addr
                      ? [addr.area || addr.street, addr.city, addr.pincode].filter(Boolean).join(', ')
                      : 'Doorstep Delivery';
                  const hasGps = Boolean(getCoordinates(o));
                  const mapsUrl = getGoogleMapsUrl(o);

                  return (
                    <tr key={o.id} className="hover:bg-slate-900/60 transition-colors group">
                      {/* Order ID & Date */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-black text-white font-mono">{o.order_number}</span>
                          <button
                            title="Copy Order Number"
                            onClick={() => handleCopy(o.order_number, `ord-${o.id}`, 'Order ID')}
                            className="text-slate-500 hover:text-white p-1 rounded transition-colors"
                          >
                            {copiedField === `ord-${o.id}` ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {new Date(o.created_at).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                          {' • '}
                          {new Date(o.created_at).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </td>

                      {/* Customer */}
                      <td className="py-3.5 px-4">
                        <p className="font-bold text-slate-200">{customerName}</p>
                        {o.customer_email && (
                          <p className="text-[10px] text-slate-500 truncate max-w-[130px]">{o.customer_email}</p>
                        )}
                      </td>

                      {/* Mobile & Click to Call */}
                      <td className="py-3.5 px-4">
                        {mobile ? (
                          <div className="flex items-center gap-2">
                            <a
                              href={`tel:${mobile}`}
                              title="Click to Call Customer"
                              className="font-mono text-xs font-bold text-slate-200 hover:text-emerald-400 flex items-center gap-1.5 group/phone transition-colors"
                            >
                              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 group-hover/phone:bg-emerald-500 group-hover/phone:text-slate-950 transition-colors">
                                <Phone className="w-3 h-3" />
                              </div>
                              <span>{mobile}</span>
                            </a>
                            <button
                              title="Copy Phone Number"
                              onClick={() => handleCopy(mobile, `phone-${o.id}`, 'Phone number')}
                              className="text-slate-500 hover:text-white p-1 rounded transition-colors"
                            >
                              {copiedField === `phone-${o.id}` ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-500 text-[11px]">No phone</span>
                        )}
                      </td>

                      {/* Delivery Locality */}
                      <td className="py-3.5 px-4 max-w-[200px]">
                        <div className="flex items-start gap-1.5">
                          <MapPin
                            className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${hasGps ? 'text-emerald-400' : 'text-slate-500'}`}
                          />
                          <div>
                            <p className="text-slate-300 font-medium text-[11px] truncate">{localityText}</p>
                            <a
                              href={mapsUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[10px] text-brand-400 hover:underline inline-flex items-center gap-1 mt-0.5"
                            >
                              <span>{hasGps ? 'GPS Location' : 'Address Search'}</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          </div>
                        </div>
                      </td>

                      {/* Total Amount */}
                      <td className="py-3.5 px-4">
                        <span className="font-black text-brand-400 text-sm">₹{o.total}</span>
                        {o.delivery_charge > 0 ? (
                          <p className="text-[10px] text-slate-500">+₹{o.delivery_charge} delivery</p>
                        ) : (
                          <p className="text-[10px] text-emerald-400 font-bold">Free delivery</p>
                        )}
                      </td>

                      {/* Payment */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <span className="inline-block text-[10px] font-black uppercase text-slate-300">
                            {o.payment_method}
                          </span>
                          <div>
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${getPaymentStatusBadge(
                                o.payment_status
                              )}`}
                            >
                              {o.payment_status.toUpperCase()}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Order Status Selector */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <select
                            value={o.order_status}
                            disabled={isUpdatingStatus}
                            onChange={(e) => {
                              const newSt = e.target.value;
                              if (newSt === 'cancelled') {
                                setOrderToCancel(o);
                              } else {
                                handleUpdateStatus(o.id, newSt);
                              }
                            }}
                            className={`text-[11px] font-bold px-2.5 py-1.5 rounded-xl border focus:outline-none cursor-pointer bg-slate-900 transition-colors ${statusInfo.bg}`}
                          >
                            <option value="pending" className="bg-slate-900 text-amber-400">
                              New / Pending
                            </option>
                            <option value="confirmed" className="bg-slate-900 text-blue-400">
                              Confirmed
                            </option>
                            <option value="preparing" className="bg-slate-900 text-purple-400">
                              Preparing
                            </option>
                            <option value="out_for_delivery" className="bg-slate-900 text-sky-400">
                              Out for Delivery
                            </option>
                            <option value="delivered" className="bg-slate-900 text-emerald-400">
                              Delivered
                            </option>
                            <option value="cancelled" className="bg-slate-900 text-rose-400">
                              Cancelled
                            </option>
                          </select>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openOrderDetails(o)}
                            className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold transition-all text-xs flex items-center gap-1.5"
                          >
                            <Eye className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Details</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ===================== DEDICATED ORDER DETAILS MODAL / DRAWER ===================== */}
      {isDetailDrawerOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-slate-950 border border-slate-800 rounded-3xl max-w-2xl w-full text-white shadow-2xl overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-slate-800 flex items-start justify-between bg-slate-900/60">
              <div>
                <div className="flex items-center gap-2.5">
                  <h3 className="font-extrabold text-lg text-white">Order: {selectedOrder.order_number}</h3>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                      getStatusBadge(selectedOrder.order_status).bg
                    }`}
                  >
                    {getStatusBadge(selectedOrder.order_status).label}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span>
                    Placed on{' '}
                    {new Date(selectedOrder.created_at).toLocaleString('en-IN', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </span>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleResendEmail(selectedOrder.id)}
                  disabled={isResendingEmail}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                  title="Resend email alert to freshvegitables29@gmail.com"
                >
                  <Mail className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{isResendingEmail ? 'Sending...' : 'Resend Email Alert'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsDetailDrawerOpen(false);
                    if (paramOrderId) navigate('/admin/orders');
                  }}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              {/* 1. Workflow Progression Stage Controls */}
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Delivery Progression Status
                  </h4>
                  {selectedOrder.order_status !== 'cancelled' && selectedOrder.order_status !== 'delivered' && (
                    <button
                      onClick={() => setOrderToCancel(selectedOrder)}
                      className="text-[11px] font-bold text-rose-400 hover:text-rose-300 transition-colors"
                    >
                      Cancel Order
                    </button>
                  )}
                </div>

                {/* Visual Step Indicator */}
                <div className="grid grid-cols-5 gap-1.5 pt-1">
                  {workflowStages.map((st, idx) => {
                    const currentIdx = getStageIndex(selectedOrder.order_status);
                    const isDone = currentIdx >= idx && selectedOrder.order_status !== 'cancelled';
                    const isCurrent = currentIdx === idx && selectedOrder.order_status !== 'cancelled';

                    return (
                      <div key={st.id} className="text-center space-y-1.5">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            selectedOrder.order_status === 'cancelled'
                              ? 'bg-rose-500/20'
                              : isDone
                              ? 'bg-emerald-500'
                              : 'bg-slate-800'
                          }`}
                        />
                        <p
                          className={`text-[9px] font-bold truncate ${
                            isCurrent
                              ? 'text-emerald-400'
                              : isDone
                              ? 'text-slate-300'
                              : 'text-slate-600'
                          }`}
                        >
                          {st.label}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {/* Workflow Action Button */}
                {(() => {
                  const currIdx = getStageIndex(selectedOrder.order_status);
                  if (selectedOrder.order_status === 'cancelled') {
                    return (
                      <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs text-center font-bold">
                        This order has been cancelled.
                      </div>
                    );
                  }
                  if (currIdx >= 0 && currIdx < workflowStages.length - 1) {
                    const nextStage = workflowStages[currIdx];
                    return (
                      <button
                        onClick={() =>
                          handleUpdateStatus(
                            selectedOrder.id,
                            nextStage.nextStatus!,
                            nextStage.nextStatus === 'delivered' && selectedOrder.payment_method === 'cod'
                              ? 'paid'
                              : undefined
                          )
                        }
                        disabled={isUpdatingStatus}
                        className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition-all flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50 shadow-md shadow-emerald-950/40"
                      >
                        <PackageCheck className="w-4 h-4" />
                        <span>Advance to: {nextStage.action}</span>
                      </button>
                    );
                  }
                  if (selectedOrder.order_status === 'delivered') {
                    return (
                      <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs text-center font-bold flex items-center justify-center gap-2">
                        <CheckCheck className="w-4 h-4" />
                        <span>Order successfully delivered to customer</span>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              {/* 2. Customer Information Card */}
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Customer Contact Details</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 text-[11px]">Customer Name</span>
                    <p className="font-bold text-white text-sm">
                      {selectedOrder.customer_name || selectedOrder.address_snapshot?.full_name || 'Customer'}
                    </p>
                    {selectedOrder.user_id && (
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">
                        ID: {selectedOrder.user_id}
                      </p>
                    )}
                  </div>

                  <div>
                    <span className="text-slate-500 text-[11px]">Direct Phone & Communication</span>
                    {(() => {
                      const ph = selectedOrder.customer_mobile || selectedOrder.address_snapshot?.phone || '';
                      if (!ph) return <p className="text-slate-500 font-medium">Not provided</p>;
                      const cleanPhone = ph.replace(/\D/g, '');
                      return (
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <a
                            href={`tel:${ph}`}
                            className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold hover:bg-emerald-500 hover:text-slate-950 transition-colors flex items-center gap-1.5"
                          >
                            <Phone className="w-3 h-3" />
                            <span>Call {ph}</span>
                          </a>

                          <a
                            href={`https://wa.me/91${cleanPhone}?text=${encodeURIComponent(
                              `Hello ${
                                selectedOrder.customer_name || 'Customer'
                              }, this is Fresh Vegetables regarding your order #${selectedOrder.order_number}.`
                            )}`}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-1.5 rounded-xl bg-emerald-600/10 border border-emerald-600/30 text-emerald-400 font-bold hover:bg-emerald-600 hover:text-white transition-colors flex items-center gap-1.5"
                          >
                            <MessageCircle className="w-3 h-3" />
                            <span>WhatsApp</span>
                          </a>

                          <button
                            onClick={() => handleCopy(ph, `modal-phone-${selectedOrder.id}`, 'Phone')}
                            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                            title="Copy Phone"
                          >
                            {copiedField === `modal-phone-${selectedOrder.id}` ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {selectedOrder.customer_email && (
                  <div className="pt-2 border-t border-slate-800/60 text-xs">
                    <span className="text-slate-500 text-[11px]">Email Address: </span>
                    <span className="text-slate-300 font-medium">{selectedOrder.customer_email}</span>
                  </div>
                )}

                {/* Admin Email Notification Status & Resend */}
                <div className="pt-2.5 border-t border-slate-800/60 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-slate-400 text-[11px]">Store Email Alert:</span>
                      {selectedOrder.admin_email_sent ? (
                        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                          Sent
                        </span>
                      ) : selectedOrder.admin_email_error ? (
                        <span
                          className="text-[10px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20"
                          title={selectedOrder.admin_email_error}
                        >
                          Failed
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                          Pending
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleResendEmail(selectedOrder.id)}
                      disabled={isResendingEmail}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-400 hover:text-sky-300 font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                      title="Send or resend email notification to freshvegitables29@gmail.com"
                    >
                      <Mail className="w-3 h-3" />
                      <span>{isResendingEmail ? 'Sending...' : 'Resend Email'}</span>
                    </button>
                  </div>
                  {resendEmailMsg && resendEmailMsg.id === selectedOrder.id && (
                    <p
                      className={`text-[10.5px] font-medium ${
                        resendEmailMsg.success ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {resendEmailMsg.text}
                    </p>
                  )}
                </div>
              </div>

              {/* 3. Delivery Address & Google Maps Location */}
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Delivery Address & GPS Navigation</span>
                  </h4>

                  <button
                    onClick={() =>
                      handleCopy(
                        getFormattedAddress(selectedOrder),
                        `modal-addr-${selectedOrder.id}`,
                        'Full delivery address'
                      )
                    }
                    className="text-[11px] font-bold text-brand-400 hover:underline flex items-center gap-1"
                  >
                    {copiedField === `modal-addr-${selectedOrder.id}` ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy Address</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-1.5 text-xs">
                  <p className="text-slate-200 leading-relaxed font-medium">
                    {getFormattedAddress(selectedOrder)}
                  </p>
                  {selectedOrder.notes && (
                    <div className="pt-2 text-amber-300 font-semibold flex items-start gap-1.5">
                      <span className="text-slate-500 shrink-0">Delivery Note:</span>
                      <span>"{selectedOrder.notes}"</span>
                    </div>
                  )}
                </div>

                {/* Google Maps Actions & GPS coordinates */}
                <div className="pt-1 space-y-2">
                  {(() => {
                    const coords = getCoordinates(selectedOrder);
                    const mapsUrl = getGoogleMapsUrl(selectedOrder);

                    if (coords) {
                      return (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                          <div>
                            <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider">
                              Verified GPS Coordinates
                            </span>
                            <p className="font-mono text-xs font-bold text-white mt-0.5">
                              Lat: {coords.lat.toFixed(6)}, Lng: {coords.lng.toFixed(6)}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() =>
                                handleCopy(`${coords.lat},${coords.lng}`, `coords-${selectedOrder.id}`, 'Coordinates')
                              }
                              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-colors flex items-center gap-1"
                            >
                              {copiedField === `coords-${selectedOrder.id}` ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                              <span>Copy GPS</span>
                            </button>

                            <a
                              href={mapsUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition-all flex items-center gap-1.5 shadow-sm"
                            >
                              <Navigation className="w-3.5 h-3.5" />
                              <span>Open in Google Maps</span>
                            </a>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800">
                        <div>
                          <span className="text-[10px] font-bold text-amber-400/90 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            <span>Exact GPS pin not shared by customer</span>
                          </span>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Search delivery route using formatted street address
                          </p>
                        </div>

                        <a
                          href={mapsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3.5 py-1.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-black text-xs transition-all flex items-center gap-1.5 self-start sm:self-auto"
                        >
                          <MapPin className="w-3.5 h-3.5" />
                          <span>Search on Google Maps</span>
                        </a>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* 4. Ordered Produce & Unit Snapshots */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Produce Line Items ({selectedOrder.items?.length || 0})
                  </h4>
                  <span className="text-[11px] text-slate-500">Historical purchase-time pricing snapshot</span>
                </div>

                {selectedOrder.items && selectedOrder.items.length > 0 ? (
                  <div className="divide-y divide-slate-800/80 rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
                    {selectedOrder.items.map((item: OrderItem, idx: number) => {
                      const itemName = item.product_name || item.product_name_snapshot || 'Fresh Vegetable';
                      const unitStr = item.unit || item.unit_snapshot || '1 unit';
                      const qty = item.quantity || 1;
                      const priceVal = Number(item.price || item.price_snapshot || 0);
                      const lineTotal = Number(item.subtotal || item.total || priceVal * qty);
                      const img =
                        item.image_url ||
                        (Array.isArray(item.product_images) ? item.product_images[0] : null) ||
                        'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=200&auto=format&fit=crop';

                      return (
                        <div key={item.id || idx} className="p-3.5 flex items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-3 min-w-0">
                            <img
                              src={img}
                              alt={itemName}
                              className="w-12 h-12 rounded-xl object-cover ring-1 ring-slate-700 bg-slate-800 shrink-0"
                              onError={(e) => {
                                e.currentTarget.src =
                                  'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=200&auto=format&fit=crop';
                              }}
                            />
                            <div className="min-w-0">
                              <p className="font-bold text-white text-xs truncate">{itemName}</p>
                              <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                                <span className="px-1.5 py-0.5 rounded bg-slate-800 font-mono text-slate-300">
                                  {unitStr}
                                </span>
                                <span>×</span>
                                <span className="font-bold text-white">{qty}</span>
                                {priceVal > 0 && <span className="text-slate-500">(@ ₹{priceVal})</span>}
                              </div>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="font-black text-brand-400 text-sm">₹{lineTotal}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-center text-xs text-slate-400">
                    No item lines recorded for this order.
                  </div>
                )}
              </div>

              {/* 5. Payment Details & Financial Breakdown */}
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Payment Status & Order Bill Breakdown</span>
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-500">Payment Mode</span>
                    <p className="font-bold text-white uppercase mt-0.5">{selectedOrder.payment_method}</p>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-500">Payment Status</span>
                    <p
                      className={`font-black uppercase mt-0.5 ${
                        selectedOrder.payment_status === 'paid' ? 'text-emerald-400' : 'text-amber-400'
                      }`}
                    >
                      {selectedOrder.payment_status}
                    </p>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-500">Delivery Charge</span>
                    <p className="font-bold text-white mt-0.5">
                      {selectedOrder.delivery_charge > 0 ? `₹${selectedOrder.delivery_charge}` : 'FREE'}
                    </p>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-500">Grand Total</span>
                    <p className="font-black text-brand-400 text-sm mt-0.5">₹{selectedOrder.total}</p>
                  </div>
                </div>

                {/* Mark as paid button for COD if currently pending */}
                {selectedOrder.payment_status !== 'paid' && selectedOrder.order_status !== 'cancelled' && (
                  <button
                    onClick={() => handleUpdateStatus(selectedOrder.id, selectedOrder.order_status, 'paid')}
                    disabled={isUpdatingStatus}
                    className="w-full py-2 px-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500 hover:text-slate-950 font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Mark Payment as Received (Paid)</span>
                  </button>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-slate-400">Order Net Payable:</span>
                <p className="text-xl font-black text-brand-400">₹{selectedOrder.total}</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsDetailDrawerOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================== CANCEL ORDER CONFIRMATION MODAL ===================== */}
      {orderToCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full text-white shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-base">Cancel Order #{orderToCancel.order_number}?</h3>
                <p className="text-xs text-slate-400">This action will return all reserved produce back to inventory.</p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300">Cancellation Reason (Optional)</label>
              <textarea
                rows={2}
                placeholder="e.g. Customer requested cancellation / Out of stock"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => {
                  setOrderToCancel(null);
                  setCancelReason('');
                }}
                disabled={isUpdatingStatus}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors"
              >
                Keep Order
              </button>
              <button
                onClick={handleConfirmCancel}
                disabled={isUpdatingStatus}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs transition-colors flex items-center gap-1.5"
              >
                {isUpdatingStatus ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminOrdersPage;
