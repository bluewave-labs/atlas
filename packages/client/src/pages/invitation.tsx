import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api-client';
import { useAuthStore } from '../stores/auth-store';
import { ROUTES } from '../config/routes';
import type { Account } from '@atlasmail/shared';

interface InvitationDetails {
  email: string;
  role: string;
  tenantName: string;
  expiresAt: string;
}

export function InvitationPage() {
  const navigate = useNavigate();
  const { token } = useParams<{ token: string }>();
  const addAccount = useAuthStore((s) => s.addAccount);

  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState('');

  useEffect(() => {
    if (!token) return;
    api
      .get(`/auth/invitation/${token}`)
      .then(({ data }) => setInvitation(data.data))
      .catch((err) => setFetchError(err.response?.data?.error || 'Failed to load invitation'));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      const { data } = await api.post(`/auth/invitation/${token}/accept`, { name, password });
      const { accessToken, refreshToken, account } = data.data;
      addAccount(account as Account, accessToken, refreshToken);
      navigate(ROUTES.HOME, { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to accept invitation');
    } finally {
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #d0d5dd',
    borderRadius: 4,
    fontSize: 14,
    outline: 'none',
    background: 'var(--color-bg-primary)',
    color: 'var(--color-text-primary)',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 13,
    fontWeight: 500,
    marginBottom: 6,
    color: 'var(--color-text-primary)',
  };

  if (fetchError) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          background: 'var(--color-bg-primary)',
          fontFamily: 'var(--font-family)',
        }}
      >
        <div
          style={{
            maxWidth: 400,
            padding: 32,
            textAlign: 'center',
            background: 'var(--color-bg-secondary)',
            border: '1px solid #d0d5dd',
            borderRadius: 8,
          }}
        >
          <h2 style={{ fontSize: 20, marginBottom: 12, color: 'var(--color-text-primary)' }}>
            Invitation unavailable
          </h2>
          <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginBottom: 20 }}>
            {fetchError}
          </p>
          <a href={ROUTES.LOGIN} style={{ color: '#13715B', fontSize: 14 }}>
            Go to sign in
          </a>
        </div>
      </div>
    );
  }

  if (!invitation) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          background: 'var(--color-bg-primary)',
          color: 'var(--color-text-secondary)',
          fontFamily: 'var(--font-family)',
        }}
      >
        Loading invitation...
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'var(--color-bg-primary)',
        fontFamily: 'var(--font-family)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          padding: 32,
          background: 'var(--color-bg-secondary)',
          border: '1px solid #d0d5dd',
          borderRadius: 8,
        }}
      >
        <h1
          style={{
            fontSize: 24,
            fontWeight: 600,
            textAlign: 'center',
            marginBottom: 8,
            color: 'var(--color-text-primary)',
          }}
        >
          Join {invitation.tenantName}
        </h1>
        <p
          style={{
            fontSize: 14,
            textAlign: 'center',
            marginBottom: 24,
            color: 'var(--color-text-secondary)',
          }}
        >
          You've been invited as <strong>{invitation.role}</strong> to join{' '}
          <strong>{invitation.tenantName}</strong> on Atlas.
        </p>

        {error && (
          <div
            style={{
              padding: '8px 12px',
              marginBottom: 16,
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 4,
              color: '#dc2626',
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Email</label>
            <input
              type="email"
              value={invitation.email}
              disabled
              style={{ ...inputStyle, opacity: 0.6 }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Your name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Doe"
              required
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              required
              minLength={8}
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={labelStyle}>Confirm password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              required
              style={inputStyle}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '8px 16px',
              height: 34,
              background: '#13715B',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              fontSize: 14,
              fontWeight: 500,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Setting up your account...' : 'Accept invitation'}
          </button>
        </form>
      </div>
    </div>
  );
}
