import React from 'react';
import { BrowserRouter, Routes, Route, Outlet, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { NotificationProvider } from './context/NotificationContext';
import { Header } from './components/common/Header';
import { Footer } from './components/common/Footer';
import { CartDrawer } from './components/cart/CartDrawer';
import { AnimatedBackground } from './components/common/AnimatedBackground';
import { PWAInstallPrompt } from './components/common/PWAInstallPrompt';
import { MobileBottomNav } from './components/common/MobileBottomNav';

// Customer Public Pages (Eagerly loaded for instant SEO & initial paint)
import { HomePage } from './pages/customer/HomePage';
import { ProductsPage } from './pages/customer/ProductsPage';
import { ProductDetailPage } from './pages/customer/ProductDetailPage';

// Customer Protected/Secondary Pages (Lazy loaded for optimal initial bundle)
const CheckoutPage = React.lazy(() => import('./pages/customer/CheckoutPage').then(m => ({ default: m.CheckoutPage })));
const OrderSuccessPage = React.lazy(() => import('./pages/customer/OrderSuccessPage').then(m => ({ default: m.OrderSuccessPage })));
const OrdersPage = React.lazy(() => import('./pages/customer/OrdersPage').then(m => ({ default: m.OrdersPage })));
const TrackingPage = React.lazy(() => import('./pages/customer/TrackingPage').then(m => ({ default: m.TrackingPage })));
const ProfilePage = React.lazy(() => import('./pages/customer/ProfilePage').then(m => ({ default: m.ProfilePage })));
const LoginPage = React.lazy(() => import('./pages/customer/LoginPage').then(m => ({ default: m.LoginPage })));
const RegisterPage = React.lazy(() => import('./pages/customer/RegisterPage').then(m => ({ default: m.RegisterPage })));
const WalletPage = React.lazy(() => import('./pages/customer/WalletPage').then(m => ({ default: m.WalletPage })));

// Admin Pages (Lazy loaded so standard customers & search bots don't download admin code)
const AdminLayout = React.lazy(() => import('./pages/admin/AdminLayout').then(m => ({ default: m.AdminLayout })));
const AdminLoginPage = React.lazy(() => import('./pages/admin/AdminLoginPage').then(m => ({ default: m.AdminLoginPage })));
const AdminDashboardPage = React.lazy(() => import('./pages/admin/AdminDashboardPage').then(m => ({ default: m.AdminDashboardPage })));
const AdminProductsPage = React.lazy(() => import('./pages/admin/AdminProductsPage').then(m => ({ default: m.AdminProductsPage })));
const AdminCategoriesPage = React.lazy(() => import('./pages/admin/AdminCategoriesPage').then(m => ({ default: m.AdminCategoriesPage })));
const AdminOrdersPage = React.lazy(() => import('./pages/admin/AdminOrdersPage').then(m => ({ default: m.AdminOrdersPage })));
const AdminCustomersPage = React.lazy(() => import('./pages/admin/AdminCustomersPage').then(m => ({ default: m.AdminCustomersPage })));
const AdminInventoryPage = React.lazy(() => import('./pages/admin/AdminInventoryPage').then(m => ({ default: m.AdminInventoryPage })));
const AdminPaymentsPage = React.lazy(() => import('./pages/admin/AdminPaymentsPage').then(m => ({ default: m.AdminPaymentsPage })));
const AdminDeliveriesPage = React.lazy(() => import('./pages/admin/AdminDeliveriesPage').then(m => ({ default: m.AdminDeliveriesPage })));
const AdminCouponsPage = React.lazy(() => import('./pages/admin/AdminCouponsPage').then(m => ({ default: m.AdminCouponsPage })));
const AdminNotificationsPage = React.lazy(() => import('./pages/admin/AdminNotificationsPage').then(m => ({ default: m.AdminNotificationsPage })));
const AdminAnalyticsPage = React.lazy(() => import('./pages/admin/AdminAnalyticsPage').then(m => ({ default: m.AdminAnalyticsPage })));
const AdminCMSPage = React.lazy(() => import('./pages/admin/AdminCMSPage').then(m => ({ default: m.AdminCMSPage })));
const AdminSellersPage = React.lazy(() => import('./pages/admin/AdminSellersPage').then(m => ({ default: m.AdminSellersPage })));
const AdminZonesPage = React.lazy(() => import('./pages/admin/AdminZonesPage').then(m => ({ default: m.AdminZonesPage })));
const AdminLoyaltyPage = React.lazy(() => import('./pages/admin/AdminLoyaltyPage').then(m => ({ default: m.AdminLoyaltyPage })));
const AdminAuditLogsPage = React.lazy(() => import('./pages/admin/AdminAuditLogsPage').then(m => ({ default: m.AdminAuditLogsPage })));
import { PermissionsPromptModal } from './components/common/PermissionsPromptModal';

const CustomerLayout: React.FC = () => {
  return (
    <div className="flex flex-col min-h-screen min-h-[100dvh] bg-[#f8fafc] text-slate-900 relative pb-safe-nav md:pb-0">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <CartDrawer />
      <MobileBottomNav />
      <PermissionsPromptModal />
      <PWAInstallPrompt />
    </div>
  );
};

import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './services/queryClient';

const isAdminDeployment =
  typeof window !== 'undefined' &&
  (window.location.hostname.startsWith('admin.') ||
    window.location.hostname.includes('-admin.') ||
    window.location.hostname.includes('-admin-') ||
    window.location.hostname.includes('fresh-vegitables-admin') ||
    window.location.hostname.includes('fresh-vegetables-admin') ||
    import.meta.env.VITE_ADMIN_ONLY === 'true');

const RouteLoadingFallback: React.FC = () => (
  <div className="flex items-center justify-center min-h-[50vh] p-8">
    <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
  </div>
);

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <NotificationProvider>
          <CartProvider>
            <BrowserRouter>
              <React.Suspense fallback={<RouteLoadingFallback />}>
                <Routes>
                  {/* Admin-only deployment auto-redirect */}
                  {isAdminDeployment && (
                    <Route path="/" element={<Navigate to="/admin" replace />} />
                  )}

                  {/* Customer Routes */}
                  <Route path="/" element={<CustomerLayout />}>
                    <Route index element={<HomePage />} />
                    <Route path="products" element={<ProductsPage />} />
                    <Route path="products/:slug" element={<ProductDetailPage />} />
                    <Route path="checkout" element={<CheckoutPage />} />
                    <Route path="order-success/:id" element={<OrderSuccessPage />} />
                    <Route path="orders" element={<OrdersPage />} />
                    <Route path="orders/:id/track" element={<TrackingPage />} />
                    <Route path="profile" element={<ProfilePage />} />
                    <Route path="wallet" element={<WalletPage />} />
                    <Route path="login" element={<LoginPage />} />
                    <Route path="register" element={<RegisterPage />} />
                  </Route>

                  {/* Admin Auth */}
                  <Route path="/admin/login" element={<AdminLoginPage />} />

                  {/* Admin Management Protected Routes */}
                  <Route path="/admin" element={<AdminLayout />}>
                    <Route index element={<AdminDashboardPage />} />
                    <Route path="analytics" element={<AdminAnalyticsPage />} />
                    <Route path="cms" element={<AdminCMSPage />} />
                    <Route path="products" element={<AdminProductsPage />} />
                    <Route path="categories" element={<AdminCategoriesPage />} />
                    <Route path="orders" element={<AdminOrdersPage />} />
                    <Route path="orders/:id" element={<AdminOrdersPage />} />
                    <Route path="deliveries" element={<AdminDeliveriesPage />} />

                    <Route path="settings" element={<AdminZonesPage initialTab="service_area" />} />
                    <Route path="delivery-service-area" element={<AdminZonesPage initialTab="service_area" />} />
                    <Route path="delivery-charges" element={<AdminZonesPage />} />
                    <Route path="zones" element={<AdminZonesPage />} />
                    <Route path="sellers" element={<AdminSellersPage />} />
                    <Route path="payments" element={<AdminPaymentsPage />} />
                    <Route path="payment-settings" element={<AdminPaymentsPage initialTab="settings" />} />
                    <Route path="loyalty" element={<AdminLoyaltyPage />} />
                    <Route path="coupons" element={<AdminCouponsPage />} />
                    <Route path="notifications" element={<AdminNotificationsPage />} />
                    <Route path="customers" element={<AdminCustomersPage />} />
                    <Route path="inventory" element={<AdminInventoryPage />} />
                    <Route path="audit-logs" element={<AdminAuditLogsPage />} />
                  </Route>
                </Routes>
              </React.Suspense>
            </BrowserRouter>
          </CartProvider>
        </NotificationProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
