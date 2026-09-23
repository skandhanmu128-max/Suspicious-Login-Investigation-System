import { Router } from 'express';
import { sqlite } from '../db/database';

const router = Router();

// GET /api/notifications
router.get('/', (_req, res) => {
  try {
    const notifications = sqlite.prepare('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50').all();
    const unreadCount = (sqlite.prepare('SELECT COUNT(*) as c FROM notifications WHERE is_read = 0').get() as any).c;
    res.json({ notifications, unreadCount });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', (req, res) => {
  try {
    sqlite.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/notifications/read-all
router.patch('/read-all', (_req, res) => {
  try {
    sqlite.prepare('UPDATE notifications SET is_read = 1').run();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/notifications/remote — List remote outbox notifications (email/push)
router.get('/remote', (_req, res) => {
  try {
    const { getRecentRemoteNotifications } = require('../security/notificationService');
    const outbox = getRecentRemoteNotifications(30);
    res.json({ outbox });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notifications/test-remote — Test remote dispatch
router.post('/test-remote', (req, res) => {
  try {
    const { dispatchRemoteNotification } = require('../security/notificationService');
    const { incidentTitle = 'Test Security Alert', severity = 'high', userId = 'usr-001', reason = 'Test remote notification trigger' } = req.body;
    const result = dispatchRemoteNotification({
      incidentId: 'case-test-01',
      caseNumber: 'CASE-TEST',
      incidentTitle,
      riskScore: severity === 'critical' ? 95 : 75,
      userId,
      reason,
      severity,
    });
    res.json({ success: true, dispatch: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
