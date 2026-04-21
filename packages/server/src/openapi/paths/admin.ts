import { z } from 'zod';
import { register, envelope, Uuid, IsoDateTime } from '../_helpers';

const TAG = 'Admin';

register({
  method: 'get', path: '/admin/overview', tags: [TAG],
  summary: 'Super-admin dashboard overview (tenants, users, usage)',
  response: envelope(z.record(z.string(), z.unknown())),
});

register({
  method: 'get', path: '/admin/tenants', tags: [TAG],
  summary: 'List all tenants (super-admin only)',
  response: envelope(z.array(z.object({
    id: Uuid,
    name: z.string(),
    slug: z.string(),
    status: z.enum(['active', 'suspended', 'trial']),
    plan: z.string(),
    storageQuotaBytes: z.number(),
    createdAt: IsoDateTime,
  }))),
});

register({
  method: 'post', path: '/admin/tenants', tags: [TAG],
  summary: 'Create a new tenant (super-admin only)',
  body: z.object({
    name: z.string(),
    slug: z.string().optional(),
    ownerEmail: z.string().email(),
    plan: z.string().optional(),
  }),
});

register({
  method: 'get', path: '/admin/tenants/:id', tags: [TAG],
  summary: 'Get a tenant with full admin detail',
  params: z.object({ id: Uuid }),
  response: envelope(z.record(z.string(), z.unknown())),
});

register({
  method: 'put', path: '/admin/tenants/:id/status', tags: [TAG],
  summary: 'Change tenant status',
  params: z.object({ id: Uuid }),
  body: z.object({ status: z.enum(['active', 'suspended']) }),
});

register({
  method: 'put', path: '/admin/tenants/:id/plan', tags: [TAG],
  summary: 'Change tenant plan',
  params: z.object({ id: Uuid }),
  body: z.object({ plan: z.string() }),
});

register({
  method: 'put', path: '/admin/tenants/:id/storage-quota', tags: [TAG],
  summary: 'Change tenant storage quota (bytes)',
  params: z.object({ id: Uuid }),
  body: z.object({ storageQuotaBytes: z.number().int().nonnegative() }),
});

register({
  method: 'get', path: '/admin/users', tags: [TAG],
  summary: 'List every user across every tenant (super-admin only)',
  response: envelope(z.array(z.object({
    id: Uuid,
    name: z.string().nullable(),
    email: z.string().email().nullable(),
    provider: z.string().nullable(),
    pictureUrl: z.string().url().nullable(),
    isSuperAdmin: z.boolean(),
    createdAt: IsoDateTime,
    tenants: z.array(z.object({
      id: Uuid,
      name: z.string().nullable(),
      slug: z.string().nullable(),
      role: z.enum(['owner', 'admin', 'member']),
    })),
  }))),
});
