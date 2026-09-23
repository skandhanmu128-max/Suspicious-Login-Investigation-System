import { Router } from 'express';
import { sqlite } from '../db/database';
import { v4 as uuidv4 } from 'uuid';
import { evaluateCoreParameters } from '../security/behaviorEngine';

const router = Router();

function parseRow(row: any) {
  const fields = ['signals', 'related_event_ids'];
  const r = { ...row };
  for (const f of fields) {
    if (typeof r[f] === 'string') {
      try { r[f] = JSON.parse(r[f]); } catch { /* keep */ }
    }
  }
  return r;
}

// GET /api/alerts
router.get('/', (req, res) => {
  try {
    const { page = '1', limit = '50', severity, status, userId, search, sort = 'risk_score', order = 'desc' } = req.query as Record<string, string>;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const conditions: string[] = [];
    const params: any[] = [];

    if (severity) { conditions.push('a.severity = ?'); params.push(severity); }
    if (status) { conditions.push('a.status = ?'); params.push(status); }
    if (userId) { conditions.push('a.user_id = ?'); params.push(userId); }
    if (search) {
      conditions.push('(a.title LIKE ? OR a.description LIKE ? OR u.name LIKE ? OR a.alert_type LIKE ?)');
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const validSorts: Record<string, string> = { risk_score: 'a.risk_score', severity: 'a.severity', last_seen: 'a.last_seen', first_seen: 'a.first_seen' };
    const orderCol = validSorts[sort] ?? 'a.risk_score';

    const total = (sqlite.prepare(`SELECT COUNT(*) as c FROM alerts a JOIN users u ON a.user_id = u.id ${where}`).get(...params) as any).c;

    const alerts = sqlite.prepare(`
      SELECT a.*, u.name as user_name, u.email as user_email, u.avatar_color, u.department
      FROM alerts a JOIN users u ON a.user_id = u.id
      ${where}
      ORDER BY 
        CASE a.severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'suspicious' THEN 3 ELSE 4 END ASC,
        ${orderCol} ${order === 'asc' ? 'ASC' : 'DESC'}
      LIMIT ? OFFSET ?
    `).all(...params, parseInt(limit), offset).map(parseRow);

    res.json({ alerts, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/alerts/:id
router.get('/:id', (req, res) => {
  try {
    const alert = sqlite.prepare(`
      SELECT a.*, u.name as user_name, u.email as user_email, u.avatar_color, u.department,
        u.known_countries, u.known_cities, u.known_devices, u.known_ips, u.typical_login_start, u.typical_login_end,
        u.current_risk, u.risk_trend
      FROM alerts a JOIN users u ON a.user_id = u.id WHERE a.id = ?
    `).get(req.params.id);

    if (!alert) return res.status(404).json({ error: 'Alert not found' });

    const a = parseRow(alert as any);
    // Parse extra fields
    ['known_countries', 'known_cities', 'known_devices', 'known_ips', 'risk_trend'].forEach(f => {
      if (typeof a[f] === 'string') { try { a[f] = JSON.parse(a[f]); } catch { /* keep */ } }
    });

    const baseline = {
      knownCountries: a.known_countries ?? [],
      knownCities: a.known_cities ?? [],
      knownDevices: a.known_devices ?? [],
      knownBrowsers: [],
      knownIps: a.known_ips ?? [],
      typicalLoginStart: a.typical_login_start ?? 8,
      typicalLoginEnd: a.typical_login_end ?? 18,
      typicalDays: [1, 2, 3, 4, 5],
      homeCity: a.known_cities?.[0] ?? 'Bengaluru',
      homeCountry: a.known_countries?.[0] ?? 'India',
    };

    // Get related events
    const rawEvents = a.related_event_ids?.length
      ? sqlite.prepare(`
          SELECT e.*, u.name as user_name, u.avatar_color FROM login_events e
          JOIN users u ON e.user_id = u.id
          WHERE e.id IN (${a.related_event_ids.map(() => '?').join(',')})
          ORDER BY e.timestamp ASC
        `).all(...a.related_event_ids).map(parseRow)
      : [];

    let prev: any = null;
    const relatedEvents = rawEvents.map((ev: any) => {
      const coreParams = evaluateCoreParameters(ev, baseline, prev);
      prev = ev;
      return { ...ev, coreParameters: coreParams };
    });

    const primaryEvent = relatedEvents.slice().sort((e1: any, e2: any) => (e2.risk_score || 0) - (e1.risk_score || 0))[0] ?? null;
    const coreParameters = primaryEvent?.coreParameters ?? null;

    // Get associated case
    const associatedCase = a.case_id
      ? sqlite.prepare('SELECT * FROM cases WHERE id = ?').get(a.case_id)
      : null;

    // Log audit
    sqlite.prepare(`
      INSERT INTO audit_logs (id, action, entity_type, entity_id, analyst, details, timestamp)
      VALUES (?, 'ALERT_VIEWED', 'alert', ?, 'SOC Analyst', '{}', ?)
    `).run(uuidv4(), req.params.id, new Date().toISOString());

    res.json({
      alert: a,
      coreParameters,
      baseline,
      primaryEvent,
      relatedEvents,
      associatedCase: associatedCase ? parseRow(associatedCase as any) : null
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/alerts/:id — update status
router.patch('/:id', (req, res) => {
  try {
    const { status, acknowledgedBy } = req.body;
    const now = new Date().toISOString();
    const alert = sqlite.prepare('SELECT * FROM alerts WHERE id = ?').get(req.params.id) as any;
    if (!alert) return res.status(404).json({ error: 'Alert not found' });

    const updates: string[] = ['status = ?'];
    const params: any[] = [status];

    if (status === 'acknowledged') { updates.push('acknowledged_at = ?', 'acknowledged_by = ?'); params.push(now, acknowledgedBy ?? 'SOC Analyst'); }
    if (status === 'closed' || status === 'false_positive') { updates.push('resolved_at = ?', 'resolved_by = ?'); params.push(now, acknowledgedBy ?? 'SOC Analyst'); }

    params.push(req.params.id);
    sqlite.prepare(`UPDATE alerts SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    sqlite.prepare(`
      INSERT INTO audit_logs (id, action, entity_type, entity_id, analyst, details, timestamp)
      VALUES (?, 'ALERT_STATUS_CHANGED', 'alert', ?, ?, ?, ?)
    `).run(uuidv4(), req.params.id, acknowledgedBy ?? 'SOC Analyst', JSON.stringify({ from: alert.status, to: status }), now);

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/alerts/:id/feedback — Store analyst classification for alert
router.post('/:id/feedback', (req, res) => {
  try {
    const { classification, notes = '', analystName = 'SOC Analyst', analystId = 'soc-analyst' } = req.body;
    if (!classification) {
      return res.status(400).json({ error: 'Classification is required.' });
    }

    const a = sqlite.prepare('SELECT * FROM alerts WHERE id = ?').get(req.params.id) as any;
    if (!a) return res.status(404).json({ error: 'Alert not found' });

    const now = new Date().toISOString();
    const feedbackId = `fb-${uuidv4().slice(0, 8)}`;

    const featuresSnapshot = {
      alertType: a.alert_type,
      riskScore: a.risk_score,
      severity: a.severity,
      userId: a.user_id,
      timestamp: a.first_seen,
    };

    // 1. Record into analyst_feedback table
    sqlite.prepare(`
      INSERT INTO analyst_feedback (id, analyst_id, analyst_name, target_type, target_id, classification, notes, features_snapshot, created_at)
      VALUES (?, ?, ?, 'alert', ?, ?, ?, ?, ?)
    `).run(feedbackId, analystId, analystName, req.params.id, classification, notes, JSON.stringify(featuresSnapshot), now);

    // 2. Map classification to alert status
    let newStatus = a.status;
    if (classification === 'false_positive') newStatus = 'false_positive';
    else if (classification === 'true_positive' || classification === 'under_investigation') newStatus = 'investigating';
    else if (classification === 'resolved') newStatus = 'closed';

    sqlite.prepare(`
      UPDATE alerts SET status = ?, resolved_at = ?, resolved_by = ? WHERE id = ?
    `).run(newStatus, now, analystName, req.params.id);

    // 3. Audit log
    sqlite.prepare(`
      INSERT INTO audit_logs (id, action, entity_type, entity_id, analyst, details, timestamp)
      VALUES (?, 'ALERT_FEEDBACK_SUBMITTED', 'alert', ?, ?, ?, ?)
    `).run(uuidv4(), req.params.id, analystName, JSON.stringify({ classification, notes }), now);

    res.json({ success: true, feedbackId, status: newStatus });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

