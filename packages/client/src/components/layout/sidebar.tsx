import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Inbox,
  Mail,
  MailOpen,
  Newspaper,
  Bell,
  Star,
  Settings,
  Edit,
  Sun,
  Moon,
  Monitor,
  Send,
  FileText,
  Archive,
  Trash2,
  AlertOctagon,
  Tag,
  Plus,
  Pencil,
  Trash2 as TrashIcon,
  Check,
  X,
  ArrowLeft,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Chip } from '../ui/chip';
import { useEmailStore } from '../../stores/email-store';
import { useSettingsStore } from '../../stores/settings-store';
import { useUIStore } from '../../stores/ui-store';
import { useThreadCounts, useGmailLabels, useCreateGmailLabel, useUpdateGmailLabel, useDeleteGmailLabel } from '../../hooks/use-threads';
import type { GmailLabel } from '../../hooks/use-threads';
import { AccountSwitcher } from './account-switcher';
import { ROUTES } from '../../config/routes';
import type { EmailCategory } from '@atlasmail/shared';
import type { ThemeMode } from '@atlasmail/shared';
import type { CSSProperties } from 'react';
import type { Mailbox } from '../../stores/email-store';

interface NavItem {
  id: EmailCategory;
  icon: typeof Inbox;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'all', icon: Inbox },
  { id: 'important', icon: Star },
  { id: 'newsletters', icon: Newspaper },
  { id: 'notifications', icon: Bell },
  { id: 'other', icon: Mail },
];

const CATEGORY_COLORS: Record<EmailCategory, string> = {
  all: 'var(--color-category-important)',
  important: 'var(--color-star)',
  other: 'var(--color-category-other)',
  newsletters: 'var(--color-category-newsletters)',
  notifications: 'var(--color-category-notifications)',
};

const THEME_CYCLE: ThemeMode[] = ['light', 'dark', 'system'];

const THEME_ICONS: Record<ThemeMode, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;

  const label = count > 99 ? '99+' : String(count);

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 18,
        height: 18,
        padding: '0 5px',
        borderRadius: 9,
        background: 'var(--color-accent-subtle)',
        color: 'var(--color-accent-primary)',
        fontSize: 10,
        fontWeight: 600,
        lineHeight: 1,
        flexShrink: 0,
        boxSizing: 'border-box' as CSSProperties['boxSizing'],
      }}
    >
      {label}
    </span>
  );
}

function CategoryNavItem({
  id,
  label,
  icon: Icon,
  isActive,
  color,
  unreadCount,
  totalCount,
  onSelect,
}: {
  id: EmailCategory;
  label: string;
  icon: typeof Inbox;
  isActive: boolean;
  color: string;
  unreadCount: number;
  totalCount: number;
  onSelect: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  const bg = isActive
    ? 'var(--color-surface-selected)'
    : hovered
      ? 'var(--color-surface-hover)'
      : 'transparent';
  const fg = isActive ? 'var(--color-text-primary)' : hovered ? 'var(--color-text-primary)' : 'var(--color-text-secondary)';

  return (
    <button
      key={id}
      className="sidebar-nav-btn"
      onClick={onSelect}
      aria-current={isActive ? 'page' : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--spacing-sm)',
        width: '100%',
        padding: '6px var(--spacing-md)',
        background: bg,
        border: 'none',
        borderRadius: 'var(--radius-md)',
        color: fg,
        fontSize: 'var(--font-size-sm)',
        fontFamily: 'var(--font-family)',
        fontWeight: isActive
          ? ('var(--font-weight-semibold)' as CSSProperties['fontWeight'])
          : ('var(--font-weight-normal)' as CSSProperties['fontWeight']),
        cursor: 'pointer',
        transition: 'background var(--transition-normal), color var(--transition-normal)',
        textAlign: 'left',
      }}
    >
      <Icon size={16} className="sidebar-nav-icon" style={{ flexShrink: 0, color: color }} />
      <span style={{ flex: 1 }}>{label}</span>
      <UnreadBadge count={unreadCount} />
    </button>
  );
}

