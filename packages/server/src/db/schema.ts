import {
  pgTable, text, uuid, varchar, integer, bigint, boolean, jsonb,
  timestamp, index, uniqueIndex, type AnyPgColumn,
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
  isSuperAdmin: boolean('is_super_admin').notNull().default(false),
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
  dateFormat: text('date_format').notNull().default('MM/DD/YYYY'),
  currencySymbol: text('currency_symbol').notNull().default('$'),
  timezone: text('timezone').notNull().default(''),
  // Tables settings
  tablesDefaultView: text('tables_default_view').notNull().default('grid'),
  tablesDefaultSort: text('tables_default_sort').notNull().default('none'),
  tablesShowFieldTypeIcons: boolean('tables_show_field_type_icons').notNull().default(true),
  tablesDefaultRowCount: integer('tables_default_row_count').notNull().default(3),
  tablesIncludeRowIdsInExport: boolean('tables_include_row_ids_in_export').notNull().default(false),
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
  homeEnabledWidgets: jsonb('home_enabled_widgets').$type<string[] | null>(),
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
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  parentId: uuid('parent_id').references((): AnyPgColumn => documents.id, { onDelete: 'set null' }),
  title: text('title').notNull().default('Untitled'),
  content: jsonb('content').$type<Record<string, unknown> | null>().default(null),
  icon: text('icon'),
  coverImage: text('cover_image'),
  sortOrder: integer('sort_order').notNull().default(0),
  isArchived: boolean('is_archived').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  accountIdx: index('idx_documents_account').on(table.accountId, table.isArchived),
  userIdx: index('idx_documents_user').on(table.userId, table.isArchived),
  parentIdx: index('idx_documents_parent').on(table.parentId, table.sortOrder),
  accountParentIdx: index('idx_documents_account_parent').on(table.accountId, table.parentId, table.sortOrder),
  userParentIdx: index('idx_documents_user_parent').on(table.userId, table.parentId, table.sortOrder),
}));

export const documentVersions = pgTable('document_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  documentId: uuid('document_id').notNull().references(() => documents.id, { onDelete: 'cascade' }),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  content: jsonb('content').$type<Record<string, unknown> | null>().default(null),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  docIdx: index('idx_document_versions_doc').on(table.documentId, table.createdAt),
}));

// ─── Task Projects ──────────────────────────────────────────────────

export const taskProjects = pgTable('task_projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull().default('Untitled project'),
  description: text('description'),
  icon: text('icon'),
  color: text('color').notNull().default('#5a7fa0'),
  sortOrder: integer('sort_order').notNull().default(0),
  isArchived: boolean('is_archived').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdx: index('idx_task_projects_user').on(table.userId, table.isArchived),
}));

// ─── Tasks ──────────────────────────────────────────────────────────

export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').references(() => taskProjects.id, { onDelete: 'set null' }),
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
  sortOrder: integer('sort_order').notNull().default(0),
  isArchived: boolean('is_archived').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userStatusIdx: index('idx_tasks_user_status').on(table.userId, table.status, table.isArchived),
  userWhenIdx: index('idx_tasks_user_when').on(table.userId, table.when, table.status),
  projectIdx: index('idx_tasks_project').on(table.projectId, table.sortOrder),
  dueDateIdx: index('idx_tasks_due_date').on(table.userId, table.dueDate),
}));

// ─── Spreadsheets (Tables / Airtable-like) ──────────────────────────

export const spreadsheets = pgTable('spreadsheets', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull().default('Untitled table'),
  columns: jsonb('columns').$type<import('@atlasmail/shared').TableColumn[]>().notNull().default([]),
  rows: jsonb('rows').$type<import('@atlasmail/shared').TableRow[]>().notNull().default([]),
  viewConfig: jsonb('view_config').$type<import('@atlasmail/shared').TableViewConfig>().notNull().default({ activeView: 'grid' } as import('@atlasmail/shared').TableViewConfig),
  sortOrder: integer('sort_order').notNull().default(0),
  isArchived: boolean('is_archived').notNull().default(false),
  color: text('color'),
  icon: text('icon'),
  guide: text('guide'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdx: index('idx_spreadsheets_user').on(table.userId, table.isArchived),
  accountIdx: index('idx_spreadsheets_account').on(table.accountId, table.isArchived),
}));

// ─── Drive (file storage) ────────────────────────────────────────────

export const driveItems = pgTable('drive_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
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
  sortOrder: integer('sort_order').notNull().default(0),
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
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
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
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tokenIdx: index('idx_share_links_token').on(table.shareToken),
  itemIdx: index('idx_share_links_item').on(table.driveItemId),
}));

export const drawings = pgTable('drawings', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull().default('Untitled drawing'),
  content: jsonb('content').$type<Record<string, unknown> | null>().default(null),
  thumbnailUrl: text('thumbnail_url'),
  sortOrder: integer('sort_order').notNull().default(0),
  isArchived: boolean('is_archived').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  accountIdx: index('idx_drawings_account').on(table.accountId, table.isArchived),
  userIdx: index('idx_drawings_user').on(table.userId, table.isArchived),
}));

// ─── Notifications ──────────────────────────────────────────────────

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
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
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
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

