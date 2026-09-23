import { Router } from 'express';
import { sqlite } from '../db/database';
import { v4 as uuidv4 } from 'uuid';
import { evaluateCoreParameters } from '../security/behaviorEngine';

const router = Router();

function parseRow(row: any) {
  const fields = ['related_alert_ids', 'related_event_ids', 'evidence', 'risk_trend', 'known_countries', 'known_cities', 'known_devices', 'signals'];
  const r = { ...row };
  for (const f of fields) {
    if (typeof r[f] === 'string') {
      try { r[f] = JSON.parse(r[f]); } catch { /* keep */ }
    }
  }
  return r;
}

// GET /api/cases
router.get('/', (req, res) => {
  try {
    const { page = '1', limit = '20', severity, status, userId, search, sort = 'created_at', order = 'desc' } = req.query as Record<string, string>;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const conditions: string[] = [];
    const params: any[] = [];

    if (severity) { conditions.push('c.severity = ?'); params.push(severity); }
    if (status) { conditions.push('c.status = ?'); params.push(status); }
    if (userId) { conditions.push('c.user_id = ?'); params.push(userId); }
    if (search) {
      conditions.push('(c.title LIKE ? OR c.case_number LIKE ? OR u.name LIKE ? OR c.description LIKE ?)');
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const total = (sqlite.prepare(`SELECT COUNT(*) as t FROM cases c JOIN users u ON c.user_id = u.id ${where}`).get(...params) as any).t;

    const cases = sqlite.prepare(`
      SELECT c.*, u.name as user_name, u.email as user_email, u.avatar_color, u.department
      FROM cases c JOIN users u ON c.user_id = u.id
      ${where}
      ORDER BY
        CASE c.severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
        CASE c.status WHEN 'investigating' THEN 1 WHEN 'triaging' THEN 2 WHEN 'new' THEN 3 ELSE 4 END,
        c.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, parseInt(limit), offset).map(parseRow);

    res.json({ cases, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/cases — create new case
router.post('/', (req, res) => {
  try {
    const { title, description, severity, userId, relatedAlertIds = [], relatedEventIds = [], assignedAnalyst } = req.body;
    if (!title || !userId) return res.status(400).json({ error: 'title and userId required' });

    const count = (sqlite.prepare('SELECT COUNT(*) as c FROM cases').get() as any).c;
    const caseNumber = `CASE-${String(count + 1).padStart(4, '0')}`;
    const id = uuidv4();
    const now = new Date().toISOString();

    // Get risk from related alert
    let riskScore = 0, confidence = 0;
    if (relatedAlertIds.length) {
      const alert = sqlite.prepare('SELECT risk_score, confidence FROM alerts WHERE id = ?').get(relatedAlertIds[0]) as any;
      if (alert) { riskScore = alert.risk_score; confidence = alert.confidence; }
    }

    sqlite.prepare(`
      INSERT INTO cases (id, case_number, title, description, severity, status, assigned_analyst,
        user_id, related_alert_ids, related_event_ids, evidence, risk_score, confidence, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'new', ?, ?, ?, ?, '[]', ?, ?, ?, ?)
    `).run(id, caseNumber, title, description, severity ?? 'medium', assignedAnalyst ?? null,
      userId, JSON.stringify(relatedAlertIds), JSON.stringify(relatedEventIds),
      riskScore, confidence, now, now);

    // Update alerts with case_id
    for (const alertId of relatedAlertIds) {
      sqlite.prepare('UPDATE alerts SET case_id = ? WHERE id = ?').run(id, alertId);
    }

    sqlite.prepare(`INSERT INTO audit_logs (id, action, entity_type, entity_id, analyst, details, timestamp) VALUES (?, 'CASE_OPENED', 'case', ?, ?, ?, ?)`).run(
      uuidv4(), id, assignedAnalyst ?? 'SOC Analyst', JSON.stringify({ caseNumber }), now
    );

    // Notification
    sqlite.prepare(`INSERT INTO notifications (id, type, title, message, severity, entity_type, entity_id, created_at) VALUES (?, 'new_case', ?, ?, ?, 'case', ?, ?)`).run(
      uuidv4(), `New Investigation: ${caseNumber}`, title, severity ?? 'medium', id, now
    );

    res.json({ success: true, id, caseNumber });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/cases/:id
router.get('/:id', (req, res) => {
  try {
    const c = sqlite.prepare(`
      SELECT c.*, u.name as user_name, u.email as user_email, u.avatar_color, u.department, u.role,
        u.known_countries, u.known_cities, u.known_devices, u.known_browsers,
        u.typical_login_start, u.typical_login_end, u.current_risk, u.risk_trend, u.risk_level as user_risk_level
      FROM cases c JOIN users u ON c.user_id = u.id WHERE c.id = ?
    `).get(req.params.id);

    if (!c) return res.status(404).json({ error: 'Case not found' });

    const cs = parseRow(c as any);

    // Get related alerts
    const relatedAlerts = cs.related_alert_ids?.length
      ? sqlite.prepare(`SELECT a.*, u.name as user_name FROM alerts a JOIN users u ON a.user_id = u.id WHERE a.id IN (${cs.related_alert_ids.map(() => '?').join(',')})`).all(...cs.related_alert_ids)
      : [];

    // Get related events (timeline)
    const relatedEvents = cs.related_event_ids?.length
      ? sqlite.prepare(`
          SELECT e.*, u.name as user_name FROM login_events e JOIN users u ON e.user_id = u.id
          WHERE e.id IN (${cs.related_event_ids.map(() => '?').join(',')})
          ORDER BY e.timestamp ASC
        `).all(...cs.related_event_ids)
      : [];

    // Build baseline object
    const userKnownIps = (() => {
      try {
        const u = sqlite.prepare('SELECT known_ips FROM users WHERE id = ?').get(cs.user_id) as any;
        return u?.known_ips ? JSON.parse(u.known_ips) : [];
      } catch { return []; }
    })();

    const baseline = {
      knownCountries: cs.known_countries ?? [],
      knownCities: cs.known_cities ?? [],
      knownDevices: cs.known_devices ?? [],
      knownBrowsers: cs.known_browsers ?? [],
      knownIps: userKnownIps,
      typicalLoginStart: cs.typical_login_start ?? 8,
      typicalLoginEnd: cs.typical_login_end ?? 18,
      typicalDays: cs.typical_days ?? [1, 2, 3, 4, 5],
      homeCity: cs.known_cities?.[0] ?? 'Bengaluru',
      homeCountry: cs.known_countries?.[0] ?? 'India',
    };

    let prev: any = null;
    const enrichedEvents = relatedEvents.map((rawEv: any) => {
      const ev = parseRow(rawEv);
      const coreParams = evaluateCoreParameters(ev, baseline, prev);
      prev = ev;
      return { ...ev, coreParameters: coreParams };
    });

    // Primary suspicious event (highest risk score or latest)
    const primaryEvent = enrichedEvents.slice().sort((a: any, b: any) => (b.risk_score || 0) - (a.risk_score || 0))[0] ?? null;
    const caseCoreParameters = primaryEvent?.coreParameters ?? null;

    // Get investigation notes
    const notes = sqlite.prepare('SELECT * FROM investigation_notes WHERE case_id = ? ORDER BY timestamp ASC').all(req.params.id);

    // Get audit trail for this case
    const auditTrail = sqlite.prepare('SELECT * FROM audit_logs WHERE entity_id = ? ORDER BY timestamp DESC LIMIT 20').all(req.params.id);

    // Audit log
    sqlite.prepare(`INSERT INTO audit_logs (id, action, entity_type, entity_id, analyst, details, timestamp) VALUES (?, 'CASE_VIEWED', 'case', ?, 'SOC Analyst', '{}', ?)`).run(uuidv4(), req.params.id, new Date().toISOString());

    res.json({
      case: cs,
      coreParameters: caseCoreParameters,
      primaryEvent,
      baseline,
      relatedAlerts: relatedAlerts.map(parseRow),
      relatedEvents: enrichedEvents,
      notes,
      auditTrail,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/cases/:id
router.patch('/:id', (req, res) => {
  try {
    const { status, assignedAnalyst, resolution, falsePositiveReason, severity } = req.body;
    const now = new Date().toISOString();
    const existing = sqlite.prepare('SELECT * FROM cases WHERE id = ?').get(req.params.id) as any;
    if (!existing) return res.status(404).json({ error: 'Case not found' });

    const updates: string[] = ['updated_at = ?'];
    const params: any[] = [now];

    if (status) { updates.push('status = ?'); params.push(status); }
    if (assignedAnalyst) { updates.push('assigned_analyst = ?'); params.push(assignedAnalyst); }
    if (resolution) { updates.push('resolution = ?'); params.push(resolution); }
    if (falsePositiveReason) { updates.push('false_positive_reason = ?'); params.push(falsePositiveReason); }
    if (severity) { updates.push('severity = ?'); params.push(severity); }
    if (status === 'resolved' || status === 'false_positive') { updates.push('resolved_at = ?'); params.push(now); }

    params.push(req.params.id);
    sqlite.prepare(`UPDATE cases SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    const analyst = assignedAnalyst ?? 'SOC Analyst';
    sqlite.prepare(`INSERT INTO audit_logs (id, action, entity_type, entity_id, analyst, details, timestamp) VALUES (?, 'STATUS_CHANGED', 'case', ?, ?, ?, ?)`).run(
      uuidv4(), req.params.id, analyst, JSON.stringify({ from: existing.status, to: status, resolution, falsePositiveReason }), now
    );

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/cases/:id/notes
router.post('/:id/notes', (req, res) => {
  try {
    const { analyst, content, noteType = 'note' } = req.body;
    if (!content) return res.status(400).json({ error: 'content required' });

    const id = uuidv4();
    const now = new Date().toISOString();

    sqlite.prepare(`INSERT INTO investigation_notes (id, case_id, analyst, content, timestamp, note_type) VALUES (?, ?, ?, ?, ?, ?)`).run(
      id, req.params.id, analyst ?? 'SOC Analyst', content, now, noteType
    );
    sqlite.prepare(`UPDATE cases SET updated_at = ? WHERE id = ?`).run(now, req.params.id);
    sqlite.prepare(`INSERT INTO audit_logs (id, action, entity_type, entity_id, analyst, details, timestamp) VALUES (?, 'NOTE_ADDED', 'case', ?, ?, ?, ?)`).run(
      uuidv4(), req.params.id, analyst ?? 'SOC Analyst', JSON.stringify({ noteType }), now
    );

    res.json({ success: true, id, timestamp: now });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/cases/:id/evidence/:evidenceId
router.patch('/:id/evidence/:evidenceId', (req, res) => {
  try {
    const { reviewed } = req.body;
    const c = sqlite.prepare('SELECT evidence FROM cases WHERE id = ?').get(req.params.id) as any;
    if (!c) return res.status(404).json({ error: 'Case not found' });

    let evidence = [];
    try { evidence = JSON.parse(c.evidence); } catch { /* use empty */ }

    const idx = evidence.findIndex((e: any) => e.id === req.params.evidenceId);
    if (idx >= 0) {
      evidence[idx] = { ...evidence[idx], reviewed };
      sqlite.prepare('UPDATE cases SET evidence = ? WHERE id = ?').run(JSON.stringify(evidence), req.params.id);
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/cases/:id/timeline
router.get('/:id/timeline', (req, res) => {
  try {
    const c = sqlite.prepare('SELECT * FROM cases WHERE id = ?').get(req.params.id) as any;
    if (!c) return res.status(404).json({ error: 'Case not found' });

    const relatedEventIds: string[] = (() => { try { return JSON.parse(c.related_event_ids); } catch { return []; } })();

    const events = relatedEventIds.length
      ? sqlite.prepare(`SELECT e.*, u.name as user_name FROM login_events e JOIN users u ON e.user_id = u.id WHERE e.id IN (${relatedEventIds.map(() => '?').join(',')}) ORDER BY e.timestamp ASC`).all(...relatedEventIds)
      : [];

    const notes = sqlite.prepare('SELECT * FROM investigation_notes WHERE case_id = ? ORDER BY timestamp ASC').all(req.params.id);
    const auditLogs = sqlite.prepare('SELECT * FROM audit_logs WHERE entity_id = ? ORDER BY timestamp ASC').all(req.params.id);

    // Merge and sort all timeline items
    const timeline = [
      ...events.map((e: any) => ({ type: 'event', timestamp: e.timestamp, data: parseRow(e) })),
      ...notes.map((n: any) => ({ type: 'note', timestamp: n.timestamp, data: n })),
      ...auditLogs.map((a: any) => ({ type: 'audit', timestamp: a.timestamp, data: a })),
      { type: 'case_created', timestamp: c.created_at, data: { title: 'Case Opened', caseNumber: c.case_number } },
    ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    res.json({ timeline });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/cases/:id/feedback — Store analyst classification (True/False Positive / Under Investigation / Resolved)
router.post('/:id/feedback', (req, res) => {
  try {
    const { classification, notes = '', analystName = 'SOC Analyst', analystId = 'soc-analyst' } = req.body;
    if (!classification) {
      return res.status(400).json({ error: 'Classification is required.' });
    }

    const c = sqlite.prepare('SELECT * FROM cases WHERE id = ?').get(req.params.id) as any;
    if (!c) return res.status(404).json({ error: 'Case not found' });

    const now = new Date().toISOString();
    const feedbackId = `fb-${uuidv4().slice(0, 8)}`;

    const featuresSnapshot = {
      caseNumber: c.case_number,
      riskScore: c.risk_score,
      severity: c.severity,
      userId: c.user_id,
      timestamp: c.created_at,
    };

    // 1. Record into analyst_feedback table
    sqlite.prepare(`
      INSERT INTO analyst_feedback (id, analyst_id, analyst_name, target_type, target_id, classification, notes, features_snapshot, created_at)
      VALUES (?, ?, ?, 'case', ?, ?, ?, ?, ?)
    `).run(feedbackId, analystId, analystName, req.params.id, classification, notes, JSON.stringify(featuresSnapshot), now);

    // 2. Map classification to case status
    let newStatus = c.status;
    let resolutionText = c.resolution;
    let fpReason = c.false_positive_reason;

    if (classification === 'false_positive') {
      newStatus = 'false_positive';
      resolutionText = notes || 'Marked as false positive by analyst feedback.';
      fpReason = notes || 'Analyst verified benign activity.';
    } else if (classification === 'true_positive') {
      newStatus = 'investigating';
    } else if (classification === 'under_investigation') {
      newStatus = 'investigating';
    } else if (classification === 'resolved') {
      newStatus = 'resolved';
      resolutionText = notes || 'Incident resolved and mitigated.';
    }

    sqlite.prepare(`
      UPDATE cases SET status = ?, resolution = ?, false_positive_reason = ?, updated_at = ? WHERE id = ?
    `).run(newStatus, resolutionText, fpReason, now, req.params.id);

    // 3. Add to investigation notes
    sqlite.prepare(`
      INSERT INTO investigation_notes (id, case_id, analyst, content, timestamp, note_type)
      VALUES (?, ?, ?, ?, ?, 'action')
    `).run(uuidv4(), req.params.id, analystName, `Analyst Feedback Submitted: [${classification.toUpperCase()}]. ${notes}`, now);

    // 4. Audit log
    sqlite.prepare(`
      INSERT INTO audit_logs (id, action, entity_type, entity_id, analyst, details, timestamp)
      VALUES (?, 'ANALYST_FEEDBACK_SUBMITTED', 'case', ?, ?, ?, ?)
    `).run(uuidv4(), req.params.id, analystName, JSON.stringify({ classification, notes }), now);

    res.json({ success: true, feedbackId, status: newStatus });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

