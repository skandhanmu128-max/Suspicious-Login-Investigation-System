// ─── Risk Engine 2.0 ──────────────────────────────────────────────────────────
// Rule-based detection with explainable signals and configurable weights.

import { analyzeTravelSpeed, isOddHour, GeoPoint } from './geoService';
import { checkThreatIntel } from './threatIntel';

// ─── Types ────────────────────────────────────────────────────────────────────

export type RiskLevel = 'safe' | 'suspicious' | 'high' | 'critical';

export interface RiskSignal {
  id: string;
  name: string;
  category: 'authentication' | 'location' | 'device' | 'time' | 'network' | 'behavioral';
  description: string;
  points: number;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  evidence: string;
}

export interface RiskResult {
  score: number;
  level: RiskLevel;
  confidence: number;
  signals: RiskSignal[];
  explanation: string;
  summary: string;
}

// ─── Default Weights (configurable) ──────────────────────────────────────────

export const DEFAULT_WEIGHTS = {
  impossible_travel: 40,
  new_country: 20,
  new_city: 8,
  new_device: 15,
  new_browser: 5,
  new_ip: 8,
  brute_force_success: 25,
  brute_force_attempt: 5,
  password_spraying: 30,
  blacklisted_ip: 30,
  tor: 20,
  vpn: 10,
  proxy: 12,
  odd_hour: 10,
  weekend_off_hours: 5,
  behavioral_anomaly: 15,
  multiple_countries: 12,
  high_velocity: 18,
};

// ─── Thresholds ───────────────────────────────────────────────────────────────

export const DEFAULT_THRESHOLDS = {
  safe: 29,
  suspicious: 49,
  high: 74,
};

// ─── Risk Calculation Input ───────────────────────────────────────────────────

export interface RiskInput {
  // Current event
  userId: string;
  timestamp: string;
  ip: string;
  country: string;
  city: string;
  lat?: number;
  lng?: number;
  device: string;
  browser: string;
  os: string;
  isMobile: boolean;
  result: 'success' | 'failure';
  isVPN: boolean;
  vpnDetected?: 'detected' | 'not_detected' | 'unknown';
  vpnProvider?: string | null;
  isTor: boolean;
  isProxy: boolean;
  ipReputation: 'clean' | 'suspicious' | 'malicious';

  // Flags
  isNewDevice: boolean;
  isNewCountry: boolean;
  isNewCity: boolean;
  isNewBrowser: boolean;
  isNewIp?: boolean;

  // User baseline
  typicalLoginStart: number;
  typicalLoginEnd: number;
  typicalDays: number[];
  knownCountries?: string[];
  knownIps?: string[];

  // Recent event history for correlation
  recentFailures?: number;          // failures in last 30 min
  recentUniqueUsers?: number;      // for password spray detection (same IP)
  previousLoginEvent?: {
    country: string;
    city: string;
    lat: number;
    lng: number;
    timestamp: string;
  } | null;
  recentCountries?: string[];       // countries in last 24h
  baseline?: {
    knownCountries?: string[];
    knownCities?: string[];
    knownDevices?: string[];
    knownBrowsers?: string[];
    knownIps?: string[];
    typicalLoginStart?: number;
    typicalLoginEnd?: number;
    typicalDays?: number[];
  };
  recentEvents?: any[];
};

// ─── Main Risk Engine ─────────────────────────────────────────────────────────

