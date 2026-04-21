import { z } from 'zod';
import { register, envelope, Uuid, IsoDateTime } from '../_helpers';

const TAG = 'Draw';

const Drawing = z.object({
  id: Uuid,
  tenantId: Uuid,
  userId: Uuid,
  title: z.string(),
  thumbnailUrl: z.string().nullable(),
  excalidrawData: z.unknown().optional().openapi({ description: 'Only present when fetching a single drawing' }),
  sortOrder: z.number().int(),
  isArchived: z.boolean(),
  visibility: z.enum(['private', 'team']),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});

register({ method: 'get', path: '/drawings', tags: [TAG], summary: 'List drawings',
  query: z.object({ archived: z.coerce.boolean().optional() }),
  response: envelope(z.object({ drawings: z.array(Drawing) })) });
register({ method: 'post', path: '/drawings', tags: [TAG], summary: 'Create a drawing',
  body: z.object({ title: z.string().optional() }), response: envelope(Drawing) });
register({ method: 'get', path: '/drawings/search', tags: [TAG], summary: 'Search drawings',
  query: z.object({ q: z.string().min(1) }), response: envelope(z.array(Drawing)) });
register({ method: 'get', path: '/drawings/:id', tags: [TAG], summary: 'Get a drawing',
  params: z.object({ id: Uuid }), response: envelope(Drawing) });
register({ method: 'patch', path: '/drawings/:id', tags: [TAG], summary: 'Update a drawing',
  params: z.object({ id: Uuid }), body: Drawing.partial(), concurrency: true, response: envelope(Drawing) });
register({ method: 'patch', path: '/drawings/:id/visibility', tags: [TAG], summary: 'Toggle drawing visibility',
  params: z.object({ id: Uuid }), body: z.object({ visibility: Drawing.shape.visibility }) });
register({ method: 'delete', path: '/drawings/:id', tags: [TAG], summary: 'Delete (archive) a drawing',
  params: z.object({ id: Uuid }) });
register({ method: 'patch', path: '/drawings/:id/restore', tags: [TAG], summary: 'Restore an archived drawing',
  params: z.object({ id: Uuid }) });
