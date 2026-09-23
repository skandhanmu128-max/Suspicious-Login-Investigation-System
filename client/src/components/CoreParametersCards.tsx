import React, { useState } from 'react';
import type { CoreLoginParameters, LoginEvent } from '../types';

interface Props {
  coreParameters?: CoreLoginParameters | null;
  baseline?: {
    knownCountries?: string[];
    knownCities?: string[];
    knownDevices?: string[];
    knownIps?: string[];
    typicalLoginStart?: number;
    typicalLoginEnd?: number;
    homeCity?: string;
    homeCountry?: string;
  } | null;
  currentEvent?: LoginEvent | null;
  showComparisonTable?: boolean;
}

export default function CoreParametersCards({
  coreParameters,
  baseline,
  currentEvent,
  showComparisonTable = true,
}: Props) {
  const [showTable, setShowTable] = useState(showComparisonTable);

  // Derive parameters if not explicitly provided
  const cp: CoreLoginParameters = coreParameters ?? (() => {
    const isNewIp = currentEvent?.is_new_device !== undefined
      ? (baseline?.knownIps?.length ? !baseline.knownIps.includes(currentEvent?.ip || '') : false)
      : false;

    const normalCountry = baseline?.homeCountry ?? baseline?.knownCountries?.[0] ?? 'India';
    const normalCity = baseline?.homeCity ?? baseline?.knownCities?.[0] ?? 'Bengaluru';
    const currentCountry = currentEvent?.country ?? '—';
    const currentCity = currentEvent?.city ?? '—';
    const isUnusualLoc = currentEvent?.is_new_country || currentEvent?.is_new_city ||
      (currentCountry !== normalCountry || currentCity !== normalCity);

    const startH = baseline?.typicalLoginStart ?? 8;
    const endH = baseline?.typicalLoginEnd ?? 22;
    const dateObj = currentEvent?.timestamp ? new Date(currentEvent.timestamp) : new Date();
    const curHour = dateObj.getHours();
    const curMin = dateObj.getMinutes().toString().padStart(2, '0');
    const isOutside = curHour < startH || curHour >= endH;

    const vpnStatus = currentEvent?.vpn_detected
      ? (currentEvent.vpn_detected === 'detected' ? 'DETECTED' : 'NOT DETECTED')
      : (currentEvent?.is_vpn ? 'DETECTED' : 'NOT DETECTED');

    return {
      ip: {
        current: currentEvent?.ip ?? '—',
        status: isNewIp ? 'NEW' : 'KNOWN',
        previousKnownIp: baseline?.knownIps?.[0] ?? '103.21.45.10',
        reputation: currentEvent?.ip_reputation ?? 'clean',
        isp: currentEvent?.isp ?? 'Unknown ISP',
        evidence: isNewIp
          ? `Current IP ${currentEvent?.ip} has not been observed in previous baseline logins.`
          : `Current IP matches user's known address.`,
      },
      location: {
        current: {
          city: currentCity,
          country: currentCountry,
          lat: currentEvent?.lat,
          lng: currentEvent?.lng,
        },
        normal: {
          city: normalCity,
          country: normalCountry,
        },
        status: isUnusualLoc ? 'UNUSUAL' : 'NORMAL',
        evidence: isUnusualLoc
          ? `Login from ${currentCity}, ${currentCountry} is outside known profile (${normalCity}, ${normalCountry}).`
          : `Login location matches user baseline.`,
      },
      loginWindow: {
        currentTime: `${curHour.toString().padStart(2, '0')}:${curMin}`,
        normalWindow: `${startH.toString().padStart(2, '0')}:00 – ${endH.toString().padStart(2, '0')}:00`,
        status: isOutside ? 'OUTSIDE NORMAL WINDOW' : 'NORMAL',
        timeDelta: isOutside ? 'Outside business hours' : 'Within normal hours',
        evidence: isOutside
          ? `Login at ${curHour.toString().padStart(2, '0')}:${curMin} is outside typical window (${startH}:00 – ${endH}:00).`
          : `Login occurred within typical window.`,
      },
      vpn: {
        status: vpnStatus as any,
        provider: currentEvent?.isp?.toLowerCase().includes('vpn') ? currentEvent.isp : (vpnStatus === 'DETECTED' ? 'Commercial VPN Relay' : undefined),
        isTor: currentEvent?.is_tor ?? false,
        isProxy: currentEvent?.is_proxy ?? false,
        evidence: vpnStatus === 'DETECTED'
          ? `VPN tunnel active. Treated as an investigation signal, not automatic compromise.`
          : `No VPN, Tor, or Proxy relay detected.`,
      },
    };
  })();

  const ipIsNew = cp.ip.status === 'NEW';
  const locIsUnusual = cp.location.status === 'UNUSUAL';
  const timeIsOutside = cp.loginWindow.status === 'OUTSIDE NORMAL WINDOW';
  const vpnIsDetected = cp.vpn.status === 'DETECTED';

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      {/* Section Header with Toggle */}
      <div className="flex items-center justify-between mb-3" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
        <div className="flex items-center gap-2">
          <span style={{ fontSize: '1rem' }}>🎯</span>
          <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-primary)' }}>
            Four Core Login Investigation Parameters
          </h4>
        </div>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setShowTable(!showTable)}
          style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem' }}
        >
          {showTable ? 'Hide Comparison Table' : 'Show Baseline Comparison'}
        </button>
      </div>

      {/* 4 Core Parameter Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1rem',
          marginBottom: '1rem',
        }}
      >
        {/* 1. IP ADDRESS */}
        <div
          className="card"
          style={{
            padding: '1rem',
            background: ipIsNew ? 'rgba(239, 68, 68, 0.05)' : 'rgba(16, 185, 129, 0.05)',
            border: `1px solid ${ipIsNew ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.25)'}`,
            borderRadius: '12px',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
              1. IP Address
            </span>
            <span
              className={`tag ${ipIsNew ? 'tag-critical' : 'tag-safe'}`}
              style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '6px' }}
            >
              {ipIsNew ? '⚠️ NEW IP' : '✓ KNOWN IP'}
            </span>
          </div>

          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
            {cp.ip.current}
          </div>

          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Prev Known: </span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{cp.ip.previousKnownIp || 'None recorded'}</span>
            </div>
            {cp.ip.isp && (
              <div>
                <span style={{ color: 'var(--text-muted)' }}>ISP/Org: </span>
                <span>{cp.ip.isp}</span>
              </div>
            )}
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Reputation: </span>
              <span style={{ textTransform: 'uppercase', fontWeight: 600, color: cp.ip.reputation === 'clean' ? 'var(--safe)' : 'var(--critical)' }}>
                {cp.ip.reputation}
              </span>
            </div>
          </div>

          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.4, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.4rem' }}>
            {cp.ip.evidence}
          </div>
        </div>

        {/* 2. LOCATION */}
        <div
          className="card"
          style={{
            padding: '1rem',
            background: locIsUnusual ? 'rgba(239, 68, 68, 0.05)' : 'rgba(16, 185, 129, 0.05)',
            border: `1px solid ${locIsUnusual ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.25)'}`,
            borderRadius: '12px',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
              2. Location
            </span>
            <span
              className={`tag ${locIsUnusual ? 'tag-critical' : 'tag-safe'}`}
              style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '6px' }}
            >
              {locIsUnusual ? '⚠️ UNUSUAL LOCATION' : '✓ NORMAL LOCATION'}
            </span>
          </div>

          <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
            📍 {cp.location.current.city}, {cp.location.current.country}
          </div>

          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Normal Base: </span>
              <span>{cp.location.normal.city}, {cp.location.normal.country}</span>
            </div>
            {cp.location.current.lat && cp.location.current.lng && (
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Coords: </span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                  {cp.location.current.lat.toFixed(2)}°, {cp.location.current.lng.toFixed(2)}°
                </span>
              </div>
            )}
          </div>

          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.4, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.4rem' }}>
            {cp.location.evidence}
          </div>
        </div>

        {/* 3. LOGIN WINDOW / TIMELINE */}
        <div
          className="card"
          style={{
            padding: '1rem',
            background: timeIsOutside ? 'rgba(245, 158, 11, 0.05)' : 'rgba(16, 185, 129, 0.05)',
            border: `1px solid ${timeIsOutside ? 'rgba(245, 158, 11, 0.3)' : 'rgba(16, 185, 129, 0.25)'}`,
            borderRadius: '12px',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
              3. Login Window
            </span>
            <span
              className={`tag ${timeIsOutside ? 'tag-suspicious' : 'tag-safe'}`}
              style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '6px' }}
            >
              {timeIsOutside ? '⏰ OUTSIDE WINDOW' : '✓ NORMAL WINDOW'}
            </span>
          </div>

          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
            ⏱ {cp.loginWindow.currentTime} <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-muted)' }}>local</span>
          </div>

          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Normal Hours: </span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--safe)' }}>{cp.loginWindow.normalWindow}</span>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Delta: </span>
              <span>{cp.loginWindow.timeDelta}</span>
            </div>
          </div>

          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.4, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.4rem' }}>
            {cp.loginWindow.evidence}
          </div>
        </div>

        {/* 4. VPN DETECTION */}
        <div
          className="card"
          style={{
            padding: '1rem',
            background: vpnIsDetected ? 'rgba(139, 92, 246, 0.08)' : 'rgba(16, 185, 129, 0.05)',
            border: `1px solid ${vpnIsDetected ? 'rgba(139, 92, 246, 0.35)' : 'rgba(16, 185, 129, 0.25)'}`,
            borderRadius: '12px',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
              4. VPN Detection
            </span>
            <span
              className="tag"
              style={{
                fontSize: '0.65rem',
                fontWeight: 700,
                padding: '0.15rem 0.5rem',
                borderRadius: '6px',
                background: vpnIsDetected ? 'rgba(139, 92, 246, 0.2)' : 'var(--safe-bg)',
                color: vpnIsDetected ? '#C4B5FD' : 'var(--safe)',
                borderColor: vpnIsDetected ? 'rgba(139, 92, 246, 0.4)' : 'var(--safe-border)',
              }}
            >
              {vpnIsDetected ? '🛡 VPN DETECTED' : '✓ NOT DETECTED'}
            </span>
          </div>

          <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
            {vpnIsDetected ? (cp.vpn.provider || 'Commercial Relay') : 'Direct Connection'}
          </div>

          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Anonymizer Flags: </span>
              <span>{cp.vpn.isTor ? 'Tor Exit Node' : cp.vpn.isProxy ? 'Open Proxy' : (vpnIsDetected ? 'VPN Obfuscation' : 'None')}</span>
            </div>
            <div style={{ fontStyle: 'italic', color: '#A78BFA', fontSize: '0.7rem' }}>
              * Investigation signal, not automatic compromise
            </div>
          </div>

          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.4, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.4rem' }}>
            {cp.vpn.evidence}
          </div>
        </div>
      </div>

      {/* Baseline vs Current Login Comparison Table */}
      {showTable && (
        <div
          className="card"
          style={{
            padding: '1.25rem',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '12px',
          }}
        >
          <div style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>
            📊 Baseline vs Current Login Telemetry Comparison
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', fontSize: '0.8rem' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '0.5rem' }}>Parameter</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem' }}>User Baseline</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem' }}>Current Authentication</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem' }}>Investigation Verdict</th>
                </tr>
              </thead>
              <tbody>
                {/* 1. IP Address */}
                <tr>
                  <td style={{ fontWeight: 600, padding: '0.6rem 0.5rem' }}>1. IP Address</td>
                  <td style={{ fontFamily: 'JetBrains Mono, monospace', padding: '0.6rem 0.5rem' }}>
                    {cp.ip.previousKnownIp || '103.21.45.10'}
                  </td>
                  <td style={{ fontFamily: 'JetBrains Mono, monospace', padding: '0.6rem 0.5rem' }}>
                    {cp.ip.current}
                  </td>
                  <td style={{ padding: '0.6rem 0.5rem' }}>
                    <span className={`tag ${ipIsNew ? 'tag-critical' : 'tag-safe'}`} style={{ fontSize: '0.68rem' }}>
                      {ipIsNew ? 'NEW IP (+8 pts)' : 'KNOWN IP (Clean)'}
                    </span>
                  </td>
                </tr>

                {/* 2. Location */}
                <tr>
                  <td style={{ fontWeight: 600, padding: '0.6rem 0.5rem' }}>2. Location</td>
                  <td style={{ padding: '0.6rem 0.5rem' }}>
                    {cp.location.normal.city}, {cp.location.normal.country}
                  </td>
                  <td style={{ padding: '0.6rem 0.5rem' }}>
                    {cp.location.current.city}, {cp.location.current.country}
                  </td>
                  <td style={{ padding: '0.6rem 0.5rem' }}>
                    <span className={`tag ${locIsUnusual ? 'tag-critical' : 'tag-safe'}`} style={{ fontSize: '0.68rem' }}>
                      {locIsUnusual ? 'UNUSUAL LOCATION (+20 pts)' : 'NORMAL LOCATION (Match)'}
                    </span>
                  </td>
                </tr>

                {/* 3. Login Window */}
                <tr>
                  <td style={{ fontWeight: 600, padding: '0.6rem 0.5rem' }}>3. Login Window / Timeline</td>
                  <td style={{ fontFamily: 'JetBrains Mono, monospace', padding: '0.6rem 0.5rem' }}>
                    {cp.loginWindow.normalWindow}
                  </td>
                  <td style={{ fontFamily: 'JetBrains Mono, monospace', padding: '0.6rem 0.5rem' }}>
                    {cp.loginWindow.currentTime} local
                  </td>
                  <td style={{ padding: '0.6rem 0.5rem' }}>
                    <span className={`tag ${timeIsOutside ? 'tag-suspicious' : 'tag-safe'}`} style={{ fontSize: '0.68rem' }}>
                      {timeIsOutside ? 'OUTSIDE NORMAL WINDOW (+10 pts)' : 'WITHIN NORMAL WINDOW (Clean)'}
                    </span>
                  </td>
                </tr>

                {/* 4. VPN Detection */}
                <tr>
                  <td style={{ fontWeight: 600, padding: '0.6rem 0.5rem' }}>4. VPN Detection</td>
                  <td style={{ padding: '0.6rem 0.5rem' }}>
                    NOT DETECTED (Direct ISP)
                  </td>
                  <td style={{ padding: '0.6rem 0.5rem' }}>
                    {vpnIsDetected ? `DETECTED (${cp.vpn.provider || 'Commercial Relay'})` : 'NOT DETECTED'}
                  </td>
                  <td style={{ padding: '0.6rem 0.5rem' }}>
                    <span
                      className="tag"
                      style={{
                        fontSize: '0.68rem',
                        background: vpnIsDetected ? 'rgba(139, 92, 246, 0.15)' : 'var(--safe-bg)',
                        color: vpnIsDetected ? '#C4B5FD' : 'var(--safe)',
                        borderColor: vpnIsDetected ? 'rgba(139, 92, 246, 0.35)' : 'var(--safe-border)',
                      }}
                    >
                      {vpnIsDetected ? 'VPN DETECTED (+10 pts signal)' : 'NO VPN (Clean)'}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
