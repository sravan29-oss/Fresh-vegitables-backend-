import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, useNavigate } from 'react-router-dom';
import { Home, Grid, Search, ShoppingBag, User, LogOut, Package, Wallet, X, ChevronRight } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';

export const MobileBottomNav: React.FC = () => {
  const { cart, setIsCartOpen } = useCart();
  const { user, logout, showLogoutConfirm, showLogoutSuccess } = useAuth();
  const navigate = useNavigate();
  const [isAccountSheetOpen, setIsAccountSheetOpen] = useState(false);
  const itemCount = cart?.item_count || 0;

  const handleLogout = () => {
    setIsAccountSheetOpen(false);
    showLogoutConfirm(() => {
      logout();
      showLogoutSuccess(false, () => {
        navigate('/');
      });
    });
  };

  return (
    <nav
      aria-label="Mobile navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/98 backdrop-blur-xl border-t border-line shadow-soft-md safe-area-pb"
    >
      <div className="grid grid-cols-5 w-full h-15 items-center px-1">
        
        {/* 1. Home */}
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `flex flex-col items-center justify-center h-full min-h-[48px] py-1.5 rounded-xl transition-all select-none cursor-pointer ${
              isActive ? 'text-forest-900 font-bold' : 'text-charcoal-500 hover:text-forest-900'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <div className="relative flex items-center justify-center">
                <Home className={`w-5 h-5 transition-transform ${isActive ? 'stroke-[2.5] scale-105 text-forest-900' : 'stroke-[1.8]'}`} />
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-leaf-500" />
                )}
              </div>
              <span className={`text-[10.5px] mt-1 tracking-tight ${isActive ? 'font-bold text-forest-900' : 'font-medium'}`}>
                Home
              </span>
            </>
          )}
        </NavLink>

        {/* 2. Categories */}
        <NavLink
          to="/products"
          end
          className={({ isActive }) =>
            `flex flex-col items-center justify-center h-full min-h-[48px] py-1.5 rounded-xl transition-all select-none cursor-pointer ${
              isActive ? 'text-forest-900 font-bold' : 'text-charcoal-500 hover:text-forest-900'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <div className="relative flex items-center justify-center">
                <Grid className={`w-5 h-5 transition-transform ${isActive ? 'stroke-[2.5] scale-105 text-forest-900' : 'stroke-[1.8]'}`} />
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-leaf-500" />
                )}
              </div>
              <span className={`text-[10.5px] mt-1 tracking-tight ${isActive ? 'font-bold text-forest-900' : 'font-medium'}`}>
                Explore
              </span>
            </>
          )}
        </NavLink>

        {/* 3. Search */}
        <button
          type="button"
          onClick={() => {
            const searchInput = document.querySelector('input[type="text"]') as HTMLInputElement | null;
            if (searchInput) {
              searchInput.focus();
              searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
              navigate('/products');
            }
          }}
          className="flex flex-col items-center justify-center h-full min-h-[48px] py-1.5 rounded-xl text-charcoal-500 hover:text-forest-900 transition-all cursor-pointer select-none"
          title="Search Produce"
          aria-label="Search Produce"
        >
          <div className="relative flex items-center justify-center">
            <Search className="w-5 h-5 stroke-[1.8]" />
          </div>
          <span className="text-[10.5px] mt-1 tracking-tight font-medium">
            Search
          </span>
        </button>

        {/* 4. Cart - Bottom Cart Opener */}
        <button
          type="button"
          onClick={() => setIsCartOpen(true)}
          className="flex flex-col items-center justify-center h-full min-h-[48px] py-1.5 rounded-xl text-charcoal-500 hover:text-forest-900 transition-all cursor-pointer relative select-none"
          title="Open Cart"
          aria-label={`Open Cart with ${itemCount} items`}
        >
          <div className="relative flex items-center justify-center">
            <ShoppingBag className="w-5 h-5 stroke-[1.8]" />
            {itemCount > 0 && (
              <span className="absolute -top-1.5 -right-2 bg-harvest-500 text-charcoal-900 text-[10px] font-bold min-w-[17px] h-[17px] px-1 rounded-full flex items-center justify-center ring-2 ring-white shadow-soft">
                {itemCount}
              </span>
            )}
          </div>
          <span className={`text-[10.5px] mt-1 tracking-tight ${itemCount > 0 ? 'font-bold text-forest-900' : 'font-medium text-charcoal-500'}`}>
            {itemCount > 0 ? `Cart (${itemCount})` : 'Cart'}
          </span>
        </button>

        {/* 5. Account / Sign In */}
        {user ? (
          <button
            type="button"
            onClick={() => setIsAccountSheetOpen(true)}
            className="flex flex-col items-center justify-center h-full min-h-[48px] py-1.5 rounded-xl text-charcoal-600 hover:text-forest-900 transition-all cursor-pointer relative select-none"
            title="Account & Menu"
            aria-label="Open Account Menu"
          >
            <div className="relative flex items-center justify-center">
              <div className="w-5 h-5 rounded-full bg-forest-900 text-white font-bold text-[10px] flex items-center justify-center shadow-soft">
                {user.name.charAt(0).toUpperCase()}
              </div>
            </div>
            <span className="text-[10.5px] mt-1 tracking-tight truncate max-w-[55px] font-medium text-charcoal-700">
              {user.name.split(' ')[0]}
            </span>
          </button>
        ) : (
          <NavLink
            to="/login"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center h-full min-h-[48px] py-1.5 rounded-xl transition-all select-none cursor-pointer ${
                isActive ? 'text-forest-900 font-bold' : 'text-charcoal-500 hover:text-forest-900'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div className="relative flex items-center justify-center">
                  <User className={`w-5 h-5 ${isActive ? 'stroke-[2.5] text-forest-900' : 'stroke-[1.8]'}`} />
                  {isActive && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-leaf-500" />
                  )}
                </div>
                <span className={`text-[10.5px] mt-1 tracking-tight truncate max-w-[55px] ${isActive ? 'font-bold text-forest-900' : 'font-medium'}`}>
                  Sign In
                </span>
              </>
            )}
          </NavLink>
        )}

      </div>

      {/* Mobile Account Bottom Sheet */}
      {isAccountSheetOpen && user && createPortal(
        <div
          className="fixed inset-0 z-[99999] bg-charcoal-950/60 backdrop-blur-xs flex flex-col justify-end animate-fade-in"
          onClick={() => setIsAccountSheetOpen(false)}
        >
          <div
            className="bg-white border-t border-line rounded-t-3xl p-5 space-y-4 shadow-soft-lg max-h-[80vh] overflow-y-auto animate-slide-up text-charcoal-900"
            onClick={(e) => e.stopPropagation()}
          >
            {/* User Header */}
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-forest-900 text-white font-bold text-base flex items-center justify-center shadow-soft">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-serif font-bold text-sm text-charcoal-900 leading-tight">{user.name}</h3>
                  <p className="text-xs text-charcoal-500 mt-0.5 font-sans">{user.email || user.mobile || 'Organic Customer'}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAccountSheetOpen(false)}
                className="w-8 h-8 rounded-full bg-cream-50 hover:bg-cream-100 flex items-center justify-center text-charcoal-500 hover:text-charcoal-900 transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Links */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  setIsAccountSheetOpen(false);
                  navigate('/profile');
                }}
                className="w-full flex items-center justify-between p-3 rounded-2xl bg-cream-50 hover:bg-sage-100/60 transition-colors text-left border border-line"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-sage-100 text-forest-700 flex items-center justify-center">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-semibold text-xs text-charcoal-900 block">Profile &amp; Addresses</span>
                    <span className="text-[10px] text-charcoal-400">Manage address and contact info</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-charcoal-400" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsAccountSheetOpen(false);
                  navigate('/orders');
                }}
                className="w-full flex items-center justify-between p-3 rounded-2xl bg-cream-50 hover:bg-sage-100/60 transition-colors text-left border border-line"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-sage-100 text-forest-700 flex items-center justify-center">
                    <Package className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-semibold text-xs text-charcoal-900 block">My Orders</span>
                    <span className="text-[10px] text-charcoal-400">Track and view harvest orders</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-charcoal-400" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsAccountSheetOpen(false);
                  navigate('/wallet');
                }}
                className="w-full flex items-center justify-between p-3 rounded-2xl bg-cream-50 hover:bg-sage-100/60 transition-colors text-left border border-line"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-harvest-50 text-harvest-600 flex items-center justify-center border border-harvest-500/20">
                    <Wallet className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-semibold text-xs text-charcoal-900 block">Wallet &amp; Credits</span>
                    <span className="text-[10px] text-charcoal-400">View store credits &amp; balance</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-charcoal-400" />
              </button>
            </div>

            {/* Logout / Sign Out Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 p-3.5 rounded-full bg-tomato-50 hover:bg-tomato-100/80 active:scale-[0.98] border border-tomato-500/20 text-tomato-500 font-semibold text-xs transition-all cursor-pointer min-h-[44px]"
              >
                <LogOut className="w-4 h-4 text-tomato-500" />
                <span>Log Out of Account</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </nav>
  );
};

export default MobileBottomNav;
