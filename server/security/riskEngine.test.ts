import { calculateRisk, RiskCalculationInput } from './riskEngine';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

console.log('🧪 Starting SentinelTrace Risk Engine Unit Tests...\n');

// 1. Safe baseline test
const safeInput: RiskCalculationInput = {
  userId: 'user-001',
  timestamp: '2026-09-23T10:00:00Z',
  ip: '203.0.113.10',
  isVPN: false,
  isTor: false,
  isProxy: false,
  ipReputation: 'clean',
  country: 'India',
  city: 'Bengaluru',
  lat: 12.97,
  lng: 77.59,
  isNewCountry: false,
  isNewCity: false,
  device: 'MacBook Pro',
  browser: 'Chrome',
  os: 'macOS',
  isMobile: false,
  isNewDevice: false,
  isNewBrowser: false,
  result: 'success',
  baseline: {
    knownCountries: ['India'],
    knownCities: ['Bengaluru'],
    knownDevices: ['MacBook Pro'],
    knownBrowsers: ['Chrome'],
    knownIps: ['203.0.113.10'],
    typicalLoginStart: 9,
    typicalLoginEnd: 18,
    typicalDays: [1, 2, 3, 4, 5],
  },
  recentEvents: [],
};

const safeResult = calculateRisk(safeInput);
assert(safeResult.score <= 35, `Safe login risk score (${safeResult.score}) is <= 35`);
assert(safeResult.level === 'safe', `Safe login risk level is 'safe'`);
assert(safeResult.signals.length === 0, `Safe login has 0 risk signals`);

// 2. Tor exit node test
const torInput: RiskCalculationInput = {
  ...safeInput,
  isTor: true,
  ipReputation: 'malicious',
  signals: [],
};

const torResult = calculateRisk(torInput);
assert(torResult.score >= 50, `Tor login risk score (${torResult.score}) is >= 50`);
assert(torResult.signals.some(s => s.id === 'tor_exit_node' || s.name.toLowerCase().includes('tor')), 'Tor exit node signal detected');

// 3. Impossible travel test
const prevEvent = {
  id: 'ev-prev',
  user_id: 'user-001',
  timestamp: '2026-09-23T09:30:00Z', // 30 minutes earlier
  ip: '203.0.113.10',
  country: 'India',
  city: 'Bengaluru',
  lat: 12.97,
  lng: 77.59,
  device: 'MacBook Pro',
  browser: 'Chrome',
  os: 'macOS',
  is_mobile: false,
  is_vpn: false,
  is_tor: false,
  is_proxy: false,
  ip_reputation: 'clean' as const,
  is_new_country: false,
  is_new_city: false,
  is_new_device: false,
  is_new_browser: false,
  result: 'success' as const,
  risk_score: 10,
  risk_level: 'safe' as const,
  confidence: 0.9,
  signals: [],
};

const impossibleTravelInput: RiskCalculationInput = {
  ...safeInput,
  timestamp: '2026-09-23T10:00:00Z', // 30 minutes later in Frankfurt (distance ~7,500km)
  country: 'Germany',
  city: 'Frankfurt',
  lat: 50.11,
  lng: 8.68,
  isNewCountry: true,
  isNewCity: true,
  recentEvents: [prevEvent],
};

const travelResult = calculateRisk(impossibleTravelInput);
assert(travelResult.score >= 50, `Impossible travel risk score (${travelResult.score}) is >= 50`);
assert(travelResult.signals.some(s => s.id === 'impossible_travel' || s.name.toLowerCase().includes('travel')), 'Impossible travel signal detected');

// 4. Brute force failed attempts test
const bruteForceRecentEvents = Array.from({ length: 6 }, (_, i) => ({
  ...prevEvent,
  id: `fail-${i}`,
  timestamp: new Date(Date.now() - (6 - i) * 60 * 1000).toISOString(),
  result: 'failure' as const,
}));

const bruteForceInput: RiskCalculationInput = {
  ...safeInput,
  result: 'failure',
  failureReason: 'Invalid credentials',
  recentEvents: bruteForceRecentEvents,
};

const bruteForceResult = calculateRisk(bruteForceInput);
assert(bruteForceResult.score >= 25, `Brute force risk score (${bruteForceResult.score}) is elevated (>= 25)`);
assert(bruteForceResult.signals.some(s => s.id === 'brute_force_attempt'), 'Brute force repeated attempts signal detected');

// ── 5. Ten Core Parameter Combinations (Section 19 Verification) ─────────────
console.log('\n🔍 Testing 10 Core Parameter Combinations...');

const baselineU101 = {
  knownCountries: ['India'],
  knownCities: ['Bengaluru'],
  knownDevices: ['MacBook Pro'],
  knownBrowsers: ['Chrome'],
  knownIps: ['103.21.45.10'],
  typicalLoginStart: 8,
  typicalLoginEnd: 22,
  typicalDays: [1, 2, 3, 4, 5],
};

// Helper for reliable local odd hour
function makeOddHourDate() {
  const d = new Date();
  d.setHours(2, 49, 0, 0);
  return d.toISOString();
}

function makeNormalHourDate() {
  const d = new Date();
  d.setHours(10, 0, 0, 0);
  return d.toISOString();
}

function makeTestEvent(overrides: Partial<any> = {}) {
  return {
    userId: 'U101',
    timestamp: makeNormalHourDate(),
    ip: '103.21.45.10', // known IP
    country: 'India',
    city: 'Bengaluru',
    lat: 12.97,
    lng: 77.59,
    device: 'MacBook Pro',
    browser: 'Chrome',
    os: 'macOS',
    isMobile: false,
    result: 'success' as const,
    isVPN: false,
    vpnDetected: 'not_detected' as const,
    isTor: false,
    isProxy: false,
    ipReputation: 'clean' as const,
    isNewDevice: false,
    isNewCountry: false,
    isNewCity: false,
    isNewBrowser: false,
    isNewIp: false,
    typicalLoginStart: 8,
    typicalLoginEnd: 22,
    typicalDays: [1, 2, 3, 4, 5],
    knownCountries: ['India'],
    knownIps: ['103.21.45.10'],
    baseline: baselineU101,
    ...overrides,
  };
}

