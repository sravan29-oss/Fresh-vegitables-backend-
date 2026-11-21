import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
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
  ArrowLeft,
  CreditCard,
  CheckCircle2,
  Gift,
  Zap,
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
  const [topupNotice, setTopupNotice] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [txFilter, setTxFilter] = useState<'all' | 'credit' | 'debit'>('all');

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

  const handleTopup = () => {
    setTopupNotice(
      'Online wallet top-up via UPI / NetBanking is temporarily awaiting production payment gateway activation. Your current balance can be spent at checkout, or you can choose Cash on Delivery for instant order confirmation.'
    );
  };

  const filteredTransactions = useMemo(() => {
    if (txFilter === 'credit') {
      return transactions.filter((t) => t.transaction_type !== 'DEBIT');
    }
    if (txFilter === 'debit') {
      return transactions.filter((t) => t.transaction_type === 'DEBIT');
    }
    return transactions;
  }, [transactions, txFilter]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-8 font-sans animate-slide-up pb-24">
      <SEOHead title="My Wallet & Rewards | Fresh Vegetables Organic" noindex={true} />

      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-semibold text-ink-500">
        <Link to="/" className="hover:text-forest-900 transition-colors">Home</Link>
        <span className="text-ink-300">/</span>
        <span className="text-ink-900 font-bold">Wallet &amp; Rewards</span>
      </nav>

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-ink-900 tracking-tight">
            Wallet, Rewards &amp; Referrals
          </h1>
          <p className="text-xs sm:text-sm text-ink-500 mt-1">
            Seamless 1-tap checkout, organic produce reward points, and customer referral benefits.
          </p>
        </div>
        <Link
          to="/profile"
          className="text-xs sm:text-sm font-semibold text-forest-700 hover:text-forest-900 flex items-center gap-1.5 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>My Profile</span>
        </Link>
      </div>

      {isLoading ? (
        <div className="py-20 text-center">
          <div className="w-10 h-10 border-3 border-forest-900 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-ink-400 text-xs mt-3 font-medium">Loading your organic wallet & rewards balance...</p>
        </div>
      ) : (
        <>
          {/* 3 Main Highlight Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 1. Digital Wallet Card */}
            <div className="p-6 sm:p-7 rounded-3xl bg-forest-900 text-cream-50 relative overflow-hidden shadow-soft flex flex-col justify-between border border-forest-800">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-leaf-300 bg-cream-50/10 px-2.5 py-1 rounded-full border border-cream-50/20">
                  Customer Wallet
                </span>
                <div className="w-8 h-8 rounded-full bg-cream-50/10 flex items-center justify-center text-leaf-300">
                  <WalletIcon className="w-4 h-4" />
                </div>
              </div>

              <div className="my-6">
                <span className="text-xs text-cream-200/80 font-medium">Available Balance</span>
                <div className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-cream-50 mt-1">
                  ₹{typeof wallet?.balance === 'number' ? Number(wallet.balance).toFixed(2) : '0.00'}
                </div>
                <p className="text-[11px] text-leaf-200 mt-1 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-leaf-300" />
                  <span>Secure Verified Ledger • Instant Checkout</span>
                </p>
              </div>

              {/* Top-up section with Gateway in Progress notice */}
              <div className="pt-4 border-t border-cream-50/15 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-cream-200/80 uppercase">Add Grocery Funds</span>
                  <span className="text-[9px] font-bold text-amber-300 bg-amber-900/40 px-2 py-0.5 rounded-full border border-amber-400/30">
                    Gateway In Progress
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {[100, 200, 500, 1000].map((amt) => (
                    <button
                      type="button"
                      key={amt}
                      onClick={() => {
                        setTopupAmount(amt);
                        handleTopup();
                      }}
                      className={`text-xs px-3 py-1.5 rounded-full font-bold transition-all cursor-pointer min-h-[32px] ${
                        topupAmount === amt
                          ? 'bg-cream-50 text-forest-900 shadow-soft'
                          : 'bg-cream-50/15 text-cream-50 hover:bg-cream-50/25'
                      }`}
                    >
                      +₹{amt}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={handleTopup}
                    className="ml-auto btn-pill-primary bg-leaf-500 hover:bg-leaf-600 text-forest-950 font-bold text-xs px-4 py-1.5 rounded-full flex items-center gap-1 cursor-pointer min-h-[32px] shadow-soft"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Top-up</span>
                  </button>
                </div>

                {topupNotice && (
                  <div className="p-2.5 rounded-xl bg-amber-950/60 border border-amber-400/30 text-amber-200 text-[10px] leading-relaxed flex items-start gap-1.5 animate-in fade-in">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Gateway Integration Pending</p>
                      <p>{topupNotice}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 2. Loyalty Points & Tier */}
            <div className="p-6 sm:p-7 rounded-3xl bg-surface border border-line shadow-soft flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-forest-700 bg-sage-100 px-2.5 py-1 rounded-full border border-leaf-500/20">
                  Organic Rewards
                </span>
                <div className="w-8 h-8 rounded-full bg-cream-100 flex items-center justify-center text-marigold-600">
                  <Award className="w-4 h-4" />
                </div>
              </div>

              <div className="my-6">
                <span className="text-xs text-ink-500 font-medium">Reward Points Balance</span>
                <div className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-ink-900 mt-1 flex items-baseline gap-2">
                  <span>{typeof loyalty?.points_balance === 'number' ? loyalty.points_balance : 0}</span>
                  <span className="text-xs font-bold text-ink-400 font-sans">Points</span>
                </div>
                <div className="inline-flex items-center gap-1.5 mt-2 bg-marigold-50 text-marigold-800 border border-marigold-200/80 px-3 py-1 rounded-full text-xs font-bold">
                  <Sparkles className="w-3 h-3 text-marigold-600" />
                  <span>{(loyalty?.tier || 'SEEDLING').toUpperCase()} MEMBER TIER</span>
                </div>
              </div>

              <div className="pt-4 border-t border-line text-xs text-ink-500 leading-relaxed space-y-1">
                <p>Earn 1 point for every ₹10 spent on certified organic produce.</p>
                <p className="text-[11px] text-forest-800 font-medium">100 Points = ₹10 off at checkout.</p>
              </div>
            </div>

            {/* 3. Referral Program Card */}
            <div className="p-6 sm:p-7 rounded-3xl bg-surface border border-line shadow-soft flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-forest-700 bg-sage-100 px-2.5 py-1 rounded-full border border-leaf-500/20">
                  Invite &amp; Earn ₹50
                </span>
                <div className="w-8 h-8 rounded-full bg-cream-100 flex items-center justify-center text-forest-700">
                  <Users className="w-4 h-4" />
                </div>
              </div>

              <div className="my-4 space-y-2">
                <span className="text-xs text-ink-500 font-medium">Your Unique Referral Code</span>
                <div className="flex items-center gap-2">
                  <div className="bg-cream-100 border border-line px-4 py-2.5 rounded-2xl font-mono text-base font-bold text-forest-900 tracking-wider flex-1 text-center">
                    {referral?.referral_code || 'ORGANIC50'}
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="bg-forest-900 hover:bg-forest-850 text-cream-50 p-2.5 rounded-2xl transition-all shadow-soft cursor-pointer min-h-[42px] min-w-[42px] flex items-center justify-center"
                    title="Copy Code"
                    aria-label="Copy referral code"
                  >
                    {copied ? <Check className="w-4 h-4 text-leaf-300" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-3 border-t border-line flex items-center justify-between text-xs">
                <div>
                  <p className="font-bold text-ink-900">{referral?.total_invited ?? 0} Friends Invited</p>
                  <p className="text-[11px] text-forest-700 font-bold">₹{referral?.total_earned ?? 0} Earned</p>
                </div>
                <a
                  href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                    `Hey! Get ₹50 off on organic farm-fresh vegetables using my code ${referral?.referral_code || 'ORGANIC50'}: ${typeof window !== 'undefined' ? window.location.origin : 'https://fresh-vegetables-organic.vercel.app'}`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-pill-primary bg-leaf-500 hover:bg-leaf-600 text-forest-950 font-bold px-3.5 py-1.5 rounded-full flex items-center gap-1.5 text-xs shadow-soft min-h-[32px]"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </a>
              </div>
            </div>
          </div>

          {/* Organic Wallet Perks Banner */}
          <div className="p-4 sm:p-5 rounded-3xl bg-sage-50/70 border border-leaf-500/20 flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-forest-900 text-cream-50 shrink-0">
                <Zap className="w-4 h-4 text-leaf-300" />
              </div>
              <div>
                <p className="font-bold text-forest-900 text-sm">Why use Fresh Vegetables Wallet?</p>
                <p className="text-ink-600 text-[11px] mt-0.5">
                  Instant 1-tap checkout • Zero gateway OTP delays • Priority packaging from Champapet &amp; KPHB hubs.
                </p>
              </div>
            </div>
            <Link
              to="/products"
              className="btn-pill-primary bg-forest-900 hover:bg-forest-850 text-cream-50 font-bold text-xs px-5 py-2.5 rounded-full shadow-soft"
            >
              <span>Shop With Wallet</span>
            </Link>
          </div>

          {/* Transaction Ledger Card */}
          <div className="bg-surface rounded-3xl border border-line p-6 sm:p-8 space-y-6 shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
              <div>
                <h3 className="font-serif font-bold text-lg text-ink-900 tracking-tight">Recent Wallet Activity</h3>
                <p className="text-xs text-ink-400 mt-0.5">Audited history of top-ups and order payments</p>
              </div>

              {/* Filter tabs */}
              <div className="flex items-center gap-1.5 bg-cream-100 p-1 rounded-xl border border-line text-xs font-bold">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'credit', label: 'Credits (+)' },
                  { id: 'debit', label: 'Debits (-)' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setTxFilter(tab.id as any)}
                    className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                      txFilter === tab.id
                        ? 'bg-surface text-forest-900 shadow-soft'
                        : 'text-ink-500 hover:text-ink-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {filteredTransactions.length === 0 ? (
              <div className="py-10 text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-cream-100 text-ink-400 flex items-center justify-center mx-auto text-xl">
                  📜
                </div>
                <p className="text-xs text-ink-500 font-medium">No transactions recorded for this filter.</p>
              </div>
            ) : (
              <div className="divide-y divide-line">
                {filteredTransactions.map((tx) => {
                  const isCredit = tx.transaction_type !== 'DEBIT';
                  return (
                    <div key={tx.id} className="py-3.5 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold shrink-0 ${
                            isCredit
                              ? 'bg-sage-100 text-forest-800'
                              : 'bg-cream-200 text-ink-700'
                          }`}
                        >
                          {isCredit ? (
                            <ArrowDownLeft className="w-4 h-4 text-leaf-600" />
                          ) : (
                            <ArrowUpRight className="w-4 h-4 text-ink-600" />
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-xs text-ink-900">{tx.description || (isCredit ? 'Wallet Top-up' : 'Grocery Purchase')}</p>
                          <p className="text-[10px] text-ink-400 mt-0.5">
                            {new Date(tx.created_at).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}{' '}
                            • Balance after: ₹{tx.balance_after.toFixed(2)}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`font-mono font-bold text-sm ${
                          isCredit ? 'text-forest-700' : 'text-ink-900'
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
        </>
      )}
    </div>
  );
};

export default WalletPage;