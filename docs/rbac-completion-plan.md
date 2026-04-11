# RBAC completion plan

Status: draft for review
Owner: tbd
Related: RBAC audit completed 2026-04-11 (commits 151a6dd → ae8ae21)

## Context

The RBAC refactor landed the core machinery across 10 apps:
- `ROLE_MATRIX` with `admin | editor | viewer` × 5 operations
- `requireAppPermission(appId, op)` middleware factory attaching `req.{app}Perm`
- `isAdminCaller(perm)` helper for admin-with-tenant-scope checks
- Ownership gating via `assertCanDelete`
- Client `useAppActions(appId)` hook
- Per-app data leaks fixed (Invoices PDF, Projects reports, Sign tenant scope, Tables tenant migration, etc.)

This doc plans the 5 remaining items needed to call RBAC "done" for production.

## Scope

1. Role-matrix test coverage (regression prevention)
2. Unified permission admin UI (biggest UX hole)
3. Permission change audit log (compliance table stakes)
4. Global search scope filtering (subtle data leak)
5. Generalize permission admin controller (eliminates per-app boilerplate)

Out of scope (deferred to later): stringly-typed role literals, client/server role-matrix drift, entity-level overrides, public token registry, Calendar server-side RBAC.

---

## Item 1 — Role-matrix test coverage

**Problem:** Every controller test mocks `{app}Perm: { role: 'admin', recordAccess: 'all' }` as the default. Viewer, editor, and `recordAccess: 'own'` paths are never exercised. A regression that lets a viewer write something would pass CI.

**Goal:** For every app, prove — via tests — that each role × operation combination produces the expected outcome.

**Approach:** one parametrized test file per app, driven by a table:

```ts
// packages/server/test/rbac-matrix.{app}.test.ts
const cases = [
  { role: 'viewer',  op: 'GET /tables',        expect: 200 },
  { role: 'viewer',  op: 'POST /tables',       expect: 403 },
  { role: 'editor',  op: 'POST /tables',       expect: 200 },
  { role: 'editor',  op: 'DELETE /tables/:id', expect: 403, owner: 'other' },
  { role: 'editor',  op: 'DELETE /tables/:id', expect: 200, owner: 'self'  },
  { role: 'admin',   op: 'DELETE /tables/:id', expect: 200, owner: 'other' },
  // ...
];
```

**Deliverables:**
- `packages/server/test/rbac-matrix.{app}.test.ts` for each of the 10 apps (10 files)
- Shared test helper `packages/server/test/helpers/rbac-harness.ts` that builds `req` with a given role/recordAccess and invokes the controller
- CI-green with the full matrix

**Size estimate:** 1–1.5 days. Most time is in writing the cases; the harness is ~30 lines.

**Risk:** Some controllers import service modules with side effects (e.g. email, cron). The harness should mock the services, not exercise them end-to-end. Otherwise tests get slow and flaky.

**Done when:** `npx vitest run` includes per-app matrix tests and they fail if anyone loosens `canAccess` or drops a middleware check.

---

## Item 2 — Unified permission admin UI

**Problem:** There is no UI to assign per-user, per-app roles. Today the tenant owner has to either rely on default (`owner/admin` → admin, else editor) or poke `app_permissions` directly in psql. CRM has a partial UI at `/crm/settings` that only covers CRM.

**Goal:** A single page `/organization/permissions` (or `/system/permissions`) where the tenant owner sees a matrix of **users × apps** with dropdowns for `role` and `record access`, editable inline.

**UX sketch:**

```
                 CRM        HR         Projects   Invoices   Sign
Alice (owner)    admin/all  admin/all  admin/all  admin/all  admin/all
Bob              [editor▾]  [viewer▾]  [editor▾]  [viewer▾]  [editor▾]
                 [all▾]     [own▾]     [all▾]     [own▾]     [all▾]
Carol            ...
```

