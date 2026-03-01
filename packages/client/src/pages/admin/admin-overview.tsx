import React from 'react';
import {
  Building2,
  Play,
  Square,
  AlertTriangle,
  Container,
  RefreshCw,
} from 'lucide-react';
import { useAdminOverview } from '../../hooks/use-admin';
import { Skeleton } from '../../components/ui/skeleton';

// ─── Types ───────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number;
  color: string;
  icon: React.ReactNode;
}

// ─── Stat card ───────────────────────────────────────────────────────────────

function StatCard({ label, value, color, icon }: StatCardProps) {
  return (
    <div
      style={{
        background: 'var(--color-bg-primary)',
        border: '1px solid var(--color-border-primary)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--spacing-xl)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--spacing-md)',
        boxShadow: 'var(--shadow-sm)',
        transition: 'box-shadow 0.15s ease',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow =
          '0 4px 12px color-mix(in srgb, var(--color-border-primary) 40%, transparent)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-sm)';
      }}
    >
      {/* Icon badge */}
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 'var(--radius-md)',
          background: `color-mix(in srgb, ${color} 12%, transparent)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>

      {/* Value */}
      <div
        style={{
          fontSize: 'var(--font-size-3xl)',
          fontWeight: 'var(--font-weight-bold)',
          color: 'var(--color-text-primary)',
          lineHeight: 1,
          letterSpacing: '-0.02em',
        }}
      >
        {value.toLocaleString()}
      </div>

      {/* Label */}
      <div
        style={{
          fontSize: 'var(--font-size-sm)',
          color: 'var(--color-text-tertiary)',
          fontWeight: 'var(--font-weight-medium)',
        }}
      >
        {label}
      </div>
    </div>
  );
}

// ─── Skeleton card ───────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div
      style={{
        background: 'var(--color-bg-primary)',
        border: '1px solid var(--color-border-primary)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--spacing-xl)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--spacing-md)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <Skeleton width={40} height={40} borderRadius="var(--radius-md)" />
      <Skeleton width={48} height={28} borderRadius="var(--radius-sm)" />
      <Skeleton width={88} height={14} borderRadius="var(--radius-sm)" />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function AdminOverviewPage() {
  const { data, isLoading, dataUpdatedAt } = useAdminOverview();

  const stats: StatCardProps[] = data
    ? [
        {
          label: 'Tenants',
          value: data.tenants,
          color: 'var(--color-accent-primary)',
          icon: <Building2 size={18} strokeWidth={2} />,
        },
        {
          label: 'Running apps',
          value: data.installations.running,
          color: 'var(--color-success)',
          icon: <Play size={18} strokeWidth={2} />,
        },
        {
          label: 'Stopped apps',
          value: data.installations.stopped,
          color: 'var(--color-warning)',
          icon: <Square size={18} strokeWidth={2} />,
        },
        {
          label: 'Errored apps',
          value: data.installations.error,
          color: 'var(--color-error)',
          icon: <AlertTriangle size={18} strokeWidth={2} />,
        },
        {
          label: 'Docker containers',
          value: data.containers,
          color: 'var(--color-info)',
          icon: <Container size={18} strokeWidth={2} />,
        },
      ]
    : [];

  const updatedAt = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--spacing-2xl)',
      }}
    >
      {/* Stat cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 'var(--spacing-lg)',
        }}
      >
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)
          : stats.map((stat) => <StatCard key={stat.label} {...stat} />)}
      </div>

      {/* Footer: last updated */}
      {updatedAt && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: 'var(--spacing-xs)',
            color: 'var(--color-text-tertiary)',
            fontSize: 'var(--font-size-xs)',
          }}
        >
          <RefreshCw size={12} strokeWidth={2} />
          <span>Last updated {updatedAt}</span>
        </div>
      )}
    </div>
  );
}
