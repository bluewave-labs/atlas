import { useMemo } from 'react';
import { useLocation, useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { HelpCircle, Search, ChevronRight } from 'lucide-react';
import { appRegistry } from '../../apps';
import { useUIStore } from '../../stores/ui-store';
import { useBreadcrumbValue, type BreadcrumbItem } from '../../lib/breadcrumb-context';
import { NotificationBell } from '../notifications/notification-bell';
import { AccountMenu } from './account-menu';

const TOP_BAR_HEIGHT = 48;

function formatViewId(viewId: string): string {
  return viewId
    .split('-')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
}

function deriveCrumbsFromRoute(
  pathname: string,
  viewParam: string | null,
  t: TFunction,
): BreadcrumbItem[] {
  const navItems = appRegistry.getNavItems();
  const match = navItems.find(({ route }) => pathname === route || pathname.startsWith(route + '/') || pathname.startsWith(route + '?'));
  if (!match) {
    if (pathname.startsWith('/settings')) {
      return [{ label: t('settings.title', 'Settings') }];
    }
    if (pathname.startsWith('/org')) {
      return [{ label: t('sidebar.organization', 'Organization') }];
    }
    return [];
  }
  const appLabel = t(match.labelKey, match.id.charAt(0).toUpperCase() + match.id.slice(1));
  const crumbs: BreadcrumbItem[] = [{ label: appLabel, to: match.route }];
  if (viewParam) {
    crumbs.push({ label: formatViewId(viewParam) });
  }
  return crumbs;
}

export function TopBar() {
  const { t } = useTranslation();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const overrideCrumbs = useBreadcrumbValue();
  const toggleCommandPalette = useUIStore((s) => s.toggleCommandPalette);
  const toggleShortcutHelp = useUIStore((s) => s.toggleShortcutHelp);

  const viewParam = searchParams.get('view');
  const crumbs = useMemo(() => {
    if (overrideCrumbs) return overrideCrumbs;
    return deriveCrumbsFromRoute(location.pathname, viewParam, t);
  }, [overrideCrumbs, location.pathname, viewParam, t]);

  return (
    <header
      aria-label="Top bar"
      className="app-top-bar"
      style={{
        height: TOP_BAR_HEIGHT,
        flexShrink: 0,
        background: 'var(--color-bg-elevated)',
        borderBottom: '1px solid var(--color-border-primary)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: 12,
        zIndex: 29,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
        }}
      >
        {crumbs.map((item, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              {i > 0 && <ChevronRight size={12} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />}
              {isLast || !item.to ? (
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: isLast ? 500 : 400,
                    color: isLast ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontFamily: 'var(--font-family)',
                  }}
                >
                  {item.label}
                </span>
              ) : (
                <Link
                  to={item.to}
                  style={{
                    fontSize: 13,
                    fontWeight: 400,
                    color: 'var(--color-text-secondary)',
                    textDecoration: 'none',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontFamily: 'var(--font-family)',
                  }}
                >
                  {item.label}
                </Link>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <button
          type="button"
          onClick={() => toggleCommandPalette()}
          aria-label={t('commandPalette.search', 'Search or jump to')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            height: 30,
            padding: '0 10px',
            minWidth: 220,
            background: 'var(--color-bg-tertiary)',
            border: '1px solid var(--color-border-primary)',
            borderRadius: 6,
            color: 'var(--color-text-tertiary)',
            fontSize: 13,
            fontFamily: 'var(--font-family)',
            cursor: 'pointer',
          }}
        >
          <Search size={14} />
          <span>{t('commandPalette.search', 'Search or jump to…')}</span>
          <span
            style={{
              marginLeft: 'auto',
              fontFamily: '"SF Mono", Menlo, monospace',
              fontSize: 11,
              background: 'var(--color-bg-elevated)',
              border: '1px solid var(--color-border-primary)',
              borderRadius: 3,
              padding: '1px 5px',
              color: 'var(--color-text-tertiary)',
            }}
          >
            ⌘K
          </span>
        </button>

        <NotificationBell />

        <button
          type="button"
          onClick={() => toggleShortcutHelp()}
          aria-label={t('common.help', 'Help')}
          style={{
            width: 30,
            height: 30,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: 'none',
            background: 'transparent',
            color: 'var(--color-text-tertiary)',
            borderRadius: 6,
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--color-surface-hover)';
            e.currentTarget.style.color = 'var(--color-text-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--color-text-tertiary)';
          }}
        >
          <HelpCircle size={16} />
        </button>

        <AccountMenu />
      </div>
    </header>
  );
}
