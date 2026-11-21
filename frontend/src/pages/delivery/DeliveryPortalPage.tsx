import React, { useState, useEffect, useRef } from 'react';
import {
  Truck,
  Phone,
  MapPin,
  Navigation,
  CheckCircle2,
  Clock,
  KeyRound,
  AlertTriangle,
  LogOut,
  RefreshCw,
  ShoppingBag,
  ExternalLink,
  ShieldCheck,
  User,
  Radio,
  Building2,
  Check,
} from 'lucide-react';
import api from '../../services/api';

export const DeliveryPortalPage: React.FC = () => {
  // Auth state
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('delivery_token'));
  const [driver, setDriver] = useState<any>(null);

  // Login form
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPin, setLoginPin] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Tasks
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');

  // GPS sharing state
  const [isGpsSharing, setIsGpsSharing] = useState<boolean>(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [lastCoords, setLastCoords] = useState<{ lat: number; lng: number; time: string } | null>(null);
  const watchIdRef = useRef<number | null>(null);

  // Modals
  const [otpModalAssignment, setOtpModalAssignment] = useState<any | null>(null);
  const [otpValue, setOtpValue] = useState('');
  const [codAmountCollected, setCodAmountCollected] = useState('');
  const [submittingOtp, setSubmittingOtp] = useState(false);

  const [failModalAssignment, setFailModalAssignment] = useState<any | null>(null);
  const [failReason, setFailReason] = useState('customer_unavailable');
  const [failNotes, setFailNotes] = useState('');
  const [submittingFail, setSubmittingFail] = useState(false);

  // Fetch driver profile and assignments
  const fetchDriverData = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const [meRes, assignRes] = await Promise.all([
        api.get('/delivery/driver/me', { headers: { Authorization: `Bearer ${token}` } }),
        api.get('/delivery/driver/assignments', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (meRes.data?.data) {
        setDriver(meRes.data.data);
      }
      if (assignRes.data?.data && Array.isArray(assignRes.data.data)) {
        setAssignments(assignRes.data.data);
      }
    } catch (err: any) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        handleLogout();
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchDriverData();
    }
  }, [token]);

  // Clean up GPS tracking on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // Handle Driver Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoggingIn(true);
      setLoginError(null);
      const res = await api.post('/delivery/auth/login', {
        phone: loginPhone.trim(),
        pin_code: loginPin.trim(),
      });

      if (res.data?.data?.token) {
        const receivedToken = res.data.data.token;
        localStorage.setItem('delivery_token', receivedToken);
        setToken(receivedToken);
        setDriver(res.data.data.partner);
      }
    } catch (err: any) {
      setLoginError(err.response?.data?.message || 'Login failed. Please check your phone number and PIN.');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = () => {
    stopGpsSharing();
    localStorage.removeItem('delivery_token');
    setToken(null);
    setDriver(null);
    setAssignments([]);
  };

  // GPS Sharing Control
  const startGpsSharing = () => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser');
      return;
    }

    setGpsError(null);
    setIsGpsSharing(true);

    const sendLocation = async (position: GeolocationPosition) => {
      const { latitude, longitude, accuracy } = position.coords;
      setLastCoords({
        lat: latitude,
        lng: longitude,
        time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      });

      try {
        await api.post(
          '/delivery/driver/location',
          { latitude, longitude, accuracy },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } catch (e: any) {
        console.warn('GPS update failed:', e.response?.data?.message);
      }
    };

    // Immediate first check
    navigator.geolocation.getCurrentPosition(
      sendLocation,
      (err) => {
        setGpsError(`GPS Permission error: ${err.message}`);
        setIsGpsSharing(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );

    // Watch position updates
    watchIdRef.current = navigator.geolocation.watchPosition(
      sendLocation,
      (err) => console.warn('Watch position error:', err.message),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 }
    );
  };

  const stopGpsSharing = () => {
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsGpsSharing(false);
  };

  // Status transitions
  const handleUpdateStatus = async (assignmentId: string, nextStatus: string) => {
    try {
      await api.put(
        `/delivery/assignments/${assignmentId}/status`,
        { status: nextStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (nextStatus === 'OUT_FOR_DELIVERY' && !isGpsSharing) {
        // Prompt to enable GPS
        startGpsSharing();
      }
      fetchDriverData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update status');
    }
  };

  // OTP Verification
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpModalAssignment || !otpValue) return;

    const isCod = (otpModalAssignment.payment_method || '').toLowerCase() === 'cod';
    if (isCod) {
      const orderTotal = Number(otpModalAssignment.total_amount || 0);
      const collected = Number(codAmountCollected);
      if (isNaN(collected) || Math.abs(collected - orderTotal) > 0.01) {
        alert(`COD Collection Mismatch: Exact order total of ₹${orderTotal.toFixed(2)} must be collected.`);
        return;
      }
    }

    try {
      setSubmittingOtp(true);
      await api.post(
        `/delivery/assignments/${otpModalAssignment.id}/verify-otp`,
        {
          otp: otpValue.trim(),
          cod_amount_collected: isCod ? Number(codAmountCollected) : undefined,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert('Delivery completed successfully! OTP verified.');
      setOtpModalAssignment(null);
      setOtpValue('');
      setCodAmountCollected('');
      fetchDriverData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'OTP verification failed');
    } finally {
      setSubmittingOtp(false);
    }
  };

  // Failure Submission
  const handleReportFailure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!failModalAssignment) return;

    try {
      setSubmittingFail(true);
      await api.post(
        `/delivery/assignments/${failModalAssignment.id}/fail`,
        { reason: failReason, notes: failNotes },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert('Delivery failure recorded.');
      setFailModalAssignment(null);
      setFailReason('customer_unavailable');
      setFailNotes('');
      fetchDriverData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to record failure');
    } finally {
      setSubmittingFail(false);
    }
  };

  // Split active vs completed
  const activeAssignments = assignments.filter((a) => !['DELIVERED', 'CANCELLED', 'DELIVERY_FAILED'].includes(a.status));
  const completedAssignments = assignments.filter((a) => ['DELIVERED', 'DELIVERY_FAILED'].includes(a.status));

  // If NOT logged in, show mobile login screen
  if (!token) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 font-sans text-slate-100">
        <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-forest-900/60 border border-forest-700/50 flex items-center justify-center mx-auto text-emerald-400">
              <Truck className="w-7 h-7" />
            </div>
            <h1 className="text-xl font-black text-white tracking-tight">Delivery Fleet Portal</h1>
            <p className="text-xs text-slate-400">Fresh Vegetables Organic — Hyderabad Hubs</p>
          </div>

          {loginError && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-900 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Registered Mobile Number
              </label>
              <input
                type="tel"
                required
                placeholder="+91 9848011221"
                value={loginPhone}
                onChange={(e) => setLoginPhone(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-brand-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                4-Digit Driver PIN
              </label>
              <input
                type="password"
                required
                maxLength={6}
                placeholder="1234"
                value={loginPin}
                onChange={(e) => setLoginPin(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-brand-500 font-mono tracking-widest text-center"
              />
            </div>

            <button
              type="submit"
              disabled={loggingIn || !loginPhone}
              className="w-full bg-brand-500 hover:bg-brand-400 disabled:opacity-40 text-slate-950 py-3.5 rounded-xl font-black text-sm shadow-lg shadow-brand-500/20 transition-all cursor-pointer"
            >
              {loggingIn ? 'Authenticating...' : 'Sign In to Driver App'}
            </button>
          </form>

          {/* Quick Demo Helper */}
          <div className="pt-4 border-t border-slate-800/80 text-center space-y-2">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Dedicated Driver Credentials:</span>
            <div className="flex gap-2 justify-center">
              <button
                type="button"
                onClick={() => {
                  setLoginPhone('+91 9848011221');
                  setLoginPin('7482');
                }}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-brand-400 rounded-lg text-[10px] font-bold border border-slate-700 transition-colors"
              >
                Champapet (PIN 7482)
              </button>
              <button
                type="button"
                onClick={() => {
                  setLoginPhone('+91 9848022332');
                  setLoginPin('5928');
                }}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-purple-400 rounded-lg text-[10px] font-bold border border-slate-700 transition-colors"
              >
                KPHB (PIN 5928)
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // LOGGED IN DRIVER PORTAL
  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-100 pb-16">
      {/* Mobile Top App Bar */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-3">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-forest-900/50 border border-forest-700 flex items-center justify-center text-brand-400">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xs font-black text-white leading-tight">{driver?.name || 'Driver'}</h2>
              <p className="text-[10px] text-brand-400 font-bold flex items-center gap-1">
                <Building2 className="w-3 h-3" />
                {driver?.assigned_hub_name || 'Assigned Hub'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchDriverData}
              disabled={loading}
              className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleLogout}
              className="p-2 rounded-xl bg-rose-950/40 border border-rose-900/50 text-rose-400 hover:bg-rose-900/40 transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-4">
        {/* GPS Location Sharing Banner */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-3 h-3 rounded-full ${
                  isGpsSharing ? 'bg-emerald-400 animate-ping' : 'bg-slate-600'
                }`}
              />
              <div>
                <h3 className="text-xs font-bold text-white">
                  {isGpsSharing ? 'Live GPS Sharing Active' : 'GPS Location Sharing Paused'}
                </h3>
                <p className="text-[10px] text-slate-400">
                  {isGpsSharing && lastCoords
                    ? `Updated at ${lastCoords.time}`
                    : 'Turn on during active delivery routes'}
                </p>
              </div>
            </div>

            <button
              onClick={isGpsSharing ? stopGpsSharing : startGpsSharing}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                isGpsSharing
                  ? 'bg-rose-950 text-rose-300 border border-rose-800 hover:bg-rose-900'
                  : 'bg-emerald-950 text-emerald-300 border border-emerald-800 hover:bg-emerald-900'
              }`}
            >
              {isGpsSharing ? 'Pause GPS' : 'Share GPS'}
            </button>
          </div>

          {gpsError && (
            <p className="text-[11px] text-rose-400 bg-rose-950/30 p-2 rounded-lg border border-rose-900/50">
              {gpsError}
            </p>
          )}
        </div>

        {/* Tab Switcher: Active vs Completed */}
        <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('active')}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'active'
                ? 'bg-brand-500 text-slate-950 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Assigned Deliveries ({activeAssignments.length})
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'completed'
                ? 'bg-brand-500 text-slate-950 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            History ({completedAssignments.length})
          </button>
        </div>

        {/* Deliveries List */}
        {activeTab === 'active' ? (
          activeAssignments.length === 0 ? (
            <div className="text-center py-12 px-4 rounded-2xl border border-dashed border-slate-800 bg-slate-900/20 space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-500/40 mx-auto" />
              <h4 className="text-sm font-bold text-white">No Pending Deliveries</h4>
              <p className="text-xs text-slate-500">
                You are all caught up! New orders assigned by your hub will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {activeAssignments.map((task) => {
                const isAssigned = task.status === 'DRIVER_ASSIGNED';
                const isPickedUp = task.status === 'PICKED_UP';
                const isOut = task.status === 'OUT_FOR_DELIVERY';

                const gmapsUrl = task.destination_lat && task.destination_lng
                  ? `https://www.google.com/maps/dir/?api=1&destination=${task.destination_lat},${task.destination_lng}`
                  : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(task.delivery_address || 'Hyderabad')}`;

                return (
                  <div
                    key={task.id}
                    className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl"
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <div>
                        <span className="font-mono text-xs font-bold text-brand-400">
                          #{task.order_number}
                        </span>
                        <h4 className="text-sm font-black text-white mt-0.5">{task.customer_name}</h4>
                      </div>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          isOut
                            ? 'bg-sky-950 text-sky-400 border border-sky-800 animate-pulse'
                            : isPickedUp
                            ? 'bg-purple-950 text-purple-400 border border-purple-800'
                            : 'bg-indigo-950 text-indigo-400 border border-indigo-800'
                        }`}
                      >
                        {task.status}
                      </span>
                    </div>

                    {/* Address & Navigation */}
                    <div className="space-y-2">
                      <div className="flex items-start gap-2 text-xs text-slate-300">
                        <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <span className="leading-snug">{task.delivery_address}</span>
                      </div>

                      {/* Quick Contact & Navigation Buttons */}
                      <div className="grid grid-cols-2 gap-2 pt-2">
                        {task.customer_phone ? (
                          <a
                            href={`tel:${task.customer_phone}`}
                            className="bg-slate-800 hover:bg-slate-700 text-white rounded-xl py-2 px-3 text-xs font-bold flex items-center justify-center gap-1.5 border border-slate-700 transition-colors"
                          >
                            <Phone className="w-3.5 h-3.5 text-emerald-400" /> Call Customer
                          </a>
                        ) : (
                          <span className="bg-slate-800 text-slate-500 rounded-xl py-2 px-3 text-xs font-bold text-center">
                            No Phone
                          </span>
                        )}

                        <a
                          href={gmapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-slate-800 hover:bg-slate-700 text-brand-400 rounded-xl py-2 px-3 text-xs font-bold flex items-center justify-center gap-1.5 border border-slate-700 transition-colors"
                        >
                          <Navigation className="w-3.5 h-3.5 text-brand-400" /> Google Maps
                        </a>
                      </div>
                    </div>

                    {/* Order Details Preview */}
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 text-xs space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Collect Payable:</span>
                        <span className="font-bold text-white">₹{task.total_amount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Payment Mode:</span>
                        <span className="font-mono text-brand-400 uppercase font-bold">
                          {task.payment_method} ({task.payment_status})
                        </span>
                      </div>
                      {task.notes && (
                        <p className="text-[11px] text-amber-400/90 pt-1 border-t border-slate-800/50">
                          Note: {task.notes}
                        </p>
                      )}
                    </div>

                    {/* Action Progression Controls */}
                    <div className="space-y-2 pt-1">
                      {isAssigned && (
                        <button
                          onClick={() => handleUpdateStatus(task.id, 'PICKED_UP')}
                          className="w-full bg-purple-600 hover:bg-purple-500 text-white py-3 rounded-xl font-bold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <ShoppingBag className="w-4 h-4" /> 1. Pick Up Produce at Hub
                        </button>
                      )}

                      {isPickedUp && (
                        <button
                          onClick={() => handleUpdateStatus(task.id, 'OUT_FOR_DELIVERY')}
                          className="w-full bg-sky-500 hover:bg-sky-400 text-slate-950 py-3 rounded-xl font-black text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <Navigation className="w-4 h-4" /> 2. Start Delivery Route (Out for Delivery)
                        </button>
                      )}

                      {isOut && (
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            onClick={() => {
                              setOtpModalAssignment(task);
                              setOtpValue('');
                              setCodAmountCollected(task.payment_method === 'cod' ? String(task.total_amount || '') : '');
                            }}
                            className="col-span-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 py-3 rounded-xl font-black text-xs shadow-lg shadow-emerald-500/20 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <KeyRound className="w-4 h-4" /> Submit Customer OTP
                          </button>
                          <button
                            onClick={() => {
                              setFailModalAssignment(task);
                              setFailReason('customer_unavailable');
                              setFailNotes('');
                            }}
                            className="col-span-1 bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800 py-3 rounded-xl font-bold text-xs transition-all cursor-pointer"
                          >
                            Failed
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          /* History Tab */
          <div className="space-y-3">
            {completedAssignments.length === 0 ? (
              <p className="text-center py-8 text-xs text-slate-500">No completed deliveries yet.</p>
            ) : (
              completedAssignments.map((task) => (
                <div
                  key={task.id}
                  className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-mono text-[11px] font-bold text-slate-400">#{task.order_number}</span>
                    <h5 className="font-bold text-white text-xs mt-0.5">{task.customer_name}</h5>
                    <p className="text-[10px] text-slate-500">{task.delivery_address}</p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                      task.status === 'DELIVERED'
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : 'bg-rose-950 text-rose-400 border border-rose-800'
                    }`}
                  >
                    {task.status}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </main>

      {/* MODAL 1: OTP SUBMISSION */}
      {otpModalAssignment && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 flex items-center justify-center mx-auto text-emerald-400">
                <KeyRound className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-white text-base">Enter Delivery OTP</h3>
              <p className="text-xs text-slate-400">
                Ask customer for the 6-digit confirmation code
              </p>
            </div>

            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  6-Digit OTP *
                </label>
                <input
                  type="text"
                  autoFocus
                  required
                  maxLength={6}
                  placeholder="• • • • • •"
                  value={otpValue}
                  onChange={(e) => setOtpValue(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 text-center text-2xl font-mono tracking-widest text-emerald-400 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* COD Cash Collection Verification */}
              {otpModalAssignment?.payment_method === 'cod' && (
                <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/40 space-y-2 text-left">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-amber-300">Cash On Delivery (COD)</span>
                    <span className="font-mono font-black text-amber-200">₹{otpModalAssignment.total_amount}</span>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                      Cash Amount Collected (₹) *
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      placeholder={`Enter exact ₹${otpModalAssignment.total_amount}`}
                      value={codAmountCollected}
                      onChange={(e) => setCodAmountCollected(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-amber-400"
                    />
                    {Number(codAmountCollected) !== Number(otpModalAssignment.total_amount) && codAmountCollected !== '' && (
                      <p className="text-[10px] text-rose-400 mt-1">
                        Amount must match exact order total of ₹{otpModalAssignment.total_amount}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setOtpModalAssignment(null)}
                  className="flex-1 py-3 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    submittingOtp ||
                    otpValue.trim().length !== 6 ||
                    (otpModalAssignment.payment_method === 'cod' &&
                      (!codAmountCollected || Math.abs(Number(codAmountCollected) - Number(otpModalAssignment.total_amount)) > 0.01))
                  }
                  className="flex-1 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 py-3 rounded-xl font-black text-xs shadow-lg transition-all"
                >
                  {submittingOtp ? 'Verifying...' : 'Verify OTP & Complete'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: REPORT FAILURE */}
      {failModalAssignment && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-2xl bg-rose-950/60 border border-rose-500/40 flex items-center justify-center mx-auto text-rose-400">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-white text-base">Report Non-Delivery</h3>
              <p className="text-xs text-slate-400">Order #{failModalAssignment.order_number}</p>
            </div>

            <form onSubmit={handleReportFailure} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Reason *
                </label>
                <select
                  value={failReason}
                  onChange={(e) => setFailReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                >
                  <option value="customer_unavailable">Customer Unavailable</option>
                  <option value="customer_phone_unreachable">Phone Unreachable</option>
                  <option value="incorrect_address">Incorrect Address</option>
                  <option value="customer_rescheduled">Customer Rescheduled</option>
                  <option value="delivery_refused">Delivery Refused</option>
                  <option value="other">Other Issue</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Notes (Min 5 chars) *
                </label>
                <textarea
                  required
                  minLength={5}
                  rows={2}
                  placeholder="Detail calls made or customer response..."
                  value={failNotes}
                  onChange={(e) => setFailNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setFailModalAssignment(null)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-400 bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingFail || failNotes.trim().length < 5}
                  className="flex-1 bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white py-2.5 rounded-xl font-bold text-xs shadow-lg transition-all"
                >
                  {submittingFail ? 'Saving...' : 'Submit Failure'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeliveryPortalPage;

