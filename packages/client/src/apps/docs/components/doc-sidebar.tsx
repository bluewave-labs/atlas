import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Plus,
  ChevronRight,
  FileText,
  MoreHorizontal,
  Trash2,
  Copy,
  Search,
  Clock,
  Star,
  RotateCcw,
  StarOff,
  LayoutTemplate,
  Upload,
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { IconButton } from '../../../components/ui/icon-button';
import {
  useDocumentList,
  useCreateDocument,
  useDeleteDocument,
  useRestoreDocument,
  useDuplicateDocument,
  useMoveDocument,
} from '../hooks';
import { useDocSettingsStore } from '../settings-store';
import type { DocumentTreeNode } from '@atlasmail/shared';
import { AppSidebar } from '../../../components/layout/app-sidebar';

// ─── Server-backed helpers for favorites & recently viewed ──────────────

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api-client';
import { queryKeys } from '../../../config/query-keys';

const MAX_RECENT = 10;

function useDocFavoritesAndRecent() {
  const queryClient = useQueryClient();

  const { data: serverSettings } = useQuery({
    queryKey: queryKeys.settings.all,
    queryFn: async () => {
      const { data } = await api.get('/settings');
      return data.data as Record<string, unknown> | null;
    },
    staleTime: 60_000,
  });

  const mutation = useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      const { data } = await api.put('/settings', patch);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.all });
    },
  });

  const favorites: string[] = Array.isArray(serverSettings?.docFavorites)
    ? serverSettings.docFavorites as string[]
    : [];

  const recent: string[] = Array.isArray(serverSettings?.docRecent)
    ? serverSettings.docRecent as string[]
    : [];

  const setFavorites = (ids: string[]) => {
    queryClient.setQueryData(queryKeys.settings.all, (old: Record<string, unknown> | null | undefined) => ({
      ...(old ?? {}),
      docFavorites: ids,
    }));
    mutation.mutate({ docFavorites: ids });
  };

  const addRecentlyViewed = (id: string) => {
    const next = [id, ...recent.filter((r) => r !== id)].slice(0, MAX_RECENT);
    queryClient.setQueryData(queryKeys.settings.all, (old: Record<string, unknown> | null | undefined) => ({
      ...(old ?? {}),
      docRecent: next,
    }));
    mutation.mutate({ docRecent: next });
  };

  return { favorites, recent, setFavorites, addRecentlyViewed };
}

// ─── Sidebar view modes ─────────────────────────────────────────────────

type SidebarView = 'tree' | 'favorites' | 'recent' | 'trash';

// ─── Sidebar ────────────────────────────────────────────────────────────

interface DocSidebarProps {
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  onNewFromTemplate?: () => void;
  onImport?: () => void;
}


