import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { memoryStore } from '../config/mockDb';
import { sendSuccess } from '../utils/apiResponse';
import { BadRequestError } from '../utils/appError';
import { logAuditEvent } from '../services/audit.service';
import { v4 as uuidv4 } from 'uuid';

// ================= CUSTOMER WALLET & LOYALTY =================

export async function getLoyaltyAccount(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id || '11111111-1111-1111-1111-111111111111';

    let account = (memoryStore as any).loyalty_accounts.find((a: any) => a.user_id === userId);
    if (!account) {
      account = {
        id: uuidv4(),
        user_id: userId,
        points_balance: 100,
        lifetime_points_earned: 100,
        tier: 'BRONZE',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      (memoryStore as any).loyalty_accounts.push(account);
    }

    const transactions = (memoryStore as any).loyalty_transactions.filter(
      (tx: any) => tx.loyalty_account_id === account.id
    );

    sendSuccess(res, 'Loyalty points and tier data', {
      account,
      transactions,
    });
  } catch (error) {
    next(error);
  }
}

export async function getWallet(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id || '11111111-1111-1111-1111-111111111111';

    let wallet = (memoryStore as any).wallets.find((w: any) => w.user_id === userId);
    if (!wallet) {
      wallet = {
        id: uuidv4(),
        user_id: userId,
        balance: 250.0,
        currency: 'INR',
        is_locked: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      (memoryStore as any).wallets.push(wallet);
    }

    const transactions = (memoryStore as any).wallet_transactions.filter(
      (tx: any) => tx.wallet_id === wallet.id
    );

    sendSuccess(res, 'Customer digital wallet details', {
      wallet,
      transactions,
    });
  } catch (error) {
    next(error);
  }
}

export async function topupWallet(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id || '11111111-1111-1111-1111-111111111111';
    const amount = Number(req.body.amount);

    if (!amount || amount <= 0) {
      throw new BadRequestError('Topup amount must be greater than 0');
    }

    let wallet = (memoryStore as any).wallets.find((w: any) => w.user_id === userId);
    if (!wallet) {
      wallet = {
        id: uuidv4(),
        user_id: userId,
        balance: 0.0,
        currency: 'INR',
        is_locked: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      (memoryStore as any).wallets.push(wallet);
    }

    wallet.balance = Number((wallet.balance + amount).toFixed(2));
    wallet.updated_at = new Date().toISOString();

    const newTx = {
      id: uuidv4(),
      wallet_id: wallet.id,
      amount,
      transaction_type: 'CREDIT',
      balance_after: wallet.balance,
      reference_type: 'topup',
      reference_id: `top_${Date.now()}`,
      description: `Added ₹${amount} to wallet via Instant UPI`,
      status: 'SUCCESS',
      created_at: new Date().toISOString(),
    };

    (memoryStore as any).wallet_transactions.unshift(newTx);

    sendSuccess(res, `₹${amount} successfully added to wallet`, {
      wallet,
      transaction: newTx,
    });
  } catch (error) {
    next(error);
  }
}

export async function payWithWallet(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id || '11111111-1111-1111-1111-111111111111';
    const { order_id, amount } = req.body;

    if (!amount || Number(amount) <= 0) {
      throw new BadRequestError('Invalid payment amount');
    }

    const wallet = (memoryStore as any).wallets.find((w: any) => w.user_id === userId);
    if (!wallet || wallet.balance < Number(amount)) {
      throw new BadRequestError(`Insufficient wallet balance. Available: ₹${wallet?.balance || 0}`);
    }

    // Deduct balance securely on the backend
    wallet.balance = Number((wallet.balance - Number(amount)).toFixed(2));
    wallet.updated_at = new Date().toISOString();

    const debitTx = {
      id: uuidv4(),
      wallet_id: wallet.id,
      amount: Number(amount),
      transaction_type: 'DEBIT',
      balance_after: wallet.balance,
      reference_type: 'order',
      reference_id: order_id || `ord_${Date.now()}`,
      description: `Payment for fresh vegetable order #${order_id || 'DEMO'}`,
      status: 'SUCCESS',
      created_at: new Date().toISOString(),
    };

    (memoryStore as any).wallet_transactions.unshift(debitTx);

    // Also earn loyalty points (1 point per ₹10 spent)
    const pointsEarned = Math.floor(Number(amount) / 10);
    const account = (memoryStore as any).loyalty_accounts.find((a: any) => a.user_id === userId);
    if (account && pointsEarned > 0) {
      account.points_balance += pointsEarned;
      account.lifetime_points_earned += pointsEarned;
      (memoryStore as any).loyalty_transactions.unshift({
        id: uuidv4(),
        loyalty_account_id: account.id,
        points: pointsEarned,
        type: 'EARNED_ORDER',
        reference_id: order_id,
        description: `Earned ${pointsEarned} points for order payment`,
        created_at: new Date().toISOString(),
      });
    }

    sendSuccess(res, 'Payment debited successfully from wallet', {
      wallet,
      transaction: debitTx,
      points_earned: pointsEarned,
    });
  } catch (error) {
    next(error);
  }
}

// ================= REFERRAL PROGRAM =================

