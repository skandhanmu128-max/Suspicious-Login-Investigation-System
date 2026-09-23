// ─── Simulation Engine ────────────────────────────────────────────────────────
// Generates realistic attack scenarios for the simulator page and attack replay.

import { v4 as uuidv4 } from 'uuid';
import { CITY_COORDS } from './geoService';
import { checkThreatIntel } from './threatIntel';
import { calculateRisk } from './riskEngine';
import { generateDeviceFingerprint } from './behaviorEngine';

export type ScenarioType =
  | 'normal'
  | 'new_device'
  | 'impossible_travel'
  | 'brute_force'
  | 'password_spray'
  | 'account_takeover'
  | 'vpn_login'
  | 'odd_hour';

export interface SimulationEvent {
  id: string;
  userId: string;
  timestamp: string;
  ip: string;
  country: string;
  city: string;
  lat: number;
  lng: number;
  device: string;
  browser: string;
  os: string;
  isMobile: boolean;
  deviceFingerprint: string;
  result: 'success' | 'failure';
  isVPN: boolean;
  isTor: boolean;
  isProxy: boolean;
  ipReputation: 'clean' | 'suspicious' | 'malicious';
  isNewDevice: boolean;
  isNewCountry: boolean;
  isNewCity: boolean;
  isNewBrowser: boolean;
  riskScore: number;
  riskLevel: string;
  confidence: number;
  signals: any[];
  explanation: string;
  attackScenario: ScenarioType;
  correlationId: string;
  delayMs?: number; // for replay mode
}

const DEVICES = ['MacBook Pro', 'Windows Laptop', 'Linux Desktop', 'iPad', 'Android Phone'];
const BROWSERS = ['Chrome', 'Firefox', 'Safari', 'Edge', 'Brave'];
const OS_LIST = ['macOS', 'Windows 11', 'Windows 10', 'Ubuntu', 'iOS', 'Android'];

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateIP(prefix: string = ''): string {
  if (prefix) return `${prefix}.${Math.floor(Math.random() * 254) + 1}.${Math.floor(Math.random() * 254) + 1}`;
  return `${Math.floor(Math.random() * 200) + 1}.${Math.floor(Math.random() * 254)}.${Math.floor(Math.random() * 254)}.${Math.floor(Math.random() * 254) + 1}`;
}

function makeTimestamp(base: Date, offsetMinutes: number = 0): string {
  return new Date(base.getTime() + offsetMinutes * 60 * 1000).toISOString();
}

export const SCENARIOS: Record<ScenarioType, {
  name: string;
  description: string;
  expectedLevel: string;
  steps: string[];
}> = {
  normal: {
    name: 'Normal Employee Login',
    description: 'Employee logging in from their usual location during business hours on a known device.',
    expectedLevel: 'SAFE',
    steps: ['Login from known location', 'Known device', 'Business hours', 'Success'],
  },
  new_device: {
    name: 'New Device Login',
    description: 'Known user, known country, but accessing from an unrecognized device or browser.',
    expectedLevel: 'SUSPICIOUS',
    steps: ['Login from known country', 'New/unrecognized device', 'Authentication success'],
  },
  impossible_travel: {
    name: 'Impossible Travel',
    description: 'User appears to log in from two geographically distant locations in an implausibly short time.',
    expectedLevel: 'CRITICAL',
    steps: ['Login from Bengaluru', 'Wait 20 minutes', 'Login from Berlin', 'Impossible travel detected'],
  },
  brute_force: {
    name: 'Credential Stuffing / Brute Force',
    description: 'Multiple failed login attempts followed by a successful authentication from a new location with a new device.',
    expectedLevel: 'CRITICAL',
    steps: ['8 failed logins', 'Successful login', 'New device detected', 'New country detected', 'Critical alert'],
  },
  password_spray: {
    name: 'Password Spraying',
    description: 'Single IP address attempts authentication against multiple accounts with few attempts each — avoiding lockout.',
    expectedLevel: 'CRITICAL',
    steps: ['1-2 attempts per user', 'Same source IP', '5+ target accounts', 'Spray pattern detected'],
  },
  account_takeover: {
    name: 'Account Takeover Chain',
    description: 'Full account takeover scenario: new country, new device, unusual hour, successful login via VPN.',
    expectedLevel: 'CRITICAL',
    steps: ['New country', 'New device', 'Odd hour', 'VPN active', 'Successful login', 'Critical incident created'],
  },
  vpn_login: {
    name: 'VPN-Based Suspicious Login',
    description: 'Login from new IP 185.22.91.44, Moscow, at 02:49 AM with VPN detected — demonstrating all 4 core parameters.',
    expectedLevel: 'CRITICAL',
    steps: ['IP: 185.22.91.44 (New IP)', 'Location: Moscow, Russia (Unusual)', 'Timeline: 02:49 AM (Outside Window)', 'VPN: DETECTED (NordSec Relay)'],
  },
  odd_hour: {
    name: 'Odd-Hour Behavioral Anomaly',
    description: 'User who normally logs in 08:00–18:00 suddenly authenticating at 02:30 from a new device.',
    expectedLevel: 'HIGH',
    steps: ['2:30 AM login', 'New device', 'Outside normal hours', 'Behavioral anomaly flagged'],
  },
};