interface MailboxNavItemDef {
  id: Mailbox;
  icon: typeof Inbox;
}

const MAILBOX_NAV_ITEMS: MailboxNavItemDef[] = [
  { id: 'starred', icon: Star },
  { id: 'unread', icon: MailOpen },
  { id: 'sent', icon: Send },
  { id: 'drafts', icon: FileText },
  { id: 'archive', icon: Archive },
  { id: 'spam', icon: AlertOctagon },
  { id: 'trash', icon: Trash2 },
];

const MAILBOX_COLORS: Record<Mailbox, string> = {
  inbox: 'currentColor',
  starred: '#d4a017',
  unread: '#5a7fa0',
  sent: '#4a9e8f',
  drafts: '#c4856c',
  archive: '#7889a0',
  trash: '#c45a5a',
  spam: '#d4954a',
};

function MailboxNavItem({
  mailbox,
  label,
  icon: Icon,
  isActive,
  color,
  totalCount,
  onSelect,
}: {
  mailbox: Mailbox;
  label: string;
  icon: typeof Inbox;
  isActive: boolean;
  color: string;
  totalCount: number;
  onSelect: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  const bg = isActive
    ? 'var(--color-surface-selected)'
    : hovered
      ? 'var(--color-surface-hover)'
      : 'transparent';
  const fg = isActive ? 'var(--color-text-primary)' : hovered ? 'var(--color-text-primary)' : 'var(--color-text-secondary)';

  return (
    <button
      className="sidebar-nav-btn"
      onClick={onSelect}
      aria-current={isActive ? 'page' : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--spacing-sm)',
        width: '100%',
        padding: '6px var(--spacing-md)',
        background: bg,
        border: 'none',
        borderRadius: 'var(--radius-md)',
        color: fg,
        fontSize: 'var(--font-size-sm)',
        fontFamily: 'var(--font-family)',
        fontWeight: isActive
          ? ('var(--font-weight-semibold)' as CSSProperties['fontWeight'])
          : ('var(--font-weight-normal)' as CSSProperties['fontWeight']),
        cursor: 'pointer',
        transition: 'background var(--transition-normal), color var(--transition-normal)',
        textAlign: 'left',
      }}
    >
      <Icon size={16} className="sidebar-nav-icon" style={{ flexShrink: 0, color: color }} />
      <span style={{ flex: 1 }}>{label}</span>
      {totalCount > 0 && (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: 18,
            height: 18,
            padding: '0 5px',
            borderRadius: 9,
            background: 'var(--color-accent-subtle)',
            color: 'var(--color-accent-primary)',
            fontSize: 10,
            fontWeight: 600,
            lineHeight: 1,
            flexShrink: 0,
            boxSizing: 'border-box' as CSSProperties['boxSizing'],
          }}
        >
          {totalCount > 999 ? '999+' : totalCount}
        </span>
      )}
    </button>
  );
}

