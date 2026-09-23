import { v4 as uuidv4 } from 'uuid';
import { sqlite } from '../db/database';
import { dispatchRemoteNotification } from './notificationService';

export interface SessionActivityInput {
  userId: string;
  sessionId: string;
  activityType: 'request_spike' | 'sensitive_resource_access' | 'session_duration_anomaly' | 'privilege_escalation' | 'data_export';
  resourceName?: string;
  requestCount?: number;
  durationSeconds?: number;
  ip?: string;
  userAgent?: string;
  timestamp?: string;
}

export interface SessionEvaluationResult {
  riskScore: number;
  riskLevel: 'safe' | 'suspicious' | 'high' | 'critical';
  confidence: number;
  signals: Array<{
    id: string;
    name: string;
    description: string;
    points: number;
    severity: string;
    evidence: string;
  }>;
  explanation: string;
  incidentCreated?: boolean;
  caseId?: string;
  caseNumber?: string;
}

// Department peer baselines (typical authorized resource prefixes and request ceilings)
const DEPARTMENT_PROFILES: Record<string, { typicalResources: string[]; maxNormalRequests: number }> = {
  Finance: {
    typicalResources: ['/financial/', '/payroll/', '/billing/', '/reports/', '/banking/'],
    maxNormalRequests: 80,
  },
  Engineering: {
    typicalResources: ['/git/', '/repos/', '/deploy/', '/api/v1/code/', '/ci-cd/', '/monitoring/'],
    maxNormalRequests: 180,
  },
  Marketing: {
    typicalResources: ['/campaigns/', '/social/', '/assets/', '/analytics/', '/media/'],
    maxNormalRequests: 60,
  },
  Sales: {
    typicalResources: ['/crm/', '/deals/', '/contacts/', '/pipeline/', '/quotes/'],
    maxNormalRequests: 70,
  },
  Executive: {
    typicalResources: ['/board/', '/reports/', '/financial/summary/', '/strategy/'],
    maxNormalRequests: 50,
  },
  'Core Infrastructure': {
    typicalResources: ['/k8s/', '/infra/', '/cloud/', '/vpn/', '/security/'],
    maxNormalRequests: 200,
  },
};

/**
 * Continuously evaluates in-session activity against individual and department baselines.
 */
