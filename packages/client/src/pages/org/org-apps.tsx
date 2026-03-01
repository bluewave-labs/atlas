import { useState, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Play, Square, RotateCw, Trash2, Users, Plus, Search, ExternalLink } from 'lucide-react';
import { useAuthStore } from '../../stores/auth-store';
import {
  useCatalog,
  useInstallations,
  useInstallApp,
  useUninstallApp,
  useStartApp,
  useStopApp,
  useAppAssignments,
  useAssignUser,
  useRemoveAssignment,
  useTenantUsers,
  useMyTenants,
} from '../../hooks/use-platform';
import { queryKeys } from '../../config/query-keys';
import { AppIcon } from '../../components/marketplace/app-icons';
import { InstallConfirmModal } from '../../components/marketplace/install-confirm-modal';
import type { CatalogApp, AppInstallation } from '@atlasmail/shared';

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  running: { bg: 'color-mix(in srgb, #16a34a 10%, transparent)', text: '#16a34a' },
  stopped: { bg: 'color-mix(in srgb, #6b7280 10%, transparent)', text: '#6b7280' },
  installing: { bg: 'color-mix(in srgb, #2563eb 10%, transparent)', text: '#2563eb' },
  uninstalling: { bg: 'color-mix(in srgb, #dc2626 10%, transparent)', text: '#dc2626' },
  error: { bg: 'color-mix(in srgb, #dc2626 10%, transparent)', text: '#dc2626' },
};

function StatusBadge({ status }: { status: string }) {
  const colors = STATUS_COLORS[status] ?? STATUS_COLORS.stopped;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 10px',
        fontSize: 'var(--font-size-xs)',
        fontWeight: 'var(--font-weight-medium)',
        borderRadius: 12,
        background: colors.bg,
        color: colors.text,
        textTransform: 'capitalize',
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: colors.text }} />
      {status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Action button
// ---------------------------------------------------------------------------

function ActionButton({ icon, label, onClick, danger }: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  const color = danger ? '#dc2626' : 'var(--color-text-secondary)';
  const borderColor = danger ? 'color-mix(in srgb, #dc2626 25%, transparent)' : 'var(--color-border-primary)';
  return (
    <button
      onClick={onClick}
      title={label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 30,
        height: 30,
        border: `1px solid ${borderColor}`,
        borderRadius: 'var(--radius-sm)',
        background: 'var(--color-bg-primary)',
        color,
        cursor: 'pointer',
        transition: 'background 0.15s ease, border-color 0.15s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = danger
          ? 'color-mix(in srgb, #dc2626 8%, transparent)'
          : 'var(--color-surface-hover, var(--color-bg-secondary))';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'var(--color-bg-primary)';
      }}
    >
      {icon}
    </button>
  );
}

// ---------------------------------------------------------------------------
// OrgAppsPage
// ---------------------------------------------------------------------------

