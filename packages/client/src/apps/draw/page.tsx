import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Excalidraw, exportToBlob, exportToSvg, exportToClipboard, useHandleLibrary } from '@excalidraw/excalidraw';
import { convertToExcalidrawElements } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import {
  Plus,
  Search,
  Trash2,
  RotateCcw,
  Pencil,
  Copy,
  Download,
  Image,
  FileImage,
  Clipboard,
  Settings,
  ChevronDown,
  LayoutTemplate,
  ArrowDownAZ,
  Layers,
  Share2,
  Loader2,
  Check,
  ImagePlus,
  Maximize,
  Minimize,
} from 'lucide-react';
import { AppSidebar } from '../../components/layout/app-sidebar';
import { Button } from '../../components/ui/button';
import { IconButton } from '../../components/ui/icon-button';
import { useTranslation } from 'react-i18next';
import {
  useDrawingList,
  useDrawing,
  useCreateDrawing,
  useUpdateDrawing,
  useDeleteDrawing,
  useRestoreDrawing,
  useDuplicateDrawing,
  useAutoSaveDrawing,
  useUpdateDrawingVisibility,
} from './hooks';
import { useSettingsStore } from '../../stores/settings-store';
import { useDrawSettingsStore, useDrawSettingsSync, type DrawSortOrder } from './settings-store';
import { DrawSettingsModal } from './components/draw-settings-modal';
import { SmartButtonBar } from '../../components/shared/SmartButtonBar';
import { PresenceAvatars } from '../../components/shared/presence-avatars';
import { VisibilityToggle } from '../../components/shared/visibility-toggle';
import { useAuthStore } from '../../stores/auth-store';
import { useUIStore } from '../../stores/ui-store';
import { DRAWING_TEMPLATES } from '../../config/drawing-templates';
import { DEFAULT_LIBRARY_ITEMS } from '../../config/drawing-libraries';
import type { Drawing } from '@atlasmail/shared';
import { FeatureEmptyState } from '../../components/ui/feature-empty-state';

// ─── Sort helper ────────────────────────────────────────────────────

function sortDrawings(drawings: Drawing[], order: DrawSortOrder): Drawing[] {
  const sorted = [...drawings];
  switch (order) {
    case 'name':
      sorted.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
      break;
    case 'created':
      sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      break;
    case 'modified':
    default:
      sorted.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      break;
  }
  return sorted;
}

// ─── Sidebar button ──────────────────────────────────────────────────

function SidebarButton({
  icon,
  onClick,
  tooltip,
  disabled,
}: {
  icon: React.ReactNode;
  onClick: () => void;
  tooltip?: string;
  disabled?: boolean;
}) {
  return (
    <IconButton
      icon={icon}
      label={tooltip || ''}
      tooltip={!!tooltip}
      tooltipSide="bottom"
      size={26}
      onClick={onClick}
      disabled={disabled}
      style={{
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'default' : 'pointer',
      }}
    />
  );
}

// ─── Drawing list item ───────────────────────────────────────────────

