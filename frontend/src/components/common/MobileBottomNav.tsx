import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, useNavigate } from 'react-router-dom';
import { Home, Grid, ShoppingBag, User, LogOut, Package, Wallet, X, ChevronRight } from 'lucide-react';
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

        {/* 4. Account / Sign In with Quick Logout Support */}
        {user ? (
          <button
            type="button"
            onClick={() => setIsAccountSheetOpen(true)}
            className="flex flex-col items-center justify-center h-full min-h-[48px] py-1 rounded-xl text-slate-600 hover:text-[#0c831f] transition-all cursor-pointer relative select-none"
            title="Account & Menu"
            aria-label="Open Account Menu"
          >
            <div className="relative flex items-center justify-center">
              <div className="w-5 h-5 rounded-full bg-[#0c831f] text-white font-black text-[10px] flex items-center justify-center ring-1 ring-emerald-600/30">
                {user.name.charAt(0).toUpperCase()}
              </div>
            </div>
            <span className="text-[10.5px] mt-0.5 tracking-tight truncate max-w-[65px] font-bold text-slate-700">
              {user.name.split(' ')[0]}
            </span>
          </button>
        ) : (
          <NavLink
            to="/login"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center h-full min-h-[48px] py-1 rounded-xl transition-all select-none ${
                isActive ? 'text-[#0c831f] font-extrabold' : 'text-slate-500 hover:text-slate-800'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div className="relative flex items-center justify-center">
                  <User className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
                  {isActive && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[#0c831f]" />
                  )}
                </div>
                <span className={`text-[10.5px] mt-0.5 tracking-tight truncate max-w-[65px] ${isActive ? 'font-black text-[#0c831f]' : 'font-medium'}`}>
                  Sign In
                </span>
              </>
            )}
          </NavLink>
        )}

      </div>

      {/* Mobile Account Bottom Sheet with Explicit Logout Button */}
      {isAccountSheetOpen && user && createPortal(
        <div
          className="fixed inset-0 z-[99999] bg-slate-950/60 backdrop-blur-xs flex flex-col justify-end animate-fade-in"
          onClick={() => setIsAccountSheetOpen(false)}
        >
          <div
            className="bg-white border-t border-slate-200 rounded-t-3xl p-5 space-y-4 shadow-2xl max-h-[80vh] overflow-y-auto animate-slide-up text-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            {/* User Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-[#0c831f] text-white font-black text-base flex items-center justify-center shadow-xs">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 leading-tight">{user.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{user.email || user.mobile || 'Organic Customer'}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAccountSheetOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Links */}
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => {
                  setIsAccountSheetOpen(false);
                  navigate('/profile');
                }}
                className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-[#0c831f] flex items-center justify-center">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-xs text-slate-900 block">Profile & Addresses</span>
                    <span className="text-[10px] text-slate-400">Manage address and contact info</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsAccountSheetOpen(false);
                  navigate('/orders');
                }}
                className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-[#0c831f] flex items-center justify-center">
                    <Package className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-xs text-slate-900 block">My Orders</span>
                    <span className="text-[10px] text-slate-400">Track and view past orders</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsAccountSheetOpen(false);
                  navigate('/wallet');
                }}
                className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
                    <Wallet className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-xs text-slate-900 block">Wallet & Cashback</span>
                    <span className="text-[10px] text-slate-400">View balance & credits</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            {/* Logout / Sign Out Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 p-3.5 rounded-2xl bg-rose-50 hover:bg-rose-100 active:scale-98 border border-rose-200 text-rose-600 font-black text-xs transition-all shadow-xs cursor-pointer"
              >
                <LogOut className="w-4 h-4 text-rose-600" />
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
