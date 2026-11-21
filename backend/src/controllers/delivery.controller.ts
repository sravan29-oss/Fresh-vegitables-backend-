import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import db from '../config/database';
import { env } from '../config/env';
import { AuthRequest } from '../middleware/auth';
import { sendSuccess } from '../utils/apiResponse';
import { AppError, NotFoundError, ValidationError, ForbiddenError } from '../utils/appError';
import { memoryStore } from '../config/mockDb';
import { logAuditEvent } from '../services/audit.service';
import { getPersistedDeliverySettings, savePersistedDeliverySettings } from '../services/deliverySettings.service';
import { checkServiceability, checkMultiHubServiceability, isValidCoordinate, calculateHaversineDistanceKm } from '../services/serviceability.service';
import { getPersistedZones } from '../services/zoneStore.service';
import { getPersistedHubs, getActiveHubs, getHubById, upsertHub, updateHub, DeliveryHub } from '../services/hubStore.service';
import {
  getAdminDeliveryDashboard,
  getDeliveryPersonnel,
  createDeliveryPersonnel,
  updateDeliveryPersonnel,
  assignDeliveryPartnerToOrder,
  updateDispatchStatus,
  verifyDeliveryOTPAndComplete,
  reportFailedDelivery,
  recordDriverGPS,
  getCustomerOrderLiveTracking,
  FailedDeliveryReason,
  DELIVERY_HUBS_INFO,
} from '../services/deliveryManagement.service';

// ===================== DISCONTINUED DELIVERY PARTNER HANDLER (HTTP 410 GONE) =====================
export function discontinuedDeliveryPartnerHandler(req: Request, res: Response) {
  return res.status(410).json({
    success: false,
    statusCode: 410,
    code: 'DELIVERY_PARTNER_ENDPOINT_DISCONTINUED',
    message: 'Delivery partner functionality has been discontinued. Fresh Vegetables Organic operates on a direct admin-managed delivery model.',
    timestamp: new Date().toISOString(),
  });
}

// ===================== ADMIN: DELIVERY PARTNERS =====================

export async function getDeliveryPartners(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const hubId = req.query.hub_id as string | undefined;
    const partners = await getDeliveryPersonnel(hubId);
    sendSuccess(res, 'Delivery partners fetched', partners);
  } catch (error) {
    next(error);
  }
}

export async function createDeliveryPartner(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const partner = await createDeliveryPersonnel(req.body);
    sendSuccess(res, 'Delivery partner registered', partner, 201);
  } catch (error) {
    next(error);
  }
}

export async function updateDeliveryPartner(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const partner = await updateDeliveryPersonnel(id, req.body);
    sendSuccess(res, 'Delivery partner updated', partner);
  } catch (error) {
    next(error);
  }
}

export async function deleteDeliveryPartner(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    try {
      await db.query('UPDATE delivery_partners SET is_active = false, status = $1 WHERE id = $2', ['SUSPENDED', id]);
    } catch {
      const partner = memoryStore.delivery_partners.find((p) => p.id === id);
      if (partner) {
        partner.is_active = false;
        partner.status = 'SUSPENDED';
      }
    }
    sendSuccess(res, 'Delivery partner deactivated safely');
  } catch (error) {
    next(error);
  }
}

// ===================== ADMIN: DISPATCH & DASHBOARD =====================

export async function getDeliveriesDashboard(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const hubId = req.query.hub_id as string | undefined;
    const status = req.query.status as string | undefined;
    const data = await getAdminDeliveryDashboard(hubId, status);
    sendSuccess(res, 'Deliveries dashboard data', data);
  } catch (error) {
    next(error);
  }
}

export async function assignDriver(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { orderId } = req.params;
    const { delivery_partner_id, notes } = req.body;
    if (!delivery_partner_id) throw new ValidationError('delivery_partner_id is required');

    const result = await assignDeliveryPartnerToOrder(
      orderId,
      delivery_partner_id,
      notes,
      req.user?.id || 'admin'
    );
    // Sanitize API response: never expose customer delivery OTP in production responses
    const { dev_otp, ...sanitizedResult } = result;
    sendSuccess(res, 'Driver assigned successfully', sanitizedResult);
  } catch (error) {
    next(error);
  }
}

export async function updateDeliveryStatus(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    if (!status) throw new ValidationError('status is required');

    const user = {
      id: req.user?.id || 'admin',
      role: req.user?.role || 'admin',
    };

    const assignment = await updateDispatchStatus(id, status, user, notes);
    sendSuccess(res, `Delivery status changed to ${status}`, assignment);
  } catch (error) {
    next(error);
  }
}

export async function verifyDeliveryOTP(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { otp, cod_amount_collected, notes } = req.body;
    if (!otp) throw new ValidationError('6-digit delivery OTP is required');

    const user = {
      id: req.user?.id || 'admin',
      role: req.user?.role || 'admin',
    };

    const result = await verifyDeliveryOTPAndComplete(id, otp, user, {
      cod_amount_collected,
      notes,
    });
    sendSuccess(res, result.message, result.assignment);
  } catch (error) {
    next(error);
  }
}

export async function reportDeliveryFailure(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { reason, notes } = req.body;
    if (!reason) throw new ValidationError('Failure reason is required');

    const user = {
      id: req.user?.id || 'admin',
      role: req.user?.role || 'admin',
    };

    const assignment = await reportFailedDelivery(id, reason as FailedDeliveryReason, notes, user);
    sendSuccess(res, 'Delivery failure recorded', assignment);
  } catch (error) {
    next(error);
  }
}

// ===================== DELIVERY PERSONNEL AUTH & PORTAL =====================

