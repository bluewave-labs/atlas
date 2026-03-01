import { useState, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Play, Square, RotateCw, Trash2, Users, Plus, Search } from 'lucide-react';
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
import { Button } from '../../components/ui/button';
import { Chip } from '../../components/ui/chip';
import { Input } from '../../components/ui/input';
import { Modal } from '../../components/ui/modal';
import { Avatar } from '../../components/ui/avatar';
import { IconButton } from '../../components/ui/icon-button';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import type { CatalogApp, AppInstallation } from '@atlasmail/shared';

// ---------------------------------------------------------------------------
// Status chip color map
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, string> = {
  running: '#16a34a',
  stopped: '#6b7280',
  installing: '#2563eb',
  uninstalling: '#dc2626',
  error: '#dc2626',
};

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
  const [assignModalInstallation, setAssignModalInstallation] = useState<AppInstallation | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [uninstallTarget, setUninstallTarget] = useState<(AppInstallation & { appName: string }) | null>(null);
  const [stopTarget, setStopTarget] = useState<(AppInstallation & { appName: string }) | null>(null);

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
    installApp.mutate({ catalogAppId: selectedApp.id, subdomain });
  };

  const handleInstallDone = useCallback(() => {
    setInstallOpen(false);
    setSelectedApp(null);
    queryClient.invalidateQueries({ queryKey: queryKeys.platform.all });
  }, [queryClient]);

  const handleUninstallConfirm = () => {
    if (!uninstallTarget) return;
    uninstallApp.mutate(uninstallTarget.id, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.platform.all });
        setUninstallTarget(null);
      },
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

  const allInstalled =
    (!activeInstallations || activeInstallations.length === 0) &&
    (!transitionalInstallations || transitionalInstallations.length === 0);

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
              {activeInstallations
                ? `${activeInstallations.length} app${activeInstallations.length !== 1 ? 's' : ''} installed`
                : 'Loading...'}
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
            {transitionalInstallations?.map((inst) => (
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
                  <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)' }}>
                    {inst.appName}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
                    {inst.subdomain}
                  </div>
                </div>
                <Chip color={STATUS_COLORS[inst.status] ?? STATUS_COLORS.stopped} height={24}>
                  {inst.status}
                </Chip>
              </div>
            ))}

            {/* Active */}
            {activeInstallations?.map((inst, i) => (
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
                  <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)' }}>
                    {inst.appName}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
                    {inst.subdomain}
                  </div>
                </div>
                <Chip color={STATUS_COLORS[inst.status] ?? STATUS_COLORS.stopped} height={24}>
                  {inst.status}
                </Chip>
                <div style={{ display: 'flex', gap: 4 }}>
                  {inst.status === 'stopped' && (
                    <IconButton
                      icon={<Play size={13} />}
                      label="Start"
                      size={30}
                      tooltip
                      onClick={() => startApp.mutate(inst.id)}
                    />
                  )}
                  {inst.status === 'running' && (
                    <IconButton
                      icon={<Square size={13} />}
                      label="Stop"
                      size={30}
                      tooltip
                      onClick={() => setStopTarget(inst)}
                    />
                  )}
                  <IconButton
                    icon={<RotateCw size={13} />}
                    label="Restart"
                    size={30}
                    tooltip
                    onClick={() => stopApp.mutate(inst.id, { onSuccess: () => startApp.mutate(inst.id) })}
                  />
                  <IconButton
                    icon={<Users size={13} />}
                    label="Manage users"
                    size={30}
                    tooltip
                    onClick={() => setAssignModalInstallation(inst)}
                  />
                  <IconButton
                    icon={<Trash2 size={13} />}
                    label="Uninstall"
                    size={30}
                    tooltip
                    destructive
                    onClick={() => setUninstallTarget(inst)}
                  />
                </div>
              </div>
            ))}
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
          <div style={{ width: 220 }}>
            <Input
              placeholder="Search apps..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              iconLeft={<Search size={14} />}
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
                    <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)' }}>
                      {app.name}
                    </div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
                      {app.category}
                    </div>
                  </div>
                </div>
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.5, flex: 1 }}>
                  {app.description}
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Plus size={13} />}
                  onClick={(e) => { e.stopPropagation(); handleInstallClick(app); }}
                  style={{ marginTop: 'var(--spacing-md)', alignSelf: 'flex-start' }}
                >
                  Install
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Install modal */}
      <InstallConfirmModal
        app={selectedApp}
        open={installOpen}
        onOpenChange={(open) => { setInstallOpen(open); }}
        onConfirm={handleConfirmInstall}
        isLoading={installApp.isPending}
        tenantSlug={undefined}
        installationStatus={currentInstallation?.status}
        onDone={handleInstallDone}
      />

      {/* Stop confirmation */}
      <ConfirmDialog
        open={!!stopTarget}
        onOpenChange={(open) => { if (!open) setStopTarget(null); }}
        title="Stop app"
        description={`Stop ${stopTarget?.appName ?? 'this app'}? It will become unavailable until restarted.`}
        confirmLabel="Stop"
        destructive
        onConfirm={() => {
          if (stopTarget) {
            stopApp.mutate(stopTarget.id);
            setStopTarget(null);
          }
        }}
      />

      {/* Uninstall confirmation */}
      <ConfirmDialog
        open={!!uninstallTarget}
        onOpenChange={(open) => { if (!open) setUninstallTarget(null); }}
        title="Uninstall app"
        description={`Uninstall ${uninstallTarget?.appName ?? 'this app'}? This will permanently remove all data and cannot be undone.`}
        confirmLabel="Uninstall"
        destructive
        onConfirm={handleUninstallConfirm}
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
    <Modal open onOpenChange={(open) => { if (!open) onClose(); }} width={480} title="Manage users">
      <Modal.Header
        title={`Manage users`}
        subtitle={installation.name ?? installation.subdomain}
      />

      <Modal.Body>
        {/* Assigned users */}
        <div
          style={{
            fontSize: 'var(--font-size-xs)',
            fontWeight: 'var(--font-weight-medium)',
            color: 'var(--color-text-tertiary)',
            marginBottom: 'var(--spacing-sm)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          Assigned ({assignments?.length ?? 0})
        </div>

        {(!assignments || assignments.length === 0) ? (
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', marginBottom: 'var(--spacing-lg)' }}>
            No users assigned yet.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)', marginBottom: 'var(--spacing-lg)' }}>
            {assignments.map((a) => (
              <div
                key={a.userId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-sm)',
                  padding: 'var(--spacing-sm) var(--spacing-md)',
                  background: 'var(--color-bg-secondary)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 'var(--font-size-sm)',
                }}
              >
                <Avatar name={a.name ?? undefined} email={a.email ?? undefined} size={28} />
                <span style={{ flex: 1, color: 'var(--color-text-primary)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {a.name || a.email || a.userId}
                </span>
                <Chip color="#6b7280" height={20}>{a.appRole}</Chip>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => removeAssignment.mutate(a.userId)}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Add users */}
        {unassignedUsers.length > 0 && (
          <>
            <div
              style={{
                fontSize: 'var(--font-size-xs)',
                fontWeight: 'var(--font-weight-medium)',
                color: 'var(--color-text-tertiary)',
                marginBottom: 'var(--spacing-sm)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Available to assign
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
              {unassignedUsers.map((u) => (
                <div
                  key={u.userId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--spacing-sm)',
                    padding: 'var(--spacing-sm) var(--spacing-md)',
                    background: 'var(--color-bg-secondary)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 'var(--font-size-sm)',
                  }}
                >
                  <Avatar name={u.name ?? undefined} email={u.email ?? undefined} size={28} />
                  <span style={{ flex: 1, color: 'var(--color-text-primary)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {u.name || u.email}
                  </span>
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<Plus size={12} />}
                    disabled={assignUser.isPending}
                    onClick={() => assignUser.mutate({ userId: u.userId, appRole: 'member' })}
                  >
                    Assign
                  </Button>
                </div>
              ))}
            </div>
          </>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" size="md" onClick={onClose}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
