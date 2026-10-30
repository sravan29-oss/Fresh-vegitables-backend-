import { getPersistedDeliverySettings, StoreDeliverySettings } from './deliverySettings.service';

/**
 * Calculates straight-line distance in kilometres between two geographic coordinates
 * using the Haversine formula.
 */
export function calculateHaversineDistanceKm(
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
  const distance = R * c;

  // Round to 2 decimal places for consistency and avoid floating point inaccuracies
  return Number(distance.toFixed(2));
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
  radiusKm: number;
  message: string;
  hubName?: string;
  hubAddress?: string;
}

/**
 * Evaluates whether a given delivery coordinate is serviceable based on the configured delivery hub.
 * Follows strict safety rules:
 * - Until valid hub coordinates are configured, fails safely (not serviceable).
 * - Distance <= configured radius: serviceable.
 * - Distance > configured radius: not serviceable.
 */
export function checkServiceability(
  customerLat: number,
  customerLng: number,
  customSettings?: StoreDeliverySettings
): ServiceabilityResult {
  const settings = customSettings || getPersistedDeliverySettings();
  const radiusKm = Number(settings.delivery_radius_km) > 0 ? Number(settings.delivery_radius_km) : 5.0;

  const hubLat = settings.hub_latitude !== undefined && settings.hub_latitude !== null ? Number(settings.hub_latitude) : null;
  const hubLng = settings.hub_longitude !== undefined && settings.hub_longitude !== null ? Number(settings.hub_longitude) : null;
  const isEnabled = settings.serviceability_enabled !== false;

  // 1. Fail safe if hub coordinates are not configured or serviceability disabled
  if (hubLat === null || hubLng === null || !isValidCoordinate(hubLat, hubLng) || !isEnabled) {
    return {
      configured: false,
      serviceable: false,
      radiusKm,
      message: 'Delivery availability is being configured. Please try again shortly.',
      hubName: settings.hub_name || 'Central Delivery Hub',
    };
  }

  // 2. Validate customer coordinates
  if (!isValidCoordinate(customerLat, customerLng)) {
    return {
      configured: true,
      serviceable: false,
      radiusKm,
      message: 'Invalid delivery coordinates provided. Please select a valid location.',
      hubName: settings.hub_name || 'Central Delivery Hub',
    };
  }

  // 3. Compute distance using Haversine formula
  const distanceKm = calculateHaversineDistanceKm(hubLat, hubLng, Number(customerLat), Number(customerLng));

  // Small epsilon (0.001 km / 1 metre) to accommodate boundary float precision (e.g. exactly 5.0 km)
  const isWithinRadius = distanceKm <= radiusKm + 0.001;

  if (isWithinRadius) {
    return {
      configured: true,
      serviceable: true,
      distanceKm,
      radiusKm,
      message: 'Delivery available at your location.',
      hubName: settings.hub_name || 'Central Delivery Hub',
      hubAddress: settings.hub_address || '',
    };
  }

  return {
    configured: true,
    serviceable: false,
    distanceKm,
    radiusKm,
    message: 'Sorry, we are currently unavailable in your area. Please choose a different location.',
    hubName: settings.hub_name || 'Central Delivery Hub',
    hubAddress: settings.hub_address || '',
  };
}

