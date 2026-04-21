import { z } from 'zod';
import { register, envelope, Uuid, IsoDateTime, User } from '../_helpers';

const Tenant = z.object({
  id: Uuid,
  name: z.string(),
  slug: z.string(),
  createdAt: IsoDateTime,
});

register({
  method: 'post',
  path: '/platform/tenants',
  tags: ['Platform'],
  summary: 'Create a new tenant',
  body: z.object({ name: z.string(), slug: z.string().optional() }),
  response: envelope(Tenant),
});

register({
  method: 'get',
  path: '/platform/tenants',
  tags: ['Platform'],
  summary: 'List tenants the current user belongs to',
  response: envelope(z.array(Tenant)),
});

register({
  method: 'get',
  path: '/platform/tenants/:id',
  tags: ['Platform'],
  summary: 'Get a tenant by id',
  params: z.object({ id: Uuid }),
  response: envelope(Tenant),
});

register({
  method: 'patch',
  path: '/platform/tenants/:id',
  tags: ['Platform'],
  summary: 'Update tenant settings',
  params: z.object({ id: Uuid }),
  body: z.object({ name: z.string().optional(), slug: z.string().optional() }),
  response: envelope(Tenant),
});

register({
  method: 'get',
  path: '/platform/tenants/:id/users',
  tags: ['Platform'],
  summary: 'List members of a tenant',
  params: z.object({ id: Uuid }),
  response: envelope(z.array(User.extend({ role: z.enum(['owner', 'admin', 'member']) }))),
});

register({
  method: 'post',
  path: '/platform/tenants/:id/users',
  tags: ['Platform'],
  summary: 'Create a tenant user directly (admin only)',
  params: z.object({ id: Uuid }),
  body: z.object({
    email: z.string().email(),
    name: z.string(),
    password: z.string().min(8),
    role: z.enum(['admin', 'member']),
  }),
  response: envelope(User),
});

register({
  method: 'delete',
  path: '/platform/tenants/:id/users/:userId',
  tags: ['Platform'],
  summary: 'Remove a user from a tenant',
  params: z.object({ id: Uuid, userId: Uuid }),
});

register({
  method: 'put',
  path: '/platform/tenants/:id/users/:userId/role',
  tags: ['Platform'],
  summary: 'Change a tenant member’s role',
  params: z.object({ id: Uuid, userId: Uuid }),
  body: z.object({ role: z.enum(['owner', 'admin', 'member']) }),
});

register({
  method: 'post',
  path: '/platform/tenants/:id/invitations',
  tags: ['Platform'],
  summary: 'Invite a user to join a tenant',
  params: z.object({ id: Uuid }),
  body: z.object({ email: z.string().email(), role: z.enum(['admin', 'member']) }),
});

register({
  method: 'get',
  path: '/platform/tenants/:id/apps',
  tags: ['Platform'],
  summary: 'List apps enabled for a tenant',
  params: z.object({ id: Uuid }),
  response: envelope(z.array(z.object({ appId: z.string(), enabled: z.boolean() }))),
});

register({
  method: 'post',
  path: '/platform/tenants/:id/apps/:appId/enable',
  tags: ['Platform'],
  summary: 'Enable an app for a tenant',
  params: z.object({ id: Uuid, appId: z.string() }),
});

register({
  method: 'post',
  path: '/platform/tenants/:id/apps/:appId/disable',
  tags: ['Platform'],
  summary: 'Disable an app for a tenant',
  params: z.object({ id: Uuid, appId: z.string() }),
});
