import { type CSSProperties, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Shield } from 'lucide-react';
import {
  useAppPermissions,
  useSetAppPermission,
  useRevertAppPermission,
  type AppPermissionRole,
  type AppPermissionRecordAccess,
  type AppPermissionCell,
} from '../hooks';
import { Select } from '../../../components/ui/select';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Avatar } from '../../../components/ui/avatar';
import { Skeleton } from '../../../components/ui/skeleton';

export function PermissionsView() {
  const { t } = useTranslation();
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
    </div>
  );
}
