import { type ReactNode } from 'react';
import type { CSSProperties } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutGrid,
  Settings,
  Users,
} from 'lucide-react';
import { useAuthStore } from '../../stores/auth-store';
import { useMyTenants } from '../../hooks/use-platform';
import { ROUTES } from '../../config/routes';
import { AppSidebar, SidebarSection, SidebarItem } from '../../components/layout/app-sidebar';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  iconColor?: string;
  end?: boolean;
}

// ---------------------------------------------------------------------------
// Nav config
// ---------------------------------------------------------------------------

const NAV_ITEMS: NavItem[] = [
  { to: ROUTES.ORG_MEMBERS, label: 'Members', icon: <Users size={15} />, iconColor: '#10b981' },
  { to: ROUTES.ORG_APPS, label: 'Apps', icon: <LayoutGrid size={15} />, iconColor: '#8b5cf6' },
  { to: ROUTES.ORG_SETTINGS, label: 'Settings', icon: <Settings size={15} />, iconColor: '#6b7280' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getPageTitle(pathname: string): string {
  if (pathname.startsWith(ROUTES.ORG_MEMBERS)) return 'Members';
  if (pathname.startsWith(ROUTES.ORG_APPS)) return 'Apps';
  if (pathname.startsWith(ROUTES.ORG_SETTINGS)) return 'Settings';
  return 'Organization';
}

// ---------------------------------------------------------------------------
// OrgLayout
// ---------------------------------------------------------------------------

export function OrgLayout() {
  const tenantId = useAuthStore((s) => s.tenantId);
  const { data: tenants, isLoading: tenantsLoading } = useMyTenants();
  const activeTenant = tenants?.[0];
  const hasTenant = !!tenantId || !!activeTenant;
  const { pathname } = useLocation();

  if (tenantsLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'var(--font-family)', color: 'var(--color-text-secondary)' }}>
        Loading...
      </div>
    );
  }

  if (!hasTenant) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', fontFamily: 'var(--font-family)',
        color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)',
      }}>
        You are not part of an organization. Contact your administrator.
      </div>
    );
  }

  const pageTitle = getPageTitle(pathname);

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      overflow: 'hidden',
      fontFamily: 'var(--font-family)',
      background: 'var(--color-bg-primary)',
      color: 'var(--color-text-primary)',
    }}>
      <AppSidebar
        storageKey="atlas_org_sidebar"
        title={activeTenant?.name ?? 'Organization'}
      >
        <SidebarSection>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end ?? false}
              style={{ textDecoration: 'none' }}
            >
              {({ isActive }) => (
                <SidebarItem
                  label={item.label}
                  icon={item.icon}
                  iconColor={item.iconColor}
                  isActive={isActive}
                />
              )}
            </NavLink>
          ))}
        </SidebarSection>
      </AppSidebar>

      {/* Content area */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        minWidth: 0,
        paddingBottom: 'var(--global-dock-offset, 0px)',
      }}>
        {/* Top bar */}
        <header style={{
          height: 48,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-sm)',
          padding: '0 var(--spacing-xl)',
          borderBottom: '1px solid var(--color-border-primary)',
          background: 'var(--color-bg-primary)',
        }}>
          <span style={{
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-text-tertiary)',
          }}>
            Organization
          </span>
          <span style={{
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-text-tertiary)',
            userSelect: 'none',
          }}>
            /
          </span>
          <span style={{
            fontSize: 'var(--font-size-sm)',
            fontWeight: 'var(--font-weight-semibold)' as CSSProperties['fontWeight'],
            color: 'var(--color-text-primary)',
          }}>
            {pageTitle}
          </span>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, overflow: 'auto', padding: 'var(--spacing-xl)' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
