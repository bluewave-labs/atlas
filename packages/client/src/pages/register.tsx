import { useState, useEffect } from 'react';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api-client';
import { useAuthStore } from '../stores/auth-store';
import { ROUTES } from '../config/routes';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import type { Account } from '@atlas-platform/shared';

const BG_IMAGE = '/wallpapers/04-mountain-golden.jpg';

const glassInputStyle = {
  background: 'rgba(255, 255, 255, 0.1)',
  borderColor: 'rgba(255, 255, 255, 0.2)',
};

export function RegisterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const addAccount = useAuthStore((s) => s.addAccount);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [signupDisabled, setSignupDisabled] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    api.get('/auth/setup-status')
      .then(({ data }) => {
        if (data.data.publicSignupEnabled === false) {
          setSignupDisabled(true);
        }
      })
      .catch(() => { /* server unreachable: fall through, the POST will surface the error */ })
      .finally(() => setChecking(false));
  }, []);

  if (isAuthenticated && !registered) {
    return <Navigate to={ROUTES.HOME} replace />;
  }
  if (!checking && signupDisabled) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }
  if (checking) {
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data } = await api.post('/auth/register', { name, email, password, companyName });
      const { accessToken, refreshToken, account } = data.data;
      setRegistered(true);
      addAccount(account as Account, accessToken, refreshToken);
      navigate(ROUTES.ONBOARDING, { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.error || t('register.genericError', 'Registration failed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-family)', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: '-20px', backgroundImage: `url(${BG_IMAGE})`, backgroundSize: 'cover', backgroundPosition: 'center', filter: 'brightness(0.5)', animation: 'loginKenBurns 30s ease-in-out infinite alternate' }} />

      <div className="glass-card" style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 400, padding: 32, background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 20, boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
        <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 600, textAlign: 'center', marginBottom: 8, color: '#fff' }}>
          {t('register.title')}
        </h1>
        <p style={{ fontSize: 'var(--font-size-sm)', textAlign: 'center', marginBottom: 24, color: 'rgba(255,255,255,0.65)' }}>
          {t('register.subtitle')}
        </p>

        {error && (
          <div style={{ padding: '8px 12px', marginBottom: 16, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)', color: '#fca5a5', fontSize: 'var(--font-size-sm)' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Input
            label={t('register.name')}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            size="md"
            style={glassInputStyle}
          />
          <Input
            label={t('register.email')}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            required
            size="md"
            style={glassInputStyle}
          />
          <Input
            label={t('register.password')}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            size="md"
            style={glassInputStyle}
          />
          <Input
            label={t('register.companyName')}
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder={t('register.companyPlaceholder')}
            required
            size="md"
            style={glassInputStyle}
          />

          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={loading}
            style={{ width: '100%', background: 'rgba(255,255,255,0.2)', borderColor: 'rgba(255,255,255,0.25)' }}
          >
            {loading ? t('register.submitting') : t('register.submit')}
          </Button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Link to={ROUTES.LOGIN} style={{ fontSize: 'var(--font-size-sm)', color: 'rgba(255,255,255,0.7)', textDecoration: 'none' }}>
            {t('register.hasAccount')}
          </Link>
        </div>
      </div>
    </div>
  );
}
