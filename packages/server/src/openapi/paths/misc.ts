import { z } from 'zod';
import { register, envelope, EnvelopeError, Uuid, IsoDateTime } from '../_helpers';

// ---------- User settings ----------
const UserSettings = z.object({
  id: Uuid,
  accountId: Uuid,
  theme: z.enum(['light', 'dark', 'system']),
  density: z.enum(['compact', 'comfortable']),
  shortcutsPreset: z.string(),
  customShortcuts: z.record(z.string(), z.unknown()),
  autoAdvance: z.string(),
  readingPane: z.string(),
  desktopNotifications: z.boolean(),
  notificationSound: z.boolean(),
  signatureHtml: z.string().nullable(),
  trackingEnabled: z.boolean(),
  // Tasks section
  tasksDefaultView: z.string(),
  tasksConfirmDelete: z.boolean(),
  tasksShowCalendar: z.boolean(),
  tasksShowEvening: z.boolean(),
  tasksShowWhenBadges: z.boolean(),
  tasksShowProject: z.boolean(),
  tasksShowNotesIndicator: z.boolean(),
  tasksCompactMode: z.boolean(),
  tasksCompletedBehavior: z.string(),
  tasksDefaultSort: z.string(),
  tasksViewMode: z.string(),
  // Format / locale
  dateFormat: z.string(),
  currencySymbol: z.string(),
  timezone: z.string(),
  timeFormat: z.string(),
  numberFormat: z.string(),
  calendarStartDay: z.string(),
  calDefaultView: z.string(),
}).passthrough();

register({
  method: 'get',
  path: '/settings',
  tags: ['User settings'],
  summary: 'Get user settings',
  response: envelope(UserSettings),
});

register({
  method: 'put',
  path: '/settings',
  tags: ['User settings'],
  summary: 'Update user settings',
  body: z.record(z.string(), z.unknown()),
});

register({
  method: 'get',
  path: '/settings/ai',
  tags: ['User settings'],
  summary: 'Get AI provider configuration (keys redacted)',
  response: envelope(z.record(z.string(), z.unknown())),
});

register({
  method: 'put',
  path: '/settings/ai',
  tags: ['User settings'],
  summary: 'Update AI provider configuration',
  body: z.record(z.string(), z.unknown()),
});

register({
  method: 'delete',
  path: '/settings/ai/key/:provider',
  tags: ['User settings'],
  summary: 'Remove an AI provider API key',
  params: z.object({ provider: z.string() }),
});

register({
  method: 'post',
  path: '/settings/ai/test',
  tags: ['User settings'],
  summary: 'Test an AI provider configuration',
  body: z.object({ provider: z.string() }),
  response: envelope(z.object({ ok: z.boolean(), message: z.string().optional() })),
});

// ---------- Notifications ----------
const Notification = z.object({
  id: Uuid,
  title: z.string(),
  body: z.string().nullable(),
  readAt: IsoDateTime.nullable(),
  createdAt: IsoDateTime,
});

register({
  method: 'get',
  path: '/notifications',
  tags: ['Notifications'],
  summary: 'List notifications for the current user',
  query: z.object({ limit: z.coerce.number().int().min(1).max(100).optional() }),
  response: envelope(z.object({
    items: z.array(Notification),
    hasMore: z.boolean(),
    unreadCount: z.number().int(),
  })),
});

register({
  method: 'get',
  path: '/notifications/unread-count',
  tags: ['Notifications'],
  summary: 'Get unread notification count',
  response: envelope(z.object({ count: z.number().int() })),
});

register({
  method: 'get',
  path: '/notifications/activity-feed',
  tags: ['Notifications'],
  summary: 'Get cross-app activity feed',
  query: z.object({ limit: z.coerce.number().int().min(1).max(200).optional() }),
  response: envelope(z.array(z.record(z.string(), z.unknown()))),
});

register({
  method: 'post',
  path: '/notifications/read-all',
  tags: ['Notifications'],
  summary: 'Mark all notifications as read',
});

