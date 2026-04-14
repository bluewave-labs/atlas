import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  useDriveItems, useDriveBreadcrumbs, useDriveFavourites, useDriveRecent,
  useDriveTrash, useDriveUploads, useDriveSearch, useCreateFolder, useUploadFiles,
  useUpdateDriveItem, useDeleteDriveItem, useRestoreDriveItem,
  usePermanentDeleteDriveItem, useDriveStorage, useDriveFolders,
  useDuplicateDriveItem, useCopyDriveItem, useBatchDeleteDriveItems,
  useBatchMoveDriveItems, useBatchFavouriteDriveItems, useFilePreview,
  useFileVersions, useReplaceFile, useRestoreVersion, useShareLinks,
  useCreateShareLink, useDeleteShareLink, useDriveItemsByType,
  useCreateLinkedDocument, useCreateLinkedDrawing, useCreateLinkedSpreadsheet,
  useSharedWithMe, useItemShares, useShareItem, useRevokeShare,
  useFileActivity, useFileComments, useCreateFileComment, useDeleteFileComment,
  useUpdateDriveItemVisibility,
} from './hooks';
import { api } from '../../lib/api-client';
import { useToastStore } from '../../stores/toast-store';
import { ROUTES } from '../../config/routes';
import { useDriveSettingsStore, useDriveSettingsSync } from './settings-store';
import { useUIStore } from '../../stores/ui-store';
import { useAuthStore } from '../../stores/auth-store';
import { useAppActions } from '../../hooks/use-app-permissions';
import { useTenantUsers, useMyTenants } from '../../hooks/use-platform';
import { useQuery } from '@tanstack/react-query';
import type { DriveItem } from '@atlas-platform/shared';

import {
  PREVIEW_WIDTH_KEY, MIN_PREVIEW_WIDTH, MAX_PREVIEW_WIDTH, VIEW_MODE_KEY,
  TAG_COLORS, getSavedPreviewWidth, getSavedViewMode,
  matchesTypeFilter, matchesModifiedFilter, isTextPreviewable,
} from './lib/helpers';
import type { ViewMode, SidebarView, SortBy, TypeFilter, ModifiedFilter } from './lib/types';

