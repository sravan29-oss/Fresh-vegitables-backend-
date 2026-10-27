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

export function getPersistedDeliverySettings(): StoreDeliverySettings {
  const fromFile = readSettingsFromFile();
  if (fromFile) {
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
  };
  writeSettingsToFile(fallback);
  (memoryStore as any).delivery_settings = fallback;
  return fallback;
}

export function savePersistedDeliverySettings(partial: Partial<StoreDeliverySettings>): StoreDeliverySettings {
  const current = getPersistedDeliverySettings();
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
    updated_at: new Date().toISOString(),
  };

  writeSettingsToFile(updated);
  (memoryStore as any).delivery_settings = updated;
  return updated;
}