export function DocSidebar({ selectedId, onSelect, onNewFromTemplate, onImport }: DocSidebarProps) {
  const { data, isLoading } = useDocumentList();
  const createDoc = useCreateDocument();
  const deleteDoc = useDeleteDocument();
  const restoreDoc = useRestoreDocument();
  const duplicateDoc = useDuplicateDocument();
  const moveDoc = useMoveDocument();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [view, setView] = useState<SidebarView>(useDocSettingsStore.getState().sidebarDefault);
  const { favorites, recent: recentIds, setFavorites: setServerFavorites, addRecentlyViewed } = useDocFavoritesAndRecent();
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // Track recently viewed when selection changes
  useEffect(() => {
    if (selectedId) {
      addRecentlyViewed(selectedId);
    }
  }, [selectedId]);

  const handleNewPage = useCallback(() => {
    createDoc.mutate({ title: 'Untitled' }, {
      onSuccess: (doc) => {
        onSelect(doc.id);
      },
    });
  }, [createDoc, onSelect]);

  const handleNewSubPage = useCallback(
    (parentId: string) => {
      createDoc.mutate({ title: 'Untitled', parentId }, {
        onSuccess: (doc) => {
          onSelect(doc.id);
        },
      });
    },
    [createDoc, onSelect],
  );

  const handleDelete = useCallback(
    (id: string) => {
      deleteDoc.mutate(id);
    },
    [deleteDoc],
  );

  const handleRestore = useCallback(
    (id: string) => {
      restoreDoc.mutate(id);
    },
    [restoreDoc],
  );

  const handleDuplicate = useCallback(
    (id: string) => {
      duplicateDoc.mutate(id, {
        onSuccess: (doc) => {
          onSelect(doc.id);
        },
      });
    },
    [duplicateDoc, onSelect],
  );

  const handleMoveDocument = useCallback(
    (draggedId: string, targetParentId: string) => {
      moveDoc.mutate({ id: draggedId, parentId: targetParentId, sortOrder: 0 });
    },
    [moveDoc],
  );

  const toggleFavorite = useCallback(
    (id: string) => {
      const next = favorites.includes(id)
        ? favorites.filter((f) => f !== id)
        : [...favorites, id];
      setServerFavorites(next);
    },
    [favorites, setServerFavorites],
  );

  const tree = data?.tree ?? [];
  const allDocs = data?.documents ?? [];

  // Filter tree by search
  const filteredTree = searchQuery.trim()
    ? filterTree(tree, searchQuery.toLowerCase())
    : tree;

  // Build favorites list from flat docs
  const favoriteDocs = allDocs.filter((d) => favorites.includes(d.id));

  // Build recently viewed list
  const recentDocs = recentIds
    .map((id) => allDocs.find((d) => d.id === id))
    .filter(Boolean) as typeof allDocs;

  const searchBar = (
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
        onFocus={() => { setSearchFocused(true); setView('tree'); }}
        onBlur={() => setSearchFocused(false)}
        placeholder="Search"
        style={{
          flex: 1,
          border: 'none',
          outline: 'none',
          background: 'transparent',
          fontSize: 12,
          fontFamily: 'var(--font-family)',
          color: 'var(--color-text-primary)',
          padding: 0,
        }}
      />
    </div>
  );

  const footerContent = view === 'tree' ? (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
      }}
    >
      <Button
        variant="ghost"
        size="sm"
        icon={<Plus size={14} />}
        onClick={handleNewPage}
        disabled={createDoc.isPending}
        style={{ width: '100%', justifyContent: 'flex-start', color: 'var(--color-text-tertiary)' }}
      >
        New page
      </Button>
      {onNewFromTemplate && (
        <Button
          variant="ghost"
          size="sm"
          icon={<LayoutTemplate size={14} />}
          onClick={onNewFromTemplate}
          style={{ width: '100%', justifyContent: 'flex-start', color: 'var(--color-text-tertiary)' }}
        >
          From template
        </Button>
      )}
      {onImport && (
        <Button
          variant="ghost"
          size="sm"
          icon={<Upload size={14} />}
          onClick={onImport}
          style={{ width: '100%', justifyContent: 'flex-start', color: 'var(--color-text-tertiary)' }}
        >
          Import document
        </Button>
      )}
    </div>
  ) : undefined;

  return (
    <AppSidebar
      storageKey="atlas_docs_sidebar"
      title="Write"
      search={searchBar}
      footer={footerContent}
    >
      {/* Quick links */}
      <div style={{ padding: '0 0 0 0' }}>
        <QuickLink
          icon={<Clock size={14} />}
          label="Recently viewed"
          active={view === 'recent'}
          onClick={() => setView(view === 'recent' ? 'tree' : 'recent')}
        />
        <QuickLink
          icon={<Star size={14} />}
          label="Favorites"
          active={view === 'favorites'}
          onClick={() => setView(view === 'favorites' ? 'tree' : 'favorites')}
          badge={favoriteDocs.length > 0 ? favoriteDocs.length : undefined}
        />
        <QuickLink
          icon={<Trash2 size={14} />}
          label="Trash"
          active={view === 'trash'}
          onClick={() => setView(view === 'trash' ? 'tree' : 'trash')}
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

      {/* Section header */}
      {view === 'tree' && (
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
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--color-text-tertiary)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Private
          </span>
          <SidebarButton
            icon={<Plus size={13} />}
            onClick={handleNewPage}
            tooltip="New page"
            disabled={createDoc.isPending}
          />
        </div>
      )}

      {view !== 'tree' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '2px 4px',
            marginBottom: 2,
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--color-text-tertiary)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            {view === 'favorites' ? 'Favorites' : view === 'recent' ? 'Recently viewed' : 'Trash'}
          </span>
        </div>
      )}

      {/* Content area */}
      <div role="tree">
        {isLoading ? (
          <LoadingPlaceholder />
        ) : view === 'tree' ? (
          /* Tree view */
          filteredTree.length === 0 && searchQuery.trim() ? (
            <EmptySidebarMsg>No results for "{searchQuery}"</EmptySidebarMsg>
          ) : (
            filteredTree.map((node) => (
              <TreeNode
                key={node.id}
                node={node}
                depth={0}
                selectedId={selectedId}
                onSelect={onSelect}
                onNewSubPage={handleNewSubPage}
                onMoveDocument={handleMoveDocument}
                onDelete={handleDelete}
                onDuplicate={handleDuplicate}
                onToggleFavorite={toggleFavorite}
                isFavorite={favorites.includes(node.id)}
                allFavorites={favorites}
                dragOverId={dragOverId}
                onDragOverChange={setDragOverId}
              />
            ))
          )
        ) : view === 'favorites' ? (
          /* Favorites view */
          favoriteDocs.length === 0 ? (
            <EmptySidebarMsg>No favorites yet. Star a page to add it here.</EmptySidebarMsg>
          ) : (
            favoriteDocs.map((doc) => (
              <FlatDocRow
                key={doc.id}
                id={doc.id}
                title={doc.title}
                icon={doc.icon}
                isSelected={doc.id === selectedId}
                onClick={() => onSelect(doc.id)}
                action={
                  <SidebarButton
                    icon={<StarOff size={12} />}
                    onClick={() => toggleFavorite(doc.id)}
                    tooltip="Remove from favorites"
                  />
                }
              />
            ))
          )
        ) : view === 'recent' ? (
          /* Recently viewed */
          recentDocs.length === 0 ? (
            <EmptySidebarMsg>No recently viewed documents.</EmptySidebarMsg>
          ) : (
            recentDocs.map((doc) => (
              <FlatDocRow
                key={doc.id}
                id={doc.id}
                title={doc.title}
                icon={doc.icon}
                isSelected={doc.id === selectedId}
                onClick={() => onSelect(doc.id)}
              />
            ))
          )
        ) : (
          /* Trash view */
          <TrashView
            selectedId={selectedId}
            onSelect={onSelect}
            onRestore={handleRestore}
          />
        )}
      </div>
    </AppSidebar>
  );
}

