import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { SettingsCategory } from '../../config/settings-registry';
import { categoryI18nKey, panelI18nKey } from '../../config/settings-registry';
import { urlForPanel } from '../../config/settings-url';

interface SettingsSidebarProps {
  categories: SettingsCategory[];
  activeCategoryId: string;
  activePanelId: string;
}

export function SettingsSidebar({ categories, activeCategoryId, activePanelId }: SettingsSidebarProps) {
  const { t } = useTranslation();

  return (
    <aside
      aria-label="Settings navigation"
      style={{
        width: 260,
        flexShrink: 0,
        background: 'var(--color-bg-secondary)',
        borderRight: '1px solid var(--color-border-primary)',
        overflowY: 'auto',
        padding: '18px 0',
      }}
    >
      <div
        style={{
          padding: '0 18px 14px',
          fontSize: 'var(--font-size-lg)',
          fontWeight: 'var(--font-weight-semibold)',
          color: 'var(--color-text-primary)',
          fontFamily: 'var(--font-family)',
        }}
      >
        {t('settings.title', 'Settings')}
      </div>

      {categories.map((cat) => {
        const catKey = categoryI18nKey(cat.id);
        const catLabel = catKey ? t(catKey, cat.label) : cat.label;
        return (
          <div key={cat.id} style={{ padding: '10px 0' }}>
            <div
              style={{
                padding: '0 18px 6px',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 'var(--font-weight-medium)',
                color: 'var(--color-text-tertiary)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                fontFamily: 'var(--font-family)',
              }}
            >
              {catLabel}
            </div>
            {cat.panels.map((panel) => {
              const isActive = cat.id === activeCategoryId && panel.id === activePanelId;
              const panelKey = panelI18nKey(panel.id);
              const panelLabel = panelKey ? t(panelKey, panel.label) : panel.label;
              const Icon = panel.icon;
              return (
                <Link
                  key={panel.id}
                  to={urlForPanel(cat.id, panel.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '6px 18px',
                    fontSize: 'var(--font-size-sm)',
                    fontFamily: 'var(--font-family)',
                    color: isActive ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
                    background: isActive ? 'var(--color-accent-subtle)' : 'transparent',
                    textDecoration: 'none',
                    borderLeft: isActive ? '2px solid var(--color-accent-primary)' : '2px solid transparent',
                    transition: 'background 120ms ease, color 120ms ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'var(--color-surface-hover)';
                      e.currentTarget.style.color = 'var(--color-text-primary)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = 'var(--color-text-secondary)';
                    }
                  }}
                >
                  <Icon size={15} strokeWidth={1.75} />
                  {panelLabel}
                </Link>
              );
            })}
          </div>
        );
      })}
    </aside>
  );
}
