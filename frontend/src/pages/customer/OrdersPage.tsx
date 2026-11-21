import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Package,
  Clock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  MapPin,
  Truck,
  ArrowRight,
  ArrowLeft,
  Building2,
  ShieldCheck,
  CreditCard,
  ShoppingBag,
  RotateCcw,
  Sparkles,
  AlertCircle,
  Search,
  X,
  Phone,
} from 'lucide-react';
import api from '../../services/api';
import { Order } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { subscribeLiveUpdates } from '../../services/liveSync';
import { SEOHead } from '../../components/common/SEOHead';
import { getProductImageUrl, getFallbackImageUrl } from '../../utils/imageUrl';

export const OrdersPage: React.FC = () => {
  const { user, isLoading: authLoading } = useAuth();
  const { addToCart } = useCart();
  const navigate = useNavigate();

  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'delivered' | 'cancelled'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [reorderingId, setReorderingId] = useState<string | null>(null);

  const fetchOrders = useCallback(async (silent = false) => {
    if (!user) return;
    try {
      if (!silent) setIsLoading(true);
      const res = await api.get('/orders');
      if (res.data?.data) {
        setOrders(res.data.data);
        if (res.data.data.length > 0 && !expandedOrderId) {
          setExpandedOrderId(res.data.data[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load orders', err);
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [user, expandedOrderId]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/login?redirect=/orders');
      return;
    }

    fetchOrders();

    // Auto-poll orders every 30 seconds for real-time status updates
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      fetchOrders(true);
    }, 30000);

    const handleFocus = () => fetchOrders(true);
    window.addEventListener('focus', handleFocus);

    // Live sync listener for instant order status changes
    const unsubscribeSync = subscribeLiveUpdates(['orders', 'all'], () => {
      fetchOrders(true);
    });

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      unsubscribeSync();
    };
  }, [user, authLoading, navigate, fetchOrders]);

  // Counts for filter pills
  const counts = useMemo(() => {
    const active = orders.filter((o) =>
      ['pending', 'confirmed', 'preparing', 'packed', 'out_for_delivery'].includes(o.order_status)
    ).length;
    const delivered = orders.filter((o) => o.order_status === 'delivered').length;
    const cancelled = orders.filter((o) => o.order_status === 'cancelled').length;
    return { all: orders.length, active, delivered, cancelled };
  }, [orders]);

  // Filtered orders list with status and keyword search
  const filteredOrders = useMemo(() => {
    let list = orders;
    if (statusFilter !== 'all') {
      if (statusFilter === 'active') {
        list = list.filter((o) =>
          ['pending', 'confirmed', 'preparing', 'packed', 'out_for_delivery'].includes(o.order_status)
        );
      } else if (statusFilter === 'delivered') {
        list = list.filter((o) => o.order_status === 'delivered');
      } else if (statusFilter === 'cancelled') {
        list = list.filter((o) => o.order_status === 'cancelled');
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((o) => {
        const matchesNum = (o.order_number || '').toLowerCase().includes(q);
        const matchesHub = (o.assigned_hub_name || o.assigned_hub_code || '').toLowerCase().includes(q);
        const matchesItem = o.items?.some((it: any) =>
          (it.product_name || it.product_name_snapshot || '').toLowerCase().includes(q)
        );
        return matchesNum || matchesHub || matchesItem;
      });
    }

    return list;
  }, [orders, statusFilter, searchQuery]);

  const handleReorder = async (e: React.MouseEvent, order: Order) => {
    e.stopPropagation();
    if (!order.items || order.items.length === 0) return;
    try {
      setReorderingId(order.id);
      let addedCount = 0;
      let skippedCount = 0;

      for (const item of order.items) {
        if (item.product_id) {
          try {
            const success = await addToCart(
              item.product_id,
              item.variant_id || null,
              item.quantity || 1,
              undefined,
              true
            );
            if (success) {
              addedCount++;
            } else {
              skippedCount++;
            }
          } catch {
            skippedCount++;
          }
        }
      }

      if (addedCount > 0) {
        if (skippedCount > 0) {
          alert(`${addedCount} produce items added to your cart. ${skippedCount} item(s) are currently unavailable or out of stock.`);
        }
        navigate('/cart');
      } else {
        alert('Items in this order are currently out of stock or unavailable.');
      }
    } catch (err) {
      console.error('Failed to reorder items', err);
      alert('Could not add past order items to cart.');
    } finally {
      setReorderingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'delivered':
        return (
          <span className="bg-sage-100 text-forest-800 text-[11px] font-bold px-3 py-1 rounded-full border border-leaf-500/20 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-leaf-600" />
            <span>Delivered</span>
          </span>
        );
      case 'out_for_delivery':
        return (
          <span className="bg-leaf-100 text-forest-900 text-[11px] font-bold px-3 py-1 rounded-full border border-leaf-400 animate-pulse flex items-center gap-1.5 shadow-xs">
            <Truck className="w-3 h-3 text-forest-800" />
            <span>Out for Delivery</span>
          </span>
        );
      case 'packed':
      case 'preparing':
        return (
          <span className="bg-cream-200 text-ink-800 text-[11px] font-bold px-3 py-1 rounded-full border border-line flex items-center gap-1">
            <Package className="w-3 h-3 text-forest-700" />
            <span>Packing Fresh</span>
          </span>
        );
      case 'confirmed':
        return (
          <span className="bg-sage-50 text-forest-800 text-[11px] font-bold px-3 py-1 rounded-full border border-leaf-500/20 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-forest-700" />
            <span>Confirmed</span>
          </span>
        );
      case 'cancelled':
        return (
          <span className="bg-tomato-50 text-tomato-600 text-[11px] font-bold px-3 py-1 rounded-full border border-tomato-200 flex items-center gap-1">
            <AlertCircle className="w-3 h-3 text-tomato-600" />
            <span>Cancelled</span>
          </span>
        );
      default:
        return (
          <span className="bg-cream-100 text-ink-600 text-[11px] font-bold px-3 py-1 rounded-full border border-line flex items-center gap-1">
            <Clock className="w-3 h-3 text-ink-500" />
            <span>Order Placed</span>
          </span>
        );
    }
  };

  const getPaymentBadge = (method: string, status: string) => {
    const isCod = method === 'cod';
    const isPaid = status === 'paid' || status === 'cod_collected';

    return (
      <span
        className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
          isPaid
            ? 'bg-sage-50 text-forest-800 border-leaf-500/20'
            : 'bg-amber-50 text-amber-800 border-amber-200'
        }`}
      >
        {isCod ? 'Cash on Delivery' : 'Online Payment'} • {isPaid ? 'Paid' : 'Due on Delivery'}
      </span>
    );
  };

  const statusSteps = ['pending', 'confirmed', 'packed', 'out_for_delivery', 'delivered'];

  const getStepIndex = (status: string) => {
    if (status === 'preparing') return 1;
    const idx = statusSteps.indexOf(status);
    return idx === -1 ? 0 : idx;
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center font-sans">
        <div className="w-10 h-10 border-3 border-forest-900 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-ink-400 text-xs mt-3 font-medium">Fetching your order history...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6 sm:space-y-8 font-sans animate-slide-up">
      <SEOHead title="My Orders | Fresh Vegetables Organic" noindex={true} />

      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-semibold text-ink-500">
        <Link to="/" className="hover:text-forest-900 transition-colors">Home</Link>
        <span className="text-ink-300">/</span>
        <span className="text-ink-900 font-bold">Orders</span>
      </nav>

      {/* Heading */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-ink-900 tracking-tight">
            My Vegetable Orders
          </h1>
          <p className="text-xs sm:text-sm text-ink-500 mt-1">
            Track real-time delivery status from our Champapet and KPHB fulfillment hubs
          </p>
        </div>
        <Link
          to="/products"
          className="text-xs sm:text-sm font-semibold text-forest-700 hover:text-forest-900 flex items-center gap-1.5 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Shop More Produce</span>
        </Link>
      </div>

      {/* Filter and Search Bar */}
      {orders.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Filter Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              {[
                { id: 'all', label: 'All Orders', count: counts.all },
                { id: 'active', label: 'In Progress', count: counts.active },
                { id: 'delivered', label: 'Delivered', count: counts.delivered },
                { id: 'cancelled', label: 'Cancelled', count: counts.cancelled },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id as any)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                    statusFilter === tab.id
                      ? 'bg-forest-900 text-cream-50 shadow-soft'
                      : 'bg-surface text-ink-600 border border-line hover:bg-cream-100'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      statusFilter === tab.id
                        ? 'bg-forest-800 text-cream-100'
                        : 'bg-cream-100 text-ink-500'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Keyword / Order ID Search */}
            <div className="relative min-w-[220px] sm:w-64">
              <Search className="w-4 h-4 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search order ID or item..."
                className="w-full pl-9 pr-8 py-2 text-xs rounded-full bg-white border border-line focus:outline-none focus:border-forest-700 focus:ring-1 focus:ring-forest-700 transition-all font-sans text-ink-900 placeholder:text-ink-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600 p-0.5"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {filteredOrders.length === 0 ? (
        <div className="bg-surface rounded-3xl border border-line p-10 sm:p-14 text-center space-y-4 shadow-soft max-w-lg mx-auto">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-sage-100 border border-leaf-500/20 flex items-center justify-center text-5xl shadow-soft">
            🥬
          </div>
          <h2 className="font-serif font-bold text-xl text-ink-900">
            {statusFilter === 'all' ? 'No Orders Placed Yet' : `No ${statusFilter} orders`}
          </h2>
          <p className="text-xs sm:text-sm text-ink-500 max-w-sm mx-auto leading-relaxed">
            {statusFilter === 'all'
              ? 'Discover our crisp seasonal vegetables harvested from local partner farms and place your first delivery today.'
              : `You do not have any orders matching the "${statusFilter}" filter.`}
          </p>
          <div className="pt-2">
            {statusFilter === 'all' ? (
              <Link
                to="/products"
                className="btn-pill-primary inline-flex items-center gap-2 bg-forest-900 hover:bg-forest-850 text-cream-50 font-bold text-xs sm:text-sm px-6 py-3.5 rounded-full shadow-soft transition-all min-h-[44px]"
              >
                <span>Explore Fresh Produce</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <button
                onClick={() => setStatusFilter('all')}
                className="btn-pill-primary inline-flex items-center gap-2 bg-forest-900 hover:bg-forest-850 text-cream-50 font-bold text-xs px-5 py-2.5 rounded-full shadow-soft cursor-pointer"
              >
                <span>View All Orders</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const isExpanded = expandedOrderId === order.id;
            const currentStepIdx = getStepIndex(order.order_status);
            const hubName =
              order.assigned_hub_name ||
              (order.assigned_hub_code === 'kphb' ? 'KPHB Hub' : 'Champapet Hub');
            const eta =
              order.confirmed_eta ||
              (order as any).address_snapshot?.confirmed_eta ||
              'Scheduled in delivery slot';

            return (
              <div
                key={order.id}
                className="bg-surface rounded-2xl sm:rounded-3xl border border-line shadow-soft overflow-hidden transition-all"
              >
                {/* Header Row */}
                <div
                  onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setExpandedOrderId(isExpanded ? null : order.id);
                    }
                  }}
                  className="p-5 sm:p-6 cursor-pointer flex flex-wrap items-center justify-between gap-4 hover:bg-cream-100/50 transition-colors select-none focus:outline-none focus:ring-2 focus:ring-forest-700/30"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-bold text-base text-ink-900 font-mono tracking-tight">
                        {order.order_number}
                      </span>
                      {getStatusBadge(order.order_status)}
                      {getPaymentBadge(order.payment_method, order.payment_status)}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap text-xs text-ink-400 font-medium">
                      <span>
                        Placed on{' '}
                        {new Date(order.created_at).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1 text-forest-800 font-bold">
                        <Building2 className="w-3 h-3 text-leaf-600" />
                        <span>{hubName}</span>
                      </span>
                      {order.order_status !== 'delivered' && order.order_status !== 'cancelled' && (
                        <>
                          <span>•</span>
                          <span className="text-leaf-700 font-bold flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>ETA: {eta}</span>
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 sm:gap-6">
                    <div className="text-right">
                      <p className="text-xs text-ink-400 font-medium">Total Amount</p>
                      <p className="text-base sm:text-lg font-serif font-bold text-forest-900">₹{order.total}</p>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-cream-100 border border-line text-ink-600 flex items-center justify-center shrink-0">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="p-5 sm:p-6 border-t border-line bg-cream-50/50 space-y-5 animate-slide-up">
                    {/* Progress Bar (if not cancelled) */}
                    {order.order_status !== 'cancelled' && (
                      <div className="bg-surface p-4 sm:p-5 rounded-2xl border border-line shadow-soft space-y-4">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div>
                            <h4 className="text-xs font-bold uppercase tracking-wider text-ink-400 font-serif">
                              Delivery Journey
                            </h4>
                            <p className="text-[11px] text-ink-500 mt-0.5">
                              Dispatched from {hubName} within our strict 5.0 KM delivery boundary.
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => handleReorder(e, order)}
                              disabled={reorderingId === order.id}
                              className="px-3.5 py-1.5 rounded-full bg-cream-100 hover:bg-cream-200 text-ink-800 text-xs font-bold border border-line flex items-center gap-1.5 transition-all cursor-pointer min-h-[36px]"
                            >
                              <RotateCcw className={`w-3 h-3 ${reorderingId === order.id ? 'animate-spin' : ''}`} />
                              <span>{reorderingId === order.id ? 'Adding...' : 'Order Again'}</span>
                            </button>
                            <Link
                              to={`/orders/${order.id}/track`}
                              className="btn-pill-primary bg-forest-900 hover:bg-forest-850 text-cream-50 font-bold text-xs px-4 py-2 rounded-full flex items-center gap-1.5 shadow-soft transition-all min-h-[36px]"
                            >
                              <Truck className="w-3.5 h-3.5" />
                              <span>Track Live</span>
                              <ArrowRight className="w-3 h-3" />
                            </Link>
                          </div>
                        </div>

                        <div className="grid grid-cols-5 gap-1.5 sm:gap-2 text-center text-[10px] sm:text-xs">
                          {['Placed', 'Confirmed', 'Packed', 'On Way', 'Delivered'].map((step, idx) => (
                            <div key={step} className="space-y-1.5">
                              <div
                                className={`h-2 rounded-full transition-all ${
                                  idx <= currentStepIdx ? 'bg-leaf-500' : 'bg-cream-200'
                                }`}
                              />
                              <span
                                className={`font-semibold block truncate ${
                                  idx <= currentStepIdx ? 'text-forest-900 font-bold' : 'text-ink-400'
                                }`}
                              >
                                {step}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Delivery Address & Hub Details Card */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {order.address_snapshot && (
                        <div className="bg-surface p-4 rounded-2xl border border-line shadow-soft flex items-start gap-3">
                          <div className="p-2 rounded-xl bg-sage-100 text-forest-700 shrink-0 mt-0.5">
                            <MapPin className="w-4 h-4" />
                          </div>
                          <div className="text-xs space-y-0.5 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-ink-900">
                                {order.address_snapshot.full_name || 'Delivery Address'}
                              </span>
                              <span className="text-[10px] uppercase font-bold px-2 py-0.5 bg-cream-100 text-ink-600 rounded-md border border-line">
                                {order.address_snapshot.address_type || 'Home'}
                              </span>
                            </div>
                            <p className="text-ink-600 font-medium leading-relaxed">
                              {[
                                order.address_snapshot.house_number,
                                order.address_snapshot.street,
                                order.address_snapshot.area,
                                order.address_snapshot.landmark,
                                order.address_snapshot.city,
                                order.address_snapshot.state,
                              ]
                                .filter(Boolean)
                                .join(', ')}
                              {order.address_snapshot.pincode ? ` - ${order.address_snapshot.pincode}` : ''}
                            </p>
                            {order.address_snapshot.phone && (
                              <p className="text-ink-400 text-[11px] font-medium pt-0.5">
                                Contact: {order.address_snapshot.phone}
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Hub & Fulfillment Details */}
                      <div className="bg-surface p-4 rounded-2xl border border-line shadow-soft flex items-start gap-3">
                        <div className="p-2 rounded-xl bg-sage-100 text-forest-700 shrink-0 mt-0.5">
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div className="text-xs space-y-1 min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-ink-900">{hubName}</span>
                            <span className="text-[10px] font-bold text-forest-800 bg-leaf-100 px-2 py-0.5 rounded-full">
                              5.0 KM Radius
                            </span>
                          </div>
                          <p className="text-ink-500 text-[11px] leading-relaxed">
                            {order.assigned_hub_address || 'Express Organic Fulfillment Station'}
                          </p>
                          <div className="pt-1 flex items-center justify-between text-[11px] text-ink-600 border-t border-line">
                            <span>Confirmed ETA:</span>
                            <span className="font-bold text-forest-800">{eta}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Items table */}
                    {order.items && order.items.length > 0 && (
                      <div className="bg-surface p-4 sm:p-5 rounded-2xl border border-line shadow-soft space-y-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-ink-400 font-serif">
                          Order Contents ({order.items.length} item{order.items.length === 1 ? '' : 's'})
                        </h4>
                        <div className="divide-y divide-line text-xs">
                          {order.items.map((item: any) => {
                            const itemName = item.product_name || item.product_name_snapshot || 'Fresh Vegetable';
                            const itemImage = item.image_url || item.image || item.product_images?.[0];
                            return (
                              <div key={item.id || item.product_id} className="py-2.5 flex justify-between items-center gap-3">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="w-10 h-10 rounded-xl bg-cream-100 border border-line p-0.5 shrink-0 flex items-center justify-center overflow-hidden">
                                    {itemImage ? (
                                      <img
                                        src={getProductImageUrl(itemImage, itemName)}
                                        alt={itemName}
                                        className="w-full h-full object-contain rounded-lg"
                                        onError={(e) => {
                                          e.currentTarget.src = getFallbackImageUrl(itemName);
                                        }}
                                      />
                                    ) : (
                                      <span>🥦</span>
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-bold text-ink-900 truncate">{itemName}</p>
                                    <p className="text-[11px] text-ink-400">
                                      {item.unit || item.unit_snapshot || '1 unit'} • Qty: {item.quantity}
                                    </p>
                                  </div>
                                </div>
                                <span className="font-bold text-ink-900 whitespace-nowrap font-mono">
                                  ₹{item.subtotal || item.total}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Order Bill Summary & Cancellation Policy Notice */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Price Breakdown */}
                      <div className="bg-surface p-4 rounded-2xl border border-line shadow-soft space-y-2 text-xs">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-ink-400 font-serif border-b border-line pb-2 flex items-center justify-between">
                          <span>Bill Summary</span>
                          <span className="text-[10px] text-ink-400 normal-case font-mono">{order.payment_method?.toUpperCase()}</span>
                        </h4>
                        <div className="flex justify-between text-ink-600">
                          <span>Items Subtotal:</span>
                          <span className="font-semibold text-ink-900 font-mono">₹{order.subtotal || order.total}</span>
                        </div>
                        <div className="flex justify-between text-ink-600">
                          <span>Delivery Fee:</span>
                          <span className="font-semibold text-ink-900 font-mono">
                            {Number(order.delivery_charge || 0) > 0 ? `₹${order.delivery_charge}` : 'FREE'}
                          </span>
                        </div>
                        {Number(order.discount || 0) > 0 && (
                          <div className="flex justify-between text-leaf-700 font-semibold">
                            <span>Discount Applied:</span>
                            <span className="font-mono">-₹{order.discount}</span>
                          </div>
                        )}
                        <div className="border-t border-line pt-2 flex justify-between items-center text-sm">
                          <span className="font-serif font-bold text-ink-900">Total Paid/Payable:</span>
                          <span className="font-serif font-bold text-forest-900 text-base">₹{order.total}</span>
                        </div>
                      </div>

                      {/* Modification / Cancellation & Support */}
                      <div className="bg-surface p-4 rounded-2xl border border-line shadow-soft flex flex-col justify-between text-xs space-y-3">
                        <div>
                          <h4 className="text-xs font-bold uppercase tracking-wider text-ink-400 font-serif border-b border-line pb-2">
                            Order Support & Assistance
                          </h4>
                          <p className="text-[11px] text-ink-600 mt-2 leading-relaxed">
                            {['pending', 'confirmed'].includes(order.order_status)
                              ? 'This order is eligible for modification or cancellation prior to fresh harvest packaging.'
                              : order.order_status === 'cancelled'
                              ? 'This order was cancelled. Any online payment is refunded per standard policy.'
                              : 'Order is currently packed or out for delivery and cannot be modified.'}
                          </p>
                        </div>
                        <div className="pt-2 border-t border-line flex items-center justify-between">
                          <span className="text-[11px] text-ink-500 font-medium">Need immediate help?</span>
                          <a
                            href="tel:+918106970384"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-forest-900 text-cream-50 font-bold text-[11px] hover:bg-forest-850 transition-colors shadow-soft"
                          >
                            <Phone className="w-3 h-3 text-leaf-300" />
                            <span>Call Support</span>
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default OrdersPage;