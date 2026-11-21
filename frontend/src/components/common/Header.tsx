import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  ShoppingBag,
  Search,
  User,
  LogOut,
  Package,
  MapPin,
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
  const { itemCount, setIsCartOpen, serviceability, isLocationModalOpen, setIsLocationModalOpen, deliveryEstimate, deliverySettings } = useCart();
  const navigate = useNavigate();
  const location = useLocation();

  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [cartBounced, setCartBounced] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Pulse cart button when items are added
  useEffect(() => {
    if (itemCount > 0) {
      setCartBounced(true);
      const t = setTimeout(() => setCartBounced(false), 600);
      return () => clearTimeout(t);
    }
  }, [itemCount]);

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
    announcement_text: 'Same-Day Delivery within our serviceable areas in Hyderabad',
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
  const [currentZone, setCurrentZone] = useState<DeliveryZone | null>(() => {
    const saved = localStorage.getItem('fresh_delivery_zone');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return null;
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
    return '';
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
    <header className="sticky top-0 z-50 bg-cream-50/95 backdrop-blur-md border-b border-line shadow-soft transition-all duration-200 w-full safe-area-pt">
      {/* ─── Top Announcement Bar (Deep Forest Boutique Green) ─── */}
      <div className="bg-forest-900 text-cream-50 text-[11px] font-medium h-8 flex items-center overflow-hidden w-full border-b border-forest-800">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 w-full flex items-center justify-between gap-3 min-w-0">
          
          {/* Left: Dispatch Radar & Rotating Live Status */}
          <div className="flex items-center gap-2 min-w-0">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-leaf-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-leaf-500"></span>
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider shrink-0 ${
              deliveryEstimate.isPaused ? 'bg-marigold-500/20 text-marigold-400' : 'bg-forest-800 text-leaf-300'
            }`}>
              {deliveryEstimate.isPaused ? 'Deliveries Paused' : (deliveryEstimate.etaText ? `${deliveryEstimate.etaText} Dispatch` : 'Fresh Dispatch')}
            </span>
            <span className="truncate text-cream-50/90 font-medium text-[11px] sm:text-[11.5px]">
              {deliveryEstimate.isPaused
                ? (deliveryEstimate.statusMessage || 'Express delivery temporarily paused in your area')
                : (storeSettings.announcement_text || 'Same-Day Delivery within our serviceable areas in Hyderabad')}
            </span>
          </div>

          {/* Right: Quality Certification & Support (Desktop only) */}
          <div className="flex items-center gap-4 shrink-0 hidden sm:flex text-forest-200">
            <div className="flex items-center gap-1.5 text-xs text-cream-100 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-leaf-400 shrink-0" />
              <span>{storeSettings.quality_badge || '100% Genuine Certified Organic Harvest'}</span>
            </div>

            <span className="text-forest-700 font-bold">•</span>

            <a
              href={`tel:${(storeSettings.support_phone || '+91 8106970384').replace(/[\s-]/g, '')}`}
              className="group flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-forest-800/80 hover:bg-forest-700 text-cream-50 transition-colors text-[11px] font-semibold cursor-pointer"
              title="Call Dedicated Customer Support"
            >
              <Phone className="w-3 h-3 text-leaf-400 group-hover:scale-105 transition-transform" />
              <span>Support: {storeSettings.support_phone || '+91 8106970384'}</span>
            </a>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          MOBILE NAVBAR (< md: Phone / Small Screens) - Clean Boutique Mobile Header
          ═══════════════════════════════════════════════════════════════════════ */}
      <div className="md:hidden w-full px-3 pt-2.5 pb-2.5">
        {/* Row 1: Brand & Location (Left) + Notification & Quick Cart / Profile (Right) */}
        <div className="flex items-center justify-between gap-2 h-11 w-full">
          
          {/* Left: Brand Icon + Delivery Location Chip */}
          <div className="flex items-center gap-2 min-w-0">
            <Link to="/" className="shrink-0 flex items-center" aria-label="Fresh Vegetables Organic Home">
              <img
                src="/logo.png"
                alt="Fresh Vegetables Organic"
                className="w-9 h-9 rounded-xl object-cover border border-line shadow-soft"
              />
            </Link>

            {/* Location selector chip */}
            <button
              type="button"
              onClick={() => setIsLocationModalOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-2xl bg-surface border border-line hover:border-leaf-500 shadow-soft text-left cursor-pointer min-w-0 group transition-all duration-150 min-h-[44px]"
              title="Change delivery location"
              aria-label={displayLocationName ? `Delivery location: ${displayLocationName}` : 'Select delivery location'}
            >
              <div className="w-6 h-6 rounded-full bg-sage-100 flex items-center justify-center shrink-0 text-forest-700 group-hover:text-forest-900">
                <MapPin className="w-3.5 h-3.5" />
              </div>
              <div className="flex flex-col min-w-0 leading-tight">
                <div className="flex items-center gap-1 leading-none">
                  {displayLocationName && serviceability.checked ? (
                    serviceability.serviceable ? (
                      deliveryEstimate.isPaused ? (
                        <span className="text-[9px] font-bold uppercase text-marigold-600 flex items-center gap-1 tracking-wider">
                          <span className="w-1.5 h-1.5 rounded-full bg-marigold-500 animate-pulse"></span>
                          <span>DELIVERY PAUSED</span>
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold uppercase text-forest-700 flex items-center gap-1 tracking-wider truncate">
                          <span className="w-1.5 h-1.5 rounded-full bg-leaf-500 animate-pulse"></span>
                          <span>{serviceability.distanceKm !== undefined ? `${serviceability.distanceKm} KM • ${deliveryEstimate.etaText || 'Express'}` : (deliveryEstimate.etaText || 'Express')}</span>
                        </span>
                      )
                    ) : !serviceability.configured ? (
                      <span className="text-[9px] font-bold uppercase text-marigold-600 flex items-center gap-1 tracking-wider">
                        <span className="w-1.5 h-1.5 rounded-full bg-marigold-500"></span>
                        <span>CONFIGURING</span>
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold uppercase text-tomato-500 flex items-center gap-1 tracking-wider">
                        <span className="w-1.5 h-1.5 rounded-full bg-tomato-500"></span>
                        <span>OUTSIDE 5 KM ZONE</span>
                      </span>
                    )
                  ) : (
                    <span className="text-[9px] font-bold uppercase text-forest-700 flex items-center gap-1 tracking-wider">
                      <span className="w-1.5 h-1.5 rounded-full bg-leaf-500 animate-pulse"></span>
                      <span>SELECT LOCATION</span>
                    </span>
                  )}
                </div>
                <span className="text-xs font-semibold text-ink-900 truncate max-w-[120px] xs:max-w-[160px] flex items-center gap-0.5 mt-0.5">
                  <span className="truncate">{displayLocationName || 'Select Locality'}</span>
                  <ChevronDown className="w-3 h-3 text-ink-400 shrink-0 group-hover:translate-y-0.5 transition-transform" />
                </span>
              </div>
            </button>
          </div>

          {/* Right: Notification Bell + Profile Avatar + Quick Cart */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Notification Bell */}
            <div className="relative" ref={notifRef}>
              <button
                type="button"
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                className="w-10 h-10 rounded-full bg-surface border border-line text-ink-700 hover:text-forest-900 hover:border-leaf-500 flex items-center justify-center transition-colors cursor-pointer relative shadow-soft"
                title="Notifications"
                aria-label="Notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-tomato-500 text-white text-[9px] font-bold min-w-[16px] h-[16px] px-1 rounded-full flex items-center justify-center ring-2 ring-white shadow-soft">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Mobile Notification Dropdown */}
              {isNotifOpen && (
                <div
                  className="fixed right-3 top-24 w-[calc(100vw-24px)] max-w-sm rounded-2xl z-[80] animate-fade-in shadow-soft-lg border border-line bg-surface overflow-hidden"
                >
                  <div className="px-4 py-3 bg-cream-50 border-b border-line flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-serif font-bold text-ink-900 text-sm">Notifications</span>
                      {unreadCount > 0 && (
                        <span className="text-[10px] font-bold bg-sage-100 text-forest-900 border border-leaf-500/20 px-2 py-0.5 rounded-full">
                          {unreadCount} new
                        </span>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={markAllAsRead}
                        className="text-[11px] font-semibold text-forest-700 hover:text-forest-900 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-sage-100 transition-colors cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" /> Mark read
                      </button>
                    )}
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-line/60 bg-surface">
                    {notifications.length === 0 ? (
                      <div className="py-10 text-center text-xs text-ink-500 bg-surface">
                        <Bell className="w-8 h-8 text-ink-300 mx-auto mb-2" />
                        <p className="font-medium text-ink-700">No notifications yet</p>
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => handleNotificationClick(n)}
                          className={`p-3.5 cursor-pointer transition-colors text-xs ${
                            !n.is_read
                              ? 'bg-sage-50 hover:bg-sage-100/70 border-l-3 border-leaf-500'
                              : 'bg-surface hover:bg-cream-50 border-l-3 border-transparent'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-semibold text-ink-900 text-[13px] leading-snug">
                              {n.title}
                            </p>
                            {!n.is_read && (
                              <span className="w-2 h-2 rounded-full bg-leaf-500 shrink-0 mt-1"></span>
                            )}
                          </div>
                          <p className="text-ink-500 text-xs mt-1 leading-relaxed">
                            {n.message}
                          </p>
                          <div className="flex items-center gap-1.5 text-[10.5px] text-forest-700 font-medium mt-1.5">
                            <Clock className="w-3 h-3 text-leaf-500" />
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
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(true)}
                className="w-10 h-10 rounded-full bg-forest-900 text-cream-50 font-bold text-xs flex items-center justify-center shadow-pill shrink-0 cursor-pointer hover:bg-forest-700 transition-colors"
                title="Account & Menu"
                aria-label="Account Profile and Menu"
              >
                {user.name.charAt(0).toUpperCase()}
              </button>
            ) : (
              <Link
                to="/login"
                className="w-10 h-10 rounded-full bg-surface hover:bg-cream-100 border border-line text-ink-700 flex items-center justify-center transition-colors shrink-0 shadow-soft"
                title="Sign In"
                aria-label="Sign In"
              >
                <User className="w-4 h-4" />
              </Link>
            )}

            {/* Cart Pill Button */}
            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className="h-10 px-3.5 rounded-full bg-forest-900 hover:bg-forest-700 text-cream-50 font-semibold text-xs flex items-center gap-1.5 shadow-pill cursor-pointer shrink-0 transition-all duration-150 active:scale-95"
              title="View Cart"
              aria-label={`Cart with ${itemCount} items`}
            >
              <ShoppingBag className="w-3.5 h-3.5 text-cream-50" />
              <span>{itemCount}</span>
            </button>
          </div>
        </div>

        {/* Row 2: Mobile Search Input */}
        <div className="pt-2 w-full">
          <form onSubmit={handleSearchSubmit} className="w-full">
            <div className="relative flex items-center w-full">
              <Search className="w-4 h-4 text-ink-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder={DYNAMIC_PLACEHOLDERS[placeholderIdx]}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-11 pl-10 pr-9 text-xs bg-surface hover:bg-cream-50/50 focus:bg-surface border border-line focus:border-forest-700 focus:ring-2 focus:ring-forest-900/10 rounded-[12px] text-ink-900 placeholder:text-ink-400 font-medium transition-all shadow-soft"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-ink-400 hover:text-ink-900 rounded-full cursor-pointer"
                  title="Clear search"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Row 3: Horizontal Category Scrolling Bar on Mobile */}
        {categories.length > 0 && (
          <div className="pt-2 pb-0.5 -mx-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <Link
              to="/products"
              className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 transition-all ${
                location.pathname === '/products' && !location.search
                  ? 'bg-forest-900 text-white shadow-soft'
                  : 'bg-white text-charcoal-700 hover:bg-cream-100 border border-line'
              }`}
            >
              All Produce
            </Link>
            {categories.map((c) => {
              const isCatActive = location.pathname.includes(`/categories/${c.slug}`) || location.search.includes(`category=${c.slug}`);
              return (
                <Link
                  key={c.id}
                  to={`/categories/${c.slug}`}
                  className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap shrink-0 transition-all ${
                    isCatActive
                      ? 'bg-forest-900 text-white font-semibold shadow-soft'
                      : 'bg-white text-charcoal-700 hover:bg-cream-100 border border-line'
                  }`}
                >
                  {c.name}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          DESKTOP NAVBAR (>= md: Tablets & Laptops) - Slim, High-End Organic Header
          ═══════════════════════════════════════════════════════════════════════ */}
      <div className="hidden md:block max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20 gap-4 lg:gap-6">
          
          {/* Brand Logo & Wordmark */}
          <div className="flex items-center gap-3 shrink-0">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="relative">
                <img
                  src="/logo.png"
                  alt="Fresh Vegetables Organic Logo"
                  className="w-11 h-11 rounded-2xl object-cover border border-line shadow-soft group-hover:scale-105 transition-all duration-200"
                />
                <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-forest-900 border-2 border-surface flex items-center justify-center">
                  <Leaf className="w-2.5 h-2.5 text-leaf-300" />
                </span>
              </div>

              <div className="flex flex-col justify-center leading-none">
                <span className="font-serif text-xl lg:text-2xl font-bold tracking-tight text-ink-900 group-hover:text-forest-900 transition-colors flex items-center gap-2">
                  <span>Fresh Vegetables</span>
                  <span className="badge-organic text-[10px] tracking-wider uppercase font-sans">Organic</span>
                </span>
                <div className="flex text-[10px] font-semibold tracking-wider text-ink-500 mt-1 items-center gap-1.5 font-sans">
                  <span className={`w-1.5 h-1.5 rounded-full ${deliveryEstimate.isPaused ? 'bg-marigold-500' : 'bg-leaf-500'} animate-pulse`}></span>
                  <span>{deliveryEstimate.isPaused ? 'Deliveries Paused' : (deliveryEstimate.etaText ? `${deliveryEstimate.etaText} Express • 5 KM Radius` : 'Fresh Delivery • 5 KM Radius')}</span>
                </div>
              </div>
            </Link>
          </div>

          {/* Location & Delivery Zone Capsule */}
          <button
            type="button"
            onClick={() => setIsLocationModalOpen(true)}
            className="flex items-center h-11 px-3.5 rounded-full bg-surface hover:bg-cream-100 border border-line hover:border-leaf-500 transition-all duration-200 cursor-pointer group text-left shrink-0 shadow-soft min-h-[44px]"
            title="Click to check delivery availability or switch address"
          >
            <div className="w-7 h-7 rounded-full bg-sage-100 flex items-center justify-center shrink-0 mr-2.5 text-forest-700 group-hover:scale-105 transition-transform">
              <MapPin className="w-3.5 h-3.5" />
            </div>
            <div className="flex flex-col justify-center leading-tight">
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-bold uppercase tracking-wider text-ink-500">
                  {displayLocationName ? 'Deliver to' : 'Location'}
                </span>
                {displayLocationName && serviceability.checked ? (
                  serviceability.serviceable ? (
                    <span className="text-[9px] bg-sage-100 text-forest-900 font-semibold px-2 py-0.2 rounded-full border border-leaf-500/20">
                      {serviceability.distanceKm !== undefined ? `${serviceability.distanceKm} km • Available` : 'Serviceable'}
                    </span>
                  ) : !serviceability.configured ? (
                    <span className="text-[9px] bg-marigold-50 text-marigold-700 font-semibold px-2 py-0.2 rounded-full border border-marigold-500/30">
                      Configuring
                    </span>
                  ) : (
                    <span className="text-[9px] bg-tomato-50 text-tomato-500 font-semibold px-2 py-0.2 rounded-full border border-tomato-500/20">
                      Outside 5 km
                    </span>
                  )
                ) : (
                  <span className="text-[9px] bg-sage-100 text-forest-900 font-semibold px-2 py-0.2 rounded-full border border-leaf-500/20 animate-pulse">
                    Check Location
                  </span>
                )}
              </div>
              <div className="font-semibold text-ink-900 group-hover:text-forest-900 transition-colors text-xs flex items-center gap-1.5 mt-0.5">
                <span className="truncate max-w-[140px]" title={displayLocationName || 'Check Delivery Location'}>
                  {displayLocationName || 'Select Locality'}
                </span>
                {displayLocationName && (
                  <>
                    <span className="text-ink-300">•</span>
                    <span className={`text-[10px] font-medium flex items-center gap-1 shrink-0 ${deliveryEstimate.isPaused ? 'text-marigold-700' : 'text-forest-700'}`}>
                      <Clock className="w-3 h-3 text-leaf-500" />
                      {deliveryEstimate.isPaused ? 'Paused' : (deliveryEstimate.etaText || 'Express')}
                    </span>
                  </>
                )}
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-ink-400 group-hover:text-ink-700 group-hover:translate-y-0.5 transition-all ml-2 shrink-0" />
          </button>

          {/* Center Search Input */}
          <form onSubmit={handleSearchSubmit} className="flex-1 max-w-lg mx-2 lg:mx-4">
            <div className="relative flex items-center w-full">
              <button
                type="submit"
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400 hover:text-forest-900 transition-colors cursor-pointer p-0.5 rounded-md"
                title="Search produce"
              >
                <Search className="w-4.5 h-4.5" />
              </button>
              
              <input
                type="text"
                placeholder={DYNAMIC_PLACEHOLDERS[placeholderIdx]}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-11 pl-10 pr-10 text-xs sm:text-sm bg-surface hover:bg-cream-50/50 focus:bg-surface border border-line focus:border-forest-700 focus:ring-2 focus:ring-forest-900/10 rounded-[12px] transition-all text-ink-900 placeholder:text-ink-400 font-medium shadow-soft"
              />
              
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-ink-400 hover:text-ink-900 rounded-full hover:bg-cream-100 transition-colors cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </form>

          {/* Right Action Bar (Bell, User, Cart) */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            
            {/* Desktop Notification Bell */}
            <div className="relative" ref={notifRef}>
              <button
                type="button"
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                className="w-11 h-11 rounded-full bg-surface hover:bg-cream-100 border border-line text-ink-700 hover:text-forest-900 flex items-center justify-center transition-colors group cursor-pointer relative shadow-soft"
                title="Notifications"
                aria-label="Notifications"
              >
                <Bell className="w-4.5 h-4.5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-tomato-500 text-white text-[9px] font-bold min-w-[17px] h-[17px] px-1 rounded-full flex items-center justify-center ring-2 ring-white shadow-soft">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notifications Dropdown */}
              {isNotifOpen && (
                <div
                  className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-2xl z-[100] animate-fade-in shadow-soft-lg border border-line bg-surface overflow-hidden"
                >
                  <div className="px-4 py-3 bg-cream-50 border-b border-line flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-serif font-bold text-ink-900 text-sm">Notifications</span>
                      {unreadCount > 0 && (
                        <span className="text-[10px] font-bold bg-sage-100 text-forest-900 border border-leaf-500/20 px-2 py-0.5 rounded-full">
                          {unreadCount} new
                        </span>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={markAllAsRead}
                        className="text-[11px] font-semibold text-forest-700 hover:text-forest-900 flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-sage-100 transition-colors cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" /> Mark all read
                      </button>
                    )}
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-line/60 bg-surface">
                    {notifications.length === 0 ? (
                      <div className="py-10 text-center text-xs text-ink-500 bg-surface">
                        <Bell className="w-8 h-8 text-ink-300 mx-auto mb-2" />
                        <p className="font-medium text-ink-700">No notifications yet</p>
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => handleNotificationClick(n)}
                          className={`p-3.5 cursor-pointer transition-colors text-xs ${
                            !n.is_read
                              ? 'bg-sage-50 hover:bg-sage-100/70 border-l-3 border-leaf-500'
                              : 'bg-surface hover:bg-cream-50 border-l-3 border-transparent'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-semibold text-ink-900 text-[13px] leading-snug">
                              {n.title}
                            </p>
                            {!n.is_read && (
                              <span className="w-2 h-2 rounded-full bg-leaf-500 shrink-0 mt-1"></span>
                            )}
                          </div>
                          <p className="text-ink-500 text-xs mt-1 leading-relaxed">
                            {n.message}
                          </p>
                          <div className="flex items-center gap-1.5 text-[10.5px] text-forest-700 font-medium mt-1.5">
                            <Clock className="w-3 h-3 text-leaf-500" />
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
                  type="button"
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="h-11 flex items-center gap-2 pl-2 pr-3.5 rounded-full bg-surface hover:bg-cream-100 border border-line text-ink-900 transition-all cursor-pointer group shadow-soft min-h-[44px]"
                  title="Account"
                >
                  <div className="w-7 h-7 rounded-full bg-forest-900 text-cream-50 font-bold text-xs flex items-center justify-center shrink-0">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex flex-col text-left leading-none">
                    <span className="text-[8.5px] font-bold text-ink-500 uppercase tracking-wider">Account</span>
                    <span className="text-xs font-semibold text-ink-900 group-hover:text-forest-900 truncate max-w-[85px] mt-0.5">
                      {user.name.split(' ')[0]}
                    </span>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-ink-400 group-hover:text-ink-700 group-hover:translate-y-0.5 transition-all inline shrink-0 ml-0.5" />
                </button>
              ) : (
                <Link
                  to="/login"
                  className="btn-pill-secondary h-11 px-4 text-xs font-semibold"
                  title="Sign In"
                >
                  <User className="w-4 h-4 text-forest-900 shrink-0 mr-1.5" />
                  <span>Sign In</span>
                </Link>
              )}

              {/* User Dropdown Menu */}
              {user && isUserMenuOpen && (
                <div
                  className="absolute right-0 top-full mt-2 w-64 rounded-2xl z-[100] animate-fade-in shadow-soft-lg border border-line bg-surface overflow-hidden"
                >
                  <div className="px-4 py-3 bg-cream-50 border-b border-line">
                    <p className="text-[8.5px] text-ink-500 font-bold uppercase tracking-wider">Signed in as</p>
                    <p className="text-sm font-semibold text-ink-900 truncate">{user.name}</p>
                    <p className="text-xs text-ink-500 truncate" title={user.email}>{user.email}</p>
                  </div>
                  <div className="py-1.5 space-y-0.5 bg-surface">
                    <Link
                      to="/orders"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-ink-700 hover:text-forest-900 hover:bg-cream-100 transition-colors"
                    >
                      <Package className="w-4 h-4 text-leaf-500" />
                      <span>My Orders</span>
                    </Link>
                    <Link
                      to="/wallet"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="flex items-center justify-between px-4 py-2 text-xs font-medium text-ink-700 hover:text-forest-900 hover:bg-cream-100 transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <Wallet className="w-4 h-4 text-marigold-500" />
                        <span>Wallet &amp; Credits</span>
                      </div>
                    </Link>
                    <Link
                      to="/profile"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-ink-700 hover:text-forest-900 hover:bg-cream-100 transition-colors"
                    >
                      <User className="w-4 h-4 text-leaf-500" />
                      <span>Profile &amp; Addresses</span>
                    </Link>
                  </div>
                  <div className="border-t border-line pt-1 bg-surface">
                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        showLogoutConfirm(() => {
                          logout();
                          showLogoutSuccess(false, () => {
                            navigate('/');
                          });
                        });
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-tomato-500 hover:bg-tomato-50 transition-colors cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 text-tomato-500" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Desktop Cart Button */}
            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className={`btn-pill-primary h-11 px-5 gap-2.5 transition-all duration-300 ${
                cartBounced ? 'scale-105 shadow-soft-lg ring-2 ring-leaf-400' : ''
              }`}
              title="View Cart & Checkout"
            >
              <div className="relative flex items-center justify-center">
                <ShoppingBag className="w-4 h-4" />
                {itemCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-marigold-500 text-forest-950 text-[9px] font-bold min-w-[17px] h-[17px] px-0.5 rounded-full flex items-center justify-center ring-2 ring-forest-900 shadow-soft">
                    {itemCount}
                  </span>
                )}
              </div>
              <span className="tracking-wider uppercase font-bold text-[11px]">My Cart</span>
            </button>
          </div>
        </div>

        {/* ─── Desktop Sub-Navigation Rail (Clean Categories) ─── */}
        <div className="flex items-center gap-2 py-2 border-t border-line text-xs font-medium overflow-x-auto scrollbar-none">
          <Link
            to="/products"
            className={`px-3.5 py-1.5 rounded-full transition-all duration-150 whitespace-nowrap flex items-center gap-1.5 ${
              location.pathname === '/products' && !location.search
                ? 'bg-forest-900 text-cream-50 font-semibold'
                : 'text-ink-700 hover:text-forest-900 hover:bg-cream-100'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-leaf-500" />
            <span>All Vegetables</span>
          </Link>

          {categories.map((cat) => {
            const isCatActive = location.pathname.includes(`/categories/${cat.slug}`) || location.search.includes(`category=${cat.slug}`);
            return (
              <Link
                key={cat.id}
                to={`/categories/${cat.slug}`}
                className={`px-3 py-1.5 rounded-full transition-all duration-150 whitespace-nowrap ${
                  isCatActive
                    ? 'bg-forest-900 text-cream-50 font-semibold'
                    : 'text-ink-700 hover:text-forest-900 hover:bg-cream-100'
                }`}
              >
                {cat.name}
              </Link>
            );
          })}

          <Link
            to="/products?in_stock=true"
            className="px-3.5 py-1.5 rounded-full bg-marigold-50 hover:bg-marigold-100 text-marigold-700 border border-marigold-500/30 font-semibold whitespace-nowrap transition-all ml-auto flex items-center gap-1.5"
          >
            <Flame className="w-3.5 h-3.5 text-marigold-600" />
            <span>Daily Deals</span>
          </Link>

          <div className="hidden xl:flex items-center gap-2 pl-3 ml-2 border-l border-line text-[11px] font-medium text-ink-500">
            <span className="w-1.5 h-1.5 rounded-full bg-leaf-500"></span>
            <span>Fresh Vegetables • 5 KM Delivery Radius</span>
          </div>
        </div>
      </div>

      {/* ─── Mobile Drawer Menu ─── */}
      {isMobileMenuOpen && createPortal(
        <div
          className="md:hidden fixed inset-0 z-[99999] bg-forest-950/60 backdrop-blur-xs transition-opacity animate-fade-in flex flex-col justify-end"
          onClick={() => setIsMobileMenuOpen(false)}
        >
          <div
            className="bg-surface border-t border-line rounded-t-3xl max-h-[85vh] overflow-y-auto p-6 space-y-6 shadow-soft-lg text-ink-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-line pb-4">
              <div className="flex items-center gap-3">
                <img
                  src="/logo.png"
                  alt="Fresh Vegetables Organic Logo"
                  className="w-11 h-11 rounded-2xl object-cover border border-line"
                />
                <div>
                  <h3 className="font-serif font-bold text-base text-ink-900 leading-tight flex items-center gap-1.5">
                    <span>Fresh Vegetables</span>
                    <span className="badge-organic text-[10px] uppercase font-sans">Organic</span>
                  </h3>
                  <p className="text-[10px] font-medium text-ink-500 flex items-center gap-1 mt-0.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${deliveryEstimate.isPaused ? 'bg-marigold-500' : 'bg-leaf-500'}`}></span>
                    ⚡ {deliveryEstimate.isPaused ? 'Deliveries Paused' : `${deliveryEstimate.etaText || 'Express'} Express`} • 5 KM Radius
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 text-ink-400 hover:text-ink-900 rounded-full hover:bg-cream-100 transition-colors"
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
              className="p-3.5 bg-cream-50 rounded-2xl border border-line flex items-center justify-between cursor-pointer hover:border-leaf-500 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-sage-100 flex items-center justify-center text-forest-700">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-ink-500">Delivery Zone</p>
                  <p className="text-xs font-semibold text-ink-900">{currentZone ? currentZone.name : 'Select Delivery Zone'}</p>
                </div>
              </div>
              <span className="text-xs font-semibold text-forest-700">Change</span>
            </div>

            {/* Quick Links */}
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-ink-500">Produce Categories</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <Link
                  to="/products"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-3 bg-sage-50 text-forest-900 border border-leaf-500/20 rounded-xl hover:bg-sage-100 transition-colors font-semibold flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-leaf-500" />
                  <span>All Vegetables</span>
                </Link>
                <Link
                  to="/products?in_stock=true"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-3 bg-marigold-50 text-marigold-700 border border-marigold-500/30 rounded-xl hover:bg-marigold-100 transition-colors font-semibold flex items-center gap-1.5"
                >
                  <Flame className="w-3.5 h-3.5 text-marigold-600" />
                  <span>Daily Deals</span>
                </Link>
                {categories.map((cat) => (
                  <Link
                    key={cat.id}
                    to={`/categories/${cat.slug}`}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-3 bg-surface text-ink-700 border border-line rounded-xl hover:bg-cream-100 transition-colors truncate font-medium"
                  >
                    {cat.name}
                  </Link>
                ))}
              </div>
            </div>

            {/* Account section */}
            <div className="border-t border-line pt-4 space-y-3">
              {user ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-cream-50 rounded-2xl border border-line">
                    <div className="w-9 h-9 rounded-full bg-forest-900 text-cream-50 font-bold flex items-center justify-center text-xs">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-ink-900">{user.name}</p>
                      <p className="text-xs text-ink-500">{user.email}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <Link
                      to="/profile"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="p-3 bg-surface hover:bg-cream-100 rounded-xl text-ink-900 border border-line flex items-center gap-2 col-span-2 font-medium"
                    >
                      <User className="w-4 h-4 text-leaf-500" /> Profile &amp; Addresses
                    </Link>
                    <Link
                      to="/orders"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="p-3 bg-surface hover:bg-cream-100 rounded-xl text-ink-900 border border-line flex items-center gap-2 font-medium"
                    >
                      <Package className="w-4 h-4 text-leaf-500" /> My Orders
                    </Link>
                    <Link
                      to="/wallet"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="p-3 bg-surface hover:bg-cream-100 rounded-xl text-marigold-700 border border-line flex items-center gap-2 font-medium"
                    >
                      <Wallet className="w-4 h-4 text-marigold-500" /> Wallet &amp; Credits
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        showLogoutConfirm(() => {
                          logout();
                          showLogoutSuccess(false, () => {
                            navigate('/');
                          });
                        });
                      }}
                      className="p-3 bg-tomato-50 hover:bg-tomato-100/70 rounded-xl text-tomato-500 border border-tomato-500/20 flex items-center justify-center gap-2 col-span-2 cursor-pointer font-semibold transition-colors"
                    >
                      <LogOut className="w-4 h-4 text-tomato-500" /> Sign Out
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Link
                    to="/login"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="btn-pill-primary flex-1 text-center py-2.5"
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="btn-pill-secondary flex-1 text-center py-2.5"
                  >
                    Create Account
                  </Link>
                </div>
              )}

              <div className="pt-2">
                <Link
                  to="/admin/login"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-2 text-xs font-medium text-ink-400 hover:text-ink-700 py-2"
                >
                  <ShieldAlert className="w-4 h-4 text-marigold-500" />
                  Admin Operations Portal
                </Link>
              </div>
            </div>
          </div>
        </div>,
        document.body
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
