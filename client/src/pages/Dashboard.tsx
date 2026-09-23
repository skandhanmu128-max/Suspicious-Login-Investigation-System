import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import api from '../services/api';
import {
  riskColor, riskLabel, formatDate, timeAgo, alertTypeLabel,
  alertTypeIcon, getInitials, niceNumber, confidenceLabel
} from '../lib/utils';
import type { Alert, LoginEvent, User } from '../types';

// ── Animated counter ──────────────────────────────────────────────────────────
function Counter({ value, duration = 1200 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = Math.ceil(value / (duration / 16));
    const timer = setInterval(() => {
      start += step;
      if (start >= value) { setDisplay(value); clearInterval(timer); }
      else setDisplay(start);
    }, 16);
    return () => clearInterval(timer);
  }, [value, duration]);
  return <>{display.toLocaleString()}</>;
}

// ── Risk ring ─────────────────────────────────────────────────────────────────
function RiskRing({ score, level, size = 70 }: { score: number; level: string; size?: number }) {
  const radius = (size - 8) / 2;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (score / 100) * circ;
  const color = riskColor(level);
  return (
    <div className="risk-ring" style={{ width: size, height: size, position: 'relative' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={5} />
        <motion.circle
          cx={size/2} cy={size/2} r={radius}
          fill="none" stroke={color} strokeWidth={5}
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 4px ${color})` }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: size > 60 ? '1.1rem' : '0.8rem', color,
      }}>
        {score}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [liveMode, setLiveMode] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api.dashboard.get();
      setData(d);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!liveMode) return;
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [liveMode, load]);

  if (loading) return <DashboardSkeleton />;
  if (!data) return (
    <div className="card" style={{ textAlign: 'center', padding: '60px', margin: '40px auto', maxWidth: '480px' }}>
      <div style={{ fontSize: '2rem', marginBottom: '12px' }}>⚠️</div>
      <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '8px' }}>Unable to Retrieve Telemetry Feed</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', marginBottom: '16px' }}>The SOC telemetry pipeline could not be loaded. Please ensure the backend service is reachable.</p>
      <button className="btn btn-primary" onClick={() => { setLoading(true); load(); }}>↻ Retry Connection</button>
    </div>
  );

  const { stats, recentAlerts, topRiskyUsers, recentEvents, eventsPerDay, alertSeverity, signalFrequency, geoData } = data;

  const severityColors: Record<string, string> = {
    critical: '#EF4444', high: '#F97316', suspicious: '#F59E0B', safe: '#10B981',
  };

  const RISK_DIST_COLORS = ['#10B981', '#F59E0B', '#F97316', '#EF4444'];

  return (
    <div className="fade-in">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Security Operations Center</h1>
          <p className="page-subtitle">Real-time authentication monitoring & threat detection</p>
        </div>
        <div className="flex gap-2 items-center">
          <button
            className={`btn ${liveMode ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setLiveMode(v => !v)}
          >
            {liveMode ? (
              <><div className="live-dot" style={{ background: 'white' }} /> Pause Live</>
            ) : (
              <><span>▶</span> Live Mode</>
            )}
          </button>
          <button className="btn btn-ghost" onClick={load}>↻ Refresh</button>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-4 mb-6">
        {[
          { label: 'Critical Alerts', value: stats.criticalAlerts, icon: '🔴', cls: 'critical', color: 'var(--critical)', bg: 'rgba(239,68,68,0.15)' },
          { label: 'High Risk Users', value: stats.highRiskUsers, icon: '👤', cls: 'amber', color: 'var(--suspicious)', bg: 'rgba(245,158,11,0.15)' },
          { label: 'Open Investigations', value: stats.openCases, icon: '🗂', cls: 'blue', color: 'var(--blue)', bg: 'rgba(59,130,246,0.15)' },
          { label: 'Auth Events (24h)', value: stats.todayEvents, icon: '⚡', cls: 'safe', color: 'var(--safe)', bg: 'rgba(16,185,129,0.15)' },
        ].map((m, i) => (
          <motion.div
            key={m.label}
            className={`metric-card ${m.cls}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
          >
            <div className="flex items-center justify-between">
              <div className="metric-icon" style={{ background: m.bg, color: m.color }}>
                {m.icon}
              </div>
              {m.cls === 'critical' && m.value > 0 && (
                <div className="risk-badge critical"><div className="pulse-dot" />Active</div>
              )}
            </div>
            <div className="metric-value" style={{ color: m.cls === 'critical' && m.value > 0 ? m.color : 'var(--text-primary)' }}>
              <Counter value={m.value} />
            </div>
            <div className="metric-label">{m.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Second row stats */}
      <div className="grid grid-4 mb-6">
        {[
          { label: 'Total Events', value: stats.totalEvents, color: 'var(--text-secondary)' },
          { label: 'Open Alerts', value: stats.openAlerts, color: 'var(--suspicious)' },
          { label: 'Confirmed Threats', value: stats.confirmedThreats, color: 'var(--critical)' },
          { label: 'False Positives', value: stats.falsePositives, color: 'var(--safe)' },
        ].map((m, i) => (
          <motion.div
            key={m.label}
            className="metric-card"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.32 + i * 0.06 }}
            style={{ padding: '0.875rem 1.25rem', flexDirection: 'row', alignItems: 'center', gap: '0.75rem' }}
          >
            <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.5rem', fontWeight: 700, color: m.color }}>
              <Counter value={m.value} />
            </div>
            <div className="metric-label" style={{ flex: 1 }}>{m.label}</div>
          </motion.div>
        ))}
      </div>

      {/* 4 Core Parameter Detection Signals Row */}
      <div className="card mb-6" style={{ padding: '1rem 1.25rem', background: 'rgba(15, 23, 42, 0.65)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span style={{ fontSize: '0.9rem' }}>🎯</span>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>
              Core Authentication Parameter Telemetry (Active Detection Signals)
            </span>
          </div>
          <Link to="/events" style={{ fontSize: '0.75rem', color: 'var(--text-accent)', textDecoration: 'none' }}>
            View Telemetry Feed →
          </Link>
        </div>

        <div className="grid grid-4" style={{ gap: '0.75rem' }}>
          <div className="card" style={{ padding: '0.75rem 1rem', background: 'rgba(139, 92, 246, 0.08)', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '10px' }}>
            <div className="flex items-center justify-between">
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>1. VPN DETECTED</span>
              <span>🛡</span>
            </div>
            <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.4rem', fontWeight: 700, color: '#C4B5FD', marginTop: '2px' }}>
              <Counter value={stats.vpnDetectedCount || 0} />
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>Treated as investigation signal</div>
          </div>

          <div className="card" style={{ padding: '0.75rem 1rem', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '10px' }}>
            <div className="flex items-center justify-between">
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>2. UNUSUAL LOCATION</span>
              <span>📍</span>
            </div>
            <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.4rem', fontWeight: 700, color: 'var(--critical)', marginTop: '2px' }}>
              <Counter value={stats.unusualLocationCount || 0} />
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>New country / city anomalies</div>
          </div>

          <div className="card" style={{ padding: '0.75rem 1rem', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '10px' }}>
            <div className="flex items-center justify-between">
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>3. OUTSIDE LOGIN WINDOW</span>
              <span>⏰</span>
            </div>
            <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.4rem', fontWeight: 700, color: 'var(--suspicious)', marginTop: '2px' }}>
              <Counter value={stats.outsideWindowCount || 0} />
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>Odd-hour behavioral shifts</div>
          </div>

          <div className="card" style={{ padding: '0.75rem 1rem', background: 'rgba(6, 182, 212, 0.08)', border: '1px solid rgba(6, 182, 212, 0.3)', borderRadius: '10px' }}>
            <div className="flex items-center justify-between">
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>4. NEW IP ADDRESS</span>
              <span>🌐</span>
            </div>
            <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.4rem', fontWeight: 700, color: '#22D3EE', marginTop: '2px' }}>
              <Counter value={stats.newIpCount || 0} />
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>Unrecognized IP access</div>
          </div>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-2 mb-6" style={{ gap: '1.25rem' }}>
        {/* Event trend chart */}
        <motion.div className="card" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }}>
          <div className="card-header">
            <h4>Authentication Events (7 Days)</h4>
            <span className="text-xs text-muted">Daily volume</span>
          </div>
          <div className="card-body">
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={eventsPerDay}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorCrit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={v => v.slice(5)} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                  <Tooltip
                    contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: 'var(--text-primary)' }}
                  />
                  <Area type="monotone" dataKey="total" name="Total" stroke="#3B82F6" fill="url(#colorTotal)" strokeWidth={2} />
                  <Area type="monotone" dataKey="critical" name="Critical" stroke="#EF4444" fill="url(#colorCrit)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </motion.div>

        {/* Alert severity + signal distribution */}
        <motion.div className="card" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.55 }}>
          <div className="card-header">
            <h4>Top Detection Signals</h4>
            <span className="text-xs text-muted">Trigger frequency</span>
          </div>
          <div className="card-body">
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={signalFrequency.slice(0, 7)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: '#94A3B8' }} width={130} />
                  <Tooltip
                    contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 12 }}
                  />
                  <Bar dataKey="count" name="Triggers" radius={[0, 4, 4, 0]}>
                    {signalFrequency.slice(0, 7).map((_: any, i: number) => (
                      <Cell key={i} fill={['#EF4444', '#F97316', '#F59E0B', '#3B82F6', '#8B5CF6', '#10B981', '#60A5FA'][i % 7]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Critical Alerts + Top Users */}
      <div className="grid grid-2 mb-6" style={{ gridTemplateColumns: '1.6fr 1fr' }}>
        {/* Critical alert queue */}
        <motion.div className="card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
          <div className="card-header">
            <h4>🚨 Active Security Alerts</h4>
            <Link to="/alerts" className="btn btn-ghost btn-sm">View All →</Link>
          </div>
          <div style={{ overflow: 'hidden' }}>
            {recentAlerts.length === 0 ? (
              <div className="empty-state"><div className="empty-icon">✅</div><p>No active alerts</p></div>
            ) : (
              recentAlerts.map((alert: Alert, i: number) => (
                <Link
                  key={alert.id}
                  to={`/alerts/${alert.id}`}
                  style={{ textDecoration: 'none' }}
                >
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.65 + i * 0.05 }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.875rem', padding: '0.875rem 1.25rem',
                      borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer',
                      background: alert.severity === 'critical' ? 'rgba(239,68,68,0.03)' : 'transparent',
                      transition: 'background 0.2s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                    onMouseLeave={e => (e.currentTarget.style.background = alert.severity === 'critical' ? 'rgba(239,68,68,0.03)' : 'transparent')}
                  >
                    <div style={{ fontSize: '1.2rem' }}>{alertTypeIcon(alert.alert_type)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`risk-badge ${alert.severity}`}>
                          {alert.severity === 'critical' && <div className="pulse-dot" />}
                          {riskLabel(alert.severity)}
                        </span>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {alert.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div
                          className="avatar avatar-sm"
                          style={{ background: alert.avatar_color ?? '#3B82F6', color: 'white', fontSize: '0.6rem', width: 20, height: 20 }}
                        >
                          {getInitials(alert.user_name ?? 'U')}
                        </div>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{alert.user_name}</span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{timeAgo(alert.last_seen)}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.1rem', fontWeight: 700, color: riskColor(alert.severity) }}>
                        {Math.round(alert.risk_score)}
                      </div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>risk</div>
                    </div>
                  </motion.div>
                </Link>
              ))
            )}
          </div>
        </motion.div>

        {/* High risk users */}
        <motion.div className="card" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.65 }}>
          <div className="card-header">
            <h4>🎯 High Risk Users</h4>
            <Link to="/users" className="btn btn-ghost btn-sm">View All →</Link>
          </div>
          <div>
            {topRiskyUsers.map((user: User, i: number) => (
              <Link key={user.id} to={`/users/${user.id}`} style={{ textDecoration: 'none' }}>
                <motion.div
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.7 + i * 0.05 }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.7rem 1.25rem',
                    borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.025)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div
                    className="avatar avatar-sm"
                    style={{ background: user.avatar_color ?? '#3B82F6', color: 'white' }}
                  >
                    {getInitials(user.name)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.83rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {user.name}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{user.department}</div>
                  </div>
                  <RiskRing score={Math.round(user.current_risk)} level={user.risk_level} size={44} />
                </motion.div>
              </Link>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Live event feed */}
      <motion.div className="card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
        <div className="card-header">
          <div className="flex items-center gap-2">
            <h4>⚡ Live Authentication Feed</h4>
            {liveMode && <div className="live-indicator"><div className="live-dot" />Streaming</div>}
          </div>
          <Link to="/events" className="btn btn-ghost btn-sm">View All Events →</Link>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>User</th>
                <th>IP Address</th>
                <th>Location</th>
                <th>Device</th>
                <th>Result</th>
                <th>Risk</th>
              </tr>
            </thead>
            <tbody>
              {recentEvents.slice(0, 10).map((ev: LoginEvent, i: number) => (
                <tr
                  key={ev.id}
                  onClick={() => window.location.href = `/events/${ev.id}`}
                  className={ev.risk_level === 'critical' ? 'critical-row' : ''}
                >
                  <td>
                    <span className="mono text-xs" style={{ color: 'var(--text-muted)' }}>
                      {formatDate(ev.timestamp, 'HH:mm:ss')}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="avatar avatar-sm" style={{ background: (ev as any).avatar_color ?? '#3B82F6', color: 'white', width: 24, height: 24, fontSize: '0.65rem' }}>
                        {getInitials((ev as any).user_name ?? 'U')}
                      </div>
                      <span style={{ fontSize: '0.83rem', color: 'var(--text-primary)' }}>{(ev as any).user_name}</span>
                    </div>
                  </td>
                  <td>
                    <span className={`mono text-xs ${ev.ip_reputation === 'malicious' ? 'text-critical' : ev.ip_reputation === 'suspicious' ? 'text-suspicious' : 'text-muted'}`}>
                      {ev.ip}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.83rem' }}>{ev.city}, {ev.country}</span>
                    {ev.is_vpn && <span className="tag" style={{ marginLeft: 4, fontSize: '0.65rem' }}>VPN</span>}
                    {ev.is_tor && <span className="tag" style={{ marginLeft: 4, fontSize: '0.65rem', borderColor: 'rgba(139,92,246,0.3)', color: '#A78BFA' }}>TOR</span>}
                  </td>
                  <td style={{ fontSize: '0.8rem' }}>{ev.browser} / {ev.os}</td>
                  <td>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      fontSize: '0.75rem', fontWeight: 600,
                      color: ev.result === 'success' ? 'var(--safe)' : 'var(--critical)',
                    }}>
                      {ev.result === 'success' ? '✓' : '✗'} {ev.result}
                    </span>
                  </td>
                  <td>
                    <span className={`risk-badge ${ev.risk_level}`}>
                      {ev.risk_level === 'critical' && <div className="pulse-dot" />}
                      {Math.round(ev.risk_score)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div>
      <div className="grid grid-4 mb-6">
        {[0,1,2,3].map(i => <div key={i} className="skeleton skeleton-card" />)}
      </div>
      <div className="grid grid-2 mb-6">
        {[0,1].map(i => <div key={i} className="skeleton" style={{ height: 280, borderRadius: 16 }} />)}
      </div>
      <div className="skeleton" style={{ height: 320, borderRadius: 16 }} />
    </div>
  );
}
