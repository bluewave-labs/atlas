import {
  sqliteTable, text, integer, index, uniqueIndex, type AnySQLiteColumn,
} from 'drizzle-orm/sqlite-core';
import crypto from 'node:crypto';

const uuid = () => text().$defaultFn(() => crypto.randomUUID());
const timestamp = () => text();
const timestampNow = () => text().$defaultFn(() => new Date().toISOString());

// ─── Users (groups multiple accounts under one person) ──────────────
export const users = sqliteTable('users', {
  id: uuid().primaryKey(),
  createdAt: timestampNow().notNull(),
  updatedAt: timestampNow().notNull(),
});

export const accounts = sqliteTable('accounts', {
  id: uuid().primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
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
  userIdx: index('idx_accounts_user').on(table.userId),
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
  // Tasks settings
  tasksDefaultView: text('tasks_default_view').notNull().default('inbox'),
  tasksConfirmDelete: integer('tasks_confirm_delete', { mode: 'boolean' }).notNull().default(true),
  tasksShowCalendar: integer('tasks_show_calendar', { mode: 'boolean' }).notNull().default(true),
  tasksShowEvening: integer('tasks_show_evening', { mode: 'boolean' }).notNull().default(true),
  tasksShowWhenBadges: integer('tasks_show_when_badges', { mode: 'boolean' }).notNull().default(true),
  tasksShowProject: integer('tasks_show_project', { mode: 'boolean' }).notNull().default(true),
  tasksShowNotesIndicator: integer('tasks_show_notes_indicator', { mode: 'boolean' }).notNull().default(true),
  tasksCompactMode: integer('tasks_compact_mode', { mode: 'boolean' }).notNull().default(false),
  tasksCompletedBehavior: text('tasks_completed_behavior').notNull().default('fade'),
  tasksDefaultSort: text('tasks_default_sort').notNull().default('manual'),
  tasksViewMode: text('tasks_view_mode').notNull().default('list'),
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

// ─── Calendar ────────────────────────────────────────────────────────

export const calendars = sqliteTable('calendars', {
  id: uuid().primaryKey(),
  accountId: text('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  googleCalendarId: text('google_calendar_id').notNull(),
  summary: text('summary'),
  description: text('description'),
  backgroundColor: text('background_color'),
  foregroundColor: text('foreground_color'),
  timeZone: text('time_zone'),
  accessRole: text('access_role'),
  isPrimary: integer('is_primary', { mode: 'boolean' }).notNull().default(false),
  isSelected: integer('is_selected', { mode: 'boolean' }).notNull().default(true),
  syncToken: text('sync_token'),
  lastSyncAt: text('last_sync_at'),
  createdAt: text('createdAt').$defaultFn(() => new Date().toISOString()).notNull(),
  updatedAt: text('updatedAt').$defaultFn(() => new Date().toISOString()).notNull(),
}, (table) => ({
  accountGoogleIdx: uniqueIndex('idx_calendars_account_google').on(table.accountId, table.googleCalendarId),
}));

export const calendarEvents = sqliteTable('calendar_events', {
  id: uuid().primaryKey(),
  accountId: text('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  calendarId: text('calendar_id').notNull().references(() => calendars.id, { onDelete: 'cascade' }),
  googleEventId: text('google_event_id').notNull(),
  summary: text('summary'),
  description: text('description'),
  location: text('location'),
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  isAllDay: integer('is_all_day', { mode: 'boolean' }).notNull().default(false),
  status: text('status').notNull().default('confirmed'),
  selfResponseStatus: text('self_response_status'),
  htmlLink: text('html_link'),
  hangoutLink: text('hangout_link'),
  organizer: text('organizer', { mode: 'json' }).$type<{ email: string; displayName?: string; self?: boolean }>(),
  attendees: text('attendees', { mode: 'json' }).$type<Array<{ email: string; displayName?: string; responseStatus?: string }>>(),
  recurrence: text('recurrence', { mode: 'json' }).$type<string[]>(),
  recurringEventId: text('recurring_event_id'),
  transparency: text('transparency'),
  colorId: text('color_id'),
  reminders: text('reminders', { mode: 'json' }).$type<{ useDefault: boolean; overrides?: Array<{ method: string; minutes: number }> }>(),
  createdAt: timestampNow().notNull(),
  updatedAt: timestampNow().notNull(),
}, (table) => ({
  accountGoogleIdx: uniqueIndex('idx_cal_events_account_google').on(table.accountId, table.googleEventId),
  calendarIdx: index('idx_cal_events_calendar').on(table.calendarId),
  timeRangeIdx: index('idx_cal_events_time_range').on(table.accountId, table.startTime, table.endTime),
}));

// ─── Documents (Notion-style pages) ─────────────────────────────────

export const documents = sqliteTable('documents', {
  id: uuid().primaryKey(),
  accountId: text('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  parentId: text('parent_id').references((): AnySQLiteColumn => documents.id, { onDelete: 'set null' }),
  title: text('title').notNull().default('Untitled'),
  content: text('content', { mode: 'json' }).$type<Record<string, unknown> | null>().default(null),
  icon: text('icon'),
  coverImage: text('cover_image'),
  sortOrder: integer('sort_order').notNull().default(0),
  isArchived: integer('is_archived', { mode: 'boolean' }).notNull().default(false),
  createdAt: timestampNow().notNull(),
  updatedAt: timestampNow().notNull(),
}, (table) => ({
  accountIdx: index('idx_documents_account').on(table.accountId, table.isArchived),
  userIdx: index('idx_documents_user').on(table.userId, table.isArchived),
  parentIdx: index('idx_documents_parent').on(table.parentId, table.sortOrder),
  accountParentIdx: index('idx_documents_account_parent').on(table.accountId, table.parentId, table.sortOrder),
  userParentIdx: index('idx_documents_user_parent').on(table.userId, table.parentId, table.sortOrder),
}));

export const documentVersions = sqliteTable('document_versions', {
  id: uuid().primaryKey(),
  documentId: text('document_id').notNull().references(() => documents.id, { onDelete: 'cascade' }),
  accountId: text('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  content: text('content', { mode: 'json' }).$type<Record<string, unknown> | null>().default(null),
  createdAt: timestampNow().notNull(),
}, (table) => ({
  docIdx: index('idx_document_versions_doc').on(table.documentId, table.createdAt),
}));

// ─── Drawings (Excalidraw whiteboards) ──────────────────────────────

// ─── Task Projects ──────────────────────────────────────────────────

export const taskProjects = sqliteTable('task_projects', {
  id: uuid().primaryKey(),
  accountId: text('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull().default('Untitled project'),
  description: text('description'),
  icon: text('icon'),
  color: text('color').notNull().default('#5a7fa0'),
  sortOrder: integer('sort_order').notNull().default(0),
  isArchived: integer('is_archived', { mode: 'boolean' }).notNull().default(false),
  createdAt: timestampNow().notNull(),
  updatedAt: timestampNow().notNull(),
}, (table) => ({
  userIdx: index('idx_task_projects_user').on(table.userId, table.isArchived),
}));

// ─── Tasks ──────────────────────────────────────────────────────────

export const tasks = sqliteTable('tasks', {
  id: uuid().primaryKey(),
  accountId: text('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  projectId: text('project_id').references(() => taskProjects.id, { onDelete: 'set null' }),
  title: text('title').notNull().default(''),
  notes: text('notes'),
  description: text('description'),                        // HTML from Tiptap rich editor
  icon: text('icon'),                                      // task-level emoji icon
  type: text('type').notNull().default('task'),            // task | heading
  headingId: text('heading_id'),                           // FK to tasks(id) for section grouping
  status: text('status').notNull().default('todo'),        // todo | completed | cancelled
  when: text('when').notNull().default('inbox'),           // inbox | today | evening | anytime | someday
  priority: text('priority').notNull().default('none'),    // none | low | medium | high
  dueDate: text('due_date'),
  completedAt: text('completed_at'),
  tags: text('tags', { mode: 'json' }).notNull().$type<string[]>().default([]),
  recurrenceRule: text('recurrence_rule'),
  recurrenceParentId: text('recurrence_parent_id').references((): AnySQLiteColumn => tasks.id, { onDelete: 'set null' }),
  sortOrder: integer('sort_order').notNull().default(0),
  isArchived: integer('is_archived', { mode: 'boolean' }).notNull().default(false),
  createdAt: timestampNow().notNull(),
  updatedAt: timestampNow().notNull(),
}, (table) => ({
  userStatusIdx: index('idx_tasks_user_status').on(table.userId, table.status, table.isArchived),
  userWhenIdx: index('idx_tasks_user_when').on(table.userId, table.when, table.status),
  projectIdx: index('idx_tasks_project').on(table.projectId, table.sortOrder),
  dueDateIdx: index('idx_tasks_due_date').on(table.userId, table.dueDate),
}));

// ─── Drawings (Excalidraw whiteboards) ──────────────────────────────

export const drawings = sqliteTable('drawings', {
  id: uuid().primaryKey(),
  accountId: text('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull().default('Untitled drawing'),
  content: text('content', { mode: 'json' }).$type<Record<string, unknown> | null>().default(null),
  thumbnailUrl: text('thumbnail_url'),
  sortOrder: integer('sort_order').notNull().default(0),
  isArchived: integer('is_archived', { mode: 'boolean' }).notNull().default(false),
  createdAt: timestampNow().notNull(),
  updatedAt: timestampNow().notNull(),
}, (table) => ({
  accountIdx: index('idx_drawings_account').on(table.accountId, table.isArchived),
  userIdx: index('idx_drawings_user').on(table.userId, table.isArchived),
}));
