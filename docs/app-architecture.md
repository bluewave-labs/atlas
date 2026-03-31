# Atlas app architecture

This document describes how Atlas apps are structured, how they register via manifests, and provides a reference for each of the 10 built-in apps.

---

## App registry pattern

Atlas uses a manifest-driven architecture. Each app declares its capabilities via two manifest files: one for the client (React) and one for the server (Express). A central registry on each side collects all manifests and exposes them to the framework.

### Shared base manifest (`AppManifestBase`)

Defined in `packages/shared/src/types/app-manifest.ts`. Every manifest (client and server) extends this base:

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique app identifier (e.g. `crm`, `docs`) |
| `name` | `string` | Human-readable display name |
| `labelKey` | `string` | i18n key for the sidebar label |
| `iconName` | `string` | Lucide icon name (string, server-safe) |
| `color` | `string` | Brand color hex |
| `minPlan` | `'starter' \| 'pro' \| 'enterprise'` | Minimum tenant plan required |
| `category` | `'productivity' \| 'communication' \| 'data' \| 'storage' \| 'other'` | App category for grouping |
| `dependencies` | `string[]` | IDs of other apps this one depends on |
| `defaultEnabled` | `boolean` | Whether enabled by default for new tenants |
| `version` | `string` | Semantic version |
| `objects` | `EntityObjectMeta[]` | Entity/data model metadata |
| `widgets` | `AppWidgetMeta[]` | Widget definitions |

### Client manifest (`ClientAppManifest`)

Defined in `packages/client/src/config/app-manifest.client.ts`. Extends `AppManifestBase` with:

| Field | Type | Description |
|-------|------|-------------|
| `icon` | `LucideIcon` | Lucide icon component for rendering |
| `routes` | `AppRoute[]` | Client routes (path + React component) |
| `settingsCategory` | `SettingsCategory` | Settings panels this app contributes |
| `sidebarOrder` | `number` | Sidebar sort order (lower = higher) |
| `widgets` | `ClientAppWidget[]` | Widget React components |

### Server manifest (`ServerAppManifest`)

Defined in `packages/server/src/config/app-manifest.server.ts`. Extends `AppManifestBase` with:

| Field | Type | Description |
|-------|------|-------------|
| `router` | `Router` | Express router for API routes |
| `routePrefix` | `string` | API route prefix (e.g. `/crm`) |
| `tables` | `string[]` | Database table names this app owns |

### Client registry

Located at `packages/client/src/config/app-registry.ts`. The `AppRegistry` class provides:

- `register(manifest)` -- adds an app
- `getAll()` -- returns all apps sorted by `sidebarOrder`
- `getEnabled(enabledAppIds)` -- filters to tenant-enabled apps
- `getRoutes()` -- flattens all app routes for React Router
- `getNavItems()` -- returns sidebar navigation items
- `getSettingsCategories()` -- collects settings panels
- `getAllWidgets()` -- collects dashboard widgets from all apps
- `getAppWidgets(appId)` -- returns widgets for a specific app

All apps are registered in `packages/client/src/apps/index.ts`:

```typescript
import { appRegistry } from '../config/app-registry';
import { crmManifest } from './crm/manifest';
appRegistry.register(crmManifest);
// ... repeat for each app
```

### Server registry

All apps are registered in `packages/server/src/apps/index.ts`:

```typescript
import { serverAppRegistry } from '../config/app-registry.server';
import { crmServerManifest } from './crm/manifest';
serverAppRegistry.register(crmServerManifest);
// ... repeat for each app
```

The server mounts each app's Express router at `/api/apps{routePrefix}`.

---

## Adding a new app -- step-by-step checklist

### 1. Shared types

- Create `packages/shared/src/types/{name}.ts` with TypeScript interfaces
- Export from `packages/shared/src/types/index.ts`

### 2. Database

- Add tables to `packages/server/src/db/schema.ts`
- Add `CREATE TABLE IF NOT EXISTS` to `packages/server/src/db/migrate.ts`
- Include standard columns: `id` (uuid), `accountId`, `userId`, `isArchived`, `sortOrder`, `createdAt`, `updatedAt`

