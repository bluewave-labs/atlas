import { useState, useMemo, type CSSProperties } from 'react';
import { Shield, Users, Check, X, Eye, Plus, Pencil, Trash2, Info, Crown, Briefcase, TrendingUp, EyeIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  useCrmPermissions,
  useUpdateCrmPermission,
  type CrmRole,
  type CrmRecordAccess,
  type CrmPermissionWithUser,
  type CrmEntity,
  type CrmOperation,
  canAccess,
} from '../hooks';
import { Select } from '../../../components/ui/select';
import { Badge } from '../../../components/ui/badge';
import { Skeleton } from '../../../components/ui/skeleton';
import { Avatar } from '../../../components/ui/avatar';
import { Tooltip } from '../../../components/ui/tooltip';
import { StatusDot } from '../../../components/ui/status-dot';
import { StatCard } from '../../../components/ui/stat-card';

// ─── Constants ──────────────────────────────────────────────────────

const ROLES: CrmRole[] = ['admin', 'manager', 'sales', 'viewer'];

function getEntities(t: (key: string) => string): { id: CrmEntity; label: string; icon: typeof Eye }[] {
  return [
    { id: 'deals', label: t('crm.sidebar.deals'), icon: Eye },
    { id: 'contacts', label: t('crm.sidebar.contacts'), icon: Eye },
    { id: 'companies', label: t('crm.sidebar.companies'), icon: Eye },
    { id: 'activities', label: t('crm.sidebar.activities'), icon: Eye },
    { id: 'workflows', label: t('crm.sidebar.automations'), icon: Eye },
    { id: 'dashboard', label: t('crm.sidebar.dashboard'), icon: Eye },
  ];
}

function getOperations(t: (key: string) => string): { id: CrmOperation; label: string; icon: typeof Eye }[] {
  return [
    { id: 'view', label: t('crm.permissions.view'), icon: Eye },
    { id: 'create', label: t('crm.permissions.create'), icon: Plus },
    { id: 'update', label: t('crm.permissions.edit'), icon: Pencil },
    { id: 'delete', label: t('common.delete'), icon: Trash2 },
  ];
}

function getRoleOptions(t: (key: string) => string) {
  return [
    { value: 'admin', label: t('crm.permissions.admin') },
    { value: 'manager', label: t('crm.permissions.manager') },
    { value: 'sales', label: t('crm.permissions.sales') },
    { value: 'viewer', label: t('crm.permissions.viewer') },
  ];
}

function getAccessOptions(t: (key: string) => string) {
  return [
    { value: 'all', label: t('crm.permissions.allRecords') },
    { value: 'own', label: t('crm.permissions.ownRecords') },
  ];
}

const ROLE_COLORS: Record<CrmRole, string> = {
  admin: '#7c3aed',
  manager: '#2563eb',
  sales: '#f59e0b',
  viewer: '#6b7280',
};

function getRoleDescriptions(t: (key: string) => string): Record<CrmRole, string> {
  return {
    admin: t('crm.permissions.adminDesc'),
    manager: t('crm.permissions.managerDesc'),
    sales: t('crm.permissions.salesDesc'),
    viewer: t('crm.permissions.viewerDesc'),
  };
}

const ROLE_ICONS: Record<CrmRole, typeof Crown> = {
  admin: Crown,
  manager: Briefcase,
  sales: TrendingUp,
  viewer: EyeIcon,
};

// ─── Permission Matrix Cell ─────────────────────────────────────────

function MatrixCell({ allowed }: { allowed: boolean }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 24,
      height: 24,
    }}>
      <div style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: allowed ? 'var(--color-success)' : 'var(--color-border-secondary)',
      }} />
    </div>
  );
}

// ─── Permission Matrix (Odoo/Salesforce style) ──────────────────────

