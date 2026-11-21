import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  CheckCircle2,
  Package,
  Truck,
  ArrowRight,
  ShieldCheck,
  Building2,
  Clock,
  MapPin,
  CreditCard,
  ShoppingBag,
  Sparkles,
  Calendar,
  AlertTriangle,
  RotateCcw,
  Check,
} from 'lucide-react';
import api from '../../services/api';
import { Order } from '../../types';
import { SEOHead } from '../../components/common/SEOHead';
import { getProductImageUrl, getFallbackImageUrl } from '../../utils/imageUrl';

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

  const assignedHubName =
    order?.assigned_hub_name ||
    (order?.assigned_hub_code === 'kphb' ? 'Fresh Vegetables KPHB Hub' : 'Fresh Vegetables Champapet Hub');
  const confirmedEta = order?.confirmed_eta || (order as any)?.address_snapshot?.confirmed_eta || 'Scheduled in delivery slot';
  const deliveryAddress = (order?.address_snapshot || (order as any)?.delivery_address || {}) as any;
  const isCod = order?.payment_method === 'cod';
  const isCancelled = order?.order_status === 'cancelled';
  const isPaymentFailed = order?.payment_status === 'failed';

  const formattedDate = order?.created_at
    ? new Date(order.created_at).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Kolkata',
      })
    : '';

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-14 text-center space-y-6 sm:space-y-8 font-sans animate-slide-up">
      <SEOHead title="Order Confirmed | Fresh Vegetables Organic" noindex={true} />

      {/* Celebration or Alert Icon */}
      <div className="relative inline-block">
        <div
          className={`w-20 h-20 sm:w-24 sm:h-24 rounded-3xl flex items-center justify-center mx-auto shadow-soft border ${
            isCancelled || isPaymentFailed
              ? 'bg-tomato-50 text-tomato-600 border-tomato-200'
              : 'bg-cream-100 text-forest-800 border-line'
          }`}
        >
          {isCancelled || isPaymentFailed ? (
            <AlertTriangle className="w-12 h-12 sm:w-14 sm:h-14 stroke-[2.2]" />
          ) : (
            <CheckCircle2 className="w-12 h-12 sm:w-14 sm:h-14 stroke-[2.2] text-leaf-600" />
          )}
        </div>
        {!isCancelled && !isPaymentFailed && (
          <div className="absolute -bottom-1.5 -right-1.5 bg-leaf-500 text-white p-2 rounded-full shadow-soft animate-bounce">
            <Sparkles className="w-4 h-4" />
          </div>
        )}
      </div>

      {/* Heading & Context Message */}
      <div className="space-y-2">
        <span
          className={`inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-3.5 py-1 rounded-full border ${
            isCancelled
              ? 'bg-tomato-100 text-tomato-800 border-tomato-300'
              : isPaymentFailed
              ? 'bg-amber-100 text-amber-900 border-amber-300'
              : 'bg-cream-100 text-forest-800 border-line'
          }`}
        >
          {isCancelled
            ? 'Order Cancelled'
            : isPaymentFailed
            ? 'Payment Pending Verification'
            : 'Order Confirmed & Scheduled'}
        </span>
        <h1 className="font-heading text-2xl sm:text-4xl font-bold text-ink-900 tracking-tight">
          {isCancelled
            ? 'This order has been cancelled'
            : isPaymentFailed
            ? 'Payment was not completed'
            : 'Thank you for choosing fresh produce!'}
        </h1>
        <p className="text-ink-500 text-xs sm:text-sm max-w-md mx-auto leading-relaxed font-sans">
          {isCancelled
            ? 'This order was cancelled by store operations. No produce was dispatched and no charges were made.'
            : isPaymentFailed
            ? 'The payment transaction could not be verified. Your items remain safe in your basket. Please retry or choose Cash on Delivery.'
            : 'Your order has been recorded. Our team is hand-sorting and packing your fresh organic vegetables for doorstep dispatch.'}
        </p>
      </div>

      {isLoading ? (
        <div className="py-12 text-center bg-white rounded-3xl border border-line shadow-soft p-8">
          <div className="w-8 h-8 border-3 border-forest-900 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-ink-400 mt-3 font-medium">Retrieving confirmed order summary...</p>
        </div>
      ) : order ? (
        <div className="bg-white rounded-3xl border border-line p-6 sm:p-8 text-left shadow-soft space-y-6">
          {/* Order Reference & Date */}
          <div className="flex flex-wrap justify-between items-center pb-4 border-b border-line gap-3">
            <div>
              <p className="text-xs text-ink-400 font-semibold uppercase tracking-wider font-sans">Order Reference</p>
              <p className="text-lg font-bold text-ink-900 font-mono tracking-tight">{order.order_number}</p>
              {formattedDate && (
                <p className="text-[11px] text-ink-500 flex items-center gap-1 mt-0.5 font-sans">
                  <Calendar className="w-3.5 h-3.5 text-forest-700" />
                  <span>Placed on {formattedDate}</span>
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs text-ink-400 font-semibold uppercase tracking-wider font-sans">Total Payable</p>
              <p className="text-2xl font-heading font-bold text-forest-900 font-mono">₹{order.total}</p>
            </div>
          </div>

          {/* Two-Hub Dispatch Notice */}
          <div className="p-4 sm:p-5 rounded-2xl bg-cream-50 border border-line space-y-2.5 text-xs font-sans">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-forest-700" />
                <span className="font-bold text-forest-900 text-sm">Dispatched from {assignedHubName}</span>
              </div>
              <span className="text-[10px] font-bold text-forest-800 bg-cream-100 px-2.5 py-0.5 rounded-full border border-line">
                5.0 KM Service Radius
              </span>
            </div>
            <div className="flex items-center gap-4 text-ink-600 flex-wrap text-xs">
              <span className="flex items-center gap-1 font-semibold">
                <Clock className="w-3.5 h-3.5 text-forest-700" />
                <span>Estimated ETA: <strong className="text-forest-900">{confirmedEta}</strong></span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 font-semibold">
                <Truck className="w-3.5 h-3.5 text-forest-700" />
                <span>Express Farm-to-Doorstep</span>
              </span>
            </div>
          </div>

          {/* Payment Status Box */}
          <div className="p-4 rounded-2xl bg-cream-50 border border-line text-xs space-y-1.5 font-sans">
            <div className="flex items-center justify-between">
              <span className="font-bold text-ink-900 flex items-center gap-1.5 font-heading">
                <CreditCard className="w-4 h-4 text-forest-700" />
                <span>Payment Mode: {isCod ? 'Cash on Delivery (COD)' : order.payment_method?.toUpperCase()}</span>
              </span>
              <span className="text-[10px] uppercase font-bold text-forest-800 bg-cream-100 px-2.5 py-0.5 rounded-full border border-line">
                {isCod ? 'Due on Delivery' : 'Payment Confirmed'}
              </span>
            </div>
            <p className="text-[11px] text-ink-600 leading-relaxed">
              {isCod
                ? 'Please have exact cash ready or scan any UPI QR code (Google Pay, PhonePe, Paytm, BHIM) upon delivery.'
                : 'Your payment was confirmed. An itemized invoice has been dispatched to your email.'}
            </p>
          </div>

          {/* Delivery Address Summary */}
          {deliveryAddress && (
            <div className="p-4 rounded-2xl bg-white border border-line text-xs space-y-1 font-sans">
              <div className="flex items-center gap-1.5 font-bold text-ink-900 pb-1">
                <MapPin className="w-4 h-4 text-forest-700" />
                <span>Delivery Address</span>
              </div>
              <p className="text-ink-600 leading-relaxed font-medium">
                {[
                  deliveryAddress.house_number,
                  deliveryAddress.street,
                  deliveryAddress.area,
                  deliveryAddress.landmark ? `Near ${deliveryAddress.landmark}` : '',
                  deliveryAddress.city || 'Hyderabad',
                  deliveryAddress.pincode,
                ]
                  .filter(Boolean)
                  .join(', ')}
              </p>
            </div>
          )}

          {/* Items Summary with thumbnails */}
          {order.items && order.items.length > 0 && (
            <div className="space-y-3 font-sans">
              <h4 className="text-xs font-bold uppercase tracking-wider text-ink-400 font-heading flex items-center gap-1.5">
                <ShoppingBag className="w-3.5 h-3.5 text-forest-700" />
                <span>Order Contents ({order.items.length} item{order.items.length === 1 ? '' : 's'}):</span>
              </h4>
              <div className="divide-y divide-line/60">
                {order.items.map((item) => {
                  const itemName = item.product_name || (item as any).product_name_snapshot || 'Fresh Vegetable';
                  const itemImg = (item as any).image_url || (item as any).image || (item as any).product_images?.[0];
                  return (
                    <div key={item.id} className="py-2.5 flex justify-between items-center text-xs gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={getProductImageUrl(itemImg, itemName)}
                          alt={itemName}
                          className="w-10 h-10 rounded-lg object-contain bg-cream-50 border border-line p-0.5 shrink-0"
                          onError={(e) => {
                            e.currentTarget.src = getFallbackImageUrl(itemName);
                          }}
                        />
                        <div className="min-w-0">
                          <p className="font-bold text-ink-900 truncate">{itemName}</p>
                          <p className="text-[11px] text-ink-400">
                            {item.unit || (item as any).unit_snapshot} × {item.quantity}
                          </p>
                        </div>
                      </div>
                      <span className="font-bold text-ink-900 font-mono whitespace-nowrap">₹{item.subtotal}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-line flex items-center justify-between text-xs text-ink-500 flex-wrap gap-2 font-sans">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-forest-700" />
              <span>Two-hub organic freshness guarantee</span>
            </span>
            <span className="font-medium text-ink-600">
              Receipt sent to verified account email
            </span>
          </div>
        </div>
      ) : null}

      {/* Action buttons */}
      <div className="flex flex-wrap justify-center gap-3 pt-2">
        {order && (
          <Link
            to={`/orders/${order.id}/track`}
            className="bg-forest-900 hover:bg-forest-850 text-white font-bold text-xs sm:text-sm px-7 py-3.5 rounded-full shadow-soft flex items-center gap-2 transition-all min-h-[44px] cursor-pointer"
          >
            <Package className="w-4 h-4" />
            <span>Track Live Delivery</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        )}
        <Link
          to="/orders"
          className="bg-white hover:bg-cream-100 text-ink-800 font-bold text-xs sm:text-sm px-6 py-3.5 rounded-full border border-line flex items-center gap-2 transition-all min-h-[44px] shadow-soft cursor-pointer"
        >
          <span>View All Orders</span>
        </Link>
        <Link
          to="/products"
          className="bg-white hover:bg-cream-100 text-ink-800 font-bold text-xs sm:text-sm px-6 py-3.5 rounded-full border border-line flex items-center gap-2 transition-all min-h-[44px] shadow-soft cursor-pointer"
        >
          <span>Continue Shopping</span>
        </Link>
      </div>
    </div>
  );
};

export default OrderSuccessPage;
