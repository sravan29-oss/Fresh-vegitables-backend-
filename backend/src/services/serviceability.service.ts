import { getPersistedDeliverySettings, StoreDeliverySettings } from './deliverySettings.service';
import { getPersistedHubs, DeliveryHub } from './hubStore.service';

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

export interface HubEvaluation {
  hub: DeliveryHub;
  distanceKm: number;
  rawDistanceKm: number;
  radiusKm: number;
  isWithinRadius: boolean;
  isActive: boolean;
  isPaused: boolean;
  isEligible: boolean;
  ineligibilityReason?: string;
}

export interface ServiceabilityResult {
  configured: boolean;
  serviceable: boolean;
  requiresVerification?: boolean;
  distanceKm?: number;
  rawDistanceKm?: number;
  radiusKm: number;
  message: string;
  hubName?: string;
  hubAddress?: string;
  // Two-hub enhancements
  assignedHub?: DeliveryHub;
  assigned_hub_id?: string;
  assigned_hub_code?: string;
  assigned_hub_name?: string;
  assigned_hub_address?: string;
  eligibleHubs?: HubEvaluation[];
  allHubEvaluations?: HubEvaluation[];
}

/**
 * Evaluates delivery serviceability across ALL authorized fulfillment hubs.
 *
 * STRICT PRODUCTION RULES:
 * 1. Customer coordinates must be valid.
 * 2. Unrounded Haversine distance is calculated against every active hub.
 * 3. A hub is ELIGIBLE only if unrounded distance <= hub.delivery_radius_km (strictly capped at 5.0 KM).
 * 4. Inactive or paused hubs are excluded from fulfillment eligibility.
 * 5. If multiple hubs are eligible (overlapping boundary), the nearest eligible hub is assigned.
 * 6. Deterministic tie-breaker: If two hubs have equal distance within 1 metre (0.001 km), sort by hub_code ascending.
 * 7. Zones NEVER expand the coverage of a hub.
 */
export function checkMultiHubServiceability(
  customerLat: number,
  customerLng: number,
  options?: {
    hubs?: DeliveryHub[];
    fallbackSettings?: StoreDeliverySettings;
  }
): ServiceabilityResult {
  const hubs = options?.hubs && options.hubs.length > 0 ? options.hubs : getPersistedHubs();
  const settings = options?.fallbackSettings || getPersistedDeliverySettings();
  const isGlobalEnabled = settings.serviceability_enabled !== false;

  // 1. Fail-safe if coordinates are invalid or missing
  if (!isValidCoordinate(customerLat, customerLng)) {
    return {
      configured: true,
      serviceable: false,
      requiresVerification: true,
      radiusKm: 5.0,
      message: 'Delivery address requires verified geographic coordinates. Please select an exact location on the map.',
      hubName: hubs[0]?.name || 'Fresh Vegetables Central Hub',
      hubAddress: hubs[0]?.address || '',
      eligibleHubs: [],
      allHubEvaluations: [],
    };
  }

  // 2. Fail-safe if no hubs exist or global serviceability disabled
  if (!hubs || hubs.length === 0 || !isGlobalEnabled) {
    return {
      configured: false,
      serviceable: false,
      radiusKm: 5.0,
      message: 'Delivery availability is being configured. Please try again shortly.',
      hubName: settings.hub_name || 'Fresh Vegetables Central Hub',
      hubAddress: settings.hub_address || '',
      eligibleHubs: [],
      allHubEvaluations: [],
    };
  }

  const evaluations: HubEvaluation[] = [];

  for (const hub of hubs) {
    if (!isValidCoordinate(hub.latitude, hub.longitude)) {
      continue;
    }

    const rawDistance = calculateExactHaversineKm(
      Number(hub.latitude),
      Number(hub.longitude),
      Number(customerLat),
      Number(customerLng)
    );
    const distanceKm = Number(rawDistance.toFixed(2));
    const radiusKm = Math.min(5.0, Math.max(0.5, Number(hub.delivery_radius_km || 5.0)));
    const isWithinRadius = rawDistance <= radiusKm;
    const isActive = hub.is_active !== false;
    const isPaused = Boolean(hub.is_paused);

    let ineligibilityReason: string | undefined;
    if (!isActive) {
      ineligibilityReason = 'Hub is currently inactive.';
    } else if (isPaused) {
      ineligibilityReason = hub.pause_reason || `Deliveries from ${hub.name} are temporarily paused.`;
    } else if (!isWithinRadius) {
      ineligibilityReason = `Location is ${distanceKm} km away (maximum radius: ${radiusKm} KM).`;
    }

    const isEligible = isWithinRadius && isActive && !isPaused;

    evaluations.push({
      hub,
      distanceKm,
      rawDistanceKm: rawDistance,
      radiusKm,
      isWithinRadius,
      isActive,
      isPaused,
      isEligible,
      ineligibilityReason,
    });
  }

  // Sort eligible hubs:
  // Primary: raw distance ascending (nearest first)
  // Tie-breaker: alphabetical by hub_code ascending if distances match within 0.001 km (1 metre)
  const eligibleHubs = evaluations
    .filter((e) => e.isEligible)
    .sort((a, b) => {
      const distDiff = a.rawDistanceKm - b.rawDistanceKm;
      if (Math.abs(distDiff) < 0.001) {
        return a.hub.hub_code.localeCompare(b.hub.hub_code);
      }
      return distDiff;
    });

  // SUCCESS: Customer is within delivery range of at least one eligible hub
  if (eligibleHubs.length > 0) {
    const assigned = eligibleHubs[0];
    return {
      configured: true,
      serviceable: true,
      distanceKm: assigned.distanceKm,
      rawDistanceKm: assigned.rawDistanceKm,
      radiusKm: assigned.radiusKm,
      message: 'Great! Delivery is available at your location.',
      hubName: assigned.hub.name,
      hubAddress: assigned.hub.address,
      assignedHub: assigned.hub,
      assigned_hub_id: assigned.hub.id,
      assigned_hub_code: assigned.hub.hub_code,
      assigned_hub_name: assigned.hub.name,
      assigned_hub_address: assigned.hub.address,
      eligibleHubs,
      allHubEvaluations: evaluations,
    };
  }

  // REJECTION: Identify nearest hub for informative feedback
  const sortedAll = [...evaluations].sort((a, b) => a.rawDistanceKm - b.rawDistanceKm);
  const nearest = sortedAll[0];

  let rejectMessage = 'Sorry! We are not delivering to your location yet.';
  if (nearest) {
    if (nearest.isWithinRadius && nearest.isPaused) {
      rejectMessage = nearest.hub.pause_reason || `Deliveries from ${nearest.hub.name} are temporarily paused.`;
    } else if (nearest.isWithinRadius && !nearest.isActive) {
      rejectMessage = `${nearest.hub.name} is currently inactive.`;
    }
  }

  return {
    configured: true,
    serviceable: false,
    distanceKm: nearest?.distanceKm,
    rawDistanceKm: nearest?.rawDistanceKm,
    radiusKm: nearest?.radiusKm || 5.0,
    message: rejectMessage,
    hubName: nearest?.hub.name || settings.hub_name || 'Fresh Vegetables Central Hub',
    hubAddress: nearest?.hub.address || settings.hub_address || '',
    assignedHub: undefined,
    assigned_hub_id: undefined,
    assigned_hub_code: undefined,
    assigned_hub_name: undefined,
    assigned_hub_address: undefined,
    eligibleHubs: [],
    allHubEvaluations: evaluations,
  };
}

