import { Mail } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { config } from '../../config/env';
import type { CSSProperties } from 'react';

// Google's OAuth authorization URL — the server exchanges the code for tokens.
function buildGoogleOAuthUrl(): string {
  const baseUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
  const params = new URLSearchParams({
    client_id: config.googleClientId,
    redirect_uri: `${window.location.origin}/auth/callback`,
    response_type: 'code',
    scope: [
      'openid',
      'email',
      'profile',
      'https://www.googleapis.com/auth/gmail.modify',
    ].join(' '),
    access_type: 'offline',
    prompt: 'consent',
  });
  return `${baseUrl}?${params.toString()}`;
}

export function LoginPage() {
  const { t } = useTranslation();

  function handleGoogleSignIn() {
    window.location.href = buildGoogleOAuthUrl();
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        width: '100vw',
        background: 'var(--color-bg-primary)',
        fontFamily: 'var(--font-family)',
      }}
    >
      {/* Card */}
      <div
        style={{
          width: '100%',
          maxWidth: 400,
          background: 'var(--color-bg-elevated)',
          border: '1px solid var(--color-border-primary)',
          borderRadius: 'var(--radius-xl)',
          padding: 'var(--spacing-2xl)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'var(--spacing-xl)',
          boxShadow: 'var(--shadow-elevated)',
        }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--spacing-md)' }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 'var(--radius-lg)',
              background: 'var(--color-accent-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Mail size={28} color="#ffffff" />
          </div>
          <div style={{ textAlign: 'center' }}>
            <h1
              style={{
                margin: 0,
                fontSize: 'var(--font-size-xl)',
                fontWeight: 'var(--font-weight-semibold)' as CSSProperties['fontWeight'],
                color: 'var(--color-text-primary)',
                letterSpacing: '-0.02em',
              }}
            >
              {t('auth.appName')}
            </h1>
            <p
              style={{
                margin: 'var(--spacing-xs) 0 0',
                fontSize: 'var(--font-size-md)',
                color: 'var(--color-text-tertiary)',
              }}
            >
              {t('auth.tagline')}
            </p>
          </div>
        </div>

        {/* Divider */}
        <div
          style={{
            width: '100%',
            height: 1,
            background: 'var(--color-border-primary)',
          }}
        />

        {/* Sign in section */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          <p
            style={{
              margin: 0,
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-secondary)',
              textAlign: 'center',
            }}
          >
            {t('auth.signInToContinue')}
          </p>

          {/* Google sign in button */}
          <button
            onClick={handleGoogleSignIn}
            aria-label={t('auth.signInWithGoogle')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--spacing-md)',
              width: '100%',
              height: 44,
              background: 'var(--color-bg-tertiary)',
              border: '1px solid var(--color-border-primary)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-text-primary)',
              fontSize: 'var(--font-size-md)',
              fontWeight: 'var(--font-weight-medium)' as CSSProperties['fontWeight'],
              fontFamily: 'var(--font-family)',
              cursor: 'pointer',
              transition: 'background var(--transition-normal), border-color var(--transition-normal)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--color-surface-hover)';
              e.currentTarget.style.borderColor = 'var(--color-text-tertiary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--color-bg-tertiary)';
              e.currentTarget.style.borderColor = 'var(--color-border-primary)';
            }}
          >
            {/* Google icon SVG */}
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.616z"
                fill="#4285F4"
              />
              <path
                d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"
                fill="#34A853"
              />
              <path
                d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
                fill="#FBBC05"
              />
              <path
                d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
                fill="#EA4335"
              />
            </svg>
            {t('auth.signInWithGoogle')}
          </button>
        </div>

      </div>
    </div>
  );
}
