import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Grid, Search, ShoppingBag, User } from 'lucide-react';
import { useCart } from '../../context/CartContext';

export const MobileBottomNav: React.FC = () => {
  const { cart } = useCart();
  const itemCount = cart?.item_count || 0;

  const links = [
    { name: 'Home', path: '/', icon: Home },
    { name: 'Categories', path: '/products', icon: Grid },
    { name: 'Search', path: '/products?focus=search', icon: Search },
    { name: 'Orders', path: '/orders', icon: ShoppingBag, badge: itemCount > 0 ? itemCount : null },
    { name: 'Account', path: '/profile', icon: User },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-xl border-t border-slate-800/80 px-2 py-1.5 shadow-2xl safe-area-pb">
      <div className="flex items-center justify-around">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <NavLink
              key={link.name}
              to={link.path}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all relative ${
                  isActive ? 'text-brand-400 font-extrabold' : 'text-slate-400 hover:text-slate-200'
                }`
              }
            >
              <div className="relative">
                <Icon className="w-5 h-5" />
                {link.badge !== null && link.badge !== undefined && (
                  <span className="absolute -top-1 -right-2 bg-brand-500 text-slate-950 text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center ring-2 ring-slate-950 animate-pulse">
                    {link.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-1 tracking-tight">{link.name}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};
