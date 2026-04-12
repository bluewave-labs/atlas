import { useState } from 'react';
import type { CSSProperties } from 'react';
import {
  Building2,
  CreditCard,
  Calendar,
  Copy,
  Check,
  Pencil,
  X,
} from 'lucide-react';
import { useAuthStore } from '../../stores/auth-store';
import { useMyTenants, useTenantUsers, useUpdateTenantName } from '../../hooks/use-platform';
import { useAllTenantPermissions } from '../../hooks/use-app-permissions';
import { Chip } from '../../components/ui/chip';
import { AlertBanner } from '../../components/ui/alert-banner';
import { Skeleton } from '../../components/ui/skeleton';
import { IconButton } from '../../components/ui/icon-button';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';

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

const PLAN_COLORS: Record<string, string> = {
  starter: '#6b7280',
  pro: 'var(--color-accent-primary)',
  enterprise: '#7c3aed',
};

function PlanBadge({ plan }: { plan: string }) {
  const color = PLAN_COLORS[plan] ?? PLAN_COLORS.starter;
  return (
    <Chip
      color={color}
      height={20}
      style={{
        padding: '0 10px',
        fontWeight: 'var(--font-weight-semibold)' as CSSProperties['fontWeight'],
        textTransform: 'capitalize',
      }}
    >
      {plan}
    </Chip>
  );
}

function StatusBadge({ status }: { status: string }) {
  const isActive = status === 'active';
  const color = isActive ? 'var(--color-success, #16a34a)' : 'var(--color-error, #ef4444)';
  return (
    <Chip
      color={color}
      height={20}
      style={{
        padding: '0 10px',
        fontWeight: 'var(--font-weight-medium)' as CSSProperties['fontWeight'],
        textTransform: 'capitalize',
      }}
    >
      {status}
    </Chip>
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
      <IconButton
        icon={copied ? <Check size={13} /> : <Copy size={13} />}
        label={copied ? 'Copied' : 'Copy to clipboard'}
        size={24}
        tooltip
        tooltipSide="top"
        active={copied}
        activeColor="var(--color-success, #16a34a)"
        onClick={handleCopy}
      />
    </div>
  );
}

function SkeletonBlock() {
  return (
    <div style={sectionStyle}>
      <div style={sectionHeaderStyle}>
        <Skeleton width={120} height={16} borderRadius="var(--radius-sm)" />
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} style={{ ...rowStyle, borderBottom: i < 3 ? rowStyle.borderBottom : 'none' }}>
          <Skeleton width={100} height={14} borderRadius="var(--radius-sm)" />
          <Skeleton width={180} height={14} borderRadius="var(--radius-sm)" />
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
  const { data: allPermissions } = useAllTenantPermissions(!!effectiveTenantId);
  const updateTenantName = useUpdateTenantName();
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');

  const isLoading = tenantsLoading || usersLoading;

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

  const isOwner = tenant.role === 'owner';

  const memberCount = users?.length ?? 0;

  // Count members without explicit HR app permission (non-admin/owner)
  const membersWithoutHr = (() => {
    if (!users || !allPermissions) return 0;
    const adminOwnerRoles = new Set(['admin', 'owner']);
    const nonAdminMembers = users.filter(u => !adminOwnerRoles.has(u.role));
    const hrUserIds = new Set(
      allPermissions
        .filter(p => p.appId === 'hr')
        .map(p => p.userId),
    );
    return nonAdminMembers.filter(u => !hrUserIds.has(u.userId)).length;
  })();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)', maxWidth: 720 }}>
      {/* Page header */}
      <div>
        <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)', margin: 0 }}>
          Organization settings
        </h2>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', margin: '4px 0 0' }}>
          {memberCount} team member{memberCount !== 1 ? 's' : ''} in this organization.
        </p>
      </div>

      {/* Organization profile */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <Building2 size={15} style={{ color: 'var(--color-text-tertiary)' }} />
          <span style={sectionTitleStyle}>Organization profile</span>
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>Name</span>
          {editingName ? (
            <div style={{ ...valueStyle, display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
              <Input
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                size="sm"
                autoFocus
                style={{ flex: 1, maxWidth: 300 }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && nameInput.trim()) {
                    updateTenantName.mutate({ tenantId: tenant.id, name: nameInput.trim() }, {
                      onSuccess: () => setEditingName(false),
                    });
                  }
                  if (e.key === 'Escape') setEditingName(false);
                }}
              />
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  if (nameInput.trim()) {
                    updateTenantName.mutate({ tenantId: tenant.id, name: nameInput.trim() }, {
                      onSuccess: () => setEditingName(false),
                    });
                  }
                }}
                disabled={!nameInput.trim() || updateTenantName.isPending}
              >
                Save
              </Button>
              <IconButton
                icon={<X size={13} />}
                label="Cancel"
                size={24}
                onClick={() => setEditingName(false)}
              />
            </div>
          ) : (
            <div style={{ ...valueStyle, display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
              <span>{tenant.name}</span>
              {isOwner && (
                <IconButton
                  icon={<Pencil size={13} />}
                  label="Edit name"
                  size={24}
                  tooltip
                  tooltipSide="top"
                  onClick={() => {
                    setNameInput(tenant.name);
                    setEditingName(true);
                  }}
                />
              )}
            </div>
          )}
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

      {/* Subscription */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <CreditCard size={15} style={{ color: 'var(--color-text-tertiary)' }} />
          <span style={sectionTitleStyle}>Subscription</span>
        </div>
        <div style={{ ...rowStyle, borderBottom: 'none' }}>
          <span style={labelStyle}>Team members</span>
          <span style={valueStyle}>{memberCount}</span>
        </div>
      </div>

      {/* HR access warning */}
      {membersWithoutHr > 0 && (
        <AlertBanner variant="warning">
          {membersWithoutHr} member{membersWithoutHr !== 1 ? 's' : ''} don't have access to HR.
          They won't be able to view their employee profile, submit leave requests, or check attendance.
        </AlertBanner>
      )}

    </div>
  );
}
