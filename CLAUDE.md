# Atlas — Project Documentation

## Overview

Atlas is an all-in-one business platform with modular app architecture. Each app is self-contained in its own directory and registers via manifests.

**Stack:** React + TypeScript + Vite (client), Express + PostgreSQL + Drizzle ORM (server), shared types package.

**Product name:** Atlas (NOT AtlasMail). No email functionality exists.

---

## Documentation Index

Detailed documentation lives in `/docs/`. Read the relevant doc before building or modifying a feature.

| Document | What it covers | When to read |
|----------|---------------|--------------|
| [API Reference](docs/api-reference.md) | Every API endpoint — method, path, auth, request/response shapes | Building client hooks, testing endpoints, debugging API calls |
| [Database Schema](docs/database-schema.md) | All tables, columns, types, constraints, FK relationships, indexes | Adding tables, writing migrations, building queries |
| [App Architecture](docs/app-architecture.md) | App registry pattern, per-app features/routes/tables, adding new apps | Building a new app, understanding how apps register |
| [Design System](docs/design-system.md) | CSS variables, component library (31 components), layout patterns, i18n | Building UI, creating components, styling, translations |
| [Infrastructure](docs/infrastructure.md) | Docker, deployment, CI/CD, CLI, env vars, SSL, backups, monitoring | Deploying, configuring, troubleshooting production |

---

## Monorepo Structure

```
packages/
  client/     — React frontend (port 5180)
  server/     — Express API (port 3001)
  shared/     — Shared TypeScript types
  desktop/    — Electron wrapper (not actively used)
```

---

## App Architecture

Every app follows the same self-contained structure:

### Client (`packages/client/src/apps/{name}/`)
```
manifest.ts          — App metadata, routes, settings panels, sidebar config
page.tsx             — Main page component
components/          — App-specific components
hooks.ts             — Data fetching hooks (React Query)
settings-store.ts    — App settings (Zustand + server persistence)
```

### Server (`packages/server/src/apps/{name}/`)
```
manifest.ts          — App metadata, Express router, table list
routes.ts            — Express route definitions
controller.ts        — Request handlers
service.ts           — Business logic + database queries
```

### Current Apps

| App | ID | Color | Icon | Sidebar Order | Route |
|-----|----|-------|------|---------------|-------|
| CRM | crm | #f97316 | Briefcase | 10 | /crm |
| HRM | hr | #10b981 | Users | 20 | /hr |
| Projects | projects | #0ea5e9 | FolderKanban | 25 | /projects |
| Sign | sign | #8b5cf6 | PenTool | 30 | /sign-app |
| Drive | drive | #64748b | HardDrive | 40 | /drive, /drive/folder/:id |
| Tables | tables | #2d8a6e | Table2 | 50 | /tables, /tables/:id |
| Tasks | tasks | #6366f1 | CheckSquare | 60 | /tasks |
| Write | docs | #c4856c | FileText | 70 | /docs, /docs/:id |
| Draw | draw | #e06c9f | Pencil | 80 | /draw, /draw/:id |
| System | system | #6b7280 | Monitor | 90 | /system |

---

## Adding a New App

### 1. Shared types
Create `packages/shared/src/types/{name}.ts` with interfaces.
Add `export * from './{name}'` to `packages/shared/src/types/index.ts`.

### 2. Database
Add tables to `packages/server/src/db/schema.ts`.
Add `CREATE TABLE IF NOT EXISTS` to `packages/server/src/db/migrate.ts`.

### 3. Server app
Create directory `packages/server/src/apps/{name}/` with:
- `service.ts` — CRUD functions (import db, schema, drizzle-orm)
- `controller.ts` — Express handlers (extract auth from `req.auth!`)
- `routes.ts` — Express router (import authMiddleware)
- `manifest.ts` — ServerAppManifest

Register in `packages/server/src/apps/index.ts`:
```typescript
import { myServerManifest } from './{name}/manifest';
serverAppRegistry.register(myServerManifest);
```

### 4. Client app
Create directory `packages/client/src/apps/{name}/` with:
- `hooks.ts` — React Query hooks
- `page.tsx` — Page component using AppSidebar
- `components/` — App-specific components
- `settings-store.ts` — Settings
- `manifest.ts` — ClientAppManifest

Register in `packages/client/src/apps/index.ts`:
```typescript
import { myManifest } from './{name}/manifest';
appRegistry.register(myManifest);
```

### 5. Global search (optional)
Add to `packages/server/src/services/global-search.service.ts` UNION ALL query.

### 6. Query keys
Add namespace to `packages/client/src/config/query-keys.ts`.

That's it — sidebar, routes, settings panels register automatically from the manifest.

---

## Database Patterns

### Common columns (every record table)
```typescript
id: uuid('id').primaryKey().defaultRandom(),
accountId: uuid('account_id').notNull(),
userId: uuid('user_id').notNull(),
isArchived: boolean('is_archived').notNull().default(false),
sortOrder: integer('sort_order').notNull().default(0),
createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
```