// ─── Trash view ─────────────────────────────────────────────────────────

function TrashView({
  selectedId,
  onSelect,
  onRestore,
}: {
  selectedId?: string;
  onSelect: (id: string) => void;
  onRestore: (id: string) => void;
}) {
  const { data } = useDocumentList(true); // include archived
  const allDocs = data?.documents ?? [];
  const archivedDocs = allDocs.filter((d) => d.isArchived);

  if (archivedDocs.length === 0) {
    return <EmptySidebarMsg>Trash is empty.</EmptySidebarMsg>;
  }

  return (
    <>
      {archivedDocs.map((doc) => (
        <FlatDocRow
          key={doc.id}
          id={doc.id}
          title={doc.title}
          icon={doc.icon}
          isSelected={doc.id === selectedId}
          onClick={() => onSelect(doc.id)}
          muted
          action={
            <SidebarButton
              icon={<RotateCcw size={12} />}
              onClick={() => onRestore(doc.id)}
              tooltip="Restore"
            />
          }
        />
      ))}
    </>
  );
}

// ─── Flat doc row (for favorites, recent, trash) ────────────────────────

function FlatDocRow({
  id,
  title,
  icon,
  isSelected,
  onClick,
  action,
  muted,
}: {
  id: string;
  title: string;
  icon: string | null;
  isSelected: boolean;
  onClick: () => void;
  action?: React.ReactNode;
  muted?: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 8px',
        height: 28,
        cursor: 'pointer',
        borderRadius: 'var(--radius-sm)',
        margin: '0 4px',
        background: isSelected
          ? 'var(--color-surface-selected)'
          : hovered
            ? 'var(--color-surface-hover)'
            : 'transparent',
        opacity: muted ? 0.6 : 1,
      }}
    >
      <span style={{ fontSize: 14, width: 20, textAlign: 'center', flexShrink: 0 }}>
        {icon || <FileText size={14} style={{ color: 'var(--color-text-tertiary)' }} />}
      </span>
      <span
        style={{
          flex: 1,
          fontSize: 13,
          color: isSelected ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
          fontWeight: isSelected ? 500 : 400,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          minWidth: 0,
        }}
      >
        {title || 'Untitled'}
      </span>
      {hovered && action && (
        <div style={{ flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
          {action}
        </div>
      )}
    </div>
  );
}

// ─── QuickLink ──────────────────────────────────────────────────────────

