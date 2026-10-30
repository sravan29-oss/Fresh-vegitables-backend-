import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import db from '../config/database';
import { memoryStore } from '../config/mockDb';
import { sendSuccess } from '../utils/apiResponse';
import { BadRequestError } from '../utils/appError';
import { logAuditEvent } from '../services/audit.service';
import { v4 as uuidv4 } from 'uuid';

// ================= CUSTOMER WALLET & LOYALTY =================

export async function getLoyaltyAccount(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id || '11111111-1111-1111-1111-111111111111';

    let account: any = null;
    let transactions: any[] = [];

    try {
      const accRes = await db.query(
        'SELECT * FROM loyalty_accounts WHERE user_id = $1 LIMIT 1',
        [userId]
      );
      if (accRes.rows.length > 0) {
        account = accRes.rows[0];
      } else {
        const insertRes = await db.query(
          `INSERT INTO loyalty_accounts (id, user_id, points_balance, lifetime_points_earned, tier)
           VALUES ($1, $2, 0, 0, 'BRONZE')
           RETURNING *`,
          [uuidv4(), userId]
        );
        account = insertRes.rows[0];
      }

      if (account) {
        const txRes = await db.query(
          'SELECT * FROM loyalty_transactions WHERE loyalty_account_id = $1 ORDER BY created_at DESC LIMIT 50',
          [account.id]
        );
        transactions = txRes.rows;
      }
    } catch {
      // Memory fallback if DB query fails
      account = (memoryStore as any).loyalty_accounts.find((a: any) => a.user_id === userId);
      if (!account) {
        account = {
          id: uuidv4(),
          user_id: userId,
          points_balance: 0,
          lifetime_points_earned: 0,
          tier: 'BRONZE',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        (memoryStore as any).loyalty_accounts.push(account);
      }
      transactions = (memoryStore as any).loyalty_transactions.filter(
        (tx: any) => tx.loyalty_account_id === account.id
      );
    }

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

    let wallet: any = null;
    let transactions: any[] = [];

    try {
      const walletRes = await db.query(
        'SELECT * FROM wallets WHERE user_id = $1 LIMIT 1',
        [userId]
      );

      if (walletRes.rows.length > 0) {
        wallet = walletRes.rows[0];
        wallet.balance = Number(wallet.balance || 0);
      } else {
        // Create new customer wallet with strict ₹0.00 default balance
        const newWalletId = uuidv4();
        const insertRes = await db.query(
          `INSERT INTO wallets (id, user_id, balance, currency, is_locked)
           VALUES ($1, $2, 0.00, 'INR', false)
           RETURNING *`,
          [newWalletId, userId]
        );
        wallet = insertRes.rows[0];
        wallet.balance = 0.0;
      }

      const txRes = await db.query(
        'SELECT * FROM wallet_transactions WHERE wallet_id = $1 ORDER BY created_at DESC LIMIT 50',
        [wallet.id]
      );
      transactions = txRes.rows;
    } catch {
      // Memory fallback if DB query fails
      wallet = (memoryStore as any).wallets.find((w: any) => w.user_id === userId);
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
      transactions = (memoryStore as any).wallet_transactions.filter(
        (tx: any) => tx.wallet_id === wallet.id
      );
    }

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

    let wallet: any = null;
    let newTx: any = null;

    try {
      const walletId = uuidv4();
      const upsertRes = await db.query(
        `INSERT INTO wallets (id, user_id, balance, currency, is_locked, updated_at)
         VALUES ($1, $2, $3, 'INR', false, NOW())
         ON CONFLICT (user_id)
         DO UPDATE SET balance = wallets.balance + $3, updated_at = NOW()
         RETURNING *`,
        [walletId, userId, amount]
      );
      wallet = upsertRes.rows[0];
      wallet.balance = Number(wallet.balance);

      const txId = uuidv4();
      const txRes = await db.query(
        `INSERT INTO wallet_transactions (id, wallet_id, amount, transaction_type, balance_after, reference_type, reference_id, description, status)
         VALUES ($1, $2, $3, 'CREDIT', $4, 'topup', $5, $6, 'SUCCESS')
         RETURNING *`,
        [txId, wallet.id, amount, wallet.balance, `top_${Date.now()}`, `Added ₹${amount} to wallet via Instant UPI`]
      );
      newTx = txRes.rows[0];
    } catch {
      // Memory fallback
      wallet = (memoryStore as any).wallets.find((w: any) => w.user_id === userId);
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

      newTx = {
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
    }

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

    let wallet: any = null;
    let debitTx: any = null;
    const numAmount = Number(amount);

    try {
      const walletRes = await db.query(
        'SELECT * FROM wallets WHERE user_id = $1 LIMIT 1',
        [userId]
      );
      wallet = walletRes.rows[0];

      if (!wallet || Number(wallet.balance) < numAmount) {
        throw new BadRequestError(`Insufficient wallet balance. Available: ₹${Number(wallet?.balance || 0).toFixed(2)}`);
      }

      const updateRes = await db.query(
        `UPDATE wallets
         SET balance = balance - $1, updated_at = NOW()
         WHERE user_id = $2
         RETURNING *`,
        [numAmount, userId]
      );
      wallet = updateRes.rows[0];
      wallet.balance = Number(wallet.balance);

      const txId = uuidv4();
      const txRes = await db.query(
        `INSERT INTO wallet_transactions (id, wallet_id, amount, transaction_type, balance_after, reference_type, reference_id, description, status)
         VALUES ($1, $2, $3, 'DEBIT', $4, 'order', $5, $6, 'SUCCESS')
         RETURNING *`,
        [txId, wallet.id, numAmount, wallet.balance, order_id || `ord_${Date.now()}`, `Payment for fresh vegetable order #${order_id || 'DEMO'}`]
      );
      debitTx = txRes.rows[0];
    } catch (err: any) {
      if (err instanceof BadRequestError) throw err;
      // Memory fallback
      wallet = (memoryStore as any).wallets.find((w: any) => w.user_id === userId);
      if (!wallet || wallet.balance < numAmount) {
        throw new BadRequestError(`Insufficient wallet balance. Available: ₹${wallet?.balance || 0}`);
      }
      wallet.balance = Number((wallet.balance - numAmount).toFixed(2));
      wallet.updated_at = new Date().toISOString();

      debitTx = {
        id: uuidv4(),
        wallet_id: wallet.id,
        amount: numAmount,
        transaction_type: 'DEBIT',
        balance_after: wallet.balance,
        reference_type: 'order',
        reference_id: order_id || `ord_${Date.now()}`,
        description: `Payment for fresh vegetable order #${order_id || 'DEMO'}`,
        status: 'SUCCESS',
        created_at: new Date().toISOString(),
      };
      (memoryStore as any).wallet_transactions.unshift(debitTx);
    }

    // Earn loyalty points (1 point per ₹10 spent)
    const pointsEarned = Math.floor(numAmount / 10);
    if (pointsEarned > 0) {
      try {
        await db.query(
          `UPDATE loyalty_accounts
           SET points_balance = points_balance + $1,
               lifetime_points_earned = lifetime_points_earned + $1,
               updated_at = NOW()
           WHERE user_id = $2`,
          [pointsEarned, userId]
        );
      } catch {
        const account = (memoryStore as any).loyalty_accounts.find((a: any) => a.user_id === userId);
        if (account) {
          account.points_balance += pointsEarned;
          account.lifetime_points_earned += pointsEarned;
        }
      }
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

    let referralCode: any = null;
    let userReferrals: any[] = [];

    try {
      const refRes = await db.query(
        'SELECT * FROM referral_codes WHERE user_id = $1 LIMIT 1',
        [userId]
      );
      if (refRes.rows.length > 0) {
        referralCode = refRes.rows[0];
      } else {
        const userRes = await db.query('SELECT name FROM users WHERE id = $1 LIMIT 1', [userId]);
        const userName = userRes.rows[0]?.name || 'FRESH';
        const cleanName = userName.replace(/[^a-zA-Z]/g, '').slice(0, 5).toUpperCase() || 'FRESH';
        const code = `${cleanName}50`;

        const insRes = await db.query(
          `INSERT INTO referral_codes (id, user_id, code, reward_amount, referee_discount, usage_count, is_active)
           VALUES ($1, $2, $3, 50.0, 50.0, 0, true)
           RETURNING *`,
          [uuidv4(), userId, code]
        );
        referralCode = insRes.rows[0];
      }

      const refsRes = await db.query(
        'SELECT * FROM referrals WHERE referrer_id = $1 ORDER BY created_at DESC',
        [userId]
      );
      userReferrals = refsRes.rows;
    } catch {
      referralCode = (memoryStore as any).referral_codes.find((r: any) => r.user_id === userId);
      if (!referralCode) {
        const user = memoryStore.users.find((u) => u.id === userId);
        const cleanName = (user?.name || 'FRESH').replace(/[^a-zA-Z]/g, '').slice(0, 5).toUpperCase() || 'FRESH';
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
      userReferrals = (memoryStore as any).referrals.filter((r: any) => r.referrer_id === userId);
    }

    const totalEarnings = userReferrals.filter((r: any) => r.status === 'REWARDED').length * 50;

    sendSuccess(res, 'Referral code and friends invited overview', {
      referral_code: referralCode.code,
      reward_amount: Number(referralCode.reward_amount || 50),
      referee_discount: Number(referralCode.referee_discount || 50),
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

    // Verify referral code
    let refCode: any = null;
    try {
      const codeRes = await db.query(
        'SELECT * FROM referral_codes WHERE UPPER(code) = $1 AND is_active = true LIMIT 1',
        [cleanCode]
      );
      refCode = codeRes.rows[0];
    } catch {
      refCode = (memoryStore as any).referral_codes.find(
        (r: any) => r.code.toUpperCase() === cleanCode && r.is_active
      );
    }

    if (!refCode) {
      throw new BadRequestError('Invalid or inactive referral code');
    }

    if (refCode.user_id === userId) {
      throw new BadRequestError('Self-referrals are not permitted');
    }

    // Check if already used
    try {
      const existRes = await db.query(
        'SELECT id FROM referrals WHERE referee_id = $1 LIMIT 1',
        [userId]
      );
      if (existRes.rows.length > 0) {
        throw new BadRequestError('You have already applied a referral code');
      }

      await db.query(
        `INSERT INTO referrals (id, referrer_id, referee_id, referral_code, status, rewarded_at)
         VALUES ($1, $2, $3, $4, 'QUALIFIED', NOW())`,
        [uuidv4(), refCode.user_id, userId, cleanCode]
      );
      await db.query(
        'UPDATE referral_codes SET usage_count = usage_count + 1 WHERE id = $1',
        [refCode.id]
      );
    } catch (err: any) {
      if (err instanceof BadRequestError) throw err;
      const existing = (memoryStore as any).referrals.find((r: any) => r.referee_id === userId);
      if (existing) throw new BadRequestError('You have already applied a referral code');

      (memoryStore as any).referrals.push({
        id: uuidv4(),
        referrer_id: refCode.user_id,
        referee_id: userId,
        referral_code: cleanCode,
        status: 'QUALIFIED',
        created_at: new Date().toISOString(),
      });
      refCode.usage_count = (refCode.usage_count || 0) + 1;
    }

    // Credit ₹50 to referee's wallet
    let newBalance = 50.0;
    try {
      const upsertRes = await db.query(
        `INSERT INTO wallets (id, user_id, balance, currency, is_locked, updated_at)
         VALUES ($1, $2, 50.00, 'INR', false, NOW())
         ON CONFLICT (user_id)
         DO UPDATE SET balance = wallets.balance + 50.00, updated_at = NOW()
         RETURNING balance`,
        [uuidv4(), userId]
      );
      newBalance = Number(upsertRes.rows[0].balance);
    } catch {
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
      newBalance = wallet.balance;
    }

    sendSuccess(res, 'Referral code applied! ₹50 credited to your wallet.', {
      discount: 50,
      wallet_balance: newBalance,
    });
  } catch (error) {
    next(error);
  }
}

// ================= ADMIN LOYALTY & WALLETS =================

export async function getAdminLoyaltyOverview(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    let wallets: any[] = [];
    let accounts: any[] = [];
    let referrals: any[] = [];
    let totalWalletLiabilities = 0;
    let totalPointsOutstanding = 0;
    let totalReferrals = 0;
    let successfulReferrals = 0;

    try {
      // Fetch customer wallets with joined user names and contact info
      const walletsRes = await db.query(`
        SELECT w.id, w.user_id, w.balance, w.currency, w.is_locked, w.created_at, w.updated_at,
               u.name as user_name, u.email as user_email, u.mobile as user_mobile
        FROM wallets w
        LEFT JOIN users u ON w.user_id = u.id
        ORDER BY w.updated_at DESC
      `);
      wallets = walletsRes.rows.map((w: any) => ({
        ...w,
        balance: Number(w.balance || 0),
      }));

      totalWalletLiabilities = wallets.reduce((sum, w) => sum + Number(w.balance), 0);

      // Fetch loyalty accounts
      const accountsRes = await db.query(`
        SELECT la.id, la.user_id, la.points_balance, la.lifetime_points_earned, la.tier, la.created_at, la.updated_at,
               u.name as user_name, u.email as user_email, u.mobile as user_mobile
        FROM loyalty_accounts la
        LEFT JOIN users u ON la.user_id = u.id
        ORDER BY la.updated_at DESC
      `);
      accounts = accountsRes.rows.map((a: any) => ({
        ...a,
        points_balance: Number(a.points_balance || 0),
      }));
      totalPointsOutstanding = accounts.reduce((sum, a) => sum + Number(a.points_balance), 0);

      // Fetch referrals
      const refsRes = await db.query('SELECT * FROM referrals ORDER BY created_at DESC');
      referrals = refsRes.rows;
      totalReferrals = referrals.length;
      successfulReferrals = referrals.filter((r) => r.status === 'REWARDED').length;
    } catch {
      // Memory fallback
      wallets = (memoryStore as any).wallets.map((w: any) => {
        const u = memoryStore.users.find((user) => user.id === w.user_id);
        return {
          ...w,
          balance: Number(w.balance || 0),
          user_name: u?.name || 'Customer',
          user_email: u?.email || '',
          user_mobile: u?.mobile || '',
        };
      });
      accounts = (memoryStore as any).loyalty_accounts;
      referrals = (memoryStore as any).referrals;
      totalWalletLiabilities = wallets.reduce((sum: number, w: any) => sum + Number(w.balance), 0);
      totalPointsOutstanding = accounts.reduce((sum: number, a: any) => sum + Number(a.points_balance), 0);
      totalReferrals = referrals.length;
      successfulReferrals = referrals.filter((r: any) => r.status === 'REWARDED').length;
    }

    sendSuccess(res, 'Admin loyalty, wallet, and referral metrics', {
      metrics: {
        total_wallets: wallets.length,
        total_wallet_liabilities: totalWalletLiabilities,
        total_loyalty_accounts: accounts.length,
        total_points_outstanding: totalPointsOutstanding,
        total_referrals: totalReferrals,
        successful_referrals: successfulReferrals,
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
    const numAmount = Number(amount);

    if (!user_id || isNaN(numAmount) || numAmount === 0) {
      throw new BadRequestError('User ID and non-zero amount are required');
    }

    if (type === 'WALLET') {
      let finalBalance = 0;
      let walletId = '';

      try {
        // First check existing balance to prevent negative balance on debit
        const existingRes = await db.query('SELECT id, balance FROM wallets WHERE user_id = $1 LIMIT 1', [user_id]);
        const currentBalance = existingRes.rows.length > 0 ? Number(existingRes.rows[0].balance) : 0;

        if (numAmount < 0 && currentBalance + numAmount < 0) {
          throw new BadRequestError(`Cannot deduct ₹${Math.abs(numAmount).toFixed(2)}. Available balance is only ₹${currentBalance.toFixed(2)}.`);
        }

        const newId = uuidv4();
        const upsertRes = await db.query(
          `INSERT INTO wallets (id, user_id, balance, currency, is_locked, updated_at)
           VALUES ($1, $2, $3, 'INR', false, NOW())
           ON CONFLICT (user_id)
           DO UPDATE SET balance = wallets.balance + $3, updated_at = NOW()
           RETURNING *`,
          [newId, user_id, numAmount]
        );

        const updatedWallet = upsertRes.rows[0];
        finalBalance = Number(updatedWallet.balance);
        walletId = updatedWallet.id;

        // Insert audited transaction
        const txId = uuidv4();
        await db.query(
          `INSERT INTO wallet_transactions (id, wallet_id, amount, transaction_type, balance_after, reference_type, reference_id, description, status)
           VALUES ($1, $2, $3, $4, $5, 'admin_adjustment', $6, $7, 'SUCCESS')`,
          [
            txId,
            walletId,
            Math.abs(numAmount),
            numAmount >= 0 ? 'PROMOTIONAL_BONUS' : 'DEBIT',
            finalBalance,
            req.adminUser?.id || null,
            reason || (numAmount >= 0 ? 'Admin wallet bonus' : 'Admin wallet debit'),
          ]
        );
      } catch (err: any) {
        if (err instanceof BadRequestError) throw err;
        // Memory fallback
        let wallet = (memoryStore as any).wallets.find((w: any) => w.user_id === user_id);
        if (!wallet) {
          wallet = {
            id: uuidv4(),
            user_id,
            balance: 0.0,
            currency: 'INR',
            is_locked: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          (memoryStore as any).wallets.push(wallet);
        }

        if (numAmount < 0 && wallet.balance + numAmount < 0) {
          throw new BadRequestError(`Cannot deduct ₹${Math.abs(numAmount).toFixed(2)}. Available balance is only ₹${wallet.balance.toFixed(2)}.`);
        }

        wallet.balance = Number((wallet.balance + numAmount).toFixed(2));
        wallet.updated_at = new Date().toISOString();
        finalBalance = wallet.balance;
        walletId = wallet.id;

        (memoryStore as any).wallet_transactions.unshift({
          id: uuidv4(),
          wallet_id: wallet.id,
          amount: Math.abs(numAmount),
          transaction_type: numAmount >= 0 ? 'PROMOTIONAL_BONUS' : 'DEBIT',
          balance_after: finalBalance,
          reference_type: 'admin_adjustment',
          reference_id: req.adminUser?.id || null,
          description: reason || (numAmount >= 0 ? 'Admin wallet bonus' : 'Admin wallet debit'),
          status: 'SUCCESS',
          created_at: new Date().toISOString(),
        });
      }

      // Also sync memoryStore if it exists
      const memWallet = (memoryStore as any).wallets.find((w: any) => w.user_id === user_id);
      if (memWallet) {
        memWallet.balance = finalBalance;
      }
    } else {
      // POINTS adjustment
      try {
        const newId = uuidv4();
        const upsertRes = await db.query(
          `INSERT INTO loyalty_accounts (id, user_id, points_balance, lifetime_points_earned, tier, updated_at)
           VALUES ($1, $2, $3, $3, 'BRONZE', NOW())
           ON CONFLICT (user_id)
           DO UPDATE SET points_balance = GREATEST(0, loyalty_accounts.points_balance + $3), updated_at = NOW()
           RETURNING *`,
          [newId, user_id, Math.floor(numAmount)]
        );
        const updatedAcc = upsertRes.rows[0];

        await db.query(
          `INSERT INTO loyalty_transactions (id, loyalty_account_id, points, type, reference_id, description)
           VALUES ($1, $2, $3, 'PROMOTIONAL', $4, $5)`,
          [
            uuidv4(),
            updatedAcc.id,
            numAmount,
            req.adminUser?.id || null,
            reason || 'Administrative points adjustment',
          ]
        );
      } catch {
        let account = (memoryStore as any).loyalty_accounts.find((a: any) => a.user_id === user_id);
        if (!account) {
          account = {
            id: uuidv4(),
            user_id,
            points_balance: 0,
            lifetime_points_earned: 0,
            tier: 'BRONZE',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          (memoryStore as any).loyalty_accounts.push(account);
        }
        account.points_balance = Math.max(0, account.points_balance + Math.floor(numAmount));
        (memoryStore as any).loyalty_transactions.unshift({
          id: uuidv4(),
          loyalty_account_id: account.id,
          points: numAmount,
          type: 'PROMOTIONAL',
          reference_id: req.adminUser?.id || null,
          description: reason || 'Administrative points adjustment',
          created_at: new Date().toISOString(),
        });
      }
    }

    await logAuditEvent({
      req,
      action: `ADMIN_${type}_ADJUSTED`,
      entityType: type.toLowerCase(),
      entityId: user_id,
      newValues: { amount: numAmount, reason },
    });

    sendSuccess(res, `Successfully adjusted ${type} for customer.`);
  } catch (error) {
    next(error);
  }
}
