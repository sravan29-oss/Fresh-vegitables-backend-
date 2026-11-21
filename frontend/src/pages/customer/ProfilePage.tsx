import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, MapPin, Plus, Trash2, CheckCircle2, Phone, Mail, Navigation, AlertCircle, Loader2, CheckCircle, LogOut, Package, Wallet, ArrowLeft } from 'lucide-react';
import api from '../../services/api';
import { Address } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { SEOHead } from '../../components/common/SEOHead';

export const ProfilePage: React.FC = () => {
  const { user, updateUser, logout, showLogoutConfirm, showLogoutSuccess, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [name, setName] = useState(user?.name || '');
  const [mobile, setMobile] = useState(user?.mobile || '');
  const [isUpdating, setIsUpdating] = useState(false);
  const [message, setMessage] = useState('');

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
      pincode: '500072',
      latitude: initLat,
      longitude: initLng,
      address_type: 'home',
      is_default: false,
    };
  });

  // Fetch and auto-fill customer basic details into newAddress
  const fetchUserBasicDetails = useCallback(async () => {
    let nameVal = user?.name || '';
    let phoneVal = user?.mobile || '';

    if (!nameVal || !phoneVal) {
      try {
        const res = await api.get('/auth/profile');
        if (res.data?.data) {
          const profile = res.data.data;
          nameVal = nameVal || profile.name || '';
          phoneVal = phoneVal || profile.mobile || '';
        }
      } catch (err) {}
    }

    const cleanPhone = phoneVal ? phoneVal.replace(/\D/g, '').slice(-10) : '';

    setNewAddress((prev) => ({
      ...prev,
      full_name: nameVal || prev.full_name,
      phone: cleanPhone || prev.phone,
    }));
  }, [user]);

  // Auto-sync whenever user state is updated
  useEffect(() => {
    if (user?.name || user?.mobile) {
      fetchUserBasicDetails();
    }
  }, [user, fetchUserBasicDetails]);

  const handleToggleAddAddress = () => {
    if (!isAddingAddress) {
      fetchUserBasicDetails();
    }
    setIsAddingAddress(!isAddingAddress);
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
          message: `Serviceable in ${data.zone.name}! Express delivery active.`,
        });
      } else {
        setZoneServiceability({
          checked: true,
          serviceable: false,
          message: data?.message || `Currently unavailable for delivery to pincode ${clean}.`,
        });
      }
    } catch {
      const serviceableList = [
        '500072', '500085', '500090', '500018',
        '500081', '500032', '500084', '500046',
        '500049', '500050', '500019',
        '380009', '380015', '380006', '380054'
      ];
      const isServ = serviceableList.includes(clean);
      setZoneServiceability({
        checked: true,
        serviceable: isServ,
        zoneName: isServ ? 'Express Delivery Hub' : undefined,
        message: isServ
          ? 'Serviceable delivery zone! Express delivery active.'
          : `Currently unavailable for delivery: Pincode ${clean} is outside our active delivery zones.`,
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

        let detectedPincode = '';
        let detectedArea = '';
        let detectedCity = '';
        let detectedState = '';
        let detectedHouse = '';

        try {
          const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
          if (apiKey) {
            const gRes = await fetch(
              `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${apiKey}`
            );
            const gData = await gRes.json();
            if (gData.results && gData.results.length > 0) {
              const result = gData.results[0];
              for (const comp of result.address_components) {
                if (comp.types.includes('postal_code')) detectedPincode = comp.long_name;
                if (comp.types.includes('sublocality_level_1') || comp.types.includes('sublocality')) {
                  detectedArea = comp.long_name;
                }
                if (comp.types.includes('locality')) detectedCity = comp.long_name;
                if (comp.types.includes('administrative_area_level_1')) detectedState = comp.long_name;
                if (comp.types.includes('premise') || comp.types.includes('street_number')) {
                  detectedHouse = comp.long_name;
                }
              }
            }
          }
        } catch (e) {
          console.warn('Google reverse geocode error:', e);
        }

        if (!detectedPincode || !detectedArea) {
          try {
            const nomRes = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
            );
            const nomData = await nomRes.json();
            if (nomData?.address) {
              const a = nomData.address;
              if (!detectedPincode && a.postcode) detectedPincode = a.postcode.replace(/\D/g, '').slice(0, 6);
              if (!detectedArea) detectedArea = a.suburb || a.neighbourhood || a.road || '';
              if (!detectedCity) detectedCity = a.city || a.town || a.county || '';
              if (!detectedState) detectedState = a.state || '';
            }
          } catch (e) {
            console.warn('Nominatim reverse geocode error:', e);
          }
        }

        const isNearHyderabad = latitude >= 17.1 && latitude <= 17.7 && longitude >= 78.1 && longitude <= 78.7;
        const isNearAhmedabad = latitude >= 22.8 && latitude <= 23.3 && longitude >= 72.3 && longitude <= 72.8;

        if (!detectedPincode) {
          if (isNearHyderabad) detectedPincode = '500081';
          else if (isNearAhmedabad) detectedPincode = '380015';
        }

        if (!detectedCity) {
          if (isNearHyderabad) detectedCity = 'Hyderabad';
          else if (isNearAhmedabad) detectedCity = 'Ahmedabad';
        }

        if (!detectedState) {
          if (isNearHyderabad) detectedState = 'Telangana';
          else if (isNearAhmedabad) detectedState = 'Gujarat';
        }

        setNewAddress((prev) => ({
          ...prev,
          latitude: Number(latitude.toFixed(6)),
          longitude: Number(longitude.toFixed(6)),
          house_number: detectedHouse || prev.house_number,
          area: detectedArea || prev.area,
          city: detectedCity || prev.city,
          state: detectedState || prev.state,
          pincode: detectedPincode || prev.pincode,
        }));

        setIsDetectingLocation(false);

        if (detectedPincode) {
          checkPincodeServiceability(detectedPincode);
        } else if (!isNearHyderabad && !isNearAhmedabad) {
          setZoneServiceability({
            checked: true,
            serviceable: false,
            message: 'Currently Unavailable: Your GPS location is outside our fresh delivery zones.',
          });
        }
      },
      (err) => {
        setIsDetectingLocation(false);
        if (newAddress.pincode) {
          checkPincodeServiceability(newAddress.pincode);
        }
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  useEffect(() => {
    if (isAddingAddress) {
      detectCurrentLocation();
    } else {
      setZoneServiceability({ checked: false, serviceable: true });
    }
  }, [isAddingAddress]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/login?redirect=/profile');
      return;
    }

    api.get('/addresses')
      .then((res) => {
        if (res.data?.data) setAddresses(res.data.data);
      })
      .catch((err) => console.error(err));
  }, [user, authLoading, navigate]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsUpdating(true);
      const res = await api.put('/auth/profile', { name, mobile });
      if (res.data?.data) {
        updateUser(res.data.data);
        setMessage('Profile updated successfully!');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update profile');
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

  const handleCreateAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (zoneServiceability.checked && !zoneServiceability.serviceable) {
      alert(
        zoneServiceability.message ||
          'Currently Unavailable: Delivery is not available to this address as it is outside our active delivery zones.'
      );
      return;
    }
    try {
      const payload = { ...newAddress };
      if (!payload.latitude || !payload.longitude) {
        try {
          const savedZone = localStorage.getItem('fresh_delivery_zone');
          if (savedZone) {
            const parsed = JSON.parse(savedZone);
            if (parsed.latitude && parsed.longitude) {
              payload.latitude = Number(parsed.latitude);
              payload.longitude = Number(parsed.longitude);
            }
          }
        } catch {}
      }

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
    if (!confirm('Are you sure you want to remove this address?')) return;
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

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-8 font-sans animate-slide-up">
      <SEOHead title="Account & Addresses | Fresh Vegetables Organic" noindex={true} />

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-semibold text-ink-500">
        <Link to="/" className="hover:text-forest-900 transition-colors">Home</Link>
        <span className="text-ink-300">/</span>
        <span className="text-ink-900 font-bold">Profile & Addresses</span>
      </nav>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-ink-900 tracking-tight">Account & Addresses</h1>
          <p className="text-xs sm:text-sm text-ink-500 mt-1">Manage your customer profile, orders, and delivery addresses</p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="self-start sm:self-auto flex items-center gap-2 px-4 py-2.5 rounded-full bg-tomato-50 hover:bg-tomato-100 text-tomato-600 border border-tomato-200 text-xs font-bold transition-all cursor-pointer min-h-[40px]"
          title="Sign Out of Account"
        >
          <LogOut className="w-4 h-4 text-tomato-500" />
          <span>Sign Out</span>
        </button>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Link
          to="/orders"
          className="flex items-center gap-3 p-4 rounded-2xl bg-surface border border-line shadow-soft hover:border-leaf-500/50 hover:shadow-soft-md transition-all group"
        >
          <div className="w-10 h-10 rounded-xl bg-sage-100 text-forest-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <Package className="w-5 h-5" />
          </div>
          <div className="overflow-hidden">
            <p className="font-bold text-xs sm:text-sm text-ink-900 group-hover:text-forest-900 transition-colors truncate">My Orders</p>
            <p className="text-[11px] text-ink-400 font-medium truncate">Track live & history</p>
          </div>
        </Link>

        <Link
          to="/wallet"
          className="flex items-center gap-3 p-4 rounded-2xl bg-surface border border-line shadow-soft hover:border-marigold-500/50 hover:shadow-soft-md transition-all group"
        >
          <div className="w-10 h-10 rounded-xl bg-cream-200 text-marigold-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <Wallet className="w-5 h-5" />
          </div>
          <div className="overflow-hidden">
            <p className="font-bold text-xs sm:text-sm text-ink-900 group-hover:text-forest-900 transition-colors truncate">Wallet & Rewards</p>
            <p className="text-[11px] text-ink-400 font-medium truncate">Credits & balance</p>
          </div>
        </Link>

        <button
          type="button"
          onClick={handleLogout}
          className="col-span-2 sm:col-span-1 flex items-center gap-3 p-4 rounded-2xl bg-surface hover:bg-tomato-50/50 border border-line shadow-soft hover:border-tomato-300 transition-all text-left cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-xl bg-tomato-50 text-tomato-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <LogOut className="w-5 h-5" />
          </div>
          <div className="overflow-hidden">
            <p className="font-bold text-xs sm:text-sm text-tomato-600 truncate">Sign Out</p>
            <p className="text-[11px] text-ink-400 font-medium truncate">End session safely</p>
          </div>
        </button>
      </div>

      {message && (
        <div className="p-4 bg-sage-50 border border-leaf-500/30 text-forest-900 text-xs font-bold rounded-2xl flex items-center gap-2 shadow-soft">
          <CheckCircle className="w-4 h-4 text-forest-700" />
          <span>{message}</span>
        </div>
      )}

      {/* 1. Profile Details Card */}
      <div className="bg-surface p-6 sm:p-8 rounded-3xl border border-line shadow-soft space-y-5">
        <div className="flex items-center gap-2 pb-3 border-b border-line">
          <User className="w-5 h-5 text-forest-700" />
          <h2 className="font-serif font-bold text-lg text-ink-900">Personal Information</h2>
        </div>

        <form onSubmit={handleUpdateProfile} className="space-y-4 max-w-lg text-xs">
          <div>
            <label className="font-bold text-ink-800 block mb-1">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-organic w-full p-3 border border-line rounded-xl bg-cream-50/50 focus:bg-white text-ink-900 font-medium"
            />
          </div>

          <div>
            <label className="font-bold text-ink-800 block mb-1">Email Address (Read-only)</label>
            <input
              type="email"
              disabled
              value={user?.email || ''}
              className="w-full p-3 border border-line rounded-xl bg-cream-100 text-ink-400 cursor-not-allowed font-medium"
            />
          </div>

          <div>
            <label className="font-bold text-ink-800 block mb-1">Mobile Number (10 digits)</label>
            <input
              type="tel"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              className="input-organic w-full p-3 border border-line rounded-xl bg-cream-50/50 focus:bg-white text-ink-900 font-medium font-mono"
            />
          </div>

          <button
            type="submit"
            disabled={isUpdating}
            className="btn-pill-primary bg-forest-900 hover:bg-forest-850 text-cream-50 font-bold text-xs px-6 py-3 rounded-full shadow-soft transition-all min-h-[44px] cursor-pointer disabled:opacity-50"
          >
            {isUpdating ? 'Saving Changes...' : 'Save Profile Changes'}
          </button>
        </form>
      </div>

      {/* 2. Addresses Management */}
      <div className="bg-surface p-6 sm:p-8 rounded-3xl border border-line shadow-soft space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-line flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-forest-700" />
            <h2 className="font-serif font-bold text-lg text-ink-900">Saved Delivery Addresses</h2>
          </div>
          <button
            type="button"
            onClick={handleToggleAddAddress}
            className="text-xs font-bold text-forest-700 hover:text-forest-900 flex items-center gap-1.5 cursor-pointer py-1 px-3 rounded-full hover:bg-cream-100 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Address</span>
          </button>
        </div>

        {isAddingAddress && (
          <form onSubmit={handleCreateAddress} className="p-5 sm:p-6 rounded-2xl bg-cream-50 border border-line space-y-4 text-xs mb-6 shadow-soft animate-slide-up">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="font-serif font-bold text-ink-900 text-sm">Add New Address</h3>
              <button
                type="button"
                onClick={detectCurrentLocation}
                disabled={isDetectingLocation}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-surface hover:bg-cream-100 text-forest-800 text-xs font-bold rounded-full border border-line transition-all cursor-pointer disabled:opacity-50 min-h-[38px] shadow-soft"
              >
                {isDetectingLocation ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-forest-700" />
                    <span>Auto-Fetching GPS...</span>
                  </>
                ) : (
                  <>
                    <Navigation className="w-3.5 h-3.5 text-forest-700 fill-current" />
                    <span>Auto-Fetch GPS</span>
                  </>
                )}
              </button>
            </div>

            {/* Out of zone warning banner */}
            {zoneServiceability.checked && !zoneServiceability.serviceable && (
              <div className="p-3.5 bg-marigold-50 border border-marigold-200 rounded-xl flex items-start gap-2.5 text-ink-900 shadow-soft">
                <AlertCircle className="w-4 h-4 text-marigold-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-xs uppercase font-serif text-ink-900">Currently Outside Service Zone</p>
                  <p className="text-xs text-ink-600 mt-0.5 font-medium leading-relaxed">
                    {zoneServiceability.message || 'We deliver within 5 km of our Champapet & KPHB hubs.'}
                  </p>
                </div>
              </div>
            )}

            {zoneServiceability.checked && zoneServiceability.serviceable && (
              <div className="p-3 bg-sage-50 border border-leaf-500/30 rounded-xl flex items-center gap-2 text-forest-900 text-xs font-bold shadow-soft">
                <CheckCircle className="w-4 h-4 text-forest-700 shrink-0" />
                <span>{zoneServiceability.message || `Serviceable: ${zoneServiceability.zoneName}`}</span>
              </div>
            )}

            <div className="flex items-center justify-between pb-1 border-b border-line">
              <span className="font-bold text-ink-800 text-xs">Recipient Details</span>
              <button
                type="button"
                onClick={fetchUserBasicDetails}
                className="text-[11px] font-bold text-forest-700 hover:text-forest-900 flex items-center gap-1 cursor-pointer"
                title="Auto-fetch your profile details"
              >
                <User className="w-3.5 h-3.5" />
                <span>Fetch My Details</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <input
                  type="text"
                  placeholder="Full Name *"
                  required
                  value={newAddress.full_name}
                  onChange={(e) => setNewAddress({ ...newAddress, full_name: e.target.value })}
                  className="input-organic w-full p-3 bg-surface border border-line rounded-xl focus:outline-none focus:border-leaf-500 text-xs font-medium text-ink-900"
                />
              </div>
              <div className="relative flex items-center">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-ink-600 text-xs select-none">
                  +91
                </span>
                <input
                  type="tel"
                  placeholder="9876543210 *"
                  required
                  maxLength={10}
                  value={newAddress.phone}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, '');
                    const clean = raw.length === 12 && raw.startsWith('91') ? raw.slice(2) : raw.slice(0, 10);
                    setNewAddress({ ...newAddress, phone: clean });
                  }}
                  className="input-organic w-full pl-12 pr-3 py-3 bg-surface border border-line rounded-xl focus:outline-none focus:border-leaf-500 text-xs font-mono font-medium text-ink-900"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="House / Flat No. *"
                required
                value={newAddress.house_number}
                onChange={(e) => setNewAddress({ ...newAddress, house_number: e.target.value })}
                className="input-organic p-3 bg-surface border border-line rounded-xl text-xs font-medium text-ink-900"
              />
              <input
                type="text"
                placeholder="Street / Colony"
                value={newAddress.street}
                onChange={(e) => setNewAddress({ ...newAddress, street: e.target.value })}
                className="input-organic p-3 bg-surface border border-line rounded-xl text-xs font-medium text-ink-900"
              />
            </div>
            <input
              type="text"
              placeholder="Area / Locality *"
              required
              value={newAddress.area}
              onChange={(e) => setNewAddress({ ...newAddress, area: e.target.value })}
              className="input-organic w-full p-3 bg-surface border border-line rounded-xl text-xs font-medium text-ink-900"
            />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                placeholder="City"
                required
                value={newAddress.city}
                onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                className="input-organic p-3 bg-surface border border-line rounded-xl text-xs font-medium text-ink-900"
              />
              <input
                type="text"
                placeholder="State"
                required
                value={newAddress.state}
                onChange={(e) => setNewAddress({ ...newAddress, state: e.target.value })}
                className="input-organic p-3 bg-surface border border-line rounded-xl text-xs font-medium text-ink-900"
              />
              <input
                type="text"
                placeholder="Pincode *"
                required
                maxLength={6}
                value={newAddress.pincode}
                onChange={(e) => {
                  const pin = e.target.value;
                  setNewAddress({ ...newAddress, pincode: pin });
                  if (pin.length === 6) {
                    checkPincodeServiceability(pin);
                  } else {
                    setZoneServiceability({ checked: false, serviceable: true });
                  }
                }}
                className="input-organic p-3 bg-surface border border-line rounded-xl font-mono text-xs font-medium text-ink-900"
              />
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="submit"
                disabled={zoneServiceability.checked && !zoneServiceability.serviceable}
                className="btn-pill-primary font-bold px-6 py-3 rounded-full text-xs transition-all bg-forest-900 hover:bg-forest-850 text-cream-50 disabled:bg-cream-200 disabled:text-ink-400 disabled:cursor-not-allowed shadow-soft min-h-[44px]"
              >
                {zoneServiceability.checked && !zoneServiceability.serviceable
                  ? 'Currently Out of Service Zone'
                  : 'Save Delivery Address'}
              </button>
              <button
                type="button"
                onClick={() => setIsAddingAddress(false)}
                className="bg-cream-100 hover:bg-cream-200/80 text-ink-700 font-bold px-5 py-3 rounded-full text-xs transition-colors border border-line min-h-[44px]"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {addresses.map((a) => (
            <div
              key={a.id}
              className={`p-5 rounded-2xl border transition-all ${
                a.is_default ? 'border-leaf-500 bg-sage-50/60 shadow-soft' : 'border-line bg-surface'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <span className="font-bold text-xs uppercase tracking-wider text-ink-800 bg-cream-100 px-2 py-0.5 rounded-md border border-line">
                  {a.address_type}
                </span>
                <div className="flex items-center gap-2">
                  {!a.is_default && (
                    <button
                      type="button"
                      onClick={() => handleSetDefault(a.id)}
                      className="text-[11px] text-forest-700 hover:text-forest-900 hover:underline font-bold cursor-pointer"
                    >
                      Make Default
                    </button>
                  )}
                  {a.is_default && (
                    <span className="text-[10px] font-bold text-forest-800 bg-sage-100 px-2 py-0.5 rounded-full border border-leaf-500/20">
                      Default
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDeleteAddress(a.id)}
                    className="text-ink-400 hover:text-tomato-500 p-1 transition-colors cursor-pointer"
                    title="Remove address"
                    aria-label="Remove address"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <p className="font-bold text-xs text-ink-900">{a.full_name} • <span className="font-mono">{a.phone}</span></p>
              <p className="text-xs text-ink-500 mt-1 leading-relaxed">
                {[a.house_number, a.street, a.area, a.landmark, a.city, a.pincode]
                  .filter(Boolean)
                  .join(', ')}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Account Session & Logout Section */}
      <div className="bg-surface p-5 sm:p-6 rounded-3xl border border-line shadow-soft flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold text-ink-900 font-serif">Signed In Account</p>
          <p className="text-[11px] text-ink-500 mt-0.5">{user?.name} ({user?.email || user?.mobile || 'Active Customer'})</p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-tomato-50 hover:bg-tomato-100 text-tomato-600 border border-tomato-200 text-xs font-bold transition-all cursor-pointer min-h-[40px]"
        >
          <LogOut className="w-4 h-4" />
          <span>Log Out of Account</span>
        </button>
      </div>
    </div>
  );
};

export default ProfilePage;
