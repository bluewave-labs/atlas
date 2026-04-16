import {
  pgTable, text, uuid, varchar, integer, bigint, boolean, jsonb,
  timestamp, index, uniqueIndex, real, type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { customType } from 'drizzle-orm/pg-core';

// Custom tsvector type for full-text search
const tsvector = customType<{ data: string }>({
  dataType() {
    return 'tsvector';
  },
});

// ─── Users (groups multiple accounts under one person) ──────────────

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name'),
  email: text('email'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  email: text('email').notNull().unique(),
  name: text('name'),
  pictureUrl: text('picture_url'),
  provider: text('provider').notNull().default('google'),
  providerId: text('provider_id').notNull(),
  passwordHash: text('password_hash'),
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token').notNull(),
  tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }).notNull(),
  historyId: integer('history_id'),
  lastFullSync: timestamp('last_full_sync', { withTimezone: true }),
  lastSync: timestamp('last_sync', { withTimezone: true }),
  syncStatus: text('sync_status').notNull().default('idle'),
  syncError: text('sync_error'),
  watchExpiration: bigint('watch_expiration', { mode: 'number' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  providerIdx: index('idx_accounts_provider').on(table.provider, table.providerId),
  userIdx: index('idx_accounts_user').on(table.userId),
}));

export const threads = pgTable('threads', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  gmailThreadId: text('gmail_thread_id').notNull(),
  subject: text('subject'),
  snippet: text('snippet'),
  messageCount: integer('message_count').notNull().default(0),
  unreadCount: integer('unread_count').notNull().default(0),
  hasAttachments: boolean('has_attachments').notNull().default(false),
  lastMessageAt: timestamp('last_message_at', { withTimezone: true }).notNull(),
  category: text('category').notNull().default('other'),
  labels: jsonb('labels').$type<string[]>().notNull().default([]),
  isStarred: boolean('is_starred').notNull().default(false),
  isArchived: boolean('is_archived').notNull().default(false),
  isTrashed: boolean('is_trashed').notNull().default(false),
  isSpam: boolean('is_spam').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  accountGmailIdx: uniqueIndex('idx_threads_account_gmail').on(table.accountId, table.gmailThreadId),
  accountCategoryIdx: index('idx_threads_account_category').on(table.accountId, table.category),
  lastMessageIdx: index('idx_threads_last_message').on(table.accountId, table.lastMessageAt),
}));

export const emails = pgTable('emails', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  threadId: uuid('thread_id').notNull().references(() => threads.id, { onDelete: 'cascade' }),
  gmailMessageId: text('gmail_message_id').notNull(),
  messageIdHeader: text('message_id_header'),
  inReplyTo: text('in_reply_to'),
  referencesHeader: text('references_header'),
  fromAddress: text('from_address').notNull(),
  fromName: text('from_name'),
  toAddresses: jsonb('to_addresses').$type<any[]>().notNull().default([]),
  ccAddresses: jsonb('cc_addresses').$type<any[]>().notNull().default([]),
  bccAddresses: jsonb('bcc_addresses').$type<any[]>().notNull().default([]),
  replyTo: text('reply_to'),
  subject: text('subject'),
  snippet: text('snippet'),
  bodyText: text('body_text'),
  bodyHtml: text('body_html'),
  bodyHtmlCompressed: text('body_html_compressed'),
  gmailLabels: jsonb('gmail_labels').$type<string[]>().notNull().default([]),
  isUnread: boolean('is_unread').notNull().default(true),
  isStarred: boolean('is_starred').notNull().default(false),
  isDraft: boolean('is_draft').notNull().default(false),
  internalDate: timestamp('internal_date', { withTimezone: true }).notNull(),
  receivedAt: timestamp('received_at', { withTimezone: true }),
  sizeEstimate: integer('size_estimate'),
  searchVector: tsvector('search_vector'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  accountGmailIdx: uniqueIndex('idx_emails_account_gmail').on(table.accountId, table.gmailMessageId),
  threadIdx: index('idx_emails_thread').on(table.threadId, table.internalDate),
  accountDateIdx: index('idx_emails_account_date').on(table.accountId, table.internalDate),
}));

export const attachments = pgTable('attachments', {
  id: uuid('id').primaryKey().defaultRandom(),
  emailId: uuid('email_id').notNull().references(() => emails.id, { onDelete: 'cascade' }),
  gmailAttachmentId: text('gmail_attachment_id'),
  filename: text('filename').notNull(),
  mimeType: text('mime_type').notNull(),
  size: integer('size').notNull(),
  contentId: text('content_id'),
  isInline: boolean('is_inline').notNull().default(false),
  storageUrl: text('storage_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  emailIdx: index('idx_attachments_email').on(table.emailId),
}));

export const categoryRules = pgTable('category_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  category: text('category').notNull(),
  priority: integer('priority').notNull().default(0),
  conditions: jsonb('conditions').$type<any>().notNull(),
  isSystem: boolean('is_system').notNull().default(false),
  isEnabled: boolean('is_enabled').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  accountIdx: index('idx_category_rules_account').on(table.accountId, table.priority),
}));

export const userSettings = pgTable('user_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }).unique(),
  theme: text('theme').notNull().default('system'),
  density: text('density').notNull().default('default'),
  shortcutsPreset: text('shortcuts_preset').notNull().default('superhuman'),
  customShortcuts: jsonb('custom_shortcuts').$type<Record<string, any>>().notNull().default({}),
  autoAdvance: text('auto_advance').notNull().default('next'),
  readingPane: text('reading_pane').notNull().default('right'),
  desktopNotifications: boolean('desktop_notifications').notNull().default(true),
  notificationSound: boolean('notification_sound').notNull().default(false),
  signatureHtml: text('signature_html'),
  trackingEnabled: boolean('tracking_enabled').notNull().default(false),
  // Tasks settings
  tasksDefaultView: text('tasks_default_view').notNull().default('inbox'),
  tasksConfirmDelete: boolean('tasks_confirm_delete').notNull().default(true),
  tasksShowCalendar: boolean('tasks_show_calendar').notNull().default(true),
  tasksShowEvening: boolean('tasks_show_evening').notNull().default(true),
  tasksShowWhenBadges: boolean('tasks_show_when_badges').notNull().default(true),
  tasksShowProject: boolean('tasks_show_project').notNull().default(true),
  tasksShowNotesIndicator: boolean('tasks_show_notes_indicator').notNull().default(true),
  tasksCompactMode: boolean('tasks_compact_mode').notNull().default(false),
  tasksCompletedBehavior: text('tasks_completed_behavior').notNull().default('fade'),
  tasksDefaultSort: text('tasks_default_sort').notNull().default('manual'),
  tasksViewMode: text('tasks_view_mode').notNull().default('list'),
  // Global settings
  dateFormat: text('date_format').notNull().default('DD/MM/YYYY'),
  currencySymbol: text('currency_symbol').notNull().default('$'),
  timezone: text('timezone').notNull().default(''),
  timeFormat: text('time_format').notNull().default('12h'),
  numberFormat: text('number_format').notNull().default('comma-period'),
  calendarStartDay: text('calendar_start_day').notNull().default('monday'),
  // Calendar settings
  calDefaultView: text('cal_default_view').notNull().default('week'),
  calWeekStartsOnMonday: boolean('cal_week_starts_on_monday').notNull().default(false),
  calShowWeekNumbers: boolean('cal_show_week_numbers').notNull().default(false),
  calDensity: text('cal_density').notNull().default('default'),
  calWorkStartHour: integer('cal_work_start_hour').notNull().default(9),
  calWorkEndHour: integer('cal_work_end_hour').notNull().default(17),
  calSecondaryTimezone: text('cal_secondary_timezone'),
  calEventReminderMinutes: integer('cal_event_reminder_minutes').notNull().default(10),
  // General app settings
  language: text('language').notNull().default('en'),
  fontFamily: text('font_family').notNull().default('inter'),
  colorTheme: text('color_theme').notNull().default('default'),
  showBadgeCount: boolean('show_badge_count').notNull().default(true),
  notificationLevel: text('notification_level').notNull().default('smart'),
  composeMode: text('compose_mode').notNull().default('rich'),
  signature: text('signature').notNull().default(''),
  includeSignatureInReplies: boolean('include_signature_in_replies').notNull().default(true),
  undoSendDelay: integer('undo_send_delay').notNull().default(5),
  sendAnimation: boolean('send_animation').notNull().default(true),
  themeTransition: boolean('theme_transition').notNull().default(true),
  // AI settings
  aiEnabled: boolean('ai_enabled').notNull().default(false),
  aiProvider: text('ai_provider').notNull().default('openai'),
  aiApiKeys: jsonb('ai_api_keys').$type<Record<string, string>>().notNull().default({}),
  aiCustomProvider: jsonb('ai_custom_provider').$type<Record<string, string>>().notNull().default({}),
  aiWritingAssistant: boolean('ai_writing_assistant').notNull().default(true),
  aiQuickReplies: boolean('ai_quick_replies').notNull().default(true),
  aiThreadSummary: boolean('ai_thread_summary').notNull().default(true),
  aiTranslation: boolean('ai_translation').notNull().default(true),
  // Docs settings
  docsFontStyle: text('docs_font_style').notNull().default('default'),
  docsSmallText: boolean('docs_small_text').notNull().default(false),
  docsFullWidth: boolean('docs_full_width').notNull().default(false),
  docsSpellCheck: boolean('docs_spell_check').notNull().default(true),
  docsOpenLastVisited: boolean('docs_open_last_visited').notNull().default(true),
  docsSidebarDefault: text('docs_sidebar_default').notNull().default('tree'),
  docFavorites: jsonb('doc_favorites').$type<string[]>().notNull().default([]),
  docRecent: jsonb('doc_recent').$type<string[]>().notNull().default([]),
  // Draw settings
  drawGridMode: boolean('draw_grid_mode').notNull().default(false),
  drawSnapToGrid: boolean('draw_snap_to_grid').notNull().default(false),
  drawDefaultBackground: text('draw_default_background').notNull().default('white'),
  drawExportQuality: integer('draw_export_quality').notNull().default(1),
  drawExportWithBackground: boolean('draw_export_with_background').notNull().default(true),
  drawAutoSaveInterval: integer('draw_auto_save_interval').notNull().default(2000),
  drawSortOrder: text('draw_sort_order').notNull().default('modified'),
  drawLibrary: jsonb('draw_library').$type<unknown[]>().notNull().default([]),
  // Drive settings
  driveDefaultView: text('drive_default_view').notNull().default('list'),
  driveDefaultSort: text('drive_default_sort').notNull().default('default'),
  driveSidebarDefault: text('drive_sidebar_default').notNull().default('files'),
  driveShowPreviewPanel: boolean('drive_show_preview_panel').notNull().default(true),
  driveCompactMode: boolean('drive_compact_mode').notNull().default(false),
  driveConfirmDelete: boolean('drive_confirm_delete').notNull().default(true),
  driveAutoVersionOnReplace: boolean('drive_auto_version_on_replace').notNull().default(true),
  driveMaxVersions: integer('drive_max_versions').notNull().default(20),
  driveShareDefaultExpiry: text('drive_share_default_expiry').notNull().default('never'),
  driveDuplicateHandling: text('drive_duplicate_handling').notNull().default('rename'),
  driveShowThumbnails: boolean('drive_show_thumbnails').notNull().default(true),
  driveShowFileExtensions: boolean('drive_show_file_extensions').notNull().default(true),
  driveSortOrder: text('drive_sort_order').notNull().default('asc'),
  // Search
  recentSearches: jsonb('recent_searches').$type<string[]>().notNull().default([]),
  // Home
  homeBgType: text('home_bg_type').notNull().default('unsplash'),
  homeBgValue: text('home_bg_value'),
  homeBgRotate: boolean('home_bg_rotate').notNull().default(false),
  homeShowSeconds: boolean('home_show_seconds').notNull().default(true),
  homeEnabledWidgets: jsonb('home_enabled_widgets').$type<string[] | null>(),
  homeDockPet: varchar('home_dock_pet', { length: 20 }).notNull().default('cat'),
  homeFlyingBirds: boolean('home_flying_birds').notNull().default(false),
  homeDemoDataActive: boolean('home_demo_data_active').notNull().default(false),
  appWidgets: jsonb('app_widgets').$type<Record<string, { enabledIds: string[]; order: string[] }> | null>(),
  recentItems: jsonb('recent_items').$type<string[]>().notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const contacts = pgTable('contacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  emails: jsonb('emails').$type<string[]>().notNull().default([]),
  name: text('name'),
  givenName: text('given_name'),
  familyName: text('family_name'),
  photoUrl: text('photo_url'),
  phoneNumbers: jsonb('phone_numbers').$type<string[]>().notNull().default([]),
  organization: text('organization'),
  jobTitle: text('job_title'),
  notes: text('notes'),
  googleResourceName: text('google_resource_name'),
  frequency: integer('frequency').notNull().default(1),
  lastContacted: timestamp('last_contacted', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  accountEmailIdx: uniqueIndex('idx_contacts_account_email').on(table.accountId, table.email),
  accountFreqIdx: index('idx_contacts_account_freq').on(table.accountId, table.frequency),
}));

