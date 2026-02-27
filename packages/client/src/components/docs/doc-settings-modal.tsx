import { useState, type CSSProperties, type ReactNode, type ReactElement } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import { X, Type, Rocket } from 'lucide-react';
import { useDocSettingsStore, type DocFontStyle, type DocSidebarDefault } from '../../stores/docs-settings-store';
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

interface DocSettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function DocSettingsModal({ open, onClose }: DocSettingsModalProps) {
  const [activeItem, setActiveItem] = useState<DocNavItemId>('editor');
  const ActivePanel = PANELS[activeItem];

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
            <Dialog.Title>Document settings</Dialog.Title>
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
                  {PANEL_TITLES[activeItem]}
                </h2>
                <p
                  style={{
                    margin: '4px 0 0',
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--color-text-tertiary)',
                    fontFamily: 'var(--font-family)',
                  }}
                >
                  {PANEL_DESCRIPTIONS[activeItem]}
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
