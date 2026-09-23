// ─── Seed Data ────────────────────────────────────────────────────────────────
// Creates 15 synthetic users, 150+ login events, 8 attack storylines,
// pre-generated alerts and cases with full relationships.

import { v4 as uuidv4 } from 'uuid';
import { initializeDatabase, db, sqlite } from './database';
import { calculateRisk } from '../security/riskEngine';
import { generateDeviceFingerprint, calculateRiskTrend } from '../security/behaviorEngine';
import { checkThreatIntel } from '../security/threatIntel';
import { CITY_COORDS } from '../security/geoService';
import { hashPassword } from '../security/auth';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysAgo(n: number, hour = 9, minute = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function hoursAgo(n: number): string {
  return new Date(Date.now() - n * 3600 * 1000).toISOString();
}

function minutesAgo(n: number): string {
  return new Date(Date.now() - n * 60 * 1000).toISOString();
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateIP(a: number, b: number, c?: number, d?: number): string {
  return `${a}.${b}.${c ?? randomBetween(1, 254)}.${d ?? randomBetween(1, 254)}`;
}

// ─── Synthetic Users ──────────────────────────────────────────────────────────

const USERS = [
  {
    id: 'U101', name: 'User U101', email: 'u101@company.com',
    department: 'Core Infrastructure', role: 'Staff Security Engineer', avatarColor: '#06B6D4',
    homeCity: 'Bengaluru', homeCountry: 'India',
    knownDevices: ['MacBook Pro', 'FP-MACPRO-U101'],
    knownBrowsers: ['Chrome', 'Firefox'],
    knownIps: ['103.21.45.10'],
    typicalLoginStart: 8, typicalLoginEnd: 22, typicalDays: [1, 2, 3, 4, 5],
  },
  {
    id: 'usr-001', name: 'Arjun Rao', email: 'arjun.rao@company.com',
    department: 'Engineering', role: 'Senior Developer', avatarColor: '#3B82F6',
    homeCity: 'Bengaluru', homeCountry: 'India',
    knownDevices: ['MacBook Pro', 'FP-MACPRO01'],
    knownBrowsers: ['Chrome', 'Safari'],
    knownIps: ['49.36.100.10', '49.36.100.11'],
    typicalLoginStart: 8, typicalLoginEnd: 19, typicalDays: [1, 2, 3, 4, 5],
  },
  {
    id: 'usr-002', name: 'Priya Sharma', email: 'priya.sharma@company.com',
    department: 'Finance', role: 'Finance Manager', avatarColor: '#10B981',
    homeCity: 'Mumbai', homeCountry: 'India',
    knownDevices: ['Windows Laptop', 'FP-WIN01'],
    knownBrowsers: ['Chrome', 'Edge'],
    knownIps: ['103.24.80.5', '103.24.80.6'],
    typicalLoginStart: 9, typicalLoginEnd: 18, typicalDays: [1, 2, 3, 4, 5],
  },
  {
    id: 'usr-003', name: 'Rahul Mehta', email: 'rahul.mehta@company.com',
    department: 'Engineering', role: 'DevOps Engineer', avatarColor: '#8B5CF6',
    homeCity: 'Hyderabad', homeCountry: 'India',
    knownDevices: ['Linux Desktop', 'FP-LINUX01'],
    knownBrowsers: ['Firefox', 'Chrome'],
    knownIps: ['117.55.240.10'],
    typicalLoginStart: 7, typicalLoginEnd: 20, typicalDays: [1, 2, 3, 4, 5, 6],
  },
  {
    id: 'usr-004', name: 'Sneha Patel', email: 'sneha.patel@company.com',
    department: 'HR', role: 'HR Business Partner', avatarColor: '#F59E0B',
    homeCity: 'Pune', homeCountry: 'India',
    knownDevices: ['MacBook Pro', 'FP-MACPRO02'],
    knownBrowsers: ['Safari', 'Chrome'],
    knownIps: ['45.114.100.20'],
    typicalLoginStart: 9, typicalLoginEnd: 17, typicalDays: [1, 2, 3, 4, 5],
  },
  {
    id: 'usr-005', name: 'Vikram Singh', email: 'vikram.singh@company.com',
    department: 'Sales', role: 'Regional Sales Director', avatarColor: '#EF4444',
    homeCity: 'Delhi', homeCountry: 'India',
    knownDevices: ['Windows Laptop', 'iPad', 'FP-WIN02'],
    knownBrowsers: ['Chrome', 'Edge', 'Safari'],
    knownIps: ['59.90.145.30', '59.90.145.31'],
    typicalLoginStart: 7, typicalLoginEnd: 21, typicalDays: [1, 2, 3, 4, 5, 6],
  },
  {
    id: 'usr-006', name: 'Ananya Krishnan', email: 'ananya.krishnan@company.com',
    department: 'Engineering', role: 'Full-Stack Developer', avatarColor: '#EC4899',
    homeCity: 'Chennai', homeCountry: 'India',
    knownDevices: ['MacBook Pro', 'FP-MACPRO03'],
    knownBrowsers: ['Chrome', 'Firefox'],
    knownIps: ['49.204.75.100'],
    typicalLoginStart: 9, typicalLoginEnd: 18, typicalDays: [1, 2, 3, 4, 5],
  },
  {
    id: 'usr-007', name: 'Rohan Gupta', email: 'rohan.gupta@company.com',
    department: 'Engineering', role: 'Security Engineer', avatarColor: '#14B8A6',
    homeCity: 'Bengaluru', homeCountry: 'India',
    knownDevices: ['Linux Desktop', 'MacBook Pro', 'FP-LINUX02'],
    knownBrowsers: ['Firefox', 'Brave'],
    knownIps: ['49.36.200.50'],
    typicalLoginStart: 8, typicalLoginEnd: 20, typicalDays: [1, 2, 3, 4, 5],
  },
  {
    id: 'usr-008', name: 'Kavya Nair', email: 'kavya.nair@company.com',
    department: 'Marketing', role: 'Digital Marketing Manager', avatarColor: '#F97316',
    homeCity: 'Bengaluru', homeCountry: 'India',
    knownDevices: ['Windows Laptop', 'Android Phone', 'FP-WIN03'],
    knownBrowsers: ['Chrome', 'Samsung Internet'],
    knownIps: ['103.195.45.20'],
    typicalLoginStart: 9, typicalLoginEnd: 17, typicalDays: [1, 2, 3, 4, 5],
  },
  {
    id: 'usr-009', name: 'Aditya Kumar', email: 'aditya.kumar@company.com',
    department: 'Product', role: 'Product Manager', avatarColor: '#6366F1',
    homeCity: 'Mumbai', homeCountry: 'India',
    knownDevices: ['MacBook Pro', 'iPad', 'FP-MACPRO04'],
    knownBrowsers: ['Safari', 'Chrome'],
    knownIps: ['103.24.90.15'],
    typicalLoginStart: 8, typicalLoginEnd: 20, typicalDays: [1, 2, 3, 4, 5],
  },
  {
    id: 'usr-010', name: 'Divya Reddy', email: 'divya.reddy@company.com',
    department: 'Legal', role: 'Senior Legal Counsel', avatarColor: '#84CC16',
    homeCity: 'Hyderabad', homeCountry: 'India',
    knownDevices: ['Windows Laptop', 'FP-WIN04'],
    knownBrowsers: ['Edge', 'Chrome'],
    knownIps: ['117.55.250.40'],
    typicalLoginStart: 9, typicalLoginEnd: 17, typicalDays: [1, 2, 3, 4, 5],
  },
  {
    id: 'usr-011', name: 'Sanjay Verma', email: 'sanjay.verma@company.com',
    department: 'Finance', role: 'CFO', avatarColor: '#A78BFA',
    homeCity: 'Delhi', homeCountry: 'India',
    knownDevices: ['MacBook Pro', 'iPhone', 'FP-MACPRO05'],
    knownBrowsers: ['Safari', 'Chrome'],
    knownIps: ['59.90.160.80'],
    typicalLoginStart: 7, typicalLoginEnd: 21, typicalDays: [1, 2, 3, 4, 5],
  },
  {
    id: 'usr-012', name: 'Meera Joshi', email: 'meera.joshi@company.com',
    department: 'Engineering', role: 'Data Scientist', avatarColor: '#34D399',
    homeCity: 'Pune', homeCountry: 'India',
    knownDevices: ['Linux Desktop', 'MacBook Pro', 'FP-LINUX03'],
    knownBrowsers: ['Chrome', 'Firefox'],
    knownIps: ['45.114.110.30'],
    typicalLoginStart: 9, typicalLoginEnd: 19, typicalDays: [1, 2, 3, 4, 5],
  },
  {
    id: 'usr-013', name: 'Karthik Rajan', email: 'karthik.rajan@company.com',
    department: 'Engineering', role: 'Backend Engineer', avatarColor: '#FB923C',
    homeCity: 'Chennai', homeCountry: 'India',
    knownDevices: ['Linux Desktop', 'FP-LINUX04'],
    knownBrowsers: ['Firefox', 'Chrome'],
    knownIps: ['49.204.80.60'],
    typicalLoginStart: 8, typicalLoginEnd: 18, typicalDays: [1, 2, 3, 4, 5],
  },
  {
    id: 'usr-014', name: 'Pooja Bhatt', email: 'pooja.bhatt@company.com',
    department: 'Operations', role: 'Operations Lead', avatarColor: '#60A5FA',
    homeCity: 'Mumbai', homeCountry: 'India',
    knownDevices: ['Windows Laptop', 'FP-WIN05'],
    knownBrowsers: ['Chrome', 'Firefox'],
    knownIps: ['103.24.85.25'],
    typicalLoginStart: 8, typicalLoginEnd: 18, typicalDays: [1, 2, 3, 4, 5],
  },
  {
    id: 'usr-015', name: 'Nikhil Desai', email: 'nikhil.desai@company.com',
    department: 'Engineering', role: 'Mobile Developer', avatarColor: '#F472B6',
    homeCity: 'Bengaluru', homeCountry: 'India',
    knownDevices: ['MacBook Pro', 'Android Phone', 'FP-MACPRO06'],
    knownBrowsers: ['Chrome', 'Safari'],
    knownIps: ['49.36.205.70'],
    typicalLoginStart: 9, typicalLoginEnd: 18, typicalDays: [1, 2, 3, 4, 5],
  },
];

// ─── Helper: Insert Event ──────────────────────────────────────────────────────

function insertEvent(event: {
  id: string;
  userId: string;
  timestamp: string;
  ip: string;
  isVPN?: boolean;
  isTor?: boolean;
  isProxy?: boolean;
  ipReputation?: string;
  asn?: string;
  isp?: string;
  country: string;
  city: string;
  lat?: number;
  lng?: number;
  isNewCountry?: boolean;
  isNewCity?: boolean;
  device: string;
  browser: string;
  os: string;
  isMobile?: boolean;
  deviceFingerprint?: string;
  isNewDevice?: boolean;
  isNewBrowser?: boolean;
  result: string;
  failureReason?: string;
  riskScore?: number;
  riskLevel?: string;
  confidence?: number;
  signals?: any[];
  explanation?: string;
  attackScenario?: string;
  isVPN?: boolean;
  vpnDetected?: string;
  isTor?: boolean;
  isProxy?: boolean;
  ipReputation?: string;
  asn?: string;
  isp?: string;
  country: string;
  city: string;
  lat?: number;
  lng?: number;
  isNewCountry?: boolean;
  isNewCity?: boolean;
  device: string;
  browser: string;
  os: string;
  isMobile?: boolean;
  deviceFingerprint?: string;
  isNewDevice?: boolean;
  isNewBrowser?: boolean;
  result: string;
  failureReason?: string;
  riskScore?: number;
  riskLevel?: string;
  confidence?: number;
  signals?: any[];
  explanation?: string;
  attackScenario?: string;
  correlationId?: string;
}) {
  const coords = CITY_COORDS[event.city] ?? { lat: 0, lng: 0 };
  const fp = event.deviceFingerprint ?? generateDeviceFingerprint(
    event.device, event.browser, event.os, event.isMobile ?? false
  );
  const vpnStatus = event.vpnDetected ?? (event.isVPN ? 'detected' : 'not_detected');

  sqlite.prepare(`
    INSERT OR IGNORE INTO login_events (
      id, user_id, timestamp, ip, is_vpn, vpn_detected, is_tor, is_proxy, ip_reputation,
      asn, isp, country, city, lat, lng, is_new_country, is_new_city,
      device, browser, os, is_mobile, device_fingerprint, is_new_device, is_new_browser,
      result, failure_reason, risk_score, risk_level, confidence, signals, explanation,
      attack_scenario, correlation_id
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?
    )
  `).run(
    event.id, event.userId, event.timestamp, event.ip,
    event.isVPN ? 1 : 0, vpnStatus, event.isTor ? 1 : 0, event.isProxy ? 1 : 0,
    event.ipReputation ?? 'clean', event.asn ?? null, event.isp ?? null,
    event.country, event.city,
    event.lat ?? coords.lat, event.lng ?? coords.lng,
    event.isNewCountry ? 1 : 0, event.isNewCity ? 1 : 0,
    event.device, event.browser, event.os,
    event.isMobile ? 1 : 0, fp,
    event.isNewDevice ? 1 : 0, event.isNewBrowser ? 1 : 0,
    event.result, event.failureReason ?? null,
    event.riskScore ?? 0, event.riskLevel ?? 'safe',
    event.confidence ?? 0,
    JSON.stringify(event.signals ?? []), event.explanation ?? null,
    event.attackScenario ?? null, event.correlationId ?? null
  );
}

function insertAlert(alert: {
  id: string;
  alertType: string;
  title: string;
  description: string;
  severity: string;
  status?: string;
  userId: string;
  relatedEventIds: string[];
  riskScore: number;
  confidence: number;
  signals: any[];
  explanation?: string;
  firstSeen: string;
  lastSeen: string;
  caseId?: string;
}) {
  sqlite.prepare(`
    INSERT OR IGNORE INTO alerts (
      id, alert_type, title, description, severity, status, user_id,
      related_event_ids, risk_score, confidence, signals, explanation,
      first_seen, last_seen, case_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    alert.id, alert.alertType, alert.title, alert.description,
    alert.severity, alert.status ?? 'open', alert.userId,
    JSON.stringify(alert.relatedEventIds),
    alert.riskScore, alert.confidence,
    JSON.stringify(alert.signals), alert.explanation ?? null,
    alert.firstSeen, alert.lastSeen, alert.caseId ?? null
  );
}

function insertCase(c: {
  id: string;
  caseNumber: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  assignedAnalyst?: string;
  userId: string;
  relatedAlertIds: string[];
  relatedEventIds: string[];
  evidence: any[];
  riskScore: number;
  confidence: number;
  createdAt: string;
  updatedAt: string;
}) {
  sqlite.prepare(`
    INSERT OR IGNORE INTO cases (
      id, case_number, title, description, severity, status, assigned_analyst,
      user_id, related_alert_ids, related_event_ids, evidence, risk_score, confidence,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    c.id, c.caseNumber, c.title, c.description, c.severity, c.status,
    c.assignedAnalyst ?? null, c.userId,
    JSON.stringify(c.relatedAlertIds), JSON.stringify(c.relatedEventIds),
    JSON.stringify(c.evidence), c.riskScore, c.confidence,
    c.createdAt, c.updatedAt
  );
}

function insertNote(note: {
  id: string; caseId: string; analyst: string; content: string;
  timestamp: string; noteType?: string;
}) {
  sqlite.prepare(`
    INSERT OR IGNORE INTO investigation_notes (id, case_id, analyst, content, timestamp, note_type)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(note.id, note.caseId, note.analyst, note.content, note.timestamp, note.noteType ?? 'note');
}

function insertNotification(n: {
  id: string; type: string; title: string; message: string;
  severity: string; entityType?: string; entityId?: string; createdAt: string;
}) {
  sqlite.prepare(`
    INSERT OR IGNORE INTO notifications (id, type, title, message, severity, entity_type, entity_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(n.id, n.type, n.title, n.message, n.severity, n.entityType ?? null, n.entityId ?? null, n.createdAt);
}

function insertAuditLog(log: {
  id: string; action: string; entityType: string; entityId: string;
  analyst: string; details: any; timestamp: string;
}) {
  sqlite.prepare(`
    INSERT OR IGNORE INTO audit_logs (id, action, entity_type, entity_id, analyst, details, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(log.id, log.action, log.entityType, log.entityId, log.analyst, JSON.stringify(log.details), log.timestamp);
}

// ─── Main Seed Function ───────────────────────────────────────────────────────

export function seedDatabase() {
  // Check if already seeded
  const existingUsers = sqlite.prepare('SELECT COUNT(*) as count FROM users').get() as any;
  const existingU101 = sqlite.prepare("SELECT id FROM users WHERE id = 'U101'").get() as any;

  if (existingUsers.count > 0) {
    if (!existingU101) {
      console.log('📊 Database already seeded, but U101 is missing. Backfilling U101 benchmark...');
      seedU101Benchmark();
    } else {
      console.log('📊 Database already seeded, skipping...');
    }
    return;
  }

  console.log('🌱 Seeding database...');

  // ── Insert Users ───────────────────────────────────────────────────────────
  for (const u of USERS) {
    const coords = CITY_COORDS[u.homeCity] ?? { lat: 0, lng: 0 };
    sqlite.prepare(`
      INSERT OR IGNORE INTO users (
        id, name, email, department, role, avatar_color,
        known_countries, known_cities, known_devices, known_browsers, known_ips,
        typical_login_start, typical_login_end, typical_days,
        current_risk, risk_level, risk_trend,
        total_logins, failed_logins, last_login, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      u.id, u.name, u.email, u.department, u.role, u.avatarColor,
      JSON.stringify([u.homeCountry]),
      JSON.stringify([u.homeCity]),
      JSON.stringify(u.knownDevices),
      JSON.stringify(u.knownBrowsers),
      JSON.stringify(u.knownIps),
      u.typicalLoginStart, u.typicalLoginEnd, JSON.stringify(u.typicalDays),
      0, 'safe', JSON.stringify([0, 0, 0, 0, 0, 0, 0]),
      0, 0, null, daysAgo(60)
    );
  }

  // ─── Generate Normal Login Events (last 30 days, ~4–6 per user) ───────────
  // Each user gets regular, clean login events

  const normalEvents: string[] = [];

  for (const u of USERS) {
    const coords = CITY_COORDS[u.homeCity] ?? { lat: 0, lng: 0 };
    const eventsPerUser = randomBetween(12, 20);

    for (let i = 0; i < eventsPerUser; i++) {
      const daysBack = randomBetween(1, 28);
      const hour = randomBetween(u.typicalLoginStart, Math.min(u.typicalLoginEnd, 18));
      const minute = randomBetween(0, 59);
      const ip = randomItem(u.knownIps);
      const device = randomItem(u.knownDevices.filter(d => !d.startsWith('FP-')));
      const browser = randomItem(u.knownBrowsers);
      const os = device.includes('Mac') ? 'macOS' :
                 device.includes('Linux') ? 'Linux' :
                 device.includes('iPad') || device.includes('iPhone') ? 'iOS' :
                 device.includes('Android') ? 'Android' : 'Windows 11';

      const id = uuidv4();
      normalEvents.push(id);
      insertEvent({
        id, userId: u.id,
        timestamp: daysAgo(daysBack, hour, minute),
        ip, country: u.homeCountry, city: u.homeCity,
        lat: coords.lat, lng: coords.lng,
        device, browser, os,
        isMobile: device.includes('Phone') || device.includes('iPad'),
        result: 'success',
        riskScore: randomBetween(0, 15),
        riskLevel: 'safe',
        confidence: 0.1,
        signals: [],
        explanation: 'Normal authentication event — consistent with user behavior',
      });
    }

    // Some failed logins (normal user mistakes)
    const failCount = randomBetween(1, 3);
    for (let i = 0; i < failCount; i++) {
      const daysBack = randomBetween(1, 20);
      const ip = randomItem(u.knownIps);
      const device = randomItem(u.knownDevices.filter(d => !d.startsWith('FP-')));
      const browser = randomItem(u.knownBrowsers);

      insertEvent({
        id: uuidv4(), userId: u.id,
        timestamp: daysAgo(daysBack, randomBetween(8, 18), randomBetween(0, 59)),
        ip, country: u.homeCountry, city: u.homeCity,
        device, browser, os: 'macOS',
        result: 'failure',
        failureReason: 'Invalid password',
        riskScore: 5,
        riskLevel: 'safe',
        confidence: 0.1,
        signals: [],
      });
    }
  }

  // ═══ ATTACK STORYLINES ════════════════════════════════════════════════════

  // ── STORYLINE 1: Arjun Rao — Impossible Travel ────────────────────────────
  // Arjun normally logs in from Bengaluru. Attacker uses stolen credentials
  // and logs in from Berlin 22 minutes after Arjun's last normal login.

  const arjun = USERS[0]; // usr-001
  const arjunCoords = CITY_COORDS['Bengaluru']!;
  const berlinCoords = CITY_COORDS['Berlin']!;

  const ev_arjun_normal = uuidv4();
  insertEvent({
    id: ev_arjun_normal, userId: arjun.id,
    timestamp: hoursAgo(2.8),
    ip: '49.36.100.10',
    country: 'India', city: 'Bengaluru',
    lat: arjunCoords.lat, lng: arjunCoords.lng,
    device: 'MacBook Pro', browser: 'Chrome', os: 'macOS',
    result: 'success',
    riskScore: 5, riskLevel: 'safe', confidence: 0.1, signals: [],
    explanation: 'Normal login from known location and device',
  });

  const impossibleTravelSignal = [{
    id: 'impossible_travel', name: 'Impossible Travel', category: 'location',
    description: 'Login from Bengaluru then Berlin in 22 minutes',
    points: 40, severity: 'critical',
    evidence: 'Distance: 7,170 km | Time: 22 min | Required speed: 19,554 km/h',
  }, {
    id: 'new_country', name: 'New Country', category: 'location',
    description: 'Germany not previously observed for this user',
    points: 20, severity: 'high',
    evidence: 'Known countries: India',
  }, {
    id: 'new_device', name: 'New Device', category: 'device',
    description: 'Unrecognized device: Windows Laptop / Windows 11',
    points: 15, severity: 'medium',
    evidence: 'Device fingerprint not in user\'s known devices',
  }, {
    id: 'odd_hour', name: 'Unusual Login Time', category: 'time',
    description: 'Login at 03:xx — outside user\'s typical hours',
    points: 10, severity: 'low',
    evidence: 'User typically logs in 08:00–19:00. This login at 03:14.',
  }, {
    id: 'behavioral_anomaly', name: 'Behavioral Anomaly', category: 'behavioral',
    description: 'New country AND new device combination — highly unusual',
    points: 15, severity: 'high',
    evidence: 'First time observing Germany with Windows Laptop for this account',
  }];

  const ev_arjun_berlin = uuidv4();
  insertEvent({
    id: ev_arjun_berlin, userId: arjun.id,
    timestamp: hoursAgo(2.4),
    ip: '203.0.113.45', ipReputation: 'malicious',
    country: 'Germany', city: 'Berlin',
    lat: berlinCoords.lat, lng: berlinCoords.lng,
    isNewCountry: true, isNewCity: true, isNewDevice: true,
    device: 'Windows Laptop', browser: 'Chrome', os: 'Windows 11',
    isVPN: false,
    result: 'success',
    riskScore: 85, riskLevel: 'critical', confidence: 0.93,
    signals: impossibleTravelSignal,
    explanation: 'CRITICAL: Impossible travel detected. Multiple independent risk indicators suggest potential account compromise.',
    attackScenario: 'impossible_travel',
    correlationId: 'CORR-ARJ-IMPTRAV-001',
  });

  // Alert for Arjun impossible travel
  const alert_arjun_it = uuidv4();
  insertAlert({
    id: alert_arjun_it, alertType: 'impossible_travel',
    title: 'Impossible Travel Detected',
    description: 'User Arjun Rao authenticated from Bengaluru, India then Berlin, Germany within 22 minutes — a physical impossibility. Combined with new device and new country, this event has a critical risk score of 85/100.',
    severity: 'critical', status: 'investigating',
    userId: arjun.id,
    relatedEventIds: [ev_arjun_normal, ev_arjun_berlin],
    riskScore: 85, confidence: 0.93,
    signals: impossibleTravelSignal,
    explanation: 'Impossible travel combined with new device and new country access',
    firstSeen: hoursAgo(2.4), lastSeen: hoursAgo(2.4),
  });

  // Case for Arjun
  const case_arjun = uuidv4();
  const case_arjun_num = 'CASE-0001';
  insertCase({
    id: case_arjun, caseNumber: case_arjun_num,
    title: 'Potential Account Compromise — Impossible Travel',
    description: 'Employee Arjun Rao\'s account shows a critical impossible travel event. Authentication from Bengaluru was followed 22 minutes later by a successful login from Berlin, Germany on an unrecognized Windows device. This pattern is consistent with credential theft and unauthorized access.',
    severity: 'critical', status: 'investigating',
    assignedAnalyst: 'Analyst: Rohan Gupta',
    userId: arjun.id,
    relatedAlertIds: [alert_arjun_it],
    relatedEventIds: [ev_arjun_normal, ev_arjun_berlin],
    evidence: [
      { id: 'ev-1', type: 'ip', label: 'Attacker IP', value: '203.0.113.45', severity: 'critical', reviewed: false },
      { id: 'ev-2', type: 'location', label: 'Impossible Travel', value: 'Bengaluru → Berlin (7,170 km in 22 min)', severity: 'critical', reviewed: false },
      { id: 'ev-3', type: 'device', label: 'New Device', value: 'Windows Laptop (Chrome / Windows 11)', severity: 'high', reviewed: false },
      { id: 'ev-4', type: 'geo', label: 'Distance', value: '7,170 km', severity: 'critical', reviewed: false },
      { id: 'ev-5', type: 'time', label: 'Time Difference', value: '22 minutes', severity: 'critical', reviewed: false },
      { id: 'ev-6', type: 'auth', label: 'Previous Login', value: 'Bengaluru, India — 03:02 UTC', severity: 'info', reviewed: false },
      { id: 'ev-7', type: 'auth', label: 'Suspicious Login', value: 'Berlin, Germany — 03:24 UTC', severity: 'critical', reviewed: false },
    ],
    riskScore: 85, confidence: 0.93,
    createdAt: hoursAgo(2.3), updatedAt: hoursAgo(0.5),
  });

  // Update alert with case
  sqlite.prepare('UPDATE alerts SET case_id = ?, status = ? WHERE id = ?').run(case_arjun, 'investigating', alert_arjun_it);

  // Investigation notes
  insertNote({
    id: uuidv4(), caseId: case_arjun, analyst: 'Rohan Gupta',
    content: 'Case opened automatically due to critical risk score (85/100) and impossible travel detection. Arjun\'s account accessed from Berlin, Germany — 7,170 km from his usual Bengaluru location — just 22 minutes after a confirmed normal login. Distance requires travel at approximately 19,554 km/h which is physically impossible. Initiating account investigation.',
    timestamp: hoursAgo(2.1), noteType: 'note',
  });
  insertNote({
    id: uuidv4(), caseId: case_arjun, analyst: 'Rohan Gupta',
    content: 'Contacted user Arjun Rao via corporate Slack. No response yet. Escalating to IT for temporary session termination pending investigation. Berlin login device (Windows Laptop) is not registered in MDM. Suspicious.',
    timestamp: hoursAgo(1.5), noteType: 'action',
  });
  insertNote({
    id: uuidv4(), caseId: case_arjun, analyst: 'Rohan Gupta',
    content: 'User Arjun Rao confirmed via phone: he is in Bengaluru and did NOT login from Berlin. Account compromise confirmed. Escalating to Critical. Password reset initiated. Session revoked.',
    timestamp: hoursAgo(0.5), noteType: 'escalation',
  });

  // ── STORYLINE 2: Priya Sharma — Brute Force Attack ────────────────────────

  const priya = USERS[1]; // usr-002
  const mumbaiCoords = CITY_COORDS['Mumbai']!;
  const moscowCoords = { lat: 55.7558, lng: 37.6173 };
  const attackIP2 = '203.0.113.88';
  const corr2 = 'CORR-PRIYA-BRUTE-001';

  const priya_fail_ids: string[] = [];
  for (let i = 0; i < 8; i++) {
    const id = uuidv4();
    priya_fail_ids.push(id);
    insertEvent({
      id, userId: priya.id,
      timestamp: minutesAgo(45 - i * 4),
      ip: attackIP2, ipReputation: 'malicious',
      country: 'Russia', city: 'Moscow',
      lat: moscowCoords.lat, lng: moscowCoords.lng,
      isNewCountry: true, isNewCity: true, isNewDevice: true,
      device: 'Unknown Linux', browser: 'Firefox', os: 'Linux',
      result: 'failure', failureReason: 'Invalid password',
      riskScore: 15 + i * 3, riskLevel: i < 3 ? 'suspicious' : 'high',
      confidence: 0.5 + i * 0.05,
      signals: [{ id: 'brute_force_attempt', name: 'Repeated Authentication Failures', category: 'authentication', points: 5 * (i + 1), severity: i < 4 ? 'medium' : 'high', evidence: `${i + 1} failures recorded` }],
      attackScenario: 'brute_force', correlationId: corr2,
    });
  }

  const ev_priya_success = uuidv4();
  const bruteForceSignals = [
    { id: 'brute_force_success', name: 'Successful Login After Multiple Failures', category: 'authentication', points: 25, severity: 'critical', evidence: '8 authentication failures in last 45 minutes, then success' },
    { id: 'blacklisted_ip', name: 'Blacklisted IP Address', category: 'network', points: 30, severity: 'critical', evidence: 'IP 203.0.113.88 associated with known attack infrastructure' },
    { id: 'new_country', name: 'New Country', category: 'location', points: 20, severity: 'high', evidence: 'Russia not previously observed for this user' },
    { id: 'new_device', name: 'New Device', category: 'device', points: 15, severity: 'medium', evidence: 'Unknown Linux device not in known devices list' },
    { id: 'behavioral_anomaly', name: 'Behavioral Anomaly', category: 'behavioral', points: 15, severity: 'high', evidence: 'New country AND new device combination' },
  ];

  insertEvent({
    id: ev_priya_success, userId: priya.id,
    timestamp: minutesAgo(12),
    ip: attackIP2, ipReputation: 'malicious',
    country: 'Russia', city: 'Moscow',
    lat: moscowCoords.lat, lng: moscowCoords.lng,
    isNewCountry: true, isNewCity: true, isNewDevice: true,
    device: 'Unknown Linux', browser: 'Firefox', os: 'Linux',
    result: 'success',
    riskScore: 90, riskLevel: 'critical', confidence: 0.95,
    signals: bruteForceSignals,
    explanation: 'CRITICAL: Brute force attack successful. 8 failed attempts followed by success from a malicious IP in Russia.',
    attackScenario: 'brute_force', correlationId: corr2,
  });

  const alert_priya_bf = uuidv4();
  insertAlert({
    id: alert_priya_bf, alertType: 'brute_force',
    title: 'Brute Force Attack — Account Compromised',
    description: '8 failed login attempts from a blacklisted IP (Russia) followed by a successful authentication. Account may be compromised.',
    severity: 'critical', status: 'open',
    userId: priya.id,
    relatedEventIds: [...priya_fail_ids, ev_priya_success],
    riskScore: 90, confidence: 0.95,
    signals: bruteForceSignals,
    firstSeen: minutesAgo(45), lastSeen: minutesAgo(12),
  });

  const case_priya = uuidv4();
  insertCase({
    id: case_priya, caseNumber: 'CASE-0002',
    title: 'Brute Force Attack — Priya Sharma Account',
    description: 'Automated brute force attack detected against Priya Sharma\'s account. 8 consecutive failed authentication attempts from IP 203.0.113.88 (Moscow, Russia — blacklisted) culminated in a successful login. Immediate action required.',
    severity: 'critical', status: 'triaging',
    userId: priya.id,
    relatedAlertIds: [alert_priya_bf],
    relatedEventIds: [...priya_fail_ids, ev_priya_success],
    evidence: [
      { id: 'ev-1', type: 'ip', label: 'Attacker IP', value: '203.0.113.88', severity: 'critical', reviewed: false },
      { id: 'ev-2', type: 'auth', label: 'Failed Attempts', value: '8 consecutive failures', severity: 'critical', reviewed: false },
      { id: 'ev-3', type: 'auth', label: 'Successful Login', value: 'After 8 failures at 45-minute mark', severity: 'critical', reviewed: false },
      { id: 'ev-4', type: 'location', label: 'Attack Origin', value: 'Moscow, Russia (blacklisted ISP)', severity: 'critical', reviewed: false },
      { id: 'ev-5', type: 'device', label: 'Attacker Device', value: 'Unknown Linux (Firefox)', severity: 'high', reviewed: false },
    ],
    riskScore: 90, confidence: 0.95,
    createdAt: minutesAgo(10), updatedAt: minutesAgo(5),
  });
  sqlite.prepare('UPDATE alerts SET case_id = ? WHERE id = ?').run(case_priya, alert_priya_bf);

  insertNote({
    id: uuidv4(), caseId: case_priya, analyst: 'System',
    content: 'Case automatically created due to critical brute force pattern detection. 8 authentication failures followed by success from blacklisted IP. Risk score: 90/100. Confidence: 95%. Immediate analyst review required.',
    timestamp: minutesAgo(9), noteType: 'note',
  });

  // ── STORYLINE 3: Rahul Mehta — Password Spraying ──────────────────────────

  const rahul = USERS[2]; // usr-003
  const sprayIP = '198.51.100.22';
  const corr3 = 'CORR-SPRAY-GROUP-001';
  const sprayCoords = CITY_COORDS['Amsterdam']!;

  const sprayTargets = [USERS[2], USERS[4], USERS[6], USERS[8], USERS[10]]; // 5 users
  const spray_event_ids: string[] = [];

  const spraySignals = [
    { id: 'password_spraying', name: 'Password Spraying Suspected', category: 'authentication', points: 30, severity: 'critical', evidence: '5 unique usernames attempted from IP 198.51.100.22 in 20 minutes' },
    { id: 'blacklisted_ip', name: 'Suspicious IP Address', category: 'network', points: 15, severity: 'high', evidence: 'IP 198.51.100.22 from suspicious hosting provider' },
    { id: 'new_country', name: 'New Country', category: 'location', points: 20, severity: 'high', evidence: 'Netherlands not previously observed' },
  ];

  sprayTargets.forEach((target, i) => {
    const id1 = uuidv4();
    const id2 = uuidv4();
    spray_event_ids.push(id1, id2);

    insertEvent({
      id: id1, userId: target.id,
      timestamp: minutesAgo(20 - i * 2),
      ip: sprayIP, ipReputation: 'suspicious',
      country: 'Netherlands', city: 'Amsterdam',
      lat: sprayCoords.lat, lng: sprayCoords.lng,
      isNewCountry: true, isNewCity: true, isNewDevice: true,
      device: 'Unknown Device', browser: 'Chrome', os: 'Windows 10',
      result: 'failure', failureReason: 'Invalid password',
      riskScore: 55, riskLevel: 'high', confidence: 0.78,
      signals: spraySignals,
      attackScenario: 'password_spray', correlationId: corr3,
    });
    insertEvent({
      id: id2, userId: target.id,
      timestamp: minutesAgo(19 - i * 2),
      ip: sprayIP, ipReputation: 'suspicious',
      country: 'Netherlands', city: 'Amsterdam',
      lat: sprayCoords.lat, lng: sprayCoords.lng,
      isNewCountry: true, isNewCity: true, isNewDevice: true,
      device: 'Unknown Device', browser: 'Chrome', os: 'Windows 10',
      result: 'failure', failureReason: 'Invalid password',
      riskScore: 65, riskLevel: 'high', confidence: 0.82,
      signals: spraySignals,
      attackScenario: 'password_spray', correlationId: corr3,
    });
  });

  const alert_spray = uuidv4();
  insertAlert({
    id: alert_spray, alertType: 'password_spray',
    title: 'Password Spraying Campaign Detected',
    description: 'Single IP address (198.51.100.22, Amsterdam, Netherlands) attempting authentication against 5 different accounts with 2 attempts per account — classic password spraying pattern designed to avoid account lockout.',
    severity: 'critical', status: 'open',
    userId: rahul.id,
    relatedEventIds: spray_event_ids,
    riskScore: 75, confidence: 0.88,
    signals: spraySignals,
    firstSeen: minutesAgo(20), lastSeen: minutesAgo(10),
  });

  const case_spray = uuidv4();
  insertCase({
    id: case_spray, caseNumber: 'CASE-0003',
    title: 'Password Spraying Campaign — 5 Accounts Targeted',
    description: 'Coordinated password spraying attack from IP 198.51.100.22 (Netherlands). Attack targeted 5 user accounts with precisely 2 attempts each — a deliberate strategy to stay below lockout thresholds. No successful authentications recorded yet.',
    severity: 'critical', status: 'new',
    userId: rahul.id,
    relatedAlertIds: [alert_spray],
    relatedEventIds: spray_event_ids,
    evidence: [
      { id: 'ev-1', type: 'ip', label: 'Attack IP', value: '198.51.100.22 (Netherlands)', severity: 'critical', reviewed: false },
      { id: 'ev-2', type: 'pattern', label: 'Spray Pattern', value: '2 attempts × 5 users = 10 total attempts', severity: 'critical', reviewed: false },
      { id: 'ev-3', type: 'time', label: 'Attack Window', value: '20 minutes', severity: 'high', reviewed: false },
      { id: 'ev-4', type: 'target', label: 'Targeted Accounts', value: '5 accounts across Engineering and Sales', severity: 'critical', reviewed: false },
    ],
    riskScore: 75, confidence: 0.88,
    createdAt: minutesAgo(8), updatedAt: minutesAgo(2),
  });
  sqlite.prepare('UPDATE alerts SET case_id = ? WHERE id = ?').run(case_spray, alert_spray);

  // ── STORYLINE 4: Vikram Singh — VPN Anomaly ───────────────────────────────

  const vikram = USERS[4]; // usr-005
  const delhiCoords = CITY_COORDS['Delhi']!;
  const ev_vikram_vpn = uuidv4();
  const vpnSignals = [
    { id: 'vpn', name: 'VPN Detected', category: 'network', points: 10, severity: 'low', evidence: 'VPN service detected on IP 10.8.45.120. May be legitimate corporate VPN.' },
    { id: 'new_city', name: 'New City', category: 'location', points: 8, severity: 'low', evidence: 'City appears as Singapore (VPN exit node) — not previously seen' },
  ];

  insertEvent({
    id: ev_vikram_vpn, userId: vikram.id,
    timestamp: hoursAgo(5),
    ip: '10.8.45.120', isVPN: true, ipReputation: 'suspicious',
    country: 'Singapore', city: 'Singapore',
    lat: CITY_COORDS['Singapore']!.lat, lng: CITY_COORDS['Singapore']!.lng,
    isNewCountry: true, isNewCity: true,
    device: 'Windows Laptop', browser: 'Chrome', os: 'Windows 11',
    result: 'success',
    riskScore: 38, riskLevel: 'suspicious', confidence: 0.55,
    signals: vpnSignals,
    explanation: 'VPN usage detected. Login location appears to be Singapore (VPN exit node). User\'s device and credentials are familiar.',
    attackScenario: 'vpn_login',
  });

  insertAlert({
    id: uuidv4(), alertType: 'vpn_anomaly',
    title: 'VPN Login — Unusual Location',
    description: 'Vikram Singh authenticated via VPN with exit node in Singapore. Known device, valid credentials. No other anomalies detected.',
    severity: 'suspicious', status: 'open',
    userId: vikram.id,
    relatedEventIds: [ev_vikram_vpn],
    riskScore: 38, confidence: 0.55,
    signals: vpnSignals,
    firstSeen: hoursAgo(5), lastSeen: hoursAgo(5),
  });

  // ── STORYLINE 5: Ananya Krishnan — Odd-Hour Access ────────────────────────

  const ananya = USERS[5]; // usr-006
  const chennaiCoords = CITY_COORDS['Chennai']!;

  const oddHourSignals = [
    { id: 'odd_hour', name: 'Unusual Login Time', category: 'time', points: 10, severity: 'low', evidence: 'Login at 02:47 — user typically logs in 09:00–18:00' },
    { id: 'new_device', name: 'New Device', category: 'device', points: 15, severity: 'medium', evidence: 'Windows Laptop not in user\'s known devices (user typically uses MacBook)' },
    { id: 'new_browser', name: 'New Browser', category: 'device', points: 5, severity: 'low', evidence: 'Edge browser not previously used by this user' },
  ];

  const ev_ananya_odd1 = uuidv4();
  const ev_ananya_odd2 = uuidv4();

  insertEvent({
    id: ev_ananya_odd1, userId: ananya.id,
    timestamp: daysAgo(1, 2, 47),
    ip: '49.204.75.200',
    country: 'India', city: 'Chennai',
    lat: chennaiCoords.lat, lng: chennaiCoords.lng,
    device: 'Windows Laptop', browser: 'Edge', os: 'Windows 11',
    isNewDevice: true, isNewBrowser: true,
    result: 'success',
    riskScore: 30, riskLevel: 'suspicious', confidence: 0.65,
    signals: oddHourSignals,
    attackScenario: 'odd_hour',
  });

  insertEvent({
    id: ev_ananya_odd2, userId: ananya.id,
    timestamp: daysAgo(3, 3, 15),
    ip: '49.204.75.200',
    country: 'India', city: 'Chennai',
    lat: chennaiCoords.lat, lng: chennaiCoords.lng,
    device: 'Windows Laptop', browser: 'Edge', os: 'Windows 11',
    isNewDevice: true, isNewBrowser: true,
    result: 'success',
    riskScore: 35, riskLevel: 'suspicious', confidence: 0.68,
    signals: [
      ...oddHourSignals,
      { id: 'behavioral_anomaly', name: 'Behavioral Anomaly', category: 'behavioral', points: 15, severity: 'high', evidence: 'Second repeated odd-hour login from same new device' },
    ],
    attackScenario: 'odd_hour',
  });

  insertAlert({
    id: uuidv4(), alertType: 'behavioral_anomaly',
    title: 'Repeated Odd-Hour Access — Behavioral Anomaly',
    description: 'Ananya Krishnan has logged in at 02:47 and 03:15 on two separate nights from a device not registered in MDM. Repeated unusual hours from new device suggests potential insider threat or compromised account.',
    severity: 'high', status: 'open',
    userId: ananya.id,
    relatedEventIds: [ev_ananya_odd1, ev_ananya_odd2],
    riskScore: 50, confidence: 0.72,
    signals: oddHourSignals,
    firstSeen: daysAgo(3, 3, 15), lastSeen: daysAgo(1, 2, 47),
  });

  // ── STORYLINE 6: Sanjay Verma — Account Takeover Chain ────────────────────

  const sanjay = USERS[10]; // usr-011
  const corr6 = 'CORR-SANJAY-ATO-001';
  const atoIP = '185.220.101.55';
  const kyivCoords = { lat: 50.4501, lng: 30.5234 };

  const ev_sanjay_fail1 = uuidv4();
  const ev_sanjay_fail2 = uuidv4();
  const ev_sanjay_success = uuidv4();

  insertEvent({
    id: ev_sanjay_fail1, userId: sanjay.id,
    timestamp: hoursAgo(1.2),
    ip: atoIP, isTor: true, ipReputation: 'suspicious',
    country: 'Ukraine', city: 'Kyiv',
    lat: kyivCoords.lat, lng: kyivCoords.lng,
    isNewCountry: true, isNewCity: true, isNewDevice: true,
    device: 'Unknown Linux Machine', browser: 'Firefox', os: 'Linux',
    result: 'failure', failureReason: 'Invalid password',
    riskScore: 55, riskLevel: 'high', confidence: 0.72,
    signals: [
      { id: 'tor', name: 'Tor Exit Node', category: 'network', points: 20, severity: 'high', evidence: 'IP 185.220.101.55 identified as Tor exit node' },
      { id: 'new_country', name: 'New Country', category: 'location', points: 20, severity: 'high', evidence: 'Ukraine not previously observed' },
      { id: 'new_device', name: 'New Device', category: 'device', points: 15, severity: 'medium', evidence: 'Unknown Linux device' },
    ],
    attackScenario: 'account_takeover', correlationId: corr6,
  });

  insertEvent({
    id: ev_sanjay_fail2, userId: sanjay.id,
    timestamp: hoursAgo(1.0),
    ip: atoIP, isTor: true, ipReputation: 'suspicious',
    country: 'Ukraine', city: 'Kyiv',
    lat: kyivCoords.lat, lng: kyivCoords.lng,
    isNewCountry: true, isNewCity: true, isNewDevice: true,
    device: 'Unknown Linux Machine', browser: 'Firefox', os: 'Linux',
    result: 'failure', failureReason: 'Invalid password',
    riskScore: 60, riskLevel: 'high', confidence: 0.78,
    signals: [],
    attackScenario: 'account_takeover', correlationId: corr6,
  });

  const atoSignals = [
    { id: 'tor', name: 'Tor Exit Node', category: 'network', points: 20, severity: 'high', evidence: 'Authentication via Tor — identity concealment detected' },
    { id: 'new_country', name: 'New Country', category: 'location', points: 20, severity: 'high', evidence: 'Germany not previously observed for CFO account' },
    { id: 'new_device', name: 'New Device', category: 'device', points: 15, severity: 'medium', evidence: 'Windows laptop not registered for this account' },
    { id: 'odd_hour', name: 'Unusual Login Time', category: 'time', points: 10, severity: 'low', evidence: 'Login at 04:22 — CFO typically logs in 07:00–21:00' },
    { id: 'vpn', name: 'VPN Detected', category: 'network', points: 10, severity: 'low', evidence: 'VPN exit node in Berlin' },
    { id: 'behavioral_anomaly', name: 'Behavioral Anomaly', category: 'behavioral', points: 15, severity: 'high', evidence: 'New country AND new device — highly anomalous for senior account' },
  ];

  insertEvent({
    id: ev_sanjay_success, userId: sanjay.id,
    timestamp: hoursAgo(0.7),
    ip: '10.8.200.45', isVPN: true, ipReputation: 'suspicious',
    country: 'Germany', city: 'Berlin',
    lat: berlinCoords.lat, lng: berlinCoords.lng,
    isNewCountry: true, isNewCity: true, isNewDevice: true,
    device: 'Windows Laptop', browser: 'Chrome', os: 'Windows 11',
    result: 'success',
    riskScore: 88, riskLevel: 'critical', confidence: 0.93,
    signals: atoSignals,
    explanation: 'CRITICAL: Account takeover pattern detected. CFO account accessed via Tor then VPN from two different countries. Multiple independent risk indicators.',
    attackScenario: 'account_takeover', correlationId: corr6,
  });

  const alert_sanjay = uuidv4();
  insertAlert({
    id: alert_sanjay, alertType: 'account_takeover',
    title: 'Account Takeover — CFO Account',
    description: 'Critical account takeover pattern detected on CFO Sanjay Verma\'s account. Authentication attempts via Tor from Ukraine followed by successful VPN login from Berlin. Immediate action required.',
    severity: 'critical', status: 'open',
    userId: sanjay.id,
    relatedEventIds: [ev_sanjay_fail1, ev_sanjay_fail2, ev_sanjay_success],
    riskScore: 88, confidence: 0.93,
    signals: atoSignals,
    firstSeen: hoursAgo(1.2), lastSeen: hoursAgo(0.7),
  });

  const case_sanjay = uuidv4();
  insertCase({
    id: case_sanjay, caseNumber: 'CASE-0004',
    title: 'Critical: CFO Account Takeover Suspected',
    description: 'Account takeover pattern on CFO Sanjay Verma\'s account. Two failed authentication attempts from Tor exit node in Ukraine followed by successful login via VPN from Berlin, Germany. Given the seniority of this account (CFO), this requires immediate escalation.',
    severity: 'critical', status: 'new',
    userId: sanjay.id,
    relatedAlertIds: [alert_sanjay],
    relatedEventIds: [ev_sanjay_fail1, ev_sanjay_fail2, ev_sanjay_success],
    evidence: [
      { id: 'ev-1', type: 'ip', label: 'Tor Exit Node', value: '185.220.101.55 (Ukraine)', severity: 'critical', reviewed: false },
      { id: 'ev-2', type: 'ip', label: 'VPN IP', value: '10.8.200.45 (Berlin)', severity: 'high', reviewed: false },
      { id: 'ev-3', type: 'auth', label: 'Failed Attempts', value: '2 failures via Tor before success', severity: 'critical', reviewed: false },
      { id: 'ev-4', type: 'auth', label: 'Successful Login', value: 'Via VPN from Berlin, Germany', severity: 'critical', reviewed: false },
      { id: 'ev-5', type: 'device', label: 'Unregistered Device', value: 'Windows Laptop — not in MDM', severity: 'high', reviewed: false },
      { id: 'ev-6', type: 'role', label: 'Account Privilege', value: 'CFO — Critical financial access', severity: 'critical', reviewed: false },
    ],
    riskScore: 88, confidence: 0.93,
    createdAt: hoursAgo(0.6), updatedAt: hoursAgo(0.1),
  });
  sqlite.prepare('UPDATE alerts SET case_id = ? WHERE id = ?').run(case_sanjay, alert_sanjay);

  // ── More suspicious events for other users (high risk dashboard) ──────────

  // Rohan — multiple country logins
  const rohan = USERS[6]; // usr-007
  const singaporeCoords = CITY_COORDS['Singapore']!;
  const tokyoCoords = CITY_COORDS['Tokyo']!;

  insertEvent({
    id: uuidv4(), userId: rohan.id,
    timestamp: daysAgo(2, 14, 30),
    ip: '103.200.100.50',
    country: 'Singapore', city: 'Singapore',
    lat: singaporeCoords.lat, lng: singaporeCoords.lng,
    isNewCountry: true, isNewCity: true,
    device: 'MacBook Pro', browser: 'Chrome', os: 'macOS',
    result: 'success',
    riskScore: 28, riskLevel: 'safe', confidence: 0.45,
    signals: [{ id: 'new_country', name: 'New Country', category: 'location', points: 20, severity: 'high', evidence: 'Singapore not previously observed' }],
    explanation: 'New country (Singapore) — likely legitimate business travel',
  });

  insertEvent({
    id: uuidv4(), userId: rohan.id,
    timestamp: daysAgo(2, 18, 0),
    ip: '203.147.50.30',
    country: 'Japan', city: 'Tokyo',
    lat: tokyoCoords.lat, lng: tokyoCoords.lng,
    isNewCountry: true, isNewCity: true,
    device: 'MacBook Pro', browser: 'Chrome', os: 'macOS',
    result: 'success',
    riskScore: 42, riskLevel: 'suspicious', confidence: 0.65,
    signals: [
      { id: 'new_country', name: 'New Country', category: 'location', points: 20, severity: 'high', evidence: 'Japan not previously observed' },
      { id: 'multiple_countries', name: 'Multiple Countries in 24 Hours', category: 'behavioral', points: 12, severity: 'high', evidence: 'Singapore + Japan within 4 hours' },
    ],
    explanation: 'Multiple new countries in short period — possible business travel but worth monitoring',
  });

  // ── STORYLINE 7: Meera Joshi — New Device ─────────────────────────────────

  const meera = USERS[11]; // usr-012
  const puneCoords = CITY_COORDS['Pune']!;

  const ev_meera_newdev = uuidv4();
  const newDevSignals = [
    { id: 'new_device', name: 'New Device', category: 'device', points: 15, severity: 'medium', evidence: 'Android Phone not in user\'s known devices (typically uses Linux Desktop + MacBook)' },
    { id: 'new_browser', name: 'New Browser', category: 'device', points: 5, severity: 'low', evidence: 'Samsung Internet browser not previously used' },
  ];

  insertEvent({
    id: ev_meera_newdev, userId: meera.id,
    timestamp: hoursAgo(3),
    ip: '45.114.110.35',
    country: 'India', city: 'Pune',
    lat: puneCoords.lat, lng: puneCoords.lng,
    isNewDevice: true, isNewBrowser: true,
    device: 'Android Phone', browser: 'Samsung Internet', os: 'Android', isMobile: true,
    result: 'success',
    riskScore: 32, riskLevel: 'suspicious', confidence: 0.65,
    signals: newDevSignals,
    explanation: 'New mobile device detected. User typically uses desktop workstations. Review recommended.',
    attackScenario: 'new_device',
  });

  insertAlert({
    id: uuidv4(), alertType: 'new_device',
    title: 'New Device — Mobile Access',
    description: 'Meera Joshi authenticated from an Android phone — first mobile access recorded. Known location. Recommend confirming with user.',
    severity: 'suspicious', status: 'open',
    userId: meera.id,
    relatedEventIds: [ev_meera_newdev],
    riskScore: 32, confidence: 0.65,
    signals: newDevSignals,
    firstSeen: hoursAgo(3), lastSeen: hoursAgo(3),
  });

  // ── STORYLINE 8: Kavya Nair — Resolved False Positive ─────────────────────

  const kavya = USERS[7]; // usr-008
  const londonCoords = CITY_COORDS['London']!;

  const ev_kavya_london = uuidv4();
  insertEvent({
    id: ev_kavya_london, userId: kavya.id,
    timestamp: daysAgo(5, 11, 30),
    ip: '195.154.50.20', isProxy: false,
    country: 'United Kingdom', city: 'London',
    lat: londonCoords.lat, lng: londonCoords.lng,
    isNewCountry: true, isNewCity: true,
    device: 'Windows Laptop', browser: 'Chrome', os: 'Windows 11',
    result: 'success',
    riskScore: 33, riskLevel: 'suspicious', confidence: 0.60,
    signals: [{ id: 'new_country', name: 'New Country', category: 'location', points: 20, severity: 'high', evidence: 'UK not previously observed' }],
    explanation: 'New country (UK). Appears to be legitimate travel.',
  });

  const alert_kavya_fp = uuidv4();
  insertAlert({
    id: alert_kavya_fp, alertType: 'new_country',
    title: 'New Country — UK Access',
    description: 'Kavya Nair logged in from London, UK — a new country. Confirmed as business travel. Marked as false positive.',
    severity: 'suspicious', status: 'false_positive',
    userId: kavya.id,
    relatedEventIds: [ev_kavya_london],
    riskScore: 33, confidence: 0.60,
    signals: [],
    resolvedAt: daysAgo(4, 10, 0), resolvedBy: 'Rohan Gupta',
    firstSeen: daysAgo(5, 11, 30), lastSeen: daysAgo(5, 11, 30),
  } as any);

  const case_kavya = uuidv4();
  insertCase({
    id: case_kavya, caseNumber: 'CASE-0005',
    title: 'Suspicious Login — UK Travel (False Positive)',
    description: 'Alert generated for Kavya Nair\'s login from London, UK. Confirmed employee business travel. Case resolved as false positive.',
    severity: 'medium', status: 'false_positive',
    assignedAnalyst: 'Rohan Gupta',
    userId: kavya.id,
    relatedAlertIds: [alert_kavya_fp],
    relatedEventIds: [ev_kavya_london],
    evidence: [
      { id: 'ev-1', type: 'location', label: 'Login Location', value: 'London, UK', severity: 'medium', reviewed: true },
      { id: 'ev-2', type: 'resolution', label: 'Verification', value: 'Employee confirmed travel via email', severity: 'info', reviewed: true },
    ],
    riskScore: 33, confidence: 0.60,
    createdAt: daysAgo(5, 12, 0), updatedAt: daysAgo(4, 10, 0),
  });
  sqlite.prepare('UPDATE cases SET resolved_at = ?, resolution = ?, false_positive_reason = ?, status = ? WHERE id = ?').run(
    daysAgo(4, 10, 0),
    'Confirmed false positive — employee was traveling to London for Q3 business review.',
    'Employee Travel',
    'false_positive',
    case_kavya
  );
  sqlite.prepare('UPDATE alerts SET case_id = ? WHERE id = ?').run(case_kavya, alert_kavya_fp);

  insertNote({
    id: uuidv4(), caseId: case_kavya, analyst: 'Rohan Gupta',
    content: 'Reached out to Kavya Nair directly. She confirmed she is in London for the Q3 Business Review conference. She will be there from 5th to 9th. Closing case as false positive. Reason: Employee Travel.',
    timestamp: daysAgo(4, 10, 0), noteType: 'note',
  });

  // ── Update user risk levels and stats ──────────────────────────────────────

  // Arjun — Critical
  sqlite.prepare(`UPDATE users SET current_risk = 85, risk_level = 'critical', risk_trend = ?, total_logins = 18, failed_logins = 0, last_login = ? WHERE id = ?`).run(
    JSON.stringify([5, 5, 10, 5, 8, 12, 85]),
    hoursAgo(2.4), arjun.id
  );

  // Priya — Critical
  sqlite.prepare(`UPDATE users SET current_risk = 90, risk_level = 'critical', risk_trend = ?, total_logins = 14, failed_logins = 8, last_login = ? WHERE id = ?`).run(
    JSON.stringify([8, 5, 5, 12, 10, 15, 90]),
    minutesAgo(12), priya.id
  );

  // Rahul — High (spray target)
  sqlite.prepare(`UPDATE users SET current_risk = 65, risk_level = 'high', risk_trend = ?, total_logins = 20, failed_logins = 2, last_login = ? WHERE id = ?`).run(
    JSON.stringify([5, 8, 5, 10, 8, 12, 65]),
    minutesAgo(20), rahul.id
  );

  // Sanjay — Critical (CFO)
  sqlite.prepare(`UPDATE users SET current_risk = 88, risk_level = 'critical', risk_trend = ?, total_logins = 12, failed_logins = 2, last_login = ? WHERE id = ?`).run(
    JSON.stringify([8, 5, 10, 8, 5, 12, 88]),
    hoursAgo(0.7), sanjay.id
  );

  // Ananya — Suspicious
  sqlite.prepare(`UPDATE users SET current_risk = 50, risk_level = 'high', risk_trend = ?, total_logins = 16, failed_logins = 0, last_login = ? WHERE id = ?`).run(
    JSON.stringify([5, 5, 5, 8, 12, 25, 50]),
    daysAgo(1, 2, 47), ananya.id
  );

  // Kavya — Safe now (FP resolved)
  sqlite.prepare(`UPDATE users SET current_risk = 5, risk_level = 'safe', risk_trend = ?, total_logins = 22, failed_logins = 0, last_login = ? WHERE id = ?`).run(
    JSON.stringify([33, 5, 5, 5, 8, 5, 5]),
    daysAgo(1, 9, 30), kavya.id
  );

  // Vikram — Suspicious (VPN)
  sqlite.prepare(`UPDATE users SET current_risk = 38, risk_level = 'suspicious', risk_trend = ?, total_logins = 28, failed_logins = 0, last_login = ? WHERE id = ?`).run(
    JSON.stringify([5, 8, 5, 5, 10, 8, 38]),
    hoursAgo(5), vikram.id
  );

  // Meera — Suspicious (new device)
  sqlite.prepare(`UPDATE users SET current_risk = 32, risk_level = 'suspicious', risk_trend = ?, total_logins = 19, failed_logins = 0, last_login = ? WHERE id = ?`).run(
    JSON.stringify([5, 5, 5, 8, 5, 10, 32]),
    hoursAgo(3), meera.id
  );

  // Remaining users — safe, update stats
  const safeUsers = [USERS[3], USERS[8], USERS[9], USERS[11], USERS[12], USERS[13], USERS[14]];
  for (const u of safeUsers) {
    sqlite.prepare(`UPDATE users SET current_risk = ?, risk_level = 'safe', risk_trend = ?, total_logins = ?, failed_logins = ?, last_login = ? WHERE id = ?`).run(
      randomBetween(0, 18),
      JSON.stringify([0, 0, 0, 5, 0, 5, randomBetween(0, 15)]),
      randomBetween(10, 30), randomBetween(0, 2),
      daysAgo(randomBetween(0, 2), randomBetween(8, 17), randomBetween(0, 59)),
      u.id
    );
  }

  // ── Notifications ──────────────────────────────────────────────────────────

  insertNotification({
    id: uuidv4(), type: 'critical_alert',
    title: 'Critical Alert: Impossible Travel Detected',
    message: 'Arjun Rao — Bengaluru → Berlin in 22 minutes. Risk: 85/100',
    severity: 'critical', entityType: 'alert', entityId: alert_arjun_it,
    createdAt: hoursAgo(2.4),
  });
  insertNotification({
    id: uuidv4(), type: 'critical_alert',
    title: 'Critical Alert: Brute Force Attack Successful',
    message: 'Priya Sharma — 8 failures then success from blacklisted IP. Risk: 90/100',
    severity: 'critical', entityType: 'alert', entityId: alert_priya_bf,
    createdAt: minutesAgo(12),
  });
  insertNotification({
    id: uuidv4(), type: 'critical_alert',
    title: 'Critical Alert: CFO Account Takeover',
    message: 'Sanjay Verma — Tor + VPN chain attack. Risk: 88/100',
    severity: 'critical', entityType: 'alert', entityId: alert_sanjay,
    createdAt: hoursAgo(0.7),
  });
  insertNotification({
    id: uuidv4(), type: 'password_spray',
    title: 'Password Spraying Campaign',
    message: '5 accounts targeted from single IP. Spray pattern confirmed.',
    severity: 'critical', entityType: 'alert', entityId: alert_spray,
    createdAt: minutesAgo(15),
  });
  insertNotification({
    id: uuidv4(), type: 'new_case',
    title: 'Case Auto-Created: CASE-0004',
    message: 'CFO account takeover — critical investigation required.',
    severity: 'critical', entityType: 'case', entityId: case_sanjay,
    createdAt: hoursAgo(0.6),
  });

  // ── Audit Logs ─────────────────────────────────────────────────────────────

  insertAuditLog({ id: uuidv4(), action: 'CASE_OPENED', entityType: 'case', entityId: case_arjun, analyst: 'System', details: { caseNumber: 'CASE-0001', reason: 'Critical risk score auto-trigger' }, timestamp: hoursAgo(2.3) });
  insertAuditLog({ id: uuidv4(), action: 'ALERT_VIEWED', entityType: 'alert', entityId: alert_arjun_it, analyst: 'Rohan Gupta', details: { alertType: 'impossible_travel' }, timestamp: hoursAgo(2.1) });
  insertAuditLog({ id: uuidv4(), action: 'STATUS_CHANGED', entityType: 'case', entityId: case_arjun, analyst: 'Rohan Gupta', details: { from: 'new', to: 'investigating' }, timestamp: hoursAgo(2.0) });
  insertAuditLog({ id: uuidv4(), action: 'NOTE_ADDED', entityType: 'case', entityId: case_arjun, analyst: 'Rohan Gupta', details: { noteType: 'note' }, timestamp: hoursAgo(2.1) });
  insertAuditLog({ id: uuidv4(), action: 'NOTE_ADDED', entityType: 'case', entityId: case_arjun, analyst: 'Rohan Gupta', details: { noteType: 'action' }, timestamp: hoursAgo(1.5) });
  insertAuditLog({ id: uuidv4(), action: 'CASE_OPENED', entityType: 'case', entityId: case_priya, analyst: 'System', details: { caseNumber: 'CASE-0002', reason: 'Brute force pattern auto-detection' }, timestamp: minutesAgo(10) });
  insertAuditLog({ id: uuidv4(), action: 'STATUS_CHANGED', entityType: 'case', entityId: case_priya, analyst: 'System', details: { from: 'new', to: 'triaging' }, timestamp: minutesAgo(8) });
  insertAuditLog({ id: uuidv4(), action: 'FALSE_POSITIVE', entityType: 'case', entityId: case_kavya, analyst: 'Rohan Gupta', details: { reason: 'Employee Travel', resolution: 'Confirmed with user via phone' }, timestamp: daysAgo(4, 10, 0) });

  // ── Seed User U101 & 4 Core Parameters Benchmark ─────────────────────────
  seedU101Benchmark();

  // ── Seed Initial SOC Personnel (Admin & Analyst) ─────────────────────────
  seedSocUsers();

  console.log('✅ Database seeded successfully!');
  console.log('   Users: 16 (includes User U101 benchmark)');
  console.log('   Login Events: 110+');
  console.log('   Alerts: 10');
  console.log('   Cases: 6 (5 active, 1 false positive, CASE-0006 for U101)');
  console.log('   Investigation Notes: 7');
  console.log('   Notifications: 6');
  console.log('   Audit Logs: 9');
}

export function seedU101Benchmark() {
  const existingCase = sqlite.prepare("SELECT id FROM cases WHERE id = 'case-u101-tc4'").get() as any;
  if (existingCase) {
    console.log('User U101 benchmark & CASE-0006 already present in database.');
    return;
  }

  console.log('🎯 Seeding User U101 benchmark & 4 core investigation test cases...');
  const coords = CITY_COORDS['Bengaluru'] ?? { lat: 12.9716, lng: 77.5946 };
  const moscowCoords = { lat: 55.7558, lng: 37.6173 };

  // 1. Insert User U101
  sqlite.prepare(`
    INSERT OR REPLACE INTO users (
      id, name, email, department, role, avatar_color,
      known_countries, known_cities, known_devices, known_browsers, known_ips,
      typical_login_start, typical_login_end, typical_days,
      current_risk, risk_level, risk_trend,
      total_logins, failed_logins, last_login, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'U101', 'User U101', 'u101@company.com', 'Core Infrastructure', 'Staff Security Engineer', '#06B6D4',
    JSON.stringify(['India']),
    JSON.stringify(['Bengaluru']),
    JSON.stringify(['MacBook Pro', 'FP-MACPRO-U101']),
    JSON.stringify(['Chrome', 'Firefox']),
    JSON.stringify(['103.21.45.10']),
    8, 22, JSON.stringify([1, 2, 3, 4, 5]),
    88, 'critical', JSON.stringify([0, 0, 5, 0, 10, 28, 88]),
    14, 0, hoursAgo(0.5), daysAgo(30)
  );

  // 2. Insert baseline normal events for U101 (last 7 days)
  for (let i = 1; i <= 6; i++) {
    insertEvent({
      id: `ev-u101-base-${i}`,
      userId: 'U101',
      timestamp: daysAgo(i, 9, 30),
      ip: '103.21.45.10',
      country: 'India',
      city: 'Bengaluru',
      lat: coords.lat,
      lng: coords.lng,
      device: 'MacBook Pro',
      browser: 'Chrome',
      os: 'macOS',
      result: 'success',
      isVPN: false,
      vpnDetected: 'not_detected',
      riskScore: 0,
      riskLevel: 'safe',
      confidence: 0.1,
      signals: [],
      explanation: 'Normal authentication event — consistent with user baseline across IP, location, timeline, and network.',
    });
  }

  // 3. Test Case 1: Normal Login (Safe)
  // IP: 103.21.45.10, Bengaluru, 09:15 AM, VPN: NOT DETECTED
  const tc1Date = new Date();
  tc1Date.setHours(9, 15, 0, 0);
  insertEvent({
    id: 'ev-u101-tc1',
    userId: 'U101',
    timestamp: tc1Date.toISOString(),
    ip: '103.21.45.10',
    country: 'India',
    city: 'Bengaluru',
    lat: coords.lat,
    lng: coords.lng,
    device: 'MacBook Pro',
    browser: 'Chrome',
    os: 'macOS',
    result: 'success',
    isVPN: false,
    vpnDetected: 'not_detected',
    riskScore: 0,
    riskLevel: 'safe',
    confidence: 0.1,
    signals: [],
    explanation: 'Normal authentication event — consistent with user baseline across IP, location, timeline, and network.',
    attackScenario: 'normal',
    correlationId: 'CORR-U101-BENCHMARK',
  });

  // 4. Test Case 2: VPN Only (Low risk / Signal only, not compromised)
  // IP: 103.21.45.50, Bengaluru, 10:00 AM, VPN: DETECTED
  const tc2Date = new Date();
  tc2Date.setHours(10, 0, 0, 0);
  const tc2Signals = [{
    id: 'vpn',
    name: 'VPN Detected',
    category: 'network',
    points: 10,
    severity: 'low',
    evidence: 'VPN detected on IP 103.21.45.50 (Corporate VPN Gateway). Treated as an investigation signal, not automatic compromise.',
  }];
  insertEvent({
    id: 'ev-u101-tc2',
    userId: 'U101',
    timestamp: tc2Date.toISOString(),
    ip: '103.21.45.50',
    country: 'India',
    city: 'Bengaluru',
    lat: coords.lat,
    lng: coords.lng,
    device: 'MacBook Pro',
    browser: 'Chrome',
    os: 'macOS',
    result: 'success',
    isVPN: true,
    vpnDetected: 'detected',
    isp: 'Corporate VPN Gateway',
    riskScore: 10,
    riskLevel: 'safe',
    confidence: 0.45,
    signals: tc2Signals,
    explanation: 'Detected 1 risk indicator(s): VPN Detected. Core parameter flags: VPN detected [Corporate VPN Gateway]. Risk score: 10/100. Review and monitor.',
    attackScenario: 'vpn_login',
    correlationId: 'CORR-U101-BENCHMARK',
  });

  // 5. Test Case 3: New IP + VPN (Suspicious)
  // IP: 185.22.91.44, Bengaluru, 10:30 AM, VPN: DETECTED
  const tc3Date = new Date();
  tc3Date.setHours(10, 30, 0, 0);
  const tc3Signals = [
    {
      id: 'new_ip',
      name: 'New IP Address',
      category: 'network',
      points: 8,
      severity: 'low',
      evidence: 'IP 185.22.91.44 is not in user\'s known IP baseline (103.21.45.10).',
    },
    {
      id: 'vpn',
      name: 'VPN Detected',
      category: 'network',
      points: 10,
      severity: 'low',
      evidence: 'VPN detected on IP 185.22.91.44 (NordSec Ltd). Treated as an investigation signal, not automatic compromise.',
    },
  ];
  insertEvent({
    id: 'ev-u101-tc3',
    userId: 'U101',
    timestamp: tc3Date.toISOString(),
    ip: '185.22.91.44',
    country: 'India',
    city: 'Bengaluru',
    lat: coords.lat,
    lng: coords.lng,
    device: 'MacBook Pro',
    browser: 'Chrome',
    os: 'macOS',
    result: 'success',
    isVPN: true,
    vpnDetected: 'detected',
    isp: 'NordSec Ltd',
    riskScore: 28,
    riskLevel: 'suspicious',
    confidence: 0.65,
    signals: tc3Signals,
    explanation: 'Detected 2 risk indicator(s): New IP Address, VPN Detected. Core parameter flags: new IP (185.22.91.44), VPN detected [NordSec Ltd]. Risk score: 28/100. Review and monitor.',
    attackScenario: 'vpn_login',
    correlationId: 'CORR-U101-BENCHMARK',
  });

  insertAlert({
    id: 'alert-u101-tc3',
    alertType: 'vpn_anomaly',
    title: 'New IP + VPN Login Detected',
    description: 'User U101 authenticated using unrecognized IP 185.22.91.44 with active VPN tunnel (NordSec Ltd). Location Bengaluru matches home city.',
    severity: 'suspicious',
    status: 'open',
    userId: 'U101',
    relatedEventIds: ['ev-u101-tc3'],
    riskScore: 28,
    confidence: 0.65,
    signals: tc3Signals,
    explanation: 'New IP and VPN detection triggered suspicious classification.',
    firstSeen: tc3Date.toISOString(),
    lastSeen: tc3Date.toISOString(),
  });

  // 6. Test Case 4: Full Suspicious Login (Critical Docket)
  // IP: 185.22.91.44, Moscow, Russia, 02:49 AM, VPN: DETECTED
  const tc4Date = new Date();
  tc4Date.setHours(2, 49, 0, 0);
  const tc4Signals = [
    {
      id: 'new_country',
      name: 'New Country',
      category: 'location',
      points: 20,
      severity: 'high',
      evidence: 'Russia not previously observed for this user (Known countries: India).',
    },
    {
      id: 'odd_hour',
      name: 'Unusual Login Time',
      category: 'time',
      points: 10,
      severity: 'low',
      evidence: 'User typically logs in between 08:00 and 22:00. This login occurred at 02:49 local time.',
    },
    {
      id: 'new_ip',
      name: 'New IP Address',
      category: 'network',
      points: 8,
      severity: 'low',
      evidence: 'IP 185.22.91.44 is not in user\'s known IP baseline (103.21.45.10).',
    },
    {
      id: 'vpn',
      name: 'VPN Detected',
      category: 'network',
      points: 10,
      severity: 'low',
      evidence: 'VPN detected on IP 185.22.91.44 (NordSec Ltd). Treated as an investigation signal, not automatic compromise.',
    },
    {
      id: 'new_device',
      name: 'New Device',
      category: 'device',
      points: 15,
      severity: 'medium',
      evidence: 'Unrecognized Linux device not in user\'s registered baseline.',
    },
    {
      id: 'behavioral_anomaly',
      name: 'Behavioral Anomaly',
      category: 'behavioral',
      points: 15,
      severity: 'high',
      evidence: 'New country (Russia) AND new device (Linux Workstation) combination.',
    },
    {
      id: 'blacklisted_ip',
      name: 'Suspicious IP Reputation',
      category: 'network',
      points: 10,
      severity: 'medium',
      evidence: 'IP 185.22.91.44 identified on proxy/VPN risk lists.',
    },
  ];

  insertEvent({
    id: 'ev-u101-tc4',
    userId: 'U101',
    timestamp: tc4Date.toISOString(),
    ip: '185.22.91.44',
    country: 'Russia',
    city: 'Moscow',
    lat: moscowCoords.lat,
    lng: moscowCoords.lng,
    isNewCountry: true,
    isNewCity: true,
    isNewDevice: true,
    isNewBrowser: true,
    device: 'Linux Workstation',
    browser: 'Firefox',
    os: 'Linux',
    result: 'success',
    isVPN: true,
    vpnDetected: 'detected',
    isp: 'NordSec Ltd',
    ipReputation: 'suspicious',
    riskScore: 88,
    riskLevel: 'critical',
    confidence: 0.94,
    signals: tc4Signals,
    explanation: 'CRITICAL: Detected 7 risk indicator(s): New Country, Unusual Login Time, New Device. Core parameter flags: new IP (185.22.91.44), unusual location (Moscow, Russia), outside normal window (02:00), VPN detected [NordSec Ltd]. Risk score: 88/100. Immediate investigation recommended.',
    attackScenario: 'vpn_login',
    correlationId: 'CORR-U101-BENCHMARK',
  });

  const alert_u101_tc4 = 'alert-u101-tc4';
  insertAlert({
    id: alert_u101_tc4,
    alertType: 'critical_suspicious_login',
    title: 'Suspicious Login: 4 Core Parameters Triggered',
    description: 'User U101 authenticated from Moscow, Russia at 02:49 AM via VPN (185.22.91.44) on an unregistered Linux workstation. All four core investigation parameters triggered.',
    severity: 'critical',
    status: 'investigating',
    userId: 'U101',
    relatedEventIds: ['ev-u101-tc1', 'ev-u101-tc4'],
    riskScore: 88,
    confidence: 0.94,
    signals: tc4Signals,
    explanation: 'Concurrent anomaly across IP, Location, Login Window, and VPN Detection parameters.',
    firstSeen: tc4Date.toISOString(),
    lastSeen: tc4Date.toISOString(),
  });

  const maxRow = sqlite.prepare("SELECT MAX(CAST(SUBSTR(case_number, 6) AS INTEGER)) as maxNum FROM cases").get() as any;
  const u101CaseNum = `CASE-${String((maxRow?.maxNum || 6) + 1).padStart(4, '0')}`;
  const case_u101 = 'case-u101-tc4';

  insertCase({
    id: case_u101,
    caseNumber: u101CaseNum,
    title: 'Suspicious Login — User U101 (4 Core Parameters Triggered)',
    description: 'Comprehensive authentication anomaly detected for User U101. All 4 core investigation parameters triggered: Unrecognized IP (185.22.91.44), Unusual Location (Moscow, Russia vs Bengaluru), Outside Normal Login Window (02:49 AM vs 08:00-22:00), and VPN Detected (NordSec Ltd Relay).',
    severity: 'critical',
    status: 'investigating',
    assignedAnalyst: 'Analyst: Rohan Gupta',
    userId: 'U101',
    relatedAlertIds: [alert_u101_tc4],
    relatedEventIds: ['ev-u101-tc1', 'ev-u101-tc2', 'ev-u101-tc3', 'ev-u101-tc4'],
    evidence: [
      { id: 'ev-c-1', type: 'ip', label: '1. IP Address', value: '185.22.91.44 (NEW IP — baseline: 103.21.45.10)', severity: 'high', reviewed: true },
      { id: 'ev-c-2', type: 'location', label: '2. Location', value: 'Moscow, Russia (UNUSUAL — baseline: Bengaluru, India)', severity: 'critical', reviewed: true },
      { id: 'ev-c-3', type: 'time', label: '3. Login Window', value: '02:49 AM (OUTSIDE NORMAL WINDOW 08:00 AM – 10:00 PM)', severity: 'high', reviewed: true },
      { id: 'ev-c-4', type: 'vpn', label: '4. VPN Detection', value: 'DETECTED (NordSec Ltd Relay — obfuscating origin)', severity: 'medium', reviewed: true },
      { id: 'ev-c-5', type: 'device', label: 'Device Profile', value: 'Unregistered Linux Workstation (Firefox)', severity: 'medium', reviewed: false },
    ],
    riskScore: 88,
    confidence: 0.94,
    createdAt: tc4Date.toISOString(),
    updatedAt: new Date().toISOString(),
  });

  sqlite.prepare('UPDATE alerts SET case_id = ?, status = ? WHERE id = ?').run(case_u101, 'investigating', alert_u101_tc4);

  insertNote({
    id: uuidv4(),
    caseId: case_u101,
    analyst: 'System Detection Engine',
    content: 'Automated case docket generated: All 4 core investigation parameters triggered simultaneously on authentication event ev-u101-tc4. IP: 185.22.91.44 (New), Location: Moscow, Russia (Unusual), Window: 02:49 AM (Outside 08:00-22:00 baseline), VPN: DETECTED (NordSec Ltd). Overall Risk: 88/100.',
    timestamp: tc4Date.toISOString(),
    noteType: 'note',
  });

  insertNote({
    id: uuidv4(),
    caseId: case_u101,
    analyst: 'Rohan Gupta',
    content: 'Triage assessment: User U101 baseline confirms normal presence in Bengaluru, India during daytime hours. NordSec Ltd is a commercial anonymizing VPN, not enterprise VPN. Suspicious credential use suspected. Active session revoked.',
    timestamp: new Date().toISOString(),
    noteType: 'action',
  });

  insertNotification({
    id: uuidv4(),
    type: 'critical_alert',
    title: 'Critical Alert: 4 Core Parameters Flagged (U101)',
    message: 'User U101 login from Moscow, Russia via VPN at 02:49 AM. CASE-0006 opened.',
    severity: 'critical',
    entityType: 'case',
    entityId: case_u101,
    createdAt: tc4Date.toISOString(),
  });

  console.log('✅ User U101 benchmark & CASE-0006 seeded successfully!');
}

export function seedSocUsers() {
  const existingCount = (sqlite.prepare('SELECT COUNT(*) as c FROM soc_users').get() as any)?.c || 0;
  if (existingCount > 0) {
    return;
  }

  console.log('🔐 Seeding initial SOC personnel (Admin & Analyst)...');
  const now = new Date().toISOString();

  // 1. Admin User
  const adminPass = hashPassword('Admin@Sentinel2026!');
  sqlite.prepare(`
    INSERT INTO soc_users (id, name, email, password_hash, salt, role, avatar_color, created_at, is_active)
    VALUES (?, ?, ?, ?, ?, 'ADMIN', '#3B82F6', ?, 1)
  `).run('soc-usr-admin', 'SOC Administrator', 'admin@sentineltrace.io', adminPass.hash, adminPass.salt, now);

  // 2. Analyst User
  const analystPass = hashPassword('Analyst@Sentinel2026!');
  sqlite.prepare(`
    INSERT INTO soc_users (id, name, email, password_hash, salt, role, avatar_color, created_at, is_active)
    VALUES (?, ?, ?, ?, ?, 'ANALYST', '#10B981', ?, 1)
  `).run('soc-usr-analyst', 'Rohan Gupta (Lead Analyst)', 'analyst@sentineltrace.io', analystPass.hash, analystPass.salt, now);

  // 3. Initial Remote Notification sample
  sqlite.prepare(`
    INSERT INTO remote_notifications (id, incident_id, recipient, channel, subject, body, status, created_at, sent_at)
    VALUES (?, ?, 'soc-alerts@sentineltrace.io', 'email', ?, ?, 'sent', ?, ?)
  `).run(
    'rem-notif-001',
    'case-u101-tc4',
    '[CRITICAL ALERT] SentinelTrace Incident CASE-0007: Suspicious Login — User U101',
    '🚨 CRITICAL SECURITY INCIDENT DETECTED\nIncident Docket: CASE-0007\nTarget Identity: Aarav Patel (U101)\nAssessed Risk: 88/100 [CRITICAL]\nTrigger: Russian VPN egress outside normal login window with new IP.',
    now,
    now
  );

  // 4. Initial Analyst Feedback sample
  sqlite.prepare(`
    INSERT INTO analyst_feedback (id, analyst_id, analyst_name, target_type, target_id, classification, notes, features_snapshot, created_at)
    VALUES (?, 'soc-usr-analyst', 'Rohan Gupta', 'case', 'case-u101-tc4', 'true_positive', 'Confirmed unauthorized adversary authentication from NordSec relay.', '{}', ?)
  `).run('fb-init-001', now);

  console.log('✅ SOC personnel seeded: admin@sentineltrace.io & analyst@sentineltrace.io');
}

