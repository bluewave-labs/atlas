import { z } from 'zod';
import { register, envelope, Uuid, IsoDateTime } from '../_helpers';

const TAG = 'Drive';

const DriveItem = z.object({
  id: Uuid,
  tenantId: Uuid,
  userId: Uuid,
  name: z.string(),
  type: z.enum(['folder', 'file']),
  mimeType: z.string().nullable(),
  size: z.number().int().nullable(),
  parentId: Uuid.nullable(),
  storagePath: z.string().nullable(),
  icon: z.string().nullable(),
  linkedResourceType: z.string().nullable(),
  linkedResourceId: z.string().nullable(),
  isFavourite: z.boolean(),
  isArchived: z.boolean(),
  tags: z.array(z.string()),
  sortOrder: z.number().int(),
  visibility: z.enum(['private', 'team']),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});

const DriveVersion = z.object({
  id: Uuid,
  driveItemId: Uuid,
  name: z.string(),
  mimeType: z.string().nullable(),
  size: z.number().int().nullable(),
  createdAt: IsoDateTime,
});

const ShareLink = z.object({
  id: Uuid,
  driveItemId: Uuid,
  shareToken: z.string(),
  expiresAt: IsoDateTime.nullable(),
  createdAt: IsoDateTime,
});

// Widget
register({ method: 'get', path: '/drive/widget', tags: [TAG], summary: 'Get Drive widget data for home',
  response: envelope(z.record(z.string(), z.unknown())) });

// Listing + navigation
register({ method: 'get', path: '/drive', tags: [TAG], summary: 'List drive items',
  query: z.object({ parentId: Uuid.optional() }), response: envelope(z.object({ items: z.array(DriveItem) })) });
register({ method: 'get', path: '/drive/search', tags: [TAG], summary: 'Search drive items',
  query: z.object({ q: z.string().min(1) }), response: envelope(z.array(DriveItem)) });
register({ method: 'get', path: '/drive/trash', tags: [TAG], summary: 'List trashed items',
  response: envelope(z.array(DriveItem)) });
register({ method: 'get', path: '/drive/favourites', tags: [TAG], summary: 'List favourite items',
  response: envelope(z.array(DriveItem)) });
register({ method: 'get', path: '/drive/recent', tags: [TAG], summary: 'List recently opened items',
  response: envelope(z.array(DriveItem)) });
register({ method: 'get', path: '/drive/uploads', tags: [TAG], summary: 'List recently uploaded items',
  response: envelope(z.array(DriveItem)) });
register({ method: 'get', path: '/drive/folders', tags: [TAG], summary: 'List folders (for picker)',
  response: envelope(z.array(DriveItem)) });
register({ method: 'get', path: '/drive/storage', tags: [TAG], summary: 'Get storage usage',
  response: envelope(z.object({
    totalBytes: z.string().openapi({ description: 'Bytes used (string to handle BigInt)' }),
    fileCount: z.string().openapi({ description: 'File count (string from SQL COUNT)' }),
  })) });
register({ method: 'get', path: '/drive/by-type', tags: [TAG], summary: 'List items grouped by type',
  query: z.object({ type: z.string().optional() }),
  response: envelope(z.array(DriveItem)) });

// Folder / upload / creation
register({ method: 'post', path: '/drive/folder', tags: [TAG], summary: 'Create a folder',
  body: z.object({ name: z.string(), parentId: Uuid.optional() }), response: envelope(DriveItem) });
register({ method: 'post', path: '/drive/upload', tags: [TAG], summary: 'Upload file(s) (multipart/form-data)',
  response: envelope(z.array(DriveItem)) });
register({ method: 'post', path: '/drive/create-document', tags: [TAG], summary: 'Create a Write document linked into Drive',
  body: z.object({ name: z.string(), parentId: Uuid.optional() }), response: envelope(DriveItem) });
