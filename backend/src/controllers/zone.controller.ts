import { Request, Response, NextFunction } from 'express';
import { memoryStore } from '../config/mockDb';
import { sendSuccess } from '../utils/apiResponse';
import { BadRequestError, NotFoundError } from '../utils/appError';
import { logAuditEvent } from '../services/audit.service';
import cache from '../services/cache.service';
import { v4 as uuidv4 } from 'uuid';

export async function getActiveDeliveryZones(req: Request, res: Response, next: NextFunction) {
  try {
    const cached = cache.get('zones:active');
    if (cached) return sendSuccess(res, 'Active delivery zones (cached)', cached);

    const zones = (memoryStore as any).delivery_zones.filter((z: any) => z.status === 'ACTIVE');
    cache.set('zones:active', zones, 600);
    sendSuccess(res, 'Active delivery zones', zones);
  } catch (error) {
    next(error);
  }
}

export async function checkPincodeServiceability(req: Request, res: Response, next: NextFunction) {
  try {
    const { pincode } = req.body;
    if (!pincode) throw new BadRequestError('Pincode is required');

    const cleanPincode = String(pincode).trim();
    const zones = (memoryStore as any).delivery_zones.filter((z: any) => z.status === 'ACTIVE');

    // Find zone covering this pincode
    const matchedZone = zones.find((z: any) =>
      Array.isArray(z.pincodes) && z.pincodes.includes(cleanPincode)
    );

    if (!matchedZone) {
      return sendSuccess(res, 'Pincode not currently serviceable', {
        serviceable: false,
        pincode: cleanPincode,
        message: `We do not yet deliver to pincode ${cleanPincode}. We are rapidly expanding across Hyderabad and Ahmedabad!`,
      });
    }

    // Find fulfillment store
    const store = (memoryStore as any).stores.find((st: any) =>
      st.coverage_zones && st.coverage_zones.includes(matchedZone.id)
    ) || (memoryStore as any).stores[0];

    sendSuccess(res, 'Delivery zone resolved successfully', {
      serviceable: true,
      pincode: cleanPincode,
      zone: matchedZone,
      delivery_fee: matchedZone.delivery_fee,
      min_order_amount: matchedZone.min_order_amount,
      free_delivery_threshold: matchedZone.free_delivery_threshold,
      estimated_delivery_time: matchedZone.estimated_delivery_time,
      fulfillment_store: store ? { name: store.name, address: store.address } : null,
    });
  } catch (error) {
    next(error);
  }
}

export async function getStores(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(res, 'Fulfillment stores & micro-hubs', (memoryStore as any).stores);
  } catch (error) {
    next(error);
  }
}

// ================= ADMIN ZONE MANAGEMENT =================

export async function getAdminZones(req: Request, res: Response, next: NextFunction) {
  try {
    const zones = (memoryStore as any).delivery_zones;
    sendSuccess(res, 'All delivery zones for admin', zones);
  } catch (error) {
    next(error);
  }
}

export async function createZone(req: Request, res: Response, next: NextFunction) {
  try {
    const {
      name,
      pincodes,
      delivery_radius_km,
      delivery_fee,
      min_order_amount,
      free_delivery_threshold,
      estimated_delivery_time,
      latitude,
      longitude,
    } = req.body;

    if (!name || !pincodes) {
      throw new BadRequestError('Zone name and pincodes are required');
    }

    const pinArray = Array.isArray(pincodes)
      ? pincodes
      : String(pincodes).split(',').map((p) => p.trim());

    const newZone = {
      id: uuidv4(),
      name,
      pincodes: pinArray,
      delivery_radius_km: Number(delivery_radius_km) || 10.0,
      delivery_fee: Number(delivery_fee) || 20.0,
      min_order_amount: Number(min_order_amount) || 199.0,
      free_delivery_threshold: Number(free_delivery_threshold) || 499.0,
      estimated_delivery_time: estimated_delivery_time || '30–45 mins',
      status: 'ACTIVE',
      latitude: latitude ? Number(latitude) : 17.4474,
      longitude: longitude ? Number(longitude) : 78.3762,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    (memoryStore as any).delivery_zones.push(newZone);
    cache.invalidate('zones:active');

    await logAuditEvent({
      req,
      action: 'DELIVERY_ZONE_CREATED',
      entityType: 'delivery_zone',
      entityId: newZone.id,
      newValues: newZone,
    });

    sendSuccess(res, 'Delivery zone created successfully', newZone, 201);
  } catch (error) {
    next(error);
  }
}

export async function updateZone(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const body = req.body;

    const zone = (memoryStore as any).delivery_zones.find((z: any) => z.id === id);
    if (!zone) throw new NotFoundError('Delivery zone not found');

    const oldValues = { ...zone };

    if (body.pincodes && !Array.isArray(body.pincodes)) {
      body.pincodes = String(body.pincodes).split(',').map((p) => p.trim());
    }

    Object.assign(zone, {
      ...body,
      updated_at: new Date().toISOString(),
    });

    cache.invalidate('zones:active');

    await logAuditEvent({
      req,
      action: 'DELIVERY_ZONE_UPDATED',
      entityType: 'delivery_zone',
      entityId: id,
      oldValues,
      newValues: zone,
    });

    sendSuccess(res, 'Delivery zone updated successfully', zone);
  } catch (error) {
    next(error);
  }
}

export async function deleteZone(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const index = (memoryStore as any).delivery_zones.findIndex((z: any) => z.id === id);
    if (index === -1) throw new NotFoundError('Delivery zone not found');

    const [deleted] = (memoryStore as any).delivery_zones.splice(index, 1);
    cache.invalidate('zones:active');

    await logAuditEvent({
      req,
      action: 'DELIVERY_ZONE_DELETED',
      entityType: 'delivery_zone',
      entityId: id,
      oldValues: deleted,
    });

    sendSuccess(res, 'Delivery zone deleted successfully', deleted);
  } catch (error) {
    next(error);
  }
}
