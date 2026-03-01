import { useState } from 'react';
import type { CSSProperties } from 'react';
import {
  Building2,
  Globe,
  CreditCard,
  Cpu,
  HardDrive,
  MemoryStick,
  Calendar,
  Hash,
  Shield,
  Copy,
  Check,
} from 'lucide-react';
import { useAuthStore } from '../../stores/auth-store';
import { useMyTenants, useTenantUsers } from '../../hooks/use-platform';
import { useInstalledApps } from '../../hooks/use-installed-apps';

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const sectionStyle: CSSProperties = {
  background: 'var(--color-bg-primary)',
  border: '1px solid var(--color-border-primary)',
  borderRadius: 'var(--radius-md)',
  overflow: 'hidden',
};

const sectionHeaderStyle: CSSProperties = {
  padding: 'var(--spacing-lg) var(--spacing-xl)',
  borderBottom: '1px solid var(--color-border-primary)',
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--spacing-sm)',
};

const sectionTitleStyle: CSSProperties = {
  fontSize: 'var(--font-size-sm)',
  fontWeight: 'var(--font-weight-semibold)' as CSSProperties['fontWeight'],
  color: 'var(--color-text-primary)',
};

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: 'var(--spacing-md) var(--spacing-xl)',
  borderBottom: '1px solid var(--color-border-secondary)',
  gap: 'var(--spacing-md)',
  minHeight: 48,
};

const labelStyle: CSSProperties = {
  fontSize: 'var(--font-size-sm)',
  color: 'var(--color-text-secondary)',
  width: 160,
  flexShrink: 0,
  fontWeight: 'var(--font-weight-medium)' as CSSProperties['fontWeight'],
};

