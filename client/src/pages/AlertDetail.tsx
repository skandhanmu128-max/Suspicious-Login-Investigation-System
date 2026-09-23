import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../services/api';
import { riskColor, riskLabel, formatDateFull, timeAgo, alertTypeLabel, alertTypeIcon, categoryIcon, getInitials, confidenceLabel } from '../lib/utils';
import type { Alert, LoginEvent, RiskSignal, CoreLoginParameters } from '../types';
import CoreParametersCards from '../components/CoreParametersCards';

export default function AlertDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [alert, setAlert] = useState<Alert | null>(null);
  const [relatedEvents, setRelatedEvents] = useState<LoginEvent[]>([]);
  const [associatedCase, setAssociatedCase] = useState<any>(null);
  const [coreParameters, setCoreParameters] = useState<CoreLoginParameters | null>(null);
  const [baseline, setBaseline] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => { if (id) load(); }, [id]);

  async function load() {
    try {
      const data = await api.alerts.get(id!);
      setAlert(data.alert);
      setRelatedEvents(data.relatedEvents ?? []);
      setAssociatedCase(data.associatedCase);
      setCoreParameters(data.coreParameters ?? null);
      setBaseline(data.baseline ?? null);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function acknowledge() {
    setUpdating(true);
    try {
      await api.alerts.update(id!, { status: 'acknowledged', acknowledgedBy: 'SOC Analyst' });
      await load();
    } finally { setUpdating(false); }
  }

  async function createCase() {
    if (!alert) return;
    setUpdating(true);
    try {
      const result = await api.cases.create({
        title: `Investigation: ${alert.title}`,
        description: alert.description,
        severity: alert.severity,
        userId: alert.user_id,
        relatedAlertIds: [alert.id],
        relatedEventIds: alert.related_event_ids,
        assignedAnalyst: 'SOC Analyst',
      });
      navigate(`/cases/${result.id}`);
    } finally { setUpdating(false); }
  }

  async function markFalsePositive() {
    setUpdating(true);
    try {
      await api.alerts.update(id!, { status: 'false_positive', acknowledgedBy: 'SOC Analyst' });
      await load();
    } finally { setUpdating(false); }
  }

  async function handleFeedback(classification: string) {
    if (!alert) return;
    const note = window.prompt(`Submit alert classification [${classification.toUpperCase()}]: Enter investigation rationale/notes:`) || '';
    try {
      await api.alerts.feedback(alert.id, { classification, notes: note });
      await load();
    } catch (err: any) {
      window.alert(`Failed to submit feedback: ${err.message}`);
    }
  }

  if (loading) return (
    <div className="fade-in">
      <div className="skeleton skeleton-title mb-4" style={{ width: 300 }} />
      <div className="skeleton skeleton-card mb-4" />
      <div className="skeleton skeleton-card" />
    </div>
  );

  if (!alert) return (
    <div className="empty-state"><h4>Alert not found</h4><Link to="/alerts" className="btn btn-primary">Back to Alerts</Link></div>
  );

  const color = riskColor(alert.severity);

  return (
    <div className="fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-4" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        <Link to="/alerts" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Alerts</Link>
        <span>›</span>
        <span style={{ color: 'var(--text-secondary)' }}>{alertTypeLabel(alert.alert_type)}</span>
      </div>

      {/* Header */}
      <motion.div
        className={`card mb-5 ${alert.severity === 'critical' ? 'card-critical' : alert.severity === 'high' ? 'card-high' : ''}`}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div style={{ padding: '1.5rem' }}>
          <div className="flex items-start gap-4">
            <div style={{ fontSize: '2rem', lineHeight: 1 }}>{alertTypeIcon(alert.alert_type)}</div>
            <div style={{ flex: 1 }}>
              <div className="flex items-center gap-3 mb-2" style={{ flexWrap: 'wrap' }}>
                <span className={`risk-badge ${alert.severity}`} style={{ fontSize: '0.8rem', padding: '0.25rem 0.75rem' }}>
                  {alert.severity === 'critical' && <div className="pulse-dot" />}
                  {riskLabel(alert.severity)}
                </span>
                <span className={`status-badge ${alert.status}`}>{alert.status.replace('_', ' ')}</span>
                <span style={{ fontSize: '0.75rem', fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-muted)' }}>
                  {alert.id.substring(0, 12).toUpperCase()}
                </span>
              </div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                {alert.title}
              </h2>
              <p style={{ fontSize: '0.87rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {alert.description}
              </p>
            </div>

            {/* Risk scores */}
            <div style={{ display: 'flex', gap: '1.5rem', flexShrink: 0 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '2rem', fontWeight: 800, color, lineHeight: 1 }}>
                  {Math.round(alert.risk_score)}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Risk Score
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '2rem', fontWeight: 800, color: 'var(--blue-light)', lineHeight: 1 }}>
                  {Math.round(alert.confidence * 100)}%
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Confidence
                </div>
              </div>
            </div>
          </div>

          {/* Meta info */}
          <div className="flex gap-6 mt-4" style={{ flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Affected User</div>
              <div className="flex items-center gap-2">
                <div className="avatar avatar-sm" style={{ background: alert.avatar_color ?? '#3B82F6', color: 'white', width: 28, height: 28 }}>
                  {getInitials(alert.user_name ?? 'U')}
                </div>
                <Link to={`/users/${alert.user_id}`} style={{ fontSize: '0.87rem', fontWeight: 600, color: 'var(--text-accent)', textDecoration: 'none' }}>
                  {alert.user_name}
                </Link>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{alert.department}</span>
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>First Seen</div>
              <div style={{ fontSize: '0.87rem', color: 'var(--text-secondary)' }}>{formatDateFull(alert.first_seen)}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Last Seen</div>
              <div style={{ fontSize: '0.87rem', color: 'var(--text-secondary)' }}>{timeAgo(alert.last_seen)}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Events Linked</div>
              <div style={{ fontSize: '0.87rem', color: 'var(--text-secondary)' }}>{alert.related_event_ids?.length ?? 0}</div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 mt-4" style={{ flexWrap: 'wrap' }}>
            {!associatedCase && alert.status !== 'false_positive' && (
              <button className="btn btn-primary" onClick={createCase} disabled={updating}>
                🗂 Open Investigation Case
              </button>
            )}
            {associatedCase && (
              <Link to={`/cases/${associatedCase.id}`} className="btn btn-primary">
                🗂 View Case {associatedCase.case_number}
              </Link>
            )}
            {alert.status === 'open' && (
              <button className="btn btn-secondary" onClick={acknowledge} disabled={updating}>
                ✓ Acknowledge
              </button>
            )}
            {alert.status !== 'false_positive' && (
              <button className="btn btn-ghost" onClick={markFalsePositive} disabled={updating}>
                Mark False Positive
              </button>
            )}
          </div>

          {/* Analyst Classification Feedback Controls */}
          <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
              🧠 Analyst Alert Classification (ML Feedback Log)
            </div>
            <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
              <button
                className="btn btn-sm btn-danger"
                onClick={() => handleFeedback('true_positive')}
                title="Mark alert as confirmed threat"
              >
                ✓ True Positive
              </button>
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => handleFeedback('false_positive')}
                title="Mark alert as benign / false alarm"
              >
                ✕ False Positive
              </button>
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => handleFeedback('under_investigation')}
                title="Active investigation required"
              >
                🔍 Under Investigation
              </button>
              <button
                className="btn btn-sm btn-primary"
                onClick={() => handleFeedback('resolved')}
                title="Close alert as resolved"
              >
                ✔ Resolved
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* 4 Core Login Investigation Parameters */}
      <CoreParametersCards
        coreParameters={coreParameters}
        baseline={baseline}
        currentEvent={relatedEvents[0]}
        showComparisonTable={true}
      />

      {/* Two columns: signals + events */}
      <div className="grid grid-2" style={{ gap: '1.25rem', gridTemplateColumns: '1fr 1fr' }}>
        {/* Detection Signals */}
        <motion.div className="card" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
          <div className="card-header">
            <h4>🔍 WHY WAS THIS FLAGGED?</h4>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{alert.signals?.length ?? 0} signals</span>
          </div>
          <div className="card-body" style={{ padding: '0.75rem' }}>
            {!alert.signals?.length ? (
              <div className="empty-state" style={{ padding: '2rem' }}><p>No signals recorded</p></div>
            ) : (
              alert.signals.map((sig: RiskSignal, i: number) => (
                <motion.div
                  key={sig.id}
                  className="signal-item"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.25 + i * 0.06 }}
                  style={{
                    borderLeft: `3px solid ${sig.severity === 'critical' ? 'var(--critical)' : sig.severity === 'high' ? 'var(--high)' : sig.severity === 'medium' ? 'var(--suspicious)' : 'var(--border-default)'}`,
                  }}
                >
                  <div className="signal-number">{i + 1}</div>
                  <div style={{ flex: 1 }}>
                    <div className="flex items-center gap-2 mb-1">
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{sig.name}</span>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                        {categoryIcon(sig.category)} {sig.category}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>{sig.description}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                      📎 {sig.evidence}
                    </div>
                  </div>
                  <div className={`signal-points positive`}>+{sig.points}</div>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>

        {/* Related Events Timeline */}
        <motion.div className="card" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 }}>
          <div className="card-header">
            <h4>📋 Related Authentication Events</h4>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{relatedEvents.length} events</span>
          </div>
          <div className="card-body" style={{ padding: '0.75rem' }}>
            {relatedEvents.length === 0 ? (
              <div className="empty-state" style={{ padding: '2rem' }}><p>No related events</p></div>
            ) : (
              <div className="timeline">
                {relatedEvents.map((ev, i) => (
                  <div key={ev.id} className="timeline-item">
                    <div className={`timeline-dot ${ev.result === 'success' ? 'event-success' : 'event-failure'}`}>
                      {ev.result === 'success' ? '✓' : '✗'}
                    </div>
                    <div className="timeline-time">{formatDateFull(ev.timestamp)}</div>
                    <Link to={`/events/${ev.id}`} style={{ textDecoration: 'none' }}>
                      <div className="timeline-content" style={{ cursor: 'pointer' }}>
                        <div className="flex items-center gap-2 mb-1">
                          <span style={{
                            fontSize: '0.75rem', fontWeight: 700,
                            color: ev.result === 'success' ? 'var(--safe)' : 'var(--critical)',
                          }}>
                            {ev.result.toUpperCase()}
                          </span>
                          {ev.is_new_device && <span className="tag" style={{ fontSize: '0.62rem' }}>New Device</span>}
                          {ev.is_new_country && <span className="tag" style={{ fontSize: '0.62rem', borderColor: 'rgba(239,68,68,0.3)', color: 'var(--critical)', background: 'rgba(239,68,68,0.1)' }}>New Country</span>}
                          {ev.is_vpn && <span className="tag" style={{ fontSize: '0.62rem' }}>VPN</span>}
                          {ev.is_tor && <span className="tag" style={{ fontSize: '0.62rem', borderColor: 'rgba(139,92,246,0.3)', color: '#A78BFA', background: 'rgba(139,92,246,0.1)' }}>TOR</span>}
                        </div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                          {ev.city}, {ev.country} · {ev.ip}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          {ev.device} · {ev.browser}
                        </div>
                        {ev.risk_score > 0 && (
                          <div className={`risk-badge ${ev.risk_level}`} style={{ marginTop: 4, display: 'inline-flex' }}>
                            {Math.round(ev.risk_score)} risk
                          </div>
                        )}
                      </div>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