### 3. Server app

Create `packages/server/src/apps/{name}/`:

| File | Purpose |
|------|---------|
| `service.ts` | CRUD functions (import db, schema, drizzle-orm) |
| `controller.ts` | Express handlers (extract auth from `req.auth!`) |
| `routes.ts` | Express router (import `authMiddleware`) |
| `manifest.ts` | `ServerAppManifest` with router, routePrefix, tables, objects |

Register in `packages/server/src/apps/index.ts`:
```typescript
import { myServerManifest } from './{name}/manifest';
serverAppRegistry.register(myServerManifest);
```

### 4. Client app

Create `packages/client/src/apps/{name}/`:

| File | Purpose |
|------|---------|
| `manifest.ts` | `ClientAppManifest` with routes, icon, settings, widgets |
| `page.tsx` | Main page component (uses `AppSidebar`) |
| `hooks.ts` | React Query hooks |
| `settings-store.ts` | App settings (Zustand + server persistence) |
| `components/` | App-specific components |

Register in `packages/client/src/apps/index.ts`:
```typescript
import { myManifest } from './{name}/manifest';
appRegistry.register(myManifest);
```

### 5. Query keys

Add namespace to `packages/client/src/config/query-keys.ts`.

### 6. Translations

Add keys to all 5 locale files (`en.json`, `de.json`, `fr.json`, `it.json`, `tr.json`) in `packages/client/src/i18n/locales/`.

### 7. Global search (optional)

Add to `packages/server/src/services/global-search.service.ts` UNION ALL query.

Sidebar, routes, settings panels, and widgets register automatically from the manifest.

---

## App reference

### CRM

| Property | Value |
|----------|-------|
| **App ID** | `crm` |
| **Display name** | CRM |
| **Icon** | Briefcase |
| **Color** | `#f97316` (orange) |
| **Category** | data |
| **Sidebar order** | 10 |

**Purpose:** Customer relationship management with pipeline-based deal tracking, contact and company management, activity logging, and lead qualification.

**Client routes:**
| Route | Component |
|-------|-----------|
| `/crm` | `CrmPage` |

**Server API prefix:** `/crm`

**Database tables:**
- `crm_companies` -- organizations and businesses
- `crm_contacts` -- individual people associated with companies
- `crm_deal_stages` -- pipeline stages for tracking deal progress
- `crm_deals` -- sales opportunities and revenue tracking
- `crm_activities` -- logged interactions (calls, emails, meetings)
- `crm_permissions` -- CRM-specific access control

**Entity objects:**
- Companies (with relations to contacts, deals, activities)
- Contacts (with relations to companies, deals)
- Deal stages
- Deals (with relations to stages, contacts, companies)
- Activities (with relations to deals, contacts, companies)
- Leads

**Settings panels:**
| Panel ID | Label | Icon |
|----------|-------|------|
| `stages` | Pipeline stages | Settings |
| `general` | General | Settings |
| `integrations` | Integrations | Settings |

**Widgets:**
| Widget ID | Name | Size | Description |
|-----------|------|------|-------------|
| `pipeline` | Pipeline | sm | CRM pipeline value and deal count |

**Key components:** `CrmStagesPanel`, `CrmGeneralPanel`, `CrmIntegrationsPanel`, `PipelineWidget`

---

### HR (HRM)

| Property | Value |
|----------|-------|
| **App ID** | `hr` |
| **Display name** | HR |
| **Icon** | Users |
| **Color** | `#10b981` (emerald) |
| **Category** | productivity |
| **Sidebar order** | 20 |

**Purpose:** Human resource management with employee records, department structure, leave management, onboarding workflows, attendance tracking, and employee document storage.

**Client routes:**
| Route | Component |
|-------|-----------|
| `/hr` | `HrPage` |

**Server API prefix:** `/hr`

