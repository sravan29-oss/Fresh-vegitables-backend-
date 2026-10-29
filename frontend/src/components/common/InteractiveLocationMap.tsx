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
  Plus,
  Minus,
  Maximize2,
  ShieldCheck,
  Radio,
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

// Google Maps Tile Layer Variants (Reliable, high-speed, 100% Google Maps Theme)
const GOOGLE_TILE_LAYERS = {
  roadmap: {
    url: 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    subdomains: ['0', '1', '2', '3'],
    maxZoom: 20,
    name: 'Map',
  },
  satellite: {
    url: 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    subdomains: ['0', '1', '2', '3'],
    maxZoom: 20,
    name: 'Satellite',
  },
  terrain: {
    url: 'https://mt{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
    subdomains: ['0', '1', '2', '3'],
    maxZoom: 20,
    name: 'Terrain',
  },
};

type MapTheme = keyof typeof GOOGLE_TILE_LAYERS;

export const InteractiveLocationMap: React.FC<InteractiveLocationMapProps> = ({
  initialCenter = [17.4474, 78.3762], // Hyderabad central IT corridor
  zoom = 14,
  markerPosition,
  onPositionChange,
  zones = [],
  selectedZoneId,
  interactive = true,
  circleRadiusKm,
  height = '370px',
  showSearchBar = true,
  showDetectLocationBtn = true,
  placeholder = 'Search Colony, Area or Landmark in Hyderabad...',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const activeTileLayerRef = useRef<L.TileLayer | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const adminCircleRef = useRef<L.Circle | null>(null);
  const zonesLayerGroupRef = useRef<L.LayerGroup | null>(null);

  const [currentCoords, setCurrentCoords] = useState<[number, number]>(
    markerPosition || initialCenter
  );
  const [activeTheme, setActiveTheme] = useState<MapTheme>('roadmap');
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

  // Reverse Geocoding: Tries Google Geocoding (if key enabled) -> OSM Nominatim -> Local Colony Directory
  const reverseGeocode = useCallback(
    async (lat: number, lng: number) => {
      const roundedLat = Number(lat.toFixed(6));
      const roundedLng = Number(lng.toFixed(6));

      // 1. Attempt Google Geocoding API if key configured
      const googleApiKey =
        import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
        import.meta.env.GOOGLE_MAPS_API_KEY;

      if (googleApiKey) {
        try {
          const gRes = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${roundedLat},${roundedLng}&key=${googleApiKey}`
          );
          const gData = await gRes.json();
          if (gData.status === 'OK' && gData.results && gData.results.length > 0) {
            const first = gData.results[0];
            let colony = '';
            let area = 'Hyderabad';
            let pincode = '';

            for (const comp of first.address_components) {
              if (
                comp.types.includes('sublocality') ||
                comp.types.includes('neighborhood') ||
                comp.types.includes('sublocality_level_1')
              ) {
                colony = comp.long_name;
              }
              if (comp.types.includes('locality') || comp.types.includes('administrative_area_level_2')) {
                area = comp.long_name;
              }
              if (comp.types.includes('postal_code')) {
                pincode = comp.long_name;
              }
            }

            if (!colony) colony = first.address_components[0]?.long_name || 'Hyderabad Colony';
            const full = first.formatted_address || `${colony}, ${area}`;

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
          // Google API failed or denied billing, seamlessly fallback to Nominatim
        }
      }

      // 2. High-precision OpenStreetMap Nominatim reverse geocode
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

      // 3. Fallback: Match nearest named reference in Hyderabad directory
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

  // Switch Google Maps Layer Theme
  const switchMapTheme = (theme: MapTheme) => {
    setActiveTheme(theme);
    if (!mapInstanceRef.current) return;

    if (activeTileLayerRef.current) {
      mapInstanceRef.current.removeLayer(activeTileLayerRef.current);
    }

    const config = GOOGLE_TILE_LAYERS[theme];
    const newLayer = L.tileLayer(config.url, {
      subdomains: config.subdomains,
      maxZoom: config.maxZoom,
      attribution: 'Google Maps &bull; FreshVegetables Network',
    }).addTo(mapInstanceRef.current);

    activeTileLayerRef.current = newLayer;
  };

  // Create Google Maps Inspired Custom Pin with FreshVegetables Branding
  const createGoogleStyledPin = () => {
    return L.divIcon({
      className: 'custom-google-pin',
      html: `
        <div style="position: relative; width: 48px; height: 56px; display: flex; align-items: center; justify-content: center; transform: translate(-2px, -6px);">
          <!-- Outer Pulsing Radar Waves -->
          <div style="position: absolute; bottom: 0px; width: 42px; height: 42px; border-radius: 9999px; background: rgba(16, 185, 129, 0.4); animation: pulseRadar 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="position: absolute; bottom: 6px; width: 30px; height: 30px; border-radius: 9999px; background: rgba(5, 150, 105, 0.25); animation: pingSlow 2.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          
          <!-- Google Maps Teardrop Marker Pin with Fresh Vegetables Emerald Gradient -->
          <div style="position: relative; z-index: 10; display: flex; flex-direction: column; align-items: center; filter: drop-shadow(0 8px 16px rgba(5, 150, 105, 0.45));">
            <svg width="40" height="48" viewBox="0 0 384 512" fill="none">
              <defs>
                <linearGradient id="freshPinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#10b981" />
                  <stop offset="60%" stop-color="#059669" />
                  <stop offset="100%" stop-color="#047857" />
                </linearGradient>
                <filter id="pinShadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="4" stdDeviation="3" flood-color="#000" flood-opacity="0.3"/>
                </filter>
              </defs>
              <path 
                d="M172.268 501.67C26.97 291.031 0 269.413 0 192 0 85.961 85.961 0 192 0s192 85.961 192 192c0 77.413-26.97 99.031-172.268 309.67-9.535 13.774-29.93 13.773-39.464 0z" 
                fill="url(#freshPinGrad)"
                stroke="#ffffff"
                stroke-width="12"
              />
              <!-- White Inner Circle -->
              <circle cx="192" cy="192" r="92" fill="#ffffff" />
              <!-- Emerald Fresh Leaf Centerpiece -->
              <path 
                d="M192 136c-30.9 0-56 25.1-56 56 0 12.4 4 23.9 10.9 33.1L192 268l45.1-42.9c6.9-9.2 10.9-20.7 10.9-33.1 0-30.9-25.1-56-56-56z" 
                fill="#059669" 
              />
              <circle cx="192" cy="192" r="18" fill="#ffffff" />
            </svg>
          </div>
        </div>
      `,
      iconSize: [48, 56],
      iconAnchor: [24, 52],
    });
  };

  // Initialize Map with Google Maps Theme
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    // Reset default icon assets
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

    // Default: Official Google Maps Roadmap Theme Layer
    const tileConfig = GOOGLE_TILE_LAYERS[activeTheme];
    const initialTileLayer = L.tileLayer(tileConfig.url, {
      subdomains: tileConfig.subdomains,
      maxZoom: tileConfig.maxZoom,
      attribution: 'Google Maps &bull; FreshVegetables Delivery',
    }).addTo(map);

    activeTileLayerRef.current = initialTileLayer;

    // Create & Add Google Styled Pin
    const marker = L.marker(currentCoords, {
      icon: createGoogleStyledPin(),
      draggable: interactive,
      autoPan: true,
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

    // Delivery zones overlay layer group
    const zonesGroup = L.layerGroup().addTo(map);
    zonesLayerGroupRef.current = zonesGroup;

    mapInstanceRef.current = map;

    // Initial reverse geocode
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

  // Sync external markerPosition prop
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

  // Update Zones Geofence Circles on Google Maps canvas
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
          opacity: 0.85,
          fillColor: isSelected ? '#34d399' : '#10b981',
          fillOpacity: isSelected ? 0.18 : 0.08,
          dashArray: isSelected ? '6, 6' : undefined,
        }).addTo(group);

        circle.bindTooltip(
          `<div style="font-family: inherit; font-size: 11px; padding: 2px;">
            <strong style="color: #ffffff;">${zone.name}</strong><br/>
            <span style="color: #34d399;">${zone.estimated_delivery_time} • ₹${zone.delivery_fee} Delivery Fee</span>
          </div>`,
          {
            permanent: false,
            direction: 'top',
            className: 'fresh-zone-tooltip',
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
        weight: 2.2,
        dashArray: '6, 6',
        fillColor: '#34d399',
        fillOpacity: 0.18,
      }).addTo(map);

      circle.bindTooltip(
        `<div style="font-size: 11px; font-weight: bold; color: #ffffff; padding: 2px 6px;">Coverage Radius: ${circleRadiusKm} km</div>`,
        { permanent: true, direction: 'right', className: 'fresh-zone-tooltip' }
      );

      adminCircleRef.current = circle;
    }
  }, [circleRadiusKm, currentCoords, markerPosition]);

  // Colony search suggestions
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

  // Select Hyderabad colony
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

  // Search online fallback
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

  // Detect GPS location
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

  // Custom Google Maps Zoom Controls
  const handleZoomIn = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomOut();
    }
  };

  const handleRecenter = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.panTo(currentCoords);
    }
  };

  return (
    <div className="relative rounded-2xl overflow-hidden border border-emerald-500/25 bg-[#06180f] shadow-2xl flex flex-col">
      {/* ─── Google Maps Style Search & Location Header ─── */}
      {showSearchBar && (
        <div className="p-3 bg-[#071f13] border-b border-emerald-500/20 relative z-20">
          <form onSubmit={handleOnlineSearch} className="relative">
            <Search className="w-4 h-4 text-emerald-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder={placeholder}
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full h-10 pl-9 pr-24 text-xs sm:text-sm bg-[#04140c] border border-emerald-500/30 focus:border-emerald-400 rounded-xl text-white placeholder:text-emerald-100/40 focus:outline-none focus:ring-1 focus:ring-emerald-400 shadow-inner"
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
                className="h-7 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[11px] flex items-center gap-1 transition-all shadow-sm cursor-pointer"
              >
                {isSearchingOnline ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <span>Locate</span>
                )}
              </button>
            </div>
          </form>

          {/* Autocomplete Suggestions */}
          {suggestions.length > 0 && (
            <div className="absolute left-3 right-3 top-14 bg-[#081e13] border border-emerald-500/30 rounded-xl shadow-2xl overflow-hidden z-50 animate-fade-in max-h-56 overflow-y-auto divide-y divide-emerald-950/60">
              <div className="p-2 text-[10px] font-black uppercase tracking-wider text-emerald-400/80 bg-[#05160d]">
                Hyderabad Colonies &amp; Landmarks
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

      {/* ─── Map Canvas & Overlay Elements ─── */}
      <div className="relative w-full" style={{ height }}>
        {/* Leaflet Canvas with Google Roadmap Tiles */}
        <div ref={mapContainerRef} className="w-full h-full z-10" />

        {/* ─── Fresh Vegetables Watermark & Branding Badge (Top-Left) ─── */}
        <div className="absolute top-3 left-3 z-[400] bg-slate-950/90 backdrop-blur-md border border-emerald-500/35 rounded-xl px-2.5 py-1.5 shadow-xl flex items-center gap-2 pointer-events-none">
          <div className="w-5 h-5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
            <span className="text-xs">🌿</span>
          </div>
          <div className="leading-tight">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-black text-white tracking-tight">
                Fresh<span className="text-emerald-400">Vegetables</span>
              </span>
              <span className="text-[8.5px] font-bold text-emerald-300 bg-emerald-950/80 px-1 py-0.2 rounded border border-emerald-500/30">
                LIVE MAP
              </span>
            </div>
            <p className="text-[9px] text-emerald-200/70">15–25 Mins Hyperlocal Express</p>
          </div>
        </div>

        {/* ─── Google Maps Theme Switcher Pill (Top-Right) ─── */}
        <div className="absolute top-3 right-3 z-[400] flex items-center gap-2">
          {/* Map / Satellite / Terrain Mode Pills */}
          <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-xl p-0.5 border border-slate-200 dark:border-slate-800 shadow-md flex items-center gap-0.5 text-[11px] font-bold">
            <button
              type="button"
              onClick={() => switchMapTheme('roadmap')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                activeTheme === 'roadmap'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-emerald-500'
              }`}
            >
              Map
            </button>
            <button
              type="button"
              onClick={() => switchMapTheme('satellite')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                activeTheme === 'satellite'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-emerald-500'
              }`}
            >
              Satellite
            </button>
            <button
              type="button"
              onClick={() => switchMapTheme('terrain')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer hidden sm:block ${
                activeTheme === 'terrain'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-emerald-500'
              }`}
            >
              Terrain
            </button>
          </div>

          {/* Detect GPS Button */}
          {showDetectLocationBtn && (
            <button
              type="button"
              onClick={handleDetectGPS}
              disabled={isDetectingLocation}
              className="h-8 px-2.5 rounded-xl bg-white/95 dark:bg-slate-900/95 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-slate-200 dark:border-slate-800 text-emerald-600 dark:text-emerald-400 text-xs font-bold shadow-md flex items-center gap-1.5 backdrop-blur-md transition-all cursor-pointer"
              title="Locate my position"
            >
              {isDetectingLocation ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" />
              ) : (
                <Navigation className="w-3.5 h-3.5 text-emerald-500" />
              )}
              <span className="hidden md:inline">My Location</span>
            </button>
          )}
        </div>

        {/* ─── Google Maps Style Vertical Floating Controls (Bottom-Right) ─── */}
        <div className="absolute bottom-4 right-3 z-[400] flex flex-col items-center gap-2">
          {/* Re-center Button */}
          <button
            type="button"
            onClick={handleRecenter}
            className="w-8 h-8 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:text-emerald-500 shadow-lg flex items-center justify-center transition-all cursor-pointer"
            title="Re-center on pin"
          >
            <Compass className="w-4 h-4 text-emerald-500" />
          </button>

          {/* Zoom In & Zoom Out Column */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-lg flex flex-col overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
            <button
              type="button"
              onClick={handleZoomIn}
              className="w-8 h-8 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Zoom In"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleZoomOut}
              className="w-8 h-8 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Zoom Out"
            >
              <Minus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ─── Bottom-Left: Subtle Brand Watermark Tag & Instruction ─── */}
        <div className="absolute bottom-3 left-3 z-[400] flex items-center gap-2">
          <div className="bg-slate-950/85 backdrop-blur-md border border-emerald-500/30 rounded-xl px-2.5 py-1 text-[10px] text-emerald-200/90 shadow-md flex items-center gap-1.5 pointer-events-none">
            <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
            <span>Click or drag pin to select colony</span>
          </div>

          <div className="hidden sm:flex items-center gap-1 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border border-slate-200/50 dark:border-slate-800/50 rounded-lg px-2 py-0.5 text-[9px] text-slate-500 dark:text-slate-400 pointer-events-none">
            <span>Powered by Google Maps &bull; FreshVegetables</span>
          </div>
        </div>
      </div>

      {/* ─── Selected Location Footer Bar ─── */}
      {resolvedAddress && (
        <div className="p-3 bg-[#06180f] border-t border-emerald-500/20 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0 leading-tight">
              <p className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                Selected Delivery Location
              </p>
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