- Rows = tenant members (from `tenant_members`)
- Columns = enabled apps for this tenant (from `tenant_apps` + `serverAppRegistry`)
- Each cell shows current role; clicking opens a small inline popover with role + record access
- Owner row is read-only (owners are always admin/all)
- Changes save on blur; optimistic UI, toast on error

**Server-side:** already exists as `getAppPermission` + `setAppPermission` in `app-permissions.service.ts` lines 23, 100. Only needs a batch-read endpoint:

```
GET  /permissions                 → list all (user, appId, role, recordAccess) for current tenant
PUT  /permissions/:userId/:appId  → { role, recordAccess }
DELETE /permissions/:userId/:appId → revert to tenant-default
```

**Client-side:**
- New page `packages/client/src/apps/system/components/permissions-view.tsx` (or under organization settings)
- Route added to System manifest
- React Query hook `useAppPermissions()` + `useSetAppPermission()` mutation
- Reuses `<Select>` from `components/ui/select.tsx`, sizes `sm`

**Gating:** only tenant owner can view/edit (`req.auth!.tenantRole === 'owner'`).

**Deliverables:**
- `packages/server/src/apps/system/permissions.controller.ts`
- `packages/server/src/apps/system/routes.ts` — 3 new routes under `/system/permissions`
- `packages/client/src/apps/system/components/permissions-view.tsx`
- `packages/client/src/apps/system/hooks.ts` — 2 new hooks
- Translation keys in all 5 locales under `system.permissions.*`
- Matrix test in Item 1 should cover the new endpoints

**Size estimate:** 2–3 days.

**Risk:**
- Bulk-read across all users × apps could be N²; make it one JOIN query against `app_permissions` with a LEFT JOIN on `tenant_members`.
- Need to decide: if a user has no row in `app_permissions`, do we display the *derived* default ("editor/all for non-privileged") or "unset"? Recommend: display the derived default, but track in the UI that it's inherited (grey text) vs explicit (black).

**Done when:** a tenant owner can log in, go to `/organization/permissions`, set Bob to `viewer/own` on Projects, log in as Bob in an incognito window, and see that Bob can only view his own projects with no edit UI.

---

## Item 3 — Permission change audit log

**Problem:** `app_permissions` has `createdAt`/`updatedAt` but no history. Who changed whose role and when is not recorded. For SOC2/SOX compliance this is table stakes.

**Goal:** Every permission change (insert, update, delete) writes a row to a new `app_permission_audit` table. Surfaced in the same admin UI from Item 2 as a "History" tab.

**Schema:**

```sql
CREATE TABLE app_permission_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  target_user_id UUID NOT NULL,  -- whose permission changed
  actor_user_id UUID NOT NULL,   -- who made the change
  app_id VARCHAR(50) NOT NULL,
  action VARCHAR(20) NOT NULL,   -- 'grant' | 'revoke' | 'update'
  before_role VARCHAR(20),       -- null for grant
  before_record_access VARCHAR(10),
  after_role VARCHAR(20),        -- null for revoke
  after_record_access VARCHAR(10),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_app_permission_audit_tenant_created
  ON app_permission_audit (tenant_id, created_at DESC);
CREATE INDEX idx_app_permission_audit_target_user
  ON app_permission_audit (tenant_id, target_user_id);
```

**Server wiring:**
- `setAppPermission` in `app-permissions.service.ts` gains an `actorUserId` parameter
- Inside the transaction, writes an audit row alongside the insert/update
- New read function `listPermissionAudit(tenantId, filters?)` with pagination

**Retention:** indefinite (SOC2 evidence). Auditors want 1+ year minimum; disk is cheap.

