import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { urlForCategory } from '../../config/settings-url';
import {
  Plus, Search, Upload, FolderPlus, Trash2,
  Star, ChevronRight, LayoutGrid, LayoutList, Clock, Heart,
  HardDrive, Upload as UploadIcon, Check, ChevronDown, FileArchive, Share2,
  FileImage, FileText, FileVideo, X, FolderInput, Settings,
  Music, Table2, Pencil, Users, Inbox,
} from 'lucide-react';
import { Settings2 } from 'lucide-react';
import { AppSidebar, SidebarItem, SidebarSection } from '../../components/layout/app-sidebar';
import { ContentArea } from '../../components/ui/content-area';
import { Button } from '../../components/ui/button';
import { IconButton } from '../../components/ui/icon-button';
import { Chip } from '../../components/ui/chip';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { Modal } from '../../components/ui/modal';
import { EmojiPicker } from '../../components/shared/emoji-picker';
import { FeatureEmptyState } from '../../components/ui/feature-empty-state';
import { formatBytes } from '../../lib/drive-utils';
import { ROUTES } from '../../config/routes';
import type { DriveItem } from '@atlas-platform/shared';
import '../../styles/drive.css';

import { DriveDataTableList } from './components/drive-data-table-list';
import { DriveGridView } from './components/drive-grid-view';
import { DrivePreviewPanel } from './components/drive-preview-panel';
import { DriveContextMenuView } from './components/drive-context-menu';
import { DriveBulkBar } from './components/drive-bulk-bar';
import { NewFolderModal, MoveModal, TagModal, ShareModal, GoogleDriveModal } from './components/modals';
import { getSortOptions, getTypeFilterOptions, getModifiedFilterOptions, parseTag } from './lib/helpers';
import { useDrivePage } from './use-drive-page';
import { useBatchTrash, useBatchMoveDriveItems, useRestoreDriveItem, usePermanentDeleteDriveItem } from './hooks';