register({
  method: 'post',
  path: '/notifications/:id/read',
  tags: ['Notifications'],
  summary: 'Mark a single notification as read',
  params: z.object({ id: Uuid }),
});

register({
  method: 'delete',
  path: '/notifications/:id',
  tags: ['Notifications'],
  summary: 'Delete a notification',
  params: z.object({ id: Uuid }),
});

// ---------- Global search ----------
register({
  method: 'get',
  path: '/search',
  tags: ['Search'],
  summary: 'Global search across all apps',
  query: z.object({
    q: z.string().min(1).openapi({ example: 'invoice' }),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  }),
  response: envelope(
    z.array(
      z.object({
        appId: z.string(),
        recordId: Uuid,
        title: z.string(),
        snippet: z.string().nullable(),
      }),
    ),
  ),
});

// ---------- Exchange rates ----------
register({
  method: 'get',
  path: '/exchange-rates/convert',
  tags: ['Exchange rates'],
  summary: 'Convert an amount between currencies with multi-provider fallback',
  query: z.object({
    from: z.string().length(3).openapi({ example: 'USD' }),
    to: z.string().length(3).openapi({ example: 'EUR' }),
    amount: z.coerce.number().optional().openapi({ example: 100 }),
  }),
  response: envelope(
    z.object({
      from: z.string().length(3),
      to: z.string().length(3),
      rate: z.number().openapi({ example: 0.85034 }),
      amount: z.number(),
      converted: z.number(),
      provider: z.string().openapi({ example: 'frankfurter' }),
      cached: z.boolean(),
    }),
  ),
  extraResponses: {
    400: { description: 'Invalid currency or amount', schema: EnvelopeError },
    503: {
      description: 'All rate providers failed',
      schema: EnvelopeError.extend({ code: z.literal('RATE_UNAVAILABLE') }),
    },
  },
});

register({
  method: 'get',
  path: '/exchange-rates/rates',
  tags: ['Exchange rates'],
  summary: 'Get rates for multiple target currencies against a base',
  query: z.object({
    base: z.string().length(3).openapi({ example: 'USD' }),
    targets: z.string().openapi({ example: 'EUR,GBP,TRY', description: 'Comma-separated ISO codes' }),
  }),
  response: envelope(
    z.object({
      base: z.string().length(3),
      rates: z.record(z.string(), z.object({ rate: z.number(), provider: z.string() })),
    }),
  ),
});

// ---------- Record links ----------
const RecordLink = z.object({
  id: Uuid,
  sourceAppId: z.string(),
  sourceRecordId: Uuid,
  targetAppId: z.string(),
  targetRecordId: Uuid,
  createdAt: IsoDateTime,
});

register({
  method: 'get',
  path: '/links/:appId/:recordId',
  tags: ['Record links'],
  summary: 'List all cross-app links for a record',
  params: z.object({ appId: z.string(), recordId: Uuid }),
  response: envelope(z.array(RecordLink)),
});

register({
  method: 'get',
  path: '/links/:appId/:recordId/counts',
  tags: ['Record links'],
  summary: 'Get per-app link counts for a record',
  params: z.object({ appId: z.string(), recordId: Uuid }),
  response: envelope(z.record(z.string(), z.number().int())),
});

register({
  method: 'get',
  path: '/links/:appId/:recordId/details',
  tags: ['Record links'],
  summary: 'Get detailed info on each linked record (title, type, etc.)',
  params: z.object({ appId: z.string(), recordId: Uuid }),
  response: envelope(z.array(z.record(z.string(), z.unknown()))),
});

register({
  method: 'post',
  path: '/links',
  tags: ['Record links'],
  summary: 'Create a link between two records',
  body: z.object({
    sourceAppId: z.string(),
    sourceRecordId: Uuid,
    targetAppId: z.string(),
    targetRecordId: Uuid,
  }),
  response: envelope(RecordLink),
});

register({
  method: 'delete',
  path: '/links/:id',
  tags: ['Record links'],
  summary: 'Delete a record link',
  params: z.object({ id: Uuid }),
});

