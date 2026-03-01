import type { CSSProperties, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, AppWindow, UserPlus, ArrowRight, Download } from 'lucide-react';
import { useAuthStore } from '../../stores/auth-store';
import { useTenantUsers, useMyTenants } from '../../hooks/use-platform';
import { useInstalledApps } from '../../hooks/use-installed-apps';
import { ROUTES } from '../../config/routes';
import { AppIcon } from '../../components/marketplace/app-icons';

// ---------------------------------------------------------------------------
// StatCard
// ---------------------------------------------------------------------------

interface StatCardProps {
  label: string;
  value: number;
  color: string;
  icon: ReactNode;
  onClick?: () => void;
}

function StatCard({ label, value, color, icon, onClick }: StatCardProps) {
  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--color-bg-primary)',
        border: '1px solid var(--color-border-primary)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--spacing-xl)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--spacing-md)',
        boxShadow: 'var(--shadow-sm)',
        transition: 'box-shadow 0.15s ease, border-color 0.15s ease',
        cursor: onClick ? 'pointer' : 'default',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 4px 12px color-mix(in srgb, var(--color-border-primary) 40%, transparent)';
        if (onClick) e.currentTarget.style.borderColor = 'var(--color-accent-primary)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
        e.currentTarget.style.borderColor = 'var(--color-border-primary)';
      }}
    >
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
      <div
        style={{
          fontSize: 'var(--font-size-sm)',
          color: 'var(--color-text-tertiary)',
          fontWeight: 'var(--font-weight-medium)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {label}
        {onClick && <ArrowRight size={14} style={{ opacity: 0.5 }} />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SkeletonCard
// ---------------------------------------------------------------------------

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
      <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: 'var(--color-border-primary)', opacity: 0.5 }} />
      <div style={{ width: 48, height: 28, borderRadius: 'var(--radius-sm)', background: 'var(--color-border-primary)', opacity: 0.5 }} />
      <div style={{ width: 88, height: 14, borderRadius: 'var(--radius-sm)', background: 'var(--color-border-primary)', opacity: 0.35 }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// QuickActionCard
// ---------------------------------------------------------------------------

function QuickActionCard({ icon, label, description, onClick }: {
  icon: ReactNode;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--spacing-md)',
        padding: 'var(--spacing-lg)',
        background: 'var(--color-bg-primary)',
        border: '1px solid var(--color-border-primary)',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        fontFamily: 'var(--font-family)',
        textAlign: 'left',
        transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
        boxShadow: 'none',
        width: '100%',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--color-accent-primary)';
        e.currentTarget.style.boxShadow = '0 2px 8px color-mix(in srgb, var(--color-accent-primary) 12%, transparent)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--color-border-primary)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 'var(--radius-sm)',
          background: 'color-mix(in srgb, var(--color-accent-primary) 10%, transparent)',
          color: 'var(--color-accent-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)' }}>
          {label}
        </div>
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginTop: 2 }}>
          {description}
        </div>
      </div>
      <ArrowRight size={14} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
    </button>
  );
}

// ---------------------------------------------------------------------------
// OrgOverviewPage
// ---------------------------------------------------------------------------

export function OrgOverviewPage() {
  const tenantId = useAuthStore((s) => s.tenantId);
  const { data: tenants, isLoading: tenantsLoading } = useMyTenants();
  const effectiveTenantId = tenantId ?? tenants?.[0]?.id;
  const navigate = useNavigate();

  const { data: users, isLoading: usersLoading } = useTenantUsers(effectiveTenantId ?? undefined);
  const { installations: activeInstallations, isLoading: appsLoading } = useInstalledApps();

  const isLoading = tenantsLoading || usersLoading || appsLoading;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-2xl)' }}>
      {/* Stat cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 'var(--spacing-lg)',
        }}
      >
        {isLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            <StatCard
              label="Team members"
              value={users?.length ?? 0}
              color="var(--color-accent-primary)"
              icon={<Users size={18} strokeWidth={2} />}
              onClick={() => navigate(ROUTES.ORG_MEMBERS)}
            />
            <StatCard
              label="Installed apps"
              value={activeInstallations?.length ?? 0}
              color="var(--color-info, #2563eb)"
              icon={<AppWindow size={18} strokeWidth={2} />}
              onClick={() => navigate(ROUTES.ORG_APPS)}
            />
          </>
        )}
      </div>

      {/* Quick actions */}
      <div>
        <h3
          style={{
            fontSize: 'var(--font-size-sm)',
            fontWeight: 'var(--font-weight-semibold)',
            color: 'var(--color-text-primary)',
            marginBottom: 'var(--spacing-md)',
          }}
        >
          Quick actions
        </h3>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 'var(--spacing-sm)',
          }}
        >
          <QuickActionCard
            icon={<UserPlus size={16} />}
            label="Add a team member"
            description="Create or invite users to your organization"
            onClick={() => navigate(ROUTES.ORG_MEMBERS)}
          />
          <QuickActionCard
            icon={<Download size={16} />}
            label="Install an app"
            description="Browse and install apps from the catalog"
            onClick={() => navigate(ROUTES.ORG_APPS)}
          />
        </div>
      </div>

      {/* Installed apps list */}
      {activeInstallations && activeInstallations.length > 0 && (
        <div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 'var(--spacing-md)',
          }}>
            <h3
              style={{
                fontSize: 'var(--font-size-sm)',
                fontWeight: 'var(--font-weight-semibold)',
                color: 'var(--color-text-primary)',
              }}
            >
              Installed apps
            </h3>
            <button
              onClick={() => navigate(ROUTES.ORG_APPS)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                background: 'none',
                border: 'none',
                color: 'var(--color-accent-primary)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 'var(--font-weight-medium)',
                cursor: 'pointer',
                fontFamily: 'var(--font-family)',
              }}
            >
              View all
              <ArrowRight size={12} />
            </button>
          </div>
          <div
            style={{
              background: 'var(--color-bg-primary)',
              border: '1px solid var(--color-border-primary)',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
            }}
          >
            {activeInstallations.map((inst, i) => (
              <div
                key={inst.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-md)',
                  padding: 'var(--spacing-md) var(--spacing-lg)',
                  borderBottom: i < activeInstallations.length - 1 ? '1px solid var(--color-border-primary)' : 'none',
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 'var(--radius-sm)',
                    overflow: 'hidden',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: inst.color || '#666',
                  }}
                >
                  {inst.manifestId && <AppIcon manifestId={inst.manifestId} size={20} color="#fff" />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)' }}>
                    {inst.name ?? inst.catalogAppId}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
                    {inst.subdomain}
                  </div>
                </div>
                <StatusDot status={inst.status} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// StatusDot
// ---------------------------------------------------------------------------

function StatusDot({ status }: { status: string }) {
  const isRunning = status === 'running';
  const color = isRunning ? 'var(--color-success, #16a34a)' : '#6b7280';
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
