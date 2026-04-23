import { z } from 'zod';
import { register, envelope, Uuid, IsoDateTime } from '../_helpers';

const TAG = 'Write';

const Document = z.object({
  id: Uuid,
  tenantId: Uuid,
  userId: Uuid,
  parentId: Uuid.nullable(),
  title: z.string(),
  content: z.record(z.string(), z.unknown()).nullable(),
  icon: z.string().nullable(),
  coverImage: z.string().nullable(),
  sortOrder: z.number().int(),
  isArchived: z.boolean(),
  visibility: z.enum(['private', 'team']),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});

const DocVersion = z.object({
  id: Uuid,
  documentId: Uuid,
  title: z.string(),
  content: z.record(z.string(), z.unknown()).nullable(),
  createdAt: IsoDateTime,
});

const DocComment = z.object({
  id: Uuid,
  documentId: Uuid,
  userId: Uuid,
  content: z.string(),
  isResolved: z.boolean(),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});

register({ method: 'get', path: '/docs', tags: [TAG], summary: 'List documents',
  query: z.object({ parentId: Uuid.optional(), archived: z.coerce.boolean().optional() }),
  response: envelope(z.object({ documents: z.array(Document) })) });
register({ method: 'post', path: '/docs', tags: [TAG], summary: 'Create a document',
  body: z.object({ title: z.string().optional(), parentId: Uuid.optional() }), response: envelope(Document) });
register({ method: 'get', path: '/docs/search', tags: [TAG], summary: 'Search documents',
  query: z.object({ q: z.string().min(1) }), response: envelope(z.array(Document)) });
register({ method: 'post', path: '/docs/import', tags: [TAG], summary: 'Import a document from Markdown/HTML',
  body: z.object({ title: z.string().optional(), content: z.string(), format: z.enum(['markdown', 'html']).optional() }),
  response: envelope(Document) });
register({ method: 'get', path: '/docs/:id', tags: [TAG], summary: 'Get a document',
  params: z.object({ id: Uuid }), response: envelope(Document) });
register({ method: 'patch', path: '/docs/:id', tags: [TAG], summary: 'Update a document',
  params: z.object({ id: Uuid }), body: Document.partial(), concurrency: true, response: envelope(Document) });
register({ method: 'patch', path: '/docs/:id/visibility', tags: [TAG], summary: 'Toggle document visibility',
  params: z.object({ id: Uuid }), body: z.object({ visibility: Document.shape.visibility }) });
register({ method: 'delete', path: '/docs/:id', tags: [TAG], summary: 'Delete (archive) a document',
  params: z.object({ id: Uuid }) });
register({ method: 'patch', path: '/docs/:id/move', tags: [TAG], summary: 'Move a document under a new parent',
  params: z.object({ id: Uuid }), body: z.object({ parentId: Uuid.nullable() }) });
register({ method: 'patch', path: '/docs/:id/restore', tags: [TAG], summary: 'Restore an archived document',
  params: z.object({ id: Uuid }) });

// Versions
register({ method: 'get', path: '/docs/:id/versions', tags: [TAG], summary: 'List document versions',
  params: z.object({ id: Uuid }), response: envelope(z.array(DocVersion)) });
register({ method: 'post', path: '/docs/:id/versions', tags: [TAG], summary: 'Create a new version snapshot',
  params: z.object({ id: Uuid }), response: envelope(DocVersion) });
register({ method: 'post', path: '/docs/:id/versions/:versionId/restore', tags: [TAG], summary: 'Restore a specific version',
  params: z.object({ id: Uuid, versionId: Uuid }), response: envelope(Document) });

// Comments
register({ method: 'get', path: '/docs/:id/comments', tags: [TAG], summary: 'List document comments',
  params: z.object({ id: Uuid }), response: envelope(z.array(DocComment)) });
register({ method: 'post', path: '/docs/:id/comments', tags: [TAG], summary: 'Add a document comment',
  params: z.object({ id: Uuid }), body: z.object({ content: z.string() }), response: envelope(DocComment) });
register({ method: 'patch', path: '/docs/comments/:commentId', tags: [TAG], summary: 'Edit a comment',
  params: z.object({ commentId: Uuid }), body: z.object({ content: z.string() }), response: envelope(DocComment) });
register({ method: 'delete', path: '/docs/comments/:commentId', tags: [TAG], summary: 'Delete a comment',
  params: z.object({ commentId: Uuid }) });
register({ method: 'patch', path: '/docs/comments/:commentId/resolve', tags: [TAG], summary: 'Resolve/unresolve a comment',
  params: z.object({ commentId: Uuid }), body: z.object({ resolved: z.boolean() }) });

// Backlinks
register({ method: 'get', path: '/docs/:id/backlinks', tags: [TAG], summary: 'List documents that link to this one',
  params: z.object({ id: Uuid }), response: envelope(z.array(Document)) });

// Seed
register({ method: 'post', path: '/docs/seed', tags: [TAG], summary: 'Seed sample documents (admin only)' });
