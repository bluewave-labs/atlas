import { useCallback, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { isTenantOwner } from '@atlas-platform/shared';
import { appRegistry } from '../../apps';
import { useMyAccessibleApps } from '../../hooks/use-app-permissions';
import { useAuthStore } from '../../stores/auth-store';
import { FULL_BLEED_BRAND_ICONS, getBrandIconScale } from '../icons/app-icons';
import '../../styles/global-dock.css';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Base size of the dock card (px) */
const BASE = 36;
/** Maximum size on hover (px) */
const MAX = 56;
/** Distance in px from cursor at which magnification drops to zero */
const RANGE = 150;
/** Base icon render size within the idle-size card */
const BASE_ICON = 20;
/** Ratio of icon size to card size — used to drive the CSS variable */
const ICON_RATIO = BASE_ICON / BASE;

/**
 * Per-app background for brand icons. Mirrors the home-page BRAND_ICON_BACKGROUNDS
 * but kept local so the global dock can evolve independently.
 */
const BRAND_ICON_BACKGROUNDS: Record<string, string> = {
  crm: '#ffffff',
  work: '#ffffff',
  projects: '#ffffff',
  invoices: '#ffffff',
  hr: '#fff1ea',
  tasks: '#eef0ff',
  system: '#f5f5f7',
  drive: '#fff4e6',
  calendar: 'linear-gradient(145deg, #5dadff 0%, #2563eb 50%, #1e3a8a 100%)',
};

// ─── Component ────────────────────────────────────────────────────────────────

export function GlobalDock() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const dockRef = useRef<HTMLDivElement>(null);

  // Accessible apps for the current user
  const { data: myApps } = useMyAccessibleApps();
  const tenantRole = useAuthStore((s) => s.tenantRole);
  const isOwner = isTenantOwner(tenantRole);

  const dockApps = useMemo(() => {
    const accessibleSet =
      myApps?.appIds === '__all__'
        ? null
        : new Set(myApps?.appIds ?? []);

    return appRegistry
      .getAll()
      .filter((app) => app.id !== 'system' || isOwner)
      .filter((app) => !accessibleSet || accessibleSet.has(app.id))
      .map((app) => ({
        id: app.id,
        icon: app.icon,
        label: t(app.labelKey, app.name),
        color: app.color,
        route: app.routes[0]?.path ?? `/${app.id}`,
      }));
  }, [myApps, isOwner, t]);

  // ── Magnification handlers ──────────────────────────────────────────────

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const dock = dockRef.current;
    if (!dock) return;
    const mouseX = e.clientX;
    const items = dock.querySelectorAll<HTMLElement>('.global-dock-item');
    items.forEach((item) => {
      item.classList.remove('dock-resetting');
      const rect = item.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const distance = Math.abs(mouseX - centerX);
      const normalized = Math.min(distance / RANGE, 1);
      const scale = Math.max(0, 1 - normalized * normalized);
      const size = BASE + (MAX - BASE) * scale;
      const mt = -(size - BASE);
      item.style.width = `${size}px`;
      item.style.height = `${size}px`;
      item.style.marginTop = `${mt}px`;
      item.style.setProperty(
        '--dock-icon-size',
        `${Math.round(size * ICON_RATIO)}px`,
      );
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    const dock = dockRef.current;
    if (!dock) return;
    const items = dock.querySelectorAll<HTMLElement>('.global-dock-item');
    items.forEach((item) => {
      item.classList.add('dock-resetting');
      item.style.width = `${BASE}px`;
      item.style.height = `${BASE}px`;
      item.style.marginTop = '0px';
      item.style.setProperty('--dock-icon-size', `${BASE_ICON}px`);
    });
    setTimeout(() => {
      items.forEach((item) => item.classList.remove('dock-resetting'));
    }, 350);
  }, []);

  // ── Active-app detection ────────────────────────────────────────────────

  const activeAppId = useMemo(() => {
    const path = location.pathname;
    for (const app of dockApps) {
      // Match if pathname starts with the app route (handles sub-routes)
      if (path === app.route || path.startsWith(app.route + '/')) {
        return app.id;
      }
    }
    return null;
  }, [location.pathname, dockApps]);

  // Don't render until apps have loaded
  if (!myApps || dockApps.length === 0) return null;

  return (
    <div
      ref={dockRef}
      className="global-dock"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {dockApps.map((app) => {
        const Icon = app.icon;
        const brandBg = BRAND_ICON_BACKGROUNDS[app.id];
        const isBrandIcon = brandBg !== undefined;
        const isFullBleed = FULL_BLEED_BRAND_ICONS.has(app.id);
        const isActive = activeAppId === app.id;

        return (
          <div
            key={app.id}
            className={`global-dock-item${isActive ? ' active' : ''}`}
            onClick={() => navigate(app.route)}
            style={{
              ['--dock-icon-size' as string]: `${BASE_ICON}px`,
            }}
          >
            {isFullBleed ? (
              <div
                className="global-dock-icon-inner"
                style={{
                  background: 'transparent',
                  boxShadow:
                    '0 2px 8px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)',
                  overflow: 'hidden',
                  padding: 0,
                }}
              >
                <Icon
                  style={{
                    width: '100%',
                    height: '100%',
                    display: 'block',
                  }}
                />
              </div>
            ) : (
              <div
                className="global-dock-icon-inner"
                style={{
                  background: isBrandIcon
                    ? brandBg
                    : `linear-gradient(145deg, color-mix(in srgb, ${app.color} 85%, #fff) 0%, ${app.color} 50%, color-mix(in srgb, ${app.color} 70%, #000) 100%)`,
                  boxShadow: isBrandIcon
                    ? '0 2px 8px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.05)'
                    : `0 2px 8px ${app.color}44, inset 0 1px 1px rgba(255,255,255,0.2), inset 0 -1px 2px rgba(0,0,0,0.15)`,
                }}
              >
                {isBrandIcon
                  ? (() => {
                      const brandScale = getBrandIconScale(app.id);
                      return (
                        <Icon
                          size={Math.round(BASE_ICON * brandScale)}
                          style={{
                            width: `calc(var(--dock-icon-size, ${BASE_ICON}px) * ${brandScale})`,
                            height: `calc(var(--dock-icon-size, ${BASE_ICON}px) * ${brandScale})`,
                          }}
                        />
                      );
                    })()
                  : (
                    <Icon
                      size={BASE_ICON}
                      color="#fff"
                      strokeWidth={1.6}
                      style={{
                        width: `var(--dock-icon-size, ${BASE_ICON}px)`,
                        height: `var(--dock-icon-size, ${BASE_ICON}px)`,
                        filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.25))',
                      }}
                    />
                  )}
              </div>
            )}
            <span className="global-dock-tooltip">{app.label}</span>
          </div>
        );
      })}
    </div>
  );
}