// Case 1: Known IP + Normal Loc + Normal Time + No VPN -> SAFE
const c1 = calculateRisk(makeTestEvent());
assert(c1.level === 'safe' && c1.score < 20, `Case 1: SAFE (${c1.score})`);

// Case 2: Known IP + Normal Loc + Normal Time + VPN Detected -> SAFE / Low Suspicious (Signal, not compromise)
const c2 = calculateRisk(makeTestEvent({ isVPN: true, vpnDetected: 'detected', vpnProvider: 'Corporate Gateway' }));
assert(c2.signals.some(s => s.id === 'vpn'), 'Case 2: VPN detected signal emitted');
assert(c2.score <= 35, `Case 2: Low risk (${c2.score}), not treated as immediate compromise`);

// Case 3: New IP + Normal Loc + Normal Time + No VPN -> Low/Moderate Risk
const c3 = calculateRisk(makeTestEvent({ ip: '103.21.45.99', isNewIp: true }));
assert(c3.signals.some(s => s.id === 'new_ip'), 'Case 3: New IP signal emitted');

// Case 4: New IP + Normal Loc + Normal Time + VPN Detected -> SUSPICIOUS
const c4 = calculateRisk(makeTestEvent({ ip: '185.22.91.44', isNewIp: true, isVPN: true, vpnDetected: 'detected' }));
assert(c4.signals.some(s => s.id === 'new_ip') && c4.signals.some(s => s.id === 'vpn'), 'Case 4: New IP + VPN signals emitted');
assert(c4.score >= 18, `Case 4: Score elevated (${c4.score})`);

// Case 5: Known IP + Unusual Loc + Normal Time + No VPN -> SUSPICIOUS
const c5 = calculateRisk(makeTestEvent({ country: 'Germany', city: 'Berlin', isNewCountry: true, isNewCity: true }));
assert(c5.signals.some(s => s.id === 'new_country'), 'Case 5: New country signal emitted');
assert(c5.score >= 20, `Case 5: Score elevated for unusual location (${c5.score})`);

// Case 6: Known IP + Unusual Loc + Outside Window + No VPN -> HIGH
const c6 = calculateRisk(makeTestEvent({ country: 'Germany', city: 'Berlin', isNewCountry: true, isNewCity: true, timestamp: makeOddHourDate() }));
assert(c6.signals.some(s => s.id === 'new_country') && c6.signals.some(s => s.id === 'odd_hour'), 'Case 6: New country + odd hour');
assert(c6.score >= 30, `Case 6: Score high (${c6.score})`);

// Case 7: New IP + Unusual Loc + Normal Time + No VPN -> HIGH
const c7 = calculateRisk(makeTestEvent({ ip: '185.22.91.44', isNewIp: true, country: 'Germany', city: 'Berlin', isNewCountry: true, isNewCity: true }));
assert(c7.signals.some(s => s.id === 'new_ip') && c7.signals.some(s => s.id === 'new_country'), 'Case 7: New IP + New Country');

// Case 8: New IP + Unusual Loc + Outside Window + No VPN -> HIGH / CRITICAL
const c8 = calculateRisk(makeTestEvent({ ip: '185.22.91.44', isNewIp: true, country: 'Russia', city: 'Moscow', isNewCountry: true, isNewCity: true, timestamp: makeOddHourDate() }));
assert(c8.score >= 38, `Case 8: High risk (${c8.score})`);

// Case 9: New IP + Normal Loc + Outside Window + VPN Detected -> HIGH
const c9 = calculateRisk(makeTestEvent({ ip: '185.22.91.44', isNewIp: true, timestamp: makeOddHourDate(), isVPN: true, vpnDetected: 'detected' }));
assert(c9.signals.some(s => s.id === 'new_ip') && c9.signals.some(s => s.id === 'odd_hour') && c9.signals.some(s => s.id === 'vpn'), 'Case 9: 3 flags active');

// Case 10: New IP + Unusual Loc + Outside Window + VPN Detected -> CRITICAL (All 4 Core Parameters)
const c10 = calculateRisk(makeTestEvent({
  ip: '185.22.91.44',
  isNewIp: true,
  country: 'Russia',
  city: 'Moscow',
  isNewCountry: true,
  isNewCity: true,
  isNewDevice: true,
  device: 'Unknown Linux',
  timestamp: makeOddHourDate(),
  isVPN: true,
  vpnDetected: 'detected',
  vpnProvider: 'NordSec Ltd',
  ipReputation: 'suspicious',
}));
assert(c10.score >= 70, `Case 10: Critical risk score (${c10.score}/100)`);
assert(c10.signals.some(s => s.id === 'new_ip'), 'Case 10: Flag 1 (IP) present');
assert(c10.signals.some(s => s.id === 'new_country'), 'Case 10: Flag 2 (Location) present');
assert(c10.signals.some(s => s.id === 'odd_hour'), 'Case 10: Flag 3 (Timeline) present');
assert(c10.signals.some(s => s.id === 'vpn'), 'Case 10: Flag 4 (VPN) present');
assert(c10.explanation.includes('Core parameter flags:'), 'Case 10: Explanation articulates core parameter flags');

console.log('\n🎉 All Risk Engine unit tests and 10 parameter combinations passed successfully!\n');
