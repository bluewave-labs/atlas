import { useState, useEffect, useCallback, type CSSProperties, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { settingsCategories } from '../config/settings-registry';
import { SidebarNavButton } from '../components/settings/settings-modal';

// ---------------------------------------------------------------------------
// Settings page — two-level navigation
// ---------------------------------------------------------------------------

export function SettingsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Read URL params (defaults: global / first panel)
  const appParam = searchParams.get('app') || 'global';
  const panelParam = searchParams.get('panel');

  // Find active category
  const activeCategory = settingsCategories.find((c) => c.id === appParam) ?? settingsCategories[0];
  const [activeCategoryId, setActiveCategoryId] = useState(activeCategory.id);

  // Find active panel
  const category = settingsCategories.find((c) => c.id === activeCategoryId) ?? settingsCategories[0];
  const initialPanel = panelParam
    ? category.panels.find((p) => p.id === panelParam) ?? category.panels[0]
    : category.panels[0];
  const [activePanelId, setActivePanelId] = useState(initialPanel.id);

  // Sync category from URL on mount
  useEffect(() => {
    const cat = settingsCategories.find((c) => c.id === appParam);
    if (cat) {
      setActiveCategoryId(cat.id);
      const panel = panelParam ? cat.panels.find((p) => p.id === panelParam) : cat.panels[0];
      setActivePanelId(panel?.id ?? cat.panels[0]?.id ?? '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update URL when navigation changes (replaceState — no history pushes)
  const updateUrl = useCallback(
    (catId: string, panId: string) => {
      setSearchParams({ app: catId, panel: panId }, { replace: true });
    },
    [setSearchParams],
  );

  const handleCategoryClick = useCallback(
    (catId: string) => {
      setActiveCategoryId(catId);
      const cat = settingsCategories.find((c) => c.id === catId)!;
      const firstPanel = cat.panels[0]?.id ?? '';
      setActivePanelId(firstPanel);
      updateUrl(catId, firstPanel);
    },
    [updateUrl],
  );

  const handlePanelClick = useCallback(
    (panId: string) => {
      setActivePanelId(panId);
      updateUrl(activeCategoryId, panId);
    },
    [activeCategoryId, updateUrl],
  );

  // Resolve the active panel component
  const currentCategory = settingsCategories.find((c) => c.id === activeCategoryId) ?? settingsCategories[0];
  const currentPanel = currentCategory.panels.find((p) => p.id === activePanelId) ?? currentCategory.panels[0];
  const ActivePanelComponent = currentPanel?.component;

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        background: 'var(--color-bg-primary)',
        fontFamily: 'var(--font-family)',
        overflow: 'hidden',
      }}
    >
      {/* Primary sidebar — categories */}
      <div
        style={{
          width: 220,
          flexShrink: 0,
          background: 'var(--color-bg-secondary)',
          borderRight: '1px solid var(--color-border-primary)',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          padding: 'var(--spacing-lg) var(--spacing-sm)',
          boxSizing: 'border-box',
        }}
      >
        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-sm)',
            width: '100%',
            padding: '7px var(--spacing-md)',
            background: 'transparent',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-text-secondary)',
            fontSize: 'var(--font-size-sm)',
            fontFamily: 'var(--font-family)',
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'background var(--transition-normal), color var(--transition-normal)',
            marginBottom: 'var(--spacing-sm)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--color-surface-hover)';
            e.currentTarget.style.color = 'var(--color-text-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--color-text-secondary)';
          }}
        >
          <ArrowLeft size={16} />
          Back
        </button>

        {/* Title */}
        <div
          style={{
            padding: 'var(--spacing-sm) var(--spacing-md)',
            marginBottom: 'var(--spacing-lg)',
          }}
        >
          <span
            style={{
              fontSize: 'var(--font-size-lg)',
              fontWeight: 'var(--font-weight-semibold)' as CSSProperties['fontWeight'],
              color: 'var(--color-text-primary)',
              fontFamily: 'var(--font-family)',
            }}
          >
            Settings
          </span>
        </div>

        {/* Category list */}
        {settingsCategories.map((cat) => {
          const isActive = activeCategoryId === cat.id;
          const Icon = cat.icon;
          return (
            <CategoryButton
              key={cat.id}
              isActive={isActive}
              onClick={() => handleCategoryClick(cat.id)}
              label={cat.label}
              icon={<Icon size={16} />}
            />
          );
        })}
      </div>

      {/* Secondary sidebar — panels for the active category */}
      <div
        style={{
          width: 190,
          flexShrink: 0,
          background: 'var(--color-bg-primary)',
          borderRight: '1px solid var(--color-border-primary)',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          padding: 'var(--spacing-lg) var(--spacing-sm)',
          boxSizing: 'border-box',
        }}
      >
        {/* Category header */}
        <div
          style={{
            padding: 'var(--spacing-xs) var(--spacing-md)',
            marginBottom: 'var(--spacing-sm)',
          }}
        >
          <span
            style={{
              fontSize: 'var(--font-size-xs)',
              fontWeight: 'var(--font-weight-semibold)' as CSSProperties['fontWeight'],
              color: 'var(--color-text-tertiary)',
              fontFamily: 'var(--font-family)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            {currentCategory.label}
          </span>
        </div>

        {currentCategory.panels.map((panel) => {
          const PanelIcon = panel.icon;
          return (
            <SidebarNavButton
              key={panel.id}
              isActive={activePanelId === panel.id}
              onClick={() => handlePanelClick(panel.id)}
              label={panel.label}
              icon={<PanelIcon size={16} />}
            />
          );
        })}
      </div>

      {/* Content area */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Scrollable content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 'var(--spacing-2xl)',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ maxWidth: 700, margin: '0 auto' }}>
            {ActivePanelComponent && <ActivePanelComponent />}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Category button (primary sidebar)
// ---------------------------------------------------------------------------

function CategoryButton({
  isActive,
  onClick,
  label,
  icon,
}: {
  isActive: boolean;
  onClick: () => void;
  label: string;
  icon: ReactNode;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-current={isActive ? 'page' : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--spacing-sm)',
        width: '100%',
        padding: '8px var(--spacing-md)',
        background: isActive
          ? 'var(--color-surface-selected)'
          : hovered
            ? 'var(--color-surface-hover)'
            : 'transparent',
        border: 'none',
        borderRadius: 'var(--radius-md)',
        color: isActive ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
        fontSize: 'var(--font-size-sm)',
        fontFamily: 'var(--font-family)',
        fontWeight: isActive
          ? ('var(--font-weight-medium)' as CSSProperties['fontWeight'])
          : ('var(--font-weight-normal)' as CSSProperties['fontWeight']),
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background var(--transition-normal), color var(--transition-normal)',
        outline: 'none',
        marginBottom: 2,
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          flexShrink: 0,
          color: isActive ? 'var(--color-accent-primary)' : 'currentColor',
        }}
      >
        {icon}
      </span>
      {label}
    </button>
  );
}
