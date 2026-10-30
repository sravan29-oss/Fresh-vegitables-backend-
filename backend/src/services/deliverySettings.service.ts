import fs from 'fs';
import path from 'path';
import { memoryStore } from '../config/mockDb';

const SETTINGS_FILE = path.join(__dirname, '..', 'config', 'delivery_settings.json');

export interface StoreDeliverySettings {
  id: string;
  default_delivery_charge: number;
  free_delivery_threshold: number;
  min_order_amount: number;
  enable_free_delivery: boolean;
  express_delivery_fee: number;
  estimated_delivery_time: string;
  is_delivery_active: boolean;
  surge_charge: number;
  updated_at: string;

  // Delivery Hub & 5 KM Service Area Configuration
  hub_name?: string;
  hub_address?: string;
  hub_latitude?: number | null;
  hub_longitude?: number | null;
  delivery_radius_km?: number;
  serviceability_enabled?: boolean;
}

export function readSettingsFromFile(): StoreDeliverySettings | null {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
      const parsed = JSON.parse(data);
      if (parsed && typeof parsed.default_delivery_charge === 'number') {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Failed reading delivery_settings.json:', err);
  }
  return null;
}

export function writeSettingsToFile(settings: StoreDeliverySettings): void {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed writing delivery_settings.json:', err);
  }
}

/**
 * Checks if optional environment variables provide initial hub coordinates
 */
function getEnvHubCoordinates(): { lat: number | null; lng: number | null; radius: number; name?: string } {
  const envLat = process.env.DELIVERY_HUB_LATITUDE ? parseFloat(process.env.DELIVERY_HUB_LATITUDE) : null;
  const envLng = process.env.DELIVERY_HUB_LONGITUDE ? parseFloat(process.env.DELIVERY_HUB_LONGITUDE) : null;
  const envRadius = process.env.DELIVERY_RADIUS_KM ? parseFloat(process.env.DELIVERY_RADIUS_KM) : 5.0;
  const envName = process.env.DELIVERY_HUB_NAME || undefined;

  const validLat = envLat !== null && !isNaN(envLat) && envLat >= -90 && envLat <= 90 ? envLat : null;
  const validLng = envLng !== null && !isNaN(envLng) && envLng >= -180 && envLng <= 180 ? envLng : null;

  return {
    lat: validLat,
    lng: validLng,
    radius: envRadius > 0 ? envRadius : 5.0,
    name: envName,
  };
}

export function getPersistedDeliverySettings(): StoreDeliverySettings {
  const envHub = getEnvHubCoordinates();

  const fromFile = readSettingsFromFile();
  if (fromFile) {
    // If file has no hub lat/lng but env has them, apply env
    if (fromFile.hub_latitude === undefined && envHub.lat !== null) {
      fromFile.hub_latitude = envHub.lat;
      fromFile.hub_longitude = envHub.lng;
    }
    if (fromFile.delivery_radius_km === undefined) {
      fromFile.delivery_radius_km = envHub.radius;
    }
    if (fromFile.hub_name === undefined) {
      fromFile.hub_name = envHub.name || 'Fresh Vegetables Central Hub';
    }
    if (fromFile.hub_address === undefined) {
      fromFile.hub_address = '';
    }
    if (fromFile.serviceability_enabled === undefined) {
      fromFile.serviceability_enabled = true;
    }

    (memoryStore as any).delivery_settings = fromFile;
    return fromFile;
  }

  if ((memoryStore as any).delivery_settings) {
    return (memoryStore as any).delivery_settings;
  }

  const fallback: StoreDeliverySettings = {
    id: 'global_delivery_settings',
    default_delivery_charge: 30,
    free_delivery_threshold: 499,
    min_order_amount: 199,
    enable_free_delivery: true,
    express_delivery_fee: 45,
    estimated_delivery_time: '25–35 mins',
    is_delivery_active: true,
    surge_charge: 0,
    updated_at: new Date().toISOString(),
    // Delivery hub starts unconfigured unless env vars are explicitly provided
    hub_name: envHub.name || 'Fresh Vegetables Central Hub',
    hub_address: '',
    hub_latitude: envHub.lat,
    hub_longitude: envHub.lng,
    delivery_radius_km: envHub.radius,
    serviceability_enabled: true,
  };

  writeSettingsToFile(fallback);
  (memoryStore as any).delivery_settings = fallback;
  return fallback;
}