export async function driverLogin(req: Request, res: Response, next: NextFunction) {
  try {
    const { phone, pin_code, password, pin } = req.body;
    if (!phone) throw new ValidationError('Phone number is required');

    let partner: any = null;
    try {
      const pRes = await db.query('SELECT * FROM delivery_partners WHERE phone = $1 LIMIT 1', [phone.trim()]);
      if (pRes.rows.length > 0) partner = pRes.rows[0];
    } catch {
      partner = memoryStore.delivery_partners.find(
        (p) => p.phone === phone.trim() || p.phone.replace(/\s+/g, '') === phone.replace(/\s+/g, '')
      );
    }

    if (!partner) {
      throw new NotFoundError('Delivery partner account not found with this mobile number');
    }

    if (partner.is_active === false || partner.status === 'SUSPENDED') {
      throw new ForbiddenError('Delivery partner account is deactivated or suspended. Please contact store management.');
    }

    // Account Lockout Guard: Check if locked due to 5 consecutive failed attempts
    if (partner.locked_until && new Date(partner.locked_until) > new Date()) {
      const mins = Math.ceil((new Date(partner.locked_until).getTime() - Date.now()) / 60000);
      throw new ForbiddenError(
        `Account temporarily locked due to 5 consecutive failed login attempts. Please try again after ${mins} minute(s).`
      );
    }

    const providedPin = (pin || pin_code || password || '').trim();
    if (!providedPin) {
      throw new ValidationError('PIN code or password is required');
    }

    // Verify PIN securely using salted bcrypt hash (No default 1234 or plaintext)
    let isPinValid = false;
    if (partner.pin_hash) {
      isPinValid = await bcrypt.compare(providedPin, partner.pin_hash);
    }

    if (!isPinValid) {
      const failedAttempts = (partner.failed_login_attempts || 0) + 1;
      const isNowLocked = failedAttempts >= 5;
      const lockUntil = isNowLocked ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null;

      try {
        await db.query(
          'UPDATE delivery_partners SET failed_login_attempts = $1, locked_until = $2 WHERE id = $3',
          [failedAttempts, lockUntil, partner.id]
        );
      } catch {
        partner.failed_login_attempts = failedAttempts;
        partner.locked_until = lockUntil;
      }

      if (isNowLocked) {
        throw new ValidationError(
          'Account temporarily locked for 15 minutes due to 5 consecutive failed login attempts.'
        );
      } else {
        throw new ValidationError(
          `Invalid credentials. ${5 - failedAttempts} attempt(s) remaining.`
        );
      }
    }

    // On successful authentication, reset failed attempts & lockout
    try {
      await db.query(
        'UPDATE delivery_partners SET failed_login_attempts = 0, locked_until = null WHERE id = $1',
        [partner.id]
      );
    } catch {
      partner.failed_login_attempts = 0;
      partner.locked_until = null;
    }

    // Generate JWT token with appropriate shift lifetime (12h)
    const token = jwt.sign(
      {
        id: partner.id,
        name: partner.name,
        phone: partner.phone,
        role: 'delivery',
        assigned_hub_id: partner.assigned_hub_id,
      },
      env.JWT_SECRET,
      { expiresIn: '12h' }
    );

    sendSuccess(res, 'Driver signed in successfully', {
      token,
      partner: {
        id: partner.id,
        name: partner.name,
        phone: partner.phone,
        vehicle_type: partner.vehicle_type,
        vehicle_number: partner.vehicle_number,
        assigned_hub_id: partner.assigned_hub_id,
        status: partner.status,
        rating: partner.rating,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getDriverMe(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const driverId = req.user?.id;
    if (!driverId) throw new ValidationError('Driver identity required');

    let partner: any = null;
    try {
      const pRes = await db.query('SELECT * FROM delivery_partners WHERE id = $1 LIMIT 1', [driverId]);
      if (pRes.rows.length > 0) partner = pRes.rows[0];
    } catch {
      partner = memoryStore.delivery_partners.find((p) => p.id === driverId);
    }

    if (!partner) throw new NotFoundError('Delivery partner profile not found');

    const hubInfo = DELIVERY_HUBS_INFO[partner.assigned_hub_id] || DELIVERY_HUBS_INFO['hub-champapet'];

    sendSuccess(res, 'Driver profile retrieved', {
      ...partner,
      assigned_hub_name: hubInfo.name,
    });
  } catch (error) {
    next(error);
  }
}

export async function getDriverAssignments(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const driverId = req.user?.id;
    if (!driverId) throw new ValidationError('Driver identity required');

    let assignments: any[] = [];
    let orders: any[] = [];

    try {
      const aRes = await db.query('SELECT * FROM delivery_assignments WHERE delivery_partner_id = $1 ORDER BY assigned_at DESC', [driverId]);
      assignments = aRes.rows;
      const oRes = await db.query('SELECT * FROM orders');
      orders = oRes.rows;
    } catch {
      assignments = memoryStore.delivery_assignments.filter((a) => a.delivery_partner_id === driverId);
      orders = memoryStore.orders;
    }

    const enriched = assignments.map((assign) => {
      const ord = orders.find((o) => o.id === assign.order_id) || {};
      let addr = ord.address_snapshot || ord.delivery_address || {};
      if (typeof addr === 'string') {
        try { addr = JSON.parse(addr); } catch { addr = {}; }
      }

      return {
        ...assign,
        order_number: ord.order_number,
        customer_name: ord.customer_name || addr.full_name || 'Customer',
        customer_phone: ord.customer_mobile || addr.phone || '',
        delivery_address: addr.full_address || `${addr.house_number || ''} ${addr.street || ''}, ${addr.area || ''}, ${addr.city || 'Hyderabad'}`,
        destination_lat: addr.latitude || null,
        destination_lng: addr.longitude || null,
        items: ord.items || [],
        total_amount: ord.total || 0,
        payment_method: ord.payment_method || 'cod',
        payment_status: ord.payment_status || 'pending',
      };
    });

    sendSuccess(res, 'Driver assignments retrieved', enriched);
  } catch (error) {
    next(error);
  }
}

// ===================== GPS & LIVE TRACKING =====================

export async function updateDriverLocation(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { latitude, longitude, accuracy } = req.body;
    // Derive driver ID strictly from authenticated user if delivery role, or body if admin
    const driverId = req.user?.role === 'delivery' ? req.user.id : req.body.delivery_partner_id || req.user?.id;

    if (!driverId) throw new ValidationError('delivery_partner_id is required');
    if (latitude === undefined || longitude === undefined) {
      throw new ValidationError('latitude and longitude are required');
    }

    const result = await recordDriverGPS(driverId, Number(latitude), Number(longitude), accuracy ? Number(accuracy) : undefined);
    sendSuccess(res, 'Driver location updated', result);
  } catch (error) {
    next(error);
  }
}

export async function getOrderTracking(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const customerUserId = req.user?.role === 'customer' ? req.user.id : undefined;

    const trackingData = await getCustomerOrderLiveTracking(id, customerUserId);
    sendSuccess(res, 'Order live tracking details', trackingData);
  } catch (error) {
    next(error);
  }
}

// ===================== STORE DELIVERY SETTINGS & CHARGES =====================

export async function getDeliverySettings(req: Request, res: Response, next: NextFunction) {
  try {
    let settings = getPersistedDeliverySettings();
    try {
      const result = await db.query("SELECT * FROM delivery_settings WHERE id = 'global_delivery_settings' LIMIT 1");
      if (result.rows.length > 0) {
        const row = result.rows[0];
        settings = {
          id: 'global_delivery_settings',
          default_delivery_charge: Number(row.default_delivery_charge),
          free_delivery_threshold: Number(row.free_delivery_threshold),
          min_order_amount: Number(row.min_order_amount),
          enable_free_delivery: Boolean(row.enable_free_delivery),
          express_delivery_fee: Number(row.express_delivery_fee),
          estimated_delivery_time: String(row.estimated_delivery_time || '30–45 mins'),
          min_eta_minutes: row.min_eta_minutes ? Number(row.min_eta_minutes) : 30,
          max_eta_minutes: row.max_eta_minutes ? Number(row.max_eta_minutes) : 45,
          is_delivery_active: row.is_delivery_active !== false,
          global_delivery_status: (row.global_delivery_status as any) || (row.is_delivery_active !== false ? 'available' : 'paused'),
          global_pause_reason: row.global_pause_reason || '',
          global_reopen_at: row.global_reopen_at || null,
          surge_charge: Number(row.surge_charge || 0),
          hub_name: row.hub_name || settings.hub_name || 'Fresh Vegetables Central Hub',
          hub_address: row.hub_address !== undefined && row.hub_address !== null ? row.hub_address : (settings.hub_address || ''),
          hub_latitude: row.hub_latitude !== null && row.hub_latitude !== undefined ? Number(row.hub_latitude) : settings.hub_latitude,
          hub_longitude: row.hub_longitude !== null && row.hub_longitude !== undefined ? Number(row.hub_longitude) : settings.hub_longitude,
          delivery_radius_km: row.delivery_radius_km ? Number(row.delivery_radius_km) : (settings.delivery_radius_km || 5.0),
          serviceability_enabled: row.serviceability_enabled !== false && settings.serviceability_enabled !== false,
          operating_hours_start: row.operating_hours_start || settings.operating_hours_start || '06:00',
          operating_hours_end: row.operating_hours_end || settings.operating_hours_end || '22:00',
          express_enabled: row.express_enabled !== false && settings.express_enabled !== false,
          express_start_time: row.express_start_time || settings.express_start_time || '06:00',
          express_end_time: row.express_end_time || settings.express_end_time || '21:30',
          morning_slot_enabled: row.morning_slot_enabled !== false && settings.morning_slot_enabled !== false,
          morning_slot_start: row.morning_slot_start || settings.morning_slot_start || '06:00',
          morning_slot_end: row.morning_slot_end || settings.morning_slot_end || '09:00',
          morning_slot_cutoff: row.morning_slot_cutoff || settings.morning_slot_cutoff || '08:30',
          evening_slot_enabled: row.evening_slot_enabled !== false && settings.evening_slot_enabled !== false,
          evening_slot_start: row.evening_slot_start || settings.evening_slot_start || '17:00',
          evening_slot_end: row.evening_slot_end || settings.evening_slot_end || '20:00',
          evening_slot_cutoff: row.evening_slot_cutoff || settings.evening_slot_cutoff || '19:30',
          updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
        };
        savePersistedDeliverySettings(settings);
      }
    } catch {
      // Use persisted file settings
    }

    const isHubConfigured =
      settings.hub_latitude !== null &&
      settings.hub_latitude !== undefined &&
      settings.hub_longitude !== null &&
      settings.hub_longitude !== undefined &&
      isValidCoordinate(settings.hub_latitude, settings.hub_longitude);

    sendSuccess(res, 'Delivery settings retrieved successfully', {
      ...settings,
      is_hub_configured: isHubConfigured,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateDeliverySettings(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const {
      default_delivery_charge,
      free_delivery_threshold,
      min_order_amount,
      enable_free_delivery,
      express_delivery_fee,
      estimated_delivery_time,
      min_eta_minutes,
      max_eta_minutes,
      surge_charge,
      is_delivery_active,
      global_delivery_status,
      global_pause_reason,
      global_reopen_at,
      hub_name,
      hub_address,
      hub_latitude,
      hub_longitude,
      delivery_radius_km,
      serviceability_enabled,
      operating_hours_start,
      operating_hours_end,
      express_enabled,
      express_start_time,
      express_end_time,
      morning_slot_enabled,
      morning_slot_start,
      morning_slot_end,
      morning_slot_cutoff,
      evening_slot_enabled,
      evening_slot_start,
      evening_slot_end,
      evening_slot_cutoff,
    } = req.body;

    // Validate coordinates if provided
    if (hub_latitude !== undefined && hub_latitude !== null && hub_latitude !== '') {
      const lat = Number(hub_latitude);
      if (isNaN(lat) || lat < -90 || lat > 90) {
        throw new ValidationError('Hub latitude must be a valid number between -90 and 90');
      }
    }

    if (hub_longitude !== undefined && hub_longitude !== null && hub_longitude !== '') {
      const lng = Number(hub_longitude);
      if (isNaN(lng) || lng < -180 || lng > 180) {
        throw new ValidationError('Hub longitude must be a valid number between -180 and 180');
      }
    }

    if (delivery_radius_km !== undefined) {
      const radius = Number(delivery_radius_km);
      if (isNaN(radius) || radius <= 0 || radius > 5.0) {
        throw new ValidationError('Delivery radius cannot exceed the store limit of 5.0 km without explicit authorization.');
      }
    }

    const oldValues = getPersistedDeliverySettings();

    // Persist immediately to file & memory
    const updatedSettings = savePersistedDeliverySettings({
      default_delivery_charge,
      free_delivery_threshold,
      min_order_amount,
      enable_free_delivery,
      express_delivery_fee,
      estimated_delivery_time,
      min_eta_minutes,
      max_eta_minutes,
      surge_charge,
      is_delivery_active,
      global_delivery_status,
      global_pause_reason,
      global_reopen_at,
      hub_name,
      hub_address,
      hub_latitude: hub_latitude !== undefined ? (hub_latitude === null || hub_latitude === '' ? null : Number(hub_latitude)) : undefined,
      hub_longitude: hub_longitude !== undefined ? (hub_longitude === null || hub_longitude === '' ? null : Number(hub_longitude)) : undefined,
      delivery_radius_km: delivery_radius_km !== undefined ? Number(delivery_radius_km) : undefined,
      serviceability_enabled: serviceability_enabled !== undefined ? Boolean(serviceability_enabled) : undefined,
      operating_hours_start,
      operating_hours_end,
      express_enabled,
      express_start_time,
      express_end_time,
      morning_slot_enabled,
      morning_slot_start,
      morning_slot_end,
      morning_slot_cutoff,
      evening_slot_enabled,
      evening_slot_start,
      evening_slot_end,
      evening_slot_cutoff,
    });

    // Also persist to PostgreSQL with UPSERT
    try {
      await db.query(
        `INSERT INTO delivery_settings (
          id,
          default_delivery_charge,
          free_delivery_threshold,
          min_order_amount,
          enable_free_delivery,
          express_delivery_fee,
          estimated_delivery_time,
          surge_charge,
          is_delivery_active,
          hub_name,
          hub_address,
          hub_latitude,
          hub_longitude,
          delivery_radius_km,
          serviceability_enabled,
          operating_hours_start,
          operating_hours_end,
          express_enabled,
          express_start_time,
          express_end_time,
          morning_slot_enabled,
          morning_slot_start,
          morning_slot_end,
          morning_slot_cutoff,
          evening_slot_enabled,
          evening_slot_start,
          evening_slot_end,
          evening_slot_cutoff,
          global_delivery_status,
          global_pause_reason,
          global_reopen_at,
          min_eta_minutes,
          max_eta_minutes,
          updated_at
        ) VALUES (
          'global_delivery_settings',
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
          $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27,
          $28, $29, $30, $31, $32, NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          default_delivery_charge = EXCLUDED.default_delivery_charge,
          free_delivery_threshold = EXCLUDED.free_delivery_threshold,
          min_order_amount = EXCLUDED.min_order_amount,
          enable_free_delivery = EXCLUDED.enable_free_delivery,
          express_delivery_fee = EXCLUDED.express_delivery_fee,
          estimated_delivery_time = EXCLUDED.estimated_delivery_time,
          surge_charge = EXCLUDED.surge_charge,
          is_delivery_active = EXCLUDED.is_delivery_active,
          hub_name = EXCLUDED.hub_name,
          hub_address = EXCLUDED.hub_address,
          hub_latitude = EXCLUDED.hub_latitude,
          hub_longitude = EXCLUDED.hub_longitude,
          delivery_radius_km = EXCLUDED.delivery_radius_km,
          serviceability_enabled = EXCLUDED.serviceability_enabled,
          operating_hours_start = EXCLUDED.operating_hours_start,
          operating_hours_end = EXCLUDED.operating_hours_end,
          express_enabled = EXCLUDED.express_enabled,
          express_start_time = EXCLUDED.express_start_time,
          express_end_time = EXCLUDED.express_end_time,
          morning_slot_enabled = EXCLUDED.morning_slot_enabled,
          morning_slot_start = EXCLUDED.morning_slot_start,
          morning_slot_end = EXCLUDED.morning_slot_end,
          morning_slot_cutoff = EXCLUDED.morning_slot_cutoff,
          evening_slot_enabled = EXCLUDED.evening_slot_enabled,
          evening_slot_start = EXCLUDED.evening_slot_start,
          evening_slot_end = EXCLUDED.evening_slot_end,
          evening_slot_cutoff = EXCLUDED.evening_slot_cutoff,
          global_delivery_status = EXCLUDED.global_delivery_status,
          global_pause_reason = EXCLUDED.global_pause_reason,
          global_reopen_at = EXCLUDED.global_reopen_at,
          min_eta_minutes = EXCLUDED.min_eta_minutes,
          max_eta_minutes = EXCLUDED.max_eta_minutes,
          updated_at = NOW()
        RETURNING *`,
        [
          updatedSettings.default_delivery_charge,
          updatedSettings.free_delivery_threshold,
          updatedSettings.min_order_amount,
          updatedSettings.enable_free_delivery,
          updatedSettings.express_delivery_fee,
          updatedSettings.estimated_delivery_time,
          updatedSettings.surge_charge,
          updatedSettings.is_delivery_active,
          updatedSettings.hub_name || 'Fresh Vegetables Central Hub',
          updatedSettings.hub_address || '',
          updatedSettings.hub_latitude ?? null,
          updatedSettings.hub_longitude ?? null,
          updatedSettings.delivery_radius_km || 5.0,
          updatedSettings.serviceability_enabled !== false,
          updatedSettings.operating_hours_start || '06:00',
          updatedSettings.operating_hours_end || '22:00',
          updatedSettings.express_enabled !== false,
          updatedSettings.express_start_time || '06:00',
          updatedSettings.express_end_time || '21:30',
          updatedSettings.morning_slot_enabled !== false,
          updatedSettings.morning_slot_start || '06:00',
          updatedSettings.morning_slot_end || '09:00',
          updatedSettings.morning_slot_cutoff || '08:30',
          updatedSettings.evening_slot_enabled !== false,
          updatedSettings.evening_slot_start || '17:00',
          updatedSettings.evening_slot_end || '20:00',
          updatedSettings.evening_slot_cutoff || '19:30',
          updatedSettings.global_delivery_status || 'available',
          updatedSettings.global_pause_reason || '',
          updatedSettings.global_reopen_at || null,
          updatedSettings.min_eta_minutes || 30,
          updatedSettings.max_eta_minutes || 45,
        ]
      );
    } catch (dbErr) {
      console.warn('DB delivery_settings upsert error:', dbErr);
    }

    await logAuditEvent({
      req,
      action: 'DELIVERY_SETTINGS_UPDATED',
      entityType: 'delivery_settings',
      entityId: 'global_delivery_settings',
      oldValues,
      newValues: updatedSettings,
    });

    const isHubConfigured =
      updatedSettings.hub_latitude !== null &&
      updatedSettings.hub_latitude !== undefined &&
      updatedSettings.hub_longitude !== null &&
      updatedSettings.hub_longitude !== undefined &&
      isValidCoordinate(updatedSettings.hub_latitude, updatedSettings.hub_longitude);

    sendSuccess(res, 'Delivery charges and settings updated successfully', {
      ...updatedSettings,
      is_hub_configured: isHubConfigured,
    });
  } catch (error) {
    next(error);
  }
}

// ===================== SERVICEABILITY CHECK (5 KM RADIUS) & DYNAMIC ETA =====================

export async function checkDeliveryServiceability(req: Request, res: Response, next: NextFunction) {
  try {
    const { latitude, longitude, pincode } = req.body;

    if (latitude === undefined || longitude === undefined || latitude === null || longitude === null) {
      return res.status(400).json({
        success: false,
        configured: true,
        serviceable: false,
        is_delivery_active: false,
        eta_text: 'Location Required',
        message: 'Latitude and longitude are required to check delivery serviceability.',
      });
    }

    const lat = Number(latitude);
    const lng = Number(longitude);

    if (isNaN(lat) || isNaN(lng) || !isValidCoordinate(lat, lng)) {
      return res.status(400).json({
        success: false,
        configured: true,
        serviceable: false,
        is_delivery_active: false,
        eta_text: 'Invalid Location',
        message: 'Invalid coordinates: latitude must be between -90 and 90, longitude between -180 and 180.',
      });
    }

    let settings = getPersistedDeliverySettings();
    try {
      const dbSettingsRes = await db.query("SELECT * FROM delivery_settings WHERE id = 'global_delivery_settings' LIMIT 1");
      if (dbSettingsRes.rows.length > 0) {
        const row = dbSettingsRes.rows[0];
        settings = {
          ...settings,
          hub_latitude: row.hub_latitude ? Number(row.hub_latitude) : 17.34457,
          hub_longitude: row.hub_longitude ? Number(row.hub_longitude) : 78.516972,
          delivery_radius_km: row.delivery_radius_km ? Number(row.delivery_radius_km) : 5.0,
          serviceability_enabled: row.serviceability_enabled !== false,
          hub_name: row.hub_name || 'Fresh Vegetables Champapet Hub',
          hub_address: row.hub_address || 'Flat/House 9-153/4 Raji reddy nagar colony, Champapet, Hyderabad, Telangana - 500059',
          is_delivery_active: row.is_delivery_active !== false,
          global_delivery_status: row.global_delivery_status || 'available',
        };
      }
    } catch {}

    let hubs = getActiveHubs();
    try {
      const dbHubsRes = await db.query('SELECT * FROM delivery_hubs WHERE is_active = true');
      if (dbHubsRes.rows.length > 0) {
        hubs = dbHubsRes.rows.map((r: any) => ({
          id: r.id,
          hub_code: r.hub_code,
          name: r.name,
          address: r.address,
          latitude: Number(r.latitude),
          longitude: Number(r.longitude),
          delivery_radius_km: Math.min(5.0, Number(r.delivery_radius_km || 5.0)),
          is_active: r.is_active !== false,
          is_paused: Boolean(r.is_paused),
          pause_reason: r.pause_reason || '',
          operating_hours_start: r.operating_hours_start || '06:00',
          operating_hours_end: r.operating_hours_end || '22:00',
          max_orders_per_slot: Number(r.max_orders_per_slot || 35),
        }));
      }
    } catch {}

    const result = checkMultiHubServiceability(lat, lng, { hubs, fallbackSettings: settings });
    const zones = getPersistedZones();

    // 1. Strict Enforcement: If coordinates are outside 5.0 KM radius of all eligible hubs
    if (!result.serviceable || !result.configured) {
      return res.status(200).json({
        success: true,
        configured: result.configured,
        serviceable: false,
        is_delivery_active: false,
        distanceKm: result.distanceKm,
        rawDistanceKm: result.rawDistanceKm,
        radiusKm: result.radiusKm || 5.0,
        eta_text: 'Not Serviceable',
        message: result.message || 'Sorry! We are not delivering to your location yet.',
        error_description: result.distanceKm
          ? `Your location is ${result.distanceKm} km from our nearest delivery hub (${result.hubName}, maximum radius: ${result.radiusKm || 5.0} KM). Please select another location within our delivery area.`
          : 'Sorry! We are not delivering to your location yet.',
        hubName: result.hubName,
        hubAddress: result.hubAddress,
        assigned_hub_id: null,
        assigned_hub_code: null,
        assigned_hub_name: null,
        assigned_hub_address: null,
        data: {
          ...result,
          serviceable: false,
          is_delivery_active: false,
          eta_text: 'Not Serviceable',
          message: result.message || 'Sorry! We are not delivering to your location yet.',
        },
      });
    }

    // 2. Resolve matched zone within serviceable range under assigned hub
    const assignedHub = result.assignedHub;
    const assignedHubId = result.assigned_hub_id;
    const assignedHubCode = result.assigned_hub_code;

    const hubZones = zones.filter((z) => !z.hub_id || z.hub_id === assignedHubId || z.hub_code === assignedHubCode);
    const candidateZones = hubZones.length > 0 ? hubZones : zones;

    let matchedZone: any = null;
    let minZoneDistance = Infinity;

    for (const z of candidateZones) {
      if (z.latitude && z.longitude) {
        const dist = calculateHaversineDistanceKm(lat, lng, Number(z.latitude), Number(z.longitude));
        if (dist < minZoneDistance) {
          minZoneDistance = dist;
          matchedZone = z;
        }
      }
    }

    if (!matchedZone && pincode) {
      const cleanPin = String(pincode).trim();
      matchedZone = candidateZones.find((z) => Array.isArray(z.pincodes) && z.pincodes.includes(cleanPin));
    }

    if (!matchedZone && candidateZones.length > 0) {
      matchedZone = candidateZones[0];
    }

    // 3. Determine Global & Hub/Zone-level Availability
    const globalStatus = settings.global_delivery_status || (settings.is_delivery_active !== false ? 'available' : 'paused');
    const isHubPaused = assignedHub ? Boolean(assignedHub.is_paused) : false;
    const isZonePaused = matchedZone ? (matchedZone.is_paused === true || matchedZone.status === 'PAUSED') : false;
    const minEta = matchedZone?.min_eta_minutes || settings.min_eta_minutes || 30;
    const maxEta = matchedZone?.max_eta_minutes || settings.max_eta_minutes || 45;

    let isDeliveryActive = true;
    let etaText = (minEta && maxEta) ? `${minEta}–${maxEta} MINS` : 'Delivery estimate unavailable';
    let statusMessage = `Express delivery available from ${result.assigned_hub_name || result.hubName}.`;

    if (globalStatus === 'paused') {
      isDeliveryActive = false;
      etaText = 'Delivery Paused';
      statusMessage = settings.global_pause_reason || 'Express deliveries are temporarily paused. Resuming shortly.';
    } else if (globalStatus === 'closed_for_today') {
      isDeliveryActive = false;
      etaText = 'Closed for Today';
      statusMessage = 'Deliveries are closed for today. Express orders reopen tomorrow morning.';
    } else if (isHubPaused) {
      isDeliveryActive = false;
      etaText = 'Delivery Paused';
      statusMessage = assignedHub?.pause_reason || `Express delivery from ${assignedHub?.name} is temporarily paused.`;
    } else if (isZonePaused) {
      isDeliveryActive = false;
      etaText = 'Delivery Paused';
      statusMessage = matchedZone.pause_reason || `Express delivery is temporarily paused in ${matchedZone.name}.`;
    } else {
      // Check operating hours in IST
      const openTime = assignedHub?.operating_hours_start || matchedZone?.daily_open_time || settings.operating_hours_start || '06:00';
      const closeTime = assignedHub?.operating_hours_end || matchedZone?.daily_close_time || settings.operating_hours_end || '22:00';
      const nowIst = new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour12: false, hour: '2-digit', minute: '2-digit' });

      if (nowIst < openTime || nowIst > closeTime) {
        isDeliveryActive = false;
        etaText = `Opens at ${openTime}`;
        statusMessage = `Orders from ${result.assigned_hub_name || 'this hub'} are delivered between ${openTime} and ${closeTime}.`;
      } else {
        isDeliveryActive = true;
        etaText = `${minEta}–${maxEta} MINS`;
        statusMessage = `Great! We deliver to your location from ${result.assigned_hub_name || 'our delivery hub'}.`;
      }
    }

    return res.status(200).json({
      success: true,
      configured: true,
      serviceable: true,
      is_delivery_active: isDeliveryActive,
      global_status: globalStatus,
      distanceKm: result.distanceKm,
      radiusKm: result.radiusKm,
      message: statusMessage,
      // Multi-hub assignments
      assigned_hub_id: result.assigned_hub_id,
      assigned_hub_code: result.assigned_hub_code,
      assigned_hub_name: result.assigned_hub_name,
      assigned_hub_address: result.assigned_hub_address,
      hubName: result.assigned_hub_name || result.hubName,
      hubAddress: result.assigned_hub_address || result.hubAddress,
      zone: matchedZone,
      eta_text: etaText,
      min_eta_minutes: minEta,
      max_eta_minutes: maxEta,
      priority: matchedZone?.priority || 'normal',
      delivery_fee: matchedZone?.delivery_fee ?? settings.default_delivery_charge,
      free_delivery_threshold: matchedZone?.free_delivery_threshold ?? settings.free_delivery_threshold,
      min_order_amount:
        matchedZone?.min_order_amount !== undefined && !isNaN(Number(matchedZone.min_order_amount))
          ? Math.min(Number(matchedZone.min_order_amount), Number(settings.min_order_amount))
          : Number(settings.min_order_amount),
      data: {
        ...result,
        assigned_hub_id: result.assigned_hub_id,
        assigned_hub_code: result.assigned_hub_code,
        assigned_hub_name: result.assigned_hub_name,
        assigned_hub_address: result.assigned_hub_address,
        zone: matchedZone,
        eta_text: etaText,
        is_delivery_active: isDeliveryActive,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Multi-tier Reverse Geocoding with Authoritative 5 KM Serviceability
 * Converts GPS coordinates into an accurate, readable address with locality, area, city, and pincode.
 * Evaluates delivery serviceability from the Champapet hub.
 */
export async function reverseGeocodeCoordinates(req: Request, res: Response, next: NextFunction) {
  try {
    const rawLat = req.query.latitude ?? req.query.lat ?? req.body?.latitude ?? req.body?.lat;
    const rawLng = req.query.longitude ?? req.query.lng ?? req.body?.longitude ?? req.body?.lng;

    if (rawLat === undefined || rawLng === undefined || rawLat === null || rawLng === null) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required for reverse geocoding.',
      });
    }

    const lat = Number(rawLat);
    const lng = Number(rawLng);

    if (isNaN(lat) || isNaN(lng) || !isValidCoordinate(lat, lng)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid coordinates provided. Latitude must be between -90 and 90, longitude between -180 and 180.',
      });
    }

    const roundedLat = Number(lat.toFixed(6));
    const roundedLng = Number(lng.toFixed(6));

    let colony = '';
    let area = '';
    let city = 'Hyderabad';
    let state = 'Telangana';
    let pincode = '';
    let formattedAddress = '';

    // 1. Primary: OpenStreetMap Nominatim with official User-Agent
    try {
      const nomRes = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${roundedLat}&lon=${roundedLng}&zoom=18&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'FreshVegetablesOrganicBackend/1.0 (support@freshvegetables.org)',
            'Accept-Language': 'en',
          },
          signal: AbortSignal.timeout(6000),
        }
      );
      if (nomRes.ok) {
        const nomData: any = await nomRes.json();
        if (nomData?.address) {
          const a = nomData.address;
          colony = a.neighbourhood || a.suburb || a.residential || a.quarter || a.road || '';
          area = a.suburb || a.city_district || a.county || a.city || '';
          city = a.city || a.town || a.county || 'Hyderabad';
          state = a.state || 'Telangana';
          pincode = a.postcode || '';

          const parts = [a.road, a.neighbourhood, a.suburb, a.city, a.postcode].filter(Boolean);
          formattedAddress = parts.length > 0 ? parts.join(', ') : nomData.display_name;
        }
      }
    } catch (e: any) {
      console.warn('⚠️ [Reverse Geocode] Nominatim failed, falling back to BigDataCloud:', e?.message);
    }

    // 2. Secondary: BigDataCloud Free Reverse Geocode Client API
    if (!formattedAddress) {
      try {
        const bdcRes = await fetch(
          `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${roundedLat}&longitude=${roundedLng}&localityLanguage=en`,
          { signal: AbortSignal.timeout(6000) }
        );
        if (bdcRes.ok) {
          const bdcData: any = await bdcRes.json();
          colony = bdcData.locality || bdcData.city || 'Hyderabad';
          area = bdcData.city || bdcData.principalSubdivision || 'Hyderabad';
          city = bdcData.city || 'Hyderabad';
          state = bdcData.principalSubdivision || 'Telangana';
          pincode = bdcData.postcode || '';
          formattedAddress = [bdcData.locality, bdcData.city, bdcData.principalSubdivision].filter(Boolean).join(', ');
        }
      } catch (e: any) {
        console.warn('⚠️ [Reverse Geocode] BigDataCloud fallback failed:', e?.message);
      }
    }

    // 3. Fallback: Clean coordinate reference if external services are unreachable
    if (!formattedAddress) {
      colony = 'Detected Location';
      area = 'Hyderabad';
      city = 'Hyderabad';
      formattedAddress = `Location (${roundedLat.toFixed(4)}, ${roundedLng.toFixed(4)}), Hyderabad`;
    }

    // Authoritative serviceability check against 5.0 KM delivery radius from Champapet Hub
    let settings = getPersistedDeliverySettings();
    try {
      const dbSettingsRes = await db.query("SELECT * FROM delivery_settings WHERE id = 'global_delivery_settings' LIMIT 1");
      if (dbSettingsRes.rows.length > 0) {
        const row = dbSettingsRes.rows[0];
        settings = {
          ...settings,
          hub_latitude: row.hub_latitude ? Number(row.hub_latitude) : 17.34457,
          hub_longitude: row.hub_longitude ? Number(row.hub_longitude) : 78.516972,
          delivery_radius_km: row.delivery_radius_km ? Number(row.delivery_radius_km) : 5.0,
          serviceability_enabled: row.serviceability_enabled !== false,
          hub_name: row.hub_name || 'Fresh Vegetables Champapet Hub',
          hub_address: row.hub_address || 'Flat/House 9-153/4 Raji reddy nagar colony, Champapet, Hyderabad, Telangana - 500059',
          is_delivery_active: row.is_delivery_active !== false,
          global_delivery_status: row.global_delivery_status || 'available',
        };
      }
    } catch {}

    const serv = checkServiceability(roundedLat, roundedLng, settings);

    return res.status(200).json({
      success: true,
      data: {
        latitude: roundedLat,
        longitude: roundedLng,
        colony: colony || area || 'Detected Location',
        area: area || colony || 'Hyderabad',
        city,
        state,
        pincode,
        formatted_address: formattedAddress,
        serviceability: {
          configured: serv.configured,
          serviceable: serv.serviceable,
          distanceKm: serv.distanceKm,
          rawDistanceKm: serv.rawDistanceKm,
          radiusKm: serv.radiusKm || 5.0,
          assigned_hub_id: serv.assigned_hub_id,
          assigned_hub_code: serv.assigned_hub_code,
          assigned_hub_name: serv.assigned_hub_name || serv.hubName,
          assigned_hub_address: serv.assigned_hub_address || serv.hubAddress,
          hubName: serv.assigned_hub_name || serv.hubName,
          hubAddress: serv.assigned_hub_address || serv.hubAddress,
          message: serv.serviceable
            ? `Great! Delivery is available from ${serv.assigned_hub_name || serv.hubName}.`
            : (serv.message || 'Sorry! We are not delivering to your location yet.'),
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

// ===================== TWO-HUB MANAGEMENT ENDPOINTS =====================

/**
 * Public: List active authorized delivery hubs
 */
export async function getPublicDeliveryHubs(req: Request, res: Response, next: NextFunction) {
  try {
    let hubs = getActiveHubs();
    try {
      const dbRes = await db.query('SELECT * FROM delivery_hubs WHERE is_active = true ORDER BY name ASC');
      if (dbRes.rows.length > 0) {
        hubs = dbRes.rows.map((r: any) => ({
          id: r.id,
          hub_code: r.hub_code,
          name: r.name,
          address: r.address,
          latitude: Number(r.latitude),
          longitude: Number(r.longitude),
          delivery_radius_km: Math.min(5.0, Number(r.delivery_radius_km || 5.0)),
          is_active: r.is_active !== false,
          is_paused: Boolean(r.is_paused),
          pause_reason: r.pause_reason || '',
          operating_hours_start: r.operating_hours_start || '06:00',
          operating_hours_end: r.operating_hours_end || '22:00',
          max_orders_per_slot: Number(r.max_orders_per_slot || 35),
        }));
      }
    } catch {}

    sendSuccess(res, 'Active delivery hubs retrieved', hubs);
  } catch (error) {
    next(error);
  }
}

/**
 * Admin: List all delivery hubs with mapped zones and active statistics
 */
export async function getAdminDeliveryHubs(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    let hubs = getPersistedHubs();
    try {
      const dbRes = await db.query('SELECT * FROM delivery_hubs ORDER BY created_at ASC');
      if (dbRes.rows.length > 0) {
        hubs = dbRes.rows.map((r: any) => ({
          id: r.id,
          hub_code: r.hub_code,
          name: r.name,
          address: r.address,
          latitude: Number(r.latitude),
          longitude: Number(r.longitude),
          delivery_radius_km: Math.min(5.0, Number(r.delivery_radius_km || 5.0)),
          is_active: r.is_active !== false,
          is_paused: Boolean(r.is_paused),
          pause_reason: r.pause_reason || '',
          operating_hours_start: r.operating_hours_start || '06:00',
          operating_hours_end: r.operating_hours_end || '22:00',
          max_orders_per_slot: Number(r.max_orders_per_slot || 35),
        }));
      }
    } catch {}

    const allZones = getPersistedZones();

    // Attach mapped zones to each hub
    const hubsWithZones = hubs.map((h) => {
      const mappedZones = allZones.filter((z) => z.hub_id === h.id || z.hub_code === h.hub_code);
      return {
        ...h,
        zones: mappedZones,
        zone_count: mappedZones.length,
      };
    });

    sendSuccess(res, 'Admin delivery hubs retrieved', hubsWithZones);
  } catch (error) {
    next(error);
  }
}

/**
 * Admin: Create an authorized fulfillment hub
 */
export async function createAdminDeliveryHub(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const {
      hub_code,
      name,
      address,
      latitude,
      longitude,
      delivery_radius_km,
      is_active,
      is_paused,
      pause_reason,
      operating_hours_start,
      operating_hours_end,
      max_orders_per_slot,
    } = req.body;

    if (!hub_code || !name || !address || latitude === undefined || longitude === undefined) {
      throw new ValidationError('Hub code, name, address, latitude, and longitude are required');
    }

    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!isValidCoordinate(lat, lng)) {
      throw new ValidationError('Latitude must be between -90 and 90, longitude between -180 and 180');
    }

    const radius = Number(delivery_radius_km || 5.0);
    if (isNaN(radius) || radius <= 0 || radius > 5.0) {
      throw new ValidationError('Delivery radius cannot exceed the store limit of 5.0 KM');
    }

    const cleanCode = String(hub_code).toLowerCase().trim().replace(/[^a-z0-9_-]/g, '');
    const id = `hub-${cleanCode}`;

    const newHub: DeliveryHub = {
      id,
      hub_code: cleanCode,
      name: String(name).trim(),
      address: String(address).trim(),
      latitude: lat,
      longitude: lng,
      delivery_radius_km: radius,
      is_active: is_active !== false,
      is_paused: Boolean(is_paused),
      pause_reason: pause_reason || '',
      operating_hours_start: operating_hours_start || '06:00',
      operating_hours_end: operating_hours_end || '22:00',
      max_orders_per_slot: Number(max_orders_per_slot || 35),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    upsertHub(newHub);

    // Save to DB if table exists
    try {
      await db.query(
        `INSERT INTO delivery_hubs (
          id, hub_code, name, address, latitude, longitude, delivery_radius_km,
          is_active, is_paused, pause_reason, operating_hours_start, operating_hours_end, max_orders_per_slot
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          address = EXCLUDED.address,
          latitude = EXCLUDED.latitude,
          longitude = EXCLUDED.longitude,
          delivery_radius_km = EXCLUDED.delivery_radius_km,
          is_active = EXCLUDED.is_active,
          is_paused = EXCLUDED.is_paused,
          pause_reason = EXCLUDED.pause_reason,
          operating_hours_start = EXCLUDED.operating_hours_start,
          operating_hours_end = EXCLUDED.operating_hours_end,
          max_orders_per_slot = EXCLUDED.max_orders_per_slot,
          updated_at = NOW()`,
        [
          newHub.id,
          newHub.hub_code,
          newHub.name,
          newHub.address,
          newHub.latitude,
          newHub.longitude,
          newHub.delivery_radius_km,
          newHub.is_active,
          newHub.is_paused,
          newHub.pause_reason,
          newHub.operating_hours_start,
          newHub.operating_hours_end,
          newHub.max_orders_per_slot,
        ]
      );
    } catch {}

    sendSuccess(res, 'Delivery hub created successfully', newHub, 201);
  } catch (error) {
    next(error);
  }
}

/**
 * Admin: Update hub configuration
 */
export async function updateAdminDeliveryHub(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const existing = getHubById(id);
    if (!existing) {
      throw new NotFoundError(`Delivery hub ${id} not found`);
    }

    const {
      name,
      address,
      latitude,
      longitude,
      delivery_radius_km,
      is_active,
      is_paused,
      pause_reason,
      operating_hours_start,
      operating_hours_end,
      max_orders_per_slot,
    } = req.body;

    if (latitude !== undefined && longitude !== undefined) {
      if (!isValidCoordinate(Number(latitude), Number(longitude))) {
        throw new ValidationError('Invalid latitude or longitude');
      }
    }

    if (delivery_radius_km !== undefined) {
      const radius = Number(delivery_radius_km);
      if (isNaN(radius) || radius <= 0 || radius > 5.0) {
        throw new ValidationError('Delivery radius cannot exceed 5.0 KM');
      }
    }

    const updated = updateHub(id, {
      name: name !== undefined ? String(name).trim() : undefined,
      address: address !== undefined ? String(address).trim() : undefined,
      latitude: latitude !== undefined ? Number(latitude) : undefined,
      longitude: longitude !== undefined ? Number(longitude) : undefined,
      delivery_radius_km: delivery_radius_km !== undefined ? Math.min(5.0, Number(delivery_radius_km)) : undefined,
      is_active: is_active !== undefined ? Boolean(is_active) : undefined,
      is_paused: is_paused !== undefined ? Boolean(is_paused) : undefined,
      pause_reason: pause_reason !== undefined ? String(pause_reason) : undefined,
      operating_hours_start: operating_hours_start !== undefined ? String(operating_hours_start) : undefined,
      operating_hours_end: operating_hours_end !== undefined ? String(operating_hours_end) : undefined,
      max_orders_per_slot: max_orders_per_slot !== undefined ? Number(max_orders_per_slot) : undefined,
    });

    // Update DB if table exists
    try {
      await db.query(
        `UPDATE delivery_hubs SET
          name = COALESCE($1, name),
          address = COALESCE($2, address),
          latitude = COALESCE($3, latitude),
          longitude = COALESCE($4, longitude),
          delivery_radius_km = COALESCE($5, delivery_radius_km),
          is_active = COALESCE($6, is_active),
          is_paused = COALESCE($7, is_paused),
          pause_reason = COALESCE($8, pause_reason),
          operating_hours_start = COALESCE($9, operating_hours_start),
          operating_hours_end = COALESCE($10, operating_hours_end),
          max_orders_per_slot = COALESCE($11, max_orders_per_slot),
          updated_at = NOW()
        WHERE id = $12`,
        [
          name !== undefined ? String(name).trim() : null,
          address !== undefined ? String(address).trim() : null,
          latitude !== undefined ? Number(latitude) : null,
          longitude !== undefined ? Number(longitude) : null,
          delivery_radius_km !== undefined ? Math.min(5.0, Number(delivery_radius_km)) : null,
          is_active !== undefined ? Boolean(is_active) : null,
          is_paused !== undefined ? Boolean(is_paused) : null,
          pause_reason !== undefined ? String(pause_reason) : null,
          operating_hours_start !== undefined ? String(operating_hours_start) : null,
          operating_hours_end !== undefined ? String(operating_hours_end) : null,
          max_orders_per_slot !== undefined ? Number(max_orders_per_slot) : null,
          id,
        ]
      );
    } catch {}

    sendSuccess(res, 'Delivery hub updated successfully', updated);
  } catch (error) {
    next(error);
  }
}

/**
 * Admin: Quick toggle pause status for a specific hub
 */
export async function toggleHubPause(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { is_paused, pause_reason } = req.body;

    const existing = getHubById(id);
    if (!existing) {
      throw new NotFoundError(`Delivery hub ${id} not found`);
    }

    const updated = updateHub(id, {
      is_paused: Boolean(is_paused),
      pause_reason: pause_reason || (is_paused ? `Deliveries from ${existing.name} are temporarily paused.` : ''),
    });

    try {
      await db.query(
        'UPDATE delivery_hubs SET is_paused = $1, pause_reason = $2, updated_at = NOW() WHERE id = $3',
        [Boolean(is_paused), pause_reason || '', id]
      );
    } catch {}

    sendSuccess(res, `Delivery hub ${is_paused ? 'paused' : 'resumed'} successfully`, updated);
  } catch (error) {
    next(error);
  }
}

