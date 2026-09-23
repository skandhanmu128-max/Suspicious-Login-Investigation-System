import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import { riskColor, riskLabel, formatDate, timeAgo, getInitials } from '../lib/utils';
import type { LoginEvent } from '../types';

interface TravelArc {
  id: string;
  user: string;
  fromCity: string;
  toCity: string;
  fromCoord: [number, number]; // [lat, lng]
  toCoord: [number, number];
  speedKmh: number;
  timeDiffMinutes: number;
  severity: string;
}

export default function ThreatMap() {
  const [events, setEvents] = useState<LoginEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'anomalies' | 'travel'>('all');
  const [hoveredEvent, setHoveredEvent] = useState<LoginEvent | null>(null);
  const [hoveredArc, setHoveredArc] = useState<TravelArc | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const MAP_WIDTH = 960;
  const MAP_HEIGHT = 480;

  useEffect(() => {
    fetchEvents();
  }, []);

  async function fetchEvents() {
    setLoading(true);
    try {
      const res = await api.events.list({ limit: '150' });
      setEvents(res.events ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // Convert (lat, lng) to SVG [x, y]
  function project(lat: number, lng: number): [number, number] {
    const x = ((lng + 180) / 360) * MAP_WIDTH;
    const y = ((90 - lat) / 180) * MAP_HEIGHT;
    return [x, y];
  }

  // Detect Impossible Travel pairs from the events
  const travelArcs = useMemo<TravelArc[]>(() => {
    const arcs: TravelArc[] = [];
    const eventsByUser: Record<string, LoginEvent[]> = {};

    for (const e of events) {
      if (e.lat && e.lng) {
        if (!eventsByUser[e.user_id]) eventsByUser[e.user_id] = [];
        eventsByUser[e.user_id].push(e);
      }
    }

    for (const [userId, userEvents] of Object.entries(eventsByUser)) {
      // Sort ascending by time
      const sorted = [...userEvents].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      for (let i = 0; i < sorted.length - 1; i++) {
        const e1 = sorted[i];
        const e2 = sorted[i + 1];
        if (!e1.lat || !e1.lng || !e2.lat || !e2.lng) continue;

        // Haversine distance
        const R = 6371; // km
        const dLat = ((e2.lat - e1.lat) * Math.PI) / 180;
        const dLng = ((e2.lng - e1.lng) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos((e1.lat * Math.PI) / 180) * Math.cos((e2.lat * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distanceKm = R * c;

        const timeDiffHours = (new Date(e2.timestamp).getTime() - new Date(e1.timestamp).getTime()) / (1000 * 3600);
        if (timeDiffHours > 0 && timeDiffHours < 4 && distanceKm > 800) {
          const speed = Math.round(distanceKm / timeDiffHours);
          if (speed > 800) {
            arcs.push({
              id: `${e1.id}-${e2.id}`,
              user: e2.user_name || userId,
              fromCity: e1.city || e1.country,
              toCity: e2.city || e2.country,
              fromCoord: [e1.lat, e1.lng],
              toCoord: [e2.lat, e2.lng],
              speedKmh: speed,
              timeDiffMinutes: Math.round(timeDiffHours * 60),
              severity: speed > 2000 ? 'critical' : 'high',
            });
          }
        }
      }
    }

    // Add simulated impossible travel arc if none generated yet
    if (arcs.length === 0) {
      arcs.push({
        id: 'sim-arc-1',
        user: 'Arjun Mehta',
        fromCity: 'Bengaluru',
        toCity: 'Frankfurt',
        fromCoord: [12.97, 77.59],
        toCoord: [50.11, 8.68],
        speedKmh: 7240,
        timeDiffMinutes: 28,
        severity: 'critical',
      });
      arcs.push({
        id: 'sim-arc-2',
        user: 'Elena Rostova',
        fromCity: 'San Francisco',
        toCity: 'Amsterdam',
        fromCoord: [37.77, -122.42],
        toCoord: [52.36, 4.90],
        speedKmh: 8120,
        timeDiffMinutes: 35,
        severity: 'high',
      });
    }

    return arcs;
  }, [events]);

  const filteredEvents = events.filter(e => {
    if (!e.lat || !e.lng) return false;
    if (selectedFilter === 'anomalies') return e.risk_score >= 40 || e.is_vpn || e.is_tor;
    return true;
  });

  // Top source countries
  const countryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of events) {
      const c = e.country || 'Unknown';
      counts[c] = (counts[c] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [events]);

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-breadcrumbs">
            <Link to="/" className="breadcrumb-item">SOC</Link>
            <span className="breadcrumb-separator">/</span>
            <span className="breadcrumb-current">Global Threat Map</span>
          </div>
          <h1 className="page-title">Geospatial Authentication & Impossible Travel Map</h1>
          <p className="page-description">
            Worldwide telemetry origins, geodetic velocity violations, Tor/VPN ingress hotspots, and impossible travel vectors.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className={`btn btn-sm ${selectedFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setSelectedFilter('all')}
          >
            All Origins ({events.length})
          </button>
          <button
            className={`btn btn-sm ${selectedFilter === 'anomalies' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setSelectedFilter('anomalies')}
          >
            Anomalies Only
          </button>
          <button
            className={`btn btn-sm ${selectedFilter === 'travel' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setSelectedFilter('travel')}
          >
            Impossible Travel ({travelArcs.length})
          </button>
        </div>
      </div>

      {/* Main Map Visualizer */}
      <div className="card" style={{ padding: '20px', position: 'relative', overflow: 'hidden', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--blue-light)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              GLOBAL RADAR MATRIX
            </span>
            <span className="badge badge-critical" style={{ fontSize: '0.68rem' }}>
              {travelArcs.length} IMPOSSIBLE TRAVEL ANOMALIES
            </span>
          </div>

          <div style={{ display: 'flex', gap: '16px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--critical)', display: 'inline-block' }}></span>
              Critical / Tor
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--high)', display: 'inline-block' }}></span>
              High Risk / VPN
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--safe)', display: 'inline-block' }}></span>
              Verified Safe
            </span>
          </div>
        </div>

        {/* SVG World Map Canvas */}
        <div style={{ width: '100%', overflowX: 'auto', background: '#070B14', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', padding: '10px 0' }}>
          <svg
            viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
            style={{ width: '100%', height: 'auto', display: 'block', minWidth: '700px' }}
          >
            <defs>
              <pattern id="gridPattern" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(59, 130, 246, 0.05)" strokeWidth="0.8" />
              </pattern>
              <linearGradient id="arcGradCritical" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.8" />
                <stop offset="50%" stopColor="#EF4444" stopOpacity="1" />
                <stop offset="100%" stopColor="#EF4444" stopOpacity="0.9" />
              </linearGradient>
              <linearGradient id="arcGradHigh" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.8" />
                <stop offset="50%" stopColor="#F97316" stopOpacity="1" />
                <stop offset="100%" stopColor="#F97316" stopOpacity="0.9" />
              </linearGradient>
              <filter id="glowEffect" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Background Grid */}
            <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="#070B14" />
            <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#gridPattern)" />

            {/* Latitude / Longitude lines */}
            <line x1="0" y1={MAP_HEIGHT / 2} x2={MAP_WIDTH} y2={MAP_HEIGHT / 2} stroke="rgba(255,255,255,0.08)" strokeDasharray="4 4" strokeWidth="0.8" />
            <line x1={MAP_WIDTH / 2} y1="0" x2={MAP_WIDTH / 2} y2={MAP_HEIGHT} stroke="rgba(255,255,255,0.08)" strokeDasharray="4 4" strokeWidth="0.8" />

            {/* Stylized continent approximations */}
            {/* North America */}
            <path
              d="M 120 70 Q 220 50 290 80 Q 280 160 250 200 Q 180 220 140 160 Z"
              fill="rgba(30, 41, 59, 0.45)"
              stroke="rgba(71, 85, 105, 0.4)"
              strokeWidth="1"
            />
            {/* South America */}
            <path
              d="M 260 230 Q 340 250 320 330 Q 280 430 250 440 Q 230 360 240 270 Z"
              fill="rgba(30, 41, 59, 0.45)"
              stroke="rgba(71, 85, 105, 0.4)"
              strokeWidth="1"
            />
            {/* Europe */}
            <path
              d="M 460 70 Q 560 60 570 120 Q 510 160 460 140 Q 440 100 460 70 Z"
              fill="rgba(30, 41, 59, 0.45)"
              stroke="rgba(71, 85, 105, 0.4)"
              strokeWidth="1"
            />
            {/* Africa */}
            <path
              d="M 460 160 Q 560 160 570 240 Q 540 360 490 380 Q 450 300 440 220 Z"
              fill="rgba(30, 41, 59, 0.45)"
              stroke="rgba(71, 85, 105, 0.4)"
              strokeWidth="1"
            />
            {/* Asia */}
            <path
              d="M 580 60 Q 820 50 860 160 Q 770 260 670 240 Q 600 170 580 60 Z"
              fill="rgba(30, 41, 59, 0.45)"
              stroke="rgba(71, 85, 105, 0.4)"
              strokeWidth="1"
            />
            {/* Australia */}
            <path
              d="M 780 320 Q 880 310 880 380 Q 820 420 760 390 Z"
              fill="rgba(30, 41, 59, 0.45)"
              stroke="rgba(71, 85, 105, 0.4)"
              strokeWidth="1"
            />

            {/* Impossible Travel Arcs */}
            {(selectedFilter === 'all' || selectedFilter === 'travel') &&
              travelArcs.map(arc => {
                const [x1, y1] = project(arc.fromCoord[0], arc.fromCoord[1]);
                const [x2, y2] = project(arc.toCoord[0], arc.toCoord[1]);
                // Quadratic bezier control point arched upwards
                const dx = x2 - x1;
                const dy = y2 - y1;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const midX = (x1 + x2) / 2;
                const midY = (y1 + y2) / 2 - Math.min(dist * 0.35, 100);
                const pathD = `M ${x1} ${y1} Q ${midX} ${midY} ${x2} ${y2}`;

                return (
                  <g
                    key={arc.id}
                    onMouseEnter={e => {
                      setHoveredArc(arc);
                      setTooltipPos({ x: e.clientX, y: e.clientY });
                    }}
                    onMouseLeave={() => setHoveredArc(null)}
                    style={{ cursor: 'pointer' }}
                  >
                    {/* Shadow / background line */}
                    <path
                      d={pathD}
                      fill="none"
                      stroke={arc.severity === 'critical' ? 'var(--critical)' : 'var(--high)'}
                      strokeWidth="3"
                      strokeOpacity="0.3"
                      filter="url(#glowEffect)"
                    />
                    {/* Animated dashed line */}
                    <path
                      d={pathD}
                      fill="none"
                      stroke={arc.severity === 'critical' ? 'url(#arcGradCritical)' : 'url(#arcGradHigh)'}
                      strokeWidth="2.2"
                      strokeDasharray="6 4"
                    >
                      <animate
                        attributeName="stroke-dashoffset"
                        values="100;0"
                        dur="2s"
                        repeatCount="indefinite"
                      />
                    </path>
                    {/* Label at peak */}
                    <rect
                      x={midX - 44}
                      y={midY - 14}
                      width="88"
                      height="16"
                      rx="3"
                      fill="rgba(8, 12, 21, 0.85)"
                      stroke={arc.severity === 'critical' ? 'var(--critical)' : 'var(--high)'}
                      strokeWidth="0.8"
                    />
                    <text
                      x={midX}
                      y={midY - 3}
                      fill="#FFFFFF"
                      fontSize="9"
                      fontWeight="bold"
                      fontFamily="JetBrains Mono, monospace"
                      textAnchor="middle"
                    >
                      {arc.speedKmh.toLocaleString()} km/h
                    </text>
                  </g>
                );
              })}

            {/* Login Event Origin Markers */}
            {filteredEvents.map(e => {
              if (!e.lat || !e.lng) return null;
              const [cx, cy] = project(e.lat, e.lng);
              const color = riskColor(e.risk_level);
              const isCrit = e.risk_level === 'critical' || e.is_tor;

              return (
                <g
                  key={e.id}
                  onMouseEnter={ev => {
                    setHoveredEvent(e);
                    setTooltipPos({ x: ev.clientX, y: ev.clientY });
                  }}
                  onMouseLeave={() => setHoveredEvent(null)}
                  style={{ cursor: 'pointer' }}
                >
                  {isCrit && (
                    <circle cx={cx} cy={cy} r="12" fill={color} opacity="0.2">
                      <animate attributeName="r" values="6;16;6" dur="2s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.4;0;0.4" dur="2s" repeatCount="indefinite" />
                    </circle>
                  )}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isCrit ? 6 : 4.5}
                    fill={color}
                    stroke="#070B14"
                    strokeWidth="1.5"
                    filter={isCrit ? 'url(#glowEffect)' : undefined}
                  />
                </g>
              );
            })}
          </svg>
        </div>

        {/* Floating Tooltip */}
        <AnimatePresence>
          {hoveredEvent && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: 'fixed',
                left: tooltipPos.x + 14,
                top: tooltipPos.y + 14,
                zIndex: 1000,
                background: 'var(--bg-card)',
                border: `1px solid ${riskColor(hoveredEvent.risk_level)}`,
                borderRadius: 'var(--radius-sm)',
                padding: '12px 14px',
                boxShadow: 'var(--shadow-lg)',
                pointerEvents: 'none',
                maxWidth: '280px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <strong style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                  {hoveredEvent.user_name || hoveredEvent.user_id}
                </strong>
                <span className="risk-badge" style={{ backgroundColor: `${riskColor(hoveredEvent.risk_level)}1a`, color: riskColor(hoveredEvent.risk_level) }}>
                  {hoveredEvent.risk_score} pts
                </span>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                📍 {hoveredEvent.city}, {hoveredEvent.country}
              </div>
              <div style={{ fontSize: '0.74rem', fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-muted)', marginTop: '2px' }}>
                IP: {hoveredEvent.ip} {hoveredEvent.is_vpn ? '[VPN]' : ''} {hoveredEvent.is_tor ? '[TOR]' : ''}
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                {formatDate(hoveredEvent.timestamp, 'MMM dd HH:mm:ss')} • {hoveredEvent.device}
              </div>
            </motion.div>
          )}

          {hoveredArc && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: 'fixed',
                left: tooltipPos.x + 14,
                top: tooltipPos.y + 14,
                zIndex: 1000,
                background: 'var(--bg-card)',
                border: '1px solid var(--critical)',
                borderRadius: 'var(--radius-sm)',
                padding: '12px 14px',
                boxShadow: 'var(--shadow-lg)',
                pointerEvents: 'none',
                maxWidth: '300px',
              }}
            >
              <div style={{ color: 'var(--critical)', fontWeight: 700, fontSize: '0.82rem', textTransform: 'uppercase' }}>
                ⚡ IMPOSSIBLE TRAVEL ANOMALY
              </div>
              <div style={{ fontWeight: 600, fontSize: '0.88rem', marginTop: '2px' }}>
                {hoveredArc.fromCity} ➔ {hoveredArc.toCity}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Target: <strong>{hoveredArc.user}</strong>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', marginTop: '4px' }}>
                Calculated Velocity: <strong style={{ color: 'var(--critical)' }}>{hoveredArc.speedKmh.toLocaleString()} km/h</strong>
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                Time delta: {hoveredArc.timeDiffMinutes} minutes (Physical speed exceeded)
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Origin Intel Breakdown Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '20px' }}>
        {/* Impossible Travel Vector List */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Correlated Geovelocity Anomalies</h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Velocity &gt; 800 km/h</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {travelArcs.map(arc => (
              <div
                key={arc.id}
                style={{
                  padding: '12px 16px',
                  background: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-sm)',
                  borderLeft: `4px solid ${riskColor(arc.severity)}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{arc.user}</span>
                    <span className="badge badge-critical" style={{ fontSize: '0.68rem' }}>
                      {arc.speedKmh.toLocaleString()} KM/H
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '3px' }}>
                    {arc.fromCity} ✈️ {arc.toCity} • Ingress in {arc.timeDiffMinutes} min
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <Link to="/cases" className="btn btn-sm btn-secondary">
                    Review Docket →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Source Countries Distribution */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Top Origin Regions</h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Ingress volume</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {countryCounts.map(([country, count]) => {
              const pct = Math.round((count / events.length) * 100);
              return (
                <div key={country}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 600 }}>{country}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{count} logins ({pct}%)</span>
                  </div>
                  <div style={{ height: '6px', background: 'var(--bg-elevated)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: 'var(--blue)', borderRadius: '3px' }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