// ─── Email tracking ─────────────────────────────────────────────────

export const emailTracking = pgTable('email_tracking', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  emailId: uuid('email_id').references((): AnyPgColumn => emails.id, { onDelete: 'set null' }),
  threadId: uuid('thread_id').references(() => threads.id, { onDelete: 'set null' }),
  trackingId: uuid('tracking_id').defaultRandom().notNull().unique(),
  subject: text('subject'),
  recipientAddress: text('recipient_address').notNull(),
  openCount: integer('open_count').notNull().default(0),
  clickCount: integer('click_count').notNull().default(0),
  firstOpenedAt: timestamp('first_opened_at', { withTimezone: true }),
  lastOpenedAt: timestamp('last_opened_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  accountIdx: index('idx_email_tracking_account').on(table.accountId),
  threadIdx: index('idx_email_tracking_thread').on(table.threadId),
}));

export const trackingEvents = pgTable('tracking_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  trackingId: uuid('tracking_id').notNull(),
  eventType: text('event_type').notNull(),
  linkUrl: text('link_url'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  trackingIdIdx: index('idx_tracking_events_tracking_id').on(table.trackingId),
  createdAtIdx: index('idx_tracking_events_created_at').on(table.createdAt),
}));

// ─── Calendar ────────────────────────────────────────────────────────

export const calendars = pgTable('calendars', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  googleCalendarId: text('google_calendar_id').notNull(),
  summary: text('summary'),
  description: text('description'),
  backgroundColor: text('background_color'),
  foregroundColor: text('foreground_color'),
  timeZone: text('time_zone'),
  accessRole: text('access_role'),
  isPrimary: boolean('is_primary').notNull().default(false),
  isSelected: boolean('is_selected').notNull().default(true),
  syncToken: text('sync_token'),
  lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  accountGoogleIdx: uniqueIndex('idx_calendars_account_google').on(table.accountId, table.googleCalendarId),
}));

export const calendarEvents = pgTable('calendar_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  calendarId: uuid('calendar_id').notNull().references(() => calendars.id, { onDelete: 'cascade' }),
  googleEventId: text('google_event_id').notNull(),
  summary: text('summary'),
  description: text('description'),
  location: text('location'),
  startTime: timestamp('start_time', { withTimezone: true }).notNull(),
  endTime: timestamp('end_time', { withTimezone: true }).notNull(),
  isAllDay: boolean('is_all_day').notNull().default(false),
  status: text('status').notNull().default('confirmed'),
  selfResponseStatus: text('self_response_status'),
  htmlLink: text('html_link'),
  hangoutLink: text('hangout_link'),
  organizer: jsonb('organizer').$type<{ email: string; displayName?: string; self?: boolean }>(),
  attendees: jsonb('attendees').$type<Array<{ email: string; displayName?: string; responseStatus?: string }>>(),
  recurrence: jsonb('recurrence').$type<string[]>(),
  recurringEventId: text('recurring_event_id'),
  transparency: text('transparency'),
  colorId: text('color_id'),
  reminders: jsonb('reminders').$type<{ useDefault: boolean; overrides?: Array<{ method: string; minutes: number }> }>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  accountGoogleIdx: uniqueIndex('idx_cal_events_account_google').on(table.accountId, table.googleEventId),
  calendarIdx: index('idx_cal_events_calendar').on(table.calendarId),
  timeRangeIdx: index('idx_cal_events_time_range').on(table.accountId, table.startTime, table.endTime),
}));

// ─── Password Reset Tokens ───────────────────────────────────────────

export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ─── Documents (Notion-style pages) ─────────────────────────────────

export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  parentId: uuid('parent_id').references((): AnyPgColumn => documents.id, { onDelete: 'set null' }),
  title: text('title').notNull().default('Untitled'),
  content: jsonb('content').$type<Record<string, unknown> | null>().default(null),
  icon: text('icon'),
  coverImage: text('cover_image'),
  sortOrder: integer('sort_order').notNull().default(0),
  isArchived: boolean('is_archived').notNull().default(false),
  visibility: varchar('visibility', { length: 10 }).notNull().default('private'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('idx_documents_tenant').on(table.tenantId, table.isArchived),
  userIdx: index('idx_documents_user').on(table.userId, table.isArchived),
  parentIdx: index('idx_documents_parent').on(table.parentId, table.sortOrder),
  tenantParentIdx: index('idx_documents_tenant_parent').on(table.tenantId, table.parentId, table.sortOrder),
  userParentIdx: index('idx_documents_user_parent').on(table.userId, table.parentId, table.sortOrder),
}));

export const documentVersions = pgTable('document_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  documentId: uuid('document_id').notNull().references(() => documents.id, { onDelete: 'cascade' }),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  content: jsonb('content').$type<Record<string, unknown> | null>().default(null),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  docIdx: index('idx_document_versions_doc').on(table.documentId, table.createdAt),
}));

// ─── Tasks ──────────────────────────────────────────────────────────

export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').references(() => projectProjects.id, { onDelete: 'set null' }),
  isPrivate: boolean('is_private').notNull().default(false),
  title: text('title').notNull().default(''),
  notes: text('notes'),
  description: text('description'),
  icon: text('icon'),
  type: text('type').notNull().default('task'),
  headingId: uuid('heading_id'),
  status: text('status').notNull().default('todo'),
  when: text('when').notNull().default('inbox'),
  priority: text('priority').notNull().default('none'),
  dueDate: text('due_date'),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  tags: jsonb('tags').$type<string[]>().notNull().default([]),
  recurrenceRule: text('recurrence_rule'),
  recurrenceParentId: uuid('recurrence_parent_id').references((): AnyPgColumn => tasks.id, { onDelete: 'set null' }),
  sourceEmailId: text('source_email_id'),
  sourceEmailSubject: text('source_email_subject'),
  assigneeId: uuid('assignee_id'),
  lastReminderAt: timestamp('last_reminder_at', { withTimezone: true }),
  sortOrder: integer('sort_order').notNull().default(0),
  isArchived: boolean('is_archived').notNull().default(false),
  visibility: varchar('visibility', { length: 10 }).notNull().default('team'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userStatusIdx: index('idx_tasks_user_status').on(table.userId, table.status, table.isArchived),
  userWhenIdx: index('idx_tasks_user_when').on(table.userId, table.when, table.status),
  projectIdx: index('idx_tasks_project').on(table.projectId, table.sortOrder),
  dueDateIdx: index('idx_tasks_due_date').on(table.userId, table.dueDate),
  userPrivateIdx: index('idx_tasks_user_private').on(table.userId, table.isPrivate),
}));

// ─── Drive (file storage) ────────────────────────────────────────────

export const driveItems = pgTable('drive_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: text('type').notNull().default('file'),
  mimeType: text('mime_type'),
  size: integer('size'),
  parentId: uuid('parent_id').references((): AnyPgColumn => driveItems.id, { onDelete: 'set null' }),
  storagePath: text('storage_path'),
  icon: text('icon'),
  linkedResourceType: text('linked_resource_type'),
  linkedResourceId: text('linked_resource_id'),
  isFavourite: boolean('is_favourite').notNull().default(false),
  isArchived: boolean('is_archived').notNull().default(false),
  tags: jsonb('tags').$type<string[]>().notNull().default([]),
  uploadSource: jsonb('upload_source'),
  sortOrder: integer('sort_order').notNull().default(0),
  visibility: varchar('visibility', { length: 10 }).notNull().default('private'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userParentIdx: index('idx_drive_items_user_parent').on(table.userId, table.parentId, table.isArchived),
  userArchivedIdx: index('idx_drive_items_user_archived').on(table.userId, table.isArchived),
  userFavouriteIdx: index('idx_drive_items_user_favourite').on(table.userId, table.isFavourite),
}));

