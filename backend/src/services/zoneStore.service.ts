import fs from 'fs';
import path from 'path';
import { memoryStore } from '../config/mockDb';

const ZONES_FILE = path.join(__dirname, '..', 'config', 'delivery_zones.json');

export interface DeliveryZoneItem {
  id: string;
  name: string;
  pincodes: string[];
  delivery_radius_km: number;
  delivery_fee: number;
  min_order_amount: number;
  free_delivery_threshold: number;
  estimated_delivery_time: string;
  min_eta_minutes?: number;
  max_eta_minutes?: number;
  priority?: 'high' | 'medium' | 'normal';
  daily_open_time?: string;
  daily_close_time?: string;
  max_capacity_per_slot?: number;
  current_orders_in_slot?: number;
  is_paused?: boolean;
  pause_reason?: string;
  status: string;
  latitude: number;
  longitude: number;
  created_at?: string;
  updated_at?: string;
}

const DEFAULT_FALLBACK_ZONES: DeliveryZoneItem[] = [
  {
    id: 'zone-champapet',
    name: 'Champapet & Saroornagar Zone',
    pincodes: ['500059', '500079', '500035', '500060'],
    delivery_radius_km: 5.0,
    delivery_fee: 10.0,
    min_order_amount: 10.0,
    free_delivery_threshold: 99.0,
    estimated_delivery_time: '30–45 min',
    min_eta_minutes: 30,
    max_eta_minutes: 45,
    priority: 'high',
    daily_open_time: '06:00',
    daily_close_time: '22:00',
    max_capacity_per_slot: 35,
    is_paused: false,
    status: 'ACTIVE',
    latitude: 17.34457,
    longitude: 78.516972,
  },
  {
    id: 'zone-kphb',
    name: 'Kukatpally & KPHB Zone',
    pincodes: ['500072', '500085', '500090', '500018', '500038'],
    delivery_radius_km: 5.0,
    delivery_fee: 20.0,
    min_order_amount: 10.0,
    free_delivery_threshold: 199.0,
    estimated_delivery_time: '45–60 min',
    min_eta_minutes: 45,
    max_eta_minutes: 60,
    priority: 'medium',
    daily_open_time: '06:00',
    daily_close_time: '22:00',
    max_capacity_per_slot: 25,
    is_paused: false,
    status: 'ACTIVE',
    latitude: 17.4938,
    longitude: 78.3995,
  },
  {
    id: 'zone-hitech',
    name: 'Hitech City, Madhapur & Gachibowli',
    pincodes: ['500081', '500032', '500084', '500046', '500033'],
    delivery_radius_km: 5.0,
    delivery_fee: 25.0,
    min_order_amount: 10.0,
    free_delivery_threshold: 199.0,
    estimated_delivery_time: '40–50 min',
    min_eta_minutes: 40,
    max_eta_minutes: 50,
    priority: 'medium',
    daily_open_time: '06:00',
    daily_close_time: '22:00',
    max_capacity_per_slot: 25,
    is_paused: false,
    status: 'ACTIVE',
    latitude: 17.4474,
    longitude: 78.3762,
  },
  {
    id: 'zone-miyapur',
    name: 'Miyapur, Chandanagar & BHEL',
    pincodes: ['500049', '500050', '500019', '502032'],
    delivery_radius_km: 5.0,
    delivery_fee: 25.0,
    min_order_amount: 10.0,
    free_delivery_threshold: 199.0,
    estimated_delivery_time: '45–60 min',
    min_eta_minutes: 45,
    max_eta_minutes: 60,
    priority: 'normal',
    daily_open_time: '06:00',
    daily_close_time: '22:00',
    max_capacity_per_slot: 20,
    is_paused: false,
    status: 'ACTIVE',
    latitude: 17.4968,
    longitude: 78.3547,
  },
];

export function readZonesFromFile(): DeliveryZoneItem[] | null {
  try {
    if (fs.existsSync(ZONES_FILE)) {
      const data = fs.readFileSync(ZONES_FILE, 'utf8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((z: any) => ({
          ...z,
          delivery_radius_km: Math.min(5.0, Number(z.delivery_radius_km || 5.0)),
        }));
      }
    }
  } catch (err) {
    console.error('Failed reading delivery_zones.json:', err);
  }
  return null;
}

export function writeZonesToFile(zones: DeliveryZoneItem[]): void {
  try {
    fs.writeFileSync(ZONES_FILE, JSON.stringify(zones, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed writing delivery_zones.json:', err);
  }
}

export function getPersistedZones(): DeliveryZoneItem[] {
  const fromFile = readZonesFromFile();
  if (fromFile && fromFile.length > 0) {
    (memoryStore as any).delivery_zones = fromFile;
    return fromFile;
  }
  if ((memoryStore as any).delivery_zones && (memoryStore as any).delivery_zones.length > 0) {
    writeZonesToFile((memoryStore as any).delivery_zones);
    return (memoryStore as any).delivery_zones;
  }
  (memoryStore as any).delivery_zones = DEFAULT_FALLBACK_ZONES;
  writeZonesToFile(DEFAULT_FALLBACK_ZONES);
  return DEFAULT_FALLBACK_ZONES;
}

export function savePersistedZones(zones: DeliveryZoneItem[]): DeliveryZoneItem[] {
  (memoryStore as any).delivery_zones = zones;
  writeZonesToFile(zones);
  return zones;
}
