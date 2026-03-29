import { useState, useEffect } from 'react';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import { api } from '../lib/api-client';
import { useAuthStore } from '../stores/auth-store';
import { ROUTES } from '../config/routes';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import type { Account } from '@atlasmail/shared';

const BG_IMAGES = [
  'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1920&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1448375240586-882707db888b?w=1920&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1920&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1439853949127-fa647821eba0?w=1920&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1507041957456-9c397ce39c97?w=1920&q=80&auto=format&fit=crop',
];

function getDailyImageIndex(): number {
  return Math.floor(Date.now() / 86400000) % BG_IMAGES.length;
}

// Glass-morphism overrides for shared components on photo backgrounds
const glassInputStyle = {
  background: 'rgba(255, 255, 255, 0.1)',
  borderColor: 'rgba(255, 255, 255, 0.2)',
  color: '#fff',
};

export function LoginPage() {
  const navigate = useNavigate();
  const addAccount = useAuthStore((s) => s.addAccount);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSetup, setCheckingSetup] = useState(true);

  useEffect(() => {
    api.get('/auth/setup-status')
      .then(({ data }) => {
        if (data.data.needsSetup) {
          navigate(ROUTES.SETUP, { replace: true });
        }
      })
      .catch(() => {})
      .finally(() => setCheckingSetup(false));
  }, [navigate]);

  if (isAuthenticated) {
    return <Navigate to={ROUTES.HOME} replace />;
  }

  if (checkingSetup) {
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

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-family)', overflow: 'hidden' }}>
      {/* Background */}
      <div style={{ position: 'absolute', inset: '-20px', backgroundImage: `url(${BG_IMAGES[getDailyImageIndex()]})`, backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(2px) brightness(0.55)' }} />

      {/* Glass card */}
      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 400, padding: 32, background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 20, boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
        <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 600, textAlign: 'center', marginBottom: 8, color: '#fff' }}>
          Sign in to Atlas
        </h1>
        <p style={{ fontSize: 'var(--font-size-sm)', textAlign: 'center', marginBottom: 24, color: 'rgba(255,255,255,0.65)' }}>
          Enter your credentials to continue
        </p>

        {error && (
          <div style={{ padding: '8px 12px', marginBottom: 16, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)', color: '#fca5a5', fontSize: 'var(--font-size-sm)' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            required
            size="lg"
            style={glassInputStyle}
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            required
            size="lg"
            style={glassInputStyle}
          />

          <div style={{ textAlign: 'right', marginTop: -8 }}>
            <Link to={ROUTES.FORGOT_PASSWORD} style={{ fontSize: 'var(--font-size-sm)', color: 'rgba(255,255,255,0.7)', textDecoration: 'none' }}>
              Forgot password?
            </Link>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={loading}
            style={{ width: '100%', background: 'rgba(255,255,255,0.2)', borderColor: 'rgba(255,255,255,0.25)' }}
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  );
}
