import { useState, type CSSProperties, type ReactNode, type ReactElement } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import { X, Palette, Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  useDrawSettingsStore,
  type DrawBackground,
  type DrawExportQuality,
  type DrawAutoSaveInterval,
} from '../../stores/draw-settings-store';
import {
  SettingsSection,
  SettingsRow,
  SettingsToggle,
  SelectableCard,
  SettingsSelect,
} from '../settings/settings-primitives';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DrawNavItemId = 'canvas' | 'export';

interface DrawSidebarNavItem {
  id: DrawNavItemId;
  label: string;
  icon: typeof Palette;
}

interface DrawSidebarSection {
  title: string;
  items: DrawSidebarNavItem[];
}

// ---------------------------------------------------------------------------
// Panel: Canvas
// ---------------------------------------------------------------------------

const BG_COLORS: Record<DrawBackground, string> = {
  white: '#ffffff',
  light: '#f5f5f5',
  dark: '#1e1e1e',
};

export function DrawCanvasPanel() {
  const { t } = useTranslation();
  const {
    gridMode, setGridMode,
    snapToGrid, setSnapToGrid,
    defaultBackground, setDefaultBackground,
    autoSaveInterval, setAutoSaveInterval,
  } = useDrawSettingsStore();

  const autoSaveOptions: Array<{ value: DrawAutoSaveInterval; label: string }> = [
    { value: 1000, label: t('draw.autoSave1s') },
    { value: 2000, label: t('draw.autoSave2s') },
    { value: 5000, label: t('draw.autoSave5s') },
    { value: 10000, label: t('draw.autoSave10s') },
  ];

  const bgOptions: { id: DrawBackground; label: string }[] = [
    { id: 'white', label: t('draw.bgWhite') },
    { id: 'light', label: t('draw.bgLight') },
    { id: 'dark', label: t('draw.bgDark') },
  ];

  return (
    <div>
      <SettingsSection title={t('draw.settingsCanvas')} description={t('draw.settingsCanvasDesc')}>
        <SettingsRow label={t('draw.gridMode')} description={t('draw.gridModeDesc')}>
          <SettingsToggle checked={gridMode} onChange={setGridMode} label={t('draw.gridMode')} />
        </SettingsRow>
        <SettingsRow label={t('draw.snapToGrid')} description={t('draw.snapToGridDesc')}>
          <SettingsToggle checked={snapToGrid} onChange={setSnapToGrid} label={t('draw.snapToGrid')} />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title={t('draw.defaultBg')}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--spacing-sm)' }}>
          {bgOptions.map((bg) => (
            <SelectableCard
              key={bg.id}
              selected={defaultBackground === bg.id}
              onClick={() => setDefaultBackground(bg.id)}
              style={{ padding: 'var(--spacing-md) var(--spacing-lg)' }}
            >
              <span
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 'var(--radius-md)',
                  background: BG_COLORS[bg.id],
                  border: '1px solid var(--color-border-primary)',
                }}
              />
              <span
                style={{
                  fontSize: 'var(--font-size-sm)',
                  color: defaultBackground === bg.id ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
                  fontWeight: defaultBackground === bg.id
                    ? ('var(--font-weight-medium)' as CSSProperties['fontWeight'])
                    : ('var(--font-weight-normal)' as CSSProperties['fontWeight']),
                }}
              >
                {bg.label}
              </span>
            </SelectableCard>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection title={t('draw.autoSaveInterval')}>
        <SettingsRow label={t('draw.autoSaveInterval')} description="">
          <SettingsSelect
            value={autoSaveInterval}
            options={autoSaveOptions}
            onChange={setAutoSaveInterval}
          />
        </SettingsRow>
      </SettingsSection>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel: Export
// ---------------------------------------------------------------------------

export function DrawExportPanel() {
  const { t } = useTranslation();
  const {
    exportQuality, setExportQuality,
    exportWithBackground, setExportWithBackground,
  } = useDrawSettingsStore();

  const qualityOptions: Array<{ value: DrawExportQuality; label: string }> = [
    { value: 1, label: t('draw.qualityStandard') },
    { value: 2, label: t('draw.qualityHigh') },
    { value: 4, label: t('draw.qualityUltra') },
  ];

  return (
    <div>
      <SettingsSection title={t('draw.settingsExport')} description={t('draw.settingsExportDesc')}>
        <SettingsRow label={t('draw.exportQuality')}>
          <SettingsSelect
            value={exportQuality}
            options={qualityOptions}
            onChange={setExportQuality}
          />
        </SettingsRow>
        <SettingsRow label={t('draw.exportBg')} description={t('draw.exportBgDesc')}>
          <SettingsToggle checked={exportWithBackground} onChange={setExportWithBackground} label={t('draw.exportBg')} />
        </SettingsRow>
      </SettingsSection>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel map
// ---------------------------------------------------------------------------

const PANELS: Record<DrawNavItemId, () => ReactElement> = {
  canvas: DrawCanvasPanel,
  export: DrawExportPanel,
};

// ---------------------------------------------------------------------------
// Sidebar nav button
// ---------------------------------------------------------------------------

function SidebarNavButton({
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
        padding: '7px var(--spacing-md)',
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
        marginBottom: 1,
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

// ---------------------------------------------------------------------------
// Main modal
// ---------------------------------------------------------------------------

interface DrawSettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function DrawSettingsModal({ open, onClose }: DrawSettingsModalProps) {
  const { t } = useTranslation();
  const [activeItem, setActiveItem] = useState<DrawNavItemId>('canvas');
  const ActivePanel = PANELS[activeItem];

  const sidebarSections: DrawSidebarSection[] = [
    {
      title: t('draw.title'),
      items: [
        { id: 'canvas', label: t('draw.settingsCanvas'), icon: Palette },
        { id: 'export', label: t('draw.settingsExport'), icon: Download },
      ],
    },
  ];

  const panelTitles: Record<DrawNavItemId, string> = {
    canvas: t('draw.settingsCanvas'),
    export: t('draw.settingsExport'),
  };

  const panelDescriptions: Record<DrawNavItemId, string> = {
    canvas: t('draw.settingsCanvasDesc'),
    export: t('draw.settingsExportDesc'),
  };

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: 'fixed',
            inset: 0,
            background: 'var(--color-bg-overlay)',
            zIndex: 200,
            animation: 'fadeIn 150ms ease',
          }}
        />

        <Dialog.Content
          aria-describedby={undefined}
          onPointerDownOutside={(e) => e.preventDefault()}
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 660,
            maxWidth: 'calc(100vw - 48px)',
            height: 520,
            maxHeight: 'calc(100vh - 48px)',
            background: 'var(--color-bg-elevated)',
            borderRadius: 'var(--radius-xl)',
            boxShadow: 'var(--shadow-elevated)',
            display: 'flex',
            overflow: 'hidden',
            zIndex: 201,
            animation: 'scaleIn 150ms ease',
          }}
        >
          <VisuallyHidden.Root>
            <Dialog.Title>{t('draw.settings')}</Dialog.Title>
          </VisuallyHidden.Root>

          {/* Left sidebar */}
          <div
            style={{
              width: 200,
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
            <div
              style={{
                padding: 'var(--spacing-sm) var(--spacing-md)',
                marginBottom: 'var(--spacing-md)',
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
                {t('draw.settings')}
              </span>
            </div>

            {sidebarSections.map((section) => (
              <div key={section.title}>
                <div
                  style={{
                    padding: 'var(--spacing-xs) var(--spacing-md)',
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 'var(--font-weight-semibold)' as CSSProperties['fontWeight'],
                    color: 'var(--color-text-tertiary)',
                    fontFamily: 'var(--font-family)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    marginBottom: 2,
                  }}
                >
                  {section.title}
                </div>

                {section.items.map(({ id, label, icon: Icon }) => (
                  <SidebarNavButton
                    key={id}
                    isActive={activeItem === id}
                    onClick={() => setActiveItem(id)}
                    label={label}
                    icon={<Icon size={16} />}
                  />
                ))}
              </div>
            ))}
          </div>

          {/* Right content area */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Content header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 'var(--spacing-lg) var(--spacing-2xl)',
                borderBottom: '1px solid var(--color-border-primary)',
                flexShrink: 0,
              }}
            >
              <div>
                <h2
                  style={{
                    margin: 0,
                    fontSize: 'var(--font-size-xl)',
                    fontWeight: 'var(--font-weight-semibold)' as CSSProperties['fontWeight'],
                    color: 'var(--color-text-primary)',
                    fontFamily: 'var(--font-family)',
                  }}
                >
                  {panelTitles[activeItem]}
                </h2>
                <p
                  style={{
                    margin: '4px 0 0',
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--color-text-tertiary)',
                    fontFamily: 'var(--font-family)',
                  }}
                >
                  {panelDescriptions[activeItem]}
                </p>
              </div>

              <Dialog.Close asChild>
                <button
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
                    flexShrink: 0,
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
              </Dialog.Close>
            </div>

            {/* Scrollable content */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: 'var(--spacing-2xl)',
                boxSizing: 'border-box',
              }}
            >
              <ActivePanel />
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
