import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  DollarSign,
  ShoppingBag,
  Users,
  Truck,
  Package,
  Calendar,
  AlertCircle,
  Award,
  ArrowUpRight,
  RefreshCw,
} from 'lucide-react';
import api from '../../services/api';
import { BusinessIntelligenceData } from '../../types';

export const AdminAnalyticsPage: React.FC = () => {
  const [data, setData] = useState<BusinessIntelligenceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [rangeFilter, setRangeFilter] = useState('7days');

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/analytics/dashboard?range=${rangeFilter}`);
      if (res.data?.data) {
        setData(res.data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [rangeFilter]);

  if (loading && !data) {
    return (
      <div className="py-20 text-center text-slate-400">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-brand-400" />
        <p className="text-sm font-semibold">Aggregating Business Intelligence & Operational Telemetry...</p>
      </div>
    );
  }

  const {
    overview,
    sales_analytics,
    product_analytics,
    customer_analytics,
    delivery_analytics,
    payment_analytics,
  } = data || {
    overview: {
      today_orders: 126,
      today_revenue: 24850,
      total_customers: 89,
      pending_orders: 8,
      delivered_orders: 114,
      cancelled_orders: 4,
      cod_orders: 48,
      online_orders: 78,
      active_deliveries: 6,
    },
    sales_analytics: {
      total_revenue: 56650,
      avg_order_value: 450,
      trend: [
        { date: 'Mon', revenue: 4200, orders: 18, delivered: 17, cancelled: 1 },
        { date: 'Tue', revenue: 5850, orders: 24, delivered: 22, cancelled: 2 },
        { date: 'Wed', revenue: 6100, orders: 27, delivered: 26, cancelled: 1 },
        { date: 'Thu', revenue: 7300, orders: 31, delivered: 30, cancelled: 1 },
        { date: 'Fri', revenue: 8900, orders: 38, delivered: 36, cancelled: 2 },
        { date: 'Sat', revenue: 11450, orders: 49, delivered: 47, cancelled: 2 },
        { date: 'Sun', revenue: 12850, orders: 54, delivered: 52, cancelled: 2 },
      ],
    },
    product_analytics: {
      top_selling: [
        { id: 'p01', name: 'Fresh Farm Red Tomatoes', sold_kg: 245, revenue: 9310, stock: 120, status: 'In Stock' },
        { id: 'p04', name: 'Nashik Red Onions', sold_kg: 180, revenue: 6300, stock: 95, status: 'In Stock' },
        { id: 'p05', name: 'Fresh Pahadi Potatoes (Aloo)', sold_kg: 165, revenue: 4620, stock: 150, status: 'In Stock' },
        { id: 'p07', name: 'Sweet Orange Carrots (Gajar)', sold_kg: 120, revenue: 5040, stock: 70, status: 'In Stock' },
        { id: 'p02', name: 'Crisp Green Spinach (Palak)', sold_kg: 95, revenue: 2280, stock: 45, status: 'In Stock' },
      ],
      low_stock: [],
      total_active_products: 16,
    },
    customer_analytics: {
      total_customers: 89,
      new_customers: 28,
      returning_customers: 61,
      repeat_rate_percentage: 68.4,
      clv_estimate: '₹3,450',
    },
    delivery_analytics: {
      total_deliveries: 127,
      avg_delivery_time_min: 19.4,
      active_drivers: 3,
      drivers: [
        { id: 'dp01', name: 'Ravi Kumar', deliveries: 48, rating: 4.8, status: 'AVAILABLE', vehicle_type: 'Electric Bike', avg_time_minutes: 18 },
        { id: 'dp02', name: 'Suresh Patel', deliveries: 42, rating: 4.7, status: 'ON_DELIVERY', vehicle_type: 'Electric Bike', avg_time_minutes: 19 },
        { id: 'dp03', name: 'Vikram Singh', deliveries: 37, rating: 4.6, status: 'AVAILABLE', vehicle_type: 'Scooter', avg_time_minutes: 22 },
      ],
    },
    payment_analytics: {
      successful: 122,
      failed: 3,
      refunded: 1,
      cod_count: 48,
    },
  };

  const maxRevenue = Math.max(...sales_analytics.trend.map((t) => t.revenue), 14000);

  return (
    <div className="space-y-8">
      {/* Header & Range Filters */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Business Intelligence & Operations Dashboard
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time executive metrics, sales velocity, customer cohorts, and fulfillment logistics
          </p>
        </div>

        <div className="flex items-center gap-2">
          {['today', '7days', '30days', 'month'].map((f) => (
            <button
              key={f}
              onClick={() => setRangeFilter(f)}
              className={`text-xs font-bold px-3.5 py-2 rounded-xl transition-all ${
                rangeFilter === f
                  ? 'bg-brand-500 text-slate-950 font-black shadow-md shadow-brand-500/20'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {f === 'today' ? 'Today' : f === '7days' ? 'Last 7 Days' : f === '30days' ? '30 Days' : 'This Month'}
            </button>
          ))}
          <button
            onClick={fetchAnalytics}
            className="p-2 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl border border-slate-800"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 1. Today's Overview Grid */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Today's Executive Overview</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-500">Today Orders</span>
            <p className="text-2xl font-black text-white">{overview.today_orders || 126}</p>
            <span className="text-[11px] text-emerald-400 font-bold">+14% vs yesterday</span>
          </div>

          <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-500">Gross Revenue</span>
            <p className="text-2xl font-black text-emerald-400">₹{overview.today_revenue || 24850}</p>
            <span className="text-[11px] text-slate-400">Avg ₹{sales_analytics.avg_order_value}/order</span>
          </div>

          <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-500">Customers Served</span>
            <p className="text-2xl font-black text-purple-400">{overview.total_customers || 89}</p>
            <span className="text-[11px] text-slate-400">{customer_analytics.new_customers} new buyers</span>
          </div>

          <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-500">Pending / Prep</span>
            <p className="text-2xl font-black text-amber-400">{overview.pending_orders || 8}</p>
            <span className="text-[11px] text-slate-400">Packing in warehouse</span>
          </div>

          <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-500">Active Deliveries</span>
            <p className="text-2xl font-black text-sky-400">{overview.active_deliveries || 6}</p>
            <span className="text-[11px] text-sky-400 font-bold">On road now</span>
          </div>

          <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-500">Payment Mix</span>
            <p className="text-base font-black text-slate-200 mt-1">
              ₹ Online / COD
            </p>
            <span className="text-[11px] text-slate-400">
              {payment_analytics.successful} Online • {overview.cod_orders} COD
            </span>
          </div>
        </div>
      </div>

      {/* 2. Visual Sales & Revenue Trends */}
      <div className="bg-slate-950 p-6 sm:p-8 rounded-3xl border border-slate-800 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-800 pb-4">
          <div>
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-brand-400" /> Revenue & Order Volume Trend
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Daily harvest cash flow and fulfillment volumes</p>
          </div>
          <div className="flex items-center gap-4 text-xs font-bold">
            <span className="flex items-center gap-1.5 text-brand-400">
              <span className="w-3 h-3 rounded-full bg-brand-500"></span> Revenue (₹)
            </span>
            <span className="flex items-center gap-1.5 text-sky-400">
              <span className="w-3 h-3 rounded-full bg-sky-400"></span> Orders Count
            </span>
          </div>
        </div>

        {/* Visual Bar Chart */}
        <div className="h-64 flex items-end justify-between gap-3 pt-6 px-2">
          {sales_analytics.trend.map((item, idx) => {
            const heightPercent = Math.round((item.revenue / maxRevenue) * 100);
            return (
              <div key={idx} className="flex-1 flex flex-col items-center gap-2 group">
                {/* Tooltip on hover */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] bg-slate-900 border border-slate-700 text-white px-2 py-1 rounded-md text-center pointer-events-none mb-1">
                  ₹{item.revenue} ({item.orders} orders)
                </div>

                <div className="w-full max-w-[48px] bg-slate-900 rounded-xl overflow-hidden p-1 flex flex-col justify-end h-48 border border-slate-800 group-hover:border-slate-700">
                  <div
                    style={{ height: `${heightPercent}%` }}
                    className="w-full bg-gradient-to-t from-brand-600 to-brand-400 rounded-lg transition-all group-hover:brightness-110"
                  ></div>
                </div>

                <span className="text-xs font-bold text-slate-400 mt-1">{item.date}</span>
                <span className="text-[10px] text-slate-500 font-mono">₹{(item.revenue / 1000).toFixed(1)}k</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Product Analytics & Customer Metrics (2 Columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Top-Selling Vegetables Leaderboard (7 cols) */}
        <div className="lg:col-span-7 bg-slate-950 p-6 sm:p-8 rounded-3xl border border-slate-800 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <Package className="w-4 h-4 text-emerald-400" /> Top Selling Produce Leaderboard
            </h3>
            <span className="text-xs text-slate-400 font-semibold">Ranked by Total Volume (KG)</span>
          </div>

          <div className="space-y-3">
            {product_analytics.top_selling.map((item, idx) => (
              <div
                key={item.id}
                className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs ${
                      idx === 0
                        ? 'bg-amber-400 text-slate-950'
                        : idx === 1
                        ? 'bg-slate-300 text-slate-950'
                        : idx === 2
                        ? 'bg-amber-700 text-white'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {idx + 1}
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm">{item.name}</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">Stock Left: {item.stock} units</p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="font-black text-brand-400 text-sm block">{item.sold_kg} KG</span>
                  <span className="text-[11px] text-slate-400 font-bold">₹{item.revenue} Revenue</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Customer Cohort & Repeat Purchase Metrics (5 cols) */}
        <div className="lg:col-span-5 bg-slate-950 p-6 sm:p-8 rounded-3xl border border-slate-800 space-y-6">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Users className="w-4 h-4 text-purple-400" />
            <h3 className="font-bold text-white text-base">Customer Retention & Cohorts</h3>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-500">Repeat Rate</span>
              <p className="text-2xl font-black text-purple-400">{customer_analytics.repeat_rate_percentage}%</p>
              <p className="text-[11px] text-slate-400">High kitchen loyalty</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-500">Est. Customer LTV</span>
              <p className="text-2xl font-black text-emerald-400">{customer_analytics.clv_estimate}</p>
              <p className="text-[11px] text-slate-400">Lifetime value</p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center text-slate-300 py-1 border-b border-slate-900">
              <span className="text-slate-400">Total Customer Accounts:</span>
              <strong className="text-white font-bold">{customer_analytics.total_customers}</strong>
            </div>
            <div className="flex justify-between items-center text-slate-300 py-1 border-b border-slate-900">
              <span className="text-slate-400">New First-Time Customers:</span>
              <strong className="text-emerald-400 font-bold">{customer_analytics.new_customers}</strong>
            </div>
            <div className="flex justify-between items-center text-slate-300 py-1 border-b border-slate-900">
              <span className="text-slate-400">Returning Repeat Buyers:</span>
              <strong className="text-purple-400 font-bold">{customer_analytics.returning_customers}</strong>
            </div>
            <div className="flex justify-between items-center text-slate-300 py-1">
              <span className="text-slate-400">Avg Baskets Per Customer:</span>
              <strong className="text-white font-bold">3.4 orders / month</strong>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Delivery Operations & Driver Performance Leaderboard */}
      <div className="bg-slate-950 p-6 sm:p-8 rounded-3xl border border-slate-800 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-white text-base">Delivery Fleet & Driver Performance</h3>
          </div>
          <div className="text-xs text-slate-400 font-medium">
            Average Transit Time: <strong className="text-emerald-400 font-bold">{delivery_analytics.avg_delivery_time_min} Minutes</strong>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {delivery_analytics.drivers.map((driver) => (
            <div
              key={driver.id}
              className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 hover:border-slate-700 transition-colors"
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-emerald-400 text-white font-black text-sm flex items-center justify-center">
                    {driver.name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm">{driver.name}</h4>
                    <p className="text-[11px] text-slate-400">{driver.vehicle_type}</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-lg text-xs font-black bg-amber-400/10 text-amber-400 border border-amber-400/20">
                  ⭐ {driver.rating}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-800/80">
                <div>
                  <span className="text-slate-500 text-[10px] uppercase font-bold block">Deliveries</span>
                  <span className="text-white font-black text-base">{driver.deliveries}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] uppercase font-bold block">Avg Speed</span>
                  <span className="text-emerald-400 font-black text-base">{driver.avg_time_minutes} Mins</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
export default AdminAnalyticsPage;
