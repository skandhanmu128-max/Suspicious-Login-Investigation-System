// ─── Utility Functions ────────────────────────────────────────────────────────
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import type { RiskLevel } from '../types';

export function formatDate(ts: string, fmt = 'MMM dd, HH:mm'): string {
  try { return format(parseISO(ts), fmt); }
  catch { return ts; }
}

export function formatDateFull(ts: string): string {
  try { return format(parseISO(ts), 'MMM dd, yyyy HH:mm:ss'); }
  catch { return ts; }
}

export function timeAgo(ts: string): string {
  try { return formatDistanceToNow(parseISO(ts), { addSuffix: true }); }
  catch { return ts; }
}

export function formatTimestamp(ts: string): string {
  try { return format(parseISO(ts), 'HH:mm:ss'); }
  catch { return ts; }
}

export function riskColor(level: RiskLevel | string): string {
  switch (level) {
    case 'critical': return 'var(--critical)';
    case 'high': return 'var(--high)';
    case 'suspicious': return 'var(--suspicious)';
    case 'safe': return 'var(--safe)';
    default: return 'var(--text-muted)';
  }
}

export function riskBg(level: RiskLevel | string): string {
  switch (level) {
    case 'critical': return 'var(--critical-bg)';
    case 'high': return 'var(--high-bg)';
    case 'suspicious': return 'var(--suspicious-bg)';
    case 'safe': return 'var(--safe-bg)';
    default: return 'rgba(100,116,139,0.1)';
  }
}

export function riskLabel(level: RiskLevel | string): string {
  switch (level) {
    case 'critical': return 'Critical';
    case 'high': return 'High';
    case 'suspicious': return 'Suspicious';
    case 'safe': return 'Safe';
    default: return level;
  }
}

export function severityIcon(level: string): string {
  switch (level) {
    case 'critical': return '🔴';
    case 'high': return '🟠';
    case 'suspicious': return '🟡';
    case 'safe': return '🟢';
    default: return '⚪';
  }
}

export function alertTypeLabel(type: string): string {
  const map: Record<string, string> = {
    impossible_travel: 'Impossible Travel',
    brute_force: 'Brute Force',
    password_spray: 'Password Spraying',
    account_takeover: 'Account Takeover',
    vpn_anomaly: 'VPN Anomaly',
    new_device: 'New Device',
    behavioral_anomaly: 'Behavioral Anomaly',
    new_country: 'New Country',
    odd_hour: 'Odd Hour',
  };
  return map[type] ?? type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function alertTypeIcon(type: string): string {
  const map: Record<string, string> = {
    impossible_travel: '✈️',
    brute_force: '🔨',
    password_spray: '💧',
    account_takeover: '🎭',
    vpn_anomaly: '🛡️',
    new_device: '💻',
    behavioral_anomaly: '👁️',
    new_country: '🌍',
    odd_hour: '🌙',
  };
  return map[type] ?? '⚠️';
}

export function categoryIcon(category: string): string {
  const map: Record<string, string> = {
    authentication: '🔐',
    location: '📍',
    device: '💻',
    time: '🕐',
    network: '🌐',
    behavioral: '🧠',
  };
  return map[category] ?? '⚠️';
}

export function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
}

export function confidenceLabel(c: number): string {
  const pct = Math.round(c * 100);
  if (pct >= 90) return `${pct}% · Very High`;
  if (pct >= 75) return `${pct}% · High`;
  if (pct >= 60) return `${pct}% · Moderate`;
  if (pct >= 40) return `${pct}% · Low`;
  return `${pct}% · Very Low`;
}

export function caseStatusLabel(status: string): string {
  const map: Record<string, string> = {
    new: 'New', triaging: 'Triaging', investigating: 'Investigating',
    contained: 'Contained', resolved: 'Resolved', false_positive: 'False Positive',
  };
  return map[status] ?? status;
}

export function caseStatusNext(status: string): Array<{ value: string; label: string }> {
  const transitions: Record<string, Array<{ value: string; label: string }>> = {
    new: [{ value: 'triaging', label: 'Begin Triage' }, { value: 'false_positive', label: 'Mark False Positive' }],
    triaging: [{ value: 'investigating', label: 'Start Investigation' }, { value: 'false_positive', label: 'Mark False Positive' }],
    investigating: [{ value: 'contained', label: 'Mark Contained' }, { value: 'resolved', label: 'Resolve Case' }, { value: 'false_positive', label: 'Mark False Positive' }],
    contained: [{ value: 'resolved', label: 'Resolve Case' }],
    resolved: [],
    false_positive: [],
  };
  return transitions[status] ?? [];
}

export function ipClass(reputation: string): string {
  if (reputation === 'malicious') return 'text-critical';
  if (reputation === 'suspicious') return 'text-suspicious';
  return 'text-safe';
}

export function truncate(str: string, max: number): string {
  return str.length > max ? str.substring(0, max) + '…' : str;
}

export function niceNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}