// ─── Drive item versions (file versioning) ───────────────────────────

export const driveItemVersions = pgTable('drive_item_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  driveItemId: uuid('drive_item_id').notNull().references(() => driveItems.id, { onDelete: 'cascade' }),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  mimeType: text('mime_type'),
  size: integer('size'),
  storagePath: text('storage_path'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  itemIdx: index('idx_drive_versions_item').on(table.driveItemId, table.createdAt),
}));

// ─── Drive share links ───────────────────────────────────────────────

export const driveShareLinks = pgTable('drive_share_links', {
  id: uuid('id').primaryKey().defaultRandom(),
  driveItemId: uuid('drive_item_id').notNull().references(() => driveItems.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  shareToken: text('share_token').notNull().unique(),
  passwordHash: text('password_hash'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  mode: varchar('mode', { length: 20 }).notNull().default('view'),
  uploadInstructions: text('upload_instructions'),
  requireUploaderEmail: boolean('require_uploader_email').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tokenIdx: index('idx_share_links_token').on(table.shareToken),
  itemIdx: index('idx_share_links_item').on(table.driveItemId),
}));

// ─── Drive item shares (per-user sharing) ───────────────────────────

export const driveItemShares = pgTable('drive_item_shares', {
  id: uuid('id').primaryKey().defaultRandom(),
  driveItemId: uuid('drive_item_id').notNull().references(() => driveItems.id, { onDelete: 'cascade' }),
  sharedWithUserId: uuid('shared_with_user_id').notNull(),
  permission: varchar('permission', { length: 20 }).notNull().default('view'),
  sharedByUserId: uuid('shared_by_user_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  uniqueIdx: uniqueIndex('idx_drive_shares_unique').on(table.driveItemId, table.sharedWithUserId),
  sharedWithIdx: index('idx_drive_shares_user').on(table.sharedWithUserId),
}));

// ─── Drive activity log ────────────────────────────────────────────

export const driveActivityLog = pgTable('drive_activity_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  driveItemId: uuid('drive_item_id').notNull().references(() => driveItems.id, { onDelete: 'cascade' }),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  userId: uuid('user_id').notNull(),
  action: varchar('action', { length: 100 }).notNull(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  itemIdx: index('idx_drive_activity_item').on(table.driveItemId),
}));

// ─── Drive comments ────────────────────────────────────────────────

export const driveComments = pgTable('drive_comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  driveItemId: uuid('drive_item_id').notNull().references(() => driveItems.id, { onDelete: 'cascade' }),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  userId: uuid('user_id').notNull(),
  body: text('body').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  itemIdx: index('idx_drive_comments_item').on(table.driveItemId),
}));

export const drawings = pgTable('drawings', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull().default('Untitled drawing'),
  content: jsonb('content').$type<Record<string, unknown> | null>().default(null),
  thumbnailUrl: text('thumbnail_url'),
  sortOrder: integer('sort_order').notNull().default(0),
  isArchived: boolean('is_archived').notNull().default(false),
  visibility: varchar('visibility', { length: 10 }).notNull().default('private'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('idx_drawings_tenant').on(table.tenantId, table.isArchived),
  userIdx: index('idx_drawings_user').on(table.userId, table.isArchived),
}));

// ─── Notifications ──────────────────────────────────────────────────

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  type: text('type').notNull().default('reminder'),
  title: text('title').notNull(),
  body: text('body'),
  sourceType: text('source_type'),
  sourceId: text('source_id'),
  isRead: boolean('is_read').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdx: index('idx_notifications_user').on(table.userId, table.isRead),
  userCreatedIdx: index('idx_notifications_user_created').on(table.userId, table.createdAt),
}));

// ─── Activity Feed ─────────────────────────────────────────────────

export const activityFeed = pgTable('activity_feed', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  userId: uuid('user_id').notNull(),
  appId: varchar('app_id', { length: 50 }).notNull(),
  eventType: varchar('event_type', { length: 100 }).notNull(),
  title: text('title').notNull(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantCreatedIdx: index('idx_activity_feed_tenant_created').on(table.tenantId, table.createdAt),
  userIdx: index('idx_activity_feed_user').on(table.userId),
}));

// ─── Push Subscriptions ─────────────────────────────────────────────

export const pushSubscriptions = pgTable('push_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  endpoint: text('endpoint').notNull(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdx: index('idx_push_subscriptions_user').on(table.userId),
}));

// ─── Subtasks ────────────────────────────────────────────────────────

export const subtasks = pgTable('subtasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  taskId: uuid('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull().default(''),
  isCompleted: boolean('is_completed').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  taskIdx: index('idx_subtasks_task').on(table.taskId, table.sortOrder),
}));

// ─── Task Activities ─────────────────────────────────────────────────

export const taskActivities = pgTable('task_activities', {
  id: uuid('id').primaryKey().defaultRandom(),
  taskId: uuid('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  action: text('action').notNull(),
  field: text('field'),
  oldValue: text('old_value'),
  newValue: text('new_value'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  taskIdx: index('idx_task_activities_task').on(table.taskId, table.createdAt),
}));

// ─── Task Templates ──────────────────────────────────────────────────

export const taskTemplates = pgTable('task_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  title: text('title').notNull().default('Untitled template'),
  description: text('description'),
  icon: text('icon'),
  defaultWhen: text('default_when').notNull().default('inbox'),
  defaultPriority: text('default_priority').notNull().default('none'),
  defaultTags: jsonb('default_tags').$type<string[]>().notNull().default([]),
  subtaskTitles: jsonb('subtask_titles').$type<string[]>().notNull().default([]),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdx: index('idx_task_templates_user').on(table.userId),
}));

// ─── Task Comments ────────���────────────────────────────────────────

export const taskComments = pgTable('task_comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  taskId: uuid('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  userId: uuid('user_id').notNull(),
  body: text('body').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  taskIdx: index('idx_task_comments_task').on(table.taskId),
}));

// ─── Task Attachments ──────────────────────────────────────────────

export const taskAttachments = pgTable('task_attachments', {
  id: uuid('id').primaryKey().defaultRandom(),
  taskId: uuid('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  userId: uuid('user_id').notNull(),
  fileName: varchar('file_name', { length: 500 }).notNull(),
  storagePath: text('storage_path').notNull(),
  mimeType: varchar('mime_type', { length: 255 }),
  size: integer('size').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  taskIdx: index('idx_task_attachments_task').on(table.taskId),
}));

// ─── Task Dependencies ─────────────────────────────────────────────

export const taskDependencies = pgTable('task_dependencies', {
  id: uuid('id').primaryKey().defaultRandom(),
  taskId: uuid('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  blockedByTaskId: uuid('blocked_by_task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  taskIdx: index('idx_task_deps_task').on(table.taskId),
  blockerIdx: index('idx_task_deps_blocker').on(table.blockedByTaskId),
  uniqueDep: uniqueIndex('idx_task_deps_unique').on(table.taskId, table.blockedByTaskId),
}));

// ��── Document Comments ────────���─────────────────────────────────────

export const documentComments = pgTable('document_comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  documentId: uuid('document_id').notNull().references(() => documents.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  content: text('content').notNull(),
  selectionFrom: integer('selection_from'),
  selectionTo: integer('selection_to'),
  selectionText: text('selection_text'),
  isResolved: boolean('is_resolved').notNull().default(false),
  parentId: uuid('parent_id').references((): AnyPgColumn => documentComments.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  docIdx: index('idx_document_comments_doc').on(table.documentId),
  parentIdx: index('idx_document_comments_parent').on(table.parentId),
}));

// ─── Document Links ─────────────────────────────────────────────────

export const documentLinks = pgTable('document_links', {
  id: uuid('id').primaryKey().defaultRandom(),
  sourceDocId: uuid('source_doc_id').notNull().references(() => documents.id, { onDelete: 'cascade' }),
  targetDocId: uuid('target_doc_id').notNull().references(() => documents.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  sourceIdx: index('idx_document_links_source').on(table.sourceDocId),
  targetIdx: index('idx_document_links_target').on(table.targetDocId),
  uniqueLink: uniqueIndex('idx_document_links_unique').on(table.sourceDocId, table.targetDocId),
}));

// ─── Platform: Tenants ──────────────────────────────────────────────

export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: varchar('slug', { length: 63 }).unique().notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  plan: varchar('plan', { length: 50 }).notNull().default('starter'),
  status: varchar('status', { length: 50 }).notNull().default('active'),
  ownerId: uuid('owner_id').notNull(),
  k8sNamespace: varchar('k8s_namespace', { length: 63 }).unique().notNull(),
  quotaCpu: integer('quota_cpu').notNull().default(2000),
  quotaMemoryMb: integer('quota_memory_mb').notNull().default(4096),
  quotaStorageMb: integer('quota_storage_mb').notNull().default(20480),
  storageQuotaBytes: bigint('storage_quota_bytes', { mode: 'number' }).notNull().default(10737418240),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  slugIdx: uniqueIndex('idx_tenants_slug').on(table.slug),
  ownerIdx: index('idx_tenants_owner').on(table.ownerId),
}));

// ─── Platform: Tenant Members ───────────────────────────────────────

export const tenantMembers = pgTable('tenant_members', {
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull(),
  role: varchar('role', { length: 50 }).notNull().default('member'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  uniqueMember: uniqueIndex('idx_tenant_members_unique').on(table.tenantId, table.userId),
}));

// ─── Platform: Tenant Invitations ───────────────────────────────────

export const tenantInvitations = pgTable('tenant_invitations', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  email: varchar('email', { length: 255 }).notNull(),
  role: varchar('role', { length: 50 }).notNull().default('member'),
  invitedBy: uuid('invited_by').notNull(),
  token: varchar('token', { length: 255 }).unique().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  appPermissions: jsonb('app_permissions').$type<Array<{ appId: string; enabled: boolean; role: string; recordAccess?: string }> | null>(),
  crmTeamId: uuid('crm_team_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantEmailIdx: uniqueIndex('idx_tenant_invitations_tenant_email').on(table.tenantId, table.email),
  tokenIdx: uniqueIndex('idx_tenant_invitations_token').on(table.token),
}));

