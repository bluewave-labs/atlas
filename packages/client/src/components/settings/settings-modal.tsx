import { useState, useEffect, useCallback, useRef, type CSSProperties, type ReactNode, type ReactElement } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import DOMPurify from 'dompurify';
import * as Dialog from '@radix-ui/react-dialog';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import {
  User,
  Mail,
  Palette,
  Bell,
  PenLine,
  Inbox,
  PanelRight,
  Tag,
  Keyboard,
  Info,
  Sun,
  Moon,
  Monitor,
  X,
  Plus,
  Trash2,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  LogOut,
  Save,
  Camera,
  AlertCircle,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Link as LinkIcon,
  List,
  ListOrdered,
  Undo2,
  Redo2,
  Sparkles,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useUIStore } from '../../stores/ui-store';
import { useSettingsStore, type FontFamilyId, type AIProvider } from '../../stores/settings-store';
import { useAuthStore } from '../../stores/auth-store';
import { Avatar } from '../ui/avatar';
import { AddAccountModal } from './add-account-modal';
import { ConfirmDialog } from '../ui/confirm-dialog';
import {
  SettingsSection,
  SettingsRow,
  SettingsToggle,
  SelectableCard,
  RadioOption,
  SettingsSelect,
} from './settings-primitives';
import { DEFAULT_SHORTCUTS, type ShortcutCategory } from '@atlasmail/shared';
import { SUPPORTED_LANGUAGES } from '../../i18n';
import { COLOR_THEMES } from '../../lib/color-themes';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type NavItemId =
  | 'general'
  | 'accounts'
  | 'appearance'
  | 'notifications'
  | 'composer'
  | 'ai'
  | 'inbox'
  | 'reading-pane'
  | 'labels'
  | 'shortcuts'
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
        { id: 'accounts', label: t('settings.accounts'), icon: Mail },
      ],
    },
    {
      title: t('settings.preferences'),
      items: [
        { id: 'appearance', label: t('settings.appearance'), icon: Palette },
        { id: 'notifications', label: t('settings.notifications'), icon: Bell },
        { id: 'composer', label: t('settings.composer'), icon: PenLine },
        { id: 'ai', label: t('settings.ai'), icon: Sparkles },
      ],
    },
    {
      title: t('settings.emailSection'),
      items: [
        { id: 'inbox', label: t('settings.inboxSection'), icon: Inbox },
        { id: 'reading-pane', label: t('settings.readingPane'), icon: PanelRight },
        { id: 'labels', label: t('settings.labels'), icon: Tag },
      ],
    },
    {
      title: t('settings.advanced'),
      items: [
        { id: 'shortcuts', label: t('settings.keyboardShortcuts'), icon: Keyboard },
        { id: 'about', label: t('settings.about'), icon: Info },
      ],
    },
  ];
}

// ---------------------------------------------------------------------------
// Primitive UI components (shared — imported from settings-primitives.tsx)
// Local-only components below.
// ---------------------------------------------------------------------------

function SingleKeyBadge({ label }: { label: string }) {
  return (
    <kbd
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 24,
        height: 22,
        padding: '0 6px',
        background: 'var(--color-bg-tertiary)',
        border: '1px solid var(--color-border-primary)',
        borderRadius: 'var(--radius-sm)',
        fontSize: 'var(--font-size-xs)',
        fontFamily: 'var(--font-mono)',
        color: 'var(--color-text-secondary)',
        boxShadow: '0 1px 0 var(--color-border-primary)',
        lineHeight: 1,
      }}
    >
      {label === 'mod' ? '⌘' : label === 'shift' ? '⇧' : label === 'Enter' ? '↵' : label}
    </kbd>
  );
}

function KeyBadge({ children }: { children: string }) {
  // Handle sequences like "g i" (space-separated steps)
  const steps = children.split(' ');
  if (steps.length > 1) {
    return (
      <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
        {steps.map((step, si) => (
          <span key={si} style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
            {si > 0 && (
              <span style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-xs)' }}>then</span>
            )}
            {step.split('+').map((k, ki) => (
              <SingleKeyBadge key={ki} label={k} />
            ))}
          </span>
        ))}
      </span>
    );
  }

  // Single combo like "mod+Enter" or "e"
  const keys = children.split('+');
  return (
    <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
      {keys.map((k, i) => (
        <SingleKeyBadge key={i} label={k} />
      ))}
    </span>
  );
}

// Inline save button for settings that need explicit save
function SaveButton({ onClick, saved }: { onClick: () => void; saved: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--spacing-xs)',
        height: 32,
        padding: '0 var(--spacing-md)',
        background: saved ? 'var(--color-success)' : 'var(--color-accent-primary)',
        border: 'none',
        borderRadius: 'var(--radius-md)',
        color: '#ffffff',
        fontSize: 'var(--font-size-sm)',
        fontFamily: 'var(--font-family)',
        fontWeight: 'var(--font-weight-medium)' as CSSProperties['fontWeight'],
        cursor: 'pointer',
        transition: 'background var(--transition-normal)',
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        if (!saved) e.currentTarget.style.opacity = '0.9';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.opacity = '1';
      }}
    >
      {saved ? <CheckCircle2 size={13} /> : <Save size={13} />}
      {saved ? 'Saved' : 'Save'}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Visual preview illustrations
// ---------------------------------------------------------------------------

function DensityPreview({ density }: { density: 'compact' | 'default' | 'comfortable' }) {
  const gaps: Record<typeof density, number> = { compact: 3, default: 6, comfortable: 10 };
  const gap = gaps[density];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap,
        width: 56,
        padding: '8px 6px',
      }}
    >
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            height: 4,
            borderRadius: 2,
            background: i === 1 ? 'var(--color-accent-primary)' : 'var(--color-border-primary)',
            opacity: i === 1 ? 1 : i === 2 ? 0.6 : 0.35,
          }}
        />
      ))}
    </div>
  );
}

