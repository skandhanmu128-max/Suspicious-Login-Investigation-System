import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';
import api from '../services/api';
import {
  riskColor, riskLabel, formatDate, formatDateFull, timeAgo,
  getInitials, alertTypeLabel
} from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import type { User, LoginEvent, Alert, Case } from '../types';

export default function UserDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { role } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [events, setEvents] = useState<LoginEvent[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    loadUserData(id);
  }, [id]);

  async function loadUserData(userId: string) {
    setLoading(true);
    try {
      const uRes = await api.users.get(userId);
      setUser(uRes.user ?? null);
      if (uRes.recentEvents) setEvents(uRes.recentEvents);
      if (uRes.recentAlerts) setAlerts(uRes.recentAlerts);
      if (uRes.userCases) setCases(uRes.userCases);

      // Fetch extended events/alerts in background
      Promise.allSettled([
        api.events.list({ userId, limit: '20' }),
        api.alerts.list({ userId, limit: '10' }),
        api.cases.list({ userId }),
      ]).then(results => {
        if (results[0].status === 'fulfilled' && results[0].value?.events) {
          setEvents(results[0].value.events);
        }
        if (results[1].status === 'fulfilled' && results[1].value?.alerts) {
          setAlerts(results[1].value.alerts);
        }
        if (results[2].status === 'fulfilled' && results[2].value?.cases) {
          setCases(results[2].value.cases);
        }
      });
    } catch (err) {
      console.error('Failed to load user data:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleAction(actionName: string, requiresAdmin = false) {
    if (requiresAdmin && role !== 'ADMIN') {
      setActionSuccess(`Access Denied: Action '${actionName}' requires ADMIN role privileges.`);
      setTimeout(() => setActionSuccess(null), 4000);
      return;
    }
    setActionSuccess(`Action initiated: ${actionName}`);
    setTimeout(() => setActionSuccess(null), 4000);
  }

  if (loading) {
    return (
      <div className="page-container" style={{ textAlign: 'center', padding: '60px' }}>
        <div style={{ color: 'var(--text-muted)' }}>Retrieving user baseline & telemetry...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page-container">
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <h3>User not found</h3>
          <p style={{ color: 'var(--text-muted)' }}>No identity with identifier "{id}" exists in the directory.</p>
          <Link to="/users" className="btn btn-primary" style={{ marginTop: '16px' }}>Back to Users</Link>
        </div>
      </div>
    );
  }

  const riskCol = riskColor(user.risk_level);

  // Generate trend data
  const trendData = (user.risk_trend || [10, 15, 20, 15, 30, user.current_risk]).map((val, idx) => ({
    day: `D-${(user.risk_trend?.length || 6) - idx}`,
    risk: val,
  }));

  return (
    <div className="page-container">
      {/* Breadcrumbs */}
      <div className="page-breadcrumbs" style={{ marginBottom: '12px' }}>
        <Link to="/" className="breadcrumb-item">SOC</Link>
        <span className="breadcrumb-separator">/</span>
        <Link to="/users" className="breadcrumb-item">Users</Link>
        <span className="breadcrumb-separator">/</span>
        <span className="breadcrumb-current">{user.name}</span>
      </div>

      {actionSuccess && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--safe-bg)',
            border: '1px solid var(--safe-border)',
            color: 'var(--safe)',
            fontWeight: 600,
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <span>✓ {actionSuccess}</span>
          <button className="btn-icon" onClick={() => setActionSuccess(null)}>✕</button>
        </motion.div>
      )}

      {/* Header card */}
      <div className="card" style={{ padding: '24px', marginBottom: '24px', borderTop: `4px solid ${riskCol}` }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
            <div
              className="avatar-lg"
              style={{ background: user.avatar_color || 'var(--blue)', width: '64px', height: '64px', fontSize: '1.4rem' }}
            >
              {getInitials(user.name)}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>{user.name}</h1>
                <span
                  className="risk-badge"
                  style={{
                    backgroundColor: `${riskCol}1a`,
                    color: riskCol,
                    border: `1px solid ${riskCol}40`,
                    fontWeight: 700
                  }}
                >
                  {user.current_risk} · {riskLabel(user.risk_level)}
                </span>
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.86rem', marginTop: '4px' }}>
                {user.email} • ID: <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{user.id}</span>
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: '2px' }}>
                {user.role} — <strong>{user.department}</strong>
              </div>
            </div>
          </div>

          {/* Quick SOC Actions */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              id="revoke-sessions-btn"
              className="btn btn-secondary"
              disabled={role !== 'ADMIN'}
              onClick={() => handleAction('All Active Sessions Terminated', true)}
              title={role !== 'ADMIN' ? 'Admin Role Required' : 'Terminate all active user sessions'}
              style={{ opacity: role !== 'ADMIN' ? 0.5 : 1, cursor: role !== 'ADMIN' ? 'not-allowed' : 'pointer' }}
            >
              ⊘ Terminate Sessions {role !== 'ADMIN' && '(Admin)'}
            </button>
            <button
              id="require-mfa-btn"
              className="btn btn-secondary"
              onClick={() => handleAction('Step-Up MFA Challenge Enforced')}
              title="Force step-up authentication challenge"
            >
              🔐 Require MFA
            </button>
            <button
              id="lock-account-btn"
              className="btn btn-danger"
              disabled={role !== 'ADMIN'}
              onClick={() => handleAction('Account Temporarily Locked (SOC Containment)', true)}
              title={role !== 'ADMIN' ? 'Admin Role Required' : 'Temporarily lock identity access'}
              style={{ opacity: role !== 'ADMIN' ? 0.5 : 1, cursor: role !== 'ADMIN' ? 'not-allowed' : 'pointer' }}
            >
              🔒 Lock Identity {role !== 'ADMIN' && '(Admin)'}
            </button>
          </div>
        </div>
      </div>

      {/* Grid: Baseline vs Anomalies + Risk Trend */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '20px', marginBottom: '24px' }}>
        {/* Baseline profile comparison */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">UEBA Baseline vs Current Posture</h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>30-Day Learned Profile</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="info-block">
                <div className="info-block-label">EXPECTED WORKING HOURS</div>
                <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {user.typical_login_start || 9}:00 – {user.typical_login_end || 18}:00
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Monday through Friday (Business Day)
                </div>
              </div>

              <div className="info-block">
                <div className="info-block-label">KNOWN LOCATIONS</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {(user.known_cities || ['Seattle', 'San Francisco']).join(', ')}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Countries: {(user.known_countries || ['United States']).join(', ')}
                </div>
              </div>

              <div className="info-block">
                <div className="info-block-label">REGISTERED DEVICES</div>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                  {(user.known_devices || ['MacBook Pro (M3)', 'iPhone 15']).join(', ')}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Browsers: {(user.known_browsers || ['Chrome', 'Safari']).join(', ')}
                </div>
              </div>

              <div className="info-block">
                <div className="info-block-label">HISTORICAL RELIABILITY</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {user.total_logins - user.failed_logins} / {user.total_logins} Success
                </div>
                <div style={{ fontSize: '0.75rem', color: user.failed_logins > 3 ? 'var(--critical)' : 'var(--safe)', marginTop: '4px' }}>
                  Failed Attempts: {user.failed_logins}
                </div>
              </div>
            </div>

            {/* Active alerts note */}
            {alerts.length > 0 && (
              <div style={{ padding: '12px 14px', background: 'var(--critical-bg)', border: '1px solid var(--critical-border)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--critical)' }}>
                  ⚠️ {alerts.length} UNRESOLVED ALERTS FLAGGED FOR THIS IDENTITY
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Latest: {alerts[0].title} ({alertTypeLabel(alerts[0].alert_type)})
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Risk Trend Chart */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Risk Trajectory</h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Score progression</span>
          </div>

          <div style={{ height: '220px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="userRiskGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={riskCol} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={riskCol} stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="day" stroke="var(--text-muted)" fontSize={11} />
                <YAxis domain={[0, 100]} stroke="var(--text-muted)" fontSize={11} />
                <Tooltip
                  contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: '8px' }}
                />
                <Area type="monotone" dataKey="risk" stroke={riskCol} strokeWidth={2} fillOpacity={1} fill="url(#userRiskGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Linked Incidents & Alerts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
        {/* Linked Alerts */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Triggered Alerts ({alerts.length})</h3>
            <Link to={`/alerts?user_id=${user.id}`} style={{ fontSize: '0.8rem', color: 'var(--text-accent)' }}>View in Queue →</Link>
          </div>

          {alerts.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>No open alerts for this user.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {alerts.map(a => (
                <Link
                  key={a.id}
                  to={`/alerts/${a.id}`}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.86rem', color: 'var(--text-primary)' }}>{a.title}</div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                      {alertTypeLabel(a.alert_type)} • {timeAgo(a.first_seen)}
                    </div>
                  </div>
                  <span
                    className="risk-badge"
                    style={{
                      backgroundColor: `${riskColor(a.severity)}1a`,
                      color: riskColor(a.severity),
                      border: `1px solid ${riskColor(a.severity)}40`
                    }}
                  >
                    {a.risk_score}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Linked Cases */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Investigation Dockets ({cases.length})</h3>
            <Link to={`/cases`} style={{ fontSize: '0.8rem', color: 'var(--text-accent)' }}>All Cases →</Link>
          </div>

          {cases.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>No formal cases opened for this identity.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {cases.map(c => (
                <Link
                  key={c.id}
                  to={`/cases/${c.id}`}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.78rem', color: 'var(--text-accent)' }}>{c.case_number}</span>
                      <strong style={{ fontSize: '0.86rem', color: 'var(--text-primary)' }}>{c.title}</strong>
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Status: {c.status} • Analyst: {c.assigned_analyst || 'Unassigned'}
                    </div>
                  </div>
                  <span
                    className="risk-badge"
                    style={{
                      backgroundColor: `${riskColor(c.severity)}1a`,
                      color: riskColor(c.severity),
                      border: `1px solid ${riskColor(c.severity)}40`
                    }}
                  >
                    {riskLabel(c.severity)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Telemetry Log */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="card-title">Recent Authentication Events</h3>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Last {events.length} sessions</span>
        </div>

        <table className="soc-table">
          <thead>
            <tr>
              <th style={{ width: '130px' }}>TIMESTAMP</th>
              <th style={{ width: '100px' }}>RESULT</th>
              <th style={{ width: '140px' }}>IP ADDRESS</th>
              <th style={{ width: '160px' }}>LOCATION</th>
              <th>DEVICE / BROWSER</th>
              <th style={{ width: '100px', textAlign: 'right' }}>RISK SCORE</th>
            </tr>
          </thead>
          <tbody>
            {events.map(ev => (
              <tr key={ev.id}>
                <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem' }}>
                  {formatDate(ev.timestamp, 'MMM dd HH:mm')}
                </td>
                <td>
                  <span className={`badge ${ev.result === 'failure' ? 'badge-critical' : 'badge-safe'}`}>
                    {ev.result === 'failure' ? '✕ Failed' : '✓ Success'}
                  </span>
                </td>
                <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.82rem' }}>
                  {ev.ip}
                </td>
                <td style={{ fontSize: '0.84rem' }}>
                  {ev.city ? `${ev.city}, ${ev.country}` : ev.country}
                  {ev.is_new_country && <span style={{ color: 'var(--critical)', fontSize: '0.7rem', display: 'block' }}>★ New Country</span>}
                </td>
                <td style={{ fontSize: '0.82rem' }}>
                  {ev.device} • {ev.browser} ({ev.os})
                </td>
                <td style={{ textAlign: 'right' }}>
                  <span
                    className="risk-badge"
                    style={{
                      backgroundColor: `${riskColor(ev.risk_level)}1a`,
                      color: riskColor(ev.risk_level),
                      border: `1px solid ${riskColor(ev.risk_level)}40`
                    }}
                  >
                    {ev.risk_score}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
