// ─── Correlation Engine ───────────────────────────────────────────────────────
// Groups related events into alerts and creates incidents automatically.

export interface CorrelatedAlert {
  alertType: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'suspicious' | 'safe';
  relatedEventIds: string[];
  riskScore: number;
  confidence: number;
  signals: any[];
  userId: string;
}

export interface EventForCorrelation {
  id: string;
  userId: string;
  timestamp: string;
  ip: string;
  country: string;
  city: string;
  device: string;
  browser: string;
  result: string;
  riskScore: number;
  riskLevel: string;
  signals: any[];
  isNewDevice: boolean;
  isNewCountry: boolean;
  isVPN: boolean;
  isTor: boolean;
  ipReputation: string;
  correlationId?: string;
}

// ─── Correlation Rules ─────────────────────────────────────────────────────────

/**
 * Detect impossible travel: two logins from different geos within a short time
 */
export function detectImpossibleTravel(events: EventForCorrelation[]): {
  detected: boolean;
  eventIds: string[];
  description: string;
} {
  const sorted = [...events].sort((a, b) =>
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    const hasSignal = b.signals?.some((s: any) => s.id === 'impossible_travel');
    if (hasSignal) {
      return {
        detected: true,
        eventIds: [a.id, b.id],
        description: `Login from ${a.city}, ${a.country} then ${b.city}, ${b.country} in rapid succession`,
      };
    }
  }
  return { detected: false, eventIds: [], description: '' };
}

/**
 * Detect brute force: 3+ failures followed by success from the same account
 */
export function detectBruteForce(events: EventForCorrelation[]): {
  detected: boolean;
  eventIds: string[];
  failCount: number;
} {
  const sorted = [...events].sort((a, b) =>
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  let failures: EventForCorrelation[] = [];
  for (const event of sorted) {
    if (event.result === 'failure') {
      failures.push(event);
    } else if (event.result === 'success' && failures.length >= 3) {
      return {
        detected: true,
        eventIds: [...failures.map(f => f.id), event.id],
        failCount: failures.length,
      };
    } else {
      failures = []; // Reset if success with < 3 failures
    }
  }
  return { detected: false, eventIds: [], failCount: 0 };
}

/**
 * Detect password spraying: same IP, multiple users, few attempts per user
 */
export function detectPasswordSpraying(
  eventsFromIP: Array<{ userId: string; id: string; result: string; timestamp: string }>
): {
  detected: boolean;
  uniqueUsers: number;
  eventIds: string[];
} {
  const userAttempts = new Map<string, string[]>();
  for (const event of eventsFromIP) {
    if (!userAttempts.has(event.userId)) {
      userAttempts.set(event.userId, []);
    }
    userAttempts.get(event.userId)!.push(event.id);
  }

  const uniqueUsers = userAttempts.size;
  const allEventIds = eventsFromIP.map(e => e.id);

  // Password spray: same IP hitting 4+ users with few attempts each
  if (uniqueUsers >= 4) {
    const maxAttemptsPerUser = Math.max(...Array.from(userAttempts.values()).map(ids => ids.length));
    if (maxAttemptsPerUser <= 4) { // Few attempts per user
      return { detected: true, uniqueUsers, eventIds: allEventIds };
    }
  }

  return { detected: false, uniqueUsers, eventIds: [] };
}

/**
 * Check if a set of events constitutes an account takeover scenario
 */
export function detectAccountTakeover(events: EventForCorrelation[]): {
  detected: boolean;
  eventIds: string[];
  indicators: string[];
} {
  const indicators: string[] = [];
  const eventIds = events.map(e => e.id);
  const successEvents = events.filter(e => e.result === 'success');
  const failEvents = events.filter(e => e.result === 'failure');

  if (failEvents.length >= 3) indicators.push('Multiple authentication failures');
  if (successEvents.some(e => e.isNewCountry)) indicators.push('New country access');
  if (successEvents.some(e => e.isNewDevice)) indicators.push('New device detected');
  if (successEvents.some(e => e.isVPN || e.isTor)) indicators.push('VPN/Tor usage');
  if (events.some(e => e.signals?.some((s: any) => s.id === 'impossible_travel'))) {
    indicators.push('Impossible travel detected');
  }
  if (events.some(e => e.ipReputation === 'malicious')) indicators.push('Malicious IP');

  const detected = indicators.length >= 3 && successEvents.length > 0;
  return { detected, eventIds, indicators };
}

/**
 * Build a correlation ID from shared properties
 */
export function buildCorrelationId(userId: string, scenario: string): string {
  return `CORR-${userId.substring(0, 8)}-${scenario.toUpperCase()}-${Date.now().toString(36)}`;
}

/**
 * Determine if a group of events warrants automatic incident creation
 */
export function shouldCreateIncident(riskScore: number, signals: any[]): boolean {
  if (riskScore >= 75) return true;
  const hasCritical = signals.some((s: any) => s.severity === 'critical');
  if (hasCritical && signals.length >= 2) return true;
  return false;
}
