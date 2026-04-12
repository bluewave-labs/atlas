-- Tables app schema (deprecated in v1.10.0)
-- Preserved for reference. Run these DROP statements to clean up the database.

-- Drop tables (order matters due to FK)
DROP TABLE IF EXISTS table_row_comments CASCADE;
DROP TABLE IF EXISTS spreadsheets CASCADE;

-- Drop indexes (cascade above handles these, but listed for completeness)
-- idx_table_row_comments_row
-- idx_spreadsheets_user
-- idx_spreadsheets_tenant

-- Remove tables-related columns from user_settings
-- ALTER TABLE user_settings DROP COLUMN IF EXISTS tables_default_view;
-- ALTER TABLE user_settings DROP COLUMN IF EXISTS tables_default_sort;
-- ALTER TABLE user_settings DROP COLUMN IF EXISTS tables_show_field_type_icons;
-- ALTER TABLE user_settings DROP COLUMN IF EXISTS tables_default_row_count;
-- ALTER TABLE user_settings DROP COLUMN IF EXISTS tables_include_row_ids_in_export;

-- Original Drizzle schema for reference:
--
-- spreadsheets: id, tenant_id, user_id, title, columns (jsonb), rows (jsonb),
--   view_config (jsonb), sort_order, is_archived, color, icon, guide,
--   created_at, updated_at
--
-- table_row_comments: id, spreadsheet_id (FK→spreadsheets), row_id, tenant_id,
--   user_id, body, created_at, updated_at
