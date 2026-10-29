import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Grid, ShoppingBag, User } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';

export const MobileBottomNav: React.FC = () => {
  const { cart, setIsCartOpen } = useCart();
  const { user } = useAuth();
  const itemCount = cart?.item_count || 0;

  return (
    <nav
      aria-label="Mobile navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl border-t border-slate-200/90 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] safe-area-pb"
    >
      <div className="grid grid-cols-4 w-full h-14 items-center px-1">
        
        {/* 1. Home */}
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `flex flex-col items-center justify-center h-full min-h-[48px] py-1 rounded-xl transition-all select-none ${
              isActive ? 'text-[#0c831f] font-extrabold' : 'text-slate-500 hover:text-slate-800'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <div className="relative flex items-center justify-center">
                <Home className={`w-5 h-5 transition-transform ${isActive ? 'stroke-[2.5] scale-105' : 'stroke-[1.8]'}`} />
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[#0c831f]" />
                )}
              </div>
              <span className={`text-[10.5px] mt-0.5 tracking-tight ${isActive ? 'font-black text-[#0c831f]' : 'font-medium'}`}>
                Home
              </span>
            </>
          )}
        </NavLink>

        {/* 2. Categories */}
        <NavLink
          to="/products"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center h-full min-h-[48px] py-1 rounded-xl transition-all select-none ${
              isActive ? 'text-[#0c831f] font-extrabold' : 'text-slate-500 hover:text-slate-800'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <div className="relative flex items-center justify-center">
                <Grid className={`w-5 h-5 transition-transform ${isActive ? 'stroke-[2.5] scale-105' : 'stroke-[1.8]'}`} />
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[#0c831f]" />
                )}
              </div>
              <span className={`text-[10.5px] mt-0.5 tracking-tight ${isActive ? 'font-black text-[#0c831f]' : 'font-medium'}`}>
                Categories
              </span>
            </>
          )}
        </NavLink>

        {/* 3. Cart - Quick Commerce Bottom Cart Opener */}
        <button
          type="button"
          onClick={() => setIsCartOpen(true)}
          className="flex flex-col items-center justify-center h-full min-h-[48px] py-1 rounded-xl text-slate-500 hover:text-[#0c831f] transition-all cursor-pointer relative select-none"
          title="Open Cart"
          aria-label={`Open Cart with ${itemCount} items`}
        >
          <div className="relative flex items-center justify-center">
            <ShoppingBag className="w-5 h-5 stroke-[1.8]" />
            {itemCount > 0 && (
              <span className="absolute -top-1.5 -right-2 bg-[#0c831f] text-white text-[10px] font-black min-w-[17px] h-[17px] px-1 rounded-full flex items-center justify-center ring-2 ring-white shadow-xs">
                {itemCount}
              </span>
            )}
          </div>
          <span className={`text-[10.5px] mt-0.5 tracking-tight ${itemCount > 0 ? 'font-black text-[#0c831f]' : 'font-medium text-slate-500'}`}>
            {itemCount > 0 ? `Cart (${itemCount})` : 'Cart'}
          </span>
        </button>

        {/* 4. Account / Sign In */}
        <NavLink
          to={user ? '/profile' : '/login'}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center h-full min-h-[48px] py-1 rounded-xl transition-all select-none ${
              isActive ? 'text-[#0c831f] font-extrabold' : 'text-slate-500 hover:text-slate-800'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <div className="relative flex items-center justify-center">
                {user ? (
                  <div className="w-5 h-5 rounded-full bg-[#0c831f] text-white font-black text-[10px] flex items-center justify-center ring-1 ring-emerald-600/30">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                ) : (
                  <User className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
                )}
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[#0c831f]" />
                )}
              </div>
              <span className={`text-[10.5px] mt-0.5 tracking-tight truncate max-w-[65px] ${isActive ? 'font-black text-[#0c831f]' : 'font-medium'}`}>
                {user ? user.name.split(' ')[0] : 'Account'}
              </span>
            </>
          )}
        </NavLink>

      </div>
    </nav>
  );
};

export default MobileBottomNav;
