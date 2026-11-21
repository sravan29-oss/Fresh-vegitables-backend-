import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Truck, Phone, Mail, MapPin, Leaf, Clock, Banknote, Send, Check } from 'lucide-react';
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

  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    api.get('/cms/settings')
      .then((res) => {
        if (res.data?.data) {
          setStoreSettings(res.data.data);
        }
      })
      .catch(() => {});
  }, []);

  const handleNewsletterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newsletterEmail.trim()) {
      setIsSubscribed(true);
      setTimeout(() => {
        setNewsletterEmail('');
      }, 2000);
    }
  };

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
              <h4 className="font-serif font-bold text-white text-sm">2-Hour Delivery</h4>
              <p className="text-xs text-cream-300/80 mt-0.5">Dispatched within 5 KM of our hubs</p>
            </div>
          </div>

          {/* 2. 100% Certified Organic */}
          <div className="flex items-center gap-3.5 p-4 rounded-2xl bg-forest-900/60 border border-forest-800/80">
            <div className="w-11 h-11 rounded-xl bg-forest-800 text-leaf-300 flex items-center justify-center shrink-0">
              <Leaf className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-serif font-bold text-white text-sm">Farm Fresh Produce</h4>
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
              <p className="text-xs text-cream-300/80 mt-0.5">Dedicated customer assistance</p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Main 4 Columns (Step 8 Specification) ─── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-10">
          
          {/* Column 1: Brand identity and short description */}
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
                <span className="text-[10px] text-leaf-300 font-semibold tracking-wider uppercase font-sans">
                  Organic Grocery Store
                </span>
              </div>
            </div>

            <p className="text-xs text-cream-300/90 leading-relaxed font-sans">
              Dedicated to bringing chemical-free, farm-fresh organic vegetables to families in Hyderabad. Carefully selected from trusted regional farmers and delivered within 2 hours.
            </p>

            <div className="text-xs text-cream-400 space-y-1 font-sans">
              <p className="text-[11px] text-leaf-300 font-semibold">Champapet &amp; KPHB Fulfillment Hubs</p>
              <p className="text-[11px]">Strict 5 KM Hyperlocal Freshness Radius</p>
            </div>
          </div>

          {/* Column 2: Shopping navigation */}
          <div>
            <h4 className="font-serif font-bold text-white text-sm mb-4">Shopping Navigation</h4>
            <ul className="space-y-2.5 text-xs text-cream-300 font-sans">
              <li><Link to="/products" className="hover:text-white transition-colors">Shop All Vegetables</Link></li>
              <li><Link to="/products?best_seller=true" className="hover:text-white transition-colors">Customer Favourites</Link></li>
              <li><Link to="/products?featured=true" className="hover:text-white transition-colors">Seasonal Specials</Link></li>
              <li><Link to="/products?in_stock=true" className="hover:text-white transition-colors">In-Stock Today</Link></li>
              <li><Link to="/orders" className="hover:text-white transition-colors">My Orders &amp; Tracking</Link></li>
              <li><Link to="/profile" className="hover:text-white transition-colors">Saved Delivery Addresses</Link></li>
            </ul>
          </div>

          {/* Column 3: Product categories */}
          <div>
            <h4 className="font-serif font-bold text-white text-sm mb-4">Product Categories</h4>
            <ul className="space-y-2.5 text-xs text-cream-300 font-sans">
              <li><Link to="/categories/fresh" className="hover:text-white transition-colors">Fresh Vegetables</Link></li>
              <li><Link to="/categories/leafy-vegetables" className="hover:text-white transition-colors">Leafy Greens &amp; Herbs</Link></li>
              <li><Link to="/categories/coriander-others" className="hover:text-white transition-colors">Coriander &amp; Kitchen Greens</Link></li>
              <li><Link to="/categories/root-vegetables" className="hover:text-white transition-colors">Root Vegetables</Link></li>
              <li><Link to="/categories/exotic-vegetables" className="hover:text-white transition-colors">Exotic Vegetables</Link></li>
              <li><Link to="/categories/dairy" className="hover:text-white transition-colors">Farm Fresh Dairy</Link></li>
            </ul>
          </div>

          {/* Column 4: Contact and customer support */}
          <div className="space-y-4">
            <h4 className="font-serif font-bold text-white text-sm">Contact &amp; Support</h4>
            <p className="text-xs text-cream-300/90 leading-relaxed font-sans">
              Customer assistance available daily for orders, delivery status, and serviceability.
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
                <span>6:00 AM – 9:00 PM Daily</span>
              </div>
            </div>

            {/* Newsletter Subscription */}
            <div className="pt-2">
              <h5 className="text-xs font-semibold text-white mb-1.5 font-serif">Harvest Newsletter</h5>
              <form onSubmit={handleNewsletterSubmit} className="flex gap-1.5">
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  required
                  className="bg-forest-900 border border-forest-800 rounded-xl px-3 py-2 text-xs text-white placeholder:text-forest-400 focus:outline-none focus:border-leaf-500 flex-1 min-h-[38px]"
                />
                <button
                  type="submit"
                  className="px-3.5 py-2 rounded-xl bg-forest-800 hover:bg-forest-700 text-white font-semibold text-xs flex items-center justify-center transition-colors min-h-[38px] cursor-pointer"
                  title="Subscribe to harvest updates"
                >
                  {isSubscribed ? <Check className="w-3.5 h-3.5 text-leaf-300" /> : <Send className="w-3.5 h-3.5" />}
                </button>
              </form>
              {isSubscribed && (
                <span className="text-[10.5px] text-leaf-300 font-medium block mt-1">
                  ✓ Subscribed for fresh harvest updates!
                </span>
              )}
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
            <span>Cash on Delivery Available</span>
          </span>
          <span className="text-forest-800">•</span>
          <span>Champapet &amp; KPHB Colony • Hyderabad</span>
          <span className="text-forest-800">•</span>
          {/* Subtle admin access preserved without visual prominence */}
          <Link to="/admin/login" className="text-forest-700 hover:text-cream-300 transition-colors" title="Administrative Access">
            Admin
          </Link>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
