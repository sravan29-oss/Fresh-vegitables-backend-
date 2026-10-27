import React, { useEffect } from 'react';
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
  Calendar,
  Store,
  MapPin,
  Wallet,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const AdminLayout: React.FC = () => {
  const { adminUser, adminLogout, showLogoutConfirm, showLogoutSuccess } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const adminToken = localStorage.getItem('admin_token');
    if (!adminToken) {
      navigate('/admin/login');
    }
  }, [adminUser, navigate]);

  const navItems = [
    { name: 'Dashboard', path: '/admin', icon: LayoutDashboard },
    { name: 'Analytics & BI', path: '/admin/analytics', icon: BarChart3 },
    { name: 'Homepage CMS', path: '/admin/cms', icon: LayoutTemplate },
    { name: 'Products', path: '/admin/products', icon: Package },
    { name: 'Categories', path: '/admin/categories', icon: Layers },
    { name: 'Orders & Deliveries', path: '/admin/orders', icon: ShoppingBag },
    { name: 'Subscriptions', path: '/admin/subscriptions', icon: Calendar },
    { name: 'Deliveries & Fleet', path: '/admin/deliveries', icon: Truck },
    { name: 'Delivery Charges & Zones', path: '/admin/delivery-charges', icon: MapPin },
    { name: 'Sellers & Farmers', path: '/admin/sellers', icon: Store },
    { name: 'Payments Ledger', path: '/admin/payments', icon: CreditCard },
    { name: 'Loyalty & Wallets', path: '/admin/loyalty', icon: Wallet },
    { name: 'Coupons & Offers', path: '/admin/coupons', icon: Tag },
    { name: 'Broadcast Alerts', path: '/admin/notifications', icon: Bell },
    { name: 'Customers', path: '/admin/customers', icon: Users },
    { name: 'Inventory', path: '/admin/inventory', icon: Boxes },
    { name: 'Audit Logs', path: '/admin/audit-logs', icon: ShieldAlert },
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col justify-between p-4 flex-shrink-0">
        <div className="space-y-6">
          {/* Logo / Header */}
          <div className="px-3 py-2 flex items-center gap-3">
            <img
              src="/logo.png"
              alt="Fresh Vegetables Admin"
              className="w-10 h-10 rounded-full object-cover border border-emerald-500/40 shadow-sm"
            />
            <div>
              <h2 className="font-extrabold text-white text-base tracking-tight leading-tight">
                Fresh<span className="text-brand-400">Admin</span>
              </h2>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                Store Operations
              </span>
            </div>
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
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-brand-500 text-slate-950 shadow-md shadow-brand-500/20'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer controls in sidebar */}
        <div className="pt-4 border-t border-slate-800 space-y-2">
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

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-900">
        {/* Top bar */}
        <header className="h-16 border-b border-slate-800 px-8 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-brand-400" />
            <span>Operational Mode: <strong>Production Ready</strong></span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-300">
              {adminUser?.name || 'Store Manager'}
            </span>
            <div className="w-8 h-8 rounded-full bg-brand-500 text-slate-950 font-black text-xs flex items-center justify-center">
              AD
            </div>
          </div>
        </header>

        {/* Content body */}
        <main className="p-8 flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