**Database tables:**
- `employees` -- staff records
- `departments` -- organizational units
- `time_off_requests` -- leave requests
- `leave_balances` -- leave allocation and usage
- `onboarding_tasks` -- new hire checklist items
- `onboarding_templates` -- reusable onboarding templates
- `employee_documents` -- employee-related files
- `hr_leave_types` -- leave type definitions
- `hr_leave_policies` -- leave policy rules
- `hr_leave_policy_assignments` -- policy-to-employee mappings
- `hr_holiday_calendars` -- public holiday calendars
- `hr_holidays` -- individual holidays
- `hr_leave_applications` -- leave applications
- `hr_attendance` -- attendance records
- `hr_lifecycle_events` -- employee lifecycle tracking

**Entity objects:**
- Employees (with relation to departments)
- Departments (with relation to employees)
- Leave balances (with relation to employees)
- Onboarding tasks (with relation to employees)
- Employee documents (with relation to employees)

**Settings panels:**
| Panel ID | Label | Icon |
|----------|-------|------|
| `general` | General | Settings |
| `appearance` | Appearance | Eye |

**Widgets:**
| Widget ID | Name | Size | Description |
|-----------|------|------|-------------|
| `team` | Team | sm | Employee headcount and department overview |

**Key components:** `HrGeneralPanel`, `HrAppearancePanel`, `TeamWidget`

---

### Projects

| Property | Value |
|----------|-------|
| **App ID** | `projects` |
| **Display name** | Projects |
| **Icon** | FolderKanban |
| **Color** | `#0ea5e9` (sky blue) |
| **Category** | data (server) / productivity (client) |
| **Sidebar order** | 25 |

**Purpose:** Project management with client billing, time tracking, invoicing, and team member assignment. Supports billable and non-billable projects with hourly rate management.

**Client routes:**
| Route | Component |
|-------|-----------|
| `/projects` | `ProjectsPage` |

**Server API prefix:** `/projects`

**Database tables:**
- `project_clients` -- client organizations
- `project_projects` -- projects with billing configuration
- `project_members` -- team members assigned to projects
- `project_time_entries` -- tracked time entries
- `project_invoices` -- client invoices
- `project_invoice_line_items` -- invoice line items
- `project_settings` -- organization-level project settings

**Entity objects:**
- Clients (with relations to projects, invoices)
- Projects (with relations to clients, time entries, members)
- Project members (with relation to projects)
- Time entries (with relation to projects)
- Invoices (with relations to clients, line items)
- Invoice line items (with relations to invoices, time entries)
- Project settings

**Settings panels:** None

**Widgets:** None

---

### Sign

| Property | Value |
|----------|-------|
| **App ID** | `sign` |
| **Display name** | Sign |
| **Icon** | PenTool |
| **Color** | `#8b5cf6` (violet) |
| **Category** | productivity |
| **Sidebar order** | 30 |

**Purpose:** Electronic signature workflows. Upload PDF documents, place signature fields, send to signers via email with unique tokens, and track completion status.

**Client routes:**
| Route | Component |
|-------|-----------|
| `/sign-app` | `SignPage` |

**Server API prefix:** `/sign`

**Database tables:**
- `signature_documents` -- documents sent for signature
- `signature_fields` -- placed signature/form fields on documents
- `signing_tokens` -- access tokens for document signers

**Entity objects:**
- Signature documents (with relations to fields, tokens)
- Signature fields (with relation to documents)
- Signing tokens (with relation to documents)

**Settings panels:** None

**Widgets:** None

---

### Drive

| Property | Value |
|----------|-------|
| **App ID** | `drive` |
| **Display name** | Drive |
| **Icon** | HardDrive |
| **Color** | `#64748b` (slate) |
| **Category** | storage |
| **Sidebar order** | 40 |

**Purpose:** File storage and management with folder hierarchy, file versioning, share links, and favourites.

**Client routes:**
| Route | Component |
|-------|-----------|
| `/drive` | `DrivePage` |
| `/drive/folder/:id` | `DrivePage` |

