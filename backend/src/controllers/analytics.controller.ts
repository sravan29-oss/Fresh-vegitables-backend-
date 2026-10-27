import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { sendSuccess } from '../utils/apiResponse';
import { memoryStore } from '../config/mockDb';

export async function getBusinessIntelligence(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const range = (req.query.range as string) || '7days';

    // 1. Core aggregates from memoryStore
    const orders = memoryStore.orders;
    const users = memoryStore.users;
    const products = memoryStore.products;
    const partners = memoryStore.delivery_partners;
    const payments = memoryStore.payments;

    const totalRevenue = orders
      .filter((o) => o.order_status !== 'cancelled')
      .reduce((sum, o) => sum + Number((o as any).total_amount || o.total || 0), 0);

    const pendingOrders = orders.filter((o) => ['pending', 'confirmed', 'preparing', 'packed'].includes(o.order_status)).length;
    const deliveredOrders = orders.filter((o) => o.order_status === 'delivered').length;
    const cancelledOrders = orders.filter((o) => o.order_status === 'cancelled').length;
    const codOrders = orders.filter((o) => o.payment_method === 'cod').length;
    const onlineOrders = orders.filter((o) => o.payment_method !== 'cod').length;
    const activeDeliveries = orders.filter((o) => o.order_status === 'out_for_delivery').length;

    // Today specific stats
    const todayOrders = orders.length; // Active demo orders
    const todayRevenue = totalRevenue;

    // 2. Revenue & Orders Trend (7 Days or Month)
    const salesTrend = [
      { date: 'Mon', revenue: 4200, orders: 18, delivered: 17, cancelled: 1 },
      { date: 'Tue', revenue: 5850, orders: 24, delivered: 22, cancelled: 2 },
      { date: 'Wed', revenue: 6100, orders: 27, delivered: 26, cancelled: 1 },
      { date: 'Thu', revenue: 7300, orders: 31, delivered: 30, cancelled: 1 },
      { date: 'Fri', revenue: 8900, orders: 38, delivered: 36, cancelled: 2 },
      { date: 'Sat', revenue: 11450, orders: 49, delivered: 47, cancelled: 2 },
      { date: 'Sun', revenue: 12850, orders: 54, delivered: 52, cancelled: 2 },
    ];

    // 3. Product Analytics
    const topSellingProducts = products
      .filter((p) => p.status === 'active')
      .slice(0, 5)
      .map((p) => ({
        id: p.id,
        name: p.name,
        sold_kg: 0,
        revenue: 0,
        stock: p.stock_quantity,
        status: p.stock_quantity > 0 ? 'In Stock' : 'Out of Stock',
      }));


    const lowStockProducts = products
      .filter((p) => p.stock_quantity <= p.minimum_stock + 10)
      .map((p) => ({
        id: p.id,
        name: p.name,
        stock_quantity: p.stock_quantity,
        minimum_stock: p.minimum_stock,
        selling_price: p.selling_price,
      }));

    // 4. Customer Analytics
    const totalCustomers = users.length + 84; // demo scale
    const newCustomers = 28;
    const returningCustomers = 61;
    const avgOrderValue = Math.round(totalRevenue / Math.max(orders.length, 1));
    const repeatPurchaseRate = 68.4; // %

    // 5. Delivery Analytics
    const driverPerformance = partners.map((p) => ({
      id: p.id,
      name: p.name,
      deliveries: p.total_deliveries || 18,
      rating: p.rating || 4.8,
      status: p.status,
      vehicle_type: p.vehicle_type,
      avg_time_minutes: 19,
    }));

    // Payment stats
    const successfulPayments = payments.filter((p: any) => p.payment_status === 'PAID' || p.status === 'PAID').length + 42;
    const failedPayments = payments.filter((p: any) => p.payment_status === 'FAILED' || p.status === 'FAILED').length + 3;
    const refundedPayments = memoryStore.refunds.length;

    sendSuccess(res, 'Business intelligence and analytics report', {
      range,
      overview: {
        today_orders: todayOrders,
        today_revenue: todayRevenue,
        total_customers: totalCustomers,
        pending_orders: pendingOrders,
        delivered_orders: deliveredOrders,
        cancelled_orders: cancelledOrders,
        cod_orders: codOrders,
        online_orders: onlineOrders,
        active_deliveries: activeDeliveries,
      },
      sales_analytics: {
        total_revenue: totalRevenue + 56650,
        avg_order_value: avgOrderValue,
        trend: salesTrend,
      },
      product_analytics: {
        top_selling: topSellingProducts,
        low_stock: lowStockProducts,
        total_active_products: products.filter((p) => p.status === 'active').length,
      },
      customer_analytics: {
        total_customers: totalCustomers,
        new_customers: newCustomers,
        returning_customers: returningCustomers,
        repeat_rate_percentage: repeatPurchaseRate,
        clv_estimate: '₹3,450',
      },
      delivery_analytics: {
        total_deliveries: 127,
        avg_delivery_time_min: 19.4,
        active_drivers: partners.filter((p) => p.status === 'ON_DELIVERY' || p.status === 'AVAILABLE').length,
        drivers: driverPerformance,
      },
      payment_analytics: {
        successful: successfulPayments,
        failed: failedPayments,
        refunded: refundedPayments,
        cod_count: codOrders,
      },
    });
  } catch (error) {
    next(error);
  }
}
