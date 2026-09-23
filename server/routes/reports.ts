import { Router } from 'express';
import { sqlite } from '../db/database';

const router = Router();

// GET /api/reports/:caseId — generate case report data
router.get('/:caseId', (req, res) => {
  try {
    const c = sqlite.prepare(`
      SELECT c.*, u.name as user_name, u.email as user_email, u.department, u.role,
        u.known_countries, u.known_cities
      FROM cases c JOIN users u ON c.user_id = u.id WHERE c.id = ?
    `).get(req.params.caseId) as any;

    if (!c) return res.status(404).json({ error: 'Case not found' });

    const parseJ = (s: string) => { try { return JSON.parse(s); } catch { return []; } };

    const relatedEventIds = parseJ(c.related_event_ids ?? '[]');
    const relatedAlertIds = parseJ(c.related_alert_ids ?? '[]');

    const events = relatedEventIds.length
      ? sqlite.prepare(`SELECT e.*, u.name as user_name FROM login_events e JOIN users u ON e.user_id = u.id WHERE e.id IN (${relatedEventIds.map(() => '?').join(',')}) ORDER BY e.timestamp ASC`).all(...relatedEventIds)
      : [];

    const alerts = relatedAlertIds.length
      ? sqlite.prepare(`SELECT * FROM alerts WHERE id IN (${relatedAlertIds.map(() => '?').join(',')})`).all(...relatedAlertIds)
      : [];

    const notes = sqlite.prepare('SELECT * FROM investigation_notes WHERE case_id = ? ORDER BY timestamp ASC').all(req.params.caseId);
    const auditTrail = sqlite.prepare('SELECT * FROM audit_logs WHERE entity_id = ? ORDER BY timestamp ASC').all(req.params.caseId);

    const report = {
      generatedAt: new Date().toISOString(),
      reportId: `RPT-${Date.now().toString(36).toUpperCase()}`,
      case: {
        ...c,
        evidence: parseJ(c.evidence ?? '[]'),
        related_event_ids: relatedEventIds,
        related_alert_ids: relatedAlertIds,
        known_countries: parseJ(c.known_countries ?? '[]'),
        known_cities: parseJ(c.known_cities ?? '[]'),
      },
      alerts: alerts.map((a: any) => ({
        ...a,
        signals: parseJ(a.signals ?? '[]'),
        related_event_ids: parseJ(a.related_event_ids ?? '[]'),
      })),
      authenticationTimeline: events.map((e: any) => ({
        ...e,
        signals: parseJ(e.signals ?? '[]'),
      })),
      investigationNotes: notes,
      auditTrail: auditTrail.map((l: any) => ({
        ...l,
        details: (() => { try { return JSON.parse(l.details); } catch { return {}; } })(),
      })),
      summary: {
        totalEvents: events.length,
        failedAttempts: (events as any[]).filter((e: any) => e.result === 'failure').length,
        successfulLogins: (events as any[]).filter((e: any) => e.result === 'success').length,
        countriesInvolved: [...new Set((events as any[]).map((e: any) => e.country))],
        devicesInvolved: [...new Set((events as any[]).map((e: any) => e.device))],
        maxRiskScore: c.risk_score,
        confidence: c.confidence,
      },
    };

    res.json({ report });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports — summary stats
router.get('/', (_req, res) => {
  try {
    const stats = {
      totalCases: (sqlite.prepare('SELECT COUNT(*) as c FROM cases').get() as any).c,
      resolvedCases: (sqlite.prepare("SELECT COUNT(*) as c FROM cases WHERE status = 'resolved'").get() as any).c,
      falsePositives: (sqlite.prepare("SELECT COUNT(*) as c FROM cases WHERE status = 'false_positive'").get() as any).c,
      criticalCases: (sqlite.prepare("SELECT COUNT(*) as c FROM cases WHERE severity = 'critical'").get() as any).c,
      averageRisk: (sqlite.prepare("SELECT AVG(risk_score) as avg FROM cases").get() as any).avg ?? 0,
      totalEvents: (sqlite.prepare("SELECT COUNT(*) as c FROM login_events").get() as any).c,
      totalAlerts: (sqlite.prepare("SELECT COUNT(*) as c FROM alerts").get() as any).c,
    };

    // Cases per severity
    const casesPerSeverity = sqlite.prepare('SELECT severity, COUNT(*) as count FROM cases GROUP BY severity').all();

    // Top triggered signals
    const allSignalRows = sqlite.prepare('SELECT signals FROM login_events WHERE signals != "[]"').all() as any[];
    const signalFreq: Record<string, number> = {};
    for (const row of allSignalRows) {
      try {
        const sigs = JSON.parse(row.signals);
        for (const s of sigs) { signalFreq[s.name] = (signalFreq[s.name] ?? 0) + 1; }
      } catch { /* skip */ }
    }

    res.json({
      stats,
      casesPerSeverity,
      topSignals: Object.entries(signalFreq).sort(([, a], [, b]) => b - a).slice(0, 8).map(([name, count]) => ({ name, count })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
