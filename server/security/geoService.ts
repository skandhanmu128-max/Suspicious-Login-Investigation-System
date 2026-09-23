// ─── Geo Service ──────────────────────────────────────────────────────────────
// Calculates distances, travel speeds, and impossible travel detection.

export interface GeoPoint {
  country: string;
  city: string;
  lat: number;
  lng: number;
  timestamp: string;
}

// Haversine formula — returns distance in km
export function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

export interface TravelAnalysis {
  isImpossible: boolean;
  distanceKm: number;
  timeDiffMinutes: number;
  requiredSpeedKmh: number;
  maxComercialFlightSpeed: number;
  explanation: string;
}

// Maximum physically plausible speed (faster than any commercial flight)
const MAX_PLAUSIBLE_SPEED_KMH = 1200;

export function analyzeTravelSpeed(prev: GeoPoint, curr: GeoPoint): TravelAnalysis {
  const distanceKm = haversineDistance(prev.lat, prev.lng, curr.lat, curr.lng);
  const timeDiffMs = new Date(curr.timestamp).getTime() - new Date(prev.timestamp).getTime();
  const timeDiffMinutes = timeDiffMs / (1000 * 60);
  const timeDiffHours = timeDiffMinutes / 60;

  const requiredSpeedKmh = timeDiffHours > 0 ? distanceKm / timeDiffHours : Infinity;
  const maxComercialFlightSpeed = 920; // km/h

  const isImpossible = distanceKm > 100 && requiredSpeedKmh > MAX_PLAUSIBLE_SPEED_KMH;

  let explanation = '';
  if (isImpossible) {
    explanation = `Login from ${prev.city}, ${prev.country} at ${new Date(prev.timestamp).toISOString()} ` +
      `and from ${curr.city}, ${curr.country} ${timeDiffMinutes.toFixed(0)} minutes later. ` +
      `Distance: ${distanceKm.toFixed(0)} km. ` +
      `Required speed: ${requiredSpeedKmh.toFixed(0)} km/h (physically implausible).`;
  }

  return {
    isImpossible,
    distanceKm: Math.round(distanceKm),
    timeDiffMinutes: Math.round(timeDiffMinutes),
    requiredSpeedKmh: Math.round(requiredSpeedKmh),
    maxComercialFlightSpeed,
    explanation,
  };
}

// City → coordinates lookup table (synthetic cities used in demo)
export const CITY_COORDS: Record<string, { lat: number; lng: number; country: string }> = {
  // India
  'Bengaluru': { lat: 12.9716, lng: 77.5946, country: 'India' },
  'Hyderabad': { lat: 17.3850, lng: 78.4867, country: 'India' },
  'Mumbai': { lat: 19.0760, lng: 72.8777, country: 'India' },
  'Delhi': { lat: 28.6139, lng: 77.2090, country: 'India' },
  'Chennai': { lat: 13.0827, lng: 80.2707, country: 'India' },
  'Pune': { lat: 18.5204, lng: 73.8567, country: 'India' },
  // Europe
  'Berlin': { lat: 52.5200, lng: 13.4050, country: 'Germany' },
  'London': { lat: 51.5074, lng: -0.1278, country: 'United Kingdom' },
  'Paris': { lat: 48.8566, lng: 2.3522, country: 'France' },
  'Amsterdam': { lat: 52.3676, lng: 4.9041, country: 'Netherlands' },
  'Zurich': { lat: 47.3769, lng: 8.5417, country: 'Switzerland' },
  'Stockholm': { lat: 59.3293, lng: 18.0686, country: 'Sweden' },
  // Americas
  'New York': { lat: 40.7128, lng: -74.0060, country: 'United States' },
  'San Francisco': { lat: 37.7749, lng: -122.4194, country: 'United States' },
  'Chicago': { lat: 41.8781, lng: -87.6298, country: 'United States' },
  'Toronto': { lat: 43.6532, lng: -79.3832, country: 'Canada' },
  'São Paulo': { lat: -23.5505, lng: -46.6333, country: 'Brazil' },
  // Asia-Pacific
  'Singapore': { lat: 1.3521, lng: 103.8198, country: 'Singapore' },
  'Tokyo': { lat: 35.6762, lng: 139.6503, country: 'Japan' },
  'Sydney': { lat: -33.8688, lng: 151.2093, country: 'Australia' },
  'Beijing': { lat: 39.9042, lng: 116.4074, country: 'China' },
  'Hong Kong': { lat: 22.3193, lng: 114.1694, country: 'Hong Kong' },
  // Middle East / Africa
  'Dubai': { lat: 25.2048, lng: 55.2708, country: 'United Arab Emirates' },
  'Nairobi': { lat: -1.2921, lng: 36.8219, country: 'Kenya' },
  'Lagos': { lat: 6.5244, lng: 3.3792, country: 'Nigeria' },
};

export function getCityCoords(city: string): { lat: number; lng: number; country: string } | null {
  return CITY_COORDS[city] ?? null;
}

// Check if a login hour is unusual for a user
export function isOddHour(hour: number, typicalStart: number, typicalEnd: number): boolean {
  // Odd if more than 2 hours outside typical window
  if (typicalStart <= typicalEnd) {
    return hour < (typicalStart - 2) || hour > (typicalEnd + 2);
  }
  // Night-shift wrapped window
  return hour > (typicalEnd + 2) && hour < (typicalStart - 2);
}
