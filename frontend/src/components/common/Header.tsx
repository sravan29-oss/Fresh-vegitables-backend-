import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  ShoppingBag,
  Search,
  User,
  LogOut,
  Package,
  MapPin,
  Menu,
  X,
  ShieldAlert,
  Bell,
  Check,
  Wallet,
  ChevronDown,
  Phone,
  Clock,
  Flame,
  ShieldCheck,
  Sparkles,
  Leaf,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import api from '../../services/api';
import { Category, Notification, DeliveryZone } from '../../types';
import { LocationSelectorModal } from './LocationSelectorModal';
import { useNotifications } from '../../context/NotificationContext';

const DYNAMIC_PLACEHOLDERS = [
  'Search "organic spinach, tomatoes, broccoli..."',
  'Search "fresh methi, coriander, mint & herbs..."',
  'Search "crunchy capsicum, cucumbers, zucchini..."',
  'Search "farm potatoes, red onions & ginger..."',
  'Search "daily sunrise harvest & green veggies..."',
];

export const Header: React.FC = () => {
  const { user, logout, showLogoutConfirm, showLogoutSuccess } = useAuth();
  const { itemCount, setIsCartOpen } = useCart();
  const navigate = useNavigate();
  const location = useLocation();

  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Dynamic rotating search placeholder with smooth timing
  useEffect(() => {
    const timer = setInterval(() => {
      setPlaceholderIdx((prev) => (prev + 1) % DYNAMIC_PLACEHOLDERS.length);
    }, 3800);
    return () => clearInterval(timer);
  }, []);

  // Store Support & Contact Settings (Admin configurable)
  const [storeSettings, setStoreSettings] = useState<{
    support_phone?: string;
    announcement_text?: string;
    quality_badge?: string;
  }>({
    support_phone: '+91 8106970384',
    announcement_text: 'Same-Day Farm Delivery for orders placed before 2:00 PM',
    quality_badge: '100% Genuine Certified Organic Harvest',
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

  // Location & Delivery Zone selector state
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [currentZone, setCurrentZone] = useState<DeliveryZone | null>(() => {
    const saved = localStorage.getItem('fresh_delivery_zone');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return {
      id: 'zone-kphb',
      name: 'Kukatpally & KPHB Zone',
      pincodes: ['500072'],
      delivery_radius_km: 8.5,
      delivery_fee: 20,
      min_order_amount: 199,
      free_delivery_threshold: 499,
      estimated_delivery_time: '25–35 mins',
      status: 'ACTIVE',
    };
  });

  // Selected Delivery Area or Colony Display Name (Persisted & Synced)
  const [displayLocationName, setDisplayLocationName] = useState<string>(() => {
    const savedColony = localStorage.getItem('fresh_delivery_colony');
    if (savedColony && savedColony.trim()) return savedColony;
    const savedAddr = localStorage.getItem('fresh_delivery_address');
    if (savedAddr && savedAddr.trim()) return savedAddr.split(',')[0].trim();
    const savedZone = localStorage.getItem('fresh_delivery_zone');
    if (savedZone) {
      try {
        const p = JSON.parse(savedZone);
        if (p?.name) return p.name;
      } catch {}
    }
    return 'KPHB Colony Phase 1';
  });

  // Notification state connected to Global NotificationContext
  const { notifications, unreadCount, markAllAsRead, markAsRead } = useNotifications();
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get('/categories')
      .then((res) => {
        if (res.data?.data) setCategories(res.data.data.slice(0, 6));
      })
      .catch(() => {});

    // Listen for live location changes dispatched by LocationSelectorModal or Profile addresses
    const handleLocationChanged = (e: any) => {
      const { zone, colony, address } = e.detail || {};
      if (zone) setCurrentZone(zone);
      if (colony) setDisplayLocationName(colony);
      else if (address) setDisplayLocationName(address.split(',')[0].trim());
      else if (zone?.name) setDisplayLocationName(zone.name);
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'fresh_delivery_colony' && e.newValue) {
        setDisplayLocationName(e.newValue);
      }
      if (e.key === 'fresh_delivery_zone' && e.newValue) {
        try { setCurrentZone(JSON.parse(e.newValue)); } catch {}
      }
    };

    window.addEventListener('fresh_delivery_location_changed', handleLocationChanged);
    window.addEventListener('storage', handleStorageChange);

    // If logged in user has a saved default address, fetch and sync
    const token = localStorage.getItem('token');
    if (token) {
      api.get('/addresses')
        .then((res) => {
          if (res.data?.data && res.data.data.length > 0) {
            const defaultAddr = res.data.data.find((a: any) => a.is_default) || res.data.data[0];
            if (defaultAddr) {
              const locName = defaultAddr.area || defaultAddr.street || defaultAddr.city;
              if (locName) {
                setDisplayLocationName(locName);
                localStorage.setItem('fresh_delivery_colony', locName);
              }
            }
          }
        })
        .catch(() => {});
    }

    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotifOpen(false);
      }
    };
    const handleOpenLoc = () => setIsLocationModalOpen(true);
    window.addEventListener('fresh_open_location_modal', handleOpenLoc);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('fresh_delivery_location_changed', handleLocationChanged);
      window.removeEventListener('fresh_open_location_modal', handleOpenLoc);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [user]);

  const handleNotificationClick = async (notif: Notification) => {
    try {
      if (!notif.is_read) {
        await markAsRead(notif.id);
      }
      setIsNotifOpen(false);
      if (notif.reference_type === 'order') {
        const refId = notif.reference_id && notif.reference_id !== 'undefined' ? notif.reference_id : null;
        if (refId) {
          navigate(`/orders/${refId}/track`);
        } else {
          navigate('/orders');
        }
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
    <header className="sticky top-0 z-40 bg-white/98 backdrop-blur-md border-b border-slate-200 shadow-sm transition-all duration-300 w-full max-w-[100vw] overflow-x-hidden">
      {/* ─── Top Announcement Bar (Vibrant Quick-Commerce Green) ─── */}
      <div className="bg-[#0c831f] text-white text-[11px] font-medium h-7.5 sm:h-8.5 flex items-center overflow-hidden w-full">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 w-full flex items-center justify-between gap-3 min-w-0">
          
          {/* Left: Dispatch Radar & Rotating Live Status */}
          <div className="flex items-center gap-2 min-w-0">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
            </span>
            <span className="px-1.5 py-0.5 rounded text-[8.5px] sm:text-[9px] font-black uppercase tracking-wider bg-white/20 text-white shrink-0">
              ⚡ 15-MIN DISPATCH
            </span>
            <span className="truncate text-white font-bold tracking-wide text-[11px] sm:text-[11.5px]">
              {storeSettings.announcement_text || 'Same-Day Farm Delivery for orders placed before 2:00 PM'}
            </span>
          </div>

          {/* Right: Quality Certification & Support (Desktop only) */}
          <div className="flex items-center gap-4 shrink-0 hidden sm:flex text-emerald-100">
            <div className="flex items-center gap-1.5 text-xs text-white font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-200 shrink-0" />
              <span>{storeSettings.quality_badge || '100% Residue-Free & Certified Organic'}</span>
            </div>

            <span className="text-emerald-300 font-bold">•</span>

            <a
              href={`tel:${(storeSettings.support_phone || '+91 8106970384').replace(/[\s-]/g, '')}`}
              className="group flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/15 hover:bg-white/25 text-white transition-all text-[11px] font-bold cursor-pointer"
              title="Call Dedicated Customer Support"
            >
              <Phone className="w-3 h-3 text-white group-hover:scale-110 transition-transform" />
              <span>Support: {storeSettings.support_phone || '+91 8106970384'}</span>
            </a>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          MOBILE NAVBAR (< md: Phone / Small Screens) - Zepto/Blinkit Native App Style
          ═══════════════════════════════════════════════════════════════════════ */}
      <div className="md:hidden w-full px-3 pt-2 pb-2">
        {/* Row 1: Brand & Location (Left) + Notification & Quick Cart / Profile (Right) */}
        <div className="flex items-center justify-between gap-2 h-12 w-full">
          
          {/* Left: Brand Icon + Delivery Time & Location Stack */}
          <div className="flex items-center gap-2 min-w-0">
            <Link to="/" className="shrink-0 flex items-center">
              <img
                src="/logo.png"
                alt="Fresh Vegetables"
                className="w-9 h-9 rounded-xl object-cover ring-1 ring-emerald-500/20 shadow-xs"
              />
            </Link>

            <button
              type="button"
              onClick={() => setIsLocationModalOpen(true)}
              className="flex flex-col text-left justify-center cursor-pointer min-w-0 pr-1 group"
              title="Change delivery location"
            >
              <span className="text-[10px] font-black uppercase text-[#0c831f] flex items-center gap-1 leading-none tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-[#0c831f] animate-pulse"></span>
                <span>15 MINS DELIVERY</span>
              </span>
              <span className="text-xs font-black text-slate-900 truncate max-w-[155px] xs:max-w-[200px] flex items-center gap-0.5 mt-0.5 leading-tight group-hover:text-[#0c831f] transition-colors">
                <span className="truncate">{displayLocationName}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 group-hover:translate-y-0.5 transition-transform" />
              </span>
            </button>
          </div>

          {/* Right: Notification Bell + Profile Avatar + Quick Cart */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Notification Bell */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                className="w-8.5 h-8.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 border border-slate-200/80 text-slate-700 flex items-center justify-center transition-all cursor-pointer relative"
                title="Notifications"
                aria-label="Notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-[9px] font-black min-w-[16px] h-[16px] px-1 rounded-full flex items-center justify-center ring-2 ring-white shadow-xs">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Mobile Notification Dropdown */}
              {isNotifOpen && (
                <div
                  className="fixed right-2 top-20 w-[calc(100vw-16px)] max-w-sm rounded-2xl z-[80] animate-fade-in shadow-2xl border border-slate-200 bg-white overflow-hidden"
                >
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-slate-900 text-sm">Notifications</span>
                      {unreadCount > 0 && (
                        <span className="text-[10px] font-black bg-emerald-100 text-[#0c831f] border border-emerald-200 px-2 py-0.5 rounded-full">
                          {unreadCount} new
                        </span>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllAsRead}
                        className="text-[11px] font-bold text-[#0c831f] hover:text-[#0a701a] flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-emerald-50 transition-colors cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" /> Mark all read
                      </button>
                    )}
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 bg-white">
                    {notifications.length === 0 ? (
                      <div className="py-10 text-center text-xs text-slate-500 bg-white">
                        <Bell className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="font-semibold text-slate-700">No notifications yet</p>
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => handleNotificationClick(n)}
                          className={`p-3.5 cursor-pointer transition-colors text-xs ${
                            !n.is_read
                              ? 'bg-emerald-50/60 hover:bg-emerald-50 border-l-4 border-[#0c831f]'
                              : 'bg-white hover:bg-slate-50 border-l-4 border-transparent'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-extrabold text-slate-900 text-[13px] leading-snug">
                              {n.title}
                            </p>
                            {!n.is_read && (
                              <span className="w-2 h-2 rounded-full bg-[#0c831f] shrink-0 mt-1"></span>
                            )}
                          </div>
                          <p className="text-slate-600 text-xs mt-1 leading-relaxed font-normal">
                            {n.message}
                          </p>
                          <div className="flex items-center gap-1.5 text-[10.5px] text-[#0c831f] font-semibold mt-1.5">
                            <Clock className="w-3 h-3 text-[#0c831f]" />
                            <span>{new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Profile Avatar / Sign In */}
            {user ? (
              <Link
                to="/profile"
                className="w-8.5 h-8.5 rounded-xl bg-[#0c831f] text-white font-black text-xs flex items-center justify-center shadow-xs ring-1 ring-emerald-600/30 shrink-0"
                title="Profile & Orders"
              >
                {user.name.charAt(0).toUpperCase()}
              </Link>
            ) : (
              <Link
                to="/login"
                className="w-8.5 h-8.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200/80 text-slate-700 flex items-center justify-center transition-all shrink-0"
                title="Sign In"
              >
                <User className="w-4 h-4" />
              </Link>
            )}

            {/* Cart Pill (Zepto/Blinkit Green Pill) */}
            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className="h-8.5 px-2.5 rounded-xl bg-[#0c831f] active:bg-[#0a701a] text-white font-extrabold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0"
              title="View Cart"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>{itemCount}</span>
            </button>
          </div>
        </div>

        {/* Row 2: Mobile Search Input */}
        <div className="pt-1.5 w-full">
          <form onSubmit={handleSearchSubmit} className="w-full">
            <div className="relative flex items-center w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder={DYNAMIC_PLACEHOLDERS[placeholderIdx]}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 pl-9 pr-8 text-xs bg-slate-100 hover:bg-slate-50 focus:bg-white border border-slate-200 focus:border-[#0c831f] focus:ring-1 focus:ring-emerald-500 rounded-xl text-slate-900 placeholder:text-slate-400 font-medium transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-700 rounded-full cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          DESKTOP NAVBAR (>= md: Tablets & Laptops) - Expansive Commercial Header
          ═══════════════════════════════════════════════════════════════════════ */}
      <div className="hidden md:block max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20 gap-3 md:gap-5">
          
          {/* Brand Logo & Wordmark */}
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <Link to="/" className="flex items-center gap-2 sm:gap-3 group">
              <div className="relative">
                <img
                  src="/logo.png"
                  alt="Fresh Vegetables Logo"
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl object-cover ring-1 ring-slate-200 shadow-sm group-hover:scale-105 transition-all duration-300"
                />
                <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-[#0c831f] border-2 border-white flex items-center justify-center">
                  <Leaf className="w-2 h-2 sm:w-2.5 sm:h-2.5 text-white" />
                </span>
              </div>

              <div className="flex flex-col justify-center leading-none">
                <span className="text-lg sm:text-2xl lg:text-[26px] font-black tracking-tight text-slate-900 group-hover:text-emerald-800 transition-colors">
                  Fresh<span className="text-[#0c831f]">Vegetables</span>
                </span>
                <div className="flex text-[9.5px] font-extrabold uppercase tracking-[0.14em] text-slate-500 mt-1 items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#0c831f] animate-pulse"></span>
                  <span>⚡ 15 MINS QUICK COMMERCE • 100% ORGANIC</span>
                </div>
              </div>
            </Link>
          </div>

          {/* Location & Express Zone Capsule */}
          <button
            onClick={() => setIsLocationModalOpen(true)}
            className="flex items-center h-10 px-3 rounded-xl bg-slate-100 hover:bg-slate-200/80 border border-slate-200/80 text-slate-800 transition-all duration-200 cursor-pointer group text-left shrink-0"
            title="Click to switch delivery zone or address"
          >
            <div className="w-6 h-6 rounded-lg bg-emerald-100 border border-emerald-200 flex items-center justify-center shrink-0 mr-2 text-[#0c831f] group-hover:scale-110 transition-transform">
              <MapPin className="w-3.5 h-3.5" />
            </div>
            <div className="flex flex-col justify-center leading-tight">
              <div className="flex items-center gap-1.5">
                <span className="text-[8.5px] font-black uppercase tracking-[0.14em] text-slate-500">DELIVERING TO</span>
                <span className="text-[9.5px] bg-emerald-100 text-[#0c831f] font-black px-1.5 py-0.2 rounded-full border border-emerald-200">
                  ₹{currentZone?.delivery_fee || 20}
                </span>
              </div>
              <div className="font-bold text-slate-900 group-hover:text-[#0c831f] transition-colors text-xs flex items-center gap-1.5 mt-0.5">
                <span className="truncate max-w-[145px] font-extrabold" title={displayLocationName}>
                  {displayLocationName}
                </span>
                <span className="text-slate-400">•</span>
                <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1 shrink-0">
                  <Clock className="w-3 h-3 text-[#0c831f]" />
                  {currentZone?.estimated_delivery_time || '25–35 mins'}
                </span>
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700 group-hover:translate-y-0.5 transition-all ml-1.5 shrink-0" />
          </button>

          {/* Center Search Input */}
          <form onSubmit={handleSearchSubmit} className="flex-1 max-w-xl mx-2 lg:mx-4">
            <div className="relative flex items-center w-full">
              <button
                type="submit"
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#0c831f] transition-colors cursor-pointer p-0.5 rounded-md"
                title="Search"
              >
                <Search className="w-4.5 h-4.5" />
              </button>
              
              <input
                type="text"
                placeholder={DYNAMIC_PLACEHOLDERS[placeholderIdx]}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-10 pr-10 text-xs sm:text-sm bg-slate-100 hover:bg-slate-50 focus:bg-white border border-slate-200 focus:border-[#0c831f] focus:ring-2 focus:ring-emerald-500/20 rounded-xl transition-all text-slate-900 placeholder:text-slate-400 font-medium"
              />
              
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-200 transition-colors cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </form>

          {/* Right Action Bar (Bell, User, Cart) */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            
            {/* Desktop Notification Bell */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200/80 border border-slate-200/80 text-slate-700 hover:text-slate-900 flex items-center justify-center transition-all duration-200 group cursor-pointer relative"
                title="Notifications"
              >
                <Bell className="w-4.5 h-4.5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-[9px] font-black min-w-[17px] h-[17px] px-1 rounded-full flex items-center justify-center ring-2 ring-white shadow-xs">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Crisp White Notifications Dropdown */}
              {isNotifOpen && (
                <div
                  className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl z-[70] animate-fade-in shadow-2xl border border-slate-200 bg-white overflow-hidden"
                >
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-slate-900 text-sm">Notifications</span>
                      {unreadCount > 0 && (
                        <span className="text-[10px] font-black bg-emerald-100 text-[#0c831f] border border-emerald-200 px-2 py-0.5 rounded-full">
                          {unreadCount} new
                        </span>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllAsRead}
                        className="text-[11px] font-bold text-[#0c831f] hover:text-[#0a701a] flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-emerald-50 transition-colors cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" /> Mark all read
                      </button>
                    )}
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 bg-white">
                    {notifications.length === 0 ? (
                      <div className="py-10 text-center text-xs text-slate-500 bg-white">
                        <Bell className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="font-semibold text-slate-700">No notifications yet</p>
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => handleNotificationClick(n)}
                          className={`p-3.5 cursor-pointer transition-colors text-xs ${
                            !n.is_read
                              ? 'bg-emerald-50/60 hover:bg-emerald-50 border-l-4 border-[#0c831f]'
                              : 'bg-white hover:bg-slate-50 border-l-4 border-transparent'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-extrabold text-slate-900 text-[13px] leading-snug">
                              {n.title}
                            </p>
                            {!n.is_read && (
                              <span className="w-2 h-2 rounded-full bg-[#0c831f] shrink-0 mt-1"></span>
                            )}
                          </div>
                          <p className="text-slate-600 text-xs mt-1 leading-relaxed font-normal">
                            {n.message}
                          </p>
                          <div className="flex items-center gap-1.5 text-[10.5px] text-[#0c831f] font-semibold mt-1.5">
                            <Clock className="w-3 h-3 text-[#0c831f]" />
                            <span>{new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Desktop User Account / Sign In */}
            <div className="relative" ref={userMenuRef}>
              {user ? (
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="h-10 flex items-center gap-1.5 pl-2 pr-3 rounded-xl bg-slate-100 hover:bg-slate-200/80 border border-slate-200/80 text-slate-900 transition-all cursor-pointer group"
                  title="Account"
                >
                  <div className="w-7 h-7 rounded-lg bg-[#0c831f] text-white font-black text-xs flex items-center justify-center shadow-xs shrink-0 ring-1 ring-emerald-600/30">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex flex-col text-left leading-none">
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-wider">Account</span>
                    <span className="text-xs font-extrabold text-slate-900 group-hover:text-[#0c831f] truncate max-w-[85px] mt-0.5">
                      {user.name.split(' ')[0]}
                    </span>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700 group-hover:translate-y-0.5 transition-all inline shrink-0 ml-0.5" />
                </button>
              ) : (
                <Link
                  to="/login"
                  className="h-10 flex items-center gap-1.5 px-3.5 text-xs font-bold text-slate-800 hover:text-slate-950 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition-all"
                  title="Sign In"
                >
                  <User className="w-4 h-4 text-slate-600 shrink-0" />
                  <span>Sign In</span>
                </Link>
              )}

              {/* Crisp White User Dropdown Menu */}
              {user && isUserMenuOpen && (
                <div
                  className="absolute right-0 mt-2 w-60 rounded-2xl z-[70] animate-fade-in shadow-2xl border border-slate-200 bg-white overflow-hidden"
                >
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                    <p className="text-[8.5px] text-slate-500 font-black uppercase tracking-wider">Signed in as</p>
                    <p className="text-sm font-extrabold text-slate-900 truncate">{user.name}</p>
                    <p className="text-xs text-slate-500 truncate">{user.email}</p>
                  </div>
                  <div className="py-1.5 space-y-0.5 bg-white">
                    <Link
                      to="/orders"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-xs font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                    >
                      <Package className="w-4 h-4 text-[#0c831f]" />
                      <span>My Orders</span>
                    </Link>
                    <Link
                      to="/wallet"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="flex items-center justify-between px-4 py-2 text-xs font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <Wallet className="w-4 h-4 text-amber-600" />
                        <span>Wallet &amp; Credits</span>
                      </div>
                      <span className="text-[10px] bg-amber-100 text-amber-800 font-extrabold px-1.5 py-0.5 rounded border border-amber-200">
                        ₹250
                      </span>
                    </Link>
                    <Link
                      to="/profile"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-xs font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                    >
                      <User className="w-4 h-4 text-[#0c831f]" />
                      <span>Profile &amp; Addresses</span>
                    </Link>
                  </div>
                  <div className="border-t border-slate-100 pt-1 bg-white">
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
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 text-rose-500" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Desktop Cart Button */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="h-10 px-4 rounded-xl bg-[#0c831f] hover:bg-[#0a701a] text-white font-extrabold text-sm flex items-center gap-2.5 shadow-sm hover:shadow-md transition-all duration-200 active:scale-95 cursor-pointer shrink-0"
              title="View Cart & Checkout"
            >
              <div className="relative flex items-center justify-center">
                <ShoppingBag className="w-4 h-4" />
                {itemCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-white text-[#0c831f] text-[9px] font-black min-w-[17px] h-[17px] px-0.5 rounded-full flex items-center justify-center ring-2 ring-[#0c831f] shadow-xs">
                    {itemCount}
                  </span>
                )}
              </div>
              <span className="tracking-wider uppercase font-black text-[11px]">My Cart</span>
            </button>
          </div>
        </div>

        {/* ─── Desktop Sub-Navigation Rail (Clean Categories) ─── */}
        <div className="flex items-center gap-2 py-2.5 border-t border-slate-100 text-xs font-bold overflow-x-auto scrollbar-none">
          <Link
            to="/products"
            className={`px-3.5 py-1.5 rounded-lg transition-all duration-200 whitespace-nowrap flex items-center gap-1.5 ${
              location.pathname === '/products' && !location.search
                ? 'bg-emerald-50 text-[#0c831f] border border-emerald-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-[#0c831f]" />
            <span>All Vegetables</span>
          </Link>

          {categories.map((cat) => {
            const isCatActive = location.search.includes(`category=${cat.slug}`);
            return (
              <Link
                key={cat.id}
                to={`/products?category=${cat.slug}`}
                className={`px-3 py-1.5 rounded-lg transition-all duration-200 whitespace-nowrap ${
                  isCatActive
                    ? 'bg-emerald-50 text-[#0c831f] border border-emerald-200 font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent'
                }`}
              >
                {cat.name}
              </Link>
            );
          })}

          <Link
            to="/products?in_stock=true"
            className="px-3.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-black whitespace-nowrap transition-all ml-auto flex items-center gap-1.5 shadow-xs"
          >
            <Flame className="w-3.5 h-3.5 text-amber-600" />
            <span>Daily Deals</span>
          </Link>

          <div className="hidden xl:flex items-center gap-2 pl-3 ml-2 border-l border-slate-200 text-[11px] font-bold text-slate-500">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0c831f]"></span>
            <span>Harvested Fresh Today • Zero Cold Storage</span>
          </div>
        </div>
      </div>

      {/* ─── Mobile Drawer Menu ─── */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs transition-opacity animate-fade-in flex flex-col justify-end">
          <div className="bg-white border-t border-slate-200 rounded-t-3xl max-h-[85vh] overflow-y-auto p-6 space-y-6 shadow-2xl text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div className="flex items-center gap-3">
                <img
                  src="/logo.png"
                  alt="Fresh Vegetables Logo"
                  className="w-11 h-11 rounded-xl object-cover ring-1 ring-slate-200"
                />
                <div>
                  <h3 className="font-black text-base text-slate-900 leading-tight">
                    Fresh<span className="text-[#0c831f]">Vegetables</span>
                  </h3>
                  <p className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#0c831f]"></span>
                    ⚡ 15 MINS QUICK COMMERCE • 100% ORGANIC
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100 transition-colors"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Delivery Zone Capsule for Mobile */}
            <div
              onClick={() => {
                setIsMobileMenuOpen(false);
                setIsLocationModalOpen(true);
              }}
              className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <MapPin className="w-4 h-4 text-[#0c831f]" />
                <div>
                  <p className="text-[9px] font-black uppercase tracking-wider text-slate-500">Delivery Zone</p>
                  <p className="text-xs font-bold text-slate-900">{currentZone ? currentZone.name : 'Select Zone'}</p>
                </div>
              </div>
              <span className="text-xs font-extrabold text-[#0c831f]">Change</span>
            </div>

            {/* Quick Links */}
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Produce Categories</p>
              <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                <Link
                  to="/products"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-3 bg-emerald-50 text-[#0c831f] border border-emerald-200 rounded-xl hover:bg-emerald-100 transition-colors font-bold flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#0c831f]" />
                  <span>All Vegetables</span>
                </Link>
                <Link
                  to="/products?in_stock=true"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-3 bg-amber-50 text-amber-800 border border-amber-200 rounded-xl hover:bg-amber-100 transition-colors font-bold flex items-center gap-1.5"
                >
                  <Flame className="w-3.5 h-3.5 text-amber-600" />
                  <span>Daily Deals</span>
                </Link>
                {categories.map((cat) => (
                  <Link
                    key={cat.id}
                    to={`/products?category=${cat.slug}`}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-3 bg-slate-50 text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors truncate"
                  >
                    {cat.name}
                  </Link>
                ))}
              </div>
            </div>

            {/* Account section */}
            <div className="border-t border-slate-200 pt-4 space-y-3">
              {user ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200">
                    <div className="w-9 h-9 rounded-lg bg-[#0c831f] text-white font-black flex items-center justify-center text-xs">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-extrabold text-sm text-slate-900">{user.name}</p>
                      <p className="text-xs text-slate-500">{user.email}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                    <Link
                      to="/orders"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="p-3 bg-slate-50 hover:bg-slate-100 rounded-xl text-slate-800 border border-slate-200 flex items-center gap-2"
                    >
                      <Package className="w-4 h-4 text-[#0c831f]" /> My Orders
                    </Link>
                    <Link
                      to="/wallet"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="p-3 bg-slate-50 hover:bg-slate-100 rounded-xl text-amber-800 border border-slate-200 flex items-center gap-2"
                    >
                      <Wallet className="w-4 h-4 text-amber-600" /> Wallet (₹250)
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
                      className="p-3 bg-rose-50 hover:bg-rose-100 rounded-xl text-rose-600 border border-rose-200 flex items-center justify-center gap-2 col-span-2 cursor-pointer font-bold transition-colors"
                    >
                      <LogOut className="w-4 h-4 text-rose-500" /> Sign Out
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Link
                    to="/login"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex-1 text-center py-2.5 bg-[#0c831f] hover:bg-[#0a701a] text-white rounded-xl font-bold text-xs shadow-xs"
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex-1 text-center py-2.5 bg-slate-50 text-slate-800 border border-slate-200 rounded-xl font-bold text-xs hover:bg-slate-100"
                  >
                    Create Account
                  </Link>
                </div>
              )}

              <div className="pt-2">
                <Link
                  to="/admin/login"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-800 py-2"
                >
                  <ShieldAlert className="w-4 h-4 text-amber-600" />
                  Admin Operations Portal
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Location & Delivery Zone Selector Modal */}
      <LocationSelectorModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        onZoneSelected={(zone, colony) => {
          setCurrentZone(zone);
          if (colony) setDisplayLocationName(colony);
          else if (zone?.name) setDisplayLocationName(zone.name);
        }}
      />
    </header>
  );
};

export default Header;
