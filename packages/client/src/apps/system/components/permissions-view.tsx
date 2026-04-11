import { type CSSProperties, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Shield } from 'lucide-react';
import {
  useAppPermissions,
  useSetAppPermission,
  useRevertAppPermission,
  useAppPermissionsAudit,
  type AppPermissionRole,
  type AppPermissionRecordAccess,
  type AppPermissionCell,
  type PermissionAuditRow,
} from '../hooks';
import { Select } from '../../../components/ui/select';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Avatar } from '../../../components/ui/avatar';
import { Skeleton } from '../../../components/ui/skeleton';

export function PermissionsView() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'matrix' | 'history'>('matrix');
  const { data, isLoading, error } = useAppPermissions();
  const setPerm = useSetAppPermission();
  const revertPerm = useRevertAppPermission();

  const roleOptions = useMemo(
    () => [
      { value: 'admin', label: t('system.permissions.roleAdmin') },
      { value: 'editor', label: t('system.permissions.roleEditor') },
      { value: 'viewer', label: t('system.permissions.roleViewer') },
    ],
    [t],
  );

  const accessOptions = useMemo(
    () => [
      { value: 'all', label: t('system.permissions.recordAccessAll') },
      { value: 'own', label: t('system.permissions.recordAccessOwn') },
    ],
    [t],
  );

  const cellMap = useMemo(() => {
    const m = new Map<string, AppPermissionCell>();
    for (const c of data?.cells ?? []) m.set(`${c.userId}:${c.appId}`, c);
    return m;
  }, [data]);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Skeleton style={{ height: 32, width: 200 }} />
        <Skeleton style={{ height: 48, width: '100%' }} />
        <Skeleton style={{ height: 48, width: '100%' }} />
        <Skeleton style={{ height: 48, width: '100%' }} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-sm)' }}>
        {t('system.permissions.saveError')}
      </div>
    );
  }

  const { users, apps } = data;

  const handleRoleChange = (
    userId: string,
    appId: string,
    role: AppPermissionRole,
    recordAccess: AppPermissionRecordAccess,
  ) => {
    setPerm.mutate({ userId, appId, role, recordAccess });
  };

  const handleRevert = (userId: string, appId: string) => {
    revertPerm.mutate({ userId, appId });
  };

  const headerStyle: CSSProperties = {
    fontSize: 'var(--font-size-xs)',
    fontWeight: 600,
    color: 'var(--color-text-tertiary)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    padding: '8px 12px',
    textAlign: 'left',
    borderBottom: '1px solid var(--color-border-primary)',
    background: 'var(--color-bg-secondary)',
    whiteSpace: 'nowrap',
  };

  const cellStyle: CSSProperties = {
    padding: '8px 12px',
    borderBottom: '1px solid var(--color-border-secondary)',
    verticalAlign: 'top',
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        fontFamily: 'var(--font-family)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Shield size={18} style={{ color: 'var(--color-accent-primary)' }} />
        <h2
          style={{
            fontSize: 'var(--font-size-xl)',
            fontWeight: 700,
            color: 'var(--color-text-primary)',
            margin: 0,
          }}
        >
          {t('system.permissions.title')}
        </h2>
      </div>

      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--color-border-primary)' }}>
        <TabButton active={tab === 'matrix'} onClick={() => setTab('matrix')}>
          {t('system.permissions.tabMatrix')}
        </TabButton>
        <TabButton active={tab === 'history'} onClick={() => setTab('history')}>
          {t('system.permissions.tabHistory')}
        </TabButton>
      </div>

      {tab === 'history' ? (
        <HistoryTab />
      ) : (
      <div
        style={{
          border: '1px solid var(--color-border-primary)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'auto',
          background: 'var(--color-bg-primary)',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...headerStyle, minWidth: 220 }}>
                {t('system.permissions.columnUser')}
              </th>
              {apps.map((app) => (
                <th key={app.id} style={{ ...headerStyle, minWidth: 220 }}>
                  {app.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const isOwner = user.tenantRole === 'owner';
              return (
                <tr key={user.userId}>
                  <td style={cellStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <Avatar name={user.userName} email={user.userEmail} size={32} />
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            fontSize: 'var(--font-size-sm)',
                            fontWeight: 500,
                            color: 'var(--color-text-primary)',
                          }}
                        >
                          <span
                            style={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {user.userName || user.userEmail}
                          </span>
                          {isOwner && (
                            <Badge variant="primary">
                              {t('system.permissions.ownerBadge')}
                            </Badge>
                          )}
                        </div>
                        {user.userName && (
                          <div
                            style={{
                              fontSize: 'var(--font-size-xs)',
                              color: 'var(--color-text-tertiary)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {user.userEmail}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  {apps.map((app) => {
                    const cell = cellMap.get(`${user.userId}:${app.id}`);
                    if (!cell) return <td key={app.id} style={cellStyle} />;
                    const disabled = isOwner;
                    const tooltip = cell.inherited
                      ? t('system.permissions.inheritedTooltip')
                      : undefined;
                    const cellColor = cell.inherited
                      ? 'var(--color-text-tertiary)'
                      : 'var(--color-text-primary)';
                    return (
                      <td key={app.id} style={cellStyle}>
                        <div
                          title={tooltip}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 6,
                            color: cellColor,
                            opacity: cell.inherited ? 0.75 : 1,
                          }}
                        >
                          <Select
                            value={cell.role}
                            onChange={(v) =>
                              handleRoleChange(
                                user.userId,
                                app.id,
                                v as AppPermissionRole,
                                cell.recordAccess,
                              )
                            }
                            options={roleOptions}
                            size="sm"
                            disabled={disabled}
                          />
                          <Select
                            value={cell.recordAccess}
                            onChange={(v) =>
                              handleRoleChange(
                                user.userId,
                                app.id,
                                cell.role,
                                v as AppPermissionRecordAccess,
                              )
                            }
                            options={accessOptions}
                            size="sm"
                            disabled={disabled}
                          />
                          {!disabled && !cell.inherited && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRevert(user.userId, app.id)}
                            >
                              {t('system.permissions.resetButton')}
                            </Button>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: 'none',
        border: 'none',
        padding: '8px 14px',
        fontSize: 'var(--font-size-sm)',
        fontWeight: active ? 600 : 500,
        color: active ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
        borderBottom: active
          ? '2px solid var(--color-accent-primary)'
          : '2px solid transparent',
        marginBottom: -1,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

function HistoryTab() {
  const { t } = useTranslation();
  const { data, isLoading } = useAppPermissionsAudit({ limit: 100 });

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Skeleton style={{ height: 40 }} />
        <Skeleton style={{ height: 40 }} />
        <Skeleton style={{ height: 40 }} />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div
        style={{
          padding: 24,
          border: '1px solid var(--color-border-primary)',
          borderRadius: 'var(--radius-lg)',
          color: 'var(--color-text-tertiary)',
          fontSize: 'var(--font-size-sm)',
          textAlign: 'center',
        }}
      >
        {t('system.permissions.historyEmpty')}
      </div>
    );
  }

  return (
    <div
      style={{
        border: '1px solid var(--color-border-primary)',
        borderRadius: 'var(--radius-lg)',
        background: 'var(--color-bg-primary)',
        overflow: 'hidden',
      }}
    >
      {data.map((row) => (
        <HistoryRow key={row.id} row={row} />
      ))}
    </div>
  );
}

function HistoryRow({ row }: { row: PermissionAuditRow }) {
  const { t } = useTranslation();
  const actor = row.actorType === 'system'
    ? t('system.permissions.historySystemActor')
    : row.actorName || row.actorEmail || '—';
  const target = row.targetName || row.targetEmail || '—';
  const app = row.appId;

  let text: string;
  if (row.action === 'grant') {
    text = t('system.permissions.historyActionGrant', {
      actor,
      target,
      role: row.afterRole ?? '',
      recordAccess: row.afterRecordAccess ?? '',
      app,
    });
  } else if (row.action === 'revoke') {
    text = t('system.permissions.historyActionRevoke', { actor, target, app });
  } else {
    text = t('system.permissions.historyActionUpdate', {
      actor,
      target,
      app,
      role: row.afterRole ?? '',
      recordAccess: row.afterRecordAccess ?? '',
    });
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '10px 14px',
        borderBottom: '1px solid var(--color-border-secondary)',
        fontSize: 'var(--font-size-sm)',
        color: 'var(--color-text-primary)',
      }}
    >
      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {text}
      </span>
      <span
        style={{
          color: 'var(--color-text-tertiary)',
          fontSize: 'var(--font-size-xs)',
          whiteSpace: 'nowrap',
        }}
      >
        {new Date(row.createdAt).toLocaleString()}
      </span>
    </div>
  );
}