/**
 * Backward-compatible serviceability check.
 * Defaults to multi-hub evaluation across all configured hubs, or respects explicit customSettings overrides.
 */
export function checkServiceability(
  customerLat: number,
  customerLng: number,
  customSettings?: StoreDeliverySettings,
  customHubs?: DeliveryHub[]
): ServiceabilityResult {
  // If customSettings is explicitly supplied with hub coordinates or disabled flag (e.g. in unit tests or admin overrides)
  if (customSettings && (customSettings.hub_latitude !== undefined || customSettings.serviceability_enabled !== undefined)) {
    if (
      customSettings.hub_latitude === null ||
      customSettings.hub_longitude === null ||
      customSettings.serviceability_enabled === false
    ) {
      return {
        configured: false,
        serviceable: false,
        radiusKm: Number(customSettings.delivery_radius_km) || 5.0,
        message: 'Delivery availability is being configured. Please try again shortly.',
        hubName: customSettings.hub_name || 'Fresh Vegetables Central Hub',
        hubAddress: customSettings.hub_address || '',
      };
    }

    if (customSettings.hub_latitude !== undefined && customSettings.hub_longitude !== undefined) {
      const singleHub: DeliveryHub = {
        id: 'single-hub',
        hub_code: 'single',
        name: customSettings.hub_name || 'Fresh Vegetables Central Hub',
        address: customSettings.hub_address || '',
        latitude: Number(customSettings.hub_latitude),
        longitude: Number(customSettings.hub_longitude),
        delivery_radius_km: Math.min(5.0, Number(customSettings.delivery_radius_km || 5.0)),
        is_active: true,
        is_paused: false,
        operating_hours_start: '06:00',
        operating_hours_end: '22:00',
        max_orders_per_slot: 35,
      };
      return checkMultiHubServiceability(customerLat, customerLng, {
        hubs: [singleHub],
        fallbackSettings: customSettings,
      });
    }
  }

  return checkMultiHubServiceability(customerLat, customerLng, {
    hubs: customHubs,
    fallbackSettings: customSettings,
  });
}