// ─── Platform: Tenant Apps ─────────────────────────────────────────

export const tenantApps = pgTable('tenant_apps', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  appId: varchar('app_id', { length: 100 }).notNull(),
  isEnabled: boolean('is_enabled').notNull().default(true),
  enabledAt: timestamp('enabled_at', { withTimezone: true }).defaultNow().notNull(),
  enabledBy: uuid('enabled_by').notNull(),
  config: jsonb('config').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantAppIdx: uniqueIndex('idx_tenant_apps_unique').on(table.tenantId, table.appId),
  tenantIdx: index('idx_tenant_apps_tenant').on(table.tenantId),
}));

// ─── Custom Field Definitions ──────────────────────────────────────

export const customFieldDefinitions = pgTable('custom_field_definitions', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
  appId: varchar('app_id', { length: 100 }).notNull(),
  recordType: varchar('record_type', { length: 100 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull(),
  fieldType: varchar('field_type', { length: 50 }).notNull(),
  options: jsonb('options').$type<Record<string, unknown>>().notNull().default({}),
  isRequired: boolean('is_required').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  createdBy: uuid('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantAppIdx: index('idx_cfd_tenant_app').on(table.tenantId, table.appId, table.recordType),
  slugIdx: uniqueIndex('idx_cfd_slug_unique').on(table.tenantId, table.appId, table.recordType, table.slug),
}));

export const customFieldValues = pgTable('custom_field_values', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  fieldDefinitionId: uuid('field_definition_id').notNull().references(() => customFieldDefinitions.id, { onDelete: 'cascade' }),
  recordId: uuid('record_id').notNull(),
  value: jsonb('value').$type<unknown>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  recordFieldIdx: uniqueIndex('idx_cfv_record_field').on(table.recordId, table.fieldDefinitionId),
  fieldIdx: index('idx_cfv_field').on(table.fieldDefinitionId),
  recordIdx: index('idx_cfv_record').on(table.recordId),
  tenantIdx: index('idx_cfv_tenant').on(table.tenantId),
}));

// ─── Cross-App Record Links ────────────────────────────────────────

export const recordLinks = pgTable('record_links', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
  sourceAppId: varchar('source_app_id', { length: 100 }).notNull(),
  sourceRecordId: uuid('source_record_id').notNull(),
  targetAppId: varchar('target_app_id', { length: 100 }).notNull(),
  targetRecordId: uuid('target_record_id').notNull(),
  linkType: varchar('link_type', { length: 100 }).notNull().default('related'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  createdBy: uuid('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  sourceIdx: index('idx_record_links_source').on(table.sourceAppId, table.sourceRecordId),
  targetIdx: index('idx_record_links_target').on(table.targetAppId, table.targetRecordId),
  uniqueLink: uniqueIndex('idx_record_links_unique').on(
    table.sourceAppId, table.sourceRecordId,
    table.targetAppId, table.targetRecordId,
    table.linkType,
  ),
}));

// ─── Signature: Documents ──────────────────────────────────────────
export const signatureDocuments = pgTable('signature_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  userId: uuid('user_id').notNull(),
  title: varchar('title', { length: 500 }).notNull(),
  fileName: varchar('file_name', { length: 500 }).notNull(),
  storagePath: text('storage_path').notNull(),
  pageCount: integer('page_count').notNull().default(1),
  status: varchar('status', { length: 50 }).notNull().default('draft'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  tags: jsonb('tags').$type<string[]>().notNull().default([]),
  documentType: varchar('document_type', { length: 50 }).notNull().default('contract'),
  counterpartyName: varchar('counterparty_name', { length: 255 }),
  redirectUrl: text('redirect_url'),
  isArchived: boolean('is_archived').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('idx_sig_docs_tenant').on(table.tenantId),
  statusIdx: index('idx_sig_docs_status').on(table.status),
}));

// ─── Signature: Fields ─────────────────────────────────────────────
export const signatureFields = pgTable('signature_fields', {
  id: uuid('id').primaryKey().defaultRandom(),
  documentId: uuid('document_id').notNull().references(() => signatureDocuments.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 50 }).notNull().default('signature'),
  pageNumber: integer('page_number').notNull().default(1),
  x: real('x').notNull(),
  y: real('y').notNull(),
  width: real('width').notNull(),
  height: real('height').notNull(),
  signerEmail: varchar('signer_email', { length: 255 }),
  label: varchar('label', { length: 255 }),
  required: boolean('required').notNull().default(true),
  options: jsonb('options').$type<Record<string, unknown>>().notNull().default({}),
  signedAt: timestamp('signed_at', { withTimezone: true }),
  signatureData: text('signature_data'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  documentIdx: index('idx_sig_fields_document').on(table.documentId),
}));

// ─── Signature: Signing Tokens ─────────────────────────────────────
export const signingTokens = pgTable('signing_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  documentId: uuid('document_id').notNull().references(() => signatureDocuments.id, { onDelete: 'cascade' }),
  signerEmail: varchar('signer_email', { length: 255 }).notNull(),
  signerName: varchar('signer_name', { length: 255 }),
  token: varchar('token', { length: 255 }).unique().notNull(),
  status: varchar('status', { length: 50 }).notNull().default('pending'),
  signedAt: timestamp('signed_at', { withTimezone: true }),
  declineReason: text('decline_reason'),
  role: varchar('role', { length: 50 }).notNull().default('signer'),
  signingOrder: integer('signing_order').notNull().default(0),
  lastReminderAt: timestamp('last_reminder_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tokenIdx: uniqueIndex('idx_signing_tokens_token').on(table.token),
  documentIdx: index('idx_signing_tokens_document').on(table.documentId),
}));

// ─── Signature: Audit Log ──────────────────────────────────────────
export const signAuditLog = pgTable('sign_audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  documentId: uuid('document_id').notNull().references(() => signatureDocuments.id, { onDelete: 'cascade' }),
  action: varchar('action', { length: 100 }).notNull(),
  actorEmail: varchar('actor_email', { length: 255 }),
  actorName: varchar('actor_name', { length: 255 }),
  ipAddress: varchar('ip_address', { length: 100 }),
  userAgent: text('user_agent'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  documentIdx: index('idx_sign_audit_document').on(table.documentId),
}));

// ─── Signature: Templates ─────────────────────────────────────────
export const signTemplates = pgTable('sign_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  userId: uuid('user_id').notNull(),
  title: varchar('title', { length: 500 }).notNull(),
  fileName: varchar('file_name', { length: 500 }).notNull(),
  storagePath: text('storage_path').notNull(),
  pageCount: integer('page_count').notNull().default(1),
  fields: jsonb('fields').$type<Array<{
    type: string;
    pageNumber: number;
    x: number;
    y: number;
    width: number;
    height: number;
    signerEmail: string | null;
    label: string | null;
    required: boolean;
  }>>().notNull().default([]),
  isArchived: boolean('is_archived').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('idx_sign_templates_tenant').on(table.tenantId),
}));

// ─── HR: Departments ──────────────────────────────────────────────

export const departments = pgTable('departments', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull().default('Untitled department'),
  headEmployeeId: uuid('head_employee_id'),
  color: text('color').notNull().default('#5a7fa0'),
  description: text('description'),
  sortOrder: integer('sort_order').notNull().default(0),
  isArchived: boolean('is_archived').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdx: index('idx_departments_user').on(table.userId, table.isArchived),
  tenantIdx: index('idx_departments_tenant').on(table.tenantId, table.isArchived),
}));

// ─── HR: Employees ────────────────────────────────────────────────

export const employees = pgTable('employees', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  linkedUserId: uuid('linked_user_id').references(() => users.id, { onDelete: 'set null' }),
  name: text('name').notNull().default(''),
  email: text('email').notNull().default(''),
  role: text('role').notNull().default(''),
  departmentId: uuid('department_id').references(() => departments.id, { onDelete: 'set null' }),
  startDate: text('start_date'),
  phone: text('phone'),
  avatarUrl: text('avatar_url'),
  status: text('status').notNull().default('active'),
  tags: jsonb('tags').$type<string[]>().notNull().default([]),
  dateOfBirth: text('date_of_birth'),
  gender: varchar('gender', { length: 20 }),
  emergencyContactName: varchar('emergency_contact_name', { length: 255 }),
  emergencyContactPhone: varchar('emergency_contact_phone', { length: 50 }),
  emergencyContactRelation: varchar('emergency_contact_relation', { length: 100 }),
  employmentType: varchar('employment_type', { length: 50 }).notNull().default('full-time'),
  managerId: uuid('manager_id'),
  jobTitle: varchar('job_title', { length: 255 }),
  workLocation: varchar('work_location', { length: 255 }),
  salary: integer('salary'),
  salaryCurrency: varchar('salary_currency', { length: 10 }).notNull().default('USD'),
  salaryPeriod: varchar('salary_period', { length: 20 }).notNull().default('yearly'),
  sortOrder: integer('sort_order').notNull().default(0),
  isArchived: boolean('is_archived').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userStatusIdx: index('idx_employees_user_status').on(table.userId, table.status, table.isArchived),
  departmentIdx: index('idx_employees_department').on(table.departmentId, table.sortOrder),
  tenantIdx: index('idx_employees_tenant').on(table.tenantId, table.isArchived),
}));

// ─── HR: Leave Balances ──────────────────────────────────────────

export const leaveBalances = pgTable('leave_balances', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  employeeId: uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  leaveType: varchar('leave_type', { length: 50 }).notNull(),
  year: integer('year').notNull(),
  allocated: integer('allocated').notNull().default(0),
  used: integer('used').notNull().default(0),
  carried: integer('carried').notNull().default(0),
  leaveTypeId: uuid('leave_type_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  employeeYearIdx: index('idx_leave_balances_employee_year').on(table.employeeId, table.year),
  tenantIdx: index('idx_leave_balances_tenant').on(table.tenantId),
}));

// ─── HR: Onboarding Tasks ───────────────────────────────────────

