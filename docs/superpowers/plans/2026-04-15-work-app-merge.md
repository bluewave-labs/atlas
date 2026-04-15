# Work app — Tasks + Projects merge implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retire the `tasks` and `projects` apps and replace them with a single `work` app. Add a Financials tab to the project detail page. Make personal tasks private to the assignee. Add `projectId` to invoices.

**Architecture:** New `work` app owns both tasks and projects code. The richer `project_projects` table survives; `task_projects` is migrated into it and dropped. Tasks gain an `isPrivate` column set automatically by the server from `projectId` nullability. Invoices gain a nullable `projectId` column + index. Global search, permissions, and tenantApps migrate to the new `work` id.

**Tech Stack:** React + TypeScript + Vite (client), Express + PostgreSQL + Drizzle ORM (server), react-i18next. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-04-15-work-app-merge-design.md`

---

## Implementation order rationale

The plan is ordered so each task leaves the codebase green. Schema first; backend first (since privacy lives there and the client can't change shape without it); client scaffolding parallel; old apps removed last; cleanup.

Atlas is pre-launch per CLAUDE.md — no redirects, no backwards-compat shims. Hard cutover throughout.

---

## Task 1: Schema changes — add `isPrivate` to tasks, `projectId` to invoices

**Files:**
- Modify: `packages/server/src/db/schema.ts`

- [ ] **Step 1: Add `isPrivate` column to the `tasks` table**

Find the `tasks` pgTable (around line 429, next to the existing `projectId` column). Add:

```ts
isPrivate: boolean('is_private').notNull().default(false),
```

Place it next to `projectId`. Also add an index for privacy-filtered queries:

```ts
userPrivateIdx: index('idx_tasks_user_private').on(table.userId, table.isPrivate),
```

Add the index entry alongside the existing `projectIdx` inside the same pgTable index block.

- [ ] **Step 2: Add `projectId` column to the `invoices` table**

Find the `invoices` pgTable. Add (placement: next to `dealId`):

```ts
projectId: uuid('project_id').references(() => projectProjects.id, { onDelete: 'set null' }),
```

And inside the index block for invoices, add:

```ts
projectIdx: index('idx_invoices_project').on(table.projectId),
```

If `projectProjects` is declared below `invoices` in the file, hoist its declaration OR add the FK reference as a raw `references` string. Easiest fix: move the `projectProjects` block above the `invoices` block.

- [ ] **Step 3: Change `tasks.projectId` FK target**

The existing line reads:

```ts
projectId: uuid('project_id').references(() => taskProjects.id, { onDelete: 'set null' }),
```

Replace with:

```ts
projectId: uuid('project_id').references(() => projectProjects.id, { onDelete: 'set null' }),
```

Same caveat about declaration order — make sure `projectProjects` is declared before `tasks`.

- [ ] **Step 4: Do NOT drop `task_projects` yet**

Leave the `taskProjects` pgTable declaration in place. The migration task (Task 2) needs it readable until data is moved. We'll drop it in Task 16.

- [ ] **Step 5: Typecheck schema**

Run: `cd /Users/gorkemcetin/atlasmail/packages/server && npx tsc --noEmit 2>&1 | tail -20`

Expected: no new errors. The known pre-existing `hrEmployees` error may still be present.

- [ ] **Step 6: Push schema — but beware the FK swap**

Normally `cd packages/server && npm run db:push` would apply changes. The FK target swap on `tasks.projectId` will fail if there are rows in `tasks` with `projectId` pointing at `task_projects` IDs that don't exist in `project_projects`. Task 2 handles that by running the migration *before* db:push drops the old FK.

**Skip the db:push in this task.** Stop here. Task 2 will handle ordering.

- [ ] **Step 7: Commit**

```bash
cd /Users/gorkemcetin/atlasmail
git add packages/server/src/db/schema.ts
git commit -m "schema(work): add isPrivate to tasks, projectId to invoices, retarget tasks.projectId FK"
git push origin main
```

---

## Task 2: Migration script — move task_projects rows into project_projects

**Files:**
- Create: `packages/server/src/db/migrations/2026-04-15-work-merge.ts`

- [ ] **Step 1: Create the migration script**

Write `packages/server/src/db/migrations/2026-04-15-work-merge.ts`:

```ts
/**
 * One-shot migration for the Tasks+Projects → Work merge.
 *
 * 1. Copy task_projects rows into project_projects, preserving IDs.
 *    On ID collision, rewrite tasks.projectId using an old→new map.
 * 2. Set tasks.isPrivate = true where projectId IS NULL.
 * 3. Migrate tenantApps: collapse 'tasks' and 'projects' rows into 'work'.
 *
 * After this script runs, db:push can safely drop task_projects in a later step.
 */
