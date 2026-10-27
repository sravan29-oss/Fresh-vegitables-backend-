import { Request, Response, NextFunction } from 'express';
import { memoryStore } from '../config/mockDb';
import { sendSuccess } from '../utils/apiResponse';
import { BadRequestError, NotFoundError } from '../utils/appError';
import { logAuditEvent } from '../services/audit.service';
import { v4 as uuidv4 } from 'uuid';

export async function getSellers(req: Request, res: Response, next: NextFunction) {
  try {
    const sellers = (memoryStore as any).sellers;
    const payouts = (memoryStore as any).seller_payouts;

    const totalActiveSellers = sellers.filter((s: any) => s.status === 'ACTIVE').length;
    const verifiedSellers = sellers.filter((s: any) => s.verification_status === 'VERIFIED').length;
    const totalDisbursedPayouts = payouts.reduce((sum: number, p: any) => sum + Number(p.net_payout), 0);

    sendSuccess(res, 'Sellers and supplier partners list', {
      metrics: {
        total_sellers: sellers.length,
        active_sellers: totalActiveSellers,
        verified_sellers: verifiedSellers,
        total_payouts_disbursed: totalDisbursedPayouts,
      },
      sellers,
      payouts,
    });
  } catch (error) {
    next(error);
  }
}

export async function createSeller(req: Request, res: Response, next: NextFunction) {
  try {
    const {
      business_name,
      owner_name,
      phone,
      email,
      address,
      city,
      state,
      pincode,
      commission_percentage,
      bank_account_details,
    } = req.body;

    if (!business_name || !owner_name || !phone) {
      throw new BadRequestError('Business name, owner name, and phone are required');
    }

    const newSeller = {
      id: uuidv4(),
      business_name,
      owner_name,
      phone,
      email: email || `${business_name.toLowerCase().replace(/\s+/g, '')}@freshveggies.com`,
      address: address || 'Agro Cluster',
      city: city || 'Hyderabad',
      state: state || 'Telangana',
      pincode: pincode || '500001',
      status: 'ACTIVE',
      verification_status: 'VERIFIED',
      commission_percentage: Number(commission_percentage) || 10.0,
      bank_account_details: bank_account_details || { bank: 'HDFC Bank', account_ending: '1234' },
      rating: 4.9,
      total_orders: 0,
      total_revenue: 0,
      pending_payout: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    (memoryStore as any).sellers.push(newSeller);

    await logAuditEvent({
      req,
      action: 'SELLER_ONBOARDED',
      entityType: 'seller',
      entityId: newSeller.id,
      newValues: newSeller,
    });

    sendSuccess(res, 'Seller partner created successfully', newSeller, 201);
  } catch (error) {
    next(error);
  }
}

export async function updateSeller(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const body = req.body;

    const seller = (memoryStore as any).sellers.find((s: any) => s.id === id);
    if (!seller) {
      throw new NotFoundError('Seller not found');
    }

    const oldValues = { ...seller };
    Object.assign(seller, {
      ...body,
      updated_at: new Date().toISOString(),
    });

    await logAuditEvent({
      req,
      action: 'SELLER_UPDATED',
      entityType: 'seller',
      entityId: id,
      oldValues,
      newValues: seller,
    });

    sendSuccess(res, 'Seller updated successfully', seller);
  } catch (error) {
    next(error);
  }
}

export async function verifySeller(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'VERIFIED' | 'REJECTED'

    const seller = (memoryStore as any).sellers.find((s: any) => s.id === id);
    if (!seller) {
      throw new NotFoundError('Seller not found');
    }

    seller.verification_status = status || 'VERIFIED';
    seller.updated_at = new Date().toISOString();

    await logAuditEvent({
      req,
      action: 'SELLER_VERIFICATION_STATUS_CHANGED',
      entityType: 'seller',
      entityId: id,
      newValues: { status: seller.verification_status },
    });

    sendSuccess(res, `Seller verification updated to ${seller.verification_status}`, seller);
  } catch (error) {
    next(error);
  }
}

export async function processSellerPayout(req: Request, res: Response, next: NextFunction) {
  try {
    const { seller_id, amount } = req.body;

    const seller = (memoryStore as any).sellers.find((s: any) => s.id === seller_id);
    if (!seller) {
      throw new NotFoundError('Seller not found');
    }

    const grossAmount = Number(amount) || seller.pending_payout || 10000;
    const commissionDeducted = Number(((grossAmount * (seller.commission_percentage || 10)) / 100).toFixed(2));
    const netPayout = Number((grossAmount - commissionDeducted).toFixed(2));

    const payoutRecord = {
      id: uuidv4(),
      seller_id,
      seller_name: seller.business_name,
      amount: grossAmount,
      commission_deducted: commissionDeducted,
      net_payout: netPayout,
      period_start: new Date(Date.now() - 86400000 * 15).toISOString().slice(0, 10),
      period_end: new Date().toISOString().slice(0, 10),
      status: 'PROCESSED',
      payment_reference: `NEFT-DISB-${Date.now().toString().slice(-8)}`,
      created_at: new Date().toISOString(),
    };

    (memoryStore as any).seller_payouts.unshift(payoutRecord);
    seller.pending_payout = Math.max(0, (seller.pending_payout || 0) - grossAmount);

    await logAuditEvent({
      req,
      action: 'SELLER_PAYOUT_DISBURSED',
      entityType: 'seller_payout',
      entityId: payoutRecord.id,
      newValues: payoutRecord,
    });

    sendSuccess(res, 'Seller payout processed successfully', payoutRecord, 201);
  } catch (error) {
    next(error);
  }
}
