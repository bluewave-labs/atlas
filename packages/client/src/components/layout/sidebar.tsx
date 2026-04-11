import { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Sun,
  Moon,
  Monitor,
  ArrowLeft,
  Building2,
  Settings,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../../stores/settings-store';
import { useAuthStore } from '../../stores/auth-store';
import { AccountSwitcher } from './account-switcher';
import { appRegistry } from '../../apps';
import { FULL_BLEED_BRAND_ICONS, getBrandIconScale } from '../../components/icons/app-icons';
import type { AppIconComponent } from '../../config/app-manifest.client';
import { ROUTES } from '../../config/routes';
import { useMyAccessibleApps } from '../../hooks/use-app-permissions';
import type { ThemeMode } from '@atlas-platform/shared';
import type { CSSProperties } from 'react';

const THEME_CYCLE: ThemeMode[] = ['light', 'dark', 'system'];
const ALWAYS_SHOW_NAV = new Set(['org', 'settings']);

const THEME_ICONS: Record<ThemeMode, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

// App nav items from the registry + fixed platform entries
function getNavItems() {
  return [
    ...appRegistry.getNavItems(),
    { id: 'org', labelKey: 'sidebar.organization', icon: Building2, color: '#7889a0', route: ROUTES.ORG },
    { id: 'settings', labelKey: 'sidebar.settings', icon: Settings, color: '#6b7280', route: ROUTES.SETTINGS },
  ];
}

// App ids whose icons are multicolor brand SVGs (not lucide). They get a
// small rounded background card behind the icon so the brand artwork reads
// clearly against the dock row, and they skip the lucide shake animation
// (sub-pixel transforms wreck SVGs that contain masks/gradients/filters).
const BRAND_ICON_BACKGROUNDS: Record<string, string> = {
  crm: '#ffffff',
  projects: '#ffffff',
  invoices: '#ffffff',
  // Tables artwork is meant to sit on a dark slate backdrop.
  tables: '#3C444E',
  hr: '#fff1ea',
  // Tasks brand colour is indigo #6366f1 — light tint backdrop.
  tasks: '#eef0ff',
  // System glyph is multicolour — neutral light slate keeps colours honest.
  system: '#f5f5f7',
  // Drive folder artwork is orange/blue gradients — soft peach tint matches.
  drive: '#fff4e6',
  // Calendar artwork is dark-grey + white, so it needs a coloured backdrop.
  calendar: 'linear-gradient(145deg, #5dadff 0%, #2563eb 50%, #1e3a8a 100%)',
};

function NavButton({
  id,
  label,
  icon: Icon,
  isActive,
  color,
  onClick,
}: {
  id: string;
  label: string;
  icon: AppIconComponent;
  isActive: boolean;
  color: string;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  const bg = isActive
    ? 'var(--color-surface-selected)'
    : hovered
      ? 'var(--color-surface-hover)'
      : 'transparent';
  const fg = isActive ? 'var(--color-text-primary)' : hovered ? 'var(--color-text-primary)' : 'var(--color-text-secondary)';

  const brandBg = BRAND_ICON_BACKGROUNDS[id];
  const isBrandIcon = brandBg !== undefined;
  const isFullBleed = FULL_BLEED_BRAND_ICONS.has(id);

  return (
    <button
      className="sidebar-nav-btn"
      onClick={onClick}
      aria-current={isActive ? 'page' : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--spacing-sm)',
        width: '100%',
        padding: '6px var(--spacing-md)',
        background: bg,
        border: 'none',
        borderRadius: 'var(--radius-md)',
        color: fg,
        fontSize: 'var(--font-size-sm)',
        fontFamily: 'var(--font-family)',
        fontWeight: isActive
          ? ('var(--font-weight-semibold)' as CSSProperties['fontWeight'])
          : ('var(--font-weight-normal)' as CSSProperties['fontWeight']),
        cursor: 'pointer',
        transition: 'background var(--transition-normal), color var(--transition-normal)',
        textAlign: 'left',
      }}
    >
      {isFullBleed ? (
        <span
          className="sidebar-nav-brand-icon"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 24,
            height: 24,
            flexShrink: 0,
            borderRadius: 'var(--radius-sm)',
            boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.04)',
            overflow: 'hidden',
          }}
        >
          {/* Full-bleed: the SVG fills the 24×24 card edge-to-edge with no
              padding. The artwork is itself a backdrop, not a glyph. */}
          <Icon style={{ width: '100%', height: '100%', display: 'block' }} />
        </span>
      ) : isBrandIcon ? (
        <span
          className="sidebar-nav-brand-icon"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 24,
            height: 24,
            flexShrink: 0,
            background: brandBg,
            borderRadius: 'var(--radius-sm)',
            boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.04)',
          }}
        >
          {/* Brand SVGs render at the per-app scale (default 1.2× of the
              lucide size, calendar 1.44×, system 1.56×) — see
              getBrandIconScale in app-icons.tsx for the rationale. */}
          <Icon size={Math.round(18 * getBrandIconScale(id))} />
        </span>
      ) : (
        <Icon size={18} className="sidebar-nav-icon" style={{ flexShrink: 0, color }} />
      )}
      <span style={{ flex: 1 }}>{label}</span>
    </button>
  );
}

