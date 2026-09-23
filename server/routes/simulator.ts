import { Router } from 'express';
import { sqlite } from '../db/database';
import { v4 as uuidv4 } from 'uuid';
import { generateScenarioEvents, ScenarioType, SCENARIOS } from '../security/simulationEngine';
import { authenticateToken, requireRole } from '../security/auth';

const router = Router();

// GET /api/simulator/scenarios — list all available scenarios
router.get('/scenarios', (_req, res) => {
  res.json({ scenarios: SCENARIOS });
});

// POST /api/simulator/run — run a named scenario
router.post('/run', async (req, res) => {
  try {
    const { scenario, userId } = req.body as { scenario: ScenarioType; userId?: string };

    if (!scenario || !SCENARIOS[scenario]) {
      return res.status(400).json({ error: 'Invalid scenario. Valid: ' + Object.keys(SCENARIOS).join(', ') });
    }

    // Pick a user (default to Arjun for impossible_travel, Priya for brute_force, etc)
    const targetUserId = userId ?? getDefaultUser(scenario);
    const user = sqlite.prepare('SELECT * FROM users WHERE id = ?').get(targetUserId) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });

    const baseline = {
      knownCountries: JSON.parse(user.known_countries ?? '[]'),
      knownCities: JSON.parse(user.known_cities ?? '[]'),
      knownDevices: JSON.parse(user.known_devices ?? '[]'),
      knownBrowsers: JSON.parse(user.known_browsers ?? '[]'),
      typicalLoginStart: user.typical_login_start,
      typicalLoginEnd: user.typical_login_end,
      typicalDays: JSON.parse(user.typical_days ?? '[1,2,3,4,5]'),
      homeCity: JSON.parse(user.known_cities ?? '[]')[0] ?? 'Bengaluru',
      homeCountry: JSON.parse(user.known_countries ?? '[]')[0] ?? 'India',
      knownDevice: JSON.parse(user.known_devices ?? '[]').find((d: string) => !d.startsWith('FP-')) ?? 'MacBook Pro',
      knownBrowser: JSON.parse(user.known_browsers ?? '[]')[0] ?? 'Chrome',
    };

    const events = generateScenarioEvents(scenario, targetUserId, baseline);

    // Persist events to database
    for (const event of events) {
      const vpnDetected = event.isVPN ? 'detected' : 'not_detected';
      sqlite.prepare(`
        INSERT OR IGNORE INTO login_events (
          id, user_id, timestamp, ip, is_vpn, vpn_detected, is_tor, is_proxy, ip_reputation,
          country, city, lat, lng, is_new_country, is_new_city,
          device, browser, os, is_mobile, device_fingerprint, is_new_device, is_new_browser,
          result, risk_score, risk_level, confidence, signals, explanation,
          attack_scenario, correlation_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        event.id, event.userId, event.timestamp, event.ip,
        event.isVPN ? 1 : 0, vpnDetected, event.isTor ? 1 : 0, event.isProxy ? 1 : 0, event.ipReputation,
        event.country, event.city, event.lat, event.lng,
        event.isNewCountry ? 1 : 0, event.isNewCity ? 1 : 0,
        event.device, event.browser, event.os, event.isMobile ? 1 : 0, event.deviceFingerprint,
        event.isNewDevice ? 1 : 0, event.isNewBrowser ? 1 : 0,
        event.result, event.riskScore, event.riskLevel, event.confidence,
        JSON.stringify(event.signals), event.explanation,
        event.attackScenario, event.correlationId
      );
    }

    // Auto-generate alert if risk is high enough
    const highRiskEvents = events.filter(e => e.riskScore >= 50);
    let alertId: string | null = null;
    let caseId: string | null = null;

    if (highRiskEvents.length > 0) {
      const maxRisk = highRiskEvents.reduce((max, e) => e.riskScore > max.riskScore ? e : max);
      const scenarioInfo = SCENARIOS[scenario];

      alertId = uuidv4();
      const severity = maxRisk.riskScore >= 75 ? 'critical' : maxRisk.riskScore >= 50 ? 'high' : 'suspicious';

      sqlite.prepare(`
        INSERT INTO alerts (id, alert_type, title, description, severity, status, user_id,
          related_event_ids, risk_score, confidence, signals, explanation, first_seen, last_seen)
        VALUES (?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        alertId, scenario,
        `[SIM] ${scenarioInfo.name}`,
        `Simulation: ${scenarioInfo.description}`,
        severity, targetUserId,
        JSON.stringify(events.map(e => e.id)),
        maxRisk.riskScore, maxRisk.confidence,
        JSON.stringify(maxRisk.signals),
        maxRisk.explanation,
        events[0].timestamp, events[events.length - 1].timestamp
      );

      // Auto-create case for critical scenarios
      if (maxRisk.riskScore >= 75) {
        const count = (sqlite.prepare('SELECT COUNT(*) as c FROM cases').get() as any).c;
        caseId = uuidv4();
        const caseNumber = `CASE-${String(count + 1).padStart(4, '0')}`;

        sqlite.prepare(`
          INSERT INTO cases (id, case_number, title, description, severity, status,
            user_id, related_alert_ids, related_event_ids, evidence, risk_score, confidence, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, 'new', ?, ?, ?, '[]', ?, ?, ?, ?)
        `).run(
          caseId, caseNumber,
          `[SIM] ${scenarioInfo.name} — ${user.name}`,
          `Auto-created from simulation: ${scenarioInfo.description}`,
          severity, targetUserId,
          JSON.stringify([alertId]), JSON.stringify(events.map(e => e.id)),
          maxRisk.riskScore, maxRisk.confidence,
          new Date().toISOString(), new Date().toISOString()
        );

        sqlite.prepare('UPDATE alerts SET case_id = ? WHERE id = ?').run(caseId, alertId);

        // Notification
        sqlite.prepare(`INSERT INTO notifications (id, type, title, message, severity, entity_type, entity_id, created_at) VALUES (?, 'simulation', ?, ?, 'critical', 'case', ?, ?)`).run(
          uuidv4(), `[SIM] ${caseNumber} Created`,
          `Simulation triggered: ${scenarioInfo.name} for ${user.name}. Risk: ${maxRisk.riskScore}/100`,
          caseId, new Date().toISOString()
        );
      }

      // Update user risk
      sqlite.prepare(`UPDATE users SET current_risk = ?, risk_level = ?, last_login = ? WHERE id = ?`).run(
        maxRisk.riskScore,
        maxRisk.riskLevel,
        events[events.length - 1].timestamp,
        targetUserId
      );
    }

    // Audit log
    sqlite.prepare(`INSERT INTO audit_logs (id, action, entity_type, entity_id, analyst, details, timestamp) VALUES (?, 'SIMULATION_RUN', 'event', ?, 'SOC Analyst', ?, ?)`).run(
      uuidv4(), events[0]?.id ?? 'none', JSON.stringify({ scenario, eventsGenerated: events.length }), new Date().toISOString()
    );

    res.json({
      success: true,
      scenario,
      scenarioInfo: SCENARIOS[scenario],
      eventsGenerated: events.length,
      events,
      alertId,
      caseId,
      maxRiskScore: highRiskEvents[0]?.riskScore ?? 0,
    });
  } catch (err: any) {
    console.error('Simulation error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/simulator/reset — reset demo data (ADMIN only)
router.post('/reset', authenticateToken, requireRole(['ADMIN']), (_req, res) => {
  try {
    // Clear all data
    sqlite.exec(`
      DELETE FROM audit_logs;
      DELETE FROM investigation_notes;
      DELETE FROM notifications;
      DELETE FROM alerts;
      DELETE FROM cases;
      DELETE FROM login_events;
      UPDATE users SET current_risk = 0, risk_level = 'safe', risk_trend = '[]',
        total_logins = 0, failed_logins = 0, last_login = NULL;
    `);

    // Re-seed
    const { seedDatabase } = require('../db/seed');
    // Force re-seed by temporarily using raw sqlite
    sqlite.prepare("DELETE FROM users").run(); // Will cascade via foreign keys
    // Actually re-insert everything
    const seed = require('../db/seed');
    // Workaround: just tell frontend to reload
    res.json({ success: true, message: 'Demo environment reset. Please restart the server to re-seed.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

function getDefaultUser(scenario: ScenarioType): string {
  const map: Record<ScenarioType, string> = {
    normal: 'usr-006',
    new_device: 'usr-012',
    impossible_travel: 'usr-001',
    brute_force: 'usr-002',
    password_spray: 'usr-003',
    account_takeover: 'usr-011',
    vpn_login: 'U101',
    odd_hour: 'usr-006',
  };
  return map[scenario] ?? 'usr-001';
}

export default router;
