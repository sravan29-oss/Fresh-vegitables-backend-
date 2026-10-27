import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShoppingBag,
  IndianRupee,
  Users,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Package,
  Clock,
} from 'lucide-react';
import api from '../../services/api';
import { DashboardStats, Order } from '../../types';

export const AdminDashboardPage: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/dashboard')
      .then((res) => {
        if (res.data?.data) {
          setStats(res.data.data.stats);
          setRecentOrders(res.data.data.recent_orders || []);
        }
      })
      .catch((err) => console.error('Failed to load dashboard', err))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <div className="py-20 text-center">
        <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-slate-400 text-xs mt-3">Loading operational analytics...</p>
      </div>
    );
  }

  const statCards = [
    {
      title: "Today's Orders",
      value: stats?.today_orders || 0,
      sub: `Total All Time: ${stats?.total_orders || 0}`,
      icon: ShoppingBag,
      color: 'text-brand-400',
      bg: 'bg-brand-500/10',
    },
    {
      title: "Today's Revenue",
      value: `₹${stats?.today_revenue || 0}`,
      sub: `Total: ₹${stats?.total_revenue || 0}`,
      icon: IndianRupee,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
    },
    {
      title: 'Active Customers',
      value: stats?.total_customers || 0,
      sub: 'Verified buyers',
      icon: Users,
      color: 'text-sky-400',
      bg: 'bg-sky-500/10',
    },
    {
      title: 'Low Stock Alerts',
      value: stats?.low_stock_products || 0,
      sub: 'Needs replenishment',
      icon: AlertTriangle,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Executive Dashboard</h1>
          <p className="text-xs text-slate-400 mt-1">Real-time marketplace revenue, deliveries, and inventory</p>
        </div>
        <div className="flex gap-3">
          <Link
            to="/admin/products"
            className="bg-brand-500 hover:bg-brand-400 text-slate-950 font-bold text-xs px-4 py-2.5 rounded-xl shadow-md transition-all"
          >
            + Add Vegetable
          </Link>
          <Link
            to="/admin/orders"
            className="bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all"
          >
            Manage Orders
          </Link>
        </div>
      </div>

      {/* Analytics Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              className="bg-slate-950 p-6 rounded-3xl border border-slate-800 space-y-4 hover:border-slate-700 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400">{card.title}</span>
                <div className={`w-10 h-10 rounded-xl ${card.bg} ${card.color} flex items-center justify-center`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <div>
                <h3 className="text-2xl font-black text-white tracking-tight">{card.value}</h3>
                <p className="text-[11px] text-slate-400 mt-1">{card.sub}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent Orders Section */}
      <div className="bg-slate-950 rounded-3xl border border-slate-800 p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-extrabold text-white">Recent Customer Orders</h3>
            <p className="text-xs text-slate-400 mt-0.5">Live incoming delivery requests</p>
          </div>
          <Link
            to="/admin/orders"
            className="text-xs font-bold text-brand-400 hover:text-brand-300 flex items-center gap-1"
          >
            <span>View All Orders</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-500">
            No incoming orders yet. Place a test order on the customer website!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="pb-3 px-2">Order #</th>
                  <th className="pb-3 px-2">Customer</th>
                  <th className="pb-3 px-2">Amount</th>
                  <th className="pb-3 px-2">Status</th>
                  <th className="pb-3 px-2">Time</th>
                  <th className="pb-3 px-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {recentOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-900/60 transition-colors">
                    <td className="py-3 px-2 font-bold text-white">{order.order_number}</td>
                    <td className="py-3 px-2 text-slate-300">{order.customer_name}</td>
                    <td className="py-3 px-2 font-bold text-brand-400">₹{order.total}</td>
                    <td className="py-3 px-2">
                      <span className="bg-slate-800 text-slate-300 text-[10px] font-bold px-2.5 py-0.5 rounded-full capitalize">
                        {order.order_status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-slate-400 text-[11px]">
                      {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-3 px-2 text-right">
                      <Link
                        to="/admin/orders"
                        className="text-brand-400 hover:underline font-bold text-[11px]"
                      >
                        Manage →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
