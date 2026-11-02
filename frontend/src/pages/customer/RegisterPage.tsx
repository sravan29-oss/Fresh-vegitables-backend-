import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, User, Phone, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { SEOHead } from '../../components/common/SEOHead';
import { sendFirebasePhoneOtp, ConfirmationResult } from '../../config/firebase';
import { OtpVerificationScreen } from '../../components/auth/OtpVerificationScreen';

export const RegisterPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect') || '/';
  const navigate = useNavigate();
  const { login, showLoginSuccess } = useAuth();

  // Step 1: Customer details
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');

  // Flow State
  const [isOtpStep, setIsOtpStep] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);

  // Status & Error
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [alreadyExists, setAlreadyExists] = useState(false);

  // Clean 10-digit mobile
  const cleanMobile = mobile.replace(/\D/g, '').slice(-10);

  /**
   * Step 1: Validate input, pre-check if mobile is already registered, and send Firebase SMS OTP
   */
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setAlreadyExists(false);

    if (name.trim().length < 2) {
      setErrorMsg('Please enter your full name (at least 2 characters).');
      return;
    }

    if (cleanMobile.length !== 10) {
      setErrorMsg('Please enter a valid 10-digit Indian mobile number.');
      return;
    }

    try {
      setIsLoading(true);

      // Pre-check if phone is already registered in PostgreSQL
      try {
        const checkRes = await api.post('/auth/firebase/check-phone', { phone: cleanMobile });
        if (checkRes.data?.data?.exists) {
          setAlreadyExists(true);
          setErrorMsg('An account with this mobile number already exists. Please log in instead.');
          setIsLoading(false);
          return;
        }
      } catch (checkErr) {
        // Proceed if pre-check fails non-critically
        console.warn('Phone pre-check warning:', checkErr);
      }

      // Send Firebase SMS OTP invisibly in background
      const confirmation = await sendFirebasePhoneOtp(cleanMobile);
      setConfirmationResult(confirmation);
      setIsOtpStep(true);
    } catch (err: any) {
      console.error('Failed to send registration OTP:', err);
      let msg = 'Failed to send OTP. Please check your mobile number and try again.';
      if (err.code === 'auth/configuration-not-found') {
        msg = 'Phone authentication is not enabled in your Firebase Console. Please open Firebase Console > Authentication > Sign-in method, click "Phone" and toggle "Enable".';
      } else if (err.code === 'auth/unauthorized-domain') {
        msg = 'Domain not authorized. Please add fresh-vegetables-organic.vercel.app to Firebase Console > Authentication > Settings > Authorized domains.';
      } else if (err.code === 'auth/invalid-phone-number') {
        msg = 'Invalid mobile number. Please enter a valid 10-digit number.';
      } else if (err.code === 'auth/too-many-requests') {
        msg = 'Too many attempts. Please wait a few minutes before requesting another OTP.';
      } else if (err.message) {
        msg = err.message;
      }
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Step 2: Verify Firebase OTP, verify ID token with backend, and establish customer session
   */
  const handleVerifyOtp = async (otpCode: string) => {
    if (!confirmationResult) {
      setErrorMsg('Session expired. Please request a new OTP.');
      setIsOtpStep(false);
      return;
    }

    try {
      setIsLoading(true);
      setErrorMsg('');

      // 1. Authoritative verification with Firebase Client SDK
      const userCredential = await confirmationResult.confirm(otpCode);
      const idToken = await userCredential.user.getIdToken(true);

      // 2. Authoritative backend token validation & PostgreSQL user creation
      const res = await api.post('/auth/firebase/register', {
        idToken,
        name: name.trim(),
        email: email.trim() || undefined,
      });

      if (res.data?.data) {
        const { token, accessToken, user, refreshToken } = res.data.data;
        login(accessToken || token, user, refreshToken);
        showLoginSuccess(user, false, () => {
          navigate(redirect);
        });
      }
    } catch (err: any) {
      console.error('Registration verification failed:', err);
      let msg = 'Verification failed. Please enter the correct 6-digit OTP.';
      if (err.code === 'auth/invalid-verification-code') {
        msg = 'Invalid OTP code. Please enter the correct 6-digit code sent to your phone.';
      } else if (err.code === 'auth/code-expired') {
        msg = 'OTP has expired. Please tap Resend OTP to receive a new code.';
      } else if (err.response?.data?.message) {
        msg = err.response.data.message;
      } else if (err.message) {
        msg = err.message;
      }
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Resend OTP handler for OtpVerificationScreen
   */
  const handleResendOtp = async () => {
    setErrorMsg('');
    const confirmation = await sendFirebasePhoneOtp(cleanMobile);
    setConfirmationResult(confirmation);
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <SEOHead title="Customer Registration | Fresh Vegetables Organic" noindex={true} />
      <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200/80 shadow-xl p-8 sm:p-10 space-y-6">
        {/* Container for Firebase background verification & Google compliant branding */}
        <div id="recaptcha-invisible-container" />

        {isOtpStep ? (
          <OtpVerificationScreen
            phoneNumber={`+91${cleanMobile}`}
            onVerifyOtp={handleVerifyOtp}
            onResendOtp={handleResendOtp}
            onChangePhone={() => {
              setIsOtpStep(false);
              setErrorMsg('');
            }}
            isLoading={isLoading}
            errorMsg={errorMsg}
          />
        ) : (
          <>
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
                Join thousands enjoying daily crisp, farm-picked vegetables
              </p>
            </div>

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

            <form onSubmit={handleSendOtp} className="space-y-4 text-xs">
              {/* Full Name — Required */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rahul Sharma"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium text-slate-800"
                  />
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              {/* Phone Number — Required */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Mobile Number <span className="text-rose-500">*</span>
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-600 text-xs select-none">
                    +91
                  </span>
                  <input
                    type="tel"
                    required
                    inputMode="numeric"
                    pattern="[0-9]{10}"
                    maxLength={10}
                    placeholder="9876543210"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                    className="w-full pl-13 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium text-slate-800 tracking-wider"
                  />
                  <Phone className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">We will send a 6-digit OTP to this number</p>
              </div>

              {/* Email Address — Optional */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Email Address <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <div className="relative">
                  <input
                    type="email"
                    placeholder="rahul@example.com (optional)"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium text-slate-800"
                  />
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              {/* Send OTP button */}
              <button
                type="submit"
                disabled={isLoading || cleanMobile.length !== 10 || name.trim().length < 2}
                className="w-full bg-[#0c831f] hover:bg-emerald-700 text-white font-extrabold py-3.5 px-4 rounded-xl shadow-lg shadow-emerald-700/25 flex items-center justify-center gap-2 transition-all active:scale-98 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Sending OTP...</span>
                  </>
                ) : (
                  <>
                    <span>Send OTP</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="text-center text-xs text-slate-500 pt-2 border-t border-slate-100">
              Already have an account?{' '}
              <Link
                to={`/login?redirect=${encodeURIComponent(redirect)}`}
                className="font-bold text-[#0c831f] hover:text-emerald-700"
              >
                Sign In Here
              </Link>
            </div>

            <p className="text-[10px] text-slate-400 text-center pt-2 border-t border-slate-50">
              This site is protected by reCAPTCHA and the Google{' '}
              <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-600">Privacy Policy</a> and{' '}
              <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-600">Terms of Service</a> apply.
            </p>
          </>
        )}
      </div>
    </div>
  );
};
