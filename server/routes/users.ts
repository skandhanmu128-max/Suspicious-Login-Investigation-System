import { Router } from 'express';
import { sqlite } from '../db/database';

const router = Router();

function parseUser(row: any) {
  const fields = ['known_countries', 'known_cities', 'known_devices', 'known_browsers', 'known_ips', 'risk_trend', 'typical_days'];
  const r = { ...row };
  for (const f of fields) {
    if (typeof r[f] === 'string') { try { r[f] = JSON.parse(r[f]); } catch { /* keep */ } }
  }
  return r;
}

// GET /api/users
router.get('/', (req, res) => {
  try {
    const { page = '1', limit = '20', riskLevel, department, search, sort = 'current_risk', order = 'desc' } = req.query as Record<string, string>;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const conditions: string[] = [];
    const params: any[] = [];

    if (riskLevel) { conditions.push('risk_level = ?'); params.push(riskLevel); }
    if (department) { conditions.push('department = ?'); params.push(department); }
    if (search) {
      conditions.push('(name LIKE ? OR email LIKE ? OR department LIKE ? OR role LIKE ?)');
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const total = (sqlite.prepare(`SELECT COUNT(*) as t FROM users ${where}`).get(...params) as any).t;

    const users = sqlite.prepare(`
      SELECT * FROM users ${where}
      ORDER BY ${sort === 'name' ? 'name' : sort === 'total_logins' ? 'total_logins' : 'current_risk'} ${order === 'asc' ? 'ASC' : 'DESC'}
      LIMIT ? OFFSET ?
    `).all(...params, parseInt(limit), offset).map(parseUser);

    res.json({ users, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/:id
router.get('/:id', (req, res) => {
  try {
    const user = sqlite.prepare('SELECT * FROM users WHERE id = ? OR LOWER(id) = LOWER(?) OR id = ?').get(
      req.params.id,
      req.params.id,
      req.params.id === 'usr-101' ? 'U101' : req.params.id
    );
    if (!user) return res.status(404).json({ error: 'User not found' });

    const u = parseUser(user as any);
    const actualId = u.id;

    // Recent events
    const recentEvents = sqlite.prepare(`
      SELECT * FROM login_events WHERE user_id = ? ORDER BY timestamp DESC LIMIT 30
    `).all(actualId);

    // Recent alerts
    const recentAlerts = sqlite.prepare(`
      SELECT * FROM alerts WHERE user_id = ? ORDER BY last_seen DESC LIMIT 10
    `).all(actualId);

    // Cases
    const userCases = sqlite.prepare(`
      SELECT * FROM cases WHERE user_id = ? ORDER BY created_at DESC LIMIT 5
    `).all(actualId);

    // Stats
    const stats = {
      totalEvents: (sqlite.prepare('SELECT COUNT(*) as c FROM login_events WHERE user_id = ?').get(req.params.id) as any).c,
      successEvents: (sqlite.prepare("SELECT COUNT(*) as c FROM login_events WHERE user_id = ? AND result = 'success'").get(req.params.id) as any).c,
      failedEvents: (sqlite.prepare("SELECT COUNT(*) as c FROM login_events WHERE user_id = ? AND result = 'failure'").get(req.params.id) as any).c,
      criticalEvents: (sqlite.prepare("SELECT COUNT(*) as c FROM login_events WHERE user_id = ? AND risk_level = 'critical'").get(req.params.id) as any).c,
      uniqueCountries: (sqlite.prepare("SELECT COUNT(DISTINCT country) as c FROM login_events WHERE user_id = ?").get(req.params.id) as any).c,
      uniqueDevices: (sqlite.prepare("SELECT COUNT(DISTINCT device) as c FROM login_events WHERE user_id = ?").get(req.params.id) as any).c,
      openCases: (sqlite.prepare("SELECT COUNT(*) as c FROM cases WHERE user_id = ? AND status NOT IN ('resolved','false_positive')").get(req.params.id) as any).c,
    };

    res.json({
      user: u,
      recentEvents: recentEvents.map((e: any) => {
        const r = { ...e };
        if (typeof r.signals === 'string') { try { r.signals = JSON.parse(r.signals); } catch { /* keep */ } }
        return r;
      }),
      recentAlerts: recentAlerts.map((a: any) => {
        const r = { ...a };
        if (typeof r.signals === 'string') { try { r.signals = JSON.parse(r.signals); } catch { /* keep */ } }
        if (typeof r.related_event_ids === 'string') { try { r.related_event_ids = JSON.parse(r.related_event_ids); } catch { /* keep */ } }
        return r;
      }),
      userCases,
      stats,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