### Table naming
- Flat names, plural: `documents`, `tasks`, `spreadsheets`, `drive_items`
- Join tables: `tenant_members`, `tenant_apps`
- No app prefix needed

### Schema file
All tables in `packages/server/src/db/schema.ts`. Sections:
- Users & Accounts (users, accounts, userSettings, passwordResetTokens)
- Platform (tenants, tenantMembers, tenantInvitations, tenantApps)
- Custom Fields (customFieldDefinitions)
- Record Links (recordLinks)
- App tables (documents, drawings, tasks, spreadsheets, driveItems, etc.)

### Migrations
In `packages/server/src/db/migrate.ts`. Uses `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE ADD COLUMN IF NOT EXISTS` for idempotency.

---

## Authentication

### JWT structure (`req.auth`)
```typescript
interface AuthPayload {
  userId: string;
  accountId: string;
  email: string;
  tenantId?: string;
  isSuperAdmin?: boolean;
}
```

### Middleware
- `authMiddleware` — JWT verification, sets `req.auth`
- `adminAuthMiddleware` — Requires `isSuperAdmin: true`
- `requireApp(appId)` — Checks tenant has app enabled

### Secrets (env vars)
- `JWT_SECRET` — Access token signing (1h expiry)
- `JWT_REFRESH_SECRET` — Refresh token signing (30d expiry)
- `TOKEN_ENCRYPTION_KEY` — 64-char hex for AES-256 encryption

---

## UI Components

All in `packages/client/src/components/ui/`. **Always use these instead of raw HTML elements.**

### Form elements
| Component | Props | Use for |
|-----------|-------|---------|
| `Button` | variant: primary/secondary/ghost/danger, size: sm/md/lg | All buttons |
| `Input` | label?, error?, size: sm/md/lg, iconLeft? | Text inputs |
| `Textarea` | label?, error? | Multi-line text |
| `Select` | value, onChange, options, size?, width? | Dropdowns |
| `IconButton` | icon, label, size, tooltip?, destructive? | Icon-only buttons |

### Size alignment
Input and Button sizes match: sm=28px, md=34px, lg=40px. **Always use the same size when placing them side-by-side.**

### Feedback
| Component | Use for |
|-----------|---------|
| `Badge` | Status labels (variant: default/primary/success/warning/error) |
| `Chip` | Removable tags with color |
| `Skeleton` | Loading placeholders |
| `Toast` | Notifications (via useToastStore) |
| `Tooltip` | Hover help text |

### Layout
| Component | Use for |
|-----------|---------|
| `Modal` | Dialogs (compound: Modal, Modal.Header, Modal.Body, Modal.Footer) |
| `Popover` | Radix popover (Popover, PopoverTrigger, PopoverContent) |
| `ContextMenu` | Right-click menus |
| `ConfirmDialog` | Destructive action confirmation |
| `ScrollArea` | Custom scrollbars |
| `AppSidebar` | App sidebar shell (resizable, persistent width) |
| `SidebarItem` | Nav items inside AppSidebar |
| `SidebarSection` | Grouped sections inside AppSidebar |
| `SmartButtonBar` | Cross-app link badges (appId + recordId) |

### Other
| Component | Use for |
|-----------|---------|
| `Avatar` | User profile pictures with fallback |
| `Kbd` | Keyboard shortcut display |
| `EmptyState` | Full-page empty states |

---

## Design Tokens (CSS Variables)

### Colors
```css
--color-bg-primary          /* Main background (white/dark) */
--color-bg-secondary        /* Secondary background */
--color-bg-tertiary         /* Tertiary/input background */
--color-bg-elevated         /* Elevated surfaces (modals) */
--color-text-primary        /* Primary text */
--color-text-secondary      /* Secondary text */
--color-text-tertiary       /* Muted text */
--color-border-primary      /* Primary borders */
--color-border-secondary    /* Subtle borders */
--color-accent-primary      /* Brand accent (#13715B) */
--color-surface-hover       /* Hover state */
--color-surface-selected    /* Selected/active state */
--color-success             /* Success green */
--color-warning             /* Warning amber */
--color-error               /* Error red */
```

### Spacing
```css
--spacing-xs: 4px
--spacing-sm: 8px
--spacing-md: 12px
--spacing-lg: 16px
--spacing-xl: 20px
--spacing-2xl: 24px
```

### Typography
```css
--font-family               /* System font stack */
--font-size-xs: 11px
--font-size-sm: 13px
--font-size-md: 14px
--font-size-lg: 16px
--font-size-xl: 18px
--font-size-2xl: 24px
--font-weight-normal: 400
--font-weight-medium: 500
--font-weight-semibold: 600
--font-weight-bold: 700
```

### Border radius
```css
--radius-sm: 4px
--radius-md: 6px
--radius-lg: 8px
--radius-xl: 12px
```

### Shadows
```css
--shadow-sm
--shadow-md
--shadow-lg
--shadow-elevated
```

---

## Coding Rules

## Translation / i18n

Atlas uses `react-i18next` for internationalization. 5 languages: EN, TR, DE, FR, IT.

### Translation files
`packages/client/src/i18n/locales/{en,tr,de,fr,it}.json`

