// ─── App Registry Types ─────────────────────────────────────────────

/** Unique string identifier for each app */
export type AppId = string;

/** Minimum tenant plan required to use an app */
export type AppMinPlan = 'starter' | 'pro' | 'enterprise';

/** App category for grouping */
export type AppCategory = 'productivity' | 'communication' | 'data' | 'storage' | 'other';

// ─── Entity / Data Model Types ────────────────────────────────────────

export interface EntityFieldMeta {
  /** Display name, e.g. "Email address" */
  name: string;
  /** DB column slug, e.g. "email" */
  slug: string;
  /** Field type: text, number, date, boolean, select, relation, url, email, phone, json, multi_select */
  fieldType: string;
  /** Whether the field is required */
  isRequired: boolean;
  /** Optional description */
  description?: string;
}

export interface EntityRelationMeta {
  /** Target in "appId:objectId" format, e.g. "crm:contacts" */
  targetObjectId: string;
  /** Relationship type */
  type: 'one-to-many' | 'many-to-one' | 'many-to-many';
  /** Foreign key column name */
  foreignKey?: string;
}

export interface EntityObjectMeta {
  /** Unique within app, e.g. "companies" */
  id: string;
  /** Display name, e.g. "Companies" */
  name: string;
  /** Lucide icon name */
  iconName: string;
  /** Database table name */
  tableName: string;
  /** Optional description */
  description?: string;
  /** Standard (built-in) fields */
  standardFields: EntityFieldMeta[];
  /** Relationships to other objects */
  relations?: EntityRelationMeta[];
}

// ─── Widget Metadata ───────────────────────────────────────────────

export interface AppWidgetMeta {
  /** Unique widget identifier within the app, e.g. 'cpu-usage' */
  id: string;
  /** Human-readable name */
  name: string;
  /** Short description of what this widget shows */
  description: string;
  /** Lucide icon name (string) for server-safe reference */
  iconName: string;
  /** Default grid size: sm=1col, md=2col, lg=full-row */
  defaultSize: 'sm' | 'md' | 'lg';
  /** Auto-refresh interval in ms (optional) */
  refreshInterval?: number;
  /** Whether the widget is enabled by default for new users */
  defaultEnabled: boolean;
}

/**
 * Shared (isomorphic) portion of the app manifest.
 * No React components, no Express routers — safe for both client and server.
 * Client and server extend this with environment-specific fields.
 */
export interface AppManifestBase {
  /** Unique app identifier, e.g. 'docs', 'crm'. Used as route prefix and DB key. */
  id: AppId;

  /** Human-readable name */
  name: string;

  /** i18n key for the sidebar label */
  labelKey: string;

  /** Lucide icon name (string) for server-safe reference */
  iconName: string;

  /** Brand color hex */
  color: string;

  /** Minimum tenant plan required */
  minPlan: AppMinPlan;

  /** App category for grouping in admin UI */
  category: AppCategory;

  /** IDs of other apps this one depends on */
  dependencies: AppId[];

  /** Whether this app is enabled by default for new tenants */
  defaultEnabled: boolean;

  /** Version string */
  version: string;

  /** Entity/object metadata for the data model settings panel */
  objects?: EntityObjectMeta[];

  /** Widget definitions this app contributes */
  widgets?: AppWidgetMeta[];
}

// ─── Cross-App Record Linking ───────────────────────────────────────

export interface RecordLink {
  id: string;
  sourceAppId: string;
  sourceRecordId: string;
  targetAppId: string;
  targetRecordId: string;
  linkType: string;
  metadata: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
}

export interface LinkCount {
  appId: string;
  count: number;
}

export interface LinkedRecord {
  linkId: string;
  appId: string;
  recordId: string;
  title: string;
  linkType: string;
  createdAt: string;
}

export interface GlobalSearchResult {
  appId: string;
  recordId: string;
  title: string;
  appName: string;
}

// ─── Tenant App Access ──────────────────────────────────────────────

export interface TenantApp {
  id: string;
  tenantId: string;
  appId: string;
  isEnabled: boolean;
  enabledAt: string;
  enabledBy: string;
  config: Record<string, unknown>;
}
