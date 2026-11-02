import { Request, Response, NextFunction } from 'express';
import { memoryStore } from '../config/mockDb';
import { sendSuccess } from '../utils/apiResponse';
import { BadRequestError, NotFoundError } from '../utils/appError';
import { logAuditEvent } from '../services/audit.service';
import cache from '../services/cache.service';
import { v4 as uuidv4 } from 'uuid';
import { getPersistedZones, savePersistedZones } from '../services/zoneStore.service';
import { checkServiceability } from '../services/serviceability.service';

export async function getActiveDeliveryZones(req: Request, res: Response, next: NextFunction) {
  try {
    const cached = cache.get('zones:active');
    if (cached) return sendSuccess(res, 'Active delivery zones (cached)', cached);

    const allZones = getPersistedZones();
    const activeZones = allZones.filter((z: any) => {
      if (z.status !== 'ACTIVE') return false;
      if (z.latitude && z.longitude) {
        const serv = checkServiceability(Number(z.latitude), Number(z.longitude));
        return serv.serviceable;
      }
      return true;
    });
    cache.set('zones:active', activeZones, 300);
    sendSuccess(res, 'Active delivery zones', activeZones);
  } catch (error) {
    next(error);
  }
}

export async function checkPincodeServiceability(req: Request, res: Response, next: NextFunction) {
  try {
    const { pincode } = req.body;
    if (!pincode) throw new BadRequestError('Pincode is required');

    const cleanPincode = String(pincode).trim();
    const zones = getPersistedZones().filter((z: any) => z.status === 'ACTIVE');

    // Find zone covering this pincode
    const matchedZone = zones.find((z: any) =>
      Array.isArray(z.pincodes) && z.pincodes.includes(cleanPincode)
    );

    if (!matchedZone) {
      return sendSuccess(res, 'Pincode not currently serviceable', {
        serviceable: false,
        pincode: cleanPincode,
        message: 'Sorry! Delivery is not available at this location.',
      });
    }

    if (matchedZone.latitude && matchedZone.longitude) {
      const serv = checkServiceability(Number(matchedZone.latitude), Number(matchedZone.longitude));
      if (!serv.serviceable) {
        return sendSuccess(res, 'Pincode not currently serviceable', {
          serviceable: false,
          pincode: cleanPincode,
          message: 'Sorry! Delivery is not available at this location.',
        });
      }
    }

    // Find fulfillment store
    const store = (memoryStore as any).stores?.find((st: any) =>
      st.coverage_zones && st.coverage_zones.includes(matchedZone.id)
    ) || (memoryStore as any).stores?.[0];

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

export async function checkLocationCoordinates(req: Request, res: Response, next: NextFunction) {
  try {
    const { latitude, longitude, pincode } = req.body;
    if (latitude === undefined || longitude === undefined) {
      throw new BadRequestError('Latitude and longitude are required');
    }

    const lat = Number(latitude);
    const lng = Number(longitude);

    // Authoritative serviceability check against 5.0 KM Champapet hub
    const serviceCheckResult = checkServiceability(lat, lng);
    if (!serviceCheckResult.serviceable) {
      return sendSuccess(res, 'Coordinates currently outside active delivery radius', {
        serviceable: false,
        latitude: lat,
        longitude: lng,
        distanceKm: serviceCheckResult.distanceKm,
        radiusKm: serviceCheckResult.radiusKm,
        message: 'Sorry! Delivery is not available at this location.',
      });
    }

    const zones = getPersistedZones().filter((z: any) => z.status === 'ACTIVE');

    // Haversine distance formula to check if coordinate falls within zone's delivery_radius_km
    const toRad = (d: number) => (d * Math.PI) / 180;
    const R = 6371; // km
    let matchedZone: any = null;
    let minDistance = Infinity;

    for (const z of zones) {
      if (z.latitude && z.longitude) {
        const dLat = toRad(z.latitude - lat);
        const dLng = toRad(z.longitude - lng);
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos(toRad(lat)) * Math.cos(toRad(z.latitude)) * Math.sin(dLng / 2) ** 2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;

        const radius = Number(z.delivery_radius_km) || 10;
        if (distance <= radius && distance < minDistance) {
          minDistance = distance;
          matchedZone = { ...z, distance_km: Number(distance.toFixed(2)) };
        }
      }
    }

    // Pincode fallback match
    if (!matchedZone && pincode) {
      const cleanPin = String(pincode).trim();
      const pinMatch = zones.find((z: any) => Array.isArray(z.pincodes) && z.pincodes.includes(cleanPin));
      if (pinMatch) matchedZone = pinMatch;
    }

    if (!matchedZone) {
      return sendSuccess(res, 'Coordinates currently outside active delivery radius', {
        serviceable: false,
        latitude: lat,
        longitude: lng,
        message: 'This exact location is outside our current express delivery radius. Expanding soon!',
      });
    }

    sendSuccess(res, 'Delivery zone resolved successfully', {
      serviceable: true,
      latitude: lat,
      longitude: lng,
      zone: matchedZone,
      delivery_fee: matchedZone.delivery_fee,
      min_order_amount: matchedZone.min_order_amount,
      free_delivery_threshold: matchedZone.free_delivery_threshold,
      estimated_delivery_time: matchedZone.estimated_delivery_time,
    });
  } catch (error) {
    next(error);
  }
}

export async function getStores(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(res, 'Fulfillment stores & micro-hubs', (memoryStore as any).stores || []);
  } catch (error) {
    next(error);
  }
}

// ================= ADMIN ZONE MANAGEMENT =================

export async function getAdminZones(req: Request, res: Response, next: NextFunction) {
  try {
    const zones = getPersistedZones();
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
      min_eta_minutes,
      max_eta_minutes,
      priority,
      daily_open_time,
      daily_close_time,
      max_capacity_per_slot,
      is_paused,
      pause_reason,
      latitude,
      longitude,
    } = req.body;

    if (!name || !pincodes) {
      throw new BadRequestError('Zone name and pincodes are required');
    }

    const pinArray = Array.isArray(pincodes)
      ? pincodes.map((p: any) => String(p).trim()).filter(Boolean)
      : String(pincodes).split(',').map((p) => p.trim()).filter(Boolean);

    const minEta = Number(min_eta_minutes) > 0 ? Number(min_eta_minutes) : 30;
    const maxEta = Number(max_eta_minutes) > 0 ? Number(max_eta_minutes) : 45;

    const newZone = {
      id: uuidv4(),
      name: String(name).trim(),
      pincodes: pinArray,
      delivery_radius_km: Math.min(5.0, Number(delivery_radius_km) > 0 ? Number(delivery_radius_km) : 5.0),
      delivery_fee: Number(delivery_fee) >= 0 ? Number(delivery_fee) : 20.0,
      min_order_amount: Number(min_order_amount) >= 0 ? Number(min_order_amount) : 199.0,
      free_delivery_threshold: Number(free_delivery_threshold) >= 0 ? Number(free_delivery_threshold) : 499.0,
      min_eta_minutes: minEta,
      max_eta_minutes: maxEta,
      estimated_delivery_time: String(estimated_delivery_time || `${minEta}–${maxEta} min`).trim(),
      priority: priority || 'normal',
      daily_open_time: daily_open_time || '06:00',
      daily_close_time: daily_close_time || '22:00',
      max_capacity_per_slot: Number(max_capacity_per_slot) > 0 ? Number(max_capacity_per_slot) : 25,
      is_paused: Boolean(is_paused),
      pause_reason: pause_reason || '',
      status: is_paused ? 'PAUSED' : 'ACTIVE',
      latitude: latitude ? Number(latitude) : 17.4938,
      longitude: longitude ? Number(longitude) : 78.3995,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const zones = getPersistedZones();
    zones.push(newZone);
    savePersistedZones(zones);
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

    const zones = getPersistedZones();
    const zoneIndex = zones.findIndex((z: any) => z.id === id);
    if (zoneIndex === -1) throw new NotFoundError('Delivery zone not found');

    const zone = zones[zoneIndex];
    const oldValues = { ...zone };

    let pinArray = zone.pincodes;
    if (body.pincodes) {
      pinArray = Array.isArray(body.pincodes)
        ? body.pincodes.map((p: any) => String(p).trim()).filter(Boolean)
        : String(body.pincodes).split(',').map((p) => p.trim()).filter(Boolean);
    }

    const minEta = body.min_eta_minutes !== undefined ? Number(body.min_eta_minutes) : (zone.min_eta_minutes || 30);
    const maxEta = body.max_eta_minutes !== undefined ? Number(body.max_eta_minutes) : (zone.max_eta_minutes || 45);

    const isPaused = body.is_paused !== undefined ? Boolean(body.is_paused) : Boolean(zone.is_paused);

    const updatedZone = {
      ...zone,
      name: body.name !== undefined ? String(body.name).trim() : zone.name,
      pincodes: pinArray,
      delivery_radius_km: body.delivery_radius_km !== undefined ? Math.min(5.0, Number(body.delivery_radius_km)) : Math.min(5.0, Number(zone.delivery_radius_km || 5.0)),
      delivery_fee: body.delivery_fee !== undefined ? Number(body.delivery_fee) : zone.delivery_fee,
      min_order_amount: body.min_order_amount !== undefined ? Number(body.min_order_amount) : zone.min_order_amount,
      free_delivery_threshold: body.free_delivery_threshold !== undefined ? Number(body.free_delivery_threshold) : zone.free_delivery_threshold,
      min_eta_minutes: minEta,
      max_eta_minutes: maxEta,
      estimated_delivery_time: body.estimated_delivery_time !== undefined ? String(body.estimated_delivery_time).trim() : `${minEta}–${maxEta} min`,
      priority: body.priority !== undefined ? body.priority : (zone.priority || 'normal'),
      daily_open_time: body.daily_open_time !== undefined ? body.daily_open_time : (zone.daily_open_time || '06:00'),
      daily_close_time: body.daily_close_time !== undefined ? body.daily_close_time : (zone.daily_close_time || '22:00'),
      max_capacity_per_slot: body.max_capacity_per_slot !== undefined ? Number(body.max_capacity_per_slot) : (zone.max_capacity_per_slot || 25),
      is_paused: isPaused,
      pause_reason: body.pause_reason !== undefined ? body.pause_reason : (zone.pause_reason || ''),
      latitude: body.latitude !== undefined ? Number(body.latitude) : zone.latitude,
      longitude: body.longitude !== undefined ? Number(body.longitude) : zone.longitude,
      status: body.status || (isPaused ? 'PAUSED' : 'ACTIVE'),
      updated_at: new Date().toISOString(),
    };

    zones[zoneIndex] = updatedZone;
    savePersistedZones(zones);
    cache.invalidate('zones:active');

    await logAuditEvent({
      req,
      action: 'DELIVERY_ZONE_UPDATED',
      entityType: 'delivery_zone',
      entityId: id,
      oldValues,
      newValues: updatedZone,
    });

    sendSuccess(res, 'Delivery zone updated successfully', updatedZone);
  } catch (error) {
    next(error);
  }
}

export async function toggleZonePause(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { is_paused, pause_reason } = req.body;

    const zones = getPersistedZones();
    const zoneIndex = zones.findIndex((z: any) => z.id === id);
    if (zoneIndex === -1) throw new NotFoundError('Delivery zone not found');

    const zone = zones[zoneIndex];
    const newPauseState = is_paused !== undefined ? Boolean(is_paused) : !zone.is_paused;

    const updatedZone = {
      ...zone,
      is_paused: newPauseState,
      pause_reason: pause_reason !== undefined ? pause_reason : (newPauseState ? zone.pause_reason : ''),
      status: newPauseState ? 'PAUSED' : 'ACTIVE',
      updated_at: new Date().toISOString(),
    };

    zones[zoneIndex] = updatedZone;
    savePersistedZones(zones);
    cache.invalidate('zones:active');

    sendSuccess(res, `Delivery zone ${newPauseState ? 'paused' : 'resumed'} successfully`, updatedZone);
  } catch (error) {
    next(error);
  }
}

export async function deleteZone(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const zones = getPersistedZones();
    const index = zones.findIndex((z: any) => z.id === id);
    if (index === -1) throw new NotFoundError('Delivery zone not found');

    const [deleted] = zones.splice(index, 1);
    savePersistedZones(zones);
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
