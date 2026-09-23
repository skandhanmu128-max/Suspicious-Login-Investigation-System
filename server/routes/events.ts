import { Router } from 'express';
import { sqlite } from '../db/database';
import { evaluateCoreParameters } from '../security/behaviorEngine';

const router = Router();

function parseRow(row: any) {
  const fields = ['signals', 'known_countries', 'known_cities', 'known_devices', 'known_browsers', 'known_ips', 'risk_trend', 'typical_days'];
  const result = { ...row };
  for (const f of fields) {
    if (typeof result[f] === 'string') {
      try { result[f] = JSON.parse(result[f]); } catch { /* keep */ }
    }
  }
  return result;
}

// GET /api/events — paginated, filtered
router.get('/', (req, res) => {
  try {
    const {
      page = '1', limit = '50',
      riskLevel, result, country, city, device, browser,
      search, sort = 'timestamp', order = 'desc',
      dateFrom, dateTo, isVPN, isTor, ipReputation,
    } = req.query as Record<string, string>;

    const targetUserId = req.query.userId || req.query.user_id;
    const targetRiskLevel = req.query.riskLevel || req.query.risk_level;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const conditions: string[] = [];
    const params: any[] = [];

    if (targetUserId) { conditions.push('e.user_id = ?'); params.push(targetUserId); }
    if (targetRiskLevel) { conditions.push('e.risk_level = ?'); params.push(targetRiskLevel); }
    if (result) { conditions.push('e.result = ?'); params.push(result); }
    if (country) { conditions.push('e.country LIKE ?'); params.push(`%${country}%`); }
    if (city) { conditions.push('e.city LIKE ?'); params.push(`%${city}%`); }
    if (device) { conditions.push('e.device LIKE ?'); params.push(`%${device}%`); }
    if (browser) { conditions.push('e.browser LIKE ?'); params.push(`%${browser}%`); }
    if (isVPN === 'true') { conditions.push('e.is_vpn = 1'); }
    if (isTor === 'true') { conditions.push('e.is_tor = 1'); }
    if (ipReputation) { conditions.push('e.ip_reputation = ?'); params.push(ipReputation); }
    if (dateFrom) { conditions.push('e.timestamp >= ?'); params.push(dateFrom); }
    if (dateTo) { conditions.push('e.timestamp <= ?'); params.push(dateTo); }
    if (search) {
      conditions.push('(u.name LIKE ? OR e.ip LIKE ? OR e.country LIKE ? OR e.city LIKE ? OR e.device LIKE ?)');
      const s = `%${search}%`;
      params.push(s, s, s, s, s);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    let sortCol = 'e.timestamp';
    if (sort === 'riskScore' || sort === 'risk_score') sortCol = 'e.risk_score';
    else if (sort === 'userName' || sort === 'user_name') sortCol = 'u.name';
    else if (sort === 'country') sortCol = 'e.country';

    const orderClause = `ORDER BY ${sortCol} ${order === 'asc' ? 'ASC' : 'DESC'}`;

    const countSql = `SELECT COUNT(*) as total FROM login_events e JOIN users u ON e.user_id = u.id ${where}`;
    const total = (sqlite.prepare(countSql).get(...params) as any).total;

    const sql = `
      SELECT e.*, u.name as user_name, u.email as user_email, u.avatar_color, u.department
      FROM login_events e
      JOIN users u ON e.user_id = u.id
      ${where}
      ${orderClause}
      LIMIT ? OFFSET ?
    `;

    const events = sqlite.prepare(sql).all(...params, parseInt(limit), offset).map(parseRow);

    res.json({ events, total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/events/:id
router.get('/:id', (req, res) => {
  try {
    const event = sqlite.prepare(`
      SELECT e.*, u.name as user_name, u.email as user_email, u.avatar_color, u.department,
        u.known_countries, u.known_cities, u.known_devices, u.known_browsers, u.known_ips,
        u.typical_login_start, u.typical_login_end, u.current_risk, u.risk_level as user_risk_level
      FROM login_events e JOIN users u ON e.user_id = u.id
      WHERE e.id = ?
    `).get(req.params.id);

    if (!event) return res.status(404).json({ error: 'Event not found' });

    const ev = parseRow(event as any);

    // Compute 4 core parameters
    const baseline = {
      knownCountries: ev.known_countries ?? [],
      knownCities: ev.known_cities ?? [],
      knownDevices: ev.known_devices ?? [],
      knownBrowsers: ev.known_browsers ?? [],
      knownIps: ev.known_ips ?? [],
      typicalLoginStart: ev.typical_login_start ?? 8,
      typicalLoginEnd: ev.typical_login_end ?? 18,
      typicalDays: [1, 2, 3, 4, 5],
      homeCity: ev.known_cities?.[0] ?? ev.city,
      homeCountry: ev.known_countries?.[0] ?? ev.country,
    };

    const prevRow = sqlite.prepare(`
      SELECT * FROM login_events WHERE user_id = ? AND timestamp < ? ORDER BY timestamp DESC LIMIT 1
    `).get(ev.user_id, ev.timestamp) as any;

    const coreParameters = evaluateCoreParameters(ev, baseline, prevRow ? parseRow(prevRow) : null);
    const enrichedEvent = { ...ev, coreParameters };

    // Find related events (same correlation ID or nearby events from same user)
    let relatedEvents: any[] = [];
    if (ev.correlation_id) {
      relatedEvents = sqlite.prepare(`
        SELECT e.*, u.name as user_name FROM login_events e JOIN users u ON e.user_id = u.id
        WHERE e.correlation_id = ? AND e.id != ? LIMIT 10
      `).all(ev.correlation_id, req.params.id);
    }

    // Find associated alert
    const alert = sqlite.prepare(`
      SELECT * FROM alerts WHERE related_event_ids LIKE ? LIMIT 1
    `).get(`%${req.params.id}%`);

    res.json({ event: enrichedEvent, relatedEvents: relatedEvents.map(parseRow), alert: alert ? parseRow(alert as any) : null });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/events/session-activity — Continuous in-session monitoring
router.post('/session-activity', (req, res) => {
  try {
    const { userId, sessionId, activityType, resourceName, requestCount, durationSeconds, ip, userAgent } = req.body;

    if (!userId || !sessionId || !activityType) {
      return res.status(400).json({ error: 'userId, sessionId, and activityType are required.' });
    }

    const { evaluateSessionActivity } = require('../security/sessionMonitoring');
    const result = evaluateSessionActivity({
      userId,
      sessionId,
      activityType,
      resourceName,
      requestCount: requestCount ? Number(requestCount) : 1,
      durationSeconds: durationSeconds ? Number(durationSeconds) : 0,
      ip,
      userAgent,
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true, evaluation: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/events/session-activity — List recent active session events
router.get('/session-activity/recent', (req, res) => {
  try {
    const { limit = '20', userId } = req.query as Record<string, string>;
    const params: any[] = [];
    let sql = 'SELECT se.*, u.name as user_name, u.department FROM session_events se JOIN users u ON se.user_id = u.id ';
    if (userId) {
      sql += 'WHERE se.user_id = ? ';
      params.push(userId);
    }
    sql += 'ORDER BY se.timestamp DESC LIMIT ?';
    params.push(parseInt(limit, 10));

    const events = sqlite.prepare(sql).all(...params).map(e => ({
      ...e,
      signals: typeof (e as any).signals === 'string' ? JSON.parse((e as any).signals) : (e as any).signals
    }));

    res.json({ sessionEvents: events });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