import { db } from '../index';
import { sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { logger } from '../../utils/logger';

export async function migrateWorkMerge() {
  logger.info('Starting work-merge migration');

  // 1. Load existing task_projects
  const taskProjectRows = await db.execute(sql`
    SELECT id, account_id, tenant_id, name, description, created_at, updated_at, is_archived, sort_order
    FROM task_projects
  `);

  const idRewrites: Record<string, string> = {};

  for (const row of taskProjectRows.rows as Array<Record<string, unknown>>) {
    const existing = await db.execute(sql`
      SELECT id FROM project_projects WHERE id = ${row.id as string}
    `);

    if ((existing.rows as unknown[]).length > 0) {
      // Collision — generate new id
      const newId = randomUUID();
      idRewrites[row.id as string] = newId;
      await db.execute(sql`
        INSERT INTO project_projects (id, account_id, tenant_id, name, description, status, is_archived, sort_order, created_at, updated_at)
        VALUES (${newId}, ${row.account_id}, ${row.tenant_id}, ${row.name}, ${row.description ?? null}, 'active', ${row.is_archived ?? false}, ${row.sort_order ?? 0}, ${row.created_at}, ${row.updated_at})
      `);
    } else {
      await db.execute(sql`
        INSERT INTO project_projects (id, account_id, tenant_id, name, description, status, is_archived, sort_order, created_at, updated_at)
        VALUES (${row.id}, ${row.account_id}, ${row.tenant_id}, ${row.name}, ${row.description ?? null}, 'active', ${row.is_archived ?? false}, ${row.sort_order ?? 0}, ${row.created_at}, ${row.updated_at})
      `);
    }
  }

  // 2. Rewrite tasks.projectId for collisions
  for (const [oldId, newId] of Object.entries(idRewrites)) {
    await db.execute(sql`
      UPDATE tasks SET project_id = ${newId} WHERE project_id = ${oldId}
    `);
  }

  // 3. Set isPrivate for personal tasks
  await db.execute(sql`UPDATE tasks SET is_private = true WHERE project_id IS NULL`);

  // 4. Migrate tenantApps: collapse tasks/projects → work (de-dup)
  await db.execute(sql`
    INSERT INTO tenant_apps (tenant_id, app_id, enabled_at)
    SELECT DISTINCT tenant_id, 'work', MIN(enabled_at)
    FROM tenant_apps
    WHERE app_id IN ('tasks', 'projects')
    GROUP BY tenant_id
    ON CONFLICT (tenant_id, app_id) DO NOTHING
  `);
  await db.execute(sql`DELETE FROM tenant_apps WHERE app_id IN ('tasks', 'projects')`);

  logger.info({ rewrites: Object.keys(idRewrites).length }, 'work-merge migration complete');
}
```

- [ ] **Step 2: Wire it into the startup migrate flow**

Read `packages/server/src/db/migrate.ts` to find the existing migration entry point. At the end (after existing idempotent ALTERs), add:

```ts
import { migrateWorkMerge } from './migrations/2026-04-15-work-merge';

// ... at the end of the migrate() function:
try {
  // Guard: only run if task_projects still exists
  const exists = await db.execute(sql`SELECT to_regclass('task_projects') AS t`);
  const hasTaskProjects = (exists.rows as any[])[0]?.t !== null;
  if (hasTaskProjects) {
    await migrateWorkMerge();
  }
} catch (e) {
  logger.error({ err: e }, 'work-merge migration failed');
}
```

If `migrate.ts` doesn't exist or uses a different entry pattern, grep for `migrate` and `db:push` — add the call wherever startup migrations run. Run it once at server boot, guarded by existence check so re-running is a no-op.

- [ ] **Step 3: Apply schema**

Run: `cd /Users/gorkemcetin/atlasmail/packages/server && npm run db:push`

Expected: schema updates apply. If drizzle-kit complains about the FK swap referencing data in both old and new tables, accept the prompt to proceed (dev DB only, pre-launch).

- [ ] **Step 4: Start server briefly to trigger migration**

```bash
cd /Users/gorkemcetin/atlasmail/packages/server && timeout 15 npm run dev 2>&1 | tail -30
```

Expected log line: `work-merge migration complete`.

- [ ] **Step 5: Verify**

```bash
cd /Users/gorkemcetin/atlasmail
docker compose exec -T postgres psql -U postgres -d atlas -c "SELECT COUNT(*) FROM project_projects;"
docker compose exec -T postgres psql -U postgres -d atlas -c "SELECT COUNT(*) FROM tasks WHERE is_private = true;"
docker compose exec -T postgres psql -U postgres -d atlas -c "SELECT app_id, COUNT(*) FROM tenant_apps GROUP BY app_id;"
```

Expected: project_projects count ≥ previous task_projects count; tasks with `is_private=true` ≥ rows where `project_id IS NULL`; `tenant_apps` shows `work` but no `tasks` or `projects`.

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/db/migrations/2026-04-15-work-merge.ts packages/server/src/db/migrate.ts
git commit -m "feat(work): migration — move task_projects into project_projects, seed isPrivate"
git push origin main
```

---

## Task 3: Shared types — add `projectId` to `Invoice`, `isPrivate` to `Task`

**Files:**
- Modify: `packages/shared/src/types/invoices.ts`
- Modify: `packages/shared/src/types/tasks.ts` (or wherever Task type lives)

- [ ] **Step 1: Add `projectId` to the `Invoice` interface**

Find the `Invoice` interface. Add:

```ts
projectId?: string | null;
```

Next to `dealId`. Also add to `CreateInvoiceInput` / `UpdateInvoiceInput` if those types exist in the same file — optional in both.

- [ ] **Step 2: Add `isPrivate` to the `Task` interface**

Grep for `export interface Task` in `packages/shared/src/types/`. Add to the Task interface:

```ts
isPrivate: boolean;
```

Do NOT add it to any CreateTaskInput / UpdateTaskInput type — the server derives it and rejects it from the client.

- [ ] **Step 3: Typecheck**

```bash
cd /Users/gorkemcetin/atlasmail/packages/shared && npx tsc --noEmit 2>&1 | tail -5
cd /Users/gorkemcetin/atlasmail/packages/client && timeout 180 npx tsc --noEmit 2>&1 | tail -10
cd /Users/gorkemcetin/atlasmail/packages/server && timeout 180 npx tsc --noEmit 2>&1 | tail -10
```

Expected: shared clean; client/server may surface places that need the new field — don't fix those here, later tasks handle them.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/types/
git commit -m "types(work): add Invoice.projectId and Task.isPrivate"
git push origin main
```

---

## Task 4: Server — scaffold the `work` app skeleton

**Files:**
- Create: `packages/server/src/apps/work/manifest.ts`
- Create: `packages/server/src/apps/work/routes.ts`
- Create: `packages/server/src/apps/work/controller.ts` (stub)
- Create: `packages/server/src/apps/work/service.ts` (stub)

- [ ] **Step 1: Create the router and manifest**

Write `packages/server/src/apps/work/manifest.ts`:

```ts
import type { ServerAppManifest } from '../../types/app-manifest';
import { workRouter } from './routes';
import { tasks, projectProjects, projectMembers, projectTimeEntries } from '../../db/schema';

export const workServerManifest: ServerAppManifest = {
  id: 'work',
  name: 'Work',
  router: workRouter,
  tables: [tasks, projectProjects, projectMembers, projectTimeEntries],
};
```

(Match the shape `ServerAppManifest` requires — grep for `ServerAppManifest` in other `manifest.ts` files if shape differs. Copy from `packages/server/src/apps/tasks/manifest.ts`.)

- [ ] **Step 2: Create routes.ts stub**

Write `packages/server/src/apps/work/routes.ts`:

```ts
import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { requireAppPermission } from '../../middleware/app-permissions';
import { withConcurrencyCheck } from '../../middleware/concurrency-check';
import { tasks, projectProjects } from '../../db/schema';
import * as controller from './controller';

export const workRouter: Router = Router();

workRouter.use(authMiddleware);
workRouter.use(requireAppPermission('work'));

// Tasks
workRouter.get('/tasks', controller.listTasks);
workRouter.post('/tasks', controller.createTask);
workRouter.get('/tasks/:id', controller.getTask);
workRouter.patch('/tasks/:id', withConcurrencyCheck(tasks), controller.updateTask);
workRouter.delete('/tasks/:id', controller.deleteTask);

// Projects
workRouter.get('/projects', controller.listProjects);
workRouter.post('/projects', controller.createProject);
workRouter.get('/projects/:id', controller.getProject);
workRouter.patch('/projects/:id', withConcurrencyCheck(projectProjects), controller.updateProject);
workRouter.delete('/projects/:id', controller.deleteProject);

// Project members
workRouter.get('/projects/:id/members', controller.listProjectMembers);
workRouter.post('/projects/:id/members', controller.addProjectMember);
workRouter.delete('/projects/:id/members/:userId', controller.removeProjectMember);

// Project time entries
workRouter.get('/projects/:id/time-entries', controller.listProjectTimeEntries);
workRouter.post('/projects/:id/time-entries', controller.createProjectTimeEntry);
workRouter.patch('/projects/:id/time-entries/:entryId', controller.updateProjectTimeEntry);
workRouter.delete('/projects/:id/time-entries/:entryId', controller.deleteProjectTimeEntry);

// Project files (record_links)
workRouter.get('/projects/:id/files', controller.listProjectFiles);

// Project financials (read-only)
workRouter.get('/projects/:id/financials', controller.getProjectFinancials);
```

- [ ] **Step 3: Create controller stub**

Write `packages/server/src/apps/work/controller.ts`:

```ts
import type { Request, Response } from 'express';

const NOT_IMPLEMENTED = (_req: Request, res: Response) => {
  res.status(501).json({ success: false, error: 'Not implemented yet' });
};

export const listTasks = NOT_IMPLEMENTED;
export const createTask = NOT_IMPLEMENTED;
export const getTask = NOT_IMPLEMENTED;
export const updateTask = NOT_IMPLEMENTED;
export const deleteTask = NOT_IMPLEMENTED;

export const listProjects = NOT_IMPLEMENTED;
export const createProject = NOT_IMPLEMENTED;
export const getProject = NOT_IMPLEMENTED;
export const updateProject = NOT_IMPLEMENTED;
export const deleteProject = NOT_IMPLEMENTED;

export const listProjectMembers = NOT_IMPLEMENTED;
export const addProjectMember = NOT_IMPLEMENTED;
export const removeProjectMember = NOT_IMPLEMENTED;

export const listProjectTimeEntries = NOT_IMPLEMENTED;
export const createProjectTimeEntry = NOT_IMPLEMENTED;
export const updateProjectTimeEntry = NOT_IMPLEMENTED;
export const deleteProjectTimeEntry = NOT_IMPLEMENTED;

export const listProjectFiles = NOT_IMPLEMENTED;
export const getProjectFinancials = NOT_IMPLEMENTED;
```

- [ ] **Step 4: Create service.ts placeholder**

Write `packages/server/src/apps/work/service.ts`:

```ts
// Work-app services. Business logic lives here; controllers thin-wrap these.
// Implemented incrementally by later tasks.
export {};
```

- [ ] **Step 5: Register the app permission**

Read `packages/server/src/services/app-permissions.service.ts`. Find the definitions that include `tasks` and `projects` entries. Add a `work` entry — copy the shape from `tasks` (roles: admin/member, actions: read/create/update/delete). Leave the old `tasks` and `projects` entries in place for now; Task 16 removes them.

- [ ] **Step 6: Register the server manifest**

Edit `packages/server/src/apps/index.ts`. Add:

```ts
import { workServerManifest } from './work/manifest';
serverAppRegistry.register(workServerManifest);
```

Place after existing registrations. Leave `tasksServerManifest` and `projectsServerManifest` registered for now.

- [ ] **Step 7: Typecheck + start server**

```bash
cd /Users/gorkemcetin/atlasmail/packages/server && timeout 180 npx tsc --noEmit 2>&1 | tail -10
cd /Users/gorkemcetin/atlasmail/packages/server && timeout 10 npm run dev 2>&1 | tail -10
```

Expected: clean typecheck (plus known `hrEmployees` pre-existing error); server boots without crashing; /work routes respond with 501.

- [ ] **Step 8: Commit**

```bash
git add packages/server/src/apps/work/ packages/server/src/apps/index.ts packages/server/src/services/app-permissions.service.ts
git commit -m "feat(work): scaffold work app — manifest, routes, permissions"
git push origin main
```

---

## Task 5: Server — port task service into work

**Files:**
- Create/modify: `packages/server/src/apps/work/service.ts`
- Create: `packages/server/src/apps/work/utils/readable-tasks.ts`
- Modify: `packages/server/src/apps/work/controller.ts`

- [ ] **Step 1: Create the privacy-query helper**

Write `packages/server/src/apps/work/utils/readable-tasks.ts`:

```ts
import { and, eq, or, SQL } from 'drizzle-orm';
import { tasks } from '../../../db/schema';

/**
 * Returns a WHERE fragment that restricts task rows to those the current user
 * can read: either public (isPrivate=false) or owned by the user.
 *
 * Every task-reading query MUST go through this helper.
 */
export function readableTasksFilter(currentUserId: string): SQL {
  return or(eq(tasks.isPrivate, false), eq(tasks.userId, currentUserId))!;
}
```

- [ ] **Step 2: Port the existing task service into work/service.ts**

Read `packages/server/src/apps/tasks/service.ts` and `packages/server/src/apps/tasks/services/*.ts`. Port into `packages/server/src/apps/work/service.ts`. Preserve the existing public API shape so controllers map cleanly. During the port:

- Every `SELECT` from `tasks` adds `AND readableTasksFilter(userId)` in its `where`.
- `createTask`: if input has `projectId`, set `isPrivate = false`. Else set `isPrivate = true`. Never accept `isPrivate` from the input.
- `updateTask`: when the patch changes `projectId` from null → value, force `isPrivate = false`. Value → null → force `isPrivate = true`. Never accept client-supplied `isPrivate`.
- `getTask(id)`: after reading, if `row.isPrivate === true && row.userId !== currentUserId`, return null (controller then responds 403).
- `deleteTask(id)`: same check.

Keep the existing `listTasks` filter param surface (`projectId`, `assigneeId`, `createdById`, status, etc.). Add a new `view` param accepting `'my' | 'assigned' | 'created' | 'all'`:
- `my`: `userId = currentUserId AND (projectId IS NULL OR assigneeId = currentUserId)` — personal tasks plus project tasks assigned to me
- `assigned`: `assigneeId = currentUserId`
- `created`: `userId = currentUserId`
- `all`: no additional filter (still subject to the privacy predicate)

- [ ] **Step 3: Implement task controllers**

Edit `packages/server/src/apps/work/controller.ts`. Replace each task stub with a real implementation that:
- Pulls `userId`, `tenantId` from `req.auth!`.
- Calls the ported service function.
- Returns `{ success: true, data }` on success.
- Returns 403 `{ success: false, error: 'Forbidden' }` if the service signals a privacy violation (e.g. service returns a sentinel or throws).
- Returns 500 on unexpected errors with a logger call.

Use `packages/server/src/apps/tasks/controller.ts` (and any sub-controllers) as the template. Copy the handler bodies, adjust imports to the new service location, wire privacy checks.

- [ ] **Step 4: Typecheck and start server**

```bash
cd /Users/gorkemcetin/atlasmail/packages/server && timeout 180 npx tsc --noEmit 2>&1 | tail -10
cd /Users/gorkemcetin/atlasmail/packages/server && timeout 10 npm run dev 2>&1 | tail -5
```

Expected: clean; server boots.

- [ ] **Step 5: Manual smoke test via curl**

```bash
TOKEN=$(cat /tmp/atlas-token 2>/dev/null || echo "SET_TOKEN_FIRST")
curl -s http://localhost:3001/api/v1/work/tasks -H "Authorization: Bearer $TOKEN" | head -c 200
```

Expected: `{"success":true,"data":[...tasks...]}`. (If no saved token, grab one from browser localStorage or log in first.)

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/apps/work/
git commit -m "feat(work): port task service with privacy enforcement"
git push origin main
```

---

## Task 6: Server — port project service into work

**Files:**
- Modify: `packages/server/src/apps/work/service.ts` (append)
- Modify: `packages/server/src/apps/work/controller.ts` (replace project stubs)

- [ ] **Step 1: Port the project service**

Read `packages/server/src/apps/projects/service.ts` and `packages/server/src/apps/projects/services/*.ts`. Port CRUD + member management + time entries into `work/service.ts`. Preserve behavior — no logic changes.

- [ ] **Step 2: Port project file listing**

`listProjectFiles(projectId)` queries `record_links` where one side is this project and the other is a `drive_items` row. Implementation:

```ts
import { recordLinks, driveItems } from '../../db/schema';
import { eq, and, or } from 'drizzle-orm';

export async function listProjectFiles(tenantId: string, projectId: string) {
  // Find drive item IDs linked to this project (either direction)
  const links = await db
    .select({ driveItemId: recordLinks.targetRecordId, sourceAppId: recordLinks.sourceAppId, targetAppId: recordLinks.targetAppId })
    .from(recordLinks)
    .where(
      and(
        eq(recordLinks.tenantId, tenantId),
        or(
          and(eq(recordLinks.sourceAppId, 'work'), eq(recordLinks.sourceRecordId, projectId), eq(recordLinks.targetAppId, 'drive')),
          and(eq(recordLinks.targetAppId, 'work'), eq(recordLinks.targetRecordId, projectId), eq(recordLinks.sourceAppId, 'drive'))
        )
      )
    );
  const ids = links.map(l => l.sourceAppId === 'drive' ? l.driveItemId : l.driveItemId);
  if (ids.length === 0) return [];
  return db.select().from(driveItems).where(inArray(driveItems.id, ids));
}
```

Adjust to the actual `record_links` schema shape — grep for `recordLinks` in schema.ts to confirm column names.

- [ ] **Step 3: Implement project controllers**

Replace each project / member / time-entry / files stub in `controller.ts` with a real implementation, same pattern as Task 5.

- [ ] **Step 4: Typecheck + smoke**

```bash
cd /Users/gorkemcetin/atlasmail/packages/server && timeout 180 npx tsc --noEmit 2>&1 | tail -10
```

Expected clean.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/apps/work/
git commit -m "feat(work): port project service (CRUD, members, time, files)"
git push origin main
```

---

## Task 7: Server — financials service and controller

**Files:**
- Create: `packages/server/src/apps/work/services/financial.service.ts`
- Modify: `packages/server/src/apps/work/controller.ts`

- [ ] **Step 1: Create financial.service.ts**

```ts
import { db } from '../../../db';
import { invoices, invoicePayments } from '../../../db/schema';
import { eq, and, sum, sql } from 'drizzle-orm';

export interface FinancialsSummary {
  totalBilled: number;
  totalPaid: number;
  outstanding: number;
  currency: string; // or 'MIXED'
}

export async function getProjectFinancials(tenantId: string, projectId: string) {
  const rows = await db
    .select()
    .from(invoices)
    .where(and(
      eq(invoices.tenantId, tenantId),
      eq(invoices.projectId, projectId),
      eq(invoices.isArchived, false),
    ))
    .orderBy(invoices.issueDate);

  const currencies = new Set(rows.map(r => r.currency));
  const currency = currencies.size === 1 ? Array.from(currencies)[0] : 'MIXED';

  const totalBilled = rows.reduce((acc, r) => acc + Number(r.total ?? 0), 0);
  const totalPaid = rows.reduce((acc, r) => acc + (Number(r.total ?? 0) - Number(r.balanceDue ?? 0)), 0);
  const outstanding = rows.reduce((acc, r) => acc + Number(r.balanceDue ?? 0), 0);

  return {
    summary: { totalBilled, totalPaid, outstanding, currency },
    invoices: rows.map(r => ({
      id: r.id,
      invoiceNumber: r.invoiceNumber,
      issueDate: r.issueDate,
      dueDate: r.dueDate,
      total: Number(r.total ?? 0),
      balanceDue: Number(r.balanceDue ?? 0),
      status: r.status,
      currency: r.currency,
    })),
  };
}
```

(If `invoices.balanceDue` isn't a column but a computed value — check the invoices service — compute it in the reducer the same way the existing invoice listing does.)

- [ ] **Step 2: Wire the controller**

In `work/controller.ts`:

```ts
import * as financialService from './services/financial.service';

export async function getProjectFinancials(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;
    const id = req.params.id as string;
    const data = await financialService.getProjectFinancials(tenantId, id);
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to get project financials');
    res.status(500).json({ success: false, error: 'Failed to get financials' });
  }
}
```

- [ ] **Step 3: Typecheck**

```bash
cd /Users/gorkemcetin/atlasmail/packages/server && timeout 180 npx tsc --noEmit 2>&1 | tail -10
```

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/apps/work/
git commit -m "feat(work): project financials endpoint (summary + invoice list)"
git push origin main
```

---

## Task 8: Server — invoices accept and return `projectId`

**Files:**
- Modify: `packages/server/src/apps/invoices/controllers/invoice.controller.ts`
- Modify: `packages/server/src/apps/invoices/services/invoice.service.ts`
- Modify: `packages/server/src/apps/invoices/routes.ts` (if list filter needed)

- [ ] **Step 1: Accept `projectId` in create controller**

Find the create-invoice controller. Add `projectId` to the destructured body and pass it to the service.

- [ ] **Step 2: Accept `projectId` in update controller**

In `updateInvoice` controller (around line 114 per the earlier fix), add `projectId` to the destructure list and pass through.

- [ ] **Step 3: Update the service input types**

In `invoice.service.ts`, add optional `projectId?: string | null` to `createInvoice` and `updateInvoice` input types. Map it to the DB column on INSERT/UPDATE.

- [ ] **Step 4: Support `?projectId=` filter on list**

In the list controller, read `req.query.projectId`. Pass to the service `listInvoices`. In the service, if `projectId` is provided, add `eq(invoices.projectId, projectId)` to the where clause.

- [ ] **Step 5: Typecheck**

```bash
cd /Users/gorkemcetin/atlasmail/packages/server && timeout 180 npx tsc --noEmit 2>&1 | tail -10
```

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/apps/invoices/
git commit -m "feat(invoices): accept and filter by projectId"
git push origin main
```

---

## Task 9: Server — global search switches to `work` branch

**Files:**
- Modify: `packages/server/src/services/global-search.service.ts`

- [ ] **Step 1: Replace the tasks and projects branches with a single work branch**

Find the UNION ALL query. Locate the branches that SELECT from `tasks` and `project_projects` (or similar). Replace both with a combined work branch that:
- SELECTs tasks with the privacy predicate: `(is_private = false OR user_id = :currentUserId)`
- SELECTs projects unchanged from `project_projects`
- Both UNIONed, tagged with a `result_type` discriminator (`'work_task'`, `'work_project'`)

Keep the result shape the consumer expects. Copy prior SELECT column lists exactly; don't invent new columns.

- [ ] **Step 2: Typecheck + smoke**

```bash
cd /Users/gorkemcetin/atlasmail/packages/server && timeout 180 npx tsc --noEmit 2>&1 | tail -10
```

- [ ] **Step 3: Commit**

```bash
git add packages/server/src/services/global-search.service.ts
git commit -m "feat(work): global search — merge tasks+projects into work branch with privacy filter"
git push origin main
```

---

## Task 10: Client — scaffold the `work` app

**Files:**
- Create: `packages/client/src/apps/work/manifest.ts`
- Create: `packages/client/src/apps/work/page.tsx`
- Create: `packages/client/src/apps/work/hooks.ts`
- Create: `packages/client/src/apps/work/settings-store.ts`
- Create: `packages/client/src/components/icons/app-icons.tsx` — add `WorkIcon`
- Modify: `packages/client/src/apps/index.ts` (register)
- Modify: `packages/client/src/config/routes.ts` (add `WORK`)
- Modify: `packages/client/src/config/query-keys.ts` (add `work` namespace)

- [ ] **Step 1: Add `WORK` to routes config**

In `packages/client/src/config/routes.ts`, add:

```ts
export const WORK = '/work';
```

- [ ] **Step 2: Add `work` to query keys**

In `packages/client/src/config/query-keys.ts`, add:

```ts
work: {
  all: ['work'] as const,
  taskList: (filters: Record<string, unknown>) => ['work', 'tasks', filters] as const,
  task: (id: string) => ['work', 'task', id] as const,
  projectList: ['work', 'projects'] as const,
  project: (id: string) => ['work', 'project', id] as const,
  projectMembers: (id: string) => ['work', 'project', id, 'members'] as const,
  projectTime: (id: string) => ['work', 'project', id, 'time'] as const,
  projectFiles: (id: string) => ['work', 'project', id, 'files'] as const,
  projectFinancials: (id: string) => ['work', 'project', id, 'financials'] as const,
},
```

- [ ] **Step 3: Add `WorkIcon` brand SVG**

In `packages/client/src/components/icons/app-icons.tsx`, add a `WorkIcon` component. If time-boxed, use a simple lucide fallback wrapped in the brand-card pattern — copy the shape of `TasksIcon` or `ProjectsIcon` and change the color to `#6366f1`. A proper SVG can land later.

- [ ] **Step 4: Create settings-store**

```ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface WorkSettingsState {
  lastSelectedProjectId: string | null;
  taskViewMode: 'kanban' | 'list' | 'table';
  setLastSelectedProjectId: (id: string | null) => void;
  setTaskViewMode: (mode: 'kanban' | 'list' | 'table') => void;
}

export const useWorkSettings = create<WorkSettingsState>()(
  persist(
    (set) => ({
      lastSelectedProjectId: null,
      taskViewMode: 'list',
      setLastSelectedProjectId: (id) => set({ lastSelectedProjectId: id }),
      setTaskViewMode: (mode) => set({ taskViewMode: mode }),
    }),
    { name: 'atlas_work_settings' }
  )
);
```

- [ ] **Step 5: Create hooks.ts stubs**

Write `packages/client/src/apps/work/hooks.ts` with all the hooks listed in the spec's "Hooks" section. Start by porting the existing `tasks/hooks.ts` and `projects/hooks.ts` — change all API paths from `/tasks` and `/projects` to `/work/tasks` and `/work/projects`. Change all query keys to `queryKeys.work.*`. Add `useProjectFinancials(id)`:

```ts
export function useProjectFinancials(id: string) {
  return useQuery({
    queryKey: queryKeys.work.projectFinancials(id),
    queryFn: async () => {
      const { data } = await api.get(`/work/projects/${id}/financials`);
      return data.data as {
        summary: { totalBilled: number; totalPaid: number; outstanding: number; currency: string };
        invoices: Array<{ id: string; invoiceNumber: string; issueDate: string; dueDate: string; total: number; balanceDue: number; status: string; currency: string }>;
      };
    },
    enabled: !!id,
  });
}
```

- [ ] **Step 6: Create a minimal page.tsx**

```tsx
import { useSearchParams } from 'react-router-dom';
import { AppSidebar } from '../../components/ui/app-sidebar';
import { ContentArea } from '../../components/ui/content-area';
import { WorkSidebar } from './components/work-sidebar';
import { MyTasksView } from './components/task-views/my-tasks-view';
import { AssignedView } from './components/task-views/assigned-view';
import { CreatedView } from './components/task-views/created-view';
import { AllTasksView } from './components/task-views/all-tasks-view';
import { ProjectDetailPage } from './components/project-detail-page';

export function WorkPage() {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId');
  const view = searchParams.get('view') ?? 'my';

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <AppSidebar storageKey="atlas_work_sidebar" title="Work">
        <WorkSidebar activeView={projectId ? 'project' : view} activeProjectId={projectId} />
      </AppSidebar>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {projectId ? (
          <ProjectDetailPage projectId={projectId} />
        ) : view === 'assigned' ? <AssignedView /> : view === 'created' ? <CreatedView /> : view === 'all' ? <AllTasksView /> : <MyTasksView />}
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Create manifest**

```ts
import type { ClientAppManifest } from '../../types/app-manifest';
import { WorkIcon } from '../../components/icons/app-icons';
import { WORK } from '../../config/routes';
import { WorkPage } from './page';

export const workManifest: ClientAppManifest = {
  id: 'work',
  name: 'Work',
  route: WORK,
  color: '#6366f1',
  icon: WorkIcon,
  sidebarOrder: 25,
  page: WorkPage,
};
```

(Match actual `ClientAppManifest` shape — copy from `tasks/manifest.ts`.)

- [ ] **Step 8: Register the manifest**

In `packages/client/src/apps/index.ts`:

```ts
import { workManifest } from './work/manifest';
appRegistry.register(workManifest);
```

Leave the old `tasksManifest` and `projectsManifest` registered for now; Task 16 removes them.

- [ ] **Step 9: Stub out the component files**

Create empty components so the page imports resolve. Each file exports a placeholder component rendering `<div>Coming soon</div>`:

- `components/work-sidebar.tsx`
- `components/task-views/my-tasks-view.tsx`
- `components/task-views/assigned-view.tsx`
- `components/task-views/created-view.tsx`
- `components/task-views/all-tasks-view.tsx`
- `components/project-detail-page.tsx`

- [ ] **Step 10: Typecheck + dev**

```bash
cd /Users/gorkemcetin/atlasmail/packages/client && timeout 180 npx tsc --noEmit 2>&1 | tail -10
```

Expected clean. Start dev: http://localhost:5180/work should render the placeholder.

- [ ] **Step 11: Commit**

```bash
git add packages/client/src/apps/work/ packages/client/src/apps/index.ts packages/client/src/config/ packages/client/src/components/icons/
git commit -m "feat(work): scaffold work app (manifest, page, hooks, sidebar, placeholder tabs)"
git push origin main
```

---

## Task 11: Client — port task views

**Files:**
- Modify: `packages/client/src/apps/work/components/work-sidebar.tsx`
- Modify: `packages/client/src/apps/work/components/task-views/*.tsx`
- Create: `packages/client/src/apps/work/components/task-list.tsx` (migrated from tasks app)
- Create: `packages/client/src/apps/work/components/task-detail-panel.tsx` (migrated)

- [ ] **Step 1: Implement `WorkSidebar`**

Read `packages/client/src/apps/tasks/page.tsx` / sidebar / components to see the existing sidebar pattern. Then write:

```tsx
import { useNavigate } from 'react-router-dom';
import { Inbox, UserCheck, Edit, Layers, FolderKanban } from 'lucide-react';
import { SidebarItem, SidebarSection } from '../../../components/ui/app-sidebar';
import { useProjectList } from '../hooks';

interface Props {
  activeView: string;
  activeProjectId: string | null;
}

export function WorkSidebar({ activeView, activeProjectId }: Props) {
  const navigate = useNavigate();
  const { data: projects = [] } = useProjectList();

  const nav = (qs: string) => navigate(`/work${qs}`);

  return (
    <>
      <SidebarSection>
        <SidebarItem label="My tasks" icon={<Inbox size={15} />} isActive={activeView === 'my' && !activeProjectId} onClick={() => nav('')} />
        <SidebarItem label="Assigned to me" icon={<UserCheck size={15} />} isActive={activeView === 'assigned'} onClick={() => nav('?view=assigned')} />
        <SidebarItem label="Created by me" icon={<Edit size={15} />} isActive={activeView === 'created'} onClick={() => nav('?view=created')} />
        <SidebarItem label="All tasks" icon={<Layers size={15} />} isActive={activeView === 'all'} onClick={() => nav('?view=all')} />
      </SidebarSection>
      <SidebarSection title="Projects">
        {projects.map((p) => (
          <SidebarItem key={p.id} label={p.name} icon={<FolderKanban size={15} />} isActive={activeProjectId === p.id} onClick={() => nav(`?projectId=${p.id}`)} />
        ))}
      </SidebarSection>
    </>
  );
}
```

(Use `t('work.sidebar.*')` keys instead of hardcoded English once i18n is added in Task 15. Hardcoded is fine for now; Task 15 sweeps.)

- [ ] **Step 2: Port `task-list.tsx` from tasks app**

Copy `packages/client/src/apps/tasks/components/task-list.tsx` (and any local dependencies) into `packages/client/src/apps/work/components/task-list.tsx`. Change imports from `../hooks` (tasks) to `../hooks` (work — same relative path, different directory). Accept a new optional `projectIdFilter?: string` prop so the project Tasks tab can reuse it.

- [ ] **Step 3: Port `task-detail-panel.tsx`**

Same procedure — copy from tasks app. If the component touched `isPrivate` (it shouldn't; the column didn't exist before), skip. Otherwise no semantic changes needed.

- [ ] **Step 4: Implement the four task views**

Each view is a thin wrapper that renders `<TaskList>` with appropriate filters:

```tsx
export function MyTasksView() {
  return <TaskList view="my" />;
}
```

Same for `AssignedView` (`view="assigned"`), `CreatedView` (`view="created"`), `AllTasksView` (`view="all"`).

`TaskList` reads the `view` prop and calls `useTaskList({ view, projectId: projectIdFilter })`.

- [ ] **Step 5: Typecheck + smoke**

```bash
cd /Users/gorkemcetin/atlasmail/packages/client && timeout 180 npx tsc --noEmit 2>&1 | tail -10
```

Dev server: navigate to http://localhost:5180/work. Each sidebar item should render a (possibly empty) task list.

- [ ] **Step 6: Commit**

```bash
git add packages/client/src/apps/work/
git commit -m "feat(work): implement sidebar + four task views + ported task-list"
git push origin main
```

---

## Task 12: Client — project detail page with tabs

**Files:**
- Modify: `packages/client/src/apps/work/components/project-detail-page.tsx`
- Create: `packages/client/src/apps/work/components/project-overview-tab.tsx`
- Create: `packages/client/src/apps/work/components/project-tasks-tab.tsx`
- Create: `packages/client/src/apps/work/components/project-financials-tab.tsx`
- Create: `packages/client/src/apps/work/components/project-members-tab.tsx`
- Create: `packages/client/src/apps/work/components/project-time-tab.tsx`
- Create: `packages/client/src/apps/work/components/project-files-tab.tsx`

- [ ] **Step 1: Build the tabs shell**

```tsx
import { useSearchParams } from 'react-router-dom';
import { ContentArea } from '../../../components/ui/content-area';
import { useProject } from '../hooks';
import { ProjectOverviewTab } from './project-overview-tab';
import { ProjectTasksTab } from './project-tasks-tab';
import { ProjectFinancialsTab } from './project-financials-tab';
import { ProjectMembersTab } from './project-members-tab';
import { ProjectTimeTab } from './project-time-tab';
import { ProjectFilesTab } from './project-files-tab';

const TABS = ['overview', 'tasks', 'financials', 'members', 'time', 'files'] as const;
type TabId = typeof TABS[number];

interface Props { projectId: string; }

export function ProjectDetailPage({ projectId }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get('tab') as TabId | null) ?? 'overview';
  const { data: project, isLoading } = useProject(projectId);

  if (isLoading) return <ContentArea title=""><div style={{ padding: 32 }}>Loading…</div></ContentArea>;
  if (!project) return <ContentArea title=""><div style={{ padding: 32 }}>Project not found</div></ContentArea>;

  const setTab = (next: TabId) => setSearchParams({ projectId, tab: next }, { replace: true });

  return (
    <ContentArea
      headerSlot={
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', padding: 'var(--spacing-sm) var(--spacing-lg)', width: '100%' }}>
          <span style={{ fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)' }}>
            {project.name}
          </span>
          <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
            {TABS.map((id) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  padding: '6px 10px', borderRadius: 'var(--radius-sm)',
                  fontSize: 'var(--font-size-sm)',
                  color: tab === id ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                  fontWeight: tab === id ? 'var(--font-weight-semibold)' : 'var(--font-weight-medium)',
                  borderBottom: tab === id ? '2px solid var(--color-accent-primary)' : '2px solid transparent',
                }}
              >
                {id}
              </button>
            ))}
          </div>
        </div>
      }
    >
      {tab === 'overview' && <ProjectOverviewTab project={project} />}
      {tab === 'tasks' && <ProjectTasksTab projectId={projectId} />}
      {tab === 'financials' && <ProjectFinancialsTab projectId={projectId} project={project} />}
      {tab === 'members' && <ProjectMembersTab projectId={projectId} />}
      {tab === 'time' && <ProjectTimeTab projectId={projectId} />}
      {tab === 'files' && <ProjectFilesTab projectId={projectId} />}
    </ContentArea>
  );
}
```

- [ ] **Step 2: Implement `ProjectOverviewTab`**

Read project-summary / description render code in existing Projects app. Port. Show name, description, status, due date, member avatars, task-count summary, outstanding invoice total (call `useProjectFinancials`).

- [ ] **Step 3: Implement `ProjectTasksTab`**

```tsx
import { TaskList } from './task-list';

export function ProjectTasksTab({ projectId }: { projectId: string }) {
  return (
    <div style={{ padding: 'var(--spacing-md)' }}>
      <TaskList view="all" projectIdFilter={projectId} />
    </div>
  );
}
```

- [ ] **Step 4: Implement `ProjectMembersTab`, `ProjectTimeTab`**

Port from the existing Projects app's members and time-entries components. Change query hooks to `useProjectMembers(id)` / `useProjectTimeEntries(id)` from `../hooks`.

- [ ] **Step 5: Implement `ProjectFilesTab`**

Call `useProjectFiles(projectId)`. Render a read-only list of drive items (name, type icon, size, last modified). Each row links out to Drive (`/drive/folder/<parentId>?previewId=<id>` — match existing Drive route pattern).

- [ ] **Step 6: Typecheck + smoke**

```bash
cd /Users/gorkemcetin/atlasmail/packages/client && timeout 180 npx tsc --noEmit 2>&1 | tail -10
```

Navigate to `/work?projectId=<real-id>` — each tab renders.

- [ ] **Step 7: Commit**

```bash
git add packages/client/src/apps/work/
git commit -m "feat(work): project detail page with 6 tabs (Overview, Tasks, Financials, Members, Time, Files)"
git push origin main
```

---

## Task 13: Client — Financials tab

**Files:**
- Modify: `packages/client/src/apps/work/components/project-financials-tab.tsx`

- [ ] **Step 1: Implement the Financials tab**

```tsx
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { useProjectFinancials } from '../hooks';
import { getInvoiceStatusVariant } from '@atlas-platform/shared';
import type { Project } from '@atlas-platform/shared';

interface Props { projectId: string; project: Project; }

function fmt(n: number, currency: string) {
  if (currency === 'MIXED') return `${n.toFixed(2)} (mixed)`;
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(n); }
  catch { return `${n.toFixed(2)} ${currency}`; }
}

export function ProjectFinancialsTab({ projectId, project }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading } = useProjectFinancials(projectId);

  if (isLoading || !data) return <div style={{ padding: 'var(--spacing-md)' }}>Loading…</div>;

  const { summary, invoices } = data;

  const newInvoice = () => {
    navigate(`/invoices?view=new&projectId=${projectId}&companyId=${project.companyId ?? ''}`);
  };

  return (
    <div style={{ padding: 'var(--spacing-md)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      {/* Summary strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--spacing-md)' }}>
        <SummaryCard label={t('work.financials.totalBilled')} value={fmt(summary.totalBilled, summary.currency)} />
        <SummaryCard label={t('work.financials.totalPaid')} value={fmt(summary.totalPaid, summary.currency)} />
        <SummaryCard label={t('work.financials.outstanding')} value={fmt(summary.outstanding, summary.currency)} />
      </div>

      {/* New invoice */}
      <div>
        <Button variant="primary" size="sm" onClick={newInvoice}>
          {t('work.financials.newInvoice')}
        </Button>
      </div>

      {/* Invoices table */}
      {invoices.length === 0 ? (
        <div style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-sm)' }}>
          {t('work.financials.empty')}
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-sm)' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--color-text-tertiary)', borderBottom: '1px solid var(--color-border-secondary)' }}>
              <th style={{ padding: 'var(--spacing-sm)' }}>{t('work.financials.colNumber')}</th>
              <th style={{ padding: 'var(--spacing-sm)' }}>{t('work.financials.colIssueDate')}</th>
              <th style={{ padding: 'var(--spacing-sm)' }}>{t('work.financials.colDueDate')}</th>
              <th style={{ padding: 'var(--spacing-sm)' }}>{t('work.financials.colTotal')}</th>
              <th style={{ padding: 'var(--spacing-sm)' }}>{t('work.financials.colBalance')}</th>
              <th style={{ padding: 'var(--spacing-sm)' }}>{t('work.financials.colStatus')}</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id}
                  onClick={() => navigate(`/invoices?view=invoice-detail&invoiceId=${inv.id}`)}
                  style={{ cursor: 'pointer', borderBottom: '1px solid var(--color-border-secondary)' }}>
                <td style={{ padding: 'var(--spacing-sm)' }}>{inv.invoiceNumber}</td>
                <td style={{ padding: 'var(--spacing-sm)' }}>{inv.issueDate.slice(0, 10)}</td>
                <td style={{ padding: 'var(--spacing-sm)' }}>{inv.dueDate.slice(0, 10)}</td>
                <td style={{ padding: 'var(--spacing-sm)' }}>{fmt(inv.total, inv.currency)}</td>
                <td style={{ padding: 'var(--spacing-sm)' }}>{fmt(inv.balanceDue, inv.currency)}</td>
                <td style={{ padding: 'var(--spacing-sm)' }}>
                  <Badge variant={getInvoiceStatusVariant(inv.status as any)}>{inv.status}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      padding: 'var(--spacing-md)',
      border: '1px solid var(--color-border-secondary)',
      borderRadius: 'var(--radius-md)',
      background: 'var(--color-bg-secondary)',
    }}>
      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </div>
      <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)', marginTop: 'var(--spacing-xs)' }}>
        {value}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire the "+ New invoice" deep-link into invoices page**