export const onboardingTasks = pgTable('onboarding_tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  employeeId: uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),
  category: varchar('category', { length: 100 }).notNull().default('general'),
  dueDate: text('due_date'),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  completedBy: uuid('completed_by'),
  sortOrder: integer('sort_order').notNull().default(0),
  isArchived: boolean('is_archived').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  employeeIdx: index('idx_onboarding_tasks_employee').on(table.employeeId, table.isArchived),
  tenantIdx: index('idx_onboarding_tasks_tenant').on(table.tenantId),
}));

// ─── HR: Onboarding Templates ───────────────────────────────────

export const onboardingTemplates = pgTable('onboarding_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  name: varchar('name', { length: 255 }).notNull(),
  tasks: jsonb('tasks').$type<Array<{ title: string; description?: string; category: string }>>().notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('idx_onboarding_templates_tenant').on(table.tenantId),
}));

// ─── HR: Employee Documents ─────────────────────────────────────

export const employeeDocuments = pgTable('employee_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  employeeId: uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 500 }).notNull(),
  type: varchar('type', { length: 100 }).notNull().default('other'),
  storagePath: text('storage_path').notNull(),
  mimeType: varchar('mime_type', { length: 100 }),
  size: integer('size'),
  expiresAt: text('expires_at'),
  notes: text('notes'),
  uploadedBy: uuid('uploaded_by').notNull(),
  isArchived: boolean('is_archived').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  employeeIdx: index('idx_employee_documents_employee').on(table.employeeId, table.isArchived),
  tenantIdx: index('idx_employee_documents_tenant').on(table.tenantId),
}));

// ─── HR: Time-Off Requests ────────────────────────────────────────

export const timeOffRequests = pgTable('time_off_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  employeeId: uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  type: text('type').notNull().default('vacation'),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  status: text('status').notNull().default('pending'),
  approverId: uuid('approver_id').references(() => employees.id, { onDelete: 'set null' }),
  notes: text('notes'),
  sortOrder: integer('sort_order').notNull().default(0),
  isArchived: boolean('is_archived').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  employeeIdx: index('idx_time_off_employee').on(table.employeeId, table.status),
  statusIdx: index('idx_time_off_status').on(table.userId, table.status, table.isArchived),
  approverIdx: index('idx_time_off_approver').on(table.approverId),
}));

// ─── HR: Leave Types ────────────────────────────────────────────────

export const hrLeaveTypes = pgTable('hr_leave_types', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull(),
  color: varchar('color', { length: 20 }).notNull().default('#3b82f6'),
  defaultDaysPerYear: integer('default_days_per_year').notNull().default(0),
  maxCarryForward: integer('max_carry_forward').notNull().default(0),
  requiresApproval: boolean('requires_approval').notNull().default(true),
  isPaid: boolean('is_paid').notNull().default(true),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  isArchived: boolean('is_archived').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantSlugIdx: uniqueIndex('idx_hr_leave_types_tenant_slug').on(table.tenantId, table.slug),
  tenantActiveIdx: index('idx_hr_leave_types_tenant_active').on(table.tenantId, table.isActive),
}));

// ─── HR: Leave Policies ─────────────────────────────────────────────

export const hrLeavePolicies = pgTable('hr_leave_policies', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  isDefault: boolean('is_default').notNull().default(false),
  allocations: jsonb('allocations').$type<Array<{ leaveTypeId: string; daysPerYear: number }>>().notNull().default([]),
  isArchived: boolean('is_archived').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('idx_hr_leave_policies_tenant').on(table.tenantId),
}));

// ─── HR: Leave Policy Assignments ───────────────────────────────────

export const hrLeavePolicyAssignments = pgTable('hr_leave_policy_assignments', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  employeeId: uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  policyId: uuid('policy_id').notNull().references(() => hrLeavePolicies.id, { onDelete: 'cascade' }),
  effectiveFrom: text('effective_from'),
  isArchived: boolean('is_archived').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  employeeIdx: index('idx_hr_policy_assignments_employee').on(table.employeeId),
  tenantIdx: index('idx_hr_policy_assignments_tenant').on(table.tenantId),
}));

// ─── HR: Holiday Calendars ──────────────────────────────────────────

export const hrHolidayCalendars = pgTable('hr_holiday_calendars', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  name: varchar('name', { length: 255 }).notNull(),
  year: integer('year').notNull(),
  description: text('description'),
  isDefault: boolean('is_default').notNull().default(false),
  isArchived: boolean('is_archived').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('idx_hr_holiday_calendars_tenant').on(table.tenantId),
}));

// ─── HR: Holidays ───────────────────────────────────────────────────

export const hrHolidays = pgTable('hr_holidays', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  calendarId: uuid('calendar_id').notNull().references(() => hrHolidayCalendars.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  date: text('date').notNull(),
  description: text('description'),
  type: varchar('type', { length: 50 }).notNull().default('public'),
  isRecurring: boolean('is_recurring').notNull().default(false),
  isArchived: boolean('is_archived').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  calendarIdx: index('idx_hr_holidays_calendar').on(table.calendarId),
  tenantDateIdx: index('idx_hr_holidays_tenant_date').on(table.tenantId, table.date),
}));

// ─── HR: Leave Applications ─────────────────────────────────────────

export const hrLeaveApplications = pgTable('hr_leave_applications', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  employeeId: uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  leaveTypeId: uuid('leave_type_id').notNull().references(() => hrLeaveTypes.id),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  halfDay: boolean('half_day').notNull().default(false),
  halfDayDate: text('half_day_date'),
  totalDays: real('total_days').notNull().default(0),
  reason: text('reason'),
  status: varchar('status', { length: 50 }).notNull().default('draft'),
  approverId: uuid('approver_id').references(() => employees.id, { onDelete: 'set null' }),
  approverComment: text('approver_comment'),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  rejectedAt: timestamp('rejected_at', { withTimezone: true }),
  balanceBefore: real('balance_before'),
  isArchived: boolean('is_archived').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  employeeStatusIdx: index('idx_hr_leave_apps_employee_status').on(table.employeeId, table.status),
  approverStatusIdx: index('idx_hr_leave_apps_approver_status').on(table.approverId, table.status),
  tenantStatusIdx: index('idx_hr_leave_apps_tenant_status').on(table.tenantId, table.status),
}));

// ─── HR: Attendance ─────────────────────────────────────────────────

export const hrAttendance = pgTable('hr_attendance', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  employeeId: uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  date: text('date').notNull(),
  status: varchar('status', { length: 50 }).notNull().default('present'),
  checkInTime: text('check_in_time'),
  checkOutTime: text('check_out_time'),
  workingHours: real('working_hours'),
  notes: text('notes'),
  markedBy: uuid('marked_by'),
  isArchived: boolean('is_archived').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  employeeDateIdx: uniqueIndex('idx_hr_attendance_employee_date').on(table.employeeId, table.date),
  tenantDateIdx: index('idx_hr_attendance_tenant_date').on(table.tenantId, table.date),
  employeeStatusIdx: index('idx_hr_attendance_employee_status').on(table.employeeId, table.status),
}));

// ─── HR: Lifecycle Events ───────────────────────────────────────────

export const hrLifecycleEvents = pgTable('hr_lifecycle_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  employeeId: uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  eventType: varchar('event_type', { length: 50 }).notNull(),
  eventDate: text('event_date').notNull(),
  effectiveDate: text('effective_date'),
  fromValue: text('from_value'),
  toValue: text('to_value'),
  fromDepartmentId: uuid('from_department_id'),
  toDepartmentId: uuid('to_department_id'),
  notes: text('notes'),
  createdBy: uuid('created_by'),
  isArchived: boolean('is_archived').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  employeeDateIdx: index('idx_hr_lifecycle_employee_date').on(table.employeeId, table.eventDate),
  tenantIdx: index('idx_hr_lifecycle_tenant').on(table.tenantId),
}));

// ─── HR: Expense Categories ──────────────────────────────────────────

export const hrExpenseCategories = pgTable('hr_expense_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  name: varchar('name', { length: 255 }).notNull(),
  icon: varchar('icon', { length: 50 }).notNull().default('receipt'),
  color: varchar('color', { length: 20 }).notNull().default('#6b7280'),
  maxAmount: real('max_amount'),
  receiptRequired: boolean('receipt_required').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('idx_hr_expense_categories_tenant').on(table.tenantId),
}));

// ─── HR: Expense Policies ────────────────────────────────────────────

export const hrExpensePolicies = pgTable('hr_expense_policies', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  name: varchar('name', { length: 255 }).notNull(),
  monthlyLimit: real('monthly_limit'),
  requireReceiptAbove: real('require_receipt_above'),
  autoApproveBelow: real('auto_approve_below'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('idx_hr_expense_policies_tenant').on(table.tenantId),
}));

// ─── HR: Expense Policy Assignments ─────────────────────────────────

export const hrExpensePolicyAssignments = pgTable('hr_expense_policy_assignments', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  policyId: uuid('policy_id').notNull().references(() => hrExpensePolicies.id, { onDelete: 'cascade' }),
  employeeId: uuid('employee_id').references(() => employees.id, { onDelete: 'cascade' }),
  departmentId: uuid('department_id').references(() => departments.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  policyIdx: index('idx_hr_expense_policy_assignments_policy').on(table.policyId),
}));

// ─── HR: Expense Reports ────────────────────────────────────────────

export const hrExpenseReports = pgTable('hr_expense_reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  userId: uuid('user_id').notNull(),
  employeeId: uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 500 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('draft'),
  totalAmount: real('total_amount').notNull().default(0),
  currency: varchar('currency', { length: 10 }).notNull().default('USD'),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  refusedAt: timestamp('refused_at', { withTimezone: true }),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  approverId: uuid('approver_id'),
  approverComment: text('approver_comment'),
  isArchived: boolean('is_archived').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('idx_hr_expense_reports_tenant').on(table.tenantId),
  employeeIdx: index('idx_hr_expense_reports_employee').on(table.employeeId),
  statusIdx: index('idx_hr_expense_reports_status').on(table.status),
}));

// ─── HR: Expenses ───────────────────────────────────────────────────

