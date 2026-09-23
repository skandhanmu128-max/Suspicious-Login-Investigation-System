// ─── Behavior Engine ──────────────────────────────────────────────────────────
// Manages per-user behavioral baselines and deviation detection.

export interface UserBaseline {
  knownCountries: string[];
  knownCities: string[];
  knownDevices: string[];
  knownBrowsers: string[];
  knownIps: string[];
  typicalLoginStart: number;
  typicalLoginEnd: number;
  typicalDays: number[];
}

export interface BehaviorFlags {
  isNewCountry: boolean;
  isNewCity: boolean;
  isNewDevice: boolean;
  isNewBrowser: boolean;
  isNewIp: boolean;
}

export interface CoreLoginParameters {
  ip: {
    current: string;
    status: 'known' | 'new';
    previousKnownIp: string | null;
    reputation: 'clean' | 'suspicious' | 'malicious';
    asn?: string | null;
    isp?: string | null;
  };
  location: {
    current: string;
    normal: string;
    status: 'known' | 'unusual';
    coords?: [number, number];
  };
  loginWindow: {
    current: string;
    normal: string;
    status: 'normal' | 'outside_window' | 'insufficient_data';
    timeDiffFromPrev?: string;
  };
  vpn: {
    status: 'detected' | 'not_detected' | 'unknown';
    source: string;
    isTor: boolean;
    isProxy: boolean;
    reputation: string;
  };
}

export function formatHourAmPm(hour: number): string {
  const h = hour % 24;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 === 0 ? 12 : h % 12;
  return `${displayH.toString().padStart(2, '0')}:00 ${ampm}`;
}

import { checkThreatIntel } from './threatIntel';

export function evaluateCoreParameters(
  event: any,
  baseline?: Partial<UserBaseline> | null,
  previousEvent?: { timestamp: string; ip: string } | null
): CoreLoginParameters {
  const intel = event?.ip ? checkThreatIntel(event.ip) : { isVPN: false, isTor: false, isProxy: false, reputation: 'clean' as const, vpnProvider: null, isp: null, asn: null };
  const knownIps = baseline?.knownIps ?? [];
  const knownCities = baseline?.knownCities ?? [];
  const knownCountries = baseline?.knownCountries ?? [];

  // 1. IP Address
  const isKnownIp = knownIps.length > 0 ? knownIps.includes(event.ip) : false;
  const previousKnownIp = knownIps.length > 0 ? knownIps[knownIps.length - 1] : (previousEvent?.ip ?? null);

  // 2. Location
  const currentLoc = [event.city, event.country].filter(Boolean).join(', ') || 'Unknown Location';
  const normalLoc = [knownCities[0], knownCountries[0]].filter(Boolean).join(', ') || (knownCountries[0] ?? 'Insufficient historical data');
  const isKnownLoc = knownCountries.length > 0 && (
    (event.country && knownCountries.includes(event.country)) &&
    (!event.city || knownCities.length === 0 || knownCities.includes(event.city))
  );

  // 3. Login Window
  const evDate = new Date(event.timestamp);
  const evHour = isNaN(evDate.getTime()) ? new Date().getHours() : evDate.getHours();

  const hasHistoricalWindow = Boolean(
    baseline &&
    baseline.typicalLoginStart !== undefined &&
    baseline.typicalLoginEnd !== undefined &&
    (knownCities.length > 0 || knownIps.length > 0)
  );

  let windowStatus: 'normal' | 'outside_window' | 'insufficient_data' = 'insufficient_data';
  let normalWindowStr = 'Insufficient historical data';

  if (hasHistoricalWindow) {
    const start = baseline!.typicalLoginStart!;
    const end = baseline!.typicalLoginEnd!;
    normalWindowStr = `${formatHourAmPm(start)} – ${formatHourAmPm(end)}`;

    const isInside = start <= end
      ? (evHour >= start && evHour <= end)
      : (evHour >= start || evHour <= end);

    windowStatus = isInside ? 'normal' : 'outside_window';
  }

  let timeDiffFromPrev: string | undefined;
  if (previousEvent && previousEvent.timestamp) {
    const prevTime = new Date(previousEvent.timestamp).getTime();
    const currTime = new Date(event.timestamp).getTime();
    if (!isNaN(prevTime) && !isNaN(currTime) && currTime > prevTime) {
      const diffMin = Math.round((currTime - prevTime) / 60000);
      if (diffMin < 60) timeDiffFromPrev = `${diffMin}m after previous login`;
      else timeDiffFromPrev = `${(diffMin / 60).toFixed(1)}h after previous login`;
    }
  }

  // 4. VPN Detection
  const vpnStatusRaw = event.vpnDetected ?? event.vpn_detected;
  const isVpnBool = Boolean(event.isVPN || event.is_vpn || vpnStatusRaw === 'detected' || intel.isVPN);
  const vpnStatus: 'detected' | 'not_detected' | 'unknown' =
    vpnStatusRaw === 'unknown' ? 'unknown' :
    (isVpnBool || vpnStatusRaw === 'detected') ? 'detected' : 'not_detected';

  const vpnProvider = event.vpnProvider ?? event.vpn_provider ?? intel.vpnProvider ?? (isVpnBool ? 'Commercial VPN / Relay Service' : null);
  const vpnSource = vpnProvider
    ? vpnProvider
    : isVpnBool
    ? 'Threat Intelligence Engine (ASN/Prefix DB)'
    : 'Clean IP Telemetry (No Commercial VPN / Proxy Signature)';

  const isTor = Boolean(event.isTor || event.is_tor || intel.isTor);
  const isProxy = Boolean(event.isProxy || event.is_proxy || intel.isProxy);
  const reputation = (event.ipReputation || event.ip_reputation || intel.reputation || 'clean') as 'clean' | 'suspicious' | 'malicious';

  return {
    ip: {
      current: event.ip || 'Unknown IP',
      status: isKnownIp ? 'known' : 'new',
      previousKnownIp: previousKnownIp && previousKnownIp !== event.ip ? previousKnownIp : (knownIps[0] ?? null),
      reputation,
      asn: event.asn ?? intel.asn ?? null,
      isp: event.isp ?? intel.isp ?? null,
    },
    location: {
      current: currentLoc,
      normal: normalLoc,
      status: isKnownLoc ? 'known' : 'unusual',
      coords: event.lat && event.lng ? [event.lat, event.lng] : undefined,
    },
    loginWindow: {
      current: isNaN(evDate.getTime()) ? 'Unknown Time' : evDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
      normal: normalWindowStr,
      status: windowStatus,
      timeDiffFromPrevious: timeDiffFromPrev,
    },
    vpn: {
      status: vpnStatus,
      provider: vpnProvider,
      source: vpnSource,
      isTor,
      isProxy,
      reputation,
    },
  };
}