function DrawingListItem({
  drawing,
  isSelected,
  onClick,
  onDelete,
  onRestore,
  onDuplicate,
  isTrash,
}: {
  drawing: Drawing;
  isSelected: boolean;
  onClick: () => void;
  onDelete?: () => void;
  onRestore?: () => void;
  onDuplicate?: () => void;
  isTrash?: boolean;
}) {
  const { t } = useTranslation();
  const [hovered, setHovered] = useState(false);

  const bg = isSelected
    ? 'var(--color-surface-selected)'
    : hovered
      ? 'var(--color-surface-hover)'
      : 'transparent';

  const updatedLabel = new Date(drawing.updatedAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });

  const actionCount = (onDelete ? 1 : 0) + (onRestore ? 1 : 0) + (onDuplicate ? 1 : 0);

  return (
    <div
      style={{ position: 'relative' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        onClick={onClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          padding: '7px 8px',
          paddingRight: hovered && actionCount > 0 ? 8 + actionCount * 28 : 8,
          background: bg,
          border: 'none',
          borderRadius: 'var(--radius-sm)',
          cursor: 'pointer',
          transition: 'background 0.12s ease',
          textAlign: 'left',
          fontFamily: 'var(--font-family)',
        }}
      >
        {drawing.thumbnailUrl ? (
          <img
            src={drawing.thumbnailUrl}
            alt=""
            style={{
              width: 28,
              height: 28,
              borderRadius: 'var(--radius-sm)',
              objectFit: 'cover',
              flexShrink: 0,
              border: '1px solid var(--color-border-secondary)',
            }}
          />
        ) : (
          <Pencil
            size={14}
            style={{
              flexShrink: 0,
              color: isSelected ? 'var(--color-accent-primary)' : 'var(--color-text-tertiary)',
            }}
          />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: isSelected ? 600 : 400,
              color: 'var(--color-text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {drawing.title || t('draw.untitled')}
          </div>
          <div
            style={{
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-text-tertiary)',
              marginTop: 1,
            }}
          >
            {updatedLabel}
          </div>
        </div>
      </button>

      {/* Hover actions */}
      {hovered && (
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
          {!isTrash && onDuplicate && (
            <SidebarButton
              icon={<Copy size={12} />}
              onClick={onDuplicate}
              tooltip={t('draw.duplicate')}
            />
          )}
          {isTrash && onRestore && (
            <SidebarButton
              icon={<RotateCcw size={12} />}
              onClick={onRestore}
              tooltip={t('draw.restore')}
            />
          )}
          {onDelete && (
            <SidebarButton
              icon={<Trash2 size={12} />}
              onClick={onDelete}
              tooltip={isTrash ? t('draw.delete') : t('draw.trash')}
            />
          )}
        </div>
      )}
    </div>
  );
}

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
            minWidth: 160,
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

// ─── Template picker ────────────────────────────────────────────────

function TemplatePicker({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (title: string, elements?: unknown[]) => void;
}) {
  const { t } = useTranslation();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  if (!open) return null;

  const templates = [
    { id: 'blank', name: t('draw.templateBlank'), description: t('draw.templateBlankDesc') },
    { id: 'flowchart', name: t('draw.templateFlowchart'), description: t('draw.templateFlowchartDesc') },
    { id: 'wireframe', name: t('draw.templateWireframe'), description: t('draw.templateWireframeDesc') },
    { id: 'mindMap', name: t('draw.templateMindMap'), description: t('draw.templateMindMapDesc') },
    { id: 'kanban', name: t('draw.templateKanban'), description: t('draw.templateKanbanDesc') },
    { id: 'swot', name: t('draw.templateSwot'), description: t('draw.templateSwotDesc') },
  ];

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'var(--color-bg-overlay)',
          zIndex: 200,
        }}
      />
      {/* Modal */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 560,
          maxWidth: 'calc(100vw - 48px)',
          maxHeight: 'calc(100vh - 96px)',
          background: 'var(--color-bg-elevated)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-elevated)',
          zIndex: 201,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'var(--font-family)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px 12px',
            borderBottom: '1px solid var(--color-border-primary)',
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 'var(--font-size-lg)',
              fontWeight: 600,
              color: 'var(--color-text-primary)',
            }}
          >
            {t('draw.newDrawing')}
          </h2>
          <p
            style={{
              margin: '4px 0 0',
              fontSize: 13,
              color: 'var(--color-text-tertiary)',
            }}
          >
            {t('draw.fromTemplate')}
          </p>
        </div>

        {/* Template grid */}
        <div
          style={{
            padding: 16,
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 10,
            overflowY: 'auto',
          }}
        >
          {templates.map((tmpl) => (
            <button
              key={tmpl.id}
              onClick={() => {
                if (tmpl.id === 'blank') {
                  onCreate(t('draw.untitled'));
                } else {
                  const found = DRAWING_TEMPLATES.find((dt) => dt.id === tmpl.id);
                  onCreate(tmpl.name, found?.elements);
                }
                onClose();
              }}
              onMouseEnter={() => setHoveredId(tmpl.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '16px 12px',
                background: hoveredId === tmpl.id
                  ? 'var(--color-surface-hover)'
                  : 'var(--color-bg-tertiary)',
                border: '1px solid var(--color-border-secondary)',
                borderRadius: 'var(--radius-lg)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                fontFamily: 'var(--font-family)',
                minHeight: 100,
              }}
            >
              <LayoutTemplate
                size={24}
                style={{
                  color: hoveredId === tmpl.id
                    ? 'var(--color-accent-primary)'
                    : 'var(--color-text-tertiary)',
                }}
              />
              <span
                style={{
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 500,
                  color: 'var(--color-text-primary)',
                  textAlign: 'center',
                }}
              >
                {tmpl.name}
              </span>
              <span
                style={{
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-text-tertiary)',
                  textAlign: 'center',
                  lineHeight: 1.3,
                }}
              >
                {tmpl.description}
              </span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

// ─── Draw sidebar ────────────────────────────────────────────────────

type SidebarView = 'list' | 'trash';

function DrawSidebar({
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
          <SidebarButton
            icon={<Plus size={14} />}
            onClick={onNewFromTemplate}
            tooltip={t('draw.newDrawing')}
            disabled={isCreating}
          />
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
          filteredDrawings.map((drawing) => (
            <DrawingListItem
              key={drawing.id}
              drawing={drawing}
              isSelected={drawing.id === selectedId}
              onClick={() => onSelect(drawing.id)}
              onDelete={() => handleDelete(drawing.id)}
              onDuplicate={() => handleDuplicate(drawing.id)}
            />
          ))
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
          archivedDrawings.map((drawing) => (
            <DrawingListItem
              key={drawing.id}
              drawing={drawing}
              isSelected={drawing.id === selectedId}
              onClick={() => onSelect(drawing.id)}
              onDelete={() => handleDelete(drawing.id)}
              onRestore={() => handleRestore(drawing.id)}
              isTrash
            />
          ))
        )
      )}
    </AppSidebar>
  );
}