function ThemeToggleButton() {
  const { theme, setTheme } = useSettingsStore();
  const { t } = useTranslation();
  const [showTooltip, setShowTooltip] = useState(false);

  const ThemeIcon = THEME_ICONS[theme];

  const THEME_LABELS: Record<ThemeMode, string> = {
    light: t('sidebar.lightMode'),
    dark: t('sidebar.darkMode'),
    system: t('sidebar.systemMode'),
  };

  const label = THEME_LABELS[theme];

  function cycleTheme() {
    const currentIndex = THEME_CYCLE.indexOf(theme);
    const nextIndex = (currentIndex + 1) % THEME_CYCLE.length;
    setTheme(THEME_CYCLE[nextIndex]);
  }

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        onClick={cycleTheme}
        aria-label={t('sidebar.themeAriaLabel', { label })}
        title={label}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 32,
          height: 32,
          padding: 0,
          background: 'transparent',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          color: 'var(--color-text-secondary)',
          cursor: 'pointer',
          transition: 'background var(--transition-normal), color var(--transition-normal), transform 150ms ease',
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          setShowTooltip(true);
          e.currentTarget.style.background = 'var(--color-surface-hover)';
          e.currentTarget.style.color = 'var(--color-text-primary)';
          e.currentTarget.style.transform = 'rotate(15deg)';
        }}
        onMouseLeave={(e) => {
          setShowTooltip(false);
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = 'var(--color-text-secondary)';
          e.currentTarget.style.transform = 'rotate(0deg)';
        }}
      >
        <ThemeIcon size={16} />
      </button>

      {showTooltip && (
        <div
          role="tooltip"
          style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginBottom: 6,
            padding: '4px 8px',
            background: 'var(--color-surface-overlay)',
            color: 'var(--color-text-primary)',
            fontSize: 'var(--font-size-xs)',
            fontFamily: 'var(--font-family)',
            fontWeight: 500 as CSSProperties['fontWeight'],
            borderRadius: 'var(--radius-sm)',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            boxShadow: 'var(--shadow-md)',
            zIndex: 100,
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: myApps } = useMyAccessibleApps();

  const tenantRole = useAuthStore((s) => s.tenantRole);
  const isOwner = tenantRole === 'owner';

  const navItems = useMemo(() => {
    const all = getNavItems();
    // System app is reserved for the tenant owner.
    const filtered = isOwner ? all : all.filter((item) => item.id !== 'system');
    if (!myApps || myApps.appIds === '__all__') return filtered;
    const allowedSet = new Set(myApps.appIds);
    return filtered.filter((item) => ALWAYS_SHOW_NAV.has(item.id) || allowedSet.has(item.id));
  }, [myApps, isOwner]);

  // Detect Electron desktop shell (set by preload script)
  const isDesktop = !!('atlasDesktop' in window);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        padding: 'var(--spacing-sm) var(--spacing-sm)',
        paddingTop: isDesktop ? 40 : undefined,
        boxSizing: 'border-box',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Header with back arrow + title */}
      <div
        className={isDesktop ? 'desktop-drag-region' : undefined}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: 'var(--spacing-xs) var(--spacing-xs)',
          marginBottom: 'var(--spacing-sm)',
        }}
      >
        <button
          onClick={() => navigate(ROUTES.HOME)}
          title="Home screen"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 26,
            height: 26,
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            background: 'transparent',
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
            flexShrink: 0,
            padding: 0,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-hover)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <ArrowLeft size={14} />
        </button>
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            letterSpacing: '-0.01em',
            flex: 1,
          }}
        >
          Atlas
        </span>
        <ThemeToggleButton />
      </div>

      {/* Navigation */}
      <nav
        aria-label="Application navigation"
        style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}
      >
        {navItems.map(({ id, labelKey, icon, color, route }) => (
          <NavButton
            key={id}
            id={id}
            label={t(labelKey, id.charAt(0).toUpperCase() + id.slice(1))}
            icon={icon}
            isActive={location.pathname.startsWith(route)}
            color={color}
            onClick={() => navigate(route)}
          />
        ))}
      </nav>

      {/* Bottom section: account switcher */}
      <div
        style={{
          borderTop: '1px solid var(--color-border-primary)',
          paddingTop: 'var(--spacing-sm)',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
        }}
      >
        <AccountSwitcher />
      </div>
    </div>
  );
}
