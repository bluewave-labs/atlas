import { type ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
import { TopBar } from '../../components/layout/top-bar';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NavItem {
  to: string;
  labelKey: string;
  icon: ReactNode;
  iconColor?: string;
  end?: boolean;
}

// ---------------------------------------------------------------------------
// Nav config
// ---------------------------------------------------------------------------

const NAV_ITEMS: NavItem[] = [
  { to: ROUTES.ORG_MEMBERS, labelKey: 'org.nav.members', icon: <Users size={15} />, iconColor: '#10b981' },
  { to: ROUTES.ORG_APPS, labelKey: 'org.nav.apps', icon: <LayoutGrid size={15} />, iconColor: '#8b5cf6' },
  { to: ROUTES.ORG_SETTINGS, labelKey: 'org.nav.settings', icon: <Settings size={15} />, iconColor: '#6b7280' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getPageTitleKey(pathname: string): string {
  if (pathname.startsWith(ROUTES.ORG_MEMBERS)) return 'org.nav.members';
  if (pathname.startsWith(ROUTES.ORG_APPS)) return 'org.nav.apps';
  if (pathname.startsWith(ROUTES.ORG_SETTINGS)) return 'org.nav.settings';
  return 'org.nav.organization';
}

// ---------------------------------------------------------------------------
// OrgLayout
// ---------------------------------------------------------------------------

export function OrgLayout() {
  const { t } = useTranslation();
  const tenantId = useAuthStore((s) => s.tenantId);
  const { data: tenants, isLoading: tenantsLoading } = useMyTenants();
  const activeTenant = tenants?.[0];
  const hasTenant = !!tenantId || !!activeTenant;
  const { pathname } = useLocation();

  if (tenantsLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', marginLeft: 56, fontFamily: 'var(--font-family)', color: 'var(--color-text-secondary)' }}>
        {t('org.loading')}
      </div>
    );
  }

  if (!hasTenant) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', marginLeft: 56, fontFamily: 'var(--font-family)',
        color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)',
      }}>
        {t('org.notInOrg')}
      </div>
    );
  }

  const pageTitle = t(getPageTitleKey(pathname));

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      overflow: 'hidden',
      fontFamily: 'var(--font-family)',
      marginLeft: 56,
      background: 'var(--color-bg-primary)',
      color: 'var(--color-text-primary)',
    }}>
      <AppSidebar
        storageKey="atlas_org_sidebar"
        title={activeTenant?.name ?? t('org.nav.organization')}
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
                  label={t(item.labelKey)}
                  icon={item.icon}
                  iconColor={item.iconColor}
                  isActive={isActive}
                />
              )}
            </NavLink>
          ))}
        </SidebarSection>
      </AppSidebar>

      {/* Content column */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
        <TopBar />
        <ContentArea
          breadcrumbs={[
            { label: t('org.nav.organization') },
            { label: pageTitle },
          ]}
        >
          <main style={{ flex: 1, overflow: 'auto', padding: 'var(--spacing-xl)' }}>
            <Outlet />
          </main>
        </ContentArea>
      </div>
    </div>
  );
}
