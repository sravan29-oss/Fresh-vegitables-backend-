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
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#05180f]/95 backdrop-blur-xl border-t border-emerald-950/80 shadow-[0_-4px_25px_rgba(0,0,0,0.5)] safe-area-pb">
      <div className="grid grid-cols-4 w-full h-15 items-center px-1">
        
        {/* 1. Home */}
        <NavLink
          to="/"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center py-1 rounded-xl transition-all ${
              isActive ? 'text-emerald-400 font-black' : 'text-slate-400 hover:text-slate-200'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <div className="relative">
                <Home className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-emerald-400 shadow-sm" />
                )}
              </div>
              <span className="text-[10px] mt-1 tracking-tight">Home</span>
            </>
          )}
        </NavLink>

        {/* 2. Categories */}
        <NavLink
          to="/products"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center py-1 rounded-xl transition-all ${
              isActive ? 'text-emerald-400 font-black' : 'text-slate-400 hover:text-slate-200'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <div className="relative">
                <Grid className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-emerald-400 shadow-sm" />
                )}
              </div>
              <span className="text-[10px] mt-1 tracking-tight">Categories</span>
            </>
          )}
        </NavLink>

        {/* 3. Cart - Real Quick Commerce Bottom Cart Opener */}
        <button
          type="button"
          onClick={() => setIsCartOpen(true)}
          className="flex flex-col items-center justify-center py-1 rounded-xl text-slate-400 hover:text-emerald-300 transition-all cursor-pointer relative"
          title="Open Cart"
        >
          <div className="relative">
            <ShoppingBag className="w-5 h-5 stroke-[1.8]" />
            {itemCount > 0 && (
              <span className="absolute -top-1.5 -right-2 bg-emerald-500 text-slate-950 text-[10px] font-black min-w-[17px] h-[17px] px-1 rounded-full flex items-center justify-center ring-2 ring-[#05180f] animate-pulse shadow-sm">
                {itemCount}
              </span>
            )}
          </div>
          <span className="text-[10px] mt-1 tracking-tight font-bold text-emerald-300">
            {itemCount > 0 ? `Cart (${itemCount})` : 'Cart'}
          </span>
        </button>

        {/* 4. Account / Sign In */}
        <NavLink
          to={user ? '/profile' : '/login'}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center py-1 rounded-xl transition-all ${
              isActive ? 'text-emerald-400 font-black' : 'text-slate-400 hover:text-slate-200'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <div className="relative">
                {user ? (
                  <div className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 font-black text-[10px] flex items-center justify-center ring-1 ring-emerald-300">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                ) : (
                  <User className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
                )}
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-emerald-400 shadow-sm" />
                )}
              </div>
              <span className="text-[10px] mt-1 tracking-tight font-medium">
                {user ? user.name.split(' ')[0] : 'Account'}
              </span>
            </>
          )}
        </NavLink>

      </div>
    </nav>
  );
};