function QuickLink({
  icon,
  label,
  onClick,
  active,
  badge,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  badge?: number;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      icon={icon}
      onClick={onClick}
      style={{
        width: '100%',
        justifyContent: 'flex-start',
        color: active ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
        background: active ? 'var(--color-surface-selected)' : 'transparent',
        fontSize: 13,
      }}
    >
      <span style={{ flex: 1, textAlign: 'left' }}>{label}</span>
      {badge !== undefined && (
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: 'var(--color-text-tertiary)',
            background: 'var(--color-surface-hover)',
            borderRadius: 8,
            padding: '1px 5px',
          }}
        >
          {badge}
        </span>
      )}
    </Button>
  );
}

// ─── SidebarButton ──────────────────────────────────────────────────────

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
      label={tooltip ?? ''}
      size={22}
      tooltip={!!tooltip}
      disabled={disabled}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{ opacity: disabled ? 0.4 : 1 }}
    />
  );
}

// ─── EmptySidebarMsg ────────────────────────────────────────────────────

function EmptySidebarMsg({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: '16px 12px',
        textAlign: 'center',
        color: 'var(--color-text-tertiary)',
        fontSize: 12,
        lineHeight: 1.5,
      }}
    >
      {children}
    </div>
  );
}

// ─── LoadingPlaceholder ─────────────────────────────────────────────────

function LoadingPlaceholder() {
  return (
    <div style={{ padding: '8px' }}>
      {[120, 90, 140, 80, 110].map((w, i) => (
        <div
          key={i}
          style={{
            height: 28,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '0 8px',
          }}
        >
          <div style={{ width: 16, height: 16, borderRadius: 3, background: 'var(--color-surface-hover)' }} />
          <div style={{ width: w, height: 10, borderRadius: 3, background: 'var(--color-surface-hover)' }} />
        </div>
      ))}
    </div>
  );
}

// ─── TreeNode ───────────────────────────────────────────────────────────