export function savePersistedDeliverySettings(partial: Partial<StoreDeliverySettings>): StoreDeliverySettings {
  const current = getPersistedDeliverySettings();

  // Validate coordinates if provided
  let newLat: number | null = current.hub_latitude !== undefined ? current.hub_latitude : null;
  if (partial.hub_latitude !== undefined) {
    if (partial.hub_latitude === null || partial.hub_latitude === ('' as any)) {
      newLat = null;
    } else {
      const parsed = Number(partial.hub_latitude);
      if (!isNaN(parsed) && isFinite(parsed) && parsed >= -90 && parsed <= 90) {
        newLat = parsed;
      }
    }
  }

  let newLng: number | null = current.hub_longitude !== undefined ? current.hub_longitude : null;
  if (partial.hub_longitude !== undefined) {
    if (partial.hub_longitude === null || partial.hub_longitude === ('' as any)) {
      newLng = null;
    } else {
      const parsed = Number(partial.hub_longitude);
      if (!isNaN(parsed) && isFinite(parsed) && parsed >= -180 && parsed <= 180) {
        newLng = parsed;
      }
    }
  }

  let newRadius: number = current.delivery_radius_km || 5.0;
  if (partial.delivery_radius_km !== undefined) {
    const parsedRad = Number(partial.delivery_radius_km);
    if (!isNaN(parsedRad) && parsedRad > 0 && parsedRad <= 100) {
      newRadius = parsedRad;
    }
  }

  const updated: StoreDeliverySettings = {
    id: 'global_delivery_settings',
    default_delivery_charge: partial.default_delivery_charge !== undefined ? Math.max(0, Number(partial.default_delivery_charge)) : current.default_delivery_charge,
    free_delivery_threshold: partial.free_delivery_threshold !== undefined ? Math.max(0, Number(partial.free_delivery_threshold)) : current.free_delivery_threshold,
    min_order_amount: partial.min_order_amount !== undefined ? Math.max(0, Number(partial.min_order_amount)) : current.min_order_amount,
    enable_free_delivery: partial.enable_free_delivery !== undefined ? Boolean(partial.enable_free_delivery) : current.enable_free_delivery,
    express_delivery_fee: partial.express_delivery_fee !== undefined ? Math.max(0, Number(partial.express_delivery_fee)) : current.express_delivery_fee,
    estimated_delivery_time: partial.estimated_delivery_time !== undefined ? String(partial.estimated_delivery_time).trim() : current.estimated_delivery_time,
    is_delivery_active: partial.is_delivery_active !== undefined ? Boolean(partial.is_delivery_active) : current.is_delivery_active,
    surge_charge: partial.surge_charge !== undefined ? Math.max(0, Number(partial.surge_charge)) : current.surge_charge,
    hub_name: partial.hub_name !== undefined ? String(partial.hub_name).trim() : (current.hub_name || 'Fresh Vegetables Central Hub'),
    hub_address: partial.hub_address !== undefined ? String(partial.hub_address).trim() : (current.hub_address || ''),
    hub_latitude: newLat,
    hub_longitude: newLng,
    delivery_radius_km: newRadius,
    serviceability_enabled: partial.serviceability_enabled !== undefined ? Boolean(partial.serviceability_enabled) : (current.serviceability_enabled !== false),
    updated_at: new Date().toISOString(),
  };

  writeSettingsToFile(updated);
  (memoryStore as any).delivery_settings = updated;
  return updated;
}