export async function getReferralProgram(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id || '11111111-1111-1111-1111-111111111111';

    let referralCode = (memoryStore as any).referral_codes.find((r: any) => r.user_id === userId);
    if (!referralCode) {
      const user = memoryStore.users.find((u) => u.id === userId);
      const cleanName = (user?.name || 'FRESH').replace(/[^a-zA-Z]/g, '').slice(0, 5).toUpperCase();
      referralCode = {
        id: uuidv4(),
        user_id: userId,
        code: `${cleanName}50`,
        reward_amount: 50.0,
        referee_discount: 50.0,
        usage_count: 0,
        is_active: true,
        created_at: new Date().toISOString(),
      };
      (memoryStore as any).referral_codes.push(referralCode);
    }

    const userReferrals = (memoryStore as any).referrals.filter((r: any) => r.referrer_id === userId);
    const totalEarnings = userReferrals.filter((r: any) => r.status === 'REWARDED').length * 50;

    sendSuccess(res, 'Referral code and friends invited overview', {
      referral_code: referralCode.code,
      reward_amount: referralCode.reward_amount,
      referee_discount: referralCode.referee_discount,
      total_invited: userReferrals.length,
      total_earned: totalEarnings,
      referrals: userReferrals,
      share_link: `${req.protocol}://${req.get('host')}/register?ref=${referralCode.code}`,
    });
  } catch (error) {
    next(error);
  }
}

export async function applyReferral(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id || '11111111-1111-1111-1111-111111111111';
    const { code } = req.body;

    if (!code) throw new BadRequestError('Referral code is required');

    const cleanCode = String(code).trim().toUpperCase();
    const refCode = (memoryStore as any).referral_codes.find(
      (r: any) => r.code.toUpperCase() === cleanCode && r.is_active
    );

    if (!refCode) {
      throw new BadRequestError('Invalid or inactive referral code');
    }

    if (refCode.user_id === userId) {
      throw new BadRequestError('Self-referrals are not permitted');
    }

    const existing = (memoryStore as any).referrals.find((r: any) => r.referee_id === userId);
    if (existing) {
      throw new BadRequestError('You have already applied a referral code');
    }

    const newRef = {
      id: uuidv4(),
      referrer_id: refCode.user_id,
      referee_id: userId,
      referral_code: cleanCode,
      status: 'QUALIFIED',
      qualifying_order_id: null,
      created_at: new Date().toISOString(),
      rewarded_at: new Date().toISOString(),
    };
    (memoryStore as any).referrals.push(newRef);
    refCode.usage_count = (refCode.usage_count || 0) + 1;

    // Credit ₹50 to referee's wallet
    let wallet = (memoryStore as any).wallets.find((w: any) => w.user_id === userId);
    if (!wallet) {
      wallet = {
        id: uuidv4(),
        user_id: userId,
        balance: 50.0,
        currency: 'INR',
        is_locked: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      (memoryStore as any).wallets.push(wallet);
    } else {
      wallet.balance += 50.0;
    }

    sendSuccess(res, 'Referral code applied! ₹50 credited to your wallet.', {
      discount: 50,
      wallet_balance: wallet.balance,
    });
  } catch (error) {
    next(error);
  }
}

// ================= ADMIN LOYALTY & WALLETS =================

export async function getAdminLoyaltyOverview(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const wallets = (memoryStore as any).wallets;
    const accounts = (memoryStore as any).loyalty_accounts;
    const referrals = (memoryStore as any).referrals;

    const totalWalletLiabilities = wallets.reduce((sum: number, w: any) => sum + Number(w.balance), 0);
    const totalPointsOutstanding = accounts.reduce((sum: number, a: any) => sum + Number(a.points_balance), 0);
    const totalSuccessfulReferrals = referrals.filter((r: any) => r.status === 'REWARDED').length;

    sendSuccess(res, 'Admin loyalty, wallet, and referral metrics', {
      metrics: {
        total_wallets: wallets.length,
        total_wallet_liabilities: totalWalletLiabilities,
        total_loyalty_accounts: accounts.length,
        total_points_outstanding: totalPointsOutstanding,
        total_referrals: referrals.length,
        successful_referrals: totalSuccessfulReferrals,
      },
      wallets,
      loyalty_accounts: accounts,
      referrals,
    });
  } catch (error) {
    next(error);
  }
}

export async function adminAdjustLoyalty(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { user_id, type, amount, reason } = req.body; // type: 'WALLET' | 'POINTS'

    if (!user_id || !amount) {
      throw new BadRequestError('User ID and amount are required');
    }

    if (type === 'WALLET') {
      let wallet = (memoryStore as any).wallets.find((w: any) => w.user_id === user_id);
      if (wallet) {
        wallet.balance = Number((wallet.balance + Number(amount)).toFixed(2));
        (memoryStore as any).wallet_transactions.unshift({
          id: uuidv4(),
          wallet_id: wallet.id,
          amount: Number(amount),
          transaction_type: Number(amount) >= 0 ? 'PROMOTIONAL_BONUS' : 'DEBIT',
          balance_after: wallet.balance,
          reference_type: 'admin_adjustment',
          reference_id: req.adminUser?.id,
          description: reason || 'Administrative adjustment',
          status: 'SUCCESS',
          created_at: new Date().toISOString(),
        });
      }
    } else {
      let account = (memoryStore as any).loyalty_accounts.find((a: any) => a.user_id === user_id);
      if (account) {
        account.points_balance = Math.max(0, account.points_balance + Number(amount));
        (memoryStore as any).loyalty_transactions.unshift({
          id: uuidv4(),
          loyalty_account_id: account.id,
          points: Number(amount),
          type: 'PROMOTIONAL',
          reference_id: req.adminUser?.id,
          description: reason || 'Administrative adjustment',
          created_at: new Date().toISOString(),
        });
      }
    }

    await logAuditEvent({
      req,
      action: `ADMIN_${type}_ADJUSTED`,
      entityType: type.toLowerCase(),
      entityId: user_id,
      newValues: { amount, reason },
    });

    sendSuccess(res, `Successfully adjusted ${type} for customer.`);
  } catch (error) {
    next(error);
  }
}
