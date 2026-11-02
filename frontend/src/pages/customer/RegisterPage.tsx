import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { User, Mail, Phone, Lock, ArrowRight, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { SEOHead } from '../../components/common/SEOHead';

export const RegisterPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect') || '/';
  const navigate = useNavigate();
  const { login, showLoginSuccess } = useAuth();

  // Customer Form Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Password Visibility Toggle States (Operate Independently)
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Status & Error
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [alreadyExists, setAlreadyExists] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setAlreadyExists(false);

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanMobile = mobile.replace(/\D/g, '').slice(-10);

    // Validation
    if (cleanName.length < 2) {
      setErrorMsg('Please enter your full name (at least 2 characters).');
      return;
    }

    if (!cleanEmail) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    if (!cleanMobile || cleanMobile.length !== 10 || !/^[6-9]\d{9}$/.test(cleanMobile)) {
      setErrorMsg('Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please verify your confirm password.');
      return;
    }

    try {
      setIsLoading(true);

      const res = await api.post('/auth/register', {
        name: cleanName,
        email: cleanEmail,
        mobile: cleanMobile,
        password,
      });

      if (res.data?.data) {
        const { token, accessToken, user, refreshToken } = res.data.data;
        login(accessToken || token, user, refreshToken);
        showLoginSuccess(user, false, () => {
          navigate(redirect);
        });
      }
    } catch (err: any) {
      console.error('Customer registration error:', err);
      const serverMsg = err.response?.data?.message;
      if (serverMsg) {
        setErrorMsg(serverMsg);
        if (serverMsg.toLowerCase().includes('already registered')) {
          setAlreadyExists(true);
        }
      } else if (err.response?.status === 409) {
        setAlreadyExists(true);
        setErrorMsg('An account with this email or mobile number already exists.');
      } else {
        setErrorMsg('Failed to create account. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <SEOHead title="Customer Registration | Fresh Vegetables Organic" noindex={true} />
      <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200/80 shadow-xl p-8 sm:p-10 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <img
            src="/logo.png"
            alt="Fresh Vegetables Organic"
            className="w-20 h-20 rounded-full object-cover mx-auto shadow-md shadow-brand-500/20 ring-4 ring-brand-50"
          />
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            Create an Account
          </h2>
          <p className="text-xs text-slate-500">
            Join thousands enjoying daily crisp, farm-picked organic vegetables
          </p>
        </div>

        {/* Error Notification */}
        {errorMsg && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-2xl flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p>{errorMsg}</p>
              {alreadyExists && (
                <Link
                  to={`/login?redirect=${encodeURIComponent(redirect)}`}
                  className="inline-block text-[#0c831f] hover:underline font-black mt-1"
                >
                  Click here to Log In &rarr;
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Registration Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Full Name */}
          <div>
            <label className="font-bold text-slate-700 block mb-1">
              Full Name <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                required
                autoFocus
                placeholder="e.g. Rahul Sharma"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium text-slate-800 text-sm"
                aria-label="Full Name"
              />
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Email Address */}
          <div>
            <label className="font-bold text-slate-700 block mb-1">
              Email Address <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="email"
                required
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium text-slate-800 text-sm"
                aria-label="Email Address"
              />
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Phone Number with default +91 mentioned */}
          <div>
            <label className="font-bold text-slate-700 block mb-1">
              Phone Number <span className="text-rose-500">*</span>
            </label>
            <div className="relative flex items-center">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none select-none">
                <span className="font-extrabold text-slate-700 text-xs bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
                  +91
                </span>
              </div>
              <input
                type="tel"
                required
                inputMode="numeric"
                maxLength={10}
                placeholder="9876543210"
                value={mobile}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, '');
                  if (raw.length === 12 && raw.startsWith('91')) {
                    setMobile(raw.slice(2));
                  } else {
                    setMobile(raw.slice(0, 10));
                  }
                }}
                className="w-full pl-18 pr-10 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium text-slate-800 text-sm tracking-wider"
                aria-label="Phone Number"
              />
              <Phone className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              Enter your 10-digit Indian mobile number for order delivery updates
            </p>
          </div>

          {/* Password with Eye View/Hide Toggle */}
          <div>
            <label className="font-bold text-slate-700 block mb-1">
              Password <span className="text-rose-500">*</span>
            </label>
            <div className="relative flex items-center">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-12 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium text-slate-800 text-sm"
                aria-label="Password"
              />
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                title={showPassword ? 'Hide password' : 'Show password'}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4 text-slate-600" />
                ) : (
                  <Eye className="w-4 h-4 text-slate-500" />
                )}
              </button>
            </div>
          </div>

          {/* Confirm Password with Eye View/Hide Toggle */}
          <div>
            <label className="font-bold text-slate-700 block mb-1">
              Confirm Password <span className="text-rose-500">*</span>
            </label>
            <div className="relative flex items-center">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                required
                minLength={6}
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full pl-10 pr-12 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium text-slate-800 text-sm"
                aria-label="Confirm Password"
              />
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                title={showConfirmPassword ? 'Hide password' : 'Show password'}
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? (
                  <EyeOff className="w-4 h-4 text-slate-600" />
                ) : (
                  <Eye className="w-4 h-4 text-slate-500" />
                )}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={
              isLoading ||
              !name.trim() ||
              !email.trim() ||
              mobile.replace(/\D/g, '').length !== 10 ||
              password.length < 6 ||
              confirmPassword.length < 6
            }
            className="w-full bg-[#0c831f] hover:bg-emerald-700 text-white font-extrabold py-3.5 px-4 rounded-xl shadow-lg shadow-emerald-700/25 flex items-center justify-center gap-2 transition-all active:scale-98 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Creating Account...</span>
              </>
            ) : (
              <>
                <span>Register & Start Shopping</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Link to Sign In */}
        <div className="text-center text-xs text-slate-500 pt-2 border-t border-slate-100">
          Already have an account?{' '}
          <Link
            to={`/login?redirect=${encodeURIComponent(redirect)}`}
            className="font-bold text-[#0c831f] hover:text-emerald-700"
          >
            Sign In Here
          </Link>
        </div>
      </div>
    </div>
  );
};