export const hrExpenses = pgTable('hr_expenses', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  userId: uuid('user_id').notNull(),
  employeeId: uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id').references(() => hrExpenseCategories.id, { onDelete: 'set null' }),
  projectId: uuid('project_id').references(() => projectProjects.id, { onDelete: 'set null' }),
  reportId: uuid('report_id').references(() => hrExpenseReports.id, { onDelete: 'set null' }),
  description: text('description').notNull(),
  notes: text('notes'),
  amount: real('amount').notNull(),
  taxAmount: real('tax_amount').notNull().default(0),
  currency: varchar('currency', { length: 10 }).notNull().default('USD'),
  quantity: real('quantity').notNull().default(1),
  expenseDate: timestamp('expense_date', { withTimezone: true }).notNull(),
  merchantName: varchar('merchant_name', { length: 255 }),
  paymentMethod: varchar('payment_method', { length: 20 }).notNull().default('personal_card'),
  receiptPath: text('receipt_path'),
  status: varchar('status', { length: 20 }).notNull().default('draft'),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  refusedAt: timestamp('refused_at', { withTimezone: true }),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  approverId: uuid('approver_id'),
  approverComment: text('approver_comment'),
  policyViolation: text('policy_violation'),
  isArchived: boolean('is_archived').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('idx_hr_expenses_tenant').on(table.tenantId),
  employeeIdx: index('idx_hr_expenses_employee').on(table.employeeId),
  categoryIdx: index('idx_hr_expenses_category').on(table.categoryId),
  statusIdx: index('idx_hr_expenses_status').on(table.status),
  reportIdx: index('idx_hr_expenses_report').on(table.reportId),
  projectIdx: index('idx_hr_expenses_project').on(table.projectId),
  expenseDateIdx: index('idx_hr_expenses_date').on(table.expenseDate),
}));

// ─── CRM: Companies ────────────────────────────────────────────────
export const crmCompanies = pgTable('crm_companies', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  userId: uuid('user_id').notNull(),
  name: varchar('name', { length: 500 }).notNull(),
  domain: varchar('domain', { length: 255 }),
  industry: varchar('industry', { length: 255 }),
  size: varchar('size', { length: 50 }),
  address: text('address'),
  phone: varchar('phone', { length: 50 }),
  teamId: uuid('team_id'),
  taxId: varchar('tax_id', { length: 11 }),
  taxOffice: varchar('tax_office', { length: 100 }),
  currency: varchar('currency', { length: 10 }).notNull().default('USD'),
  postalCode: varchar('postal_code', { length: 20 }),
  state: varchar('state', { length: 100 }),
  country: varchar('country', { length: 100 }),
  logo: text('logo'),
  portalToken: uuid('portal_token').unique(),
  tags: jsonb('tags').$type<string[]>().notNull().default([]),
  isArchived: boolean('is_archived').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('idx_crm_companies_tenant').on(table.tenantId),
}));

// ─── CRM: Contacts ─────────────────────────────────────────────────
export const crmContacts = pgTable('crm_contacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  userId: uuid('user_id').notNull(),
  name: varchar('name', { length: 500 }).notNull(),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  companyId: uuid('company_id').references(() => crmCompanies.id, { onDelete: 'set null' }),
  teamId: uuid('team_id'),
  position: varchar('position', { length: 255 }),
  source: varchar('source', { length: 100 }),
  tags: jsonb('tags').$type<string[]>().notNull().default([]),
  isArchived: boolean('is_archived').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('idx_crm_contacts_tenant').on(table.tenantId),
  companyIdx: index('idx_crm_contacts_company').on(table.companyId),
}));

// ─── CRM: Deal Stages ──────────────────────────────────────────────
export const crmDealStages = pgTable('crm_deal_stages', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  name: varchar('name', { length: 100 }).notNull(),
  color: varchar('color', { length: 20 }).notNull().default('#6b7280'),
  probability: integer('probability').notNull().default(0),
  sequence: integer('sequence').notNull().default(0),
  isDefault: boolean('is_default').notNull().default(false),
  rottingDays: integer('rotting_days'),
}, (table) => ({
  tenantIdx: index('idx_crm_stages_tenant').on(table.tenantId),
}));

// ─── CRM: Deals ────────────────────────────────────────────────────
export const crmDeals = pgTable('crm_deals', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  userId: uuid('user_id').notNull(),
  title: varchar('title', { length: 500 }).notNull(),
  value: real('value').notNull().default(0),
  currency: varchar('currency', { length: 10 }).notNull().default('USD'),
  stageId: uuid('stage_id').notNull().references(() => crmDealStages.id),
  contactId: uuid('contact_id').references(() => crmContacts.id, { onDelete: 'set null' }),
  companyId: uuid('company_id').references(() => crmCompanies.id, { onDelete: 'set null' }),
  assignedUserId: uuid('assigned_user_id'),
  teamId: uuid('team_id'),
  probability: integer('probability').notNull().default(0),
  expectedCloseDate: timestamp('expected_close_date', { withTimezone: true }),
  wonAt: timestamp('won_at', { withTimezone: true }),
  lostAt: timestamp('lost_at', { withTimezone: true }),
  lostReason: text('lost_reason'),
  tags: jsonb('tags').$type<string[]>().notNull().default([]),
  stageEnteredAt: timestamp('stage_entered_at', { withTimezone: true }),
  isArchived: boolean('is_archived').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('idx_crm_deals_tenant').on(table.tenantId),
  stageIdx: index('idx_crm_deals_stage').on(table.stageId),
  contactIdx: index('idx_crm_deals_contact').on(table.contactId),
  companyIdx: index('idx_crm_deals_company').on(table.companyId),
}));

// ─── CRM: Activity Types ──────────────────────────────────────────
export const crmActivityTypes = pgTable('crm_activity_types', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  name: varchar('name', { length: 100 }).notNull(),
  icon: varchar('icon', { length: 50 }).notNull().default('sticky-note'),
  color: varchar('color', { length: 20 }).notNull().default('#6b7280'),
  isDefault: boolean('is_default').notNull().default(false),
  isArchived: boolean('is_archived').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('idx_crm_activity_types_tenant').on(table.tenantId),
}));

// ─── CRM: Activities ───────────────────────────────────────────────
export const crmActivities = pgTable('crm_activities', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  userId: uuid('user_id').notNull(),
  type: varchar('type', { length: 50 }).notNull().default('note'),
  body: text('body').notNull().default(''),
  dealId: uuid('deal_id').references(() => crmDeals.id, { onDelete: 'cascade' }),
  contactId: uuid('contact_id').references(() => crmContacts.id, { onDelete: 'cascade' }),
  companyId: uuid('company_id').references(() => crmCompanies.id, { onDelete: 'cascade' }),
  assignedUserId: uuid('assigned_user_id'),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  isArchived: boolean('is_archived').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  dealIdx: index('idx_crm_activities_deal').on(table.dealId),
  contactIdx: index('idx_crm_activities_contact').on(table.contactId),
  companyIdx: index('idx_crm_activities_company').on(table.companyId),
}));

// ─── CRM: Workflow Automations ────────────────────────────────────
export const crmWorkflows = pgTable('crm_workflows', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  userId: uuid('user_id').notNull(),
  name: varchar('name', { length: 500 }).notNull(),
  trigger: varchar('trigger', { length: 100 }).notNull(),
  triggerConfig: jsonb('trigger_config').$type<Record<string, unknown>>().notNull().default({}),
  action: varchar('action', { length: 100 }).notNull(),
  actionConfig: jsonb('action_config').$type<Record<string, unknown>>().notNull().default({}),
  isActive: boolean('is_active').notNull().default(true),
  executionCount: integer('execution_count').notNull().default(0),
  lastExecutedAt: timestamp('last_executed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('idx_crm_workflows_tenant').on(table.tenantId),
  triggerIdx: index('idx_crm_workflows_trigger').on(table.trigger),
}));

// ─── CRM: Sales Teams ────────────────────────────────────────────
export const crmTeams = pgTable('crm_teams', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  name: varchar('name', { length: 100 }).notNull(),
  color: varchar('color', { length: 20 }).notNull().default('#3b82f6'),
  leaderUserId: uuid('leader_user_id'),
  isArchived: boolean('is_archived').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('idx_crm_teams_tenant').on(table.tenantId),
}));

export const crmTeamMembers = pgTable('crm_team_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  teamId: uuid('team_id').notNull().references(() => crmTeams.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  uniqueIdx: uniqueIndex('idx_crm_team_members_unique').on(table.teamId, table.userId),
}));

// ─── CRM: Leads ───────────────────────────────────────────────────
export const crmLeads = pgTable('crm_leads', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  userId: uuid('user_id').notNull(),
  name: varchar('name', { length: 500 }).notNull(),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  companyName: varchar('company_name', { length: 500 }),
  source: varchar('source', { length: 50 }).notNull().default('other'),
  status: varchar('status', { length: 50 }).notNull().default('new'),
  notes: text('notes'),
  convertedContactId: uuid('converted_contact_id'),
  convertedDealId: uuid('converted_deal_id'),
  tags: jsonb('tags').$type<string[]>().notNull().default([]),
  expectedRevenue: real('expected_revenue').notNull().default(0),
  probability: integer('probability').notNull().default(0),
  assignedUserId: uuid('assigned_user_id'),
  teamId: uuid('team_id'),
  expectedCloseDate: timestamp('expected_close_date', { withTimezone: true }),
  enrichedData: jsonb('enriched_data').$type<Record<string, unknown>>(),
  enrichedAt: timestamp('enriched_at', { withTimezone: true }),
  isArchived: boolean('is_archived').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('idx_crm_leads_tenant').on(table.tenantId),
  statusIdx: index('idx_crm_leads_status').on(table.status),
}));

// ─── CRM: Notes (rich text) ──────────────────────────────────────
export const crmNotes = pgTable('crm_notes', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  userId: uuid('user_id').notNull(),
  title: varchar('title', { length: 500 }).notNull().default(''),
  content: jsonb('content').$type<Record<string, unknown>>().notNull().default({}),
  dealId: uuid('deal_id').references(() => crmDeals.id, { onDelete: 'cascade' }),
  contactId: uuid('contact_id').references(() => crmContacts.id, { onDelete: 'cascade' }),
  companyId: uuid('company_id').references(() => crmCompanies.id, { onDelete: 'cascade' }),
  isPinned: boolean('is_pinned').notNull().default(false),
  isArchived: boolean('is_archived').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  dealIdx: index('idx_crm_notes_deal').on(table.dealId),
  contactIdx: index('idx_crm_notes_contact').on(table.contactId),
  companyIdx: index('idx_crm_notes_company').on(table.companyId),
}));

