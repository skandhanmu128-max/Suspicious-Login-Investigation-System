import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(__dirname, '..', 'sentineltrace.db');

// Ensure the db directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const sqlite = new Database(DB_PATH);

// Enable WAL mode for better performance
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });

// Auto-create tables (inline migration)
export function initializeDatabase() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      department TEXT NOT NULL,
      role TEXT NOT NULL,
      avatar_color TEXT NOT NULL DEFAULT '#3B82F6',
      known_countries TEXT NOT NULL DEFAULT '[]',
      known_cities TEXT NOT NULL DEFAULT '[]',
      known_devices TEXT NOT NULL DEFAULT '[]',
      known_browsers TEXT NOT NULL DEFAULT '[]',
      known_ips TEXT NOT NULL DEFAULT '[]',
      typical_login_start INTEGER NOT NULL DEFAULT 8,
      typical_login_end INTEGER NOT NULL DEFAULT 18,
      typical_days TEXT NOT NULL DEFAULT '[1,2,3,4,5]',
      current_risk REAL NOT NULL DEFAULT 0,
      risk_level TEXT NOT NULL DEFAULT 'safe',
      risk_trend TEXT NOT NULL DEFAULT '[]',
      total_logins INTEGER NOT NULL DEFAULT 0,
      failed_logins INTEGER NOT NULL DEFAULT 0,
      last_login TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS login_events (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      timestamp TEXT NOT NULL,
      ip TEXT NOT NULL,
      is_vpn INTEGER NOT NULL DEFAULT 0,
      vpn_detected TEXT NOT NULL DEFAULT 'not_detected',
      is_tor INTEGER NOT NULL DEFAULT 0,
      is_proxy INTEGER NOT NULL DEFAULT 0,
      ip_reputation TEXT NOT NULL DEFAULT 'clean',
      asn TEXT,
      isp TEXT,
      country TEXT NOT NULL,
      city TEXT NOT NULL,
      lat REAL,
      lng REAL,
      is_new_country INTEGER NOT NULL DEFAULT 0,
      is_new_city INTEGER NOT NULL DEFAULT 0,
      device TEXT NOT NULL,
      browser TEXT NOT NULL,
      os TEXT NOT NULL,
      is_mobile INTEGER NOT NULL DEFAULT 0,
      device_fingerprint TEXT,
      is_new_device INTEGER NOT NULL DEFAULT 0,
      is_new_browser INTEGER NOT NULL DEFAULT 0,
      result TEXT NOT NULL,
      failure_reason TEXT,
      risk_score REAL NOT NULL DEFAULT 0,
      risk_level TEXT NOT NULL DEFAULT 'safe',
      confidence REAL NOT NULL DEFAULT 0,
      signals TEXT NOT NULL DEFAULT '[]',
      explanation TEXT,
      session_id TEXT,
      user_agent TEXT,
      referer TEXT,
      attack_scenario TEXT,
      correlation_id TEXT
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY,
      alert_type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      severity TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      user_id TEXT NOT NULL REFERENCES users(id),
      related_event_ids TEXT NOT NULL DEFAULT '[]',
      risk_score REAL NOT NULL,
      confidence REAL NOT NULL,
      signals TEXT NOT NULL DEFAULT '[]',
      explanation TEXT,
      first_seen TEXT NOT NULL,
      last_seen TEXT NOT NULL,
      acknowledged_at TEXT,
      acknowledged_by TEXT,
      resolved_at TEXT,
      resolved_by TEXT,
      case_id TEXT
    );

    CREATE TABLE IF NOT EXISTS cases (
      id TEXT PRIMARY KEY,
      case_number TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      severity TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new',
      assigned_analyst TEXT,
      user_id TEXT NOT NULL REFERENCES users(id),
      related_alert_ids TEXT NOT NULL DEFAULT '[]',
      related_event_ids TEXT NOT NULL DEFAULT '[]',
      evidence TEXT NOT NULL DEFAULT '[]',
      resolution TEXT,
      false_positive_reason TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      resolved_at TEXT,
      risk_score REAL NOT NULL DEFAULT 0,
      confidence REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS investigation_notes (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL REFERENCES cases(id),
      analyst TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      note_type TEXT NOT NULL DEFAULT 'note'
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      analyst TEXT NOT NULL,
      details TEXT NOT NULL DEFAULT '{}',
      timestamp TEXT NOT NULL,
      ip_address TEXT
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'info',
      is_read INTEGER NOT NULL DEFAULT 0,
      entity_type TEXT,
      entity_id TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      id TEXT PRIMARY KEY DEFAULT 'global',
      safe_max INTEGER NOT NULL DEFAULT 29,
      suspicious_max INTEGER NOT NULL DEFAULT 49,
      high_max INTEGER NOT NULL DEFAULT 74,
      weights TEXT NOT NULL DEFAULT '{}',
      live_mode INTEGER NOT NULL DEFAULT 0,
      live_interval INTEGER NOT NULL DEFAULT 15,
      attack_probability REAL NOT NULL DEFAULT 0.3,
      theme TEXT NOT NULL DEFAULT 'dark',
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS soc_users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'ANALYST',
      avatar_color TEXT NOT NULL DEFAULT '#3B82F6',
      created_at TEXT NOT NULL,
      last_login TEXT,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS soc_sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES soc_users(id),
      role TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT
    );

    CREATE TABLE IF NOT EXISTS session_events (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      session_id TEXT NOT NULL,
      activity_type TEXT NOT NULL,
      resource_name TEXT,
      request_count INTEGER NOT NULL DEFAULT 1,
      duration_seconds INTEGER NOT NULL DEFAULT 0,
      risk_score REAL NOT NULL DEFAULT 0,
      signals TEXT NOT NULL DEFAULT '[]',
      timestamp TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS analyst_feedback (
      id TEXT PRIMARY KEY,
      analyst_id TEXT NOT NULL,
      analyst_name TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      classification TEXT NOT NULL,
      notes TEXT,
      features_snapshot TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS remote_notifications (
      id TEXT PRIMARY KEY,
      incident_id TEXT,
      recipient TEXT NOT NULL,
      channel TEXT NOT NULL DEFAULT 'email',
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'sent',
      created_at TEXT NOT NULL,
      sent_at TEXT
    );
  `);

  // Inline migration for vpn_detected column if it doesn't exist
  try {
    sqlite.exec("ALTER TABLE login_events ADD COLUMN vpn_detected TEXT DEFAULT 'not_detected'");
  } catch {
    // Column already exists
  }

  // Initialize default settings if not present
  const existing = sqlite.prepare("SELECT id FROM settings WHERE id = 'global'").get();
  if (!existing) {
    sqlite.prepare(`
      INSERT INTO settings (id, updated_at) VALUES ('global', ?)
    `).run(new Date().toISOString());
  }

  console.log('✅ Database initialized');
}

export { sqlite };
