import { type CSSProperties, type ReactNode } from 'react';
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  AppWindow,
  ArrowLeft,
  Building2,
  Container,
  LayoutDashboard,
  LogOut,
  Shield,
} from 'lucide-react';
import { useAuthStore } from '../../stores/auth-store';
import { ROUTES } from '../../config/routes';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { ScrollArea } from '../../components/ui/scroll-area';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  end?: boolean;
}

// ---------------------------------------------------------------------------
// Nav config
// ---------------------------------------------------------------------------

const NAV_ITEMS: NavItem[] = [
  { to: ROUTES.ADMIN_OVERVIEW, label: 'Overview', icon: <LayoutDashboard size={16} />, end: true },
  { to: ROUTES.ADMIN_TENANTS, label: 'Tenants', icon: <Building2 size={16} /> },
  { to: ROUTES.ADMIN_INSTALLATIONS, label: 'Installations', icon: <AppWindow size={16} /> },
  { to: ROUTES.ADMIN_CONTAINERS, label: 'Containers', icon: <Container size={16} /> },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getPageTitle(pathname: string): string {
  if (pathname === ROUTES.ADMIN_OVERVIEW) return 'Overview';
  if (pathname.startsWith(ROUTES.ADMIN_TENANTS)) return 'Tenants';
  if (pathname.startsWith(ROUTES.ADMIN_INSTALLATIONS)) return 'Installations';
  if (pathname.startsWith(ROUTES.ADMIN_CONTAINERS)) return 'Containers';
  return 'Admin';
}

function getInitials(name: string): string {
  return name
    .split(/[\s._-]+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
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
  const account = useAuthStore((s) => s.account);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const displayName = account?.name ?? 'Admin';
  const pageTitle = getPageTitle(pathname);
  const initials = getInitials(displayName);

  const handleLogout = () => {
    logout();
    navigate(ROUTES.LOGIN, { replace: true });
  };

  // -------------------------------------------------------------------------
  // Styles
  // -------------------------------------------------------------------------

  const shellStyle: CSSProperties = {
    display: 'flex',
    height: '100vh',
    overflow: 'hidden',
    fontFamily: 'var(--font-family)',
    background: 'var(--color-bg-secondary)',
    color: 'var(--color-text-primary)',
  };

  const sidebarStyle: CSSProperties = {
    width: 240,
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--color-bg-primary)',
    borderRight: '1px solid var(--color-border-primary)',
  };

  const sidebarHeaderStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--spacing-sm)',
    padding: 'var(--spacing-lg)',
    borderBottom: '1px solid var(--color-border-secondary)',
    minHeight: 56,
  };

  const shieldWrapStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 30,
    height: 30,
    borderRadius: 'var(--radius-sm)',
    background: 'color-mix(in srgb, var(--color-accent-primary) 12%, transparent)',
    color: 'var(--color-accent-primary)',
    flexShrink: 0,
  };

  const logoTextStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
    overflow: 'hidden',
  };

  const logoTitleStyle: CSSProperties = {
    fontSize: 'var(--font-size-sm)',
    fontWeight: 'var(--font-weight-semibold)' as CSSProperties['fontWeight'],
    color: 'var(--color-text-primary)',
    lineHeight: 1.3,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  };

  const logoSubtitleStyle: CSSProperties = {
    fontSize: 'var(--font-size-xs)',
    color: 'var(--color-text-tertiary)',
    lineHeight: 1.3,
    whiteSpace: 'nowrap',
  };

  const navStyle: CSSProperties = {
    flex: 1,
    padding: 'var(--spacing-sm)',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    overflow: 'hidden',
  };

  const sidebarFooterStyle: CSSProperties = {
    padding: 'var(--spacing-md)',
    borderTop: '1px solid var(--color-border-secondary)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--spacing-xs)',
  };

  const avatarStyle: CSSProperties = {
    width: 28,
    height: 28,
    borderRadius: '50%',
    background: 'color-mix(in srgb, var(--color-accent-primary) 18%, transparent)',
    color: 'var(--color-accent-primary)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 'var(--font-size-xs)',
    fontWeight: 'var(--font-weight-semibold)' as CSSProperties['fontWeight'],
    flexShrink: 0,
    letterSpacing: '0.03em',
    userSelect: 'none',
  };

  const footerUsernameStyle: CSSProperties = {
    flex: 1,
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-text-secondary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    minWidth: 0,
  };

  const contentAreaStyle: CSSProperties = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    minWidth: 0,
  };

  const topBarStyle: CSSProperties = {
    height: 56,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--spacing-sm)',
    padding: '0 var(--spacing-xl)',
    borderBottom: '1px solid var(--color-border-primary)',
    background: 'var(--color-bg-primary)',
  };

  const breadcrumbLabelStyle: CSSProperties = {
    fontSize: 'var(--font-size-xs)',
    color: 'var(--color-text-tertiary)',
    fontWeight: 'var(--font-weight-normal)' as CSSProperties['fontWeight'],
  };

  const breadcrumbSepStyle: CSSProperties = {
    fontSize: 'var(--font-size-xs)',
    color: 'var(--color-text-tertiary)',
    userSelect: 'none',
  };

  const pageTitleStyle: CSSProperties = {
    fontSize: 'var(--font-size-sm)',
    fontWeight: 'var(--font-weight-semibold)' as CSSProperties['fontWeight'],
    color: 'var(--color-text-primary)',
  };

  const mainStyle: CSSProperties = {
    flex: 1,
    overflow: 'auto',
    padding: 'var(--spacing-xl)',
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div style={shellStyle}>
      {/* Sidebar */}
      <aside style={sidebarStyle}>
        {/* Header */}
        <div style={sidebarHeaderStyle}>
          <div style={shieldWrapStyle}>
            <Shield size={16} strokeWidth={2} />
          </div>
          <div style={logoTextStyle}>
            <span style={logoTitleStyle}>Atlas admin</span>
            <span style={logoSubtitleStyle}>System management</span>
          </div>
        </div>

        {/* Nav */}
        <nav style={navStyle} aria-label="Admin navigation">
          <ScrollArea>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '0 0 var(--spacing-xs)' }}>
              {NAV_ITEMS.map((item) => (
                <NavLinkItem key={item.to} item={item} />
              ))}
            </div>
          </ScrollArea>
        </nav>

        {/* Footer */}
        <div style={sidebarFooterStyle}>
          <Button
            variant="ghost"
            size="sm"
            icon={<ArrowLeft size={14} />}
            onClick={() => navigate(ROUTES.HOME)}
            style={{ width: '100%', justifyContent: 'flex-start', marginBottom: 'var(--spacing-sm)' }}
          >
            Back to home
          </Button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
            <div style={avatarStyle} aria-hidden="true">
              {initials}
            </div>
            <span style={footerUsernameStyle} title={displayName}>
              {displayName}
            </span>
            <Button
              variant="ghost"
              size="sm"
              icon={<LogOut size={14} />}
              onClick={handleLogout}
              aria-label="Log out"
              style={{ flexShrink: 0, color: 'var(--color-text-tertiary)' }}
            />
          </div>
        </div>
      </aside>

      {/* Content area */}
      <div style={contentAreaStyle}>
        {/* Top bar */}
        <header style={topBarStyle}>
          <span style={breadcrumbLabelStyle}>Admin</span>
          <span style={breadcrumbSepStyle}>/</span>
          <span style={pageTitleStyle}>{pageTitle}</span>
          <div style={{ flex: 1 }} />
          <Badge variant="primary">Admin</Badge>
        </header>

        {/* Page content */}
        <main style={mainStyle}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// NavLinkItem — isolated so hover state can be managed per-item
