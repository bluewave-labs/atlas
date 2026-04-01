import { useEffect, useState, useRef, type CSSProperties, type ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, CheckCircle2, XCircle, ArrowLeft } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { useMarketplaceStatus, useMarketplaceCatalog } from './hooks';

const MAX_WAIT_SECONDS = 120;
const POLL_INTERVAL = 3_000;

const circleStyle = (bg: string): CSSProperties => ({
  width: 64,
  height: 64,
  borderRadius: '50%',
  background: bg,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});

function StatusCircle({ bg, children }: { bg: string; children: ReactNode }) {
  return <div style={circleStyle(bg)}>{children}</div>;
}

function getAppUrl(port: number): string {
  const host = window.location.hostname;
  return `http://${host}:${port}`;
}

export function MarketplaceStartupPage() {
  const { appId } = useParams<{ appId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [elapsed, setElapsed] = useState(0);
  const [redirecting, setRedirecting] = useState(false);
  const startTime = useRef(Date.now());

  const { data: catalog } = useMarketplaceCatalog();
  const app = catalog?.items.find(a => a.id === appId);
  const appName = app?.name ?? appId ?? '';
  const port = app?.assignedPort;

  const { data: status } = useMarketplaceStatus(appId ?? '', !!appId && !!port && !redirecting, POLL_INTERVAL);
  const isHealthy = status?.health?.ok === true;
  const timedOut = elapsed >= MAX_WAIT_SECONDS;
  const done = redirecting || timedOut;

  // Tick elapsed time — stops after redirect or timeout
  useEffect(() => {
    if (done) return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [done]);

  // Auto-redirect when healthy
  useEffect(() => {
    if (isHealthy && port && !redirecting) {
      setRedirecting(true);
      const id = setTimeout(() => {
        window.location.href = getAppUrl(port);
      }, 800);
      return () => clearTimeout(id);
    }
  }, [isHealthy, port, redirecting]);

  const progressPercent = Math.min((elapsed / MAX_WAIT_SECONDS) * 100, 100);

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-bg-primary)',
        fontFamily: 'var(--font-family)',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'var(--spacing-xl)',
          maxWidth: 420,
          textAlign: 'center',
          padding: 'var(--spacing-2xl)',
        }}
      >
        {/* Status icon */}
        {timedOut ? (
          <StatusCircle bg="color-mix(in srgb, var(--color-error) 10%, transparent)">
            <XCircle size={32} style={{ color: 'var(--color-error)' }} />
          </StatusCircle>
        ) : redirecting ? (
          <StatusCircle bg="color-mix(in srgb, var(--color-success) 10%, transparent)">
            <CheckCircle2 size={32} style={{ color: 'var(--color-success)' }} />
          </StatusCircle>
        ) : (
          <StatusCircle bg="var(--color-bg-secondary)">
            <Loader2 size={32} style={{ color: 'var(--color-accent-primary)', animation: 'spin 1s linear infinite' }} />
          </StatusCircle>
        )}

        {/* Title */}
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: 'var(--font-size-xl)',
              fontWeight: 'var(--font-weight-semibold)' as CSSProperties['fontWeight'],
              color: 'var(--color-text-primary)',
              marginBottom: 'var(--spacing-xs)',
            }}
          >
            {timedOut
              ? t('marketplace.startupTimeout', { name: appName })
              : redirecting
                ? t('marketplace.startupReady', { name: appName })
                : t('marketplace.startupWaiting', { name: appName })}
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: 'var(--font-size-md)',
              color: 'var(--color-text-secondary)',
              lineHeight: 'var(--line-height-normal)',
            }}
          >
            {timedOut
              ? t('marketplace.startupTimeoutDesc')
              : redirecting
                ? t('marketplace.startupRedirecting')
                : t('marketplace.startupWaitingDesc')}
          </p>
        </div>

        {/* Progress bar */}
        {!done && (
          <div style={{ width: '100%' }}>
            <div
              style={{
                width: '100%',
                height: 4,
                borderRadius: 2,
                background: 'var(--color-bg-tertiary)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${progressPercent}%`,
                  height: '100%',
                  borderRadius: 2,
                  background: 'var(--color-accent-primary)',
                  transition: 'width 1s linear',
                }}
              />
            </div>
            <div
              style={{
                marginTop: 'var(--spacing-xs)',
                fontSize: 'var(--font-size-xs)',
                color: 'var(--color-text-tertiary)',
                fontFamily: 'var(--font-family-mono, monospace)',
              }}
            >
              {elapsed}s
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
          <Button
            variant="secondary"
            size="sm"
            icon={<ArrowLeft size={14} />}
            onClick={() => navigate('/marketplace')}
          >
            {t('marketplace.backToMarketplace')}
          </Button>
          {(timedOut || !redirecting) && port && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open(getAppUrl(port), '_blank')}
            >
              {t('marketplace.openAnyway')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