export function generateScenarioEvents(
  scenario: ScenarioType,
  userId: string,
  userBaseline: {
    knownCountries: string[];
    knownCities: string[];
    knownDevices: string[];
    knownBrowsers: string[];
    typicalLoginStart: number;
    typicalLoginEnd: number;
    typicalDays: number[];
    homeCity: string;
    homeCountry: string;
    knownDevice: string;
    knownBrowser: string;
  }
): SimulationEvent[] {
  const now = new Date();
  const correlationId = `CORR-${scenario.toUpperCase()}-${Date.now().toString(36)}`;
  const events: SimulationEvent[] = [];

  const homeCoords = CITY_COORDS[userBaseline.homeCity] ?? CITY_COORDS['Bengaluru'];
  const berlinCoords = CITY_COORDS['Berlin']!;

  function makeEvent(overrides: Partial<SimulationEvent> & { timestamp: string }): SimulationEvent {
    const device = overrides.device ?? userBaseline.knownDevice;
    const browser = overrides.browser ?? userBaseline.knownBrowser;
    const os = overrides.os ?? 'macOS';
    const isMobile = overrides.isMobile ?? false;
    const fp = generateDeviceFingerprint(device, browser, os, isMobile);
    const ip = overrides.ip ?? generateIP();
    const intel = checkThreatIntel(ip);
    const country = overrides.country ?? userBaseline.homeCountry;
    const city = overrides.city ?? userBaseline.homeCity;
    const coords = CITY_COORDS[city] ?? homeCoords;

    const isNewDevice = overrides.isNewDevice ?? !userBaseline.knownDevices.includes(device);
    const isNewCountry = overrides.isNewCountry ?? !userBaseline.knownCountries.includes(country);
    const isNewCity = overrides.isNewCity ?? !userBaseline.knownCities.includes(city);
    const isNewBrowser = overrides.isNewBrowser ?? !userBaseline.knownBrowsers.includes(browser);

    const riskInput = {
      userId,
      timestamp: overrides.timestamp,
      ip,
      country,
      city,
      lat: coords.lat,
      lng: coords.lng,
      device,
      browser,
      os,
      isMobile,
      result: overrides.result ?? 'success',
      isVPN: overrides.isVPN ?? intel.isVPN,
      isTor: overrides.isTor ?? intel.isTor,
      isProxy: overrides.isProxy ?? intel.isProxy,
      ipReputation: (overrides.ipReputation ?? intel.reputation) as 'clean' | 'suspicious' | 'malicious',
      isNewDevice,
      isNewCountry,
      isNewCity,
      isNewBrowser,
      typicalLoginStart: userBaseline.typicalLoginStart,
      typicalLoginEnd: userBaseline.typicalLoginEnd,
      typicalDays: userBaseline.typicalDays,
      recentFailures: overrides.recentFailures ?? 0,
      recentUniqueUsers: overrides.recentUniqueUsers ?? 0,
      previousLoginEvent: overrides.previousLoginEvent ?? null,
      recentCountries: overrides.recentCountries ?? [],
      knownCountries: userBaseline.knownCountries,
    } as any;

    const risk = calculateRisk(riskInput);

    return {
      id: uuidv4(),
      userId,
      timestamp: overrides.timestamp,
      ip,
      country,
      city,
      lat: overrides.lat ?? coords.lat,
      lng: overrides.lng ?? coords.lng,
      device,
      browser,
      os,
      isMobile,
      deviceFingerprint: fp,
      result: overrides.result ?? 'success',
      isVPN: overrides.isVPN ?? intel.isVPN,
      isTor: overrides.isTor ?? intel.isTor,
      isProxy: overrides.isProxy ?? intel.isProxy,
      ipReputation: (overrides.ipReputation ?? intel.reputation) as any,
      isNewDevice,
      isNewCountry,
      isNewCity,
      isNewBrowser,
      riskScore: risk.score,
      riskLevel: risk.level,
      confidence: risk.confidence,
      signals: risk.signals,
      explanation: risk.explanation,
      attackScenario: scenario,
      correlationId,
      delayMs: overrides.delayMs ?? 0,
      ...overrides,
    };
  }

  switch (scenario) {
    case 'normal': {
      events.push(makeEvent({
        timestamp: makeTimestamp(now, -5),
        device: userBaseline.knownDevice,
        browser: userBaseline.knownBrowser,
        country: userBaseline.homeCountry,
        city: userBaseline.homeCity,
        result: 'success',
        isNewDevice: false,
        isNewCountry: false,
        isNewCity: false,
        isNewBrowser: false,
        delayMs: 0,
      }));
      break;
    }

    case 'new_device': {
      events.push(makeEvent({
        timestamp: makeTimestamp(now, -3),
        device: 'Unknown Android Device',
        browser: 'Samsung Internet',
        os: 'Android',
        isMobile: true,
        country: userBaseline.homeCountry,
        city: userBaseline.homeCity,
        result: 'success',
        isNewDevice: true,
        isNewCountry: false,
        isNewCity: false,
        isNewBrowser: true,
        delayMs: 0,
      }));
      break;
    }

    case 'impossible_travel': {
      // Event 1: Normal login from home
      const e1 = makeEvent({
        timestamp: makeTimestamp(now, -25),
        device: userBaseline.knownDevice,
        browser: userBaseline.knownBrowser,
        country: userBaseline.homeCountry,
        city: userBaseline.homeCity,
        lat: homeCoords.lat,
        lng: homeCoords.lng,
        result: 'success',
        isNewDevice: false,
        isNewCountry: false,
        isNewCity: false,
        isNewBrowser: false,
        delayMs: 0,
      });
      events.push(e1);

      // Event 2: Login from Berlin 20 minutes later
      events.push(makeEvent({
        timestamp: makeTimestamp(now, -5),
        device: 'Windows Laptop',
        browser: 'Chrome',
        os: 'Windows 11',
        country: 'Germany',
        city: 'Berlin',
        lat: berlinCoords.lat,
        lng: berlinCoords.lng,
        result: 'success',
        isNewDevice: true,
        isNewCountry: true,
        isNewCity: true,
        isNewBrowser: false,
        previousLoginEvent: {
          country: e1.country,
          city: e1.city,
          lat: e1.lat,
          lng: e1.lng,
          timestamp: e1.timestamp,
        },
        recentCountries: [userBaseline.homeCountry, 'Germany'],
        delayMs: 3000,
      }));
      break;
    }

    case 'brute_force': {
      const attackIP = '203.0.113.45';
      // 8 failures
      for (let i = 0; i < 8; i++) {
        events.push(makeEvent({
          timestamp: makeTimestamp(now, -(30 - i * 3)),
          ip: attackIP,
          ipReputation: 'malicious',
          country: 'Russia',
          city: 'Moscow',
          lat: 55.7558,
          lng: 37.6173,
          device: 'Unknown Device',
          browser: 'Firefox',
          os: 'Linux',
          result: 'failure',
          isNewDevice: true,
          isNewCountry: true,
          isNewCity: true,
          isNewBrowser: false,
          recentFailures: i,
          delayMs: i * 800,
        }));
      }
      // Success after 8 failures
      events.push(makeEvent({
        timestamp: makeTimestamp(now, -5),
        ip: attackIP,
        ipReputation: 'malicious',
        country: 'Russia',
        city: 'Moscow',
        lat: 55.7558,
        lng: 37.6173,
        device: 'Unknown Device',
        browser: 'Firefox',
        os: 'Linux',
        result: 'success',
        isNewDevice: true,
        isNewCountry: true,
        isNewCity: true,
        isNewBrowser: false,
        recentFailures: 8,
        delayMs: 7000,
      }));
      break;
    }

    case 'password_spray': {
      const sprayIP = '198.51.100.22';
      // Same IP, different users — we use the provided user plus 4 fake ones
      const fakeUsers = ['user-spray-1', 'user-spray-2', 'user-spray-3', 'user-spray-4'];
      const allUsers = [userId, ...fakeUsers];
      allUsers.forEach((uid, i) => {
        events.push(makeEvent({
          timestamp: makeTimestamp(now, -(20 - i * 2)),
          userId: uid,
          ip: sprayIP,
          ipReputation: 'suspicious',
          country: 'Netherlands',
          city: 'Amsterdam',
          lat: CITY_COORDS['Amsterdam']!.lat,
          lng: CITY_COORDS['Amsterdam']!.lng,
          device: 'Unknown Device',
          browser: 'Chrome',
          os: 'Windows 10',
          result: 'failure',
          isNewDevice: true,
          isNewCountry: true,
          isNewCity: true,
          isNewBrowser: false,
          recentFailures: 2,
          recentUniqueUsers: i + 1,
          delayMs: i * 1000,
        }));
      });
      break;
    }

    case 'account_takeover': {
      const atoIP = '185.220.101.42';
      events.push(makeEvent({
        timestamp: makeTimestamp(now, -35),
        ip: atoIP,
        ipReputation: 'suspicious',
        isVPN: false,
        isTor: true,
        country: 'Ukraine',
        city: 'Kyiv',
        lat: 50.4501,
        lng: 30.5234,
        device: 'Unknown Linux Machine',
        browser: 'Firefox',
        os: 'Linux',
        result: 'failure',
        isNewDevice: true,
        isNewCountry: true,
        isNewCity: true,
        recentFailures: 1,
        delayMs: 0,
      }));
      events.push(makeEvent({
        timestamp: makeTimestamp(now, -30),
        ip: atoIP,
        ipReputation: 'suspicious',
        isTor: true,
        country: 'Ukraine',
        city: 'Kyiv',
        lat: 50.4501,
        lng: 30.5234,
        device: 'Unknown Linux Machine',
        browser: 'Firefox',
        os: 'Linux',
        result: 'failure',
        isNewDevice: true,
        isNewCountry: true,
        isNewCity: true,
        recentFailures: 2,
        delayMs: 1500,
      }));
      events.push(makeEvent({
        timestamp: makeTimestamp(now, -10),
        ip: '10.8.0.45',
        ipReputation: 'suspicious',
        isVPN: true,
        country: 'Germany',
        city: 'Berlin',
        lat: berlinCoords.lat,
        lng: berlinCoords.lng,
        device: 'Windows Laptop',
        browser: 'Chrome',
        os: 'Windows 11',
        result: 'success',
        isNewDevice: true,
        isNewCountry: true,
        isNewCity: true,
        recentFailures: 2,
        recentCountries: [userBaseline.homeCountry, 'Ukraine', 'Germany'],
        delayMs: 4000,
      }));
      break;
    }

    case 'vpn_login': {
      // 02:49 AM login from Moscow with 185.22.91.44 (NordSec VPN detected)
      const oddTime = new Date(now);
      oddTime.setHours(2, 49, 0, 0);
      events.push(makeEvent({
        timestamp: oddTime.toISOString(),
        ip: '185.22.91.44',
        ipReputation: 'suspicious',
        isVPN: true,
        country: 'Russia',
        city: 'Moscow',
        lat: 55.7558,
        lng: 37.6173,
        device: 'Unknown Linux Device',
        browser: 'Firefox',
        os: 'Linux',
        result: 'success',
        isNewDevice: true,
        isNewCountry: true,
        isNewCity: true,
        isNewBrowser: true,
        delayMs: 0,
      }));
      break;
    }

    case 'odd_hour': {
      // 2:30 AM login
      const oddTime = new Date(now);
      oddTime.setHours(2, 30, 0, 0);
      events.push(makeEvent({
        timestamp: oddTime.toISOString(),
        device: 'Unknown Windows Laptop',
        browser: 'Edge',
        os: 'Windows 11',
        country: userBaseline.homeCountry,
        city: userBaseline.homeCity,
        result: 'success',
        isNewDevice: true,
        isNewCountry: false,
        isNewCity: false,
        isNewBrowser: true,
        delayMs: 0,
      }));
      break;
    }
  }

  return events;
}