// ---------------------------------------------------------------------------

function NavLinkItem({ item }: { item: NavItem }) {
  const baseItemStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--spacing-sm)',
    padding: '0 var(--spacing-sm)',
    height: 34,
    borderRadius: 'var(--radius-sm)',
    fontSize: 'var(--font-size-sm)',
    fontWeight: 'var(--font-weight-normal)' as CSSProperties['fontWeight'],
    textDecoration: 'none',
    transition: 'background var(--transition-fast), color var(--transition-fast)',
    cursor: 'pointer',
    userSelect: 'none',
    // Left accent placeholder
    borderLeft: '2px solid transparent',
    boxSizing: 'border-box',
  };

  return (
    <NavLink
      to={item.to}
      end={item.end ?? false}
      style={({ isActive }) => ({
        ...baseItemStyle,
        color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
        background: isActive ? 'var(--color-surface-active)' : 'transparent',
        borderLeft: isActive
          ? '2px solid var(--color-accent-primary)'
          : '2px solid transparent',
        fontWeight: isActive
          ? ('var(--font-weight-medium)' as CSSProperties['fontWeight'])
          : ('var(--font-weight-normal)' as CSSProperties['fontWeight']),
      })}
      onMouseEnter={(e) => {
        const el = e.currentTarget;
        // Only apply hover if not active (active has its own bg)
        if (!el.getAttribute('aria-current')) {
          el.style.background = 'var(--color-surface-hover)';
          el.style.color = 'var(--color-text-primary)';
        }
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget;
        if (!el.getAttribute('aria-current')) {
          el.style.background = 'transparent';
          el.style.color = 'var(--color-text-secondary)';
        }
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          flexShrink: 0,
          opacity: 0.8,
        }}
        aria-hidden="true"
      >
        {item.icon}
      </span>
      {item.label}
    </NavLink>
  );
}