// ---------- Custom fields ----------
const CustomField = z.object({
  id: Uuid,
  appId: z.string(),
  entity: z.string(),
  key: z.string(),
  label: z.string(),
  type: z.enum(['text', 'number', 'date', 'boolean', 'select', 'multiselect', 'url', 'email']),
  options: z.array(z.string()).nullable(),
  required: z.boolean(),
  createdAt: IsoDateTime,
});

register({
  method: 'get',
  path: '/custom-fields',
  tags: ['Custom fields'],
  summary: 'List custom field definitions',
  query: z.object({ appId: z.string().optional(), entity: z.string().optional() }),
  response: envelope(z.array(CustomField)),
});

register({
  method: 'post',
  path: '/custom-fields',
  tags: ['Custom fields'],
  summary: 'Create a custom field definition',
  body: CustomField.omit({ id: true, createdAt: true }),
  response: envelope(CustomField),
});

register({
  method: 'patch',
  path: '/custom-fields/:id',
  tags: ['Custom fields'],
  summary: 'Update a custom field definition',
  params: z.object({ id: Uuid }),
  body: CustomField.partial(),
  response: envelope(CustomField),
});

register({
  method: 'delete',
  path: '/custom-fields/:id',
  tags: ['Custom fields'],
  summary: 'Delete a custom field definition',
  params: z.object({ id: Uuid }),
});

register({
  method: 'get',
  path: '/custom-field-values/:appId/:recordId',
  tags: ['Custom fields'],
  summary: 'Get all custom field values for a record',
  params: z.object({ appId: z.string(), recordId: Uuid }),
  response: envelope(z.record(z.string(), z.unknown())),
});

register({
  method: 'put',
  path: '/custom-field-values/:appId/:recordId',
  tags: ['Custom fields'],
  summary: 'Set custom field values for a record',
  params: z.object({ appId: z.string(), recordId: Uuid }),
  body: z.record(z.string(), z.unknown()),
});

// ---------- Files ----------
register({
  method: 'post',
  path: '/upload',
  tags: ['Files'],
  summary: 'Upload a file (multipart/form-data)',
  response: envelope(z.object({ url: z.string().url(), filename: z.string(), size: z.number() })),
});

// ---------- Stocks ----------
register({
  method: 'get',
  path: '/stocks/quote',
  tags: ['Stocks'],
  summary: 'Get current quote for a stock symbol',
  query: z.object({ symbol: z.string().openapi({ example: 'AAPL' }) }),
  response: envelope(z.object({
    symbol: z.string(),
    price: z.number(),
    change: z.number(),
    changePercent: z.number(),
    currency: z.string(),
  })),
});

// ---------- Presence ----------
register({
  method: 'get',
  path: '/presence',
  tags: ['Presence'],
  summary: 'List online users in the tenant',
  response: envelope(z.array(z.object({
    userId: Uuid,
    status: z.enum(['online', 'away', 'offline']),
    lastSeen: IsoDateTime,
  }))),
});

register({
  method: 'post',
  path: '/presence/heartbeat',
  tags: ['Presence'],
  summary: 'Send a presence heartbeat (keep session active)',
});

// ---------- Updates ----------
register({
  method: 'get',
  path: '/updates',
  tags: ['Updates'],
  summary: 'List in-app product updates / changelog entries',
  response: envelope(z.array(z.object({
    id: Uuid,
    title: z.string(),
    body: z.string(),
    publishedAt: IsoDateTime,
    readAt: IsoDateTime.nullable(),
  }))),
});

register({
  method: 'post',
  path: '/updates/:id/read',
  tags: ['Updates'],
  summary: 'Mark an update as read',
  params: z.object({ id: Uuid }),
});

// ---------- Public share links ----------
register({
  method: 'get',
  path: '/share/:token',
  tags: ['Public share'],
  summary: 'Fetch a publicly shared record by share token',
  public: true,
  params: z.object({ token: z.string() }),
  response: envelope(z.record(z.string(), z.unknown())),
});
