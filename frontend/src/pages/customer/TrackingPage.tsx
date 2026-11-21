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
  Building2,
  Sparkles,
  Navigation,
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
                  rawOrd.confirmed_eta ||
                  addr.confirmed_eta ||
                  (rawOrd.order_status === 'delivered'
                    ? 'Delivered'
                    : rawOrd.order_status === 'out_for_delivery'
                    ? 'On the way to your delivery address'
                    : 'Scheduled in delivery slot'),
                logistics_status: rawOrd.order_status,
                fulfillment_center:
                  rawOrd.assigned_hub_name ||
                  addr.assigned_hub_name ||
                  (rawOrd.assigned_hub_code === 'kphb' || addr.assigned_hub_code === 'kphb'
                    ? 'Fresh Vegetables KPHB Hub'
                    : 'Fresh Vegetables Champapet Hub'),
                package_type: 'Certified Farm-Fresh Packaging',
                store_location: {
                  name:
                    rawOrd.assigned_hub_name ||
                    (rawOrd.assigned_hub_code === 'kphb' || addr.assigned_hub_code === 'kphb'
                      ? 'Fresh Vegetables KPHB Hub'
                      : 'Fresh Vegetables Champapet Hub'),
                  latitude:
                    rawOrd.assigned_hub_code === 'kphb' || addr.assigned_hub_code === 'kphb'
                      ? 17.48942
                      : 17.34457,
                  longitude:
                    rawOrd.assigned_hub_code === 'kphb' || addr.assigned_hub_code === 'kphb'
                      ? 78.397227
                      : 78.516972,
                },
                destination: {
                  address: fullAddr,
                  latitude: addr.latitude !== null && addr.latitude !== undefined && !isNaN(Number(addr.latitude)) ? Number(addr.latitude) : null,
                  longitude: addr.longitude !== null && addr.longitude !== undefined && !isNaN(Number(addr.longitude)) ? Number(addr.longitude) : null,
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
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 py-20 text-center font-sans">
        <div className="w-10 h-10 border-3 border-forest-900 border-t-transparent rounded-full animate-spin mb-4" />
        <h3 className="text-base font-bold text-ink-900 font-serif">Loading Order Tracking...</h3>
        <p className="text-xs text-ink-400 mt-1">Retrieving live fulfillment milestones</p>
      </div>
    );
  }

  const order = data?.order || ({} as Partial<Order>);
  const currentStatus = (order.order_status || data?.logistics_status || 'confirmed').toLowerCase();
  const isCancelled = currentStatus === 'cancelled';
  const isDelivered = currentStatus === 'delivered';
  const isOutForDelivery = currentStatus === 'out_for_delivery';

  // Fulfillment Hub Details (Two-Hub Architecture: Champapet vs. KPHB)
  const hubInfo = (data as any)?.assigned_hub || (data as any)?.fulfillment_hub || {};
  const hubName = (order as any).assigned_hub_name || hubInfo.name || 'Champapet Fulfillment Hub';
  const hubCode = (order as any).assigned_hub_code || hubInfo.code || (hubName.toLowerCase().includes('kphb') ? 'HUB-KPHB' : 'HUB-CP');
  const hubAddress = (order as any).assigned_hub_address || hubInfo.address || (hubName.toLowerCase().includes('kphb') ? 'Road Number 3, Phase 3, KPHB Colony, Hyderabad' : 'Raji Reddy Nagar Colony, Champapet, Hyderabad');
  const hubDistanceKm = (order as any).hub_distance_km ?? (data as any)?.hub_distance_km ?? null;

  // 6 Real milestone stages (Admin-Managed Direct Delivery)
  const milestoneStages = isCancelled
    ? [
        { key: 'placed', label: 'Order Placed', desc: 'Received & Verified' },
        { key: 'cancelled', label: 'Order Cancelled', desc: 'Cancelled by Store' },
      ]
    : [
        { key: 'pending', label: 'Order Placed', desc: 'Received & Verified' },
        { key: 'confirmed', label: 'Order Confirmed', desc: 'Accepted by Hub' },
        { key: 'preparing', label: 'Preparing', desc: 'Harvest & Sorting' },
        { key: 'ready_for_delivery', label: 'Ready for Delivery', desc: 'Packed & Staged' },
        { key: 'out_for_delivery', label: 'Out for Delivery', desc: 'On Direct Route' },
        { key: 'delivered', label: 'Delivered', desc: 'Doorstep Completed' },
      ];

  const getStepIndex = (st: string) => {
    if (st === 'cancelled') return 1;
    if (st === 'delivered') return 5;
    if (st === 'out_for_delivery') return 4;
    if (st === 'ready_for_delivery' || st === 'packed') return 3;
    if (st === 'preparing') return 2;
    if (st === 'confirmed') return 1;
    return 0;
  };

  const currentStepIdx = getStepIndex(currentStatus);

  // Status visual attributes
  const getStatusPresentation = () => {
    switch (currentStatus) {
      case 'pending':
        return {
          title: 'Order Placed & Awaiting Confirmation',
          description: 'Your order has been recorded. Our team is scheduling fresh produce procurement.',
          badge: 'Order Placed',
          badgeBg: 'bg-cream-200 text-ink-800 border-line',
          icon: Clock,
        };
      case 'confirmed':
        return {
          title: 'Order Confirmed by Store',
          description: 'Your order has been confirmed. Fresh vegetable selection is in progress.',
          badge: 'Confirmed',
          badgeBg: 'bg-sage-100 text-forest-800 border-leaf-500/20',
          icon: CheckCircle2,
        };
      case 'preparing':
        return {
          title: 'Harvesting & Preparing Fresh Produce',
          description: 'Your vegetables have been freshly harvested and are undergoing quality inspection.',
          badge: 'Preparing',
          badgeBg: 'bg-sage-100 text-forest-800 border-leaf-500/20',
          icon: Package,
        };
      case 'ready_for_delivery':
      case 'packed':
        return {
          title: 'Packed & Ready for Delivery',
          description: 'Your fresh produce is packed in eco-friendly packaging and staged for doorstep dispatch.',
          badge: 'Ready for Delivery',
          badgeBg: 'bg-sage-100 text-forest-900 border-leaf-500/20',
          icon: Package,
        };
      case 'out_for_delivery':
        return {
          title: 'Out for Delivery — On Route to Your Doorstep',
          description: 'Our direct delivery team is on the way to your verified address within our 5 KM service zone.',
          badge: 'Out for Delivery',
          badgeBg: 'bg-leaf-100 text-forest-900 border-leaf-400 font-bold animate-pulse',
          icon: Truck,
        };
      case 'delivered':
        return {
          title: 'Delivered Successfully 🎉',
          description: 'Your package has been safely delivered to your doorstep. Thank you for choosing fresh produce!',
          badge: 'Delivered',
          badgeBg: 'bg-forest-900 text-cream-50 border-transparent font-bold',
          icon: CheckCircle2,
        };
      case 'cancelled':
        return {
          title: 'Order Cancelled',
          description: 'This order was cancelled by store operations. Produce has been returned to inventory.',
          badge: 'Cancelled',
          badgeBg: 'bg-tomato-50 text-tomato-600 border-tomato-200',
          icon: AlertCircle,
        };
      default:
        return {
          title: 'Processing Order',
          description: 'We are preparing your fresh farm order.',
          badge: currentStatus.toUpperCase(),
          badgeBg: 'bg-cream-100 text-ink-700 border-line',
          icon: Clock,
        };
    }
  };

  const statusPresentation = getStatusPresentation();
  const StatusIcon = statusPresentation.icon;

  // Chronological activities
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
          location: 'Fresh Vegetables Online Store',
          completed: true,
        },
        {
          id: '2',
          status: 'cancelled',
          title: 'Order Cancelled',
          description: 'Order was cancelled by store operations. Reserved produce restored to inventory.',
          timestamp: `${orderDateStr}, ${orderTimeStr}`,
          location: 'Store Fulfillment Hub, Hyderabad',
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
          location: 'Fresh Vegetables Online Store',
          completed: true,
        },
        {
          id: '2',
          status: 'confirmed',
          title: 'Order Confirmed',
          description: 'Order confirmed by store fulfillment team and scheduled for preparation.',
          timestamp: currentStepIdx >= 1 ? `${orderDateStr}, ${orderTimeStr}` : 'Expected shortly',
          location: hubName || 'Fulfillment Hub',
          completed: currentStepIdx >= 1,
        },
        {
          id: '3',
          status: 'preparing',
          title: 'Harvested Fresh & Quality Checked',
          description: 'Produce selected from local organic partner farms. Cleaned, sorted, and weighed.',
          timestamp: currentStepIdx >= 2 ? `${orderDateStr}, ${orderTimeStr}` : 'Pending harvest & preparation',
          location: 'Sorting & Packaging Station',
          completed: currentStepIdx >= 2,
        },
        {
          id: '4',
          status: 'ready_for_delivery',
          title: 'Packed & Ready for Delivery',
          description: 'Order packed in eco-friendly packaging and staged for direct doorstep dispatch.',
          timestamp: currentStepIdx >= 3 ? `${orderDateStr}, ${orderTimeStr}` : 'Pending packaging',
          location: hubName || 'Fulfillment Hub',
          completed: currentStepIdx >= 3,
        },
        {
          id: '5',
          status: 'out_for_delivery',
          title: isOutForDelivery || isDelivered ? 'Out for Delivery' : 'Out for Delivery (Upcoming)',
          description:
            isOutForDelivery || isDelivered
              ? 'Package dispatched from local fulfillment hub on direct route to your address.'
              : 'Direct doorstep dispatch upon packaging completion.',
          timestamp: currentStepIdx >= 4 ? `${orderDateStr}, ${orderTimeStr}` : 'Scheduled upon packing',
          location: 'Hyderabad Direct Route',
          completed: currentStepIdx >= 4,
        },
        {
          id: '6',
          status: 'delivered',
          title: isDelivered ? 'Delivered' : 'Delivery at Doorstep',
          description: isDelivered
            ? 'Package safely delivered to your doorstep. Enjoy your 100% organic produce!'
            : 'Expected doorstep delivery within scheduled delivery slot.',
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
    <div className="min-h-screen bg-cream-50/60 pb-16 font-sans animate-slide-up">
      <SEOHead title="Live Order Tracking | Fresh Vegetables Organic" noindex={true} />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* Navigation Breadcrumb & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Link
              to="/orders"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-ink-500 hover:text-forest-900 transition-colors mb-2 group"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              <span>Back to My Orders</span>
            </Link>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-serif text-2xl sm:text-3xl font-bold text-ink-900 tracking-tight">
                Order Tracking
              </h1>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-cream-100 text-ink-700 text-xs font-mono font-bold border border-line">
                <span>#{order.order_number || id}</span>
                <button
                  type="button"
                  onClick={() => handleCopyOrderNumber(order.order_number || id || '')}
                  title="Copy Order ID"
                  aria-label="Copy Order ID"
                  className="text-ink-400 hover:text-ink-700 transition-colors ml-0.5 cursor-pointer"
                >
                  {copiedId ? <Check className="w-3.5 h-3.5 text-forest-700" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            <p className="text-xs text-ink-500 mt-1">
              Placed on {createdAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} at{' '}
              {orderTimeStr}
            </p>
          </div>

          <button
            type="button"
            onClick={() => fetchTracking(true)}
            disabled={isRefreshing}
            className="self-start sm:self-center inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-surface hover:bg-cream-100 text-ink-800 text-xs font-bold border border-line shadow-soft transition-all disabled:opacity-60 cursor-pointer min-h-[40px]"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-ink-500 ${isRefreshing ? 'animate-spin text-forest-700' : ''}`} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh Status'}</span>
          </button>
        </div>

        {/* HERO STATUS CARD */}
        <div className="bg-surface rounded-3xl border border-line shadow-soft p-6 sm:p-8 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-line pb-6">
            <div className="flex items-start gap-4">
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border ${
                  isCancelled
                    ? 'bg-tomato-50 border-tomato-200 text-tomato-600'
                    : isDelivered
                    ? 'bg-sage-100 border-leaf-500/20 text-forest-800'
                    : isOutForDelivery
                    ? 'bg-leaf-100 border-leaf-400 text-forest-900'
                    : 'bg-cream-100 border-line text-ink-700'
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
                  <span className="text-[11px] font-semibold text-ink-400">Doorstep Delivery</span>
                </div>
                <h2 className="font-serif text-xl sm:text-2xl font-bold text-ink-900 tracking-tight">
                  {statusPresentation.title}
                </h2>
                <p className="text-xs sm:text-sm text-ink-600 leading-relaxed font-medium">
                  {statusPresentation.description}
                </p>
              </div>
            </div>

            {/* Quick summary pill */}
            <div className="bg-cream-50/70 border border-line rounded-2xl p-4 text-xs space-y-1.5 shrink-0 min-w-[210px]">
              <div className="flex justify-between text-ink-500">
                <span>Payment Mode:</span>
                <span className="font-bold text-ink-800 uppercase">{order.payment_method || 'COD'}</span>
              </div>
              <div className="flex justify-between text-ink-500">
                <span>Payment Status:</span>
                <span
                  className={`font-bold uppercase ${
                    order.payment_status === 'paid' || order.payment_status === 'cod_collected'
                      ? 'text-forest-700'
                      : 'text-marigold-600'
                  }`}
                >
                  {order.payment_status?.replace(/_/g, ' ') || 'Pending'}
                </span>
              </div>
              <div className="flex justify-between text-ink-500">
                <span>Grand Total:</span>
                <span className="font-serif font-bold text-forest-900 text-sm">₹{order.total}</span>
              </div>
            </div>
          </div>

          {/* Stepper Progress Bar */}
          <div className="pt-2">
            {isCancelled ? (
              <div className="max-w-md mx-auto grid grid-cols-2 gap-4 relative">
                <div className="absolute top-4 left-1/4 right-1/4 h-1 bg-tomato-200 rounded-full" />
                <div className="flex flex-col items-center text-center relative z-10">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs bg-forest-900 text-cream-50 shadow-soft ring-4 ring-surface">
                    <Check className="w-4 h-4 stroke-[3]" />
                  </div>
                  <span className="text-xs font-bold mt-2 text-ink-900">Order Placed</span>
                  <span className="text-[10px] text-ink-400 mt-0.5 font-medium">Verified</span>
                </div>
                <div className="flex flex-col items-center text-center relative z-10">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs bg-tomato-500 text-cream-50 shadow-soft ring-4 ring-surface">
                    ✕
                  </div>
                  <span className="text-xs font-bold mt-2 text-tomato-600">Cancelled</span>
                  <span className="text-[10px] text-tomato-500 mt-0.5 font-medium">Terminated</span>
                </div>
              </div>
            ) : (
              <div className="relative">
                {/* Connecting background bar */}
                <div className="absolute top-4 left-6 right-6 h-1 bg-cream-200 rounded-full hidden sm:block" />
                {/* Filled active connecting bar */}
                <div
                  className="absolute top-4 left-6 h-1 bg-forest-900 rounded-full transition-all duration-700 hidden sm:block"
                  style={{
                    width: `${(currentStepIdx / (milestoneStages.length - 1)) * 90}%`,
                  }}
                />

                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 relative z-10">
                  {milestoneStages.map((stage, idx) => {
                    const isCompleted = idx <= currentStepIdx;
                    const isCurrent = idx === currentStepIdx;

                    return (
                      <div key={stage.key} className="flex flex-col items-center text-center">
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                            isCompleted
                              ? 'bg-forest-900 text-cream-50 shadow-soft ring-4 ring-surface'
                              : 'bg-surface text-ink-400 border-2 border-line'
                          } ${isCurrent && !isDelivered ? 'ring-4 ring-leaf-200 animate-pulse' : ''}`}
                        >
                          {isCompleted ? <Check className="w-4 h-4 stroke-[3]" /> : idx + 1}
                        </div>
                        <span
                          className={`text-xs font-bold mt-2 ${
                            isCompleted ? 'text-ink-900 font-bold' : 'text-ink-400'
                          }`}
                        >
                          {stage.label}
                        </span>
                        <span className="text-[10px] text-ink-400 mt-0.5 font-medium">{stage.desc}</span>
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
            <div className="bg-surface rounded-3xl border border-line shadow-soft p-6 sm:p-7 space-y-5">
              <div className="flex items-center justify-between border-b border-line pb-4">
                <div>
                  <h3 className="font-serif font-bold text-ink-900 text-base">Shipment Activity & Updates</h3>
                  <p className="text-xs text-ink-400 mt-0.5">Chronological fulfillment progress</p>
                </div>
                <span className="text-xs font-bold text-forest-800 bg-sage-100 px-3 py-1 rounded-full border border-leaf-500/20">
                  Live Status
                </span>
              </div>

              <div className="relative pl-6 space-y-6 before:content-[''] before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-line">
                {activities.map((act) => (
                  <div key={act.id} className="relative flex items-start gap-4">
                    <div
                      className={`absolute -left-6 mt-1 w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                        act.completed
                          ? 'bg-forest-900 text-cream-50 ring-4 ring-surface'
                          : 'bg-cream-200 text-ink-400 ring-4 ring-surface'
                      }`}
                    >
                      {act.completed ? '✓' : ''}
                    </div>

                    <div className="flex-1 space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className={`text-xs font-bold ${act.completed ? 'text-ink-900' : 'text-ink-400'}`}>
                          {act.title}
                        </p>
                        <span className="text-[11px] font-semibold text-ink-400">{act.timestamp}</span>
                      </div>
                      <p className="text-xs text-ink-600 leading-relaxed">{act.description}</p>
                      <p className="text-[11px] font-mono text-ink-400 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-ink-400" /> {act.location}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Order Items List Card */}
            {orderItems.length > 0 && (
              <div className="bg-surface rounded-3xl border border-line shadow-soft p-6 sm:p-7 space-y-4">
                <div className="flex items-center justify-between border-b border-line pb-3">
                  <h3 className="font-serif font-bold text-ink-900 text-base flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-forest-700" />
                    <span>Items in this Order ({orderItems.length})</span>
                  </h3>
                </div>

                <div className="divide-y divide-line">
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
                            className="w-12 h-12 rounded-xl object-contain border border-line shrink-0 bg-cream-50 p-1"
                            onError={(e) => {
                              e.currentTarget.src = getFallbackImageUrl(productName);
                            }}
                          />
                          <div className="min-w-0">
                            <p className="font-bold text-ink-900 text-xs truncate">
                              {productName}
                            </p>
                            <p className="text-[11px] text-ink-500 mt-0.5">
                              {unitStr} × {qty} {price > 0 && `(@ ₹${price})`}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-mono font-bold text-ink-900 text-xs">₹{lineTotal}</span>
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
            {/* Direct Store Delivery & Fulfillment Card */}
            <div className="bg-surface rounded-3xl border border-line shadow-soft p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <h4 className="font-serif font-bold text-ink-900 text-sm flex items-center gap-2">
                  <Truck className="w-4 h-4 text-forest-700" />
                  <span>Direct Doorstep Delivery</span>
                </h4>
                <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${
                  isDelivered
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : isOutForDelivery
                    ? 'bg-leaf-100 text-forest-900 border-leaf-400 animate-pulse'
                    : 'bg-cream-100 text-ink-700 border-line'
                }`}>
                  {isDelivered ? 'Delivered' : isOutForDelivery ? 'Out for Delivery' : 'Direct Store Delivery'}
                </span>
              </div>

              {/* Service Model & Fulfillment Hub */}
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-forest-900 text-cream-50 font-bold flex items-center justify-center text-sm shrink-0">
                    🌱
                  </div>
                  <div>
                    <h5 className="font-bold text-ink-900 text-sm">
                      Fresh Vegetables Store Team
                    </h5>
                    <p className="text-[11px] text-ink-500">
                      Direct owner delivery • 100% farm-fresh harvest
                    </p>
                    <span className="text-[11px] text-forest-700 font-bold">
                      Fulfillment Hub: {hubName}
                    </span>
                  </div>
                </div>

                {hubAddress && (
                  <div className="p-3 rounded-2xl bg-cream-100/70 border border-line text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-ink-500 font-medium">Dispatched From:</span>
                      <span className="font-bold text-ink-800 text-[11px] font-mono">{hubCode}</span>
                    </div>
                    <p className="text-ink-700 text-[11px] leading-relaxed">
                      {hubAddress}
                    </p>
                    {hubDistanceKm !== null && hubDistanceKm !== undefined && (
                      <p className="text-ink-500 text-[10px]">
                        Distance to your doorstep: <strong>{Number(hubDistanceKm).toFixed(1)} km</strong> (5 KM radius)
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Delivery Window & Support */}
              <div className="p-3.5 rounded-2xl bg-cream-100/70 border border-line space-y-2 text-xs">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-ink-500">Delivery Window:</span>
                  <span className="font-bold text-forest-800 font-mono text-xs">
                    {data?.confirmed_eta || order.confirmed_eta || (isDelivered ? 'Delivered' : isOutForDelivery ? 'Arriving shortly at your address' : 'Scheduled in delivery slot')}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-ink-500">Need Help?</span>
                  <a
                    href="tel:+918106970384"
                    className="inline-flex items-center gap-1 text-forest-800 font-bold hover:underline"
                  >
                    <Phone className="w-3 h-3 text-leaf-600" />
                    <span>+91 8106970384</span>
                  </a>
                </div>
              </div>

              {/* View Destination in Google Maps */}
              {data?.destination?.latitude && data?.destination?.longitude && (
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${data.destination.latitude},${data.destination.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 px-4 rounded-xl bg-forest-50 hover:bg-forest-100 text-forest-800 font-bold text-xs flex items-center justify-center gap-2 border border-forest-200 transition-colors"
                >
                  <Navigation className="w-4 h-4 text-forest-700" /> View Delivery Address on Map
                </a>
              )}
            </div>

            {/* Delivery Address Card */}
            <div className="bg-surface rounded-3xl border border-line shadow-soft p-6 space-y-3.5 text-xs">
              <h4 className="font-serif font-bold text-ink-900 border-b border-line pb-3 text-sm flex items-center gap-2">
                <MapPin className="w-4 h-4 text-forest-700" />
                <span>Delivery Address</span>
              </h4>

              <div className="space-y-2 text-ink-600">
                <p>
                  <strong className="text-ink-900 font-bold">Recipient:</strong> {recipientName}
                </p>
                {recipientPhone && (
                  <p className="flex items-center gap-1.5">
                    <strong className="text-ink-900 font-bold">Phone:</strong>
                    <a href={`tel:${recipientPhone}`} className="text-forest-800 hover:underline font-mono font-bold">
                      {recipientPhone}
                    </a>
                  </p>
                )}
                <p className="leading-relaxed pt-1">
                  <strong className="text-ink-900 font-bold block mb-0.5">Doorstep Location:</strong>
                  <span className="text-ink-700">{fullAddressText}</span>
                </p>
                {addr.landmark && (
                  <p className="text-[11px] text-ink-500">
                    <strong>Landmark:</strong> Near {addr.landmark}
                  </p>
                )}
              </div>
            </div>

            {/* Two-Hub Fulfillment Station Card */}
            <div className="bg-surface rounded-3xl border border-line shadow-soft p-6 space-y-3.5 text-xs">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <h4 className="font-serif font-bold text-ink-900 text-sm flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-forest-700" />
                  <span>Fulfillment Hub</span>
                </h4>
                <span className="text-[10px] font-bold text-forest-800 bg-leaf-100 px-2.5 py-0.5 rounded-full border border-leaf-400/30">
                  Max 5.0 KM Radius
                </span>
              </div>

              <div className="space-y-2.5 text-ink-600">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="font-bold text-ink-900 text-xs">
                    {order.assigned_hub_name ||
                      (order.assigned_hub_code === 'kphb' ? 'Fresh Vegetables KPHB Hub' : 'Fresh Vegetables Champapet Hub')}
                  </span>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 bg-sage-100 text-forest-800 rounded-md border border-leaf-500/20 font-mono">
                    {order.assigned_hub_code || 'CHAMPAPET'}
                  </span>
                </div>
                <p className="text-[11px] text-ink-500 leading-relaxed">
                  {order.assigned_hub_address ||
                    (order.assigned_hub_code === 'kphb'
                      ? 'Road Number 3, Phase 3, KPHB Colony, Hyderabad'
                      : 'Raji Reddy Nagar Colony, Champapet, Hyderabad')}
                </p>

                <div className="pt-2 border-t border-line space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="text-ink-500">Service Zone:</span>
                    <span className="font-semibold text-ink-800">
                      {order.delivery_zone_name || (order as any).address_snapshot?.delivery_zone_name || 'Express Produce Zone'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-ink-500">Hub Distance:</span>
                    <span className="font-bold text-forest-900 font-mono">
                      {order.hub_distance_km ? `${order.hub_distance_km} KM` : (order as any).address_snapshot?.distance_km ? `${(order as any).address_snapshot?.distance_km} KM` : '< 5.0 KM'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-ink-500">Estimated Delivery ETA:</span>
                    <span className="font-bold text-forest-800">
                      {data?.confirmed_eta || order.confirmed_eta || (order as any).address_snapshot?.confirmed_eta || (isDelivered ? 'Delivered' : isOutForDelivery ? 'On the way to your delivery address' : 'Scheduled in delivery slot')}
                    </span>
                  </div>
                </div>

                <div className="pt-1 flex items-center gap-1.5 text-[10px] text-forest-700 font-medium">
                  <ShieldCheck className="w-3.5 h-3.5 text-leaf-600" />
                  <span>Two-hub freshness guarantee — within 5.0 KM max radius</span>
                </div>
              </div>
            </div>

            {/* Bill & Payment Summary Card */}
            <div className="bg-surface rounded-3xl border border-line shadow-soft p-6 space-y-3 text-xs">
              <h4 className="font-serif font-bold text-ink-900 border-b border-line pb-3 text-sm flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-forest-700" />
                <span>Payment & Bill Summary</span>
              </h4>

              <div className="space-y-2 text-ink-600">
                <div className="flex justify-between">
                  <span>Items Subtotal:</span>
                  <span className="font-semibold text-ink-900">₹{order.subtotal || order.total}</span>
                </div>
                <div className="flex justify-between">
                  <span>Delivery Charges:</span>
                  <span className="font-semibold text-ink-900">
                    {Number(order.delivery_charge || 0) > 0 ? `₹${order.delivery_charge}` : 'FREE'}
                  </span>
                </div>
                {Number(order.discount || 0) > 0 && (
                  <div className="flex justify-between text-forest-700 font-semibold">
                    <span>Discount Applied:</span>
                    <span>-₹{order.discount}</span>
                  </div>
                )}
                <div className="border-t border-line pt-2.5 flex justify-between items-center text-sm">
                  <span className="font-serif font-bold text-ink-900">Total Payable:</span>
                  <span className="font-serif font-bold text-forest-900 text-base">₹{order.total}</span>
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-line text-[11px]">
                  <span className="text-ink-500">Method:</span>
                  <span className="font-bold text-ink-800 uppercase">{order.payment_method || 'COD'}</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-ink-500">Payment Status:</span>
                  <span
                    className={`font-bold uppercase ${
                      order.payment_status === 'paid' || order.payment_status === 'cod_collected'
                        ? 'text-forest-700'
                        : 'text-marigold-600'
                    }`}
                  >
                    {order.payment_status?.replace(/_/g, ' ') || 'Pending'}
                  </span>
                </div>
              </div>
            </div>

            {/* Store Help & Direct Support Card */}
            <div className="bg-forest-900 text-cream-50 rounded-3xl p-6 space-y-3.5 shadow-soft">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-2xl bg-cream-50/10 text-cream-50 border border-cream-50/20">
                  <Phone className="w-4 h-4 text-leaf-300" />
                </div>
                <div>
                  <h4 className="font-serif font-bold text-sm text-cream-50">Need order support?</h4>
                  <p className="text-[11px] text-cream-200/80">Our local store team is ready to coordinate.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <a
                  href="tel:+918106970384"
                  className="btn-pill-primary py-2.5 px-3 rounded-full bg-forest-800 hover:bg-forest-700 text-cream-50 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors border border-cream-50/20 shadow-soft min-h-[40px]"
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
                  className="py-2.5 px-3 rounded-full bg-cream-50/10 hover:bg-cream-50/20 text-cream-50 border border-cream-50/30 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors min-h-[40px]"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-leaf-300" />
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