function PermissionMatrix() {
  const { t } = useTranslation();
  const ENTITIES = getEntities(t);
  const OPERATIONS = getOperations(t);
  const [hoveredRole, setHoveredRole] = useState<CrmRole | null>(null);

  return (
    <div style={{
      border: '1px solid var(--color-border-secondary)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
      marginBottom: 'var(--spacing-xl)',
    }}>
      {/* Header row: Entity names across the top */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '120px repeat(6, 1fr)',
        borderBottom: '1px solid var(--color-border-secondary)',
        background: 'var(--color-bg-secondary)',
      }}>
        <div style={{
          padding: 'var(--spacing-sm) var(--spacing-md)',
          fontSize: 'var(--font-size-xs)',
          fontWeight: 'var(--font-weight-medium)' as CSSProperties['fontWeight'],
          color: 'var(--color-text-tertiary)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}>
          {t('crm.permissions.role')}
        </div>
        {ENTITIES.map((entity) => (
          <div
            key={entity.id}
            style={{
              padding: 'var(--spacing-sm) var(--spacing-xs)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 'var(--font-weight-medium)' as CSSProperties['fontWeight'],
              color: 'var(--color-text-secondary)',
              textAlign: 'center',
            }}
          >
            {entity.label}
          </div>
        ))}
      </div>

      {/* Operation sub-header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '120px repeat(6, 1fr)',
        borderBottom: '1px solid var(--color-border-primary)',
        background: 'var(--color-bg-secondary)',
      }}>
        <div />
        {ENTITIES.map((entity) => (
          <div key={entity.id} style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 2,
            padding: '2px var(--spacing-xs)',
          }}>
            {OPERATIONS.map((op) => {
              const Icon = op.icon;
              return (
                <Tooltip key={op.id} content={op.label}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 28,
                    height: 20,
                  }}>
                    <Icon size={10} style={{ color: 'var(--color-text-tertiary)', opacity: 0.6 }} />
                  </div>
                </Tooltip>
              );
            })}
          </div>
        ))}
      </div>

      {/* Role rows */}
      {ROLES.map((role, idx) => (
        <div
          key={role}
          onMouseEnter={() => setHoveredRole(role)}
          onMouseLeave={() => setHoveredRole(null)}
          style={{
            display: 'grid',
            gridTemplateColumns: '120px repeat(6, 1fr)',
            borderBottom: idx < ROLES.length - 1 ? '1px solid var(--color-border-secondary)' : 'none',
            background: hoveredRole === role ? 'var(--color-surface-hover)' : 'transparent',
            transition: 'background var(--transition-fast)',
          }}
        >
          {/* Role name + color dot */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-sm)',
            padding: 'var(--spacing-sm) var(--spacing-md)',
          }}>
            <StatusDot color={ROLE_COLORS[role]} size={8} />
            <span style={{
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-medium)' as CSSProperties['fontWeight'],
              color: 'var(--color-text-primary)',
              textTransform: 'capitalize',
            }}>
              {role}
            </span>
          </div>

          {/* CRUD cells per entity */}
          {ENTITIES.map((entity) => (
            <div key={entity.id} style={{
              display: 'flex',
              justifyContent: 'center',
              gap: 2,
              padding: 'var(--spacing-xs)',
              alignItems: 'center',
            }}>
              {OPERATIONS.map((op) => (
                <MatrixCell key={op.id} allowed={canAccess(role, entity.id, op.id)} />
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── User Permission Row ────────────────────────────────────────────

function UserPermissionRow({ perm, onUpdate }: {
  perm: CrmPermissionWithUser;
  onUpdate: (userId: string, role: CrmRole, recordAccess: CrmRecordAccess) => void;
}) {
  const { t } = useTranslation();
  const ROLE_OPTIONS = getRoleOptions(t);
  const ACCESS_OPTIONS = getAccessOptions(t);
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 140px 170px',
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
        onChange={(v) => onUpdate(perm.userId, v as CrmRole, perm.recordAccess)}
        options={ROLE_OPTIONS}
        size="sm"
      />

      {/* Record access selector */}
      <Select
        value={perm.recordAccess}
        onChange={(v) => onUpdate(perm.userId, perm.role, v as CrmRecordAccess)}
        options={ACCESS_OPTIONS}
        size="sm"
      />
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────

export function PermissionsView() {
  const { t } = useTranslation();
  const { data, isLoading } = useCrmPermissions();
  const updatePermission = useUpdateCrmPermission();

  const permissions = data?.permissions ?? [];

  const handleUpdate = (userId: string, role: CrmRole, recordAccess: CrmRecordAccess) => {
    updatePermission.mutate({ userId, role, recordAccess });
  };

  if (isLoading) {
    return (
      <div style={{ padding: 'var(--spacing-xl)' }}>
        <Skeleton height={32} style={{ marginBottom: 'var(--spacing-md)' }} />
        <Skeleton height={200} style={{ marginBottom: 'var(--spacing-xl)' }} />
        <Skeleton height={48} style={{ marginBottom: 'var(--spacing-sm)' }} />
        <Skeleton height={48} style={{ marginBottom: 'var(--spacing-sm)' }} />
        <Skeleton height={48} />
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 'var(--spacing-xl)', fontFamily: 'var(--font-family)' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--spacing-sm)',
        marginBottom: 'var(--spacing-sm)',
      }}>
        <Shield size={18} style={{ color: 'var(--color-accent-primary)' }} />
        <span style={{
          fontSize: 'var(--font-size-lg)',
          fontWeight: 'var(--font-weight-semibold)' as CSSProperties['fontWeight'],
          color: 'var(--color-text-primary)',
        }}>
          {t('crm.permissions.title', 'CRM permissions')}
        </span>
      </div>
      <p style={{
        fontSize: 'var(--font-size-sm)',
        color: 'var(--color-text-tertiary)',
        marginBottom: 'var(--spacing-xl)',
        lineHeight: 'var(--line-height-normal)',
      }}>
        {t('crm.permissions.description', 'Control what each role can do. Assign roles to team members below.')}
      </p>

      {/* Role descriptions */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 'var(--spacing-sm)',
        marginBottom: 'var(--spacing-xl)',
      }}>
        {ROLES.map((role) => (
          <StatCard
            key={role}
            label={role}
            value={role.charAt(0).toUpperCase() + role.slice(1)}
            subtitle={getRoleDescriptions(t)[role]}
            color={ROLE_COLORS[role]}
            icon={ROLE_ICONS[role]}
          />
        ))}
      </div>

      {/* CRUD Permission Matrix */}
      <div style={{
        fontSize: 'var(--font-size-xs)',
        fontWeight: 'var(--font-weight-medium)' as CSSProperties['fontWeight'],
        color: 'var(--color-text-tertiary)',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        marginBottom: 'var(--spacing-sm)',
      }}>
        {t('crm.permissions.matrix', 'Permission matrix')}
      </div>
      <PermissionMatrix />

      {/* Legend */}
      <div style={{
        display: 'flex',
        gap: 'var(--spacing-lg)',
        marginBottom: 'var(--spacing-xl)',
        fontSize: 'var(--font-size-xs)',
        color: 'var(--color-text-tertiary)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Eye size={10} /> {t('crm.permissions.view')}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Plus size={10} /> {t('crm.permissions.create')}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Pencil size={10} /> {t('crm.permissions.edit')}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Trash2 size={10} /> {t('common.delete')}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <MatrixCell allowed={true} /> {t('crm.permissions.allowed')}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <MatrixCell allowed={false} /> {t('crm.permissions.denied')}
        </div>
      </div>

      {/* Team members section */}
      <div style={{
        fontSize: 'var(--font-size-xs)',
        fontWeight: 'var(--font-weight-medium)' as CSSProperties['fontWeight'],
        color: 'var(--color-text-tertiary)',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        marginBottom: 'var(--spacing-sm)',
      }}>
        {t('crm.permissions.teamMembers', 'Team member assignments')}
      </div>

      <div style={{
        border: '1px solid var(--color-border-secondary)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
      }}>
        {/* Table header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 140px 170px',
          gap: 'var(--spacing-md)',
          padding: 'var(--spacing-sm) var(--spacing-lg)',
          background: 'var(--color-bg-secondary)',
          borderBottom: '1px solid var(--color-border-secondary)',
        }}>
          <span style={headerStyle}>{t('crm.permissions.user')}</span>
          <span style={headerStyle}>{t('crm.permissions.role')}</span>
          <span style={headerStyle}>{t('crm.permissions.recordAccess')}</span>
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
              {t('crm.permissions.noMembers', 'No team members found')}
            </span>
          </div>
        ) : (
          permissions.map((perm) => (
            <UserPermissionRow
              key={perm.userId}
              perm={perm}
              onUpdate={handleUpdate}
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
