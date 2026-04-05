import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Star, Clock, HardDrive, Users, File,
} from 'lucide-react';
import { DataTable, type DataTableColumn, type SortState } from '../../../components/ui/data-table';
import { Avatar } from '../../../components/ui/avatar';
import { Badge } from '../../../components/ui/badge';
import { Tooltip } from '../../../components/ui/tooltip';
import { getFileTypeIcon, formatBytes, formatRelativeDate } from '../../../lib/drive-utils';
import { stripExtension } from '../lib/helpers';
import type { DriveDataTableListProps } from '../lib/types';
import type { DriveItem } from '@atlasmail/shared';

export function DriveDataTableList({
  displayItems,
  sortBy,
  setSortBy,
  selectedIds,
  setSelectedIds,
  renameId,
  setRenameId,
  renameValue,
  setRenameValue,
  handleRenameSubmit,
  setPreviewItem,
  handleItemDoubleClick,
  handleContextMenu,
  handleItemDragStart,
  handleItemDragEnd,
  handleFolderDragOver,
  handleFolderDragLeave,
  handleFolderDrop,
  dragOverFolderId,
  sidebarView,
  tenantUsersData,
  driveSettings,
  renderTags,
}: DriveDataTableListProps) {
  const { t } = useTranslation();
  // Map SortBy <-> DataTable SortState
  const dtSort: SortState | null = sortBy === 'default' ? null : {
    column: sortBy === 'date' ? 'date' : sortBy,
    direction: sortBy === 'size' || sortBy === 'date' ? 'desc' : 'asc',
  };

  const handleDtSortChange = useCallback((next: SortState | null) => {
    if (!next) { setSortBy('default'); return; }
    if (next.column === 'name') setSortBy('name');
    else if (next.column === 'size') setSortBy('size');
    else if (next.column === 'date') setSortBy('date');
    else setSortBy('default');
  }, [setSortBy]);

  const handleSelectionChange = useCallback((ids: Set<string>) => {
    setSelectedIds(ids);
  }, [setSelectedIds]);

  // Event delegation: context menu on the wrapping div using data-drive-id
  const handleContainerContextMenu = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    let target = e.target as HTMLElement | null;
    while (target && target !== e.currentTarget) {
      const itemId = target.dataset.driveId;
      if (itemId) {
        const item = displayItems.find((i) => i.id === itemId);
        if (item) { handleContextMenu(e, item); return; }
      }
      target = target.parentElement;
    }
  }, [displayItems, handleContextMenu]);

  const handleContainerDoubleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    let target = e.target as HTMLElement | null;
    while (target && target !== e.currentTarget) {
      const itemId = target.dataset.driveId;
      if (itemId) {
        const item = displayItems.find((i) => i.id === itemId);
        if (item) { handleItemDoubleClick(item); return; }
      }
      target = target.parentElement;
    }
  }, [displayItems, handleItemDoubleClick]);

  const columns: DataTableColumn<DriveItem>[] = [
    {
      key: 'name',
      label: t('drive.table.name'),
      icon: <File size={12} />,
      sortable: true,
      render: (item) => {
        const Icon = getFileTypeIcon(item.mimeType, item.type, item.linkedResourceType);
        const isRenaming = renameId === item.id;
        return (
          <div
            className="drive-list-name"
            data-drive-id={item.id}
            draggable={!isRenaming}
            onDragStart={(e) => { e.stopPropagation(); handleItemDragStart(e, item); }}
            onDragEnd={(e) => { e.stopPropagation(); handleItemDragEnd(); }}
            onDragOver={item.type === 'folder' ? (e) => { e.stopPropagation(); handleFolderDragOver(e, item.id); } : undefined}
            onDragLeave={item.type === 'folder' ? (e) => { e.stopPropagation(); handleFolderDragLeave(e); } : undefined}
            onDrop={item.type === 'folder' ? (e) => { e.stopPropagation(); handleFolderDrop(e, item.id); } : undefined}
          >
            {item.icon ? (
              <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>{item.icon}</span>
            ) : (
              <Icon size={22} />
            )}
            {isRenaming ? (
              <input
                className="drive-rename-input"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={handleRenameSubmit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRenameSubmit();
                  if (e.key === 'Escape') setRenameId(null);
                }}
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span>{driveSettings.showFileExtensions ? item.name : stripExtension(item.name, item.type)}</span>
            )}
            {item.isFavourite && (
              <Star size={12} fill="var(--color-star, #f59e0b)" color="var(--color-star, #f59e0b)" />
            )}
            {((item as any).shareCount > 0 || (item as any).hasShareLink) && (
              <Tooltip content={t('drive.table.shared')}>
                <span style={{ display: 'inline-flex', color: 'var(--color-text-tertiary)' }}>
                  <Users size={12} />
                </span>
              </Tooltip>
            )}
            {renderTags(item)}
          </div>
        );
      },
    },
    ...(sidebarView === 'shared' ? [{
      key: 'sharedBy',
      label: t('drive.table.sharedBy'),
      width: 160,
      sortable: false,
      render: (item: DriveItem) => {
        const sharedItem = item as DriveItem & { sharePermission?: string; sharedBy?: string };
        const sharer = tenantUsersData.find((u) => u.userId === sharedItem.sharedBy);
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
            {sharer && (
              <Tooltip content={sharer.name || sharer.email}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
                  <Avatar name={sharer.name || null} email={sharer.email} size={18} />
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {sharer.name || sharer.email}
                  </span>
                </span>
              </Tooltip>
            )}
            <Badge variant={sharedItem.sharePermission === 'edit' ? 'primary' : 'default'}>
              {sharedItem.sharePermission === 'edit' ? t('drive.sharing.shareEdit') : t('drive.sharing.shareView')}
            </Badge>
          </div>
        );
      },
    } as DataTableColumn<DriveItem>] : []),
    {
      key: 'size',
      label: t('drive.table.size'),
      icon: <HardDrive size={12} />,
      width: 120,
      sortable: true,
      align: 'right' as const,
      render: (item) => (
        <span className="drive-list-size">
          {item.type === 'file' ? formatBytes(item.size) : '—'}
        </span>
      ),
      compare: (a, b) => (a.size ?? 0) - (b.size ?? 0),
    },
    {
      key: 'date',
      label: t('drive.table.modified'),
      icon: <Clock size={12} />,
      width: 140,
      sortable: true,
      render: (item) => (
        <span className="drive-list-modified">
          {formatRelativeDate(item.updatedAt)}
        </span>
      ),
      compare: (a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime(),
    },
  ];

  return (
    <div
      onContextMenu={handleContainerContextMenu}
      onDoubleClick={handleContainerDoubleClick}
      style={{ display: 'contents' }}
    >
      <DataTable<DriveItem>
        data={displayItems}
        columns={columns}
        selectable
        selectedIds={selectedIds}
        onSelectionChange={handleSelectionChange}
        sort={dtSort}
        onSortChange={handleDtSortChange}
        onRowClick={(item) => {
          // DataTable manages multi-select; open preview panel on single click
          if (driveSettings.showPreviewPanel && (item.type === 'file' || item.linkedResourceType)) {
            setPreviewItem(item);
          }
        }}
        activeRowId={null}
        paginated={false}
        hideFooter={false}
        keyboardNavigation
        rowClassName={(item) =>
          [
            dragOverFolderId === item.id ? 'drive-drag-over' : '',
            driveSettings.compactMode ? 'compact' : '',
          ].filter(Boolean).join(' ')
        }
        className="drive-data-table"
      />
    </div>
  );
}