// ─── CRM: Saved Views ────────────────────────────────────────────
export const crmSavedViews = pgTable('crm_saved_views', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  userId: uuid('user_id').notNull(),
  appSection: varchar('app_section', { length: 50 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  filters: jsonb('filters').$type<Record<string, unknown>>().notNull().default({}),
  isPinned: boolean('is_pinned').notNull().default(false),
  isShared: boolean('is_shared').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('idx_crm_saved_views_tenant').on(table.tenantId),
  userIdx: index('idx_crm_saved_views_user').on(table.userId, table.appSection),
}));

// ─── CRM: Lead Forms ─────────────────────────────────────────────
export const crmLeadForms = pgTable('crm_lead_forms', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  userId: uuid('user_id').notNull(),
  name: varchar('name', { length: 255 }).notNull().default('Default Lead Form'),
  token: varchar('token', { length: 64 }).notNull().unique(),
  fields: jsonb('fields').$type<Array<{ id: string; type: string; label: string; placeholder: string; required: boolean; options?: string[]; mapTo?: string }>>().notNull().default([]),
  isActive: boolean('is_active').notNull().default(true),
  submitCount: integer('submit_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tokenIdx: index('idx_crm_lead_forms_token').on(table.token),
  tenantIdx: index('idx_crm_lead_forms_tenant').on(table.tenantId),
}));

// ─── CRM: Proposals ────────────────────────────────────────────────
export const crmProposals = pgTable('crm_proposals', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  userId: uuid('user_id').notNull(),
  dealId: uuid('deal_id').references(() => crmDeals.id, { onDelete: 'set null' }),
  contactId: uuid('contact_id').references(() => crmContacts.id, { onDelete: 'set null' }),
  companyId: uuid('company_id').references(() => crmCompanies.id, { onDelete: 'set null' }),
  title: varchar('title', { length: 500 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('draft'),
  content: jsonb('content'),
  lineItems: jsonb('line_items').$type<Array<{ description: string; quantity: number; unitPrice: number; taxRate: number }>>().notNull().default([]),
  subtotal: real('subtotal').notNull().default(0),
  taxPercent: real('tax_percent').notNull().default(0),
  taxAmount: real('tax_amount').notNull().default(0),
  discountPercent: real('discount_percent').notNull().default(0),
  discountAmount: real('discount_amount').notNull().default(0),
  total: real('total').notNull().default(0),
  currency: varchar('currency', { length: 10 }).notNull().default('USD'),
  validUntil: timestamp('valid_until', { withTimezone: true }),
  publicToken: uuid('public_token').notNull().defaultRandom().unique(),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  viewedAt: timestamp('viewed_at', { withTimezone: true }),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  declinedAt: timestamp('declined_at', { withTimezone: true }),
  notes: text('notes'),
  isArchived: boolean('is_archived').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('idx_crm_proposals_tenant').on(table.tenantId),
  dealIdx: index('idx_crm_proposals_deal').on(table.dealId),
  companyIdx: index('idx_crm_proposals_company').on(table.companyId),
  statusIdx: index('idx_crm_proposals_status').on(table.status),
  publicTokenIdx: uniqueIndex('idx_crm_proposals_token').on(table.publicToken),
}));

// ─── CRM: Proposal Revisions ─────────────────────────────────────
export const crmProposalRevisions = pgTable('crm_proposal_revisions', {
  id: uuid('id').primaryKey().defaultRandom(),
  proposalId: uuid('proposal_id').notNull().references(() => crmProposals.id, { onDelete: 'cascade' }),
  tenantId: uuid('tenant_id').notNull(),
  revisionNumber: integer('revision_number').notNull(),
  snapshotJson: jsonb('snapshot_json').notNull(),
  changedBy: uuid('changed_by').notNull(),
  changeReason: varchar('change_reason', { length: 200 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  proposalIdx: index('idx_crm_proposal_revisions_proposal').on(table.proposalId),
}));

// ─── Projects: Projects ───────────────────────────────────────────
export const projectProjects = pgTable('project_projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  userId: uuid('user_id').notNull(),
  companyId: uuid('company_id').references(() => crmCompanies.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 500 }).notNull(),
  description: text('description'),
  billable: boolean('billable').notNull().default(true),
  status: varchar('status', { length: 50 }).notNull().default('active'),
  estimatedHours: real('estimated_hours'),
  estimatedAmount: real('estimated_amount'),
  startDate: timestamp('start_date', { withTimezone: true }),
  endDate: timestamp('end_date', { withTimezone: true }),
  color: varchar('color', { length: 20 }),
  isArchived: boolean('is_archived').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('idx_project_projects_tenant').on(table.tenantId),
  companyIdx: index('idx_project_projects_company').on(table.companyId),
  statusIdx: index('idx_project_projects_status').on(table.status),
}));

// ─── Projects: Members ────────────────────────────────────────────
export const projectMembers = pgTable('project_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  projectId: uuid('project_id').notNull().references(() => projectProjects.id, { onDelete: 'cascade' }),
  hourlyRate: real('hourly_rate'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  projectIdx: index('idx_project_members_project').on(table.projectId),
  userProjectIdx: uniqueIndex('idx_project_members_user_project').on(table.userId, table.projectId),
}));

// ─── Projects: Time Entries ───────────────────────────────────────
export const projectTimeEntries = pgTable('project_time_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  userId: uuid('user_id').notNull(),
  projectId: uuid('project_id').notNull().references(() => projectProjects.id, { onDelete: 'cascade' }),
  durationMinutes: integer('duration_minutes').notNull().default(0),
  workDate: varchar('work_date', { length: 10 }).notNull(),
  startTime: varchar('start_time', { length: 5 }),
  endTime: varchar('end_time', { length: 5 }),
  billable: boolean('billable').notNull().default(true),
  billed: boolean('billed').notNull().default(false),
  paid: boolean('paid').notNull().default(false),
  locked: boolean('locked').notNull().default(false),
  invoiceLineItemId: uuid('invoice_line_item_id'),
  rateId: uuid('rate_id').references(() => projectRates.id, { onDelete: 'set null' }),
  notes: text('notes'),
  taskDescription: varchar('task_description', { length: 500 }),
  tags: jsonb('tags').$type<string[]>().notNull().default([]),
  isArchived: boolean('is_archived').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('idx_project_time_entries_tenant').on(table.tenantId),
  projectIdx: index('idx_project_time_entries_project').on(table.projectId),
  userDateIdx: index('idx_project_time_entries_user_date').on(table.userId, table.workDate),
  billedIdx: index('idx_project_time_entries_billed').on(table.billed, table.billable),
}));

// ─── Projects: Settings ───────────────────────────────────────────
export const projectSettings = pgTable('project_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  defaultHourlyRate: real('default_hourly_rate').notNull().default(0),
  companyName: varchar('company_name', { length: 500 }),
  companyAddress: text('company_address'),
  companyLogo: text('company_logo'),
  // Tenant-wide defaults exposed in the Projects → General settings panel.
  weekStartDay: varchar('week_start_day', { length: 10 }).notNull().default('monday'),
  defaultProjectVisibility: varchar('default_project_visibility', { length: 10 }).notNull().default('team'),
  defaultBillable: boolean('default_billable').notNull().default(true),
  timeRounding: integer('time_rounding').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantIdx: uniqueIndex('idx_project_settings_tenant').on(table.tenantId),
}));

// ─── Projects: Rates ─────────────────────────────────────────────
export const projectRates = pgTable('project_rates', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  title: varchar('title', { length: 200 }).notNull(),
  factor: real('factor').notNull().default(1),
  extraPerHour: real('extra_per_hour').notNull().default(0),
  isArchived: boolean('is_archived').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('idx_project_rates_tenant').on(table.tenantId),
}));

// ─── Tenant-wide Format Settings (singleton per tenant) ────────────
// This is a minimal tenant-level settings bucket used for values that need
// to be shared across apps (e.g. defaultCurrency read by Projects/Invoices).
// User-scoped formatting lives on user_settings; this table is explicitly
// tenant-wide so every user in the tenant sees the same value.
export const tenantFormatSettings = pgTable('tenant_format_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  defaultCurrency: varchar('default_currency', { length: 10 }).notNull().default('USD'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantIdx: uniqueIndex('idx_tenant_format_settings_tenant').on(table.tenantId),
}));

// ─── Sign: Settings ────────────────────────────────────────────────
export const signSettings = pgTable('sign_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  reminderCadenceDays: integer('reminder_cadence_days').notNull().default(3),
  signatureExpiryDays: integer('signature_expiry_days').notNull().default(30),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantIdx: uniqueIndex('idx_sign_settings_tenant').on(table.tenantId),
}));

// ─── Invoices ──────────────────────────────────────────────────────
export const invoices = pgTable('invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  userId: uuid('user_id').notNull(),
  companyId: uuid('company_id').notNull().references(() => crmCompanies.id, { onDelete: 'cascade' }),
  contactId: uuid('contact_id').references(() => crmContacts.id, { onDelete: 'set null' }),
  dealId: uuid('deal_id').references(() => crmDeals.id, { onDelete: 'set null' }),
  projectId: uuid('project_id').references(() => projectProjects.id, { onDelete: 'set null' }),
  proposalId: uuid('proposal_id').references(() => crmProposals.id, { onDelete: 'set null' }),
  invoiceNumber: varchar('invoice_number', { length: 50 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('draft'),
  currency: varchar('currency', { length: 10 }).notNull().default('USD'),
  subtotal: real('subtotal').notNull().default(0),
  taxPercent: real('tax_percent').notNull().default(0),
  taxAmount: real('tax_amount').notNull().default(0),
  discountPercent: real('discount_percent').notNull().default(0),
  discountAmount: real('discount_amount').notNull().default(0),
  total: real('total').notNull().default(0),
  notes: text('notes'),
  issueDate: timestamp('issue_date', { withTimezone: true }).notNull(),
  dueDate: timestamp('due_date', { withTimezone: true }).notNull(),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  viewedAt: timestamp('viewed_at', { withTimezone: true }),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  eFaturaType: varchar('e_fatura_type', { length: 20 }),
  eFaturaUuid: varchar('e_fatura_uuid', { length: 50 }),
  eFaturaStatus: varchar('e_fatura_status', { length: 20 }),
  eFaturaXml: text('e_fatura_xml'),
  lastEmailedAt: timestamp('last_emailed_at', { withTimezone: true }),
  emailSentCount: integer('email_sent_count').notNull().default(0),
  lastReminderStage: integer('last_reminder_stage').notNull().default(0),
  lastReminderAt: timestamp('last_reminder_at', { withTimezone: true }),
  isArchived: boolean('is_archived').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('idx_invoices_tenant').on(table.tenantId),
  companyIdx: index('idx_invoices_company').on(table.companyId),
  statusIdx: index('idx_invoices_status').on(table.status),
  uniqueNumber: uniqueIndex('idx_invoices_number').on(table.tenantId, table.invoiceNumber),
  projectIdx: index('idx_invoices_project').on(table.projectId),
}));