### Adding translations for a new app
1. Add a new section to ALL 5 locale files: `"appName": { "key": "value" }`
2. Import `useTranslation` in components: `import { useTranslation } from 'react-i18next'`
3. Use `const { t } = useTranslation()` in each component
4. Replace hardcoded strings with `t('appName.key')`
5. For interpolation: `t('key', { count: 5 })` → `"{{count}} items"`

### Rules
- Every git tag MUST have a corresponding GitHub Release with release notes. They must always be in sync.
- When tagging and making a release, always update the version number in Settings > About Atlas (next to "Current application version").
- Every user-visible string MUST use `t()` — no hardcoded English text
- Sidebar labels, view titles, button labels, form labels, empty states, error messages
- Keys are namespaced by app: `crm.sidebar.dashboard`, `sign.actions.upload`
- Add keys to ALL 5 locale files in the same commit
- **Every feature with a UI MUST include translations for all 5 languages (EN, TR, DE, FR, IT).** Do not merge or consider a feature complete if any locale file is missing the new keys. Add translations as part of the feature implementation, not as a follow-up task.

---

### Never do
- Use hardcoded hex colors — use CSS variables
- Use raw `<button>`, `<input>`, `<select>`, `<textarea>` — use shared components
- Use localStorage for settings — use server API + React Query
- Create files outside the app directory — keep apps self-contained
- Import from one app into another — use cross-app linking (record_links) instead
- Use `window.confirm()` or `window.alert()` — always use the `<ConfirmDialog>` component from `components/ui/confirm-dialog.tsx` for destructive action confirmations. It provides a proper modal with title, description, and styled confirm/cancel buttons.

### Always do
- Use `req.auth!.userId` and `req.auth!.accountId` for data scoping
- Add `isArchived` for soft deletes (never hard delete user data)
- Use `uuid` primary keys with `defaultRandom()`
- Use CSS variables for all colors, spacing, radius, font sizes
- Use `Button`/`Input` size prop to match heights when side-by-side
- Add new tables to both schema.ts AND migrate.ts
- Register new apps in both client and server `apps/index.ts`

### Server pattern
```typescript
// Service function
export async function listItems(userId: string, accountId: string) {
  return db.select().from(items)
    .where(and(eq(items.accountId, accountId), eq(items.isArchived, false)))
    .orderBy(items.sortOrder);
}

// Controller handler
export async function listItems(req: Request, res: Response) {
  try {
    const data = await itemService.listItems(req.auth!.userId, req.auth!.accountId);
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to list items');
    res.status(500).json({ success: false, error: 'Failed to list items' });
  }
}
```

### Client hook pattern
```typescript
export function useItemList() {
  return useQuery({
    queryKey: queryKeys.myApp.list,
    queryFn: async () => {
      const { data } = await api.get('/myapp');
      return data.data as MyItem[];
    },
    staleTime: 10_000,
  });
}
```

### Client page pattern
```tsx
export function MyAppPage() {
  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <AppSidebar storageKey="atlas_myapp_sidebar" title="My App">
        <SidebarSection>
          <SidebarItem label="All items" icon={<List size={15} />} isActive />
        </SidebarSection>
      </AppSidebar>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {/* Main content */}
      </div>
    </div>
  );
}
```

---

## Key File Paths

| Purpose | Path |
|---------|------|
| Client app registry | `packages/client/src/apps/index.ts` |
| Server app registry | `packages/server/src/apps/index.ts` |
| Route constants | `packages/client/src/config/routes.ts` |
| Query keys | `packages/client/src/config/query-keys.ts` |
| Settings registry | `packages/client/src/config/settings-registry.ts` |
| DB schema | `packages/server/src/db/schema.ts` |
| DB migrations | `packages/server/src/db/migrate.ts` |
| Auth middleware | `packages/server/src/middleware/auth.ts` |
| Theme/tokens | `packages/client/src/styles/theme.css` |
| Shared types | `packages/shared/src/types/index.ts` |
| Global search | `packages/server/src/services/global-search.service.ts` |
| App sidebar | `packages/client/src/components/layout/app-sidebar.tsx` |
| Smart buttons | `packages/client/src/components/shared/SmartButtonBar.tsx` |

---

## Environment Variables

```env
# Required
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/atlas
JWT_SECRET=<min 32 chars>
JWT_REFRESH_SECRET=<min 32 chars>
TOKEN_ENCRYPTION_KEY=<64 hex chars>

# Optional
PORT=3001
SERVER_PUBLIC_URL=http://localhost:3001
CLIENT_PUBLIC_URL=http://localhost:5180
CORS_ORIGINS=http://localhost:5180
REDIS_URL=redis://localhost:6379
SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
```

---

## Multi-tenancy (Hidden)

Atlas runs as single-tenant but the multi-tenant DB structure exists:
- `tenants` table — one row for the organization
- `tenantMembers` — maps users to the tenant with roles (owner/admin/member)
- `tenantApps` — which apps are enabled per tenant
- Tenant is auto-created during first-run setup (`POST /auth/setup`)
- No public registration — admin adds users via org members page
