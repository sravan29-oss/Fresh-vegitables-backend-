import React, { useEffect, useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Layers,
  ShoppingBag,
  Users,
  Boxes,
  CreditCard,
  Truck,
  Tag,
  Bell,
  BarChart3,
  LogOut,
  ExternalLink,
  ShieldCheck,
  LayoutTemplate,
  Store,
  MapPin,
  Wallet,
  ShieldAlert,
  Crosshair,
  Menu,
  X,
  Settings,
  Sliders,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { AdminOrderAlertProvider, useAdminOrderAlerts } from '../../context/AdminOrderAlertContext';
import { AdminOrderNotificationBar } from '../../components/admin/AdminOrderNotificationBar';
import { SEOHead } from '../../components/common/SEOHead';

export const AdminLayoutContent: React.FC = () => {
  const { adminUser, adminLogout, showLogoutConfirm, showLogoutSuccess } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  // Close drawer on route change
  useEffect(() => {
    setIsMobileDrawerOpen(false);
  }, [location.pathname]);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (isMobileDrawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileDrawerOpen]);

  useEffect(() => {
    const adminToken = localStorage.getItem('admin_token');
    if (!adminToken) {
      navigate('/admin/login');
    }
  }, [adminUser, navigate]);

  const navItems = [
    { name: 'Dashboard', path: '/admin', icon: LayoutDashboard },
    { name: 'Orders & Deliveries', path: '/admin/orders', icon: ShoppingBag },
    { name: 'Payment Management', path: '/admin/payment-settings', icon: Sliders },
    { name: 'Payments Ledger', path: '/admin/payments', icon: CreditCard },
    { name: 'Delivery Service Area (5 KM)', path: '/admin/settings', icon: Crosshair },
    { name: 'Delivery Charges & Zones', path: '/admin/delivery-charges', icon: MapPin },
    { name: 'Products Catalog', path: '/admin/products', icon: Package },
    { name: 'Categories', path: '/admin/categories', icon: Layers },
    { name: 'Inventory & Stock', path: '/admin/inventory', icon: Boxes },
    { name: 'Deliveries & Fleet', path: '/admin/deliveries', icon: Truck },
    { name: 'Customers Directory', path: '/admin/customers', icon: Users },
    { name: 'Analytics & BI', path: '/admin/analytics', icon: BarChart3 },
    { name: 'Homepage CMS', path: '/admin/cms', icon: LayoutTemplate },
    { name: 'Coupons & Offers', path: '/admin/coupons', icon: Tag },
    { name: 'Loyalty & Wallets', path: '/admin/loyalty', icon: Wallet },
    { name: 'Sellers & Farmers', path: '/admin/sellers', icon: Store },
    { name: 'Audit Logs', path: '/admin/audit-logs', icon: ShieldAlert },
  ];

  // Mobile Bottom Bar Items (Compact 6-tab system)
  const mobileBottomItems = [
    { name: 'Dashboard', path: '/admin', icon: LayoutDashboard, exact: true },
    { name: 'Orders', path: '/admin/orders', icon: ShoppingBag },
    { name: 'Products', path: '/admin/products', icon: Package },
    { name: 'Payments', path: '/admin/payments', icon: CreditCard },
    { name: 'Customers', path: '/admin/customers', icon: Users },
    { name: 'Settings', path: '/admin/payment-settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col lg:flex-row overflow-x-hidden">
      <SEOHead title="Admin Operations | Fresh Vegetables Organic" noindex={true} />
      {/* ─── Mobile Drawer Backdrop ─── */}
      {isMobileDrawerOpen && (
        <div
          onClick={() => setIsMobileDrawerOpen(false)}
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs lg:hidden transition-opacity"
        />
      )}

      {/* ─── Sidebar / Off-Canvas Drawer on Mobile ─── */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-slate-950 border-r border-slate-800 flex flex-col justify-between p-4 transform transition-transform duration-300 ease-in-out lg:static lg:w-64 lg:translate-x-0 ${
          isMobileDrawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="space-y-5 overflow-y-auto max-h-[calc(100vh-100px)]">
          {/* Logo / Header with Close Button for Mobile */}
          <div className="px-2 py-2 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src="/logo.png"
                alt="Fresh Vegetables Admin"
                className="w-10 h-10 rounded-full object-cover border border-emerald-500/40 shadow-sm"
              />
              <div>
                <h2 className="font-extrabold text-white text-base tracking-tight leading-tight">
                  Fresh<span className="text-brand-400">Admin</span>
                </h2>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                  Store Operations
                </span>
              </div>
            </div>

            {/* Mobile Close Button */}
            <button
              onClick={() => setIsMobileDrawerOpen(false)}
              className="lg:hidden p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Nav links */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.path === '/admin'
                  ? location.pathname === '/admin'
                  : location.pathname.startsWith(item.path);

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMobileDrawerOpen(false)}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-brand-500 text-slate-950 shadow-md shadow-brand-500/20'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer controls in sidebar */}
        <div className="pt-4 border-t border-slate-800 space-y-2 mt-auto">
          <Link
            to="/"
            target="_blank"
            className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-900 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            <span>Open Customer Store</span>
          </Link>

          <button
            onClick={() => {
              showLogoutConfirm(() => {
                adminLogout();
                showLogoutSuccess(true, () => {
                  navigate('/admin/login');
                });
              });
            }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-bold text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ─── Main Content Area ─── */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-900 min-h-screen">
        {/* Top Header Bar */}
        <header className="h-16 border-b border-slate-800 px-4 sm:px-6 lg:px-8 flex items-center justify-between bg-slate-950/70 backdrop-blur-md sticky top-0 z-30">
          <div className="flex items-center gap-3">
            {/* Hamburger Button for Mobile/Tablet */}
            <button
              onClick={() => setIsMobileDrawerOpen(true)}
              className="lg:hidden p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors focus:outline-none"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-brand-400 shrink-0" />
              <span className="text-xs font-bold text-slate-300 hidden sm:inline">
                Fresh Vegetables <span className="text-slate-500 font-normal">| Live Hub</span>
              </span>
            </div>
          </div>

          {/* Right Header: Sound Notification Controls & Admin Profile */}
          <div className="flex items-center gap-2 sm:gap-4">
            <AdminOrderNotificationBar />

            <div className="h-5 w-px bg-slate-800 hidden sm:block" />

            <div className="flex items-center gap-2.5">
              <span className="text-xs font-bold text-slate-300 hidden md:inline">
                {adminUser?.name || 'Store Manager'}
              </span>
              <div className="w-8 h-8 rounded-full bg-brand-500 text-slate-950 font-black text-xs flex items-center justify-center shadow-xs">
                {adminUser?.name ? adminUser.name.slice(0, 2).toUpperCase() : 'AD'}
              </div>
            </div>
          </div>
        </header>

        {/* Content body with responsive bottom safe-area margin */}
        <main className="p-3 sm:p-6 lg:p-8 flex-1 overflow-y-auto pb-24 lg:pb-8">
          <Outlet />
        </main>
      </div>

      {/* ─── Mobile Bottom Navigation Bar (iOS & Android Safe Area Aware) ─── */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-md border-t border-slate-800 flex items-center justify-around px-1 py-1.5 lg:hidden shadow-2xl"
        style={{ paddingBottom: 'max(0.4rem, env(safe-area-inset-bottom, 0px))' }}
      >
        {mobileBottomItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.exact
            ? location.pathname === item.path
            : location.pathname.startsWith(item.path);

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all min-w-[56px] ${
                isActive
                  ? 'text-brand-400 font-black scale-105'
                  : 'text-slate-400 hover:text-slate-200 font-semibold'
              }`}
            >
              <Icon className="w-4 h-4 mb-0.5" />
              <span className="text-[10px] tracking-tight">{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
};

export const AdminLayout: React.FC = () => {
  return (
    <AdminOrderAlertProvider>
      <AdminLayoutContent />
    </AdminOrderAlertProvider>
  );
};
