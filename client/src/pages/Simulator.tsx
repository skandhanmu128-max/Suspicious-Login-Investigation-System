import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import { riskColor, riskLabel, formatDate, getInitials } from '../lib/utils';
import type { User } from '../types';

interface ScenarioMeta {
  name: string;
  description: string;
  severity: string;
  mitre: string;
  icon: string;
  steps: number;
}

export default function Simulator() {
  const [scenarios, setScenarios] = useState<Record<string, ScenarioMeta>>({});
  const [selectedScenarioKey, setSelectedScenarioKey] = useState<string>('impossible_travel');
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [simulating, setSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState<any>(null);
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);
  const [isPlayingReplay, setIsPlayingReplay] = useState<boolean>(false);
  const [resetting, setResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [scenRes, userRes] = await Promise.all([
        api.simulator.scenarios(),
        api.users.list(),
      ]);
      setScenarios(scenRes.scenarios || {});
      setUsers(userRes.users || []);
    } catch (err) {
      console.error('Failed to load simulator info:', err);
    }
  }

  async function handleRunSimulation() {
    setSimulating(true);
    setSimulationResult(null);
    setActiveStepIndex(0);
    try {
      const res = await api.simulator.run(selectedScenarioKey, selectedUserId || undefined);
      setSimulationResult(res);
      setIsPlayingReplay(true);
    } catch (err: any) {
      alert(`Simulation failed: ${err.message}`);
    } finally {
      setSimulating(false);
    }
  }

  // Auto step replay player
  useEffect(() => {
    if (!isPlayingReplay || !simulationResult?.events?.length) return;
    const events = simulationResult.events;
    if (activeStepIndex >= events.length - 1) {
      setIsPlayingReplay(false);
      return;
    }
    const timer = setTimeout(() => {
      setActiveStepIndex(prev => prev + 1);
    }, 1800);
    return () => clearTimeout(timer);
  }, [isPlayingReplay, activeStepIndex, simulationResult]);

  async function handleResetData() {
    if (!confirm('Are you sure you want to reset all telemetry, alerts, and cases back to clean demo seed data?')) return;
    setResetting(true);
    try {
      await api.simulator.reset();
      setResetSuccess(true);
      setSimulationResult(null);
      setTimeout(() => setResetSuccess(false), 4000);
      loadData();
    } catch (err: any) {
      alert(`Reset failed: ${err.message}`);
    } finally {
      setResetting(false);
    }
  }

  const currentScenario = scenarios[selectedScenarioKey];

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-breadcrumbs">
            <Link to="/" className="breadcrumb-item">SOC</Link>
            <span className="breadcrumb-separator">/</span>
            <span className="breadcrumb-current">Adversary Simulator</span>
          </div>
          <h1 className="page-title">Threat Scenario & Attack Replay Studio</h1>
          <p className="page-description">
            Inject synthetic multi-stage identity attacks to test correlation engine, alerting pipelines, and SOC response workflows.
          </p>
        </div>

        <button
          id="reset-demo-btn"
          className="btn btn-secondary"
          onClick={handleResetData}
          disabled={resetting}
          style={{ borderColor: 'var(--border-strong)' }}
        >
          {resetting ? 'Resetting Data...' : '⟲ Reset Demo DB'}
        </button>
      </div>

      {resetSuccess && (
        <div style={{ padding: '12px 16px', background: 'var(--safe-bg)', border: '1px solid var(--safe-border)', color: 'var(--safe)', borderRadius: 'var(--radius-md)', marginBottom: '20px' }}>
          ✓ Database successfully restored to clean baseline state.
        </div>
      )}

      {/* Scenario Gallery Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '14px', marginBottom: '24px' }}>
        {Object.entries(scenarios).map(([key, s]) => {
          const isSelected = selectedScenarioKey === key;
          const sevColor = riskColor(s.severity);
          return (
            <div
              key={key}
              onClick={() => {
                setSelectedScenarioKey(key);
                setSimulationResult(null);
              }}
              className="card hover-card"
              style={{
                cursor: 'pointer',
                borderColor: isSelected ? 'var(--blue)' : undefined,
                background: isSelected ? 'rgba(59, 130, 246, 0.08)' : undefined,
                boxShadow: isSelected ? 'var(--shadow-glow-blue)' : undefined,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '16px'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <span style={{ fontSize: '1.6rem' }}>{s.icon || '⚡'}</span>
                  <span
                    className="risk-badge"
                    style={{
                      backgroundColor: `${sevColor}1a`,
                      color: sevColor,
                      border: `1px solid ${sevColor}40`,
                      fontSize: '0.68rem',
                      textTransform: 'uppercase'
                    }}
                  >
                    {s.severity}
                  </span>
                </div>
                <div style={{ fontWeight: 700, fontSize: '0.94rem', color: 'var(--text-primary)', marginBottom: '4px' }}>
                  {s.name}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  {s.description}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '8px', borderTop: '1px solid var(--border-subtle)', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{s.mitre}</span>
                <span>{s.steps} Telemetry Steps</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Execution Studio */}
      <div className="card" style={{ padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '16px', marginBottom: '20px' }}>
          <div>
            <div style={{ fontSize: '0.76rem', color: 'var(--blue-light)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              TARGET EXECUTION CONFIGURATION
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: '4px 0 0 0' }}>
              {currentScenario?.name || 'Selected Attack Scenario'}
            </h3>
            <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              MITRE ATT&CK: <strong>{currentScenario?.mitre}</strong> • Expected Outcome: Alert & Automated Case Creation
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Target Identity</label>
              <select
                id="simulator-user-select"
                className="select-field"
                value={selectedUserId}
                onChange={e => setSelectedUserId(e.target.value)}
                style={{ minWidth: '220px' }}
              >
                <option value="">Default Scenario Target</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.department})</option>
                ))}
              </select>
            </div>

            <div style={{ alignSelf: 'flex-end' }}>
              <button
                id="run-simulation-btn"
                className="btn btn-primary"
                onClick={handleRunSimulation}
                disabled={simulating}
                style={{ padding: '10px 22px', fontSize: '0.92rem' }}
              >
                {simulating ? 'Synthesizing Attack...' : '▶ Launch Attack Simulation'}
              </button>
            </div>
          </div>
        </div>

        {/* Live Attack Player / Feed */}
        {simulationResult ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <span className="badge badge-critical" style={{ marginRight: '8px' }}>SIMULATION ACTIVE</span>
                <span style={{ fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
                  Replaying {simulationResult.events?.length || 0} sequence events
                </span>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={() => setIsPlayingReplay(!isPlayingReplay)}
                >
                  {isPlayingReplay ? '❚❚ Pause Replay' : '▶ Play Replay'}
                </button>
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={() => setActiveStepIndex(0)}
                >
                  ⏮ Restart
                </button>
              </div>
            </div>

            {/* Stepper progress */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '20px' }}>
              {(simulationResult.events || []).map((ev: any, idx: number) => {
                const isCurrent = idx === activeStepIndex;
                const isPast = idx < activeStepIndex;
                const scoreColor = riskColor(ev.riskLevel || 'safe');
                return (
                  <div
                    key={idx}
                    onClick={() => setActiveStepIndex(idx)}
                    style={{
                      flex: 1,
                      height: '8px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      background: isCurrent ? scoreColor : isPast ? 'var(--blue)' : 'var(--border-strong)',
                      boxShadow: isCurrent ? `0 0 10px ${scoreColor}` : undefined,
                      transition: 'all 0.2s ease'
                    }}
                  />
                );
              })}
            </div>

            {/* Current Active Event Snapshot */}
            {simulationResult.events && simulationResult.events[activeStepIndex] && (
              <motion.div
                key={activeStepIndex}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  background: 'var(--bg-elevated)',
                  border: `1px solid ${riskColor(simulationResult.events[activeStepIndex].riskLevel)}60`,
                  borderRadius: 'var(--radius-md)',
                  padding: '20px',
                  marginBottom: '20px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                      STEP {activeStepIndex + 1} OF {simulationResult.events.length} • {simulationResult.events[activeStepIndex].timestamp}
                    </div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '4px' }}>
                      {simulationResult.events[activeStepIndex].result === 'failure' ? '❌ Failed Authentication Attempt' : '✅ Successful Authentication'}
                    </div>
                    <div style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      Origin: <strong>{simulationResult.events[activeStepIndex].city}, {simulationResult.events[activeStepIndex].country}</strong> • IP: <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{simulationResult.events[activeStepIndex].ip}</span>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800, color: riskColor(simulationResult.events[activeStepIndex].riskLevel) }}>
                      {simulationResult.events[activeStepIndex].riskScore}
                    </div>
                    <div style={{ fontSize: '0.74rem', textTransform: 'uppercase', fontWeight: 700, color: riskColor(simulationResult.events[activeStepIndex].riskLevel) }}>
                      {riskLabel(simulationResult.events[activeStepIndex].riskLevel)}
                    </div>
                  </div>
                </div>

                {/* Explanation */}
                {simulationResult.events[activeStepIndex].explanation && (
                  <div style={{ marginTop: '14px', padding: '10px 14px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', fontSize: '0.84rem' }}>
                    <strong>Engine Assessment:</strong> {simulationResult.events[activeStepIndex].explanation}
                  </div>
                )}
              </motion.div>
            )}

            {/* Generated Artifacts Link */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)' }}>
              <div>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.92rem' }}>
                  Adversary Simulation Ingested into SOC Pipeline
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Risk engine generated alerts and opened correlated investigation dockets.
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                {simulationResult.alertId && (
                  <Link
                    id="view-simulated-alert"
                    to={`/alerts/${simulationResult.alertId}`}
                    className="btn btn-secondary"
                  >
                    View Alert #{simulationResult.alertId.substring(0, 8)} →
                  </Link>
                )}
                {simulationResult.caseId && (
                  <Link
                    id="view-simulated-case"
                    to={`/cases/${simulationResult.caseId}`}
                    className="btn btn-primary"
                  >
                    View Investigation Case →
                  </Link>
                )}
                <Link to="/events" className="btn btn-secondary">
                  Telemetry Stream →
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            Select an attack storyline above and click <strong>"Launch Attack Simulation"</strong> to inject real-time security events.
          </div>
        )}
      </div>
    </div>
  );
}