Read `packages/client/src/apps/invoices/page.tsx`. The `view=new` branch (or equivalent "create invoice" flow) may already exist. If the page doesn't accept `projectId` / `companyId` from query params, add that support: pass `defaultProjectId` and `defaultCompanyId` into whatever form component handles new invoices. If the form is a modal, open it on mount when `view=new` is set.

If this touches a lot of invoice-page internals, it's acceptable to leave a `console.warn('new invoice pre-fill not wired yet')` and ship the Financials tab — the button still opens the invoices page, the user manually picks the project. Prefer wiring it if it's under ~30 LOC.

- [ ] **Step 3: Typecheck**

```bash
cd /Users/gorkemcetin/atlasmail/packages/client && timeout 180 npx tsc --noEmit 2>&1 | tail -10
```

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/apps/work/ packages/client/src/apps/invoices/
git commit -m "feat(work): Financials tab — summary strip + invoice table + new-invoice deep link"
git push origin main
```

---

## Task 14: Client — invoice meta block gets Project select

**Files:**
- Modify: `packages/client/src/apps/invoices/components/invoice-meta-block.tsx`

- [ ] **Step 1: Add Project select**

Add a Project select row to `InvoiceMetaBlock`, similar to the existing Company row. Populate via `useProjectList()` from `../../work/hooks`. Include an empty option (label: `—`, value: `''`) so invoices can be unassigned from a project.

```tsx
import { useProjectList } from '../../work/hooks';

