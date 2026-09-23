import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import {
  riskColor, riskLabel, formatDateFull, formatDate, timeAgo, getInitials,
  caseStatusLabel, caseStatusNext, categoryIcon, alertTypeIcon
} from '../lib/utils';
import type { Case, InvestigationNote, AuditLog, LoginEvent, TimelineItem, RiskSignal, EvidenceItem } from '../types';
import CoreParametersCards from '../components/CoreParametersCards';

export default function CaseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [caseData, setCaseData] = useState<Case | null>(null);
  const [relatedEvents, setRelatedEvents] = useState<LoginEvent[]>([]);
  const [notes, setNotes] = useState<InvestigationNote[]>([]);
  const [auditTrail, setAuditTrail] = useState<AuditLog[]>([]);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'timeline' | 'evidence' | 'notes' | 'audit'>('timeline');
  const [noteContent, setNoteContent] = useState('');
  const [noteType, setNoteType] = useState<'note' | 'action' | 'escalation'>('note');
  const [submittingNote, setSubmittingNote] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [resolution, setResolution] = useState('');
  const [fpReason, setFpReason] = useState('');
  const [exportingPDF, setExportingPDF] = useState(false);

  useEffect(() => { if (id) load(); }, [id]);

  async function load() {
    try {
      const [caseRes, tlRes] = await Promise.all([
        api.cases.get(id!),
        api.cases.timeline(id!),
      ]);
      setCaseData({
        ...caseRes.case,
        coreParameters: caseRes.coreParameters ?? caseRes.case?.coreParameters,
      });
      setRelatedEvents(caseRes.relatedEvents ?? []);
      setNotes(caseRes.notes ?? []);
      setAuditTrail(caseRes.auditTrail ?? []);
      setTimeline(tlRes.timeline ?? []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function handleFeedback(classification: string) {
    if (!caseData) return;
    const note = window.prompt(`Submit analyst classification [${classification.toUpperCase()}]: Enter investigation rationale/notes:`) || '';
    try {
      await api.cases.feedback(caseData.id, { classification, notes: note });
      await load();
    } catch (err: any) {
      alert(`Failed to submit feedback: ${err.message}`);
    }
  }

  async function submitNote() {
    if (!noteContent.trim()) return;
    setSubmittingNote(true);
    try {
      await api.cases.addNote(id!, { analyst: 'SOC Analyst', content: noteContent, noteType });
      setNoteContent('');
      await load();
    } finally { setSubmittingNote(false); }
  }

  async function updateStatus() {
    setUpdatingStatus(true);
    try {
      await api.cases.update(id!, {
        status: newStatus,
        assignedAnalyst: 'SOC Analyst',
        resolution: resolution || undefined,
        falsePositiveReason: fpReason || undefined,
      });
      setShowStatusModal(false);
      await load();
    } finally { setUpdatingStatus(false); }
  }

  async function reviewEvidence(evidenceId: string, reviewed: boolean) {
    await api.cases.reviewEvidence(id!, evidenceId, reviewed);
    await load();
  }

  async function exportPDF() {
    setExportingPDF(true);
    try {
      const { jsPDF } = await import('jspdf');
      const report = await api.reports.get(id!);
      const r = report.report;
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      let y = 20;

      const addText = (text: string, size = 10, bold = false, color = [0, 0, 0]) => {
        doc.setFontSize(size);
        doc.setFont('helvetica', bold ? 'bold' : 'normal');
        doc.setTextColor(color[0], color[1], color[2]);
        doc.text(text, 20, y);
        y += size * 0.5 + 3;
      };

      const newLine = (n = 1) => { y += n * 6; };

      // Header
      doc.setFillColor(11, 15, 26);
      doc.rect(0, 0, 210, 40, 'F');
      doc.setFontSize(20); doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('🛡 SENTINELTRACE', 20, 18);
      doc.setFontSize(10); doc.setFont('helvetica', 'normal');
      doc.text('Security Investigation Report', 20, 26);
      doc.setFontSize(8);
      doc.text(`Report ID: ${r.reportId}  |  Generated: ${formatDateFull(r.generatedAt)}`, 20, 34);

      y = 50;

      addText('CASE SUMMARY', 14, true, [59, 130, 246]);
      newLine(0.5);
      addText(`Case Number: ${r.case.case_number}`, 10, true);
      addText(`Title: ${r.case.title}`);
      addText(`Severity: ${r.case.severity.toUpperCase()}`, 10, false, r.case.severity === 'critical' ? [239, 68, 68] : [0, 0, 0]);
      addText(`Status: ${r.case.status}`);
      addText(`Risk Score: ${Math.round(r.case.risk_score)} / 100`);
      addText(`Confidence: ${Math.round(r.case.confidence * 100)}%`);
      addText(`Assigned Analyst: ${r.case.assigned_analyst ?? 'Unassigned'}`);
      newLine();

      addText('AFFECTED USER', 12, true, [59, 130, 246]);
      addText(`Name: ${r.case.user_name}`);
      addText(`Email: ${r.case.user_email}`);
      addText(`Department: ${r.case.department}`);
      addText(`Role: ${r.case.role}`);
      newLine();

      addText('SUMMARY STATISTICS', 12, true, [59, 130, 246]);
      addText(`Total Auth Events: ${r.summary.totalEvents}`);
      addText(`Failed Attempts: ${r.summary.failedAttempts}`);
      addText(`Successful Logins: ${r.summary.successfulLogins}`);
      addText(`Countries Involved: ${r.summary.countriesInvolved.join(', ')}`);
      addText(`Devices: ${r.summary.devicesInvolved.join(', ')}`);
      newLine();

      if (r.authenticationTimeline?.length) {
        addText('AUTHENTICATION TIMELINE', 12, true, [59, 130, 246]);
        for (const ev of r.authenticationTimeline.slice(0, 10)) {
          addText(`${formatDate(ev.timestamp, 'MMM dd HH:mm:ss')} | ${ev.result.toUpperCase()} | ${ev.city}, ${ev.country} | ${ev.ip} | ${ev.device}`, 8);
        }
        newLine();
      }

      if (r.investigationNotes?.length) {
        if (y > 240) { doc.addPage(); y = 20; }
        addText('INVESTIGATION NOTES', 12, true, [59, 130, 246]);
        for (const note of r.investigationNotes) {
          addText(`[${note.note_type.toUpperCase()}] ${formatDateFull(note.timestamp)} — ${note.analyst}`, 9, true);
          const lines = doc.splitTextToSize(note.content, 170);
          doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(80, 80, 80);
          doc.text(lines, 20, y);
          y += lines.length * 4.5 + 4;
        }
        newLine();
      }

      if (r.case.resolution) {
        addText('RESOLUTION', 12, true, [16, 185, 129]);
        addText(r.case.resolution);
        if (r.case.false_positive_reason) addText(`False Positive Reason: ${r.case.false_positive_reason}`);
      }

      if (y > 240) { doc.addPage(); y = 20; }
      addText('AUDIT TRAIL', 12, true, [59, 130, 246]);
      for (const log of r.auditTrail.slice(0, 12)) {
        addText(`${formatDateFull(log.timestamp)} | ${log.action} | ${log.analyst}`, 8);
      }

      doc.setFontSize(7); doc.setFont('helvetica', 'italic'); doc.setTextColor(150, 150, 150);
      doc.text('Demo / Synthetic Security Telemetry — Not real-world threat intelligence', 20, 290);

      doc.save(`SentinelTrace-${r.case.case_number}-Report.pdf`);
    } catch (e) { console.error('PDF error:', e); alert('Failed to generate PDF'); }
    finally { setExportingPDF(false); }
  }

  if (loading) return (
    <div className="fade-in">
      <div className="skeleton skeleton-title mb-4" style={{ width: 300 }} />
      <div className="skeleton" style={{ height: 200, borderRadius: 16, marginBottom: 16 }} />
      <div className="skeleton" style={{ height: 400, borderRadius: 16 }} />
    </div>
  );

  if (!caseData) return (
    <div className="empty-state"><h4>Case not found</h4><Link to="/cases" className="btn btn-primary">Back to Cases</Link></div>
  );

  const color = riskColor(caseData.severity);
  const nextStatuses = caseStatusNext(caseData.status);
  const evidenceItems = Array.isArray(caseData.evidence) ? caseData.evidence : [];

  return (
    <div className="fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-4" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        <Link to="/cases" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Cases</Link>
        <span>›</span>
        <span style={{ color: 'var(--text-secondary)' }}>{caseData.case_number}</span>
      </div>

      {/* Case header */}
      <motion.div
        className={`card mb-5 ${caseData.severity === 'critical' ? 'card-critical' : ''}`}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div style={{ padding: '1.5rem' }}>
          <div className="flex items-start gap-4">
            <div style={{ flex: 1 }}>
              <div className="flex items-center gap-3 mb-2" style={{ flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.78rem', color: 'var(--text-muted)' }}>{caseData.case_number}</span>
                <span className={`risk-badge ${caseData.severity}`}>
                  {caseData.severity === 'critical' && <div className="pulse-dot" />}
                  {riskLabel(caseData.severity)}
                </span>
                <span className={`status-badge ${caseData.status}`}>{caseStatusLabel(caseData.status)}</span>
                {caseData.assigned_analyst && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>👤 {caseData.assigned_analyst}</span>
                )}
              </div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 700, marginBottom: '0.5rem' }}>{caseData.title}</h2>
              <p style={{ fontSize: '0.87rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{caseData.description}</p>

              <div className="flex gap-6 mt-3" style={{ flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 3 }}>Affected User</div>
                  <div className="flex items-center gap-2">
                    <div className="avatar avatar-sm" style={{ background: caseData.avatar_color ?? '#3B82F6', color: 'white', width: 26, height: 26 }}>
                      {getInitials(caseData.user_name ?? 'U')}
                    </div>
                    <Link to={`/users/${caseData.user_id}`} style={{ fontSize: '0.87rem', fontWeight: 600, color: 'var(--text-accent)', textDecoration: 'none' }}>
                      {caseData.user_name}
                    </Link>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{caseData.role}</span>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 3 }}>Opened</div>
                  <div style={{ fontSize: '0.87rem', color: 'var(--text-secondary)' }}>{timeAgo(caseData.created_at)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 3 }}>Risk Score</div>
                  <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.1rem', fontWeight: 700, color }}>
                    {Math.round(caseData.risk_score)} <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 400 }}>/ 100</span>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 3 }}>Confidence</div>
                  <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.1rem', fontWeight: 700, color: 'var(--blue-light)' }}>
                    {Math.round(caseData.confidence * 100)}%
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 mt-4" style={{ flexWrap: 'wrap' }}>
            {nextStatuses.map(ns => (
              <button key={ns.value} className="btn btn-secondary" onClick={() => { setNewStatus(ns.value); setShowStatusModal(true); }}>
                {ns.label}
              </button>
            ))}
            <button className="btn btn-ghost" onClick={exportPDF} disabled={exportingPDF}>
              {exportingPDF ? '⏳ Generating…' : '📄 Export PDF Report'}
            </button>
          </div>

          {/* Analyst Feedback Controls */}
          <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
              🧠 Analyst Incident Classification (ML Feedback Log)
            </div>
            <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
              <button
                className="btn btn-sm btn-danger"
                onClick={() => handleFeedback('true_positive')}
                title="Mark as verified adversary threat"
              >
                ✓ True Positive
              </button>
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => handleFeedback('false_positive')}
                title="Mark as benign or false alarm"
              >
                ✕ False Positive
              </button>
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => handleFeedback('under_investigation')}
                title="Keep actively in progress"
              >
                🔍 Under Investigation
              </button>
              <button
                className="btn btn-sm btn-primary"
                onClick={() => handleFeedback('resolved')}
                title="Mark threat as mitigated and resolved"
              >
                ✔ Resolved
              </button>
            </div>
          </div>

          {/* Resolved notice */}
          {caseData.resolution && (
            <div style={{ marginTop: '1rem', padding: '0.875rem', background: 'var(--safe-bg)', border: '1px solid var(--safe-border)', borderRadius: 10 }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--safe)', marginBottom: '0.3rem' }}>✅ Resolution</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{caseData.resolution}</div>
              {caseData.false_positive_reason && (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>False Positive: {caseData.false_positive_reason}</div>
              )}
            </div>
          )}
        </div>
      </motion.div>

      {/* 4 Core Login Investigation Parameters & Comparison */}
      <CoreParametersCards
        coreParameters={caseData.coreParameters}
        baseline={{
          knownCountries: caseData.known_countries,
          knownCities: caseData.known_cities,
          knownDevices: caseData.known_devices,
          knownIps: caseData.known_ips,
          typicalLoginStart: caseData.typical_login_start,
          typicalLoginEnd: caseData.typical_login_end,
          homeCity: caseData.known_cities?.[0],
          homeCountry: caseData.known_countries?.[0],
        }}
        currentEvent={relatedEvents.slice().sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0))[0] ?? relatedEvents[relatedEvents.length - 1]}
      />

      {/* Tab content */}
      <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <div className="tab-bar" style={{ marginBottom: 0 }}>
          {[
            { key: 'timeline', label: '⏱ Timeline', count: timeline.length },
            { key: 'evidence', label: '📎 Evidence', count: evidenceItems.length },
            { key: 'notes', label: '📝 Notes', count: notes.length },
            { key: 'audit', label: '🔍 Audit Trail', count: auditTrail.length },
          ].map(tab => (
            <button
              key={tab.key}
              className={`tab-item ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key as any)}
            >
              {tab.label}
              {tab.count > 0 && (
                <span style={{ marginLeft: 4, background: activeTab === tab.key ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.06)', padding: '0.1rem 0.4rem', borderRadius: 10, fontSize: '0.7rem' }}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div style={{ padding: '1.25rem' }}>
          <AnimatePresence mode="wait">
            {activeTab === 'timeline' && (
              <motion.div key="timeline" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="timeline">
                  {timeline.map((item, i) => (
                    <div key={i} className="timeline-item">
                      <div className={`timeline-dot ${
                        item.type === 'event' ? (item.data.result === 'success' ? 'event-success' : 'event-failure')
                        : item.type === 'note' ? 'event-note'
                        : item.type === 'audit' ? 'event-audit'
                        : 'event-case'
                      }`}>
                        {item.type === 'event' ? (item.data.result === 'success' ? '✓' : '✗') :
                         item.type === 'note' ? '📝' :
                         item.type === 'audit' ? '🔍' : '🗂'}
                      </div>
                      <div className="timeline-time">{formatDateFull(item.timestamp)}</div>
                      <div className="timeline-content">
                        {item.type === 'event' && (
                          <>
                            <div className="flex items-center gap-2 mb-1">
                              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: item.data.result === 'success' ? 'var(--safe)' : 'var(--critical)' }}>
                                {item.data.result === 'success' ? '✓ AUTHENTICATION SUCCESS' : '✗ AUTHENTICATION FAILURE'}
                              </span>
                              {item.data.risk_score > 0 && (
                                <span className={`risk-badge ${item.data.risk_level}`} style={{ fontSize: '0.65rem' }}>
                                  {Math.round(item.data.risk_score)}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                              {item.data.city}, {item.data.country} · <span className="mono">{item.data.ip}</span>
                            </div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                              {item.data.device} · {item.data.browser}
                              {item.data.is_new_device && ' · ⚠️ New Device'}
                              {item.data.is_new_country && ' · 🌍 New Country'}
                              {item.data.is_vpn && ' · 🛡 VPN'}
                            </div>
                          </>
                        )}
                        {item.type === 'note' && (
                          <>
                            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--blue-light)', marginBottom: 4 }}>
                              {item.data.analyst} · <span style={{ fontWeight: 400, textTransform: 'capitalize' }}>{item.data.note_type}</span>
                            </div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{item.data.content}</div>
                          </>
                        )}
                        {item.type === 'audit' && (
                          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.data.analyst}</span> · {item.data.action.replace(/_/g, ' ')}
                          </div>
                        )}
                        {item.type === 'case_created' && (
                          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#8B5CF6' }}>
                            🗂 Case Opened: {item.data.caseNumber}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {timeline.length === 0 && (
                    <div className="empty-state" style={{ padding: '2rem' }}><p>No timeline events yet</p></div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'evidence' && (
              <motion.div key="evidence" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {evidenceItems.length === 0 ? (
                  <div className="empty-state"><p>No evidence items recorded</p></div>
                ) : (
                  evidenceItems.map((ev: EvidenceItem) => (
                    <div
                      key={ev.id}
                      className={`evidence-item ${ev.reviewed ? 'reviewed' : ''}`}
                      style={{ cursor: 'pointer' }}
                      onClick={() => reviewEvidence(ev.id, !ev.reviewed)}
                    >
                      <div
                        className="evidence-icon"
                        style={{
                          background: ev.severity === 'critical' ? 'var(--critical-bg)' :
                                     ev.severity === 'high' ? 'var(--high-bg)' : 'var(--bg-card)',
                        }}
                      >
                        {ev.type === 'ip' ? '🌐' : ev.type === 'location' ? '📍' :
                         ev.type === 'device' ? '💻' : ev.type === 'auth' ? '🔐' :
                         ev.type === 'time' ? '⏱' : ev.type === 'geo' ? '🗺' :
                         ev.type === 'role' ? '👑' : '📎'}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div className="flex items-center gap-2 mb-1">
                          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>{ev.label}</span>
                          {ev.severity !== 'info' && (
                            <span className={`risk-badge ${ev.severity === 'critical' ? 'critical' : ev.severity === 'high' ? 'high' : 'suspicious'}`} style={{ fontSize: '0.62rem' }}>
                              {ev.severity}
                            </span>
                          )}
                          {ev.reviewed && (
                            <span style={{ fontSize: '0.72rem', color: 'var(--safe)', marginLeft: 'auto' }}>✓ Reviewed</span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontFamily: ev.type === 'ip' ? 'JetBrains Mono, monospace' : 'inherit' }}>
                          {ev.value}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </motion.div>
            )}

            {activeTab === 'notes' && (
              <motion.div key="notes" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {/* Add note */}
                {caseData.status !== 'resolved' && caseData.status !== 'false_positive' && (
                  <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'var(--bg-elevated)', borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="avatar avatar-sm" style={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)', color: 'white' }}>RG</div>
                      <span style={{ fontSize: '0.83rem', fontWeight: 600 }}>Add Investigation Note</span>
                      <select
                        className="select" value={noteType}
                        onChange={e => setNoteType(e.target.value as any)}
                        style={{ width: 130, marginLeft: 'auto', padding: '0.35rem 2rem 0.35rem 0.75rem', fontSize: '0.78rem' }}
                      >
                        <option value="note">Note</option>
                        <option value="action">Action</option>
                        <option value="escalation">Escalation</option>
                      </select>
                    </div>
                    <textarea
                      className="textarea"
                      placeholder="Document your investigation findings, actions taken, or escalation reasons…"
                      value={noteContent}
                      onChange={e => setNoteContent(e.target.value)}
                      style={{ minHeight: 80 }}
                    />
                    <div className="flex justify-end mt-2">
                      <button className="btn btn-primary btn-sm" onClick={submitNote} disabled={submittingNote || !noteContent.trim()}>
                        {submittingNote ? '⏳' : '→'} Submit Note
                      </button>
                    </div>
                  </div>
                )}

                {notes.length === 0 ? (
                  <div className="empty-state"><p>No notes added yet. Begin your investigation.</p></div>
                ) : (
                  notes.map(note => (
                    <div key={note.id} className={`note-card note-type-${note.note_type}`}>
                      <div className="note-header">
                        <div className="flex items-center gap-2">
                          <div className="avatar avatar-sm" style={{ background: '#3B82F6', color: 'white', width: 24, height: 24, fontSize: '0.6rem' }}>
                            {getInitials(note.analyst)}
                          </div>
                          <span className="note-analyst">{note.analyst}</span>
                          <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: note.note_type === 'escalation' ? 'var(--critical)' : note.note_type === 'action' ? 'var(--suspicious)' : 'var(--text-muted)' }}>
                            {note.note_type}
                          </span>
                        </div>
                        <span className="note-time">{formatDateFull(note.timestamp)}</span>
                      </div>
                      <div className="note-content">{note.content}</div>
                    </div>
                  ))
                )}
              </motion.div>
            )}

            {activeTab === 'audit' && (
              <motion.div key="audit" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {auditTrail.length === 0 ? (
                  <div className="empty-state"><p>No audit events recorded</p></div>
                ) : (
                  <div className="timeline">
                    {auditTrail.map((log, i) => (
                      <div key={log.id} className="timeline-item">
                        <div className="timeline-dot event-audit">🔍</div>
                        <div className="timeline-time">{formatDateFull(log.timestamp)}</div>
                        <div className="timeline-content">
                          <div className="flex items-center gap-2">
                            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace' }}>
                              {log.action}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            Analyst: {log.analyst}
                            {log.details && Object.keys(log.details).length > 0 && (
                              <span> · {JSON.stringify(log.details)}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Status update modal */}
      <AnimatePresence>
        {showStatusModal && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="modal" initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}>
              <div className="modal-header">
                <h4>Update Case Status</h4>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowStatusModal(false)}>✕</button>
              </div>
              <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>New Status</label>
                  <div className={`status-badge ${newStatus}`} style={{ fontSize: '0.85rem', padding: '0.3rem 0.75rem' }}>{caseStatusLabel(newStatus)}</div>
                </div>
                {(newStatus === 'resolved') && (
                  <div>
                    <label style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Resolution Summary *</label>
                    <textarea className="textarea" placeholder="Describe what happened and how it was resolved…" value={resolution} onChange={e => setResolution(e.target.value)} style={{ minHeight: 80 }} />
                  </div>
                )}
                {newStatus === 'false_positive' && (
                  <div>
                    <label style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>False Positive Reason *</label>
                    <select className="select" value={fpReason} onChange={e => setFpReason(e.target.value)} style={{ width: '100%' }}>
                      <option value="">Select reason…</option>
                      <option value="Employee Travel">Employee Travel</option>
                      <option value="Approved VPN">Approved VPN</option>
                      <option value="New Device">New Device (User Confirmed)</option>
                      <option value="Business Requirement">Business Requirement</option>
                      <option value="Security Testing">Security Testing</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                )}
                <div className="flex gap-2 justify-end">
                  <button className="btn btn-ghost" onClick={() => setShowStatusModal(false)}>Cancel</button>
                  <button className="btn btn-primary" onClick={updateStatus} disabled={updatingStatus}>
                    {updatingStatus ? '⏳' : '✓'} Confirm
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
