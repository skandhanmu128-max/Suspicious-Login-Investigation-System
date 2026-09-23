import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { sqlite } from '../db/database';

export type UserRole = 'ADMIN' | 'ANALYST';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar_color: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/**
 * Hash a password using scrypt with a cryptographic salt.
 */
export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

/**
 * Verify a plaintext password against the stored scrypt hash and salt.
 */
export function verifyPassword(password: string, storedHash: string, salt: string): boolean {
  try {
    const computedHash = crypto.scryptSync(password, salt, 64).toString('hex');
    const a = Buffer.from(computedHash, 'hex');
    const b = Buffer.from(storedHash, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Create a session token with 24-hour expiration stored in SQLite.
 */
export function createSession(userId: string, role: string, ipAddress?: string, userAgent?: string): string {
  const token = `st_${crypto.randomBytes(32).toString('hex')}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

  sqlite.prepare(`
    INSERT INTO soc_sessions (token, user_id, role, created_at, expires_at, ip_address, user_agent)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(token, userId, role, now.toISOString(), expiresAt, ipAddress || null, userAgent || null);

  return token;
}

/**
 * Revoke/delete a session token.
 */
export function revokeSession(token: string): void {
  try {
    sqlite.prepare('DELETE FROM soc_sessions WHERE token = ?').run(token);
  } catch { /* ignore */ }
}

/**
 * Middleware: Verify Bearer session token.
 * Unauthorized visitors receive 401.
 */
export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid authentication token.' });
  }

  const nowIso = new Date().toISOString();
  const session = sqlite.prepare(`
    SELECT s.token, s.expires_at, u.id, u.name, u.email, u.role, u.avatar_color, u.is_active
    FROM soc_sessions s
    JOIN soc_users u ON s.user_id = u.id
    WHERE s.token = ?
  `).get(token) as any;

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized: Session not found or expired.' });
  }

  if (session.expires_at < nowIso) {
    revokeSession(token);
    return res.status(401).json({ error: 'Unauthorized: Session has expired. Please log in again.' });
  }

  if (!session.is_active) {
    return res.status(403).json({ error: 'Forbidden: Account has been deactivated.' });
  }

  req.user = {
    id: session.id,
    name: session.name,
    email: session.email,
    role: session.role as UserRole,
    avatar_color: session.avatar_color,
  };

  next();
}

/**
 * Middleware: Role-Based Access Control.
 * E.g., requireRole(['ADMIN'])
 */
export function requireRole(allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized: Authentication required.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Forbidden: This action requires one of the following roles: [${allowedRoles.join(', ')}]. Current role: '${req.user.role}'.`,
        requiredRoles: allowedRoles,
        userRole: req.user.role
      });
    }

    next();
  };
}
