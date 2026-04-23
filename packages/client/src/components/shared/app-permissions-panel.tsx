import { type CSSProperties } from 'react';
import { Shield, Users, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  useAppPermissions,
  useUpdateAppPermission,
  useDeleteAppPermission,
  type AppRole,
  type AppRecordAccess,
  type AppPermissionWithUser,
} from '../../hooks/use-app-permissions';
import { Select } from '../ui/select';
import { IconButton } from '../ui/icon-button';
import { Skeleton } from '../ui/skeleton';
import { Avatar } from '../ui/avatar';

// ─── Props ─────────────────────────────────────────────────────────

interface AppPermissionsPanelProps {
  appId: string;
  appName: string;
  appColor: string;
}

// ─── Constants ─────────────────────────────────────────────────────

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'editor', label: 'Editor' },
  { value: 'viewer', label: 'Viewer' },
];

// recordAccess: 'own' is only enforced by CRM services today — see RBAC audit.
// Hide the "Own records only" option for apps that don't actually honor it,
// otherwise the setting silently does nothing.
const APPS_SUPPORTING_OWN_RECORD_ACCESS = new Set(['crm']);

const ROLE_COLORS: Record<AppRole, string> = {
  admin: '#16a34a',
  editor: '#2563eb',
  viewer: '#6b7280',
};

const ROLE_DESCRIPTIONS: Record<AppRole, string> = {
  admin: 'Full access to all features and settings',
  editor: 'Create, edit, and delete own records',
  viewer: 'Read-only access to all records',
};

// ─── Role Cards ────────────────────────────────────────────────────

