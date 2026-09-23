import { Router } from 'express';
import { sqlite } from '../db/database';
import { authenticateToken, requireRole } from '../security/auth';

const router = Router();

router.get('/', (_req, res) => {
  try {
    const s = sqlite.prepare('SELECT * FROM settings WHERE id = ?').get('global') as any;
    res.json({ settings: { ...s, weights: s?.weights ? JSON.parse(s.weights) : {} } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/', authenticateToken, requireRole(['ADMIN']), (req, res) => {
  try {
    const { safeMax, suspiciousMax, highMax, weights, liveMode, liveInterval, attackProbability, theme } = req.body;
    const now = new Date().toISOString();
    const updates: string[] = ['updated_at = ?'];
    const params: any[] = [now];

    if (safeMax !== undefined) { updates.push('safe_max = ?'); params.push(safeMax); }
    if (suspiciousMax !== undefined) { updates.push('suspicious_max = ?'); params.push(suspiciousMax); }
    if (highMax !== undefined) { updates.push('high_max = ?'); params.push(highMax); }
    if (weights !== undefined) { updates.push('weights = ?'); params.push(JSON.stringify(weights)); }
    if (liveMode !== undefined) { updates.push('live_mode = ?'); params.push(liveMode ? 1 : 0); }
    if (liveInterval !== undefined) { updates.push('live_interval = ?'); params.push(liveInterval); }
    if (attackProbability !== undefined) { updates.push('attack_probability = ?'); params.push(attackProbability); }
    if (theme !== undefined) { updates.push('theme = ?'); params.push(theme); }

    params.push('global');
    sqlite.prepare(`UPDATE settings SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
