import { useState, type CSSProperties, type ReactElement } from 'react';
import { Type, Rocket } from 'lucide-react';
import { useDocSettingsStore, type DocFontStyle, type DocSidebarDefault } from '../../stores/docs-settings-store';
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

type DocNavItemId = 'editor' | 'startup';

interface DocSidebarNavItem {
  id: DocNavItemId;
  label: string;
  icon: typeof Type;
}

interface DocSidebarSection {
  title: string;
  items: DocSidebarNavItem[];
}

// ---------------------------------------------------------------------------
// Nav config
// ---------------------------------------------------------------------------

const SIDEBAR_SECTIONS: DocSidebarSection[] = [
  {
    title: 'Documents',
    items: [
      { id: 'editor', label: 'Editor', icon: Type },
      { id: 'startup', label: 'Startup', icon: Rocket },
    ],
  },
];

const PANEL_TITLES: Record<DocNavItemId, string> = {
  editor: 'Editor',
  startup: 'Startup',
};

const PANEL_DESCRIPTIONS: Record<DocNavItemId, string> = {
  editor: 'Customize the writing experience',
  startup: 'Configure default behavior when opening documents',
};

// ---------------------------------------------------------------------------
// Font style constants
// ---------------------------------------------------------------------------

const FONT_STYLES: { id: DocFontStyle; label: string; fontFamily: string; preview: string }[] = [
  {
    id: 'default',
    label: 'Default',
    fontFamily: 'var(--font-family)',
    preview: 'Aa',
  },
  {
    id: 'serif',
    label: 'Serif',
    fontFamily: "Georgia, 'Times New Roman', serif",
    preview: 'Aa',
  },
  {
    id: 'mono',
    label: 'Mono',
    fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
    preview: 'Aa',
  },
];

// ---------------------------------------------------------------------------
// Panel: Editor
// ---------------------------------------------------------------------------

export function DocsEditorPanel() {
  const {
    fontStyle, setFontStyle,
    smallText, setSmallText,
    fullWidth, setFullWidth,
    spellCheck, setSpellCheck,
  } = useDocSettingsStore();

  return (
    <div>
      <SettingsSection title="Font style" description="Choose the typeface used in the document body.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--spacing-sm)' }}>
          {FONT_STYLES.map((fs) => (
            <SelectableCard
              key={fs.id}
              selected={fontStyle === fs.id}
              onClick={() => setFontStyle(fs.id)}
              style={{ padding: 'var(--spacing-md) var(--spacing-lg)' }}
            >
              <span
                style={{
                  fontSize: 28,
                  fontFamily: fs.fontFamily,
                  color: 'var(--color-text-primary)',
                  lineHeight: 1.2,
                  fontWeight: 400,
                }}
              >
                {fs.preview}
              </span>
              <span
                style={{
                  fontSize: 'var(--font-size-sm)',
                  color: fontStyle === fs.id ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
                  fontWeight: fontStyle === fs.id
                    ? ('var(--font-weight-medium)' as CSSProperties['fontWeight'])
                    : ('var(--font-weight-normal)' as CSSProperties['fontWeight']),
                }}
              >
                {fs.label}
              </span>
            </SelectableCard>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection title="Layout">
        <SettingsRow label="Small text" description="Use a smaller font size for body text.">
          <SettingsToggle checked={smallText} onChange={setSmallText} label="Small text" />
        </SettingsRow>
        <SettingsRow label="Full width" description="Stretch pages to fill the available width.">
          <SettingsToggle checked={fullWidth} onChange={setFullWidth} label="Full width" />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Input">
        <SettingsRow label="Spell check" description="Highlight misspelled words in the editor.">
          <SettingsToggle checked={spellCheck} onChange={setSpellCheck} label="Spell check" />
        </SettingsRow>
      </SettingsSection>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel: Startup
// ---------------------------------------------------------------------------

const SIDEBAR_DEFAULT_OPTIONS: Array<{ value: DocSidebarDefault; label: string }> = [
  { value: 'tree', label: 'Pages' },
  { value: 'favorites', label: 'Favorites' },
  { value: 'recent', label: 'Recent' },
];

export function DocsStartupPanel() {
  const {
    openLastVisited, setOpenLastVisited,
    sidebarDefault, setSidebarDefault,
  } = useDocSettingsStore();

  return (
    <div>
      <SettingsSection title="On open" description="What happens when you navigate to the documents section.">
        <SettingsRow label="Open last visited page" description="Automatically open the most recently viewed page.">
          <SettingsToggle checked={openLastVisited} onChange={setOpenLastVisited} label="Open last visited page" />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Sidebar">
        <SettingsRow label="Default section" description="Which view the sidebar shows when you first open documents.">
          <SettingsSelect
            value={sidebarDefault}
            options={SIDEBAR_DEFAULT_OPTIONS}
            onChange={setSidebarDefault}
          />
        </SettingsRow>
      </SettingsSection>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel map
// ---------------------------------------------------------------------------

const PANELS: Record<DocNavItemId, () => ReactElement> = {
  editor: DocsEditorPanel,
  startup: DocsStartupPanel,
};

// ---------------------------------------------------------------------------
// Main modal
// ---------------------------------------------------------------------------

interface DocSettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function DocSettingsModal({ open, onClose }: DocSettingsModalProps) {
  const [activeItem, setActiveItem] = useState<DocNavItemId>('editor');
  const ActivePanel = PANELS[activeItem];

  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      width={660}
      height={520}
      title="Document settings"
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
            Settings
          </span>
        </div>

        {SIDEBAR_SECTIONS.map((section) => (
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
        <Modal.Header title={PANEL_TITLES[activeItem]} subtitle={PANEL_DESCRIPTIONS[activeItem]} />
        <Modal.Body>
          <ActivePanel />
        </Modal.Body>
      </div>
    </Modal>
  );
}
