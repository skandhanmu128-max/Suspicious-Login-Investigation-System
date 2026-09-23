import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

// ─── Users ────────────────────────────────────────────────────────────────────
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  department: text('department').notNull(),
  role: text('role').notNull(),
  avatarColor: text('avatar_color').notNull().default('#3B82F6'),
  // Behavioral baseline (JSON arrays)
  knownCountries: text('known_countries').notNull().default('[]'),
  knownCities: text('known_cities').notNull().default('[]'),
  knownDevices: text('known_devices').notNull().default('[]'),
  knownBrowsers: text('known_browsers').notNull().default('[]'),
  knownIps: text('known_ips').notNull().default('[]'),
  typicalLoginStart: integer('typical_login_start').notNull().default(8),  // hour 0–23
  typicalLoginEnd: integer('typical_login_end').notNull().default(18),
  typicalDays: text('typical_days').notNull().default('[1,2,3,4,5]'), // weekdays
  // Risk
  currentRisk: real('current_risk').notNull().default(0),
  riskLevel: text('risk_level').notNull().default('safe'),
  riskTrend: text('risk_trend').notNull().default('[]'), // 7-day array
  // Stats
  totalLogins: integer('total_logins').notNull().default(0),
  failedLogins: integer('failed_logins').notNull().default(0),
  lastLogin: text('last_login'),
  createdAt: text('created_at').notNull(),
});

// ─── Login Events ─────────────────────────────────────────────────────────────
export const loginEvents = sqliteTable('login_events', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  timestamp: text('timestamp').notNull(),
  // Network
  ip: text('ip').notNull(),
  isVPN: integer('is_vpn', { mode: 'boolean' }).notNull().default(false),
  vpnDetected: text('vpn_detected').notNull().default('not_detected'), // detected | not_detected | unknown
  isTor: integer('is_tor', { mode: 'boolean' }).notNull().default(false),
  isProxy: integer('is_proxy', { mode: 'boolean' }).notNull().default(false),
  ipReputation: text('ip_reputation').notNull().default('clean'), // clean | suspicious | malicious
  asn: text('asn'),
  isp: text('isp'),
  // Geo
  country: text('country').notNull(),
  city: text('city').notNull(),
  lat: real('lat'),
  lng: real('lng'),
  isNewCountry: integer('is_new_country', { mode: 'boolean' }).notNull().default(false),
  isNewCity: integer('is_new_city', { mode: 'boolean' }).notNull().default(false),
  // Device
  device: text('device').notNull(),
  browser: text('browser').notNull(),
  os: text('os').notNull(),
  isMobile: integer('is_mobile', { mode: 'boolean' }).notNull().default(false),
  deviceFingerprint: text('device_fingerprint'),
  isNewDevice: integer('is_new_device', { mode: 'boolean' }).notNull().default(false),
  isNewBrowser: integer('is_new_browser', { mode: 'boolean' }).notNull().default(false),
  // Result
  result: text('result').notNull(), // success | failure
  failureReason: text('failure_reason'),
  // Risk
  riskScore: real('risk_score').notNull().default(0),
  riskLevel: text('risk_level').notNull().default('safe'),
  confidence: real('confidence').notNull().default(0),
  signals: text('signals').notNull().default('[]'), // JSON RiskSignal[]
  explanation: text('explanation'),
  // Context
  sessionId: text('session_id'),
  userAgent: text('user_agent'),
  referer: text('referer'),
  // Attack context
  attackScenario: text('attack_scenario'), // which scenario this belongs to
  correlationId: text('correlation_id'),   // groups related events
});

// ─── Alerts ───────────────────────────────────────────────────────────────────
export const alerts = sqliteTable('alerts', {
  id: text('id').primaryKey(),
  alertType: text('alert_type').notNull(), // impossible_travel | brute_force | etc
  title: text('title').notNull(),
  description: text('description').notNull(),
  severity: text('severity').notNull(), // critical | high | suspicious | safe
  status: text('status').notNull().default('open'), // open | acknowledged | investigating | closed | false_positive
  // Relationships
  userId: text('user_id').notNull().references(() => users.id),
  relatedEventIds: text('related_event_ids').notNull().default('[]'), // JSON
  // Scoring
  riskScore: real('risk_score').notNull(),
  confidence: real('confidence').notNull(),
  signals: text('signals').notNull().default('[]'), // JSON
  explanation: text('explanation'),
  // Timestamps
  firstSeen: text('first_seen').notNull(),
  lastSeen: text('last_seen').notNull(),
  acknowledgedAt: text('acknowledged_at'),
  acknowledgedBy: text('acknowledged_by'),
  resolvedAt: text('resolved_at'),
  resolvedBy: text('resolved_by'),
  // Case link
  caseId: text('case_id'),
});

// ─── Cases ────────────────────────────────────────────────────────────────────
export const cases = sqliteTable('cases', {
  id: text('id').primaryKey(),
  caseNumber: text('case_number').notNull().unique(), // CASE-0001
  title: text('title').notNull(),
  description: text('description').notNull(),
  severity: text('severity').notNull(), // critical | high | medium | low
  status: text('status').notNull().default('new'), // new | triaging | investigating | contained | resolved | false_positive
  // Assignment
  assignedAnalyst: text('assigned_analyst'),
  // Relationships
  userId: text('user_id').notNull().references(() => users.id),
  relatedAlertIds: text('related_alert_ids').notNull().default('[]'),
  relatedEventIds: text('related_event_ids').notNull().default('[]'),
  // Evidence
  evidence: text('evidence').notNull().default('[]'), // JSON EvidenceItem[]
  // Resolution
  resolution: text('resolution'),
  falsePositiveReason: text('false_positive_reason'),
  // Timestamps
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  resolvedAt: text('resolved_at'),
  // Risk summary
  riskScore: real('risk_score').notNull().default(0),
  confidence: real('confidence').notNull().default(0),
});

