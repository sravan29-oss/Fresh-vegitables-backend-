import { getPersistedDeliverySettings, StoreDeliverySettings } from './deliverySettings.service';

/**
 * Calculates raw, unrounded straight-line distance in kilometres between two geographic coordinates
 * using the Haversine formula.
 */
export function calculateExactHaversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const R = 6371; // Earth's mean radius in kilometres

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculates straight-line distance in kilometres rounded to 2 decimal places for user display.
 */
export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const rawDistance = calculateExactHaversineKm(lat1, lon1, lat2, lon2);
  return Number(rawDistance.toFixed(2));
}

export function isValidCoordinate(latitude: any, longitude: any): boolean {
  if (
    latitude === undefined ||
    latitude === null ||
    longitude === undefined ||
    longitude === null
  ) {
    return false;
  }
  const lat = Number(latitude);
  const lng = Number(longitude);

  if (isNaN(lat) || !isFinite(lat) || lat < -90 || lat > 90) return false;
  if (isNaN(lng) || !isFinite(lng) || lng < -180 || lng > 180) return false;

  return true;
}

export interface ServiceabilityResult {
  configured: boolean;
  serviceable: boolean;
  distanceKm?: number;
  rawDistanceKm?: number;
  radiusKm: number;
  message: string;
  hubName?: string;
  hubAddress?: string;
}

/**
 * Evaluates whether a given delivery coordinate is serviceable based on the configured delivery hub.
 * STRICT PRODUCTION RULES:
 * - Distance <= 5.0 KM: potentially serviceable, subject to area and delivery availability.
 * - Distance > 5.0 KM: NOT SERVICEABLE.
 * - NEVER round distance before comparing with 5.0 KM!
 * - Never pad with epsilon tolerance.
 */
export function checkServiceability(
  customerLat: number,
  customerLng: number,
  customSettings?: StoreDeliverySettings
): ServiceabilityResult {
  const settings = customSettings || getPersistedDeliverySettings();
  const radiusKm = Number(settings.delivery_radius_km) > 0 ? Number(settings.delivery_radius_km) : 5.0;

  // Authoritative default Champapet hub coordinates if undefined, but respect explicit null as unconfigured
  const hubLat = settings.hub_latitude === null
    ? null
    : (settings.hub_latitude !== undefined ? Number(settings.hub_latitude) : 17.34457);
  const hubLng = settings.hub_longitude === null
    ? null
    : (settings.hub_longitude !== undefined ? Number(settings.hub_longitude) : 78.516972);
  const isEnabled = settings.serviceability_enabled !== false;

  // 1. Fail safe if hub coordinates are not configured or serviceability disabled
  if (hubLat === null || hubLng === null || !isValidCoordinate(hubLat, hubLng) || !isEnabled) {
    return {
      configured: false,
      serviceable: false,
      radiusKm,
      message: 'Delivery availability is being configured. Please try again shortly.',
      hubName: settings.hub_name || 'Fresh Vegetables Champapet Hub',
      hubAddress: settings.hub_address || 'Flat/House 9-153/4 Raji reddy nagar colony, Champapet, Hyderabad, Telangana - 500059',
    };
  }

  // 2. Validate customer coordinates
  if (!isValidCoordinate(customerLat, customerLng)) {
    return {
      configured: true,
      serviceable: false,
      radiusKm,
      message: 'Invalid delivery coordinates provided. Please select a valid location.',
      hubName: settings.hub_name || 'Fresh Vegetables Champapet Hub',
      hubAddress: settings.hub_address || 'Flat/House 9-153/4 Raji reddy nagar colony, Champapet, Hyderabad, Telangana - 500059',
    };
  }

  // 3. Compute UNROUNDED distance using exact Haversine formula
  const rawDistance = calculateExactHaversineKm(hubLat, hubLng, Number(customerLat), Number(customerLng));
  const distanceKm = Number(rawDistance.toFixed(2));

  // 4. STRICT COMPARISON: Distance must be strictly <= radiusKm (5.0 KM)
  // Distance > 5.0 KM is ALWAYS NOT SERVICEABLE
  const isWithinRadius = rawDistance <= radiusKm;

  if (isWithinRadius) {
    return {
      configured: true,
      serviceable: true,
      distanceKm,
      rawDistanceKm: rawDistance,
      radiusKm,
      message: 'Delivery available at your location.',
      hubName: settings.hub_name || 'Fresh Vegetables Champapet Hub',
      hubAddress: settings.hub_address || 'Flat/House 9-153/4 Raji reddy nagar colony, Champapet, Hyderabad, Telangana - 500059',
    };
  }

  return {
    configured: true,
    serviceable: false,
    distanceKm,
    rawDistanceKm: rawDistance,
    radiusKm,
    message: 'Sorry! Delivery is not available at this location.',
    hubName: settings.hub_name || 'Fresh Vegetables Champapet Hub',
    hubAddress: settings.hub_address || 'Flat/House 9-153/4 Raji reddy nagar colony, Champapet, Hyderabad, Telangana - 500059',
  };
}
