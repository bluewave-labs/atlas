import { useState, type CSSProperties, type ReactElement } from 'react';
import { Palette, Download } from 'lucide-react';
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
import { Modal, ModalSidebarNavButton } from '../ui/modal';

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
    <Modal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      width={660}
      height={520}
      title={t('draw.settings')}
    >
      {/* Left sidebar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          bottom: 0,
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
              <ModalSidebarNavButton
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
          marginLeft: 200,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <Modal.Header title={panelTitles[activeItem]} subtitle={panelDescriptions[activeItem]} />
        <Modal.Body>
          <ActivePanel />
        </Modal.Body>
      </div>
    </Modal>
  );
}
