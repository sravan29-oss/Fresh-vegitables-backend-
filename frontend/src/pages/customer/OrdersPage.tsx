import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Package, Clock, CheckCircle2, ChevronDown, ChevronUp, MapPin, Truck } from 'lucide-react';
import api from '../../services/api';
import { Order } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { subscribeLiveUpdates } from '../../services/liveSync';

export const OrdersPage: React.FC = () => {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  const fetchOrders = React.useCallback(async (silent = false) => {
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'delivered':
        return <span className="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-3 py-1 rounded-full">Delivered</span>;
      case 'out_for_delivery':
        return <span className="bg-sky-100 text-sky-800 text-[11px] font-bold px-3 py-1 rounded-full animate-pulse">Out for Delivery 🚚</span>;
      case 'packed':
      case 'preparing':
        return <span className="bg-amber-100 text-amber-800 text-[11px] font-bold px-3 py-1 rounded-full">Packing Fresh</span>;
      case 'confirmed':
        return <span className="bg-brand-100 text-brand-800 text-[11px] font-bold px-3 py-1 rounded-full">Confirmed</span>;
      case 'cancelled':
        return <span className="bg-rose-100 text-rose-800 text-[11px] font-bold px-3 py-1 rounded-full">Cancelled</span>;
      default:
        return <span className="bg-slate-100 text-slate-800 text-[11px] font-bold px-3 py-1 rounded-full">Pending</span>;
    }
  };

  const statusSteps = ['pending', 'confirmed', 'packed', 'out_for_delivery', 'delivered'];

  const getStepIndex = (status: string) => {
    if (status === 'preparing') return 1;
    const idx = statusSteps.indexOf(status);
    return idx === -1 ? 0 : idx;
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-slate-400 text-xs mt-3">Fetching your order history...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">My Vegetable Orders</h1>
        <p className="text-xs text-slate-500 mt-1">Track delivery status and view past receipts</p>
      </div>

      {orders.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-4 shadow-sm">
          <div className="text-6xl">🥬</div>
          <h3 className="font-bold text-lg text-slate-800">No Orders Placed Yet</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Discover our fresh organic greens and place your first harvest delivery today.
          </p>
          <Link
            to="/products"
            className="inline-block bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs px-6 py-3 rounded-xl shadow-md transition-all"
          >
            Start Shopping
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const isExpanded = expandedOrderId === order.id;
            const currentStepIdx = getStepIndex(order.order_status);

            return (
              <div
                key={order.id}
                className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden transition-all"
              >
                {/* Header Row */}
                <div
                  onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                  className="p-5 sm:p-6 cursor-pointer flex flex-wrap items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <span className="font-black text-base text-slate-900">{order.order_number}</span>
                      {getStatusBadge(order.order_status)}
                    </div>
                    <p className="text-xs text-slate-400 font-medium">
                      Placed on {new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-xs text-slate-400 font-medium">Total Amount</p>
                      <p className="text-base font-black text-brand-700">₹{order.total}</p>
                    </div>
                    <div className="p-1 rounded-xl bg-slate-100 text-slate-600">
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="p-5 sm:p-6 border-t border-slate-100 bg-slate-50/40 space-y-6">
                    {/* Progress Bar (if not cancelled) */}
                    {order.order_status !== 'cancelled' && (
                      <div className="bg-white p-5 rounded-2xl border border-slate-100 space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                            Delivery Journey
                          </h4>
                          <Link
                            to={`/orders/${order.id}/track`}
                            className="bg-brand-600 hover:bg-brand-700 text-white font-black text-xs px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 shadow-md shadow-brand-600/20 transition-all"
                          >
                            <Truck className="w-3.5 h-3.5" /> Track Live Delivery 🛵
                          </Link>
                        </div>
                        <div className="grid grid-cols-5 gap-1 text-center text-[10px]">
                          {['Placed', 'Confirmed', 'Packed', 'On Way', 'Delivered'].map((step, idx) => (
                            <div key={step} className="space-y-1.5">
                              <div
                                className={`h-2 rounded-full transition-all ${
                                  idx <= currentStepIdx ? 'bg-brand-600' : 'bg-slate-200'
                                }`}
                              />
                              <span
                                className={`font-bold block truncate ${
                                  idx <= currentStepIdx ? 'text-brand-900' : 'text-slate-400'
                                }`}
                              >
                                {step}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Delivery Address Card */}
                    {order.address_snapshot && (
                      <div className="bg-white p-4 rounded-2xl border border-slate-100 flex items-start gap-3">
                        <div className="p-2 rounded-xl bg-brand-50 text-brand-600 shrink-0 mt-0.5">
                          <MapPin className="w-4 h-4" />
                        </div>
                        <div className="text-xs space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900">
                              {order.address_snapshot.full_name || 'Delivery Address'}
                            </span>
                            <span className="text-[10px] uppercase font-bold px-2 py-0.5 bg-brand-100 text-brand-800 rounded-md">
                              {order.address_snapshot.address_type || 'Home'}
                            </span>
                          </div>
                          <p className="text-slate-600 font-medium leading-relaxed">
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
                            <p className="text-slate-400 text-[11px] font-medium">Contact: {order.address_snapshot.phone}</p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Items table */}
                    {order.items && order.items.length > 0 && (
                      <div className="bg-white p-5 rounded-2xl border border-slate-100 space-y-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          Order Contents
                        </h4>
                        <div className="divide-y divide-slate-100 text-xs">
                          {order.items.map((item: any) => (
                            <div key={item.id || item.product_id} className="py-2.5 flex justify-between items-center gap-3">
                              <div className="flex items-center gap-3">
                                <img
                                  src={item.image_url || item.product_images?.[0] || 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=200&auto=format&fit=crop'}
                                  alt=""
                                  className="w-10 h-10 rounded-xl object-cover ring-1 ring-slate-100 bg-slate-50 shrink-0"
                                  onError={(e) => {
                                    e.currentTarget.src = 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=200&auto=format&fit=crop';
                                  }}
                                />
                                <div>
                                  <p className="font-bold text-slate-800">{item.product_name || item.product_name_snapshot || 'Fresh Vegetable'}</p>
                                  <p className="text-[11px] text-slate-400">
                                    {item.unit || item.unit_snapshot || '1 unit'} • Qty: {item.quantity}
                                  </p>
                                </div>
                              </div>
                              <span className="font-extrabold text-slate-900 whitespace-nowrap">₹{item.subtotal || item.total}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
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
