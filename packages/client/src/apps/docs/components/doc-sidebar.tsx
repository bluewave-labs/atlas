import { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Search,
  Clock,
  Star,
  StarOff,
  Trash2,
  LayoutTemplate,
  Upload,
  Settings2,
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { ConfirmDialog } from '../../../components/ui/confirm-dialog';
import {
  useDocumentList,
  useCreateDocument,
  useDeleteDocument,
  useRestoreDocument,
  useDuplicateDocument,
  useMoveDocument,
} from '../hooks';
import { useDocSettingsStore } from '../settings-store';
import { useToastStore } from '../../../stores/toast-store';
import { useAppActions } from '../../../hooks/use-app-permissions';
import { useAuthStore } from '../../../stores/auth-store';
import { useNavigate } from 'react-router-dom';
import { urlForCategory } from '../../../config/settings-url';
import { AppSidebar, SidebarItem } from '../../../components/layout/app-sidebar';
import { useDocFavoritesAndRecent } from './sidebar/use-doc-favorites-recent';
import { QuickLink } from './sidebar/quick-link';
import { FlatDocRow } from './sidebar/flat-doc-row';
import { TreeNode } from './sidebar/tree-node';
import { SidebarButton, EmptySidebarMsg, LoadingPlaceholder, TrashView, filterTree } from './sidebar/sidebar-helpers';

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
  const { canCreate, canDelete, canDeleteOwn } = useAppActions('docs');
  const currentUserId = useAuthStore((s) => s.account?.userId);
  const navigate = useNavigate();
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
    createDoc.mutate({ title: t('docs.untitled') }, {
      onSuccess: (doc) => {
        onSelect(doc.id);
      },
    });
  }, [createDoc, onSelect]);

  const handleNewSubPage = useCallback(
    (parentId: string) => {
      createDoc.mutate({ title: t('docs.untitled'), parentId }, {
        onSuccess: (doc) => {
          onSelect(doc.id);
        },
      });
    },
    [createDoc, onSelect],
  );

  const { addToast } = useToastStore();
  const { t } = useTranslation();
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const lastDeletedRef = useRef<string | null>(null);

  const handleDelete = useCallback(
    (id: string) => {
      setDeleteConfirmId(id);
    },
    [],
  );

  const confirmDelete = useCallback(() => {
    if (!deleteConfirmId) return;
    const id = deleteConfirmId;
    lastDeletedRef.current = id;
    deleteDoc.mutate(id, {
      onSuccess: () => {
        addToast({ type: 'success', message: t('docs.deleted') });
        if (selectedId === id) onSelect('');
      },
    });
    setDeleteConfirmId(null);
  }, [deleteConfirmId, deleteDoc, addToast, t, selectedId, onSelect]);

  // Shift+Z to restore last deleted
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.shiftKey && e.key === 'Z' && lastDeletedRef.current) {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
        e.preventDefault();
        restoreDoc.mutate(lastDeletedRef.current, {
          onSuccess: () => {
            addToast({ type: 'success', message: t('docs.restored') });
            lastDeletedRef.current = null;
          },
        });
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [restoreDoc, addToast, t]);

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

  // Permission helper: admin deletes any; editor deletes own; viewer none.
  const canDeleteDoc = useCallback(
    (id: string) => {
      if (canDelete) return true;
      if (!canDeleteOwn) return false;
      const doc = allDocs.find((d) => d.id === id);
      return !!doc && doc.userId === currentUserId;
    },
    [canDelete, canDeleteOwn, allDocs, currentUserId],
  );

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
        placeholder={t('docs.search')}
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

  const footerContent = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
      }}
    >
      <SidebarItem
        label={t('docs.settings', 'Settings')}
        icon={<Settings2 size={14} />}
        onClick={() => navigate(urlForCategory('docs'))}
      />
      {view === 'tree' && canCreate && (
        <>
          <Button
            variant="ghost"
            size="sm"
            icon={<Plus size={14} />}
            onClick={handleNewPage}
            disabled={createDoc.isPending}
            style={{ width: '100%', justifyContent: 'flex-start', color: 'var(--color-text-tertiary)' }}
          >
            {t('docs.newPage')}
          </Button>
          {onNewFromTemplate && (
            <Button
              variant="ghost"
              size="sm"
              icon={<LayoutTemplate size={14} />}
              onClick={onNewFromTemplate}
              style={{ width: '100%', justifyContent: 'flex-start', color: 'var(--color-text-tertiary)' }}
            >
              {t('docs.fromTemplate')}
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
              {t('docs.importDocument')}
            </Button>
          )}
        </>
      )}
    </div>
  );

  return (
    <>
    <AppSidebar
      storageKey="atlas_docs_sidebar"
      title={t('docs.title')}
      search={searchBar}
      footer={footerContent}
    >
      {/* Quick links */}
      <div style={{ padding: '0 0 0 0' }}>
        <QuickLink
          icon={<Clock size={14} />}
          label={t('docs.recentlyViewed')}
          active={view === 'recent'}
          onClick={() => setView(view === 'recent' ? 'tree' : 'recent')}
        />
        <QuickLink
          icon={<Star size={14} />}
          label={t('docs.favorites')}
          active={view === 'favorites'}
          onClick={() => setView(view === 'favorites' ? 'tree' : 'favorites')}
          badge={favoriteDocs.length > 0 ? favoriteDocs.length : undefined}
        />
        <QuickLink
          icon={<Trash2 size={14} />}
          label={t('docs.trash')}
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
            {t('docs.private')}
          </span>
          {canCreate && (
            <SidebarButton
              icon={<Plus size={13} />}
              onClick={handleNewPage}
              tooltip={t('docs.newPage')}
              disabled={createDoc.isPending}
            />
          )}
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
            {view === 'favorites' ? t('docs.favorites') : view === 'recent' ? t('docs.recentlyViewed') : t('docs.trash')}
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
            <EmptySidebarMsg>{t('docs.noResults', { query: searchQuery })}</EmptySidebarMsg>
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
                canCreate={canCreate}
                canDeleteNode={canDeleteDoc}
              />
            ))
          )
        ) : view === 'favorites' ? (
          /* Favorites view */
          favoriteDocs.length === 0 ? (
            <EmptySidebarMsg>{t('docs.noFavorites')}</EmptySidebarMsg>
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
                    tooltip={t('docs.removeFromFavorites')}
                  />
                }
              />
            ))
          )
        ) : view === 'recent' ? (
          /* Recently viewed */
          recentDocs.length === 0 ? (
            <EmptySidebarMsg>{t('docs.noRecentDocs')}</EmptySidebarMsg>
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

    <ConfirmDialog
      open={!!deleteConfirmId}
      onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}
      title={t('docs.deleteConfirmTitle')}
      description={t('docs.deleteConfirmDesc')}
      confirmLabel={t('docs.deleteConfirmAction')}
      destructive
      onConfirm={confirmDelete}
    />
    </>
  );
}
