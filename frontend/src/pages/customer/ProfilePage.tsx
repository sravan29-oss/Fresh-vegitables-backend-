import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, MapPin, Plus, Trash2, CheckCircle2, Phone, Mail, Navigation, AlertCircle, Loader2, CheckCircle } from 'lucide-react';
import api from '../../services/api';
import { Address } from '../../types';
import { useAuth } from '../../context/AuthContext';

export const ProfilePage: React.FC = () => {
  const { user, updateUser, isLoading: authLoading } = useAuth();
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

  const [newAddress, setNewAddress] = useState({
    full_name: user?.name || '',
    phone: user?.mobile || '',
    house_number: '',
    street: '',
    area: '',
    landmark: '',
    city: 'Ahmedabad',
    state: 'Gujarat',
    pincode: '380015',
    address_type: 'home' as 'home' | 'work' | 'other',
    is_default: false,
  });

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
          ? 'Serviceable delivery zone! Express 30 mins delivery.'
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
      const res = await api.post('/addresses', newAddress);
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
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      <div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Account & Addresses</h1>
        <p className="text-xs text-slate-500 mt-1">Manage your personal information and delivery destinations</p>
      </div>

      {message && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold rounded-2xl">
          ✓ {message}
        </div>
      )}

      {/* 1. Profile Details Card */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-sm space-y-5">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <User className="w-5 h-5 text-brand-600" />
          <h3 className="text-lg font-bold text-slate-900">Personal Information</h3>
        </div>

        <form onSubmit={handleUpdateProfile} className="space-y-4 max-w-lg text-xs">
          <div>
            <label className="font-bold text-slate-700 block mb-1">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-3 border rounded-xl bg-slate-50 focus:bg-white"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Email Address (Read-only)</label>
            <input
              type="email"
              disabled
              value={user?.email || ''}
              className="w-full p-3 border rounded-xl bg-slate-100 text-slate-500 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Mobile Number</label>
            <input
              type="tel"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              className="w-full p-3 border rounded-xl bg-slate-50 focus:bg-white"
            />
          </div>

          <button
            type="submit"
            disabled={isUpdating}
            className="bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs px-6 py-3 rounded-xl shadow-md transition-colors"
          >
            {isUpdating ? 'Saving...' : 'Save Profile Changes'}
          </button>
        </form>
      </div>

      {/* 2. Addresses Management */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-sm space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-brand-600" />
            <h3 className="text-lg font-bold text-slate-900">Saved Addresses</h3>
          </div>
          <button
            onClick={() => setIsAddingAddress(!isAddingAddress)}
            className="text-xs font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Address</span>
          </button>
        </div>

        {isAddingAddress && (
          <form onSubmit={handleCreateAddress} className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4 text-xs mb-6">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-800 text-sm">Add Delivery Address</h4>
              <button
                type="button"
                onClick={detectCurrentLocation}
                disabled={isDetectingLocation}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-700 text-xs font-bold rounded-xl border border-brand-200 transition-all cursor-pointer disabled:opacity-50"
              >
                {isDetectingLocation ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Auto-Fetching...</span>
                  </>
                ) : (
                  <>
                    <Navigation className="w-3.5 h-3.5 text-brand-600 fill-current" />
                    <span>Auto-Fetch GPS</span>
                  </>
                )}
              </button>
            </div>

            {/* Out of zone warning banner */}
            {zoneServiceability.checked && !zoneServiceability.serviceable && (
              <div className="p-3.5 bg-rose-50 border-2 border-rose-300 rounded-xl flex items-start gap-2 text-rose-800">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-xs uppercase text-rose-700">Currently Unavailable for Delivery</p>
                  <p className="text-xs text-rose-600 mt-0.5 font-medium">
                    {zoneServiceability.message || 'We do not deliver to this location yet.'}
                  </p>
                </div>
              </div>
            )}

            {zoneServiceability.checked && zoneServiceability.serviceable && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-800 text-xs font-bold">
                <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>{zoneServiceability.message || `Serviceable: ${zoneServiceability.zoneName}`}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Full Name"
                required
                value={newAddress.full_name}
                onChange={(e) => setNewAddress({ ...newAddress, full_name: e.target.value })}
                className="p-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-brand-500"
              />
              <input
                type="tel"
                placeholder="Mobile (10 digits)"
                required
                value={newAddress.phone}
                onChange={(e) => setNewAddress({ ...newAddress, phone: e.target.value })}
                className="p-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-brand-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="House / Flat No."
                required
                value={newAddress.house_number}
                onChange={(e) => setNewAddress({ ...newAddress, house_number: e.target.value })}
                className="p-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-brand-500"
              />
              <input
                type="text"
                placeholder="Street / Colony"
                value={newAddress.street}
                onChange={(e) => setNewAddress({ ...newAddress, street: e.target.value })}
                className="p-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-brand-500"
              />
            </div>
            <input
              type="text"
              placeholder="Area / Locality"
              required
              value={newAddress.area}
              onChange={(e) => setNewAddress({ ...newAddress, area: e.target.value })}
              className="w-full p-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-brand-500"
            />
            <div className="grid grid-cols-3 gap-3">
              <input
                type="text"
                placeholder="City"
                required
                value={newAddress.city}
                onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                className="p-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-brand-500"
              />
              <input
                type="text"
                placeholder="State"
                required
                value={newAddress.state}
                onChange={(e) => setNewAddress({ ...newAddress, state: e.target.value })}
                className="p-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-brand-500"
              />
              <input
                type="text"
                placeholder="Pincode"
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
                className="p-2.5 bg-white border border-slate-200 rounded-xl font-mono focus:outline-none focus:border-brand-500"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={zoneServiceability.checked && !zoneServiceability.serviceable}
                className={`font-bold px-5 py-2.5 rounded-xl text-xs transition-all ${
                  zoneServiceability.checked && !zoneServiceability.serviceable
                    ? 'bg-rose-100 text-rose-500 border border-rose-300 cursor-not-allowed opacity-70'
                    : 'bg-brand-600 hover:bg-brand-700 text-white cursor-pointer shadow-md shadow-brand-600/20'
                }`}
              >
                {zoneServiceability.checked && !zoneServiceability.serviceable
                  ? 'Currently Unavailable - Out of Zone'
                  : 'Save Address'}
              </button>
              <button
                type="button"
                onClick={() => setIsAddingAddress(false)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-4 py-2.5 rounded-xl text-xs transition-colors"
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
              className={`p-4 rounded-2xl border transition-all ${
                a.is_default ? 'border-brand-500 bg-brand-50/40' : 'border-slate-200'
              }`}
            >
              <div className="flex justify-between items-start mb-1">
                <span className="font-bold text-xs uppercase tracking-wider text-slate-800">
                  {a.address_type}
                </span>
                <div className="flex items-center gap-2">
                  {!a.is_default && (
                    <button
                      onClick={() => handleSetDefault(a.id)}
                      className="text-[10px] text-brand-600 hover:underline font-bold"
                    >
                      Make Default
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteAddress(a.id)}
                    className="text-slate-300 hover:text-rose-500"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <p className="font-semibold text-xs text-slate-800">{a.full_name} • {a.phone}</p>
              <p className="text-xs text-slate-500 mt-1">
                {[a.house_number, a.street, a.area, a.landmark, a.city, a.pincode]
                  .filter(Boolean)
                  .join(', ')}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
