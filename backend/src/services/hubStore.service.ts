import fs from 'fs';
import path from 'path';
import { memoryStore } from '../config/mockDb';

const HUBS_FILE = path.join(__dirname, '..', 'config', 'delivery_hubs.json');

export interface DeliveryHub {
  id: string;
  hub_code: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  delivery_radius_km: number;
  is_active: boolean;
  is_paused: boolean;
  pause_reason?: string;
  operating_hours_start: string;
  operating_hours_end: string;
  max_orders_per_slot: number;
  created_at?: string;
  updated_at?: string;
}

export const DEFAULT_APPROVED_HUBS: DeliveryHub[] = [
  {
    id: 'hub-champapet',
    hub_code: 'champapet',
    name: 'Fresh Vegetables Champapet Hub',
    address: 'Flat/House 9-153/4, Raji Reddy Nagar Colony, Champapet, Hyderabad, Telangana - 500059.',
    latitude: 17.34457,
    longitude: 78.516972,
    delivery_radius_km: 5.0,
    is_active: true,
    is_paused: false,
    pause_reason: '',
    operating_hours_start: '06:00',
    operating_hours_end: '22:00',
    max_orders_per_slot: 35,
    created_at: '2026-11-11T00:00:00.000Z',
    updated_at: '2026-11-11T00:00:00.000Z',
  },
  {
    id: 'hub-kphb',
    hub_code: 'kphb',
    name: 'Fresh Vegetables KPHB Hub',
    address: 'Road Number 3, Phase 3, KPHB Colony, Hyderabad, Telangana - 500072.',
    latitude: 17.48942,
    longitude: 78.397227,
    delivery_radius_km: 5.0,
    is_active: true,
    is_paused: false,
    pause_reason: '',
    operating_hours_start: '06:00',
    operating_hours_end: '22:00',
    max_orders_per_slot: 35,
    created_at: '2026-11-11T00:00:00.000Z',
    updated_at: '2026-11-11T00:00:00.000Z',
  },
];

export function readHubsFromFile(): DeliveryHub[] | null {
  try {
    if (fs.existsSync(HUBS_FILE)) {
      const data = fs.readFileSync(HUBS_FILE, 'utf8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((h: any) => ({
          ...h,
          // Strictly cap maximum delivery radius at 5.0 KM
          delivery_radius_km: Math.min(5.0, Math.max(0.5, Number(h.delivery_radius_km || 5.0))),
          latitude: Number(h.latitude),
          longitude: Number(h.longitude),
          is_active: h.is_active !== false,
          is_paused: Boolean(h.is_paused),
        }));
      }
    }
  } catch (err) {
    console.error('Failed reading delivery_hubs.json:', err);
  }
  return null;
}

export function writeHubsToFile(hubs: DeliveryHub[]): void {
  try {
    fs.writeFileSync(HUBS_FILE, JSON.stringify(hubs, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed writing delivery_hubs.json:', err);
  }
}

export function getPersistedHubs(): DeliveryHub[] {
  const fromFile = readHubsFromFile();
  if (fromFile && fromFile.length > 0) {
    (memoryStore as any).delivery_hubs = fromFile;
    return fromFile;
  }
  if ((memoryStore as any).delivery_hubs && (memoryStore as any).delivery_hubs.length > 0) {
    writeHubsToFile((memoryStore as any).delivery_hubs);
    return (memoryStore as any).delivery_hubs;
  }
  (memoryStore as any).delivery_hubs = DEFAULT_APPROVED_HUBS;
  writeHubsToFile(DEFAULT_APPROVED_HUBS);
  return DEFAULT_APPROVED_HUBS;
}

export function getActiveHubs(): DeliveryHub[] {
  return getPersistedHubs().filter((h) => h.is_active !== false);
}

export function getHubById(id: string): DeliveryHub | null {
  const hubs = getPersistedHubs();
  return hubs.find((h) => h.id === id) || null;
}

export function getHubByCode(code: string): DeliveryHub | null {
  const hubs = getPersistedHubs();
  const clean = String(code || '').toLowerCase().trim();
  return hubs.find((h) => h.hub_code.toLowerCase() === clean) || null;
}

export function upsertHub(hub: DeliveryHub): DeliveryHub {
  const hubs = getPersistedHubs();
  const cappedRadius = Math.min(5.0, Math.max(0.5, Number(hub.delivery_radius_km || 5.0)));
  const normalized: DeliveryHub = {
    ...hub,
    delivery_radius_km: cappedRadius,
    latitude: Number(hub.latitude),
    longitude: Number(hub.longitude),
    updated_at: new Date().toISOString(),
  };

  const existingIdx = hubs.findIndex((h) => h.id === hub.id || h.hub_code === hub.hub_code);
  if (existingIdx >= 0) {
    hubs[existingIdx] = {
      ...hubs[existingIdx],
      ...normalized,
    };
  } else {
    hubs.push({
      ...normalized,
      created_at: normalized.created_at || new Date().toISOString(),
    });
  }

  (memoryStore as any).delivery_hubs = hubs;
  writeHubsToFile(hubs);
  return normalized;
}

export function updateHub(id: string, updates: Partial<DeliveryHub>): DeliveryHub | null {
  const hubs = getPersistedHubs();
  const idx = hubs.findIndex((h) => h.id === id);
  if (idx < 0) return null;

  const current = hubs[idx];
  const radius = updates.delivery_radius_km !== undefined
    ? Math.min(5.0, Math.max(0.5, Number(updates.delivery_radius_km)))
    : current.delivery_radius_km;

  const updated: DeliveryHub = {
    ...current,
    ...updates,
    delivery_radius_km: radius,
    latitude: updates.latitude !== undefined ? Number(updates.latitude) : current.latitude,
    longitude: updates.longitude !== undefined ? Number(updates.longitude) : current.longitude,
    updated_at: new Date().toISOString(),
  };

  hubs[idx] = updated;
  (memoryStore as any).delivery_hubs = hubs;
  writeHubsToFile(hubs);
  return updated;
}

