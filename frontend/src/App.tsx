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

// Customer Pages
import { HomePage } from './pages/customer/HomePage';
import { ProductsPage } from './pages/customer/ProductsPage';
import { ProductDetailPage } from './pages/customer/ProductDetailPage';
import { CheckoutPage } from './pages/customer/CheckoutPage';
import { OrderSuccessPage } from './pages/customer/OrderSuccessPage';
import { OrdersPage } from './pages/customer/OrdersPage';
import { TrackingPage } from './pages/customer/TrackingPage';
import { ProfilePage } from './pages/customer/ProfilePage';
import { LoginPage } from './pages/customer/LoginPage';
import { RegisterPage } from './pages/customer/RegisterPage';
import { WalletPage } from './pages/customer/WalletPage';

// Admin Pages
import { AdminLayout } from './pages/admin/AdminLayout';
import { AdminLoginPage } from './pages/admin/AdminLoginPage';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminProductsPage } from './pages/admin/AdminProductsPage';
import { AdminCategoriesPage } from './pages/admin/AdminCategoriesPage';
import { AdminOrdersPage } from './pages/admin/AdminOrdersPage';
import { AdminCustomersPage } from './pages/admin/AdminCustomersPage';
import { AdminInventoryPage } from './pages/admin/AdminInventoryPage';
import { AdminPaymentsPage } from './pages/admin/AdminPaymentsPage';
import { AdminDeliveriesPage } from './pages/admin/AdminDeliveriesPage';
import { AdminCouponsPage } from './pages/admin/AdminCouponsPage';
import { AdminNotificationsPage } from './pages/admin/AdminNotificationsPage';
import { AdminAnalyticsPage } from './pages/admin/AdminAnalyticsPage';

// Phases 13–20 Admin Pages
import { AdminCMSPage } from './pages/admin/AdminCMSPage';
import { AdminSellersPage } from './pages/admin/AdminSellersPage';
import { AdminZonesPage } from './pages/admin/AdminZonesPage';
import { AdminLoyaltyPage } from './pages/admin/AdminLoyaltyPage';
import { AdminAuditLogsPage } from './pages/admin/AdminAuditLogsPage';
import { PermissionsPromptModal } from './components/common/PermissionsPromptModal';

const CustomerLayout: React.FC = () => {
  return (
    <div className="flex flex-col min-h-screen bg-[#f8fafc] text-slate-900 relative pb-20 md:pb-0">
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

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <NotificationProvider>
          <CartProvider>
            <BrowserRouter>
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
                  <Route path="deliveries" element={<AdminDeliveriesPage />} />
                  <Route path="delivery-charges" element={<AdminZonesPage />} />
                  <Route path="zones" element={<AdminZonesPage />} />
                  <Route path="sellers" element={<AdminSellersPage />} />
                  <Route path="payments" element={<AdminPaymentsPage />} />
                  <Route path="loyalty" element={<AdminLoyaltyPage />} />
                  <Route path="coupons" element={<AdminCouponsPage />} />
                  <Route path="notifications" element={<AdminNotificationsPage />} />
                  <Route path="customers" element={<AdminCustomersPage />} />
                  <Route path="inventory" element={<AdminInventoryPage />} />
                  <Route path="audit-logs" element={<AdminAuditLogsPage />} />
                </Route>
              </Routes>
            </BrowserRouter>
          </CartProvider>
        </NotificationProvider>
      </AuthProvider>
    </QueryClientProvider>
);
};

export default App;
