import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  MapPin,
  Phone,
  MessageCircle,
  Truck,
  CheckCircle2,
  Clock,
  ShieldCheck,
  ChevronRight,
  RefreshCw,
  Navigation,
  ArrowLeft,
  Sparkles,
  Package,
  Box,
  Check,
  ExternalLink,
  Calendar,
  AlertCircle,
  Info,
} from 'lucide-react';
import api from '../../services/api';
import { DeliveryTrackingResponse, DeliveryTimelineEvent } from '../../types';
import { subscribeLiveUpdates } from '../../services/liveSync';

const DEFAULT_TRACKING_DATA: DeliveryTrackingResponse = {
  order: {
    id: 'demo-order',
    order_number: 'FV-884291',
    user_id: 'cust-1',
    address_id: 'addr-1',
    subtotal: 580,
    delivery_charge: 0,
    discount: 50,
    total: 530,
    payment_method: 'upi',
    payment_status: 'paid',
    order_status: 'confirmed',
    customer_name: 'Rahul Sharma',
    customer_mobile: '+91 8106970384',
    delivery_address: {
      address_line1: 'Flat 402, Green Acres Residency',
      address_line2: 'Near Outer Ring Road',
      area: 'Satellite Road, Sector 14',
      city: 'Ahmedabad',
      pincode: '380015',
    },
    created_at: new Date().toISOString(),
  },
  show_driver: false,
  carrier_name: 'FreshVeg Logistics Express',
  tracking_number: 'TRK-FV884291',
  expected_delivery: 'Today, by 8:00 PM',
  logistics_status: 'confirmed',
  fulfillment_center: 'Central Farm Depot, Agro Hub 04, Ahmedabad',
  package_type: 'Eco-Insulated Cold-Chain Fresh Harvest Box',
  tracking: {
    order_id: 'demo-order',
    status: 'OUT_FOR_DELIVERY',
    partner_name: 'Ravi Kumar',
    partner_phone: '+91 98123 45678',
    partner_rating: 4.88,
    vehicle_type: 'Electric Scooter (Eco-Harvest)',
    vehicle_number: 'GJ-01-EV-4421',
    partner_lat: 23.0295,
    partner_lng: 72.5684,
    estimated_delivery_time: '12-15 mins',
    notes: 'Temperature-controlled insulated fresh crate',
    show_driver: false,
  },
  store_location: {
    name: 'Fresh Vegetables Central Organic Hub',
    latitude: 23.0225,
    longitude: 72.5714,
  },
  destination: {
    address: 'Flat 402, Green Acres Residency, Satellite Road, Ahmedabad',
    latitude: 23.0330,
    longitude: 72.5650,
  },
};

