import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api-client';
import { useAuthStore } from '../stores/auth-store';
import { ROUTES } from '../config/routes';
import type { Account } from '@atlasmail/shared';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 63);
}

export function RegisterPage() {
  const navigate = useNavigate();
  const addAccount = useAuthStore((s) => s.addAccount);

  const [companyName, setCompanyName] = useState('');
  const [companySlug, setCompanySlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [userName, setUserName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function handleCompanyNameChange(value: string) {
    setCompanyName(value);
    if (!slugEdited) {
      setCompanySlug(slugify(value));
    }
  }

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
      const { data } = await api.post('/auth/register', {
        companyName,
        companySlug,
        userName,
        email,
        password,
      });
      const { accessToken, refreshToken, account } = data.data;
      addAccount(account as Account, accessToken, refreshToken);
      navigate(ROUTES.HOME, { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed');
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
          maxWidth: 440,
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
          Create your company account
        </h1>
        <p
          style={{
            fontSize: 14,
            textAlign: 'center',
            marginBottom: 24,
            color: 'var(--color-text-secondary)',
          }}
        >
          Get started with Atlas for your team
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
            <label style={labelStyle}>Company name</label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => handleCompanyNameChange(e.target.value)}
              placeholder="Acme Inc."
              required
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Company URL</label>
            <input
              type="text"
              value={companySlug}
              onChange={(e) => {
                setCompanySlug(e.target.value);
                setSlugEdited(true);
              }}
              placeholder="acme-inc"
              required
              style={inputStyle}
            />
            <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>
              Used as your unique identifier
            </span>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Your name</label>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Jane Doe"
              required
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@acme.com"
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
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p
          style={{
            fontSize: 13,
            textAlign: 'center',
            marginTop: 20,
            color: 'var(--color-text-secondary)',
          }}
        >
          Already have an account?{' '}
          <Link
            to={ROUTES.LOGIN}
            style={{ color: '#13715B', textDecoration: 'none', fontWeight: 500 }}
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
