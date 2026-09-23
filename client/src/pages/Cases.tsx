import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import {
  riskColor, riskLabel, formatDate, timeAgo, caseStatusLabel,
  getInitials, truncate
} from '../lib/utils';
import type { Case, CaseStatus, RiskLevel } from '../types';

export default function Cases() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [cases, setCases] = useState<Case[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') ?? 'all');
  const [severityFilter, setSeverityFilter] = useState(searchParams.get('severity') ?? 'all');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // New Case form state
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newSeverity, setNewSeverity] = useState<RiskLevel>('high');
  const [newUserId, setNewUserId] = useState('');
  const [newAnalyst, setNewAnalyst] = useState('Alex Rivera (Lead SOC)');
  const [usersList, setUsersList] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchCases();
  }, [statusFilter, severityFilter]);

  useEffect(() => {
    api.users.list().then(res => setUsersList(res.users ?? [])).catch(() => {});
  }, []);

  async function fetchCases() {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (severityFilter !== 'all') params.severity = severityFilter;
      const res = await api.cases.list(params);
      setCases(res.cases ?? []);
      setTotal(res.total ?? (res.cases?.length || 0));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const filteredCases = cases.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.case_number.toLowerCase().includes(q) ||
      c.title.toLowerCase().includes(q) ||
      (c.user_name && c.user_name.toLowerCase().includes(q)) ||
      (c.assigned_analyst && c.assigned_analyst.toLowerCase().includes(q))
    );
  });

  // Calculate statistics
  const openCount = cases.filter(c => ['new', 'triaging', 'investigating'].includes(c.status)).length;
  const criticalCount = cases.filter(c => c.severity === 'critical' && c.status !== 'resolved' && c.status !== 'false_positive').length;
  const triagingCount = cases.filter(c => c.status === 'triaging').length;
  const resolvedCount = cases.filter(c => c.status === 'resolved').length;

  async function handleCreateCase(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim() || !newUserId) return;
    setCreating(true);
    try {
      const selectedUser = usersList.find(u => u.id === newUserId);
      await api.cases.create({
        title: newTitle,
        description: newDesc,
        severity: newSeverity,
        user_id: newUserId,
        assigned_analyst: newAnalyst,
        risk_score: selectedUser?.current_risk ?? 75,
        confidence: 0.85,
      });
      setShowCreateModal(false);
      setNewTitle('');
      setNewDesc('');
      fetchCases();
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-breadcrumbs">
            <Link to="/" className="breadcrumb-item">SOC</Link>
            <span className="breadcrumb-separator">/</span>
            <span className="breadcrumb-current">Investigation Cases</span>
          </div>
          <h1 className="page-title">Security Incidents & Investigations</h1>
          <p className="page-description">
            Active security response dockets, correlated attack storylines, forensic evidence and remediation tracking.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            id="refresh-cases-btn"
            className="btn btn-secondary"
            onClick={fetchCases}
            disabled={loading}
          >
            ↻ Refresh
          </button>
          <button
            id="create-case-btn"
            className="btn btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            + New Investigation
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="stats-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-card">
          <div className="stat-label">ACTIVE INVESTIGATIONS</div>
          <div className="stat-value" style={{ color: 'var(--blue-light)' }}>{openCount}</div>
          <div className="stat-sub">Across all security analysts</div>
        </div>
        <div className="stat-card" style={{ borderColor: criticalCount > 0 ? 'var(--critical-border)' : undefined }}>
          <div className="stat-label">CRITICAL THREATS</div>
          <div className="stat-value" style={{ color: 'var(--critical)' }}>{criticalCount}</div>
          <div className="stat-sub">Immediate response required</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">IN TRIAGE</div>
          <div className="stat-value" style={{ color: 'var(--suspicious)' }}>{triagingCount}</div>
          <div className="stat-sub">Initial assessment underway</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">CONTAINED / RESOLVED</div>
          <div className="stat-value" style={{ color: 'var(--safe)' }}>{resolvedCount}</div>
          <div className="stat-sub">Dockets closed successfully</div>
        </div>
      </div>

      {/* Filter toolbar */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '12px', flex: '1 1 320px' }}>
            <input
              id="case-search-input"
              type="text"
              placeholder="Search case #, title, user, or analyst..."
              className="input-field"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', maxWidth: '400px' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Status:</span>
            <select
              id="case-status-filter"
              className="select-field"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="new">New</option>
              <option value="triaging">Triaging</option>
              <option value="investigating">Investigating</option>
              <option value="contained">Contained</option>
              <option value="resolved">Resolved</option>
              <option value="false_positive">False Positive</option>
            </select>

            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '6px' }}>Severity:</span>
            <select
              id="case-severity-filter"
              className="select-field"
              value={severityFilter}
              onChange={e => setSeverityFilter(e.target.value)}
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="suspicious">Suspicious</option>
              <option value="safe">Safe</option>
            </select>
          </div>
        </div>
      </div>

      {/* Cases list */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="soc-table" id="cases-table">
          <thead>
            <tr>
              <th style={{ width: '130px' }}>CASE ID</th>
              <th>INCIDENT TITLE & TARGET USER</th>
              <th style={{ width: '130px' }}>SEVERITY</th>
              <th style={{ width: '140px' }}>STATUS</th>
              <th style={{ width: '170px' }}>ASSIGNED ANALYST</th>
              <th style={{ width: '130px' }}>EVIDENCE</th>
              <th style={{ width: '140px' }}>LAST UPDATED</th>
              <th style={{ width: '100px', textAlign: 'right' }}>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  Loading investigation dockets...
                </td>
              </tr>
            ) : filteredCases.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  No investigation cases match the selected filters.
                </td>
              </tr>
            ) : (
              filteredCases.map(c => {
                const status = c.status;
                let statusBadgeClass = 'badge-blue';
                if (status === 'resolved') statusBadgeClass = 'badge-safe';
                if (status === 'investigating') statusBadgeClass = 'badge-critical';
                if (status === 'triaging') statusBadgeClass = 'badge-warning';
                if (status === 'false_positive') statusBadgeClass = 'badge-muted';

                return (
                  <tr key={c.id} className="hover-row">
                    <td>
                      <Link
                        to={`/cases/${c.id}`}
                        style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, color: 'var(--text-accent)' }}
                      >
                        {c.case_number}
                      </Link>
                    </td>
                    <td>
                      <div>
                        <Link
                          to={`/cases/${c.id}`}
                          style={{ fontWeight: 600, color: 'var(--text-primary)', textDecoration: 'none', display: 'block' }}
                        >
                          {c.title}
                        </Link>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          <span>Target: <strong style={{ color: 'var(--text-secondary)' }}>{c.user_name || c.user_id}</strong></span>
                          {c.department && <span>• {c.department}</span>}
                          {c.risk_score && (
                            <span style={{ color: riskColor(c.severity) }}>
                              • Score: {c.risk_score}/100
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
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
                    </td>
                    <td>
                      <span className={`badge ${statusBadgeClass}`}>
                        {caseStatusLabel(c.status)}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div className="avatar-xs" style={{ background: 'var(--border-strong)' }}>
                          {getInitials(c.assigned_analyst || 'Unassigned')}
                        </div>
                        <span style={{ fontSize: '0.85rem' }}>{c.assigned_analyst || 'Unassigned'}</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                        <span>{(c.evidence ?? []).length} artifacts</span>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {(c.related_event_ids ?? []).length} telemetry events
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.82rem' }}>{timeAgo(c.updated_at || c.created_at)}</div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{formatDate(c.updated_at || c.created_at)}</div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Link
                        id={`view-case-${c.case_number.toLowerCase()}`}
                        to={`/cases/${c.id}`}
                        className="btn btn-sm btn-secondary"
                      >
                        Investigate →
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* New Case Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
            <motion.div
              className="modal-box"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              style={{ maxWidth: '540px' }}
            >
              <div className="modal-header">
                <h3 className="modal-title">Create Investigation Case</h3>
                <button className="btn-icon" onClick={() => setShowCreateModal(false)}>✕</button>
              </div>

              <form onSubmit={handleCreateCase} className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label className="form-label">Incident Title</label>
                  <input
                    id="new-case-title"
                    type="text"
                    required
                    placeholder="e.g., Compromised Credentials & Lateral Probe"
                    className="input-field"
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                  />
                </div>

                <div>
                  <label className="form-label">Target Identity</label>
                  <select
                    id="new-case-user"
                    required
                    className="select-field"
                    value={newUserId}
                    onChange={e => setNewUserId(e.target.value)}
                    style={{ width: '100%' }}
                  >
                    <option value="">Select Target User...</option>
                    {usersList.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.email}) - {u.department} [Risk: {u.current_risk}]
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="form-label">Initial Severity</label>
                    <select
                      className="select-field"
                      value={newSeverity}
                      onChange={e => setNewSeverity(e.target.value as RiskLevel)}
                      style={{ width: '100%' }}
                    >
                      <option value="critical">Critical</option>
                      <option value="high">High</option>
                      <option value="suspicious">Suspicious</option>
                      <option value="safe">Safe</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Lead Analyst</label>
                    <input
                      type="text"
                      className="input-field"
                      value={newAnalyst}
                      onChange={e => setNewAnalyst(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label">Incident Summary / Hypotheses</label>
                  <textarea
                    rows={3}
                    placeholder="Describe suspicious behaviors, observed indicators, or escalation reason..."
                    className="textarea-field"
                    value={newDesc}
                    onChange={e => setNewDesc(e.target.value)}
                  />
                </div>

                <div className="modal-footer" style={{ marginTop: '10px' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                    Cancel
                  </button>
                  <button id="submit-create-case-btn" type="submit" className="btn btn-primary" disabled={creating}>
                    {creating ? 'Creating Docket...' : 'Open Investigation'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