export function useDrivePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id: folderId } = useParams<{ id: string }>();
  const addToast = useToastStore((s) => s.addToast);
  const openSettings = useUIStore((s) => s.openSettings);

  // Drive settings (persisted to server)
  useDriveSettingsSync();
  const driveSettings = useDriveSettingsStore();

  // State
  const [previewWidth, setPreviewWidth] = useState(getSavedPreviewWidth);
  const [viewMode, setViewMode] = useState<ViewMode>(() => driveSettings.defaultView as ViewMode || getSavedViewMode());
  const [sidebarView, setSidebarView] = useState<SidebarView>(() => driveSettings.sidebarDefault as SidebarView || 'files');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastClickedId, setLastClickedId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: DriveItem } | null>(null);
  const [newDropdownOpen, setNewDropdownOpen] = useState(false);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<DriveItem | null>(null);
  const [confirmPermanent, setConfirmPermanent] = useState<DriveItem | null>(null);
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [moveItem, setMoveItem] = useState<DriveItem | null>(null);
  const [moveTargetId, setMoveTargetId] = useState<string | null>(null);
  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [copyModalItem, setCopyModalItem] = useState<DriveItem | null>(null);
  const [copyTargetId, setCopyTargetId] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>(() => driveSettings.defaultSort as SortBy || 'default');
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const [modifiedFilter, setModifiedFilter] = useState<ModifiedFilter>('any');
  const [modifiedDropdownOpen, setModifiedDropdownOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState<DriveItem | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ loaded: number; total: number } | null>(null);
  const [tagModalItem, setTagModalItem] = useState<DriveItem | null>(null);
  const [tagLabel, setTagLabel] = useState('');
  const [tagColor, setTagColor] = useState(TAG_COLORS[0].hex);
  const [iconPickerItem, setIconPickerItem] = useState<DriveItem | null>(null);
  const [dragItemId, setDragItemId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [batchMoveOpen, setBatchMoveOpen] = useState(false);
  const [batchMoveTargetId, setBatchMoveTargetId] = useState<string | null>(null);
  const [shareModalItem, setShareModalItem] = useState<DriveItem | null>(null);
  const [googleDriveModalOpen, setGoogleDriveModalOpen] = useState(false);
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentBody, setCommentBody] = useState('');
  const dragCounter = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceFileInputRef = useRef<HTMLInputElement>(null);
  const [replaceTargetId, setReplaceTargetId] = useState<string | null>(null);
  const newDropdownRef = useRef<HTMLDivElement>(null);
  const sortDropdownRef = useRef<HTMLDivElement>(null);
  const typeDropdownRef = useRef<HTMLDivElement>(null);
  const modifiedDropdownRef = useRef<HTMLDivElement>(null);

  // Queries
  const currentParentId = folderId || null;
  const { data: itemsData, isLoading: itemsLoading } = useDriveItems(sidebarView === 'files' ? currentParentId : undefined, sortBy, driveSettings.sortOrder);
  const { data: breadcrumbsData } = useDriveBreadcrumbs(folderId);
  const { data: favouritesData } = useDriveFavourites();
  const { data: recentData } = useDriveRecent();
  const { data: trashData } = useDriveTrash();
  const { data: uploadsData } = useDriveUploads();
  const { data: searchData } = useDriveSearch(searchQuery);
  const { data: storageData } = useDriveStorage();
  const { data: tenantsData } = useMyTenants();
  const storageQuotaBytes = tenantsData?.[0]?.storageQuotaBytes ?? 10 * 1024 * 1024 * 1024;
  const { data: foldersData } = useDriveFolders();
  const previewFileId = previewItem && previewItem.type === 'file' && isTextPreviewable(previewItem.mimeType, previewItem.name) ? previewItem.id : undefined;
  const { data: filePreviewData, isLoading: previewLoading } = useFilePreview(previewFileId);

  // Linked resource content previews
  const linkedDocId = previewItem?.linkedResourceType === 'document' ? previewItem.linkedResourceId : undefined;
  const { data: linkedDocData } = useQuery({
    queryKey: ['docs', 'detail', linkedDocId],
    queryFn: async () => { const { data } = await api.get(`/docs/${linkedDocId}`); return data.data as { id: string; title: string; content: Record<string, unknown> | null }; },
    enabled: !!linkedDocId,
  });

  const linkedDrawingId = previewItem?.linkedResourceType === 'drawing' ? previewItem.linkedResourceId : undefined;
  const { data: linkedDrawingData } = useQuery({
    queryKey: ['drawings', 'detail', linkedDrawingId],
    queryFn: async () => { const { data } = await api.get(`/drawings/${linkedDrawingId}`); return data.data as { id: string; title: string; content: Record<string, unknown> | null }; },
    enabled: !!linkedDrawingId,
  });

  const linkedTableId = previewItem?.linkedResourceType === 'spreadsheet' ? previewItem.linkedResourceId : undefined;
  const { data: linkedTableData } = useQuery({
    queryKey: ['tables', 'detail', linkedTableId],
    queryFn: async () => { const { data } = await api.get(`/tables/${linkedTableId}`); return data.data as { id: string; title: string; columns: Array<{ id: string; name: string; type: string }>; rows: Array<Record<string, unknown>> }; },
    enabled: !!linkedTableId,
  });

  // Type filter queries
  const typeCategory = ['images', 'documents', 'videos', 'audio'].includes(sidebarView) ? sidebarView : undefined;
  const { data: typeData } = useDriveItemsByType(typeCategory);

  // Version & share queries
  const versionItemId = previewItem?.type === 'file' ? previewItem.id : undefined;
  const { data: versionsData } = useFileVersions(versionHistoryOpen ? versionItemId : undefined);
  const { data: shareLinksData } = useShareLinks(shareModalItem?.id);

  // Internal sharing queries
  const { data: sharedWithMeData } = useSharedWithMe();
  const { data: itemSharesData } = useItemShares(shareModalItem?.id ?? null);
  const tenantId = useAuthStore((s) => s.tenantId);
  const { data: tenantUsersData } = useTenantUsers(tenantId ?? undefined);

  // Mutations
  const createFolder = useCreateFolder();
  const uploadFiles = useUploadFiles();
  const updateItem = useUpdateDriveItem();
  const deleteItem = useDeleteDriveItem();
  const restoreItem = useRestoreDriveItem();
  const permanentDelete = usePermanentDeleteDriveItem();
  const duplicateItem = useDuplicateDriveItem();
  const batchDelete = useBatchDeleteDriveItems();
  const batchMove = useBatchMoveDriveItems();
  const batchFavourite = useBatchFavouriteDriveItems();
  const replaceFile = useReplaceFile();
  const restoreVersion = useRestoreVersion();
  const createShareLink = useCreateShareLink();
  const deleteShareLink = useDeleteShareLink();
  const copyItem = useCopyDriveItem();
  const createLinkedDocument = useCreateLinkedDocument();
  const createLinkedDrawing = useCreateLinkedDrawing();
  const createLinkedSpreadsheet = useCreateLinkedSpreadsheet();
  const shareItem = useShareItem();
  const revokeShare = useRevokeShare();
  const createFileComment = useCreateFileComment();
  const deleteFileComment = useDeleteFileComment();
  const updateDriveVisibility = useUpdateDriveItemVisibility();
  const { account } = useAuthStore();
  const perm = useAppActions('drive');

  // Activity & comments queries
  const activityItemId = activityOpen && previewItem ? previewItem.id : undefined;
  const { data: activityData } = useFileActivity(activityItemId);
  const commentsItemId = commentsOpen && previewItem ? previewItem.id : undefined;
  const { data: commentsData } = useFileComments(commentsItemId);

  // Clipboard for copy/paste
  const [clipboardItemId, setClipboardItemId] = useState<string | null>(null);

  // Determine which items to show
  const displayItems = useMemo(() => {
    let items: DriveItem[];
    if (searchQuery.trim()) items = searchData?.items ?? [];
    else if (sidebarView === 'favourites') items = favouritesData?.items ?? [];
    else if (sidebarView === 'recent') items = recentData?.items ?? [];
    else if (sidebarView === 'trash') items = trashData?.items ?? [];
    else if (sidebarView === 'uploaded') items = uploadsData?.items ?? [];
    else if (sidebarView === 'shared') items = sharedWithMeData ?? [];
    else if (['images', 'documents', 'videos', 'audio'].includes(sidebarView)) items = typeData?.items ?? [];
    else items = itemsData?.items ?? [];
    if (typeFilter !== 'all') items = items.filter((item) => matchesTypeFilter(item, typeFilter));
    if (modifiedFilter !== 'any') items = items.filter((item) => matchesModifiedFilter(item, modifiedFilter));
    return items;
  }, [sidebarView, searchQuery, itemsData, favouritesData, recentData, trashData, uploadsData, searchData, typeData, sharedWithMeData, typeFilter, modifiedFilter]);

  const isLoading = sidebarView === 'files' && itemsLoading;
  const breadcrumbs = breadcrumbsData?.breadcrumbs ?? [];
  const hasSelection = selectedIds.size > 0;

  // Save view mode
  useEffect(() => { localStorage.setItem(VIEW_MODE_KEY, viewMode); }, [viewMode]);

  // Close dropdowns on click outside
  useEffect(() => {
    if (!sortDropdownOpen && !typeDropdownOpen && !modifiedDropdownOpen && !newDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (newDropdownOpen && newDropdownRef.current && !newDropdownRef.current.contains(target)) setNewDropdownOpen(false);
      if (sortDropdownOpen && sortDropdownRef.current && !sortDropdownRef.current.contains(target)) setSortDropdownOpen(false);
      if (typeDropdownOpen && typeDropdownRef.current && !typeDropdownRef.current.contains(target)) setTypeDropdownOpen(false);
      if (modifiedDropdownOpen && modifiedDropdownRef.current && !modifiedDropdownRef.current.contains(target)) setModifiedDropdownOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [sortDropdownOpen, typeDropdownOpen, modifiedDropdownOpen, newDropdownOpen]);

  // Auto-dismiss upload progress
  useEffect(() => {
    if (uploadProgress && uploadProgress.loaded >= uploadProgress.total) {
      const timer = setTimeout(() => setUploadProgress(null), 1500);
      return () => clearTimeout(timer);
    }
  }, [uploadProgress]);

  // Clear selection when navigating
  useEffect(() => { setSelectedIds(new Set()); setPreviewItem(null); }, [folderId, sidebarView]);

  // ─── Preview panel resize ─────────────────────────────────────────
  const previewResizingRef = useRef(false);
  const handlePreviewResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    previewResizingRef.current = true;
    const startX = e.clientX;
    const startWidth = previewWidth;
    let finalWidth = startWidth;
    const onMove = (ev: MouseEvent) => {
      if (!previewResizingRef.current) return;
      const delta = startX - ev.clientX;
      finalWidth = Math.max(MIN_PREVIEW_WIDTH, Math.min(MAX_PREVIEW_WIDTH, startWidth + delta));
      setPreviewWidth(finalWidth);
    };
    const onUp = () => {
      previewResizingRef.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      localStorage.setItem(PREVIEW_WIDTH_KEY, String(finalWidth));
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [previewWidth]);

  // ─── Selection helpers ─────────────────────────────────────────────
  const handleItemClick = useCallback((item: DriveItem, e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      setSelectedIds((prev) => { const next = new Set(prev); if (next.has(item.id)) next.delete(item.id); else next.add(item.id); return next; });
      setLastClickedId(item.id);
    } else if (e.shiftKey && lastClickedId) {
      const items = displayItems;
      const lastIdx = items.findIndex((i) => i.id === lastClickedId);
      const curIdx = items.findIndex((i) => i.id === item.id);
      if (lastIdx >= 0 && curIdx >= 0) {
        const start = Math.min(lastIdx, curIdx);
        const end = Math.max(lastIdx, curIdx);
        setSelectedIds((prev) => { const next = new Set(prev); for (let i = start; i <= end; i++) next.add(items[i].id); return next; });
      }
    } else {
      setSelectedIds(new Set([item.id]));
      if (driveSettings.showPreviewPanel && (item.type === 'file' || item.linkedResourceType)) setPreviewItem(item);
      setLastClickedId(item.id);
    }
  }, [lastClickedId, displayItems]);

  const handleItemDoubleClick = useCallback((item: DriveItem) => {
    if (item.type === 'folder') { navigate(`/drive/folder/${item.id}`); setSidebarView('files'); setSearchQuery(''); return; }
    if (item.linkedResourceType && item.linkedResourceId) {
      if (item.linkedResourceType === 'document') navigate(`/docs/${item.linkedResourceId}`);
      else if (item.linkedResourceType === 'drawing') navigate(`/draw/${item.linkedResourceId}`);
      else if (item.linkedResourceType === 'spreadsheet') navigate(`/tables/${item.linkedResourceId}`);
      return;
    }
    if (driveSettings.showPreviewPanel) setPreviewItem(item);
  }, [navigate]);

  // ─── File operations ──────────────────────────────────────────────
  const handleCreateFolder = useCallback(() => {
    if (!newFolderName.trim()) return;
    createFolder.mutate({ name: newFolderName.trim(), parentId: currentParentId }, {
      onSuccess: () => { setNewFolderOpen(false); setNewFolderName(''); addToast({ type: 'success', message: t('drive.actions.folderCreated') }); },
    });
  }, [newFolderName, currentParentId, createFolder, addToast]);

  const handleUpload = useCallback((fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;
    setUploadProgress({ loaded: 0, total: 1 });
    uploadFiles.mutate({ files, parentId: currentParentId, onProgress: (progress) => setUploadProgress(progress) }, {
      onSuccess: (data) => { setUploadProgress(null); addToast({ type: 'success', message: t('drive.actions.filesUploaded', { count: data.items.length }) }); },
      onError: () => { addToast({ type: 'error', message: t('drive.actions.uploadFailed') }); setUploadProgress(null); },
    });
  }, [currentParentId, uploadFiles, addToast]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) { handleUpload(e.target.files); e.target.value = ''; }
  }, [handleUpload]);

  const handleRename = useCallback((item: DriveItem) => { setRenameId(item.id); setRenameValue(item.name); setContextMenu(null); }, []);

  const handleRenameSubmit = useCallback(() => {
    if (!renameId || !renameValue.trim()) return;
    const trimmedName = renameValue.trim();
    const item = displayItems.find((i) => i.id === renameId);
    updateItem.mutate({ id: renameId, name: trimmedName }, {
      onSuccess: () => {
        setRenameId(null); addToast({ type: 'success', message: t('drive.actions.renamed') });
        if (item?.linkedResourceType && item?.linkedResourceId) {
          if (item.linkedResourceType === 'document') api.patch(`/docs/${item.linkedResourceId}`, { title: trimmedName }).catch(() => {});
          else if (item.linkedResourceType === 'drawing') api.patch(`/drawings/${item.linkedResourceId}`, { title: trimmedName }).catch(() => {});
          else if (item.linkedResourceType === 'spreadsheet') api.patch(`/tables/${item.linkedResourceId}`, { title: trimmedName }).catch(() => {});
        }
      },
    });
  }, [renameId, renameValue, updateItem, addToast, displayItems]);

  const handleToggleFavourite = useCallback((item: DriveItem) => {
    updateItem.mutate({ id: item.id, isFavourite: !item.isFavourite }, { onSuccess: () => addToast({ type: 'success', message: item.isFavourite ? t('drive.actions.removedFromFavourites') : t('drive.actions.addedToFavourites') }) });
    setContextMenu(null);
  }, [updateItem, addToast]);

  const handleMoveToTrash = useCallback((item: DriveItem) => {
    if (driveSettings.confirmDelete) { setConfirmDelete(item); }
    else { deleteItem.mutate(item.id, { onSuccess: () => { addToast({ type: 'success', message: t('drive.actions.movedToTrashName', { name: item.name }) }); if (previewItem?.id === item.id) setPreviewItem(null); } }); }
    setContextMenu(null);
  }, [driveSettings.confirmDelete, deleteItem, addToast, previewItem]);

  const confirmMoveToTrash = useCallback(() => {
    if (!confirmDelete) return;
    deleteItem.mutate(confirmDelete.id, { onSuccess: () => { addToast({ type: 'success', message: t('drive.actions.movedToTrash') }); setConfirmDelete(null); setSelectedIds((prev) => { const n = new Set(prev); n.delete(confirmDelete.id); return n; }); } });
  }, [confirmDelete, deleteItem, addToast]);

  const handleRestore = useCallback((item: DriveItem) => { restoreItem.mutate(item.id, { onSuccess: () => addToast({ type: 'success', message: t('drive.actions.restored') }) }); setContextMenu(null); }, [restoreItem, addToast, t]);
  const handlePermanentDelete = useCallback((item: DriveItem) => { setConfirmPermanent(item); setContextMenu(null); }, []);
  const confirmPermanentDelete = useCallback(() => { if (!confirmPermanent) return; permanentDelete.mutate(confirmPermanent.id, { onSuccess: () => { addToast({ type: 'success', message: t('drive.actions.permanentlyDeleted') }); setConfirmPermanent(null); } }); }, [confirmPermanent, permanentDelete, addToast, t]);

  const handleDownload = useCallback((item: DriveItem) => {
    if (item.type !== 'file') return;
    const token = localStorage.getItem('atlasmail_token');
    window.open(`/api/v1/drive/${item.id}/download${token ? `?token=${encodeURIComponent(token)}` : ''}`, '_blank');
    setContextMenu(null);
  }, []);

  const handleDownloadZip = useCallback((item: DriveItem) => {
    if (item.type !== 'folder') return;
    const token = localStorage.getItem('atlasmail_token');
    window.open(`/api/v1/drive/${item.id}/download-zip${token ? `?token=${encodeURIComponent(token)}` : ''}`, '_blank');
    setContextMenu(null);
  }, []);

  const handleMove = useCallback((item: DriveItem) => { setMoveItem(item); setMoveTargetId(null); setMoveModalOpen(true); setContextMenu(null); }, []);
  const handleMoveSubmit = useCallback(() => { if (!moveItem) return; const name = moveItem.name; updateItem.mutate({ id: moveItem.id, parentId: moveTargetId }, { onSuccess: () => { addToast({ type: 'success', message: t('drive.actions.movedName', { name }) }); setMoveModalOpen(false); setMoveItem(null); } }); }, [moveItem, moveTargetId, updateItem, addToast, t]);
  const handleDuplicate = useCallback((item: DriveItem) => { duplicateItem.mutate(item.id, { onSuccess: () => addToast({ type: 'success', message: t('drive.actions.duplicated') }) }); setContextMenu(null); }, [duplicateItem, addToast, t]);
  const handleCopy = useCallback((item: DriveItem) => { setCopyModalItem(item); setCopyTargetId(null); setCopyModalOpen(true); setContextMenu(null); }, []);
  const handleCopySubmit = useCallback(() => { if (!copyModalItem) return; copyItem.mutate({ id: copyModalItem.id, targetParentId: copyTargetId }, { onSuccess: () => { addToast({ type: 'success', message: t('drive.actions.copied') }); setCopyModalOpen(false); setCopyModalItem(null); } }); }, [copyModalItem, copyTargetId, copyItem, addToast, t]);
  const handleClipboardCopy = useCallback(() => { if (selectedIds.size === 1) { setClipboardItemId(Array.from(selectedIds)[0]); addToast({ type: 'success', message: t('drive.actions.copiedToClipboard') }); } }, [selectedIds, addToast, t]);
  const handleClipboardPaste = useCallback(() => { if (!clipboardItemId) return; copyItem.mutate({ id: clipboardItemId, targetParentId: currentParentId }, { onSuccess: () => addToast({ type: 'success', message: t('drive.actions.pasted') }) }); }, [clipboardItemId, currentParentId, copyItem, addToast, t]);
  const handleContextMenu = useCallback((e: React.MouseEvent, item: DriveItem) => { e.preventDefault(); e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY, item }); }, []);

  // ─── Folder icon ───────────────────────────────────────────────────
  const handleSetIcon = useCallback((item: DriveItem) => { setIconPickerItem(item); setContextMenu(null); }, []);
  const handleIconSelect = useCallback((emoji: string) => { if (!iconPickerItem) return; updateItem.mutate({ id: iconPickerItem.id, icon: emoji }, { onSuccess: () => { addToast({ type: 'success', message: t('drive.actions.iconUpdated') }); setIconPickerItem(null); } }); }, [iconPickerItem, updateItem, addToast, t]);
  const handleIconRemove = useCallback(() => { if (!iconPickerItem) return; updateItem.mutate({ id: iconPickerItem.id, icon: null }, { onSuccess: () => { addToast({ type: 'success', message: t('drive.actions.iconRemoved') }); setIconPickerItem(null); } }); }, [iconPickerItem, updateItem, addToast, t]);

  // ─── Tags ──────────────────────────────────────────────────────────
  const handleAddTag = useCallback((item: DriveItem) => { setTagModalItem(item); setTagLabel(''); setTagColor(TAG_COLORS[0].hex); setContextMenu(null); }, []);
  const handleTagSubmit = useCallback(() => { if (!tagModalItem || !tagLabel.trim()) return; const tag = `${tagColor}:${tagLabel.trim()}`; updateItem.mutate({ id: tagModalItem.id, tags: [...(tagModalItem.tags || []), tag] }, { onSuccess: () => { addToast({ type: 'success', message: t('drive.actions.tagAdded') }); setTagModalItem(null); } }); }, [tagModalItem, tagLabel, tagColor, updateItem, addToast, t]);
  const handleRemoveTag = useCallback((item: DriveItem, tagIndex: number) => { updateItem.mutate({ id: item.id, tags: item.tags.filter((_, i) => i !== tagIndex) }); }, [updateItem]);

  // ─── Bulk operations ──────────────────────────────────────────────
  const handleBulkDelete = useCallback(() => { const ids = Array.from(selectedIds); batchDelete.mutate(ids, { onSuccess: () => { addToast({ type: 'success', message: t('drive.actions.itemsMovedToTrash', { count: ids.length }) }); setSelectedIds(new Set()); } }); }, [selectedIds, batchDelete, addToast, t]);
  const handleBulkFavourite = useCallback(() => { const ids = Array.from(selectedIds); batchFavourite.mutate({ itemIds: ids, isFavourite: true }, { onSuccess: () => { addToast({ type: 'success', message: t('drive.actions.addedToFavourites') }); setSelectedIds(new Set()); } }); }, [selectedIds, batchFavourite, addToast]);
  const handleBulkMoveSubmit = useCallback(() => { const ids = Array.from(selectedIds); batchMove.mutate({ itemIds: ids, parentId: batchMoveTargetId }, { onSuccess: () => { addToast({ type: 'success', message: t('drive.actions.itemsMoved', { count: ids.length }) }); setBatchMoveOpen(false); setSelectedIds(new Set()); } }); }, [selectedIds, batchMoveTargetId, batchMove, addToast, t]);
  const handleSelectAll = useCallback(() => { setSelectedIds(new Set(displayItems.map((i) => i.id))); }, [displayItems]);
  const handleClearSelection = useCallback(() => { setSelectedIds(new Set()); }, []);

  // ─── Drag & drop (file upload from OS) ────────────────────────────
  const handleDragEnter = useCallback((e: React.DragEvent) => { e.preventDefault(); if (dragItemId) return; if (!e.dataTransfer.types.includes('Files')) return; dragCounter.current++; if (dragCounter.current === 1) setIsDraggingOver(true); }, [dragItemId]);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); if (dragItemId) return; if (!e.dataTransfer.types.includes('Files')) return; dragCounter.current--; if (dragCounter.current === 0) setIsDraggingOver(false); }, [dragItemId]);
  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); }, []);
  const handleDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); dragCounter.current = 0; setIsDraggingOver(false); if (dragItemId) return; if (!e.dataTransfer.types.includes('Files')) return; if (e.dataTransfer.files.length > 0) handleUpload(e.dataTransfer.files); }, [handleUpload, dragItemId]);

  // ─── Drag & drop (internal move) ──────────────────────────────────
  const handleItemDragStart = useCallback((e: React.DragEvent, item: DriveItem) => { e.dataTransfer.setData('text/plain', item.id); e.dataTransfer.effectAllowed = 'move'; setDragItemId(item.id); }, []);
  const handleItemDragEnd = useCallback(() => { setDragItemId(null); setDragOverFolderId(null); }, []);
  const handleFolderDragOver = useCallback((e: React.DragEvent, fId: string) => { if (!dragItemId || dragItemId === fId) return; e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'move'; setDragOverFolderId(fId); }, [dragItemId]);
  const handleFolderDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setDragOverFolderId(null); }, []);

  const handleFolderDrop = useCallback((e: React.DragEvent, targetFolderId: string) => {
    e.preventDefault(); e.stopPropagation();
    const itemId = e.dataTransfer.getData('text/plain');
    if (!itemId || itemId === targetFolderId) return;
    if (selectedIds.has(itemId) && selectedIds.size > 1) {
      batchMove.mutate({ itemIds: Array.from(selectedIds), parentId: targetFolderId }, { onSuccess: () => { addToast({ type: 'success', message: t('drive.actions.itemsMoved', { count: selectedIds.size }) }); setSelectedIds(new Set()); } });
    } else {
      updateItem.mutate({ id: itemId, parentId: targetFolderId }, { onSuccess: () => addToast({ type: 'success', message: t('drive.actions.moved') }) });
    }
    setDragItemId(null); setDragOverFolderId(null);
  }, [selectedIds, batchMove, updateItem, addToast]);

  const handleSidebarTrashDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); const itemId = e.dataTransfer.getData('text/plain'); if (!itemId) return;
    if (selectedIds.has(itemId) && selectedIds.size > 1) { batchDelete.mutate(Array.from(selectedIds), { onSuccess: () => { addToast({ type: 'success', message: t('drive.actions.itemsMovedToTrash', { count: selectedIds.size }) }); setSelectedIds(new Set()); } }); }
    else { deleteItem.mutate(itemId, { onSuccess: () => addToast({ type: 'success', message: t('drive.actions.movedToTrash') }) }); }
    setDragItemId(null); setDragOverFolderId(null);
  }, [selectedIds, batchDelete, deleteItem, addToast]);

  const handleSidebarRootDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); const itemId = e.dataTransfer.getData('text/plain'); if (!itemId) return;
    if (selectedIds.has(itemId) && selectedIds.size > 1) { batchMove.mutate({ itemIds: Array.from(selectedIds), parentId: null }, { onSuccess: () => { addToast({ type: 'success', message: t('drive.actions.movedToRoot') }); setSelectedIds(new Set()); } }); }
    else { updateItem.mutate({ id: itemId, parentId: null }, { onSuccess: () => addToast({ type: 'success', message: t('drive.actions.movedToRoot') }) }); }
    setDragItemId(null); setDragOverFolderId(null);
  }, [selectedIds, batchMove, updateItem, addToast]);

  // ─── Title for the view ────────────────────────────────────────────
  const viewTitle = useMemo(() => {
    if (searchQuery.trim()) return t('drive.search', { query: searchQuery });
    if (sidebarView === 'favourites') return t('drive.sidebar.favourites');
    if (sidebarView === 'recent') return t('drive.sidebar.recent');
    if (sidebarView === 'trash') return t('drive.sidebar.trash');
    if (sidebarView === 'uploaded') return t('drive.sidebar.uploaded');
    if (sidebarView === 'shared') return t('drive.sidebar.sharedWithMe');
    return '';
  }, [sidebarView, searchQuery]);

  // ─── Build folder tree for move modal ──────────────────────────────
  const folderTree = useMemo(() => {
    const folders = foldersData?.folders ?? [];
    const tree: Array<{ id: string; name: string; depth: number }> = [];
    function buildLevel(parentId: string | null, depth: number) {
      for (const child of folders.filter((f) => f.parentId === parentId)) {
        if (moveItem && child.id === moveItem.id) continue;
        tree.push({ id: child.id, name: child.name, depth });
        buildLevel(child.id, depth + 1);
      }
    }
    buildLevel(null, 0);
    return tree;
  }, [foldersData, moveItem]);

  const copyFolderTree = useMemo(() => {
    const folders = foldersData?.folders ?? [];
    const tree: Array<{ id: string; name: string; depth: number }> = [];
    function buildLevel(parentId: string | null, depth: number) {
      for (const child of folders.filter((f) => f.parentId === parentId)) {
        tree.push({ id: child.id, name: child.name, depth });
        buildLevel(child.id, depth + 1);
      }
    }
    buildLevel(null, 0);
    return tree;
  }, [foldersData]);

  const batchFolderTree = useMemo(() => {
    const folders = foldersData?.folders ?? [];
    const tree: Array<{ id: string; name: string; depth: number }> = [];
    function buildLevel(parentId: string | null, depth: number) {
      for (const child of folders.filter((f) => f.parentId === parentId)) {
        if (selectedIds.has(child.id)) continue;
        tree.push({ id: child.id, name: child.name, depth });
        buildLevel(child.id, depth + 1);
      }
    }
    buildLevel(null, 0);
    return tree;
  }, [foldersData, selectedIds]);

  // ─── Keyboard shortcuts ────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      if (newFolderOpen || moveModalOpen || batchMoveOpen || !!tagModalItem || !!shareModalItem || !!iconPickerItem || !!confirmDelete || !!confirmPermanent) return;
      const isMod = e.metaKey || e.ctrlKey;

      if (isMod && e.key === 'c' && !e.shiftKey) { if (selectedIds.size === 1) { e.preventDefault(); handleClipboardCopy(); } return; }
      if (isMod && e.key === 'v' && !e.shiftKey) { if (clipboardItemId) { e.preventDefault(); handleClipboardPaste(); } return; }
      if (isMod && e.shiftKey && (e.key === 'N' || e.key === 'n')) { e.preventDefault(); setNewFolderOpen(true); return; }
      if (e.key === 'F2') { if (selectedIds.size === 1) { e.preventDefault(); const item = displayItems.find((i) => i.id === Array.from(selectedIds)[0]); if (item) handleRename(item); } return; }
      if (e.key === 'Delete' || e.key === 'Backspace') { if (selectedIds.size > 0 && !isMod) { e.preventDefault(); if (selectedIds.size > 1) handleBulkDelete(); else { const item = displayItems.find((i) => i.id === Array.from(selectedIds)[0]); if (item) handleMoveToTrash(item); } } return; }
      if (e.key === 'Escape') { if (previewItem) setPreviewItem(null); else if (selectedIds.size > 0) setSelectedIds(new Set()); return; }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (displayItems.length === 0) return;
        if (selectedIds.size === 0) { setSelectedIds(new Set([displayItems[0].id])); setLastClickedId(displayItems[0].id); }
        else if (selectedIds.size === 1) {
          const idx = displayItems.findIndex((i) => i.id === Array.from(selectedIds)[0]);
          if (idx < displayItems.length - 1) { const next = displayItems[idx + 1]; setSelectedIds(new Set([next.id])); setLastClickedId(next.id); if (driveSettings.showPreviewPanel && (next.type === 'file' || next.linkedResourceType)) setPreviewItem(next); else setPreviewItem(null); }
        }
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (displayItems.length === 0) return;
        if (selectedIds.size === 0) { const last = displayItems[displayItems.length - 1]; setSelectedIds(new Set([last.id])); setLastClickedId(last.id); }
        else if (selectedIds.size === 1) {
          const idx = displayItems.findIndex((i) => i.id === Array.from(selectedIds)[0]);
          if (idx > 0) { const prev = displayItems[idx - 1]; setSelectedIds(new Set([prev.id])); setLastClickedId(prev.id); if (driveSettings.showPreviewPanel && (prev.type === 'file' || prev.linkedResourceType)) setPreviewItem(prev); else setPreviewItem(null); }
        }
        return;
      }
      if (e.key === 'Enter') { if (selectedIds.size === 1) { e.preventDefault(); const item = displayItems.find((i) => i.id === Array.from(selectedIds)[0]); if (item) handleItemDoubleClick(item); } return; }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [selectedIds, displayItems, clipboardItemId, previewItem, currentParentId, newFolderOpen, moveModalOpen, batchMoveOpen, tagModalItem, shareModalItem, iconPickerItem, confirmDelete, confirmPermanent, driveSettings.showPreviewPanel, handleClipboardCopy, handleClipboardPaste, handleRename, handleMoveToTrash, handleBulkDelete, handleItemDoubleClick]);

  return {
    // Navigation / routing
    t, navigate, folderId, addToast, openSettings,
    // Settings
    driveSettings,
    // UI state
    previewWidth, viewMode, setViewMode, sidebarView, setSidebarView,
    searchQuery, setSearchQuery, selectedIds, setSelectedIds,
    contextMenu, setContextMenu, newDropdownOpen, setNewDropdownOpen,
    newFolderOpen, setNewFolderOpen, newFolderName, setNewFolderName,
    renameId, setRenameId, renameValue, setRenameValue,
    confirmDelete, setConfirmDelete, confirmPermanent, setConfirmPermanent,
    moveModalOpen, setMoveModalOpen, moveTargetId, setMoveTargetId,
    copyModalOpen, setCopyModalOpen, copyTargetId, setCopyTargetId,
    isDraggingOver, sortBy, setSortBy, sortDropdownOpen, setSortDropdownOpen,
    typeFilter, setTypeFilter, typeDropdownOpen, setTypeDropdownOpen,
    modifiedFilter, setModifiedFilter, modifiedDropdownOpen, setModifiedDropdownOpen,
    previewItem, setPreviewItem, uploadProgress,
    tagModalItem, setTagModalItem, tagLabel, setTagLabel, tagColor, setTagColor,
    iconPickerItem, setIconPickerItem, dragOverFolderId,
    batchMoveOpen, setBatchMoveOpen, batchMoveTargetId, setBatchMoveTargetId,
    shareModalItem, setShareModalItem,
    googleDriveModalOpen, setGoogleDriveModalOpen,
    versionHistoryOpen, setVersionHistoryOpen,
    activityOpen, setActivityOpen, commentsOpen, setCommentsOpen,
    commentBody, setCommentBody,
    replaceTargetId, setReplaceTargetId, dragItemId,
    // Refs
    fileInputRef, replaceFileInputRef, newDropdownRef, sortDropdownRef, typeDropdownRef, modifiedDropdownRef,
    // Derived data
    currentParentId, displayItems, isLoading, breadcrumbs, hasSelection, viewTitle,
    folderTree, copyFolderTree, batchFolderTree,
    // Query data
    storageData, storageQuotaBytes, filePreviewData, previewLoading,
    linkedDocData, linkedDrawingData, linkedTableData,
    versionsData, shareLinksData, itemSharesData, tenantUsersData,
    activityData, commentsData, account, perm,
    // Mutations
    createLinkedDocument, createLinkedDrawing, createLinkedSpreadsheet,
    replaceFile, restoreVersion, createShareLink, deleteShareLink,
    shareItem, revokeShare, createFileComment, deleteFileComment,
    updateDriveVisibility,
    // Handlers
    handlePreviewResizeStart, handleItemClick, handleItemDoubleClick,
    handleCreateFolder, handleFileInputChange,
    handleRename, handleRenameSubmit, handleToggleFavourite,
    handleMoveToTrash, confirmMoveToTrash, handleRestore,
    handlePermanentDelete, confirmPermanentDelete,
    handleDownload, handleDownloadZip, handleMove, handleMoveSubmit,
    handleCopy, handleCopySubmit,
    handleDuplicate, handleSetIcon, handleIconSelect, handleIconRemove,
    handleAddTag, handleTagSubmit, handleRemoveTag,
    handleContextMenu,
    handleBulkDelete, handleBulkFavourite, handleBulkMoveSubmit,
    handleSelectAll, handleClearSelection,
    handleDragEnter, handleDragLeave, handleDragOver, handleDrop,
    handleItemDragStart, handleItemDragEnd,
    handleFolderDragOver, handleFolderDragLeave, handleFolderDrop,
    handleSidebarTrashDrop, handleSidebarRootDrop,
  };
}
