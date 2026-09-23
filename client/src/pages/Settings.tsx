import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Settings form state
  const [safeMax, setSafeMax] = useState(35);
  const [suspiciousMax, setSuspiciousMax] = useState(60);
  const [highMax, setHighMax] = useState(80);
  const [liveMode, setLiveMode] = useState(false);
  const [liveInterval, setLiveInterval] = useState(5);
  const [weights, setWeights] = useState<Record<string, number>>({
    impossible_travel: 45,
    brute_force: 35,
    tor_node: 30,
    vpn_proxy: 15,
    new_country: 25,
    new_device: 15,
    odd_hours: 10,
    failed_attempts: 10,
  });

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    try {
      const res = await api.settings.get();
      if (res.settings) {
        setSafeMax(res.settings.safe_max ?? 35);
        setSuspiciousMax(res.settings.suspicious_max ?? 60);
        setHighMax(res.settings.high_max ?? 80);
        setLiveMode(Boolean(res.settings.live_mode));
        setLiveInterval(res.settings.live_interval ?? 5);
        if (res.settings.weights && Object.keys(res.settings.weights).length > 0) {
          setWeights(prev => ({ ...prev, ...res.settings.weights }));
        }
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.settings.update({
        safeMax,
        suspiciousMax,
        highMax,
        liveMode,
        liveInterval,
        weights,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      alert(`Failed to save settings: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  const handleWeightChange = (key: string, val: number) => {
    setWeights(prev => ({ ...prev, [key]: val }));
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-breadcrumbs">
            <Link to="/" className="breadcrumb-item">SOC</Link>
            <span className="breadcrumb-separator">/</span>
            <span className="breadcrumb-current">Configuration</span>
          </div>
          <h1 className="page-title">Detection Engine & SOC Settings</h1>
          <p className="page-description">
            Tune algorithmic risk thresholds, behavioral weighting parameters, ingestion timers, and defense boundaries.
          </p>
        </div>

        <button
          id="save-settings-btn"
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving || loading}
        >
          {saving ? 'Saving...' : '💾 Save Changes'}
        </button>
      </div>

      {saveSuccess && (
        <div style={{ padding: '12px 16px', background: 'var(--safe-bg)', border: '1px solid var(--safe-border)', color: 'var(--safe)', borderRadius: 'var(--radius-md)', marginBottom: '20px' }}>
          ✓ Settings and risk engine parameters updated successfully.
        </div>
      )}

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Risk Thresholds Card */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Risk Severity Score Thresholds (0 - 100)</h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Defines boundary cutoffs for automated escalation</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <div className="info-block" style={{ borderLeft: '3px solid var(--safe)' }}>
              <div className="info-block-label">SAFE TIER CEILING</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
                <input
                  id="setting-safe-max"
                  type="number"
                  min={10}
                  max={50}
                  className="input-field"
                  value={safeMax}
                  onChange={e => setSafeMax(Number(e.target.value))}
                  style={{ width: '80px' }}
                />
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>0 to {safeMax} pts</span>
              </div>
            </div>

            <div className="info-block" style={{ borderLeft: '3px solid var(--suspicious)' }}>
              <div className="info-block-label">SUSPICIOUS TIER CEILING</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
                <input
                  id="setting-suspicious-max"
                  type="number"
                  min={35}
                  max={75}
                  className="input-field"
                  value={suspiciousMax}
                  onChange={e => setSuspiciousMax(Number(e.target.value))}
                  style={{ width: '80px' }}
                />
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{safeMax + 1} to {suspiciousMax} pts</span>
              </div>
            </div>

            <div className="info-block" style={{ borderLeft: '3px solid var(--high)' }}>
              <div className="info-block-label">HIGH RISK CEILING</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
                <input
                  id="setting-high-max"
                  type="number"
                  min={60}
                  max={90}
                  className="input-field"
                  value={highMax}
                  onChange={e => setHighMax(Number(e.target.value))}
                  style={{ width: '80px' }}
                />
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{suspiciousMax + 1} to {highMax} pts</span>
              </div>
            </div>

            <div className="info-block" style={{ borderLeft: '3px solid var(--critical)' }}>
              <div className="info-block-label">CRITICAL THRESHOLD</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
                <strong style={{ fontSize: '1.1rem', color: 'var(--critical)' }}>{highMax + 1}+ pts</strong>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Auto-creates SOC investigation</span>
              </div>
            </div>
          </div>
        </div>

        {/* Four Core Parameters Weight Tuning */}
        <div className="card" style={{ borderLeft: '4px solid var(--accent-cyan)' }}>
          <div className="card-header">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="badge badge-info" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Core Telemetry</span>
                <h3 className="card-title" style={{ margin: 0 }}>Four Core Login Investigation Parameters</h3>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px', marginBottom: 0 }}>
                Adjust point weights for the 4 primary SOC detection signals. VPN is tuned as an investigation signal (10 pts), escalating when combined with IP/Location/Timeline anomalies.
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
            {/* 1. IP Address */}
            <div style={{ padding: '16px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '1rem' }}>🌐</span>
                    <label style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      1. New IP Address
                    </label>
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Known vs New IP check against baseline
                  </div>
                </div>
                <span className="badge badge-info" style={{ fontSize: '0.76rem', fontWeight: 700 }}>+{weights.new_ip ?? 8} pts</span>
              </div>
              <input
                id="weight-slider-new-ip"
                type="range"
                min={0}
                max={30}
                step={2}
                value={weights.new_ip ?? 8}
                onChange={e => handleWeightChange('new_ip', Number(e.target.value))}
                style={{ width: '100%', marginTop: '8px' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                <span>0 pts (Disabled)</span>
                <span>Default: 8 pts</span>
                <span>30 pts</span>
              </div>
            </div>

            {/* 2. Location */}
            <div style={{ padding: '16px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '1rem' }}>📍</span>
                    <label style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      2. New Location / Country
                    </label>
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Geographical deviation from baseline
                  </div>
                </div>
                <span className="badge badge-warning" style={{ fontSize: '0.76rem', fontWeight: 700 }}>+{weights.new_country ?? 20} pts</span>
              </div>
              <input
                id="weight-slider-new-country"
                type="range"
                min={0}
                max={50}
                step={5}
                value={weights.new_country ?? 20}
                onChange={e => handleWeightChange('new_country', Number(e.target.value))}
                style={{ width: '100%', marginTop: '8px' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                <span>0 pts</span>
                <span>Default: 20 pts</span>
                <span>50 pts</span>
              </div>
            </div>

            {/* 3. Login Window */}
            <div style={{ padding: '16px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '1rem' }}>⏰</span>
                    <label style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      3. Outside Login Window
                    </label>
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Odd hour / off-schedule timeline deviation
                  </div>
                </div>
                <span className="badge badge-warning" style={{ fontSize: '0.76rem', fontWeight: 700 }}>+{weights.odd_hour ?? 10} pts</span>
              </div>
              <input
                id="weight-slider-odd-hour"
                type="range"
                min={0}
                max={30}
                step={2}
                value={weights.odd_hour ?? 10}
                onChange={e => handleWeightChange('odd_hour', Number(e.target.value))}
                style={{ width: '100%', marginTop: '8px' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                <span>0 pts</span>
                <span>Default: 10 pts</span>
                <span>30 pts</span>
              </div>
            </div>

            {/* 4. VPN Detection */}
            <div style={{ padding: '16px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '1rem' }}>🛡️</span>
                    <label style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      4. VPN Detection
                    </label>
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Commercial VPN / proxy masking telemetry
                  </div>
                </div>
                <span className="badge badge-info" style={{ fontSize: '0.76rem', fontWeight: 700 }}>+{weights.vpn ?? 10} pts</span>
              </div>
              <input
                id="weight-slider-vpn"
                type="range"
                min={0}
                max={35}
                step={5}
                value={weights.vpn ?? 10}
                onChange={e => handleWeightChange('vpn', Number(e.target.value))}
                style={{ width: '100%', marginTop: '8px' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                <span>0 pts</span>
                <span>Default: 10 pts</span>
                <span>35 pts</span>
              </div>
            </div>
          </div>
        </div>

        {/* Extended Behavioral & Attack Signal Weights */}
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Corroborated Threat & Attack Signal Weights</h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px', marginBottom: 0 }}>
                High-confidence attack patterns (Impossible Travel, Tor Exit Nodes, Credential Stuffing, Blacklists)
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            {[
              { key: 'impossible_travel', label: 'Impossible Travel Velocity', def: 40, max: 60, desc: 'Distance > 800km/h between successive logins' },
              { key: 'brute_force_success', label: 'Success After Multiple Failures', def: 25, max: 50, desc: '5+ consecutive failures prior to success' },
              { key: 'tor', label: 'Tor Exit Node Anonymization', def: 20, max: 40, desc: 'Darknet onion router exit IP' },
              { key: 'blacklisted_ip', label: 'Threat Intel Malicious IP', def: 30, max: 50, desc: 'Reported on AbuseIPDB / Spamhaus blacklists' },
              { key: 'password_spraying', label: 'Password Spraying Pattern', def: 30, max: 50, desc: 'Single IP targeting multiple accounts' },
              { key: 'proxy', label: 'Open HTTP/SOCKS Proxy', def: 12, max: 30, desc: 'Anonymous intermediate proxy' },
              { key: 'new_device', label: 'Unrecognized Device Fingerprint', def: 15, max: 30, desc: 'New user agent / hardware canvas' },
              { key: 'new_city', label: 'New City (Domestic)', def: 8, max: 20, desc: 'Different city within known country' },
            ].map(item => (
              <div key={item.key} style={{ padding: '14px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {item.label}
                  </label>
                  <span className="badge badge-critical" style={{ fontSize: '0.75rem' }}>+{weights[item.key] ?? item.def} pts</span>
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  {item.desc}
                </div>
                <input
                  type="range"
                  min={0}
                  max={item.max}
                  step={item.max > 30 ? 5 : 2}
                  value={weights[item.key] ?? item.def}
                  onChange={e => handleWeightChange(item.key, Number(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* SOC Operations Ingestion Config */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Telemetry Ingestion & Automation</h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Polling and live stream timers</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="info-block">
              <div className="info-block-label">LIVE STREAM POLLING FREQUENCY</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px' }}>
                <select
                  className="select-field"
                  value={liveInterval}
                  onChange={e => setLiveInterval(Number(e.target.value))}
                >
                  <option value={3}>3 Seconds (High Speed)</option>
                  <option value={5}>5 Seconds (Standard SOC)</option>
                  <option value={10}>10 Seconds (Conservative)</option>
                  <option value={30}>30 Seconds</option>
                </select>
              </div>
            </div>

            <div className="info-block">
              <div className="info-block-label">THREAT INTELLIGENCE FEED STATUS</div>
              <div style={{ marginTop: '8px', fontSize: '0.86rem', color: 'var(--safe)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="pulsing-dot safe"></span>
                <span>Active (Tor Exit List, MaxMind GeoLite, AbuseIPDB Cache)</span>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
