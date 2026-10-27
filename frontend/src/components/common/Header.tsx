import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingBag, Search, User, LogOut, Package, MapPin, Menu, X, ShieldAlert, Bell, Check } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import api from '../../services/api';
import { Category, Notification, DeliveryZone } from '../../types';
import { LocationSelectorModal } from './LocationSelectorModal';
import { Wallet, Calendar } from 'lucide-react';

export const Header: React.FC = () => {
  const { user, logout, showLogoutConfirm, showLogoutSuccess } = useAuth();
  const { itemCount, setIsCartOpen } = useCart();
  const navigate = useNavigate();

  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Store Support & Contact Settings (Admin configurable)
  const [storeSettings, setStoreSettings] = useState<{
    support_phone?: string;
    announcement_text?: string;
    quality_badge?: string;
  }>({
    support_phone: '+91 8106970384',
    announcement_text: 'Same-Day Farm Delivery available for orders before 2:00 PM',
    quality_badge: '⚡ 100% Residue-Free & Organic',
  });

  useEffect(() => {
    api.get('/cms/settings')
      .then((res) => {
        if (res.data?.data) {
          setStoreSettings(res.data.data);
        }
      })
      .catch(() => {});
  }, []);

  // Phase 19: Location & Delivery Zone selector state
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [currentZone, setCurrentZone] = useState<DeliveryZone | null>(() => {
    const saved = localStorage.getItem('fresh_delivery_zone');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return {
      id: 'zone-kphb',
      name: 'Kukatpally Zone',
      pincodes: ['500072'],
      delivery_radius_km: 8.5,
      delivery_fee: 20,
      min_order_amount: 199,
      free_delivery_threshold: 499,
      estimated_delivery_time: '25–35 mins',
      status: 'ACTIVE',
    };
  });

  // Phase 11: Notification state
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      const res = await api.get('/notifications');
      if (res.data?.data) {
        setNotifications(res.data.data.notifications || []);
        setUnreadCount(res.data.data.unread_count || 0);
      }
    } catch (err) {
      // ignore silently for guests
    }
  };

  useEffect(() => {
    api.get('/categories')
      .then((res) => {
        if (res.data?.data) setCategories(res.data.data.slice(0, 6));
      })
      .catch(() => {});

    if (user) {
      fetchNotifications();
    }

    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [user]);

  const handleMarkAllRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error(err);
    }
  };

  const handleNotificationClick = async (notif: Notification) => {
    try {
      if (!notif.is_read) {
        await api.put(`/notifications/${notif.id}/read`);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      }
      setIsNotifOpen(false);
      if (notif.reference_type === 'order' && notif.reference_id) {
        navigate(`/orders/${notif.reference_id}/track`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/products?search=${encodeURIComponent(searchQuery.trim())}`);
      setIsMobileMenuOpen(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 glass-header transition-all">
      {/* Top micro banner */}
      <div className="bg-brand-900/90 backdrop-blur-sm text-brand-50 text-xs py-1.5 px-4 font-medium">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>{storeSettings.announcement_text || 'Same-Day Farm Delivery available for orders before 2:00 PM'}</span>
          </div>
          <div className="flex items-center gap-4 hidden sm:flex">
            <span>{storeSettings.quality_badge || '⚡ 100% Residue-Free & Organic'}</span>
            <a
              href={`tel:${(storeSettings.support_phone || '+91 8106970384').replace(/[\s-]/g, '')}`}
              className="hover:text-brand-300 transition-colors flex items-center gap-1 font-semibold"
            >
              <span>📞 Support: {storeSettings.support_phone || '+91 8106970384'}</span>
            </a>
          </div>
        </div>
      </div>

      {/* Main navigation row */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-18 py-3 gap-4">
          
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 flex-shrink-0 group">
            <img
              src="/logo.png"
              alt="Fresh Vegetables Organic Logo"
              className="w-12 h-12 rounded-full object-cover shadow-md shadow-brand-500/25 group-hover:scale-105 group-hover:rotate-1 transition-all duration-300 ring-2 ring-brand-500/30"
            />
            <div>
              <span className="font-extrabold text-2xl tracking-tight text-slate-900 group-hover:text-brand-700 transition-colors">
                Fresh<span className="text-brand-600">Vegetables</span>
              </span>
              <p className="text-[10px] font-bold uppercase tracking-wider text-brand-700/80 -mt-0.5 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                100% Certified Organic
              </p>
            </div>
          </Link>

          {/* Location indicator */}
          <button
            onClick={() => setIsLocationModalOpen(true)}
            className="hidden lg:flex items-center gap-2 text-xs bg-slate-100 hover:bg-slate-200/70 px-3 py-2 rounded-xl text-slate-700 cursor-pointer border border-slate-200 transition-colors text-left"
          >
            <MapPin className="w-4 h-4 text-brand-600 flex-shrink-0 animate-bounce" />
            <div className="leading-tight">
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <span>{currentZone ? currentZone.name : 'Select Zone'}</span>
                <span className="text-[10px] bg-brand-500/20 text-brand-700 px-1.5 py-0.5 rounded font-black">
                  ₹{currentZone?.delivery_fee || 20}
                </span>
              </div>
              <div className="text-slate-500 truncate max-w-[130px]">
                {currentZone?.estimated_delivery_time || '30 Mins'} Express
              </div>
            </div>
          </button>

          {/* Search bar */}
          <form onSubmit={handleSearchSubmit} className="flex-1 max-w-xl mx-2 hidden md:block">
            <div className="relative">
              <input
                type="text"
                placeholder="Search fresh spinach, tomatoes, carrots, broccoli..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 text-sm bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 focus:border-brand-500 rounded-full focus:outline-none focus:ring-4 focus:ring-brand-500/15 transition-all text-slate-800 placeholder-slate-400"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            </div>
          </form>

          {/* Right actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Phase 11: Notification Bell */}
            {user && (
              <div className="relative" ref={notifRef}>
                <button
                  onClick={() => setIsNotifOpen(!isNotifOpen)}
                  className="p-2.5 rounded-xl hover:bg-slate-100 text-slate-700 transition-colors relative"
                  title="Notifications"
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute 1 top-1.5 right-1.5 bg-rose-500 text-white text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {/* Notifications Dropdown */}
                {isNotifOpen && (
                  <div className="absolute right-0 mt-2 w-80 sm:w-96 glass-dropdown rounded-2xl py-3 z-50 animate-fade-in">
                    <div className="px-4 pb-2 border-b border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-slate-900 text-sm">Notifications</span>
                        {unreadCount > 0 && (
                          <span className="text-[11px] font-bold bg-brand-100 text-brand-800 px-2 py-0.5 rounded-full">
                            {unreadCount} new
                          </span>
                        )}
                      </div>
                      {unreadCount > 0 && (
                        <button
                          onClick={handleMarkAllRead}
                          className="text-[11px] font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" /> Mark all read
                        </button>
                      )}
                    </div>

                    <div className="max-h-72 overflow-y-auto divide-y divide-slate-50">
                      {notifications.length === 0 ? (
                        <div className="py-8 text-center text-xs text-slate-400">
                          <p>No notifications yet</p>
                        </div>
                      ) : (
                        notifications.map((n) => (
                          <div
                            key={n.id}
                            onClick={() => handleNotificationClick(n)}
                            className={`p-3.5 cursor-pointer hover:bg-slate-50 transition-colors text-xs ${
                              !n.is_read ? 'bg-brand-50/40' : ''
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className={`font-bold ${!n.is_read ? 'text-slate-900 font-extrabold' : 'text-slate-700'}`}>
                                {n.title}
                              </p>
                              {!n.is_read && (
                                <span className="w-2 h-2 rounded-full bg-brand-600 shrink-0 mt-1"></span>
                              )}
                            </div>
                            <p className="text-slate-500 text-[11px] mt-0.5 line-clamp-2">{n.message}</p>
                            <span className="text-[10px] text-slate-400 mt-1 block">
                              {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* User Account */}
            <div className="relative" ref={userMenuRef}>
              {user ? (
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center gap-2 p-2 rounded-xl hover:bg-slate-100 text-slate-700 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 font-bold flex items-center justify-center text-sm border border-brand-200">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-semibold hidden sm:inline max-w-[90px] truncate">
                    {user.name.split(' ')[0]}
                  </span>
                </button>
              ) : (
                <Link
                  to="/login"
                  className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold text-slate-700 hover:text-brand-700 hover:bg-brand-50 rounded-xl transition-all"
                >
                  <User className="w-4 h-4" />
                  <span className="hidden sm:inline">Sign In</span>
                </Link>
              )}

              {/* User Dropdown */}
              {user && isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 glass-dropdown rounded-2xl py-2 z-50 animate-fade-in">
                  <div className="px-4 py-2.5 border-b border-slate-100">
                    <p className="text-xs text-slate-400 font-medium">Signed in as</p>
                    <p className="text-sm font-bold text-slate-900 truncate">{user.name}</p>
                    <p className="text-xs text-slate-500 truncate">{user.email}</p>
                  </div>
                  <Link
                    to="/orders"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-brand-50 hover:text-brand-700 transition-colors"
                  >
                    <Package className="w-4 h-4 text-slate-400" />
                    My Orders
                  </Link>
                  <Link
                    to="/subscriptions"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-brand-50 hover:text-brand-700 transition-colors"
                  >
                    <Calendar className="w-4 h-4 text-emerald-600" />
                    <span>My Subscriptions</span>
                  </Link>
                  <Link
                    to="/wallet"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-brand-50 hover:text-brand-700 transition-colors"
                  >
                    <Wallet className="w-4 h-4 text-brand-600" />
                    <span>Wallet &amp; Loyalty (₹250)</span>
                  </Link>
                  <Link
                    to="/profile"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-brand-50 hover:text-brand-700 transition-colors"
                  >
                    <User className="w-4 h-4 text-slate-400" />
                    Profile & Addresses
                  </Link>
                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      showLogoutConfirm(() => {
                        logout();
                        showLogoutSuccess(false, () => {
                          navigate('/');
                        });
                      });
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 transition-colors border-t border-slate-100 mt-1 cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>

            {/* Cart Button with Counter */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 active:scale-95 text-white px-4 py-2.5 rounded-xl font-semibold shadow-md shadow-brand-600/25 transition-all"
            >
              <div className="relative">
                <ShoppingBag className="w-5 h-5" />
                {itemCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-amber-400 text-slate-950 text-[10px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center border-2 border-brand-600 shadow-sm animate-pulse">
                    {itemCount}
                  </span>
                )}
              </div>
              <span className="hidden sm:inline text-sm">Cart</span>
            </button>

            {/* Mobile menu toggle */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Search */}
        <div className="md:hidden pb-3">
          <form onSubmit={handleSearchSubmit}>
            <div className="relative">
              <input
                type="text"
                placeholder="Search fresh vegetables..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>
          </form>
        </div>

        {/* Category bar */}
        <div className="hidden md:flex items-center gap-6 py-2.5 border-t border-slate-100 text-xs font-semibold text-slate-600 overflow-x-auto">
          <Link to="/products" className="text-brand-700 hover:text-brand-800 flex items-center gap-1 font-bold whitespace-nowrap">
            All Products
          </Link>
          {categories.map((cat) => (
            <Link
              key={cat.id}
              to={`/products?category=${cat.slug}`}
              className="hover:text-brand-600 whitespace-nowrap transition-colors"
            >
              {cat.name}
            </Link>
          ))}
          <Link to="/subscriptions" className="text-emerald-700 hover:text-emerald-800 font-bold whitespace-nowrap flex items-center gap-1">
            🥬 Subscribe &amp; Save (10% OFF)
          </Link>
          <Link to="/products?in_stock=true" className="text-amber-700 hover:text-amber-800 ml-auto flex items-center gap-1 whitespace-nowrap">
            🔥 Daily Deals
          </Link>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm transition-opacity animate-fade-in flex flex-col justify-end">
          <div className="bg-white rounded-t-3xl max-h-[85vh] overflow-y-auto p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <img
                  src="/logo.png"
                  alt="Fresh Vegetables Logo"
                  className="w-12 h-12 rounded-full object-cover ring-2 ring-brand-500/30 shadow-md"
                />
                <div>
                  <h3 className="font-extrabold text-lg text-slate-900 leading-tight">
                    Fresh<span className="text-brand-600">Vegetables</span>
                  </h3>
                  <p className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    100% Certified Organic
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
                aria-label="Close menu"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Quick Links */}
            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Categories & Explore</p>
              <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
                <Link
                  to="/products"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-3 bg-brand-50 text-brand-900 rounded-xl hover:bg-brand-100 transition-colors"
                >
                  🥦 All Products
                </Link>
                <Link
                  to="/subscriptions"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-3 bg-emerald-50 text-emerald-900 rounded-xl hover:bg-emerald-100 transition-colors"
                >
                  📅 Subscriptions
                </Link>
                {categories.map((cat) => (
                  <Link
                    key={cat.id}
                    to={`/products?category=${cat.slug}`}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-3 bg-slate-50 text-slate-700 rounded-xl hover:bg-slate-100 transition-colors truncate"
                  >
                    {cat.name}
                  </Link>
                ))}
              </div>
            </div>

            {/* Account section */}
            <div className="border-t border-slate-100 pt-4 space-y-3">
              {user ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl">
                    <div className="w-10 h-10 rounded-full bg-brand-500 text-slate-950 font-bold flex items-center justify-center text-sm">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-sm text-slate-900">{user.name}</p>
                      <p className="text-xs text-slate-500">{user.email}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                    <Link
                      to="/orders"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="p-3 bg-slate-50 hover:bg-slate-100 rounded-xl text-slate-700 flex items-center gap-2"
                    >
                      <Package className="w-4 h-4 text-brand-600" /> My Orders
                    </Link>
                    <Link
                      to="/wallet"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="p-3 bg-slate-50 hover:bg-slate-100 rounded-xl text-slate-700 flex items-center gap-2"
                    >
                      <Wallet className="w-4 h-4 text-emerald-600" /> Wallet
                    </Link>
                    <button
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        showLogoutConfirm(() => {
                          logout();
                          showLogoutSuccess(false, () => {
                            navigate('/');
                          });
                        });
                      }}
                      className="p-3 bg-rose-50 hover:bg-rose-100 rounded-xl text-rose-700 flex items-center justify-center gap-2 col-span-2 cursor-pointer font-bold transition-colors"
                    >
                      <LogOut className="w-4 h-4" /> Sign Out
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Link
                    to="/login"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex-1 text-center py-3 bg-brand-600 text-white rounded-xl font-bold text-sm shadow-md shadow-brand-600/20"
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex-1 text-center py-3 bg-slate-100 text-slate-800 rounded-xl font-bold text-sm hover:bg-slate-200"
                  >
                    Create Account
                  </Link>
                </div>
              )}

              <div className="pt-2">
                <Link
                  to="/admin/login"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-800 py-2"
                >
                  <ShieldAlert className="w-4 h-4 text-amber-500" />
                  Admin Operations Portal
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      <LocationSelectorModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        onZoneSelected={(zone) => setCurrentZone(zone)}
      />
    </header>
  );
};
export default Header;
