import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  RefreshCw,
  Clock,
  CheckCircle2,
  Truck,
  MapPin,
  Phone,
  MessageCircle,
  AlertCircle,
  Package,
  Check,
  ShoppingBag,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  CreditCard,
  Copy,
} from 'lucide-react';
import api from '../../services/api';
import { DeliveryTrackingResponse, DeliveryTimelineEvent, Order, OrderItem } from '../../types';
import { subscribeLiveUpdates } from '../../services/liveSync';
import { useAuth } from '../../context/AuthContext';
import { SEOHead } from '../../components/common/SEOHead';
import { getProductImageUrl, getFallbackImageUrl } from '../../utils/imageUrl';

export const TrackingPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user: authUser } = useAuth();
  const [data, setData] = useState<DeliveryTrackingResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<boolean>(false);

  const fetchTracking = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      else setIsRefreshing(true);

      const cleanId = id && id !== 'undefined' ? id : 'latest';
      let trackingResult: DeliveryTrackingResponse | null = null;

      try {
        const res = await api.get(`/delivery/tracking/${cleanId}`);
        if (res.data?.data) {
          trackingResult = res.data.data;
        }
      } catch (err) {
        console.warn('Could not fetch via /delivery/tracking, falling back to /orders:', err);
      }

      // If order details or items missing, fetch /orders/:id directly
      if (!trackingResult || !trackingResult.order || trackingResult.order.id === 'demo-order' || !trackingResult.order.items?.length) {
        if (cleanId && cleanId !== 'latest') {
          try {
            const ordRes = await api.get(`/orders/${cleanId}`);
            if (ordRes.data?.data) {
              const rawOrd = ordRes.data.data;
              const addr = rawOrd.address_snapshot || rawOrd.delivery_address || {};
              const resolvedName = rawOrd.customer_name || addr.full_name || authUser?.name || 'Customer';
              const resolvedPhone = rawOrd.customer_mobile || addr.phone || authUser?.mobile || '';

              const fullAddr =
                addr.full_address ||
                [
                  addr.house_number
                    ? String(addr.house_number).toLowerCase().includes('flat') || String(addr.house_number).toLowerCase().includes('house')
                      ? addr.house_number
                      : `Flat/House ${addr.house_number}`
                    : '',
                  addr.street,
                  addr.area,
                  addr.landmark ? `Near ${addr.landmark}` : '',
                  addr.city || 'Hyderabad',
                  addr.state || 'Telangana',
                  addr.pincode ? `- ${addr.pincode}` : '',
                ]
                  .filter(Boolean)
                  .join(', ') || 'Doorstep Delivery Address';

              const normalizedAddr = {
                ...addr,
                full_name: resolvedName,
                phone: resolvedPhone,
                full_address: fullAddr,
              };

              trackingResult = {
                order: {
                  ...rawOrd,
                  customer_name: resolvedName,
                  customer_mobile: resolvedPhone,
                  delivery_address: normalizedAddr,
                  address_snapshot: addr,
                  items: rawOrd.items || rawOrd.order_items || [],
                },
                tracking: null,
                show_driver: false,
                carrier_name: 'Fresh Vegetables Direct Express',
                tracking_number: `TRK-${(rawOrd.order_number || cleanId).replace(/[^A-Za-z0-9]/g, '').slice(-8)}`,
                expected_delivery:
                  rawOrd.order_status === 'delivered'
                    ? 'Delivered'
                    : rawOrd.order_status === 'out_for_delivery'
                    ? 'Arriving Today'
                    : 'Today, within delivery slot',
                logistics_status: rawOrd.order_status,
                fulfillment_center: 'Fresh Vegetables Store & Fulfillment Hub',
                package_type: 'Fresh Farm Packaging',
                store_location: {
                  name: 'Fresh Vegetables Hub',
                  latitude: 17.4938,
                  longitude: 78.3995,
                },
                destination: {
                  address: fullAddr,
                  latitude: Number(addr.latitude) || 17.4938,
                  longitude: Number(addr.longitude) || 78.3995,
                },
              };
            }
          } catch (e) {
            console.warn('Direct order lookup failed:', e);
          }
        }
      }

      if (trackingResult) {
        setData(trackingResult);
      }
    } catch (err) {
      console.error('Error fetching tracking info:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [id, authUser]);

  useEffect(() => {
    fetchTracking();

    // Auto-refresh when tab gains focus
    const handleFocus = () => fetchTracking(true);
    window.addEventListener('focus', handleFocus);

    // Live sync: auto-update as soon as admin updates order status
    const unsubscribeSync = subscribeLiveUpdates(['orders', 'all'], () => {
      fetchTracking(true);
    });

    return () => {
      window.removeEventListener('focus', handleFocus);
      unsubscribeSync();
    };
  }, [fetchTracking]);

  const handleCopyOrderNumber = (num: string) => {
    if (!num) return;
    navigator.clipboard.writeText(num);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  if (loading && !data) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 py-20 text-center">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
        <h3 className="text-base font-bold text-slate-900">Loading Order Tracking...</h3>
        <p className="text-xs text-slate-500 mt-1">Retrieving live fulfillment milestones</p>
      </div>
    );
  }

  const order = data?.order || ({} as Partial<Order>);
  const currentStatus = (order.order_status || data?.logistics_status || 'confirmed').toLowerCase();
  const isCancelled = currentStatus === 'cancelled';
  const isDelivered = currentStatus === 'delivered';
  const isOutForDelivery = currentStatus === 'out_for_delivery';

  // 5 Real milestone stages
  const milestoneStages = isCancelled
    ? [
        { key: 'placed', label: 'Order Placed', desc: 'Received & Verified' },
        { key: 'cancelled', label: 'Order Cancelled', desc: 'Cancelled by Store' },
      ]
    : [
        { key: 'pending', label: 'Order Placed', desc: 'Received & Verified' },
        { key: 'confirmed', label: 'Confirmed', desc: 'Accepted by Store' },
        { key: 'packed', label: 'Harvested & Packed', desc: 'Ready for Dispatch' },
        { key: 'out_for_delivery', label: 'Out for Delivery', desc: 'On the Way' },
        { key: 'delivered', label: 'Delivered', desc: 'Doorstep Completed' },
      ];

  const getStepIndex = (st: string) => {
    switch (st) {
      case 'pending':
        return 0;
      case 'confirmed':
        return 1;
      case 'preparing':
      case 'packed':
        return 2;
      case 'out_for_delivery':
        return 3;
      case 'delivered':
        return 4;
      case 'cancelled':
        return 1;
      default:
        return 1;
    }
  };

  const currentStepIdx = getStepIndex(currentStatus);

  // Status visual attributes
  const getStatusPresentation = () => {
    switch (currentStatus) {
      case 'pending':
        return {
          title: 'Order Placed & Awaiting Confirmation',
          description: 'Your order has been received. Our fulfillment team is reviewing and scheduling harvest.',
          badge: 'Order Placed',
          badgeBg: 'bg-amber-500/10 text-amber-700 border-amber-200',
          icon: Clock,
          color: 'text-amber-600',
        };
      case 'confirmed':
        return {
          title: 'Order Confirmed by Store',
          description: 'Your order has been approved. Fresh farm procurement is underway.',
          badge: 'Confirmed',
          badgeBg: 'bg-blue-500/10 text-blue-700 border-blue-200',
          icon: CheckCircle2,
          color: 'text-blue-600',
        };
      case 'preparing':
      case 'packed':
        return {
          title: 'Harvested Fresh & Packed',
          description: 'Your vegetables have been freshly harvested, quality-checked, and packed for delivery.',
          badge: 'Packed & Ready',
          badgeBg: 'bg-purple-500/10 text-purple-700 border-purple-200',
          icon: Package,
          color: 'text-purple-600',
        };
      case 'out_for_delivery':
        return {
          title: 'Out for Delivery — Arriving Today',
          description: 'Your package is on its way to your delivery address. Please keep your phone available.',
          badge: 'Out for Delivery',
          badgeBg: 'bg-emerald-500/10 text-emerald-800 border-emerald-300 font-black',
          icon: Truck,
          color: 'text-emerald-600',
        };
      case 'delivered':
        return {
          title: 'Delivered Successfully 🎉',
          description: 'Your package has been safely delivered to your doorstep. Thank you for choosing organic!',
          badge: 'Delivered',
          badgeBg: 'bg-emerald-600 text-white border-transparent font-black',
          icon: CheckCircle2,
          color: 'text-emerald-600',
        };
      case 'cancelled':
        return {
          title: 'Order Cancelled',
          description: 'This order was cancelled by store operations. Produce has been returned to inventory.',
          badge: 'Cancelled',
          badgeBg: 'bg-rose-500/10 text-rose-700 border-rose-200',
          icon: AlertCircle,
          color: 'text-rose-600',
        };
      default:
        return {
          title: 'Processing Order',
          description: 'We are preparing your fresh farm order.',
          badge: currentStatus.toUpperCase(),
          badgeBg: 'bg-slate-100 text-slate-700 border-slate-200',
          icon: Clock,
          color: 'text-slate-600',
        };
    }
  };

  const statusPresentation = getStatusPresentation();
  const StatusIcon = statusPresentation.icon;

  // Real chronological activities
  const createdAt = new Date(order.created_at || Date.now());
  const orderDateStr = createdAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  const orderTimeStr = createdAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  const activities: DeliveryTimelineEvent[] = isCancelled
    ? [
        {
          id: '1',
          status: 'pending',
          title: 'Order Placed & Verified',
          description: `Order #${order.order_number || 'FV'} received with ${order.payment_method?.toUpperCase() || 'COD'} payment mode.`,
          timestamp: `${orderDateStr}, ${orderTimeStr}`,
          location: 'Fresh Farm Online Portal',
          completed: true,
        },
        {
          id: '2',
          status: 'cancelled',
          title: 'Order Cancelled',
          description: 'Order was cancelled by store operations. Reserved produce restored to inventory.',
          timestamp: `${orderDateStr}, ${orderTimeStr}`,
          location: 'Store Operations Hub, Hyderabad',
          completed: true,
        },
      ]
    : [
        {
          id: '1',
          status: 'pending',
          title: 'Order Placed & Verified',
          description: `Order #${order.order_number || 'FV'} received with ${order.payment_method?.toUpperCase() || 'COD'} payment mode.`,
          timestamp: `${orderDateStr}, ${orderTimeStr}`,
          location: 'Online Store Portal',
          completed: true,
        },
        {
          id: '2',
          status: 'confirmed',
          title: 'Order Confirmed',
          description: 'Order accepted by store fulfillment team and scheduled for farm procurement.',
          timestamp: currentStepIdx >= 1 ? `${orderDateStr}, ${orderTimeStr}` : 'Expected shortly',
          location: 'Fresh Vegetables Hub',
          completed: currentStepIdx >= 1,
        },
        {
          id: '3',
          status: 'packed',
          title: 'Harvested Fresh & Quality Graded',
          description: 'Produce harvested fresh from local organic plots. Sorted, cleaned, and packed.',
          timestamp: currentStepIdx >= 2 ? `${orderDateStr}, ${orderTimeStr}` : 'Pending harvest & packing',
          location: 'Sorting & Packaging Station',
          completed: currentStepIdx >= 2,
        },
        {
          id: '4',
          status: 'out_for_delivery',
          title: isOutForDelivery || isDelivered ? 'Out for Delivery' : 'Out for Delivery (Upcoming)',
          description:
            isOutForDelivery || isDelivered
              ? 'Package dispatched from store hub and is on the way to your delivery address.'
              : 'Package will be dispatched as soon as harvesting and packing are completed.',
          timestamp: currentStepIdx >= 3 ? `${orderDateStr}, ${orderTimeStr}` : 'Scheduled upon packing',
          location: 'Local Delivery Station',
          completed: currentStepIdx >= 3,
        },
        {
          id: '5',
          status: 'delivered',
          title: isDelivered ? 'Delivered' : 'Delivery at Doorstep',
          description: isDelivered
            ? 'Package safely delivered to your doorstep.'
            : 'Expected doorstep delivery within estimated time.',
          timestamp: isDelivered ? `${orderDateStr}, ${orderTimeStr}` : 'Estimated today',
          location: order.delivery_address?.full_address || 'Customer Doorstep',
          completed: isDelivered,
        },
      ];

  const addr = (order.delivery_address || order.address_snapshot || {}) as any;
  const recipientName = order.customer_name || addr.full_name || authUser?.name || 'Customer';
  const recipientPhone = order.customer_mobile || addr.phone || authUser?.mobile || '';
  const fullAddressText =
    addr.full_address ||
    [
      addr.house_number
        ? String(addr.house_number).toLowerCase().includes('flat') || String(addr.house_number).toLowerCase().includes('house')
          ? addr.house_number
          : `Flat/House ${addr.house_number}`
        : '',
      addr.street,
      addr.area,
      addr.landmark ? `Near ${addr.landmark}` : '',
      addr.city || 'Hyderabad',
      addr.state || 'Telangana',
      addr.pincode ? `- ${addr.pincode}` : '',
    ]
      .filter(Boolean)
      .join(', ') || 'Customer Doorstep Address';

  const orderItems: OrderItem[] = (order.items || (order as any).order_items || []) as OrderItem[];

  return (
    <div className="min-h-screen bg-slate-50/60 pb-16">
      <SEOHead title="Live Order Tracking | Fresh Vegetables Organic" noindex={true} />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* Navigation Breadcrumb & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Link
              to="/orders"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-emerald-700 transition-colors mb-2 group"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              <span>Back to My Orders</span>
            </Link>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Order Tracking
              </h1>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-mono font-bold border border-slate-200">
                <span>#{order.order_number || id}</span>
                <button
                  type="button"
                  onClick={() => handleCopyOrderNumber(order.order_number || id || '')}
                  title="Copy Order ID"
                  className="text-slate-400 hover:text-slate-700 transition-colors ml-0.5"
                >
                  {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Placed on {createdAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} at{' '}
              {orderTimeStr}
            </p>
          </div>

          <button
            type="button"
            onClick={() => fetchTracking(true)}
            disabled={isRefreshing}
            className="self-start sm:self-center inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 shadow-xs transition-all disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isRefreshing ? 'animate-spin text-emerald-600' : ''}`} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh Status'}</span>
          </button>
        </div>

        {/* HERO STATUS CARD */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 sm:p-8 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-6">
            <div className="flex items-start gap-4">
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border ${
                  isCancelled
                    ? 'bg-rose-50 border-rose-200 text-rose-600'
                    : isDelivered
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                    : isOutForDelivery
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700'
                    : 'bg-slate-100 border-slate-200 text-slate-700'
                }`}
              >
                <StatusIcon className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${statusPresentation.badgeBg}`}
                  >
                    {statusPresentation.badge}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-400">Doorstep Delivery</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  {statusPresentation.title}
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
                  {statusPresentation.description}
                </p>
              </div>
            </div>

            {/* Quick summary pill */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-xs space-y-1.5 shrink-0 min-w-[210px]">
              <div className="flex justify-between text-slate-500">
                <span>Payment Mode:</span>
                <span className="font-bold text-slate-800 uppercase">{order.payment_method || 'COD'}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Payment Status:</span>
                <span
                  className={`font-bold uppercase ${
                    order.payment_status === 'paid' || order.payment_status === 'cod_collected'
                      ? 'text-emerald-600'
                      : 'text-amber-600'
                  }`}
                >
                  {order.payment_status?.replace(/_/g, ' ') || 'Pending'}
                </span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Grand Total:</span>
                <span className="font-extrabold text-emerald-700 text-sm">₹{order.total}</span>
              </div>
            </div>
          </div>

          {/* Stepper Progress Bar */}
          <div className="pt-2">
            {isCancelled ? (
              <div className="max-w-md mx-auto grid grid-cols-2 gap-4 relative">
                <div className="absolute top-4 left-1/4 right-1/4 h-1 bg-rose-200 rounded-full" />
                <div className="flex flex-col items-center text-center relative z-10">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs bg-emerald-600 text-white shadow-md ring-4 ring-white">
                    <Check className="w-4 h-4 stroke-[3]" />
                  </div>
                  <span className="text-xs font-black mt-2 text-slate-900">Order Placed</span>
                  <span className="text-[10px] text-slate-400 mt-0.5 font-medium">Verified</span>
                </div>
                <div className="flex flex-col items-center text-center relative z-10">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs bg-rose-600 text-white shadow-md ring-4 ring-white">
                    ✕
                  </div>
                  <span className="text-xs font-black mt-2 text-rose-700">Cancelled</span>
                  <span className="text-[10px] text-rose-500 mt-0.5 font-medium">Order Terminated</span>
                </div>
              </div>
            ) : (
              <div className="relative">
                {/* Connecting background bar */}
                <div className="absolute top-4 left-6 right-6 h-1 bg-slate-100 rounded-full hidden sm:block" />
                {/* Filled active connecting bar */}
                <div
                  className="absolute top-4 left-6 h-1 bg-emerald-600 rounded-full transition-all duration-700 hidden sm:block"
                  style={{
                    width: `${(currentStepIdx / (milestoneStages.length - 1)) * 90}%`,
                  }}
                />

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 relative z-10">
                  {milestoneStages.map((stage, idx) => {
                    const isCompleted = idx <= currentStepIdx;
                    const isCurrent = idx === currentStepIdx;

                    return (
                      <div key={stage.key} className="flex flex-col items-center text-center">
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                            isCompleted
                              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20 ring-4 ring-white'
                              : 'bg-white text-slate-400 border-2 border-slate-200'
                          } ${isCurrent && !isDelivered ? 'ring-4 ring-emerald-200 animate-pulse' : ''}`}
                        >
                          {isCompleted ? <Check className="w-4 h-4 stroke-[3]" /> : idx + 1}
                        </div>
                        <span
                          className={`text-xs font-black mt-2 ${
                            isCompleted ? 'text-slate-900' : 'text-slate-400'
                          }`}
                        >
                          {stage.label}
                        </span>
                        <span className="text-[10px] text-slate-400 mt-0.5 font-medium">{stage.desc}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 2-COLUMN MAIN CONTENT GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT COLUMN: Timeline & Order Items (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Timeline Milestones Card */}
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 sm:p-7 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">Shipment Activity & Updates</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Chronological fulfillment progress</p>
                </div>
                <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                  Live Status
                </span>
              </div>

              <div className="relative pl-6 space-y-6 before:content-[''] before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
                {activities.map((act) => (
                  <div key={act.id} className="relative flex items-start gap-4">
                    <div
                      className={`absolute -left-6 mt-1 w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                        act.completed
                          ? 'bg-emerald-600 text-white ring-4 ring-white'
                          : 'bg-slate-200 text-slate-400 ring-4 ring-white'
                      }`}
                    >
                      {act.completed ? '✓' : ''}
                    </div>

                    <div className="flex-1 space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className={`text-xs font-black ${act.completed ? 'text-slate-900' : 'text-slate-400'}`}>
                          {act.title}
                        </p>
                        <span className="text-[11px] font-semibold text-slate-400">{act.timestamp}</span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">{act.description}</p>
                      <p className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-400" /> {act.location}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Order Items List Card */}
            {orderItems.length > 0 && (
              <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 sm:p-7 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-emerald-600" />
                    <span>Items in this Order ({orderItems.length})</span>
                  </h3>
                </div>

                <div className="divide-y divide-slate-100">
                  {orderItems.map((item, idx) => {
                    const price = Number(item.price || item.price_snapshot || 0);
                    const qty = Number(item.quantity || 1);
                    const lineTotal = Number(item.total || item.subtotal || price * qty);
                    const unitStr = item.unit || item.unit_snapshot || 'Standard';
                    const productName = item.product_name || item.product_name_snapshot || 'Farm Fresh Produce';
                    const rawImg =
                      item.image_url ||
                      (Array.isArray(item.product_images) && item.product_images[0]) ||
                      (Array.isArray(item.images) && item.images[0]) ||
                      (item as any).image ||
                      '';
                    const resolvedImg = getProductImageUrl(rawImg, productName);

                    return (
                      <div key={item.id || idx} className="py-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={resolvedImg}
                            alt={productName}
                            className="w-12 h-12 rounded-xl object-cover border border-slate-100 shrink-0 bg-slate-50"
                            onError={(e) => {
                              e.currentTarget.src = getFallbackImageUrl(productName);
                            }}
                          />
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 text-xs truncate">
                              {productName}
                            </p>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {unitStr} × {qty} {price > 0 && `(@ ₹${price})`}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-extrabold text-slate-900 text-xs">₹{lineTotal}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: Address, Payment & Support (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Delivery Address Card */}
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 space-y-3.5 text-xs">
              <h4 className="font-extrabold text-slate-900 border-b border-slate-100 pb-3 text-sm flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-600" />
                <span>Delivery Address</span>
              </h4>

              <div className="space-y-2 text-slate-600">
                <p>
                  <strong className="text-slate-800 font-bold">Recipient:</strong> {recipientName}
                </p>
                {recipientPhone && (
                  <p className="flex items-center gap-1.5">
                    <strong className="text-slate-800 font-bold">Phone:</strong>
                    <a href={`tel:${recipientPhone}`} className="text-emerald-700 hover:underline font-mono font-bold">
                      {recipientPhone}
                    </a>
                  </p>
                )}
                <p className="leading-relaxed pt-1">
                  <strong className="text-slate-800 font-bold block mb-0.5">Doorstep Location:</strong>
                  <span className="text-slate-700">{fullAddressText}</span>
                </p>
                {addr.landmark && (
                  <p className="text-[11px] text-slate-500">
                    <strong>Landmark:</strong> Near {addr.landmark}
                  </p>
                )}
              </div>
            </div>

            {/* Bill & Payment Summary Card */}
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 space-y-3 text-xs">
              <h4 className="font-extrabold text-slate-900 border-b border-slate-100 pb-3 text-sm flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-600" />
                <span>Payment & Bill Summary</span>
              </h4>

              <div className="space-y-2 text-slate-600">
                <div className="flex justify-between">
                  <span>Items Subtotal:</span>
                  <span className="font-semibold text-slate-800">₹{order.subtotal || order.total}</span>
                </div>
                <div className="flex justify-between">
                  <span>Delivery Charges:</span>
                  <span className="font-semibold text-slate-800">
                    {Number(order.delivery_charge || 0) > 0 ? `₹${order.delivery_charge}` : 'FREE'}
                  </span>
                </div>
                {Number(order.discount || 0) > 0 && (
                  <div className="flex justify-between text-emerald-700 font-semibold">
                    <span>Discount Applied:</span>
                    <span>-₹{order.discount}</span>
                  </div>
                )}
                <div className="border-t border-slate-100 pt-2.5 flex justify-between items-center text-sm">
                  <span className="font-extrabold text-slate-900">Total Payable:</span>
                  <span className="font-black text-emerald-700 text-base">₹{order.total}</span>
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-slate-100 text-[11px]">
                  <span className="text-slate-500">Method:</span>
                  <span className="font-bold text-slate-800 uppercase">{order.payment_method || 'COD'}</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">Payment Status:</span>
                  <span
                    className={`font-bold uppercase ${
                      order.payment_status === 'paid' || order.payment_status === 'cod_collected'
                        ? 'text-emerald-700'
                        : 'text-amber-700'
                    }`}
                  >
                    {order.payment_status?.replace(/_/g, ' ') || 'Pending'}
                  </span>
                </div>
              </div>
            </div>

            {/* Store Help & Direct Support Card */}
            <div className="bg-slate-900 text-white rounded-3xl p-6 space-y-3.5 shadow-md">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                  <Phone className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-white">Have questions about your order?</h4>
                  <p className="text-[11px] text-slate-400">Our local store team is here to assist you.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <a
                  href="tel:+918106970384"
                  className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Call Store</span>
                </a>
                <a
                  href={`https://wa.me/918106970384?text=${encodeURIComponent(
                    `Hello Fresh Vegetables, regarding my order #${order.order_number || id}...`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrackingPage;