register({ method: 'post', path: '/drive/create-drawing', tags: [TAG], summary: 'Create a Draw drawing linked into Drive',
  body: z.object({ name: z.string(), parentId: Uuid.optional() }), response: envelope(DriveItem) });

register({ method: 'get', path: '/drive/shared-with-me', tags: [TAG], summary: 'List drive items other users have shared with me',
  response: envelope(z.array(DriveItem)) });

// Single item ops
register({ method: 'get', path: '/drive/:id', tags: [TAG], summary: 'Get a drive item',
  params: z.object({ id: Uuid }), response: envelope(DriveItem) });
register({ method: 'patch', path: '/drive/:id', tags: [TAG], summary: 'Rename / move / update an item',
  params: z.object({ id: Uuid }),
  body: z.object({ name: z.string().optional(), parentId: Uuid.nullable().optional(), isFavourite: z.boolean().optional() }),
  response: envelope(DriveItem) });
register({ method: 'delete', path: '/drive/:id', tags: [TAG], summary: 'Permanently delete an item',
  params: z.object({ id: Uuid }) });
register({ method: 'get', path: '/drive/:id/download', tags: [TAG], summary: 'Download a file',
  params: z.object({ id: Uuid }),
  extraResponses: { 200: { description: 'File binary', schema: z.string().openapi({ format: 'binary' }) } } });
register({ method: 'get', path: '/drive/:id/download-zip', tags: [TAG], summary: 'Download a folder as a zip',
  params: z.object({ id: Uuid }),
  extraResponses: { 200: { description: 'Zip binary', schema: z.string().openapi({ format: 'binary' }) } } });
register({ method: 'get', path: '/drive/:id/view', tags: [TAG], summary: 'Stream a file for inline viewing',
  params: z.object({ id: Uuid }),
  extraResponses: { 200: { description: 'File binary', schema: z.string().openapi({ format: 'binary' }) } } });
register({ method: 'get', path: '/drive/:id/preview', tags: [TAG], summary: 'Fetch a preview (thumbnail or rendered image) of a file',
  params: z.object({ id: Uuid }),
  extraResponses: { 200: { description: 'Preview binary', schema: z.string().openapi({ format: 'binary' }) } } });
register({ method: 'get', path: '/drive/:id/breadcrumbs', tags: [TAG], summary: 'Get the folder breadcrumb path for an item',
  params: z.object({ id: Uuid }),
  response: envelope(z.array(z.object({ id: Uuid, name: z.string() }))) });
register({ method: 'get', path: '/drive/:id/activity', tags: [TAG], summary: 'Get the activity log for a drive item',
  params: z.object({ id: Uuid }),
  response: envelope(z.array(z.record(z.string(), z.unknown()))) });
register({ method: 'get', path: '/drive/:id/comments', tags: [TAG], summary: 'List comments on a drive item',
  params: z.object({ id: Uuid }),
  response: envelope(z.array(z.record(z.string(), z.unknown()))) });
register({ method: 'post', path: '/drive/:id/comments', tags: [TAG], summary: 'Add a comment to a drive item',
  params: z.object({ id: Uuid }),
  body: z.object({ body: z.string() }),
  response: envelope(z.record(z.string(), z.unknown())) });
register({ method: 'delete', path: '/drive/comments/:commentId', tags: [TAG], summary: 'Delete a drive comment',
  params: z.object({ commentId: Uuid }) });
register({ method: 'post', path: '/drive/:id/replace', tags: [TAG], summary: 'Replace the file content with a new upload (creates a new version)',
  params: z.object({ id: Uuid }),
  response: envelope(DriveItem) });
register({ method: 'delete', path: '/drive/:id/permanent', tags: [TAG], summary: 'Permanently delete a drive item (bypass trash)',
  params: z.object({ id: Uuid }) });
register({ method: 'patch', path: '/drive/:id/restore', tags: [TAG], summary: 'Restore a drive item from trash',
  params: z.object({ id: Uuid }) });