// inside component:
const { data: projects = [] } = useProjectList();

// in the JSX, after the Currency row:
<Label>{t('invoices.detail.metaProject')}</Label>
<Select
  size="sm"
  value={invoice.projectId ?? ''}
  onChange={(v) => onPatch({ projectId: v || null })}
  options={[{ value: '', label: '—' }, ...projects.map((p) => ({ value: p.id, label: p.name }))]}
/>
```

- [ ] **Step 2: Add `metaProject` i18n key to all 5 locales**

```bash
cd /Users/gorkemcetin/atlasmail
python3 <<'PY'
import json
msgs = {'en': 'Project', 'tr': 'Proje', 'de': 'Projekt', 'fr': 'Projet', 'it': 'Progetto'}
for lang, m in msgs.items():
    p = f'packages/client/src/i18n/locales/{lang}.json'
    with open(p) as f: d = json.load(f)
    d.setdefault('invoices',{}).setdefault('detail',{})['metaProject'] = m
    with open(p,'w') as f: json.dump(d,f,indent=2,ensure_ascii=False); f.write('\n')
PY
```

- [ ] **Step 3: Typecheck**

```bash
cd /Users/gorkemcetin/atlasmail/packages/client && timeout 180 npx tsc --noEmit 2>&1 | tail -10
```

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/apps/invoices/ packages/client/src/i18n/locales/
git commit -m "feat(invoices): Project select in meta block"
git push origin main
```

