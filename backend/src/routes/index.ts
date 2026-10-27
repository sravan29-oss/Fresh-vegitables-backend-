import { Router } from 'express';
import authRoutes from './auth.routes';
import categoryRoutes from './category.routes';
import productRoutes from './product.routes';
import cartRoutes from './cart.routes';
import addressRoutes from './address.routes';
import orderRoutes from './order.routes';
import adminRoutes from './admin.routes';
import paymentRoutes from './payment.routes';
import deliveryRoutes from './delivery.routes';
import couponRoutes from './coupon.routes';
import notificationRoutes from './notification.routes';
import analyticsRoutes from './analytics.routes';

// Phases 13–20 Extensions
import cmsRoutes from './cms.routes';
import loyaltyRoutes from './loyalty.routes';
import subscriptionRoutes from './subscription.routes';
import sellerRoutes from './seller.routes';
import feedRoutes from './feed.routes';
import zoneRoutes from './zone.routes';
import auditRoutes from './audit.routes';
import webhookRoutes from './webhook.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/categories', categoryRoutes);
router.use('/products', productRoutes);
router.use('/cart', cartRoutes);
router.use('/addresses', addressRoutes);
router.use('/orders', orderRoutes);
router.use('/admin', adminRoutes);

// Phases 7–12 Extensions
router.use('/payments', paymentRoutes);
router.use('/delivery', deliveryRoutes);
router.use('/coupons', couponRoutes);
router.use('/notifications', notificationRoutes);
router.use('/analytics', analyticsRoutes);

// Phases 13–20 Extensions
router.use('/cms', cmsRoutes);
router.use('/loyalty', loyaltyRoutes);
router.use('/subscriptions', subscriptionRoutes);
router.use('/sellers', sellerRoutes);
router.use('/feeds', feedRoutes);
router.use('/zones', zoneRoutes);
router.use('/audit-logs', auditRoutes);

// Meta WhatsApp Cloud API Webhook Integration
router.use('/webhooks', webhookRoutes);

export default router;