**Server API prefix:** `/drive`

**Database tables:**
- `drive_items` -- files and folders
- `drive_versions` -- file version history
- `drive_share_links` -- public share links

**Entity objects:**
- Drive items (files and folders with parent/child hierarchy)

**Settings panels:**
| Panel ID | Label | Icon |
|----------|-------|------|
| `general` | General | Settings |
| `display` | Display | Eye |
| `files` | Files | File |

---

### Tables

| Property | Value |
|----------|-------|
| **App ID** | `tables` |
| **Display name** | Tables |
| **Icon** | Table2 |
| **Color** | `#2d8a6e` (teal) |
| **Category** | data |
| **Sidebar order** | 50 |

**Purpose:** Airtable-style databases with custom columns, rows, view configurations, and color/icon customization. Each spreadsheet stores its schema (columns) and data (rows) as JSON.

**Client routes:**
| Route | Component |
|-------|-----------|
| `/tables` | `TablesPage` |
| `/tables/:id` | `TablesPage` |

**Server API prefix:** `/tables`

**Database tables:**
- `spreadsheets` -- the spreadsheet itself (title, columns JSON, rows JSON, view config)
- `spreadsheet_columns` -- column definitions
- `spreadsheet_rows` -- row data

**Entity objects:**
- Spreadsheets

**Settings panels:**
| Panel ID | Label | Icon |
|----------|-------|------|
| `general` | General | Settings |
| `regional` | Regional | Languages |

---

### Tasks

| Property | Value |
|----------|-------|
| **App ID** | `tasks` |
| **Display name** | Tasks |
| **Icon** | CheckSquare |
| **Color** | `#6366f1` (indigo) |
| **Category** | productivity |
| **Sidebar order** | 60 |

**Purpose:** Task management with priority levels, due dates, project grouping, "when" scheduling (today/next/someday), status tracking, and an activity audit log.

**Client routes:**
| Route | Component |
|-------|-----------|
| `/tasks` | `TasksPage` |

**Server API prefix:** `/tasks`

**Database tables:**
- `tasks` -- action items with priority, due dates, project grouping
- `task_activities` -- audit log of changes to tasks
- `task_projects` -- groups of related tasks

**Entity objects:**
- Tasks (with relation to projects)
- Projects (with relation to tasks)
- Task activities (with relation to tasks)

**Settings panels:**
| Panel ID | Label | Icon |
|----------|-------|------|
| `general` | General | Settings |
| `appearance` | Appearance | Eye |
| `behavior` | Behavior | Zap |

**Widgets:**
| Widget ID | Name | Size | Description |
|-----------|------|------|-------------|
| `tasks-summary` | Tasks | sm | Tasks due today and overdue count |

**Key components:** `TasksGeneralPanel`, `TasksAppearancePanel`, `TasksBehaviorPanel`, `TasksWidget`

---

### Write (Docs)

| Property | Value |
|----------|-------|
| **App ID** | `docs` |
| **Display name** | Write |
| **Icon** | FileText |
| **Color** | `#c4856c` (copper) |
| **Category** | productivity |
| **Sidebar order** | 70 |

**Purpose:** Rich-text document editor with nested page hierarchy, version history, inline comments with threading, and bidirectional document linking.

**Client routes:**
| Route | Component |
|-------|-----------|
| `/docs` | `DocsPage` |
| `/docs/:id` | `DocsPage` |

**Server API prefix:** `/docs`

**Database tables:**
- `documents` -- rich-text pages with nested hierarchy
- `document_versions` -- point-in-time content snapshots
- `document_comments` -- inline comments and discussion threads
- `document_links` -- bidirectional links between documents

**Entity objects:**
- Documents (with relations to versions, comments)
- Document versions (with relation to documents)
- Document comments (with relation to documents)
- Document links (with relations to source/target documents)

**Settings panels:**
| Panel ID | Label | Icon |
|----------|-------|------|
| `editor` | Editor | Type |
| `startup` | Startup | Rocket |

---

### Draw

