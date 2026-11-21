import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Truck, ShieldCheck, Phone, Mail, MapPin, Leaf, Clock, Banknote, HelpCircle } from 'lucide-react';
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
    <footer className="bg-forest-950 text-cream-200 border-t border-forest-900 pt-14 sm:pt-16 pb-12">
      {/* ─── Top Trust Banner ─── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-10 border-b border-forest-900/80">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {/* 1. 2-Hour Delivery */}
          <div className="flex items-center gap-3.5 p-4 rounded-2xl bg-forest-900/60 border border-forest-800/80">
            <div className="w-11 h-11 rounded-xl bg-forest-800 text-leaf-300 flex items-center justify-center shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-serif font-bold text-white text-sm">2-Hour Express Delivery</h4>
              <p className="text-xs text-cream-300/80 mt-0.5">Dispatched within 5 KM of our hubs</p>
            </div>
          </div>

          {/* 2. 100% Certified Organic */}
          <div className="flex items-center gap-3.5 p-4 rounded-2xl bg-forest-900/60 border border-forest-800/80">
            <div className="w-11 h-11 rounded-xl bg-forest-800 text-leaf-300 flex items-center justify-center shrink-0">
              <Leaf className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-serif font-bold text-white text-sm">100% Certified Organic</h4>
              <p className="text-xs text-cream-300/80 mt-0.5">Zero chemicals or synthetic pesticides</p>
            </div>
          </div>

          {/* 3. Cash on Delivery Available */}
          <div className="flex items-center gap-3.5 p-4 rounded-2xl bg-forest-900/60 border border-forest-800/80">
            <div className="w-11 h-11 rounded-xl bg-forest-800 text-harvest-400 flex items-center justify-center shrink-0">
              <Banknote className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-serif font-bold text-white text-sm">Cash on Delivery (COD)</h4>
              <p className="text-xs text-cream-300/80 mt-0.5">Pay at your doorstep upon arrival</p>
            </div>
          </div>

          {/* 4. Dedicated Support */}
          <div className="flex items-center gap-3.5 p-4 rounded-2xl bg-forest-900/60 border border-forest-800/80">
            <div className="w-11 h-11 rounded-xl bg-forest-800 text-leaf-300 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-serif font-bold text-white text-sm">6 AM – 9 PM Support</h4>
              <p className="text-xs text-cream-300/80 mt-0.5">Daily customer assistance</p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Main 4 Columns ─── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-10">
          {/* Column 1: Brand Story & Legal Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <img
                src="/logo.png"
                alt="Fresh Vegetables Organic"
                className="w-11 h-11 rounded-2xl object-cover border border-forest-700 shadow-soft"
              />
              <div className="flex flex-col">
                <span className="font-serif font-bold text-lg text-white tracking-tight">
                  Fresh Vegetables
                </span>
                <span className="text-[10px] text-leaf-300 font-semibold tracking-wider uppercase">
                  100% Certified Organic
                </span>
              </div>
            </div>

            <p className="text-xs text-cream-300/90 leading-relaxed font-sans">
              Dedicated to bringing chemical-free, farm-fresh organic vegetables to families in Hyderabad. Sourced daily from verified organic growers and delivered with care.
            </p>

            <div className="pt-1 text-xs text-cream-400 space-y-1 font-sans">
              <p className="text-[11px] text-leaf-300 font-semibold">FSSAI Certified Operations</p>
              <p className="text-[11px]">Direct Farm-to-Home Delivery Network</p>
            </div>
          </div>

          {/* Column 2: Quick Links */}
          <div>
            <h4 className="font-serif font-bold text-white text-sm mb-4">Quick Links</h4>
            <ul className="space-y-2.5 text-xs text-cream-300 font-sans">
              <li><Link to="/products" className="hover:text-white transition-colors">Shop All Vegetables</Link></li>
              <li><Link to="/categories/leafy-vegetables" className="hover:text-white transition-colors">Leafy Greens &amp; Herbs</Link></li>
              <li><Link to="/categories/fresh" className="hover:text-white transition-colors">Daily Fresh Produce</Link></li>
              <li><Link to="/products?featured=true" className="hover:text-white transition-colors">Seasonal Specials</Link></li>
              <li><Link to="/orders" className="hover:text-white transition-colors">My Orders &amp; Tracking</Link></li>
              <li><Link to="/profile" className="hover:text-white transition-colors">Manage Delivery Addresses</Link></li>
            </ul>
          </div>

          {/* Column 3: Service Areas */}
          <div>
            <h4 className="font-serif font-bold text-white text-sm mb-4">Service Areas</h4>
            <ul className="space-y-2.5 text-xs text-cream-300 font-sans">
              <li className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 text-leaf-400 shrink-0 mt-0.5" />
                <span>Champapet Hub — 5 KM Delivery Radius</span>
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 text-leaf-400 shrink-0 mt-0.5" />
                <span>KPHB Colony Hub — 5 KM Delivery Radius</span>
              </li>
              <li className="flex items-start gap-2">
                <Clock className="w-3.5 h-3.5 text-leaf-400 shrink-0 mt-0.5" />
                <span>Morning Harvest Slot: 6:00 AM – 10:00 AM</span>
              </li>
              <li className="flex items-start gap-2">
                <Clock className="w-3.5 h-3.5 text-leaf-400 shrink-0 mt-0.5" />
                <span>Evening Slot: 4:00 PM – 8:00 PM</span>
              </li>
              <li className="pt-2">
                <Link to="/admin/login" className="text-[11px] text-cream-400 hover:text-white transition-colors flex items-center gap-1.5">
                  <span>🔐 Store Admin Login</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4: Contact & Support */}
          <div className="space-y-4">
            <h4 className="font-serif font-bold text-white text-sm">Customer Care</h4>
            <p className="text-xs text-cream-300/90 leading-relaxed font-sans">
              Need assistance with an active order or delivery serviceability inquiry?
            </p>

            <div className="text-xs text-cream-300 space-y-2.5 font-sans">
              <a
                href={`tel:${(storeSettings.support_phone || '+91 8106970384').replace(/[\s-]/g, '')}`}
                className="flex items-center gap-2 hover:text-white transition-colors font-medium"
              >
                <Phone className="w-4 h-4 text-leaf-400 shrink-0" />
                <span>{storeSettings.support_phone || '+91 8106970384'}</span>
              </a>

              <a
                href={`mailto:${storeSettings.support_email || 'freshvegitables29@gmail.com'}`}
                className="flex items-center gap-2 hover:text-white transition-colors font-medium"
              >
                <Mail className="w-4 h-4 text-leaf-400 shrink-0" />
                <span>{storeSettings.support_email || 'freshvegitables29@gmail.com'}</span>
              </a>

              <div className="flex items-center gap-2 text-cream-400">
                <Clock className="w-4 h-4 text-leaf-400 shrink-0" />
                <span>Support Hours: 6:00 AM – 9:00 PM Daily</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Bottom Bar ─── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 border-t border-forest-900/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-cream-400 font-sans">
        <p>© 2026 Fresh Vegetables Organic. All rights reserved.</p>

        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 text-xs">
          <span className="flex items-center gap-1 text-cream-300">
            <Banknote className="w-3.5 h-3.5 text-harvest-400" />
            <span>Cash on Delivery (COD) Available</span>
          </span>
          <span className="text-forest-800">•</span>
          <span>Champapet &amp; KPHB Colony • Hyderabad</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