export function DrivePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const d = useDrivePage();
  const canCreate = d.perm.canCreate;
  const canEdit = d.perm.canEdit;
  const canDeleteAny = d.perm.canDelete;
  const canDeleteOwn = d.perm.canDeleteOwn;
  const currentUserId = d.account?.userId;

  const batchTrash = useBatchTrash();
  const batchMove = useBatchMoveDriveItems();
  const restoreItem = useRestoreDriveItem();
  const permanentDelete = usePermanentDeleteDriveItem();

  const handleDragBatchMove = (ids: string[], targetFolderId: string) => {
    batchMove.mutate({ itemIds: ids, parentId: targetFolderId }, {
      onSuccess: () => {
        d.addToast({ type: 'success', message: t('drive.actions.itemsMoved', { count: ids.length }) });
        d.setSelectedIds(new Set());
      },
    });
  };

  const handleBulkTrash = () => {
    if (d.selectedIds.size === 0) return;
    batchTrash.mutate(Array.from(d.selectedIds), {
      onSuccess: () => d.setSelectedIds(new Set()),
    });
  };

  const handleBulkRestore = () => {
    if (d.selectedIds.size === 0) return;
    const ids = Array.from(d.selectedIds);
    Promise.all(ids.map((id) => restoreItem.mutateAsync(id))).then(() => {
      d.addToast({ type: 'success', message: t('drive.actions.itemsRestored', { count: ids.length }) });
      d.setSelectedIds(new Set());
    });
  };

  const handleBulkPermanentDelete = () => {
    if (d.selectedIds.size === 0) return;
    const ids = Array.from(d.selectedIds);
    const ok = window.confirm(t('drive.bulk.permanentDeleteConfirm', 'Permanently delete {{count}} items? This cannot be undone.', { count: ids.length }));
    if (!ok) return;
    Promise.all(ids.map((id) => permanentDelete.mutateAsync(id))).then(() => {
      d.addToast({ type: 'success', message: t('drive.actions.itemsDeletedPermanently', { count: ids.length }) });
      d.setSelectedIds(new Set());
    });
  };

  const handleBulkDownload = () => {
    const token = localStorage.getItem('atlasmail_token');
    for (const id of d.selectedIds) {
      window.open(`/api/v1/drive/${id}/download${token ? `?token=${encodeURIComponent(token)}` : ''}`, '_blank');
    }
  };

  const renderTags = (item: DriveItem) => {
    if (!item.tags || item.tags.length === 0) return null;
    return (
      <div className="drive-tags">
        {item.tags.map((tag, i) => {
          const { color, label } = parseTag(tag);
          return <Chip key={i} color={color} height={18} onRemove={() => d.handleRemoveTag(item, i)}>{label}</Chip>;
        })}
      </div>
    );
  };

  return (
    <div className="drive-page" style={{ marginLeft: 56 }}>
      <input ref={d.fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={d.handleFileInputChange} />

      {/* Sidebar */}
      <AppSidebar
        storageKey="atlas_drive_sidebar"
        title="Drive"
        search={
          canCreate ? (
          <div className="drive-sidebar-actions">
            <div ref={d.newDropdownRef} style={{ flex: 1, position: 'relative' }}>
              <Button variant="secondary" size="sm" icon={<Plus size={14} />} onClick={() => d.setNewDropdownOpen((v) => !v)} style={{ width: '100%', gap: 6 }}>
                New <ChevronDown size={12} />
              </Button>
              {d.newDropdownOpen && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: 'var(--color-bg-primary)', border: '1px solid var(--color-border-primary)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)', zIndex: 50, padding: '4px 0', minWidth: 180 }}>
                  <button onClick={() => { d.setNewDropdownOpen(false); d.setNewFolderOpen(true); }} className="drive-new-dropdown-item"><FolderPlus size={14} /> {t('drive.actions.newFolder')}</button>
                  <div style={{ height: 1, background: 'var(--color-border-primary)', margin: '4px 0' }} />
                  <button onClick={() => { d.setNewDropdownOpen(false); d.createLinkedDocument.mutate({ parentId: d.currentParentId }, { onSuccess: (data) => d.navigate(`/docs/${data.resourceId}`), onError: () => d.addToast({ type: 'error', message: t('drive.actions.failedToCreateDocument') }) }); }} className="drive-new-dropdown-item"><FileText size={14} /> {t('drive.actions.newDocument')}</button>
                  <button onClick={() => { d.setNewDropdownOpen(false); d.createLinkedDrawing.mutate({ parentId: d.currentParentId }, { onSuccess: (data) => d.navigate(`/draw/${data.resourceId}`), onError: () => d.addToast({ type: 'error', message: t('drive.actions.failedToCreateDrawing') }) }); }} className="drive-new-dropdown-item"><Pencil size={14} /> {t('drive.actions.newDrawing')}</button>
                  <div style={{ height: 1, background: 'var(--color-border-primary)', margin: '4px 0' }} />
                  <button onClick={() => { d.setNewDropdownOpen(false); d.setGoogleDriveModalOpen(true); }} className="drive-new-dropdown-item"><HardDrive size={14} /> {t('drive.google.importFromGoogle', 'Import from Google Drive')}</button>
                </div>
              )}
            </div>
            <Button variant="primary" size="sm" icon={<Upload size={14} />} onClick={() => d.fileInputRef.current?.click()} style={{ flex: 1 }}>{t('drive.actions.upload')}</Button>
          </div>
          ) : undefined
        }
        footer={(() => {
          const storageWidget = d.storageData ? (() => {
            const totalQuota = d.storageQuotaBytes;
            const usagePercent = Math.min(100, (d.storageData.totalBytes / totalQuota) * 100);
            return (
              <div className="drive-storage">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-xs)' }}>
                  <span className="drive-storage-label">{d.t('drive.storage.usage', { used: formatBytes(d.storageData.totalBytes), total: formatBytes(totalQuota) })}</span>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>{d.t('drive.storage.fileCount', { count: d.storageData.fileCount })}</span>
                </div>
                <div className="drive-storage-bar"><div className="drive-storage-fill" style={{ width: `${usagePercent}%`, background: usagePercent > 90 ? 'var(--color-error)' : usagePercent > 75 ? 'var(--color-warning)' : 'var(--color-accent-primary)' }} /></div>
              </div>
            );
          })() : null;
          return (
            <>
              <SidebarItem
                label={t('drive.sidebar.settings', 'Settings')}
                icon={<Settings2 size={14} />}
                onClick={() => navigate(urlForCategory('drive'))}
              />
              {storageWidget}
            </>
          );
        })()}
      >
        <SidebarSection>
          <div onDragOver={(e) => { if (d.dragItemId) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; } }} onDrop={d.handleSidebarRootDrop}>
            <SidebarItem label={t('drive.sidebar.myDrive')} icon={<HardDrive size={15} />} isActive={d.sidebarView === 'files' && !d.folderId} onClick={() => { d.setSidebarView('files'); d.setSearchQuery(''); d.navigate(ROUTES.DRIVE); }} />
          </div>
          <SidebarItem label={t('drive.sidebar.favourites')} icon={<Heart size={15} />} isActive={d.sidebarView === 'favourites'} onClick={() => { d.setSidebarView('favourites'); d.setSearchQuery(''); }} />
          <SidebarItem label={t('drive.sidebar.recent')} icon={<Clock size={15} />} isActive={d.sidebarView === 'recent'} onClick={() => { d.setSidebarView('recent'); d.setSearchQuery(''); }} />
          <SidebarItem label={t('drive.sidebar.uploaded')} icon={<Inbox size={15} />} isActive={d.sidebarView === 'uploaded'} onClick={() => { d.setSidebarView('uploaded'); d.setSearchQuery(''); }} />
          <div onDragOver={(e) => { if (d.dragItemId) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; } }} onDrop={d.handleSidebarTrashDrop}>
            <SidebarItem label={t('drive.sidebar.trash')} icon={<Trash2 size={15} />} isActive={d.sidebarView === 'trash'} onClick={() => { d.setSidebarView('trash'); d.setSearchQuery(''); }} />
          </div>
          <SidebarItem label={d.t('drive.sidebar.sharedWithMe')} icon={<Users size={15} />} isActive={d.sidebarView === 'shared'} onClick={() => { d.setSidebarView('shared'); d.setSearchQuery(''); }} />
        </SidebarSection>
        <SidebarSection title={t('drive.sidebar.fileTypes')}>
          <SidebarItem label={t('drive.sidebar.images')} icon={<FileImage size={15} />} isActive={d.sidebarView === 'images'} onClick={() => { d.setSidebarView('images'); d.setSearchQuery(''); }} />
          <SidebarItem label={t('drive.sidebar.documents')} icon={<FileText size={15} />} isActive={d.sidebarView === 'documents'} onClick={() => { d.setSidebarView('documents'); d.setSearchQuery(''); }} />
          <SidebarItem label={t('drive.sidebar.videos')} icon={<FileVideo size={15} />} isActive={d.sidebarView === 'videos'} onClick={() => { d.setSidebarView('videos'); d.setSearchQuery(''); }} />
          <SidebarItem label={t('drive.sidebar.audio')} icon={<Music size={15} />} isActive={d.sidebarView === 'audio'} onClick={() => { d.setSidebarView('audio'); d.setSearchQuery(''); }} />
        </SidebarSection>
      </AppSidebar>

      {/* Main content */}
      <ContentArea
        headerSlot={
          <div className="drive-main-header">
            {d.uploadProgress && (
              <div className="drive-upload-progress">
                <div className="drive-upload-progress-info"><span>{t('drive.actions.uploading')}</span><span>{Math.round((d.uploadProgress.loaded / d.uploadProgress.total) * 100)}%</span></div>
                <div className="drive-upload-progress-bar"><div className="drive-upload-progress-fill" style={{ width: `${Math.round((d.uploadProgress.loaded / d.uploadProgress.total) * 100)}%` }} /></div>
              </div>
            )}
            <div className="drive-toolbar">
          <div className="drive-toolbar-left">
            {d.sidebarView === 'files' && !d.searchQuery.trim() ? (
              <div className="drive-breadcrumbs">
                <button className={`drive-breadcrumb-item ${!d.folderId ? 'current' : ''}`} onClick={() => { if (d.folderId) d.navigate(ROUTES.DRIVE); }}>{t('drive.sidebar.myDrive')}</button>
                {d.breadcrumbs.map((crumb, i) => (
                  <span key={crumb.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <ChevronRight size={12} className="drive-breadcrumb-separator" />
                    <button className={`drive-breadcrumb-item ${i === d.breadcrumbs.length - 1 ? 'current' : ''}`} onClick={() => { if (i < d.breadcrumbs.length - 1) d.navigate(`/drive/folder/${crumb.id}`); }}>{crumb.name}</button>
                  </span>
                ))}
              </div>
            ) : (
              <span style={{ fontSize: 'var(--font-size-md)', fontWeight: 500, color: 'var(--color-text-primary)' }}>{d.viewTitle}</span>
            )}
          </div>
          <div className="drive-toolbar-right">
            {d.sidebarView === 'files' && d.folderId && (
              <Button variant="secondary" size="sm" icon={<FileArchive size={14} />} onClick={() => { const token = localStorage.getItem('atlasmail_token'); window.open(`/api/v1/drive/${d.folderId}/download-zip${token ? `?token=${encodeURIComponent(token)}` : ''}`, '_blank'); }}>{d.t('drive.actions.downloadZip')}</Button>
            )}
            <div ref={d.typeDropdownRef} style={{ position: 'relative' }}>
              <Button variant="secondary" size="sm" onClick={() => d.setTypeDropdownOpen(!d.typeDropdownOpen)} style={{ minWidth: 90, background: d.typeFilter !== 'all' ? 'color-mix(in srgb, var(--color-accent-primary) 8%, var(--color-bg-primary))' : undefined, color: d.typeFilter !== 'all' ? 'var(--color-accent-primary)' : 'var(--color-text-primary)' }}>
                {getTypeFilterOptions(t).find((o) => o.value === d.typeFilter)?.label || t('drive.preview.type')} <ChevronDown size={12} />
              </Button>
              {d.typeDropdownOpen && (<div className="drive-sort-dropdown" style={{ minWidth: 180 }}>{getTypeFilterOptions(t).map((opt) => (<button key={opt.value} className={`drive-sort-option ${d.typeFilter === opt.value ? 'active' : ''}`} onClick={() => { d.setTypeFilter(opt.value); d.setTypeDropdownOpen(false); }}>{opt.label}{d.typeFilter === opt.value && <Check size={12} />}</button>))}</div>)}
            </div>
            <div ref={d.modifiedDropdownRef} style={{ position: 'relative' }}>
              <Button variant="secondary" size="sm" onClick={() => d.setModifiedDropdownOpen(!d.modifiedDropdownOpen)} style={{ minWidth: 90, background: d.modifiedFilter !== 'any' ? 'color-mix(in srgb, var(--color-accent-primary) 8%, var(--color-bg-primary))' : undefined, color: d.modifiedFilter !== 'any' ? 'var(--color-accent-primary)' : 'var(--color-text-primary)' }}>
                {getModifiedFilterOptions(t).find((o) => o.value === d.modifiedFilter)?.label || t('drive.preview.modified')} <ChevronDown size={12} />
              </Button>
              {d.modifiedDropdownOpen && (<div className="drive-sort-dropdown" style={{ minWidth: 180 }}>{getModifiedFilterOptions(t).map((opt) => (<button key={opt.value} className={`drive-sort-option ${d.modifiedFilter === opt.value ? 'active' : ''}`} onClick={() => { d.setModifiedFilter(opt.value); d.setModifiedDropdownOpen(false); }}>{opt.label}{d.modifiedFilter === opt.value && <Check size={12} />}</button>))}</div>)}
            </div>
            <div ref={d.sortDropdownRef} style={{ position: 'relative' }}>
              <Button variant="secondary" size="sm" onClick={() => d.setSortDropdownOpen(!d.sortDropdownOpen)}>{getSortOptions(t).find((s) => s.value === d.sortBy)?.label || t('drive.sort.default')} <ChevronDown size={12} /></Button>
              {d.sortDropdownOpen && (<div className="drive-sort-dropdown">{getSortOptions(t).map((opt) => (<button key={opt.value} className={`drive-sort-option ${d.sortBy === opt.value ? 'active' : ''}`} onClick={() => { d.setSortBy(opt.value); d.setSortDropdownOpen(false); }}>{opt.label}{d.sortBy === opt.value && <Check size={12} />}</button>))}</div>)}
            </div>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)' }} />
              <input className="drive-search-input" placeholder={t('drive.toolbar.searchFiles')} value={d.searchQuery} onChange={(e) => d.setSearchQuery(e.target.value)} />
            </div>
            <IconButton icon={d.viewMode === 'list' ? <LayoutGrid size={16} /> : <LayoutList size={16} />} label={d.viewMode === 'list' ? t('drive.toolbar.gridView') : t('drive.toolbar.listView')} size={32} onClick={() => d.setViewMode(d.viewMode === 'list' ? 'grid' : 'list')} style={{ border: '1px solid var(--color-border-primary)' }} />
            <IconButton icon={<Settings size={16} />} label={t('drive.toolbar.driveSettings')} size={32} onClick={() => navigate(urlForCategory('drive'))} style={{ border: '1px solid var(--color-border-primary)' }} />
            </div>
            </div>
          </div>
        }
      >
        {/* Content area */}
        <div className="drive-content" onDragEnter={d.handleDragEnter} onDragLeave={d.handleDragLeave} onDragOver={d.handleDragOver} onDrop={d.handleDrop} onClick={() => { if (!d.hasSelection) d.setSelectedIds(new Set()); d.setContextMenu(null); }}>
          {d.isDraggingOver && (<div className="drive-dropzone-overlay"><div className="drive-dropzone-label"><UploadIcon size={32} /> {t('drive.dropzone.dropToUpload')}</div></div>)}
          {d.isLoading ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-tertiary)' }}>{t('drive.loading')}</div>
          ) : d.displayItems.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, color: 'var(--color-text-tertiary)', padding: 32 }}>
              {d.sidebarView === 'trash' ? (<><Trash2 size={40} strokeWidth={1.2} /><span style={{ fontSize: 'var(--font-size-lg)', fontWeight: 500, color: 'var(--color-text-secondary)' }}>{t('drive.emptyState.trashEmpty')}</span><span style={{ fontSize: 'var(--font-size-sm)' }}>{t('drive.emptyState.trashEmptyDesc')}</span></>)
              : d.sidebarView === 'shared' ? (<><Users size={40} strokeWidth={1.2} /><span style={{ fontSize: 'var(--font-size-lg)', fontWeight: 500, color: 'var(--color-text-secondary)' }}>{t('drive.sharing.sharedEmpty')}</span><span style={{ fontSize: 'var(--font-size-sm)' }}>{t('drive.sharing.sharedEmptyDesc')}</span></>)
              : d.sidebarView === 'favourites' ? (<><Heart size={40} strokeWidth={1.2} /><span style={{ fontSize: 'var(--font-size-lg)', fontWeight: 500, color: 'var(--color-text-secondary)' }}>{t('drive.emptyState.noFavourites')}</span><span style={{ fontSize: 'var(--font-size-sm)' }}>{t('drive.emptyState.noFavouritesDesc')}</span></>)
              : d.searchQuery.trim() ? (<><Search size={40} strokeWidth={1.2} /><span style={{ fontSize: 'var(--font-size-lg)', fontWeight: 500, color: 'var(--color-text-secondary)' }}>{t('drive.emptyState.noResults')}</span><span style={{ fontSize: 'var(--font-size-sm)' }}>{t('drive.emptyState.noResultsDesc')}</span></>)
              : (<FeatureEmptyState illustration="files" title={d.t('drive.empty.title')} description={d.t('drive.empty.desc')} highlights={[{ icon: <Upload size={14} />, title: d.t('drive.empty.h1Title'), description: d.t('drive.empty.h1Desc') }, { icon: <FolderPlus size={14} />, title: d.t('drive.empty.h2Title'), description: d.t('drive.empty.h2Desc') }, { icon: <Share2 size={14} />, title: d.t('drive.empty.h3Title'), description: d.t('drive.empty.h3Desc') }]} actionLabel={canCreate ? d.t('drive.empty.uploadFiles') : undefined} actionIcon={canCreate ? <Upload size={14} /> : undefined} onAction={canCreate ? () => d.fileInputRef.current?.click() : undefined} />)}
            </div>
          ) : d.viewMode === 'list' ? (
            <DriveDataTableList displayItems={d.displayItems} sortBy={d.sortBy} setSortBy={d.setSortBy} selectedIds={d.selectedIds} setSelectedIds={d.setSelectedIds} renameId={d.renameId} setRenameId={d.setRenameId} renameValue={d.renameValue} setRenameValue={d.setRenameValue} handleRenameSubmit={d.handleRenameSubmit} setPreviewItem={d.setPreviewItem} handleItemDoubleClick={d.handleItemDoubleClick} handleContextMenu={d.handleContextMenu} handleItemDragStart={d.handleItemDragStart} handleItemDragEnd={d.handleItemDragEnd} handleFolderDragOver={d.handleFolderDragOver} handleFolderDragLeave={d.handleFolderDragLeave} handleFolderDrop={d.handleFolderDrop} onBatchMoveToFolder={handleDragBatchMove} dragOverFolderId={d.dragOverFolderId} sidebarView={d.sidebarView} tenantUsersData={d.tenantUsersData ?? []} driveSettings={d.driveSettings} renderTags={renderTags} />
          ) : (
            <DriveGridView displayItems={d.displayItems} selectedIds={d.selectedIds} setSelectedIds={d.setSelectedIds} renameId={d.renameId} renameValue={d.renameValue} setRenameValue={d.setRenameValue} setRenameId={d.setRenameId} handleRenameSubmit={d.handleRenameSubmit} handleItemClick={d.handleItemClick} handleItemDoubleClick={d.handleItemDoubleClick} handleContextMenu={d.handleContextMenu} handleItemDragStart={d.handleItemDragStart} handleItemDragEnd={d.handleItemDragEnd} handleFolderDragOver={d.handleFolderDragOver} handleFolderDragLeave={d.handleFolderDragLeave} handleFolderDrop={d.handleFolderDrop} dragOverFolderId={d.dragOverFolderId} sidebarView={d.sidebarView} tenantUsersData={d.tenantUsersData ?? []} driveSettings={d.driveSettings} renderTags={renderTags} />
          )}
        </div>
      </ContentArea>

      {/* Preview panel */}
      {d.previewItem && (
        <DrivePreviewPanel previewItem={d.previewItem} previewWidth={d.previewWidth} handlePreviewResizeStart={d.handlePreviewResizeStart} setPreviewItem={d.setPreviewItem} filePreviewData={d.filePreviewData} previewLoading={d.previewLoading} linkedDocData={d.linkedDocData} linkedDrawingData={d.linkedDrawingData} linkedTableData={d.linkedTableData} updateDriveVisibility={d.updateDriveVisibility} account={d.account} versionHistoryOpen={d.versionHistoryOpen} setVersionHistoryOpen={d.setVersionHistoryOpen} versionsData={d.versionsData} restoreVersion={d.restoreVersion} addToast={d.addToast} commentsOpen={d.commentsOpen} setCommentsOpen={d.setCommentsOpen} commentsData={d.commentsData} commentBody={d.commentBody} setCommentBody={d.setCommentBody} createFileComment={d.createFileComment} deleteFileComment={d.deleteFileComment} activityOpen={d.activityOpen} setActivityOpen={d.setActivityOpen} activityData={d.activityData} />
      )}

      {/* Context menu */}
      {d.contextMenu && (() => {
        const item = d.contextMenu.item;
        const isOwner = item.userId === currentUserId;
        const ctxCanEdit = canEdit;
        const ctxCanDelete = canDeleteAny || (canDeleteOwn && isOwner);
        return (
        <DriveContextMenuView contextMenu={d.contextMenu} setContextMenu={() => d.setContextMenu(null)} sidebarView={d.sidebarView} handleRestore={d.handleRestore} handlePermanentDelete={d.handlePermanentDelete} handleDownload={d.handleDownload} handleDownloadZip={d.handleDownloadZip} handleRename={d.handleRename} handleSetIcon={d.handleSetIcon} handleDuplicate={d.handleDuplicate} handleMove={d.handleMove} handleCopy={d.handleCopy} handleToggleFavourite={d.handleToggleFavourite} handleAddTag={d.handleAddTag} setShareModalItem={d.setShareModalItem} setReplaceTargetId={d.setReplaceTargetId} replaceFileInputRef={d.replaceFileInputRef} handleMoveToTrash={d.handleMoveToTrash} canEdit={ctxCanEdit} canDelete={ctxCanDelete} />
        );
      })()}

      {/* Modals */}
      <NewFolderModal open={d.newFolderOpen} onOpenChange={d.setNewFolderOpen} folderName={d.newFolderName} setFolderName={d.setNewFolderName} onSubmit={d.handleCreateFolder} />
      <MoveModal open={d.moveModalOpen} onOpenChange={d.setMoveModalOpen} title={t('drive.modals.moveTo')} folderTree={d.folderTree} targetId={d.moveTargetId} setTargetId={d.setMoveTargetId} onSubmit={d.handleMoveSubmit} />
      <MoveModal open={d.batchMoveOpen} onOpenChange={d.setBatchMoveOpen} title={t('drive.modals.moveItemsTo', { count: d.selectedIds.size })} folderTree={d.batchFolderTree} targetId={d.batchMoveTargetId} setTargetId={d.setBatchMoveTargetId} onSubmit={d.handleBulkMoveSubmit} />
      <MoveModal open={d.copyModalOpen} onOpenChange={d.setCopyModalOpen} title={t('drive.modals.copyTo')} folderTree={d.copyFolderTree} targetId={d.copyTargetId} setTargetId={d.setCopyTargetId} onSubmit={d.handleCopySubmit} mode="copy" />
      <TagModal tagModalItem={d.tagModalItem} setTagModalItem={d.setTagModalItem} tagLabel={d.tagLabel} setTagLabel={d.setTagLabel} tagColor={d.tagColor} setTagColor={d.setTagColor} handleTagSubmit={d.handleTagSubmit} />
      <ShareModal shareModalItem={d.shareModalItem} setShareModalItem={d.setShareModalItem} tenantUsersData={d.tenantUsersData ?? []} itemSharesData={d.itemSharesData} shareLinksData={d.shareLinksData} shareItem={d.shareItem} revokeShare={d.revokeShare} createShareLink={d.createShareLink} deleteShareLink={d.deleteShareLink} addToast={d.addToast} defaultExpiry={d.driveSettings.shareDefaultExpiry || 'never'} />
      <GoogleDriveModal open={d.googleDriveModalOpen} onClose={() => d.setGoogleDriveModalOpen(false)} targetParentId={d.currentParentId} />

      {/* Hidden replace file input */}
      <input type="file" ref={d.replaceFileInputRef} style={{ display: 'none' }} onChange={(e) => { const file = e.target.files?.[0]; if (file && d.replaceTargetId) { d.replaceFile.mutate({ itemId: d.replaceTargetId, file }, { onSuccess: () => { d.addToast({ type: 'success', message: t('drive.actions.newVersionUploaded') }); d.setReplaceTargetId(null); } }); } e.target.value = ''; }} />

      {/* Floating bulk action bar */}
      <DriveBulkBar
        selectedCount={d.selectedIds.size}
        onSelectAll={d.handleSelectAll}
        onClear={d.handleClearSelection}
        onMove={() => { d.setBatchMoveTargetId(null); d.setBatchMoveOpen(true); }}
        onCopy={() => { d.setCopyTargetId(null); d.setCopyModalOpen(true); }}
        onDownload={handleBulkDownload}
        onFavourite={d.handleBulkFavourite}
        onTrash={handleBulkTrash}
        onRestore={handleBulkRestore}
        onDeletePermanently={handleBulkPermanentDelete}
        isTrashView={d.sidebarView === 'trash'}
        canDelete={canDeleteAny || canDeleteOwn}
        canEdit={canEdit}
      />

      {/* Confirm dialogs */}
      <ConfirmDialog open={!!d.confirmDelete} onOpenChange={() => d.setConfirmDelete(null)} title={t('drive.confirm.moveToTrashTitle')} description={t('drive.confirm.moveToTrashDesc', { name: d.confirmDelete?.name })} confirmLabel={t('drive.confirm.moveToTrashConfirm')} onConfirm={d.confirmMoveToTrash} destructive />
      <ConfirmDialog open={!!d.confirmPermanent} onOpenChange={() => d.setConfirmPermanent(null)} title={t('drive.confirm.deletePermanentlyTitle')} description={t('drive.confirm.deletePermanentlyDesc', { name: d.confirmPermanent?.name })} confirmLabel={t('drive.confirm.deletePermanentlyConfirm')} onConfirm={d.confirmPermanentDelete} destructive />

      {d.iconPickerItem && (
        <Modal open onOpenChange={() => d.setIconPickerItem(null)} title={t('drive.modals.chooseIcon')} width={320}>
          <Modal.Header title={t('drive.modals.chooseIcon')} />
          <Modal.Body>
            <EmojiPicker inline onSelect={d.handleIconSelect} onRemove={d.iconPickerItem.icon ? d.handleIconRemove : undefined} onClose={() => d.setIconPickerItem(null)} />
          </Modal.Body>
        </Modal>
      )}
    </div>
  );
}