const valueStyle: CSSProperties = {
  fontSize: 'var(--font-size-sm)',
  color: 'var(--color-text-primary)',
  flex: 1,
  minWidth: 0,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatBytes(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb} MB`;
}

function PlanBadge({ plan }: { plan: string }) {
  const colors: Record<string, { bg: string; fg: string }> = {
    starter: { bg: 'color-mix(in srgb, #6b7280 12%, transparent)', fg: '#6b7280' },
    pro: { bg: 'color-mix(in srgb, var(--color-accent-primary) 12%, transparent)', fg: 'var(--color-accent-primary)' },
    enterprise: { bg: 'color-mix(in srgb, #7c3aed 12%, transparent)', fg: '#7c3aed' },
  };
  const c = colors[plan] ?? colors.starter;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 10px',
        borderRadius: 12,
        fontSize: 'var(--font-size-xs)',
        fontWeight: 'var(--font-weight-semibold)' as CSSProperties['fontWeight'],
        background: c.bg,
        color: c.fg,
        textTransform: 'capitalize',
      }}
    >
      {plan}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const isActive = status === 'active';
  const color = isActive ? 'var(--color-success, #16a34a)' : '#ef4444';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '2px 10px',
        borderRadius: 12,
        fontSize: 'var(--font-size-xs)',
        fontWeight: 'var(--font-weight-medium)' as CSSProperties['fontWeight'],
        background: `color-mix(in srgb, ${color} 10%, transparent)`,
        color,
        textTransform: 'capitalize',
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
      {status}
    </span>
  );
}

function CopyableValue({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
      <span
        style={{
          fontFamily: 'var(--font-family-mono, monospace)',
          fontSize: 'var(--font-size-xs)',
          color: 'var(--color-text-secondary)',
          background: 'var(--color-bg-secondary)',
          padding: '2px 8px',
          borderRadius: 'var(--radius-sm)',
          userSelect: 'all',
        }}
      >
        {value}
      </span>
      <button
        onClick={handleCopy}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 24,
          height: 24,
          borderRadius: 'var(--radius-sm)',
          border: 'none',
          background: 'transparent',
          color: copied ? 'var(--color-success, #16a34a)' : 'var(--color-text-tertiary)',
          cursor: 'pointer',
          transition: 'color 0.15s ease',
        }}
        title="Copy to clipboard"
      >
        {copied ? <Check size={13} /> : <Copy size={13} />}
      </button>
    </div>
  );
}

function UsageBar({ used, total, label, color }: { used: number; total: number; label: string; color: string }) {
  const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0;
  return (
    <div style={{ flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>{label}</span>
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
          {used} / {total}
        </span>
      </div>
      <div
        style={{
          height: 6,
          borderRadius: 3,
          background: 'var(--color-bg-secondary)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            borderRadius: 3,
            background: color,
            transition: 'width 0.3s ease',
          }}
        />
      </div>
    </div>
  );
}

function SkeletonBlock() {
  return (
    <div style={sectionStyle}>
      <div style={sectionHeaderStyle}>
        <div style={{ width: 120, height: 16, borderRadius: 'var(--radius-sm)', background: 'var(--color-border-primary)', opacity: 0.5 }} />
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} style={{ ...rowStyle, borderBottom: i < 3 ? rowStyle.borderBottom : 'none' }}>
          <div style={{ width: 100, height: 14, borderRadius: 'var(--radius-sm)', background: 'var(--color-border-primary)', opacity: 0.4 }} />
          <div style={{ width: 180, height: 14, borderRadius: 'var(--radius-sm)', background: 'var(--color-border-primary)', opacity: 0.3 }} />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// OrgSettingsPage
// ---------------------------------------------------------------------------

export function OrgSettingsPage() {
  const storeTenantId = useAuthStore((s) => s.tenantId);
  const { data: tenants, isLoading: tenantsLoading } = useMyTenants();
  const tenant = tenants?.[0];
  const effectiveTenantId = storeTenantId ?? tenant?.id;

  const { data: users, isLoading: usersLoading } = useTenantUsers(effectiveTenantId ?? undefined);
  const { installations, isLoading: appsLoading } = useInstalledApps();

  const isLoading = tenantsLoading || usersLoading || appsLoading;

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)' }}>
        <SkeletonBlock />
        <SkeletonBlock />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
        No organization found.
      </div>
    );
  }

  const memberCount = users?.length ?? 0;
  const appCount = installations?.length ?? 0;
  const runningApps = installations?.filter((a) => a.status === 'running').length ?? 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)', maxWidth: 720 }}>
      {/* Organization profile */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <Building2 size={15} style={{ color: 'var(--color-text-tertiary)' }} />
          <span style={sectionTitleStyle}>Organization profile</span>
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>Name</span>
          <span style={valueStyle}>{tenant.name}</span>
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>Slug</span>
          <div style={valueStyle}>
            <CopyableValue value={tenant.slug} />
          </div>
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>Organization ID</span>
          <div style={valueStyle}>
            <CopyableValue value={tenant.id} />
          </div>
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>Status</span>
          <div style={valueStyle}>
            <StatusBadge status={tenant.status} />
          </div>
        </div>
        <div style={{ ...rowStyle, borderBottom: 'none' }}>
          <span style={labelStyle}>Created</span>
          <span style={valueStyle}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Calendar size={13} style={{ color: 'var(--color-text-tertiary)' }} />
              {formatDate(tenant.createdAt)}
            </span>
          </span>
        </div>
      </div>

      {/* Plan & billing */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <CreditCard size={15} style={{ color: 'var(--color-text-tertiary)' }} />
          <span style={sectionTitleStyle}>Plan & billing</span>
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>Current plan</span>
          <div style={valueStyle}>
            <PlanBadge plan={tenant.plan} />
          </div>
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>Team members</span>
          <span style={valueStyle}>{memberCount}</span>
        </div>
        <div style={{ ...rowStyle, borderBottom: 'none' }}>
          <span style={labelStyle}>Installed apps</span>
          <span style={valueStyle}>
            {appCount} total, {runningApps} running
          </span>
        </div>
      </div>

      {/* Resource quotas */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <Shield size={15} style={{ color: 'var(--color-text-tertiary)' }} />
          <span style={sectionTitleStyle}>Resource quotas</span>
        </div>
        <div style={{ padding: 'var(--spacing-lg) var(--spacing-xl)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 'var(--radius-sm)',
                background: 'color-mix(in srgb, #3b82f6 10%, transparent)',
                color: '#3b82f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Cpu size={15} />
            </div>
            <UsageBar
              used={appCount}
              total={tenant.quotaCpu}
              label="CPU cores"
              color="#3b82f6"
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 'var(--radius-sm)',
                background: 'color-mix(in srgb, #8b5cf6 10%, transparent)',
                color: '#8b5cf6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <MemoryStick size={15} />
            </div>
            <UsageBar
              used={0}
              total={tenant.quotaMemoryMb}
              label={`Memory (${formatBytes(tenant.quotaMemoryMb)} allocated)`}
              color="#8b5cf6"
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 'var(--radius-sm)',
                background: 'color-mix(in srgb, var(--color-accent-primary) 10%, transparent)',
                color: 'var(--color-accent-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <HardDrive size={15} />
            </div>
            <UsageBar
              used={0}
              total={tenant.quotaStorageMb}
              label={`Storage (${formatBytes(tenant.quotaStorageMb)} allocated)`}
              color="var(--color-accent-primary)"
            />
          </div>
        </div>
      </div>

      {/* Infrastructure */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <Globe size={15} style={{ color: 'var(--color-text-tertiary)' }} />
          <span style={sectionTitleStyle}>Infrastructure</span>
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>Namespace</span>
          <div style={valueStyle}>
            <CopyableValue value={tenant.k8sNamespace} />
          </div>
        </div>
        <div style={{ ...rowStyle, borderBottom: 'none' }}>
          <span style={labelStyle}>Owner ID</span>
          <div style={valueStyle}>
            <CopyableValue value={tenant.ownerId} />
          </div>
        </div>
      </div>
    </div>
  );
}
