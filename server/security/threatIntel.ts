// ─── Threat Intelligence Mock Service ─────────────────────────────────────────
// Uses documentation/test IP ranges only. No real malicious infrastructure.

export interface ThreatIntelResult {
  ip: string;
  reputation: 'clean' | 'suspicious' | 'malicious';
  isVPN: boolean;
  vpnDetected: 'detected' | 'not_detected' | 'unknown';
  vpnProvider: string | null;
  isTor: boolean;
  isProxy: boolean;
  isHosting: boolean;
  riskCategory: string | null;
  abuseScore: number; // 0–100
  isp: string | null;
  asn: string | null;
  tags: string[];
}

// Known VPN/Tor/Proxy IP prefixes (RFC 5737 documentation ranges & synthetic test IPs)
const BLACKLISTED_PREFIXES = [
  '203.0.113',   // TEST-NET-3 (RFC 5737)
  '198.51.100',  // TEST-NET-2 (RFC 5737)
  '192.0.2',     // TEST-NET-1 (RFC 5737)
];

const VPN_PREFIXES = [
  '10.8',          // OpenVPN common range
  '172.16',        // Private (VPN simulation)
  '185.22.91',     // Commercial VPN Privacy Egress (Mullvad / NordVPN test range)
  '103.21.45.50',  // Synthetic Test Case 2 Corporate VPN
];

const TOR_PREFIXES = [
  '185.220',  // Known Tor exit range pattern (simulated)
  '51.158',   // Simulated Tor range
];

const PROXY_PREFIXES = [
  '195.154',  // Simulated proxy
  '89.233',   // Simulated proxy
];

const HOSTING_PREFIXES = [
  '104.21',   // Simulated hosting/CDN
  '172.67',   // Simulated hosting
];

// ISP/ASN simulation mapping
const ISP_MAP: Record<string, { isp: string; asn: string; vpnProvider?: string }> = {
  '203.0.113': { isp: 'AttackerISP Ltd', asn: 'AS64496' },
  '198.51.100': { isp: 'ShadowNet Hosting', asn: 'AS64497' },
  '192.0.2': { isp: 'DarkProxy Services', asn: 'AS64498' },
  '10.8': { isp: 'Corporate VPN Gateway', asn: 'AS64499', vpnProvider: 'Corporate OpenVPN Access Server' },
  '103.21.45.50': { isp: 'SecureTunnel Corporate Hub', asn: 'AS64499', vpnProvider: 'Fortinet SSL-VPN Gateway' },
  '103.21.45.10': { isp: 'Airtel Broadband India', asn: 'AS9498' },
  '185.22.91': { isp: 'Datacenter Privacy Hosting', asn: 'AS60068', vpnProvider: 'Commercial Privacy VPN Egress (Mullvad/NordVPN)' },
  '185.220': { isp: 'Tor Exit Node Operator', asn: 'AS64500' },
};

export function checkThreatIntel(ip: string): ThreatIntelResult {
  if (!ip || ip === 'unknown' || ip === '0.0.0.0') {
    return {
      ip: ip || 'unknown',
      reputation: 'clean',
      isVPN: false,
      vpnDetected: 'unknown',
      vpnProvider: null,
      isTor: false,
      isProxy: false,
      isHosting: false,
      riskCategory: null,
      abuseScore: 0,
      isp: 'Unknown Provider',
      asn: null,
      tags: [],
    };
  }

  const parts = ip.split('.');
  const prefix2 = `${parts[0]}.${parts[1]}`;
  const prefix3 = `${parts[0]}.${parts[1]}.${parts[2]}`;

  const isBlacklisted = BLACKLISTED_PREFIXES.some(p => prefix3.startsWith(p) || ip === p);
  const isVPN = VPN_PREFIXES.some(p => ip === p || prefix3.startsWith(p) || prefix2.startsWith(p));
  const isTor = TOR_PREFIXES.some(p => ip === p || prefix2.startsWith(p));
  const isProxy = PROXY_PREFIXES.some(p => ip === p || prefix2.startsWith(p));
  const isHosting = HOSTING_PREFIXES.some(p => ip === p || prefix2.startsWith(p));

  let reputation: 'clean' | 'suspicious' | 'malicious' = 'clean';
  let abuseScore = 0;
  const tags: string[] = [];

  if (isBlacklisted) {
    reputation = 'malicious';
    abuseScore = 85 + Math.floor(Math.random() * 15);
    tags.push('blacklisted', 'known-attacker');
  } else if (isTor) {
    reputation = 'suspicious';
    abuseScore = 70 + Math.floor(Math.random() * 20);
    tags.push('tor-exit-node');
  } else if (isProxy) {
    reputation = 'suspicious';
    abuseScore = 55 + Math.floor(Math.random() * 25);
    tags.push('open-proxy');
  } else if (isVPN) {
    reputation = 'suspicious';
    abuseScore = 20 + Math.floor(Math.random() * 20);
    tags.push('vpn');
  } else if (isHosting) {
    reputation = 'suspicious';
    abuseScore = 30 + Math.floor(Math.random() * 20);
    tags.push('hosting-provider');
  }

  const ispMatch = Object.entries(ISP_MAP).find(([prefix]) => ip === prefix || prefix3.startsWith(prefix) || prefix2.startsWith(prefix));
  const ispInfo = ispMatch?.[1];

  const hasVpn = isVPN || tags.includes('vpn');
  const vpnDetected: 'detected' | 'not_detected' | 'unknown' = hasVpn ? 'detected' : 'not_detected';
  const vpnProvider = hasVpn ? (ispInfo?.vpnProvider ?? 'Threat Intelligence Engine (VPN ASN/Prefix DB)') : null;

  return {
    ip,
    reputation,
    isVPN: hasVpn,
    vpnDetected,
    vpnProvider,
    isTor,
    isProxy,
    isHosting,
    riskCategory: tags.length > 0 ? tags[0] : null,
    abuseScore,
    isp: ispInfo?.isp ?? 'Standard Internet Access Provider',
    asn: ispInfo?.asn ?? null,
    tags,
  };
}

// For external geolocation enrichment (falls back gracefully)
export async function fetchGeoLocation(ip: string): Promise<{
  country: string; city: string; lat: number; lng: number;
} | null> {
  try {
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=country,city,lat,lon,status`, {
      signal: AbortSignal.timeout(3000),
    });
    const data = await response.json() as any;
    if (data.status === 'success') {
      return { country: data.country, city: data.city, lat: data.lat, lng: data.lon };
    }
    return null;
  } catch {
    return null;
  }
}
