import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Truck, ShieldCheck, HeartHandshake, Sparkles, Phone, Mail, MapPin } from 'lucide-react';
import api from '../../services/api';

export const Footer: React.FC = () => {
  const [storeSettings, setStoreSettings] = useState<{
    support_phone?: string;
    support_email?: string;
    store_address?: string;
  }>({
    support_phone: '+91 8106970384',
    support_email: 'freshvegitables29@gmail.com',
    store_address: 'Hyderabad, Telangana',
  });

  useEffect(() => {
    api.get('/cms/settings')
      .then((res) => {
        if (res.data?.data) {
          setStoreSettings(res.data.data);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <footer className="bg-slate-950 text-slate-300 border-t border-slate-800 pt-16 pb-8">
      {/* Top feature badges */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 border-b border-slate-800">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-900 border border-slate-800">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-[#0c831f] flex items-center justify-center">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-white font-bold text-sm">15-Minute Express</h4>
              <p className="text-xs text-slate-400">Directly from partner farms</p>
            </div>
          </div>
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-800/40 border border-slate-800">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-white font-bold text-sm">100% Genuine &amp; Organic</h4>
              <p className="text-xs text-slate-400">Zero harmful pesticides</p>
            </div>
          </div>
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-800/40 border border-slate-800">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-white font-bold text-sm">Quality Guaranteed</h4>
              <p className="text-xs text-slate-400">Instant replacement policy</p>
            </div>
          </div>
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-800/40 border border-slate-800">
            <div className="w-12 h-12 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center">
              <HeartHandshake className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-white font-bold text-sm">Fair Farmer Prices</h4>
              <p className="text-xs text-slate-400">Supporting local growers</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Links */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand Bio */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <img
                src="/logo.png"
                alt="Fresh Vegetables Organic"
                className="w-11 h-11 rounded-full object-cover border-2 border-emerald-500/40 shadow-lg shadow-emerald-900/40"
              />
              <span className="font-black text-xl text-white tracking-tight">
                Fresh<span className="text-brand-400">Vegetables</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              We connect local chemical-free vegetable farms directly to urban kitchens. Harvested fresh daily, delivered with utmost care.
            </p>
            <div className="text-xs text-slate-400 space-y-2 pt-2">
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-brand-400 shrink-0" />
                <span>{storeSettings.store_address || 'Hyderabad, Telangana'}</span>
              </div>
              <a
                href={`tel:${(storeSettings.support_phone || '+91 8106970384').replace(/[\s-]/g, '')}`}
                className="flex items-center gap-2 hover:text-brand-300 transition-colors font-medium"
              >
                <Phone className="w-3.5 h-3.5 text-brand-400 shrink-0" />
                <span>{storeSettings.support_phone || '+91 8106970384'}</span>
              </a>
              <a
                href={`mailto:${storeSettings.support_email || 'freshvegitables29@gmail.com'}`}
                className="flex items-center gap-2 hover:text-brand-300 transition-colors font-semibold"
              >
                <Mail className="w-3.5 h-3.5 text-brand-400 shrink-0" />
                <span>{storeSettings.support_email || 'freshvegitables29@gmail.com'}</span>
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-4">Quick Links</h4>
            <ul className="space-y-2 text-xs text-slate-400">
              <li><Link to="/products" className="hover:text-brand-400 transition-colors">All Vegetables</Link></li>
              <li><Link to="/products?featured=true" className="hover:text-brand-400 transition-colors">Seasonal Specials</Link></li>
              <li><Link to="/products?best_seller=true" className="hover:text-brand-400 transition-colors">Best Sellers</Link></li>
              <li><Link to="/orders" className="hover:text-brand-400 transition-colors">Track My Order</Link></li>
              <li><Link to="/profile" className="hover:text-brand-400 transition-colors">My Addresses</Link></li>
            </ul>
          </div>

          {/* Categories */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-4">Popular Categories</h4>
            <ul className="space-y-2 text-xs text-slate-400">
              <li><Link to="/products?category=leafy-greens" className="hover:text-brand-400 transition-colors">Leafy Greens &amp; Herbs</Link></li>
              <li><Link to="/products?category=daily-essentials" className="hover:text-brand-400 transition-colors">Daily Essentials (Potatoes, Onions)</Link></li>
              <li><Link to="/products?category=exotic-veggies" className="hover:text-brand-400 transition-colors">Exotics &amp; Salads</Link></li>
              <li><Link to="/products?category=root-vegetables" className="hover:text-brand-400 transition-colors">Roots &amp; Gourds</Link></li>
              <li><Link to="/products?category=organic-certified" className="hover:text-brand-400 transition-colors">Certified Organic</Link></li>
            </ul>
          </div>

          {/* Admin link & Newsletter */}
          <div className="space-y-4">
            <h4 className="text-white font-semibold text-sm">Stay Updated</h4>
            <p className="text-xs text-slate-400">
              Subscribe for weekly harvest specials and fresh produce alerts.
            </p>
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="Enter your email"
                className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 flex-1"
              />
              <button className="bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition-colors">
                Join
              </button>
            </div>
            <div className="pt-2">
              <Link to="/admin/login" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
                🔐 Store Administration Login
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
        <p>© 2026 Fresh Vegetables Marketplace. All rights reserved.</p>
        <div className="flex items-center gap-2 text-emerald-400 font-semibold bg-emerald-950/60 border border-emerald-500/30 px-3.5 py-1.5 rounded-full shadow-xs">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>EST. 2026 • 100% Genuine Certified Organic • Hyderabad, Telangana</span>
        </div>
      </div>
    </footer>
  );
};