function RoleCards() {
  const { t } = useTranslation();
  const roles: AppRole[] = ['admin', 'editor', 'viewer'];
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: 'var(--spacing-sm)',
      marginBottom: 'var(--spacing-xl)',
    }}>
      {roles.map((role) => (
        <div
          key={role}
          style={{
            padding: 'var(--spacing-md)',
            background: 'var(--color-bg-tertiary)',
            borderRadius: 'var(--radius-md)',
            borderLeft: `3px solid ${ROLE_COLORS[role]}`,
          }}
        >
          <div style={{
            fontSize: 'var(--font-size-sm)',
            fontWeight: 'var(--font-weight-medium)' as CSSProperties['fontWeight'],
            color: 'var(--color-text-primary)',
            textTransform: 'capitalize',
            marginBottom: 4,
          }}>
            {t(`permissions.role${role.charAt(0).toUpperCase() + role.slice(1)}`, role)}
          </div>
          <div style={{
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-text-tertiary)',
            lineHeight: 'var(--line-height-normal)',
          }}>
            {t(`permissions.roleDesc${role.charAt(0).toUpperCase() + role.slice(1)}`, ROLE_DESCRIPTIONS[role])}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── User Permission Row ───────────────────────────────────────────

function UserPermissionRow({
  perm,
  supportsOwnAccess,
  onUpdate,
  onReset,
}: {
  perm: AppPermissionWithUser;
  supportsOwnAccess: boolean;
  onUpdate: (userId: string, role: AppRole, recordAccess: AppRecordAccess) => void;
  onReset: (userId: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 130px 160px 36px',
      gap: 'var(--spacing-md)',
      alignItems: 'center',
      padding: 'var(--spacing-sm) var(--spacing-lg)',
      borderBottom: '1px solid var(--color-border-secondary)',
    }}>
      {/* User info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', minWidth: 0 }}>
        <Avatar name={perm.userName} email={perm.userEmail} size={32} />
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize: 'var(--font-size-sm)',
            fontWeight: 'var(--font-weight-medium)' as CSSProperties['fontWeight'],
            color: 'var(--color-text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {perm.userName || perm.userEmail}
          </div>
          {perm.userName && (
            <div style={{
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-text-tertiary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {perm.userEmail}
            </div>
          )}
        </div>
      </div>

      {/* Role selector */}
      <Select
        value={perm.role}
        onChange={(v) => onUpdate(perm.userId, v as AppRole, perm.recordAccess)}
        options={ROLE_OPTIONS.map((o) => ({
          ...o,
          label: t(`permissions.role${o.value.charAt(0).toUpperCase() + o.value.slice(1)}`, o.label),
        }))}
        size="sm"
      />

      {/* Record access selector */}
      <Select
        value={supportsOwnAccess ? perm.recordAccess : 'all'}
        onChange={(v) => onUpdate(perm.userId, perm.role, v as AppRecordAccess)}
        options={
          supportsOwnAccess
            ? [
                { value: 'all', label: t('permissions.allRecords', 'All records') },
                { value: 'own', label: t('permissions.ownRecords', 'Own records only') },
              ]
            : [{ value: 'all', label: t('permissions.allRecords', 'All records') }]
        }
        size="sm"
        disabled={!supportsOwnAccess}
      />

      {/* Reset button */}
      <IconButton
        icon={<RotateCcw size={14} />}
        label={t('permissions.reset', 'Reset to default')}
        size={28}
        tooltip
        onClick={() => onReset(perm.userId)}
      />
    </div>
  );
}

// ─── Loading Skeleton ──────────────────────────────────────────────

function PermissionsSkeleton() {
  return (
    <div style={{ padding: 'var(--spacing-xl)' }}>
      {/* Role cards skeleton */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-xl)' }}>
        <Skeleton width="100%" height={72} borderRadius="var(--radius-md)" />
        <Skeleton width="100%" height={72} borderRadius="var(--radius-md)" />
        <Skeleton width="100%" height={72} borderRadius="var(--radius-md)" />
      </div>
      {/* Table skeleton */}
      <Skeleton height={32} style={{ marginBottom: 'var(--spacing-sm)' }} />
      <Skeleton height={48} style={{ marginBottom: 'var(--spacing-sm)' }} />
      <Skeleton height={48} style={{ marginBottom: 'var(--spacing-sm)' }} />
      <Skeleton height={48} />
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────

export function AppPermissionsPanel({ appId, appName, appColor }: AppPermissionsPanelProps) {
  const { t } = useTranslation();
  const { data, isLoading } = useAppPermissions(appId);
  const updatePermission = useUpdateAppPermission(appId);
  const deletePermission = useDeleteAppPermission(appId);

  const permissions = data?.permissions ?? [];
  const supportsOwnAccess = APPS_SUPPORTING_OWN_RECORD_ACCESS.has(appId);

  const handleUpdate = (userId: string, role: AppRole, recordAccess: AppRecordAccess) => {
    updatePermission.mutate({ userId, role, recordAccess });
  };

  const handleReset = (userId: string) => {
    deletePermission.mutate(userId);
  };

  if (isLoading) {
    return <PermissionsSkeleton />;
  }

  return (
    <div style={{ padding: 'var(--spacing-xl)', fontFamily: 'var(--font-family)' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--spacing-sm)',
        marginBottom: 'var(--spacing-sm)',
      }}>
        <Shield size={18} style={{ color: 'var(--color-text-tertiary)' }} />
        <span style={{
          fontSize: 'var(--font-size-lg)',
          fontWeight: 'var(--font-weight-semibold)' as CSSProperties['fontWeight'],
          color: 'var(--color-text-primary)',
        }}>
          {t('permissions.title', '{{appName}} permissions', { appName })}
        </span>
      </div>
      <p style={{
        fontSize: 'var(--font-size-sm)',
        color: 'var(--color-text-tertiary)',
        marginBottom: 'var(--spacing-xl)',
        lineHeight: 'var(--line-height-normal)',
        marginTop: 0,
      }}>
        {t('permissions.description', 'Manage who can access {{appName}} and what they can do.', { appName })}
      </p>

      {/* Role cards */}
      <RoleCards />

      {/* Team members section label */}
      <div style={{
        fontSize: 'var(--font-size-xs)',
        fontWeight: 'var(--font-weight-medium)' as CSSProperties['fontWeight'],
        color: 'var(--color-text-tertiary)',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        marginBottom: 'var(--spacing-sm)',
      }}>
        {t('permissions.teamMembers', 'Team member assignments')}
      </div>

      {/* Members table */}
      <div style={{
        border: '1px solid var(--color-border-secondary)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
      }}>
        {/* Table header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 130px 160px 36px',
          gap: 'var(--spacing-md)',
          padding: 'var(--spacing-sm) var(--spacing-lg)',
          background: 'var(--color-bg-secondary)',
          borderBottom: '1px solid var(--color-border-secondary)',
        }}>
          <span style={headerStyle}>{t('permissions.user', 'User')}</span>
          <span style={headerStyle}>{t('permissions.role', 'Role')}</span>
          <span style={headerStyle}>{t('permissions.recordAccess', 'Record access')}</span>
          <span />
        </div>

        {/* Permission rows */}
        {permissions.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--spacing-md)',
            padding: 'var(--spacing-2xl)',
            color: 'var(--color-text-tertiary)',
          }}>
            <Users size={32} />
            <span style={{ fontSize: 'var(--font-size-sm)' }}>
              {t('permissions.noMembers', 'No team members found')}
            </span>
          </div>
        ) : (
          permissions.map((perm) => (
            <UserPermissionRow
              key={perm.userId}
              perm={perm}
              supportsOwnAccess={supportsOwnAccess}
              onUpdate={handleUpdate}
              onReset={handleReset}
            />
          ))
        )}
      </div>
    </div>
  );
}

const headerStyle: CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  fontWeight: 'var(--font-weight-medium)',
  color: 'var(--color-text-tertiary)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};
