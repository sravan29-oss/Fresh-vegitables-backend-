import React, { useEffect, useState } from 'react';
import {
  Wallet as WalletIcon,
  Award,
  Users,
  Copy,
  Check,
  Share2,
  PlusCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import api from '../../services/api';
import { Wallet, WalletTransaction, LoyaltyAccount, ReferralProgram } from '../../types';
import { SEOHead } from '../../components/common/SEOHead';

export const WalletPage: React.FC = () => {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loyalty, setLoyalty] = useState<LoyaltyAccount | null>(null);
  const [referral, setReferral] = useState<ReferralProgram | null>(null);
  const [copied, setCopied] = useState(false);
  const [topupAmount, setTopupAmount] = useState<number>(200);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchWalletData = async () => {
    try {
      setIsLoading(true);
      const [walletRes, loyaltyRes, referralRes] = await Promise.all([
        api.get('/loyalty/wallet').catch(() => null),
        api.get('/loyalty/account').catch(() => null),
        api.get('/loyalty/referrals').catch(() => null),
      ]);

      if (walletRes?.data?.data) {
        setWallet(walletRes.data.data.wallet);
        setTransactions(walletRes.data.data.transactions || []);
      }
      if (loyaltyRes?.data?.data?.account) {
        setLoyalty(loyaltyRes.data.data.account);
      }
      if (referralRes?.data?.data) {
        setReferral(referralRes.data.data);
      }
    } catch (err) {
      console.error('Failed to load wallet data', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWalletData();
  }, []);

  const handleCopyCode = () => {
    if (referral?.referral_code) {
      navigator.clipboard.writeText(referral.referral_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleTopup = async () => {
    if (!topupAmount || topupAmount <= 0) return;
    try {
      setIsProcessing(true);
      const res = await api.post('/loyalty/wallet/add-funds', { amount: topupAmount });
      if (res.data?.data) {
        setWallet(res.data.data.wallet);
        setTransactions((prev) => [res.data.data.transaction, ...prev]);
        alert(`₹${topupAmount} added to your Fresh Vegetables Wallet!`);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Top-up failed');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in pb-24">
      <SEOHead title="My Wallet & Rewards | Fresh Vegetables Organic" noindex={true} />

      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Wallet, Rewards &amp; Referrals</h1>
        <p className="text-xs text-slate-500 mt-1">
          Instant 1-tap checkout, organic reward points, and friend invite bonuses.
        </p>
      </div>

      {/* 3 Main Highlight Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 1. Digital Wallet Card */}
        <div className="p-6 rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 text-white relative overflow-hidden shadow-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
              Customer Wallet
            </span>
            <WalletIcon className="w-5 h-5 text-emerald-400" />
          </div>

          <div className="my-6">
            <span className="text-xs text-slate-400">Available Balance</span>
            <div className="text-4xl font-black tracking-tight text-white mt-1">
              ₹{wallet?.balance ? wallet.balance.toFixed(2) : '250.00'}
            </div>
            <p className="text-[11px] text-emerald-300 mt-1 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> 100% Secure Backend Ledger
            </p>
          </div>

          {/* Quick top-up */}
          <div className="pt-4 border-t border-slate-800 space-y-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Quick Add Funds</span>
            <div className="flex items-center gap-2">
              {[100, 250, 500].map((amt) => (
                <button
                  key={amt}
                  onClick={() => setTopupAmount(amt)}
                  className={`text-xs px-2.5 py-1.5 rounded-lg font-bold transition-all ${
                    topupAmount === amt
                      ? 'bg-emerald-500 text-slate-950 font-black'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  +₹{amt}
                </button>
              ))}
              <button
                onClick={handleTopup}
                disabled={isProcessing}
                className="ml-auto bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black text-xs px-3 py-1.5 rounded-lg flex items-center gap-1"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>
          </div>
        </div>

        {/* 2. Loyalty Points & Tier */}
        <div className="p-6 rounded-3xl glass-card flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-brand-600">
              Loyalty Tier
            </span>
            <Award className="w-5 h-5 text-amber-500" />
          </div>

          <div className="my-6">
            <span className="text-xs text-slate-500">Points Balance</span>
            <div className="text-4xl font-black tracking-tight text-slate-900 mt-1 flex items-baseline gap-2">
              <span>{loyalty?.points_balance || 340}</span>
              <span className="text-xs font-bold text-slate-400">Pts</span>
            </div>
            <div className="inline-flex items-center gap-1.5 mt-2 bg-amber-500/10 text-amber-700 border border-amber-500/20 px-3 py-1 rounded-full text-xs font-black">
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span>{loyalty?.tier || 'SILVER'} MEMBER TIER</span>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 text-xs text-slate-500">
            Earn 1 point for every ₹10 spent on farm produce. Redeem points at checkout.
          </div>
        </div>

        {/* 3. Referral Program Card */}
        <div className="p-6 rounded-3xl glass-card flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-brand-600">
              Invite &amp; Earn ₹50
            </span>
            <Users className="w-5 h-5 text-brand-600" />
          </div>

          <div className="my-4 space-y-2">
            <span className="text-xs text-slate-500">Your Unique Referral Code</span>
            <div className="flex items-center gap-2">
              <div className="bg-slate-100 border border-slate-200 px-4 py-2.5 rounded-2xl font-mono text-base font-black text-brand-700 tracking-wider flex-1 text-center">
                {referral?.referral_code || 'PRIYA50'}
              </div>
              <button
                onClick={handleCopyCode}
                className="bg-brand-500 hover:bg-brand-400 text-slate-950 p-2.5 rounded-2xl transition-all shadow-md"
                title="Copy Code"
              >
                {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <div>
              <p className="font-bold text-slate-900">{referral?.total_invited || 3} Friends Invited</p>
              <p className="text-[11px] text-emerald-600 font-bold">₹{referral?.total_earned || 150} Earned</p>
            </div>
            <a
              href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                `Hey! Get ₹50 off on organic farm-fresh vegetables using my code ${referral?.referral_code || 'PRIYA50'}: ${typeof window !== 'undefined' ? window.location.origin : 'https://freshvegetables.com'}`
              )}`}
              target="_blank"
              rel="noreferrer"
              className="bg-emerald-500 text-white font-extrabold px-3 py-1.5 rounded-xl flex items-center gap-1.5 text-xs shadow-md"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </a>
          </div>
        </div>
      </div>

      {/* Transaction Ledger */}
      <div className="glass-card rounded-3xl p-6 sm:p-8 space-y-6">
        <h3 className="text-lg font-black text-slate-900 tracking-tight">Recent Wallet Activity</h3>

        {transactions.length === 0 ? (
          <p className="text-xs text-slate-400">No transactions recorded yet.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {transactions.map((tx) => {
              const isCredit = tx.transaction_type !== 'DEBIT';
              return (
                <div key={tx.id} className="py-3.5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold ${
                        isCredit
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-rose-100 text-rose-700'
                      }`}
                    >
                      {isCredit ? (
                        <ArrowDownLeft className="w-4 h-4" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <p className="font-extrabold text-xs text-slate-900">{tx.description}</p>
                      <p className="text-[10px] text-slate-400">
                        {new Date(tx.created_at).toLocaleString()} • Balance after: ₹
                        {tx.balance_after.toFixed(2)}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`font-black text-sm ${
                      isCredit ? 'text-emerald-600' : 'text-slate-900'
                    }`}
                  >
                    {isCredit ? '+' : '-'}₹{tx.amount.toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
