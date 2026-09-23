import { Router } from 'express';
import { sqlite } from '../db/database';

const router = Router();

router.get('/', (req, res) => {
  try {
    const { page = '1', limit = '50', entityType, action } = req.query as Record<string, string>;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const conditions: string[] = [];
    const params: any[] = [];

    if (entityType) { conditions.push('entity_type = ?'); params.push(entityType); }
    if (action) { conditions.push('action = ?'); params.push(action); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const total = (sqlite.prepare(`SELECT COUNT(*) as t FROM audit_logs ${where}`).get(...params) as any).t;
    const logs = sqlite.prepare(`SELECT * FROM audit_logs ${where} ORDER BY timestamp DESC LIMIT ? OFFSET ?`).all(...params, parseInt(limit), offset);

    res.json({ logs: logs.map((l: any) => ({ ...l, details: (() => { try { return JSON.parse(l.details); } catch { return {}; } })() })), total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