| Property | Value |
|----------|-------|
| **App ID** | `draw` |
| **Display name** | Draw |
| **Icon** | Pencil |
| **Color** | `#e06c9f` (pink) |
| **Category** | productivity |
| **Sidebar order** | 80 |

**Purpose:** Excalidraw-based diagram and sketch editor with per-drawing persistence and thumbnail generation.

**Client routes:**
| Route | Component |
|-------|-----------|
| `/draw` | `DrawPage` |
| `/draw/:id` | `DrawPage` |

**Server API prefix:** `/drawings`

**Database tables:**
- `drawings` -- Excalidraw-based diagrams and sketches (content stored as JSON)

**Entity objects:**
- Drawings

**Settings panels:**
| Panel ID | Label | Icon |
|----------|-------|------|
| `canvas` | Canvas | Palette |
| `export` | Export | Download |

---

### System

| Property | Value |
|----------|-------|
| **App ID** | `system` |
| **Display name** | System |
| **Icon** | Monitor |
| **Color** | `#6b7280` (gray) |
| **Category** | other |
| **Sidebar order** | 90 |

**Purpose:** System monitoring dashboard showing live CPU and memory utilization metrics. Also manages system-level settings.

**Client routes:**
| Route | Component |
|-------|-----------|
| `/system` | `SystemPage` |

**Server API prefix:** `/system`

**Database tables:**
- `system_settings`

**Entity objects:** None

**Settings panels:** None

**Widgets:**
| Widget ID | Name | Size | Refresh | Description |
|-----------|------|------|---------|-------------|
| `cpu-usage` | CPU usage | sm | 10s | Live CPU utilization gauge |
| `memory-usage` | Memory usage | sm | 10s | Live memory utilization bar |

**Key components:** `CpuWidget`, `MemoryWidget`

---

## Summary table

| App | ID | Color | Icon | Order | Route prefix | API prefix | Settings | Widgets |
|-----|----|-------|------|-------|-------------|------------|----------|---------|
| CRM | `crm` | `#f97316` | Briefcase | 10 | `/crm` | `/crm` | 3 panels | Pipeline |
| HR | `hr` | `#10b981` | Users | 20 | `/hr` | `/hr` | 2 panels | Team |
| Projects | `projects` | `#0ea5e9` | FolderKanban | 25 | `/projects` | `/projects` | -- | -- |
| Sign | `sign` | `#8b5cf6` | PenTool | 30 | `/sign-app` | `/sign` | -- | -- |
| Drive | `drive` | `#64748b` | HardDrive | 40 | `/drive` | `/drive` | 3 panels | -- |
| Tables | `tables` | `#2d8a6e` | Table2 | 50 | `/tables` | `/tables` | 2 panels | -- |
| Tasks | `tasks` | `#6366f1` | CheckSquare | 60 | `/tasks` | `/tasks` | 3 panels | Tasks |
| Write | `docs` | `#c4856c` | FileText | 70 | `/docs` | `/docs` | 2 panels | -- |
| Draw | `draw` | `#e06c9f` | Pencil | 80 | `/draw` | `/drawings` | 2 panels | -- |
| System | `system` | `#6b7280` | Monitor | 90 | `/system` | `/system` | -- | CPU, Memory |

---

## Key file paths

| Purpose | Path |
|---------|------|
| Shared manifest types | `packages/shared/src/types/app-manifest.ts` |
| Client manifest type | `packages/client/src/config/app-manifest.client.ts` |
| Server manifest type | `packages/server/src/config/app-manifest.server.ts` |
| Client app registry | `packages/client/src/config/app-registry.ts` |
| Client app registrations | `packages/client/src/apps/index.ts` |
| Server app registrations | `packages/server/src/apps/index.ts` |
| Settings registry | `packages/client/src/config/settings-registry.ts` |
| Query keys | `packages/client/src/config/query-keys.ts` |
| DB schema | `packages/server/src/db/schema.ts` |
| DB migrations | `packages/server/src/db/migrate.ts` |
