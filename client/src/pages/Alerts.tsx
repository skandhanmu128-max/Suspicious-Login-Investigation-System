import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../services/api';
import { riskColor, riskLabel, formatDate, timeAgo, alertTypeLabel, alertTypeIcon, getInitials, truncate } from '../lib/utils';
import type { Alert } from '../types';

export default function Alerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();

  const severity = searchParams.get('severity') ?? '';
  const status = searchParams.get('status') ?? '';
  const search = searchParams.get('search') ?? '';
  const page = parseInt(searchParams.get('page') ?? '1');

  useEffect(() => {
    load();
  }, [severity, status, search, page]);

  async function load() {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: '20' };
      if (severity) params.severity = severity;
      if (status) params.status = status;
      if (search) params.search = search;
      const data = await api.alerts.list(params);
      setAlerts(data.alerts ?? []);
      setTotal(data.total ?? 0);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value); else next.delete(key);
    next.delete('page');
    setSearchParams(next);
  }

  const openCritical = alerts.filter(a => a.severity === 'critical' && a.status !== 'false_positive').length;

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Alert Queue</h1>
          <p className="page-subtitle">{total} alerts · {openCritical > 0 && <span style={{ color: 'var(--critical)', fontWeight: 600 }}>{openCritical} critical open</span>}</p>
        </div>
        <Link to="/cases/new" className="btn btn-primary">+ Create Case</Link>
      </div>

      {/* Filters */}
      <div className="card mb-4">
        <div className="filter-bar">
          <div className="search-bar" style={{ width: 240 }}>
            <span className="search-icon" style={{ fontSize: '0.85rem', zIndex: 1 }}>🔍</span>
            <input
              placeholder="Search alerts…"
              defaultValue={search}
              style={{ paddingLeft: '2rem', background: 'var(--bg-base)', border: '1px solid var(--border-default)', borderRadius: 6, padding: '0.45rem 0.75rem 0.45rem 2rem', color: 'var(--text-primary)', fontSize: '0.85rem' }}
              onKeyDown={e => { if (e.key === 'Enter') setFilter('search', (e.target as HTMLInputElement).value); }}
            />
          </div>

          <select className="select" value={severity} onChange={e => setFilter('severity', e.target.value)} style={{ width: 140 }}>
            <option value="">All Severity</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="suspicious">Suspicious</option>
            <option value="safe">Safe</option>
          </select>

          <select className="select" value={status} onChange={e => setFilter('status', e.target.value)} style={{ width: 150 }}>
            <option value="">All Status</option>
            <option value="open">Open</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="investigating">Investigating</option>
            <option value="closed">Closed</option>
            <option value="false_positive">False Positive</option>
          </select>

          {(severity || status || search) && (
            <button className="btn btn-ghost btn-sm" onClick={() => setSearchParams({})}>✕ Clear</button>
          )}
        </div>
      </div>

      {/* Alert table */}
      <div className="card">
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Priority</th>
                <th>Alert</th>
                <th>User</th>
                <th>Detection</th>
                <th>Risk</th>
                <th>Confidence</th>
                <th>First Seen</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [0,1,2,3,4].map(i => (
                  <tr key={i}>
                    {[0,1,2,3,4,5,6,7].map(j => (
                      <td key={j}><div className="skeleton skeleton-text" style={{ width: '80%' }} /></td>
                    ))}
                  </tr>
                ))
              ) : alerts.length === 0 ? (
                <tr><td colSpan={8}>
                  <div className="empty-state"><div className="empty-icon">✅</div><h4>No alerts found</h4><p>No alerts match your current filters.</p></div>
                </td></tr>
              ) : (
                alerts.map((alert, i) => (
                  <motion.tr
                    key={alert.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className={alert.severity === 'critical' ? 'critical-row' : ''}
                    onClick={() => window.location.href = `/alerts/${alert.id}`}
                  >
                    <td>
                      <span className={`risk-badge ${alert.severity}`} style={{ minWidth: 80, justifyContent: 'center' }}>
                        {alert.severity === 'critical' && <div className="pulse-dot" />}
                        {riskLabel(alert.severity)}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '1rem' }}>{alertTypeIcon(alert.alert_type)}</span>
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {truncate(alert.title, 40)}
                          </div>
                          <div style={{ fontSize: '0.71rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                            {alert.id.substring(0, 8).toUpperCase()}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="avatar avatar-sm" style={{ background: alert.avatar_color ?? '#3B82F6', color: 'white', width: 26, height: 26, fontSize: '0.65rem' }}>
                          {getInitials(alert.user_name ?? 'U')}
                        </div>
                        <div>
                          <div style={{ fontSize: '0.83rem', fontWeight: 500, color: 'var(--text-primary)' }}>{alert.user_name}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{alert.department}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{alertTypeLabel(alert.alert_type)}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <svg width={32} height={32} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
                          <circle cx={16} cy={16} r={12} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={3} />
                          <circle cx={16} cy={16} r={12} fill="none"
                            stroke={riskColor(alert.severity)} strokeWidth={3}
                            strokeDasharray={75.4}
                            strokeDashoffset={75.4 - (alert.risk_score / 100) * 75.4}
                            strokeLinecap="round"
                          />
                        </svg>
                        <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, color: riskColor(alert.severity) }}>
                          {Math.round(alert.risk_score)}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {Math.round(alert.confidence * 100)}%
                      </span>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{timeAgo(alert.first_seen)}</div>
                    </td>
                    <td>
                      <span className={`status-badge ${alert.status}`}>{alert.status.replace('_', ' ')}</span>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > 20 && (
          <div className="card-footer flex items-center justify-between">
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} of {total}
            </span>
            <div className="flex gap-2">
              <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setFilter('page', String(page - 1))}>← Prev</button>
              <button className="btn btn-ghost btn-sm" disabled={page * 20 >= total} onClick={() => setFilter('page', String(page + 1))}>Next →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
