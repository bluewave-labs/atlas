import {
  pgTable, text, uuid, varchar, integer, bigint, boolean, jsonb,
  timestamp, uniqueIndex, index,
} from 'drizzle-orm/pg-core';

// ─── Tenants ─────────────────────────────────────────────────────────

export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: varchar('slug', { length: 63 }).unique().notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  plan: varchar('plan', { length: 50 }).notNull().default('starter'),
  status: varchar('status', { length: 50 }).notNull().default('active'),
  ownerId: uuid('owner_id').notNull(), // references users.id in SQLite — enforced at app level
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

// ─── Tenant Members ─────────────────────────────────────────────────

export const tenantMembers = pgTable('tenant_members', {
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull(), // references users.id in SQLite
  role: varchar('role', { length: 50 }).notNull().default('member'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  uniqueMember: uniqueIndex('idx_tenant_members_unique').on(table.tenantId, table.userId),
}));

// ─── Tenant Invitations ─────────────────────────────────────────────

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

// ─── App Catalog ─────────────────────────────────────────────────────

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

// ─── App Installations ──────────────────────────────────────────────

export const appInstallations = pgTable('app_installations', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  catalogAppId: uuid('catalog_app_id').notNull().references(() => appCatalog.id),
  installedVersion: varchar('installed_version', { length: 100 }).notNull(),
  status: varchar('status', { length: 50 }).notNull().default('installing'),
  subdomain: varchar('subdomain', { length: 63 }).notNull(),
  k8sDeploymentName: varchar('k8s_deployment_name', { length: 253 }),
  oidcClientId: varchar('oidc_client_id', { length: 255 }),
  oidcClientSecret: text('oidc_client_secret'), // AES-256-GCM encrypted
  addonRefs: jsonb('addon_refs').$type<Record<string, string>>().notNull().default({}),
  lastHealthStatus: varchar('last_health_status', { length: 50 }),
  customEnv: jsonb('custom_env').$type<Record<string, string>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('idx_installations_tenant').on(table.tenantId),
  subdomainIdx: uniqueIndex('idx_installations_subdomain').on(table.tenantId, table.subdomain),
}));

// ─── App Addons ─────────────────────────────────────────────────────

export const appAddons = pgTable('app_addons', {
  id: uuid('id').primaryKey().defaultRandom(),
  installationId: uuid('installation_id').notNull().references(() => appInstallations.id, { onDelete: 'cascade' }),
  addonType: varchar('addon_type', { length: 50 }).notNull(),
  host: varchar('host', { length: 255 }).notNull(),
  port: integer('port').notNull(),
  database: varchar('database', { length: 255 }),
  username: varchar('username', { length: 255 }),
  passwordEncrypted: text('password_encrypted'), // AES-256-GCM
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  installationIdx: index('idx_addons_installation').on(table.installationId),
}));

// ─── App User Assignments ──────────────────────────────────────────

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

// ─── App Backups ────────────────────────────────────────────────────

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
