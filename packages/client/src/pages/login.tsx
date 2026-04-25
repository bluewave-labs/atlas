import { useState, useEffect } from 'react';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { WifiOff } from 'lucide-react';
import { api } from '../lib/api-client';
import { useAuthStore } from '../stores/auth-store';
import { ROUTES } from '../config/routes';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import type { Account } from '@atlas-platform/shared';
import { APP_VERSION } from '../config/version';

// Mountain range — same wallpaper as setup page
const BG_IMAGE = '/wallpapers/04-mountain-golden.jpg';

function VersionBadge() {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 12,
        right: 16,
        fontSize: 'var(--font-size-xs)',
        color: 'rgba(255,255,255,0.55)',
        fontFamily: 'var(--font-family)',
        letterSpacing: '0.02em',
        userSelect: 'all',
        zIndex: 1,
      }}
    >
      v{APP_VERSION}
    </div>
  );
}

// Glass-morphism overrides for shared components on photo backgrounds
const glassInputStyle = {
  background: 'rgba(255, 255, 255, 0.1)',
  borderColor: 'rgba(255, 255, 255, 0.2)',
};

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const addAccount = useAuthStore((s) => s.addAccount);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSetup, setCheckingSetup] = useState(true);
  const [backendUnreachable, setBackendUnreachable] = useState(false);
  const [publicSignupEnabled, setPublicSignupEnabled] = useState(true);

  useEffect(() => {
    api.get('/auth/setup-status')
      .then(({ data }) => {
        if (data.data.needsSetup) {
          navigate(ROUTES.SETUP, { replace: true });
        }
        // publicSignupEnabled is added in v2.6.2; older servers omit it,
        // so default to true to keep existing behavior on a stale server.
        if (typeof data.data.publicSignupEnabled === 'boolean') {
          setPublicSignupEnabled(data.data.publicSignupEnabled);
        }
      })
      .catch(() => {
        setBackendUnreachable(true);
      })
      .finally(() => setCheckingSetup(false));
  }, [navigate]);

  if (isAuthenticated) {
    return <Navigate to={ROUTES.HOME} replace />;
  }

  if (checkingSetup) {
    return null;
  }

  if (backendUnreachable) {
    return (
      <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-family)', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: '-20px', backgroundImage: `url(${BG_IMAGE})`, backgroundSize: 'cover', backgroundPosition: 'center', filter: 'brightness(0.5)', animation: 'loginKenBurns 30s ease-in-out infinite alternate' }} />
        <div className="glass-card" style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 480, padding: 32, background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 20, boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <WifiOff size={24} color="#fca5a5" />
            </div>
            <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 600, color: '#fff', margin: 0 }}>
              {t('login.backendUnreachable')}
            </h1>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'rgba(255,255,255,0.65)', textAlign: 'center', margin: 0 }}>
              {t('login.backendUnreachableDesc')}
            </p>
            <div style={{ width: '100%', padding: '12px 16px', background: 'rgba(255,255,255,0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.1)', fontSize: 'var(--font-size-sm)', color: 'rgba(255,255,255,0.8)', lineHeight: 1.6 }}>
              <div style={{ fontWeight: 600, marginBottom: 8, color: 'rgba(255,255,255,0.9)' }}>
                {t('login.backendTroubleshoot')}
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <li>{t('login.backendCheck1')}</li>
                <li>{t('login.backendCheck2')}</li>
                <li>{t('login.backendCheck3')}</li>
              </ul>
            </div>
            <Button
              variant="primary"
              size="md"
              onClick={() => window.location.reload()}
              style={{ width: '100%', marginTop: 4, background: 'rgba(255,255,255,0.2)', borderColor: 'rgba(255,255,255,0.25)' }}
            >
              {t('login.retryConnection')}
            </Button>
          </div>
        </div>
        <VersionBadge />
      </div>
    );
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
      <div style={{ position: 'absolute', inset: '-20px', backgroundImage: `url(${BG_IMAGE})`, backgroundSize: 'cover', backgroundPosition: 'center', filter: 'brightness(0.5)', animation: 'loginKenBurns 30s ease-in-out infinite alternate' }} />

      {/* Glass card */}
      <div className="glass-card" style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 400, padding: 32, background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 20, boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
        <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 600, textAlign: 'center', marginBottom: 8, color: '#fff' }}>
          {t('login.title', 'Sign in to Atlas')}
        </h1>
        <p style={{ fontSize: 'var(--font-size-sm)', textAlign: 'center', marginBottom: 24, color: 'rgba(255,255,255,0.65)' }}>
          {t('login.subtitle', 'Enter your credentials to continue')}
        </p>

        {error && (
          <div style={{ padding: '8px 12px', marginBottom: 16, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)', color: '#fca5a5', fontSize: 'var(--font-size-sm)' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Input
            label={t('login.email', 'Email')}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('login.emailPlaceholder', 'you@company.com')}
            required
            size="md"
            style={glassInputStyle}
          />
          <Input
            label={t('login.password', 'Password')}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('login.passwordPlaceholder', 'Enter your password')}
            required
            size="md"
            style={glassInputStyle}
          />

          <div style={{ textAlign: 'right', marginTop: -8 }}>
            <Link to={ROUTES.FORGOT_PASSWORD} style={{ fontSize: 'var(--font-size-sm)', color: 'rgba(255,255,255,0.7)', textDecoration: 'none' }}>
              {t('login.forgotPassword', 'Forgot password?')}
            </Link>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={loading}
            style={{ width: '100%', background: 'rgba(255,255,255,0.2)', borderColor: 'rgba(255,255,255,0.25)' }}
          >
            {loading ? t('login.signingIn', 'Signing in...') : t('login.signIn', 'Sign in')}
          </Button>
        </form>

        {publicSignupEnabled && (
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <Link to={ROUTES.REGISTER} style={{ fontSize: 'var(--font-size-sm)', color: 'rgba(255,255,255,0.7)', textDecoration: 'none' }}>
              {t('login.noAccount')}
            </Link>
          </div>
        )}
      </div>
      <VersionBadge />
    </div>
  );
}