export function evaluateSessionActivity(input: SessionActivityInput): SessionEvaluationResult {
  const timestamp = input.timestamp || new Date().toISOString();
  const requestCount = input.requestCount ?? 1;
  const duration = input.durationSeconds ?? 0;
  const resource = input.resourceName || '/unknown';

  // Fetch target user and department
  const user = sqlite.prepare(`
    SELECT id, name, email, department, role, current_risk FROM users WHERE id = ?
  `).get(input.userId) as any;

  if (!user) {
    throw new Error(`User '${input.userId}' not found.`);
  }

  const dept = user.department || 'Engineering';
  const deptProfile = DEPARTMENT_PROFILES[dept] || DEPARTMENT_PROFILES['Engineering'];

  const signals: any[] = [];
  let score = 0;

  // 1. High Velocity / Request Spike Anomaly
  if (requestCount > deptProfile.maxNormalRequests * 2) {
    const points = Math.min(35, Math.round(15 + (requestCount / deptProfile.maxNormalRequests) * 5));
    score += points;
    signals.push({
      id: 'session_request_spike',
      name: 'In-Session Request Volume Spike',
      description: `Observed ${requestCount} requests, exceeding peer group ceiling (${deptProfile.maxNormalRequests}/hr for ${dept})`,
      points,
      severity: requestCount > deptProfile.maxNormalRequests * 4 ? 'critical' : 'high',
      evidence: `Peer baseline: max ${deptProfile.maxNormalRequests} req/hr. Actual: ${requestCount} req. Rate: ${(requestCount / deptProfile.maxNormalRequests).toFixed(1)}x normal.`,
    });
  }

  // 2. Sensitive / Cross-Department Resource Access
  const isNormalResource = deptProfile.typicalResources.some(prefix => resource.toLowerCase().startsWith(prefix));
  const isHighlySensitive = /financial|payroll|ledger|salary|credentials|master_key|database_dump/i.test(resource);

  if (!isNormalResource && isHighlySensitive && dept !== 'Finance' && dept !== 'Executive') {
    const points = 35;
    score += points;
    signals.push({
      id: 'unauthorized_resource_access',
      name: 'Cross-Department Sensitive Resource Ingress',
      description: `${user.name} (${dept}) accessed restricted resource: ${resource}`,
      points,
      severity: 'critical',
      evidence: `User department is ${dept}. Attempted access to privileged domain '${resource}' outside normal operational boundary.`,
    });
  }

  // 3. Extended / Anomalous Session Duration
  if (duration > 43200) { // > 12 hours continuous active session
    const points = 15;
    score += points;
    signals.push({
      id: 'excessive_session_duration',
      name: 'Anomalous Active Session Duration',
      description: `Continuous session duration reached ${(duration / 3600).toFixed(1)} hours`,
      points,
      severity: 'medium',
      evidence: `Session has remained active for ${Math.round(duration / 60)} minutes without refresh or re-authentication.`,
    });
  }

  // Explicit activity type weights
  if (input.activityType === 'privilege_escalation') {
    score += 40;
    signals.push({
      id: 'privilege_escalation',
      name: 'In-Session Privilege Escalation Attempt',
      description: 'Attempted to modify administrative IAM attributes or bypass role constraints',
      points: 40,
      severity: 'critical',
      evidence: `Detected unauthorized elevation invocation on endpoint: ${resource}`,
    });
  } else if (input.activityType === 'data_export' && !isNormalResource) {
    score += 30;
    signals.push({
      id: 'anomalous_data_exfiltration',
      name: 'Mass Data Extraction / Export',
      description: `Bulk data export query triggered against ${resource}`,
      points: 30,
      severity: 'high',
      evidence: `Data extraction pattern detected outside standard working scope.`,
    });
  }

  const finalScore = Math.min(100, Math.max(0, score));
  const riskLevel: 'safe' | 'suspicious' | 'high' | 'critical' =
    finalScore >= 75 ? 'critical' :
    finalScore >= 50 ? 'high' :
    finalScore >= 30 ? 'suspicious' : 'safe';

  const confidence = signals.length > 0 ? Math.min(0.98, 0.75 + signals.length * 0.08) : 0.4;
  const explanation = signals.length > 0
    ? `Continuous session monitoring detected ${signals.length} behavioral anomaly signals during active session ${input.sessionId}. ${signals.map(s => s.name).join('; ')}.`
    : `Session activity within normal baseline parameters for ${dept} peer group.`;

  // Record session event in DB
  const eventId = `sess-ev-${uuidv4().slice(0, 8)}`;
  sqlite.prepare(`
    INSERT INTO session_events (id, user_id, session_id, activity_type, resource_name, request_count, duration_seconds, risk_score, signals, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    eventId,
    input.userId,
    input.sessionId,
    input.activityType,
    resource,
    requestCount,
    duration,
    finalScore,
    JSON.stringify(signals),
    timestamp
  );

  let incidentCreated = false;
  let caseId: string | undefined;
  let caseNumber: string | undefined;

  // Auto-generate Incident docket if high or critical risk
  if (finalScore >= 50) {
    incidentCreated = true;
    caseId = `case-sess-${uuidv4().slice(0, 8)}`;

    const lastCase = sqlite.prepare('SELECT case_number FROM cases ORDER BY rowid DESC LIMIT 1').get() as any;
    let nextNum = 8;
    if (lastCase?.case_number) {
      const match = lastCase.case_number.match(/\d+/);
      if (match) nextNum = parseInt(match[0], 10) + 1;
    }
    caseNumber = `CASE-${String(nextNum).padStart(4, '0')}`;

    const title = `Suspicious In-Session Activity — ${user.name} (${signals[0]?.name || 'Behavioral Anomaly'})`;
    const description = `Active session ${input.sessionId} for user ${user.name} (${user.department}) violated dynamic behavioral baselines. ${explanation}`;

    sqlite.prepare(`
      INSERT INTO cases (id, case_number, title, description, severity, status, assigned_analyst, user_id, related_alert_ids, related_event_ids, evidence, risk_score, confidence, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'new', 'SOC Automated Dispatch', ?, '[]', ?, ?, ?, ?, ?, ?)
    `).run(
      caseId,
      caseNumber,
      title,
      description,
      riskLevel === 'critical' ? 'critical' : 'high',
      user.id,
      JSON.stringify([eventId]),
      JSON.stringify(signals.map(s => ({
        id: s.id,
        type: 'session_signal',
        title: s.name,
        description: s.description,
        value: s.evidence,
        severity: s.severity,
        verified: false,
      }))),
      finalScore,
      confidence,
      timestamp,
      timestamp
    );

    // Create Notification
    sqlite.prepare(`
      INSERT INTO notifications (id, type, title, message, severity, entity_type, entity_id, created_at)
      VALUES (?, 'critical_session_anomaly', ?, ?, ?, 'case', ?, ?)
    `).run(
      uuidv4(),
      `Incident ${caseNumber}: Suspicious Session Activity`,
      `${user.name}: ${signals[0]?.name || 'In-session anomaly'} (Score: ${finalScore})`,
      riskLevel,
      caseId,
      timestamp
    );

    // Requirement 9: Dispatch Remote Notification (Email/Push simulation)
    dispatchRemoteNotification({
      incidentId: caseId,
      incidentTitle: title,
      caseNumber,
      riskScore: finalScore,
      userId: user.id,
      userName: user.name,
      reason: signals[0]?.description || explanation,
      severity: riskLevel === 'critical' ? 'critical' : 'high',
      recipient: 'soc-remote-alerts@sentineltrace.io',
    });
  }

  return {
    riskScore: finalScore,
    riskLevel,
    confidence,
    signals,
    explanation,
    incidentCreated,
    caseId,
    caseNumber,
  };
}
