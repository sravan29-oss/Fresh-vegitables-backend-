import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ShieldCheck, Sparkles, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { SEOHead } from '../../components/common/SEOHead';
import { signInWithGooglePopup } from '../../config/firebase';

const GoogleIcon = () => (
  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
    />
  </svg>
);

export const LoginPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const rawRedirect = searchParams.get('redirect') || '/';
  const redirect = rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') ? rawRedirect : '/';
  const navigate = useNavigate();
  const { login, showLoginSuccess } = useAuth();

  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleGoogleAuth = async () => {
    setErrorMsg('');

    try {
      setIsGoogleLoading(true);
      const idToken = await signInWithGooglePopup();

      const res = await api.post('/auth/google', { idToken });

      if (res.data?.data) {
        const { token, accessToken, user, refreshToken } = res.data.data;
        login(accessToken || token, user, refreshToken);
        showLoginSuccess(user, false, () => {
          navigate(redirect);
        });
      }
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      const code = err?.code || '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setErrorMsg('Google sign-in popup was closed before completing.');
      } else if (code === 'auth/popup-blocked') {
        setErrorMsg('Google sign-in popup was blocked by your browser. Please allow popups.');
      } else if (code === 'auth/unauthorized-domain') {
        setErrorMsg('Domain not authorized for Google Sign-In in Firebase console.');
      } else if (code === 'auth/operation-not-allowed') {
        setErrorMsg('Google sign-in provider is not enabled in Firebase Console.');
      } else if (err.response?.data?.message) {
        setErrorMsg(err.response.data.message);
      } else if (err.message) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('Failed to sign in with Google. Please try again.');
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12 font-sans animate-slide-up">
      <SEOHead title="Customer Sign In | Fresh Vegetables Organic" noindex={true} />
      <div className="max-w-md w-full bg-surface rounded-3xl border border-line shadow-soft-xl p-8 sm:p-10 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <img
            src="/logo.png"
            alt="Fresh Vegetables Organic"
            className="w-20 h-20 rounded-full object-cover mx-auto shadow-soft ring-4 ring-sage-100 border border-line"
          />
          <h1 className="font-serif text-2xl font-bold text-ink-900 tracking-tight">
            Welcome to Fresh Harvest
          </h1>
          <p className="text-xs text-ink-500 font-sans leading-relaxed">
            Sign in with your Google account to access your basket, orders, and delivery addresses.
          </p>
        </div>

        {/* Error Notification */}
        {errorMsg && (
          <div className="p-3.5 bg-tomato-50 border border-tomato-200/80 text-tomato-600 text-xs font-semibold rounded-2xl flex items-start gap-2.5 shadow-soft">
            <AlertCircle className="w-4 h-4 text-tomato-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p>{errorMsg}</p>
            </div>
          </div>
        )}

        {/* Google Authentication Button - Sole Customer Sign-In Method */}
        <div className="space-y-3 pt-2">
          <button
            type="button"
            onClick={handleGoogleAuth}
            disabled={isGoogleLoading}
            className="w-full flex items-center justify-center gap-3 py-3.5 px-4 bg-surface hover:bg-cream-50 text-ink-900 font-bold text-sm rounded-full border border-line shadow-soft hover:shadow-soft-md transition-all active:scale-98 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer min-h-[48px]"
          >
            {isGoogleLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin text-forest-700" />
                <span>Connecting with Google...</span>
              </>
            ) : (
              <>
                <GoogleIcon />
                <span>Continue with Google</span>
              </>
            )}
          </button>

          <p className="text-[11px] text-center text-ink-400 font-medium">
            Instant 1-click login • No password required
          </p>
        </div>

        {/* Trust & Security Highlights */}
        <div className="p-4 bg-sage-50/70 border border-leaf-500/20 rounded-2xl space-y-2">
          <div className="flex items-center gap-2 text-forest-900 font-serif font-bold text-xs">
            <ShieldCheck className="w-4 h-4 text-leaf-600" />
            <span>Secure & Verified Access</span>
          </div>
          <ul className="text-[11px] text-ink-600 space-y-1.5 font-sans">
            <li className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-leaf-500 shrink-0" />
              <span>Two fulfillment hubs serving Champapet & KPHB</span>
            </li>
            <li className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-leaf-500 shrink-0" />
              <span>Direct farm-to-door fresh morning delivery</span>
            </li>
            <li className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-leaf-500 shrink-0" />
              <span>Zero passwords to remember or reset</span>
            </li>
          </ul>
        </div>

        {/* Footer Links */}
        <div className="text-center text-xs text-ink-500 pt-2 border-t border-line font-sans space-y-2">
          <div>
            New to Fresh Vegetables?{' '}
            <Link
              to={`/register?redirect=${encodeURIComponent(redirect)}`}
              className="font-bold text-forest-700 hover:text-forest-900 transition-colors"
            >
              Sign Up with Google
            </Link>
          </div>
          <div className="pt-2 text-[11px] text-ink-400">
            Store operations staff?{' '}
            <Link to="/admin/login" className="font-semibold text-ink-600 hover:text-forest-700 underline">
              Admin Portal
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
