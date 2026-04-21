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
  query: z.object({ parentId: Uuid.optional() }), response: envelope(z.array(DriveItem)) });
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
  response: envelope(z.object({ used: z.number(), quota: z.number().nullable() })) });
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
register({ method: 'get', path: '/drive/:id/versions', tags: [TAG], summary: 'List file versions',
  params: z.object({ id: Uuid }), response: envelope(z.array(DriveVersion)) });
register({ method: 'post', path: '/drive/:id/restore-version/:versionId', tags: [TAG], summary: 'Restore a specific version',
  params: z.object({ id: Uuid, versionId: Uuid }), response: envelope(DriveItem) });

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

// Share links
register({ method: 'get', path: '/drive/:id/shares', tags: [TAG], summary: 'List share links for an item',
  params: z.object({ id: Uuid }), response: envelope(z.array(ShareLink)) });
register({ method: 'post', path: '/drive/:id/shares', tags: [TAG], summary: 'Create a public share link',
  params: z.object({ id: Uuid }),
  body: z.object({ expiresAt: IsoDateTime.optional() }),
  response: envelope(ShareLink) });
register({ method: 'delete', path: '/drive/shares/:shareId', tags: [TAG], summary: 'Revoke a share link',
  params: z.object({ shareId: Uuid }) });
