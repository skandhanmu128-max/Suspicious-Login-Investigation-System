import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import {
  riskColor, riskLabel, formatDate, formatDateFull, timeAgo,
  categoryIcon, ipClass, getInitials, confidenceLabel
} from '../lib/utils';
import type { LoginEvent, RiskLevel } from '../types';
import CoreParametersCards from '../components/CoreParametersCards';

export default function Events() {
  const [searchParams] = useSearchParams();
  const [events, setEvents] = useState<LoginEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const [resultFilter, setResultFilter] = useState(searchParams.get('result') ?? 'all');
  const [riskFilter, setRiskFilter] = useState(searchParams.get('risk') ?? 'all');
  const [selectedEvent, setSelectedEvent] = useState<LoginEvent | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  useEffect(() => {
    fetchEvents();
  }, [resultFilter, riskFilter]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(fetchEvents, 5000);
    return () => clearInterval(timer);
  }, [autoRefresh, resultFilter, riskFilter]);

  async function fetchEvents() {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: '100' };
      if (resultFilter !== 'all') params.result = resultFilter;
      if (riskFilter !== 'all') params.risk_level = riskFilter;
      const res = await api.events.list(params);
      setEvents(res.events ?? []);
      setTotal(res.total ?? (res.events?.length || 0));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const filteredEvents = events.filter(e => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (e.user_name && e.user_name.toLowerCase().includes(q)) ||
      (e.user_email && e.user_email.toLowerCase().includes(q)) ||
      (e.ip && e.ip.toLowerCase().includes(q)) ||
      (e.country && e.country.toLowerCase().includes(q)) ||
      (e.city && e.city.toLowerCase().includes(q)) ||
      (e.device && e.device.toLowerCase().includes(q))
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
            <span className="breadcrumb-current">Authentication Telemetry</span>
          </div>
          <h1 className="page-title">Authentication Events Log</h1>
          <p className="page-description">
            Ingested access stream, real-time risk scoring, threat intelligence enrichment, and behavioral anomalies.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={e => setAutoRefresh(e.target.checked)}
            />
            Live Feed (5s)
          </label>
          <button
            id="refresh-events-btn"
            className="btn btn-secondary"
            onClick={fetchEvents}
            disabled={loading}
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Filter toolbar */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '12px', flex: '1 1 320px' }}>
            <input
              id="event-search-input"
              type="text"
              placeholder="Search user, email, IP, country, device..."
              className="input-field"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', maxWidth: '420px' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Outcome:</span>
            <select
              id="event-result-filter"
              className="select-field"
              value={resultFilter}
              onChange={e => setResultFilter(e.target.value)}
            >
              <option value="all">All Outcomes</option>
              <option value="success">Success</option>
              <option value="failure">Failure</option>
            </select>

            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '6px' }}>Risk:</span>
            <select
              id="event-risk-filter"
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

      {/* Telemetry Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="soc-table" id="events-table">
          <thead>
            <tr>
              <th style={{ width: '130px' }}>TIMESTAMP</th>
              <th>USER IDENTITY</th>
              <th style={{ width: '100px' }}>RESULT</th>
              <th style={{ width: '140px' }}>IP ADDRESS</th>
              <th style={{ width: '160px' }}>LOCATION</th>
              <th style={{ width: '170px' }}>DEVICE & OS</th>
              <th style={{ width: '110px' }}>RISK</th>
              <th style={{ width: '100px', textAlign: 'right' }}>SIGNALS</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  Streaming authentication telemetry...
                </td>
              </tr>
            ) : filteredEvents.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  No authentication events match the current filter.
                </td>
              </tr>
            ) : (
              filteredEvents.map(e => {
                const isFailure = e.result === 'failure';
                const hasSignals = (e.signals ?? []).length > 0;

                return (
                  <tr
                    key={e.id}
                    className="hover-row"
                    onClick={() => setSelectedEvent(e)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem' }}>
                        {formatDate(e.timestamp, 'HH:mm:ss')}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {formatDate(e.timestamp, 'MMM dd')}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div
                          className="avatar-xs"
                          style={{ background: e.avatar_color || 'var(--blue)' }}
                        >
                          {getInitials(e.user_name || e.user_id)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.86rem' }}>
                            {e.user_name || e.user_id}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {e.user_email || e.department}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${isFailure ? 'badge-critical' : 'badge-safe'}`}>
                        {isFailure ? '✕ Failed' : '✓ Success'}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.82rem' }}>
                        {e.ip}
                      </div>
                      <div style={{ display: 'flex', gap: '4px', marginTop: '2px', flexWrap: 'wrap' }}>
                        {(e.is_vpn || e.vpn_detected === 'detected') && <span className="badge badge-warning" style={{ fontSize: '0.65rem', background: 'rgba(139,92,246,0.2)', color: '#C4B5FD', borderColor: 'rgba(139,92,246,0.4)' }}>VPN</span>}
                        {e.signals?.some(s => s.id === 'new_ip') && <span className="badge badge-critical" style={{ fontSize: '0.65rem' }}>NEW IP</span>}
                        {e.is_tor && <span className="badge badge-critical" style={{ fontSize: '0.65rem' }}>TOR</span>}
                        {e.is_proxy && <span className="badge badge-warning" style={{ fontSize: '0.65rem' }}>PROXY</span>}
                        {e.ip_reputation === 'malicious' && <span className="badge badge-critical" style={{ fontSize: '0.65rem' }}>MALICIOUS</span>}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.84rem' }}>
                        {e.city ? `${e.city}, ${e.country}` : e.country}
                      </div>
                      {(e.is_new_country || e.is_new_city) && (
                        <span style={{ fontSize: '0.7rem', color: 'var(--high)', fontWeight: 600 }}>
                          ★ Unusual Location
                        </span>
                      )}
                    </td>
                    <td>
                      <div style={{ fontSize: '0.82rem' }}>{e.device || 'Unknown Device'}</div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        {e.browser} • {e.os}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span
                          className="risk-badge"
                          style={{
                            backgroundColor: `${riskColor(e.risk_level)}1a`,
                            color: riskColor(e.risk_level),
                            border: `1px solid ${riskColor(e.risk_level)}40`,
                            minWidth: '54px',
                            textAlign: 'center'
                          }}
                        >
                          {e.risk_score}
                        </span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {hasSignals ? (
                        <span className="badge badge-critical" style={{ fontSize: '0.72rem' }}>
                          {(e.signals ?? []).length} flagged
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Clean</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Detail Modal / Drawer */}
      <AnimatePresence>
        {selectedEvent && (
          <div className="modal-overlay" onClick={() => setSelectedEvent(null)}>
            <motion.div
              className="modal-box"
              initial={{ x: 60, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 60, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              style={{ maxWidth: '640px', width: '90vw' }}
            >
              <div className="modal-header">
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                    EVENT #{selectedEvent.id}
                  </div>
                  <h3 className="modal-title" style={{ marginTop: '2px' }}>
                    Telemetry Inspection
                  </h3>
                </div>
                <button className="btn-icon" onClick={() => setSelectedEvent(null)}>✕</button>
              </div>

              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {/* Top overview card */}
                <div
                  style={{
                    padding: '16px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-surface)',
                    border: `1px solid ${riskColor(selectedEvent.risk_level)}40`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className="avatar-md" style={{ background: selectedEvent.avatar_color || 'var(--blue)' }}>
                      {getInitials(selectedEvent.user_name || selectedEvent.user_id)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '1rem' }}>{selectedEvent.user_name}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{selectedEvent.user_email}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        Dept: {selectedEvent.department} • Time: {formatDateFull(selectedEvent.timestamp)}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.6rem', fontWeight: 800, color: riskColor(selectedEvent.risk_level) }}>
                      {selectedEvent.risk_score}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: riskColor(selectedEvent.risk_level), textTransform: 'uppercase', fontWeight: 700 }}>
                      {riskLabel(selectedEvent.risk_level)}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      Confidence: {confidenceLabel(selectedEvent.confidence)}
                    </div>
                  </div>
                </div>

                {/* Explanation */}
                {selectedEvent.explanation && (
                  <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', padding: '12px 16px', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ fontSize: '0.76rem', color: 'var(--blue-light)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                      Security Engine Explanation
                    </div>
                    <div style={{ fontSize: '0.86rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                      {selectedEvent.explanation}
                    </div>
                  </div>
                )}

                {/* 4 Core Parameters Breakdown */}
                <CoreParametersCards
                  currentEvent={selectedEvent}
                  coreParameters={selectedEvent.coreParameters}
                  showComparisonTable={true}
                />

                {/* Grid details */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="info-block">
                    <div className="info-block-label">NETWORK & IP</div>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.86rem', color: 'var(--text-primary)' }}>
                      {selectedEvent.ip}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      Reputation: <strong style={{ color: selectedEvent.ip_reputation === 'clean' ? 'var(--safe)' : 'var(--critical)' }}>{selectedEvent.ip_reputation}</strong>
                    </div>
                    {selectedEvent.isp && <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>ISP: {selectedEvent.isp}</div>}
                    <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                      {selectedEvent.is_vpn && <span className="badge badge-warning">VPN Detected</span>}
                      {selectedEvent.is_tor && <span className="badge badge-critical">Tor Exit Node</span>}
                      {selectedEvent.is_proxy && <span className="badge badge-warning">Proxy</span>}
                    </div>
                  </div>

                  <div className="info-block">
                    <div className="info-block-label">GEOLOCATION</div>
                    <div style={{ fontSize: '0.86rem', color: 'var(--text-primary)' }}>
                      {selectedEvent.city}, {selectedEvent.country}
                    </div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Coords: {selectedEvent.lat?.toFixed(2)}, {selectedEvent.lng?.toFixed(2)}
                    </div>
                    <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                      {selectedEvent.is_new_country && <span className="badge badge-critical">New Country</span>}
                      {selectedEvent.is_new_city && <span className="badge badge-warning">New City</span>}
                    </div>
                  </div>

                  <div className="info-block">
                    <div className="info-block-label">DEVICE PROFILE</div>
                    <div style={{ fontSize: '0.86rem', color: 'var(--text-primary)' }}>
                      {selectedEvent.device}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      {selectedEvent.browser} • {selectedEvent.os}
                    </div>
                    <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                      {selectedEvent.is_new_device && <span className="badge badge-warning">Unrecognized Device</span>}
                      {selectedEvent.is_mobile && <span className="badge badge-blue">Mobile Client</span>}
                    </div>
                  </div>

                  <div className="info-block">
                    <div className="info-block-label">AUTHENTICATION RESULT</div>
                    <div style={{ fontSize: '0.86rem', fontWeight: 600, color: selectedEvent.result === 'success' ? 'var(--safe)' : 'var(--critical)' }}>
                      {selectedEvent.result === 'success' ? 'Authenticated Successfully' : 'Authentication Failed'}
                    </div>
                    {selectedEvent.failure_reason && (
                      <div style={{ fontSize: '0.78rem', color: 'var(--critical)', marginTop: '4px' }}>
                        Reason: {selectedEvent.failure_reason}
                      </div>
                    )}
                    {selectedEvent.attack_scenario && (
                      <div style={{ fontSize: '0.76rem', color: 'var(--high)', marginTop: '4px' }}>
                        Correlated Scenario: {selectedEvent.attack_scenario}
                      </div>
                    )}
                  </div>
                </div>

                {/* Signals breakdown */}
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '10px' }}>
                    TRIGGERED RISK SIGNALS ({(selectedEvent.signals ?? []).length})
                  </div>
                  {(selectedEvent.signals ?? []).length === 0 ? (
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      No adverse risk indicators detected for this event.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {(selectedEvent.signals ?? []).map((sig, idx) => (
                        <div
                          key={idx}
                          style={{
                            padding: '10px 14px',
                            background: 'var(--bg-elevated)',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--border-subtle)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span>{categoryIcon(sig.category)}</span>
                              <span style={{ fontWeight: 600, fontSize: '0.84rem' }}>{sig.name}</span>
                              <span className="badge badge-critical" style={{ fontSize: '0.68rem' }}>+{sig.points} pts</span>
                            </div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                              {sig.description}
                            </div>
                          </div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono, monospace' }}>
                            {sig.evidence}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="modal-footer" style={{ marginTop: '10px' }}>
                  <Link
                    to={`/users/${selectedEvent.user_id}`}
                    className="btn btn-secondary"
                  >
                    View User Profile →
                  </Link>
                  <button className="btn btn-primary" onClick={() => setSelectedEvent(null)}>
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
