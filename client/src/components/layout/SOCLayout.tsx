import React, { useState, useEffect } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import type { Notification } from '../../types';
import { timeAgo } from '../../lib/utils';

const NAV = [
  {
    section: 'OPERATIONS',
    items: [
      { path: '/', icon: '⬡', label: 'SOC Dashboard' },
      { path: '/alerts', icon: '⚠', label: 'Alert Queue' },
      { path: '/cases', icon: '🗂', label: 'Investigations' },
    ],
  },
  {
    section: 'INTELLIGENCE',
    items: [
      { path: '/events', icon: '⚡', label: 'Auth Events' },
      { path: '/users', icon: '👤', label: 'User Profiles' },
      { path: '/map', icon: '🌐', label: 'Threat Map' },
    ],
  },
  {
    section: 'TOOLS',
    items: [
      { path: '/simulator', icon: '🎭', label: 'Threat Simulator' },
      { path: '/reports', icon: '📄', label: 'Reports' },
      { path: '/settings', icon: '⚙', label: 'Settings', adminOnly: true },
    ],
  },
];

export default function SOCLayout() {
  const location = useLocation();
  const { user, role, logout } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [remoteOutbox, setRemoteOutbox] = useState<any[]>([]);
  const [activeNotifTab, setActiveNotifTab] = useState<'inbox' | 'remote'>('inbox');
  const [unread, setUnread] = useState(0);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [criticalCount, setCriticalCount] = useState(0);
  const [socTime, setSocTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setSocTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchNotifications();
    fetchCriticalCount();
    fetchRemoteOutbox();
    const interval = setInterval(() => {
      fetchNotifications();
      fetchCriticalCount();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileNavOpen(false);
    setShowUserMenu(false);
  }, [location.pathname]);

  async function fetchNotifications() {
    try {
      const data = await api.notifications.list();
      setNotifications(data.notifications ?? []);
      setUnread(data.unreadCount ?? 0);
    } catch { /* fail silently */ }
  }

  async function fetchRemoteOutbox() {
    try {
      const data = await api.notifications.remote();
      setRemoteOutbox(data.outbox ?? []);
    } catch { /* fail silently */ }
  }

  async function fetchCriticalCount() {
    try {
      const data = await api.alerts.list({ severity: 'critical', status: 'open', limit: '1' });
      setCriticalCount(data.total ?? 0);
    } catch { /* fail silently */ }
  }

  async function handleMarkAllRead() {
    await api.notifications.markAllRead();
    setNotifications(n => n.map(x => ({ ...x, is_read: true })));
    setUnread(0);
  }

  const currentPage = () => {
    for (const s of NAV) for (const item of s.items) {
      if (item.path === '/' && location.pathname === '/') return 'SOC Dashboard';
      if (item.path !== '/' && location.pathname.startsWith(item.path)) return item.label;
    }
    return 'SentinelTrace';
  };

  return (
    <div className="soc-layout">
      {/* Desktop Sidebar */}
      <aside className="sidebar desktop-only">
        <div className="sidebar-logo">
          <div className="logo-mark">
            <div className="logo-icon">🛡</div>
            <div>
              <div className="logo-text">SentinelTrace</div>
            </div>
          </div>
          <div className="sidebar-subtitle">Authentication Detection Platform</div>
        </div>

        <nav className="sidebar-nav">
          {NAV.map(section => (
            <div key={section.section} className="nav-section">
              <div className="nav-section-label">{section.section}</div>
              {section.items.map(item => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`nav-item ${(item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path)) ? 'active' : ''}`}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {item.adminOnly && role !== 'ADMIN' && (
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', background: 'var(--bg-elevated)', padding: '2px 5px', borderRadius: '4px' }}>Admin</span>
                  )}
                  {item.path === '/alerts' && criticalCount > 0 && (
                    <span className="nav-badge">{criticalCount}</span>
                  )}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        {/* Sidebar user footer */}
        <div className="sidebar-footer" style={{ borderTop: '1px solid var(--border-subtle)', padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
              <div
                className="avatar avatar-sm"
                style={{ background: user?.avatar_color || '#3B82F6', color: 'white', flexShrink: 0 }}
              >
                {user?.name ? user.name.slice(0, 2).toUpperCase() : 'SO'}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  {user?.name || 'Analyst'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span className={`badge ${role === 'ADMIN' ? 'badge-critical' : 'badge-safe'}`} style={{ fontSize: '0.65rem', padding: '1px 5px' }}>
                    {role || 'ANALYST'}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={logout}
              title="Sign Out"
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1rem', padding: '4px' }}
            >
              ⏻
            </button>
          </div>
          <div className="demo-badge" style={{ fontSize: '0.68rem', textAlign: 'center' }}>
            🔬 Mobile SOC Investigation Console
          </div>
        </div>
      </aside>

      {/* Mobile Slide-Out Drawer Navigation */}
      <AnimatePresence>
        {mobileNavOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mobile-overlay"
              onClick={() => setMobileNavOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25, stiffness: 280 }}
              className="mobile-drawer"
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', borderBottom: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '1.4rem' }}>🛡️</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>SentinelTrace</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Mobile SOC Console</div>
                  </div>
                </div>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setMobileNavOpen(false)}
                  style={{ fontSize: '1.2rem', padding: '4px 8px' }}
                >
                  ✕
                </button>
              </div>

              {/* User info card in mobile drawer */}
              <div style={{ padding: '14px 16px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    className="avatar avatar-sm"
                    style={{ background: user?.avatar_color || '#3B82F6', color: 'white' }}
                  >
                    {user?.name ? user.name.slice(0, 2).toUpperCase() : 'SO'}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-primary)' }}>{user?.name}</div>
                    <span className={`badge ${role === 'ADMIN' ? 'badge-critical' : 'badge-safe'}`} style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
                      {role || 'ANALYST'}
                    </span>
                  </div>
                </div>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={logout}
                  style={{ fontSize: '0.75rem', color: 'var(--critical)' }}
                >
                  Sign Out
                </button>
              </div>

              {/* Mobile Drawer Navigation Links */}
              <nav style={{ padding: '12px 8px', overflowY: 'auto', flex: 1 }}>
                {NAV.map(section => (
                  <div key={section.section} style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', padding: '4px 12px', textTransform: 'uppercase' }}>
                      {section.section}
                    </div>
                    {section.items.map(item => (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={`nav-item ${(item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path)) ? 'active' : ''}`}
                        style={{ padding: '12px 14px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}
                      >
                        <span style={{ fontSize: '1.1rem' }}>{item.icon}</span>
                        <span style={{ flex: 1, fontSize: '0.9rem' }}>{item.label}</span>
                        {item.adminOnly && role !== 'ADMIN' && (
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', background: 'var(--bg-elevated)', padding: '2px 5px', borderRadius: '4px' }}>Admin</span>
                        )}
                        {item.path === '/alerts' && criticalCount > 0 && (
                          <span className="nav-badge">{criticalCount}</span>
                        )}
                      </Link>
                    ))}
                  </div>
                ))}
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className="main-content">
        {/* Topbar */}
        <header className="topbar">
          {/* Mobile hamburger menu toggle */}
          <button
            id="mobile-nav-toggle-btn"
            className="mobile-hamburger-btn mobile-only"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open Navigation Menu"
          >
            ☰
          </button>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }} className="desktop-only">
              SentinelTrace /
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
              {currentPage()}
            </div>
          </div>

          {/* Live indicator */}
          <div className="live-indicator">
            <div className="live-dot" />
            <span>Live</span>
          </div>

          {/* Live SOC Clock (Desktop only) */}
          <div className="desktop-only" style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '0.78rem',
            color: 'var(--text-secondary)',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
            padding: '5px 12px',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{ color: 'var(--blue-light)' }}>🕒</span>
            <span>{socTime.toISOString().slice(11, 19)} UTC</span>
          </div>

          {/* Search Bar (Desktop only) */}
          <div className="search-bar desktop-only" style={{ width: 220 }}>
            <span className="search-icon" style={{ fontSize: '0.85rem' }}>🔍</span>
            <input
              placeholder="Search..."
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  const val = (e.target as HTMLInputElement).value.trim();
                  if (val) window.location.href = `/events?search=${encodeURIComponent(val)}`;
                }
              }}
            />
          </div>

          {/* Notifications Button & Drawer */}
          <div style={{ position: 'relative' }}>
            <button
              id="notif-bell-btn"
              className="notif-btn"
              onClick={() => { setShowNotifs(v => !v); fetchRemoteOutbox(); }}
              aria-label="Notifications"
            >
              🔔
              {unread > 0 && <span className="notif-count">{unread > 9 ? '9+' : unread}</span>}
            </button>

            <AnimatePresence>
              {showNotifs && (
                <>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={{ position: 'fixed', inset: 0, zIndex: 190 }}
                    onClick={() => setShowNotifs(false)}
                  />
                  <motion.div
                    className="notif-drawer"
                    initial={{ x: 360, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: 360, opacity: 0 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                  >
                    <div className="card-header" style={{ padding: '1rem 1.25rem' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          className={`btn btn-sm ${activeNotifTab === 'inbox' ? 'btn-primary' : 'btn-ghost'}`}
                          onClick={() => setActiveNotifTab('inbox')}
                          style={{ fontSize: '0.76rem' }}
                        >
                          Alerts ({notifications.length})
                        </button>
                        <button
                          className={`btn btn-sm ${activeNotifTab === 'remote' ? 'btn-primary' : 'btn-ghost'}`}
                          onClick={() => setActiveNotifTab('remote')}
                          style={{ fontSize: '0.76rem' }}
                        >
                          Remote Outbox ({remoteOutbox.length})
                        </button>
                      </div>
                      <div className="flex gap-2">
                        {activeNotifTab === 'inbox' && unread > 0 && (
                          <button className="btn btn-ghost btn-sm" onClick={handleMarkAllRead} style={{ fontSize: '0.72rem' }}>
                            Mark read
                          </button>
                        )}
                        <button className="btn btn-ghost btn-sm" onClick={() => setShowNotifs(false)}>✕</button>
                      </div>
                    </div>

                    <div style={{ overflowY: 'auto', flex: 1 }}>
                      {activeNotifTab === 'inbox' ? (
                        notifications.length === 0 ? (
                          <div className="empty-state" style={{ padding: '2rem' }}>
                            <div className="empty-icon">🔔</div>
                            <p>No notifications</p>
                          </div>
                        ) : (
                          notifications.map(n => (
                            <div
                              key={n.id}
                              className={`notif-item ${!n.is_read ? 'unread' : ''} ${n.severity === 'critical' ? 'critical' : ''}`}
                              onClick={() => {
                                api.notifications.markRead(n.id);
                                if (n.entity_type === 'alert' && n.entity_id) window.location.href = `/alerts/${n.entity_id}`;
                                else if (n.entity_type === 'case' && n.entity_id) window.location.href = `/cases/${n.entity_id}`;
                              }}
                            >
                              <div
                                className="notif-dot"
                                style={{
                                  background: n.severity === 'critical' ? 'var(--critical-bg)' :
                                             n.severity === 'high' ? 'var(--high-bg)' : 'var(--blue-glow)',
                                }}
                              >
                                {n.severity === 'critical' ? '🔴' : n.type === 'new_case' ? '🗂' : '⚠️'}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '0.83rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
                                  {n.title}
                                </div>
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                                  {n.message}
                                </div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                  {timeAgo(n.created_at)}
                                </div>
                              </div>
                              {!n.is_read && (
                                <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--blue)', flexShrink: 0, marginTop: 4 }} />
                              )}
                            </div>
                          ))
                        )
                      ) : (
                        remoteOutbox.length === 0 ? (
                          <div className="empty-state" style={{ padding: '2rem' }}>
                            <div className="empty-icon">📨</div>
                            <p>No remote notifications sent yet</p>
                          </div>
                        ) : (
                          remoteOutbox.map(r => (
                            <div key={r.id} className="notif-item" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                              <div className="notif-dot" style={{ background: 'var(--accent-cyan)' }}>
                                📨
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                  {r.subject}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '3px 0' }}>
                                  Channel: <strong style={{ color: 'var(--blue-light)' }}>{r.channel?.toUpperCase()}</strong> → {r.recipient}
                                </div>
                                <pre style={{ fontSize: '0.68rem', background: 'var(--bg-elevated)', padding: '6px', borderRadius: '4px', whiteSpace: 'pre-wrap', maxHeight: '80px', overflowY: 'auto' }}>
                                  {r.body}
                                </pre>
                                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                  {timeAgo(r.created_at)} • Status: <span style={{ color: 'var(--safe)' }}>{r.status}</span>
                                </div>
                              </div>
                            </div>
                          ))
                        )
                      )}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          {/* User Profile / Sign Out Dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowUserMenu(v => !v)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              aria-label="User Profile Menu"
            >
              <div
                className="avatar avatar-sm"
                style={{ background: user?.avatar_color || '#3B82F6', color: 'white', fontWeight: 700 }}
              >
                {user?.name ? user.name.slice(0, 2).toUpperCase() : 'SO'}
              </div>
            </button>

            <AnimatePresence>
              {showUserMenu && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 180 }} onClick={() => setShowUserMenu(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: '120%',
                      width: '220px',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-md)',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                      padding: '12px',
                      zIndex: 190,
                    }}
                  >
                    <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px', marginBottom: '8px' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)' }}>{user?.name}</div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{user?.email}</div>
                      <span className={`badge ${role === 'ADMIN' ? 'badge-critical' : 'badge-safe'}`} style={{ fontSize: '0.65rem', marginTop: '6px' }}>
                        {role || 'ANALYST'} ROLE
                      </span>
                    </div>

                    <button
                      className="btn btn-danger btn-sm"
                      onClick={logout}
                      style={{ width: '100%', justifyContent: 'center', fontSize: '0.8rem' }}
                    >
                      ⏻ Sign Out
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </header>

        {/* Page Content */}
        <main className="page-content">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15 }}
          >
            <Outlet />
          </motion.div>
        </main>

        {/* Mobile Sticky Bottom Navigation Bar (Screens <= 768px) */}
        <nav className="mobile-bottom-nav mobile-only">
          <Link
            to="/"
            className={`bottom-nav-item ${location.pathname === '/' ? 'active' : ''}`}
          >
            <span className="bottom-nav-icon">⬡</span>
            <span className="bottom-nav-label">Dashboard</span>
          </Link>

          <Link
            to="/alerts"
            className={`bottom-nav-item ${location.pathname.startsWith('/alerts') ? 'active' : ''}`}
          >
            <span className="bottom-nav-icon" style={{ position: 'relative' }}>
              ⚠
              {criticalCount > 0 && <span className="bottom-nav-badge">{criticalCount}</span>}
            </span>
            <span className="bottom-nav-label">Alerts</span>
          </Link>

          <Link
            to="/cases"
            className={`bottom-nav-item ${location.pathname.startsWith('/cases') ? 'active' : ''}`}
          >
            <span className="bottom-nav-icon">🗂</span>
            <span className="bottom-nav-label">Cases</span>
          </Link>

          <Link
            to="/events"
            className={`bottom-nav-item ${location.pathname.startsWith('/events') ? 'active' : ''}`}
          >
            <span className="bottom-nav-icon">⚡</span>
            <span className="bottom-nav-label">Events</span>
          </Link>

          <button
            type="button"
            className={`bottom-nav-item ${mobileNavOpen ? 'active' : ''}`}
            onClick={() => setMobileNavOpen(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <span className="bottom-nav-icon">☰</span>
            <span className="bottom-nav-label">Menu</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