// ─── Investigation Notes ──────────────────────────────────────────────────────
export const investigationNotes = sqliteTable('investigation_notes', {
  id: text('id').primaryKey(),
  caseId: text('case_id').notNull().references(() => cases.id),
  analyst: text('analyst').notNull(),
  content: text('content').notNull(),
  timestamp: text('timestamp').notNull(),
  noteType: text('note_type').notNull().default('note'), // note | action | escalation
});

// ─── Audit Logs ───────────────────────────────────────────────────────────────
export const auditLogs = sqliteTable('audit_logs', {
  id: text('id').primaryKey(),
  action: text('action').notNull(), // e.g. ALERT_VIEWED, CASE_OPENED, STATUS_CHANGED
  entityType: text('entity_type').notNull(), // alert | case | event | user
  entityId: text('entity_id').notNull(),
  analyst: text('analyst').notNull(),
  details: text('details').notNull().default('{}'), // JSON
  timestamp: text('timestamp').notNull(),
  ipAddress: text('ip_address'),
});

// ─── Notifications ────────────────────────────────────────────────────────────
export const notifications = sqliteTable('notifications', {
  id: text('id').primaryKey(),
  type: text('type').notNull(), // critical_alert | new_case | impossible_travel | etc
  title: text('title').notNull(),
  message: text('message').notNull(),
  severity: text('severity').notNull().default('info'),
  isRead: integer('is_read', { mode: 'boolean' }).notNull().default(false),
  entityType: text('entity_type'), // alert | case | event
  entityId: text('entity_id'),
  createdAt: text('created_at').notNull(),
});

// ─── Settings ─────────────────────────────────────────────────────────────────
export const settings = sqliteTable('settings', {
  id: text('id').primaryKey().default('global'),
  // Risk thresholds
  safeMax: integer('safe_max').notNull().default(29),
  suspiciousMax: integer('suspicious_max').notNull().default(49),
  highMax: integer('high_max').notNull().default(74),
  // Signal weights
  weights: text('weights').notNull().default('{}'), // JSON
  // Live mode
  liveMode: integer('live_mode', { mode: 'boolean' }).notNull().default(false),
  liveInterval: integer('live_interval').notNull().default(15), // seconds
  attackProbability: real('attack_probability').notNull().default(0.3),
  // Appearance
  theme: text('theme').notNull().default('dark'),
  updatedAt: text('updated_at').notNull(),
});

// ─── SOC Personnel / Users (RBAC) ─────────────────────────────────────────────
export const socUsers = sqliteTable('soc_users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  salt: text('salt').notNull(),
  role: text('role').notNull().default('ANALYST'), // 'ADMIN' | 'ANALYST'
  avatarColor: text('avatar_color').notNull().default('#3B82F6'),
  createdAt: text('created_at').notNull(),
  lastLogin: text('last_login'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
});

// ─── SOC Active Sessions (Token Management) ───────────────────────────────────
export const socSessions = sqliteTable('soc_sessions', {
  token: text('token').primaryKey(),
  userId: text('user_id').notNull().references(() => socUsers.id),
  role: text('role').notNull(),
  createdAt: text('created_at').notNull(),
  expiresAt: text('expires_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
});

// ─── Continuous In-Session Activity Events ────────────────────────────────────
export const sessionEvents = sqliteTable('session_events', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  sessionId: text('session_id').notNull(),
  activityType: text('activity_type').notNull(), // request_spike | sensitive_resource_access | session_duration_anomaly
  resourceName: text('resource_name'),
  requestCount: integer('request_count').notNull().default(1),
  durationSeconds: integer('duration_seconds').notNull().default(0),
  riskScore: real('risk_score').notNull().default(0),
  signals: text('signals').notNull().default('[]'), // JSON
  timestamp: text('timestamp').notNull(),
});

// ─── Analyst Feedback (ML Model Tuning Log) ───────────────────────────────────
export const analystFeedback = sqliteTable('analyst_feedback', {
  id: text('id').primaryKey(),
  analystId: text('analyst_id').notNull(),
  analystName: text('analyst_name').notNull(),
  targetType: text('target_type').notNull(), // alert | case
  targetId: text('target_id').notNull(),
  classification: text('classification').notNull(), // true_positive | false_positive | under_investigation | resolved
  notes: text('notes'),
  featuresSnapshot: text('features_snapshot').notNull().default('{}'), // JSON
  createdAt: text('created_at').notNull(),
});

// ─── Remote Notifications Outbox (Email / Push / Webhook) ──────────────────────
export const remoteNotifications = sqliteTable('remote_notifications', {
  id: text('id').primaryKey(),
  incidentId: text('incident_id'),
  recipient: text('recipient').notNull(),
  channel: text('channel').notNull().default('email'), // email | push | webhook
  subject: text('subject').notNull(),
  body: text('body').notNull(),
  status: text('status').notNull().default('sent'), // pending | sent | failed
  createdAt: text('created_at').notNull(),
  sentAt: text('sent_at'),
});

