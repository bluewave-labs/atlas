import { useState, useEffect, useCallback, type CSSProperties, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { settingsCategories } from '../config/settings-registry';
import { SidebarNavButton } from '../components/settings/settings-modal';
import { useUIStore } from '../stores/ui-store';

// ---------------------------------------------------------------------------
// Settings modal — two-level navigation overlay
// ---------------------------------------------------------------------------

export function SettingsModal() {
  const { settingsOpen, settingsApp, settingsPanel, closeSettings } = useUIStore();

  // Resolve initial category from store
  const resolvedCategory = settingsCategories.find((c) => c.id === settingsApp) ?? settingsCategories[0];
  const [activeCategoryId, setActiveCategoryId] = useState(resolvedCategory.id);

  // Resolve initial panel
  const category = settingsCategories.find((c) => c.id === activeCategoryId) ?? settingsCategories[0];
  const resolvedPanel = settingsPanel
    ? category.panels.find((p) => p.id === settingsPanel) ?? category.panels[0]
    : category.panels[0];
  const [activePanelId, setActivePanelId] = useState(resolvedPanel.id);

  // Sync when store values change (e.g. opened from a different app)
  useEffect(() => {
    if (settingsOpen) {
      const cat = settingsCategories.find((c) => c.id === settingsApp) ?? settingsCategories[0];
      setActiveCategoryId(cat.id);
      const panel = settingsPanel ? cat.panels.find((p) => p.id === settingsPanel) : cat.panels[0];
      setActivePanelId(panel?.id ?? cat.panels[0]?.id ?? '');
    }
  }, [settingsOpen, settingsApp, settingsPanel]);

  // Close on Escape
  useEffect(() => {
    if (!settingsOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSettings();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [settingsOpen, closeSettings]);

  const handleCategoryClick = useCallback((catId: string) => {
    setActiveCategoryId(catId);
    const cat = settingsCategories.find((c) => c.id === catId)!;
    setActivePanelId(cat.panels[0]?.id ?? '');
  }, []);

  const handlePanelClick = useCallback((panId: string) => {
    setActivePanelId(panId);
  }, []);

  if (!settingsOpen) return null;

  // Resolve the active panel component
  const currentCategory = settingsCategories.find((c) => c.id === activeCategoryId) ?? settingsCategories[0];
  const currentPanel = currentCategory.panels.find((p) => p.id === activePanelId) ?? currentCategory.panels[0];
  const ActivePanelComponent = currentPanel?.component;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={closeSettings}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.45)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          zIndex: 200,
          animation: 'fadeIn 150ms ease',
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 960,
          maxWidth: 'calc(100vw - 48px)',
          height: 640,
          maxHeight: 'calc(100vh - 48px)',
          background: 'var(--color-bg-elevated)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-elevated)',
          display: 'flex',
          overflow: 'hidden',
          zIndex: 201,
          animation: 'scaleIn 150ms ease',
          fontFamily: 'var(--font-family)',
        }}
      >
        {/* Primary sidebar — categories */}
        <div
          style={{
            width: 180,
            flexShrink: 0,
            background: 'var(--color-bg-tertiary)',
            borderRight: '1px solid var(--color-border-primary)',
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
            padding: 'var(--spacing-lg) var(--spacing-sm)',
            boxSizing: 'border-box',
          }}
        >
          {/* Title */}
          <div
            style={{
              padding: 'var(--spacing-xs) var(--spacing-md)',
              marginBottom: 'var(--spacing-sm)',
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
                color={cat.color}
              />
            );
          })}
        </div>

        {/* Secondary sidebar — panels for the active category */}
        <div
          style={{
            width: 180,
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
          {/* Close button */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              padding: 'var(--spacing-md) var(--spacing-md) 0',
              flexShrink: 0,
            }}
          >
            <button
              onClick={closeSettings}
              aria-label="Close settings"
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
                color: 'var(--color-text-tertiary)',
                cursor: 'pointer',
                transition: 'background var(--transition-normal), color var(--transition-normal)',
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
              <X size={18} />
            </button>
          </div>

          {/* Scrollable content */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '0 var(--spacing-2xl) var(--spacing-2xl)',
              boxSizing: 'border-box',
            }}
          >
            <div style={{ maxWidth: 700 }}>
              {ActivePanelComponent && <ActivePanelComponent />}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// Keep the old export name for the route (renders nothing, redirect handled by modal)
export function SettingsPage() {
  const { openSettings } = useUIStore();

  // If someone navigates to /settings directly, open the modal and go home
  useEffect(() => {
    openSettings();
  }, [openSettings]);

  return null;
}

// ---------------------------------------------------------------------------
// Category button (primary sidebar)
// ---------------------------------------------------------------------------

function CategoryButton({
  isActive,
  onClick,
  label,
  icon,
  color,
}: {
  isActive: boolean;
  onClick: () => void;
  label: string;
  icon: ReactNode;
  color?: string;
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
        padding: '7px var(--spacing-md)',
        background: isActive
          ? 'var(--color-surface-selected)'
          : hovered
            ? 'var(--color-surface-hover)'
            : 'transparent',
        border: 'none',
        borderRadius: 'var(--radius-md)',
        color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
        fontSize: 'var(--font-size-sm)',
        fontFamily: 'var(--font-family)',
        fontWeight: isActive
          ? ('var(--font-weight-medium)' as CSSProperties['fontWeight'])
          : ('var(--font-weight-normal)' as CSSProperties['fontWeight']),
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background var(--transition-normal), color var(--transition-normal)',
        outline: 'none',
        marginBottom: 1,
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          flexShrink: 0,
          color: color || 'currentColor',
        }}
      >
        {icon}
      </span>
      {label}
    </button>
  );
}
