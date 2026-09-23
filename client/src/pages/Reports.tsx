import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import {
  riskColor, riskLabel, formatDate, formatDateFull, timeAgo, caseStatusLabel,
  alertTypeLabel, getInitials
} from '../lib/utils';
import type { Case } from '../types';

export default function Reports() {
  const [searchParams] = useSearchParams();
  const [cases, setCases] = useState<Case[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string>(searchParams.get('caseId') ?? '');
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.cases.list().then(res => {
      const caseList = res.cases ?? [];
      setCases(caseList);
      if (!selectedCaseId && caseList.length > 0) {
        setSelectedCaseId(caseList[0].id);
      }
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedCaseId) return;
    setLoading(true);
    api.reports.get(selectedCaseId)
      .then(res => setReportData(res.report ?? res))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedCaseId]);

  function handlePrint() {
    window.print();
  }

  return (
    <div className="page-container">
      {/* Header (hidden in print) */}
      <div className="page-header no-print">
        <div>
          <div className="page-breadcrumbs">
            <Link to="/" className="breadcrumb-item">SOC</Link>
            <span className="breadcrumb-separator">/</span>
            <span className="breadcrumb-current">Incident Reports</span>
          </div>
          <h1 className="page-title">Forensic Incident Reports & Dossiers</h1>
          <p className="page-description">
            Generate formal executive briefings, post-incident reviews, and compliance audit dossiers for closed or ongoing cases.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            id="print-report-btn"
            className="btn btn-primary"
            onClick={handlePrint}
            disabled={!reportData}
          >
            🖨 Print / Export PDF
          </button>
        </div>
      </div>

      {/* Case Selector Bar (hidden in print) */}
      <div className="card no-print" style={{ padding: '16px 20px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Select Investigation Docket:
          </label>
          <select
            id="report-case-select"
            className="select-field"
            value={selectedCaseId}
            onChange={e => setSelectedCaseId(e.target.value)}
            style={{ minWidth: '320px', flex: '1 1 300px' }}
          >
            {cases.map(c => (
              <option key={c.id} value={c.id}>
                {c.case_number} — {c.title} ({c.user_name || c.user_id}) [{c.status.toUpperCase()}]
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Report Document Sheet (styled for screen & printable) */}
      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
          Compiling forensic evidence & timeline dossier...
        </div>
      ) : reportData ? (
        <div
          id="report-document"
          className="card report-sheet"
          style={{
            padding: '36px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            boxShadow: 'var(--shadow-lg)',
            maxWidth: '900px',
            margin: '0 auto',
          }}
        >
          {/* Report Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid var(--border-strong)', paddingBottom: '20px', marginBottom: '24px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '1.8rem' }}>🛡</span>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '1.2rem', letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
                    SENTINELTRACE SOC
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Incident Response & Forensics Directorate
                  </div>
                </div>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div className="badge badge-critical" style={{ fontSize: '0.72rem', letterSpacing: '0.05em' }}>
                CONFIDENTIAL // TLP:AMBER
              </div>
              <div style={{ fontSize: '0.8rem', fontFamily: 'JetBrains Mono, monospace', marginTop: '6px', color: 'var(--text-secondary)' }}>
                {reportData.reportId}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Generated: {formatDateFull(reportData.generatedAt)}
              </div>
            </div>
          </div>

          {/* Title block */}
          <div style={{ marginBottom: '28px' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--blue-light)', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>
              CASE REF: {reportData.case.case_number}
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '4px', color: 'var(--text-primary)' }}>
              {reportData.case.title}
            </h2>
            <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginTop: '8px' }}>
              {reportData.case.description || 'Comprehensive post-incident analysis for suspicious authentication activities, anomaly correlation, and remediation steps.'}
            </p>
          </div>

          {/* Incident Meta Summary Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', background: 'var(--bg-surface)', padding: '16px', borderRadius: 'var(--radius-md)', marginBottom: '28px' }}>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Target Identity</div>
              <div style={{ fontWeight: 700, fontSize: '0.92rem', marginTop: '2px' }}>{reportData.case.user_name}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{reportData.case.department}</div>
            </div>

            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Severity Tier</div>
              <div style={{ marginTop: '4px' }}>
                <span
                  className="risk-badge"
                  style={{
                    backgroundColor: `${riskColor(reportData.case.severity)}1a`,
                    color: riskColor(reportData.case.severity),
                    border: `1px solid ${riskColor(reportData.case.severity)}40`,
                    fontWeight: 700
                  }}
                >
                  {riskLabel(reportData.case.severity)}
                </span>
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Docket Status</div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', marginTop: '4px' }}>
                {caseStatusLabel(reportData.case.status)}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Assigned Analyst</div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', marginTop: '4px' }}>
                {reportData.case.assigned_analyst || 'Alex Rivera'}
              </div>
            </div>
          </div>

          {/* Forensic Evidence Items */}
          <div style={{ marginBottom: '28px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px', marginBottom: '14px' }}>
              1. Key Forensic Indicators & Artifacts
            </h3>
            {(reportData.case.evidence || []).length === 0 ? (
              <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No forensic evidence attached.</div>
            ) : (
              <table className="soc-table" style={{ fontSize: '0.82rem' }}>
                <thead>
                  <tr>
                    <th style={{ width: '140px' }}>TYPE</th>
                    <th>LABEL</th>
                    <th>FORENSIC VALUE</th>
                    <th style={{ width: '100px' }}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {(reportData.case.evidence || []).map((ev: any) => (
                    <tr key={ev.id}>
                      <td style={{ fontFamily: 'JetBrains Mono, monospace' }}>{ev.type}</td>
                      <td style={{ fontWeight: 600 }}>{ev.label}</td>
                      <td style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-accent)' }}>{ev.value}</td>
                      <td>
                        <span className={`badge ${ev.reviewed ? 'badge-safe' : 'badge-warning'}`}>
                          {ev.reviewed ? 'Verified' : 'Unreviewed'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Authentication Timeline */}
          <div style={{ marginBottom: '28px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px', marginBottom: '14px' }}>
              2. Correlated Telemetry Event Timeline
            </h3>
            {(reportData.authenticationTimeline || []).length === 0 ? (
              <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No telemetry events bound to this docket.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {(reportData.authenticationTimeline || []).map((ev: any, idx: number) => (
                  <div
                    key={ev.id || idx}
                    style={{
                      padding: '10px 14px',
                      background: 'var(--bg-surface)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          {formatDate(ev.timestamp, 'yyyy-MM-dd HH:mm:ss')}
                        </span>
                        <span className={`badge ${ev.result === 'failure' ? 'badge-critical' : 'badge-safe'}`} style={{ fontSize: '0.7rem' }}>
                          {ev.result.toUpperCase()}
                        </span>
                        <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                          {ev.city}, {ev.country} ({ev.ip})
                        </span>
                      </div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                        Device: {ev.device} • Browser: {ev.browser} {ev.is_vpn ? '• [VPN]' : ''} {ev.is_tor ? '• [TOR]' : ''}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span className="risk-badge" style={{ backgroundColor: `${riskColor(ev.risk_level)}1a`, color: riskColor(ev.risk_level) }}>
                        Risk: {ev.risk_score}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Investigation Notes */}
          <div style={{ marginBottom: '28px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px', marginBottom: '14px' }}>
              3. Analyst Log & Containment History
            </h3>
            {(reportData.investigationNotes || []).length === 0 ? (
              <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No notes logged for this incident.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {(reportData.investigationNotes || []).map((n: any) => (
                  <div
                    key={n.id}
                    style={{
                      padding: '10px 14px',
                      background: 'var(--bg-elevated)',
                      borderRadius: 'var(--radius-sm)',
                      borderLeft: '3px solid var(--blue)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                      <strong style={{ color: 'var(--text-secondary)' }}>{n.analyst}</strong>
                      <span>{formatDateFull(n.timestamp)}</span>
                    </div>
                    <div style={{ fontSize: '0.86rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                      {n.content}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sign-off footer */}
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '20px', marginTop: '32px', display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            <div>
              Generated via SentinelTrace Autonomous Cyber Defense Platform
            </div>
            <div>
              Analyst Sign-off: _____________________
            </div>
          </div>
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
          No case selected. Choose an investigation docket above to view report.
        </div>
      )}
    </div>
  );
}