// ─── Document Comments ──────────────────────────────────────────────

export const documentComments = pgTable('document_comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  documentId: uuid('document_id').notNull().references(() => documents.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
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
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantEmailIdx: uniqueIndex('idx_tenant_invitations_tenant_email').on(table.tenantId, table.email),
  tokenIdx: uniqueIndex('idx_tenant_invitations_token').on(table.token),
}));

// ─── Platform: App Catalog ──────────────────────────────────────────

export const appCatalog = pgTable('app_catalog', {
  id: uuid('id').primaryKey().defaultRandom(),
  manifestId: varchar('manifest_id', { length: 255 }).unique().notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  category: varchar('category', { length: 100 }).notNull(),
  tags: jsonb('tags').$type<string[]>().notNull().default([]),
  iconUrl: text('icon_url'),
  color: varchar('color', { length: 20 }),
  description: text('description'),
  currentVersion: varchar('current_version', { length: 100 }).notNull(),
  manifest: jsonb('manifest').$type<Record<string, unknown>>().notNull(),
  minPlan: varchar('min_plan', { length: 50 }).notNull().default('starter'),
  isPublished: boolean('is_published').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  manifestIdx: uniqueIndex('idx_app_catalog_manifest').on(table.manifestId),
  categoryIdx: index('idx_app_catalog_category').on(table.category),
}));

// ─── Platform: App Installations ────────────────────────────────────

export const appInstallations = pgTable('app_installations', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  catalogAppId: uuid('catalog_app_id').notNull().references(() => appCatalog.id),
  installedVersion: varchar('installed_version', { length: 100 }).notNull(),
  status: varchar('status', { length: 50 }).notNull().default('installing'),
  subdomain: varchar('subdomain', { length: 63 }).notNull(),
  k8sDeploymentName: varchar('k8s_deployment_name', { length: 253 }),
  oidcClientId: varchar('oidc_client_id', { length: 255 }),
  oidcClientSecret: text('oidc_client_secret'),
  addonRefs: jsonb('addon_refs').$type<Record<string, string>>().notNull().default({}),
  lastHealthStatus: varchar('last_health_status', { length: 50 }),
  customEnv: jsonb('custom_env').$type<Record<string, string>>().notNull().default({}),
  provisioningApiToken: text('provisioning_api_token'),
  provisioningEnabled: boolean('provisioning_enabled').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('idx_installations_tenant').on(table.tenantId),
  subdomainIdx: uniqueIndex('idx_installations_subdomain').on(table.tenantId, table.subdomain),
}));

// ─── Platform: App Addons ───────────────────────────────────────────

export const appAddons = pgTable('app_addons', {
  id: uuid('id').primaryKey().defaultRandom(),
  installationId: uuid('installation_id').notNull().references(() => appInstallations.id, { onDelete: 'cascade' }),
  addonType: varchar('addon_type', { length: 50 }).notNull(),
  host: varchar('host', { length: 255 }).notNull(),
  port: integer('port').notNull(),
  database: varchar('database', { length: 255 }),
  username: varchar('username', { length: 255 }),
  passwordEncrypted: text('password_encrypted'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  installationIdx: index('idx_addons_installation').on(table.installationId),
}));

// ─── Platform: App User Assignments ─────────────────────────────────

export const appUserAssignments = pgTable('app_user_assignments', {
  id: uuid('id').primaryKey().defaultRandom(),
  installationId: uuid('installation_id').notNull().references(() => appInstallations.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull(),
  appRole: varchar('app_role', { length: 50 }).notNull().default('member'),
  assignedBy: uuid('assigned_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  uniqueAssignment: uniqueIndex('idx_app_assignments_unique').on(table.installationId, table.userId),
  installationIdx: index('idx_app_assignments_installation').on(table.installationId),
  userIdx: index('idx_app_assignments_user').on(table.userId),
}));

// ─── Platform: Provisioning Log ─────────────────────────────────────

export const provisioningLog = pgTable('provisioning_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  installationId: uuid('installation_id').notNull().references(() => appInstallations.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull(),
  action: varchar('action', { length: 50 }).notNull(),
  status: varchar('status', { length: 50 }).notNull().default('pending'),
  appRole: varchar('app_role', { length: 50 }),
  errorMessage: text('error_message'),
  attempts: integer('attempts').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
}, (table) => ({
  installationIdx: index('idx_provisioning_log_installation').on(table.installationId),
  userIdx: index('idx_provisioning_log_user').on(table.userId),
  statusIdx: index('idx_provisioning_log_status').on(table.status),
}));

// ─── Platform: App Backups ──────────────────────────────────────────

export const appBackups = pgTable('app_backups', {
  id: uuid('id').primaryKey().defaultRandom(),
  installationId: uuid('installation_id').notNull().references(() => appInstallations.id, { onDelete: 'cascade' }),
  triggeredBy: varchar('triggered_by', { length: 50 }).notNull(),
  status: varchar('status', { length: 50 }).notNull().default('pending'),
  storageKey: text('storage_key'),
  sizeBytes: bigint('size_bytes', { mode: 'number' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
}, (table) => ({
  installationIdx: index('idx_backups_installation').on(table.installationId),
}));