function ThemeToggleButton() {
  const { theme, setTheme } = useSettingsStore();
  const { t } = useTranslation();
  const [showTooltip, setShowTooltip] = useState(false);

  const ThemeIcon = THEME_ICONS[theme];

  const THEME_LABELS: Record<ThemeMode, string> = {
    light: t('sidebar.lightMode'),
    dark: t('sidebar.darkMode'),
    system: t('sidebar.systemMode'),
  };

  const label = THEME_LABELS[theme];

  function cycleTheme() {
    const currentIndex = THEME_CYCLE.indexOf(theme);
    const nextIndex = (currentIndex + 1) % THEME_CYCLE.length;
    setTheme(THEME_CYCLE[nextIndex]);
  }

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        onClick={cycleTheme}
        aria-label={t('sidebar.themeAriaLabel', { label })}
        title={label}
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
          color: 'var(--color-text-secondary)',
          cursor: 'pointer',
          transition: 'background var(--transition-normal), color var(--transition-normal), transform 150ms ease',
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          setShowTooltip(true);
          e.currentTarget.style.background = 'var(--color-surface-hover)';
          e.currentTarget.style.color = 'var(--color-text-primary)';
          e.currentTarget.style.transform = 'rotate(15deg)';
        }}
        onMouseLeave={(e) => {
          setShowTooltip(false);
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = 'var(--color-text-secondary)';
          e.currentTarget.style.transform = 'rotate(0deg)';
        }}
      >
        <ThemeIcon size={16} />
      </button>

      {showTooltip && (
        <div
          role="tooltip"
          style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginBottom: 6,
            padding: '4px 8px',
            background: 'var(--color-surface-overlay)',
            color: 'var(--color-text-primary)',
            fontSize: 'var(--font-size-xs)',
            fontFamily: 'var(--font-family)',
            fontWeight: 500 as CSSProperties['fontWeight'],
            borderRadius: 'var(--radius-sm)',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            boxShadow: 'var(--shadow-md)',
            zIndex: 100,
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
}

/** Compute the display name (leaf) and nesting depth from a Gmail label name. */
function parseLabelName(name: string): { displayName: string; depth: number } {
  const parts = name.split('/');
  return { displayName: parts[parts.length - 1], depth: parts.length - 1 };
}

/** Sort labels so parents appear before their children, and siblings are alphabetical. */
function sortGmailLabels(labels: GmailLabel[]): GmailLabel[] {
  return [...labels].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

function GmailLabelItem({
  label,
  isActive,
  onSelect,
  onRename,
  onDelete,
}: {
  label: GmailLabel;
  isActive: boolean;
  onSelect: () => void;
  onRename: (newName: string) => void;
  onDelete: () => void;
}) {
  const bgColor = label.color?.background || 'var(--color-text-tertiary)';
  const { displayName, depth } = parseLabelName(label.name);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(displayName);
  const [isHovered, setIsHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const isUserLabel = label.type === 'user';

  useEffect(() => {
    if (isEditing) inputRef.current?.focus();
  }, [isEditing]);

  function handleSaveRename() {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== displayName) {
      // Preserve the parent path when renaming
      const parts = label.name.split('/');
      parts[parts.length - 1] = trimmed;
      onRename(parts.join('/'));
    }
    setIsEditing(false);
  }

  if (isEditing) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '4px var(--spacing-sm)',
          paddingLeft: `${8 + depth * 16}px`,
        }}
      >
        <input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSaveRename();
            if (e.key === 'Escape') { setIsEditing(false); setEditValue(displayName); }
          }}
          style={{
            flex: 1,
            minWidth: 0,
            height: 26,
            padding: '0 6px',
            border: '1px solid var(--color-border-focus)',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--color-bg-primary)',
            color: 'var(--color-text-primary)',
            fontSize: 'var(--font-size-sm)',
            fontFamily: 'var(--font-family)',
            outline: 'none',
          }}
        />
        <button
          onClick={handleSaveRename}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 24, height: 24, padding: 0,
            background: 'transparent', border: 'none', borderRadius: 'var(--radius-sm)',
            color: 'var(--color-success)', cursor: 'pointer',
          }}
        >
          <Check size={14} />
        </button>
        <button
          onClick={() => { setIsEditing(false); setEditValue(displayName); }}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 24, height: 24, padding: 0,
            background: 'transparent', border: 'none', borderRadius: 'var(--radius-sm)',
            color: 'var(--color-text-tertiary)', cursor: 'pointer',
          }}
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div
      style={{ position: 'relative' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <button
        onClick={onSelect}
        aria-current={isActive ? 'page' : undefined}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-sm)',
          width: '100%',
          padding: '6px var(--spacing-md)',
          paddingLeft: `${12 + depth * 16}px`,
          paddingRight: isUserLabel && isHovered ? 52 : 'var(--spacing-md)',
          background: isActive ? 'var(--color-surface-selected)' : isHovered ? 'var(--color-surface-hover)' : 'transparent',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          color: isActive ? 'var(--color-text-primary)' : isHovered ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
          fontSize: 'var(--font-size-sm)',
          fontFamily: 'var(--font-family)',
          fontWeight: isActive ? 500 : 400,
          cursor: 'pointer',
          transition: 'background var(--transition-normal), color var(--transition-normal)',
          textAlign: 'left',
        }}
      >
        <span
          style={{
            flexShrink: 0,
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: bgColor,
          }}
        />
        <span
          style={{
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {displayName}
        </span>
      </button>

      {/* Inline edit/delete actions for user labels */}
      {isUserLabel && isHovered && (
        <div
          style={{
            position: 'absolute',
            right: 6,
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            gap: 2,
          }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setEditValue(displayName); setIsEditing(true); }}
            title="Rename"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 22, height: 22, padding: 0,
              background: 'var(--color-bg-tertiary)', border: 'none',
              borderRadius: 'var(--radius-sm)', color: 'var(--color-text-secondary)',
              cursor: 'pointer',
            }}
          >
            <Pencil size={12} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            title="Delete"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 22, height: 22, padding: 0,
              background: 'var(--color-bg-tertiary)', border: 'none',
              borderRadius: 'var(--radius-sm)', color: 'var(--color-error)',
              cursor: 'pointer',
            }}
          >
            <TrashIcon size={12} />
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Labels floating popover
// ---------------------------------------------------------------------------

