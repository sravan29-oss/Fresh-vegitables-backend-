import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Lock, Mail, ArrowRight, Eye, EyeOff } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { SEOHead } from '../../components/common/SEOHead';

export const AdminLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { adminLogin, showLoginSuccess } = useAuth();

  const [email, setEmail] = useState('naredlasravankumar29@gmail.com');
  const [password, setPassword] = useState('Sravan29');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      setErrorMsg('');

      const res = await api.post('/auth/admin/login', { email, password });
      if (res.data?.data) {
        const { token, accessToken, user, refreshToken } = res.data.data;
        adminLogin(accessToken || token, user, refreshToken);
        showLoginSuccess(user, true, () => {
          navigate('/admin');
        });
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Invalid admin credentials');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-12">
      <SEOHead title="Admin Login | Fresh Vegetables Organic" noindex={true} />
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 sm:p-10 shadow-2xl space-y-6 text-white">
        <div className="text-center space-y-3">
          <img
            src="/logo.png"
            alt="Fresh Vegetables Admin"
            className="w-20 h-20 rounded-full object-cover mx-auto ring-4 ring-brand-500/20 border-2 border-brand-500/40 shadow-xl"
          />
          <div>
            <h2 className="text-2xl font-black tracking-tight text-white">
              Admin Operations Portal
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Secure back-office management for Fresh Vegetables
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold rounded-2xl">
            ⚠️ {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="font-bold text-slate-300 block mb-1">Admin Email</label>
            <div className="relative">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 text-white rounded-xl focus:outline-none focus:border-brand-500"
              />
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-300 block mb-1">Admin Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-11 py-3 bg-slate-800 border border-slate-700 text-white rounded-xl focus:outline-none focus:border-brand-500"
              />
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="p-1.5 text-slate-400 hover:text-slate-200 absolute right-3 top-1/2 -translate-y-1/2 rounded-lg hover:bg-slate-700/50 transition-colors"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-brand-600 hover:bg-brand-500 text-slate-950 font-black py-3.5 px-4 rounded-xl shadow-lg shadow-brand-500/20 flex items-center justify-center gap-2 transition-all active:scale-98"
          >
            <span>{isLoading ? 'Authenticating...' : 'Access Admin Dashboard'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div
          onClick={() => {
            setEmail('naredlasravankumar29@gmail.com');
            setPassword('Sravan29');
            setErrorMsg('');
          }}
          className="p-3 bg-slate-800/60 hover:bg-slate-800 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1 cursor-pointer transition-colors"
          title="Click to fill credentials"
        >
          <div className="flex items-center justify-between">
            <p className="font-bold text-slate-300">Super Admin Credentials:</p>
            <span className="text-[10px] bg-brand-500/20 text-brand-300 px-2 py-0.5 rounded font-bold">1-Click Auto Fill</span>
          </div>
          <p>Email: <code className="text-brand-400 font-bold">naredlasravankumar29@gmail.com</code></p>
          <p>Password: <code className="text-brand-400 font-bold">Sravan29</code></p>
        </div>
      </div>
    </div>
  );
};
