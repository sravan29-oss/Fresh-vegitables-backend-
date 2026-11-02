import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Phone, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { SEOHead } from '../../components/common/SEOHead';
import { sendFirebasePhoneOtp, ConfirmationResult } from '../../config/firebase';
import { OtpVerificationScreen } from '../../components/auth/OtpVerificationScreen';

export const LoginPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect') || '/';
  const navigate = useNavigate();
  const { login, showLoginSuccess } = useAuth();

  // Mobile number input
  const [mobile, setMobile] = useState('');

  // Flow State
  const [isOtpStep, setIsOtpStep] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);

  // Status & Error
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [accountNotFound, setAccountNotFound] = useState(false);

  // Clean 10-digit mobile
  const cleanMobile = mobile.replace(/\D/g, '').slice(-10);

  /**
   * Step 1: Pre-check if mobile is registered, and send Firebase SMS OTP
   */
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setAccountNotFound(false);

    if (cleanMobile.length !== 10) {
      setErrorMsg('Please enter a valid 10-digit Indian mobile number.');
      return;
    }

    try {
      setIsLoading(true);

      // Pre-check if phone is registered in PostgreSQL before triggering SMS
      const checkRes = await api.post('/auth/firebase/check-phone', { phone: cleanMobile });
      if (!checkRes.data?.data?.exists) {
        setAccountNotFound(true);
        setErrorMsg('Account not found. Please register to continue.');
        setIsLoading(false);
        return;
      }

      // Send Firebase SMS OTP invisibly in background
      const confirmation = await sendFirebasePhoneOtp(cleanMobile);
      setConfirmationResult(confirmation);
      setIsOtpStep(true);
    } catch (err: any) {
      console.error('Failed to send login OTP:', err);
      let msg = 'Failed to send OTP. Please check your mobile number and try again.';
      if (err.response?.data?.message) {
        msg = err.response.data.message;
        if (err.response?.data?.code === 'USER_NOT_FOUND') {
          setAccountNotFound(true);
        }
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
   * Step 2: Verify Firebase OTP, validate ID token on backend, and restore customer session
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

      // 2. Authoritative backend token validation & PostgreSQL customer account identification
      const res = await api.post('/auth/firebase/login', { idToken });

      if (res.data?.data) {
        const { token, accessToken, user, refreshToken } = res.data.data;
        login(accessToken || token, user, refreshToken);
        showLoginSuccess(user, false, () => {
          navigate(redirect);
        });
      }
    } catch (err: any) {
      console.error('Login verification failed:', err);
      let msg = 'Verification failed. Please enter the correct 6-digit OTP.';
      if (err.code === 'auth/invalid-verification-code') {
        msg = 'Invalid OTP code. Please enter the correct 6-digit code sent to your phone.';
      } else if (err.code === 'auth/code-expired') {
        msg = 'OTP has expired. Please tap Resend OTP to receive a new code.';
      } else if (err.response?.status === 404 || err.response?.data?.code === 'USER_NOT_FOUND') {
        setAccountNotFound(true);
        msg = 'Account not found. Please register to continue.';
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
      <SEOHead title="Customer Sign In | Fresh Vegetables Organic" noindex={true} />
      <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200/80 shadow-xl p-8 sm:p-10 space-y-6">
        {/* Invisible container for Firebase background verification */}
        <div id="recaptcha-invisible-container" style={{ display: 'none' }} />

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
                Welcome to Fresh Vegetables
              </h2>
              <p className="text-xs text-slate-500">
                Sign in with your mobile number to access your cart, addresses, and farm deliveries
              </p>
            </div>

            {errorMsg && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-2xl flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p>{errorMsg}</p>
                  {accountNotFound && (
                    <Link
                      to={`/register?redirect=${encodeURIComponent(redirect)}`}
                      className="inline-block text-[#0c831f] hover:underline font-black mt-1"
                    >
                      Register Now &rarr;
                    </Link>
                  )}
                </div>
              </div>
            )}

            <form onSubmit={handleSendOtp} className="space-y-4 text-xs">
              {/* Phone Number with +91 country code */}
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
                    autoFocus
                    inputMode="numeric"
                    pattern="[0-9]{10}"
                    maxLength={10}
                    placeholder="9876543210"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                    className="w-full pl-13 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium text-slate-800 tracking-wider text-sm"
                  />
                  <Phone className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">We will send a 6-digit verification code</p>
              </div>

              {/* Send OTP button */}
              <button
                type="submit"
                disabled={isLoading || cleanMobile.length !== 10}
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
              Don't have an account?{' '}
              <Link
                to={`/register?redirect=${encodeURIComponent(redirect)}`}
                className="font-bold text-[#0c831f] hover:text-emerald-700"
              >
                Create an Account
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
