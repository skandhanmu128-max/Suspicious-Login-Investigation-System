import React, { useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from?.pathname || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isAuthenticated && !isLoading) {
    return <Navigate to={from} replace />;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Please provide your corporate SOC email and password.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleQuickLogin(userEmail: string, userPass: string) {
    setEmail(userEmail);
    setPassword(userPass);
    setError(null);
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(ellipse at 50% 20%, rgba(59, 130, 246, 0.12), transparent 70%), var(--bg-base)',
      padding: '20px',
    }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={{
          width: '100%',
          maxWidth: '440px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.7), 0 0 0 1px var(--border-subtle)',
          padding: '32px 28px',
        }}
      >
        {/* Header / Brand */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '56px',
            height: '56px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(16, 185, 129, 0.15))',
            border: '1px solid var(--border-accent)',
            fontSize: '28px',
            marginBottom: '14px',
          }}>
            🛡️
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
            SentinelTrace
          </h1>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '6px', marginBottom: 0 }}>
            Autonomous SOC Detection & Remote Incident Investigation
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{
              padding: '12px 14px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--critical-bg)',
              border: '1px solid var(--critical-border)',
              color: 'var(--critical)',
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '20px',
            }}
          >
            <span>⚠️</span>
            <span style={{ flex: 1 }}>{error}</span>
          </motion.div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
              Corporate Email
            </label>
            <input
              id="login-email"
              type="email"
              required
              className="input-field"
              placeholder="analyst@sentineltrace.io"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={{ width: '100%', height: '42px', fontSize: '0.9rem' }}
              autoComplete="email"
            />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Password
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ background: 'none', border: 'none', color: 'var(--blue-light)', fontSize: '0.75rem', cursor: 'pointer', padding: 0 }}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              required
              className="input-field"
              placeholder="••••••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{ width: '100%', height: '42px', fontSize: '0.9rem' }}
              autoComplete="current-password"
            />
          </div>

          <button
            id="login-submit-btn"
            type="submit"
            className="btn btn-primary"
            disabled={submitting}
            style={{ width: '100%', height: '44px', marginTop: '4px', fontSize: '0.95rem', fontWeight: 600 }}
          >
            {submitting ? 'Authenticating...' : 'Sign In to Console ➔'}
          </button>
        </form>

        {/* Quick Demo Logins */}
        <div style={{ marginTop: '28px', paddingTop: '20px', borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center', marginBottom: '10px' }}>
            Quick Demo Access (1-Click Fill)
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => handleQuickLogin('admin@sentineltrace.io', 'Admin@Sentinel2026!')}
              style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', height: '36px' }}
            >
              <span>👑</span>
              <span>Demo Admin</span>
            </button>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => handleQuickLogin('analyst@sentineltrace.io', 'Analyst@Sentinel2026!')}
              style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', height: '36px' }}
            >
              <span>🛡️</span>
              <span>Demo Analyst</span>
            </button>
          </div>

          <div style={{ textAlign: 'center', marginTop: '14px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Session credentials protected with salted <code style={{ color: 'var(--text-secondary)' }}>scrypt</code> hashing &amp; 24h bearer tokens.
          </div>
        </div>
      </motion.div>
    </div>
  );
}
