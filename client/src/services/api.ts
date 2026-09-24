const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) || '';
const BASE = API_BASE ? `${API_BASE.replace(/\/$/, '')}/api` : '/api';

export function getStoredToken(): string | null {
  return localStorage.getItem('sentinel_token');
}

export function setStoredToken(token: string | null): void {
  if (token) localStorage.setItem('sentinel_token', token);
  else localStorage.removeItem('sentinel_token');
}

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/auth/login')) {
      setStoredToken(null);
      localStorage.removeItem('sentinel_user');
      window.dispatchEvent(new Event('auth:unauthorized'));
    }
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error((err as any).error ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Authentication & RBAC
  auth: {
    login: (credentials: { email: string; password: string }) =>
      req<any>('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
    logout: () =>
      req<any>('/auth/logout', { method: 'POST' }).catch(() => ({ success: true })),
    me: () =>
      req<any>('/auth/me'),
    users: () =>
      req<any>('/auth/users'),
    createUser: (body: any) =>
      req<any>('/auth/users', { method: 'POST', body: JSON.stringify(body) }),
    updateRole: (id: string, role: string) =>
      req<any>(`/auth/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }),
  },

  // Dashboard
  dashboard: {
    get: () => req<any>('/dashboard'),
  },

  events: {
    list: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return req<any>(`/events${qs}`);
    },
    get: (id: string) => req<any>(`/events/${id}`),
    submitSessionActivity: (body: any) =>
      req<any>('/events/session-activity', { method: 'POST', body: JSON.stringify(body) }),
    recentSessionActivity: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return req<any>(`/events/session-activity/recent${qs}`);
    },
  },

  alerts: {
    list: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return req<any>(`/alerts${qs}`);
    },
    get: (id: string) => req<any>(`/alerts/${id}`),
    update: (id: string, body: any) => req<any>(`/alerts/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    feedback: (id: string, body: { classification: string; notes?: string }) =>
      req<any>(`/alerts/${id}/feedback`, { method: 'POST', body: JSON.stringify(body) }),
  },

  cases: {
    list: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return req<any>(`/cases${qs}`);
    },
    get: (id: string) => req<any>(`/cases/${id}`),
    create: (body: any) => req<any>('/cases', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: any) => req<any>(`/cases/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    addNote: (id: string, body: any) => req<any>(`/cases/${id}/notes`, { method: 'POST', body: JSON.stringify(body) }),
    timeline: (id: string) => req<any>(`/cases/${id}/timeline`),
    reviewEvidence: (caseId: string, evidenceId: string, reviewed: boolean) =>
      req<any>(`/cases/${caseId}/evidence/${evidenceId}`, { method: 'PATCH', body: JSON.stringify({ reviewed }) }),
    feedback: (id: string, body: { classification: string; notes?: string }) =>
      req<any>(`/cases/${id}/feedback`, { method: 'POST', body: JSON.stringify(body) }),
  },

  users: {
    list: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return req<any>(`/users${qs}`);
    },
    get: (id: string) => req<any>(`/users/${id}`),
  },

  simulator: {
    scenarios: () => req<any>('/simulator/scenarios'),
    run: (scenario: string, userId?: string) =>
      req<any>('/simulator/run', { method: 'POST', body: JSON.stringify({ scenario, userId }) }),
    reset: () => req<any>('/simulator/reset', { method: 'POST' }),
  },

  reports: {
    summary: () => req<any>('/reports'),
    get: (caseId: string) => req<any>(`/reports/${caseId}`),
  },

  notifications: {
    list: () => req<any>('/notifications'),
    markRead: (id: string) => req<any>(`/notifications/${id}/read`, { method: 'PATCH' }),
    markAllRead: () => req<any>('/notifications/read-all', { method: 'PATCH' }),
    remote: () => req<any>('/notifications/remote'),
    testRemote: (body?: any) =>
      req<any>('/notifications/test-remote', { method: 'POST', body: JSON.stringify(body || {}) }),
  },

  settings: {
    get: () => req<any>('/settings'),
    update: (body: any) => req<any>('/settings', { method: 'PATCH', body: JSON.stringify(body) }),
  },

  audit: {
    list: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return req<any>(`/audit${qs}`);
    },
  },

  geolocate: (ip: string) => req<any>(`/geolocate/${ip}`),
};

export default api;
