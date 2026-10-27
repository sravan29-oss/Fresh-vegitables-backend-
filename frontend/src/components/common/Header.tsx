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
  'Search organic spinach, tomatoes, broccoli...',
  'Search fresh methi, coriander, mint & herbs...',
  'Search crunchy capsicum, cucumbers, zucchini...',
  'Search farm potatoes, red onions & ginger...',
  'Search daily sunrise harvest & green veggies...',
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
  }, []);

  const handleNotificationClick = async (notif: Notification) => {
    try {
      if (!notif.is_read) {
        await markAsRead(notif.id);
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
    <header className="sticky top-0 z-40 premium-glass-header transition-all duration-300">
      {/* ─── Top Executive Announcement Bar (Deep Forest Emerald + Gold/Champagne Accents) ─── */}
      <div className="bg-gradient-to-r from-[#03130a] via-[#062415] to-[#03130a] border-b border-emerald-500/20 text-emerald-200/90 text-[11px] font-medium h-9 flex items-center">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex items-center justify-between gap-4">
          
          {/* Left: Dispatch Radar & Rotating Live Status */}
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
            </span>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hidden xs:inline-flex">
              LIVE DISPATCH
            </span>
            <span className="truncate text-emerald-100 font-semibold tracking-wide text-[11.5px]">
              {storeSettings.announcement_text || 'Same-Day Farm Delivery for orders placed before 2:00 PM'}
            </span>
          </div>

          {/* Right: Quality Certification & Clickable Support Phone Capsule */}
          <div className="flex items-center gap-4 shrink-0 hidden sm:flex text-emerald-200/90">
            <div className="flex items-center gap-1.5 text-xs text-emerald-300/90 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>{storeSettings.quality_badge || '100% Residue-Free & Certified Organic'}</span>
            </div>

            <span className="text-emerald-700/60 font-bold">•</span>

            <a
              href={`tel:${(storeSettings.support_phone || '+91 8106970384').replace(/[\s-]/g, '')}`}
              className="group flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 text-emerald-200 hover:text-white transition-all text-[11px] font-bold cursor-pointer"
              title="Call Dedicated Customer Support"
            >
              <Phone className="w-3 h-3 text-emerald-400 group-hover:scale-110 transition-transform" />
              <span>Support: {storeSettings.support_phone || '+91 8106970384'}</span>
            </a>
          </div>
        </div>
      </div>

      {/* ─── Main Navigation Center (Polished Ultra-Luxury Glass) ─── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20 gap-3 md:gap-5">
          
          {/* Brand Logo & Luxury Wordmark */}
          <Link to="/" className="flex items-center gap-3.5 flex-shrink-0 group">
            <div className="relative">
              <img
                src="/logo.png"
                alt="Fresh Vegetables Organic Logo"
                className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl object-cover ring-2 ring-emerald-500/30 group-hover:ring-emerald-400/80 shadow-[0_0_20px_rgba(16,185,129,0.3)] group-hover:scale-105 transition-all duration-300"
              />
              <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#05180f] border-2 border-emerald-400 flex items-center justify-center">
                <Leaf className="w-2.5 h-2.5 text-emerald-400" />
              </span>
            </div>

            <div className="flex flex-col justify-center leading-none">
              <span className="text-2xl sm:text-[26px] font-black tracking-tight text-white group-hover:text-emerald-100 transition-colors">
                Fresh<span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-400 animate-text-gradient font-black">Vegetables</span>
              </span>
              <div className="text-[9.5px] font-extrabold uppercase tracking-[0.18em] text-emerald-400/90 mt-1 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>EST. 2026 • 100% GENUINE ORGANIC</span>
              </div>
            </div>
          </Link>

          {/* Location & Express Zone Capsule */}
          <button
            onClick={() => setIsLocationModalOpen(true)}
            className="hidden lg:flex items-center h-10 px-3 rounded-2xl premium-nav-capsule text-white transition-all duration-300 cursor-pointer group text-left shrink-0"
            title="Click to switch delivery zone or address"
          >
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0 mr-2 text-emerald-400 group-hover:scale-110 transition-transform">
              <MapPin className="w-3.5 h-3.5" />
            </div>
            <div className="flex flex-col justify-center leading-tight">
              <div className="flex items-center gap-1.5">
                <span className="text-[8.5px] font-black uppercase tracking-[0.14em] text-emerald-400/80">DELIVERING TO</span>
                <span className="text-[9.5px] bg-emerald-400/20 text-emerald-300 font-black px-1.5 py-0.2 rounded-full border border-emerald-400/30">
                  ₹{currentZone?.delivery_fee || 20}
                </span>
              </div>
              <div className="font-bold text-white group-hover:text-emerald-200 transition-colors text-xs flex items-center gap-1.5 mt-0.5">
                <span className="truncate max-w-[130px]">{currentZone ? currentZone.name : 'Select Zone'}</span>
                <span className="text-emerald-400/60">•</span>
                <span className="text-[10px] text-emerald-300/80 font-semibold flex items-center gap-1">
                  <Clock className="w-3 h-3 text-emerald-400" />
                  {currentZone?.estimated_delivery_time || '25–35 mins'}
                </span>
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-emerald-400/60 group-hover:text-emerald-300 group-hover:translate-y-0.5 transition-all ml-1.5 shrink-0" />
          </button>

          {/* Luxury Center Search Input (Clean, Spacious, Perfectly Aligned) */}
          <form onSubmit={handleSearchSubmit} className="flex-1 max-w-xl mx-2 lg:mx-4 hidden md:block">
            <div className="relative flex items-center w-full">
              <Search className="w-4 h-4 text-emerald-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              
              <input
                type="text"
                placeholder={DYNAMIC_PLACEHOLDERS[placeholderIdx]}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-10 pr-24 text-xs sm:text-sm bg-[#061f12]/80 hover:bg-[#072416] focus:bg-[#051c10] border border-emerald-500/30 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 rounded-full transition-all text-white placeholder:text-emerald-100/50 font-medium shadow-inner"
              />
              
              <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="p-1 text-emerald-400 hover:text-white rounded-full hover:bg-emerald-900/60 transition-colors cursor-pointer mr-0.5"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="submit"
                  className="h-7.5 px-3 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs shadow-sm flex items-center gap-1 transition-all cursor-pointer active:scale-95"
                  title="Search Catalog"
                >
                  <Search className="w-3 h-3 stroke-[2.5]" />
                  <span>Search</span>
                </button>
              </div>
            </div>
          </form>

          {/* Right Action Bar (Bell, User, Cart) */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            
            {/* Notification Bell */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                className="w-10 h-10 rounded-2xl premium-nav-capsule text-emerald-300 hover:text-white flex items-center justify-center transition-all duration-300 group cursor-pointer hover-bell-wiggle"
                title="Notifications"
              >
                <Bell className="w-4.5 h-4.5 bell-icon-anim" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-gradient-to-r from-rose-500 to-amber-500 text-white text-[9.5px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center ring-2 ring-[#05180f] shadow-md animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Luxury Notifications Dropdown - Solid, Opaque, High-Contrast */}
              {isNotifOpen && (
                <div
                  className="premium-dropdown absolute right-0 mt-2.5 w-80 sm:w-96 rounded-2xl z-[70] animate-fade-in shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9),0_0_20px_rgba(16,185,129,0.2)] overflow-hidden"
                  style={{ backgroundColor: '#091f14' }}
                >
                  <div className="px-4 py-3 bg-[#06160d] border-b border-emerald-500/20 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-white text-sm">Notifications</span>
                      {unreadCount > 0 && (
                        <span className="text-[10px] font-black bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full">
                          {unreadCount} new
                        </span>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllAsRead}
                        className="text-[11px] font-bold text-emerald-300 hover:text-white flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-emerald-500/20 transition-colors cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" /> Mark all read
                      </button>
                    )}
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-emerald-950/80 bg-[#091f14]">
                    {notifications.length === 0 ? (
                      <div className="py-10 text-center text-xs text-slate-300 bg-[#091f14]">
                        <Bell className="w-8 h-8 text-emerald-400/50 mx-auto mb-2" />
                        <p className="font-semibold text-slate-300">No notifications yet</p>
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => handleNotificationClick(n)}
                          className={`p-3.5 cursor-pointer transition-colors text-xs ${
                            !n.is_read
                              ? 'bg-[#102d1e] hover:bg-[#153b28] border-l-4 border-emerald-400'
                              : 'bg-[#091f14] hover:bg-[#0e2a1c] border-l-4 border-transparent'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-extrabold text-white text-[13px] leading-snug">
                              {n.title}
                            </p>
                            {!n.is_read && (
                              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 mt-1 shadow-[0_0_8px_rgba(52,211,153,1)]"></span>
                            )}
                          </div>
                          <p className="text-slate-200 text-xs mt-1 leading-relaxed font-normal">
                            {n.message}
                          </p>
                          <div className="flex items-center gap-1.5 text-[10.5px] text-emerald-400 font-semibold mt-1.5 font-mono">
                            <Clock className="w-3 h-3 text-emerald-400" />
                            <span>{new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Account / Sign In */}
            <div className="relative" ref={userMenuRef}>
              {user ? (
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="h-10 flex items-center gap-2.5 px-3 rounded-2xl premium-nav-capsule text-white transition-all cursor-pointer group"
                >
                  <div className="w-6.5 h-6.5 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-[#05180f] font-black text-xs flex items-center justify-center shadow-md ring-1 ring-emerald-300/40 shrink-0">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex flex-col text-left leading-none hidden sm:flex">
                    <span className="text-[8px] font-black text-emerald-400 uppercase tracking-wider">Account</span>
                    <span className="text-xs font-bold text-white group-hover:text-emerald-200 truncate max-w-[85px] mt-0.5">
                      {user.name.split(' ')[0]}
                    </span>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-emerald-400/60 group-hover:text-emerald-300 group-hover:translate-y-0.5 transition-all hidden sm:inline shrink-0" />
                </button>
              ) : (
                <Link
                  to="/login"
                  className="h-10 flex items-center gap-2 px-3.5 text-xs font-bold text-emerald-200 hover:text-white rounded-2xl premium-nav-capsule transition-all"
                >
                  <User className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="hidden sm:inline">Sign In</span>
                </Link>
              )}

              {/* Luxury User Dropdown Menu - Solid, Opaque */}
              {user && isUserMenuOpen && (
                <div
                  className="premium-dropdown absolute right-0 mt-2.5 w-60 rounded-2xl z-[70] animate-fade-in shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9),0_0_20px_rgba(16,185,129,0.2)] overflow-hidden"
                  style={{ backgroundColor: '#091f14' }}
                >
                  <div className="px-4 py-3 bg-[#06160d] border-b border-emerald-500/20">
                    <p className="text-[8.5px] text-emerald-400 font-black uppercase tracking-wider">Signed in as</p>
                    <p className="text-sm font-extrabold text-white truncate">{user.name}</p>
                    <p className="text-xs text-slate-300 truncate">{user.email}</p>
                  </div>
                  <div className="py-1.5 space-y-0.5 bg-[#091f14]">
                    <Link
                      to="/orders"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-xs font-bold text-slate-200 hover:text-white hover:bg-emerald-900/40 transition-colors"
                    >
                      <Package className="w-4 h-4 text-emerald-400" />
                      <span>My Orders</span>
                    </Link>
                    <Link
                      to="/wallet"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="flex items-center justify-between px-4 py-2 text-xs font-bold text-slate-200 hover:text-white hover:bg-emerald-900/40 transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <Wallet className="w-4 h-4 text-amber-400" />
                        <span>Wallet &amp; Credits</span>
                      </div>
                      <span className="text-[10px] bg-amber-400/20 text-amber-300 font-extrabold px-1.5 py-0.5 rounded border border-amber-400/30">
                        ₹250
                      </span>
                    </Link>
                    <Link
                      to="/profile"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-xs font-bold text-slate-200 hover:text-white hover:bg-emerald-900/40 transition-colors"
                    >
                      <User className="w-4 h-4 text-emerald-400" />
                      <span>Profile &amp; Addresses</span>
                    </Link>
                  </div>
                  <div className="border-t border-emerald-950/80 pt-1 bg-[#091f14]">
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
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-bold text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 transition-colors cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 text-rose-400" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Cart Button: The Opulent Emerald Centerpiece CTA */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="h-10 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 hover:from-emerald-400 hover:via-emerald-500 hover:to-teal-500 text-white font-black text-xs flex items-center gap-2.5 shadow-[0_4px_16px_rgba(16,185,129,0.35)] hover:shadow-[0_6px_22px_rgba(16,185,129,0.5)] transition-all duration-300 active:scale-95 cursor-pointer shrink-0"
              title="View Cart & Checkout"
            >
              <div className="relative flex items-center justify-center">
                <ShoppingBag className="w-4 h-4" />
                {itemCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-white text-emerald-950 text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center ring-2 ring-emerald-700 shadow-sm">
                    {itemCount}
                  </span>
                )}
              </div>
              <span className="hidden sm:inline tracking-wider uppercase font-black text-[11px]">Cart</span>
            </button>

            {/* Mobile menu toggle */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden w-10 h-10 flex items-center justify-center text-emerald-300 hover:text-white rounded-2xl premium-nav-capsule transition-colors cursor-pointer"
              aria-label="Toggle mobile menu"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Search Row (Themed with dark luxury styling) */}
        <div className="md:hidden pb-3.5">
          <form onSubmit={handleSearchSubmit}>
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-emerald-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder={DYNAMIC_PLACEHOLDERS[placeholderIdx]}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-10 pr-9 text-xs bg-[#062013]/70 border border-emerald-500/25 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-400 text-white placeholder:text-emerald-200/40"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-emerald-400 hover:text-white rounded-full"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </form>
        </div>

        {/* ─── Luxury Sub-Navigation Rail (Clean Categories, No Subscriptions) ─── */}
        <div className="hidden md:flex items-center gap-2 py-2.5 border-t border-emerald-500/15 text-xs font-bold overflow-x-auto scrollbar-none">
          <Link
            to="/products"
            className={`px-3.5 py-1.5 rounded-xl transition-all duration-300 whitespace-nowrap flex items-center gap-1.5 ${
              location.pathname === '/products' && !location.search
                ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-400/50 shadow-[0_0_12px_rgba(52,211,153,0.25)]'
                : 'text-emerald-200/80 hover:text-white hover:bg-emerald-500/15 border border-transparent'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>All Vegetables</span>
          </Link>

          {categories.map((cat) => {
            const isCatActive = location.search.includes(`category=${cat.slug}`);
            return (
              <Link
                key={cat.id}
                to={`/products?category=${cat.slug}`}
                className={`px-3 py-1.5 rounded-xl transition-all duration-300 whitespace-nowrap ${
                  isCatActive
                    ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-400/50 shadow-[0_0_12px_rgba(52,211,153,0.25)]'
                    : 'text-emerald-100/70 hover:text-white hover:bg-emerald-500/10 border border-transparent'
                }`}
              >
                {cat.name}
              </Link>
            );
          })}

          <Link
            to="/products?in_stock=true"
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 text-amber-300 hover:text-amber-200 border border-amber-500/40 font-black whitespace-nowrap transition-all ml-auto flex items-center gap-1.5 shadow-xs"
          >
            <Flame className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span>Daily Farm Deals</span>
          </Link>

          <div className="hidden xl:flex items-center gap-2 pl-3 ml-2 border-l border-emerald-500/20 text-[11px] font-bold text-emerald-400/80">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
            <span>Harvested Fresh Today • Zero Cold Storage</span>
          </div>
        </div>
      </div>

      {/* ─── Luxury Mobile Drawer Menu (No Subscriptions) ─── */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/70 backdrop-blur-md transition-opacity animate-fade-in flex flex-col justify-end">
          <div className="bg-[#051c11] border-t border-emerald-500/30 rounded-t-3xl max-h-[85vh] overflow-y-auto p-6 space-y-6 shadow-2xl text-white">
            <div className="flex items-center justify-between border-b border-emerald-500/20 pb-4">
              <div className="flex items-center gap-3">
                <img
                  src="/logo.png"
                  alt="Fresh Vegetables Logo"
                  className="w-11 h-11 rounded-2xl object-cover ring-2 ring-emerald-500/40"
                />
                <div>
                  <h3 className="font-black text-base text-white leading-tight">
                    Fresh<span className="text-emerald-400">Vegetables</span>
                  </h3>
                  <p className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    EST. 2026 • 100% Genuine Certified Organic
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 text-emerald-400 hover:text-white rounded-full hover:bg-emerald-900/60 transition-colors"
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
              className="p-3.5 bg-emerald-950/60 rounded-2xl border border-emerald-500/30 flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <MapPin className="w-4 h-4 text-emerald-400" />
                <div>
                  <p className="text-[9px] font-black uppercase tracking-wider text-emerald-400">Delivery Zone</p>
                  <p className="text-xs font-bold text-white">{currentZone ? currentZone.name : 'Select Zone'}</p>
                </div>
              </div>
              <span className="text-xs font-extrabold text-emerald-300">Change</span>
            </div>

            {/* Quick Links */}
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-wider text-emerald-400/80">Produce Categories</p>
              <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                <Link
                  to="/products"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-3 bg-emerald-500/20 text-emerald-200 border border-emerald-500/30 rounded-xl hover:bg-emerald-500/30 transition-colors font-bold flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  <span>All Vegetables</span>
                </Link>
                <Link
                  to="/products?in_stock=true"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-3 bg-amber-500/20 text-amber-200 border border-amber-500/30 rounded-xl hover:bg-amber-500/30 transition-colors font-bold flex items-center gap-1.5"
                >
                  <Flame className="w-3.5 h-3.5 text-amber-400" />
                  <span>Daily Deals</span>
                </Link>
                {categories.map((cat) => (
                  <Link
                    key={cat.id}
                    to={`/products?category=${cat.slug}`}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-3 bg-emerald-950/40 text-emerald-100/90 border border-emerald-500/15 rounded-xl hover:bg-emerald-900/40 transition-colors truncate"
                  >
                    {cat.name}
                  </Link>
                ))}
              </div>
            </div>

            {/* Account section */}
            <div className="border-t border-emerald-500/20 pt-4 space-y-3">
              {user ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-emerald-950/60 rounded-2xl border border-emerald-500/25">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-[#05180f] font-black flex items-center justify-center text-xs">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-extrabold text-sm text-white">{user.name}</p>
                      <p className="text-xs text-emerald-300/70">{user.email}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                    <Link
                      to="/orders"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="p-3 bg-emerald-950/40 hover:bg-emerald-900/60 rounded-xl text-emerald-200 border border-emerald-500/20 flex items-center gap-2"
                    >
                      <Package className="w-4 h-4 text-emerald-400" /> My Orders
                    </Link>
                    <Link
                      to="/wallet"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="p-3 bg-emerald-950/40 hover:bg-emerald-900/60 rounded-xl text-amber-200 border border-amber-500/20 flex items-center gap-2"
                    >
                      <Wallet className="w-4 h-4 text-amber-400" /> Wallet (₹250)
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
                      className="p-3 bg-rose-500/20 hover:bg-rose-500/30 rounded-xl text-rose-300 border border-rose-500/30 flex items-center justify-center gap-2 col-span-2 cursor-pointer font-bold transition-colors"
                    >
                      <LogOut className="w-4 h-4 text-rose-400" /> Sign Out
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Link
                    to="/login"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex-1 text-center py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-bold text-xs shadow-md"
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex-1 text-center py-2.5 bg-emerald-950/60 text-emerald-200 border border-emerald-500/30 rounded-xl font-bold text-xs hover:bg-emerald-900/60"
                  >
                    Create Account
                  </Link>
                </div>
              )}

              <div className="pt-2">
                <Link
                  to="/admin/login"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-2 text-xs font-semibold text-emerald-400/80 hover:text-white py-2"
                >
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
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
        onZoneSelected={(zone) => setCurrentZone(zone)}
      />
    </header>
  );
};

export default Header;