**UI (under Item 2's permissions page):**
- "History" tab showing the last 100 changes, filterable by target user and app
- Each row: "Alice granted Bob editor/all on Projects — 2026-04-12 14:32"

**Deliverables:**
- Schema + migration in `db/schema.ts` and `db/migrate.ts`
- `setAppPermission(tenantId, userId, appId, role, recordAccess, actorUserId)` signature change
- `listPermissionAudit` service function
- `GET /system/permissions/audit` endpoint
- History tab in the permissions view
- Matrix test for the audit writes

**Size estimate:** 1 day.

**Risk:**
- `setAppPermission` signature change ripples through any caller. Currently there's one caller (CRM settings). The unified admin UI will call it. Both must pass `actorUserId`.
- First-run seed (`POST /auth/setup`) calls `setAppPermission` implicitly via tenant-member creation — should we audit "system" actions? Recommend: skip audit when `actorUserId === targetUserId === tenant owner during setup`, otherwise always audit.

**Done when:** changing Bob's role produces a visible audit row with actor, target, before, after, timestamp.

---

## Item 4 — Global search scope filtering

**Problem:** `packages/server/src/services/global-search.service.ts` does a UNION ALL across tables and filters by `accountId` only. Non-admins in Projects/Invoices/etc. should see only records they're scoped to. Today the search returns everything in the account, and the user only hits 403 when they click through.

**Goal:** Every search source respects the caller's per-app `recordAccess`.

**Approach:**

Option A — Filter at the SQL level per source
Each UNION ALL branch gains an extra WHERE condition when the caller is non-admin in that app:

```sql
SELECT id, 'project' AS type, title FROM project_projects
WHERE account_id = :accountId
  AND (
    :isAdmin_projects
    OR user_id = :userId
    OR EXISTS (SELECT 1 FROM project_members WHERE ...)
  )
UNION ALL
SELECT id, 'invoice' AS type, title FROM invoices
WHERE account_id = :accountId
  AND (:isAdmin_invoices OR user_id = :userId)
-- ...
```

Option B — Post-filter in Node
Fetch all results, then filter against per-app permissions. Simpler but leaks data to the app server and discards work.

**Recommendation:** Option A. It's verbose but keeps the DB doing the filtering and matches how we scope elsewhere.

**Implementation:**
- `globalSearch.service.ts` takes `permissions: Map<appId, ResolvedAppPermission>` and builds the WHERE clauses per source
- Controller resolves permissions for all apps once at the top of the handler (one query: `SELECT * FROM app_permissions WHERE tenant_id = ? AND user_id = ?`) and passes the map
- Default (no row) follows the `getAppPermission` derivation (privileged → admin/all, else editor/all)

**Deliverables:**
- Rewrite of `globalSearch.service.ts` to accept the permissions map
- Controller update to build the map
- Matrix test: viewer searches for a term they shouldn't see and gets no results

**Size estimate:** 0.5–1 day.

**Risk:**
- Search currently supports ~10 record types across 8 apps. Each needs its own scope branch. Easy to forget one.
- Fuzzy matching/ranking needs to happen after scoping, not before.

**Done when:** viewer Carol searches "Q2 budget" and only sees records she has access to, not 403-baited links.

---

## Item 5 — Generalize permission admin controller

**Problem:** The CRM admin UI has its own permission controller at `packages/server/src/apps/crm/permission.controller.ts`. It predates the unified `app_permissions` store and is CRM-specific. Adding a new app today means writing a new permission admin controller (or leaving that app's permissions un-editable via UI).

**Goal:** A single generic permission admin controller driven by the `serverAppRegistry`. Every app in the registry gets permission management for free.

**Approach:**

This is mostly obsoleted by Item 2. The unified permissions UI reads `serverAppRegistry` directly and shows every enabled app. The generic controller is just the server-side of that UI. Items 2 and 5 should be implemented together — don't build them twice.

**What this item specifically adds on top of Item 2:**
- Delete `packages/server/src/apps/crm/permission.controller.ts` and its route
- Delete the CRM-specific permissions UI at `packages/client/src/apps/crm/components/permissions-view.tsx` (or whatever it's named)
- Point any links that previously went to the CRM permissions page at the new unified page
- Verify no references remain via grep

**Deliverables:**
- Files deleted (list emerges during implementation)
- Migration note: if users have bookmarked the old CRM permissions URL, add a redirect

**Size estimate:** 0.5 day, folded into Item 2.

**Risk:** low — it's pure deletion after Item 2 lands.

**Done when:** grep for `crm.*permission.*controller` returns zero results, and the unified UI covers CRM (which it already does since CRM is in the registry).

---

## Sequencing

Recommended order:

1. **Item 1 (matrix tests)** — must be first. It's the safety net that catches regressions introduced by the other items.
2. **Item 2 + Item 5 together** — unified admin UI, built on top of a generalized controller. The matrix tests from #1 exercise the new endpoints.
3. **Item 3 (audit log)** — wires into the `setAppPermission` path that #2 uses. Depends on #2 so the UI has somewhere to display history.
4. **Item 4 (search scope)** — independent of #2/#3; can run in parallel with them. Scheduled last because it touches the most files and is the lowest impact of the 5.

Total: ~6 days of focused work, or ~2 weeks calendar time with review + integration.

## Open questions for review

1. **Audit retention policy** — indefinite, or purge after N years?
2. **Owner role in the matrix** — do we display the tenant owner as "admin/all" (read-only) in the permissions UI, or hide them entirely?
3. **Default permission display** — show derived defaults (editor/all) as inherited/grey, or force the user to set every cell explicitly?
4. **Search UX** — if viewer Carol has different access across apps, do we still show the "Projects" tab in search even if she'd get zero results? Or hide the tab?
5. **Migration path for existing CRM permissions UI users** — is there any live deployment using the CRM-specific permissions page that would break? (Likely not, but worth confirming before deleting.)

---

## System actor

Background jobs run outside the request/response lifecycle and therefore
outside RBAC. The reminder scheduler, recurring invoice generator, email
worker, and any cron tasks invoke service functions directly — there is no
`req.auth`, no tenant role, no permission lookup. These paths intentionally
bypass the middleware factory and are trusted to scope by `tenantId` /
`accountId` explicitly.

Once the permission-change audit log (Item 3) lands, we will need to
represent system-initiated writes in audit rows. The proposed convention:

- Introduce an `actor_type` column (`'user' | 'system'`) on the audit table,
  or reserve a sentinel `actor_user_id = 'system'` / null row.
- Background jobs pass `actorUserId: null, actorType: 'system'` into the
  permission/audit service.
- The history UI renders system rows with a distinct label ("System" with
  an icon) so operators can tell cron-triggered changes from human ones.

No code change today — captured here so whoever builds the audit log does
not have to rediscover the requirement.

---

## Public tokens

Atlas currently has three independent public-token mechanisms that let an
unauthenticated caller access a specific resource:

- **Drive share links** — `drive_share_links` table. Issued and validated by
  `packages/server/src/apps/drive/controllers/sharing.controller.ts`. Each
  row carries its own `share_token`, optional expiry, and per-link ACL.
- **Sign signing tokens** — `signing_tokens` table (see
  `packages/server/src/db/schema.ts` at line 968). Scoped to a specific
  `signature_documents` row and signer email; single-use, time-boxed.
- **CRM proposal public tokens** — `crm_proposals.public_token`. Used for
  the public proposal-view URL; one token per proposal, no revocation UI.

Each mechanism rolls its own tokenization, expiry, and lookup. There is no
unified registry, no "revoke all tokens for user X" view, and no audit of
who fetched which token. That is acceptable for now because the three
surfaces have meaningfully different threat models and the per-table indexes
are fine at single-tenant scale. When we need compliance-grade revocation,
collapse them into a single `public_tokens(kind, resource_id, token, ...)`
table with a shared service.

---

## Calendar RBAC note

The Calendar app is currently client-only — there is no
`packages/server/src/apps/calendar/` directory. Events live in the browser
and per-user settings only. As a result, it has no server-side permission
matrix, no middleware registration, and no tenant-scoped reads.

If Calendar ever gains server-backed shared calendars (team calendars,
booking pages, resource calendars), it needs the full RBAC treatment:
matrix entry in `ROLE_MATRIX`, `requireAppPermission('calendar', op)`
middleware on every route, and `recordAccess` scoping inside the service
layer. Don't ship a server Calendar app without landing this first.
