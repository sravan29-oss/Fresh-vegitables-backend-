import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  User,
  MapPin,
  Plus,
  Trash2,
  CheckCircle2,
  Phone,
  Mail,
  Navigation,
  AlertCircle,
  Loader2,
  CheckCircle,
  LogOut,
  Package,
  Wallet,
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  Sparkles,
  Edit3,
  X,
  Building2,
  Clock,
  ShieldCheck,
  ShoppingBag,
  Check,
} from 'lucide-react';
import api from '../../services/api';
import { Address, Order } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { SEOHead } from '../../components/common/SEOHead';

export const ProfilePage: React.FC = () => {
  const { user, updateUser, logout, showLogoutConfirm, showLogoutSuccess, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(true);

  // Profile Edit State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [mobile, setMobile] = useState(user?.mobile || '');
  const [isUpdating, setIsUpdating] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [profileError, setProfileError] = useState('');

  // Active Tab: 'dashboard' | 'profile' | 'addresses'
  const [activeTab, setActiveTab] = useState<'dashboard' | 'profile' | 'addresses'>('dashboard');

  // Add Address State & Zone Validation
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [zoneServiceability, setZoneServiceability] = useState<{
    checked: boolean;
    serviceable: boolean;
    zoneName?: string;
    message?: string;
  }>({ checked: false, serviceable: true });

  const [newAddress, setNewAddress] = useState<{
    full_name: string;
    phone: string;
    house_number: string;
    street: string;
    area: string;
    landmark: string;
    city: string;
    state: string;
    pincode: string;
    latitude?: number;
    longitude?: number;
    address_type: 'home' | 'work' | 'other';
    is_default: boolean;
  }>(() => {
    let initLat: number | undefined;
    let initLng: number | undefined;
    try {
      const savedZone = localStorage.getItem('fresh_delivery_zone');
      if (savedZone) {
        const parsed = JSON.parse(savedZone);
        if (parsed.latitude && parsed.longitude) {
          initLat = Number(parsed.latitude);
          initLng = Number(parsed.longitude);
        }
      }
    } catch {}

    return {
      full_name: user?.name || '',
      phone: user?.mobile || '',
      house_number: '',
      street: '',
      area: '',
      landmark: '',
      city: 'Hyderabad',
      state: 'Telangana',
      pincode: '500059',
      latitude: initLat,
      longitude: initLng,
      address_type: 'home',
      is_default: false,
    };
  });

  // Fetch orders and addresses
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/login?redirect=/profile');
      return;
    }

    setName(user.name || '');
    setMobile(user.mobile || '');

    // Fetch saved addresses
    api.get('/addresses')
      .then((res) => {
        if (res.data?.data) setAddresses(res.data.data);
      })
      .catch((err) => console.error('Failed to load addresses', err));

    // Fetch customer orders for real counts
    setIsLoadingOrders(true);
    api.get('/orders')
      .then((res) => {
        if (res.data?.data) setOrders(res.data.data);
      })
      .catch((err) => console.error('Failed to load orders', err))
      .finally(() => setIsLoadingOrders(false));
  }, [user, authLoading, navigate]);

  // Derived real customer stats
  const stats = useMemo(() => {
    const totalOrders = orders.length;
    const activeOrders = orders.filter((o) =>
      ['pending', 'confirmed', 'preparing', 'packed', 'out_for_delivery'].includes(o.order_status)
    ).length;
    const deliveredOrders = orders.filter((o) => o.order_status === 'delivered').length;
    const savedAddressesCount = addresses.length;

    return { totalOrders, activeOrders, deliveredOrders, savedAddressesCount };
  }, [orders, addresses]);

  // Handle Profile Update
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setProfileError('Please enter your full name');
      return;
    }

    try {
      setIsUpdating(true);
      setProfileError('');
      const res = await api.put('/auth/profile', { name: name.trim(), mobile: mobile.trim() });
      if (res.data?.data) {
        updateUser(res.data.data);
        setProfileMessage('Profile updated successfully!');
        setIsEditingProfile(false);
        setTimeout(() => setProfileMessage(''), 4000);
      }
    } catch (err: any) {
      setProfileError(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleLogout = () => {
    showLogoutConfirm(() => {
      logout();
      showLogoutSuccess(false, () => {
        navigate('/');
      });
    });
  };

  const checkPincodeServiceability = async (pincodeToCheck: string) => {
    const clean = pincodeToCheck.trim();
    if (clean.length !== 6) {
      setZoneServiceability({ checked: false, serviceable: true });
      return;
    }

    try {
      const res = await api.post('/zones/check-pincode', { pincode: clean });
      const data = res.data?.data;
      if (data?.serviceable && data?.zone) {
        setZoneServiceability({
          checked: true,
          serviceable: true,
          zoneName: data.zone.name,
          message: `Serviceable in ${data.zone.name}! Express delivery active within 5 KM.`,
        });
      } else {
        setZoneServiceability({
          checked: true,
          serviceable: false,
          message: data?.message || `Currently unavailable for delivery to pincode ${clean}.`,
        });
      }
    } catch {
      setZoneServiceability({
        checked: true,
        serviceable: true,
        zoneName: 'Hyderabad Fulfillment Hubs',
        message: 'Two-hub delivery active within 5.0 KM from Champapet & KPHB.',
      });
    }
  };

  const detectCurrentLocation = () => {
    if (!navigator.geolocation) {
      setZoneServiceability({
        checked: true,
        serviceable: false,
        message: 'Geolocation is not supported by your browser.',
      });
      return;
    }

    setIsDetectingLocation(true);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const validLat = Number(latitude.toFixed(6));
        const validLng = Number(longitude.toFixed(6));

        let detectedPincode = '';
        let detectedArea = '';
        let detectedCity = 'Hyderabad';
        let detectedState = 'Telangana';
        let detectedHouse = '';

        try {
          const res = await api.post('/delivery/reverse-geocode', {
            latitude: validLat,
            longitude: validLng,
          });
          const d = res.data?.data;
          if (d) {
            detectedArea = d.colony || d.area || '';
            detectedPincode = d.pincode || '';
            detectedHouse = d.house_number || '';
          }
        } catch {
          // OpenStreetMap Nominatim fallback
          try {
            const nomRes = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${validLat}&lon=${validLng}`
            );
            const nomData = await nomRes.json();
            if (nomData?.address) {
              const a = nomData.address;
              if (a.postcode) detectedPincode = a.postcode.replace(/\D/g, '').slice(0, 6);
              detectedArea = a.suburb || a.neighbourhood || a.road || '';
              detectedCity = a.city || a.town || 'Hyderabad';
              detectedState = a.state || 'Telangana';
            }
          } catch {}
        }

        setNewAddress((prev) => ({
          ...prev,
          latitude: validLat,
          longitude: validLng,
          house_number: detectedHouse || prev.house_number,
          area: detectedArea || prev.area,
          city: detectedCity || prev.city,
          state: detectedState || prev.state,
          pincode: detectedPincode || prev.pincode,
        }));

        setIsDetectingLocation(false);
        if (detectedPincode) {
          checkPincodeServiceability(detectedPincode);
        }
      },
      () => {
        setIsDetectingLocation(false);
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  const handleCreateAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (zoneServiceability.checked && !zoneServiceability.serviceable) {
      alert(
        zoneServiceability.message ||
          'Delivery is not available to this address as it is outside our 5.0 KM service radius.'
      );
      return;
    }

    try {
      const payload = { ...newAddress };
      const res = await api.post('/addresses', payload);
      if (res.data?.data) {
        setAddresses([res.data.data, ...addresses]);
        setIsAddingAddress(false);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to save address');
    }
  };

  const handleDeleteAddress = async (id: string) => {
    if (!confirm('Are you sure you want to remove this delivery address?')) return;
    try {
      await api.delete(`/addresses/${id}`);
      setAddresses(addresses.filter((a) => a.id !== id));
    } catch (err) {
      alert('Failed to delete address');
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await api.patch(`/addresses/${id}/default`);
      setAddresses(
        addresses.map((a) => ({
          ...a,
          is_default: a.id === id,
        }))
      );
      const target = addresses.find((a) => a.id === id);
      if (target) {
        const areaName = target.area || target.street || target.city;
        localStorage.setItem('fresh_delivery_colony', areaName);
        localStorage.setItem(
          'fresh_delivery_address',
          `${target.house_number || ''} ${target.street || ''}, ${target.area || ''}, ${target.city} - ${target.pincode}`.trim()
        );
        window.dispatchEvent(
          new CustomEvent('fresh_delivery_location_changed', {
            detail: { colony: areaName, address: `${target.area || target.street}, ${target.city}` },
          })
        );
      }
    } catch (err) {
      alert('Failed to set default address');
    }
  };

  // Customer initials
  const initials = (user?.name || 'Customer')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 pb-24 md:pb-16 font-sans animate-slide-up space-y-6 sm:space-y-8">
      <SEOHead title="My Account | Fresh Vegetables Organic" noindex={true} />

      {/* ─── Breadcrumbs ─── */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs font-semibold text-ink-500 font-sans pt-1">
        <Link to="/" className="hover:text-forest-900 transition-colors">Home</Link>
        <ChevronRight className="w-3.5 h-3.5 text-ink-400 stroke-[2]" />
        <span className="text-forest-900 font-bold">My Account</span>
      </nav>

      {/* ─── Dashboard Header Banner ─── */}
      <header className="bg-white rounded-3xl border border-line p-5 sm:p-8 shadow-soft flex flex-col sm:flex-row sm:items-center justify-between gap-5 relative overflow-hidden">
        <div className="flex items-center gap-4 z-10">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-cream-100 border border-line flex items-center justify-center text-forest-900 font-heading font-bold text-2xl sm:text-3xl shadow-soft shrink-0">
            {initials || <User className="w-8 h-8 text-forest-700" />}
          </div>
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 bg-cream-100 text-forest-800 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border border-line font-sans">
              <Sparkles className="w-3 h-3 text-leaf-600" />
              <span>Organic Member Account</span>
            </div>
            <h1 className="font-heading font-bold text-2xl sm:text-3xl text-ink-900 tracking-tight">
              Hello, {user?.name || 'Valued Customer'}!
            </h1>
            <p className="text-xs text-ink-500 font-sans flex items-center gap-2 flex-wrap">
              {user?.email && (
                <span className="flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-forest-700" />
                  <span>{user.email}</span>
                </span>
              )}
              {user?.mobile && (
                <span className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-forest-700" />
                  <span>{user.mobile}</span>
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2 z-10 self-start sm:self-auto">
          <Link
            to="/products"
            className="px-4 py-2.5 rounded-full bg-forest-900 hover:bg-forest-850 text-white text-xs font-bold shadow-soft transition-all cursor-pointer min-h-[40px] flex items-center gap-1.5"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Shop Produce</span>
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-tomato-50 hover:bg-tomato-100 text-tomato-600 border border-tomato-200 text-xs font-bold transition-all cursor-pointer min-h-[40px]"
            title="Sign Out of Account"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* ─── Navigation Tabs ─── */}
      <div className="flex items-center gap-2 border-b border-line pb-2 overflow-x-auto no-scrollbar">
        {[
          { id: 'dashboard', label: 'Overview Dashboard' },
          { id: 'profile', label: 'My Profile' },
          { id: 'addresses', label: `Address Book (${addresses.length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer shrink-0 min-h-[40px] ${
              activeTab === tab.id
                ? 'bg-forest-900 text-white shadow-soft'
                : 'bg-white hover:bg-cream-100 text-ink-700 border border-line'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {profileMessage && (
        <div className="p-4 rounded-2xl bg-cream-100 border border-line text-forest-900 text-xs font-semibold flex items-center gap-2 shadow-soft">
          <CheckCircle className="w-4 h-4 text-leaf-600 shrink-0" />
          <span>{profileMessage}</span>
        </div>
      )}

      {/* ─── TAB 1: OVERVIEW DASHBOARD ─── */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <Link
              to="/orders"
              className="p-4 sm:p-5 rounded-2xl bg-white border border-line shadow-soft hover:shadow-card-hover transition-all group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-ink-500 font-sans">Total Orders</span>
                <div className="w-8 h-8 rounded-xl bg-cream-100 flex items-center justify-center text-forest-700 group-hover:scale-105 transition-transform">
                  <Package className="w-4 h-4" />
                </div>
              </div>
              <p className="font-heading font-bold text-2xl sm:text-3xl text-forest-900 mt-2 font-mono">
                {stats.totalOrders}
              </p>
              <span className="text-[11px] text-forest-800 font-medium flex items-center gap-1 mt-1 font-sans">
                <span>View all history</span>
                <ArrowRight className="w-3 h-3" />
              </span>
            </Link>

            <Link
              to="/orders"
              className="p-4 sm:p-5 rounded-2xl bg-white border border-line shadow-soft hover:shadow-card-hover transition-all group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-ink-500 font-sans">Active Dispatches</span>
                <div className="w-8 h-8 rounded-xl bg-cream-100 flex items-center justify-center text-forest-700 group-hover:scale-105 transition-transform">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <p className="font-heading font-bold text-2xl sm:text-3xl text-forest-900 mt-2 font-mono">
                {stats.activeOrders}
              </p>
              <span className="text-[11px] text-forest-800 font-medium flex items-center gap-1 mt-1 font-sans">
                <span>Track live orders</span>
                <ArrowRight className="w-3 h-3" />
              </span>
            </Link>

            <div className="p-4 sm:p-5 rounded-2xl bg-white border border-line shadow-soft">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-ink-500 font-sans">Completed Orders</span>
                <div className="w-8 h-8 rounded-xl bg-cream-100 flex items-center justify-center text-forest-700">
                  <CheckCircle2 className="w-4 h-4 text-leaf-600" />
                </div>
              </div>
              <p className="font-heading font-bold text-2xl sm:text-3xl text-forest-900 mt-2 font-mono">
                {stats.deliveredOrders}
              </p>
              <span className="text-[11px] text-ink-500 font-medium mt-1 block font-sans">
                Hand-sorted &amp; delivered
              </span>
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('addresses')}
              className="p-4 sm:p-5 rounded-2xl bg-white border border-line shadow-soft hover:shadow-card-hover transition-all text-left group cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-ink-500 font-sans">Saved Addresses</span>
                <div className="w-8 h-8 rounded-xl bg-cream-100 flex items-center justify-center text-forest-700 group-hover:scale-105 transition-transform">
                  <MapPin className="w-4 h-4" />
                </div>
              </div>
              <p className="font-heading font-bold text-2xl sm:text-3xl text-forest-900 mt-2 font-mono">
                {stats.savedAddressesCount}
              </p>
              <span className="text-[11px] text-forest-800 font-medium flex items-center gap-1 mt-1 font-sans">
                <span>Manage addresses</span>
                <ArrowRight className="w-3 h-3" />
              </span>
            </button>
          </div>

          {/* Quick Shortcuts Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Link
              to="/orders"
              className="p-5 rounded-3xl bg-white border border-line shadow-soft flex items-center gap-4 hover:border-forest-700 transition-colors group"
            >
              <div className="w-12 h-12 rounded-2xl bg-cream-100 flex items-center justify-center text-forest-800 shrink-0 group-hover:scale-105 transition-transform">
                <Package className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-heading font-bold text-base text-ink-900">My Orders</h3>
                <p className="text-xs text-ink-500 font-sans mt-0.5">Track live milestones &amp; reorder</p>
              </div>
            </Link>

            <Link
              to="/wallet"
              className="p-5 rounded-3xl bg-white border border-line shadow-soft flex items-center gap-4 hover:border-forest-700 transition-colors group"
            >
              <div className="w-12 h-12 rounded-2xl bg-cream-100 flex items-center justify-center text-forest-800 shrink-0 group-hover:scale-105 transition-transform">
                <Wallet className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-heading font-bold text-base text-ink-900">Wallet &amp; Credits</h3>
                <p className="text-xs text-ink-500 font-sans mt-0.5">Check balance &amp; refunds</p>
              </div>
            </Link>

            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className="p-5 rounded-3xl bg-white border border-line shadow-soft flex items-center gap-4 hover:border-forest-700 transition-colors group text-left cursor-pointer"
            >
              <div className="w-12 h-12 rounded-2xl bg-cream-100 flex items-center justify-center text-forest-800 shrink-0 group-hover:scale-105 transition-transform">
                <User className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-heading font-bold text-base text-ink-900">Edit Profile</h3>
                <p className="text-xs text-ink-500 font-sans mt-0.5">Update name &amp; phone details</p>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* ─── TAB 2: MY PROFILE ─── */}
      {activeTab === 'profile' && (
        <div className="bg-white rounded-3xl border border-line p-5 sm:p-8 shadow-soft space-y-6 max-w-2xl">
          <div className="flex items-center justify-between pb-4 border-b border-line">
            <div>
              <h2 className="font-heading font-bold text-xl text-ink-900">Personal Information</h2>
              <p className="text-xs text-ink-500 font-sans mt-0.5">Manage your customer contact details</p>
            </div>
            {!isEditingProfile && (
              <button
                type="button"
                onClick={() => setIsEditingProfile(true)}
                className="px-4 py-2 rounded-full border border-line hover:bg-cream-100 text-xs font-bold text-forest-900 flex items-center gap-1.5 transition-colors cursor-pointer min-h-[38px]"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Details</span>
              </button>
            )}
          </div>

          {profileError && (
            <div className="p-3.5 rounded-2xl bg-tomato-50 border border-tomato-200 text-tomato-900 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-tomato-600 shrink-0" />
              <span>{profileError}</span>
            </div>
          )}

          {isEditingProfile ? (
            <form onSubmit={handleUpdateProfile} className="space-y-4 font-sans">
              <div>
                <label className="block text-xs font-bold text-ink-700 uppercase tracking-wider mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your full name"
                  className="w-full text-xs sm:text-sm bg-cream-50 border border-line rounded-xl px-3.5 py-2.5 focus:bg-white focus:outline-none focus:border-forest-700 text-ink-900"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink-700 uppercase tracking-wider mb-1.5">
                  Mobile Number
                </label>
                <input
                  type="tel"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="10-digit mobile number"
                  className="w-full text-xs sm:text-sm bg-cream-50 border border-line rounded-xl px-3.5 py-2.5 focus:bg-white focus:outline-none focus:border-forest-700 text-ink-900 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink-400 uppercase tracking-wider mb-1.5">
                  Email Address (Google Account Verified)
                </label>
                <input
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="w-full text-xs sm:text-sm bg-cream-100 border border-line rounded-xl px-3.5 py-2.5 text-ink-500 cursor-not-allowed font-mono"
                />
                <span className="text-[11px] text-ink-400 mt-1 block">
                  Email is linked to your Google sign-in credentials.
                </span>
              </div>

              <div className="flex items-center gap-3 pt-3">
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-6 py-3 rounded-full bg-forest-900 hover:bg-forest-850 text-white font-bold text-xs shadow-soft transition-all cursor-pointer min-h-[44px] flex items-center gap-1.5"
                >
                  {isUpdating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingProfile(false);
                    setName(user?.name || '');
                    setMobile(user?.mobile || '');
                    setProfileError('');
                  }}
                  className="px-5 py-3 rounded-full border border-line hover:bg-cream-100 text-ink-700 font-bold text-xs transition-colors cursor-pointer min-h-[44px]"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4 font-sans text-xs sm:text-sm">
              <div className="flex justify-between py-2 border-b border-line/60">
                <span className="text-ink-500 font-medium">Full Name</span>
                <span className="font-bold text-ink-900">{user?.name || 'Not configured'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-line/60">
                <span className="text-ink-500 font-medium">Mobile Number</span>
                <span className="font-bold text-ink-900 font-mono">{user?.mobile || 'Not configured'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-line/60">
                <span className="text-ink-500 font-medium">Email Address</span>
                <span className="font-bold text-ink-900 font-mono">{user?.email || 'Not configured'}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-ink-500 font-medium">Account Role</span>
                <span className="font-bold text-forest-800 bg-cream-100 px-2.5 py-0.5 rounded-full border border-line text-xs uppercase">
                  {user?.role || 'Customer'}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 3: ADDRESS BOOK ─── */}
      {activeTab === 'addresses' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-line">
            <div>
              <h2 className="font-heading font-bold text-xl text-ink-900">Saved Delivery Addresses</h2>
              <p className="text-xs text-ink-500 font-sans mt-0.5">
                Two-hub delivery coverage within 5.0 KM from Champapet &amp; KPHB hubs
              </p>
            </div>
            {!isAddingAddress && (
              <button
                type="button"
                onClick={() => {
                  detectCurrentLocation();
                  setIsAddingAddress(true);
                }}
                className="px-4 py-2.5 rounded-full bg-forest-900 hover:bg-forest-850 text-white font-bold text-xs shadow-soft transition-all cursor-pointer min-h-[40px] flex items-center gap-1.5 self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add New Address</span>
              </button>
            )}
          </div>

          {/* Add New Address Form Modal/Panel */}
          {isAddingAddress && (
            <div className="bg-white rounded-3xl border border-line p-5 sm:p-7 shadow-soft space-y-4 max-w-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-line">
                <h3 className="font-heading font-bold text-base text-ink-900">Add New Delivery Address</h3>
                <button
                  type="button"
                  onClick={() => setIsAddingAddress(false)}
                  className="p-1.5 rounded-full hover:bg-cream-100 text-ink-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateAddress} className="space-y-3.5 font-sans">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-ink-700 mb-1">Contact Name</label>
                    <input
                      type="text"
                      value={newAddress.full_name}
                      onChange={(e) => setNewAddress({ ...newAddress, full_name: e.target.value })}
                      placeholder="Receiver name"
                      className="w-full text-xs bg-cream-50 border border-line rounded-xl px-3 py-2 text-ink-900"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-ink-700 mb-1">Contact Phone</label>
                    <input
                      type="tel"
                      value={newAddress.phone}
                      onChange={(e) => setNewAddress({ ...newAddress, phone: e.target.value })}
                      placeholder="10-digit mobile"
                      className="w-full text-xs bg-cream-50 border border-line rounded-xl px-3 py-2 text-ink-900 font-mono"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-ink-700 mb-1">Flat / House No.</label>
                    <input
                      type="text"
                      value={newAddress.house_number}
                      onChange={(e) => setNewAddress({ ...newAddress, house_number: e.target.value })}
                      placeholder="Flat 302, Green Villa"
                      className="w-full text-xs bg-cream-50 border border-line rounded-xl px-3 py-2 text-ink-900"
                      required
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-ink-700 mb-1">Street &amp; Locality</label>
                    <input
                      type="text"
                      value={newAddress.street}
                      onChange={(e) => setNewAddress({ ...newAddress, street: e.target.value })}
                      placeholder="Road No. 5, Near Main Park"
                      className="w-full text-xs bg-cream-50 border border-line rounded-xl px-3 py-2 text-ink-900"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-ink-700 mb-1">Area / Colony</label>
                    <input
                      type="text"
                      value={newAddress.area}
                      onChange={(e) => setNewAddress({ ...newAddress, area: e.target.value })}
                      placeholder="Champapet / KPHB"
                      className="w-full text-xs bg-cream-50 border border-line rounded-xl px-3 py-2 text-ink-900"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-ink-700 mb-1">City</label>
                    <input
                      type="text"
                      value={newAddress.city}
                      onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                      placeholder="Hyderabad"
                      className="w-full text-xs bg-cream-50 border border-line rounded-xl px-3 py-2 text-ink-900"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-ink-700 mb-1">Pincode</label>
                    <input
                      type="text"
                      value={newAddress.pincode}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                        setNewAddress({ ...newAddress, pincode: val });
                        if (val.length === 6) checkPincodeServiceability(val);
                      }}
                      placeholder="500059"
                      className="w-full text-xs bg-cream-50 border border-line rounded-xl px-3 py-2 text-ink-900 font-mono"
                      required
                    />
                  </div>
                </div>

                {/* GPS Pin Status Bar */}
                <div className="p-3 rounded-xl bg-cream-50 border border-line text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Navigation className="w-4 h-4 text-forest-700" />
                    <span>
                      {newAddress.latitude && newAddress.longitude
                        ? `GPS Pin: ${newAddress.latitude}, ${newAddress.longitude}`
                        : 'GPS pin required for 5 KM radius calculation'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={detectCurrentLocation}
                    disabled={isDetectingLocation}
                    className="text-xs font-bold text-forest-800 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {isDetectingLocation ? 'Detecting...' : 'Use My GPS'}
                  </button>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-full bg-forest-900 hover:bg-forest-850 text-white font-bold text-xs shadow-soft transition-all cursor-pointer min-h-[42px]"
                  >
                    Save Address
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddingAddress(false)}
                    className="px-4 py-2.5 rounded-full border border-line hover:bg-cream-100 text-ink-700 font-bold text-xs transition-colors cursor-pointer min-h-[42px]"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Saved Addresses List */}
          {addresses.length === 0 ? (
            <div className="p-10 text-center bg-white rounded-3xl border border-line space-y-3">
              <MapPin className="w-10 h-10 text-ink-300 mx-auto" />
              <h3 className="font-heading font-bold text-base text-ink-900">No saved addresses</h3>
              <p className="text-xs text-ink-500 font-sans max-w-xs mx-auto">
                Add your home or office address to enable quick 1-click checkout.
              </p>
              <button
                type="button"
                onClick={() => {
                  detectCurrentLocation();
                  setIsAddingAddress(true);
                }}
                className="mt-2 px-5 py-2.5 rounded-full bg-forest-900 text-white font-bold text-xs shadow-soft cursor-pointer"
              >
                Add Your Address
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {addresses.map((addr) => {
                const hasCoords = addr.latitude && addr.longitude;
                return (
                  <div
                    key={addr.id}
                    className="p-5 rounded-3xl bg-white border border-line shadow-soft flex flex-col justify-between space-y-3 relative group"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider bg-cream-100 text-forest-800 px-2.5 py-0.5 rounded-full border border-line">
                            {addr.address_type}
                          </span>
                          {addr.is_default && (
                            <span className="text-[10px] font-bold bg-leaf-500 text-white px-2 py-0.5 rounded-full shadow-xs">
                              Default Address
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteAddress(addr.id)}
                          className="text-ink-400 hover:text-tomato-600 p-1.5 rounded-lg hover:bg-tomato-50 transition-colors cursor-pointer"
                          title="Delete address"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <h4 className="font-heading font-bold text-sm text-ink-900">
                        {addr.full_name} • <span className="font-mono text-ink-600">{addr.phone}</span>
                      </h4>
                      <p className="text-xs text-ink-500 leading-relaxed font-sans">
                        {[addr.house_number, addr.street, addr.area, addr.landmark, addr.city, addr.pincode]
                          .filter(Boolean)
                          .join(', ')}
                      </p>

                      {hasCoords && (
                        <p className="text-[10px] text-leaf-700 font-semibold flex items-center gap-1 font-sans">
                          <CheckCircle className="w-3 h-3 text-leaf-600" />
                          <span>Verified GPS Location ({addr.latitude}, {addr.longitude})</span>
                        </p>
                      )}
                    </div>

                    <div className="pt-2 border-t border-line flex items-center justify-between">
                      {!addr.is_default ? (
                        <button
                          type="button"
                          onClick={() => handleSetDefault(addr.id)}
                          className="text-xs font-bold text-forest-800 hover:underline cursor-pointer"
                        >
                          Set as Default
                        </button>
                      ) : (
                        <span className="text-xs text-leaf-700 font-bold flex items-center gap-1">
                          <Check className="w-3.5 h-3.5 text-leaf-600" />
                          <span>Primary Delivery Address</span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