register({ method: 'patch', path: '/drive/:id/visibility', tags: [TAG], summary: 'Change drive item visibility (private/team)',
  params: z.object({ id: Uuid }),
  body: z.object({ visibility: z.enum(['private', 'team']) }) });
register({ method: 'post', path: '/drive/:id/copy', tags: [TAG], summary: 'Copy a drive item',
  params: z.object({ id: Uuid }),
  body: z.object({ parentId: Uuid.nullable().optional(), name: z.string().optional() }),
  response: envelope(DriveItem) });
register({ method: 'post', path: '/drive/:id/duplicate', tags: [TAG], summary: 'Duplicate a drive item in place',
  params: z.object({ id: Uuid }),
  response: envelope(DriveItem) });

register({ method: 'post', path: '/drive/seed', tags: [TAG], summary: 'Seed sample drive items (admin only)' });
register({ method: 'get', path: '/drive/:id/versions', tags: [TAG], summary: 'List file versions',
  params: z.object({ id: Uuid }), response: envelope(z.array(DriveVersion)) });
register({ method: 'post', path: '/drive/:id/versions/:versionId/restore', tags: [TAG], summary: 'Restore a specific version',
  params: z.object({ id: Uuid, versionId: Uuid }), response: envelope(DriveItem) });
register({ method: 'get', path: '/drive/:id/versions/:versionId/download', tags: [TAG], summary: 'Download a specific version of a file',
  params: z.object({ id: Uuid, versionId: Uuid }),
  extraResponses: { 200: { description: 'File binary', schema: z.string().openapi({ format: 'binary' }) } } });

// Batch
register({ method: 'post', path: '/drive/batch/delete', tags: [TAG], summary: 'Permanently delete multiple items',
  body: z.object({ itemIds: z.array(Uuid) }) });
register({ method: 'post', path: '/drive/batch/move', tags: [TAG], summary: 'Move multiple items',
  body: z.object({ itemIds: z.array(Uuid), parentId: Uuid.nullable() }) });
register({ method: 'post', path: '/drive/batch/favourite', tags: [TAG], summary: 'Favourite / unfavourite multiple items',
  body: z.object({ itemIds: z.array(Uuid), value: z.boolean() }) });
register({ method: 'post', path: '/drive/batch/trash', tags: [TAG], summary: 'Move multiple items to trash',
  body: z.object({ itemIds: z.array(Uuid) }) });
register({ method: 'post', path: '/drive/batch/tag', tags: [TAG], summary: 'Tag multiple items',
  body: z.object({ itemIds: z.array(Uuid), tags: z.array(z.string()) }) });

// Share links (public, token-based)
register({ method: 'get', path: '/drive/:id/share', tags: [TAG], summary: 'List public share links for an item',
  params: z.object({ id: Uuid }), response: envelope(z.array(ShareLink)) });
register({ method: 'post', path: '/drive/:id/share', tags: [TAG], summary: 'Create a public share link',
  params: z.object({ id: Uuid }),
  body: z.object({ expiresAt: IsoDateTime.optional(), password: z.string().optional() }),
  response: envelope(ShareLink) });
register({ method: 'delete', path: '/drive/share/:linkId', tags: [TAG], summary: 'Revoke a public share link',
  params: z.object({ linkId: Uuid }) });

// Per-user sharing (invite a teammate to a drive item)
register({ method: 'get', path: '/drive/:id/shares', tags: [TAG], summary: 'List users a drive item is shared with',
  params: z.object({ id: Uuid }),
  response: envelope(z.array(z.object({ userId: Uuid, role: z.enum(['viewer', 'editor']) }))) });
register({ method: 'post', path: '/drive/:id/shares', tags: [TAG], summary: 'Share a drive item with a user',
  params: z.object({ id: Uuid }),
  body: z.object({ userId: Uuid, role: z.enum(['viewer', 'editor']) }) });
register({ method: 'delete', path: '/drive/:id/shares/:userId', tags: [TAG], summary: 'Unshare a drive item from a user',
  params: z.object({ id: Uuid, userId: Uuid }) });