// ─── Quick link (sidebar mini-nav) ───────────────────────────────────

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

// ─── Empty state ─────────────────────────────────────────────────────

function EmptyState({ onCreate }: { onCreate: () => void }) {
  const { t } = useTranslation();

  return (
    <FeatureEmptyState
      illustration="drawings"
      title={t('draw.empty.title')}
      description={t('draw.empty.desc')}
      highlights={[
        { icon: <Pencil size={14} />, title: t('draw.empty.h1Title'), description: t('draw.empty.h1Desc') },
        { icon: <Layers size={14} />, title: t('draw.empty.h2Title'), description: t('draw.empty.h2Desc') },
        { icon: <Share2 size={14} />, title: t('draw.empty.h3Title'), description: t('draw.empty.h3Desc') },
      ]}
      actionLabel={t('draw.newDrawing')}
      actionIcon={<Plus size={14} />}
      onAction={onCreate}
    />
  );
}

// ─── Export menu ─────────────────────────────────────────────────────

function ExportMenu({
  excalidrawApi,
}: {
  excalidrawApi: ExcalidrawImperativeAPI | null;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { exportQuality, exportWithBackground } = useDrawSettingsStore();

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const handleExportPng = useCallback(async () => {
    if (!excalidrawApi) return;
    const elements = excalidrawApi.getSceneElements();
    const appState = excalidrawApi.getAppState();
    const files = excalidrawApi.getFiles();
    try {
      const blob = await exportToBlob({
        elements,
        appState: { ...appState, exportWithDarkMode: appState.theme === 'dark', exportBackground: exportWithBackground },
        files,
        getDimensions: () => ({ width: 1920 * exportQuality, height: 1080 * exportQuality, scale: exportQuality }),
      } as any);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'drawing.png';
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* ignore */ }
    setOpen(false);
  }, [excalidrawApi, exportQuality, exportWithBackground]);

  const handleExportSvg = useCallback(async () => {
    if (!excalidrawApi) return;
    const elements = excalidrawApi.getSceneElements();
    const appState = excalidrawApi.getAppState();
    const files = excalidrawApi.getFiles();
    try {
      const svg = await exportToSvg({
        elements,
        appState: { ...appState, exportWithDarkMode: appState.theme === 'dark', exportBackground: exportWithBackground },
        files,
      } as any);
      const svgStr = new XMLSerializer().serializeToString(svg);
      const blob = new Blob([svgStr], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'drawing.svg';
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* ignore */ }
    setOpen(false);
  }, [excalidrawApi, exportWithBackground]);

  const handleCopyClipboard = useCallback(async () => {
    if (!excalidrawApi) return;
    const elements = excalidrawApi.getSceneElements();
    const appState = excalidrawApi.getAppState();
    const files = excalidrawApi.getFiles();
    try {
      await exportToClipboard({
        elements,
        appState: { ...appState, exportBackground: exportWithBackground },
        files,
        type: 'png',
      } as any);
    } catch { /* ignore */ }
    setOpen(false);
  }, [excalidrawApi, exportWithBackground]);

  const handleExportPdf = useCallback(async () => {
    if (!excalidrawApi) return;
    const elements = excalidrawApi.getSceneElements();
    const appState = excalidrawApi.getAppState();
    const files = excalidrawApi.getFiles();
    try {
      const blob = await exportToBlob({
        elements,
        appState: { ...appState, exportWithDarkMode: appState.theme === 'dark', exportBackground: exportWithBackground },
        files,
        getDimensions: () => ({ width: 1920 * exportQuality, height: 1080 * exportQuality, scale: exportQuality }),
      } as any);
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
      const img = new window.Image();
      img.src = dataUrl;
      await new Promise<void>((resolve) => { img.onload = () => resolve(); });
      const { jsPDF } = await import('jspdf');
      const orientation = img.width >= img.height ? 'landscape' : 'portrait';
      const pdf = new jsPDF({ orientation, unit: 'px', format: [img.width, img.height] });
      pdf.addImage(dataUrl, 'PNG', 0, 0, img.width, img.height);
      pdf.save('drawing.pdf');
    } catch { /* ignore */ }
    setOpen(false);
  }, [excalidrawApi, exportQuality, exportWithBackground]);

  const menuItems = [
    { label: t('draw.exportPng'), icon: <Image size={14} />, onClick: handleExportPng },
    { label: t('draw.exportSvg'), icon: <FileImage size={14} />, onClick: handleExportSvg },
    { label: t('draw.exportPdf'), icon: <Download size={14} />, onClick: handleExportPdf },
    { label: t('draw.copyClipboard'), icon: <Clipboard size={14} />, onClick: handleCopyClipboard },
  ];

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <Button
        variant="ghost"
        size="sm"
        icon={<Download size={13} />}
        onClick={() => setOpen(!open)}
        title={t('draw.export')}
      >
        {t('draw.export')}
        <ChevronDown size={11} />
      </Button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 4,
            minWidth: 180,
            background: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border-primary)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-md)',
            zIndex: 20,
            padding: 4,
          }}
        >
          {menuItems.map((item) => (
            <button
              key={item.label}
              onClick={item.onClick}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                padding: '6px 8px',
                background: 'transparent',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--color-text-primary)',
                fontSize: 'var(--font-size-sm)',
                fontFamily: 'var(--font-family)',
                cursor: 'pointer',
                transition: 'background 0.12s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-surface-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{ color: 'var(--color-text-tertiary)' }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Insert image button ────────────────────────────────────────────

function InsertImageButton({
  excalidrawApi,
}: {
  excalidrawApi: ExcalidrawImperativeAPI | null;
}) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleInsertImage = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !excalidrawApi) return;
    if (file.size > 10 * 1024 * 1024) { alert('Image must be under 10 MB'); return; }

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Get image dimensions
      const img = new window.Image();
      img.src = dataUrl;
      await new Promise<void>((resolve) => { img.onload = () => resolve(); });

      const fileId = crypto.randomUUID() as any;

      // Register the file with Excalidraw
      excalidrawApi.addFiles([{
        id: fileId,
        dataURL: dataUrl as any,
        mimeType: file.type as any,
        created: Date.now(),
        lastRetrieved: Date.now(),
      }]);

      // Scale to fit within canvas (max 600px width/height)
      const maxSize = 600;
      let width = img.width;
      let height = img.height;
      if (width > maxSize || height > maxSize) {
        const scale = Math.min(maxSize / width, maxSize / height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }

      const imageElement = {
        type: 'image' as const,
        id: crypto.randomUUID(),
        fileId,
        x: 100,
        y: 100,
        width,
        height,
        strokeColor: 'transparent',
        backgroundColor: 'transparent',
        fillStyle: 'solid' as const,
        strokeWidth: 0,
        roughness: 0,
        opacity: 100,
        roundness: null,
        seed: Math.floor(Math.random() * 100000),
        version: 1,
        versionNonce: Math.floor(Math.random() * 100000),
        isDeleted: false,
        groupIds: [],
        boundElements: null,
        locked: false,
        link: null,
        updated: Date.now(),
        status: 'saved' as const,
        scale: [1, 1] as [number, number],
      };

      const existingElements = excalidrawApi.getSceneElements();
      excalidrawApi.updateScene({
        elements: [...existingElements, imageElement] as any,
      });
    } catch {
      // Failed to insert image
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [excalidrawApi]);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        icon={<ImagePlus size={13} />}
        onClick={() => fileInputRef.current?.click()}
        title={t('draw.insertImage')}
      >
        {t('draw.insertImage')}
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleInsertImage}
      />
    </>
  );
}