export function detectBehaviorAnomalies(
  event: {
    country: string;
    city: string;
    device: string;
    browser: string;
    ip: string;
    deviceFingerprint?: string;
  },
  baseline: UserBaseline
): BehaviorFlags {
  return {
    isNewCountry: !baseline.knownCountries.includes(event.country),
    isNewCity: !baseline.knownCities.includes(event.city),
    isNewDevice: !baseline.knownDevices.includes(event.device) &&
                 !(event.deviceFingerprint && baseline.knownDevices.includes(event.deviceFingerprint)),
    isNewBrowser: !baseline.knownBrowsers.includes(event.browser),
    isNewIp: !baseline.knownIps.includes(event.ip),
  };
}

export function updateBaseline(
  baseline: UserBaseline,
  event: {
    country: string;
    city: string;
    device: string;
    browser: string;
    ip: string;
    deviceFingerprint?: string;
    result: string;
    timestamp: string;
  }
): UserBaseline {
  // Only update baseline on successful logins
  if (event.result !== 'success') return baseline;

  const updated = { ...baseline };

  if (!updated.knownCountries.includes(event.country)) {
    updated.knownCountries = [...updated.knownCountries, event.country];
  }
  if (!updated.knownCities.includes(event.city)) {
    updated.knownCities = [...updated.knownCities, event.city];
  }
  const deviceKey = event.deviceFingerprint ?? event.device;
  if (!updated.knownDevices.includes(deviceKey)) {
    updated.knownDevices = [...updated.knownDevices, deviceKey];
  }
  if (!updated.knownBrowsers.includes(event.browser)) {
    updated.knownBrowsers = [...updated.knownBrowsers, event.browser];
  }
  // Keep only last 20 known IPs
  if (!updated.knownIps.includes(event.ip)) {
    updated.knownIps = [...updated.knownIps.slice(-19), event.ip];
  }

  return updated;
}

// Generate a device fingerprint from device attributes
export function generateDeviceFingerprint(
  device: string, browser: string, os: string, isMobile: boolean
): string {
  const combined = `${device}|${browser}|${os}|${isMobile}`;
  // Simple hash for fingerprinting
  let hash = 5381;
  for (const char of combined) {
    hash = ((hash << 5) + hash) ^ char.charCodeAt(0);
  }
  return `FP${Math.abs(hash).toString(16).substring(0, 8).toUpperCase()}`;
}

// Calculate 7-day risk trend (returns array of daily max risk scores)
export function calculateRiskTrend(
  events: Array<{ timestamp: string; riskScore: number }>,
  days: number = 7
): number[] {
  const trend: number[] = new Array(days).fill(0);
  const now = new Date();

  for (const event of events) {
    const eventDate = new Date(event.timestamp);
    const daysAgo = Math.floor((now.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysAgo >= 0 && daysAgo < days) {
      const idx = days - 1 - daysAgo;
      trend[idx] = Math.max(trend[idx], event.riskScore);
    }
  }

  return trend;
}
