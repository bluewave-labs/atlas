import pg from 'pg';
import { env } from '../config/env';
import { logger } from '../utils/logger';

/**
 * Run all database migrations idempotently using CREATE TABLE IF NOT EXISTS.
 * This replaces both the old SQLite DDL in database.ts and the platform
 * schema migration for the unified PostgreSQL database.
 */
export async function runMigrations() {
  const client = new pg.Client({ connectionString: env.DATABASE_URL });
  await client.connect();

  try {
    // Enable uuid-ossp extension for gen_random_uuid()
    await client.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    // ─── Core user/account tables ───────────────────────────────────

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT,
        email TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS accounts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        email TEXT NOT NULL UNIQUE,
        name TEXT,
        picture_url TEXT,
        provider TEXT NOT NULL DEFAULT 'google',
        provider_id TEXT NOT NULL,
        password_hash TEXT,
        access_token TEXT NOT NULL,
        refresh_token TEXT NOT NULL,
        token_expires_at TIMESTAMPTZ NOT NULL,
        history_id INTEGER,
        last_full_sync TIMESTAMPTZ,
        last_sync TIMESTAMPTZ,
        sync_status TEXT NOT NULL DEFAULT 'idle',
        sync_error TEXT,
        watch_expiration BIGINT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS threads (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        gmail_thread_id TEXT NOT NULL,
        subject TEXT,
        snippet TEXT,
        message_count INTEGER NOT NULL DEFAULT 0,
        unread_count INTEGER NOT NULL DEFAULT 0,
        has_attachments BOOLEAN NOT NULL DEFAULT FALSE,
        last_message_at TIMESTAMPTZ NOT NULL,
        category TEXT NOT NULL DEFAULT 'other',
        labels JSONB NOT NULL DEFAULT '[]',
        is_starred BOOLEAN NOT NULL DEFAULT FALSE,
        is_archived BOOLEAN NOT NULL DEFAULT FALSE,
        is_trashed BOOLEAN NOT NULL DEFAULT FALSE,
        is_spam BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS emails (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        thread_id UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
        gmail_message_id TEXT NOT NULL,
        message_id_header TEXT,
        in_reply_to TEXT,
        references_header TEXT,
        from_address TEXT NOT NULL,
        from_name TEXT,
        to_addresses JSONB NOT NULL DEFAULT '[]',
        cc_addresses JSONB NOT NULL DEFAULT '[]',
        bcc_addresses JSONB NOT NULL DEFAULT '[]',
        reply_to TEXT,
        subject TEXT,
        snippet TEXT,
        body_text TEXT,
        body_html TEXT,
        body_html_compressed TEXT,
        gmail_labels JSONB NOT NULL DEFAULT '[]',
        is_unread BOOLEAN NOT NULL DEFAULT TRUE,
        is_starred BOOLEAN NOT NULL DEFAULT FALSE,
        is_draft BOOLEAN NOT NULL DEFAULT FALSE,
        internal_date TIMESTAMPTZ NOT NULL,
        received_at TIMESTAMPTZ,
        size_estimate INTEGER,
        search_vector tsvector,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS attachments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email_id UUID NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
        gmail_attachment_id TEXT,
        filename TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size INTEGER NOT NULL,
        content_id TEXT,
        is_inline BOOLEAN NOT NULL DEFAULT FALSE,
        storage_url TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS category_rules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        priority INTEGER NOT NULL DEFAULT 0,
        conditions JSONB NOT NULL,
        is_system BOOLEAN NOT NULL DEFAULT FALSE,
        is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS user_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE UNIQUE,
        theme TEXT NOT NULL DEFAULT 'system',
        density TEXT NOT NULL DEFAULT 'default',
        shortcuts_preset TEXT NOT NULL DEFAULT 'superhuman',
        custom_shortcuts JSONB NOT NULL DEFAULT '{}',
        auto_advance TEXT NOT NULL DEFAULT 'next',
        reading_pane TEXT NOT NULL DEFAULT 'right',
        desktop_notifications BOOLEAN NOT NULL DEFAULT TRUE,
        notification_sound BOOLEAN NOT NULL DEFAULT FALSE,
        signature_html TEXT,
        tracking_enabled BOOLEAN NOT NULL DEFAULT FALSE,
        tasks_default_view TEXT NOT NULL DEFAULT 'inbox',
        tasks_confirm_delete BOOLEAN NOT NULL DEFAULT TRUE,
        tasks_show_calendar BOOLEAN NOT NULL DEFAULT TRUE,
        tasks_show_evening BOOLEAN NOT NULL DEFAULT TRUE,
        tasks_show_when_badges BOOLEAN NOT NULL DEFAULT TRUE,
        tasks_show_project BOOLEAN NOT NULL DEFAULT TRUE,
        tasks_show_notes_indicator BOOLEAN NOT NULL DEFAULT TRUE,
        tasks_compact_mode BOOLEAN NOT NULL DEFAULT FALSE,
        tasks_completed_behavior TEXT NOT NULL DEFAULT 'fade',
        tasks_default_sort TEXT NOT NULL DEFAULT 'manual',
        tasks_view_mode TEXT NOT NULL DEFAULT 'list',
        date_format TEXT NOT NULL DEFAULT 'MM/DD/YYYY',
        currency_symbol TEXT NOT NULL DEFAULT '$',
        timezone TEXT NOT NULL DEFAULT '',
        tables_default_view TEXT NOT NULL DEFAULT 'grid',
        tables_default_sort TEXT NOT NULL DEFAULT 'none',
        tables_show_field_type_icons BOOLEAN NOT NULL DEFAULT TRUE,
        tables_default_row_count INTEGER NOT NULL DEFAULT 3,
        tables_include_row_ids_in_export BOOLEAN NOT NULL DEFAULT FALSE,
        cal_default_view TEXT NOT NULL DEFAULT 'week',
        cal_week_starts_on_monday BOOLEAN NOT NULL DEFAULT FALSE,
        cal_show_week_numbers BOOLEAN NOT NULL DEFAULT FALSE,
        cal_density TEXT NOT NULL DEFAULT 'default',
        cal_work_start_hour INTEGER NOT NULL DEFAULT 9,
        cal_work_end_hour INTEGER NOT NULL DEFAULT 17,
        cal_secondary_timezone TEXT,
        cal_event_reminder_minutes INTEGER NOT NULL DEFAULT 10,
        language TEXT NOT NULL DEFAULT 'en',
        font_family TEXT NOT NULL DEFAULT 'inter',
        color_theme TEXT NOT NULL DEFAULT 'default',
        show_badge_count BOOLEAN NOT NULL DEFAULT TRUE,
        notification_level TEXT NOT NULL DEFAULT 'smart',
        compose_mode TEXT NOT NULL DEFAULT 'rich',
        signature TEXT NOT NULL DEFAULT '',
        include_signature_in_replies BOOLEAN NOT NULL DEFAULT TRUE,
        undo_send_delay INTEGER NOT NULL DEFAULT 5,
        send_animation BOOLEAN NOT NULL DEFAULT TRUE,
        theme_transition BOOLEAN NOT NULL DEFAULT TRUE,
        ai_enabled BOOLEAN NOT NULL DEFAULT FALSE,
        ai_provider TEXT NOT NULL DEFAULT 'openai',
        ai_api_keys JSONB NOT NULL DEFAULT '{}',
        ai_custom_provider JSONB NOT NULL DEFAULT '{}',
        ai_writing_assistant BOOLEAN NOT NULL DEFAULT TRUE,
        ai_quick_replies BOOLEAN NOT NULL DEFAULT TRUE,
        ai_thread_summary BOOLEAN NOT NULL DEFAULT TRUE,
        ai_translation BOOLEAN NOT NULL DEFAULT TRUE,
        docs_font_style TEXT NOT NULL DEFAULT 'default',
        docs_small_text BOOLEAN NOT NULL DEFAULT FALSE,
        docs_full_width BOOLEAN NOT NULL DEFAULT FALSE,
        docs_spell_check BOOLEAN NOT NULL DEFAULT TRUE,
        docs_open_last_visited BOOLEAN NOT NULL DEFAULT TRUE,
        docs_sidebar_default TEXT NOT NULL DEFAULT 'tree',
        doc_favorites JSONB NOT NULL DEFAULT '[]',
        doc_recent JSONB NOT NULL DEFAULT '[]',
        draw_grid_mode BOOLEAN NOT NULL DEFAULT FALSE,
        draw_snap_to_grid BOOLEAN NOT NULL DEFAULT FALSE,
        draw_default_background TEXT NOT NULL DEFAULT 'white',
        draw_export_quality INTEGER NOT NULL DEFAULT 1,
        draw_export_with_background BOOLEAN NOT NULL DEFAULT TRUE,
        draw_auto_save_interval INTEGER NOT NULL DEFAULT 2000,
        draw_sort_order TEXT NOT NULL DEFAULT 'modified',
        draw_library JSONB NOT NULL DEFAULT '[]',
        drive_default_view TEXT NOT NULL DEFAULT 'list',
        drive_default_sort TEXT NOT NULL DEFAULT 'default',
        drive_sidebar_default TEXT NOT NULL DEFAULT 'files',
        drive_show_preview_panel BOOLEAN NOT NULL DEFAULT TRUE,
        drive_compact_mode BOOLEAN NOT NULL DEFAULT FALSE,
        drive_confirm_delete BOOLEAN NOT NULL DEFAULT TRUE,
        drive_auto_version_on_replace BOOLEAN NOT NULL DEFAULT TRUE,
        drive_max_versions INTEGER NOT NULL DEFAULT 20,
        drive_share_default_expiry TEXT NOT NULL DEFAULT 'never',
        drive_duplicate_handling TEXT NOT NULL DEFAULT 'rename',
        drive_show_thumbnails BOOLEAN NOT NULL DEFAULT TRUE,
        drive_show_file_extensions BOOLEAN NOT NULL DEFAULT TRUE,
        drive_sort_order TEXT NOT NULL DEFAULT 'asc',
        recent_searches JSONB NOT NULL DEFAULT '[]',
        home_bg_type TEXT NOT NULL DEFAULT 'unsplash',
        home_bg_value TEXT,
        home_enabled_widgets JSONB,
        recent_items JSONB NOT NULL DEFAULT '[]',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS contacts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        email TEXT NOT NULL,
        emails JSONB NOT NULL DEFAULT '[]',
        name TEXT,
        given_name TEXT,
        family_name TEXT,
        photo_url TEXT,
        phone_numbers JSONB NOT NULL DEFAULT '[]',
        organization TEXT,
        job_title TEXT,
        notes TEXT,
        google_resource_name TEXT,
        frequency INTEGER NOT NULL DEFAULT 1,
        last_contacted TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS email_tracking (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        email_id UUID REFERENCES emails(id) ON DELETE SET NULL,
        thread_id UUID REFERENCES threads(id) ON DELETE SET NULL,
        tracking_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
        subject TEXT,
        recipient_address TEXT NOT NULL,
        open_count INTEGER NOT NULL DEFAULT 0,
        click_count INTEGER NOT NULL DEFAULT 0,
        first_opened_at TIMESTAMPTZ,
        last_opened_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS tracking_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tracking_id UUID NOT NULL,
        event_type TEXT NOT NULL,
        link_url TEXT,
        ip_address TEXT,
        user_agent TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS calendars (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        google_calendar_id TEXT NOT NULL,
        summary TEXT,
        description TEXT,
        background_color TEXT,
        foreground_color TEXT,
        time_zone TEXT,
        access_role TEXT,
        is_primary BOOLEAN NOT NULL DEFAULT FALSE,
        is_selected BOOLEAN NOT NULL DEFAULT TRUE,
        sync_token TEXT,
        last_sync_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS calendar_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        calendar_id UUID NOT NULL REFERENCES calendars(id) ON DELETE CASCADE,
        google_event_id TEXT NOT NULL,
        summary TEXT,
        description TEXT,
        location TEXT,
        start_time TIMESTAMPTZ NOT NULL,
        end_time TIMESTAMPTZ NOT NULL,
        is_all_day BOOLEAN NOT NULL DEFAULT FALSE,
        status TEXT NOT NULL DEFAULT 'confirmed',
        self_response_status TEXT,
        html_link TEXT,
        hangout_link TEXT,
        organizer JSONB,
        attendees JSONB,
        recurrence JSONB,
        recurring_event_id TEXT,
        transparency TEXT,
        color_id TEXT,
        reminders JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        token TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        parent_id UUID REFERENCES documents(id) ON DELETE SET NULL,
        title TEXT NOT NULL DEFAULT 'Untitled',
        content JSONB,
        icon TEXT,
        cover_image TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_archived BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS document_versions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        content JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS task_projects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL DEFAULT 'Untitled project',
        description TEXT,
        icon TEXT,
        color TEXT NOT NULL DEFAULT '#5a7fa0',
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_archived BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        project_id UUID REFERENCES task_projects(id) ON DELETE SET NULL,
        title TEXT NOT NULL DEFAULT '',
        notes TEXT,
        description TEXT,
        icon TEXT,
        type TEXT NOT NULL DEFAULT 'task',
        heading_id UUID,
        status TEXT NOT NULL DEFAULT 'todo',
        "when" TEXT NOT NULL DEFAULT 'inbox',
        priority TEXT NOT NULL DEFAULT 'none',
        due_date TEXT,
        completed_at TIMESTAMPTZ,
        tags JSONB NOT NULL DEFAULT '[]',
        recurrence_rule TEXT,
        recurrence_parent_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
        source_email_id TEXT,
        source_email_subject TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_archived BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS spreadsheets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL DEFAULT 'Untitled table',
        columns JSONB NOT NULL DEFAULT '[]',
        rows JSONB NOT NULL DEFAULT '[]',
        view_config JSONB NOT NULL DEFAULT '{"activeView":"grid"}',
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_archived BOOLEAN NOT NULL DEFAULT FALSE,
        color TEXT,
        icon TEXT,
        guide TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS drive_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'file',
        mime_type TEXT,
        size INTEGER,
        parent_id UUID REFERENCES drive_items(id) ON DELETE SET NULL,
        storage_path TEXT,
        icon TEXT,
        linked_resource_type TEXT,
        linked_resource_id TEXT,
        is_favourite BOOLEAN NOT NULL DEFAULT FALSE,
        is_archived BOOLEAN NOT NULL DEFAULT FALSE,
        tags JSONB NOT NULL DEFAULT '[]',
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS drive_item_versions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        drive_item_id UUID NOT NULL REFERENCES drive_items(id) ON DELETE CASCADE,
        account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        mime_type TEXT,
        size INTEGER,
        storage_path TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS drive_share_links (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        drive_item_id UUID NOT NULL REFERENCES drive_items(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        share_token TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS drive_item_shares (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        drive_item_id UUID NOT NULL REFERENCES drive_items(id) ON DELETE CASCADE,
        shared_with_user_id UUID NOT NULL,
        permission VARCHAR(20) NOT NULL DEFAULT 'view',
        shared_by_user_id UUID NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT idx_drive_shares_unique UNIQUE (drive_item_id, shared_with_user_id)
      );

      CREATE TABLE IF NOT EXISTS drive_activity_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        drive_item_id UUID NOT NULL REFERENCES drive_items(id) ON DELETE CASCADE,
        account_id UUID NOT NULL,
        user_id UUID NOT NULL,
        action VARCHAR(100) NOT NULL,
        metadata JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS drive_comments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        drive_item_id UUID NOT NULL REFERENCES drive_items(id) ON DELETE CASCADE,
        account_id UUID NOT NULL,
        user_id UUID NOT NULL,
        body TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS drawings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL DEFAULT 'Untitled drawing',
        content JSONB,
        thumbnail_url TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_archived BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        type TEXT NOT NULL DEFAULT 'reminder',
        title TEXT NOT NULL,
        body TEXT,
        source_type TEXT,
        source_id TEXT,
        is_read BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS activity_feed (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        user_id UUID NOT NULL,
        app_id VARCHAR(50) NOT NULL,
        event_type VARCHAR(100) NOT NULL,
        title TEXT NOT NULL,
        metadata JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        endpoint TEXT NOT NULL,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS subtasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL DEFAULT '',
        is_completed BOOLEAN NOT NULL DEFAULT FALSE,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS task_activities (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        action TEXT NOT NULL,
        field TEXT,
        old_value TEXT,
        new_value TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS task_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        title TEXT NOT NULL DEFAULT 'Untitled template',
        description TEXT,
        icon TEXT,
        default_when TEXT NOT NULL DEFAULT 'inbox',
        default_priority TEXT NOT NULL DEFAULT 'none',
        default_tags JSONB NOT NULL DEFAULT '[]',
        subtask_titles JSONB NOT NULL DEFAULT '[]',
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS document_comments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        selection_from INTEGER,
        selection_to INTEGER,
        selection_text TEXT,
        is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
        parent_id UUID REFERENCES document_comments(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS document_links (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        source_doc_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        target_doc_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // ─── Platform tables ────────────────────────────────────────────

    await client.query(`
      CREATE TABLE IF NOT EXISTS tenants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        slug VARCHAR(63) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        plan VARCHAR(50) NOT NULL DEFAULT 'starter',
        status VARCHAR(50) NOT NULL DEFAULT 'active',
        owner_id UUID NOT NULL,
        k8s_namespace VARCHAR(63) UNIQUE NOT NULL,
        quota_cpu INTEGER NOT NULL DEFAULT 2000,
        quota_memory_mb INTEGER NOT NULL DEFAULT 4096,
        quota_storage_mb INTEGER NOT NULL DEFAULT 20480,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS tenant_members (
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        user_id UUID NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'member',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(tenant_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS tenant_invitations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        email VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'member',
        invited_by UUID NOT NULL,
        token VARCHAR(255) UNIQUE NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        accepted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(tenant_id, email)
      );

      CREATE TABLE IF NOT EXISTS tenant_apps (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        app_id VARCHAR(100) NOT NULL,
        is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        enabled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        enabled_by UUID NOT NULL,
        config JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(tenant_id, app_id)
      );

      CREATE TABLE IF NOT EXISTS custom_field_definitions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
        app_id VARCHAR(100) NOT NULL,
        record_type VARCHAR(100) NOT NULL,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) NOT NULL,
        field_type VARCHAR(50) NOT NULL,
        options JSONB NOT NULL DEFAULT '{}',
        is_required BOOLEAN NOT NULL DEFAULT FALSE,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_by UUID NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(tenant_id, app_id, record_type, slug)
      );

      CREATE TABLE IF NOT EXISTS custom_field_values (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id UUID NOT NULL,
        field_definition_id UUID NOT NULL REFERENCES custom_field_definitions(id) ON DELETE CASCADE,
        record_id UUID NOT NULL,
        value JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(record_id, field_definition_id)
      );
      CREATE INDEX IF NOT EXISTS idx_cfv_field ON custom_field_values(field_definition_id);
      CREATE INDEX IF NOT EXISTS idx_cfv_record ON custom_field_values(record_id);
      CREATE INDEX IF NOT EXISTS idx_cfv_account ON custom_field_values(account_id);

      CREATE TABLE IF NOT EXISTS record_links (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
        source_app_id VARCHAR(100) NOT NULL,
        source_record_id UUID NOT NULL,
        target_app_id VARCHAR(100) NOT NULL,
        target_record_id UUID NOT NULL,
        link_type VARCHAR(100) NOT NULL DEFAULT 'related',
        metadata JSONB NOT NULL DEFAULT '{}',
        created_by UUID NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(source_app_id, source_record_id, target_app_id, target_record_id, link_type)
      );

      CREATE TABLE IF NOT EXISTS departments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL DEFAULT 'Untitled department',
        head_employee_id UUID,
        color TEXT NOT NULL DEFAULT '#5a7fa0',
        description TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_archived BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS employees (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        linked_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        name TEXT NOT NULL DEFAULT '',
        email TEXT NOT NULL DEFAULT '',
        role TEXT NOT NULL DEFAULT '',
        department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
        start_date TEXT,
        phone TEXT,
        avatar_url TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        tags JSONB NOT NULL DEFAULT '[]',
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_archived BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      -- Extended employee fields (idempotent ALTERs)
      ALTER TABLE employees ADD COLUMN IF NOT EXISTS date_of_birth TEXT;
      ALTER TABLE employees ADD COLUMN IF NOT EXISTS gender VARCHAR(20);
      ALTER TABLE employees ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(255);
      ALTER TABLE employees ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(50);
      ALTER TABLE employees ADD COLUMN IF NOT EXISTS emergency_contact_relation VARCHAR(100);
      ALTER TABLE employees ADD COLUMN IF NOT EXISTS employment_type VARCHAR(50) NOT NULL DEFAULT 'full-time';
      ALTER TABLE employees ADD COLUMN IF NOT EXISTS manager_id UUID;
      ALTER TABLE employees ADD COLUMN IF NOT EXISTS job_title VARCHAR(255);
      ALTER TABLE employees ADD COLUMN IF NOT EXISTS work_location VARCHAR(255);
      ALTER TABLE employees ADD COLUMN IF NOT EXISTS salary INTEGER;
      ALTER TABLE employees ADD COLUMN IF NOT EXISTS salary_currency VARCHAR(10) NOT NULL DEFAULT 'USD';
      ALTER TABLE employees ADD COLUMN IF NOT EXISTS salary_period VARCHAR(20) NOT NULL DEFAULT 'yearly';

      CREATE TABLE IF NOT EXISTS leave_balances (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        leave_type VARCHAR(50) NOT NULL,
        year INTEGER NOT NULL,
        allocated INTEGER NOT NULL DEFAULT 0,
        used INTEGER NOT NULL DEFAULT 0,
        carried INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS onboarding_tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        title VARCHAR(500) NOT NULL,
        description TEXT,
        category VARCHAR(100) NOT NULL DEFAULT 'general',
        due_date TEXT,
        completed_at TIMESTAMPTZ,
        completed_by UUID,
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_archived BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS onboarding_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        tasks JSONB NOT NULL DEFAULT '[]',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS employee_documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        name VARCHAR(500) NOT NULL,
        type VARCHAR(100) NOT NULL DEFAULT 'other',
        storage_path TEXT NOT NULL,
        mime_type VARCHAR(100),
        size INTEGER,
        expires_at TEXT,
        notes TEXT,
        uploaded_by UUID NOT NULL,
        is_archived BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS time_off_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        type TEXT NOT NULL DEFAULT 'vacation',
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        approver_id UUID REFERENCES employees(id) ON DELETE SET NULL,
        notes TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_archived BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS app_catalog (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        manifest_id VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        tags JSONB NOT NULL DEFAULT '[]',
        icon_url TEXT,
        color VARCHAR(20),
        description TEXT,
        current_version VARCHAR(100) NOT NULL,
        manifest JSONB NOT NULL,
        min_plan VARCHAR(50) NOT NULL DEFAULT 'starter',
        is_published BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS app_installations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        catalog_app_id UUID NOT NULL REFERENCES app_catalog(id),
        installed_version VARCHAR(100) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'installing',
        subdomain VARCHAR(63) NOT NULL,
        k8s_deployment_name VARCHAR(253),
        oidc_client_id VARCHAR(255),
        oidc_client_secret TEXT,
        addon_refs JSONB NOT NULL DEFAULT '{}',
        last_health_status VARCHAR(50),
        custom_env JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(tenant_id, subdomain)
      );

      CREATE TABLE IF NOT EXISTS app_addons (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        installation_id UUID NOT NULL REFERENCES app_installations(id) ON DELETE CASCADE,
        addon_type VARCHAR(50) NOT NULL,
        host VARCHAR(255) NOT NULL,
        port INTEGER NOT NULL,
        database VARCHAR(255),
        username VARCHAR(255),
        password_encrypted TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS app_user_assignments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        installation_id UUID NOT NULL REFERENCES app_installations(id) ON DELETE CASCADE,
        user_id UUID NOT NULL,
        app_role VARCHAR(50) NOT NULL DEFAULT 'member',
        assigned_by UUID NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(installation_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS app_backups (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        installation_id UUID NOT NULL REFERENCES app_installations(id) ON DELETE CASCADE,
        triggered_by VARCHAR(50) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        storage_key TEXT,
        size_bytes BIGINT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMPTZ
      );
    `);

    // ─── Provisioning log table ──────────────────────────────────────

    await client.query(`
      CREATE TABLE IF NOT EXISTS provisioning_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        installation_id UUID NOT NULL REFERENCES app_installations(id) ON DELETE CASCADE,
        user_id UUID NOT NULL,
        action VARCHAR(50) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        app_role VARCHAR(50),
        error_message TEXT,
        attempts INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMPTZ
      );
    `);

    // Add provisioning columns to app_installations (idempotent)
    await client.query(`
      ALTER TABLE app_installations ADD COLUMN IF NOT EXISTS provisioning_api_token TEXT;
      ALTER TABLE app_installations ADD COLUMN IF NOT EXISTS provisioning_enabled BOOLEAN NOT NULL DEFAULT FALSE;
    `);

    // Add super admin column to users (idempotent)
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT FALSE;
    `);

    // ─── Signature tables ────────────────────────────────────────────

    await client.query(`
      CREATE TABLE IF NOT EXISTS signature_documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id UUID NOT NULL,
        user_id UUID NOT NULL,
        title VARCHAR(500) NOT NULL,
        file_name VARCHAR(500) NOT NULL,
        storage_path TEXT NOT NULL,
        page_count INTEGER NOT NULL DEFAULT 1,
        status VARCHAR(50) NOT NULL DEFAULT 'draft',
        expires_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        tags JSONB NOT NULL DEFAULT '[]',
        is_archived BOOLEAN NOT NULL DEFAULT FALSE,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS signature_fields (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        document_id UUID NOT NULL REFERENCES signature_documents(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL DEFAULT 'signature',
        page_number INTEGER NOT NULL DEFAULT 1,
        x REAL NOT NULL,
        y REAL NOT NULL,
        width REAL NOT NULL,
        height REAL NOT NULL,
        signer_email VARCHAR(255),
        label VARCHAR(255),
        required BOOLEAN NOT NULL DEFAULT TRUE,
        signed_at TIMESTAMPTZ,
        signature_data TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS signing_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        document_id UUID NOT NULL REFERENCES signature_documents(id) ON DELETE CASCADE,
        signer_email VARCHAR(255) NOT NULL,
        signer_name VARCHAR(255),
        token VARCHAR(255) UNIQUE NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        signed_at TIMESTAMPTZ,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Add decline_reason column to signing_tokens (idempotent)
    await client.query(`
      ALTER TABLE signing_tokens ADD COLUMN IF NOT EXISTS decline_reason TEXT;
    `);

    // Add signing_order and last_reminder_at columns to signing_tokens (idempotent)
    await client.query(`
      ALTER TABLE signing_tokens ADD COLUMN IF NOT EXISTS signing_order INTEGER NOT NULL DEFAULT 0;
    `);
    await client.query(`
      ALTER TABLE signing_tokens ADD COLUMN IF NOT EXISTS last_reminder_at TIMESTAMPTZ;
    `);
    await client.query(`
      ALTER TABLE signing_tokens ADD COLUMN IF NOT EXISTS role VARCHAR(50) NOT NULL DEFAULT 'signer';
    `);

    // Add redirect_url column to signature_documents (idempotent)
    await client.query(`
      ALTER TABLE signature_documents ADD COLUMN IF NOT EXISTS redirect_url TEXT;
    `);

    // ─── Signature audit log ────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS sign_audit_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        document_id UUID NOT NULL REFERENCES signature_documents(id) ON DELETE CASCADE,
        action VARCHAR(100) NOT NULL,
        actor_email VARCHAR(255),
        actor_name VARCHAR(255),
        ip_address VARCHAR(100),
        user_agent TEXT,
        metadata JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // ─── Signature templates ────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS sign_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id UUID NOT NULL,
        user_id UUID NOT NULL,
        title VARCHAR(500) NOT NULL,
        file_name VARCHAR(500) NOT NULL,
        storage_path TEXT NOT NULL,
        page_count INTEGER NOT NULL DEFAULT 1,
        fields JSONB NOT NULL DEFAULT '[]',
        is_archived BOOLEAN NOT NULL DEFAULT FALSE,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Add format columns to user_settings (idempotent)
    await client.query(`
      ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS time_format TEXT NOT NULL DEFAULT '12h';
      ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS number_format TEXT NOT NULL DEFAULT 'comma-period';
      ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS calendar_start_day TEXT NOT NULL DEFAULT 'sunday';
    `);

    // Add app_widgets column to user_settings (idempotent)
    await client.query(`
      ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS app_widgets JSONB;
      ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS home_show_seconds BOOLEAN NOT NULL DEFAULT FALSE;
      ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS home_dock_pet VARCHAR(20) NOT NULL DEFAULT 'cat';
      ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS home_flying_birds BOOLEAN NOT NULL DEFAULT TRUE;
    `);

    // Add home_demo_data_active column to user_settings (idempotent)
    await client.query(`
      ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS home_demo_data_active BOOLEAN NOT NULL DEFAULT FALSE;
    `);

    // ─── CRM tables ─────────────────────────────────────────────────

    await client.query(`
      CREATE TABLE IF NOT EXISTS crm_companies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id UUID NOT NULL,
        user_id UUID NOT NULL,
        name VARCHAR(500) NOT NULL,
        domain VARCHAR(255),
        industry VARCHAR(255),
        size VARCHAR(50),
        address TEXT,
        phone VARCHAR(50),
        tags JSONB NOT NULL DEFAULT '[]',
        is_archived BOOLEAN NOT NULL DEFAULT FALSE,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS crm_contacts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id UUID NOT NULL,
        user_id UUID NOT NULL,
        name VARCHAR(500) NOT NULL,
        email VARCHAR(255),
        phone VARCHAR(50),
        company_id UUID REFERENCES crm_companies(id) ON DELETE SET NULL,
        position VARCHAR(255),
        source VARCHAR(100),
        tags JSONB NOT NULL DEFAULT '[]',
        is_archived BOOLEAN NOT NULL DEFAULT FALSE,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS crm_deal_stages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id UUID NOT NULL,
        name VARCHAR(100) NOT NULL,
        color VARCHAR(20) NOT NULL DEFAULT '#6b7280',
        probability INTEGER NOT NULL DEFAULT 0,
        sequence INTEGER NOT NULL DEFAULT 0,
        is_default BOOLEAN NOT NULL DEFAULT FALSE
      );

      CREATE TABLE IF NOT EXISTS crm_deals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id UUID NOT NULL,
        user_id UUID NOT NULL,
        title VARCHAR(500) NOT NULL,
        value REAL NOT NULL DEFAULT 0,
        stage_id UUID NOT NULL REFERENCES crm_deal_stages(id),
        contact_id UUID REFERENCES crm_contacts(id) ON DELETE SET NULL,
        company_id UUID REFERENCES crm_companies(id) ON DELETE SET NULL,
        assigned_user_id UUID,
        probability INTEGER NOT NULL DEFAULT 0,
        expected_close_date TIMESTAMPTZ,
        won_at TIMESTAMPTZ,
        lost_at TIMESTAMPTZ,
        lost_reason TEXT,
        tags JSONB NOT NULL DEFAULT '[]',
        is_archived BOOLEAN NOT NULL DEFAULT FALSE,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS crm_activities (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id UUID NOT NULL,
        user_id UUID NOT NULL,
        type VARCHAR(50) NOT NULL DEFAULT 'note',
        body TEXT NOT NULL DEFAULT '',
        deal_id UUID REFERENCES crm_deals(id) ON DELETE CASCADE,
        contact_id UUID REFERENCES crm_contacts(id) ON DELETE CASCADE,
        company_id UUID REFERENCES crm_companies(id) ON DELETE CASCADE,
        scheduled_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        is_archived BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS crm_workflows (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id UUID NOT NULL,
        user_id UUID NOT NULL,
        name VARCHAR(500) NOT NULL,
        trigger VARCHAR(100) NOT NULL,
        trigger_config JSONB NOT NULL DEFAULT '{}',
        action VARCHAR(100) NOT NULL,
        action_config JSONB NOT NULL DEFAULT '{}',
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        execution_count INTEGER NOT NULL DEFAULT 0,
        last_executed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS crm_permissions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id UUID NOT NULL,
        user_id UUID NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'sales',
        record_access VARCHAR(50) NOT NULL DEFAULT 'own',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS crm_leads (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id UUID NOT NULL,
        user_id UUID NOT NULL,
        name VARCHAR(500) NOT NULL,
        email VARCHAR(255),
        phone VARCHAR(50),
        company_name VARCHAR(500),
        source VARCHAR(50) NOT NULL DEFAULT 'other',
        status VARCHAR(50) NOT NULL DEFAULT 'new',
        notes TEXT,
        converted_contact_id UUID,
        converted_deal_id UUID,
        tags JSONB NOT NULL DEFAULT '[]',
        is_archived BOOLEAN NOT NULL DEFAULT FALSE,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS crm_notes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id UUID NOT NULL,
        user_id UUID NOT NULL,
        title VARCHAR(500) NOT NULL DEFAULT '',
        content JSONB NOT NULL DEFAULT '{}',
        deal_id UUID REFERENCES crm_deals(id) ON DELETE CASCADE,
        contact_id UUID REFERENCES crm_contacts(id) ON DELETE CASCADE,
        company_id UUID REFERENCES crm_companies(id) ON DELETE CASCADE,
        is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
        is_archived BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // ─── CRM Saved Views & Lead Forms ───────────────────────────────

    await client.query(`
      CREATE TABLE IF NOT EXISTS crm_saved_views (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id UUID NOT NULL,
        user_id UUID NOT NULL,
        app_section VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL,
        filters JSONB NOT NULL DEFAULT '{}',
        is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
        is_shared BOOLEAN NOT NULL DEFAULT FALSE,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS crm_lead_forms (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id UUID NOT NULL,
        user_id UUID NOT NULL,
        name VARCHAR(255) NOT NULL DEFAULT 'Default Lead Form',
        token VARCHAR(64) NOT NULL UNIQUE,
        fields JSONB NOT NULL DEFAULT '["name","email","phone","companyName","message"]',
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        submit_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // ─── Projects tables ────────────────────────────────────────────

    await client.query(`
      CREATE TABLE IF NOT EXISTS project_clients (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id UUID NOT NULL,
        user_id UUID NOT NULL,
        name VARCHAR(500) NOT NULL,
        email VARCHAR(255),
        phone VARCHAR(50),
        address TEXT,
        city VARCHAR(255),
        state VARCHAR(255),
        country VARCHAR(255),
        postal_code VARCHAR(20),
        currency VARCHAR(10) NOT NULL DEFAULT 'USD',
        logo TEXT,
        portal_token UUID DEFAULT gen_random_uuid(),
        notes TEXT,
        is_archived BOOLEAN NOT NULL DEFAULT FALSE,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS project_projects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id UUID NOT NULL,
        user_id UUID NOT NULL,
        client_id UUID REFERENCES project_clients(id) ON DELETE SET NULL,
        name VARCHAR(500) NOT NULL,
        description TEXT,
        billable BOOLEAN NOT NULL DEFAULT TRUE,
        status VARCHAR(50) NOT NULL DEFAULT 'active',
        estimated_hours REAL,
        estimated_amount REAL,
        start_date TIMESTAMPTZ,
        end_date TIMESTAMPTZ,
        color VARCHAR(20),
        is_archived BOOLEAN NOT NULL DEFAULT FALSE,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS project_members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        project_id UUID NOT NULL REFERENCES project_projects(id) ON DELETE CASCADE,
        hourly_rate REAL,
        role VARCHAR(50) NOT NULL DEFAULT 'member',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS project_time_entries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id UUID NOT NULL,
        user_id UUID NOT NULL,
        project_id UUID NOT NULL REFERENCES project_projects(id) ON DELETE CASCADE,
        duration_minutes INTEGER NOT NULL DEFAULT 0,
        work_date VARCHAR(10) NOT NULL,
        start_time VARCHAR(5),
        end_time VARCHAR(5),
        billable BOOLEAN NOT NULL DEFAULT TRUE,
        billed BOOLEAN NOT NULL DEFAULT FALSE,
        locked BOOLEAN NOT NULL DEFAULT FALSE,
        invoice_line_item_id UUID,
        notes TEXT,
        task_description VARCHAR(500),
        is_archived BOOLEAN NOT NULL DEFAULT FALSE,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS project_invoices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id UUID NOT NULL,
        user_id UUID NOT NULL,
        client_id UUID NOT NULL REFERENCES project_clients(id) ON DELETE CASCADE,
        invoice_number VARCHAR(50) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'draft',
        amount REAL NOT NULL DEFAULT 0,
        tax REAL NOT NULL DEFAULT 0,
        tax_amount REAL NOT NULL DEFAULT 0,
        discount REAL NOT NULL DEFAULT 0,
        discount_amount REAL NOT NULL DEFAULT 0,
        currency VARCHAR(10) NOT NULL DEFAULT 'USD',
        issue_date TIMESTAMPTZ,
        due_date TIMESTAMPTZ,
        notes TEXT,
        sent_at TIMESTAMPTZ,
        viewed_at TIMESTAMPTZ,
        paid_at TIMESTAMPTZ,
        is_archived BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS project_invoice_line_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        invoice_id UUID NOT NULL REFERENCES project_invoices(id) ON DELETE CASCADE,
        time_entry_id UUID REFERENCES project_time_entries(id) ON DELETE SET NULL,
        description VARCHAR(500) NOT NULL DEFAULT '',
        quantity REAL NOT NULL DEFAULT 1,
        unit_price REAL NOT NULL DEFAULT 0,
        amount REAL NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS project_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id UUID NOT NULL,
        invoice_prefix VARCHAR(20) NOT NULL DEFAULT 'INV',
        default_hourly_rate REAL NOT NULL DEFAULT 0,
        company_name VARCHAR(500),
        company_address TEXT,
        company_logo TEXT,
        next_invoice_number INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // ─── HR: New leave/attendance/lifecycle tables ─────────────────

    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_leave_types (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(100) NOT NULL,
        color VARCHAR(20) NOT NULL DEFAULT '#3b82f6',
        default_days_per_year INTEGER NOT NULL DEFAULT 0,
        max_carry_forward INTEGER NOT NULL DEFAULT 0,
        requires_approval BOOLEAN NOT NULL DEFAULT TRUE,
        is_paid BOOLEAN NOT NULL DEFAULT TRUE,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_archived BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(account_id, slug)
      );

      CREATE TABLE IF NOT EXISTS hr_leave_policies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        is_default BOOLEAN NOT NULL DEFAULT FALSE,
        allocations JSONB NOT NULL DEFAULT '[]',
        is_archived BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS hr_leave_policy_assignments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        policy_id UUID NOT NULL REFERENCES hr_leave_policies(id) ON DELETE CASCADE,
        effective_from TEXT,
        is_archived BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS hr_holiday_calendars (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        year INTEGER NOT NULL,
        description TEXT,
        is_default BOOLEAN NOT NULL DEFAULT FALSE,
        is_archived BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS hr_holidays (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        calendar_id UUID NOT NULL REFERENCES hr_holiday_calendars(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        date TEXT NOT NULL,
        description TEXT,
        type VARCHAR(50) NOT NULL DEFAULT 'public',
        is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
        is_archived BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS hr_leave_applications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        leave_type_id UUID NOT NULL REFERENCES hr_leave_types(id),
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        half_day BOOLEAN NOT NULL DEFAULT FALSE,
        half_day_date TEXT,
        total_days REAL NOT NULL DEFAULT 0,
        reason TEXT,
        status VARCHAR(50) NOT NULL DEFAULT 'draft',
        approver_id UUID REFERENCES employees(id) ON DELETE SET NULL,
        approver_comment TEXT,
        approved_at TIMESTAMPTZ,
        rejected_at TIMESTAMPTZ,
        balance_before REAL,
        is_archived BOOLEAN NOT NULL DEFAULT FALSE,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS hr_attendance (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'present',
        check_in_time TEXT,
        check_out_time TEXT,
        working_hours REAL,
        notes TEXT,
        marked_by UUID,
        is_archived BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(employee_id, date)
      );

      CREATE TABLE IF NOT EXISTS hr_lifecycle_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        event_type VARCHAR(50) NOT NULL,
        event_date TEXT NOT NULL,
        effective_date TEXT,
        from_value TEXT,
        to_value TEXT,
        from_department_id UUID,
        to_department_id UUID,
        notes TEXT,
        created_by UUID,
        is_archived BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      -- Add leave_type_id to leave_balances
      ALTER TABLE leave_balances ADD COLUMN IF NOT EXISTS leave_type_id UUID;

      -- Add holiday_calendar_id to employees
      ALTER TABLE employees ADD COLUMN IF NOT EXISTS holiday_calendar_id UUID;
    `);

    // ─── Indexes ────────────────────────────────────────────────────

    const indexes = [
      // Accounts
      'CREATE INDEX IF NOT EXISTS idx_accounts_provider ON accounts(provider, provider_id)',
      'CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts(user_id)',
      // Threads
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_threads_account_gmail ON threads(account_id, gmail_thread_id)',
      'CREATE INDEX IF NOT EXISTS idx_threads_account_category ON threads(account_id, category)',
      'CREATE INDEX IF NOT EXISTS idx_threads_last_message ON threads(account_id, last_message_at)',
      // Emails
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_emails_account_gmail ON emails(account_id, gmail_message_id)',
      'CREATE INDEX IF NOT EXISTS idx_emails_thread ON emails(thread_id, internal_date)',
      'CREATE INDEX IF NOT EXISTS idx_emails_account_date ON emails(account_id, internal_date)',
      // Attachments
      'CREATE INDEX IF NOT EXISTS idx_attachments_email ON attachments(email_id)',
      // Category rules
      'CREATE INDEX IF NOT EXISTS idx_category_rules_account ON category_rules(account_id, priority)',
      // Contacts
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_account_email ON contacts(account_id, email)',
      'CREATE INDEX IF NOT EXISTS idx_contacts_account_freq ON contacts(account_id, frequency)',
      // Email tracking
      'CREATE INDEX IF NOT EXISTS idx_email_tracking_account ON email_tracking(account_id)',
      'CREATE INDEX IF NOT EXISTS idx_email_tracking_thread ON email_tracking(thread_id)',
      // Tracking events
      'CREATE INDEX IF NOT EXISTS idx_tracking_events_tracking_id ON tracking_events(tracking_id)',
      'CREATE INDEX IF NOT EXISTS idx_tracking_events_created_at ON tracking_events(created_at)',
      // Calendars
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_calendars_account_google ON calendars(account_id, google_calendar_id)',
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_cal_events_account_google ON calendar_events(account_id, google_event_id)',
      'CREATE INDEX IF NOT EXISTS idx_cal_events_calendar ON calendar_events(calendar_id)',
      'CREATE INDEX IF NOT EXISTS idx_cal_events_time_range ON calendar_events(account_id, start_time, end_time)',
      // Documents
      'CREATE INDEX IF NOT EXISTS idx_documents_account ON documents(account_id, is_archived)',
      'CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id, is_archived)',
      'CREATE INDEX IF NOT EXISTS idx_documents_parent ON documents(parent_id, sort_order)',
      'CREATE INDEX IF NOT EXISTS idx_documents_account_parent ON documents(account_id, parent_id, sort_order)',
      'CREATE INDEX IF NOT EXISTS idx_documents_user_parent ON documents(user_id, parent_id, sort_order)',
      // Document versions
      'CREATE INDEX IF NOT EXISTS idx_document_versions_doc ON document_versions(document_id, created_at)',
      // Task projects
      'CREATE INDEX IF NOT EXISTS idx_task_projects_user ON task_projects(user_id, is_archived)',
      // Tasks
      'CREATE INDEX IF NOT EXISTS idx_tasks_user_status ON tasks(user_id, status, is_archived)',
      'CREATE INDEX IF NOT EXISTS idx_tasks_user_when ON tasks(user_id, "when", status)',
      'CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id, sort_order)',
      'CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(user_id, due_date)',
      // Spreadsheets
      'CREATE INDEX IF NOT EXISTS idx_spreadsheets_user ON spreadsheets(user_id, is_archived)',
      'CREATE INDEX IF NOT EXISTS idx_spreadsheets_account ON spreadsheets(account_id, is_archived)',
      // Drive items
      'CREATE INDEX IF NOT EXISTS idx_drive_items_user_parent ON drive_items(user_id, parent_id, is_archived)',
      'CREATE INDEX IF NOT EXISTS idx_drive_items_user_archived ON drive_items(user_id, is_archived)',
      'CREATE INDEX IF NOT EXISTS idx_drive_items_user_favourite ON drive_items(user_id, is_favourite)',
      // Drive versions
      'CREATE INDEX IF NOT EXISTS idx_drive_versions_item ON drive_item_versions(drive_item_id, created_at)',
      // Drive share links
      'CREATE INDEX IF NOT EXISTS idx_share_links_token ON drive_share_links(share_token)',
      'CREATE INDEX IF NOT EXISTS idx_share_links_item ON drive_share_links(drive_item_id)',
      // Drive item shares
      'CREATE INDEX IF NOT EXISTS idx_drive_shares_user ON drive_item_shares(shared_with_user_id)',
      // Drive activity log
      'CREATE INDEX IF NOT EXISTS idx_drive_activity_item ON drive_activity_log(drive_item_id)',
      // Drive comments
      'CREATE INDEX IF NOT EXISTS idx_drive_comments_item ON drive_comments(drive_item_id)',
      // Drawings
      'CREATE INDEX IF NOT EXISTS idx_drawings_account ON drawings(account_id, is_archived)',
      'CREATE INDEX IF NOT EXISTS idx_drawings_user ON drawings(user_id, is_archived)',
      // Notifications
      'CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read)',
      'CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at)',
      // Activity feed
      'CREATE INDEX IF NOT EXISTS idx_activity_feed_tenant_created ON activity_feed(tenant_id, created_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_activity_feed_user ON activity_feed(user_id)',
      // Push subscriptions
      'CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id)',
      // Subtasks
      'CREATE INDEX IF NOT EXISTS idx_subtasks_task ON subtasks(task_id, sort_order)',
      // Task activities
      'CREATE INDEX IF NOT EXISTS idx_task_activities_task ON task_activities(task_id, created_at)',
      // Task templates
      'CREATE INDEX IF NOT EXISTS idx_task_templates_user ON task_templates(user_id)',
      // Document comments
      'CREATE INDEX IF NOT EXISTS idx_document_comments_doc ON document_comments(document_id)',
      'CREATE INDEX IF NOT EXISTS idx_document_comments_parent ON document_comments(parent_id)',
      // Document links
      'CREATE INDEX IF NOT EXISTS idx_document_links_source ON document_links(source_doc_id)',
      'CREATE INDEX IF NOT EXISTS idx_document_links_target ON document_links(target_doc_id)',
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_document_links_unique ON document_links(source_doc_id, target_doc_id)',
      // Platform indexes
      'CREATE INDEX IF NOT EXISTS idx_tenants_owner ON tenants(owner_id)',
      'CREATE INDEX IF NOT EXISTS idx_tenant_invitations_token ON tenant_invitations(token)',
      'CREATE INDEX IF NOT EXISTS idx_app_catalog_category ON app_catalog(category)',
      'CREATE INDEX IF NOT EXISTS idx_installations_tenant ON app_installations(tenant_id)',
      'CREATE INDEX IF NOT EXISTS idx_addons_installation ON app_addons(installation_id)',
      'CREATE INDEX IF NOT EXISTS idx_app_assignments_installation ON app_user_assignments(installation_id)',
      'CREATE INDEX IF NOT EXISTS idx_app_assignments_user ON app_user_assignments(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_backups_installation ON app_backups(installation_id)',
      // Provisioning log
      'CREATE INDEX IF NOT EXISTS idx_provisioning_log_installation ON provisioning_log(installation_id)',
      'CREATE INDEX IF NOT EXISTS idx_provisioning_log_user ON provisioning_log(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_provisioning_log_status ON provisioning_log(status)',
      // Signature documents
      'CREATE INDEX IF NOT EXISTS idx_sig_docs_account ON signature_documents(account_id)',
      'CREATE INDEX IF NOT EXISTS idx_sig_docs_status ON signature_documents(status)',
      // Signature fields
      'CREATE INDEX IF NOT EXISTS idx_sig_fields_document ON signature_fields(document_id)',
      // Signing tokens
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_signing_tokens_token ON signing_tokens(token)',
      'CREATE INDEX IF NOT EXISTS idx_signing_tokens_document ON signing_tokens(document_id)',
      // Sign audit log
      'CREATE INDEX IF NOT EXISTS idx_sign_audit_document ON sign_audit_log(document_id)',
      // Sign templates
      'CREATE INDEX IF NOT EXISTS idx_sign_templates_account ON sign_templates(account_id)',
      // Departments
      'CREATE INDEX IF NOT EXISTS idx_departments_user ON departments(user_id, is_archived)',
      'CREATE INDEX IF NOT EXISTS idx_departments_account ON departments(account_id, is_archived)',
      // Employees
      'CREATE INDEX IF NOT EXISTS idx_employees_user_status ON employees(user_id, status, is_archived)',
      'CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department_id, sort_order)',
      'CREATE INDEX IF NOT EXISTS idx_employees_account ON employees(account_id, is_archived)',
      // Time-off requests
      'CREATE INDEX IF NOT EXISTS idx_time_off_employee ON time_off_requests(employee_id, status)',
      'CREATE INDEX IF NOT EXISTS idx_time_off_status ON time_off_requests(user_id, status, is_archived)',
      'CREATE INDEX IF NOT EXISTS idx_time_off_approver ON time_off_requests(approver_id)',
      // Leave balances
      'CREATE INDEX IF NOT EXISTS idx_leave_balances_employee_year ON leave_balances(employee_id, year)',
      'CREATE INDEX IF NOT EXISTS idx_leave_balances_account ON leave_balances(account_id)',
      // Onboarding tasks
      'CREATE INDEX IF NOT EXISTS idx_onboarding_tasks_employee ON onboarding_tasks(employee_id, is_archived)',
      'CREATE INDEX IF NOT EXISTS idx_onboarding_tasks_account ON onboarding_tasks(account_id)',
      // Onboarding templates
      'CREATE INDEX IF NOT EXISTS idx_onboarding_templates_account ON onboarding_templates(account_id)',
      // Employee documents
      'CREATE INDEX IF NOT EXISTS idx_employee_documents_employee ON employee_documents(employee_id, is_archived)',
      'CREATE INDEX IF NOT EXISTS idx_employee_documents_account ON employee_documents(account_id)',
      // CRM Companies
      'CREATE INDEX IF NOT EXISTS idx_crm_companies_account ON crm_companies(account_id)',
      // CRM Contacts
      'CREATE INDEX IF NOT EXISTS idx_crm_contacts_account ON crm_contacts(account_id)',
      'CREATE INDEX IF NOT EXISTS idx_crm_contacts_company ON crm_contacts(company_id)',
      // CRM Deal Stages
      'CREATE INDEX IF NOT EXISTS idx_crm_stages_account ON crm_deal_stages(account_id)',
      // CRM Deals
      'CREATE INDEX IF NOT EXISTS idx_crm_deals_account ON crm_deals(account_id)',
      'CREATE INDEX IF NOT EXISTS idx_crm_deals_stage ON crm_deals(stage_id)',
      'CREATE INDEX IF NOT EXISTS idx_crm_deals_contact ON crm_deals(contact_id)',
      'CREATE INDEX IF NOT EXISTS idx_crm_deals_company ON crm_deals(company_id)',
      // CRM Activities
      'CREATE INDEX IF NOT EXISTS idx_crm_activities_deal ON crm_activities(deal_id)',
      'CREATE INDEX IF NOT EXISTS idx_crm_activities_contact ON crm_activities(contact_id)',
      'CREATE INDEX IF NOT EXISTS idx_crm_activities_company ON crm_activities(company_id)',
      // CRM Workflows
      'CREATE INDEX IF NOT EXISTS idx_crm_workflows_account ON crm_workflows(account_id)',
      'CREATE INDEX IF NOT EXISTS idx_crm_workflows_trigger ON crm_workflows(trigger)',
      // CRM Permissions
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_permissions_user ON crm_permissions(account_id, user_id)',
      // CRM Leads
      'CREATE INDEX IF NOT EXISTS idx_crm_leads_account ON crm_leads(account_id)',
      'CREATE INDEX IF NOT EXISTS idx_crm_leads_status ON crm_leads(status)',
      // CRM Notes
      'CREATE INDEX IF NOT EXISTS idx_crm_notes_deal ON crm_notes(deal_id)',
      'CREATE INDEX IF NOT EXISTS idx_crm_notes_contact ON crm_notes(contact_id)',
      'CREATE INDEX IF NOT EXISTS idx_crm_notes_company ON crm_notes(company_id)',
      // CRM Saved Views
      'CREATE INDEX IF NOT EXISTS idx_crm_saved_views_account ON crm_saved_views(account_id)',
      'CREATE INDEX IF NOT EXISTS idx_crm_saved_views_user ON crm_saved_views(user_id, app_section)',
      // CRM Lead Forms
      'CREATE INDEX IF NOT EXISTS idx_crm_lead_forms_token ON crm_lead_forms(token)',
      'CREATE INDEX IF NOT EXISTS idx_crm_lead_forms_account ON crm_lead_forms(account_id)',
      // Project Clients
      'CREATE INDEX IF NOT EXISTS idx_project_clients_account ON project_clients(account_id)',
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_project_clients_portal_token ON project_clients(portal_token)',
      // Project Projects
      'CREATE INDEX IF NOT EXISTS idx_project_projects_account ON project_projects(account_id)',
      'CREATE INDEX IF NOT EXISTS idx_project_projects_client ON project_projects(client_id)',
      'CREATE INDEX IF NOT EXISTS idx_project_projects_status ON project_projects(status)',
      // Project Members
      'CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id)',
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_project_members_user_project ON project_members(user_id, project_id)',
      // Project Time Entries
      'CREATE INDEX IF NOT EXISTS idx_project_time_entries_account ON project_time_entries(account_id)',
      'CREATE INDEX IF NOT EXISTS idx_project_time_entries_project ON project_time_entries(project_id)',
      'CREATE INDEX IF NOT EXISTS idx_project_time_entries_user_date ON project_time_entries(user_id, work_date)',
      'CREATE INDEX IF NOT EXISTS idx_project_time_entries_billed ON project_time_entries(billed, billable)',
      // Project Invoices
      'CREATE INDEX IF NOT EXISTS idx_project_invoices_account ON project_invoices(account_id)',
      'CREATE INDEX IF NOT EXISTS idx_project_invoices_client ON project_invoices(client_id)',
      'CREATE INDEX IF NOT EXISTS idx_project_invoices_status ON project_invoices(status)',
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_project_invoices_number ON project_invoices(account_id, invoice_number)',
      // Project Invoice Line Items
      'CREATE INDEX IF NOT EXISTS idx_project_line_items_invoice ON project_invoice_line_items(invoice_id)',
      'CREATE INDEX IF NOT EXISTS idx_project_line_items_time_entry ON project_invoice_line_items(time_entry_id)',
      // Project Settings
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_project_settings_account ON project_settings(account_id)',
      // CRM Email/Calendar GIN indexes for JSONB containment queries
      'CREATE INDEX IF NOT EXISTS idx_emails_from ON emails(from_address)',
      // HR Leave Types
      'CREATE INDEX IF NOT EXISTS idx_hr_leave_types_account_active ON hr_leave_types(account_id, is_active)',
      // HR Leave Policies
      'CREATE INDEX IF NOT EXISTS idx_hr_leave_policies_account ON hr_leave_policies(account_id)',
      // HR Leave Policy Assignments
      'CREATE INDEX IF NOT EXISTS idx_hr_policy_assignments_employee ON hr_leave_policy_assignments(employee_id)',
      'CREATE INDEX IF NOT EXISTS idx_hr_policy_assignments_account ON hr_leave_policy_assignments(account_id)',
      // HR Holiday Calendars
      'CREATE INDEX IF NOT EXISTS idx_hr_holiday_calendars_account ON hr_holiday_calendars(account_id)',
      // HR Holidays
      'CREATE INDEX IF NOT EXISTS idx_hr_holidays_calendar ON hr_holidays(calendar_id)',
      'CREATE INDEX IF NOT EXISTS idx_hr_holidays_account_date ON hr_holidays(account_id, date)',
      // HR Leave Applications
      'CREATE INDEX IF NOT EXISTS idx_hr_leave_apps_employee_status ON hr_leave_applications(employee_id, status)',
      'CREATE INDEX IF NOT EXISTS idx_hr_leave_apps_approver_status ON hr_leave_applications(approver_id, status)',
      'CREATE INDEX IF NOT EXISTS idx_hr_leave_apps_account_status ON hr_leave_applications(account_id, status)',
      // HR Attendance
      'CREATE INDEX IF NOT EXISTS idx_hr_attendance_account_date ON hr_attendance(account_id, date)',
      'CREATE INDEX IF NOT EXISTS idx_hr_attendance_employee_status ON hr_attendance(employee_id, status)',
      // HR Lifecycle Events
      'CREATE INDEX IF NOT EXISTS idx_hr_lifecycle_employee_date ON hr_lifecycle_events(employee_id, event_date)',
      'CREATE INDEX IF NOT EXISTS idx_hr_lifecycle_account ON hr_lifecycle_events(account_id)',
      // Additional HR composite indexes for common query patterns
      'CREATE INDEX IF NOT EXISTS idx_employees_account_status ON employees(account_id, status)',
      'CREATE INDEX IF NOT EXISTS idx_employees_account_dept ON employees(account_id, department_id)',
      'CREATE INDEX IF NOT EXISTS idx_leave_balances_account_emp_year ON leave_balances(account_id, employee_id, year)',
    ];

    for (const idx of indexes) {
      await client.query(idx);
    }

    // ─── Full-text search: tsvector GIN index + auto-update trigger ──

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_emails_search_vector
        ON emails USING GIN (search_vector);
    `);

    // Create a trigger function that auto-populates search_vector on insert/update
    await client.query(`
      CREATE OR REPLACE FUNCTION emails_search_vector_update() RETURNS trigger AS $$
      BEGIN
        NEW.search_vector :=
          setweight(to_tsvector('english', COALESCE(NEW.subject, '')), 'A') ||
          setweight(to_tsvector('english', COALESCE(NEW.from_name, '')), 'B') ||
          setweight(to_tsvector('english', COALESCE(NEW.from_address, '')), 'B') ||
          setweight(to_tsvector('english', COALESCE(NEW.body_text, '')), 'C');
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Drop and recreate the trigger to ensure it's up to date
    await client.query(`
      DROP TRIGGER IF EXISTS trg_emails_search_vector ON emails;
      CREATE TRIGGER trg_emails_search_vector
        BEFORE INSERT OR UPDATE OF subject, from_name, from_address, body_text
        ON emails
        FOR EACH ROW
        EXECUTE FUNCTION emails_search_vector_update();
    `);

    // ─── GIN indexes for JSONB containment queries (CRM email/calendar) ──
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_emails_to_gin ON emails USING GIN (to_addresses);
      CREATE INDEX IF NOT EXISTS idx_emails_cc_gin ON emails USING GIN (cc_addresses);
      CREATE INDEX IF NOT EXISTS idx_cal_events_attendees_gin ON calendar_events USING GIN (attendees);
    `);

    // ─── System Settings (singleton row, admin-only) ──────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        smtp_host VARCHAR(255),
        smtp_port INTEGER NOT NULL DEFAULT 587,
        smtp_user VARCHAR(255),
        smtp_pass TEXT,
        smtp_from VARCHAR(255) NOT NULL DEFAULT 'Atlas <noreply@atlas.local>',
        smtp_secure BOOLEAN NOT NULL DEFAULT FALSE,
        smtp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // ─── Audit Log ────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID,
        account_id UUID,
        tenant_id UUID,
        action VARCHAR(20) NOT NULL,
        entity VARCHAR(100) NOT NULL,
        entity_id VARCHAR(255),
        path VARCHAR(500) NOT NULL,
        method VARCHAR(10) NOT NULL,
        status_code INTEGER,
        ip_address VARCHAR(45),
        user_agent TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_audit_log_tenant ON audit_log (tenant_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log (user_id, created_at);
    `);

    // ─── App Permissions ──────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS app_permissions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        user_id UUID NOT NULL,
        app_id VARCHAR(50) NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'editor',
        record_access VARCHAR(20) NOT NULL DEFAULT 'all',
        entity_permissions JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_app_permissions_unique ON app_permissions (tenant_id, user_id, app_id);
    `);

    // Add entity_permissions column if table already existed before this migration
    await client.query(`
      ALTER TABLE app_permissions ADD COLUMN IF NOT EXISTS entity_permissions JSONB;
    `);

    // ─── Migrate CRM permissions into app_permissions ─────────────────
    try {
      await client.query(`
        INSERT INTO app_permissions (tenant_id, user_id, app_id, role, record_access, entity_permissions)
        SELECT
          (SELECT tenant_id FROM tenant_members WHERE user_id = cp.user_id LIMIT 1),
          cp.user_id,
          'crm',
          CASE cp.role
            WHEN 'admin' THEN 'admin'
            WHEN 'manager' THEN 'manager'
            WHEN 'sales' THEN 'editor'
            WHEN 'viewer' THEN 'viewer'
            ELSE 'editor'
          END,
          cp.record_access,
          CASE cp.role
            WHEN 'sales' THEN '{"companies": ["view"], "workflows": []}'::jsonb
            ELSE NULL
          END
        FROM crm_permissions cp
        WHERE NOT EXISTS (
          SELECT 1 FROM app_permissions ap
          WHERE ap.user_id = cp.user_id AND ap.app_id = 'crm'
        );
      `);
      logger.info('Migrated CRM permissions to app_permissions');
    } catch (err) {
      // crm_permissions table might not exist on fresh installs — safe to ignore
      logger.info('Skipped CRM permission migration (crm_permissions table may not exist)');
    }

    // Add last_reminder_at column + dueDate index to tasks (idempotent)
    await client.query(`
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS last_reminder_at TIMESTAMPTZ;
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assignee_id UUID;
      CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
    `);

    // Add password_hash column to drive_share_links (idempotent)
    await client.query(`
      ALTER TABLE drive_share_links ADD COLUMN IF NOT EXISTS password_hash TEXT;
    `);

    // ─── Task Comments ──────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS task_comments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        account_id UUID NOT NULL,
        user_id UUID NOT NULL,
        body TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_task_comments_task ON task_comments(task_id);
    `);

    // ─── Marketplace: Installed Apps ──────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS marketplace_apps (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id UUID NOT NULL,
        app_id VARCHAR(50) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'stopped',
        assigned_port INTEGER NOT NULL,
        container_ids JSONB,
        image_digest VARCHAR(255),
        latest_digest VARCHAR(255),
        generated_secrets TEXT,
        env_overrides JSONB,
        installed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(account_id, app_id)
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_marketplace_apps_unique ON marketplace_apps(account_id, app_id);
    `);

    // ─── Presence Heartbeats ────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS presence_heartbeats (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        tenant_id UUID NOT NULL,
        app_id VARCHAR(50) NOT NULL,
        record_id VARCHAR(255) NOT NULL,
        last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_presence_unique ON presence_heartbeats(user_id, app_id, record_id);
      CREATE INDEX IF NOT EXISTS idx_presence_lookup ON presence_heartbeats(tenant_id, app_id, record_id);
    `);

    // ─── Shared Workspaces: visibility + tenantId columns ──────────────
    await client.query(`
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS tenant_id UUID;
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS visibility VARCHAR(10) NOT NULL DEFAULT 'private';

      ALTER TABLE documents ADD COLUMN IF NOT EXISTS tenant_id UUID;
      ALTER TABLE documents ADD COLUMN IF NOT EXISTS visibility VARCHAR(10) NOT NULL DEFAULT 'private';

      ALTER TABLE drawings ADD COLUMN IF NOT EXISTS tenant_id UUID;
      ALTER TABLE drawings ADD COLUMN IF NOT EXISTS visibility VARCHAR(10) NOT NULL DEFAULT 'private';

      ALTER TABLE task_projects ADD COLUMN IF NOT EXISTS tenant_id UUID;
      ALTER TABLE task_projects ADD COLUMN IF NOT EXISTS visibility VARCHAR(10) NOT NULL DEFAULT 'private';

      ALTER TABLE drive_items ADD COLUMN IF NOT EXISTS tenant_id UUID;
      ALTER TABLE drive_items ADD COLUMN IF NOT EXISTS visibility VARCHAR(10) NOT NULL DEFAULT 'private';

      ALTER TABLE signature_fields ADD COLUMN IF NOT EXISTS options JSONB NOT NULL DEFAULT '{}';
    `);

    // ─── Table Row Comments ─────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS table_row_comments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        spreadsheet_id UUID NOT NULL REFERENCES spreadsheets(id) ON DELETE CASCADE,
        row_id TEXT NOT NULL,
        account_id UUID NOT NULL,
        user_id UUID NOT NULL,
        body TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_table_row_comments_row ON table_row_comments(spreadsheet_id, row_id);
    `);

    // ─── Task Attachments ────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS task_attachments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        account_id UUID NOT NULL,
        user_id UUID NOT NULL,
        file_name VARCHAR(500) NOT NULL,
        storage_path TEXT NOT NULL,
        mime_type VARCHAR(255),
        size INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_task_attachments_task ON task_attachments(task_id);
    `);

    // ─── Task Dependencies ─────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS task_dependencies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        blocked_by_task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_task_deps_task ON task_dependencies(task_id);
      CREATE INDEX IF NOT EXISTS idx_task_deps_blocker ON task_dependencies(blocked_by_task_id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_task_deps_unique ON task_dependencies(task_id, blocked_by_task_id);
    `);

    // ─── CRM: Rotting deals + activity assignment ──────────────────────
    await client.query(`
      ALTER TABLE crm_deal_stages ADD COLUMN IF NOT EXISTS rotting_days INTEGER;
      ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS stage_entered_at TIMESTAMPTZ;
      ALTER TABLE crm_activities ADD COLUMN IF NOT EXISTS assigned_user_id UUID;
    `);

    // ─── CRM: Configurable activity types ─────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS crm_activity_types (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id UUID NOT NULL,
        name VARCHAR(100) NOT NULL,
        icon VARCHAR(50) NOT NULL DEFAULT 'sticky-note',
        color VARCHAR(20) NOT NULL DEFAULT '#6b7280',
        is_default BOOLEAN NOT NULL DEFAULT FALSE,
        is_archived BOOLEAN NOT NULL DEFAULT FALSE,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_crm_activity_types_account ON crm_activity_types(account_id);
    `);

    // ─── CRM: Lead enrichment ────────────────────────────────────────
    await client.query(`
      ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS enriched_data JSONB;
      ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMPTZ;
    `);

    // ─── CRM: Lead detail fields ────────────────────────────────────
    await client.query(`
      ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS expected_revenue REAL NOT NULL DEFAULT 0;
      ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS probability INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS assigned_user_id UUID;
      ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS expected_close_date TIMESTAMPTZ;
    `);

    logger.info('Database migrations completed');
  } finally {
    await client.end();
  }
}