interface TreeNodeProps {
  node: DocumentTreeNode;
  depth: number;
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  onNewSubPage: (parentId: string) => void;
  onMoveDocument: (draggedId: string, targetParentId: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  isFavorite: boolean;
  allFavorites: string[];
  dragOverId: string | null;
  onDragOverChange: (id: string | null) => void;
}

function TreeNode({
  node,
  depth,
  selectedId,
  onSelect,
  onNewSubPage,
  onMoveDocument,
  onDelete,
  onDuplicate,
  onToggleFavorite,
  isFavorite,
  allFavorites,
  dragOverId,
  onDragOverChange,
}: TreeNodeProps) {
  const [expanded, setExpanded] = useState(depth < 1);
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const justDroppedRef = useRef(false);
  const isSelected = node.id === selectedId;
  const hasChildren = node.children.length > 0;
  const isDragOver = dragOverId === node.id;

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  return (
    <div>
      <div
        role="treeitem"
        aria-selected={isSelected}
        aria-expanded={hasChildren ? expanded : undefined}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('text/plain', node.id);
          e.dataTransfer.effectAllowed = 'move';
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          onDragOverChange(node.id);
        }}
        onDragLeave={() => {
          if (dragOverId === node.id) onDragOverChange(null);
        }}
        onDrop={(e) => {
          e.preventDefault();
          onDragOverChange(null);
          const draggedId = e.dataTransfer.getData('text/plain');
          if (draggedId && draggedId !== node.id) {
            onMoveDocument(draggedId, node.id);
            setExpanded(true);
          }
          // Suppress stale click events that fire after a drop
          justDroppedRef.current = true;
          setTimeout(() => { justDroppedRef.current = false; }, 100);
        }}
        onDragEnd={() => {
          setHovered(false);
          setMenuOpen(false);
          onDragOverChange(null);
          justDroppedRef.current = true;
          setTimeout(() => { justDroppedRef.current = false; }, 100);
        }}
        onMouseEnter={() => { if (!justDroppedRef.current) setHovered(true); }}
        onMouseLeave={() => { setHovered(false); if (!menuOpen) setMenuOpen(false); }}
        onClick={() => { if (!justDroppedRef.current) onSelect(node.id); }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 0,
          paddingLeft: 4 + depth * 16,
          paddingRight: 4,
          height: 28,
          cursor: 'pointer',
          borderRadius: 'var(--radius-sm)',
          margin: '0 4px',
          background: isSelected
            ? 'var(--color-surface-selected)'
            : isDragOver
              ? 'color-mix(in srgb, var(--color-accent-primary, #13715B) 10%, transparent)'
              : hovered
                ? 'var(--color-surface-hover)'
                : 'transparent',
          transition: 'background 0.1s ease',
          borderTop: isDragOver ? '2px solid var(--color-accent-primary, #13715B)' : '2px solid transparent',
        }}
      >
        {/* Expand toggle */}
        <IconButton
          icon={<ChevronRight size={12} />}
          label={expanded ? 'Collapse' : 'Expand'}
          size={20}
          tooltip={false}
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
          style={{
            visibility: hasChildren ? 'visible' : 'hidden',
            transition: 'transform 0.12s ease',
            transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
          }}
        />

        {/* Icon */}
        <span
          style={{
            fontSize: 14,
            lineHeight: 1,
            width: 20,
            textAlign: 'center',
            flexShrink: 0,
          }}
        >
          {node.icon || (
            <FileText size={14} style={{ color: 'var(--color-text-tertiary)', verticalAlign: 'middle' }} />
          )}
        </span>

        {/* Title */}
        <span
          style={{
            flex: 1,
            marginLeft: 4,
            fontSize: 13,
            color: isSelected ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
            fontWeight: isSelected ? 500 : 400,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            minWidth: 0,
          }}
        >
          {node.title || 'Untitled'}
        </span>

        {/* Favorite star indicator */}
        {isFavorite && !hovered && (
          <Star
            size={10}
            fill="var(--color-text-tertiary)"
            style={{ color: 'var(--color-text-tertiary)', flexShrink: 0, marginLeft: 2 }}
          />
        )}

        {/* Hover actions */}
        {hovered && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              flexShrink: 0,
              marginLeft: 4,
            }}
          >
            <SidebarButton
              icon={<Plus size={12} />}
              onClick={() => { onNewSubPage(node.id); }}
              tooltip="Add sub-page"
            />
            <div ref={menuRef} style={{ position: 'relative' }}>
              <SidebarButton
                icon={<MoreHorizontal size={12} />}
                onClick={() => setMenuOpen((v) => !v)}
                tooltip="More actions"
              />
              {menuOpen && (
                <ContextMenu
                  onDelete={() => { onDelete(node.id); setMenuOpen(false); }}
                  onDuplicate={() => { onDuplicate(node.id); setMenuOpen(false); }}
                  onToggleFavorite={() => { onToggleFavorite(node.id); setMenuOpen(false); }}
                  isFavorite={isFavorite}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Children */}
      {expanded && hasChildren && (
        <div role="group">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              onNewSubPage={onNewSubPage}
              onMoveDocument={onMoveDocument}
              onDelete={onDelete}
              onDuplicate={onDuplicate}
              onToggleFavorite={onToggleFavorite}
              isFavorite={allFavorites.includes(child.id)}
              allFavorites={allFavorites}
              dragOverId={dragOverId}
              onDragOverChange={onDragOverChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── ContextMenu ────────────────────────────────────────────────────────

function ContextMenu({
  onDelete,
  onDuplicate,
  onToggleFavorite,
  isFavorite,
}: {
  onDelete: () => void;
  onDuplicate: () => void;
  onToggleFavorite: () => void;
  isFavorite: boolean;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        top: '100%',
        right: 0,
        marginTop: 2,
        zIndex: 100,
        minWidth: 180,
        background: 'var(--color-bg-elevated)',
        border: '1px solid var(--color-border-primary)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-lg)',
        padding: 4,
        fontFamily: 'var(--font-family)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <MenuButton
        icon={<Star size={14} />}
        label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        onClick={onToggleFavorite}
      />
      <MenuButton icon={<Copy size={14} />} label="Duplicate" onClick={onDuplicate} />
      <div style={{ height: 1, background: 'var(--color-border-primary)', margin: '4px 0' }} />
      <MenuButton icon={<Trash2 size={14} />} label="Delete" onClick={onDelete} danger />
    </div>
  );
}

function MenuButton({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <Button
      variant={danger ? 'danger' : 'ghost'}
      size="sm"
      icon={icon}
      onClick={onClick}
      style={{
        width: '100%',
        justifyContent: 'flex-start',
        color: danger ? 'var(--color-status-error)' : 'var(--color-text-secondary)',
        border: 'none',
      }}
    >
      {label}
    </Button>
  );
}

// ─── Tree filter helper ─────────────────────────────────────────────────

function filterTree(tree: DocumentTreeNode[], query: string): DocumentTreeNode[] {
  const result: DocumentTreeNode[] = [];
  for (const node of tree) {
    const matchesTitle = node.title.toLowerCase().includes(query);
    const filteredChildren = filterTree(node.children, query);
    if (matchesTitle || filteredChildren.length > 0) {
      result.push({
        ...node,
        children: filteredChildren,
      });
    }
  }
  return result;
}
