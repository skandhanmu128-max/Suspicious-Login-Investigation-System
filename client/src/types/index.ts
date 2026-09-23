// ─── Shared Types ─────────────────────────────────────────────────────────────

export type RiskLevel = 'safe' | 'suspicious' | 'high' | 'critical';
export type AlertStatus = 'open' | 'acknowledged' | 'investigating' | 'closed' | 'false_positive';
export type CaseStatus = 'new' | 'triaging' | 'investigating' | 'contained' | 'resolved' | 'false_positive';
export type EventResult = 'success' | 'failure';

export interface RiskSignal {
  id: string;
  name: string;
  category: 'authentication' | 'location' | 'device' | 'time' | 'network' | 'behavioral';
  description: string;
  points: number;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  evidence: string;
}

export interface CoreLoginParameters {
  ip: {
    current: string;
    status: 'KNOWN' | 'NEW';
    previousKnownIp: string;
    reputation: 'clean' | 'suspicious' | 'malicious';
    isp?: string;
    asn?: string;
    evidence: string;
  };
  location: {
    current: {
      city: string;
      country: string;
      lat?: number;
      lng?: number;
    };
    normal: {
      city: string;
      country: string;
    };
    status: 'NORMAL' | 'UNUSUAL';
    evidence: string;
  };
  loginWindow: {
    currentTime: string;
    normalWindow: string;
    status: 'NORMAL' | 'OUTSIDE NORMAL WINDOW' | 'INSUFFICIENT DATA';
    timeDelta: string;
    evidence: string;
  };
  vpn: {
    status: 'DETECTED' | 'NOT DETECTED' | 'UNKNOWN';
    provider?: string;
    isTor: boolean;
    isProxy: boolean;
    evidence: string;
  };
}

export interface LoginEvent {
  id: string;
  user_id: string;
  user_name?: string;
  user_email?: string;
  avatar_color?: string;
  department?: string;
  timestamp: string;
  ip: string;
  is_vpn: boolean;
  vpn_detected?: 'detected' | 'not_detected' | 'unknown';
  is_tor: boolean;
  is_proxy: boolean;
  ip_reputation: 'clean' | 'suspicious' | 'malicious';
  asn?: string;
  isp?: string;
  country: string;
  city: string;
  lat?: number;
  lng?: number;
  is_new_country: boolean;
  is_new_city: boolean;
  device: string;
  browser: string;
  os: string;
  is_mobile: boolean;
  device_fingerprint?: string;
  is_new_device: boolean;
  is_new_browser: boolean;
  result: EventResult;
  failure_reason?: string;
  risk_score: number;
  risk_level: RiskLevel;
  confidence: number;
  signals: RiskSignal[];
  explanation?: string;
  attack_scenario?: string;
  correlation_id?: string;
  coreParameters?: CoreLoginParameters;
}

export interface Alert {
  id: string;
  alert_type: string;
  title: string;
  description: string;
  severity: RiskLevel;
  status: AlertStatus;
  user_id: string;
  user_name?: string;
  user_email?: string;
  avatar_color?: string;
  department?: string;
  related_event_ids: string[];
  risk_score: number;
  confidence: number;
  signals: RiskSignal[];
  explanation?: string;
  first_seen: string;
  last_seen: string;
  acknowledged_at?: string;
  acknowledged_by?: string;
  resolved_at?: string;
  resolved_by?: string;
  case_id?: string;
  coreParameters?: CoreLoginParameters;
}

export interface EvidenceItem {
  id: string;
  type: string;
  label: string;
  value: string;
  severity: string;
  reviewed: boolean;
}

export interface Case {
  id: string;
  case_number: string;
  title: string;
  description: string;
  severity: RiskLevel;
  status: CaseStatus;
  assigned_analyst?: string;
  user_id: string;
  user_name?: string;
  user_email?: string;
  avatar_color?: string;
  department?: string;
  role?: string;
  related_alert_ids: string[];
  related_event_ids: string[];
  evidence: EvidenceItem[];
  resolution?: string;
  false_positive_reason?: string;
  created_at: string;
  updated_at: string;
  resolved_at?: string;
  risk_score: number;
  confidence: number;
  coreParameters?: CoreLoginParameters;
  // Baseline fields
  known_countries?: string[];
  known_cities?: string[];
  known_devices?: string[];
  known_ips?: string[];
  typical_login_start?: number;
  typical_login_end?: number;
  user_risk_level?: RiskLevel;
  risk_trend?: number[];
}

export interface InvestigationNote {
  id: string;
  case_id: string;
  analyst: string;
  content: string;
  timestamp: string;
  note_type: 'note' | 'action' | 'escalation';
}

export interface AuditLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  analyst: string;
  details: Record<string, any>;
  timestamp: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  department: string;
  role: string;
  avatar_color: string;
  known_countries: string[];
  known_cities: string[];
  known_devices: string[];
  known_browsers: string[];
  known_ips: string[];
  typical_login_start: number;
  typical_login_end: number;
  typical_days: number[];
  current_risk: number;
  risk_level: RiskLevel;
  risk_trend: number[];
  total_logins: number;
  failed_logins: number;
  last_login?: string;
  created_at: string;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: string;
  is_read: boolean;
  entity_type?: string;
  entity_id?: string;
  created_at: string;
}

export interface TimelineItem {
  type: 'event' | 'note' | 'audit' | 'case_created';
  timestamp: string;
  data: any;
}
