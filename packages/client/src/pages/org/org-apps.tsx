import { useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../stores/auth-store';
import { useMyTenants } from '../../hooks/use-platform';
import { useTenantAppsAdmin, useToggleTenantApp } from '../../hooks/use-tenant-app-admin';
import { appRegistry } from '../../apps';
import { LayoutGrid } from 'lucide-react';
import { Chip } from '../../components/ui/chip';
import { Skeleton } from '../../components/ui/skeleton';

// ---------------------------------------------------------------------------
// App description i18n keys
// ---------------------------------------------------------------------------

const APP_DESC_KEYS: Record<string, string> = {
  crm: 'org.apps.crmDesc',
  hr: 'org.apps.hrDesc',
  sign: 'org.apps.signDesc',
  drive: 'org.apps.driveDesc',
  tables: 'org.apps.tablesDesc',
  tasks: 'org.apps.tasksDesc',
  docs: 'org.apps.docsDesc',
  draw: 'org.apps.drawDesc',
  projects: 'org.apps.projectsDesc',
};

// ---------------------------------------------------------------------------
// OrgAppsPage
// ---------------------------------------------------------------------------

export function OrgAppsPage() {
  const { t } = useTranslation();
  const storeTenantId = useAuthStore((s) => s.tenantId);
  const { data: tenants, isLoading: tenantsLoading } = useMyTenants();
  const tenant = tenants?.[0];
  const effectiveTenantId = storeTenantId ?? tenant?.id ?? '';

  const { data: tenantApps, isLoading: appsLoading } = useTenantAppsAdmin(effectiveTenantId);
  const toggleMutation = useToggleTenantApp(effectiveTenantId);
  const allApps = appRegistry.getAll();

  const enabledSet = new Set(
    (tenantApps ?? []).filter((a) => a.isEnabled).map((a) => a.appId),
  );

  const isLoading = tenantsLoading || appsLoading;

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)', maxWidth: 900 }}>
        <Skeleton width={140} height={24} borderRadius="var(--radius-sm)" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 'var(--spacing-md)' }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} width="100%" height={140} borderRadius="var(--radius-lg)" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)', maxWidth: 900 }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', marginBottom: 'var(--spacing-xs)' }}>
          <LayoutGrid size={15} style={{ color: 'var(--color-text-tertiary)' }} />
          <span style={{
            fontSize: 'var(--font-size-md)',
            fontWeight: 'var(--font-weight-semibold)' as CSSProperties['fontWeight'],
            color: 'var(--color-text-primary)',
          }}>
            {t('org.atlasApps')}
          </span>
          <Chip height={18} style={{ padding: '0 var(--spacing-xs)' }}>
            {enabledSet.size}
          </Chip>
        </div>
        <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', lineHeight: 'var(--line-height-normal)' }}>
          {t('org.appsDescription')}
        </p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: 'var(--spacing-md)',
      }}>
        {allApps.map((app) => {
          const isEnabled = enabledSet.has(app.id);
          return (
            <AppCard
              key={app.id}
              app={app}
              description={APP_DESC_KEYS[app.id] ? t(APP_DESC_KEYS[app.id]) : app.category}
              isEnabled={isEnabled}
              isPending={toggleMutation.isPending}
              onToggle={() => toggleMutation.mutate({ appId: app.id, enable: !isEnabled })}
            />
          );
        })}
      </div>

    </div>
  );
}

// ---------------------------------------------------------------------------
// AppCard
// ---------------------------------------------------------------------------

function AppCard({
  app,
  description,
  isEnabled,
  isPending,
  onToggle,
}: {
  app: { id: string; name: string; icon: React.ComponentType<{ size?: number; color?: string }>; color: string; category: string };
  description: string;
  isEnabled: boolean;
  isPending: boolean;
  onToggle: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const Icon = app.icon;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--spacing-md)',
        padding: 'var(--spacing-lg)',
        background: hovered ? 'var(--color-surface-hover)' : 'var(--color-bg-primary)',
        border: `1px solid ${isEnabled ? app.color + '44' : 'var(--color-border-primary)'}`,
        borderRadius: 'var(--radius-lg)',
        transition: 'background 0.15s, border-color 0.15s',
      }}
    >
      {/* Header: icon + toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 'var(--radius-md)',
              background: app.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Icon size={18} color="#fff" />
          </div>
          <div>
            <div style={{
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-medium)' as CSSProperties['fontWeight'],
              color: 'var(--color-text-primary)',
              fontFamily: 'var(--font-family)',
            }}>
              {app.name}
            </div>
            <div style={{
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-text-tertiary)',
              fontFamily: 'var(--font-family)',
              textTransform: 'capitalize',
            }}>
              {app.category}
            </div>
          </div>
        </div>

        <label style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
          <input
            type="checkbox"
            role="switch"
            aria-label={`${isEnabled ? 'Disable' : 'Enable'} ${app.name}`}
            aria-checked={isEnabled}
            checked={isEnabled}
            disabled={isPending}
            onChange={onToggle}
            style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
          />
          <div
            style={{
              width: 36,
              height: 20,
              borderRadius: 10,
              background: isEnabled ? 'var(--color-accent-primary)' : 'var(--color-bg-tertiary)',
              border: `1px solid ${isEnabled ? 'var(--color-accent-primary)' : 'var(--color-border-primary)'}`,
              transition: 'background 0.2s, border-color 0.2s',
              position: 'relative',
            }}
          >
            <div
              style={{
                width: 16,
                height: 16,
                borderRadius: '50%',
                background: 'var(--color-bg-primary)',
                position: 'absolute',
                top: 1,
                left: isEnabled ? 17 : 1,
                transition: 'left 0.2s',
                boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
              }}
            />
          </div>
        </label>
      </div>

      {/* Description */}
      <div style={{
        fontSize: 'var(--font-size-sm)',
        color: 'var(--color-text-secondary)',
        fontFamily: 'var(--font-family)',
        lineHeight: 'var(--line-height-normal)',
      }}>
        {description}
      </div>
    </div>
  );
}