---

## Task 15: Client — i18n `work.*` namespace

**Files:**
- Modify: `packages/client/src/i18n/locales/{en,tr,de,fr,it}.json`
- Modify: all `work/components/*.tsx` — replace hardcoded English with `t('work.*')`

- [ ] **Step 1: Add `work.*` keys via Python script**

Keys needed (use actual strings in each locale — draft EN here, translate for others; fall back to EN for the others if you're not sure — user can proofread later):

Sidebar: `sidebar.myTasks`, `sidebar.assignedToMe`, `sidebar.createdByMe`, `sidebar.allTasks`, `sidebar.projects`

Tabs: `tabs.overview`, `tabs.tasks`, `tabs.financials`, `tabs.members`, `tabs.time`, `tabs.files`

Financials: `financials.totalBilled`, `financials.totalPaid`, `financials.outstanding`, `financials.newInvoice`, `financials.empty`, `financials.colNumber`, `financials.colIssueDate`, `financials.colDueDate`, `financials.colTotal`, `financials.colBalance`, `financials.colStatus`

Empty states: `empty.myTasks`, `empty.assigned`, `empty.created`, `empty.allTasks`, `empty.projects`

Common: `loading`, `projectNotFound`

Write the Python script in the same style as Task 4 of the invoice-detail plan. Ensure parity across all 5 locales (use the verify script pattern from that plan).

- [ ] **Step 2: Replace hardcoded strings in components**

Grep for hardcoded English strings in `packages/client/src/apps/work/**/*.tsx`. Replace each with `t('work.*')`. Add `useTranslation()` where missing.

- [ ] **Step 3: Typecheck + parity check**

```bash
cd /Users/gorkemcetin/atlasmail/packages/client && timeout 180 npx tsc --noEmit 2>&1 | tail -10
python3 -c "
import json
langs=['en','tr','de','fr','it']
keys={lang: set(json.load(open(f'packages/client/src/i18n/locales/{lang}.json')).get('work',{}).keys()) for lang in langs}
base=keys['en']
for lang in langs[1:]:
    m=base-keys[lang]; e=keys[lang]-base
    print(f'{lang}: missing={m} extra={e}' if m or e else f'{lang}: OK')
"
```

Expected: each locale prints `OK` at the top level. For nested namespaces, expand the check.

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/i18n/locales/ packages/client/src/apps/work/
git commit -m "i18n(work): add work.* namespace for all 5 locales"
git push origin main
```

---

## Task 16: Remove the old `tasks` and `projects` apps

**Files:**
- Delete: `packages/server/src/apps/tasks/` (directory)
- Delete: `packages/server/src/apps/projects/` (directory)
- Delete: `packages/client/src/apps/tasks/` (directory)
- Delete: `packages/client/src/apps/projects/` (directory)
- Modify: `packages/server/src/apps/index.ts` — drop old registrations
- Modify: `packages/client/src/apps/index.ts` — drop old registrations
- Modify: `packages/server/src/db/schema.ts` — drop `task_projects` pgTable
- Modify: `packages/client/src/config/routes.ts` — drop `TASKS`, `PROJECTS`
- Modify: `packages/client/src/config/query-keys.ts` — drop `tasks`, `projects`
- Modify: `packages/server/src/services/app-permissions.service.ts` — drop `tasks`, `projects`
- Modify: `packages/client/src/components/icons/app-icons.tsx` — drop `TasksIcon`, `ProjectsIcon`

- [ ] **Step 1: Grep for dangling imports**

```bash
cd /Users/gorkemcetin/atlasmail
grep -rn "apps/tasks\|apps/projects\|tasksManifest\|projectsManifest\|TasksIcon\|ProjectsIcon\|taskProjects\|task_projects" packages/ 2>/dev/null | grep -v "apps/work" | grep -v ".d.ts"
```

Every match that's not in `apps/work/` or in the files we're about to delete is a dangling import that must be fixed first.

- [ ] **Step 2: Fix dangling imports**

For each match from step 1, either:
- Update the import to point to `apps/work/*` equivalents
- Delete the import if the consuming code is itself being removed

Common culprits: `command-palette.tsx`, `home.tsx`, `sidebar.tsx`, settings pages.

- [ ] **Step 3: Drop old app registrations**

In `packages/server/src/apps/index.ts`, remove the import and `.register()` call for `tasksServerManifest` and `projectsServerManifest`.

In `packages/client/src/apps/index.ts`, same for `tasksManifest` and `projectsManifest`.

- [ ] **Step 4: Drop old routes and query-keys**

In `packages/client/src/config/routes.ts`, delete `TASKS` and `PROJECTS` constants.
In `packages/client/src/config/query-keys.ts`, delete the `tasks` and `projects` top-level namespaces.

- [ ] **Step 5: Drop old permission entries**

In `packages/server/src/services/app-permissions.service.ts`, remove the `tasks` and `projects` app permission definitions.

- [ ] **Step 6: Drop old icons**

In `packages/client/src/components/icons/app-icons.tsx`, remove `TasksIcon` and `ProjectsIcon` exports and any entries in `BRAND_ICON_BACKGROUNDS` / `FULL_BLEED_BRAND_ICONS` that reference them.

- [ ] **Step 7: Drop `taskProjects` from schema**

In `packages/server/src/db/schema.ts`, remove the `export const taskProjects = pgTable(...)` block entirely.

- [ ] **Step 8: Delete the app directories**

```bash
cd /Users/gorkemcetin/atlasmail
rm -rf packages/server/src/apps/tasks packages/server/src/apps/projects
rm -rf packages/client/src/apps/tasks packages/client/src/apps/projects
```

- [ ] **Step 9: Push schema (drops task_projects table)**

```bash
cd /Users/gorkemcetin/atlasmail/packages/server && npm run db:push
```

Accept the drop prompt if drizzle-kit asks.

- [ ] **Step 10: Typecheck both packages + client build**

```bash
cd /Users/gorkemcetin/atlasmail/packages/server && timeout 180 npx tsc --noEmit 2>&1 | tail -10
cd /Users/gorkemcetin/atlasmail/packages/client && timeout 180 npx tsc --noEmit 2>&1 | tail -15
cd /Users/gorkemcetin/atlasmail/packages/client && timeout 300 npm run build 2>&1 | tail -5
```

All must pass (client clean; server may still show the known `hrEmployees` error).

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "refactor(work): retire tasks and projects apps

All responsibilities absorbed by the new work app. Drops:
- packages/{server,client}/src/apps/{tasks,projects}/
- task_projects table
- TASKS/PROJECTS route constants and query-keys
- TasksIcon/ProjectsIcon
- tasks/projects app-permissions entries"
git push origin main
```

---

## Task 17: End-to-end smoke test

**Files:** none; verification only.

- [ ] **Step 1: Full workspace checks**

```bash
cd /Users/gorkemcetin/atlasmail/packages/client && timeout 180 npx tsc --noEmit 2>&1 | tail -5
cd /Users/gorkemcetin/atlasmail/packages/server && timeout 180 npx tsc --noEmit 2>&1 | tail -5
cd /Users/gorkemcetin/atlasmail/packages/client && timeout 300 npm run build 2>&1 | tail -5
```

- [ ] **Step 2: Manual smoke (dev server)**

Start `npm run dev` in the server and client packages. Then:

1. Navigate to `/work` — should land on My tasks view, sidebar shows four task sections + project list.
2. Click each sidebar task item — URL changes, view changes, no console errors.
3. Click a project in the sidebar — URL changes to `?projectId=<id>`, project detail page renders with six tabs, Overview is default.
4. Click each tab — renders content, URL updates with `&tab=<id>`.
5. On the Financials tab — summary shows three numbers (zeros acceptable for a fresh project), invoices list renders (empty initially).
6. Click "+ New invoice" — navigates to the invoices app's new-invoice flow with the right project/company pre-filled (or at minimum lands on the invoices create surface).
7. Create a new invoice from the invoices app, set its Project select to this project, save. Go back to the project Financials tab — the new invoice appears in the list and the summary numbers update.
8. Create a personal task (no project) as user A. As user B (different account, same tenant), navigate to /work?view=all — the private task must NOT appear. Global search from user B: the task must NOT appear.
9. On user A's All tasks view — the private task DOES appear.
10. On a task that has `projectId`, open it, set it back to no project — in the DB, `is_private` should now be `true`. Verify via psql or via the Project tasks tab no longer listing it.
11. Old URLs `/tasks` and `/projects` should 404 (or redirect to /work if the router has a catch-all — either is acceptable for the hard-cutover pre-launch posture).
12. Open the dock — only the Work icon appears; Tasks and Projects icons are gone.

- [ ] **Step 3: No commit — verification only**

Any failures send you back to the relevant task.

---

## Follow-up polish (out of scope)

- Project profitability chart (billed vs paid over time)
- Task ↔ invoice-line-item data relationship
- Project templates, task templates
- Gantt view, recurring tasks, bulk operations
- Proper WorkIcon brand SVG (placeholder is acceptable for v1)
- "Create task" button polish on each view (reuses existing task-create flow)

---

## Risks

1. **Migration ID collisions** — handled by the rewrite fallback in Task 2.
2. **Privacy predicate miss** — every new task-reading query must use `readableTasksFilter(userId)`. During code review, grep for `.from(tasks)` in non-test files and confirm each call site applies the filter.
3. **Global-search atomicity** — Task 9 replaces the old branches with the work branch in one commit. Don't split.
4. **Invoice `projectId` nullability** — Financials summary handles zero-invoice case with zeros.
5. **Permission migration** — the one-shot tenantApps migration (Task 2) de-dups tenants that had both `tasks` and `projects` enabled.
6. **Hard cutover costs** — old bookmarks break. Pre-launch, this is fine per CLAUDE.md.
