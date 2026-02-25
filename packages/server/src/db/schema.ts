import {
  sqliteTable, text, integer, index, uniqueIndex, type AnySQLiteColumn,
} from 'drizzle-orm/sqlite-core';
import crypto from 'node:crypto';

const uuid = () => text().$defaultFn(() => crypto.randomUUID());
const timestamp = () => text();
const timestampNow = () => text().$defaultFn(() => new Date().toISOString());

export const accounts = sqliteTable('accounts', {
  id: uuid().primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  pictureUrl: text('picture_url'),
  provider: text('provider').notNull().default('google'),
  providerId: text('provider_id').notNull(),
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token').notNull(),
  tokenExpiresAt: timestamp().notNull(),
  historyId: integer('history_id'),
  lastFullSync: timestamp(),
  lastSync: timestamp(),
  syncStatus: text('sync_status').notNull().default('idle'),
  syncError: text('sync_error'),
  watchExpiration: integer('watch_expiration'), // Unix ms timestamp when Gmail push watch expires
  createdAt: timestampNow().notNull(),
  updatedAt: timestampNow().notNull(),
}, (table) => ({
  providerIdx: index('idx_accounts_provider').on(table.provider, table.providerId),
}));

export const threads = sqliteTable('threads', {
  id: uuid().primaryKey(),
  accountId: text('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  gmailThreadId: text('gmail_thread_id').notNull(),
  subject: text('subject'),
  snippet: text('snippet'),
  messageCount: integer('message_count').notNull().default(0),
  unreadCount: integer('unread_count').notNull().default(0),
  hasAttachments: integer('has_attachments', { mode: 'boolean' }).notNull().default(false),
  lastMessageAt: timestamp().notNull(),
  category: text('category').notNull().default('other'),
  labels: text('labels', { mode: 'json' }).notNull().$type<string[]>().default([]),
  isStarred: integer('is_starred', { mode: 'boolean' }).notNull().default(false),
  isArchived: integer('is_archived', { mode: 'boolean' }).notNull().default(false),
  isTrashed: integer('is_trashed', { mode: 'boolean' }).notNull().default(false),
  isSpam: integer('is_spam', { mode: 'boolean' }).notNull().default(false),
  createdAt: timestampNow().notNull(),
  updatedAt: timestampNow().notNull(),
}, (table) => ({
  accountGmailIdx: uniqueIndex('idx_threads_account_gmail').on(table.accountId, table.gmailThreadId),
  accountCategoryIdx: index('idx_threads_account_category').on(table.accountId, table.category),
  lastMessageIdx: index('idx_threads_last_message').on(table.accountId, table.lastMessageAt),
}));

export const emails = sqliteTable('emails', {
  id: uuid().primaryKey(),
  accountId: text('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  threadId: text('thread_id').notNull().references(() => threads.id, { onDelete: 'cascade' }),
  gmailMessageId: text('gmail_message_id').notNull(),
  messageIdHeader: text('message_id_header'),
  inReplyTo: text('in_reply_to'),
  referencesHeader: text('references_header'),
  fromAddress: text('from_address').notNull(),
  fromName: text('from_name'),
  toAddresses: text('to_addresses', { mode: 'json' }).notNull().$type<any[]>().default([]),
  ccAddresses: text('cc_addresses', { mode: 'json' }).notNull().$type<any[]>().default([]),
  bccAddresses: text('bcc_addresses', { mode: 'json' }).notNull().$type<any[]>().default([]),
  replyTo: text('reply_to'),
  subject: text('subject'),
  snippet: text('snippet'),
  bodyText: text('body_text'),
  bodyHtml: text('body_html'),
  bodyHtmlCompressed: text('body_html_compressed'), // gzip-compressed HTML, base64-encoded
  gmailLabels: text('gmail_labels', { mode: 'json' }).notNull().$type<string[]>().default([]),
  isUnread: integer('is_unread', { mode: 'boolean' }).notNull().default(true),
  isStarred: integer('is_starred', { mode: 'boolean' }).notNull().default(false),
  isDraft: integer('is_draft', { mode: 'boolean' }).notNull().default(false),
  internalDate: timestamp().notNull(),
  receivedAt: timestamp(),
  sizeEstimate: integer('size_estimate'),
  createdAt: timestampNow().notNull(),
  updatedAt: timestampNow().notNull(),
}, (table) => ({
  accountGmailIdx: uniqueIndex('idx_emails_account_gmail').on(table.accountId, table.gmailMessageId),
  threadIdx: index('idx_emails_thread').on(table.threadId, table.internalDate),
  accountDateIdx: index('idx_emails_account_date').on(table.accountId, table.internalDate),
}));

export const attachments = sqliteTable('attachments', {
  id: uuid().primaryKey(),
  emailId: text('email_id').notNull().references(() => emails.id, { onDelete: 'cascade' }),
  gmailAttachmentId: text('gmail_attachment_id'),
  filename: text('filename').notNull(),
  mimeType: text('mime_type').notNull(),
  size: integer('size').notNull(),
  contentId: text('content_id'),
  isInline: integer('is_inline', { mode: 'boolean' }).notNull().default(false),
  storageUrl: text('storage_url'),
  createdAt: timestampNow().notNull(),
}, (table) => ({
  emailIdx: index('idx_attachments_email').on(table.emailId),
}));

export const categoryRules = sqliteTable('category_rules', {
  id: uuid().primaryKey(),
  accountId: text('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  category: text('category').notNull(),
  priority: integer('priority').notNull().default(0),
  conditions: text('conditions', { mode: 'json' }).notNull().$type<any>(),
  isSystem: integer('is_system', { mode: 'boolean' }).notNull().default(false),
  isEnabled: integer('is_enabled', { mode: 'boolean' }).notNull().default(true),
  createdAt: timestampNow().notNull(),
  updatedAt: timestampNow().notNull(),
}, (table) => ({
  accountIdx: index('idx_category_rules_account').on(table.accountId, table.priority),
}));

export const userSettings = sqliteTable('user_settings', {
  id: uuid().primaryKey(),
  accountId: text('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }).unique(),
  theme: text('theme').notNull().default('system'),
  density: text('density').notNull().default('default'),
  shortcutsPreset: text('shortcuts_preset').notNull().default('superhuman'),
  customShortcuts: text('custom_shortcuts', { mode: 'json' }).notNull().$type<Record<string, any>>().default({}),
  autoAdvance: text('auto_advance').notNull().default('next'),
  readingPane: text('reading_pane').notNull().default('right'),
  desktopNotifications: integer('desktop_notifications', { mode: 'boolean' }).notNull().default(true),
  notificationSound: integer('notification_sound', { mode: 'boolean' }).notNull().default(false),
  signatureHtml: text('signature_html'),
  trackingEnabled: integer('tracking_enabled', { mode: 'boolean' }).notNull().default(false),
  createdAt: timestampNow().notNull(),
  updatedAt: timestampNow().notNull(),
});

export const contacts = sqliteTable('contacts', {
  id: uuid().primaryKey(),
  accountId: text('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  emails: text('emails', { mode: 'json' }).notNull().$type<string[]>().default([]),
  name: text('name'),
  givenName: text('given_name'),
  familyName: text('family_name'),
  photoUrl: text('photo_url'),
  phoneNumbers: text('phone_numbers', { mode: 'json' }).notNull().$type<string[]>().default([]),
  organization: text('organization'),
  jobTitle: text('job_title'),
  notes: text('notes'),
  googleResourceName: text('google_resource_name'),
  socialProfiles: text('social_profiles', { mode: 'json' }).$type<import('@atlasmail/shared').SocialProfile[]>(),
  enrichedAt: text('enriched_at'),
  enrichmentSource: text('enrichment_source'),
  frequency: integer('frequency').notNull().default(1),
  lastContacted: timestamp(),
  createdAt: timestampNow(),
  updatedAt: timestampNow(),
}, (table) => ({
  accountEmailIdx: uniqueIndex('idx_contacts_account_email').on(table.accountId, table.email),
  accountFreqIdx: index('idx_contacts_account_freq').on(table.accountId, table.frequency),
}));

// ─── Email tracking ─────────────────────────────────────────────────

export const emailTracking = sqliteTable('email_tracking', {
  id: uuid().primaryKey(),
  accountId: text('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  emailId: text('email_id').references((): AnySQLiteColumn => emails.id, { onDelete: 'set null' }),
  threadId: text('thread_id').references(() => threads.id, { onDelete: 'set null' }),
  trackingId: text('tracking_id').$defaultFn(() => crypto.randomUUID()).notNull().unique(),
  subject: text('subject'),
  recipientAddress: text('recipient_address').notNull(),
  openCount: integer('open_count').notNull().default(0),
  clickCount: integer('click_count').notNull().default(0),
  firstOpenedAt: timestamp(),
  lastOpenedAt: timestamp(),
  createdAt: timestampNow().notNull(),
}, (table) => ({
  accountIdx: index('idx_email_tracking_account').on(table.accountId),
  threadIdx: index('idx_email_tracking_thread').on(table.threadId),
}));

export const trackingEvents = sqliteTable('tracking_events', {
  id: uuid().primaryKey(),
  trackingId: text('tracking_id').notNull(),
  eventType: text('event_type').notNull(),
  linkUrl: text('link_url'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestampNow().notNull(),
}, (table) => ({
  trackingIdIdx: index('idx_tracking_events_tracking_id').on(table.trackingId),
  createdAtIdx: index('idx_tracking_events_created_at').on(table.createdAt),
}));
