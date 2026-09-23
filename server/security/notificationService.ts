import { v4 as uuidv4 } from 'uuid';
import { sqlite } from '../db/database';

export interface RemoteAlertPayload {
  incidentId: string;
  incidentTitle: string;
  caseNumber?: string;
  riskScore: number;
  userId: string;
  userName?: string;
  reason: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  recipient?: string;
}

export interface RemoteDispatchResult {
  id: string;
  channel: 'email' | 'push' | 'webhook';
  recipient: string;
  status: 'sent' | 'failed';
  timestamp: string;
}

/**
 * Dispatch remote security notifications to external channels (Email simulation / Push / Webhook).
 */
export function dispatchRemoteNotification(payload: RemoteAlertPayload): RemoteDispatchResult {
  const id = `rem-notif-${uuidv4().slice(0, 8)}`;
  const now = new Date().toISOString();
  const recipient = payload.recipient || 'soc-alerts@sentineltrace.io';

  const subject = `[${payload.severity.toUpperCase()} ALERT] SentinelTrace Incident ${payload.caseNumber || payload.incidentId}: ${payload.incidentTitle}`;
  const body = [
    `═══════════════════════════════════════════════════════════`,
    `🚨 ${payload.severity.toUpperCase()} SECURITY INCIDENT DETECTED`,
    `═══════════════════════════════════════════════════════════`,
    `Incident Docket : ${payload.caseNumber || payload.incidentId}`,
    `Threat Title    : ${payload.incidentTitle}`,
    `Assessed Risk   : ${payload.riskScore} / 100 [${payload.severity.toUpperCase()}]`,
    `Target Identity : ${payload.userName || payload.userId} (${payload.userId})`,
    `Primary Trigger : ${payload.reason}`,
    `Timestamp (UTC) : ${now}`,
    `═══════════════════════════════════════════════════════════`,
    `ACTION REQUIRED: Immediate triage required via SentinelTrace Mobile SOC Console.`,
    `Access URL      : http://localhost:5173/cases/${payload.incidentId}`,
  ].join('\n');

  try {
    sqlite.prepare(`
      INSERT INTO remote_notifications (id, incident_id, recipient, channel, subject, body, status, created_at, sent_at)
      VALUES (?, ?, ?, 'email', ?, ?, 'sent', ?, ?)
    `).run(id, payload.incidentId, recipient, subject, body, now, now);

    console.log(`\n📨 [REMOTE NOTIFICATION DISPATCHED] -> ${recipient}\n${subject}\n${body}\n`);

    return {
      id,
      channel: 'email',
      recipient,
      status: 'sent',
      timestamp: now,
    };
  } catch (err: any) {
    console.error('Failed to record remote notification:', err);
    return {
      id,
      channel: 'email',
      recipient,
      status: 'failed',
      timestamp: now,
    };
  }
}

/**
 * List recent remote notifications.
 */
export function getRecentRemoteNotifications(limit = 20) {
  try {
    return sqlite.prepare(`
      SELECT * FROM remote_notifications ORDER BY created_at DESC LIMIT ?
    `).all(limit);
  } catch {
    return [];
  }
}
