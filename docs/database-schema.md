# Atlas Database Schema

> Auto-generated from `packages/server/src/db/schema.ts`
>
> **Database:** PostgreSQL via Drizzle ORM
>
> **Last updated:** 2026-03-30

---

## Table of contents

1. [Core (users, accounts, settings)](#1-core)
2. [Platform (tenants, members, invitations, apps)](#2-platform)
3. [Email and calendar](#3-email-and-calendar)
4. [CRM](#4-crm)
5. [HR](#5-hr)
6. [Tasks](#6-tasks)
7. [Drive](#7-drive)
8. [Docs](#8-docs)
9. [Draw](#9-draw)
10. [Tables](#10-tables)
11. [Sign](#11-sign)
12. [Projects](#12-projects)
13. [System](#13-system)
14. [Notifications and activity](#14-notifications-and-activity)
15. [Cross-app infrastructure](#15-cross-app-infrastructure)
16. [Relationship diagram](#16-relationship-diagram)

---

## 1. Core

### `users`

Groups multiple accounts under one person (the top-level identity).

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, default random |
| `name` | text | nullable |
| `email` | text | nullable |
| `is_super_admin` | boolean | NOT NULL, default `false` |
| `created_at` | timestamptz | NOT NULL, default now |
| `updated_at` | timestamptz | NOT NULL, default now |

**Indexes:** none (PK only)

---

### `accounts`

An authentication identity linked to a user (one per provider/email combo).

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, default random |
| `user_id` | uuid | NOT NULL, FK -> `users.id` ON DELETE CASCADE |
| `email` | text | NOT NULL, UNIQUE |
| `name` | text | nullable |
| `picture_url` | text | nullable |
| `provider` | text | NOT NULL, default `'google'` |
| `provider_id` | text | NOT NULL |
| `password_hash` | text | nullable |
| `access_token` | text | NOT NULL |
| `refresh_token` | text | NOT NULL |
| `token_expires_at` | timestamptz | NOT NULL |
| `history_id` | integer | nullable |
| `last_full_sync` | timestamptz | nullable |
| `last_sync` | timestamptz | nullable |
| `sync_status` | text | NOT NULL, default `'idle'` |
| `sync_error` | text | nullable |
| `watch_expiration` | bigint | nullable |
| `created_at` | timestamptz | NOT NULL, default now |
| `updated_at` | timestamptz | NOT NULL, default now |

**Indexes:**
- `idx_accounts_provider` on (`provider`, `provider_id`)
- `idx_accounts_user` on (`user_id`)

---

### `user_settings`

Per-account user preferences for all apps (singleton per account).

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, default random |
| `account_id` | uuid | NOT NULL, FK -> `accounts.id` ON DELETE CASCADE, UNIQUE |
| `theme` | text | NOT NULL, default `'system'` |
| `density` | text | NOT NULL, default `'default'` |
| `shortcuts_preset` | text | NOT NULL, default `'superhuman'` |
| `custom_shortcuts` | jsonb | NOT NULL, default `{}` |
| `auto_advance` | text | NOT NULL, default `'next'` |
| `reading_pane` | text | NOT NULL, default `'right'` |
| `desktop_notifications` | boolean | NOT NULL, default `true` |
| `notification_sound` | boolean | NOT NULL, default `false` |
| `signature_html` | text | nullable |
| `tracking_enabled` | boolean | NOT NULL, default `false` |
| `tasks_default_view` | text | NOT NULL, default `'inbox'` |
| `tasks_confirm_delete` | boolean | NOT NULL, default `true` |
| `tasks_show_calendar` | boolean | NOT NULL, default `true` |
| `tasks_show_evening` | boolean | NOT NULL, default `true` |
| `tasks_show_when_badges` | boolean | NOT NULL, default `true` |
| `tasks_show_project` | boolean | NOT NULL, default `true` |
| `tasks_show_notes_indicator` | boolean | NOT NULL, default `true` |
| `tasks_compact_mode` | boolean | NOT NULL, default `false` |
| `tasks_completed_behavior` | text | NOT NULL, default `'fade'` |
| `tasks_default_sort` | text | NOT NULL, default `'manual'` |
| `tasks_view_mode` | text | NOT NULL, default `'list'` |
| `date_format` | text | NOT NULL, default `'DD/MM/YYYY'` |
| `currency_symbol` | text | NOT NULL, default `'$'` |
| `timezone` | text | NOT NULL, default `''` |
| `time_format` | text | NOT NULL, default `'12h'` |
| `number_format` | text | NOT NULL, default `'comma-period'` |
| `calendar_start_day` | text | NOT NULL, default `'monday'` |
| `tables_default_view` | text | NOT NULL, default `'grid'` |
| `tables_default_sort` | text | NOT NULL, default `'none'` |
| `tables_show_field_type_icons` | boolean | NOT NULL, default `true` |
| `tables_default_row_count` | integer | NOT NULL, default `3` |
| `tables_include_row_ids_in_export` | boolean | NOT NULL, default `false` |
| `cal_default_view` | text | NOT NULL, default `'week'` |
| `cal_week_starts_on_monday` | boolean | NOT NULL, default `false` |
| `cal_show_week_numbers` | boolean | NOT NULL, default `false` |
| `cal_density` | text | NOT NULL, default `'default'` |
| `cal_work_start_hour` | integer | NOT NULL, default `9` |
| `cal_work_end_hour` | integer | NOT NULL, default `17` |
| `cal_secondary_timezone` | text | nullable |
| `cal_event_reminder_minutes` | integer | NOT NULL, default `10` |
| `language` | text | NOT NULL, default `'en'` |
| `font_family` | text | NOT NULL, default `'inter'` |
| `color_theme` | text | NOT NULL, default `'default'` |
| `show_badge_count` | boolean | NOT NULL, default `true` |
| `notification_level` | text | NOT NULL, default `'smart'` |
| `compose_mode` | text | NOT NULL, default `'rich'` |
| `signature` | text | NOT NULL, default `''` |
| `include_signature_in_replies` | boolean | NOT NULL, default `true` |
| `undo_send_delay` | integer | NOT NULL, default `5` |
| `send_animation` | boolean | NOT NULL, default `true` |
| `theme_transition` | boolean | NOT NULL, default `true` |
| `ai_enabled` | boolean | NOT NULL, default `false` |
| `ai_provider` | text | NOT NULL, default `'openai'` |
| `ai_api_keys` | jsonb | NOT NULL, default `{}` |
| `ai_custom_provider` | jsonb | NOT NULL, default `{}` |
| `ai_writing_assistant` | boolean | NOT NULL, default `true` |
| `ai_quick_replies` | boolean | NOT NULL, default `true` |
| `ai_thread_summary` | boolean | NOT NULL, default `true` |
| `ai_translation` | boolean | NOT NULL, default `true` |
| `docs_font_style` | text | NOT NULL, default `'default'` |
| `docs_small_text` | boolean | NOT NULL, default `false` |
| `docs_full_width` | boolean | NOT NULL, default `false` |
| `docs_spell_check` | boolean | NOT NULL, default `true` |
| `docs_open_last_visited` | boolean | NOT NULL, default `true` |
| `docs_sidebar_default` | text | NOT NULL, default `'tree'` |
| `doc_favorites` | jsonb | NOT NULL, default `[]` |
| `doc_recent` | jsonb | NOT NULL, default `[]` |
| `draw_grid_mode` | boolean | NOT NULL, default `false` |
| `draw_snap_to_grid` | boolean | NOT NULL, default `false` |
| `draw_default_background` | text | NOT NULL, default `'white'` |
| `draw_export_quality` | integer | NOT NULL, default `1` |
| `draw_export_with_background` | boolean | NOT NULL, default `true` |
| `draw_auto_save_interval` | integer | NOT NULL, default `2000` |
| `draw_sort_order` | text | NOT NULL, default `'modified'` |
| `draw_library` | jsonb | NOT NULL, default `[]` |
| `drive_default_view` | text | NOT NULL, default `'list'` |
| `drive_default_sort` | text | NOT NULL, default `'default'` |
| `drive_sidebar_default` | text | NOT NULL, default `'files'` |
| `drive_show_preview_panel` | boolean | NOT NULL, default `true` |
| `drive_compact_mode` | boolean | NOT NULL, default `false` |
| `drive_confirm_delete` | boolean | NOT NULL, default `true` |
| `drive_auto_version_on_replace` | boolean | NOT NULL, default `true` |
| `drive_max_versions` | integer | NOT NULL, default `20` |
| `drive_share_default_expiry` | text | NOT NULL, default `'never'` |
| `drive_duplicate_handling` | text | NOT NULL, default `'rename'` |
| `drive_show_thumbnails` | boolean | NOT NULL, default `true` |
| `drive_show_file_extensions` | boolean | NOT NULL, default `true` |
| `drive_sort_order` | text | NOT NULL, default `'asc'` |
| `recent_searches` | jsonb | NOT NULL, default `[]` |
| `home_bg_type` | text | NOT NULL, default `'unsplash'` |
| `home_bg_value` | text | nullable |
| `home_show_seconds` | boolean | NOT NULL, default `false` |
| `home_enabled_widgets` | jsonb | nullable |
| `home_dock_pet` | varchar(20) | NOT NULL, default `'cat'` |
| `app_widgets` | jsonb | nullable |
| `recent_items` | jsonb | NOT NULL, default `[]` |
| `created_at` | timestamptz | NOT NULL, default now |
| `updated_at` | timestamptz | NOT NULL, default now |

**Indexes:** none (PK + unique on `account_id`)

---

### `password_reset_tokens`

Stores temporary tokens for password reset flows.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, default random |
| `account_id` | uuid | NOT NULL, FK -> `accounts.id` ON DELETE CASCADE |
| `token` | text | NOT NULL, UNIQUE |
| `expires_at` | timestamptz | NOT NULL |
| `used_at` | timestamptz | nullable |
| `created_at` | timestamptz | default now |

**Indexes:** none (PK + unique on `token`)

---

### `contacts`

Address-book contacts synced from Google or created manually.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, default random |
| `account_id` | uuid | NOT NULL, FK -> `accounts.id` ON DELETE CASCADE |
| `email` | text | NOT NULL |
| `emails` | jsonb | NOT NULL, default `[]` |
| `name` | text | nullable |
| `given_name` | text | nullable |
| `family_name` | text | nullable |
| `photo_url` | text | nullable |
| `phone_numbers` | jsonb | NOT NULL, default `[]` |
| `organization` | text | nullable |
| `job_title` | text | nullable |
| `notes` | text | nullable |
| `google_resource_name` | text | nullable |
| `frequency` | integer | NOT NULL, default `1` |
| `last_contacted` | timestamptz | nullable |
| `created_at` | timestamptz | default now |
| `updated_at` | timestamptz | default now |

**Indexes:**
- `idx_contacts_account_email` UNIQUE on (`account_id`, `email`)
- `idx_contacts_account_freq` on (`account_id`, `frequency`)

---

## 2. Platform

### `tenants`

An organization / workspace in the multi-tenant model.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, default random |
| `slug` | varchar(63) | NOT NULL, UNIQUE |
| `name` | varchar(255) | NOT NULL |
| `plan` | varchar(50) | NOT NULL, default `'starter'` |
| `status` | varchar(50) | NOT NULL, default `'active'` |
| `owner_id` | uuid | NOT NULL |
| `k8s_namespace` | varchar(63) | NOT NULL, UNIQUE |
| `quota_cpu` | integer | NOT NULL, default `2000` |
| `quota_memory_mb` | integer | NOT NULL, default `4096` |
| `quota_storage_mb` | integer | NOT NULL, default `20480` |
| `created_at` | timestamptz | NOT NULL, default now |
| `updated_at` | timestamptz | NOT NULL, default now |

**Indexes:**
- `idx_tenants_slug` UNIQUE on (`slug`)
- `idx_tenants_owner` on (`owner_id`)

---

### `tenant_members`

Maps users to tenants with a role (owner / admin / member).

| Column | Type | Constraints |
|--------|------|-------------|
| `tenant_id` | uuid | NOT NULL, FK -> `tenants.id` ON DELETE CASCADE |
| `user_id` | uuid | NOT NULL |
| `role` | varchar(50) | NOT NULL, default `'member'` |
| `created_at` | timestamptz | NOT NULL, default now |

**Primary key:** none (composite unique instead)

**Indexes:**
- `idx_tenant_members_unique` UNIQUE on (`tenant_id`, `user_id`)

---

### `tenant_invitations`

Pending invitations to join a tenant.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, default random |
| `tenant_id` | uuid | NOT NULL, FK -> `tenants.id` ON DELETE CASCADE |
| `email` | varchar(255) | NOT NULL |
| `role` | varchar(50) | NOT NULL, default `'member'` |
| `invited_by` | uuid | NOT NULL |
| `token` | varchar(255) | NOT NULL, UNIQUE |
| `expires_at` | timestamptz | NOT NULL |
| `accepted_at` | timestamptz | nullable |
| `created_at` | timestamptz | NOT NULL, default now |

**Indexes:**
- `idx_tenant_invitations_tenant_email` UNIQUE on (`tenant_id`, `email`)
- `idx_tenant_invitations_token` UNIQUE on (`token`)

---

### `tenant_apps`

Tracks which apps are enabled per tenant.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, default random |
| `tenant_id` | uuid | NOT NULL, FK -> `tenants.id` ON DELETE CASCADE |
| `app_id` | varchar(100) | NOT NULL |
| `is_enabled` | boolean | NOT NULL, default `true` |
| `enabled_at` | timestamptz | NOT NULL, default now |
| `enabled_by` | uuid | NOT NULL |
| `config` | jsonb | NOT NULL, default `{}` |
| `created_at` | timestamptz | NOT NULL, default now |
| `updated_at` | timestamptz | NOT NULL, default now |

**Indexes:**
- `idx_tenant_apps_unique` UNIQUE on (`tenant_id`, `app_id`)
- `idx_tenant_apps_tenant` on (`tenant_id`)

---

## 3. Email and calendar

### `threads`

Email conversation threads synced from Gmail.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, default random |
| `account_id` | uuid | NOT NULL, FK -> `accounts.id` ON DELETE CASCADE |
| `gmail_thread_id` | text | NOT NULL |
| `subject` | text | nullable |
| `snippet` | text | nullable |
| `message_count` | integer | NOT NULL, default `0` |
| `unread_count` | integer | NOT NULL, default `0` |
| `has_attachments` | boolean | NOT NULL, default `false` |
| `last_message_at` | timestamptz | NOT NULL |
| `category` | text | NOT NULL, default `'other'` |
| `labels` | jsonb | NOT NULL, default `[]` |
| `is_starred` | boolean | NOT NULL, default `false` |
| `is_archived` | boolean | NOT NULL, default `false` |
| `is_trashed` | boolean | NOT NULL, default `false` |
| `is_spam` | boolean | NOT NULL, default `false` |
| `created_at` | timestamptz | NOT NULL, default now |
| `updated_at` | timestamptz | NOT NULL, default now |

**Indexes:**
- `idx_threads_account_gmail` UNIQUE on (`account_id`, `gmail_thread_id`)
- `idx_threads_account_category` on (`account_id`, `category`)
- `idx_threads_last_message` on (`account_id`, `last_message_at`)

---

### `emails`

Individual email messages within a thread.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, default random |
| `account_id` | uuid | NOT NULL, FK -> `accounts.id` ON DELETE CASCADE |
| `thread_id` | uuid | NOT NULL, FK -> `threads.id` ON DELETE CASCADE |
| `gmail_message_id` | text | NOT NULL |
| `message_id_header` | text | nullable |
| `in_reply_to` | text | nullable |
| `references_header` | text | nullable |
| `from_address` | text | NOT NULL |
| `from_name` | text | nullable |
| `to_addresses` | jsonb | NOT NULL, default `[]` |
| `cc_addresses` | jsonb | NOT NULL, default `[]` |
| `bcc_addresses` | jsonb | NOT NULL, default `[]` |
| `reply_to` | text | nullable |
| `subject` | text | nullable |
| `snippet` | text | nullable |
| `body_text` | text | nullable |
| `body_html` | text | nullable |
| `body_html_compressed` | text | nullable |
| `gmail_labels` | jsonb | NOT NULL, default `[]` |
| `is_unread` | boolean | NOT NULL, default `true` |
| `is_starred` | boolean | NOT NULL, default `false` |
| `is_draft` | boolean | NOT NULL, default `false` |
| `internal_date` | timestamptz | NOT NULL |
| `received_at` | timestamptz | nullable |
| `size_estimate` | integer | nullable |
| `search_vector` | tsvector | nullable (full-text search) |
| `created_at` | timestamptz | NOT NULL, default now |
| `updated_at` | timestamptz | NOT NULL, default now |

**Indexes:**
- `idx_emails_account_gmail` UNIQUE on (`account_id`, `gmail_message_id`)
- `idx_emails_thread` on (`thread_id`, `internal_date`)
- `idx_emails_account_date` on (`account_id`, `internal_date`)

---

### `attachments`

File attachments belonging to an email.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, default random |
| `email_id` | uuid | NOT NULL, FK -> `emails.id` ON DELETE CASCADE |
| `gmail_attachment_id` | text | nullable |
| `filename` | text | NOT NULL |
| `mime_type` | text | NOT NULL |
| `size` | integer | NOT NULL |
| `content_id` | text | nullable |
| `is_inline` | boolean | NOT NULL, default `false` |
| `storage_url` | text | nullable |
| `created_at` | timestamptz | NOT NULL, default now |

**Indexes:**
- `idx_attachments_email` on (`email_id`)

---

### `category_rules`

User-defined rules to auto-categorize incoming email threads.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, default random |
| `account_id` | uuid | NOT NULL, FK -> `accounts.id` ON DELETE CASCADE |
| `name` | text | NOT NULL |
| `category` | text | NOT NULL |
| `priority` | integer | NOT NULL, default `0` |
| `conditions` | jsonb | NOT NULL |
| `is_system` | boolean | NOT NULL, default `false` |
| `is_enabled` | boolean | NOT NULL, default `true` |
| `created_at` | timestamptz | NOT NULL, default now |
| `updated_at` | timestamptz | NOT NULL, default now |

**Indexes:**
- `idx_category_rules_account` on (`account_id`, `priority`)

---

### `email_tracking`

Tracks open/click events for sent emails.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, default random |
| `account_id` | uuid | NOT NULL, FK -> `accounts.id` ON DELETE CASCADE |
| `email_id` | uuid | FK -> `emails.id` ON DELETE SET NULL |
| `thread_id` | uuid | FK -> `threads.id` ON DELETE SET NULL |
| `tracking_id` | uuid | NOT NULL, UNIQUE, default random |
| `subject` | text | nullable |
| `recipient_address` | text | NOT NULL |
| `open_count` | integer | NOT NULL, default `0` |
| `click_count` | integer | NOT NULL, default `0` |
| `first_opened_at` | timestamptz | nullable |
| `last_opened_at` | timestamptz | nullable |
| `created_at` | timestamptz | NOT NULL, default now |

**Indexes:**
- `idx_email_tracking_account` on (`account_id`)
- `idx_email_tracking_thread` on (`thread_id`)

---

### `tracking_events`

Individual open/click events for a tracked email.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, default random |
| `tracking_id` | uuid | NOT NULL |
| `event_type` | text | NOT NULL |
| `link_url` | text | nullable |
| `ip_address` | text | nullable |
| `user_agent` | text | nullable |
| `created_at` | timestamptz | NOT NULL, default now |

**Indexes:**
- `idx_tracking_events_tracking_id` on (`tracking_id`)
- `idx_tracking_events_created_at` on (`created_at`)

---

### `calendars`

Google Calendar calendars synced for an account.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, default random |
| `account_id` | uuid | NOT NULL, FK -> `accounts.id` ON DELETE CASCADE |
| `google_calendar_id` | text | NOT NULL |
| `summary` | text | nullable |
| `description` | text | nullable |
| `background_color` | text | nullable |
| `foreground_color` | text | nullable |
| `time_zone` | text | nullable |
| `access_role` | text | nullable |
| `is_primary` | boolean | NOT NULL, default `false` |
| `is_selected` | boolean | NOT NULL, default `true` |
| `sync_token` | text | nullable |
| `last_sync_at` | timestamptz | nullable |
| `created_at` | timestamptz | NOT NULL, default now |
| `updated_at` | timestamptz | NOT NULL, default now |

**Indexes:**
- `idx_calendars_account_google` UNIQUE on (`account_id`, `google_calendar_id`)

---

### `calendar_events`

Individual calendar events synced from Google Calendar.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, default random |
| `account_id` | uuid | NOT NULL, FK -> `accounts.id` ON DELETE CASCADE |
| `calendar_id` | uuid | NOT NULL, FK -> `calendars.id` ON DELETE CASCADE |
| `google_event_id` | text | NOT NULL |
| `summary` | text | nullable |
| `description` | text | nullable |
| `location` | text | nullable |
| `start_time` | timestamptz | NOT NULL |
| `end_time` | timestamptz | NOT NULL |
| `is_all_day` | boolean | NOT NULL, default `false` |
| `status` | text | NOT NULL, default `'confirmed'` |
| `self_response_status` | text | nullable |
| `html_link` | text | nullable |
| `hangout_link` | text | nullable |
| `organizer` | jsonb | nullable |
| `attendees` | jsonb | nullable |
| `recurrence` | jsonb | nullable |
| `recurring_event_id` | text | nullable |
| `transparency` | text | nullable |
| `color_id` | text | nullable |
| `reminders` | jsonb | nullable |
| `created_at` | timestamptz | NOT NULL, default now |
| `updated_at` | timestamptz | NOT NULL, default now |

**Indexes:**
- `idx_cal_events_account_google` UNIQUE on (`account_id`, `google_event_id`)
- `idx_cal_events_calendar` on (`calendar_id`)
- `idx_cal_events_time_range` on (`account_id`, `start_time`, `end_time`)

---

## 4. CRM

### `crm_companies`

Companies / organizations tracked in the CRM.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, default random |
| `account_id` | uuid | NOT NULL |
| `user_id` | uuid | NOT NULL |
| `name` | varchar(500) | NOT NULL |
| `domain` | varchar(255) | nullable |
| `industry` | varchar(255) | nullable |
| `size` | varchar(50) | nullable |
| `address` | text | nullable |
| `phone` | varchar(50) | nullable |
| `tags` | jsonb | NOT NULL, default `[]` |
| `is_archived` | boolean | NOT NULL, default `false` |
| `sort_order` | integer | NOT NULL, default `0` |
| `created_at` | timestamptz | NOT NULL, default now |
| `updated_at` | timestamptz | NOT NULL, default now |

**Indexes:**
- `idx_crm_companies_account` on (`account_id`)

---

### `crm_contacts`

People contacts associated with CRM companies.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, default random |
| `account_id` | uuid | NOT NULL |
| `user_id` | uuid | NOT NULL |
| `name` | varchar(500) | NOT NULL |
| `email` | varchar(255) | nullable |
| `phone` | varchar(50) | nullable |
| `company_id` | uuid | FK -> `crm_companies.id` ON DELETE SET NULL |
| `position` | varchar(255) | nullable |
| `source` | varchar(100) | nullable |
| `tags` | jsonb | NOT NULL, default `[]` |
| `is_archived` | boolean | NOT NULL, default `false` |
| `sort_order` | integer | NOT NULL, default `0` |
| `created_at` | timestamptz | NOT NULL, default now |
| `updated_at` | timestamptz | NOT NULL, default now |

**Indexes:**
- `idx_crm_contacts_account` on (`account_id`)
- `idx_crm_contacts_company` on (`company_id`)

---

### `crm_deal_stages`

Pipeline stages for deals (e.g. Qualification, Proposal, Closed Won).

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, default random |
| `account_id` | uuid | NOT NULL |
| `name` | varchar(100) | NOT NULL |
| `color` | varchar(20) | NOT NULL, default `'#6b7280'` |
| `probability` | integer | NOT NULL, default `0` |
| `sequence` | integer | NOT NULL, default `0` |
| `is_default` | boolean | NOT NULL, default `false` |

**Indexes:**
- `idx_crm_stages_account` on (`account_id`)

---

### `crm_deals`

Sales deals / opportunities tracked through pipeline stages.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, default random |
| `account_id` | uuid | NOT NULL |
| `user_id` | uuid | NOT NULL |
| `title` | varchar(500) | NOT NULL |
| `value` | real | NOT NULL, default `0` |
| `stage_id` | uuid | NOT NULL, FK -> `crm_deal_stages.id` |
| `contact_id` | uuid | FK -> `crm_contacts.id` ON DELETE SET NULL |
| `company_id` | uuid | FK -> `crm_companies.id` ON DELETE SET NULL |
| `assigned_user_id` | uuid | nullable |
| `probability` | integer | NOT NULL, default `0` |
| `expected_close_date` | timestamptz | nullable |
| `won_at` | timestamptz | nullable |
| `lost_at` | timestamptz | nullable |
| `lost_reason` | text | nullable |
| `tags` | jsonb | NOT NULL, default `[]` |
| `is_archived` | boolean | NOT NULL, default `false` |
| `sort_order` | integer | NOT NULL, default `0` |
| `created_at` | timestamptz | NOT NULL, default now |
| `updated_at` | timestamptz | NOT NULL, default now |

**Indexes:**
- `idx_crm_deals_account` on (`account_id`)
- `idx_crm_deals_stage` on (`stage_id`)
- `idx_crm_deals_contact` on (`contact_id`)
- `idx_crm_deals_company` on (`company_id`)

---

### `crm_activities`

Logged activities (calls, meetings, notes) linked to deals, contacts, or companies.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, default random |
| `account_id` | uuid | NOT NULL |
| `user_id` | uuid | NOT NULL |
| `type` | varchar(50) | NOT NULL, default `'note'` |
| `body` | text | NOT NULL, default `''` |
| `deal_id` | uuid | FK -> `crm_deals.id` ON DELETE CASCADE |
| `contact_id` | uuid | FK -> `crm_contacts.id` ON DELETE CASCADE |
| `company_id` | uuid | FK -> `crm_companies.id` ON DELETE CASCADE |
| `scheduled_at` | timestamptz | nullable |
| `completed_at` | timestamptz | nullable |
| `is_archived` | boolean | NOT NULL, default `false` |
| `created_at` | timestamptz | NOT NULL, default now |
| `updated_at` | timestamptz | NOT NULL, default now |

**Indexes:**
- `idx_crm_activities_deal` on (`deal_id`)
- `idx_crm_activities_contact` on (`contact_id`)
- `idx_crm_activities_company` on (`company_id`)

---

### `crm_workflows`

Automation workflows triggered by CRM events.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, default random |
| `account_id` | uuid | NOT NULL |
| `user_id` | uuid | NOT NULL |
| `name` | varchar(500) | NOT NULL |
| `trigger` | varchar(100) | NOT NULL |
| `trigger_config` | jsonb | NOT NULL, default `{}` |
| `action` | varchar(100) | NOT NULL |
| `action_config` | jsonb | NOT NULL, default `{}` |
| `is_active` | boolean | NOT NULL, default `true` |
| `execution_count` | integer | NOT NULL, default `0` |
| `last_executed_at` | timestamptz | nullable |
| `created_at` | timestamptz | NOT NULL, default now |
| `updated_at` | timestamptz | NOT NULL, default now |

**Indexes:**
- `idx_crm_workflows_account` on (`account_id`)
- `idx_crm_workflows_trigger` on (`trigger`)

---

### `crm_permissions`

Per-user CRM role and record visibility settings.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, default random |
| `account_id` | uuid | NOT NULL |
| `user_id` | uuid | NOT NULL |
| `role` | varchar(50) | NOT NULL, default `'sales'` |
| `record_access` | varchar(50) | NOT NULL, default `'own'` |
| `created_at` | timestamptz | NOT NULL, default now |
| `updated_at` | timestamptz | NOT NULL, default now |

**Indexes:**
- `idx_crm_permissions_user` UNIQUE on (`account_id`, `user_id`)

---

### `crm_leads`

Leads that can be converted into contacts and deals.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, default random |
| `account_id` | uuid | NOT NULL |
| `user_id` | uuid | NOT NULL |
| `name` | varchar(500) | NOT NULL |
| `email` | varchar(255) | nullable |
| `phone` | varchar(50) | nullable |
| `company_name` | varchar(500) | nullable |
| `source` | varchar(50) | NOT NULL, default `'other'` |
| `status` | varchar(50) | NOT NULL, default `'new'` |
| `notes` | text | nullable |
| `converted_contact_id` | uuid | nullable |
| `converted_deal_id` | uuid | nullable |
| `tags` | jsonb | NOT NULL, default `[]` |
| `is_archived` | boolean | NOT NULL, default `false` |
| `sort_order` | integer | NOT NULL, default `0` |
| `created_at` | timestamptz | NOT NULL, default now |
| `updated_at` | timestamptz | NOT NULL, default now |

**Indexes:**
- `idx_crm_leads_account` on (`account_id`)
- `idx_crm_leads_status` on (`status`)

---

### `crm_notes`

Rich-text notes attached to CRM records.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, default random |
| `account_id` | uuid | NOT NULL |
| `user_id` | uuid | NOT NULL |
| `title` | varchar(500) | NOT NULL, default `''` |
| `content` | jsonb | NOT NULL, default `{}` |
| `deal_id` | uuid | FK -> `crm_deals.id` ON DELETE CASCADE |
| `contact_id` | uuid | FK -> `crm_contacts.id` ON DELETE CASCADE |
| `company_id` | uuid | FK -> `crm_companies.id` ON DELETE CASCADE |
| `is_pinned` | boolean | NOT NULL, default `false` |
| `is_archived` | boolean | NOT NULL, default `false` |
| `created_at` | timestamptz | NOT NULL, default now |
| `updated_at` | timestamptz | NOT NULL, default now |

**Indexes:**
- `idx_crm_notes_deal` on (`deal_id`)
- `idx_crm_notes_contact` on (`contact_id`)
- `idx_crm_notes_company` on (`company_id`)

---

## 5. HR

### `departments`

Organizational departments for HR management.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, default random |
| `account_id` | uuid | NOT NULL, FK -> `accounts.id` ON DELETE CASCADE |
| `user_id` | uuid | NOT NULL, FK -> `users.id` ON DELETE CASCADE |
| `name` | text | NOT NULL, default `'Untitled department'` |
| `head_employee_id` | uuid | nullable |
| `color` | text | NOT NULL, default `'#5a7fa0'` |
| `description` | text | nullable |
| `sort_order` | integer | NOT NULL, default `0` |
| `is_archived` | boolean | NOT NULL, default `false` |
| `created_at` | timestamptz | NOT NULL, default now |
| `updated_at` | timestamptz | NOT NULL, default now |

**Indexes:**
- `idx_departments_user` on (`user_id`, `is_archived`)
- `idx_departments_account` on (`account_id`, `is_archived`)

---

### `employees`

Employee records for the HR module.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, default random |
| `account_id` | uuid | NOT NULL, FK -> `accounts.id` ON DELETE CASCADE |
| `user_id` | uuid | NOT NULL, FK -> `users.id` ON DELETE CASCADE |
| `linked_user_id` | uuid | FK -> `users.id` ON DELETE SET NULL |
| `name` | text | NOT NULL, default `''` |
| `email` | text | NOT NULL, default `''` |
| `role` | text | NOT NULL, default `''` |
| `department_id` | uuid | FK -> `departments.id` ON DELETE SET NULL |
| `start_date` | text | nullable |
| `phone` | text | nullable |
| `avatar_url` | text | nullable |
| `status` | text | NOT NULL, default `'active'` |
| `tags` | jsonb | NOT NULL, default `[]` |
| `date_of_birth` | text | nullable |
| `gender` | varchar(20) | nullable |
| `emergency_contact_name` | varchar(255) | nullable |
| `emergency_contact_phone` | varchar(50) | nullable |
| `emergency_contact_relation` | varchar(100) | nullable |
| `employment_type` | varchar(50) | NOT NULL, default `'full-time'` |
| `manager_id` | uuid | nullable |
| `job_title` | varchar(255) | nullable |
| `work_location` | varchar(255) | nullable |
| `salary` | integer | nullable |
| `salary_currency` | varchar(10) | NOT NULL, default `'USD'` |
| `salary_period` | varchar(20) | NOT NULL, default `'yearly'` |
| `sort_order` | integer | NOT NULL, default `0` |
| `is_archived` | boolean | NOT NULL, default `false` |
| `created_at` | timestamptz | NOT NULL, default now |
| `updated_at` | timestamptz | NOT NULL, default now |

**Indexes:**
- `idx_employees_user_status` on (`user_id`, `status`, `is_archived`)
- `idx_employees_department` on (`department_id`, `sort_order`)
- `idx_employees_account` on (`account_id`, `is_archived`)

---

### `leave_balances`

Tracks leave allocation and usage per employee per year.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, default random |
| `account_id` | uuid | NOT NULL, FK -> `accounts.id` ON DELETE CASCADE |
| `employee_id` | uuid | NOT NULL, FK -> `employees.id` ON DELETE CASCADE |
| `leave_type` | varchar(50) | NOT NULL |
| `year` | integer | NOT NULL |
| `allocated` | integer | NOT NULL, default `0` |
| `used` | integer | NOT NULL, default `0` |
| `carried` | integer | NOT NULL, default `0` |
| `leave_type_id` | uuid | nullable |
| `created_at` | timestamptz | NOT NULL, default now |
| `updated_at` | timestamptz | NOT NULL, default now |

**Indexes:**
- `idx_leave_balances_employee_year` on (`employee_id`, `year`)
- `idx_leave_balances_account` on (`account_id`)

---

### `hr_leave_types`

Defines types of leave available (vacation, sick, etc.).

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, default random |
| `account_id` | uuid | NOT NULL, FK -> `accounts.id` ON DELETE CASCADE |
| `name` | varchar(255) | NOT NULL |
| `slug` | varchar(100) | NOT NULL |
| `color` | varchar(20) | NOT NULL, default `'#3b82f6'` |
| `default_days_per_year` | integer | NOT NULL, default `0` |
| `max_carry_forward` | integer | NOT NULL, default `0` |
| `requires_approval` | boolean | NOT NULL, default `true` |
| `is_paid` | boolean | NOT NULL, default `true` |
| `is_active` | boolean | NOT NULL, default `true` |
| `sort_order` | integer | NOT NULL, default `0` |
| `is_archived` | boolean | NOT NULL, default `false` |
| `created_at` | timestamptz | NOT NULL, default now |
| `updated_at` | timestamptz | NOT NULL, default now |

**Indexes:**
- `idx_hr_leave_types_account_slug` UNIQUE on (`account_id`, `slug`)
- `idx_hr_leave_types_account_active` on (`account_id`, `is_active`)

---

### `hr_leave_policies`

Named leave policies that bundle allocations for multiple leave types.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, default random |
| `account_id` | uuid | NOT NULL, FK -> `accounts.id` ON DELETE CASCADE |
| `name` | varchar(255) | NOT NULL |
| `description` | text | nullable |
| `is_default` | boolean | NOT NULL, default `false` |
| `allocations` | jsonb | NOT NULL, default `[]` |
| `is_archived` | boolean | NOT NULL, default `false` |
| `created_at` | timestamptz | NOT NULL, default now |
| `updated_at` | timestamptz | NOT NULL, default now |

**Indexes:**
- `idx_hr_leave_policies_account` on (`account_id`)

---

### `hr_leave_policy_assignments`

Assigns a leave policy to a specific employee.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, default random |
| `account_id` | uuid | NOT NULL, FK -> `accounts.id` ON DELETE CASCADE |
| `employee_id` | uuid | NOT NULL, FK -> `employees.id` ON DELETE CASCADE |
| `policy_id` | uuid | NOT NULL, FK -> `hr_leave_policies.id` ON DELETE CASCADE |
| `effective_from` | text | nullable |
| `is_archived` | boolean | NOT NULL, default `false` |
| `created_at` | timestamptz | NOT NULL, default now |
| `updated_at` | timestamptz | NOT NULL, default now |

**Indexes:**
- `idx_hr_policy_assignments_employee` on (`employee_id`)
- `idx_hr_policy_assignments_account` on (`account_id`)

---

### `hr_leave_applications`

Formal leave requests submitted by employees for approval.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, default random |
| `account_id` | uuid | NOT NULL, FK -> `accounts.id` ON DELETE CASCADE |
| `employee_id` | uuid | NOT NULL, FK -> `employees.id` ON DELETE CASCADE |
| `leave_type_id` | uuid | NOT NULL, FK -> `hr_leave_types.id` |
| `start_date` | text | NOT NULL |
| `end_date` | text | NOT NULL |
| `half_day` | boolean | NOT NULL, default `false` |
| `half_day_date` | text | nullable |
| `total_days` | real | NOT NULL, default `0` |
| `reason` | text | nullable |
| `status` | varchar(50) | NOT NULL, default `'draft'` |
| `approver_id` | uuid | FK -> `employees.id` ON DELETE SET NULL |
| `approver_comment` | text | nullable |
| `approved_at` | timestamptz | nullable |
| `rejected_at` | timestamptz | nullable |
| `balance_before` | real | nullable |
| `is_archived` | boolean | NOT NULL, default `false` |
| `sort_order` | integer | NOT NULL, default `0` |
| `created_at` | timestamptz | NOT NULL, default now |
| `updated_at` | timestamptz | NOT NULL, default now |

**Indexes:**
- `idx_hr_leave_apps_employee_status` on (`employee_id`, `status`)
- `idx_hr_leave_apps_approver_status` on (`approver_id`, `status`)
- `idx_hr_leave_apps_account_status` on (`account_id`, `status`)

---

### `time_off_requests`

Legacy time-off request records (pre-leave-application system).

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, default random |
| `account_id` | uuid | NOT NULL, FK -> `accounts.id` ON DELETE CASCADE |
| `user_id` | uuid | NOT NULL, FK -> `users.id` ON DELETE CASCADE |
| `employee_id` | uuid | NOT NULL, FK -> `employees.id` ON DELETE CASCADE |
| `type` | text | NOT NULL, default `'vacation'` |
| `start_date` | text | NOT NULL |
| `end_date` | text | NOT NULL |
| `status` | text | NOT NULL, default `'pending'` |
| `approver_id` | uuid | FK -> `employees.id` ON DELETE SET NULL |
| `notes` | text | nullable |
| `sort_order` | integer | NOT NULL, default `0` |
| `is_archived` | boolean | NOT NULL, default `false` |
| `created_at` | timestamptz | NOT NULL, default now |
| `updated_at` | timestamptz | NOT NULL, default now |

**Indexes:**
- `idx_time_off_employee` on (`employee_id`, `status`)
- `idx_time_off_status` on (`user_id`, `status`, `is_archived`)
- `idx_time_off_approver` on (`approver_id`)

---

### `hr_attendance`

Daily attendance records per employee.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, default random |
| `account_id` | uuid | NOT NULL, FK -> `accounts.id` ON DELETE CASCADE |
| `employee_id` | uuid | NOT NULL, FK -> `employees.id` ON DELETE CASCADE |
| `date` | text | NOT NULL |
| `status` | varchar(50) | NOT NULL, default `'present'` |
| `check_in_time` | text | nullable |
| `check_out_time` | text | nullable |
| `working_hours` | real | nullable |
| `notes` | text | nullable |
| `marked_by` | uuid | nullable |
| `is_archived` | boolean | NOT NULL, default `false` |
| `created_at` | timestamptz | NOT NULL, default now |
| `updated_at` | timestamptz | NOT NULL, default now |

**Indexes:**
- `idx_hr_attendance_employee_date` UNIQUE on (`employee_id`, `date`)
- `idx_hr_attendance_account_date` on (`account_id`, `date`)
- `idx_hr_attendance_employee_status` on (`employee_id`, `status`)

---

### `hr_holiday_calendars`

Named holiday calendars (e.g. "US 2026", "UK 2026").

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, default random |
| `account_id` | uuid | NOT NULL, FK -> `accounts.id` ON DELETE CASCADE |
| `name` | varchar(255) | NOT NULL |
| `year` | integer | NOT NULL |
| `description` | text | nullable |
| `is_default` | boolean | NOT NULL, default `false` |
| `is_archived` | boolean | NOT NULL, default `false` |
| `created_at` | timestamptz | NOT NULL, default now |
| `updated_at` | timestamptz | NOT NULL, default now |

**Indexes:**
- `idx_hr_holiday_calendars_account` on (`account_id`)

---

### `hr_holidays`

Individual holiday entries within a holiday calendar.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, default random |
| `account_id` | uuid | NOT NULL, FK -> `accounts.id` ON DELETE CASCADE |
| `calendar_id` | uuid | NOT NULL, FK -> `hr_holiday_calendars.id` ON DELETE CASCADE |
| `name` | varchar(255) | NOT NULL |
| `date` | text | NOT NULL |
| `description` | text | nullable |
| `type` | varchar(50) | NOT NULL, default `'public'` |
| `is_recurring` | boolean | NOT NULL, default `false` |
| `is_archived` | boolean | NOT NULL, default `false` |
| `created_at` | timestamptz | NOT NULL, default now |
| `updated_at` | timestamptz | NOT NULL, default now |

**Indexes:**
- `idx_hr_holidays_calendar` on (`calendar_id`)
- `idx_hr_holidays_account_date` on (`account_id`, `date`)

---

### `hr_lifecycle_events`

Tracks employee lifecycle changes (promotions, transfers, terminations).

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, default random |
| `account_id` | uuid | NOT NULL, FK -> `accounts.id` ON DELETE CASCADE |
| `employee_id` | uuid | NOT NULL, FK -> `employees.id` ON DELETE CASCADE |
| `event_type` | varchar(50) | NOT NULL |
| `event_date` | text | NOT NULL |
| `effective_date` | text | nullable |
| `from_value` | text | nullable |
| `to_value` | text | nullable |
| `from_department_id` | uuid | nullable |
| `to_department_id` | uuid | nullable |
| `notes` | text | nullable |
| `created_by` | uuid | nullable |
| `is_archived` | boolean | NOT NULL, default `false` |
| `created_at` | timestamptz | NOT NULL, default now |
| `updated_at` | timestamptz | NOT NULL, default now |

**Indexes:**
- `idx_hr_lifecycle_employee_date` on (`employee_id`, `event_date`)
- `idx_hr_lifecycle_account` on (`account_id`)

---

### `onboarding_tasks`

Checklist items for onboarding a new employee.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, default random |
| `account_id` | uuid | NOT NULL, FK -> `accounts.id` ON DELETE CASCADE |
| `employee_id` | uuid | NOT NULL, FK -> `employees.id` ON DELETE CASCADE |
| `title` | varchar(500) | NOT NULL |
| `description` | text | nullable |
| `category` | varchar(100) | NOT NULL, default `'general'` |
| `due_date` | text | nullable |
| `completed_at` | timestamptz | nullable |
| `completed_by` | uuid | nullable |
| `sort_order` | integer | NOT NULL, default `0` |
| `is_archived` | boolean | NOT NULL, default `false` |
| `created_at` | timestamptz | NOT NULL, default now |
| `updated_at` | timestamptz | NOT NULL, default now |

**Indexes:**
- `idx_onboarding_tasks_employee` on (`employee_id`, `is_archived`)
- `idx_onboarding_tasks_account` on (`account_id`)

---

### `onboarding_templates`

Reusable templates for onboarding task checklists.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, default random |
| `account_id` | uuid | NOT NULL, FK -> `accounts.id` ON DELETE CASCADE |
| `name` | varchar(255) | NOT NULL |
| `tasks` | jsonb | NOT NULL, default `[]` |
| `created_at` | timestamptz | NOT NULL, default now |
| `updated_at` | timestamptz | NOT NULL, default now |

**Indexes:**
- `idx_onboarding_templates_account` on (`account_id`)

---

### `employee_documents`

Files uploaded for an employee (contracts, IDs, certificates).

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, default random |
| `account_id` | uuid | NOT NULL, FK -> `accounts.id` ON DELETE CASCADE |
| `employee_id` | uuid | NOT NULL, FK -> `employees.id` ON DELETE CASCADE |
| `name` | varchar(500) | NOT NULL |
| `type` | varchar(100) | NOT NULL, default `'other'` |
| `storage_path` | text | NOT NULL |
| `mime_type` | varchar(100) | nullable |
| `size` | integer | nullable |
| `expires_at` | text | nullable |
| `notes` | text | nullable |
| `uploaded_by` | uuid | NOT NULL |
| `is_archived` | boolean | NOT NULL, default `false` |
| `created_at` | timestamptz | NOT NULL, default now |
| `updated_at` | timestamptz | NOT NULL, default now |

**Indexes:**
- `idx_employee_documents_employee` on (`employee_id`, `is_archived`)
- `idx_employee_documents_account` on (`account_id`)

---

## 6. Tasks

### `task_projects`

Projects that group related tasks together.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, default random |
| `account_id` | uuid | NOT NULL, FK -> `accounts.id` ON DELETE CASCADE |
| `user_id` | uuid | NOT NULL, FK -> `users.id` ON DELETE CASCADE |
| `title` | text | NOT NULL, default `'Untitled project'` |
| `description` | text | nullable |
| `icon` | text | nullable |
| `color` | text | NOT NULL, default `'#5a7fa0'` |
| `sort_order` | integer | NOT NULL, default `0` |
| `is_archived` | boolean | NOT NULL, default `false` |
| `created_at` | timestamptz | NOT NULL, default now |
| `updated_at` | timestamptz | NOT NULL, default now |

**Indexes:**
- `idx_task_projects_user` on (`user_id`, `is_archived`)

---

### `tasks`

Individual to-do items with scheduling, priority, and recurrence.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, default random |
| `account_id` | uuid | NOT NULL, FK -> `accounts.id` ON DELETE CASCADE |
| `user_id` | uuid | NOT NULL, FK -> `users.id` ON DELETE CASCADE |
| `project_id` | uuid | FK -> `task_projects.id` ON DELETE SET NULL |
| `title` | text | NOT NULL, default `''` |
| `notes` | text | nullable |
| `description` | text | nullable |
| `icon` | text | nullable |
| `type` | text | NOT NULL, default `'task'` |
| `heading_id` | uuid | nullable |
| `status` | text | NOT NULL, default `'todo'` |
| `when` | text | NOT NULL, default `'inbox'` |
| `priority` | text | NOT NULL, default `'none'` |
| `due_date` | text | nullable |
| `completed_at` | timestamptz | nullable |
| `tags` | jsonb | NOT NULL, default `[]` |
| `recurrence_rule` | text | nullable |
| `recurrence_parent_id` | uuid | self-FK -> `tasks.id` ON DELETE SET NULL |
| `source_email_id` | text | nullable |
| `source_email_subject` | text | nullable |
| `sort_order` | integer | NOT NULL, default `0` |
| `is_archived` | boolean | NOT NULL, default `false` |
| `created_at` | timestamptz | NOT NULL, default now |
| `updated_at` | timestamptz | NOT NULL, default now |

**Indexes:**
- `idx_tasks_user_status` on (`user_id`, `status`, `is_archived`)
- `idx_tasks_user_when` on (`user_id`, `when`, `status`)
- `idx_tasks_project` on (`project_id`, `sort_order`)
- `idx_tasks_due_date` on (`user_id`, `due_date`)

---

### `subtasks`

Checklist items nested under a parent task.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, default random |
| `task_id` | uuid | NOT NULL, FK -> `tasks.id` ON DELETE CASCADE |
| `user_id` | uuid | NOT NULL, FK -> `users.id` ON DELETE CASCADE |
| `title` | text | NOT NULL, default `''` |
| `is_completed` | boolean | NOT NULL, default `false` |
| `sort_order` | integer | NOT NULL, default `0` |
| `created_at` | timestamptz | NOT NULL, default now |

**Indexes:**
- `idx_subtasks_task` on (`task_id`, `sort_order`)

---

### `task_activities`

Audit log of changes made to a task.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, default random |
| `task_id` | uuid | NOT NULL, FK -> `tasks.id` ON DELETE CASCADE |
| `user_id` | uuid | NOT NULL, FK -> `users.id` ON DELETE CASCADE |
| `action` | text | NOT NULL |
| `field` | text | nullable |
| `old_value` | text | nullable |
| `new_value` | text | nullable |
| `created_at` | timestamptz | NOT NULL, default now |

**Indexes:**
- `idx_task_activities_task` on (`task_id`, `created_at`)

---

### `task_templates`

Reusable task templates with default values and subtask titles.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, default random |
| `user_id` | uuid | NOT NULL, FK -> `users.id` ON DELETE CASCADE |
| `account_id` | uuid | NOT NULL, FK -> `accounts.id` ON DELETE CASCADE |
| `title` | text | NOT NULL, default `'Untitled template'` |
| `description` | text | nullable |
| `icon` | text | nullable |
| `default_when` | text | NOT NULL, default `'inbox'` |
| `default_priority` | text | NOT NULL, default `'none'` |
| `default_tags` | jsonb | NOT NULL, default `[]` |
| `subtask_titles` | jsonb | NOT NULL, default `[]` |
| `sort_order` | integer | NOT NULL, default `0` |
| `created_at` | timestamptz | NOT NULL, default now |

**Indexes:**
- `idx_task_templates_user` on (`user_id`)

---

## 7. Drive

### `drive_items`

Files and folders stored in the Drive app.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, default random |
| `account_id` | uuid | NOT NULL, FK -> `accounts.id` ON DELETE CASCADE |
| `user_id` | uuid | NOT NULL, FK -> `users.id` ON DELETE CASCADE |
| `name` | text | NOT NULL |
| `type` | text | NOT NULL, default `'file'` |
| `mime_type` | text | nullable |
| `size` | integer | nullable |
| `parent_id` | uuid | self-FK -> `drive_items.id` ON DELETE SET NULL |
| `storage_path` | text | nullable |
| `icon` | text | nullable |
| `linked_resource_type` | text | nullable |
| `linked_resource_id` | text | nullable |
| `is_favourite` | boolean | NOT NULL, default `false` |
| `is_archived` | boolean | NOT NULL, default `false` |
| `tags` | jsonb | NOT NULL, default `[]` |
| `sort_order` | integer | NOT NULL, default `0` |
| `created_at` | timestamptz | NOT NULL, default now |
| `updated_at` | timestamptz | NOT NULL, default now |

**Indexes:**
- `idx_drive_items_user_parent` on (`user_id`, `parent_id`, `is_archived`)
- `idx_drive_items_user_archived` on (`user_id`, `is_archived`)
- `idx_drive_items_user_favourite` on (`user_id`, `is_favourite`)

---

### `drive_item_versions`

Historical versions of a drive file.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, default random |
| `drive_item_id` | uuid | NOT NULL, FK -> `drive_items.id` ON DELETE CASCADE |
| `account_id` | uuid | NOT NULL, FK -> `accounts.id` ON DELETE CASCADE |
| `user_id` | uuid | NOT NULL, FK -> `users.id` ON DELETE CASCADE |
| `name` | text | NOT NULL |
| `mime_type` | text | nullable |
| `size` | integer | nullable |
| `storage_path` | text | nullable |
| `created_at` | timestamptz | NOT NULL, default now |

**Indexes:**
- `idx_drive_versions_item` on (`drive_item_id`, `created_at`)

---

### `drive_share_links`

Shareable links for drive items with optional expiration.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, default random |
| `drive_item_id` | uuid | NOT NULL, FK -> `drive_items.id` ON DELETE CASCADE |
| `user_id` | uuid | NOT NULL, FK -> `users.id` ON DELETE CASCADE |
| `share_token` | text | NOT NULL, UNIQUE |
| `expires_at` | timestamptz | nullable |
| `created_at` | timestamptz | NOT NULL, default now |

**Indexes:**
- `idx_share_links_token` on (`share_token`)
- `idx_share_links_item` on (`drive_item_id`)

---

## 8. Docs

### `documents`

Notion-style hierarchical documents with rich content.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, default random |
| `account_id` | uuid | NOT NULL, FK -> `accounts.id` ON DELETE CASCADE |
| `user_id` | uuid | NOT NULL, FK -> `users.id` ON DELETE CASCADE |
| `parent_id` | uuid | self-FK -> `documents.id` ON DELETE SET NULL |
| `title` | text | NOT NULL, default `'Untitled'` |
| `content` | jsonb | nullable |
| `icon` | text | nullable |
| `cover_image` | text | nullable |
| `sort_order` | integer | NOT NULL, default `0` |
| `is_archived` | boolean | NOT NULL, default `false` |
| `created_at` | timestamptz | NOT NULL, default now |
| `updated_at` | timestamptz | NOT NULL, default now |

**Indexes:**
- `idx_documents_account` on (`account_id`, `is_archived`)
- `idx_documents_user` on (`user_id`, `is_archived`)
- `idx_documents_parent` on (`parent_id`, `sort_order`)
- `idx_documents_account_parent` on (`account_id`, `parent_id`, `sort_order`)
- `idx_documents_user_parent` on (`user_id`, `parent_id`, `sort_order`)

---

### `document_versions`

Point-in-time snapshots of a document for version history.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, default random |
| `document_id` | uuid | NOT NULL, FK -> `documents.id` ON DELETE CASCADE |
| `account_id` | uuid | NOT NULL, FK -> `accounts.id` ON DELETE CASCADE |
| `user_id` | uuid | NOT NULL, FK -> `users.id` ON DELETE CASCADE |
| `title` | text | NOT NULL |
| `content` | jsonb | nullable |
| `created_at` | timestamptz | NOT NULL, default now |

**Indexes:**
- `idx_document_versions_doc` on (`document_id`, `created_at`)

---

### `document_comments`

Inline comments and replies on document content.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, default random |
| `document_id` | uuid | NOT NULL, FK -> `documents.id` ON DELETE CASCADE |
| `user_id` | uuid | NOT NULL, FK -> `users.id` ON DELETE CASCADE |
| `account_id` | uuid | NOT NULL, FK -> `accounts.id` ON DELETE CASCADE |
| `content` | text | NOT NULL |
| `selection_from` | integer | nullable |
| `selection_to` | integer | nullable |
| `selection_text` | text | nullable |
| `is_resolved` | boolean | NOT NULL, default `false` |
| `parent_id` | uuid | self-FK -> `document_comments.id` ON DELETE CASCADE |
| `created_at` | timestamptz | NOT NULL, default now |
| `updated_at` | timestamptz | NOT NULL, default now |

**Indexes:**
- `idx_document_comments_doc` on (`document_id`)
- `idx_document_comments_parent` on (`parent_id`)

---

### `document_links`

Bidirectional links between documents.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, default random |
| `source_doc_id` | uuid | NOT NULL, FK -> `documents.id` ON DELETE CASCADE |
| `target_doc_id` | uuid | NOT NULL, FK -> `documents.id` ON DELETE CASCADE |
| `created_at` | timestamptz | NOT NULL, default now |

**Indexes:**
- `idx_document_links_source` on (`source_doc_id`)
- `idx_document_links_target` on (`target_doc_id`)
- `idx_document_links_unique` UNIQUE on (`source_doc_id`, `target_doc_id`)

---

## 9. Draw

### `drawings`

Excalidraw-based drawing canvases.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, default random |
| `account_id` | uuid | NOT NULL, FK -> `accounts.id` ON DELETE CASCADE |
| `user_id` | uuid | NOT NULL, FK -> `users.id` ON DELETE CASCADE |
| `title` | text | NOT NULL, default `'Untitled drawing'` |
| `content` | jsonb | nullable |
| `thumbnail_url` | text | nullable |
| `sort_order` | integer | NOT NULL, default `0` |
| `is_archived` | boolean | NOT NULL, default `false` |
| `created_at` | timestamptz | NOT NULL, default now |
| `updated_at` | timestamptz | NOT NULL, default now |

**Indexes:**
- `idx_drawings_account` on (`account_id`, `is_archived`)
- `idx_drawings_user` on (`user_id`, `is_archived`)

---

## 10. Tables

### `spreadsheets`

Airtable-like spreadsheets with columns, rows, and view configuration stored as JSON.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, default random |
| `account_id` | uuid | NOT NULL, FK -> `accounts.id` ON DELETE CASCADE |
| `user_id` | uuid | NOT NULL, FK -> `users.id` ON DELETE CASCADE |
| `title` | text | NOT NULL, default `'Untitled table'` |
| `columns` | jsonb | NOT NULL, default `[]` |
| `rows` | jsonb | NOT NULL, default `[]` |
| `view_config` | jsonb | NOT NULL, default `{ activeView: 'grid' }` |
| `sort_order` | integer | NOT NULL, default `0` |
| `is_archived` | boolean | NOT NULL, default `false` |
| `color` | text | nullable |
| `icon` | text | nullable |
| `guide` | text | nullable |
| `created_at` | timestamptz | NOT NULL, default now |
| `updated_at` | timestamptz | NOT NULL, default now |

**Indexes:**
- `idx_spreadsheets_user` on (`user_id`, `is_archived`)
- `idx_spreadsheets_account` on (`account_id`, `is_archived`)

---

## 11. Sign

### `signature_documents`

Documents uploaded for electronic signature workflows.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, default random |
| `account_id` | uuid | NOT NULL |
| `user_id` | uuid | NOT NULL |
| `title` | varchar(500) | NOT NULL |
| `file_name` | varchar(500) | NOT NULL |
| `storage_path` | text | NOT NULL |
| `page_count` | integer | NOT NULL, default `1` |
| `status` | varchar(50) | NOT NULL, default `'draft'` |
| `expires_at` | timestamptz | nullable |
| `completed_at` | timestamptz | nullable |
| `tags` | jsonb | NOT NULL, default `[]` |
| `is_archived` | boolean | NOT NULL, default `false` |
| `sort_order` | integer | NOT NULL, default `0` |
| `created_at` | timestamptz | NOT NULL, default now |
| `updated_at` | timestamptz | NOT NULL, default now |

**Indexes:**
- `idx_sig_docs_account` on (`account_id`)
- `idx_sig_docs_status` on (`status`)

---

### `signature_fields`

Placeholders on a signature document page where signers fill in data.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, default random |
| `document_id` | uuid | NOT NULL, FK -> `signature_documents.id` ON DELETE CASCADE |
| `type` | varchar(50) | NOT NULL, default `'signature'` |
| `page_number` | integer | NOT NULL, default `1` |
| `x` | real | NOT NULL |
| `y` | real | NOT NULL |
| `width` | real | NOT NULL |
| `height` | real | NOT NULL |
| `signer_email` | varchar(255) | nullable |
| `label` | varchar(255) | nullable |
| `required` | boolean | NOT NULL, default `true` |
| `signed_at` | timestamptz | nullable |
| `signature_data` | text | nullable |
| `sort_order` | integer | NOT NULL, default `0` |
| `created_at` | timestamptz | NOT NULL, default now |
| `updated_at` | timestamptz | NOT NULL, default now |

**Indexes:**
- `idx_sig_fields_document` on (`document_id`)

---

### `signing_tokens`

One-time tokens sent to signers to authenticate their signing session.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, default random |
| `document_id` | uuid | NOT NULL, FK -> `signature_documents.id` ON DELETE CASCADE |
| `signer_email` | varchar(255) | NOT NULL |
| `signer_name` | varchar(255) | nullable |
| `token` | varchar(255) | NOT NULL, UNIQUE |
| `status` | varchar(50) | NOT NULL, default `'pending'` |
| `signed_at` | timestamptz | nullable |
| `decline_reason` | text | nullable |
| `expires_at` | timestamptz | NOT NULL |
| `created_at` | timestamptz | NOT NULL, default now |
| `updated_at` | timestamptz | NOT NULL, default now |

**Indexes:**
- `idx_signing_tokens_token` UNIQUE on (`token`)
- `idx_signing_tokens_document` on (`document_id`)

---

## 12. Projects

### `project_clients`

Clients that projects and invoices are billed to.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, default random |
| `account_id` | uuid | NOT NULL |
| `user_id` | uuid | NOT NULL |
| `name` | varchar(500) | NOT NULL |
| `email` | varchar(255) | nullable |
| `phone` | varchar(50) | nullable |
| `address` | text | nullable |
| `city` | varchar(255) | nullable |
| `state` | varchar(255) | nullable |
| `country` | varchar(255) | nullable |
| `postal_code` | varchar(20) | nullable |
| `currency` | varchar(10) | NOT NULL, default `'USD'` |
| `logo` | text | nullable |
| `portal_token` | uuid | default random |
| `notes` | text | nullable |
| `is_archived` | boolean | NOT NULL, default `false` |
| `sort_order` | integer | NOT NULL, default `0` |
| `created_at` | timestamptz | NOT NULL, default now |
| `updated_at` | timestamptz | NOT NULL, default now |

**Indexes:**
- `idx_project_clients_account` on (`account_id`)
- `idx_project_clients_portal_token` UNIQUE on (`portal_token`)

---

### `project_projects`

Billable projects linked to clients with time tracking.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, default random |
| `account_id` | uuid | NOT NULL |
| `user_id` | uuid | NOT NULL |
| `client_id` | uuid | FK -> `project_clients.id` ON DELETE SET NULL |
| `name` | varchar(500) | NOT NULL |
| `description` | text | nullable |
| `billable` | boolean | NOT NULL, default `true` |
| `status` | varchar(50) | NOT NULL, default `'active'` |
| `estimated_hours` | real | nullable |
| `estimated_amount` | real | nullable |
| `start_date` | timestamptz | nullable |
| `end_date` | timestamptz | nullable |
| `color` | varchar(20) | nullable |
| `is_archived` | boolean | NOT NULL, default `false` |
| `sort_order` | integer | NOT NULL, default `0` |
| `created_at` | timestamptz | NOT NULL, default now |
| `updated_at` | timestamptz | NOT NULL, default now |

**Indexes:**
- `idx_project_projects_account` on (`account_id`)
- `idx_project_projects_client` on (`client_id`)
- `idx_project_projects_status` on (`status`)

---

### `project_members`

Users assigned to a project with optional hourly rate.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, default random |
| `user_id` | uuid | NOT NULL |
| `project_id` | uuid | NOT NULL, FK -> `project_projects.id` ON DELETE CASCADE |
| `hourly_rate` | real | nullable |
| `role` | varchar(50) | NOT NULL, default `'member'` |
| `created_at` | timestamptz | NOT NULL, default now |
| `updated_at` | timestamptz | NOT NULL, default now |

**Indexes:**
- `idx_project_members_project` on (`project_id`)
- `idx_project_members_user_project` UNIQUE on (`user_id`, `project_id`)

---

### `project_time_entries`

Time logged against a project on a given work date.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, default random |
| `account_id` | uuid | NOT NULL |
| `user_id` | uuid | NOT NULL |
| `project_id` | uuid | NOT NULL, FK -> `project_projects.id` ON DELETE CASCADE |
| `duration_minutes` | integer | NOT NULL, default `0` |
| `work_date` | varchar(10) | NOT NULL |
| `start_time` | varchar(5) | nullable |
| `end_time` | varchar(5) | nullable |
| `billable` | boolean | NOT NULL, default `true` |
| `billed` | boolean | NOT NULL, default `false` |
| `locked` | boolean | NOT NULL, default `false` |
| `invoice_line_item_id` | uuid | nullable |
| `notes` | text | nullable |
| `task_description` | varchar(500) | nullable |
| `is_archived` | boolean | NOT NULL, default `false` |
| `sort_order` | integer | NOT NULL, default `0` |
| `created_at` | timestamptz | NOT NULL, default now |
| `updated_at` | timestamptz | NOT NULL, default now |

**Indexes:**
- `idx_project_time_entries_account` on (`account_id`)
- `idx_project_time_entries_project` on (`project_id`)
- `idx_project_time_entries_user_date` on (`user_id`, `work_date`)
- `idx_project_time_entries_billed` on (`billed`, `billable`)

---

### `project_invoices`

Invoices sent to clients for completed work.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, default random |
| `account_id` | uuid | NOT NULL |
| `user_id` | uuid | NOT NULL |
| `client_id` | uuid | NOT NULL, FK -> `project_clients.id` ON DELETE CASCADE |
| `invoice_number` | varchar(50) | NOT NULL |
| `status` | varchar(50) | NOT NULL, default `'draft'` |
| `amount` | real | NOT NULL, default `0` |
| `tax` | real | NOT NULL, default `0` |
| `tax_amount` | real | NOT NULL, default `0` |
| `discount` | real | NOT NULL, default `0` |
| `discount_amount` | real | NOT NULL, default `0` |
| `currency` | varchar(10) | NOT NULL, default `'USD'` |
| `issue_date` | timestamptz | nullable |
| `due_date` | timestamptz | nullable |
| `notes` | text | nullable |
| `sent_at` | timestamptz | nullable |
| `viewed_at` | timestamptz | nullable |
| `paid_at` | timestamptz | nullable |
| `is_archived` | boolean | NOT NULL, default `false` |
| `created_at` | timestamptz | NOT NULL, default now |
| `updated_at` | timestamptz | NOT NULL, default now |

**Indexes:**
- `idx_project_invoices_account` on (`account_id`)
- `idx_project_invoices_client` on (`client_id`)
- `idx_project_invoices_status` on (`status`)
- `idx_project_invoices_number` UNIQUE on (`account_id`, `invoice_number`)

---

### `project_invoice_line_items`

Individual line items on an invoice, optionally linked to a time entry.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, default random |
| `invoice_id` | uuid | NOT NULL, FK -> `project_invoices.id` ON DELETE CASCADE |
| `time_entry_id` | uuid | FK -> `project_time_entries.id` ON DELETE SET NULL |
| `description` | varchar(500) | NOT NULL, default `''` |
| `quantity` | real | NOT NULL, default `1` |
| `unit_price` | real | NOT NULL, default `0` |
| `amount` | real | NOT NULL, default `0` |
| `created_at` | timestamptz | NOT NULL, default now |
| `updated_at` | timestamptz | NOT NULL, default now |

**Indexes:**
- `idx_project_line_items_invoice` on (`invoice_id`)
- `idx_project_line_items_time_entry` on (`time_entry_id`)

---

### `project_settings`

Per-account settings for the Projects module (invoice prefix, rates, branding).

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, default random |
| `account_id` | uuid | NOT NULL |
| `invoice_prefix` | varchar(20) | NOT NULL, default `'INV'` |
| `default_hourly_rate` | real | NOT NULL, default `0` |
| `company_name` | varchar(500) | nullable |
| `company_address` | text | nullable |
| `company_logo` | text | nullable |
| `next_invoice_number` | integer | NOT NULL, default `1` |
| `created_at` | timestamptz | NOT NULL, default now |
| `updated_at` | timestamptz | NOT NULL, default now |

**Indexes:**
- `idx_project_settings_account` UNIQUE on (`account_id`)

---

## 13. System

### `system_settings`

Global system configuration (singleton row, admin-only).

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, default random |
| `smtp_host` | varchar(255) | nullable |
| `smtp_port` | integer | NOT NULL, default `587` |
| `smtp_user` | varchar(255) | nullable |
| `smtp_pass` | text | nullable |
| `smtp_from` | varchar(255) | NOT NULL, default `'Atlas <noreply@atlas.local>'` |
| `smtp_secure` | boolean | NOT NULL, default `false` |
| `smtp_enabled` | boolean | NOT NULL, default `false` |
| `created_at` | timestamptz | NOT NULL, default now |
| `updated_at` | timestamptz | NOT NULL, default now |

**Indexes:** none (PK only)

---

## 14. Notifications and activity

### `notifications`

In-app notifications delivered to users.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, default random |
| `user_id` | uuid | NOT NULL, FK -> `users.id` ON DELETE CASCADE |
| `account_id` | uuid | NOT NULL, FK -> `accounts.id` ON DELETE CASCADE |
| `type` | text | NOT NULL, default `'reminder'` |
| `title` | text | NOT NULL |
| `body` | text | nullable |
| `source_type` | text | nullable |
| `source_id` | text | nullable |
| `is_read` | boolean | NOT NULL, default `false` |
| `created_at` | timestamptz | NOT NULL, default now |

**Indexes:**
- `idx_notifications_user` on (`user_id`, `is_read`)
- `idx_notifications_user_created` on (`user_id`, `created_at`)

---

### `activity_feed`

Cross-app activity feed for tenant-wide audit trail.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, default random |
| `tenant_id` | uuid | NOT NULL |
| `user_id` | uuid | NOT NULL |
| `app_id` | varchar(50) | NOT NULL |
| `event_type` | varchar(100) | NOT NULL |
| `title` | text | NOT NULL |
| `metadata` | jsonb | NOT NULL, default `{}` |
| `created_at` | timestamptz | NOT NULL, default now |

**Indexes:**
- `idx_activity_feed_tenant_created` on (`tenant_id`, `created_at`)
- `idx_activity_feed_user` on (`user_id`)

---

### `push_subscriptions`

Web push notification subscriptions for a user.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, default random |
| `user_id` | uuid | NOT NULL, FK -> `users.id` ON DELETE CASCADE |
| `endpoint` | text | NOT NULL |
| `p256dh` | text | NOT NULL |
| `auth` | text | NOT NULL |
| `created_at` | timestamptz | NOT NULL, default now |

**Indexes:**
- `idx_push_subscriptions_user` on (`user_id`)

---

## 15. Cross-app infrastructure

### `custom_field_definitions`

Schema for user-defined custom fields on any app record type.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, default random |
| `tenant_id` | uuid | FK -> `tenants.id` ON DELETE CASCADE |
| `app_id` | varchar(100) | NOT NULL |
| `record_type` | varchar(100) | NOT NULL |
| `name` | varchar(255) | NOT NULL |
| `slug` | varchar(255) | NOT NULL |
| `field_type` | varchar(50) | NOT NULL |
| `options` | jsonb | NOT NULL, default `{}` |
| `is_required` | boolean | NOT NULL, default `false` |
| `sort_order` | integer | NOT NULL, default `0` |
| `created_by` | uuid | NOT NULL |
| `created_at` | timestamptz | NOT NULL, default now |
| `updated_at` | timestamptz | NOT NULL, default now |

**Indexes:**
- `idx_cfd_tenant_app` on (`tenant_id`, `app_id`, `record_type`)
- `idx_cfd_slug_unique` UNIQUE on (`tenant_id`, `app_id`, `record_type`, `slug`)

---

### `record_links`

Cross-app record-to-record links (e.g. linking a CRM deal to a task).

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, default random |
| `tenant_id` | uuid | FK -> `tenants.id` ON DELETE CASCADE |
| `source_app_id` | varchar(100) | NOT NULL |
| `source_record_id` | uuid | NOT NULL |
| `target_app_id` | varchar(100) | NOT NULL |
| `target_record_id` | uuid | NOT NULL |
| `link_type` | varchar(100) | NOT NULL, default `'related'` |
| `metadata` | jsonb | NOT NULL, default `{}` |
| `created_by` | uuid | NOT NULL |
| `created_at` | timestamptz | NOT NULL, default now |

**Indexes:**
- `idx_record_links_source` on (`source_app_id`, `source_record_id`)
- `idx_record_links_target` on (`target_app_id`, `target_record_id`)
- `idx_record_links_unique` UNIQUE on (`source_app_id`, `source_record_id`, `target_app_id`, `target_record_id`, `link_type`)

---

## 16. Relationship diagram

```
                            ┌──────────────┐
                            │    users     │
                            │──────────────│
                            │ id (PK)      │
                            └──────┬───────┘
                                   │ 1
                                   │
                          ┌────────┴────────┐
                          │                 │
                          ▼ *               ▼ *
                   ┌──────────────┐  ┌──────────────────┐
                   │   accounts   │  │  tenant_members   │
                   │──────────────│  │──────────────────│
                   │ id (PK)      │  │ tenant_id (FK)   │
                   │ user_id (FK) │  │ user_id          │
                   └──────┬───────┘  └────────┬─────────┘
                          │ 1                  │
          ┌───────────────┼───────────────┐    │
          │               │               │    ▼ *
          ▼ *             ▼ 1             │  ┌──────────────┐
   ┌──────────────┐ ┌────────────────┐    │  │   tenants    │
   │   threads    │ │ user_settings  │    │  │──────────────│
   │──────────────│ │────────────────│    │  │ id (PK)      │
   │ account_id   │ │ account_id (U) │    │  └──────┬───────┘
   └──────┬───────┘ └────────────────┘    │         │ 1
          │ 1                              │         │
          ▼ *                              │    ┌────┴──────────────┐
   ┌──────────────┐                        │    │                   │
   │    emails    │                        │    ▼ *                 ▼ *
   │──────────────│                        │  ┌─────────────┐  ┌──────────────────┐
   │ thread_id    │                        │  │ tenant_apps │  │tenant_invitations│
   └──────┬───────┘                        │  └─────────────┘  └──────────────────┘
          │ 1                              │
          ▼ *                              │
   ┌──────────────┐                        │
   │ attachments  │                        │
   └──────────────┘                        │
                                           │
  ┌────────────────────────────────────────┘
  │  accounts.id is the central FK for most app tables:
  │
  ├──▶ documents ──▶ document_versions
  │            └───▶ document_comments
  │            └───▶ document_links
  │
  ├──▶ tasks ──────▶ subtasks
  │        └───────▶ task_activities
  │        └───────▶ task_projects
  │        └───────▶ task_templates
  │
  ├──▶ spreadsheets
  │
  ├──▶ drive_items ──▶ drive_item_versions
  │             └────▶ drive_share_links
  │
  ├──▶ drawings
  │
  ├──▶ notifications
  │
  ├──▶ email_tracking ──▶ tracking_events
  │
  ├──▶ calendars ──▶ calendar_events
  │
  ├──▶ contacts
  │
  ├──▶ category_rules
  │
  ├──▶ password_reset_tokens
  │
  ├──▶ signature_documents ──▶ signature_fields
  │                     └────▶ signing_tokens
  │
  ├──▶ departments
  │
  ├──▶ employees ──────────▶ leave_balances
  │          │    └────────▶ onboarding_tasks
  │          │    └────────▶ employee_documents
  │          │    └────────▶ hr_attendance
  │          │    └────────▶ hr_lifecycle_events
  │          │    └────────▶ hr_leave_applications
  │          │    └────────▶ hr_leave_policy_assignments
  │          │    └────────▶ time_off_requests
  │          │
  │          └──▶ departments (department_id FK)
  │
  ├──▶ hr_leave_types
  ├──▶ hr_leave_policies
  ├──▶ hr_holiday_calendars ──▶ hr_holidays
  ├──▶ onboarding_templates
  │
  ├──▶ crm_companies ──┬──▶ crm_contacts
  │                    ├──▶ crm_deals
  │                    ├──▶ crm_activities
  │                    └──▶ crm_notes
  │
  ├──▶ crm_deal_stages ──▶ crm_deals
  │
  ├──▶ crm_leads
  ├──▶ crm_workflows
  ├──▶ crm_permissions
  │
  ├──▶ project_clients ──▶ project_invoices ──▶ project_invoice_line_items
  │                └────▶ project_projects ──▶ project_members
  │                                    └────▶ project_time_entries
  │
  └──▶ project_settings


  Cross-app (tenant-scoped):

  tenants.id
    ├──▶ custom_field_definitions
    ├──▶ record_links
    └──▶ activity_feed
```

---

## Summary statistics

| Domain | Tables |
|--------|--------|
| Core | 5 (users, accounts, user_settings, password_reset_tokens, contacts) |
| Platform | 4 (tenants, tenant_members, tenant_invitations, tenant_apps) |
| Email/Calendar | 7 (threads, emails, attachments, category_rules, email_tracking, tracking_events, calendars, calendar_events) |
| CRM | 8 (crm_companies, crm_contacts, crm_deal_stages, crm_deals, crm_activities, crm_workflows, crm_permissions, crm_leads, crm_notes) |
| HR | 12 (departments, employees, leave_balances, hr_leave_types, hr_leave_policies, hr_leave_policy_assignments, hr_leave_applications, hr_attendance, hr_holiday_calendars, hr_holidays, hr_lifecycle_events, onboarding_tasks, onboarding_templates, employee_documents, time_off_requests) |
| Tasks | 5 (task_projects, tasks, subtasks, task_activities, task_templates) |
| Drive | 3 (drive_items, drive_item_versions, drive_share_links) |
| Docs | 4 (documents, document_versions, document_comments, document_links) |
| Draw | 1 (drawings) |
| Tables | 1 (spreadsheets) |
| Sign | 3 (signature_documents, signature_fields, signing_tokens) |
| Projects | 7 (project_clients, project_projects, project_members, project_time_entries, project_invoices, project_invoice_line_items, project_settings) |
| System | 1 (system_settings) |
| Notifications/Activity | 3 (notifications, activity_feed, push_subscriptions) |
| Cross-app | 2 (custom_field_definitions, record_links) |
| **Total** | **~60 tables** |
