import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { CheckCircle2, Package, Truck, ArrowRight, ShieldCheck, Home } from 'lucide-react';
import api from '../../services/api';
import { Order } from '../../types';
import { SEOHead } from '../../components/common/SEOHead';

export const OrderSuccessPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (id) {
      api.get(`/orders/${id}`)
        .then((res) => {
          if (res.data?.data) setOrder(res.data.data);
        })
        .catch((err) => console.error('Failed to load order', err))
        .finally(() => setIsLoading(false));
    }
  }, [id]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-8">
      <SEOHead title="Order Confirmed | Fresh Vegetables Organic" noindex={true} />
      {/* Celebration Icon */}
      <div className="relative inline-block">
        <div className="w-24 h-24 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/10">
          <CheckCircle2 className="w-14 h-14" />
        </div>
      </div>

      <div className="space-y-2">
        <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
          Order Successfully Placed
        </span>
        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
          Thank you for choosing farm freshness!
        </h1>
        <p className="text-slate-500 text-sm max-w-md mx-auto">
          Our partner harvesters are carefully packaging your organic vegetables. You'll receive delivery shortly.
        </p>
      </div>

      {order && (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 text-left shadow-sm space-y-6">
          <div className="flex flex-wrap justify-between items-center pb-4 border-b border-slate-100 gap-2">
            <div>
              <p className="text-xs text-slate-400 font-semibold">Order Number</p>
              <p className="text-base font-extrabold text-slate-900">{order.order_number}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400 font-semibold">Total Paid</p>
              <p className="text-base font-extrabold text-brand-700">₹{order.total}</p>
            </div>
          </div>

          {/* Delivery estimate */}
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-brand-50/70 border border-brand-100 text-xs">
            <Truck className="w-5 h-5 text-brand-600 flex-shrink-0" />
            <div>
              <p className="font-bold text-brand-900">Estimated Delivery: Within 30 - 45 Minutes</p>
              <p className="text-brand-700/80">Direct dispatch from Central Agro Depot</p>
            </div>
          </div>

          {/* Items Summary */}
          {order.items && order.items.length > 0 && (
            <div className="space-y-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Items Ordered:</h4>
              <div className="divide-y divide-slate-100">
                {order.items.map((item) => (
                  <div key={item.id} className="py-2 flex justify-between text-xs">
                    <span className="font-semibold text-slate-700">
                      {item.product_name} ({item.unit}) × {item.quantity}
                    </span>
                    <span className="font-bold text-slate-900">₹{item.subtotal}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap justify-center gap-4 pt-4">
        <Link
          to="/orders"
          className="bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs px-6 py-3.5 rounded-xl shadow-lg shadow-brand-600/20 flex items-center gap-2 transition-all"
        >
          <Package className="w-4 h-4" />
          <span>Track Live Order Status</span>
        </Link>
        <Link
          to="/"
          className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-6 py-3.5 rounded-xl flex items-center gap-2 transition-all"
        >
          <Home className="w-4 h-4" />
          <span>Back to Home</span>
        </Link>
      </div>
    </div>
  );
};
