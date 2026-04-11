import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Search,
  Trash2,
  Settings,
  ArrowDownAZ,
} from 'lucide-react';
import { AppSidebar } from '../../../components/layout/app-sidebar';
import { useAppActions } from '../../../hooks/use-app-permissions';
import { useAuthStore } from '../../../stores/auth-store';
import {
  useDrawingList,
  useDeleteDrawing,
  useRestoreDrawing,
  useDuplicateDrawing,
} from '../hooks';
import { useDrawSettingsStore, type DrawSortOrder } from '../settings-store';
import { sortDrawings } from '../lib/helpers';
import { DrawingListItem, SidebarButton } from './drawing-list-item';

// ─── Sort dropdown ──────────────────────────────────────────────────

function SortDropdown({
  value,
  onChange,
}: {
  value: DrawSortOrder;
  onChange: (v: DrawSortOrder) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const options: Array<{ value: DrawSortOrder; label: string }> = [
    { value: 'modified', label: t('draw.sortByModified') },
    { value: 'created', label: t('draw.sortByCreated') },
    { value: 'name', label: t('draw.sortByName') },
  ];

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <SidebarButton
        icon={<ArrowDownAZ size={13} />}
        onClick={() => setOpen(!open)}
        tooltip={options.find((o) => o.value === value)?.label}
      />
      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 4,
            minWidth: 200,
            background: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border-primary)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-md)',
            zIndex: 20,
            padding: 4,
            overflow: 'hidden',
          }}
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                width: '100%',
                padding: '5px 8px',
                background: opt.value === value ? 'var(--color-surface-selected)' : 'transparent',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                color: opt.value === value ? 'var(--color-accent-primary)' : 'var(--color-text-primary)',
                fontSize: 'var(--font-size-sm)',
                fontFamily: 'var(--font-family)',
                fontWeight: opt.value === value ? 600 : 400,
                cursor: 'pointer',
                transition: 'background 0.12s ease',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => {
                if (opt.value !== value) e.currentTarget.style.background = 'var(--color-surface-hover)';
              }}
              onMouseLeave={(e) => {
                if (opt.value !== value) e.currentTarget.style.background = 'transparent';
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Quick link ─────────────────────────────────────────────────────

function QuickLink({
  icon,
  label,
  active,
  onClick,
  badge,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: number;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        padding: '5px 8px',
        background: active ? 'var(--color-surface-selected)' : hovered ? 'var(--color-surface-hover)' : 'transparent',
        border: 'none',
        borderRadius: 'var(--radius-sm)',
        color: active || hovered ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
        fontSize: 'var(--font-size-sm)',
        fontWeight: active ? 600 : 400,
        fontFamily: 'var(--font-family)',
        cursor: 'pointer',
        transition: 'background 0.12s ease',
        textAlign: 'left',
      }}
    >
      <span style={{ flexShrink: 0, color: 'var(--color-text-tertiary)' }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {badge !== undefined && badge > 0 && (
        <span
          style={{
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-text-tertiary)',
            background: 'var(--color-bg-tertiary)',
            padding: '1px 5px',
            borderRadius: 'var(--radius-lg)',
            fontWeight: 500,
          }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

// ─── Draw sidebar ────────────────────────────────────────────────────

type SidebarView = 'list' | 'trash';

export function DrawSidebar({
  selectedId,
  onSelect,
  onNewFromTemplate,
  onOpenSettings,
  isCreating,
}: {
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  onNewFromTemplate: () => void;
  onOpenSettings: () => void;
  isCreating?: boolean;
}) {
  const { t } = useTranslation();
  const { canCreate, canDelete, canDeleteOwn } = useAppActions('draw');
  const currentUserId = useAuthStore((s) => s.account?.userId);
  const { data, isLoading } = useDrawingList();
  const { data: archivedData } = useDrawingList(true);
  const deleteDrawing = useDeleteDrawing();
  const restoreDrawing = useRestoreDrawing();
  const duplicateDrawing = useDuplicateDrawing();
  const { sortOrder, setSortOrder } = useDrawSettingsStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [view, setView] = useState<SidebarView>('list');

  const handleDelete = useCallback(
    (id: string) => {
      deleteDrawing.mutate(id);
    },
    [deleteDrawing],
  );

  const handleRestore = useCallback(
    (id: string) => {
      restoreDrawing.mutate(id);
    },
    [restoreDrawing],
  );

  const handleDuplicate = useCallback(
    (id: string) => {
      duplicateDrawing.mutate(id, {
        onSuccess: (drawing) => {
          onSelect(drawing.id);
        },
      });
    },
    [duplicateDrawing, onSelect],
  );

  const allDrawings = data?.drawings ?? [];
  const archivedDrawings = (archivedData?.drawings ?? []).filter((d) => d.isArchived);

  const filteredDrawings = useMemo(() => {
    let list = allDrawings;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((d) =>
        (d.title || 'Untitled').toLowerCase().includes(q),
      );
    }
    return sortDrawings(list, sortOrder);
  }, [allDrawings, searchQuery, sortOrder]);

  return (
    <AppSidebar
      storageKey="atlas_draw_sidebar"
      title={t('draw.title')}
      headerAction={
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <SidebarButton
            icon={<Settings size={13} />}
            onClick={onOpenSettings}
            tooltip={t('draw.settings')}
          />
          {canCreate && (
            <SidebarButton
              icon={<Plus size={14} />}
              onClick={onNewFromTemplate}
              tooltip={t('draw.newDrawing')}
              disabled={isCreating}
            />
          )}
        </div>
      }
      search={
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '5px 8px',
            borderRadius: 'var(--radius-sm)',
            background: searchFocused ? 'var(--color-bg-primary)' : 'transparent',
            border: `1px solid ${searchFocused ? 'var(--color-border-primary)' : 'transparent'}`,
            transition: 'all 0.15s ease',
          }}
        >
          <Search size={13} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => { setSearchFocused(true); setView('list'); }}
            onBlur={() => setSearchFocused(false)}
            placeholder={t('draw.search')}
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: 'var(--font-size-sm)',
              fontFamily: 'var(--font-family)',
              color: 'var(--color-text-primary)',
              padding: 0,
            }}
          />
        </div>
      }
    >
      {/* Quick links */}
      <div style={{ padding: '0 0 0 0' }}>
        <QuickLink
          icon={<Trash2 size={14} />}
          label={t('draw.trash')}
          active={view === 'trash'}
          onClick={() => setView(view === 'trash' ? 'list' : 'trash')}
          badge={archivedDrawings.length > 0 ? archivedDrawings.length : undefined}
        />
      </div>

      {/* Separator */}
      <div
        style={{
          height: 1,
          background: 'var(--color-border-primary)',
          margin: '8px 4px',
          flexShrink: 0,
        }}
      />

      {/* Section header with sort */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '2px 4px',
          marginBottom: 2,
        }}
      >
        <span
          style={{
            fontSize: 'var(--font-size-xs)',
            fontWeight: 600,
            color: 'var(--color-text-tertiary)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          {view === 'trash' ? t('draw.trash') : t('draw.drawings')}
        </span>
        {view === 'list' && (
          <SortDropdown value={sortOrder} onChange={setSortOrder} />
        )}
      </div>

      {/* Drawing list */}
      {isLoading ? (
        <div
          style={{
            padding: '24px 12px',
            textAlign: 'center',
            color: 'var(--color-text-tertiary)',
            fontSize: 'var(--font-size-sm)',
          }}
        >
          {t('common.loading')}
        </div>
      ) : view === 'list' ? (
        filteredDrawings.length === 0 ? (
          searchQuery.trim() ? (
            <div
              style={{
                padding: '24px 12px',
                textAlign: 'center',
                color: 'var(--color-text-tertiary)',
                fontSize: 'var(--font-size-sm)',
              }}
            >
              {t('docs.noResults', { query: searchQuery })}
            </div>
          ) : (
            <div
              style={{
                padding: '24px 12px',
                textAlign: 'center',
                color: 'var(--color-text-tertiary)',
                fontSize: 'var(--font-size-sm)',
              }}
            >
              {t('draw.noDrawings')}
            </div>
          )
        ) : (
          filteredDrawings.map((drawing) => {
            const isOwner = drawing.userId === currentUserId;
            const rowCanDelete = canDelete || (canDeleteOwn && isOwner);
            return (
              <DrawingListItem
                key={drawing.id}
                drawing={drawing}
                isSelected={drawing.id === selectedId}
                onClick={() => onSelect(drawing.id)}
                onDelete={rowCanDelete ? () => handleDelete(drawing.id) : undefined}
                onDuplicate={canCreate ? () => handleDuplicate(drawing.id) : undefined}
              />
            );
          })
        )
      ) : (
        /* Trash view */
        archivedDrawings.length === 0 ? (
          <div
            style={{
              padding: '24px 12px',
              textAlign: 'center',
              color: 'var(--color-text-tertiary)',
              fontSize: 'var(--font-size-sm)',
            }}
          >
            {t('draw.trashEmpty')}
          </div>
        ) : (
          archivedDrawings.map((drawing) => {
            const isOwner = drawing.userId === currentUserId;
            const rowCanDelete = canDelete || (canDeleteOwn && isOwner);
            return (
              <DrawingListItem
                key={drawing.id}
                drawing={drawing}
                isSelected={drawing.id === selectedId}
                onClick={() => onSelect(drawing.id)}
                onDelete={rowCanDelete ? () => handleDelete(drawing.id) : undefined}
                onRestore={rowCanDelete ? () => handleRestore(drawing.id) : undefined}
                isTrash
              />
            );
          })
        )
      )}
    </AppSidebar>
  );
}