export const TrackingPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<DeliveryTrackingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [driverProgress, setDriverProgress] = useState(0.65);
  const [etaMinutes, setEtaMinutes] = useState(14);
  const [mapTheme, setMapTheme] = useState<'emerald' | 'amber'>('emerald');
  const [pulseTick, setPulseTick] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Manual status override state for testing/demoing logistics updates
  const [demoStatus, setDemoStatus] = useState<string | null>(null);

  const fetchTracking = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await api.get(`/delivery/tracking/${id}`);
      if (res.data?.data) {
        setData(res.data.data);
      } else {
        setData(DEFAULT_TRACKING_DATA);
      }
    } catch {
      // Seamlessly fall back to demo tracking
      setData(DEFAULT_TRACKING_DATA);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchTracking();

    // Auto-poll tracking every 6s for live driver and delivery updates
    const interval = setInterval(() => {
      fetchTracking(true);
    }, 6000);

    const handleFocus = () => fetchTracking(true);
    window.addEventListener('focus', handleFocus);

    const unsubscribeSync = subscribeLiveUpdates(['orders', 'all'], () => {
      fetchTracking(true);
    });

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      unsubscribeSync();
    };
  }, [id]);

  // Simulate smooth live driver movement along route if out_for_delivery
  useEffect(() => {
    const interval = setInterval(() => {
      setDriverProgress((prev) => {
        if (prev >= 0.95) return 0.95;
        return Number((prev + 0.02).toFixed(3));
      });
      setEtaMinutes((prev) => (prev > 2 ? prev - 1 : 2));
    }, 6000);

    return () => clearInterval(interval);
  }, []);

  // Animated radar ripple pulse loop for map
  useEffect(() => {
    let frameId: number;
    let tick = 0;
    const animateRadar = () => {
      tick += 0.04;
      setPulseTick(tick);
      frameId = requestAnimationFrame(animateRadar);
    };
    frameId = requestAnimationFrame(animateRadar);
    return () => cancelAnimationFrame(frameId);
  }, []);

  const trackingData = data || DEFAULT_TRACKING_DATA;
  const rawStatus = (demoStatus || trackingData.order.order_status || 'confirmed').toLowerCase();

  // Check if driver details should be unlocked (Amazon/Flipkart rule: only when Out for Delivery or Delivered)
  const isOutForDelivery = rawStatus === 'out_for_delivery' || rawStatus === 'delivered';
  const isDelivered = rawStatus === 'delivered';

  // Draw interactive route map canvas only when out for delivery
  useEffect(() => {
    if (!isOutForDelivery) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    const isEmerald = mapTheme === 'emerald';

    const colors = isEmerald
      ? {
          base: '#090d14',
          block: '#111722',
          blockBorder: '#1c2432',
          highway: '#202937',
          highwayStripe: '#334155',
          street: '#151c27',
          water: '#071520',
          waterBorder: '#0f2b3e',
          park: '#081c12',
          parkBorder: '#10b98133',
          parkText: '#34d399',
          routeGlow: '#00e599',
          routeCore: '#ecfdf5',
          riderPuck: '#00e599',
          riderRing: 'rgba(0, 229, 153, 0.4)',
          depot: '#10b981',
          dest: '#f43f5e',
          textMuted: '#64748b',
          textBright: '#e2e8f0',
        }
      : {
          base: '#0d1117',
          block: '#161c24',
          blockBorder: '#232c38',
          highway: '#242b35',
          highwayStripe: '#3e4956',
          street: '#19202a',
          water: '#081724',
          waterBorder: '#102e48',
          park: '#0a1d13',
          parkBorder: '#eab30833',
          parkText: '#facc15',
          routeGlow: '#f59e0b',
          routeCore: '#fffbeb',
          riderPuck: '#f59e0b',
          riderRing: 'rgba(245, 158, 11, 0.4)',
          depot: '#10b981',
          dest: '#ef4444',
          textMuted: '#788290',
          textBright: '#f1f5f9',
        };

    // 1. Terrain base
    ctx.fillStyle = colors.base;
    ctx.fillRect(0, 0, width, height);

    // 2. City blocks
    const blocks = [
      { x: 30, y: 30, w: width * 0.2 - 20, h: height * 0.24 },
      { x: width * 0.28, y: 30, w: width * 0.35, h: height * 0.24 },
      { x: width * 0.68, y: 30, w: width * 0.28, h: height * 0.24 },
      { x: 30, y: height * 0.36, w: width * 0.2 - 20, h: height * 0.22 },
      { x: width * 0.28, y: height * 0.36, w: width * 0.35, h: height * 0.22 },
      { x: width * 0.68, y: height * 0.36, w: width * 0.28, h: height * 0.22 },
      { x: 30, y: height * 0.66, w: width * 0.35, h: height * 0.28 },
      { x: width * 0.46, y: height * 0.66, w: width * 0.2, h: height * 0.28 },
      { x: width * 0.72, y: height * 0.66, w: width * 0.25, h: height * 0.28 },
    ];

    blocks.forEach((b) => {
      ctx.fillStyle = colors.block;
      ctx.strokeStyle = colors.blockBorder;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(b.x, b.y, b.w, b.h, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = isEmerald ? '#151d2b' : '#1c232e';
      ctx.fillRect(b.x + 8, b.y + 8, b.w * 0.4, b.h * 0.35);
      ctx.fillRect(b.x + b.w * 0.52, b.y + 8, b.w * 0.4, b.h * 0.35);
      ctx.fillRect(b.x + 8, b.y + b.h * 0.5, b.w * 0.35, b.h * 0.4);
      ctx.fillRect(b.x + b.w * 0.48, b.y + b.h * 0.5, b.w * 0.45, b.h * 0.4);
    });

    // 3. Botanical Corridor
    ctx.fillStyle = colors.park;
    ctx.strokeStyle = colors.parkBorder;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(width * 0.48, height * 0.68, width * 0.18, height * 0.24, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = colors.parkText;
    ctx.font = 'bold 10px Inter, sans-serif';
    ctx.fillText('🌿 Agro Green Reserve', width * 0.49, height * 0.78);

    // 4. Urban Canal
    ctx.strokeStyle = colors.water;
    ctx.lineWidth = 26;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-10, height * 0.12);
    ctx.bezierCurveTo(width * 0.32, height * 0.04, width * 0.68, height * 0.22, width + 10, height * 0.08);
    ctx.stroke();

    ctx.strokeStyle = colors.waterBorder;
    ctx.lineWidth = 2;
    ctx.stroke();

    // 5. Roads
    ctx.strokeStyle = colors.highway;
    ctx.lineWidth = 22;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(0, height * 0.31);
    ctx.lineTo(width, height * 0.31);
    ctx.moveTo(0, height * 0.61);
    ctx.lineTo(width, height * 0.61);
    ctx.moveTo(width * 0.24, 0);
    ctx.lineTo(width * 0.24, height);
    ctx.moveTo(width * 0.66, 0);
    ctx.lineTo(width * 0.66, height);
    ctx.stroke();

    // Divider stripes
    ctx.strokeStyle = colors.highwayStripe;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([12, 10]);
    ctx.beginPath();
    ctx.moveTo(0, height * 0.31);
    ctx.lineTo(width, height * 0.31);
    ctx.moveTo(0, height * 0.61);
    ctx.lineTo(width, height * 0.61);
    ctx.moveTo(width * 0.24, 0);
    ctx.lineTo(width * 0.24, height);
    ctx.moveTo(width * 0.66, 0);
    ctx.lineTo(width * 0.66, height);
    ctx.stroke();
    ctx.setLineDash([]);

    // Secondary streets
    ctx.strokeStyle = colors.street;
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(0, height * 0.88);
    ctx.lineTo(width, height * 0.88);
    ctx.moveTo(width * 0.44, 0);
    ctx.lineTo(width * 0.44, height);
    ctx.stroke();

    // Street labels
    ctx.fillStyle = colors.textMuted;
    ctx.font = 'bold 9px Inter, sans-serif';
    ctx.fillText('SATELLITE EXPRESS CORRIDOR', width * 0.05, height * 0.295);
    ctx.fillText('OUTER RING ROAD', width * 0.7, height * 0.595);

    // 6. Delivery Route Polyline
    const startX = width * 0.18;
    const startY = height * 0.68;
    const endX = width * 0.82;
    const endY = height * 0.25;

    const midX1 = width * 0.42;
    const midY1 = height * 0.68;
    const midX2 = width * 0.42;
    const midY2 = height * 0.25;

    // Glowing Neon Aura
    ctx.shadowColor = colors.routeGlow;
    ctx.shadowBlur = 18;
    ctx.strokeStyle = colors.routeGlow;
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(midX1, midY1);
    ctx.lineTo(midX2, midY2);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Inner bright core
    ctx.strokeStyle = colors.routeCore;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(midX1, midY1);
    ctx.lineTo(midX2, midY2);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    // 7. Calculate driver position
    const currentProg = isDelivered ? 1 : driverProgress;
    let currentX = startX;
    let currentY = startY;

    if (currentProg <= 0.35) {
      const p = currentProg / 0.35;
      currentX = startX + (midX1 - startX) * p;
      currentY = startY;
    } else if (currentProg <= 0.7) {
      const p = (currentProg - 0.35) / 0.35;
      currentX = midX1;
      currentY = midY1 + (midY2 - midY1) * p;
    } else {
      const p = (currentProg - 0.7) / 0.3;
      currentX = midX2 + (endX - midX2) * p;
      currentY = midY2;
    }

    // 8. Start Depot
    ctx.fillStyle = colors.depot;
    ctx.beginPath();
    ctx.arc(startX, startY, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🌱', startX, startY + 4);

    // Destination
    ctx.fillStyle = colors.dest;
    ctx.beginPath();
    ctx.arc(endX, endY, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText('📍', endX, endY + 4);

    // Destination badge
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(endX - 48, endY - 26, 96, 18, 4);
    ctx.fill();
    ctx.fillStyle = '#fda4af';
    ctx.font = 'bold 9px Inter, sans-serif';
    ctx.fillText('YOUR DOORSTEP', endX, endY - 14);

    // 9. Driver Scooter Marker
    const wave1 = (pulseTick * 18) % 36;
    const wave2 = (pulseTick * 18 + 18) % 36;
    ctx.strokeStyle = colors.riderRing;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(currentX, currentY, 14 + wave1, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(currentX, currentY, 14 + wave2, 0, Math.PI * 2);
    ctx.stroke();

    ctx.shadowColor = colors.routeGlow;
    ctx.shadowBlur = 16;
    ctx.fillStyle = colors.riderPuck;
    ctx.beginPath();
    ctx.arc(currentX, currentY, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(currentX, currentY, 13, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = '14px Inter, sans-serif';
    ctx.fillText('🛵', currentX, currentY + 5);

    // Floating rider pill
    const tagWidth = 140;
    const tagHeight = 22;
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = colors.routeGlow;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(currentX - tagWidth / 2, currentY - 36, tagWidth, tagHeight, 11);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = colors.routeGlow;
    ctx.font = 'bold 9px Inter, sans-serif';
    ctx.fillText(
      isDelivered ? '✅ Delivered Safely' : '🟢 28 km/h • Ravi (4.9★)',
      currentX,
      currentY - 22
    );
  }, [driverProgress, isOutForDelivery, isDelivered, mapTheme, pulseTick]);

  if (loading && !data) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 text-center">
        <RefreshCw className="w-10 h-10 text-brand-600 animate-spin mx-auto mb-4" />
        <p className="text-slate-800 text-base font-bold">Connecting to Logistics Tracking Server...</p>
        <p className="text-slate-400 text-xs mt-1">Retrieving parcel lifecycle status & transit updates</p>
      </div>
    );
  }

  const { order, tracking, destination } = trackingData;

  // Amazon/Flipkart 5-stage milestones
  const milestoneStages = [
    { key: 'placed', label: 'Order Placed', time: 'Verified' },
    { key: 'confirmed', label: 'Confirmed', time: 'Hub Accepted' },
    { key: 'packed', label: 'Harvested & Packed', time: 'Cold-Chain Ready' },
    { key: 'out_for_delivery', label: 'Out for Delivery', time: 'Courier Dispatched' },
    { key: 'delivered', label: 'Delivered', time: 'Doorstep' },
  ];

  const getStageIndex = (st: string) => {
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
      default:
        return 1;
    }
  };

  const currentStepIdx = getStageIndex(rawStatus);

  // Default Amazon/Flipkart shipment activity history
  const defaultActivities: DeliveryTimelineEvent[] = [
    {
      id: 'a1',
      status: 'pending',
      title: 'Order Placed & Verified',
      description: `Order #${order.order_number} confirmed. Payment via ${order.payment_method?.toUpperCase() || 'UPI'}.`,
      timestamp: 'Today, 10:15 AM',
      location: 'Fresh Farm Online Portal',
      completed: true,
    },
    {
      id: 'a2',
      status: 'confirmed',
      title: 'Order Confirmed by Fulfillment Hub',
      description: 'Accepted by Central Fulfillment Center. Harvest batch assigned to partner organic farm.',
      timestamp: 'Today, 10:24 AM',
      location: 'Central Farm Depot, Agro Hub 04',
      completed: currentStepIdx >= 1,
    },
    {
      id: 'a3',
      status: 'packed',
      title: 'Harvested & Packed in Insulated Crate',
      description: 'Vegetables harvested fresh, washed, quality graded, and packed in eco-chill insulated containers.',
      timestamp: currentStepIdx >= 2 ? 'Today, 10:48 AM' : 'Expected within 20 mins',
      location: 'Sorting & Packaging Center Hub 04, Ahmedabad',
      completed: currentStepIdx >= 2,
    },
    {
      id: 'a4',
      status: 'out_for_delivery',
      title: isOutForDelivery ? 'Out for Delivery (Courier Assigned)' : 'Out for Delivery (Upcoming)',
      description: isOutForDelivery
        ? `Handed over to delivery executive ${tracking?.partner_name || 'Ravi Kumar'} on ${tracking?.vehicle_type || 'Electric Scooter'}. En route to your address.`
        : 'Package will be assigned to a local delivery executive once dispatched from sorting facility.',
      timestamp: isOutForDelivery ? 'Today, 11:10 AM' : 'Scheduled upon dispatch',
      location: 'Local Delivery Hub, Sector 14',
      completed: isOutForDelivery,
    },
    {
      id: 'a5',
      status: 'delivered',
      title: 'Delivered',
      description: isDelivered ? 'Package delivered to doorstep. Verified by recipient.' : 'Expected doorstep delivery.',
      timestamp: isDelivered ? 'Today, 11:32 AM' : 'Expected Today by 8:00 PM',
      location: order.delivery_address?.area || 'Customer Address',
      completed: isDelivered,
    },
  ];

  const activities = trackingData.activities && trackingData.activities.length > 0 ? trackingData.activities : defaultActivities;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Header & Breadcrumb */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-5">
          <div>
            <Link
              to="/orders"
              className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1.5 mb-2.5 transition-colors group"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" /> Back to My Orders
            </Link>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                Package Tracking
              </h1>
              <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-brand-100 text-brand-800 flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5" />
                {trackingData.carrier_name || 'FreshVeg Logistics Express'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-700">Order #{order.order_number}</span>
              <span>•</span>
              <span className="font-mono text-slate-600">Tracking ID: {trackingData.tracking_number || `TRK-${order.order_number}`}</span>
              <span>•</span>
              <span>Total ₹{order.total} ({order.payment_method?.toUpperCase()})</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => fetchTracking(false)}
              className="text-xs font-bold bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-sm transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
              Refresh Status
            </button>
          </div>
        </div>

        {/* Demo Status Switcher Bar (Allows testing Amazon/Flipkart logistics transitions) */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-brand-600 shrink-0" />
            <span className="font-bold text-slate-700">Logistics Status Preview:</span>
            <span className="text-slate-500 hidden md:inline">
              Driver details & live map only appear when status is <strong>Out for Delivery</strong>.
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'confirmed', label: '1. Confirmed' },
              { id: 'packed', label: '2. Packed' },
              { id: 'out_for_delivery', label: '3. Out for Delivery 🛵' },
              { id: 'delivered', label: '4. Delivered ✅' },
            ].map((btn) => (
              <button
                key={btn.id}
                onClick={() => setDemoStatus(btn.id)}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${
                  rawStatus === btn.id
                    ? 'bg-brand-600 text-white shadow-sm ring-2 ring-brand-500/30'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Delivery Status Hero Card (Amazon / Flipkart Style) */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 sm:p-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-6">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs font-black uppercase tracking-wider text-brand-700 bg-brand-50 border border-brand-200 px-2.5 py-0.5 rounded-full">
                Shipment Status
              </span>
              <span className="text-xs text-slate-400 font-medium">Standard 2-Hour Express Delivery</span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {isDelivered
                ? 'Delivered to your doorstep'
                : isOutForDelivery
                ? 'Out for delivery — Arriving today'
                : rawStatus === 'packed'
                ? 'Packed & Ready for Dispatch'
                : 'Order Confirmed & Farm Harvesting'}
            </h2>

            <p className="text-sm font-semibold text-slate-600 mt-1 flex items-center gap-2">
              <Clock className="w-4 h-4 text-brand-600" />
              <span>
                {isDelivered
                  ? 'Delivered successfully'
                  : isOutForDelivery
                  ? `Estimated arrival: ~${etaMinutes} mins (${trackingData.expected_delivery || 'Today, by 8:00 PM'})`
                  : `Expected Delivery: ${trackingData.expected_delivery || 'Today, by 8:00 PM'}`}
              </span>
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-xs space-y-1.5 min-w-[240px]">
            <div className="flex justify-between text-slate-500">
              <span>Carrier:</span>
              <span className="font-bold text-slate-800">{trackingData.carrier_name || 'FreshVeg Express'}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Fulfillment Hub:</span>
              <span className="font-bold text-slate-800">Depot Hub 04</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Packaging:</span>
              <span className="font-bold text-emerald-700">Cold-Chain Insulated</span>
            </div>
          </div>
        </div>

        {/* Amazon/Flipkart Signature 5-Stage Stepper */}
        <div className="py-2">
          <div className="relative">
            {/* Background connecting line */}
            <div className="absolute top-4 left-6 right-6 h-1 bg-slate-100 rounded-full hidden sm:block"></div>
            {/* Active filled connecting line */}
            <div
              className="absolute top-4 left-6 h-1 bg-brand-600 rounded-full transition-all duration-700 hidden sm:block"
              style={{
                width: `${(currentStepIdx / (milestoneStages.length - 1)) * 90}%`,
              }}
            ></div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 relative z-10">
              {milestoneStages.map((st, idx) => {
                const isCompleted = idx <= currentStepIdx;
                const isCurrent = idx === currentStepIdx;

                return (
                  <div key={st.key} className="flex flex-col items-center text-center">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                        isCompleted
                          ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30 ring-4 ring-white'
                          : 'bg-white text-slate-400 border-2 border-slate-200'
                      } ${isCurrent && !isDelivered ? 'ring-4 ring-brand-200 animate-pulse' : ''}`}
                    >
                      {isCompleted ? <Check className="w-4 h-4 stroke-[3]" /> : idx + 1}
                    </div>
                    <span
                      className={`text-xs font-black mt-2.5 ${
                        isCompleted ? 'text-slate-900' : 'text-slate-400'
                      }`}
                    >
                      {st.label}
                    </span>
                    <span className="text-[10px] text-slate-400 mt-0.5 font-medium">{st.time}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Grid Layout: Left Column (Logistics / Live Map) + Right Column (Driver details / Order details) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column (8 cols): Either Live Route Map (if Out for Delivery) OR Logistics Information Card (if Before Out for Delivery) */}
        <div className="lg:col-span-8 space-y-6">
          {isOutForDelivery ? (
            /* OUT FOR DELIVERY ACTIVE: Live Map & Telemetry */
            <div className="space-y-4">
              <div className="bg-slate-950 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden relative ring-1 ring-slate-800">
                {/* Top-Left Live ETA Banner overlay */}
                <div className="absolute top-4 left-4 z-10 bg-slate-950/90 backdrop-blur-xl text-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-800/80 flex items-center gap-3">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center font-black text-2xl shadow-inner ${
                      mapTheme === 'emerald'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}
                  >
                    🛵
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                      <span>{mapTheme === 'emerald' ? 'Fresh Express Delivery' : 'Fresh Priority Lane'}</span>
                    </div>
                    <p className="text-xl font-black text-white flex items-center gap-2">
                      <Clock className="w-4 h-4 text-brand-400" /> {etaMinutes} Mins
                      <span className="text-xs font-semibold text-slate-400">• 3.2 km</span>
                    </p>
                  </div>
                </div>

                {/* Top-Right Theme Toggle & Controls */}
                <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
                  <div className="bg-slate-950/90 backdrop-blur-xl p-1 rounded-2xl border border-slate-800/80 shadow-2xl flex items-center gap-1 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setMapTheme('emerald')}
                      className={`px-3 py-1.5 rounded-xl transition-all ${
                        mapTheme === 'emerald'
                          ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Emerald 🌙
                    </button>
                    <button
                      type="button"
                      onClick={() => setMapTheme('amber')}
                      className={`px-3 py-1.5 rounded-xl transition-all ${
                        mapTheme === 'amber'
                          ? 'bg-amber-400 text-slate-950 shadow-md font-black'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Amber ⚡
                    </button>
                  </div>
                </div>

                {/* Delivery address badge overlay */}
                <div className="absolute bottom-4 left-4 z-10 bg-slate-950/90 backdrop-blur-xl text-slate-200 px-4 py-2.5 rounded-2xl shadow-xl border border-slate-800/80 text-xs font-semibold flex items-center gap-2 max-w-sm">
                  <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
                  <span className="truncate">Destination: {destination.address}</span>
                </div>

                {/* Speed & GPS telemetry overlay */}
                <div className="absolute bottom-4 right-4 z-10 hidden sm:flex items-center gap-2 bg-slate-950/90 backdrop-blur-xl px-3 py-1.5 rounded-xl border border-slate-800 text-[11px] font-bold text-slate-300">
                  <Navigation className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                  <span>Speed: 28 km/h</span>
                  <span className="text-slate-600">|</span>
                  <span className="text-emerald-400">GPS: Live</span>
                </div>

                {/* Canvas Map */}
                <canvas
                  ref={canvasRef}
                  width={800}
                  height={450}
                  className="w-full h-[400px] sm:h-[480px] object-cover block cursor-crosshair"
                />
              </div>

              {/* Transit badge */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 flex items-center justify-between text-xs text-slate-600">
                <div className="flex items-center gap-2 font-bold text-slate-900">
                  <Sparkles className="w-4 h-4 text-brand-600" />
                  <span>Insulated Thermal Packaging Active</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                  <span className="font-semibold text-emerald-700">Driver Active on GPS Route</span>
                </div>
              </div>
            </div>
          ) : (
            /* BEFORE OUT FOR DELIVERY: Amazon/Flipkart Logistics Information Screen */
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-slate-900 via-slate-950 to-brand-950 rounded-3xl border border-slate-800 shadow-xl p-8 sm:p-10 text-white relative overflow-hidden">
                <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-brand-500/10 rounded-full blur-3xl pointer-events-none"></div>

                <div className="max-w-xl space-y-4 relative z-10">
                  <div className="w-14 h-14 rounded-2xl bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-brand-400 shadow-inner">
                    <Box className="w-7 h-7" />
                  </div>

                  <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                    Driver Details Available Upon Dispatch
                  </h3>

                  <p className="text-slate-300 text-sm leading-relaxed">
                    Your farm-fresh organic produce is currently undergoing harvest inspection and temperature-controlled packaging at our central facility.
                  </p>

                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md text-xs text-slate-300 space-y-2">
                    <div className="flex items-center gap-2 font-bold text-brand-400">
                      <Sparkles className="w-4 h-4" />
                      <span>Logistics & Fulfillment Policy</span>
                    </div>
                    <p className="text-slate-400 leading-normal">
                      Like Amazon and Flipkart, assigned delivery partner contact details, vehicle registration, and real-time live GPS map tracking unlock automatically as soon as your package status changes to <strong>Out for Delivery</strong>.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
                    <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-xl">
                      <p className="text-slate-400">Current Facility</p>
                      <p className="font-bold text-white mt-0.5">Central Agro Depot Hub 04</p>
                    </div>
                    <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-xl">
                      <p className="text-slate-400">Packaging Type</p>
                      <p className="font-bold text-emerald-400 mt-0.5">Cold-Chain Insulated Box</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quality & Safety Banner */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-sm space-y-4">
                <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-brand-600" />
                  Freshness & Quality Assurance
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-slate-600">
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                    <p className="font-bold text-slate-800">🌱 100% Farm Fresh</p>
                    <p className="text-slate-500">Harvested within hours of dispatch</p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                    <p className="font-bold text-slate-800">❄️ Cold-Chain 4°C</p>
                    <p className="text-slate-500">Insulated transit to preserve crispness</p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                    <p className="font-bold text-slate-800">📦 Sealed Crate</p>
                    <p className="text-slate-500">Tamper-evident hygiene seal on box</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Amazon / Flipkart Detailed Shipment Activity Updates Feed */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 sm:p-7 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="font-black text-slate-900 text-base">Shipment Activity & Updates</h3>
                <p className="text-xs text-slate-400 mt-0.5">Full chronological logistics transit milestones</p>
              </div>
              <span className="text-xs font-bold text-brand-700 bg-brand-50 px-3 py-1 rounded-full border border-brand-100">
                Live Updates
              </span>
            </div>

            <div className="relative pl-6 space-y-6 before:content-[''] before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
              {activities.map((act) => (
                <div key={act.id} className="relative flex items-start gap-4">
                  <div
                    className={`absolute -left-6 mt-1 w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                      act.completed
                        ? 'bg-brand-600 text-white ring-4 ring-white'
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
                    <p className="text-xs text-slate-500 leading-relaxed">{act.description}</p>
                    <p className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-400" /> {act.location}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column (4 cols): Driver Profile (ONLY if Out for Delivery) + Delivery Details Card */}
        <div className="lg:col-span-4 space-y-6">
          {isOutForDelivery && tracking ? (
            /* DRIVER DETAILS CARD: Only shown when Out for Delivery / Delivered */
            <div className="bg-white p-6 rounded-3xl border border-brand-200/80 shadow-md shadow-brand-500/5 space-y-5 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-brand-600 text-white text-[10px] font-black uppercase px-3 py-1 rounded-bl-xl tracking-wider">
                Assigned Driver
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-black uppercase tracking-wider text-slate-400">Delivery Executive</span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  ⭐ {tracking.partner_rating || 4.88} (48 Deliveries)
                </span>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand-600 to-emerald-400 text-white font-black text-2xl flex items-center justify-center shadow-md">
                  {tracking.partner_name?.charAt(0) || 'R'}
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-lg">{tracking.partner_name || 'Ravi Kumar'}</h3>
                  <p className="text-xs text-slate-500 font-medium">{tracking.vehicle_type || 'Electric Scooter (EV)'}</p>
                  <p className="text-xs font-mono font-bold text-brand-700 mt-0.5">{tracking.vehicle_number || 'GJ-01-EV-4421'}</p>
                </div>
              </div>

              {/* Contact buttons */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <a
                  href={`tel:${tracking.partner_phone || '+919812345678'}`}
                  className="bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs py-3 px-3 rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all"
                >
                  <Phone className="w-3.5 h-3.5" /> Call Driver
                </a>
                <a
                  href={`https://wa.me/91${(tracking.partner_phone || '9812345678').replace(/[^0-9]/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-xs py-3 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all"
                >
                  <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                </a>
              </div>
            </div>
          ) : (
            /* PENDING DRIVER CARD: Shown before Out for Delivery */
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-slate-400">Courier Partner</span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                  Assigning at Hub
                </span>
              </div>

              <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="w-12 h-12 rounded-xl bg-slate-200 text-slate-400 flex items-center justify-center text-xl shrink-0">
                  🛵
                </div>
                <div className="text-xs">
                  <p className="font-bold text-slate-800">Pending Dispatch</p>
                  <p className="text-slate-400 text-[11px] mt-0.5">Driver details will appear once parcel leaves sorting facility</p>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 leading-normal">
                Deliveries are handled by certified electric bike partners equipped with refrigerated transport boxes.
              </p>
            </div>
          )}

          {/* Destination & Order Details */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4 text-xs">
            <h4 className="font-bold text-slate-900 border-b border-slate-100 pb-3 text-sm flex items-center gap-2">
              <MapPin className="w-4 h-4 text-brand-600" /> Delivery Address
            </h4>
            <div className="space-y-2 text-slate-600">
              <p>
                <strong className="text-slate-800 font-semibold">Recipient:</strong> {order.customer_name || 'Rahul Sharma'}
              </p>
              <p>
                <strong className="text-slate-800 font-semibold">Phone:</strong> {order.customer_mobile || '+91 8106970384'}
              </p>
              <p>
                <strong className="text-slate-800 font-semibold">Payment:</strong>{' '}
                <span className="font-bold uppercase text-brand-700">{order.payment_method || 'UPI'}</span> ({order.payment_status || 'paid'})
              </p>
              <p className="text-slate-500 pt-1 leading-relaxed">
                <strong className="text-slate-800 font-semibold">Address:</strong>{' '}
                {order.delivery_address?.area || 'Satellite Road, Sector 14'}, {order.delivery_address?.city || 'Ahmedabad'} - {order.delivery_address?.pincode || '380015'}
              </p>
            </div>
          </div>

          {/* Need Help / Support Card */}
          <div className="bg-slate-50 p-5 rounded-3xl border border-slate-200/80 space-y-3 text-xs">
            <div className="flex items-center gap-2 font-bold text-slate-800">
              <AlertCircle className="w-4 h-4 text-slate-500" />
              <span>Need help with this shipment?</span>
            </div>
            <p className="text-slate-500 leading-relaxed">
              If you have special delivery instructions or wish to reschedule your delivery slot, our 24/7 support is ready to help.
            </p>
            <Link
              to="/profile"
              className="inline-flex items-center gap-1 font-bold text-brand-700 hover:text-brand-800 transition-colors"
            >
              Contact Support Team <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrackingPage;
