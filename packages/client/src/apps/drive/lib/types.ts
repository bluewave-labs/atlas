import type { Dispatch, SetStateAction, ReactNode } from 'react';
import type { DriveItem } from '@atlas-platform/shared';

export type ViewMode = 'list' | 'grid';
export type SidebarView = 'files' | 'favourites' | 'recent' | 'trash' | 'shared' | 'uploaded' | 'images' | 'documents' | 'videos' | 'audio';
export type SortBy = 'default' | 'name' | 'size' | 'date' | 'type';
export type TypeFilter = 'all' | 'folders' | 'documents' | 'spreadsheets' | 'presentations' | 'photos' | 'pdfs' | 'videos' | 'archives' | 'audio' | 'drawings' | 'word' | 'excel' | 'powerpoint' | 'code' | 'text';
export type ModifiedFilter = 'any' | 'today' | '7days' | '30days' | 'thisYear' | 'lastYear';

export interface DriveDataTableListProps {
  displayItems: DriveItem[];
  sortBy: SortBy;
  setSortBy: (v: SortBy) => void;
  selectedIds: Set<string>;
  setSelectedIds: Dispatch<SetStateAction<Set<string>>>;
  renameId: string | null;
  setRenameId: (id: string | null) => void;
  renameValue: string;
  setRenameValue: (v: string) => void;
  handleRenameSubmit: () => void;
  setPreviewItem: (item: DriveItem | null) => void;
  handleItemDoubleClick: (item: DriveItem) => void;
  handleContextMenu: (e: React.MouseEvent, item: DriveItem) => void;
  handleItemDragStart: (e: React.DragEvent, item: DriveItem) => void;
  handleItemDragEnd: () => void;
  handleFolderDragOver: (e: React.DragEvent, folderId: string) => void;
  handleFolderDragLeave: (e: React.DragEvent) => void;
  handleFolderDrop: (e: React.DragEvent, targetFolderId: string) => void;
  onBatchMoveToFolder?: (ids: string[], targetFolderId: string) => void;
  dragOverFolderId: string | null;
  sidebarView: SidebarView;
  tenantUsersData: import('@atlas-platform/shared').TenantUser[];
  driveSettings: { showPreviewPanel: boolean; showFileExtensions: boolean; compactMode: boolean };
  renderTags: (item: DriveItem) => ReactNode;
}
