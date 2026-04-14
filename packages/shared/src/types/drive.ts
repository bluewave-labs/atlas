export interface DriveItem {
  id: string;
  tenantId: string;
  userId: string;
  name: string;
  type: 'file' | 'folder';
  mimeType: string | null;
  size: number | null;
  parentId: string | null;
  storagePath: string | null;
  icon: string | null;
  linkedResourceType: 'document' | 'drawing' | 'spreadsheet' | null;
  linkedResourceId: string | null;
  isFavourite: boolean;
  isArchived: boolean;
  tags: string[];
  sortOrder: number;
  visibility?: 'private' | 'team';
  createdAt: string;
  updatedAt: string;
}

export interface CreateDriveItemInput {
  name: string;
  type: 'file' | 'folder';
  parentId?: string | null;
  mimeType?: string | null;
  size?: number | null;
  storagePath?: string | null;
}

export interface UpdateDriveItemInput {
  name?: string;
  parentId?: string | null;
  icon?: string | null;
  isFavourite?: boolean;
  isArchived?: boolean;
  tags?: string[];
}

export interface DriveItemVersion {
  id: string;
  driveItemId: string;
  tenantId: string;
  userId: string;
  name: string;
  mimeType: string | null;
  size: number | null;
  storagePath: string | null;
  createdAt: string;
}

export type ShareLinkMode = 'view' | 'edit' | 'upload_only';

export interface DriveShareLink {
  id: string;
  driveItemId: string;
  userId: string;
  shareToken: string;
  passwordHash: string | null;
  expiresAt: string | null;
  mode: ShareLinkMode;
  uploadInstructions: string | null;
  requireUploaderEmail: boolean;
  createdAt: string;
}

export interface DriveActivityEntry {
  id: string;
  action: string;
  metadata: Record<string, unknown>;
  userId: string;
  userName: string;
  createdAt: string;
}

export interface DriveComment {
  id: string;
  body: string;
  userId: string;
  userName: string;
  createdAt: string;
  updatedAt: string;
}
