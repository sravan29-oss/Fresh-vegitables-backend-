import fs from 'fs';
import path from 'path';

const SETTINGS_FILE = path.join(__dirname, '..', 'config', 'payment_settings.json');

export interface StorePaymentSettings {
  id: string;
  cod_enabled: boolean;
  cod_message: string;
  cod_min_amount: number;
  cod_max_amount: number;
  cod_fee: number;
  online_enabled: boolean;
  online_gateway_name: string;
  online_message: string;
  updated_by?: string;
  updated_at: string;
}

const DEFAULT_SETTINGS: StorePaymentSettings = {
  id: 'global_payment_settings',
  cod_enabled: true,
  cod_message: 'Pay with cash or UPI QR upon delivery',
  cod_min_amount: 0,
  cod_max_amount: 5000,
  cod_fee: 0,
  online_enabled: true,
  online_gateway_name: 'Razorpay / Cards & UPI',
  online_message: 'Pay securely using UPI (GPay, PhonePe, Paytm), Credit/Debit Cards, or NetBanking',
  updated_by: 'system',
  updated_at: new Date().toISOString(),
};

let cachedSettings: StorePaymentSettings | null = null;

export function readPaymentSettingsFromFile(): StorePaymentSettings | null {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
      const parsed = JSON.parse(data);
      if (parsed && typeof parsed.cod_enabled === 'boolean' && typeof parsed.online_enabled === 'boolean') {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Failed reading payment_settings.json:', err);
  }
  return null;
}

export function writePaymentSettingsToFile(settings: StorePaymentSettings): void {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed writing payment_settings.json:', err);
  }
}

export function getPersistedPaymentSettings(): StorePaymentSettings {
  if (cachedSettings) {
    return cachedSettings;
  }
  const fromFile = readPaymentSettingsFromFile();
  if (fromFile) {
    cachedSettings = fromFile;
    return cachedSettings;
  }
  cachedSettings = { ...DEFAULT_SETTINGS };
  writePaymentSettingsToFile(cachedSettings);
  return cachedSettings;
}

export function validatePaymentSettings(settings: Partial<StorePaymentSettings>): { isValid: boolean; error?: string } {
  if (settings.cod_min_amount !== undefined && Number(settings.cod_min_amount) < 0) {
    return { isValid: false, error: 'Minimum order amount for COD cannot be negative' };
  }
  if (settings.cod_max_amount !== undefined && Number(settings.cod_max_amount) < 0) {
    return { isValid: false, error: 'Maximum order amount for COD cannot be negative' };
  }
  if (
    settings.cod_min_amount !== undefined &&
    settings.cod_max_amount !== undefined &&
    Number(settings.cod_max_amount) > 0 &&
    Number(settings.cod_min_amount) > Number(settings.cod_max_amount)
  ) {
    return { isValid: false, error: 'Minimum COD amount cannot exceed Maximum COD limit' };
  }
  if (settings.cod_fee !== undefined && Number(settings.cod_fee) < 0) {
    return { isValid: false, error: 'COD handling fee cannot be negative' };
  }
  return { isValid: true };
}

export function savePersistedPaymentSettings(partial: Partial<StorePaymentSettings>, updatedBy = 'admin'): StorePaymentSettings {
  const current = getPersistedPaymentSettings();
  const updated: StorePaymentSettings = {
    ...current,
    ...partial,
    id: 'global_payment_settings',
    cod_enabled: partial.cod_enabled !== undefined ? Boolean(partial.cod_enabled) : current.cod_enabled,
    cod_message: partial.cod_message !== undefined ? String(partial.cod_message).trim() : current.cod_message,
    cod_min_amount: partial.cod_min_amount !== undefined ? Math.max(0, Number(partial.cod_min_amount)) : current.cod_min_amount,
    cod_max_amount: partial.cod_max_amount !== undefined ? Math.max(0, Number(partial.cod_max_amount)) : current.cod_max_amount,
    cod_fee: partial.cod_fee !== undefined ? Math.max(0, Number(partial.cod_fee)) : current.cod_fee,
    online_enabled: partial.online_enabled !== undefined ? Boolean(partial.online_enabled) : current.online_enabled,
    online_gateway_name: partial.online_gateway_name !== undefined ? String(partial.online_gateway_name).trim() : current.online_gateway_name,
    online_message: partial.online_message !== undefined ? String(partial.online_message).trim() : current.online_message,
    updated_by: updatedBy,
    updated_at: new Date().toISOString(),
  };

  cachedSettings = updated;
  writePaymentSettingsToFile(updated);
  return updated;
}
