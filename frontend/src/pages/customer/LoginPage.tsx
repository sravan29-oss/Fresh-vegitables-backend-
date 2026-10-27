import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, Lock, ArrowRight, ShieldCheck } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export const LoginPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect') || '/';
  const navigate = useNavigate();
  const { login, showLoginSuccess } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      setErrorMsg('');

      const res = await api.post('/auth/login', { email, password });
      if (res.data?.data) {
        const { token, user } = res.data.data;
        login(token, user);
        showLoginSuccess(user, false, () => {
          navigate(redirect);
        });
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Invalid email or password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200/80 shadow-xl p-8 sm:p-10 space-y-6">
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
            Sign in to access your cart, addresses, and track farm deliveries
          </p>
        </div>

        {errorMsg && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-2xl">
            ⚠️ {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="font-bold text-slate-700 block mb-1">Email Address</label>
            <div className="relative">
              <input
                type="email"
                required
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Password</label>
            <div className="relative">
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-brand-600/20 flex items-center justify-center gap-2 transition-all active:scale-98"
          >
            <span>{isLoading ? 'Signing in...' : 'Sign In'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Demo credentials hint */}
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-[11px] text-slate-500 space-y-1">
          <p className="font-bold text-slate-700">Demo Customer Credentials:</p>
          <p>Email: <code className="text-brand-700 font-bold">customer@freshveggies.com</code></p>
          <p>Password: <code className="text-brand-700 font-bold">customer123</code></p>
        </div>

        <div className="text-center text-xs text-slate-500 pt-2 border-t border-slate-100">
          Don't have an account?{' '}
          <Link
            to={`/register?redirect=${encodeURIComponent(redirect)}`}
            className="font-bold text-brand-600 hover:text-brand-700"
          >
            Create an Account
          </Link>
        </div>
      </div>
    </div>
  );
};
