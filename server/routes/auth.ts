import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { sqlite } from '../db/database';
import {
  hashPassword,
  verifyPassword,
  createSession,
  revokeSession,
  authenticateToken,
  requireRole,
} from '../security/auth';

const router = Router();

// POST /api/auth/login
router.post('/login', (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = sqlite.prepare(`
      SELECT * FROM soc_users WHERE LOWER(email) = LOWER(?)
    `).get(email.trim()) as any;

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: 'Account is deactivated. Contact an administrator.' });
    }

    const isValid = verifyPassword(password, user.password_hash, user.salt);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const token = createSession(user.id, user.role, ipAddress, userAgent);

    // Update last login
    sqlite.prepare('UPDATE soc_users SET last_login = ? WHERE id = ?').run(new Date().toISOString(), user.id);

    // Log audit
    sqlite.prepare(`
      INSERT INTO audit_logs (id, action, entity_type, entity_id, analyst, details, timestamp, ip_address)
      VALUES (?, 'SOC_USER_LOGIN', 'user', ?, ?, ?, ?, ?)
    `).run(
      uuidv4(),
      user.id,
      user.name,
      JSON.stringify({ role: user.role, email: user.email }),
      new Date().toISOString(),
      ipAddress
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar_color: user.avatar_color,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

    if (token) {
      revokeSession(token);
    }

    res.json({ success: true, message: 'Logged out successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me (Current profile)
router.get('/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// GET /api/auth/users (ADMIN only: list all SOC users)
router.get('/users', authenticateToken, requireRole(['ADMIN']), (_req, res) => {
  try {
    const users = sqlite.prepare(`
      SELECT id, name, email, role, avatar_color, created_at, last_login, is_active
      FROM soc_users ORDER BY created_at ASC
    `).all();
    res.json({ users });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/users (ADMIN only: create new SOC user)
router.post('/users', authenticateToken, requireRole(['ADMIN']), (req, res) => {
  try {
    const { name, email, password, role = 'ANALYST', avatarColor = '#3B82F6' } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    const existing = sqlite.prepare('SELECT id FROM soc_users WHERE LOWER(email) = LOWER(?)').get(email.trim());
    if (existing) {
      return res.status(409).json({ error: 'A SOC user with this email already exists.' });
    }

    const { hash, salt } = hashPassword(password);
    const id = `soc-usr-${uuidv4().slice(0, 8)}`;
    const now = new Date().toISOString();

    sqlite.prepare(`
      INSERT INTO soc_users (id, name, email, password_hash, salt, role, avatar_color, created_at, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).run(id, name.trim(), email.trim(), hash, salt, role.toUpperCase(), avatarColor, now);

    res.status(201).json({
      success: true,
      user: { id, name, email, role: role.toUpperCase(), avatar_color: avatarColor, created_at: now },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/auth/users/:id/role (ADMIN only)
router.patch('/users/:id/role', authenticateToken, requireRole(['ADMIN']), (req, res) => {
  try {
    const { role } = req.body;
    if (!['ADMIN', 'ANALYST'].includes(role)) {
      return res.status(400).json({ error: "Role must be 'ADMIN' or 'ANALYST'." });
    }

    sqlite.prepare('UPDATE soc_users SET role = ? WHERE id = ?').run(role, req.params.id);
    res.json({ success: true, message: `Role updated to ${role}.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
