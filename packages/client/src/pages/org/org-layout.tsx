import { type ReactNode } from 'react';
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
import { ContentArea } from '../../components/ui/content-area';

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
      <ContentArea
        breadcrumbs={[
          { label: 'Organization' },
          { label: pageTitle },
        ]}
      >
        <main style={{ flex: 1, overflow: 'auto', padding: 'var(--spacing-xl)' }}>
          <Outlet />
        </main>
      </ContentArea>
    </div>
  );
}
