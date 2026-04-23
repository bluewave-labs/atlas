import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Home,
  Users,
  UserCog,
  FolderKanban,
  Calendar as CalendarIcon,
  FileSignature,
  Receipt,
  HardDrive,
  CheckSquare,
  FileText,
  PenTool,
  Settings,
  Settings2,
  Building2,
  Sun,
  Moon,
  Monitor,
  Grid,
  type LucideIcon,
} from 'lucide-react';
import { appRegistry } from '../../apps';
import { ROUTES } from '../../config/routes';
import { useMyAccessibleApps } from '../../hooks/use-app-permissions';
import { useSettingsStore } from '../../stores/settings-store';
import { Tooltip } from '../ui/tooltip';
import type { ThemeMode } from '@atlas-platform/shared';

const RAIL_WIDTH = 56;

// Lucide icon per app id. Any app not in the map falls back to Grid.
const RAIL_ICONS: Record<string, LucideIcon> = {
  crm: Users,
  hr: UserCog,
  work: FolderKanban,
  calendar: CalendarIcon,
  sign: FileSignature,
  invoices: Receipt,
  drive: HardDrive,
  tasks: CheckSquare,
  docs: FileText,
  draw: PenTool,
  system: Settings2,
};

const THEME_CYCLE: ThemeMode[] = ['light', 'dark', 'system'];
const THEME_ICONS: Record<ThemeMode, LucideIcon> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

function RailButton({
  icon: Icon,
  label,
  isActive,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const color = isActive
    ? 'var(--color-accent-primary)'
    : hovered
      ? 'var(--color-text-primary)'
      : 'var(--color-text-tertiary)';

  return (
    <Tooltip content={label} side="right">
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        aria-label={label}
        aria-current={isActive ? 'page' : undefined}
        style={{
          position: 'relative',
          width: 36,
          height: 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 8,
          border: 'none',
          background: isActive ? 'var(--color-accent-subtle)' : 'transparent',
          color,
          cursor: 'pointer',
          padding: 0,
          transition: 'background 120ms ease, color 120ms ease',
        }}
      >
        {isActive && (
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: -10,
              top: 8,
              bottom: 8,
              width: 2,
              borderRadius: 2,
              background: 'var(--color-accent-primary)',
            }}
          />
        )}
        <Icon size={18} strokeWidth={1.75} />
      </button>
    </Tooltip>
  );
}

function ThemeToggleRail() {
  const { t } = useTranslation();
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const current: ThemeMode = theme ?? 'system';
  const Icon = THEME_ICONS[current];

  const handleClick = () => {
    const idx = THEME_CYCLE.indexOf(current);
    const next = THEME_CYCLE[(idx + 1) % THEME_CYCLE.length];
    setTheme(next);
  };

  return (
    <RailButton
      icon={Icon}
      label={t('sidebar.themeToggle', { mode: current, defaultValue: `Theme: ${current}` })}
      isActive={false}
      onClick={handleClick}
    />
  );
}

export function AppRail() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { data: myApps } = useMyAccessibleApps();

  const navItems = appRegistry.getNavItems();

  // Filter apps by accessibility (same pattern as sidebar.tsx used)
  const visibleApps = navItems.filter(({ id }) => {
    if (!myApps) return true;
    if (myApps.appIds === '__all__') return true;
    return (myApps.appIds as string[]).includes(id);
  });

  const isActive = (route: string) =>
    route === ROUTES.HOME
      ? location.pathname === ROUTES.HOME
      : location.pathname.startsWith(route);

  return (
    <aside
      aria-label="Primary navigation"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        width: RAIL_WIDTH,
        background: 'var(--color-bg-secondary)',
        borderRight: '1px solid var(--color-border-primary)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '10px 0',
        gap: 2,
        zIndex: 30,
      }}
      className="app-rail"
    >
      <RailButton
        icon={Home}
        label={t('sidebar.home', 'Home')}
        isActive={isActive(ROUTES.HOME)}
        onClick={() => navigate(ROUTES.HOME)}
      />

      <div
        aria-hidden="true"
        style={{
          width: 28,
          height: 1,
          background: 'var(--color-border-primary)',
          margin: '6px 0',
          flexShrink: 0,
        }}
      />

      {visibleApps.map(({ id, labelKey, route }) => {
        const Icon = RAIL_ICONS[id] ?? Grid;
        return (
          <RailButton
            key={id}
            icon={Icon}
            label={t(labelKey, id.charAt(0).toUpperCase() + id.slice(1))}
            isActive={isActive(route)}
            onClick={() => navigate(route)}
          />
        );
      })}

      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <div
          aria-hidden="true"
          style={{
            width: 28,
            height: 1,
            background: 'var(--color-border-primary)',
            margin: '6px 0',
            flexShrink: 0,
          }}
        />
        <RailButton
          icon={Building2}
          label={t('sidebar.organization', 'Organization')}
          isActive={isActive(ROUTES.ORG)}
          onClick={() => navigate(ROUTES.ORG)}
        />
        <RailButton
          icon={Settings}
          label={t('sidebar.settings', 'Settings')}
          isActive={isActive(ROUTES.SETTINGS)}
          onClick={() => navigate(ROUTES.SETTINGS)}
        />
        <ThemeToggleRail />
      </div>
    </aside>
  );
}
