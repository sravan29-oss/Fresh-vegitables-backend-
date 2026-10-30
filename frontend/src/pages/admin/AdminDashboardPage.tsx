import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShoppingBag,
  IndianRupee,
  Users,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Package,
  Clock,
  CheckCircle2,
  Truck,
  RotateCw,
  XCircle,
  CreditCard,
  DollarSign,
  Calendar,
  Filter,
  Sparkles,
  ArrowUpRight,
  Eye,
  RefreshCw,
  SlidersHorizontal,
} from 'lucide-react';
import api from '../../services/api';
import { DashboardStats, Order } from '../../types';
import { subscribeLiveUpdates } from '../../services/liveSync';

type DateRange = 'today' | 'yesterday' | '7days' | '30days' | 'custom' | 'all';

export const AdminDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>('today');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());

  const fetchDashboardData = useCallback(async (showSpin = false) => {
    try {
      if (showSpin) setIsRefreshing(true);
      const params: any = { range: dateRange };
      if (dateRange === 'custom') {
        if (customStart) params.startDate = customStart;
        if (customEnd) params.endDate = customEnd;
      }

      const res = await api.get('/admin/dashboard', { params });
      if (res.data?.data) {
        setStats(res.data.data.stats);
        setRecentOrders(res.data.data.recent_orders || []);
        setLastRefreshedAt(new Date());
      }
    } catch (err) {
      console.error('Failed to load dashboard', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [dateRange, customStart, customEnd]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Real-time synchronization: auto-refresh when new orders arrive
  useEffect(() => {
    const unsub = subscribeLiveUpdates(['orders', 'payments'], () => {
      fetchDashboardData();
    });
    return () => unsub();
  }, [fetchDashboardData]);

  if (isLoading) {
    return (
      <div className="py-24 text-center space-y-3">
        <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-slate-400 text-xs font-semibold tracking-wide">Loading real-time executive analytics...</p>
      </div>
    );
  }

  // 12 Required Dashboard Metric Cards
  const metricCards = [
    {
      title: 'Total Orders',
      value: stats?.total_orders ?? 0,
      sub: `${dateRange === 'today' ? 'Today' : dateRange.toUpperCase()} volume`,
      icon: ShoppingBag,
      color: 'text-brand-400',
      bg: 'bg-brand-500/10',
      border: 'border-brand-500/20',
      link: '/admin/orders',
    },
    {
      title: 'New Orders',
      value: stats?.new_orders ?? stats?.pending_orders ?? 0,
      sub: 'Action required (Pending)',
      icon: Clock,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
      link: '/admin/orders?status=pending',
    },
    {
      title: 'Pending Orders',
      value: stats?.pending_orders ?? 0,
      sub: 'Awaiting confirmation',
      icon: AlertTriangle,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
      link: '/admin/orders?status=pending',
    },
    {
      title: 'Confirmed Orders',
      value: stats?.confirmed_orders ?? 0,
      sub: 'Approved for packing',
      icon: CheckCircle2,
      color: 'text-sky-400',
      bg: 'bg-sky-500/10',
      border: 'border-sky-500/20',
      link: '/admin/orders?status=confirmed',
    },
    {
      title: 'Processing Orders',
      value: stats?.processing_orders ?? 0,
      sub: 'Harvesting & Packing',
      icon: Package,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
      border: 'border-purple-500/20',
      link: '/admin/orders?status=preparing',
    },
    {
      title: 'Out for Delivery',
      value: stats?.out_for_delivery ?? 0,
      sub: 'On vehicle route',
      icon: Truck,
      color: 'text-indigo-400',
      bg: 'bg-indigo-500/10',
      border: 'border-indigo-500/20',
      link: '/admin/orders?status=out_for_delivery',
    },
    {
      title: 'Delivered Orders',
      value: stats?.delivered_orders ?? 0,
      sub: 'Doorstep fulfilled',
      icon: CheckCircle2,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
      link: '/admin/orders?status=delivered',
    },
    {
      title: 'Cancelled Orders',
      value: stats?.cancelled_orders ?? 0,
      sub: 'Voided / refunded',
      icon: XCircle,
      color: 'text-rose-400',
      bg: 'bg-rose-500/10',
      border: 'border-rose-500/20',
      link: '/admin/orders?status=cancelled',
    },
    {
      title: 'Total Revenue',
      value: `₹${(stats?.total_revenue ?? 0).toLocaleString('en-IN')}`,
      sub: 'Selected filter total',
      icon: IndianRupee,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
      link: '/admin/payments',
    },
    {
      title: "Today's Revenue",
      value: `₹${(stats?.today_revenue ?? 0).toLocaleString('en-IN')}`,
      sub: 'Midnight to now',
      icon: TrendingUp,
      color: 'text-brand-400',
      bg: 'bg-brand-500/10',
      border: 'border-brand-500/20',
      link: '/admin/payments',
    },
    {
      title: 'Pending Payments',
      value: stats?.pending_payments ?? 0,
      sub: 'COD & Gateway pending',
      icon: CreditCard,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
      link: '/admin/payments',
    },
    {
      title: 'Paid Orders',
      value: stats?.paid_orders ?? 0,
      sub: 'Verified received',
      icon: DollarSign,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
      link: '/admin/payments',
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header with Quick Actions and Live Indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Executive Dashboard
            </h1>
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-black uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Live Sync
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time orders, payment collections, and logistics from actual database records.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={() => fetchDashboardData(true)}
            disabled={isRefreshing}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all border border-slate-700 flex items-center gap-1.5 text-xs font-bold"
            title="Refresh dashboard stats"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-brand-400' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <Link
            to="/admin/orders"
            className="bg-brand-500 hover:bg-brand-400 text-slate-950 font-black text-xs px-3.5 py-2.5 rounded-xl transition-all shadow-md flex items-center gap-1.5"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Manage Orders</span>
          </Link>
        </div>
      </div>

      {/* Date Filter Bar */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3 sm:p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
            <Calendar className="w-4 h-4 text-brand-400" />
            <span>Reporting Date Filter:</span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {[
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: '7days', label: 'Last 7 Days' },
              { id: '30days', label: 'Last 30 Days' },
              { id: 'all', label: 'All Time' },
              { id: 'custom', label: 'Custom Range' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setDateRange(f.id as DateRange)}
                className={`text-xs font-bold px-3 py-1.5 rounded-xl whitespace-nowrap transition-all ${
                  dateRange === f.id
                    ? 'bg-brand-500 text-slate-950 shadow-sm font-black'
                    : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-850 border border-slate-800'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Date Pickers */}
        {dateRange === 'custom' && (
          <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-400">From:</span>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1 text-xs text-white focus:outline-none focus:border-brand-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-400">To:</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1 text-xs text-white focus:outline-none focus:border-brand-500"
              />
            </div>
            <button
              onClick={() => fetchDashboardData(true)}
              className="bg-slate-800 hover:bg-slate-700 text-brand-400 text-xs font-bold px-3 py-1 rounded-xl border border-brand-500/20"
            >
              Apply Filter
            </button>
          </div>
        )}
      </div>

      {/* 12 Metric Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        {metricCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <Link
              to={card.link}
              key={idx}
              className={`bg-slate-950/80 p-4 sm:p-5 rounded-2xl border ${card.border} hover:border-slate-700 hover:bg-slate-900/60 transition-all flex flex-col justify-between group cursor-pointer shadow-xs`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] sm:text-xs font-bold text-slate-400 truncate pr-1">
                  {card.title}
                </span>
                <div className={`w-8 h-8 rounded-xl ${card.bg} ${card.color} flex items-center justify-center shrink-0`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>

              <div>
                <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight group-hover:text-brand-400 transition-colors">
                  {card.value}
                </h3>
                <div className="flex items-center justify-between mt-1 text-[10px] sm:text-[11px] text-slate-500 font-medium">
                  <span className="truncate">{card.sub}</span>
                  <ArrowRight className="w-3 h-3 text-slate-600 group-hover:text-brand-400 group-hover:translate-x-0.5 transition-all shrink-0 ml-1" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Secondary Quick Overview Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Registered Customers</span>
            <span className="text-2xl font-black text-white mt-1 block">{stats?.total_customers ?? 0}</span>
            <span className="text-[11px] text-slate-500 font-medium">Verified buyer profiles</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Low Stock Vegetables</span>
            <span className="text-2xl font-black text-amber-400 mt-1 block">{stats?.low_stock_products ?? 0}</span>
            <span className="text-[11px] text-slate-500 font-medium">Needs warehouse harvest</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Recent Orders Section */}
      <div className="bg-slate-950/90 rounded-3xl border border-slate-800 p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div>
            <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-brand-400" />
              Recent Incoming Orders
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Live orders arriving from the mobile app & website
            </p>
          </div>
          <Link
            to="/admin/orders"
            className="text-xs font-bold text-brand-400 hover:text-brand-300 flex items-center gap-1 transition-colors"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <div className="text-center py-12 text-xs text-slate-500 space-y-2">
            <ShoppingBag className="w-8 h-8 text-slate-600 mx-auto" />
            <p>No orders recorded in this date window.</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="pb-2.5 px-3">Order #</th>
                    <th className="pb-2.5 px-3">Customer</th>
                    <th className="pb-2.5 px-3">Amount</th>
                    <th className="pb-2.5 px-3">Payment</th>
                    <th className="pb-2.5 px-3">Order Status</th>
                    <th className="pb-2.5 px-3">Placed Time</th>
                    <th className="pb-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium text-slate-300">
                  {recentOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-slate-900/50 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-white">
                        #{order.order_number}
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-bold text-slate-200 block">{order.customer_name || 'Customer'}</span>
                        {order.customer_mobile && (
                          <span className="text-[10px] text-slate-500 font-mono">{order.customer_mobile}</span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-brand-400">
                        ₹{order.total}
                      </td>
                      <td className="py-3 px-3">
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-slate-300">
                          {order.payment_method || 'COD'} • {order.payment_status || 'Pending'}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`text-[10px] font-black px-2.5 py-0.5 rounded-full capitalize ${
                            order.order_status === 'delivered'
                              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                              : order.order_status === 'cancelled'
                              ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                              : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          {order.order_status ? order.order_status.replace(/_/g, ' ') : 'Pending'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-400 text-[11px] whitespace-nowrap">
                        {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <Link
                          to={`/admin/orders/${order.id}`}
                          className="text-brand-400 hover:text-brand-300 font-bold text-xs inline-flex items-center gap-1"
                        >
                          <span>Manage</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="sm:hidden space-y-2.5">
              {recentOrders.map((order) => (
                <div
                  key={order.id}
                  onClick={() => navigate(`/admin/orders/${order.id}`)}
                  className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-3.5 space-y-2 active:bg-slate-850 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-black text-white">
                      #{order.order_number}
                    </span>
                    <span className="text-xs font-mono font-black text-brand-400">
                      ₹{order.total}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-300">
                    <span className="font-bold truncate max-w-[160px]">{order.customer_name || 'Customer'}</span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-[10px]">
                    <span className="text-slate-400 font-bold uppercase">
                      {order.payment_method || 'COD'} ({order.payment_status || 'Pending'})
                    </span>
                    <span
                      className={`font-black px-2 py-0.5 rounded-full capitalize ${
                        order.order_status === 'delivered'
                          ? 'bg-emerald-500/15 text-emerald-300'
                          : order.order_status === 'cancelled'
                          ? 'bg-rose-500/15 text-rose-300'
                          : 'bg-amber-500/15 text-amber-300'
                      }`}
                    >
                      {order.order_status ? order.order_status.replace(/_/g, ' ') : 'Pending'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
