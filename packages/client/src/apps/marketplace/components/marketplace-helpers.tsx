import { useState, type CSSProperties } from 'react';
import {
  Activity,
  BarChart3,
  PieChart,
  Workflow,
  ClipboardList,
  KeyRound,
  Mail,
  CalendarCheck,
  MessageSquare,
  MessagesSquare,
  Store,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '../../../components/ui/badge';
import { Skeleton } from '../../../components/ui/skeleton';
import { AlertBanner } from '../../../components/ui/alert-banner';

// ─── Icon Map ────────────────────────────────────────────────────

const ICON_MAP: Record<string, LucideIcon> = {
  Activity, BarChart3, PieChart, Workflow, ClipboardList,
  KeyRound, Mail, CalendarCheck, MessageSquare, MessagesSquare,
  Store,
};

export function getAppIcon(iconName: string): LucideIcon {
  return ICON_MAP[iconName] ?? Store;
}

// ─── Helpers ──────────────────────────────────────────────────────

export function getStatusVariant(status: string | null | undefined): 'default' | 'success' | 'warning' | 'error' {
  switch (status) {
    case 'running': return 'success';
    case 'stopped': return 'warning';
    case 'failed': return 'error';
    case 'installing': return 'primary' as 'warning';
    default: return 'default';
  }
}

// ─── Status Badge ─────────────────────────────────────────────────

export function StatusBadge({ status, t }: { status: string | null | undefined; t: (key: string) => string }) {
  const label = (() => {
    switch (status) {
      case 'running': return t('marketplace.statusRunning');
      case 'stopped': return t('marketplace.statusStopped');
      case 'failed': return t('marketplace.statusFailed');
      case 'installing': return t('marketplace.statusInstalling');
      default: return t('marketplace.statusNotInstalled');
    }
  })();

  return <Badge variant={getStatusVariant(status)}>{label}</Badge>;
}

// ─── Docker Status Indicator ──────────────────────────────────────

export function DockerStatus({ available, t }: { available: boolean; t: (key: string) => string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: available ? 'var(--color-success)' : 'var(--color-error)',
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontSize: 'var(--font-size-sm)',
          color: 'var(--color-text-secondary)',
          fontFamily: 'var(--font-family)',
        }}
      >
        {available ? t('marketplace.dockerAvailable') : t('marketplace.dockerUnavailable')}
      </span>
    </div>
  );
}

// ─── Info Row ─────────────────────────────────────────────────────

export function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        style={{
          fontSize: 'var(--font-size-xs)',
          color: 'var(--color-text-tertiary)',
          fontFamily: 'var(--font-family)',
          marginBottom: 2,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 'var(--font-size-sm)',
          color: 'var(--color-text-primary)',
          fontFamily: 'var(--font-family)',
          fontWeight: 'var(--font-weight-medium)' as CSSProperties['fontWeight'],
        }}
      >
        {value}
      </div>
    </div>
  );
}

// ─── Menu Item Button ─────────────────────────────────────────────

export function MenuItemButton({
  icon,
  label,
  onClick,
  disabled,
  destructive,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--spacing-sm)',
        width: '100%',
        padding: 'var(--spacing-sm) var(--spacing-md)',
        background: hovered ? 'var(--color-surface-hover)' : 'transparent',
        border: 'none',
        borderRadius: 'var(--radius-sm)',
        color: destructive ? 'var(--color-error)' : 'var(--color-text-primary)',
        fontSize: 'var(--font-size-sm)',
        fontFamily: 'var(--font-family)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        textAlign: 'left',
      }}
    >
      <span style={{ display: 'inline-flex', flexShrink: 0 }}>{icon}</span>
      {label}
    </button>
  );
}

// ─── Loading Skeleton ─────────────────────────────────────────────

export function CatalogSkeleton() {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 'var(--spacing-xl)',
      }}
    >
      {Array.from({ length: 4 }, (_, i) => (
        <div
          key={i}
          style={{
            background: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border-primary)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--spacing-xl)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--spacing-md)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
            <Skeleton width={40} height={40} borderRadius={8} />
            <div style={{ flex: 1 }}>
              <Skeleton width="60%" height={18} />
            </div>
            <Skeleton width={70} height={20} borderRadius={10} />
          </div>
          <Skeleton width="100%" height={14} />
          <Skeleton width="80%" height={14} />
          <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
            <Skeleton width={50} height={20} borderRadius={10} />
            <Skeleton width={60} height={20} borderRadius={10} />
          </div>
          <Skeleton width="100%" height={1} />
          <Skeleton width={80} height={28} borderRadius={6} />
        </div>
      ))}
    </div>
  );
}

// ─── Docker Unavailable Banner ────────────────────────────────────

export function DockerUnavailableBanner({ t }: { t: (key: string) => string }) {
  return (
    <AlertBanner variant="warning">
      <div>
        <div
          style={{
            fontSize: 'var(--font-size-md)',
            fontWeight: 'var(--font-weight-medium)' as CSSProperties['fontWeight'],
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-family)',
          }}
        >
          {t('marketplace.dockerUnavailable')}
        </div>
        <div
          style={{
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-secondary)',
            fontFamily: 'var(--font-family)',
            marginTop: 2,
          }}
        >
          {t('marketplace.dockerUnavailableDesc')}
        </div>
      </div>
    </AlertBanner>
  );
}
