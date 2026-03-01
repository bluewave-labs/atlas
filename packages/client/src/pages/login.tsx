import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api-client';
import { useAuthStore } from '../stores/auth-store';
import { ROUTES } from '../config/routes';
import { config } from '../config/env';
import type { Account } from '@atlasmail/shared';

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const addAccount = useAuthStore((s) => s.addAccount);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // If already authenticated, redirect to home
  if (isAuthenticated) {
    navigate(ROUTES.HOME, { replace: true });
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data } = await api.post('/auth/login', { email, password });
      const { accessToken, refreshToken, account } = data.data;
      addAccount(account as Account, accessToken, refreshToken);
      navigate(ROUTES.HOME, { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  function handleGoogleLogin() {
    const redirectUri = `${window.location.origin}${ROUTES.AUTH_CALLBACK}`;
    const url =
      `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${config.googleClientId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent('openid email profile https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/contacts.readonly https://www.googleapis.com/auth/calendar')}` +
      `&access_type=offline` +
      `&prompt=consent`;
    window.location.href = url;
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
          maxWidth: 400,
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
          Sign in to Atlas
        </h1>
        <p
          style={{
            fontSize: 14,
            textAlign: 'center',
            marginBottom: 24,
            color: 'var(--color-text-secondary)',
          }}
        >
          Enter your credentials to continue
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
            <label
              style={{
                display: 'block',
                fontSize: 13,
                fontWeight: 500,
                marginBottom: 6,
                color: 'var(--color-text-primary)',
              }}
            >
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d0d5dd',
                borderRadius: 4,
                fontSize: 14,
                outline: 'none',
                background: 'var(--color-bg-primary)',
                color: 'var(--color-text-primary)',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label
              style={{
                display: 'block',
                fontSize: 13,
                fontWeight: 500,
                marginBottom: 6,
                color: 'var(--color-text-primary)',
              }}
            >
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d0d5dd',
                borderRadius: 4,
                fontSize: 14,
                outline: 'none',
                background: 'var(--color-bg-primary)',
                color: 'var(--color-text-primary)',
                boxSizing: 'border-box',
              }}
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
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            margin: '20px 0',
            gap: 12,
          }}
        >
          <div style={{ flex: 1, height: 1, background: '#d0d5dd' }} />
          <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>or</span>
          <div style={{ flex: 1, height: 1, background: '#d0d5dd' }} />
        </div>

        {config.googleClientId && (
          <button
            type="button"
            onClick={handleGoogleLogin}
            style={{
              width: '100%',
              padding: '8px 16px',
              height: 34,
              background: 'var(--color-bg-primary)',
              color: 'var(--color-text-primary)',
              border: '1px solid #d0d5dd',
              borderRadius: 4,
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Sign in with Google
          </button>
        )}

        <p
          style={{
            fontSize: 13,
            textAlign: 'center',
            marginTop: 20,
            color: 'var(--color-text-secondary)',
          }}
        >
          Don't have an account?{' '}
          <Link
            to={ROUTES.REGISTER}
            style={{ color: '#13715B', textDecoration: 'none', fontWeight: 500 }}
          >
            Create a company account
          </Link>
        </p>
      </div>
    </div>
  );
}
