import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import {
  riskColor, riskLabel, timeAgo, getInitials
} from '../lib/utils';
import type { User } from '../types';

export default function Users() {
  const [searchParams] = useSearchParams();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const [deptFilter, setDeptFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState('all');

  useEffect(() => {
    fetchUsers();
  }, [riskFilter]);

  async function fetchUsers() {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (riskFilter !== 'all') params.risk_level = riskFilter;
      const res = await api.users.list(params);
      setUsers(res.users ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const departments = Array.from(new Set(users.map(u => u.department).filter(Boolean)));

  const filteredUsers = users.filter(u => {
    if (deptFilter !== 'all' && u.department !== deptFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.role && u.role.toLowerCase().includes(q)) ||
      (u.department && u.department.toLowerCase().includes(q))
    );
  });

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-breadcrumbs">
            <Link to="/" className="breadcrumb-item">SOC</Link>
            <span className="breadcrumb-separator">/</span>
            <span className="breadcrumb-current">User Behavioral Baselines</span>
          </div>
          <h1 className="page-title">Identity & Behavioral Profiles</h1>
          <p className="page-description">
            Monitored accounts, dynamic UEBA risk baselines, typical working patterns, and anomalous deviation scores.
          </p>
        </div>
        <button
          id="refresh-users-btn"
          className="btn btn-secondary"
          onClick={fetchUsers}
          disabled={loading}
        >
          ↻ Refresh Directory
        </button>
      </div>

      {/* Filter toolbar */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '12px', flex: '1 1 320px' }}>
            <input
              id="user-search-input"
              type="text"
              placeholder="Search user name, email, role, or department..."
              className="input-field"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', maxWidth: '420px' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Department:</span>
            <select
              className="select-field"
              value={deptFilter}
              onChange={e => setDeptFilter(e.target.value)}
            >
              <option value="all">All Departments</option>
              {departments.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>

            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '6px' }}>Risk Level:</span>
            <select
              className="select-field"
              value={riskFilter}
              onChange={e => setRiskFilter(e.target.value)}
            >
              <option value="all">All Risk Levels</option>
              <option value="critical">Critical (80-100)</option>
              <option value="high">High (60-79)</option>
              <option value="suspicious">Suspicious (35-59)</option>
              <option value="safe">Safe (0-34)</option>
            </select>
          </div>
        </div>
      </div>

      {/* User Directory Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
        {loading ? (
          <div className="card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            Loading user behavioral profiles...
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            No user identities match your criteria.
          </div>
        ) : (
          filteredUsers.map(u => {
            const riskCol = riskColor(u.risk_level);
            return (
              <div
                key={u.id}
                className="card hover-card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  borderTop: `3px solid ${riskCol}`,
                  position: 'relative'
                }}
              >
                <div>
                  {/* Top user row */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div
                        className="avatar-md"
                        style={{ background: u.avatar_color || 'var(--blue)' }}
                      >
                        {getInitials(u.name)}
                      </div>
                      <div>
                        <Link
                          to={`/users/${u.id}`}
                          style={{ fontWeight: 700, fontSize: '0.98rem', color: 'var(--text-primary)', textDecoration: 'none' }}
                        >
                          {u.name}
                        </Link>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{u.email}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          {u.role} • {u.department}
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span
                        className="risk-badge"
                        style={{
                          backgroundColor: `${riskCol}1a`,
                          color: riskCol,
                          border: `1px solid ${riskCol}40`,
                          fontWeight: 700
                        }}
                      >
                        {u.current_risk} · {riskLabel(u.risk_level)}
                      </span>
                    </div>
                  </div>

                  {/* Baseline indicators */}
                  <div style={{ background: 'var(--bg-elevated)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', marginBottom: '12px' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
                      BEHAVIORAL BASELINE
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.78rem' }}>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Hours: </span>
                        <strong>{u.typical_login_start || 9}:00 - {u.typical_login_end || 18}:00</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Countries: </span>
                        <strong>{(u.known_countries || []).slice(0, 2).join(', ') || 'US'}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Devices: </span>
                        <strong>{(u.known_devices || []).length} registered</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Fail Rate: </span>
                        <strong style={{ color: u.failed_logins > 3 ? 'var(--critical)' : 'inherit' }}>
                          {u.failed_logins}/{u.total_logins} ({Math.round(((u.failed_logins || 0) / Math.max(u.total_logins || 1, 1)) * 100)}%)
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer action */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    {u.last_login ? `Last active ${timeAgo(u.last_login)}` : 'No recent logins'}
                  </span>
                  <Link
                    to={`/users/${u.id}`}
                    className="btn btn-sm btn-secondary"
                  >
                    Examine Profile →
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
