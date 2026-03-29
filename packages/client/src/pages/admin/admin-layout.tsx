import { type ReactNode } from 'react';
import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import {
  Building2,
  LayoutDashboard,
  Shield,
} from 'lucide-react';
import { useAuthStore } from '../../stores/auth-store';
import { ROUTES } from '../../config/routes';
import { Badge } from '../../components/ui/badge';
import { AppSidebar, SidebarSection, SidebarItem } from '../../components/layout/app-sidebar';
import type { CSSProperties } from 'react';

// ---------------------------------------------------------------------------
// Nav config
// ---------------------------------------------------------------------------

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  end?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: ROUTES.ADMIN_OVERVIEW, label: 'Overview', icon: <LayoutDashboard size={15} />, end: true },
  { to: ROUTES.ADMIN_TENANTS, label: 'Tenants', icon: <Building2 size={15} /> },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getPageTitle(pathname: string): string {
  if (pathname === ROUTES.ADMIN_OVERVIEW) return 'Overview';
  if (pathname.startsWith(ROUTES.ADMIN_TENANTS)) return 'Tenants';
  return 'Admin';
}

// ---------------------------------------------------------------------------
// AdminProtectedRoute
// ---------------------------------------------------------------------------

export function AdminProtectedRoute({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin);

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  if (!isSuperAdmin) {
    return <Navigate to={ROUTES.HOME} replace />;
  }

  return <>{children}</>;
}

// ---------------------------------------------------------------------------
// AdminLayout
// ---------------------------------------------------------------------------

export function AdminLayout() {
  const { pathname } = useLocation();
  const pageTitle = getPageTitle(pathname);

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      overflow: 'hidden',
      fontFamily: 'var(--font-family)',
      background: 'var(--color-bg-secondary)',
      color: 'var(--color-text-primary)',
    }}>
      <AppSidebar
        storageKey="atlas_admin_sidebar"
        title="Admin"
        headerAction={
          <Badge variant="primary">
            <Shield size={10} style={{ marginRight: 4 }} />
            Super admin
          </Badge>
        }
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
            Admin
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