function ReadingPanePreview({ position }: { position: 'right' | 'bottom' | 'hidden' }) {
  const baseStyle: CSSProperties = {
    width: 60,
    height: 40,
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--color-border-primary)',
    overflow: 'hidden',
    display: 'flex',
  };

  if (position === 'right') {
    return (
      <div style={baseStyle}>
        <div
          style={{
            flex: 1,
            background: 'var(--color-bg-tertiary)',
            borderRight: '1px solid var(--color-border-primary)',
          }}
        />
        <div style={{ flex: 1.5, background: 'var(--color-bg-secondary)' }} />
      </div>
    );
  }

  if (position === 'bottom') {
    return (
      <div style={{ ...baseStyle, flexDirection: 'column' }}>
        <div
          style={{
            flex: 1,
            background: 'var(--color-bg-tertiary)',
            borderBottom: '1px solid var(--color-border-primary)',
          }}
        />
        <div style={{ flex: 1.5, background: 'var(--color-bg-secondary)' }} />
      </div>
    );
  }

  return (
    <div style={baseStyle}>
      <div style={{ flex: 1, background: 'var(--color-bg-tertiary)' }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel: General
// ---------------------------------------------------------------------------

export function MailGeneralPanel() {
  const account = useAuthStore((s) => s.account);
  const updateAccount = useAuthStore((s) => s.updateAccount);
  const [displayName, setDisplayName] = useState(account?.name ?? '');
  const [saved, setSaved] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarHovered, setAvatarHovered] = useState(false);

  // Reset saved state when display name changes
  useEffect(() => {
    setSaved(false);
  }, [displayName]);

  const handleSaveName = useCallback(() => {
    if (!account) return;
    updateAccount({ ...account, name: displayName.trim() });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [account, displayName, updateAccount]);

  const handleAvatarUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !account) return;

    // Validate file type and size (max 2MB)
    if (!file.type.startsWith('image/')) return;
    if (file.size > 2 * 1024 * 1024) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      updateAccount({ ...account, pictureUrl: dataUrl });
    };
    reader.readAsDataURL(file);
    // Reset input so the same file can be re-selected
    e.target.value = '';
  }, [account, updateAccount]);

  const handleRemoveAvatar = useCallback(() => {
    if (!account) return;
    updateAccount({ ...account, pictureUrl: null });
  }, [account, updateAccount]);

  return (
    <div>
      <SettingsSection title="Profile">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-xl)',
            padding: 'var(--spacing-xl)',
            background: 'var(--color-bg-tertiary)',
            borderRadius: 'var(--radius-lg)',
            marginBottom: 'var(--spacing-lg)',
            border: '1px solid var(--color-border-secondary)',
          }}
        >
          {/* Avatar with upload overlay */}
          <div
            style={{ position: 'relative', flexShrink: 0, cursor: 'pointer' }}
            onMouseEnter={() => setAvatarHovered(true)}
            onMouseLeave={() => setAvatarHovered(false)}
            onClick={() => fileInputRef.current?.click()}
          >
            <Avatar
              src={account?.pictureUrl}
              name={account?.name}
              email={account?.email ?? ''}
              size={56}
            />
            {/* Camera overlay on hover */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                background: 'rgba(0, 0, 0, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: avatarHovered ? 1 : 0,
                transition: 'opacity var(--transition-normal)',
              }}
            >
              <Camera size={18} color="#ffffff" />
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              style={{ display: 'none' }}
            />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 'var(--font-size-lg)',
                fontWeight: 'var(--font-weight-semibold)' as CSSProperties['fontWeight'],
                color: 'var(--color-text-primary)',
                fontFamily: 'var(--font-family)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {account?.name || 'No name set'}
            </div>
            <div
              style={{
                marginTop: 4,
                fontSize: 'var(--font-size-md)',
                color: 'var(--color-text-tertiary)',
                fontFamily: 'var(--font-family)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {account?.email}
            </div>
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginTop: 'var(--spacing-sm)' }}>
              <button
                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                style={{
                  padding: '2px 8px',
                  background: 'transparent',
                  border: '1px solid var(--color-border-primary)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--color-text-secondary)',
                  fontSize: 'var(--font-size-xs)',
                  fontFamily: 'var(--font-family)',
                  cursor: 'pointer',
                  transition: 'background var(--transition-normal), color var(--transition-normal)',
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
                Upload photo
              </button>
              {account?.pictureUrl && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleRemoveAvatar(); }}
                  style={{
                    padding: '2px 8px',
                    background: 'transparent',
                    border: '1px solid var(--color-border-primary)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--color-text-tertiary)',
                    fontSize: 'var(--font-size-xs)',
                    fontFamily: 'var(--font-family)',
                    cursor: 'pointer',
                    transition: 'background var(--transition-normal), color var(--transition-normal)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'color-mix(in srgb, var(--color-error) 8%, transparent)';
                    e.currentTarget.style.color = 'var(--color-error)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--color-text-tertiary)';
                  }}
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>

        <SettingsRow label="Display name" description="How your name appears when you send emails">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
              style={{
                width: 220,
                height: 34,
                padding: '0 var(--spacing-md)',
                background: 'var(--color-bg-tertiary)',
                border: '1px solid var(--color-border-primary)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-text-primary)',
                fontSize: 'var(--font-size-md)',
                fontFamily: 'var(--font-family)',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color var(--transition-normal)',
              }}
              onFocus={(e) => (e.target.style.borderColor = 'var(--color-border-focus)')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--color-border-primary)')}
            />
            <SaveButton onClick={handleSaveName} saved={saved} />
          </div>
        </SettingsRow>

        <SettingsRow label="Email address" description="Your Google account email">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              height: 34,
              padding: '0 var(--spacing-md)',
              background: 'var(--color-bg-secondary)',
              border: '1px solid var(--color-border-secondary)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-text-tertiary)',
              fontSize: 'var(--font-size-md)',
              fontFamily: 'var(--font-family)',
              userSelect: 'none',
              minWidth: 220,
            }}
          >
            {account?.email || '—'}
          </div>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Account">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'var(--spacing-md) var(--spacing-lg)',
            background: 'var(--color-surface-primary)',
            border: '1px solid var(--color-border-primary)',
            borderRadius: 'var(--radius-lg)',
          }}
        >
          <div>
            <div
              style={{
                fontSize: 'var(--font-size-md)',
                fontWeight: 'var(--font-weight-medium)' as CSSProperties['fontWeight'],
                color: 'var(--color-text-primary)',
                fontFamily: 'var(--font-family)',
              }}
            >
              Sign out
            </div>
            <div
              style={{
                marginTop: 2,
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-tertiary)',
                fontFamily: 'var(--font-family)',
              }}
            >
              Sign out of your current account
            </div>
          </div>
          <button
            onClick={() => setShowLogoutConfirm(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-xs)',
              height: 34,
              padding: '0 var(--spacing-md)',
              background: 'transparent',
              border: '1px solid var(--color-border-primary)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-text-secondary)',
              fontSize: 'var(--font-size-sm)',
              fontFamily: 'var(--font-family)',
              fontWeight: 'var(--font-weight-medium)' as CSSProperties['fontWeight'],
              cursor: 'pointer',
              transition: 'background var(--transition-normal), color var(--transition-normal)',
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
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </SettingsSection>

      <ConfirmDialog
        open={showLogoutConfirm}
        onOpenChange={setShowLogoutConfirm}
        title="Sign out?"
        description="You will be signed out of your current account. You can sign back in at any time."
        confirmLabel="Sign out"
        onConfirm={() => useAuthStore.getState().logout()}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel: Accounts
// ---------------------------------------------------------------------------

export function MailAccountsPanel() {
  const { t } = useTranslation();
  const account = useAuthStore((s) => s.account);
  const accounts = useAuthStore((s) => s.accounts);
  const switchAccount = useAuthStore((s) => s.switchAccount);
  const removeAccount = useAuthStore((s) => s.removeAccount);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [showAddAccount, setShowAddAccount] = useState(false);

  const displayAccounts = accounts.length > 0 ? accounts : account ? [account] : [];

  return (
    <div>
      <SettingsSection title="Connected accounts" description="Manage your connected email accounts">
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--spacing-sm)',
            marginBottom: 'var(--spacing-lg)',
          }}
        >
          {displayAccounts.length > 0 ? (
            displayAccounts.map((acc) => {
              const isActive = acc.id === account?.id;
              return (
                <div
                  key={acc.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--spacing-md)',
                    padding: 'var(--spacing-md) var(--spacing-lg)',
                    background: isActive
                      ? 'color-mix(in srgb, var(--color-accent-primary) 6%, var(--color-bg-tertiary))'
                      : 'var(--color-bg-tertiary)',
                    borderRadius: 'var(--radius-lg)',
                    border: isActive
                      ? '1px solid color-mix(in srgb, var(--color-accent-primary) 30%, transparent)'
                      : '1px solid var(--color-border-secondary)',
                    transition: 'background var(--transition-normal)',
                  }}
                >
                  <Avatar
                    src={acc.pictureUrl}
                    name={acc.name}
                    email={acc.email}
                    size={40}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 'var(--font-size-md)',
                        fontWeight: 'var(--font-weight-medium)' as CSSProperties['fontWeight'],
                        color: 'var(--color-text-primary)',
                        fontFamily: 'var(--font-family)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {acc.name || acc.email}
                    </div>
                    <div
                      style={{
                        marginTop: 2,
                        fontSize: 'var(--font-size-sm)',
                        color: 'var(--color-text-tertiary)',
                        fontFamily: 'var(--font-family)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {acc.email}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', flexShrink: 0 }}>
                    {isActive ? (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: 'var(--font-size-xs)',
                          color: 'var(--color-success)',
                          fontFamily: 'var(--font-family)',
                          fontWeight: 'var(--font-weight-medium)' as CSSProperties['fontWeight'],
                          background: 'color-mix(in srgb, var(--color-success) 10%, transparent)',
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-lg)',
                        }}
                      >
                        <CheckCircle2 size={12} />
                        Active
                      </span>
                    ) : (
                      <button
                        onClick={() => switchAccount(acc.id)}
                        style={{
                          height: 28,
                          padding: '0 var(--spacing-sm)',
                          background: 'var(--color-bg-elevated)',
                          border: '1px solid var(--color-border-primary)',
                          borderRadius: 'var(--radius-md)',
                          color: 'var(--color-text-secondary)',
                          fontSize: 'var(--font-size-xs)',
                          fontFamily: 'var(--font-family)',
                          cursor: 'pointer',
                          transition: 'background var(--transition-normal), color var(--transition-normal)',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'var(--color-accent-primary)';
                          e.currentTarget.style.color = '#ffffff';
                          e.currentTarget.style.borderColor = 'var(--color-accent-primary)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'var(--color-bg-elevated)';
                          e.currentTarget.style.color = 'var(--color-text-secondary)';
                          e.currentTarget.style.borderColor = 'var(--color-border-primary)';
                        }}
                      >
                        Switch
                      </button>
                    )}

                    {displayAccounts.length > 1 && (
                      <button
                        onClick={() => setConfirmRemoveId(acc.id)}
                        aria-label={`Remove ${acc.email}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 28,
                          height: 28,
                          border: 'none',
                          borderRadius: 'var(--radius-md)',
                          background: 'transparent',
                          color: 'var(--color-text-tertiary)',
                          cursor: 'pointer',
                          transition: 'background var(--transition-normal), color var(--transition-normal)',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'color-mix(in srgb, var(--color-error) 10%, transparent)';
                          e.currentTarget.style.color = 'var(--color-error)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = 'var(--color-text-tertiary)';
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div
              style={{
                padding: 'var(--spacing-2xl)',
                textAlign: 'center',
                color: 'var(--color-text-tertiary)',
                fontSize: 'var(--font-size-md)',
                fontFamily: 'var(--font-family)',
                background: 'var(--color-bg-tertiary)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--color-border-secondary)',
              }}
            >
              No accounts connected
            </div>
          )}
        </div>

        <button
          onClick={() => setShowAddAccount(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-sm)',
            padding: 'var(--spacing-md) var(--spacing-lg)',
            background: 'transparent',
            border: '1px dashed var(--color-border-primary)',
            borderRadius: 'var(--radius-lg)',
            color: 'var(--color-text-secondary)',
            fontSize: 'var(--font-size-md)',
            fontFamily: 'var(--font-family)',
            cursor: 'pointer',
            width: '100%',
            transition: 'background var(--transition-normal), border-color var(--transition-normal)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--color-surface-hover)';
            e.currentTarget.style.borderColor = 'var(--color-accent-primary)';
            e.currentTarget.style.color = 'var(--color-accent-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.borderColor = 'var(--color-border-primary)';
            e.currentTarget.style.color = 'var(--color-text-secondary)';
          }}
        >
          <Plus size={16} />
          {t('settings.addAccount')}
        </button>
      </SettingsSection>

      <AddAccountModal open={showAddAccount} onOpenChange={setShowAddAccount} />

      <ConfirmDialog
        open={!!confirmRemoveId}
        onOpenChange={(open) => { if (!open) setConfirmRemoveId(null); }}
        title={t('settings.removeAccount')}
        description={t('settings.removeAccountDescription')}
        confirmLabel={t('common.remove')}
        onConfirm={() => { if (confirmRemoveId) removeAccount(confirmRemoveId); }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel: Appearance
// ---------------------------------------------------------------------------

export function MailAppearancePanel() {
  const { t } = useTranslation();
  const {
    theme,
    density,
    fontFamily,
    language,
    colorTheme,
    sendAnimation,
    themeTransition,
    setTheme,
    setDensity,
    setFontFamily,
    setLanguage,
    setColorTheme,
    setSendAnimation,
    setThemeTransition,
    trackingEnabled,
    setTrackingEnabled,
  } = useSettingsStore();

  const themeOptions: Array<{ value: typeof theme; label: string; icon: typeof Sun; desc: string }> = [
    { value: 'light', label: t('settings.light'), icon: Sun, desc: t('settings.lightDesc') },
    { value: 'dark', label: t('settings.dark'), icon: Moon, desc: t('settings.darkDesc') },
    { value: 'system', label: t('settings.system'), icon: Monitor, desc: t('settings.systemDesc') },
  ];

  const densityOptions: Array<{ value: typeof density; label: string; desc: string }> = [
    { value: 'compact', label: t('settings.compact'), desc: t('settings.compactDesc') },
    { value: 'default', label: t('settings.default'), desc: t('settings.defaultDesc') },
    { value: 'comfortable', label: t('settings.comfortable'), desc: t('settings.comfortableDesc') },
  ];

  const fontOptions: Array<{ value: FontFamilyId; label: string; css: string }> = [
    { value: 'inter', label: 'Inter', css: "'Inter', sans-serif" },
    { value: 'geist', label: 'Geist', css: "'Geist', sans-serif" },
    { value: 'roboto', label: 'Roboto', css: "'Roboto', sans-serif" },
    { value: 'open-sans', label: 'Open Sans', css: "'Open Sans', sans-serif" },
    { value: 'lato', label: 'Lato', css: "'Lato', sans-serif" },
    { value: 'system', label: 'System default', css: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
  ];

  const languageOptions = SUPPORTED_LANGUAGES.map((lang) => ({
    value: lang.code,
    label: lang.label,
  }));

  return (
    <div>
      <SettingsSection title={t('settings.theme')} description={t('settings.themeDescription')}>
        <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
          {themeOptions.map(({ value, label, icon: Icon, desc }) => (
            <SelectableCard
              key={value}
              selected={theme === value}
              onClick={() => setTheme(value)}
              style={{ flex: 1, minHeight: 100 }}
            >
              <Icon
                size={24}
                style={{
                  color: theme === value ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
                  transition: 'color var(--transition-normal)',
                }}
              />
              <span
                style={{
                  fontSize: 'var(--font-size-md)',
                  fontWeight: 'var(--font-weight-medium)' as CSSProperties['fontWeight'],
                  color: theme === value ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
                }}
              >
                {label}
              </span>
              <span
                style={{
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-text-tertiary)',
                }}
              >
                {desc}
              </span>
            </SelectableCard>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection title={t('settings.colorTheme')} description={t('settings.colorThemeDescription')}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 'var(--spacing-sm)',
        }}>
          {COLOR_THEMES.map((ct) => {
            const isActive = colorTheme === ct.id;
            return (
              <button
                key={ct.id}
                onClick={() => setColorTheme(ct.id)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                  padding: 'var(--spacing-sm) var(--spacing-xs)',
                  background: isActive
                    ? `color-mix(in srgb, ${ct.swatch} 10%, transparent)`
                    : 'transparent',
                  border: isActive
                    ? `1.5px solid ${ct.swatch}`
                    : '1px solid var(--color-border-secondary)',
                  borderRadius: 'var(--radius-lg)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-family)',
                  transition: 'border-color var(--transition-normal), background var(--transition-normal)',
                  outline: 'none',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.borderColor = 'var(--color-border-primary)';
                    e.currentTarget.style.background = 'var(--color-surface-hover)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <div style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: ct.swatch,
                  boxShadow: isActive
                    ? `0 0 0 2px var(--color-bg-primary), 0 0 0 4px ${ct.swatch}`
                    : 'none',
                  transition: 'box-shadow var(--transition-normal)',
                }} />
                <span style={{
                  fontSize: 'var(--font-size-xs)',
                  color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                  fontWeight: isActive ? 500 : 400,
                }}>
                  {ct.name}
                </span>
              </button>
            );
          })}
        </div>
      </SettingsSection>

      <SettingsSection title={t('settings.language')} description={t('settings.languageDescription')}>
        <SettingsSelect
          value={language}
          options={languageOptions}
          onChange={(v) => setLanguage(v as string)}
        />
      </SettingsSection>

      <SettingsSection title={t('settings.density')} description={t('settings.densityDescription')}>
        <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
          {densityOptions.map(({ value, label, desc }) => (
            <SelectableCard
              key={value}
              selected={density === value}
              onClick={() => setDensity(value)}
              style={{ flex: 1, minHeight: 100, gap: 'var(--spacing-xs)' }}
            >
              <DensityPreview density={value} />
              <span
                style={{
                  fontSize: 'var(--font-size-md)',
                  fontWeight: 'var(--font-weight-medium)' as CSSProperties['fontWeight'],
                  color: density === value ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
                }}
              >
                {label}
              </span>
              <span
                style={{
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-text-tertiary)',
                }}
              >
                {desc}
              </span>
            </SelectableCard>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection title={t('settings.font')} description={t('settings.fontDescription')}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 'var(--spacing-sm)',
        }}>
          {fontOptions.map((font) => {
            const isActive = fontFamily === font.value;
            return (
              <button
                key={font.value}
                onClick={() => setFontFamily(font.value)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                  padding: 'var(--spacing-md) var(--spacing-sm)',
                  background: isActive
                    ? 'var(--color-accent-subtle)'
                    : 'transparent',
                  border: isActive
                    ? '1.5px solid var(--color-accent-primary)'
                    : '1px solid var(--color-border-secondary)',
                  borderRadius: 'var(--radius-lg)',
                  cursor: 'pointer',
                  fontFamily: font.css,
                  transition: 'border-color var(--transition-normal), background var(--transition-normal)',
                  outline: 'none',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.borderColor = 'var(--color-border-primary)';
                    e.currentTarget.style.background = 'var(--color-surface-hover)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <span style={{
                  fontSize: 'var(--font-size-lg)',
                  fontWeight: 500,
                  color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                }}>
                  Aa
                </span>
                <span style={{
                  fontSize: 'var(--font-size-xs)',
                  color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                  fontWeight: isActive ? 500 : 400,
                }}>
                  {font.label}
                </span>
              </button>
            );
          })}
        </div>
      </SettingsSection>

      <SettingsSection title={t('settings.animations')} description={t('settings.animationsDescription')}>
        <SettingsRow
          label={t('settings.sendAnimation')}
          description={t('settings.sendAnimationDesc')}
        >
          <SettingsToggle
            checked={sendAnimation}
            onChange={setSendAnimation}
            label={t('settings.sendAnimation')}
          />
        </SettingsRow>

        <SettingsRow
          label={t('settings.themeTransition')}
          description={t('settings.themeTransitionDesc')}
        >
          <SettingsToggle
            checked={themeTransition}
            onChange={setThemeTransition}
            label={t('settings.themeTransition')}
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title={t('settings.emailTracking')} description={t('settings.emailTrackingDescription')}>
        <SettingsRow
          label={t('settings.readReceipts')}
          description={t('settings.readReceiptsDesc')}
        >
          <SettingsToggle
            checked={trackingEnabled}
            onChange={setTrackingEnabled}
            label={t('settings.readReceipts')}
          />
        </SettingsRow>
      </SettingsSection>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel: Notifications
// ---------------------------------------------------------------------------

export function MailNotificationsPanel() {
  const { t } = useTranslation();
  const {
    desktopNotifications,
    soundNotifications,
    showBadgeCount,
    notificationLevel,
    setDesktopNotifications,
    setSoundNotifications,
    setShowBadgeCount,
    setNotificationLevel,
  } = useSettingsStore();

  const [permissionState, setPermissionState] = useState<NotificationPermission | 'unsupported'>(
    () => ('Notification' in window ? Notification.permission : 'unsupported'),
  );

  const handleDesktopToggle = useCallback(async (value: boolean) => {
    if (value && 'Notification' in window && Notification.permission === 'default') {
      const result = await Notification.requestPermission();
      setPermissionState(result);
      if (result !== 'granted') return;
    }
    setDesktopNotifications(value);
  }, [setDesktopNotifications]);

  const isDenied = permissionState === 'denied';
  const isUnsupported = permissionState === 'unsupported';

  const levels: Array<{
    value: typeof notificationLevel;
    label: string;
    description: string;
  }> = [
    { value: 'all', label: t('settings.allEmails'), description: t('settings.allEmailsDesc') },
    { value: 'smart', label: t('settings.smartFiltering'), description: t('settings.smartFilteringDesc') },
    { value: 'priority', label: t('settings.priorityOnly'), description: t('settings.priorityOnlyDesc') },
    { value: 'none', label: t('settings.none'), description: t('settings.noneDesc') },
  ];

  return (
    <div>
      {/* Browser permission warning */}
      {(isDenied || isUnsupported) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 'var(--spacing-sm)',
            padding: 'var(--spacing-md) var(--spacing-lg)',
            marginBottom: 'var(--spacing-xl)',
            background: 'color-mix(in srgb, var(--color-warning) 8%, transparent)',
            border: '1px solid color-mix(in srgb, var(--color-warning) 25%, transparent)',
            borderRadius: 'var(--radius-lg)',
          }}
        >
          <AlertCircle size={16} style={{ color: 'var(--color-warning)', flexShrink: 0, marginTop: 2 }} />
          <div
            style={{
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-family)',
              lineHeight: 'var(--line-height-normal)',
            }}
          >
            {isUnsupported
              ? 'Your browser does not support desktop notifications.'
              : 'Notifications are blocked by your browser. Please allow notifications in your browser settings to enable this feature.'}
          </div>
        </div>
      )}

      <SettingsSection title={t('settings.alertsTitle')} description={t('settings.alertsDescription')}>
        <SettingsRow
          label={t('settings.desktopNotifications')}
          description={isDenied ? t('settings.desktopNotificationsBlocked') : t('settings.desktopNotificationsDesc')}
        >
          <SettingsToggle
            checked={desktopNotifications && !isDenied && !isUnsupported}
            onChange={handleDesktopToggle}
            label={t('settings.desktopNotifications')}
          />
        </SettingsRow>

        <SettingsRow
          label={t('settings.soundNotifications')}
          description={t('settings.soundNotificationsDesc')}
        >
          <SettingsToggle
            checked={soundNotifications}
            onChange={setSoundNotifications}
            label={t('settings.soundNotifications')}
          />
        </SettingsRow>

        <SettingsRow
          label={t('settings.showBadgeCount')}
          description={t('settings.showBadgeCountDesc')}
        >
          <SettingsToggle
            checked={showBadgeCount}
            onChange={setShowBadgeCount}
            label={t('settings.showBadgeCount')}
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection
        title={t('settings.notificationLevel')}
        description={t('settings.notificationLevelDescription')}
      >
        <div
          role="radiogroup"
          aria-label={t('settings.notificationLevel')}
          style={{ display: 'flex', flexDirection: 'column', gap: 2 }}
        >
          {levels.map(({ value, label, description }) => (
            <RadioOption
              key={value}
              selected={notificationLevel === value}
              onClick={() => setNotificationLevel(value)}
              label={label}
              description={description}
            />
          ))}
        </div>
      </SettingsSection>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel: Composer
// ---------------------------------------------------------------------------

function SignatureToolbarButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active?: boolean;
  onClick: () => void;
  icon: typeof Bold;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 28,
        height: 28,
        border: 'none',
        borderRadius: 'var(--radius-sm)',
        background: active ? 'var(--color-surface-active)' : 'transparent',
        color: active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
        cursor: 'pointer',
        transition: 'background var(--transition-normal), color var(--transition-normal)',
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = 'var(--color-surface-hover)';
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = 'transparent';
      }}
    >
      <Icon size={14} />
    </button>
  );
}

function SignatureEditor() {
  const { signatureHtml, includeSignatureInReplies, setSignatureHtml, setSignature, setIncludeSignatureInReplies } =
    useSettingsStore();

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false, codeBlock: false }),
      Placeholder.configure({ placeholder: 'Add your HTML signature...' }),
      Underline,
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' } }),
    ],
    editorProps: {
      attributes: {
        style: [
          'outline: none',
          'color: var(--color-text-primary)',
          'font-size: var(--font-size-md)',
          'line-height: var(--line-height-normal)',
          'font-family: var(--font-family)',
          'min-height: 100px',
          'padding: 0',
        ].join('; '),
      },
    },
    content: signatureHtml || '',
    onUpdate: ({ editor: e }) => {
      setSignatureHtml(e.isEmpty ? '' : e.getHTML());
      setSignature(e.isEmpty ? '' : e.getText());
    },
  });

  // Sync editor content when store value changes externally
  useEffect(() => {
    if (!editor || editor.isFocused) return;
    const current = editor.isEmpty ? '' : editor.getHTML();
    if (current !== signatureHtml) {
      editor.commands.setContent(signatureHtml || '');
    }
  }, [signatureHtml, editor]);

  function handleSetLink() {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('Enter URL:', previousUrl || 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
      {/* TipTap editor with toolbar */}
      <div
        style={{
          border: '1px solid var(--color-border-primary)',
          borderRadius: 'var(--radius-md)',
          background: 'var(--color-bg-tertiary)',
          overflow: 'hidden',
          transition: 'border-color var(--transition-normal)',
        }}
      >
        {/* Formatting toolbar */}
        {editor && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              padding: '4px var(--spacing-sm)',
              borderBottom: '1px solid var(--color-border-secondary)',
              background: 'var(--color-bg-secondary)',
            }}
          >
            <SignatureToolbarButton
              icon={Bold}
              label="Bold"
              active={editor.isActive('bold')}
              onClick={() => editor.chain().focus().toggleBold().run()}
            />
            <SignatureToolbarButton
              icon={Italic}
              label="Italic"
              active={editor.isActive('italic')}
              onClick={() => editor.chain().focus().toggleItalic().run()}
            />
            <SignatureToolbarButton
              icon={UnderlineIcon}
              label="Underline"
              active={editor.isActive('underline')}
              onClick={() => editor.chain().focus().toggleUnderline().run()}
            />
            <div style={{ width: 1, height: 18, background: 'var(--color-border-secondary)', margin: '0 4px', flexShrink: 0 }} />
            <SignatureToolbarButton
              icon={LinkIcon}
              label="Insert link"
              active={editor.isActive('link')}
              onClick={handleSetLink}
            />
            <div style={{ width: 1, height: 18, background: 'var(--color-border-secondary)', margin: '0 4px', flexShrink: 0 }} />
            <SignatureToolbarButton
              icon={List}
              label="Bullet list"
              active={editor.isActive('bulletList')}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
            />
            <SignatureToolbarButton
              icon={ListOrdered}
              label="Numbered list"
              active={editor.isActive('orderedList')}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
            />
            <div style={{ flex: 1 }} />
            <SignatureToolbarButton
              icon={Undo2}
              label="Undo"
              onClick={() => editor.chain().focus().undo().run()}
            />
            <SignatureToolbarButton
              icon={Redo2}
              label="Redo"
              onClick={() => editor.chain().focus().redo().run()}
            />
          </div>
        )}

        {/* Editor content */}
        <div
          onClick={() => editor?.commands.focus()}
          style={{ cursor: 'text', minHeight: 120 }}
        >
          <EditorContent
            editor={editor}
            style={{ padding: 'var(--spacing-md)', outline: 'none' }}
          />
        </div>
      </div>

      {/* Include in replies toggle */}
      <SettingsRow
        label="Include signature in replies"
        description="Append signature when replying or forwarding"
      >
        <SettingsToggle
          checked={includeSignatureInReplies}
          onChange={setIncludeSignatureInReplies}
          label="Include signature in replies"
        />
      </SettingsRow>
    </div>
  );
}

export function MailComposerPanel() {
  const {
    composeMode,
    undoSendDelay,
    setComposeMode,
    setUndoSendDelay,
  } = useSettingsStore();

  return (
    <div>
      <SettingsSection title="Compose mode" description="Choose how you write emails">
        <div
          role="radiogroup"
          aria-label="Compose mode"
          style={{ display: 'flex', flexDirection: 'column', gap: 2 }}
        >
          <RadioOption
            selected={composeMode === 'rich'}
            onClick={() => setComposeMode('rich')}
            label="Rich text"
            description="Bold, italic, links, and more"
          />
          <RadioOption
            selected={composeMode === 'plain'}
            onClick={() => setComposeMode('plain')}
            label="Plain text"
            description="Simple unformatted text"
          />
        </div>
      </SettingsSection>

      <SettingsSection
        title="Signature"
        description="Automatically appended to every email you compose"
      >
        <SignatureEditor />
      </SettingsSection>

      <SettingsSection title="Undo send" description="Configure the grace period after sending">
        <SettingsRow
          label="Undo send delay"
          description="How long you have to cancel a sent email"
        >
          <SettingsSelect
            value={undoSendDelay}
            options={[
              { value: 5 as const, label: '5 seconds' },
              { value: 10 as const, label: '10 seconds' },
              { value: 20 as const, label: '20 seconds' },
              { value: 30 as const, label: '30 seconds' },
            ]}
            onChange={(v) => setUndoSendDelay(v as 5 | 10 | 20 | 30)}
          />
        </SettingsRow>
      </SettingsSection>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel: AI
// ---------------------------------------------------------------------------

const AI_PROVIDERS: Array<{
  id: AIProvider;
  label: string;
  description: string;
  placeholder: string;
}> = [
  { id: 'openai', label: 'OpenAI', description: 'GPT-4o, GPT-4.1, o3', placeholder: 'sk-...' },
  { id: 'anthropic', label: 'Anthropic', description: 'Claude Sonnet, Opus, Haiku', placeholder: 'sk-ant-...' },
  { id: 'google', label: 'Google Gemini', description: 'Gemini 2.5 Pro, Flash', placeholder: 'AIza...' },
  { id: 'openrouter', label: 'OpenRouter', description: '300+ models via one API key', placeholder: 'sk-or-v1-...' },
  { id: 'groq', label: 'Groq', description: 'Ultra-fast inference (Llama, Gemma)', placeholder: 'gsk_...' },
  { id: 'mistral', label: 'Mistral AI', description: 'Mistral Large, Codestral', placeholder: 'Enter API key...' },
  { id: 'deepseek', label: 'DeepSeek', description: 'DeepSeek-V3, R1 reasoning', placeholder: 'sk-...' },
  { id: 'xai', label: 'xAI (Grok)', description: 'Grok-3, Grok-3 Mini', placeholder: 'xai-...' },
  { id: 'perplexity', label: 'Perplexity', description: 'Sonar Pro with web search', placeholder: 'pplx-...' },
  { id: 'fireworks', label: 'Fireworks AI', description: 'Fast open-source model inference', placeholder: 'fw_...' },
  { id: 'together', label: 'Together AI', description: '200+ open-source models', placeholder: 'Enter API key...' },
  { id: 'cohere', label: 'Cohere', description: 'Command R+ for enterprise', placeholder: 'co_...' },
  { id: 'custom', label: 'Custom (OpenAI-compatible)', description: 'Any endpoint that supports the OpenAI API format', placeholder: 'Enter API key...' },
];

export function MailAIPanel() {
  const {
    aiEnabled, setAIEnabled,
    aiProvider, setAIProvider,
    aiApiKeys, setAIApiKey,
    aiCustomProvider, setAICustomProvider,
    aiWritingAssistant, setAIWritingAssistant,
    aiQuickReplies, setAIQuickReplies,
    aiThreadSummary, setAIThreadSummary,
    aiTranslation, setAITranslation,
  } = useSettingsStore();

  const [keyVisible, setKeyVisible] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [testingProvider, setTestingProvider] = useState<AIProvider | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [dropdownOpen]);

  const activeConfig = AI_PROVIDERS.find((p) => p.id === aiProvider)!;
  const currentKey = aiProvider === 'custom' ? aiCustomProvider.apiKey : (aiApiKeys[aiProvider] || '');
  const hasActiveKey = aiProvider === 'custom'
    ? !!(aiCustomProvider.apiKey && aiCustomProvider.baseUrl)
    : !!currentKey;

  const handleKeyChange = (value: string) => {
    if (aiProvider === 'custom') {
      setAICustomProvider({ apiKey: value });
    } else {
      setAIApiKey(aiProvider, value);
    }
  };

  const testApiKey = async () => {
    if (!currentKey) return;
    setTestingProvider(aiProvider);
    setTestResult(null);
    try {
      const res = await fetch('/api/v1/ai/test-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: aiProvider,
          apiKey: currentKey,
          ...(aiProvider === 'custom' ? { baseUrl: aiCustomProvider.baseUrl } : {}),
        }),
      });
      if (res.ok) {
        setTestResult({ ok: true, message: 'API key is valid' });
      } else {
        const data = await res.json().catch(() => ({}));
        setTestResult({ ok: false, message: data.error || 'Invalid API key' });
      }
    } catch {
      setTestResult({ ok: false, message: 'Connection failed' });
    }
    setTestingProvider(null);
  };

  // Shared input styles
  const inputStyle: CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    fontSize: 'var(--font-size-sm)',
    fontFamily: 'var(--font-family)',
    background: 'var(--color-bg-tertiary)',
    border: '1px solid var(--color-border-secondary)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--color-text-primary)',
    outline: 'none',
    transition: 'border-color var(--transition-normal)',
    boxSizing: 'border-box' as const,
  };

  return (
    <div>
      {/* Master toggle */}
      <SettingsSection
        title="AtlasMail AI"
        description="AI helps you draft, summarize, translate emails, and reply faster. Your data remains private and is not used for training."
      >
        <SettingsRow
          label="Enable AI features"
          description="Turn on AI-powered features across AtlasMail"
        >
          <SettingsToggle
            checked={aiEnabled}
            onChange={setAIEnabled}
            label="Enable AI features"
          />
        </SettingsRow>
      </SettingsSection>

      {aiEnabled && (
        <>
          {/* Provider & API keys */}
          <SettingsSection
            title="API configuration"
            description="Enter your own API key to use AI features. Keys are stored locally and never sent to AtlasMail servers."
          >
            {/* Provider dropdown */}
            <div style={{ padding: 'var(--spacing-md) 0', borderBottom: '1px solid var(--color-border-secondary)' }}>
              <div
                style={{
                  fontSize: 'var(--font-size-sm)',
                  fontFamily: 'var(--font-family)',
                  fontWeight: 500,
                  color: 'var(--color-text-primary)',
                  marginBottom: 'var(--spacing-xs)',
                }}
              >
                Provider
              </div>
              <div ref={dropdownRef} style={{ position: 'relative' }}>
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: 'var(--font-size-sm)',
                    fontFamily: 'var(--font-family)',
                    background: 'var(--color-bg-tertiary)',
                    border: dropdownOpen
                      ? '1px solid var(--color-accent-primary)'
                      : '1px solid var(--color-border-secondary)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--color-text-primary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'border-color var(--transition-normal)',
                    textAlign: 'left',
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 500 }}>{activeConfig.label}</span>
                    <span style={{ marginLeft: 8, color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-xs)' }}>
                      {activeConfig.description}
                    </span>
                  </div>
                  <ChevronDown
                    size={14}
                    style={{
                      color: 'var(--color-text-tertiary)',
                      transform: dropdownOpen ? 'rotate(180deg)' : 'none',
                      transition: 'transform var(--transition-normal)',
                      flexShrink: 0,
                    }}
                  />
                </button>
                {dropdownOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 4px)',
                      left: 0,
                      right: 0,
                      background: 'var(--color-bg-secondary)',
                      border: '1px solid var(--color-border-secondary)',
                      borderRadius: 'var(--radius-md)',
                      boxShadow: 'var(--shadow-lg)',
                      zIndex: 10,
                      maxHeight: 320,
                      overflowY: 'auto',
                      padding: '4px 0',
                    }}
                  >
                    {AI_PROVIDERS.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          setAIProvider(p.id);
                          setDropdownOpen(false);
                          setTestResult(null);
                          setKeyVisible(false);
                        }}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          fontSize: 'var(--font-size-sm)',
                          fontFamily: 'var(--font-family)',
                          background: aiProvider === p.id
                            ? 'color-mix(in srgb, var(--color-accent-primary) 10%, transparent)'
                            : 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-start',
                          gap: 2,
                          textAlign: 'left',
                          transition: 'background var(--transition-fast)',
                        }}
                        onMouseEnter={(e) => {
                          if (aiProvider !== p.id) e.currentTarget.style.background = 'var(--color-surface-hover)';
                        }}
                        onMouseLeave={(e) => {
                          if (aiProvider !== p.id) e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <span style={{
                          fontWeight: aiProvider === p.id ? 600 : 400,
                          color: aiProvider === p.id ? 'var(--color-accent-primary)' : 'var(--color-text-primary)',
                        }}>
                          {p.label}
                        </span>
                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
                          {p.description}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Custom provider fields */}
            {aiProvider === 'custom' && (
              <div style={{ padding: 'var(--spacing-md) 0', borderBottom: '1px solid var(--color-border-secondary)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                  <div>
                    <div style={{ fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family)', fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 'var(--spacing-xs)' }}>
                      Service name
                    </div>
                    <input
                      type="text"
                      value={aiCustomProvider.name}
                      onChange={(e) => setAICustomProvider({ name: e.target.value })}
                      placeholder="e.g. LiteLLM, Ollama, vLLM"
                      spellCheck={false}
                      style={inputStyle}
                      onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-accent-primary)'; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-border-secondary)'; }}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family)', fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 'var(--spacing-xs)' }}>
                      Base URL
                    </div>
                    <input
                      type="url"
                      value={aiCustomProvider.baseUrl}
                      onChange={(e) => setAICustomProvider({ baseUrl: e.target.value })}
                      placeholder="https://api.example.com/v1"
                      spellCheck={false}
                      style={{ ...inputStyle, fontFamily: 'monospace' }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-accent-primary)'; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-border-secondary)'; }}
                    />
                    <div style={{ marginTop: 4, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-quaternary)' }}>
                      Must be OpenAI-compatible (supports /chat/completions endpoint)
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* API key input */}
            <div style={{ padding: 'var(--spacing-md) 0' }}>
              <div style={{ fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family)', fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 'var(--spacing-xs)' }}>
                {aiProvider === 'custom' ? (aiCustomProvider.name || 'Custom') : activeConfig.label} API key
              </div>
              <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <input
                    type={keyVisible ? 'text' : 'password'}
                    value={currentKey}
                    onChange={(e) => handleKeyChange(e.target.value)}
                    placeholder={activeConfig.placeholder}
                    spellCheck={false}
                    autoComplete="off"
                    style={{ ...inputStyle, fontFamily: 'monospace', paddingRight: 36 }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-accent-primary)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-border-secondary)'; }}
                  />
                  <button
                    onClick={() => setKeyVisible(!keyVisible)}
                    style={{
                      position: 'absolute',
                      right: 8,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 2,
                      color: 'var(--color-text-tertiary)',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                    aria-label={keyVisible ? 'Hide API key' : 'Show API key'}
                  >
                    {keyVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <button
                  onClick={testApiKey}
                  disabled={!currentKey || testingProvider === aiProvider}
                  style={{
                    padding: '8px 16px',
                    fontSize: 'var(--font-size-sm)',
                    fontFamily: 'var(--font-family)',
                    fontWeight: 500,
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border-secondary)',
                    background: 'var(--color-bg-tertiary)',
                    color: !currentKey ? 'var(--color-text-quaternary)' : 'var(--color-text-primary)',
                    cursor: !currentKey ? 'not-allowed' : 'pointer',
                    transition: 'all var(--transition-normal)',
                    whiteSpace: 'nowrap',
                    opacity: !currentKey ? 0.5 : 1,
                  }}
                >
                  {testingProvider === aiProvider ? 'Testing...' : 'Test key'}
                </button>
              </div>
              {testResult && (
                <div
                  style={{
                    marginTop: 'var(--spacing-sm)',
                    fontSize: 'var(--font-size-sm)',
                    fontFamily: 'var(--font-family)',
                    color: testResult.ok ? 'var(--color-success, #22c55e)' : 'var(--color-error, #ef4444)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--spacing-xs)',
                  }}
                >
                  {testResult.ok ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                  {testResult.message}
                </div>
              )}
              <div
                style={{
                  marginTop: 'var(--spacing-sm)',
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-text-quaternary)',
                  lineHeight: 'var(--line-height-normal)',
                }}
              >
                Your API key is stored locally in your browser and sent directly to the provider. It is never transmitted to AtlasMail servers.
              </div>
            </div>
          </SettingsSection>

          {/* Feature toggles */}
          <SettingsSection
            title="AI features"
            description="Choose which AI capabilities to enable"
          >
            <SettingsRow
              label="Writing assistant"
              description="AI helps you compose and refine emails faster"
            >
              <SettingsToggle
                checked={aiWritingAssistant}
                onChange={setAIWritingAssistant}
                label="Writing assistant"
              />
            </SettingsRow>
            <SettingsRow
              label="Quick AI replies"
              description="Suggested reply buttons like 'Interested', 'Thanks', 'Not interested' powered by AI"
            >
              <SettingsToggle
                checked={aiQuickReplies}
                onChange={setAIQuickReplies}
                label="Quick AI replies"
              />
            </SettingsRow>
            <SettingsRow
              label="Thread summary"
              description="Automatically summarize long email threads into key points"
            >
              <SettingsToggle
                checked={aiThreadSummary}
                onChange={setAIThreadSummary}
                label="Thread summary"
              />
            </SettingsRow>
            <SettingsRow
              label="Translate emails"
              description="AI-powered translation when reading or composing emails"
            >
              <SettingsToggle
                checked={aiTranslation}
                onChange={setAITranslation}
                label="Translate emails"
              />
            </SettingsRow>
          </SettingsSection>

          {/* Status indicator */}
          {!hasActiveKey && (
            <div
              style={{
                padding: 'var(--spacing-md) var(--spacing-lg)',
                background: 'color-mix(in srgb, var(--color-warning, #f59e0b) 10%, transparent)',
                border: '1px solid color-mix(in srgb, var(--color-warning, #f59e0b) 30%, transparent)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-secondary)',
                lineHeight: 'var(--line-height-normal)',
                fontFamily: 'var(--font-family)',
              }}
            >
              <strong style={{ color: 'var(--color-text-primary)' }}>
                {aiProvider === 'custom' ? 'Configuration incomplete.' : 'No API key configured.'}
              </strong>{' '}
              {aiProvider === 'custom'
                ? 'Enter a base URL and API key above to start using AI features.'
                : `Enter your ${activeConfig.label} API key above to start using AI features.`}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel: Inbox
// ---------------------------------------------------------------------------

export function MailInboxPanel() {
  const { autoAdvance, setAutoAdvance } = useSettingsStore();

  const options: Array<{
    value: typeof autoAdvance;
    label: string;
    description: string;
  }> = [
    {
      value: 'next',
      label: 'Next conversation',
      description: 'Advance to the next email after archiving or deleting',
    },
    {
      value: 'previous',
      label: 'Previous conversation',
      description: 'Go back to the previous email',
    },
    {
      value: 'list',
      label: 'Return to list',
      description: 'Always return to the inbox list',
    },
  ];

  return (
    <div>
      <SettingsSection
        title="Auto-advance"
        description="What happens after you archive, trash, or complete an action on an email"
      >
        <div
          role="radiogroup"
          aria-label="Auto-advance behavior"
          style={{ display: 'flex', flexDirection: 'column', gap: 2 }}
        >
          {options.map(({ value, label, description }) => (
            <RadioOption
              key={value}
              selected={autoAdvance === value}
              onClick={() => setAutoAdvance(value)}
              label={label}
              description={description}
            />
          ))}
        </div>
      </SettingsSection>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel: Reading pane
// ---------------------------------------------------------------------------

export function MailReadingPanePanel() {
  const { readingPane, setReadingPane } = useSettingsStore();

  const positions: Array<{
    value: typeof readingPane;
    label: string;
    description: string;
  }> = [
    { value: 'right', label: 'Right', description: 'Show reading pane to the right' },
    { value: 'bottom', label: 'Bottom', description: 'Show reading pane below' },
    { value: 'hidden', label: 'Hidden', description: 'Hide the reading pane' },
  ];

  return (
    <div>
      <SettingsSection
        title="Layout"
        description="Choose where the reading pane is displayed"
      >
        <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
          {positions.map(({ value, label, description }) => (
            <SelectableCard
              key={value}
              selected={readingPane === value}
              onClick={() => setReadingPane(value)}
              style={{ flex: 1, minHeight: 110, gap: 'var(--spacing-sm)' }}
            >
              <ReadingPanePreview position={value} />
              <span
                style={{
                  fontSize: 'var(--font-size-md)',
                  fontWeight: 'var(--font-weight-medium)' as CSSProperties['fontWeight'],
                  color: readingPane === value ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
                }}
              >
                {label}
              </span>
              <span
                style={{
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-text-tertiary)',
                  textAlign: 'center',
                }}
              >
                {description}
              </span>
            </SelectableCard>
          ))}
        </div>
      </SettingsSection>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel: Labels
// ---------------------------------------------------------------------------

export function MailLabelsPanel() {
  return (
    <div>
      <SettingsSection title="Labels" description="Labels are synced from your Gmail account">
        <div
          style={{
            padding: 'var(--spacing-2xl)',
            textAlign: 'center',
            color: 'var(--color-text-tertiary)',
            fontSize: 'var(--font-size-md)',
            fontFamily: 'var(--font-family)',
            background: 'var(--color-bg-tertiary)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-border-secondary)',
          }}
        >
          Labels are managed in your Gmail account. Changes you make in Gmail will be reflected here automatically.
        </div>
      </SettingsSection>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel: Keyboard shortcuts
// ---------------------------------------------------------------------------

export function MailShortcutsPanel() {
  const { t } = useTranslation();
  const categories: ShortcutCategory[] = ['navigation', 'actions', 'compose', 'search', 'ui'];

  const CATEGORY_LABELS: Record<ShortcutCategory, string> = {
    navigation: t('shortcuts.navigation'),
    actions: t('shortcuts.actions'),
    compose: t('shortcuts.composeCategory'),
    search: t('shortcuts.searchCategory'),
    ui: t('shortcuts.ui'),
  };

  return (
    <div>
      <p
        style={{
          margin: '0 0 var(--spacing-xl)',
          fontSize: 'var(--font-size-sm)',
          color: 'var(--color-text-tertiary)',
          fontFamily: 'var(--font-family)',
          lineHeight: 'var(--line-height-normal)',
        }}
      >
        These keyboard shortcuts are available throughout the app.
      </p>

      {categories.map((category) => {
        const shortcuts = DEFAULT_SHORTCUTS.filter((s) => s.category === category);
        if (shortcuts.length === 0) return null;

        return (
          <SettingsSection key={category} title={CATEGORY_LABELS[category]}>
            <div
              style={{
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--color-border-secondary)',
                overflow: 'hidden',
              }}
            >
              {shortcuts.map((shortcut, index) => (
                <div
                  key={shortcut.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 'var(--spacing-xl)',
                    padding: 'var(--spacing-sm) var(--spacing-lg)',
                    background: index % 2 === 0 ? 'var(--color-bg-tertiary)' : 'transparent',
                    borderBottom:
                      index < shortcuts.length - 1
                        ? '1px solid var(--color-border-secondary)'
                        : 'none',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 'var(--font-size-md)',
                        color: 'var(--color-text-primary)',
                        fontFamily: 'var(--font-family)',
                        fontWeight: 'var(--font-weight-medium)' as CSSProperties['fontWeight'],
                      }}
                    >
                      {shortcut.label}
                    </div>
                    <div
                      style={{
                        marginTop: 2,
                        fontSize: 'var(--font-size-xs)',
                        color: 'var(--color-text-tertiary)',
                        fontFamily: 'var(--font-family)',
                      }}
                    >
                      {shortcut.description}
                    </div>
                  </div>
                  <KeyBadge>{shortcut.keys}</KeyBadge>
                </div>
              ))}
            </div>
          </SettingsSection>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel: About
// ---------------------------------------------------------------------------

export function MailAboutPanel() {
  return (
    <div>
      <SettingsSection title="About AtlasMail">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-xl)',
            padding: 'var(--spacing-xl)',
            background: 'var(--color-bg-tertiary)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-border-secondary)',
            marginBottom: 'var(--spacing-xl)',
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 'var(--radius-lg)',
              background: 'var(--color-accent-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Mail size={28} color="#ffffff" />
          </div>
          <div>
            <div
              style={{
                fontSize: 'var(--font-size-2xl)',
                fontWeight: 'var(--font-weight-semibold)' as CSSProperties['fontWeight'],
                color: 'var(--color-text-primary)',
                fontFamily: 'var(--font-family)',
              }}
            >
              AtlasMail
            </div>
            <div
              style={{
                marginTop: 4,
                fontSize: 'var(--font-size-md)',
                color: 'var(--color-text-tertiary)',
                fontFamily: 'var(--font-family)',
              }}
            >
              Fast, keyboard-first email client
            </div>
          </div>
        </div>

        <SettingsRow label="Version" description="Current application version">
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-secondary)',
              background: 'var(--color-bg-tertiary)',
              padding: '4px 10px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border-secondary)',
            }}
          >
            0.1.0
          </span>
        </SettingsRow>

        <SettingsRow label="Built with" description="Core technologies">
          <div style={{ display: 'flex', gap: 'var(--spacing-xs)', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {['React', 'TypeScript', 'Vite', 'Zustand'].map((name) => (
              <span
                key={name}
                style={{
                  fontFamily: 'var(--font-family)',
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-text-secondary)',
                  background: 'var(--color-bg-tertiary)',
                  padding: '3px 10px',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--color-border-secondary)',
                }}
              >
                {name}
              </span>
            ))}
          </div>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Quick links">
        <button
          onClick={() => {
            document.dispatchEvent(new CustomEvent('atlasmail:settings_navigate', { detail: { panel: 'shortcuts' } }));
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'var(--spacing-md) var(--spacing-lg)',
            marginBottom: 'var(--spacing-xs)',
            background: 'var(--color-bg-tertiary)',
            border: '1px solid var(--color-border-secondary)',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
            transition: 'background var(--transition-normal)',
            width: '100%',
            fontFamily: 'var(--font-family)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-surface-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--color-bg-tertiary)')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-bg-secondary)',
              }}
            >
              <Keyboard size={16} style={{ color: 'var(--color-text-secondary)' }} />
            </span>
            <div style={{ textAlign: 'left' }}>
              <div
                style={{
                  fontSize: 'var(--font-size-md)',
                  color: 'var(--color-text-primary)',
                  fontWeight: 'var(--font-weight-medium)' as CSSProperties['fontWeight'],
                }}
              >
                Keyboard shortcuts
              </div>
              <div
                style={{
                  marginTop: 1,
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-text-tertiary)',
                }}
              >
                View all available shortcuts
              </div>
            </div>
          </div>
          <ChevronRight size={16} style={{ color: 'var(--color-text-tertiary)' }} />
        </button>
      </SettingsSection>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel map
// ---------------------------------------------------------------------------

const PANELS: Record<NavItemId, () => ReactElement> = {
  general: MailGeneralPanel,
  accounts: MailAccountsPanel,
  appearance: MailAppearancePanel,
  notifications: MailNotificationsPanel,
  composer: MailComposerPanel,
  ai: MailAIPanel,
  inbox: MailInboxPanel,
  'reading-pane': MailReadingPanePanel,
  labels: MailLabelsPanel,
  shortcuts: MailShortcutsPanel,
  about: MailAboutPanel,
};

function usePanelTitles(): Record<NavItemId, string> {
  const { t } = useTranslation();
  return {
    general: t('settings.general'),
    accounts: t('settings.accounts'),
    appearance: t('settings.appearance'),
    notifications: t('settings.notifications'),
    composer: t('settings.composer'),
    ai: t('settings.ai'),
    inbox: t('settings.inboxSection'),
    'reading-pane': t('settings.readingPane'),
    labels: t('settings.labels'),
    shortcuts: t('settings.keyboardShortcuts'),
    about: t('settings.about'),
  };
}

function usePanelDescriptions(): Record<NavItemId, string> {
  const { t } = useTranslation();
  return {
    general: 'Manage your profile and account',
    accounts: 'Manage connected email accounts',
    appearance: 'Customize how AtlasMail looks',
    notifications: 'Configure alerts and notification preferences',
    composer: 'Email composition and signature settings',
    ai: 'Configure AI-powered features and API keys',
    inbox: 'Inbox behavior and auto-advance',
    'reading-pane': 'Reading pane layout and positioning',
    labels: 'Create and manage email labels',
    shortcuts: 'Keyboard shortcut reference',
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
