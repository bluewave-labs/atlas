CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"picture_url" text,
	"provider" text DEFAULT 'google' NOT NULL,
	"provider_id" text NOT NULL,
	"password_hash" text,
	"access_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"token_expires_at" timestamp with time zone NOT NULL,
	"history_id" integer,
	"last_full_sync" timestamp with time zone,
	"last_sync" timestamp with time zone,
	"sync_status" text DEFAULT 'idle' NOT NULL,
	"sync_error" text,
	"watch_expiration" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accounts_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "activity_feed" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"app_id" varchar(50) NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"title" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_permission_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"target_user_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"actor_type" varchar(20) DEFAULT 'user' NOT NULL,
	"app_id" varchar(50) NOT NULL,
	"action" varchar(20) NOT NULL,
	"before_role" varchar(20),
	"before_record_access" varchar(10),
	"after_role" varchar(20),
	"after_record_access" varchar(10),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"app_id" varchar(50) NOT NULL,
	"role" varchar(20) DEFAULT 'editor' NOT NULL,
	"record_access" varchar(20) DEFAULT 'all' NOT NULL,
	"entity_permissions" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_id" uuid NOT NULL,
	"gmail_attachment_id" text,
	"filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"content_id" text,
	"is_inline" boolean DEFAULT false NOT NULL,
	"storage_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"tenant_id" uuid,
	"action" varchar(20) NOT NULL,
	"entity" varchar(100) NOT NULL,
	"entity_id" varchar(255),
	"path" varchar(500) NOT NULL,
	"method" varchar(10) NOT NULL,
	"status_code" integer,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"calendar_id" uuid NOT NULL,
	"google_event_id" text NOT NULL,
	"summary" text,
	"description" text,
	"location" text,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone NOT NULL,
	"is_all_day" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'confirmed' NOT NULL,
	"self_response_status" text,
	"html_link" text,
	"hangout_link" text,
	"organizer" jsonb,
	"attendees" jsonb,
	"recurrence" jsonb,
	"recurring_event_id" text,
	"transparency" text,
	"color_id" text,
	"reminders" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendars" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"google_calendar_id" text NOT NULL,
	"summary" text,
	"description" text,
	"background_color" text,
	"foreground_color" text,
	"time_zone" text,
	"access_role" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"is_selected" boolean DEFAULT true NOT NULL,
	"sync_token" text,
	"last_sync_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "category_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"conditions" jsonb NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"email" text NOT NULL,
	"emails" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"name" text,
	"given_name" text,
	"family_name" text,
	"photo_url" text,
	"phone_numbers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"organization" text,
	"job_title" text,
	"notes" text,
	"google_resource_name" text,
	"frequency" integer DEFAULT 1 NOT NULL,
	"last_contacted" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "crm_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"type" varchar(50) DEFAULT 'note' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"deal_id" uuid,
	"contact_id" uuid,
	"company_id" uuid,
	"assigned_user_id" uuid,
	"scheduled_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_activity_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"icon" varchar(50) DEFAULT 'sticky-note' NOT NULL,
	"color" varchar(20) DEFAULT '#6b7280' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(500) NOT NULL,
	"domain" varchar(255),
	"industry" varchar(255),
	"size" varchar(50),
	"address" text,
	"phone" varchar(50),
	"team_id" uuid,
	"tax_id" varchar(11),
	"tax_office" varchar(100),
	"currency" varchar(10) DEFAULT 'USD' NOT NULL,
	"postal_code" varchar(20),
	"state" varchar(100),
	"country" varchar(100),
	"logo" text,
	"portal_token" uuid,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "crm_companies_portal_token_unique" UNIQUE("portal_token")
);
--> statement-breakpoint
CREATE TABLE "crm_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(500) NOT NULL,
	"email" varchar(255),
	"phone" varchar(50),
	"company_id" uuid,
	"team_id" uuid,
	"position" varchar(255),
	"source" varchar(100),
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_deal_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"color" varchar(20) DEFAULT '#6b7280' NOT NULL,
	"probability" integer DEFAULT 0 NOT NULL,
	"sequence" integer DEFAULT 0 NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"rotting_days" integer
);
--> statement-breakpoint
CREATE TABLE "crm_deals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(500) NOT NULL,
	"value" real DEFAULT 0 NOT NULL,
	"stage_id" uuid NOT NULL,
	"contact_id" uuid,
	"company_id" uuid,
	"assigned_user_id" uuid,
	"team_id" uuid,
	"probability" integer DEFAULT 0 NOT NULL,
	"expected_close_date" timestamp with time zone,
	"won_at" timestamp with time zone,
	"lost_at" timestamp with time zone,
	"lost_reason" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"stage_entered_at" timestamp with time zone,
	"is_archived" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_lead_forms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(255) DEFAULT 'Default Lead Form' NOT NULL,
	"token" varchar(64) NOT NULL,
	"fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"submit_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "crm_lead_forms_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "crm_leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(500) NOT NULL,
	"email" varchar(255),
	"phone" varchar(50),
	"company_name" varchar(500),
	"source" varchar(50) DEFAULT 'other' NOT NULL,
	"status" varchar(50) DEFAULT 'new' NOT NULL,
	"notes" text,
	"converted_contact_id" uuid,
	"converted_deal_id" uuid,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"expected_revenue" real DEFAULT 0 NOT NULL,
	"probability" integer DEFAULT 0 NOT NULL,
	"assigned_user_id" uuid,
	"team_id" uuid,
	"expected_close_date" timestamp with time zone,
	"enriched_data" jsonb,
	"enriched_at" timestamp with time zone,
	"is_archived" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(500) DEFAULT '' NOT NULL,
	"content" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"deal_id" uuid,
	"contact_id" uuid,
	"company_id" uuid,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"deal_id" uuid,
	"contact_id" uuid,
	"company_id" uuid,
	"title" varchar(500) NOT NULL,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"content" jsonb,
	"line_items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"subtotal" real DEFAULT 0 NOT NULL,
	"tax_percent" real DEFAULT 0 NOT NULL,
	"tax_amount" real DEFAULT 0 NOT NULL,
	"discount_percent" real DEFAULT 0 NOT NULL,
	"discount_amount" real DEFAULT 0 NOT NULL,
	"total" real DEFAULT 0 NOT NULL,
	"currency" varchar(10) DEFAULT 'USD' NOT NULL,
	"valid_until" timestamp with time zone,
	"public_token" uuid DEFAULT gen_random_uuid() NOT NULL,
	"sent_at" timestamp with time zone,
	"viewed_at" timestamp with time zone,
	"accepted_at" timestamp with time zone,
	"declined_at" timestamp with time zone,
	"notes" text,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "crm_proposals_public_token_unique" UNIQUE("public_token")
);
--> statement-breakpoint
CREATE TABLE "crm_saved_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"app_section" varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	"filters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"is_shared" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_team_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"color" varchar(20) DEFAULT '#3b82f6' NOT NULL,
	"leader_user_id" uuid,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_workflows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(500) NOT NULL,
	"trigger" varchar(100) NOT NULL,
	"trigger_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"action" varchar(100) NOT NULL,
	"action_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"execution_count" integer DEFAULT 0 NOT NULL,
	"last_executed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_field_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"app_id" varchar(100) NOT NULL,
	"record_type" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"field_type" varchar(50) NOT NULL,
	"options" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_required" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_field_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"field_definition_id" uuid NOT NULL,
	"record_id" uuid NOT NULL,
	"value" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text DEFAULT 'Untitled department' NOT NULL,
	"head_employee_id" uuid,
	"color" text DEFAULT '#5a7fa0' NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"content" text NOT NULL,
	"selection_from" integer,
	"selection_to" integer,
	"selection_text" text,
	"is_resolved" boolean DEFAULT false NOT NULL,
	"parent_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_doc_id" uuid NOT NULL,
	"target_doc_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"content" jsonb DEFAULT 'null'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"parent_id" uuid,
	"title" text DEFAULT 'Untitled' NOT NULL,
	"content" jsonb DEFAULT 'null'::jsonb,
	"icon" text,
	"cover_image" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"visibility" varchar(10) DEFAULT 'private' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drawings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text DEFAULT 'Untitled drawing' NOT NULL,
	"content" jsonb DEFAULT 'null'::jsonb,
	"thumbnail_url" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"visibility" varchar(10) DEFAULT 'private' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drive_activity_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"drive_item_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"action" varchar(100) NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drive_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"drive_item_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drive_item_shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"drive_item_id" uuid NOT NULL,
	"shared_with_user_id" uuid NOT NULL,
	"permission" varchar(20) DEFAULT 'view' NOT NULL,
	"shared_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drive_item_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"drive_item_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"mime_type" text,
	"size" integer,
	"storage_path" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drive_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'file' NOT NULL,
	"mime_type" text,
	"size" integer,
	"parent_id" uuid,
	"storage_path" text,
	"icon" text,
	"linked_resource_type" text,
	"linked_resource_id" text,
	"is_favourite" boolean DEFAULT false NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"visibility" varchar(10) DEFAULT 'private' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drive_share_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"drive_item_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"share_token" text NOT NULL,
	"password_hash" text,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "drive_share_links_share_token_unique" UNIQUE("share_token")
);
--> statement-breakpoint
CREATE TABLE "email_tracking" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"email_id" uuid,
	"thread_id" uuid,
	"tracking_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"subject" text,
	"recipient_address" text NOT NULL,
	"open_count" integer DEFAULT 0 NOT NULL,
	"click_count" integer DEFAULT 0 NOT NULL,
	"first_opened_at" timestamp with time zone,
	"last_opened_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_tracking_tracking_id_unique" UNIQUE("tracking_id")
);
--> statement-breakpoint
CREATE TABLE "emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"thread_id" uuid NOT NULL,
	"gmail_message_id" text NOT NULL,
	"message_id_header" text,
	"in_reply_to" text,
	"references_header" text,
	"from_address" text NOT NULL,
	"from_name" text,
	"to_addresses" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"cc_addresses" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"bcc_addresses" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"reply_to" text,
	"subject" text,
	"snippet" text,
	"body_text" text,
	"body_html" text,
	"body_html_compressed" text,
	"gmail_labels" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_unread" boolean DEFAULT true NOT NULL,
	"is_starred" boolean DEFAULT false NOT NULL,
	"is_draft" boolean DEFAULT false NOT NULL,
	"internal_date" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone,
	"size_estimate" integer,
	"search_vector" "tsvector",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employee_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"name" varchar(500) NOT NULL,
	"type" varchar(100) DEFAULT 'other' NOT NULL,
	"storage_path" text NOT NULL,
	"mime_type" varchar(100),
	"size" integer,
	"expires_at" text,
	"notes" text,
	"uploaded_by" uuid NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"linked_user_id" uuid,
	"name" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"role" text DEFAULT '' NOT NULL,
	"department_id" uuid,
	"start_date" text,
	"phone" text,
	"avatar_url" text,
	"status" text DEFAULT 'active' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"date_of_birth" text,
	"gender" varchar(20),
	"emergency_contact_name" varchar(255),
	"emergency_contact_phone" varchar(50),
	"emergency_contact_relation" varchar(100),
	"employment_type" varchar(50) DEFAULT 'full-time' NOT NULL,
	"manager_id" uuid,
	"job_title" varchar(255),
	"work_location" varchar(255),
	"salary" integer,
	"salary_currency" varchar(10) DEFAULT 'USD' NOT NULL,
	"salary_period" varchar(20) DEFAULT 'yearly' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hr_attendance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"date" text NOT NULL,
	"status" varchar(50) DEFAULT 'present' NOT NULL,
	"check_in_time" text,
	"check_out_time" text,
	"working_hours" real,
	"notes" text,
	"marked_by" uuid,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hr_expense_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"icon" varchar(50) DEFAULT 'receipt' NOT NULL,
	"color" varchar(20) DEFAULT '#6b7280' NOT NULL,
	"max_amount" real,
	"receipt_required" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hr_expense_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"monthly_limit" real,
	"require_receipt_above" real,
	"auto_approve_below" real,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hr_expense_policy_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"policy_id" uuid NOT NULL,
	"employee_id" uuid,
	"department_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hr_expense_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"title" varchar(500) NOT NULL,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"total_amount" real DEFAULT 0 NOT NULL,
	"currency" varchar(10) DEFAULT 'USD' NOT NULL,
	"submitted_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"refused_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"approver_id" uuid,
	"approver_comment" text,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hr_expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"category_id" uuid,
	"project_id" uuid,
	"report_id" uuid,
	"description" text NOT NULL,
	"notes" text,
	"amount" real NOT NULL,
	"tax_amount" real DEFAULT 0 NOT NULL,
	"currency" varchar(10) DEFAULT 'USD' NOT NULL,
	"quantity" real DEFAULT 1 NOT NULL,
	"expense_date" timestamp with time zone NOT NULL,
	"merchant_name" varchar(255),
	"payment_method" varchar(20) DEFAULT 'personal_card' NOT NULL,
	"receipt_path" text,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"submitted_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"refused_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"approver_id" uuid,
	"approver_comment" text,
	"policy_violation" text,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hr_holiday_calendars" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"year" integer NOT NULL,
	"description" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hr_holidays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"calendar_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"date" text NOT NULL,
	"description" text,
	"type" varchar(50) DEFAULT 'public' NOT NULL,
	"is_recurring" boolean DEFAULT false NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hr_leave_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"leave_type_id" uuid NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	"half_day" boolean DEFAULT false NOT NULL,
	"half_day_date" text,
	"total_days" real DEFAULT 0 NOT NULL,
	"reason" text,
	"status" varchar(50) DEFAULT 'draft' NOT NULL,
	"approver_id" uuid,
	"approver_comment" text,
	"approved_at" timestamp with time zone,
	"rejected_at" timestamp with time zone,
	"balance_before" real,
	"is_archived" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hr_leave_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"allocations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hr_leave_policy_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"policy_id" uuid NOT NULL,
	"effective_from" text,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hr_leave_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"color" varchar(20) DEFAULT '#3b82f6' NOT NULL,
	"default_days_per_year" integer DEFAULT 0 NOT NULL,
	"max_carry_forward" integer DEFAULT 0 NOT NULL,
	"requires_approval" boolean DEFAULT true NOT NULL,
	"is_paid" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hr_lifecycle_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"event_type" varchar(50) NOT NULL,
	"event_date" text NOT NULL,
	"effective_date" text,
	"from_value" text,
	"to_value" text,
	"from_department_id" uuid,
	"to_department_id" uuid,
	"notes" text,
	"created_by" uuid,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_line_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"time_entry_id" uuid,
	"description" text NOT NULL,
	"quantity" real DEFAULT 1 NOT NULL,
	"unit_price" real DEFAULT 0 NOT NULL,
	"amount" real DEFAULT 0 NOT NULL,
	"tax_rate" real DEFAULT 20 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"type" varchar(20) DEFAULT 'payment' NOT NULL,
	"amount" real NOT NULL,
	"currency" varchar(10) DEFAULT 'USD' NOT NULL,
	"payment_date" timestamp with time zone NOT NULL,
	"method" varchar(50),
	"reference" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"invoice_prefix" varchar(20) DEFAULT 'INV' NOT NULL,
	"next_invoice_number" integer DEFAULT 1 NOT NULL,
	"default_currency" varchar(10) DEFAULT 'USD' NOT NULL,
	"default_tax_rate" real DEFAULT 0 NOT NULL,
	"e_fatura_enabled" boolean DEFAULT false NOT NULL,
	"e_fatura_company_name" varchar(255),
	"e_fatura_company_tax_id" varchar(20),
	"e_fatura_company_tax_office" varchar(100),
	"e_fatura_company_address" text,
	"e_fatura_company_city" varchar(100),
	"e_fatura_company_country" varchar(100),
	"e_fatura_company_phone" varchar(50),
	"e_fatura_company_email" varchar(255),
	"template_id" varchar(50) DEFAULT 'classic' NOT NULL,
	"logo_path" text,
	"accent_color" varchar(20) DEFAULT '#13715B' NOT NULL,
	"company_name" varchar(255),
	"company_address" text,
	"company_city" varchar(100),
	"company_country" varchar(100),
	"company_phone" varchar(50),
	"company_email" varchar(255),
	"company_website" varchar(255),
	"company_tax_id" varchar(50),
	"payment_instructions" text,
	"bank_details" text,
	"footer_text" text,
	"reminder_enabled" boolean DEFAULT false NOT NULL,
	"reminder_1_days" integer DEFAULT 7 NOT NULL,
	"reminder_2_days" integer DEFAULT 14 NOT NULL,
	"reminder_3_days" integer DEFAULT 30 NOT NULL,
	"endless_reminder_days" integer DEFAULT 14 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_settings_tenant_id_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"contact_id" uuid,
	"deal_id" uuid,
	"proposal_id" uuid,
	"invoice_number" varchar(50) NOT NULL,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"currency" varchar(10) DEFAULT 'USD' NOT NULL,
	"subtotal" real DEFAULT 0 NOT NULL,
	"tax_percent" real DEFAULT 0 NOT NULL,
	"tax_amount" real DEFAULT 0 NOT NULL,
	"discount_percent" real DEFAULT 0 NOT NULL,
	"discount_amount" real DEFAULT 0 NOT NULL,
	"total" real DEFAULT 0 NOT NULL,
	"notes" text,
	"issue_date" timestamp with time zone NOT NULL,
	"due_date" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone,
	"viewed_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"e_fatura_type" varchar(20),
	"e_fatura_uuid" varchar(50),
	"e_fatura_status" varchar(20),
	"e_fatura_xml" text,
	"last_emailed_at" timestamp with time zone,
	"email_sent_count" integer DEFAULT 0 NOT NULL,
	"last_reminder_stage" integer DEFAULT 0 NOT NULL,
	"last_reminder_at" timestamp with time zone,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leave_balances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"leave_type" varchar(50) NOT NULL,
	"year" integer NOT NULL,
	"allocated" integer DEFAULT 0 NOT NULL,
	"used" integer DEFAULT 0 NOT NULL,
	"carried" integer DEFAULT 0 NOT NULL,
	"leave_type_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"type" text DEFAULT 'reminder' NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"source_type" text,
	"source_id" text,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "onboarding_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"title" varchar(500) NOT NULL,
	"description" text,
	"category" varchar(100) DEFAULT 'general' NOT NULL,
	"due_date" text,
	"completed_at" timestamp with time zone,
	"completed_by" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "onboarding_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"tasks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "password_reset_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "presence_heartbeats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"app_id" varchar(50) NOT NULL,
	"record_id" varchar(255) NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"hourly_rate" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"company_id" uuid,
	"name" varchar(500) NOT NULL,
	"description" text,
	"billable" boolean DEFAULT true NOT NULL,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"estimated_hours" real,
	"estimated_amount" real,
	"start_date" timestamp with time zone,
	"end_date" timestamp with time zone,
	"color" varchar(20),
	"is_archived" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"default_hourly_rate" real DEFAULT 0 NOT NULL,
	"company_name" varchar(500),
	"company_address" text,
	"company_logo" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_time_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"duration_minutes" integer DEFAULT 0 NOT NULL,
	"work_date" varchar(10) NOT NULL,
	"start_time" varchar(5),
	"end_time" varchar(5),
	"billable" boolean DEFAULT true NOT NULL,
	"billed" boolean DEFAULT false NOT NULL,
	"locked" boolean DEFAULT false NOT NULL,
	"invoice_line_item_id" uuid,
	"notes" text,
	"task_description" varchar(500),
	"is_archived" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "record_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"source_app_id" varchar(100) NOT NULL,
	"source_record_id" uuid NOT NULL,
	"target_app_id" varchar(100) NOT NULL,
	"target_record_id" uuid NOT NULL,
	"link_type" varchar(100) DEFAULT 'related' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurring_invoice_line_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recurring_invoice_id" uuid NOT NULL,
	"description" text NOT NULL,
	"quantity" real DEFAULT 1 NOT NULL,
	"unit_price" real DEFAULT 0 NOT NULL,
	"tax_rate" real DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurring_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"title" varchar(500) NOT NULL,
	"description" text,
	"currency" varchar(10) DEFAULT 'USD' NOT NULL,
	"tax_percent" real DEFAULT 0 NOT NULL,
	"discount_percent" real DEFAULT 0 NOT NULL,
	"notes" text,
	"payment_instructions" text,
	"frequency" varchar(20) NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone,
	"next_run_at" timestamp with time zone NOT NULL,
	"last_run_at" timestamp with time zone,
	"run_count" integer DEFAULT 0 NOT NULL,
	"max_runs" integer,
	"auto_send" boolean DEFAULT false NOT NULL,
	"payment_terms_days" integer DEFAULT 30 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sign_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"action" varchar(100) NOT NULL,
	"actor_email" varchar(255),
	"actor_name" varchar(255),
	"ip_address" varchar(100),
	"user_agent" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sign_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(500) NOT NULL,
	"file_name" varchar(500) NOT NULL,
	"storage_path" text NOT NULL,
	"page_count" integer DEFAULT 1 NOT NULL,
	"fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signature_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(500) NOT NULL,
	"file_name" varchar(500) NOT NULL,
	"storage_path" text NOT NULL,
	"page_count" integer DEFAULT 1 NOT NULL,
	"status" varchar(50) DEFAULT 'draft' NOT NULL,
	"expires_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"document_type" varchar(50) DEFAULT 'contract' NOT NULL,
	"counterparty_name" varchar(255),
	"redirect_url" text,
	"is_archived" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signature_fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"type" varchar(50) DEFAULT 'signature' NOT NULL,
	"page_number" integer DEFAULT 1 NOT NULL,
	"x" real NOT NULL,
	"y" real NOT NULL,
	"width" real NOT NULL,
	"height" real NOT NULL,
	"signer_email" varchar(255),
	"label" varchar(255),
	"required" boolean DEFAULT true NOT NULL,
	"options" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"signed_at" timestamp with time zone,
	"signature_data" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signing_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"signer_email" varchar(255) NOT NULL,
	"signer_name" varchar(255),
	"token" varchar(255) NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"signed_at" timestamp with time zone,
	"decline_reason" text,
	"role" varchar(50) DEFAULT 'signer' NOT NULL,
	"signing_order" integer DEFAULT 0 NOT NULL,
	"last_reminder_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "signing_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "spreadsheets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text DEFAULT 'Untitled table' NOT NULL,
	"columns" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"rows" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"view_config" jsonb DEFAULT '{"activeView":"grid"}'::jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"color" text,
	"icon" text,
	"guide" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subtasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"is_completed" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"smtp_host" varchar(255),
	"smtp_port" integer DEFAULT 587 NOT NULL,
	"smtp_user" varchar(255),
	"smtp_pass" text,
	"smtp_from" varchar(255) DEFAULT 'Atlas <noreply@atlas.local>' NOT NULL,
	"smtp_secure" boolean DEFAULT false NOT NULL,
	"smtp_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "table_row_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"spreadsheet_id" uuid NOT NULL,
	"row_id" text NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"action" text NOT NULL,
	"field" text,
	"old_value" text,
	"new_value" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"file_name" varchar(500) NOT NULL,
	"storage_path" text NOT NULL,
	"mime_type" varchar(255),
	"size" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_dependencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"blocked_by_task_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text DEFAULT 'Untitled project' NOT NULL,
	"description" text,
	"icon" text,
	"color" text DEFAULT '#5a7fa0' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"visibility" varchar(10) DEFAULT 'private' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"title" text DEFAULT 'Untitled template' NOT NULL,
	"description" text,
	"icon" text,
	"default_when" text DEFAULT 'inbox' NOT NULL,
	"default_priority" text DEFAULT 'none' NOT NULL,
	"default_tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"subtask_titles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid,
	"title" text DEFAULT '' NOT NULL,
	"notes" text,
	"description" text,
	"icon" text,
	"type" text DEFAULT 'task' NOT NULL,
	"heading_id" uuid,
	"status" text DEFAULT 'todo' NOT NULL,
	"when" text DEFAULT 'inbox' NOT NULL,
	"priority" text DEFAULT 'none' NOT NULL,
	"due_date" text,
	"completed_at" timestamp with time zone,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"recurrence_rule" text,
	"recurrence_parent_id" uuid,
	"source_email_id" text,
	"source_email_subject" text,
	"assignee_id" uuid,
	"last_reminder_at" timestamp with time zone,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"visibility" varchar(10) DEFAULT 'team' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_apps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"app_id" varchar(100) NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"enabled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"enabled_by" uuid NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"email" varchar(255) NOT NULL,
	"role" varchar(50) DEFAULT 'member' NOT NULL,
	"invited_by" uuid NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"app_permissions" jsonb,
	"crm_team_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_invitations_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "tenant_members" (
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" varchar(50) DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(63) NOT NULL,
	"name" varchar(255) NOT NULL,
	"plan" varchar(50) DEFAULT 'starter' NOT NULL,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"owner_id" uuid NOT NULL,
	"k8s_namespace" varchar(63) NOT NULL,
	"quota_cpu" integer DEFAULT 2000 NOT NULL,
	"quota_memory_mb" integer DEFAULT 4096 NOT NULL,
	"quota_storage_mb" integer DEFAULT 20480 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug"),
	CONSTRAINT "tenants_k8s_namespace_unique" UNIQUE("k8s_namespace")
);
--> statement-breakpoint
CREATE TABLE "threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"gmail_thread_id" text NOT NULL,
	"subject" text,
	"snippet" text,
	"message_count" integer DEFAULT 0 NOT NULL,
	"unread_count" integer DEFAULT 0 NOT NULL,
	"has_attachments" boolean DEFAULT false NOT NULL,
	"last_message_at" timestamp with time zone NOT NULL,
	"category" text DEFAULT 'other' NOT NULL,
	"labels" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_starred" boolean DEFAULT false NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"is_trashed" boolean DEFAULT false NOT NULL,
	"is_spam" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "time_off_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"type" text DEFAULT 'vacation' NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"approver_id" uuid,
	"notes" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tracking_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tracking_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"link_url" text,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"theme" text DEFAULT 'system' NOT NULL,
	"density" text DEFAULT 'default' NOT NULL,
	"shortcuts_preset" text DEFAULT 'superhuman' NOT NULL,
	"custom_shortcuts" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"auto_advance" text DEFAULT 'next' NOT NULL,
	"reading_pane" text DEFAULT 'right' NOT NULL,
	"desktop_notifications" boolean DEFAULT true NOT NULL,
	"notification_sound" boolean DEFAULT false NOT NULL,
	"signature_html" text,
	"tracking_enabled" boolean DEFAULT false NOT NULL,
	"tasks_default_view" text DEFAULT 'inbox' NOT NULL,
	"tasks_confirm_delete" boolean DEFAULT true NOT NULL,
	"tasks_show_calendar" boolean DEFAULT true NOT NULL,
	"tasks_show_evening" boolean DEFAULT true NOT NULL,
	"tasks_show_when_badges" boolean DEFAULT true NOT NULL,
	"tasks_show_project" boolean DEFAULT true NOT NULL,
	"tasks_show_notes_indicator" boolean DEFAULT true NOT NULL,
	"tasks_compact_mode" boolean DEFAULT false NOT NULL,
	"tasks_completed_behavior" text DEFAULT 'fade' NOT NULL,
	"tasks_default_sort" text DEFAULT 'manual' NOT NULL,
	"tasks_view_mode" text DEFAULT 'list' NOT NULL,
	"date_format" text DEFAULT 'DD/MM/YYYY' NOT NULL,
	"currency_symbol" text DEFAULT '$' NOT NULL,
	"timezone" text DEFAULT '' NOT NULL,
	"time_format" text DEFAULT '12h' NOT NULL,
	"number_format" text DEFAULT 'comma-period' NOT NULL,
	"calendar_start_day" text DEFAULT 'monday' NOT NULL,
	"tables_default_view" text DEFAULT 'grid' NOT NULL,
	"tables_default_sort" text DEFAULT 'none' NOT NULL,
	"tables_show_field_type_icons" boolean DEFAULT true NOT NULL,
	"tables_default_row_count" integer DEFAULT 3 NOT NULL,
	"tables_include_row_ids_in_export" boolean DEFAULT false NOT NULL,
	"cal_default_view" text DEFAULT 'week' NOT NULL,
	"cal_week_starts_on_monday" boolean DEFAULT false NOT NULL,
	"cal_show_week_numbers" boolean DEFAULT false NOT NULL,
	"cal_density" text DEFAULT 'default' NOT NULL,
	"cal_work_start_hour" integer DEFAULT 9 NOT NULL,
	"cal_work_end_hour" integer DEFAULT 17 NOT NULL,
	"cal_secondary_timezone" text,
	"cal_event_reminder_minutes" integer DEFAULT 10 NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"font_family" text DEFAULT 'inter' NOT NULL,
	"color_theme" text DEFAULT 'default' NOT NULL,
	"show_badge_count" boolean DEFAULT true NOT NULL,
	"notification_level" text DEFAULT 'smart' NOT NULL,
	"compose_mode" text DEFAULT 'rich' NOT NULL,
	"signature" text DEFAULT '' NOT NULL,
	"include_signature_in_replies" boolean DEFAULT true NOT NULL,
	"undo_send_delay" integer DEFAULT 5 NOT NULL,
	"send_animation" boolean DEFAULT true NOT NULL,
	"theme_transition" boolean DEFAULT true NOT NULL,
	"ai_enabled" boolean DEFAULT false NOT NULL,
	"ai_provider" text DEFAULT 'openai' NOT NULL,
	"ai_api_keys" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ai_custom_provider" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ai_writing_assistant" boolean DEFAULT true NOT NULL,
	"ai_quick_replies" boolean DEFAULT true NOT NULL,
	"ai_thread_summary" boolean DEFAULT true NOT NULL,
	"ai_translation" boolean DEFAULT true NOT NULL,
	"docs_font_style" text DEFAULT 'default' NOT NULL,
	"docs_small_text" boolean DEFAULT false NOT NULL,
	"docs_full_width" boolean DEFAULT false NOT NULL,
	"docs_spell_check" boolean DEFAULT true NOT NULL,
	"docs_open_last_visited" boolean DEFAULT true NOT NULL,
	"docs_sidebar_default" text DEFAULT 'tree' NOT NULL,
	"doc_favorites" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"doc_recent" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"draw_grid_mode" boolean DEFAULT false NOT NULL,
	"draw_snap_to_grid" boolean DEFAULT false NOT NULL,
	"draw_default_background" text DEFAULT 'white' NOT NULL,
	"draw_export_quality" integer DEFAULT 1 NOT NULL,
	"draw_export_with_background" boolean DEFAULT true NOT NULL,
	"draw_auto_save_interval" integer DEFAULT 2000 NOT NULL,
	"draw_sort_order" text DEFAULT 'modified' NOT NULL,
	"draw_library" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"drive_default_view" text DEFAULT 'list' NOT NULL,
	"drive_default_sort" text DEFAULT 'default' NOT NULL,
	"drive_sidebar_default" text DEFAULT 'files' NOT NULL,
	"drive_show_preview_panel" boolean DEFAULT true NOT NULL,
	"drive_compact_mode" boolean DEFAULT false NOT NULL,
	"drive_confirm_delete" boolean DEFAULT true NOT NULL,
	"drive_auto_version_on_replace" boolean DEFAULT true NOT NULL,
	"drive_max_versions" integer DEFAULT 20 NOT NULL,
	"drive_share_default_expiry" text DEFAULT 'never' NOT NULL,
	"drive_duplicate_handling" text DEFAULT 'rename' NOT NULL,
	"drive_show_thumbnails" boolean DEFAULT true NOT NULL,
	"drive_show_file_extensions" boolean DEFAULT true NOT NULL,
	"drive_sort_order" text DEFAULT 'asc' NOT NULL,
	"recent_searches" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"home_bg_type" text DEFAULT 'unsplash' NOT NULL,
	"home_bg_value" text,
	"home_bg_rotate" boolean DEFAULT false NOT NULL,
	"home_show_seconds" boolean DEFAULT true NOT NULL,
	"home_enabled_widgets" jsonb,
	"home_dock_pet" varchar(20) DEFAULT 'cat' NOT NULL,
	"home_flying_birds" boolean DEFAULT false NOT NULL,
	"home_demo_data_active" boolean DEFAULT false NOT NULL,
	"app_widgets" jsonb,
	"recent_items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_settings_account_id_unique" UNIQUE("account_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_email_id_emails_id_fk" FOREIGN KEY ("email_id") REFERENCES "public"."emails"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_calendar_id_calendars_id_fk" FOREIGN KEY ("calendar_id") REFERENCES "public"."calendars"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendars" ADD CONSTRAINT "calendars_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_rules" ADD CONSTRAINT "category_rules_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_deal_id_crm_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."crm_deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_contact_id_crm_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."crm_contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_company_id_crm_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."crm_companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_activity_types" ADD CONSTRAINT "crm_activity_types_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_companies" ADD CONSTRAINT "crm_companies_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_contacts" ADD CONSTRAINT "crm_contacts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_contacts" ADD CONSTRAINT "crm_contacts_company_id_crm_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."crm_companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_deal_stages" ADD CONSTRAINT "crm_deal_stages_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_deals" ADD CONSTRAINT "crm_deals_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_deals" ADD CONSTRAINT "crm_deals_stage_id_crm_deal_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."crm_deal_stages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_deals" ADD CONSTRAINT "crm_deals_contact_id_crm_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."crm_contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_deals" ADD CONSTRAINT "crm_deals_company_id_crm_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."crm_companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_lead_forms" ADD CONSTRAINT "crm_lead_forms_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_notes" ADD CONSTRAINT "crm_notes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_notes" ADD CONSTRAINT "crm_notes_deal_id_crm_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."crm_deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_notes" ADD CONSTRAINT "crm_notes_contact_id_crm_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."crm_contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_notes" ADD CONSTRAINT "crm_notes_company_id_crm_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."crm_companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_proposals" ADD CONSTRAINT "crm_proposals_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_proposals" ADD CONSTRAINT "crm_proposals_deal_id_crm_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."crm_deals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_proposals" ADD CONSTRAINT "crm_proposals_contact_id_crm_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."crm_contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_proposals" ADD CONSTRAINT "crm_proposals_company_id_crm_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."crm_companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_saved_views" ADD CONSTRAINT "crm_saved_views_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_team_members" ADD CONSTRAINT "crm_team_members_team_id_crm_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."crm_teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_teams" ADD CONSTRAINT "crm_teams_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_workflows" ADD CONSTRAINT "crm_workflows_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_field_definitions" ADD CONSTRAINT "custom_field_definitions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_field_values" ADD CONSTRAINT "custom_field_values_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_field_values" ADD CONSTRAINT "custom_field_values_field_definition_id_custom_field_definitions_id_fk" FOREIGN KEY ("field_definition_id") REFERENCES "public"."custom_field_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_comments" ADD CONSTRAINT "document_comments_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_comments" ADD CONSTRAINT "document_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_comments" ADD CONSTRAINT "document_comments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_comments" ADD CONSTRAINT "document_comments_parent_id_document_comments_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."document_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_links" ADD CONSTRAINT "document_links_source_doc_id_documents_id_fk" FOREIGN KEY ("source_doc_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_links" ADD CONSTRAINT "document_links_target_doc_id_documents_id_fk" FOREIGN KEY ("target_doc_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_parent_id_documents_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drawings" ADD CONSTRAINT "drawings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drawings" ADD CONSTRAINT "drawings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_activity_log" ADD CONSTRAINT "drive_activity_log_drive_item_id_drive_items_id_fk" FOREIGN KEY ("drive_item_id") REFERENCES "public"."drive_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_activity_log" ADD CONSTRAINT "drive_activity_log_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_comments" ADD CONSTRAINT "drive_comments_drive_item_id_drive_items_id_fk" FOREIGN KEY ("drive_item_id") REFERENCES "public"."drive_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_comments" ADD CONSTRAINT "drive_comments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_item_shares" ADD CONSTRAINT "drive_item_shares_drive_item_id_drive_items_id_fk" FOREIGN KEY ("drive_item_id") REFERENCES "public"."drive_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_item_versions" ADD CONSTRAINT "drive_item_versions_drive_item_id_drive_items_id_fk" FOREIGN KEY ("drive_item_id") REFERENCES "public"."drive_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_item_versions" ADD CONSTRAINT "drive_item_versions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_item_versions" ADD CONSTRAINT "drive_item_versions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_items" ADD CONSTRAINT "drive_items_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_items" ADD CONSTRAINT "drive_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_items" ADD CONSTRAINT "drive_items_parent_id_drive_items_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."drive_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_share_links" ADD CONSTRAINT "drive_share_links_drive_item_id_drive_items_id_fk" FOREIGN KEY ("drive_item_id") REFERENCES "public"."drive_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_share_links" ADD CONSTRAINT "drive_share_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_tracking" ADD CONSTRAINT "email_tracking_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_tracking" ADD CONSTRAINT "email_tracking_email_id_emails_id_fk" FOREIGN KEY ("email_id") REFERENCES "public"."emails"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_tracking" ADD CONSTRAINT "email_tracking_thread_id_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emails" ADD CONSTRAINT "emails_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emails" ADD CONSTRAINT "emails_thread_id_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_linked_user_id_users_id_fk" FOREIGN KEY ("linked_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_attendance" ADD CONSTRAINT "hr_attendance_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_attendance" ADD CONSTRAINT "hr_attendance_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_expense_categories" ADD CONSTRAINT "hr_expense_categories_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_expense_policies" ADD CONSTRAINT "hr_expense_policies_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_expense_policy_assignments" ADD CONSTRAINT "hr_expense_policy_assignments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_expense_policy_assignments" ADD CONSTRAINT "hr_expense_policy_assignments_policy_id_hr_expense_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."hr_expense_policies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_expense_policy_assignments" ADD CONSTRAINT "hr_expense_policy_assignments_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_expense_policy_assignments" ADD CONSTRAINT "hr_expense_policy_assignments_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_expense_reports" ADD CONSTRAINT "hr_expense_reports_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_expense_reports" ADD CONSTRAINT "hr_expense_reports_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_expenses" ADD CONSTRAINT "hr_expenses_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_expenses" ADD CONSTRAINT "hr_expenses_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_expenses" ADD CONSTRAINT "hr_expenses_category_id_hr_expense_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."hr_expense_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_expenses" ADD CONSTRAINT "hr_expenses_project_id_project_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project_projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_expenses" ADD CONSTRAINT "hr_expenses_report_id_hr_expense_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."hr_expense_reports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_holiday_calendars" ADD CONSTRAINT "hr_holiday_calendars_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_holidays" ADD CONSTRAINT "hr_holidays_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_holidays" ADD CONSTRAINT "hr_holidays_calendar_id_hr_holiday_calendars_id_fk" FOREIGN KEY ("calendar_id") REFERENCES "public"."hr_holiday_calendars"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_leave_applications" ADD CONSTRAINT "hr_leave_applications_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_leave_applications" ADD CONSTRAINT "hr_leave_applications_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_leave_applications" ADD CONSTRAINT "hr_leave_applications_leave_type_id_hr_leave_types_id_fk" FOREIGN KEY ("leave_type_id") REFERENCES "public"."hr_leave_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_leave_applications" ADD CONSTRAINT "hr_leave_applications_approver_id_employees_id_fk" FOREIGN KEY ("approver_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_leave_policies" ADD CONSTRAINT "hr_leave_policies_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_leave_policy_assignments" ADD CONSTRAINT "hr_leave_policy_assignments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_leave_policy_assignments" ADD CONSTRAINT "hr_leave_policy_assignments_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_leave_policy_assignments" ADD CONSTRAINT "hr_leave_policy_assignments_policy_id_hr_leave_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."hr_leave_policies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_leave_types" ADD CONSTRAINT "hr_leave_types_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_lifecycle_events" ADD CONSTRAINT "hr_lifecycle_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_lifecycle_events" ADD CONSTRAINT "hr_lifecycle_events_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_time_entry_id_project_time_entries_id_fk" FOREIGN KEY ("time_entry_id") REFERENCES "public"."project_time_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_settings" ADD CONSTRAINT "invoice_settings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_company_id_crm_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."crm_companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_contact_id_crm_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."crm_contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_deal_id_crm_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."crm_deals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_proposal_id_crm_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."crm_proposals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_tasks" ADD CONSTRAINT "onboarding_tasks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_tasks" ADD CONSTRAINT "onboarding_tasks_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_templates" ADD CONSTRAINT "onboarding_templates_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_project_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_projects" ADD CONSTRAINT "project_projects_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_projects" ADD CONSTRAINT "project_projects_company_id_crm_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."crm_companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_settings" ADD CONSTRAINT "project_settings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_time_entries" ADD CONSTRAINT "project_time_entries_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_time_entries" ADD CONSTRAINT "project_time_entries_project_id_project_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_links" ADD CONSTRAINT "record_links_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_invoice_line_items" ADD CONSTRAINT "recurring_invoice_line_items_recurring_invoice_id_recurring_invoices_id_fk" FOREIGN KEY ("recurring_invoice_id") REFERENCES "public"."recurring_invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_invoices" ADD CONSTRAINT "recurring_invoices_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_invoices" ADD CONSTRAINT "recurring_invoices_company_id_crm_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."crm_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sign_audit_log" ADD CONSTRAINT "sign_audit_log_document_id_signature_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."signature_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sign_templates" ADD CONSTRAINT "sign_templates_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_documents" ADD CONSTRAINT "signature_documents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_fields" ADD CONSTRAINT "signature_fields_document_id_signature_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."signature_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signing_tokens" ADD CONSTRAINT "signing_tokens_document_id_signature_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."signature_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spreadsheets" ADD CONSTRAINT "spreadsheets_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spreadsheets" ADD CONSTRAINT "spreadsheets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subtasks" ADD CONSTRAINT "subtasks_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subtasks" ADD CONSTRAINT "subtasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_row_comments" ADD CONSTRAINT "table_row_comments_spreadsheet_id_spreadsheets_id_fk" FOREIGN KEY ("spreadsheet_id") REFERENCES "public"."spreadsheets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_row_comments" ADD CONSTRAINT "table_row_comments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_activities" ADD CONSTRAINT "task_activities_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_activities" ADD CONSTRAINT "task_activities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_attachments" ADD CONSTRAINT "task_attachments_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_attachments" ADD CONSTRAINT "task_attachments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_blocked_by_task_id_tasks_id_fk" FOREIGN KEY ("blocked_by_task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_projects" ADD CONSTRAINT "task_projects_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_projects" ADD CONSTRAINT "task_projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_task_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."task_projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_recurrence_parent_id_tasks_id_fk" FOREIGN KEY ("recurrence_parent_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_apps" ADD CONSTRAINT "tenant_apps_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_invitations" ADD CONSTRAINT "tenant_invitations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_members" ADD CONSTRAINT "tenant_members_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "threads" ADD CONSTRAINT "threads_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_off_requests" ADD CONSTRAINT "time_off_requests_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_off_requests" ADD CONSTRAINT "time_off_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_off_requests" ADD CONSTRAINT "time_off_requests_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_off_requests" ADD CONSTRAINT "time_off_requests_approver_id_employees_id_fk" FOREIGN KEY ("approver_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_accounts_provider" ON "accounts" USING btree ("provider","provider_id");--> statement-breakpoint
CREATE INDEX "idx_accounts_user" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_activity_feed_tenant_created" ON "activity_feed" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_activity_feed_user" ON "activity_feed" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_app_permission_audit_tenant_created" ON "app_permission_audit" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_app_permission_audit_target" ON "app_permission_audit" USING btree ("tenant_id","target_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_app_permissions_unique" ON "app_permissions" USING btree ("tenant_id","user_id","app_id");--> statement-breakpoint
CREATE INDEX "idx_attachments_email" ON "attachments" USING btree ("email_id");--> statement-breakpoint
CREATE INDEX "idx_audit_log_tenant" ON "audit_log" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_audit_log_user" ON "audit_log" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_cal_events_account_google" ON "calendar_events" USING btree ("account_id","google_event_id");--> statement-breakpoint
CREATE INDEX "idx_cal_events_calendar" ON "calendar_events" USING btree ("calendar_id");--> statement-breakpoint
CREATE INDEX "idx_cal_events_time_range" ON "calendar_events" USING btree ("account_id","start_time","end_time");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_calendars_account_google" ON "calendars" USING btree ("account_id","google_calendar_id");--> statement-breakpoint
CREATE INDEX "idx_category_rules_account" ON "category_rules" USING btree ("account_id","priority");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_contacts_account_email" ON "contacts" USING btree ("account_id","email");--> statement-breakpoint
CREATE INDEX "idx_contacts_account_freq" ON "contacts" USING btree ("account_id","frequency");--> statement-breakpoint
CREATE INDEX "idx_crm_activities_deal" ON "crm_activities" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "idx_crm_activities_contact" ON "crm_activities" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "idx_crm_activities_company" ON "crm_activities" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_crm_activity_types_tenant" ON "crm_activity_types" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_crm_companies_tenant" ON "crm_companies" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_crm_contacts_tenant" ON "crm_contacts" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_crm_contacts_company" ON "crm_contacts" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_crm_stages_tenant" ON "crm_deal_stages" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_crm_deals_tenant" ON "crm_deals" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_crm_deals_stage" ON "crm_deals" USING btree ("stage_id");--> statement-breakpoint
CREATE INDEX "idx_crm_deals_contact" ON "crm_deals" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "idx_crm_deals_company" ON "crm_deals" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_crm_lead_forms_token" ON "crm_lead_forms" USING btree ("token");--> statement-breakpoint
CREATE INDEX "idx_crm_lead_forms_tenant" ON "crm_lead_forms" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_crm_leads_tenant" ON "crm_leads" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_crm_leads_status" ON "crm_leads" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_crm_notes_deal" ON "crm_notes" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "idx_crm_notes_contact" ON "crm_notes" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "idx_crm_notes_company" ON "crm_notes" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_crm_proposals_tenant" ON "crm_proposals" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_crm_proposals_deal" ON "crm_proposals" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "idx_crm_proposals_company" ON "crm_proposals" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_crm_proposals_status" ON "crm_proposals" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_crm_proposals_token" ON "crm_proposals" USING btree ("public_token");--> statement-breakpoint
CREATE INDEX "idx_crm_saved_views_tenant" ON "crm_saved_views" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_crm_saved_views_user" ON "crm_saved_views" USING btree ("user_id","app_section");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_crm_team_members_unique" ON "crm_team_members" USING btree ("team_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_crm_teams_tenant" ON "crm_teams" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_crm_workflows_tenant" ON "crm_workflows" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_crm_workflows_trigger" ON "crm_workflows" USING btree ("trigger");--> statement-breakpoint
CREATE INDEX "idx_cfd_tenant_app" ON "custom_field_definitions" USING btree ("tenant_id","app_id","record_type");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_cfd_slug_unique" ON "custom_field_definitions" USING btree ("tenant_id","app_id","record_type","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_cfv_record_field" ON "custom_field_values" USING btree ("record_id","field_definition_id");--> statement-breakpoint
CREATE INDEX "idx_cfv_field" ON "custom_field_values" USING btree ("field_definition_id");--> statement-breakpoint
CREATE INDEX "idx_cfv_record" ON "custom_field_values" USING btree ("record_id");--> statement-breakpoint
CREATE INDEX "idx_cfv_tenant" ON "custom_field_values" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_departments_user" ON "departments" USING btree ("user_id","is_archived");--> statement-breakpoint
CREATE INDEX "idx_departments_tenant" ON "departments" USING btree ("tenant_id","is_archived");--> statement-breakpoint
CREATE INDEX "idx_document_comments_doc" ON "document_comments" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "idx_document_comments_parent" ON "document_comments" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "idx_document_links_source" ON "document_links" USING btree ("source_doc_id");--> statement-breakpoint
CREATE INDEX "idx_document_links_target" ON "document_links" USING btree ("target_doc_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_document_links_unique" ON "document_links" USING btree ("source_doc_id","target_doc_id");--> statement-breakpoint
CREATE INDEX "idx_document_versions_doc" ON "document_versions" USING btree ("document_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_documents_tenant" ON "documents" USING btree ("tenant_id","is_archived");--> statement-breakpoint
CREATE INDEX "idx_documents_user" ON "documents" USING btree ("user_id","is_archived");--> statement-breakpoint
CREATE INDEX "idx_documents_parent" ON "documents" USING btree ("parent_id","sort_order");--> statement-breakpoint
CREATE INDEX "idx_documents_tenant_parent" ON "documents" USING btree ("tenant_id","parent_id","sort_order");--> statement-breakpoint
CREATE INDEX "idx_documents_user_parent" ON "documents" USING btree ("user_id","parent_id","sort_order");--> statement-breakpoint
CREATE INDEX "idx_drawings_tenant" ON "drawings" USING btree ("tenant_id","is_archived");--> statement-breakpoint
CREATE INDEX "idx_drawings_user" ON "drawings" USING btree ("user_id","is_archived");--> statement-breakpoint
CREATE INDEX "idx_drive_activity_item" ON "drive_activity_log" USING btree ("drive_item_id");--> statement-breakpoint
CREATE INDEX "idx_drive_comments_item" ON "drive_comments" USING btree ("drive_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_drive_shares_unique" ON "drive_item_shares" USING btree ("drive_item_id","shared_with_user_id");--> statement-breakpoint
CREATE INDEX "idx_drive_shares_user" ON "drive_item_shares" USING btree ("shared_with_user_id");--> statement-breakpoint
CREATE INDEX "idx_drive_versions_item" ON "drive_item_versions" USING btree ("drive_item_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_drive_items_user_parent" ON "drive_items" USING btree ("user_id","parent_id","is_archived");--> statement-breakpoint
CREATE INDEX "idx_drive_items_user_archived" ON "drive_items" USING btree ("user_id","is_archived");--> statement-breakpoint
CREATE INDEX "idx_drive_items_user_favourite" ON "drive_items" USING btree ("user_id","is_favourite");--> statement-breakpoint
CREATE INDEX "idx_share_links_token" ON "drive_share_links" USING btree ("share_token");--> statement-breakpoint
CREATE INDEX "idx_share_links_item" ON "drive_share_links" USING btree ("drive_item_id");--> statement-breakpoint
CREATE INDEX "idx_email_tracking_account" ON "email_tracking" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "idx_email_tracking_thread" ON "email_tracking" USING btree ("thread_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_emails_account_gmail" ON "emails" USING btree ("account_id","gmail_message_id");--> statement-breakpoint
CREATE INDEX "idx_emails_thread" ON "emails" USING btree ("thread_id","internal_date");--> statement-breakpoint
CREATE INDEX "idx_emails_account_date" ON "emails" USING btree ("account_id","internal_date");--> statement-breakpoint
CREATE INDEX "idx_employee_documents_employee" ON "employee_documents" USING btree ("employee_id","is_archived");--> statement-breakpoint
CREATE INDEX "idx_employee_documents_tenant" ON "employee_documents" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_employees_user_status" ON "employees" USING btree ("user_id","status","is_archived");--> statement-breakpoint
CREATE INDEX "idx_employees_department" ON "employees" USING btree ("department_id","sort_order");--> statement-breakpoint
CREATE INDEX "idx_employees_tenant" ON "employees" USING btree ("tenant_id","is_archived");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_hr_attendance_employee_date" ON "hr_attendance" USING btree ("employee_id","date");--> statement-breakpoint
CREATE INDEX "idx_hr_attendance_tenant_date" ON "hr_attendance" USING btree ("tenant_id","date");--> statement-breakpoint
CREATE INDEX "idx_hr_attendance_employee_status" ON "hr_attendance" USING btree ("employee_id","status");--> statement-breakpoint
CREATE INDEX "idx_hr_expense_categories_tenant" ON "hr_expense_categories" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_hr_expense_policies_tenant" ON "hr_expense_policies" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_hr_expense_policy_assignments_policy" ON "hr_expense_policy_assignments" USING btree ("policy_id");--> statement-breakpoint
CREATE INDEX "idx_hr_expense_reports_tenant" ON "hr_expense_reports" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_hr_expense_reports_employee" ON "hr_expense_reports" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_hr_expense_reports_status" ON "hr_expense_reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_hr_expenses_tenant" ON "hr_expenses" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_hr_expenses_employee" ON "hr_expenses" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_hr_expenses_category" ON "hr_expenses" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "idx_hr_expenses_status" ON "hr_expenses" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_hr_expenses_report" ON "hr_expenses" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "idx_hr_expenses_project" ON "hr_expenses" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_hr_expenses_date" ON "hr_expenses" USING btree ("expense_date");--> statement-breakpoint
CREATE INDEX "idx_hr_holiday_calendars_tenant" ON "hr_holiday_calendars" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_hr_holidays_calendar" ON "hr_holidays" USING btree ("calendar_id");--> statement-breakpoint
CREATE INDEX "idx_hr_holidays_tenant_date" ON "hr_holidays" USING btree ("tenant_id","date");--> statement-breakpoint
CREATE INDEX "idx_hr_leave_apps_employee_status" ON "hr_leave_applications" USING btree ("employee_id","status");--> statement-breakpoint
CREATE INDEX "idx_hr_leave_apps_approver_status" ON "hr_leave_applications" USING btree ("approver_id","status");--> statement-breakpoint
CREATE INDEX "idx_hr_leave_apps_tenant_status" ON "hr_leave_applications" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "idx_hr_leave_policies_tenant" ON "hr_leave_policies" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_hr_policy_assignments_employee" ON "hr_leave_policy_assignments" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_hr_policy_assignments_tenant" ON "hr_leave_policy_assignments" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_hr_leave_types_tenant_slug" ON "hr_leave_types" USING btree ("tenant_id","slug");--> statement-breakpoint
CREATE INDEX "idx_hr_leave_types_tenant_active" ON "hr_leave_types" USING btree ("tenant_id","is_active");--> statement-breakpoint
CREATE INDEX "idx_hr_lifecycle_employee_date" ON "hr_lifecycle_events" USING btree ("employee_id","event_date");--> statement-breakpoint
CREATE INDEX "idx_hr_lifecycle_tenant" ON "hr_lifecycle_events" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_invoice_line_items_invoice" ON "invoice_line_items" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "idx_invoice_payments_invoice" ON "invoice_payments" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "idx_invoice_payments_tenant" ON "invoice_payments" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_invoices_tenant" ON "invoices" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_invoices_company" ON "invoices" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_invoices_status" ON "invoices" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_invoices_number" ON "invoices" USING btree ("tenant_id","invoice_number");--> statement-breakpoint
CREATE INDEX "idx_leave_balances_employee_year" ON "leave_balances" USING btree ("employee_id","year");--> statement-breakpoint
CREATE INDEX "idx_leave_balances_tenant" ON "leave_balances" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_notifications_user" ON "notifications" USING btree ("user_id","is_read");--> statement-breakpoint
CREATE INDEX "idx_notifications_user_created" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_onboarding_tasks_employee" ON "onboarding_tasks" USING btree ("employee_id","is_archived");--> statement-breakpoint
CREATE INDEX "idx_onboarding_tasks_tenant" ON "onboarding_tasks" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_onboarding_templates_tenant" ON "onboarding_templates" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_presence_unique" ON "presence_heartbeats" USING btree ("user_id","app_id","record_id");--> statement-breakpoint
CREATE INDEX "idx_presence_lookup" ON "presence_heartbeats" USING btree ("tenant_id","app_id","record_id");--> statement-breakpoint
CREATE INDEX "idx_project_members_project" ON "project_members" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_project_members_user_project" ON "project_members" USING btree ("user_id","project_id");--> statement-breakpoint
CREATE INDEX "idx_project_projects_tenant" ON "project_projects" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_project_projects_company" ON "project_projects" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_project_projects_status" ON "project_projects" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_project_settings_tenant" ON "project_settings" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_project_time_entries_tenant" ON "project_time_entries" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_project_time_entries_project" ON "project_time_entries" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_project_time_entries_user_date" ON "project_time_entries" USING btree ("user_id","work_date");--> statement-breakpoint
CREATE INDEX "idx_project_time_entries_billed" ON "project_time_entries" USING btree ("billed","billable");--> statement-breakpoint
CREATE INDEX "idx_push_subscriptions_user" ON "push_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_record_links_source" ON "record_links" USING btree ("source_app_id","source_record_id");--> statement-breakpoint
CREATE INDEX "idx_record_links_target" ON "record_links" USING btree ("target_app_id","target_record_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_record_links_unique" ON "record_links" USING btree ("source_app_id","source_record_id","target_app_id","target_record_id","link_type");--> statement-breakpoint
CREATE INDEX "idx_recurring_invoices_tenant" ON "recurring_invoices" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_recurring_invoices_next_run" ON "recurring_invoices" USING btree ("is_active","next_run_at");--> statement-breakpoint
CREATE INDEX "idx_sign_audit_document" ON "sign_audit_log" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "idx_sign_templates_tenant" ON "sign_templates" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_sig_docs_tenant" ON "signature_documents" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_sig_docs_status" ON "signature_documents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_sig_fields_document" ON "signature_fields" USING btree ("document_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_signing_tokens_token" ON "signing_tokens" USING btree ("token");--> statement-breakpoint
CREATE INDEX "idx_signing_tokens_document" ON "signing_tokens" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "idx_spreadsheets_user" ON "spreadsheets" USING btree ("user_id","is_archived");--> statement-breakpoint
CREATE INDEX "idx_spreadsheets_tenant" ON "spreadsheets" USING btree ("tenant_id","is_archived");--> statement-breakpoint
CREATE INDEX "idx_subtasks_task" ON "subtasks" USING btree ("task_id","sort_order");--> statement-breakpoint
CREATE INDEX "idx_table_row_comments_row" ON "table_row_comments" USING btree ("spreadsheet_id","row_id");--> statement-breakpoint
CREATE INDEX "idx_task_activities_task" ON "task_activities" USING btree ("task_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_task_attachments_task" ON "task_attachments" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "idx_task_comments_task" ON "task_comments" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "idx_task_deps_task" ON "task_dependencies" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "idx_task_deps_blocker" ON "task_dependencies" USING btree ("blocked_by_task_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_task_deps_unique" ON "task_dependencies" USING btree ("task_id","blocked_by_task_id");--> statement-breakpoint
CREATE INDEX "idx_task_projects_user" ON "task_projects" USING btree ("user_id","is_archived");--> statement-breakpoint
CREATE INDEX "idx_task_templates_user" ON "task_templates" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_tasks_user_status" ON "tasks" USING btree ("user_id","status","is_archived");--> statement-breakpoint
CREATE INDEX "idx_tasks_user_when" ON "tasks" USING btree ("user_id","when","status");--> statement-breakpoint
CREATE INDEX "idx_tasks_project" ON "tasks" USING btree ("project_id","sort_order");--> statement-breakpoint
CREATE INDEX "idx_tasks_due_date" ON "tasks" USING btree ("user_id","due_date");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_tenant_apps_unique" ON "tenant_apps" USING btree ("tenant_id","app_id");--> statement-breakpoint
CREATE INDEX "idx_tenant_apps_tenant" ON "tenant_apps" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_tenant_invitations_tenant_email" ON "tenant_invitations" USING btree ("tenant_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_tenant_invitations_token" ON "tenant_invitations" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_tenant_members_unique" ON "tenant_members" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_tenants_slug" ON "tenants" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_tenants_owner" ON "tenants" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_threads_account_gmail" ON "threads" USING btree ("account_id","gmail_thread_id");--> statement-breakpoint
CREATE INDEX "idx_threads_account_category" ON "threads" USING btree ("account_id","category");--> statement-breakpoint
CREATE INDEX "idx_threads_last_message" ON "threads" USING btree ("account_id","last_message_at");--> statement-breakpoint
CREATE INDEX "idx_time_off_employee" ON "time_off_requests" USING btree ("employee_id","status");--> statement-breakpoint
CREATE INDEX "idx_time_off_status" ON "time_off_requests" USING btree ("user_id","status","is_archived");--> statement-breakpoint
CREATE INDEX "idx_time_off_approver" ON "time_off_requests" USING btree ("approver_id");--> statement-breakpoint
CREATE INDEX "idx_tracking_events_tracking_id" ON "tracking_events" USING btree ("tracking_id");--> statement-breakpoint
CREATE INDEX "idx_tracking_events_created_at" ON "tracking_events" USING btree ("created_at");