function LabelsPopover({
  labels,
  filterByLabel,
  onSelectLabel,
  onClose,
  anchorTop,
}: {
  labels: GmailLabel[];
  filterByLabel: string | null;
  onSelectLabel: (id: string | null) => void;
  onClose: () => void;
  anchorTop: number;
}) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const newInputRef = useRef<HTMLInputElement>(null);
  const createLabel = useCreateGmailLabel();
  const updateLabel = useUpdateGmailLabel();
  const deleteLabel = useDeleteGmailLabel();

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  useEffect(() => {
    if (addingNew) newInputRef.current?.focus();
  }, [addingNew]);

  function handleCreate() {
    const trimmed = newLabelName.trim();
    if (!trimmed) return;
    createLabel.mutate(trimmed, {
      onSuccess: () => { setNewLabelName(''); setAddingNew(false); },
    });
  }

  // Arrow should point at the Labels row. anchorTop is the top of the Labels button
  // relative to the sidebar container.
  const arrowSize = 8;

  return (
    <div
      ref={popoverRef}
      style={{
        position: 'fixed',
        left: 'var(--sidebar-width)',
        top: Math.max(anchorTop - 40, 8),
        width: 260,
        maxHeight: 'calc(100vh - 16px)',
        background: 'var(--color-bg-elevated)',
        border: '1px solid var(--color-border-primary)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-lg)',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Arrow pointing left */}
      <div
        style={{
          position: 'absolute',
          left: -arrowSize - 1,
          top: anchorTop - Math.max(anchorTop - 40, 8) + 8,
          width: 0,
          height: 0,
          borderTop: `${arrowSize}px solid transparent`,
          borderBottom: `${arrowSize}px solid transparent`,
          borderRight: `${arrowSize}px solid var(--color-border-primary)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: -arrowSize + 1,
          top: anchorTop - Math.max(anchorTop - 40, 8) + 8,
          width: 0,
          height: 0,
          borderTop: `${arrowSize}px solid transparent`,
          borderBottom: `${arrowSize}px solid transparent`,
          borderRight: `${arrowSize}px solid var(--color-bg-elevated)`,
        }}
      />

      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-sm)',
          padding: '10px var(--spacing-md)',
          borderBottom: '1px solid var(--color-border-secondary)',
          flexShrink: 0,
        }}
      >
        <Tag size={15} style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }} />
        <span
          style={{
            flex: 1,
            fontSize: 'var(--font-size-md)',
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-family)',
          }}
        >
          Labels
        </span>
        {filterByLabel && (
          <Chip
            onClick={() => onSelectLabel(null)}
            active
            height={24}
            style={{
              border: 'none',
              background: 'var(--color-accent-subtle)',
              color: 'var(--color-accent-primary)',
              fontWeight: 500,
              padding: '0 8px',
              fontSize: 'var(--font-size-xs)',
            }}
          >
            Clear
          </Chip>
        )}
        <button
          onClick={() => setAddingNew(true)}
          title="Add label"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 26,
            height: 26,
            padding: 0,
            background: 'transparent',
            border: '1px solid var(--color-border-primary)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
            transition: 'background var(--transition-normal)',
            flexShrink: 0,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-hover)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <Plus size={14} />
        </button>
      </div>

      {/* New label input */}
      {addingNew && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '6px var(--spacing-md)',
            borderBottom: '1px solid var(--color-border-secondary)',
          }}
        >
          <input
            ref={newInputRef}
            value={newLabelName}
            onChange={(e) => setNewLabelName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
              if (e.key === 'Escape') { setAddingNew(false); setNewLabelName(''); }
            }}
            placeholder="New label name..."
            style={{
              flex: 1,
              minWidth: 0,
              height: 28,
              padding: '0 8px',
              border: '1px solid var(--color-border-focus)',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--color-bg-primary)',
              color: 'var(--color-text-primary)',
              fontSize: 'var(--font-size-sm)',
              fontFamily: 'var(--font-family)',
              outline: 'none',
            }}
          />
          <button
            onClick={handleCreate}
            disabled={!newLabelName.trim() || createLabel.isPending}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 26, height: 26, padding: 0,
              background: 'transparent', border: 'none', borderRadius: 'var(--radius-sm)',
              color: newLabelName.trim() ? 'var(--color-success)' : 'var(--color-text-tertiary)',
              cursor: newLabelName.trim() ? 'pointer' : 'default',
            }}
          >
            <Check size={14} />
          </button>
          <button
            onClick={() => { setAddingNew(false); setNewLabelName(''); }}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 26, height: 26, padding: 0,
              background: 'transparent', border: 'none', borderRadius: 'var(--radius-sm)',
              color: 'var(--color-text-tertiary)', cursor: 'pointer',
            }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Label list */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 'var(--spacing-xs) var(--spacing-xs)',
        }}
      >
        {!labels || labels.length === 0 ? (
          <div
            style={{
              padding: 'var(--spacing-xl)',
              textAlign: 'center',
              color: 'var(--color-text-tertiary)',
              fontSize: 'var(--font-size-sm)',
            }}
          >
            No labels found
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
            {sortGmailLabels(labels).map((label) => (
              <GmailLabelItem
                key={label.id}
                label={label}
                isActive={filterByLabel === label.id}
                onSelect={() => {
                  onSelectLabel(filterByLabel === label.id ? null : label.id);
                }}
                onRename={(newName) => {
                  updateLabel.mutate({ labelId: label.id, name: newName });
                }}
                onDelete={() => {
                  if (filterByLabel === label.id) onSelectLabel(null);
                  deleteLabel.mutate(label.id);
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function Sidebar() {
  const { activeCategory, setActiveCategory, activeMailbox, setActiveMailbox, openCompose, filterByLabel, setFilterByLabel } =
    useEmailStore();
  const { toggleSettings } = useUIStore();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [labelsAnchorTop, setLabelsAnchorTop] = useState(0);
  const [labelsHovered, setLabelsHovered] = useState(false);
  const [settingsHovered, setSettingsHovered] = useState(false);
  const labelsBtnRef = useRef<HTMLButtonElement>(null);
  const { data: gmailLabels } = useGmailLabels();
  const { data: counts } = useThreadCounts();

  const handleOpenLabels = useCallback(() => {
    if (labelsBtnRef.current) {
      const rect = labelsBtnRef.current.getBoundingClientRect();
      setLabelsAnchorTop(rect.top + rect.height / 2);
    }
    setLabelsOpen((prev) => !prev);
  }, []);

  const handleCloseLabels = useCallback(() => setLabelsOpen(false), []);

  const handleSelectLabel = useCallback((id: string | null) => {
    setFilterByLabel(id);
  }, [setFilterByLabel]);

  const CATEGORY_LABELS: Record<EmailCategory, string> = {
    all: t('sidebar.allMail'),
    important: t('sidebar.important'),
    other: t('sidebar.other'),
    newsletters: t('sidebar.newsletters'),
    notifications: t('sidebar.notifications'),
  };

  const MAILBOX_LABELS: Record<string, string> = {
    starred: t('sidebar.starred'),
    unread: t('sidebar.unread'),
    sent: t('sidebar.sent'),
    drafts: t('sidebar.drafts'),
    archive: t('sidebar.archive'),
    trash: t('sidebar.trash'),
    spam: t('sidebar.spam'),
  };

  // Detect Electron desktop shell (set by preload script)
  const isDesktop = !!('atlasDesktop' in window);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        padding: 'var(--spacing-sm) var(--spacing-sm)',
        paddingTop: isDesktop ? 40 : undefined,
        boxSizing: 'border-box',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Header with back arrow + title — also serves as drag region on desktop */}
      <div
        className={isDesktop ? 'desktop-drag-region' : undefined}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: 'var(--spacing-xs) var(--spacing-xs)',
          marginBottom: 'var(--spacing-sm)',
        }}
      >
        <button
          onClick={() => navigate(ROUTES.HOME)}
          title="Home screen"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 26,
            height: 26,
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            background: 'transparent',
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
            flexShrink: 0,
            padding: 0,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-hover)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <ArrowLeft size={14} />
        </button>
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            letterSpacing: '-0.01em',
            flex: 1,
          }}
        >
          Mail
        </span>
        <ThemeToggleButton />
      </div>

      {/* Compose button */}
      <button
        className="sidebar-nav-btn"
        onClick={() => openCompose('new')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-sm)',
          width: '100%',
          padding: '6px var(--spacing-md)',
          marginBottom: 'var(--spacing-md)',
          background: 'var(--color-accent-subtle)',
          color: 'var(--color-accent-primary)',
          border: '1px solid color-mix(in srgb, var(--color-accent-primary) 20%, transparent)',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--font-size-sm)',
          fontWeight: 'var(--font-weight-medium)' as CSSProperties['fontWeight'],
          fontFamily: 'var(--font-family)',
          cursor: 'pointer',
          transition: 'background var(--transition-normal)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--color-accent-subtle-hover)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'var(--color-accent-subtle)';
        }}
      >
        <Edit size={15} className="sidebar-nav-icon" />
        {t('compose.newMessage')}
        <span
          aria-hidden="true"
          style={{
            marginLeft: 'auto',
            fontSize: 'var(--font-size-xs)',
            opacity: 0.5,
            fontFamily: 'var(--font-mono)',
            background: 'color-mix(in srgb, var(--color-accent-primary) 12%, transparent)',
            padding: '1px 5px',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          C
        </span>
      </button>

      {/* Category navigation */}
      <nav
        aria-label="Email categories"
        style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}
      >
        {NAV_ITEMS.map(({ id, icon }) => (
          <CategoryNavItem
            key={id}
            id={id}
            label={CATEGORY_LABELS[id]}
            icon={icon}
            isActive={activeMailbox === 'inbox' && activeCategory === id}
            color={CATEGORY_COLORS[id]}
            unreadCount={counts?.categories[id]?.unread ?? 0}
            totalCount={counts?.categories[id]?.total ?? 0}
            onSelect={() => setActiveCategory(id)}
          />
        ))}
      </nav>

      {/* Separator — between Other & Starred */}
      <div
        aria-hidden="true"
        style={{
          height: 1,
          background: 'var(--color-border-primary)',
          margin: '8px 0',
          flexShrink: 0,
        }}
      />

      {/* Mailbox navigation */}
      <nav
        aria-label="Mailboxes"
        style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}
      >
        {MAILBOX_NAV_ITEMS.map(({ id, icon }) => (
          <MailboxNavItem
            key={id}
            mailbox={id}
            label={MAILBOX_LABELS[id]}
            icon={icon}
            color={MAILBOX_COLORS[id]}
            isActive={activeMailbox === id}
            totalCount={counts?.mailboxes[id]?.total ?? 0}
            onSelect={() => setActiveMailbox(id)}
          />
        ))}

        {/* Separator — between Trash & Labels */}
        <div
          aria-hidden="true"
          style={{
            height: 1,
            background: 'var(--color-border-primary)',
            margin: '8px 0',
            flexShrink: 0,
          }}
        />

        {/* Gmail labels button */}
        <button
          ref={labelsBtnRef}
          className="sidebar-nav-btn"
          onClick={handleOpenLabels}
          onMouseEnter={() => setLabelsHovered(true)}
          onMouseLeave={() => setLabelsHovered(false)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-sm)',
            width: '100%',
            padding: '6px var(--spacing-md)',
            background: (filterByLabel || labelsOpen)
              ? 'var(--color-surface-selected)'
              : labelsHovered
                ? 'var(--color-surface-hover)'
                : 'transparent',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            color: (filterByLabel || labelsOpen || labelsHovered) ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
            fontSize: 'var(--font-size-sm)',
            fontFamily: 'var(--font-family)',
            fontWeight: filterByLabel ? 500 : 400,
            cursor: 'pointer',
            transition: 'background var(--transition-normal), color var(--transition-normal)',
            textAlign: 'left',
          }}
        >
          <Tag size={16} className="sidebar-nav-icon" style={{ flexShrink: 0 }} />
          <span style={{ flex: 1 }}>
            {filterByLabel
              ? parseLabelName(gmailLabels?.find((l) => l.id === filterByLabel)?.name ?? 'Labels').displayName
              : 'Labels'}
          </span>
          {filterByLabel && (
            <span
              aria-label="Label filter active"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: 'var(--color-accent-primary)',
                flexShrink: 0,
              }}
            />
          )}
        </button>
      </nav>

      {/* Bottom section: settings + account switcher */}
      <div
        style={{
          borderTop: '1px solid var(--color-border-primary)',
          paddingTop: 'var(--spacing-sm)',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
        }}
      >
        {/* Settings button */}
        <button
          className="sidebar-nav-btn"
          onClick={() => navigate('/settings?app=global&panel=general')}
          aria-label={t('settings.title')}
          onMouseEnter={() => setSettingsHovered(true)}
          onMouseLeave={() => setSettingsHovered(false)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-sm)',
            width: '100%',
            padding: '6px var(--spacing-md)',
            background: settingsHovered ? 'var(--color-surface-hover)' : 'transparent',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            color: settingsHovered ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
            fontSize: 'var(--font-size-sm)',
            fontFamily: 'var(--font-family)',
            cursor: 'pointer',
            transition: 'background var(--transition-normal), color var(--transition-normal)',
            textAlign: 'left',
          }}
        >
          <Settings size={16} className="sidebar-nav-icon" style={{ color: '#7889a0' }} />
          {t('settings.title')}
        </button>

        <AccountSwitcher />
      </div>

      {/* Gmail labels floating popover */}
      {labelsOpen && gmailLabels && (
        <LabelsPopover
          labels={gmailLabels}
          filterByLabel={filterByLabel}
          onSelectLabel={handleSelectLabel}
          onClose={handleCloseLabels}
          anchorTop={labelsAnchorTop}
        />
      )}
    </div>
  );
}
