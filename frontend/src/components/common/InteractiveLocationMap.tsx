import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import {
  Search,
  Navigation,
  MapPin,
  Compass,
  CheckCircle2,
  Clock,
  Layers,
  Sparkles,
  Loader2,
  X,
} from 'lucide-react';
import { DeliveryZone } from '../../types';
import { HYDERABAD_COLONIES, HyderabadArea } from '../../data/hyderabadColonies';

export interface AddressDetails {
  colony?: string;
  area?: string;
  pincode?: string;
  fullAddress?: string;
  latitude: number;
  longitude: number;
  matchedZone?: DeliveryZone | null;
}

interface InteractiveLocationMapProps {
  initialCenter?: [number, number];
  zoom?: number;
  markerPosition?: [number, number] | null;
  onPositionChange: (lat: number, lng: number, details?: AddressDetails) => void;
  zones?: DeliveryZone[];
  selectedZoneId?: string | null;
  interactive?: boolean;
  circleRadiusKm?: number; // For admin zone geofence preview
  height?: string;
  showSearchBar?: boolean;
  showDetectLocationBtn?: boolean;
  placeholder?: string;
}

export const InteractiveLocationMap: React.FC<InteractiveLocationMapProps> = ({
  initialCenter = [17.4474, 78.3762], // Hyderabad central IT corridor
  zoom = 13,
  markerPosition,
  onPositionChange,
  zones = [],
  selectedZoneId,
  interactive = true,
  circleRadiusKm,
  height = '360px',
  showSearchBar = true,
  showDetectLocationBtn = true,
  placeholder = 'Search Colony, Area or Landmark in Hyderabad...',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const adminCircleRef = useRef<L.Circle | null>(null);
  const zonesLayerGroupRef = useRef<L.LayerGroup | null>(null);

  const [currentCoords, setCurrentCoords] = useState<[number, number]>(
    markerPosition || initialCenter
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<HyderabadArea[]>([]);
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);

  // Helper: Find closest or matched zone
  const matchZone = useCallback(
    (lat: number, lng: number, pincode?: string): DeliveryZone | null => {
      // 1. Match by pincode if available
      if (pincode && zones.length > 0) {
        const found = zones.find(
          (z) => Array.isArray(z.pincodes) && z.pincodes.includes(pincode.trim())
        );
        if (found) return found;
      }

      // 2. Match by geographic distance within zone radius
      const toRad = (d: number) => (d * Math.PI) / 180;
      const R = 6371; // km
      let bestZone: DeliveryZone | null = null;
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
            bestZone = z;
          }
        }
      }

      return bestZone || (zones.length > 0 ? zones[0] : null);
    },
    [zones]
  );

  // Reverse Geocoding with OpenStreetMap Nominatim and local directory fallback
  const reverseGeocode = useCallback(
    async (lat: number, lng: number) => {
      const roundedLat = Number(lat.toFixed(6));
      const roundedLng = Number(lng.toFixed(6));

      // 1. Fetch exact street/colony/area from OpenStreetMap Nominatim
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${roundedLat}&lon=${roundedLng}&zoom=18&addressdetails=1`,
          { headers: { 'Accept-Language': 'en' } }
        );
        const data = await res.json();
        if (data?.address) {
          const addr = data.address;
          const colony =
            addr.suburb ||
            addr.neighbourhood ||
            addr.residential ||
            addr.quarter ||
            addr.road ||
            addr.village ||
            'Hyderabad Colony';
          const area = addr.city_district || addr.county || addr.city || 'Hyderabad';
          const pincode = addr.postcode || '';
          const full = data.display_name
            ? data.display_name.split(',').slice(0, 3).join(', ')
            : `${colony}, ${area}`;

          const matched = matchZone(roundedLat, roundedLng, pincode);
          const details: AddressDetails = {
            colony,
            area,
            pincode,
            fullAddress: full,
            latitude: roundedLat,
            longitude: roundedLng,
            matchedZone: matched,
          };
          setResolvedAddress(full);
          onPositionChange(roundedLat, roundedLng, details);
          return;
        }
      } catch (e) {
        // Fallback to local directory
      }

      // 2. Fallback: Match nearest named reference for labeling
      let closestColony = HYDERABAD_COLONIES[0];
      let minDistance = Infinity;

      for (const col of HYDERABAD_COLONIES) {
        const dist = Math.hypot(col.lat - roundedLat, col.lng - roundedLng);
        if (dist < minDistance) {
          minDistance = dist;
          closestColony = col;
        }
      }

      const matched = matchZone(roundedLat, roundedLng, closestColony.pincode);
      const details: AddressDetails = {
        colony: closestColony.colony,
        area: closestColony.name,
        pincode: closestColony.pincode,
        fullAddress: `${closestColony.colony}, Hyderabad - ${closestColony.pincode}`,
        latitude: roundedLat,
        longitude: roundedLng,
        matchedZone: matched,
      };
      setResolvedAddress(details.fullAddress || null);
      onPositionChange(roundedLat, roundedLng, details);
    },
    [matchZone, onPositionChange]
  );

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    // Fix default marker icon assets issue in bundlers
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });

    const map = L.map(mapContainerRef.current, {
      center: currentCoords,
      zoom,
      zoomControl: false,
      attributionControl: false,
    });

    // High-resolution clean OpenStreetMap Standard Tiles (100% Free, No API Key Required)
    L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        maxZoom: 19,
        subdomains: ['a', 'b', 'c'],
        attribution: '&copy; OpenStreetMap contributors',
      }
    ).addTo(map);

    // Zoom control in bottom right
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Neon Emerald Custom Marker Pin
    const customIcon = L.divIcon({
      className: 'custom-leaflet-pin',
      html: `
        <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 44px; height: 44px;">
          <div style="position: absolute; width: 40px; height: 40px; border-radius: 9999px; background: rgba(52, 211, 153, 0.35); animation: pingSlow 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="width: 34px; height: 34px; border-radius: 9999px; background: #061c11; border: 2.5px solid #10b981; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.5); z-index: 10;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
          </div>
        </div>
      `,
      iconSize: [44, 44],
      iconAnchor: [22, 38],
    });

    const marker = L.marker(currentCoords, {
      icon: customIcon,
      draggable: interactive,
    }).addTo(map);

    markerRef.current = marker;

    // Click on map to position pin
    if (interactive) {
      map.on('click', (e) => {
        const { lat, lng } = e.latlng;
        const roundedLat = Number(lat.toFixed(6));
        const roundedLng = Number(lng.toFixed(6));
        marker.setLatLng([roundedLat, roundedLng]);
        setCurrentCoords([roundedLat, roundedLng]);
        if (adminCircleRef.current) {
          adminCircleRef.current.setLatLng([roundedLat, roundedLng]);
        }
        reverseGeocode(roundedLat, roundedLng);
      });

      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        const roundedLat = Number(pos.lat.toFixed(6));
        const roundedLng = Number(pos.lng.toFixed(6));
        setCurrentCoords([roundedLat, roundedLng]);
        if (adminCircleRef.current) {
          adminCircleRef.current.setLatLng([roundedLat, roundedLng]);
        }
        reverseGeocode(roundedLat, roundedLng);
      });
    }

    // Layer group for active delivery zones
    const zonesGroup = L.layerGroup().addTo(map);
    zonesLayerGroupRef.current = zonesGroup;

    mapInstanceRef.current = map;

    // Trigger initial reverse geocode
    reverseGeocode(currentCoords[0], currentCoords[1]);

    const resizeTimer = setTimeout(() => {
      map.invalidateSize();
    }, 250);

    return () => {
      clearTimeout(resizeTimer);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Sync markerPosition prop if changed externally
  useEffect(() => {
    if (markerPosition && mapInstanceRef.current && markerRef.current) {
      const [lat, lng] = markerPosition;
      if (Math.abs(lat - currentCoords[0]) > 0.0001 || Math.abs(lng - currentCoords[1]) > 0.0001) {
        const roundedLat = Number(lat.toFixed(6));
        const roundedLng = Number(lng.toFixed(6));
        markerRef.current.setLatLng([roundedLat, roundedLng]);
        mapInstanceRef.current.panTo([roundedLat, roundedLng]);
        setCurrentCoords([roundedLat, roundedLng]);
        if (adminCircleRef.current) {
          adminCircleRef.current.setLatLng([roundedLat, roundedLng]);
        }
      }
    }
  }, [markerPosition]);

  // Update Zones Geofence Circles on map
  useEffect(() => {
    if (!mapInstanceRef.current || !zonesLayerGroupRef.current) return;
    const group = zonesLayerGroupRef.current;
    group.clearLayers();

    zones.forEach((zone) => {
      if (zone.latitude && zone.longitude) {
        const isSelected = selectedZoneId === zone.id;
        const radiusMeters = (Number(zone.delivery_radius_km) || 8.5) * 1000;

        const circle = L.circle([zone.latitude, zone.longitude], {
          radius: radiusMeters,
          color: isSelected ? '#10b981' : '#059669',
          weight: isSelected ? 2.5 : 1.5,
          opacity: 0.8,
          fillColor: isSelected ? '#34d399' : '#10b981',
          fillOpacity: isSelected ? 0.16 : 0.08,
          dashArray: isSelected ? '6, 6' : undefined,
        }).addTo(group);

        circle.bindTooltip(
          `<div style="font-family: inherit; font-size: 11px; padding: 2px;">
            <strong style="color: #064e3b;">${zone.name}</strong><br/>
            <span style="color: #047857;">${zone.estimated_delivery_time} • ₹${zone.delivery_fee} Fee</span>
          </div>`,
          {
            permanent: false,
            direction: 'top',
            className: 'zone-tooltip-glass',
          }
        );

        circle.on('click', () => {
          if (markerRef.current && interactive) {
            markerRef.current.setLatLng([zone.latitude!, zone.longitude!]);
            setCurrentCoords([zone.latitude!, zone.longitude!]);
            if (adminCircleRef.current) {
              adminCircleRef.current.setLatLng([zone.latitude!, zone.longitude!]);
            }
            reverseGeocode(zone.latitude!, zone.longitude!);
          }
        });
      }
    });
  }, [zones, selectedZoneId, interactive, reverseGeocode]);

  // Update Admin Geofence Radius Circle in real time
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (adminCircleRef.current) {
      adminCircleRef.current.remove();
      adminCircleRef.current = null;
    }

    if (circleRadiusKm && circleRadiusKm > 0) {
      const centerCoords: [number, number] = markerPosition || currentCoords;
      const circle = L.circle(centerCoords, {
        radius: circleRadiusKm * 1000,
        color: '#10b981',
        weight: 2,
        dashArray: '5, 5',
        fillColor: '#34d399',
        fillOpacity: 0.16,
      }).addTo(map);

      circle.bindTooltip(
        `<div style="font-size: 11px; font-weight: bold; color: #047857; padding: 2px 4px;">Coverage Radius: ${circleRadiusKm} km</div>`,
        { permanent: true, direction: 'right' }
      );

      adminCircleRef.current = circle;
    }
  }, [circleRadiusKm, currentCoords, markerPosition]);

  // Handle colony search input
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (!value.trim()) {
      setSuggestions([]);
      return;
    }

    const val = value.toLowerCase().trim();
    const matched = HYDERABAD_COLONIES.filter(
      (c) =>
        c.name.toLowerCase().includes(val) ||
        c.colony.toLowerCase().includes(val) ||
        c.pincode.includes(val)
    ).slice(0, 6);

    setSuggestions(matched);
  };

  // Jump to selected Hyderabad colony or search result
  const handleSelectColony = (colony: HyderabadArea) => {
    setSearchQuery(colony.name);
    setSuggestions([]);

    if (mapInstanceRef.current && markerRef.current) {
      mapInstanceRef.current.flyTo([colony.lat, colony.lng], 16, { duration: 1.2 });
      markerRef.current.setLatLng([colony.lat, colony.lng]);
      setCurrentCoords([colony.lat, colony.lng]);
      reverseGeocode(colony.lat, colony.lng);
    }
  };

  // Online Nominatim Search fallback if user types an unlisted colony
  const handleOnlineSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearchingOnline(true);
    try {
      const q = encodeURIComponent(`${searchQuery}, Hyderabad, Telangana`);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${q}&limit=4`
      );
      const data = await res.json();
      if (data && data.length > 0) {
        const first = data[0];
        const lat = parseFloat(first.lat);
        const lng = parseFloat(first.lon);

        if (mapInstanceRef.current && markerRef.current) {
          mapInstanceRef.current.flyTo([lat, lng], 16, { duration: 1.2 });
          markerRef.current.setLatLng([lat, lng]);
          setCurrentCoords([lat, lng]);
          reverseGeocode(lat, lng);
        }
        setSuggestions([]);
      }
    } catch (e) {
      // Ignored
    } finally {
      setIsSearchingOnline(false);
    }
  };

  // Detect Live GPS Location
  const handleDetectGPS = () => {
    if (!navigator.geolocation) return;

    setIsDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsDetectingLocation(false);
        const { latitude, longitude } = pos.coords;
        if (mapInstanceRef.current && markerRef.current) {
          mapInstanceRef.current.flyTo([latitude, longitude], 16, { duration: 1.2 });
          markerRef.current.setLatLng([latitude, longitude]);
          setCurrentCoords([latitude, longitude]);
          reverseGeocode(latitude, longitude);
        }
      },
      () => {
        setIsDetectingLocation(false);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  return (
    <div className="relative rounded-2xl overflow-hidden border border-emerald-500/25 bg-[#06180f] shadow-xl flex flex-col">
      {/* ─── Map Search & Location Header ─── */}
      {showSearchBar && (
        <div className="p-3 bg-[#071f13] border-b border-emerald-500/20 relative z-20">
          <form onSubmit={handleOnlineSearch} className="relative">
            <Search className="w-4 h-4 text-emerald-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder={placeholder}
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full h-10 pl-9 pr-24 text-xs sm:text-sm bg-[#04140c] border border-emerald-500/30 focus:border-emerald-400 rounded-xl text-white placeholder:text-emerald-100/40 focus:outline-none focus:ring-1 focus:ring-emerald-400"
            />
            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSuggestions([]);
                  }}
                  className="p-1 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="submit"
                disabled={isSearchingOnline}
                className="h-7 px-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[11px] flex items-center gap-1 transition-all"
              >
                {isSearchingOnline ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <span>Locate</span>
                )}
              </button>
            </div>
          </form>

          {/* Autocomplete Colony Suggestions Dropdown */}
          {suggestions.length > 0 && (
            <div className="absolute left-3 right-3 top-14 bg-[#081e13] border border-emerald-500/30 rounded-xl shadow-2xl overflow-hidden z-50 animate-fade-in max-h-56 overflow-y-auto divide-y divide-emerald-950/60">
              <div className="p-2 text-[10px] font-black uppercase tracking-wider text-emerald-400/80 bg-[#05160d]">
                Hyderabad Colonies &amp; Areas
              </div>
              {suggestions.map((col, idx) => (
                <div
                  key={idx}
                  onClick={() => handleSelectColony(col)}
                  className="p-2.5 hover:bg-emerald-500/15 cursor-pointer transition-colors flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <div>
                      <p className="font-bold text-white leading-tight">{col.name}</p>
                      <p className="text-[11px] text-emerald-200/60">{col.colony}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-300 bg-emerald-500/20 px-1.5 py-0.5 rounded border border-emerald-500/30">
                    {col.pincode}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── Leaflet Map Canvas ─── */}
      <div className="relative w-full" style={{ height }}>
        <div ref={mapContainerRef} className="w-full h-full z-10" />

        {/* Floating Controls: Detect GPS Location */}
        {showDetectLocationBtn && (
          <button
            type="button"
            onClick={handleDetectGPS}
            disabled={isDetectingLocation}
            className="absolute top-3 right-3 z-[400] h-9 px-3 rounded-xl bg-[#071f13]/95 hover:bg-[#0c311f] border border-emerald-500/40 text-emerald-200 hover:text-white text-xs font-bold shadow-lg flex items-center gap-1.5 backdrop-blur-md transition-all cursor-pointer"
            title="Locate my current position"
          >
            {isDetectingLocation ? (
              <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
            ) : (
              <Navigation className="w-4 h-4 text-emerald-400" />
            )}
            <span className="hidden sm:inline">Use My Location</span>
          </button>
        )}

        {/* Floating Map Helper Badge */}
        <div className="absolute bottom-3 left-3 z-[400] bg-[#071f13]/90 backdrop-blur-md border border-emerald-500/30 rounded-xl px-2.5 py-1.5 text-[10.5px] text-emerald-200/90 shadow-md flex items-center gap-1.5 pointer-events-none">
          <Compass className="w-3.5 h-3.5 text-emerald-400" />
          <span>Click anywhere or drag pin to choose exact colony</span>
        </div>
      </div>

      {/* ─── Selected Colony/Location Status Pill ─── */}
      {resolvedAddress && (
        <div className="p-3 bg-[#06180f] border-t border-emerald-500/20 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0 leading-tight">
              <p className="text-[10px] font-black uppercase tracking-wider text-emerald-400">Selected Location</p>
              <p className="text-white font-bold truncate text-xs">{resolvedAddress}</p>
            </div>
          </div>
          <span className="text-[10px] text-emerald-300 font-mono shrink-0 bg-emerald-950 px-2 py-1 rounded border border-emerald-500/20">
            {currentCoords[0].toFixed(4)}, {currentCoords[1].toFixed(4)}
          </span>
        </div>
      )}
    </div>
  );
};
