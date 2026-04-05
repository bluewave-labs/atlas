// Barrel re-export — keeps routes.ts imports unchanged
export {
  listItems,
  getItem,
  createFolder,
  uploadFile,
  updateItem,
  deleteItem,
  restoreItem,
  permanentDelete,
  listTrash,
  listFavourites,
  listRecent,
  searchItems,
  getBreadcrumbs,
  getStorageUsage,
  getWidgetData,
  seedSampleFolder,
  seedSampleData,
  listFolders,
  duplicateItem,
  copyItem,
  batchDelete,
  batchMove,
  batchFavourite,
  listItemsByType,
  getFolderContents,
  updateDriveItemVisibility,
} from './services/items.service';

export {
  createShareLink,
  getShareLinks,
  deleteShareLink,
  getItemByShareToken,
  verifyShareLinkPassword,
  getShareLinkByToken,
  shareItem,
  listItemShares,
  revokeShare,
  listSharedWithMe,
  checkSharePermission,
  hasSharedAccess,
} from './services/sharing.service';

export {
  createVersion,
  listVersions,
  restoreVersion,
  getVersion,
} from './services/versioning.service';

export {
  createLinkedDocument,
  createLinkedDrawing,
  createLinkedSpreadsheet,
} from './services/linked-resources.service';

export {
  logDriveActivity,
  getActivityLog,
  listComments,
  createComment,
  deleteComment,
} from './services/comments.service';