// ─── Editable title header ───────────────────────────────────────────

function EditableTitle({
  title,
  onChange,
  isSaving,
  showSaved,
  excalidrawApi,
  presenceSlot,
  visibilitySlot,
  presentSlot,
}: {
  title: string;
  onChange: (title: string) => void;
  isSaving: boolean;
  showSaved?: boolean;
  excalidrawApi: ExcalidrawImperativeAPI | null;
  presenceSlot?: React.ReactNode;
  visibilitySlot?: React.ReactNode;
  presentSlot?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditValue(title);
  }, [title]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const handleSave = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== title) {
      onChange(trimmed);
    } else {
      setEditValue(title);
    }
    setEditing(false);
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 16px',
        borderBottom: '1px solid var(--color-border-primary)',
        background: 'var(--color-bg-secondary)',
        flexShrink: 0,
      }}
    >
      <Pencil size={14} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
      {editing ? (
        <input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') {
              setEditValue(title);
              setEditing(false);
            }
          }}
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontSize: 'var(--font-size-md)',
            fontWeight: 600,
            fontFamily: 'var(--font-family)',
            color: 'var(--color-text-primary)',
            padding: 0,
          }}
        />
      ) : (
        <span
          onClick={() => setEditing(true)}
          style={{
            flex: 1,
            fontSize: 'var(--font-size-md)',
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            cursor: 'text',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {title || t('draw.untitled')}
        </span>
      )}
      {isSaving && (
        <span
          style={{
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-text-tertiary)',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <Loader2 size={12} style={{ animation: 'draw-spin 1s linear infinite' }} />
          {t('draw.saving')}
        </span>
      )}
      {!isSaving && showSaved && (
        <span
          style={{
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-text-tertiary)',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <Check size={12} />
          {t('draw.saved')}
        </span>
      )}
      {visibilitySlot}
      {presenceSlot}
      <InsertImageButton excalidrawApi={excalidrawApi} />
      <ExportMenu excalidrawApi={excalidrawApi} />
      {presentSlot}
    </div>
  );
}

// ─── Excalidraw wrapper ──────────────────────────────────────────────

// Keys of AppState we persist (not UI-related state)
const PERSISTED_APP_STATE_KEYS = [
  'viewBackgroundColor',
  'currentItemFontFamily',
  'currentItemFontSize',
  'currentItemStrokeColor',
  'currentItemBackgroundColor',
  'currentItemFillStyle',
  'currentItemStrokeWidth',
  'currentItemRoughness',
  'currentItemOpacity',
  'currentItemEndArrowhead',
  'currentItemStartArrowhead',
  'gridSize',
  'gridStep',
  'gridModeEnabled',
  'objectsSnapModeEnabled',
] as const;

function pickAppState(appState: Record<string, unknown>): Record<string, unknown> {
  const picked: Record<string, unknown> = {};
  for (const key of PERSISTED_APP_STATE_KEYS) {
    if (key in appState) {
      picked[key] = appState[key];
    }
  }
  return picked;
}

// ─── Library persistence (server-backed) ─────────────────────────────

import { api as drawApi } from '../../lib/api-client';

const libraryAdapter = {
  async load() {
    try {
      const { data } = await drawApi.get('/settings');
      const serverLib = data.data?.drawLibrary;
      const userItems = Array.isArray(serverLib) ? serverLib : [];
      return { libraryItems: [...userItems, ...DEFAULT_LIBRARY_ITEMS] as any[] };
    } catch {
      return { libraryItems: DEFAULT_LIBRARY_ITEMS as any[] };
    }
  },
  async save(libraryData: { libraryItems: readonly unknown[] }) {
    // Only persist user-added items (filter out bundled defaults)
    const userItems = libraryData.libraryItems.filter(
      (item: any) => !item.id?.startsWith('lib-'),
    );
    try {
      await drawApi.put('/settings', { drawLibrary: userItems });
    } catch { /* save failed */ }
  },
};

// ─── Thumbnail generation ────────────────────────────────────────────

const THUMBNAIL_DEBOUNCE_MS = 10_000;

async function generateThumbnailDataUrl(
  elements: readonly unknown[],
  appState: Record<string, unknown>,
  files: unknown,
): Promise<string | null> {
  try {
    const visible = (elements as any[]).filter((el) => !el.isDeleted);
    if (visible.length === 0) return null;

    const blob = await exportToBlob({
      elements: visible,
      appState: {
        ...appState,
        exportBackground: true,
        exportWithDarkMode: false,
      },
      files: files as any,
      maxWidthOrHeight: 200,
    } as any);

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// ─── Excalidraw canvas ───────────────────────────────────────────────

function ExcalidrawCanvas({
  drawing,
  onAutoSave,
  onThumbnailGenerated,
  isSaving,
  showSaved,
  onTitleChange,
  visibilitySlot,
}: {
  drawing: Drawing;
  onAutoSave: (content: Record<string, unknown>) => void;
  onThumbnailGenerated: (thumbnailUrl: string) => void;
  isSaving: boolean;
  showSaved?: boolean;
  onTitleChange: (title: string) => void;
  visibilitySlot?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const [excalidrawApi, setExcalidrawApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const [isPresenting, setIsPresenting] = useState(false);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const theme = useSettingsStore((s) => s.theme);
  const { gridMode, snapToGrid, defaultBackground } = useDrawSettingsStore();
  const isInitialLoadRef = useRef(true);
  const thumbnailTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onThumbnailRef = useRef(onThumbnailGenerated);
  onThumbnailRef.current = onThumbnailGenerated;

  // Library persistence
  useHandleLibrary({ excalidrawAPI: excalidrawApi, adapter: libraryAdapter } as any);

  // Determine effective theme for Excalidraw
  const effectiveTheme = useMemo(() => {
    if (theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return theme;
  }, [theme]);

  // Map setting value to Excalidraw viewBackgroundColor
  const BG_COLOR_MAP: Record<string, string> = { white: '#ffffff', light: '#f5f5f5', dark: '#1e1e1e' };
  const defaultBgColor = BG_COLOR_MAP[defaultBackground] || '#ffffff';

  // Parse initial data from drawing content
  const initialData = useMemo(() => {
    const content = drawing.content as Record<string, unknown> | null;
    if (!content) {
      return {
        appState: {
          theme: effectiveTheme,
          gridModeEnabled: gridMode,
          objectsSnapModeEnabled: snapToGrid,
          viewBackgroundColor: defaultBgColor,
        },
      };
    }
    const savedAppState = (content.appState as Record<string, unknown>) || {};
    return {
      elements: (content.elements as unknown[]) || [],
      appState: {
        ...savedAppState,
        theme: effectiveTheme,
        gridModeEnabled: savedAppState.gridModeEnabled ?? gridMode,
        objectsSnapModeEnabled: savedAppState.objectsSnapModeEnabled ?? snapToGrid,
        viewBackgroundColor: savedAppState.viewBackgroundColor ?? defaultBgColor,
      },
      files: (content.files as Record<string, unknown>) || undefined,
    };
  }, [drawing.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup thumbnail timer on unmount
  useEffect(() => {
    return () => {
      if (thumbnailTimerRef.current) clearTimeout(thumbnailTimerRef.current);
    };
  }, []);

  // Presentation mode: listen for fullscreen changes
  useEffect(() => {
    const handler = () => {
      if (!document.fullscreenElement) {
        setIsPresenting(false);
      }
    };
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const handlePresent = useCallback(async () => {
    try {
      if (canvasContainerRef.current) {
        await canvasContainerRef.current.requestFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
      setIsPresenting(true);
    } catch {
      // Fullscreen not supported or denied
    }
  }, []);

  const handleExitPresent = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch {
      // ignore
    }
    setIsPresenting(false);
  }, []);

  const handleChange = useCallback(
    (elements: readonly unknown[], appState: Record<string, unknown>, files: unknown) => {
      // Skip the initial load callback from Excalidraw
      if (isInitialLoadRef.current) {
        isInitialLoadRef.current = false;
        return;
      }

      const persistedAppState = pickAppState(appState);
      onAutoSave({
        elements: elements as unknown as Record<string, unknown>[],
        appState: persistedAppState,
        files: files || {},
      });

      // Debounced thumbnail generation (less frequent than auto-save)
      if (thumbnailTimerRef.current) clearTimeout(thumbnailTimerRef.current);
      thumbnailTimerRef.current = setTimeout(async () => {
        const dataUrl = await generateThumbnailDataUrl(elements, appState, files);
        if (dataUrl) onThumbnailRef.current(dataUrl);
      }, THUMBNAIL_DEBOUNCE_MS);
    },
    [onAutoSave],
  );

  return (
    <div ref={canvasContainerRef} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', background: isPresenting ? '#fff' : undefined }}>
      {!isPresenting && (
        <>
          <EditableTitle
            title={drawing.title}
            onChange={onTitleChange}
            isSaving={isSaving}
            showSaved={showSaved}
            excalidrawApi={excalidrawApi}
            presenceSlot={<PresenceAvatars appId="draw" recordId={drawing.id} />}
            visibilitySlot={visibilitySlot}
            presentSlot={
              <IconButton
                icon={<Maximize size={14} />}
                label={t('draw.present')}
                tooltip
                tooltipSide="bottom"
                size={26}
                onClick={handlePresent}
              />
            }
          />
          <SmartButtonBar appId="draw" recordId={drawing.id} />
        </>
      )}
      <div style={{ flex: 1, position: 'relative' }}>
        <Excalidraw
          excalidrawAPI={(api: ExcalidrawImperativeAPI) => {
            setExcalidrawApi(api);
          }}
          initialData={initialData as any}
          theme={effectiveTheme}
          onChange={handleChange as any}
          UIOptions={{
            canvasActions: {
              loadScene: false,
            },
          }}
        />
        {/* Exit presentation button */}
        {isPresenting && (
          <button
            onClick={handleExitPresent}
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              zIndex: 999,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              background: 'rgba(0,0,0,0.6)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--font-size-sm)',
              fontFamily: 'var(--font-family)',
              cursor: 'pointer',
              opacity: 0.7,
              transition: 'opacity 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.7'; }}
          >
            <Minimize size={14} />
            {t('draw.exitPresent')}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Draw page ───────────────────────────────────────────────────────

export function DrawPage() {
  useDrawSettingsSync();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [selectedId, setSelectedId] = useState<string | undefined>(id);
  const { data: drawing, isLoading } = useDrawing(selectedId);
  const { data: listData } = useDrawingList();
  const { autoSaveInterval } = useDrawSettingsStore();
  const { save, isSaving, isSuccess: isSaveSuccess } = useAutoSaveDrawing(autoSaveInterval);
  const createDrawing = useCreateDrawing();
  const updateDrawing = useUpdateDrawing();
  const updateVisibility = useUpdateDrawingVisibility();
  const { account } = useAuthStore();
  const [showTemplates, setShowTemplates] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const { openSettings } = useUIStore();

  // "Saved" indicator auto-dismiss
  const [showSaved, setShowSaved] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (isSaveSuccess && !isSaving) {
      setShowSaved(true);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setShowSaved(false), 2000);
    }
  }, [isSaveSuccess, isSaving]);
  useEffect(() => {
    return () => { if (savedTimerRef.current) clearTimeout(savedTimerRef.current); };
  }, []);

  // Sync selectedId with URL param when it changes (browser back/forward)
  useEffect(() => {
    if (id && id !== selectedId) {
      setSelectedId(id);
    }
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-select first drawing when none is selected
  useEffect(() => {
    if (!selectedId && listData?.drawings && listData.drawings.length > 0) {
      const first = listData.drawings[0];
      setSelectedId(first.id);
      navigate(`/draw/${first.id}`, { replace: true });
    }
  }, [selectedId, listData, navigate]);

  const handleSelect = useCallback(
    (drawingId: string) => {
      setSelectedId(drawingId);
      navigate(`/draw/${drawingId}`, { replace: true });
    },
    [navigate],
  );

  const handleAutoSave = useCallback(
    (content: Record<string, unknown>) => {
      if (selectedId) {
        save(selectedId, { content });
      }
    },
    [selectedId, save],
  );

  const handleTitleChange = useCallback(
    (title: string) => {
      if (selectedId) {
        save(selectedId, { title });
      }
    },
    [selectedId, save],
  );

  const handleThumbnailGenerated = useCallback(
    (thumbnailUrl: string) => {
      if (selectedId) {
        updateDrawing.mutate({ id: selectedId, thumbnailUrl });
      }
    },
    [selectedId, updateDrawing],
  );

  const handleCreateFromTemplate = useCallback(
    (title: string, templateElements?: unknown[]) => {
      let content: Record<string, unknown> | undefined;
      if (templateElements) {
        try {
          const elements = convertToExcalidrawElements(templateElements as any);
          content = { elements, appState: {}, files: {} };
        } catch {
          content = undefined;
        }
      }
      createDrawing.mutate(
        { title, content: content as any },
        {
          onSuccess: (d) => {
            handleSelect(d.id);
          },
        },
      );
    },
    [createDrawing, handleSelect],
  );

  const handleCreateNew = useCallback(() => {
    setShowTemplates(true);
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        width: '100%',
        background: 'var(--color-bg-primary)',
        fontFamily: 'var(--font-family)',
      }}
    >
      <DrawSidebar
        selectedId={selectedId}
        onSelect={handleSelect}
        onNewFromTemplate={() => setShowTemplates(true)}
        onOpenSettings={() => openSettings('draw')}
        isCreating={createDrawing.isPending}
      />

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {!selectedId ? (
          <EmptyState onCreate={handleCreateNew} />
        ) : isLoading ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-text-tertiary)',
              fontFamily: 'var(--font-family)',
              fontSize: 'var(--font-size-md)',
            }}
          >
            {t('common.loading')}
          </div>
        ) : drawing ? (
          <ExcalidrawCanvas
            key={drawing.id}
            drawing={drawing}
            onAutoSave={handleAutoSave}
            onThumbnailGenerated={handleThumbnailGenerated}
            isSaving={isSaving}
            showSaved={showSaved}
            onTitleChange={handleTitleChange}
            visibilitySlot={
              <VisibilityToggle
                visibility={(drawing.visibility as 'private' | 'team') || 'private'}
                onToggle={(v) => updateVisibility.mutate({ id: drawing.id, visibility: v })}
                disabled={drawing.userId !== account?.userId}
              />
            }
          />
        ) : (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-text-tertiary)',
              fontFamily: 'var(--font-family)',
              fontSize: 'var(--font-size-md)',
            }}
          >
            {t('draw.noDrawings')}
          </div>
        )}
      </div>

      {/* Template picker modal */}
      <TemplatePicker
        open={showTemplates}
        onClose={() => setShowTemplates(false)}
        onCreate={handleCreateFromTemplate}
      />

      {/* Settings modal */}
      <DrawSettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
      />

      <style>{`
        @keyframes draw-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