export function calculateRisk(
  input: RiskInput,
  weights: Partial<typeof DEFAULT_WEIGHTS> = {},
  thresholds: Partial<typeof DEFAULT_THRESHOLDS> = {}
): RiskResult {
  const w = { ...DEFAULT_WEIGHTS, ...weights };
  const t = { ...DEFAULT_THRESHOLDS, ...thresholds };

  const signals: RiskSignal[] = [];
  let rawScore = 0;

  const hour = new Date(input.timestamp).getHours();
  const dayOfWeek = new Date(input.timestamp).getDay(); // 0=Sun

  // ── 1. Impossible Travel ─────────────────────────────────────────────────
  const prevEvent = input.previousLoginEvent ?? (input.recentEvents && input.recentEvents.length > 0 ? {
    country: input.recentEvents[0].country,
    city: input.recentEvents[0].city,
    lat: input.recentEvents[0].lat,
    lng: input.recentEvents[0].lng,
    timestamp: input.recentEvents[0].timestamp,
  } : null);

  if (prevEvent && input.lat && input.lng && prevEvent.lat && prevEvent.lng) {
    const prev: GeoPoint = {
      country: prevEvent.country,
      city: prevEvent.city,
      lat: prevEvent.lat,
      lng: prevEvent.lng,
      timestamp: prevEvent.timestamp,
    };
    const curr: GeoPoint = {
      country: input.country,
      city: input.city,
      lat: input.lat,
      lng: input.lng,
      timestamp: input.timestamp,
    };
    const travel = analyzeTravelSpeed(prev, curr);

    if (travel.isImpossible) {
      rawScore += w.impossible_travel;
      signals.push({
        id: 'impossible_travel',
        name: 'Impossible Travel',
        category: 'location',
        description: `Login from ${prev.city} then ${curr.city} in ${travel.timeDiffMinutes} minutes`,
        points: w.impossible_travel,
        severity: 'critical',
        evidence: `Distance: ${travel.distanceKm.toLocaleString()} km | ` +
          `Time: ${travel.timeDiffMinutes} min | ` +
          `Required speed: ${travel.requiredSpeedKmh.toLocaleString()} km/h`,
      });
    }
  }

  // ── 2. New Country ───────────────────────────────────────────────────────
  const knownCountriesList = input.knownCountries ?? input.baseline?.knownCountries ?? [];
  if (input.isNewCountry) {
    rawScore += w.new_country;
    signals.push({
      id: 'new_country',
      name: 'New Country',
      category: 'location',
      description: `Login from ${input.country} — not previously observed for this user`,
      points: w.new_country,
      severity: 'high',
      evidence: `Known countries: ${knownCountriesList.join(', ') || 'None recorded'}`,
    });
  }

  // ── 3. New City (only if not already flagged for new country) ────────────
  if (input.isNewCity && !input.isNewCountry) {
    rawScore += w.new_city;
    signals.push({
      id: 'new_city',
      name: 'New City',
      category: 'location',
      description: `Login from ${input.city} — not previously seen for this user`,
      points: w.new_city,
      severity: 'low',
      evidence: `City ${input.city} is outside user's known locations`,
    });
  }

  // ── 4. New Device ────────────────────────────────────────────────────────
  if (input.isNewDevice) {
    rawScore += w.new_device;
    signals.push({
      id: 'new_device',
      name: 'New Device',
      category: 'device',
      description: `Unrecognized device: ${input.device} / ${input.os}`,
      points: w.new_device,
      severity: 'medium',
      evidence: `Device fingerprint not in user's known devices`,
    });
  }

  // ── 5. New Browser (only if not flagged for new device) ──────────────────
  if (input.isNewBrowser && !input.isNewDevice) {
    rawScore += w.new_browser;
    signals.push({
      id: 'new_browser',
      name: 'New Browser',
      category: 'device',
      description: `Login via ${input.browser} — not previously used by this user`,
      points: w.new_browser,
      severity: 'low',
      evidence: `Browser change detected on an otherwise known device`,
    });
  }

  // ── 5b. New IP Address ──────────────────────────────────────────────────
  const knownIpsList = input.knownIps ?? input.baseline?.knownIps ?? [];
  const isNewIp = input.isNewIp !== undefined 
    ? input.isNewIp 
    : (knownIpsList.length > 0 ? !knownIpsList.includes(input.ip) : false);

  if (isNewIp) {
    rawScore += w.new_ip;
    signals.push({
      id: 'new_ip',
      name: 'New IP Address',
      category: 'network',
      description: `Login from unrecognized IP address: ${input.ip}`,
      points: w.new_ip,
      severity: 'low',
      evidence: `IP ${input.ip} is not in user's known IP baseline (${knownIpsList.slice(0, 3).join(', ') || 'None recorded'}).`,
    });
  }

  // ── 6. Brute Force → Success ─────────────────────────────────────────────
  const failures = input.recentFailures ?? (input.recentEvents ? input.recentEvents.filter(e => e.result === 'failure').length : 0);
  if (failures >= 5 && input.result === 'success') {
    rawScore += w.brute_force_success;
    signals.push({
      id: 'brute_force_success',
      name: 'Successful Login After Multiple Failures',
      category: 'authentication',
      description: `${failures} failed attempts followed by success`,
      points: w.brute_force_success,
      severity: 'critical',
      evidence: `${failures} authentication failures in last 30 minutes, then success`,
    });
  } else if (failures >= 3 && input.result === 'failure') {
    rawScore += w.brute_force_attempt * Math.min(failures, 5);
    signals.push({
      id: 'brute_force_attempt',
      name: 'Repeated Authentication Failures',
      category: 'authentication',
      description: `${failures} consecutive failed login attempts`,
      points: w.brute_force_attempt * Math.min(failures, 5),
      severity: failures >= 8 ? 'high' : 'medium',
      evidence: `${failures} failures recorded in the last 30 minutes`,
    });
  }

  // ── 7. Password Spraying ─────────────────────────────────────────────────
  if ((input.recentUniqueUsers ?? 0) >= 4) {
    rawScore += w.password_spraying;
    signals.push({
      id: 'password_spraying',
      name: 'Password Spraying Suspected',
      category: 'authentication',
      description: `Same IP targeting ${input.recentUniqueUsers} different accounts`,
      points: w.password_spraying,
      severity: 'critical',
      evidence: `${input.recentUniqueUsers} unique usernames attempted from IP ${input.ip} in last 30 minutes`,
    });
  }

  // ── 8. Blacklisted / Malicious IP ────────────────────────────────────────
  if (input.ipReputation === 'malicious') {
    rawScore += w.blacklisted_ip;
    signals.push({
      id: 'blacklisted_ip',
      name: 'Blacklisted IP Address',
      category: 'network',
      description: `IP ${input.ip} appears on threat intelligence feeds`,
      points: w.blacklisted_ip,
      severity: 'critical',
      evidence: `IP reputation: MALICIOUS — associated with known attack infrastructure`,
    });
  }

  // ── 9. Tor ───────────────────────────────────────────────────────────────
  if (input.isTor) {
    rawScore += w.tor;
    signals.push({
      id: 'tor',
      name: 'Tor Exit Node',
      category: 'network',
      description: `Login originated from a Tor exit node`,
      points: w.tor,
      severity: 'high',
      evidence: `IP ${input.ip} identified as Tor exit node — identity anonymization`,
    });
  }

  // ── 10. VPN ──────────────────────────────────────────────────────────────
  const isVpnDetected = input.vpnDetected === 'detected' || input.isVPN;
  if (isVpnDetected && !input.isTor) {
    rawScore += w.vpn;
    signals.push({
      id: 'vpn',
      name: 'VPN Detected',
      category: 'network',
      description: `Login via VPN${input.vpnProvider ? ` (${input.vpnProvider})` : ''} — location may be masked`,
      points: w.vpn,
      severity: 'low',
      evidence: `VPN detected on IP ${input.ip}${input.vpnProvider ? ` (${input.vpnProvider})` : ''}. Treated as an investigation signal, not automatic compromise.`,
    });
  }

  // ── 11. Proxy ─────────────────────────────────────────────────────────────
  if (input.isProxy && !input.isTor) {
    rawScore += w.proxy;
    signals.push({
      id: 'proxy',
      name: 'Open Proxy',
      category: 'network',
      description: `Login via open proxy service`,
      points: w.proxy,
      severity: 'medium',
      evidence: `IP ${input.ip} identified as open proxy — traffic routing through third party`,
    });
  }

  // ── 12. Odd Hour ─────────────────────────────────────────────────────────
  const isOdd = isOddHour(hour, input.typicalLoginStart, input.typicalLoginEnd);
  if (isOdd) {
    rawScore += w.odd_hour;
    signals.push({
      id: 'odd_hour',
      name: 'Unusual Login Time',
      category: 'time',
      description: `Login at ${hour.toString().padStart(2, '0')}:xx — outside user's typical hours`,
      points: w.odd_hour,
      severity: 'low',
      evidence: `User typically logs in between ${input.typicalLoginStart}:00 and ${input.typicalLoginEnd}:00. ` +
        `This login occurred at ${hour}:xx local time.`,
    });
  }

  // ── 13. Weekend Off-Hours ─────────────────────────────────────────────────
  if ((dayOfWeek === 0 || dayOfWeek === 6) && !input.typicalDays.includes(dayOfWeek)) {
    rawScore += w.weekend_off_hours;
    signals.push({
      id: 'weekend_login',
      name: 'Weekend Login',
      category: 'time',
      description: `Login on ${dayOfWeek === 0 ? 'Sunday' : 'Saturday'} — unusual for this user`,
      points: w.weekend_off_hours,
      severity: 'info',
      evidence: `User's typical working days do not include weekends`,
    });
  }

  // ── 14. Multiple Countries in Short Period ────────────────────────────────
  if (input.recentCountries && input.recentCountries.length >= 3) {
    rawScore += w.multiple_countries;
    signals.push({
      id: 'multiple_countries',
      name: 'Multiple Countries in 24 Hours',
      category: 'behavioral',
      description: `Account accessed from ${input.recentCountries.length} different countries in 24h`,
      points: w.multiple_countries,
      severity: 'high',
      evidence: `Recent countries: ${input.recentCountries.join(', ')}`,
    });
  }

  // ── 15. Behavioral Anomaly — New Country + New Device ────────────────────
  if (input.isNewCountry && input.isNewDevice) {
    rawScore += w.behavioral_anomaly;
    signals.push({
      id: 'behavioral_anomaly',
      name: 'Behavioral Anomaly',
      category: 'behavioral',
      description: `New country AND new device combination — highly unusual`,
      points: w.behavioral_anomaly,
      severity: 'high',
      evidence: `First time observing country ${input.country} with device ${input.device} for this account`,
    });
  }

  // ── Cap score at 100 ──────────────────────────────────────────────────────
  const score = Math.min(100, Math.round(rawScore));

  // ── Risk Level ────────────────────────────────────────────────────────────
  let level: RiskLevel = 'safe';
  if (score > t.high) level = 'critical';
  else if (score > t.suspicious) level = 'high';
  else if (score > t.safe) level = 'suspicious';

  // ── Confidence ────────────────────────────────────────────────────────────
  // Based on number of independent, corroborating signals
  const independentSignalCount = signals.length;
  let confidence = 0;
  if (independentSignalCount === 0) confidence = 0;
  else if (independentSignalCount === 1) confidence = 0.45;
  else if (independentSignalCount === 2) confidence = 0.65;
  else if (independentSignalCount === 3) confidence = 0.78;
  else if (independentSignalCount === 4) confidence = 0.87;
  else if (independentSignalCount >= 5) confidence = 0.93;

  // Adjust confidence based on signal severity
  const hasCritical = signals.some(s => s.severity === 'critical');
  if (hasCritical) confidence = Math.min(0.97, confidence + 0.05);

  // ── Explanation ───────────────────────────────────────────────────────────
  const topSignals = signals.slice(0, 3).map(s => s.name).join(', ');
  
  const coreFindings: string[] = [];
  if (isNewIp) coreFindings.push(`new IP (${input.ip})`);
  if (input.isNewCountry || input.isNewCity) coreFindings.push(`unusual location (${input.city}, ${input.country})`);
  if (isOdd) coreFindings.push(`outside normal window (${hour.toString().padStart(2, '0')}:00)`);
  if (isVpnDetected) coreFindings.push(`VPN detected${input.vpnProvider ? ` [${input.vpnProvider}]` : ''}`);

  const coreSummary = coreFindings.length > 0 
    ? ` Core parameter flags: ${coreFindings.join(', ')}.`
    : '';

  const explanation = signals.length === 0
    ? 'No suspicious indicators detected. Login appears consistent with user baseline across IP, location, timeline, and network.'
    : `Detected ${signals.length} risk indicator(s): ${topSignals}.${coreSummary} ` +
      `Risk score: ${score}/100. ` +
      (level === 'critical' ? 'Immediate investigation recommended.' :
       level === 'high' ? 'Investigation recommended.' :
       'Review and monitor.');

  const summary = signals.length === 0
    ? 'Normal authentication event'
    : signals.length === 1
    ? signals[0].name
    : `${signals.length} suspicious indicators detected`;

  return { score, level, confidence, signals, explanation, summary };
}

// ─── Level Labels ─────────────────────────────────────────────────────────────

export function getRiskLevelLabel(level: RiskLevel): string {
  const labels: Record<RiskLevel, string> = {
    safe: 'Safe',
    suspicious: 'Suspicious',
    high: 'High Risk',
    critical: 'Critical',
  };
  return labels[level];
}

export function getRiskLevelColor(level: RiskLevel): string {
  const colors: Record<RiskLevel, string> = {
    safe: '#10B981',
    suspicious: '#F59E0B',
    high: '#F97316',
    critical: '#EF4444',
  };
  return colors[level];
}