export function OrgAppsPage() {
  const storeTenantId = useAuthStore((s) => s.tenantId);
  const { data: tenants } = useMyTenants();
  const tenantId = storeTenantId ?? tenants?.[0]?.id ?? null;
  const queryClient = useQueryClient();

  const { data: catalogApps = [] } = useCatalog();
  const { data: installations } = useInstallations(tenantId ?? undefined);
  const installApp = useInstallApp(tenantId ?? '');
  const uninstallApp = useUninstallApp(tenantId ?? '');
  const startApp = useStartApp(tenantId ?? '');
  const stopApp = useStopApp(tenantId ?? '');

  const [selectedApp, setSelectedApp] = useState<CatalogApp | null>(null);
  const [installOpen, setInstallOpen] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [assignModalInstallation, setAssignModalInstallation] = useState<AppInstallation | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Enrich installations with catalog metadata
  const enrichedInstallations = useMemo(() => {
    return installations?.map((inst) => {
      const catalog = catalogApps.find((c) => c.id === inst.catalogAppId);
      return {
        ...inst,
        appName: catalog?.name ?? inst.subdomain,
        manifestId: catalog?.manifestId ?? null,
        color: catalog?.color ?? '#666',
      };
    });
  }, [installations, catalogApps]);

  const activeInstallations = enrichedInstallations?.filter(
    (i) => i.status === 'running' || i.status === 'stopped',
  );
  const transitionalInstallations = enrichedInstallations?.filter(
    (i) => i.status === 'installing' || i.status === 'uninstalling',
  );

  const installedCatalogIds = useMemo(
    () => new Set(installations?.map((i) => i.catalogAppId) ?? []),
    [installations],
  );

  const availableApps = catalogApps.filter((a) => {
    if (installedCatalogIds.has(a.id)) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return a.name.toLowerCase().includes(q) || a.category.toLowerCase().includes(q);
  });

  const currentInstallation = useMemo(
    () => selectedApp ? installations?.find((i) => i.catalogAppId === selectedApp.id) : undefined,
    [installations, selectedApp],
  );

  const handleInstallClick = (app: CatalogApp) => {
    setSelectedApp(app);
    setInstallOpen(true);
  };

  const handleConfirmInstall = (subdomain: string) => {
    if (!selectedApp || !tenantId) return;
    installApp.mutate(
      { catalogAppId: selectedApp.id, subdomain },
      { onSuccess: () => setIsInstalling(true) },
    );
  };

  const handleInstallDone = useCallback(() => {
    setIsInstalling(false);
    setInstallOpen(false);
    setSelectedApp(null);
    queryClient.invalidateQueries({ queryKey: queryKeys.platform.all });
  }, [queryClient]);

  const handleUninstall = (installation: AppInstallation & { appName: string }) => {
    if (!confirm(`Uninstall ${installation.appName}? This will remove all data.`)) return;
    uninstallApp.mutate(installation.id, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.platform.all }),
    });
  };

  if (!tenantId) {
    return (
      <div style={{ padding: 32, fontFamily: 'var(--font-family)', color: 'var(--color-text-secondary)' }}>
        <h2 style={{ fontSize: 20, marginBottom: 12, color: 'var(--color-text-primary)' }}>Apps</h2>
        <p>App management requires a company account.</p>
      </div>
    );
  }

  const allInstalled = (!activeInstallations || activeInstallations.length === 0) && (!transitionalInstallations || transitionalInstallations.length === 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-2xl)', fontFamily: 'var(--font-family)' }}>
      {/* Installed apps */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
          <div>
            <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)', margin: 0 }}>
              Installed apps
            </h2>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', margin: '4px 0 0' }}>
              {activeInstallations ? `${activeInstallations.length} app${activeInstallations.length !== 1 ? 's' : ''} installed` : 'Loading...'}
            </p>
          </div>
        </div>

        {allInstalled ? (
          <div style={{
            padding: 'var(--spacing-2xl)',
            background: 'var(--color-bg-primary)',
            border: '1px solid var(--color-border-primary)',
            borderRadius: 'var(--radius-md)',
            textAlign: 'center',
            color: 'var(--color-text-tertiary)',
            fontSize: 'var(--font-size-sm)',
          }}>
            No apps installed yet. Browse the catalog below to get started.
          </div>
        ) : (
          <div
            style={{
              background: 'var(--color-bg-primary)',
              border: '1px solid var(--color-border-primary)',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
            }}
          >
            {/* Transitional */}
            {transitionalInstallations?.map((inst, i) => (
              <div
                key={inst.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-md)',
                  padding: 'var(--spacing-md) var(--spacing-lg)',
                  borderBottom: '1px solid var(--color-border-primary)',
                  opacity: 0.6,
                }}
              >
                <AppIconBadge manifestId={inst.manifestId} color={inst.color} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)' }}>{inst.appName}</div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>{inst.subdomain}</div>
                </div>
                <StatusBadge status={inst.status} />
              </div>
            ))}

            {/* Active */}
            {activeInstallations?.map((inst, i) => {
              const isLast = i === (activeInstallations?.length ?? 0) - 1 && (!transitionalInstallations || transitionalInstallations.length === 0 || i > 0);
              return (
                <div
                  key={inst.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--spacing-md)',
                    padding: 'var(--spacing-md) var(--spacing-lg)',
                    borderBottom: i < (activeInstallations?.length ?? 0) - 1 ? '1px solid var(--color-border-primary)' : 'none',
                    transition: 'background 0.1s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-hover, var(--color-bg-secondary))'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <AppIconBadge manifestId={inst.manifestId} color={inst.color} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)' }}>{inst.appName}</div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>{inst.subdomain}</div>
                  </div>
                  <StatusBadge status={inst.status} />
                  <div style={{ display: 'flex', gap: 4 }}>
                    {inst.status === 'stopped' && (
                      <ActionButton icon={<Play size={13} />} label="Start" onClick={() => startApp.mutate(inst.id)} />
                    )}
                    {inst.status === 'running' && (
                      <ActionButton icon={<Square size={13} />} label="Stop" onClick={() => stopApp.mutate(inst.id)} />
                    )}
                    <ActionButton
                      icon={<RotateCw size={13} />}
                      label="Restart"
                      onClick={() => stopApp.mutate(inst.id, { onSuccess: () => startApp.mutate(inst.id) })}
                    />
                    <ActionButton icon={<Users size={13} />} label="Manage users" onClick={() => setAssignModalInstallation(inst)} />
                    <ActionButton icon={<Trash2 size={13} />} label="Uninstall" onClick={() => handleUninstall(inst)} danger />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Available apps catalog */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
          <div>
            <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)', margin: 0 }}>
              Available apps
            </h2>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', margin: '4px 0 0' }}>
              Browse and install apps for your organization
            </p>
          </div>
          <div style={{ position: 'relative', width: 220 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)', pointerEvents: 'none' }} />
            <input
              type="text"
              placeholder="Search apps..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 32px',
                border: '1px solid var(--color-border-primary)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 'var(--font-size-sm)',
                outline: 'none',
                background: 'var(--color-bg-primary)',
                color: 'var(--color-text-primary)',
                boxSizing: 'border-box',
                fontFamily: 'var(--font-family)',
              }}
            />
          </div>
        </div>

        {availableApps.length === 0 ? (
          <div style={{
            padding: 'var(--spacing-2xl)',
            background: 'var(--color-bg-primary)',
            border: '1px solid var(--color-border-primary)',
            borderRadius: 'var(--radius-md)',
            textAlign: 'center',
            color: 'var(--color-text-tertiary)',
            fontSize: 'var(--font-size-sm)',
          }}>
            {searchQuery ? 'No apps match your search.' : 'All available apps are already installed.'}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--spacing-md)' }}>
            {availableApps.map((app) => (
              <div
                key={app.id}
                style={{
                  padding: 'var(--spacing-lg)',
                  background: 'var(--color-bg-primary)',
                  border: '1px solid var(--color-border-primary)',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                  boxShadow: 'var(--shadow-sm)',
                  display: 'flex',
                  flexDirection: 'column',
                }}
                onClick={() => handleInstallClick(app)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-accent-primary)';
                  e.currentTarget.style.boxShadow = '0 4px 12px color-mix(in srgb, var(--color-accent-primary) 12%, transparent)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-border-primary)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-sm)' }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 'var(--radius-md)',
                      background: app.color || '#666',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <AppIcon manifestId={app.manifestId} size={24} color="#fff" />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)' }}>{app.name}</div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>{app.category}</div>
                  </div>
                </div>
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.5, flex: 1 }}>
                  {app.description}
                </p>
                <button
                  onClick={(e) => { e.stopPropagation(); handleInstallClick(app); }}
                  style={{
                    marginTop: 'var(--spacing-md)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    alignSelf: 'flex-start',
                    gap: 4,
                    padding: '0 14px',
                    height: 34,
                    background: 'var(--color-accent-primary)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 'var(--font-weight-medium)',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-family)',
                    transition: 'opacity 0.15s ease',
                  }}
                >
                  <Plus size={14} />
                  Install
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Install modal */}
      <InstallConfirmModal
        app={selectedApp}
        open={installOpen}
        onOpenChange={(open) => {
          setInstallOpen(open);
          if (!open) setIsInstalling(false);
        }}
        onConfirm={handleConfirmInstall}
        isLoading={installApp.isPending}
        tenantSlug={undefined}
        installationStatus={currentInstallation?.status}
        onDone={handleInstallDone}
      />

      {/* User assignment modal */}
      {assignModalInstallation && tenantId && (
        <AssignUsersModal
          tenantId={tenantId}
          installation={assignModalInstallation}
          onClose={() => setAssignModalInstallation(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AppIconBadge
// ---------------------------------------------------------------------------

function AppIconBadge({ manifestId, color }: { manifestId: string | null; color: string }) {
  return (
    <div
      style={{
        width: 36,
        height: 36,
        borderRadius: 'var(--radius-sm)',
        background: color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {manifestId && <AppIcon manifestId={manifestId} size={22} color="#fff" />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AssignUsersModal
// ---------------------------------------------------------------------------

function AssignUsersModal({
  tenantId,
  installation,
  onClose,
}: {
  tenantId: string;
  installation: AppInstallation;
  onClose: () => void;
}) {
  const { data: assignments } = useAppAssignments(tenantId, installation.id);
  const { data: tenantUsers } = useTenantUsers(tenantId);
  const assignUser = useAssignUser(tenantId, installation.id);
  const removeAssignment = useRemoveAssignment(tenantId, installation.id);

  const assignedUserIds = new Set(assignments?.map((a) => a.userId) ?? []);
  const unassignedUsers = tenantUsers?.filter((u) => !assignedUserIds.has(u.userId)) ?? [];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.45)',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 480,
          maxHeight: '70vh',
          overflow: 'auto',
          padding: 24,
          background: 'var(--color-bg-primary)',
          border: '1px solid var(--color-border-primary)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-lg)', color: 'var(--color-text-primary)' }}>
          Manage users — {installation.name ?? installation.subdomain}
        </h3>

        {/* Assigned users */}
        <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-tertiary)', marginBottom: 'var(--spacing-sm)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Assigned ({assignments?.length ?? 0})
        </div>
        {(!assignments || assignments.length === 0) ? (
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', marginBottom: 'var(--spacing-lg)' }}>No users assigned yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)', marginBottom: 'var(--spacing-lg)' }}>
            {assignments.map((a) => (
              <div key={a.userId} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-sm)',
                padding: 'var(--spacing-sm) var(--spacing-md)',
                background: 'var(--color-bg-secondary)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 'var(--font-size-sm)',
              }}>
                <span style={{ flex: 1, color: 'var(--color-text-primary)' }}>{a.name || a.email || a.userId}</span>
                <span style={{
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-text-tertiary)',
                  padding: '1px 6px',
                  background: 'color-mix(in srgb, var(--color-text-tertiary) 10%, transparent)',
                  borderRadius: 8,
                }}>{a.appRole}</span>
                <button
                  onClick={() => removeAssignment.mutate(a.userId)}
                  style={{
                    padding: '2px 8px',
                    fontSize: 11,
                    background: 'transparent',
                    color: '#dc2626',
                    border: '1px solid color-mix(in srgb, #dc2626 25%, transparent)',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-family)',
                  }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add users */}
        {unassignedUsers.length > 0 && (
          <>
            <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-tertiary)', marginBottom: 'var(--spacing-sm)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Available to assign
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)', marginBottom: 'var(--spacing-lg)' }}>
              {unassignedUsers.map((u) => (
                <div key={u.userId} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-sm)',
                  padding: 'var(--spacing-sm) var(--spacing-md)',
                  background: 'var(--color-bg-secondary)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 'var(--font-size-sm)',
                }}>
                  <span style={{ flex: 1, color: 'var(--color-text-primary)' }}>{u.name || u.email}</span>
                  <button
                    onClick={() => assignUser.mutate({ userId: u.userId, appRole: 'member' })}
                    disabled={assignUser.isPending}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '2px 10px',
                      fontSize: 11,
                      fontWeight: 500,
                      background: 'var(--color-accent-primary)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-family)',
                    }}
                  >
                    <Plus size={10} />
                    Assign
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '0 14px',
              height: 34,
              background: 'var(--color-bg-primary)',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-border-primary)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 'var(--font-weight-medium)',
              cursor: 'pointer',
              fontFamily: 'var(--font-family)',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
