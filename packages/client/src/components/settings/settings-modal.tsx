import { useState, useEffect, type CSSProperties, type ReactNode, type ReactElement } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import {
  User,
  Palette,
  Info,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useUIStore } from '../../stores/ui-store';

// Re-export panels under both old and new names for backward compatibility
export { GeneralPanel, GeneralPanel as MailGeneralPanel } from './general-panel';
export { AppearancePanel, AppearancePanel as MailAppearancePanel } from './appearance-panel';
export { AboutPanel, AboutPanel as MailAboutPanel } from './about-panel';

// Import panels for the internal PANELS map
import { GeneralPanel } from './general-panel';
import { AppearancePanel } from './appearance-panel';
import { AboutPanel } from './about-panel';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type NavItemId =
  | 'general'
  | 'appearance'
  | 'about';

interface SidebarNavItem {
  id: NavItemId;
  label: string;
  icon: typeof User;
}

interface SidebarSection {
  title: string;
  items: SidebarNavItem[];
}

// ---------------------------------------------------------------------------
// Sidebar navigation config
// ---------------------------------------------------------------------------

function useSidebarSections(): SidebarSection[] {
  const { t } = useTranslation();
  return [
    {
      title: t('settings.account'),
      items: [
        { id: 'general', label: t('settings.general'), icon: User },
      ],
    },
    {
      title: t('settings.preferences'),
      items: [
        { id: 'appearance', label: t('settings.appearance'), icon: Palette },
      ],
    },
    {
      title: t('settings.advanced'),
      items: [
        { id: 'about', label: t('settings.about'), icon: Info },
      ],
    },
  ];
}

// ---------------------------------------------------------------------------
// Panel map
// ---------------------------------------------------------------------------

const PANELS: Record<NavItemId, () => ReactElement> = {
  general: GeneralPanel,
  appearance: AppearancePanel,
  about: AboutPanel,
};

function usePanelTitles(): Record<NavItemId, string> {
  const { t } = useTranslation();
  return {
    general: t('settings.general'),
    appearance: t('settings.appearance'),
    about: t('settings.about'),
  };
}

function usePanelDescriptions(): Record<NavItemId, string> {
  return {
    general: 'Manage your profile and account',
    appearance: 'Customize how Atlas looks',
    about: 'Application information and resources',
  };
}

// ---------------------------------------------------------------------------
// Main modal
// ---------------------------------------------------------------------------

export function SettingsModal() {
  const { t } = useTranslation();
  const { settingsOpen, closeSettings } = useUIStore();
  const [activeItem, setActiveItem] = useState<NavItemId>('general');
  const sidebarSections = useSidebarSections();
  const panelTitles = usePanelTitles();
  const panelDescriptions = usePanelDescriptions();

  // Listen for cross-panel navigation (e.g. About → Shortcuts)
  useEffect(() => {
    const handler = (e: Event) => {
      const panel = (e as CustomEvent).detail?.panel as NavItemId | undefined;
      if (panel && PANELS[panel]) setActiveItem(panel);
    };
    document.addEventListener('atlasmail:settings_navigate', handler);
    return () => document.removeEventListener('atlasmail:settings_navigate', handler);
  }, []);

  const ActivePanel = PANELS[activeItem];

  return (
    <Dialog.Root open={settingsOpen} onOpenChange={(open) => !open && closeSettings()}>
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
            width: 920,
            maxWidth: 'calc(100vw - 48px)',
            height: 680,
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
            <Dialog.Title>{t('settings.title')}</Dialog.Title>
          </VisuallyHidden.Root>

          {/* Left sidebar */}
          <div
            style={{
              width: 240,
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
                {t('settings.title')}
              </span>
            </div>

            {sidebarSections.map((section, si) => (
              <div
                key={section.title}
                style={{ marginBottom: si < sidebarSections.length - 1 ? 'var(--spacing-md)' : 0 }}
              >
                {si > 0 && (
                  <div
                    aria-hidden="true"
                    style={{
                      height: '1px',
                      background: 'var(--color-border-secondary)',
                      margin: 'var(--spacing-xs) var(--spacing-md)',
                      marginBottom: 'var(--spacing-sm)',
                    }}
                  />
                )}
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

                {section.items.map(({ id, label, icon: Icon }) => {
                  const isActive = activeItem === id;
                  return (
                    <SidebarNavButton
                      key={id}
                      isActive={isActive}
                      onClick={() => setActiveItem(id)}
                      label={label}
                      icon={<Icon size={16} />}
                    />
                  );
                })}
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

// ---------------------------------------------------------------------------
// Sidebar nav button (extracted to keep hover state isolated)
// ---------------------------------------------------------------------------

export function SidebarNavButton({
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