export const invoiceLineItems = pgTable('invoice_line_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  invoiceId: uuid('invoice_id').notNull().references(() => invoices.id, { onDelete: 'cascade' }),
  timeEntryId: uuid('time_entry_id').references(() => projectTimeEntries.id, { onDelete: 'set null' }),
  description: text('description').notNull(),
  quantity: real('quantity').notNull().default(1),
  unitPrice: real('unit_price').notNull().default(0),
  amount: real('amount').notNull().default(0),
  taxRate: real('tax_rate').notNull().default(20),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  invoiceIdx: index('idx_invoice_line_items_invoice').on(table.invoiceId),
}));

export const invoicePayments = pgTable('invoice_payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  invoiceId: uuid('invoice_id').notNull().references(() => invoices.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull(),
  type: varchar('type', { length: 20 }).notNull().default('payment'),
  amount: real('amount').notNull(),
  currency: varchar('currency', { length: 10 }).notNull().default('USD'),
  paymentDate: timestamp('payment_date', { withTimezone: true }).notNull(),
  method: varchar('method', { length: 50 }),
  reference: text('reference'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  invoiceIdx: index('idx_invoice_payments_invoice').on(table.invoiceId),
  tenantIdx: index('idx_invoice_payments_tenant').on(table.tenantId),
}));

export const recurringInvoices = pgTable('recurring_invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  userId: uuid('user_id').notNull(),
  companyId: uuid('company_id').notNull().references(() => crmCompanies.id),
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),
  // Template fields copied to generated invoices
  currency: varchar('currency', { length: 10 }).notNull().default('USD'),
  taxPercent: real('tax_percent').notNull().default(0),
  discountPercent: real('discount_percent').notNull().default(0),
  notes: text('notes'),
  paymentInstructions: text('payment_instructions'),
  // Recurrence
  frequency: varchar('frequency', { length: 20 }).notNull(),
  startDate: timestamp('start_date', { withTimezone: true }).notNull(),
  endDate: timestamp('end_date', { withTimezone: true }),
  nextRunAt: timestamp('next_run_at', { withTimezone: true }).notNull(),
  lastRunAt: timestamp('last_run_at', { withTimezone: true }),
  runCount: integer('run_count').notNull().default(0),
  maxRuns: integer('max_runs'),
  // Behavior
  autoSend: boolean('auto_send').notNull().default(false),
  paymentTermsDays: integer('payment_terms_days').notNull().default(30),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('idx_recurring_invoices_tenant').on(table.tenantId),
  nextRunIdx: index('idx_recurring_invoices_next_run').on(table.isActive, table.nextRunAt),
}));

export const recurringInvoiceLineItems = pgTable('recurring_invoice_line_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  recurringInvoiceId: uuid('recurring_invoice_id').notNull().references(() => recurringInvoices.id, { onDelete: 'cascade' }),
  description: text('description').notNull(),
  quantity: real('quantity').notNull().default(1),
  unitPrice: real('unit_price').notNull().default(0),
  taxRate: real('tax_rate').notNull().default(0),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const invoiceSettings = pgTable('invoice_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id).unique(),
  invoicePrefix: varchar('invoice_prefix', { length: 20 }).notNull().default('INV'),
  nextInvoiceNumber: integer('next_invoice_number').notNull().default(1),
  defaultCurrency: varchar('default_currency', { length: 10 }).notNull().default('USD'),
  defaultTaxRate: real('default_tax_rate').notNull().default(0),
  eFaturaEnabled: boolean('e_fatura_enabled').notNull().default(false),
  eFaturaCompanyName: varchar('e_fatura_company_name', { length: 255 }),
  eFaturaCompanyTaxId: varchar('e_fatura_company_tax_id', { length: 20 }),
  eFaturaCompanyTaxOffice: varchar('e_fatura_company_tax_office', { length: 100 }),
  eFaturaCompanyAddress: text('e_fatura_company_address'),
  eFaturaCompanyCity: varchar('e_fatura_company_city', { length: 100 }),
  eFaturaCompanyCountry: varchar('e_fatura_company_country', { length: 100 }),
  eFaturaCompanyPhone: varchar('e_fatura_company_phone', { length: 50 }),
  eFaturaCompanyEmail: varchar('e_fatura_company_email', { length: 255 }),
  // Invoice template branding (separate from e-Fatura)
  templateId: varchar('template_id', { length: 50 }).notNull().default('classic'),
  logoPath: text('logo_path'),
  accentColor: varchar('accent_color', { length: 20 }).notNull().default('#13715B'),
  companyName: varchar('company_name', { length: 255 }),
  companyAddress: text('company_address'),
  companyCity: varchar('company_city', { length: 100 }),
  companyCountry: varchar('company_country', { length: 100 }),
  companyPhone: varchar('company_phone', { length: 50 }),
  companyEmail: varchar('company_email', { length: 255 }),
  companyWebsite: varchar('company_website', { length: 255 }),
  companyTaxId: varchar('company_tax_id', { length: 50 }),
  paymentInstructions: text('payment_instructions'),
  bankDetails: text('bank_details'),
  footerText: text('footer_text'),
  reminderEnabled: boolean('reminder_enabled').notNull().default(false),
  reminder1Days: integer('reminder_1_days').notNull().default(7),
  reminder2Days: integer('reminder_2_days').notNull().default(14),
  reminder3Days: integer('reminder_3_days').notNull().default(30),
  endlessReminderDays: integer('endless_reminder_days').notNull().default(14),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ─── System Settings (admin-only, singleton row) ───────────────────

export const systemSettings = pgTable('system_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  // SMTP / Email
  smtpHost: varchar('smtp_host', { length: 255 }),
  smtpPort: integer('smtp_port').notNull().default(587),
  smtpUser: varchar('smtp_user', { length: 255 }),
  smtpPass: text('smtp_pass'),
  smtpFrom: varchar('smtp_from', { length: 255 }).notNull().default('Atlas <noreply@atlas.local>'),
  smtpSecure: boolean('smtp_secure').notNull().default(false),
  smtpEnabled: boolean('smtp_enabled').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ─── Audit Log ────────────────────────────────────────────────────────

export const auditLog = pgTable('audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id'),
  tenantId: uuid('tenant_id').references(() => tenants.id),
  action: varchar('action', { length: 20 }).notNull(), // 'create', 'update', 'delete'
  entity: varchar('entity', { length: 100 }).notNull(), // 'crm_deal', 'hr_employee', etc.
  entityId: varchar('entity_id', { length: 255 }),
  path: varchar('path', { length: 500 }).notNull(), // request path
  method: varchar('method', { length: 10 }).notNull(), // HTTP method
  statusCode: integer('status_code'),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('idx_audit_log_tenant').on(table.tenantId, table.createdAt),
  userIdx: index('idx_audit_log_user').on(table.userId, table.createdAt),
}));

// ─── App Permissions ──────────────────────────────────────────────────

export const appPermissions = pgTable('app_permissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  userId: uuid('user_id').notNull(),
  appId: varchar('app_id', { length: 50 }).notNull(),
  role: varchar('role', { length: 20 }).notNull().default('editor'),
  recordAccess: varchar('record_access', { length: 20 }).notNull().default('all'),
  entityPermissions: jsonb('entity_permissions').$type<Record<string, string[]> | null>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  uniqueIdx: uniqueIndex('idx_app_permissions_unique').on(table.tenantId, table.userId, table.appId),
}));

// ─── App Permission Audit ───────────────────────────────────────────

export const appPermissionAudit = pgTable('app_permission_audit', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  targetUserId: uuid('target_user_id').notNull(),
  actorUserId: uuid('actor_user_id'), // nullable — system actors
  actorType: varchar('actor_type', { length: 20 }).notNull().default('user'), // 'user' | 'system'
  appId: varchar('app_id', { length: 50 }).notNull(),
  action: varchar('action', { length: 20 }).notNull(), // 'grant' | 'revoke' | 'update'
  beforeRole: varchar('before_role', { length: 20 }),
  beforeRecordAccess: varchar('before_record_access', { length: 10 }),
  afterRole: varchar('after_role', { length: 20 }),
  afterRecordAccess: varchar('after_record_access', { length: 10 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  idxTenantCreated: index('idx_app_permission_audit_tenant_created').on(table.tenantId, table.createdAt),
  idxTargetUser: index('idx_app_permission_audit_target').on(table.tenantId, table.targetUserId),
}));

// ─── Presence Heartbeats ────────────────────────────────────────────

export const presenceHeartbeats = pgTable('presence_heartbeats', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  tenantId: uuid('tenant_id').notNull(),
  appId: varchar('app_id', { length: 50 }).notNull(),
  recordId: varchar('record_id', { length: 255 }).notNull(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  uniquePresence: uniqueIndex('idx_presence_unique').on(table.userId, table.appId, table.recordId),
  lookupIdx: index('idx_presence_lookup').on(table.tenantId, table.appId, table.recordId),
}));

// ─── Exchange Rates (cached from external providers) ────────────────

export const exchangeRates = pgTable('exchange_rates', {
  id: uuid('id').primaryKey().defaultRandom(),
  baseCurrency: varchar('base_currency', { length: 10 }).notNull(),
  targetCurrency: varchar('target_currency', { length: 10 }).notNull(),
  rate: real('rate').notNull(),
  provider: varchar('provider', { length: 50 }).notNull(),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).defaultNow().notNull(),
});

