import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Truck, ShieldCheck, HeartHandshake, Sparkles, Phone, Mail, MapPin, Leaf } from 'lucide-react';
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
    <footer className="bg-forest-950 text-forest-200 border-t border-forest-900/80 pt-16 pb-12">
      {/* ─── Top Trust Points Banner ─── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 border-b border-forest-900">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {/* 1. Same-Day Delivery */}
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-forest-900/60 border border-forest-800/80 hover:border-leaf-500/30 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-forest-800/80 text-leaf-400 flex items-center justify-center shrink-0">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-serif font-bold text-cream-50 text-sm">Same-Day Delivery</h4>
              <p className="text-xs text-forest-300/80 mt-0.5">Fresh delivery within our serviceable areas in Hyderabad</p>
            </div>
          </div>

          {/* 2. Organic Produce */}
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-forest-900/60 border border-forest-800/80 hover:border-leaf-500/30 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-forest-800/80 text-leaf-400 flex items-center justify-center shrink-0">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-serif font-bold text-cream-50 text-sm">Organic Produce</h4>
              <p className="text-xs text-forest-300/80 mt-0.5">Carefully sourced fresh vegetables</p>
            </div>
          </div>

          {/* 3. 5 KM Delivery Radius */}
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-forest-900/60 border border-forest-800/80 hover:border-leaf-500/30 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-forest-800/80 text-leaf-400 flex items-center justify-center shrink-0">
              <Leaf className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-serif font-bold text-cream-50 text-sm">5 KM Delivery Radius</h4>
              <p className="text-xs text-forest-300/80 mt-0.5">Local dispatch for maximum freshness</p>
            </div>
          </div>

          {/* 4. Customer Support */}
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-forest-900/60 border border-forest-800/80 hover:border-leaf-500/30 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-forest-800/80 text-marigold-400 flex items-center justify-center shrink-0">
              <Phone className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-serif font-bold text-cream-50 text-sm">Dedicated Support</h4>
              <p className="text-xs text-forest-300/80 mt-0.5">Quick assistance for your orders</p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Main Footer Columns ─── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand Bio */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <img
                src="/logo.png"
                alt="Fresh Vegetables Organic"
                className="w-11 h-11 rounded-2xl object-cover border border-forest-700 shadow-soft"
              />
              <div className="flex flex-col">
                <span className="font-serif font-bold text-lg text-cream-50 tracking-tight">
                  Fresh Vegetables
                </span>
                <span className="text-[10px] text-leaf-400 font-semibold tracking-wider uppercase">
                  Organic Boutique Delivery
                </span>
              </div>
            </div>
            <p className="text-xs text-forest-300/90 leading-relaxed font-sans">
              Fresh vegetables delivered directly to your doorstep in Hyderabad within our 5 km service zone.
            </p>
            <div className="text-xs text-forest-300 space-y-2.5 pt-2 font-sans">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-leaf-400 shrink-0" />
                <span>{storeSettings.store_address || 'Hyderabad, Telangana'}</span>
              </div>
              <a
                href={`tel:${(storeSettings.support_phone || '+91 8106970384').replace(/[\s-]/g, '')}`}
                className="flex items-center gap-2 hover:text-cream-50 transition-colors font-medium"
              >
                <Phone className="w-4 h-4 text-leaf-400 shrink-0" />
                <span>{storeSettings.support_phone || '+91 8106970384'}</span>
              </a>
              <a
                href={`mailto:${storeSettings.support_email || 'freshvegitables29@gmail.com'}`}
                className="flex items-center gap-2 hover:text-cream-50 transition-colors font-medium"
              >
                <Mail className="w-4 h-4 text-leaf-400 shrink-0" />
                <span>{storeSettings.support_email || 'freshvegitables29@gmail.com'}</span>
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-serif font-bold text-cream-50 text-sm mb-4">Quick Links</h4>
            <ul className="space-y-2.5 text-xs text-forest-300 font-sans">
              <li><Link to="/products" className="hover:text-cream-50 transition-colors">All Vegetables</Link></li>
              <li><Link to="/products?featured=true" className="hover:text-cream-50 transition-colors">Seasonal Specials</Link></li>
              <li><Link to="/products?best_seller=true" className="hover:text-cream-50 transition-colors">Best Sellers</Link></li>
              <li><Link to="/orders" className="hover:text-cream-50 transition-colors">Track My Order</Link></li>
              <li><Link to="/profile" className="hover:text-cream-50 transition-colors">My Addresses</Link></li>
            </ul>
          </div>

          {/* Categories */}
          <div>
            <h4 className="font-serif font-bold text-cream-50 text-sm mb-4">Harvest Categories</h4>
            <ul className="space-y-2.5 text-xs text-forest-300 font-sans">
              <li><Link to="/categories/fresh" className="hover:text-cream-50 transition-colors">Daily Fresh Produce</Link></li>
              <li><Link to="/categories/leafy-vegetables" className="hover:text-cream-50 transition-colors">Leafy Greens &amp; Herbs</Link></li>
              <li><Link to="/categories/coriander-others" className="hover:text-cream-50 transition-colors">Coriander, Mint &amp; Essentials</Link></li>
              <li><Link to="/categories/dairy" className="hover:text-cream-50 transition-colors">Farm Fresh Dairy</Link></li>
              <li><Link to="/products" className="hover:text-cream-50 transition-colors">All Organic Vegetables</Link></li>
            </ul>
          </div>

          {/* Newsletter */}
          <div className="space-y-4">
            <h4 className="font-serif font-bold text-cream-50 text-sm">Harvest Updates</h4>
            <p className="text-xs text-forest-300/90 leading-relaxed font-sans">
              Subscribe for weekly harvest arrivals, seasonal specials, and organic produce updates.
            </p>
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="Enter your email"
                className="bg-forest-900 border border-forest-800 rounded-full px-4 py-2.5 text-xs text-cream-50 placeholder:text-forest-400 focus:outline-none focus:border-leaf-500 focus:ring-1 focus:ring-leaf-500 flex-1 min-h-[44px]"
              />
              <button
                type="button"
                className="btn-pill-primary px-4 py-2 text-xs font-semibold shrink-0 min-h-[44px]"
              >
                Join
              </button>
            </div>
            <div className="pt-2">
              <Link to="/admin/login" className="text-xs text-forest-400 hover:text-cream-50 transition-colors font-sans">
                🔐 Store Administration Login
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Bottom Copyright Bar ─── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 border-t border-forest-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-forest-400 font-sans">
        <p>© 2026 Fresh Vegetables Organic. All rights reserved.</p>
        <div className="flex items-center gap-2 text-forest-200 font-medium bg-forest-900/80 border border-forest-800 px-3.5 py-1.5 rounded-full shadow-soft">
          <ShieldCheck className="w-4 h-4 text-leaf-400 shrink-0" />
          <span>Fresh Vegetables Organic • Hyderabad, Telangana</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
