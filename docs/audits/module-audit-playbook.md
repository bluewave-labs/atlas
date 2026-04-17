# Atlas Module Audit Playbook

A repeatable process for auditing each Atlas app end-to-end. Every module follows the same rubric, produces the same report shape, and feeds findings back into platform-wide fixes.

---

## Goals

- **Reproducible** — re-auditing a module six months later produces comparable results.
- **Compounding** — each module audit is faster than the last because patterns accumulate in `platform-findings.md` and `best-practices.md`.
- **Honest** — severity is objective, not vibes. Evidence (file:line, repro steps, screenshots) is required.
- **Focused** — one module per session, golden path before polish, blockers before nice-to-haves.

---

## Artifacts

| File | Purpose |
|------|---------|
| `module-audit-playbook.md` (this doc) | The rubric and process. Stable — revised only between modules. |
| `platform-findings.md` | Ledger of cross-cutting patterns. Grows after every module. |
| `best-practices.md` | Rules promoted from confirmed patterns (2+ modules). Graduates into `CLAUDE.md` over time. |
| `modules/{module}.md` | Per-module report. One per app. |

---

## Severity — two levels only

- **fix-before-ship** — the module cannot be considered audited while this is open. Blocks sign-off.
- **nice-to-have** — logged, may be deferred indefinitely.

Three levels invite debate ("is this a warning or minor?") without changing what actually gets fixed. Two levels force a decision.

---

## The 12 dimensions

Every module is audited against these. Each dimension has a **definition** (what passes), a **check** (how to test it), and a **severity rule** (when to fail).

### 1. Golden-path workflow
- **Pass**: a user can complete the app's core job end-to-end without dead ends, silent failures, or undocumented steps.
- **Check**: walk the workflow in a real browser with a fresh account. Record every action, every screen, every API call.
- **Severity**: any dead end or silent failure in the golden path = fix-before-ship.

### 2. Empty / loading / error states
- **Pass**: every list, detail, and mutation handles empty, loading, and error visibly.
- **Check**:
  - Every `useQuery` has `isLoading` → skeleton AND `isError` → user-visible fallback.
  - Every `useMutation` has `onSuccess` → toast AND `onError` → toast with server error message.
  - Every list has an `EmptyState` with a primary CTA.
- **Severity**: missing loading state or silent error = fix-before-ship. Missing empty CTA = nice-to-have.

### 3. Input & data correctness
- **Pass**: forms validate client-side, server rejects bad data with a readable error, soft-delete (`isArchived`) works, no orphaned rows, large datasets (1000+ rows) don't freeze the UI.
- **Check**:
  - Required fields marked; type coercion for numbers/dates; cross-field rules (start < end) enforced.
  - Every delete path sets `isArchived = true`, never `DELETE FROM`.
  - List views use virtualization or pagination above 500 rows.
- **Severity**: hard delete of user data = fix-before-ship. Missing client-side validation where server also validates = nice-to-have.

### 4. Auth & permission scoping
- **Pass**: every query filters by `accountId`; 401/403 surfaces a readable message; disabled apps return 403 at the route; cross-tenant access is impossible.
- **Check**:
  - Grep service files for any `db.select().from(table)` missing `eq(table.accountId, ...)`.
  - Routes use `requireApp(appId)` middleware.
  - 403 responses render something the user can act on.
- **Severity**: any missing `accountId` scope = fix-before-ship (data leak).

### 5. Optimistic concurrency
- **Pass**: every update mutation passes `updatedAt`; server uses `withConcurrencyCheck(table)`; 409 fires the global `ConflictDialog`.
- **Check**:
  - Grep update mutations for `ifUnmodifiedSince(updatedAt)`.
  - Grep server routes for `withConcurrencyCheck`.
  - Test by editing the same record in two tabs.
- **Severity**: missing concurrency on a shared-edit entity = fix-before-ship. Missing on a user-only entity (e.g. personal settings) = nice-to-have.

### 6. i18n completeness
- **Pass**: no hardcoded English in user-visible strings; all 5 locales (EN/TR/DE/FR/IT) have all keys used by the module.
- **Check**:
  - Grep component files for user-facing string literals not wrapped in `t()`.
  - Diff the module's key namespace across all 5 locale files.
- **Severity**: missing key in any locale = fix-before-ship. Hardcoded string in a rarely-used admin surface = nice-to-have.

### 7. Cross-app linking
- **Pass**: `recordLinks` resolve both directions; `SmartButtonBar` shows the right badges on detail pages; broken links (target deleted/archived) don't crash the UI.
- **Check**: create a link, navigate both directions, archive the target, reload.
- **Severity**: crash on broken link = fix-before-ship. Missing SmartButtonBar on a detail page = nice-to-have.

### 8. Destructive action safety
- **Pass**: every destructive action routes through `<ConfirmDialog>`; no `window.confirm` / `window.alert`; soft-delete is preferred; undo exists where cheap.
- **Check**:
  - Grep module for `window.confirm`, `window.alert`, `confirm(`.
  - Grep for delete/archive actions without a `ConfirmDialog` wrapper.
- **Severity**: destructive action without confirmation = fix-before-ship. Missing undo = nice-to-have.

### 9. Keyboard & focus
- **Pass**: tab order is linear and logical; Esc closes modals; focus returns to the trigger after modal close; Enter submits single-input forms; visible focus rings on all interactive elements.
- **Check**: keyboard-only walk of the golden path.
- **Severity**: focus trap missing in a modal = fix-before-ship. Missing focus ring on a button = nice-to-have.

### 10. Navigation & deep linking
- **Pass**: every view has a shareable URL; browser back/forward works; refreshing a detail page lands on the same record; search params survive navigation where they should.
- **Check**: copy URL from every distinct view, paste in new tab, verify it renders the same state. Test back/forward.
- **Severity**: refresh loses state on a detail page = fix-before-ship. Minor search-param drift = nice-to-have.

### 11. Search & filters
- **Pass**: global search returns this app's records; filters persist across navigation within the app; clearing a filter actually clears; combining filters is additive (AND), not exclusive.
- **Check**:
  - Global search includes the module in `global-search.service.ts` UNION ALL.
  - Apply filters, navigate away, navigate back — filters still applied.
  - Clear filters button exists and works.
- **Severity**: global search missing = fix-before-ship. Filter state lost on navigation = nice-to-have.

### 12. Performance smoke test
- **Pass**: initial page load < 2s on cached visit; no N+1 queries in server logs; a list with 1000 rows doesn't hang scrolling.
- **Check**:
  - Chrome DevTools Network + Performance panels on cold + warm loads.
  - Seed 1000+ rows, scroll, search.
  - Inspect server logs for repeated queries inside a single request.
- **Severity**: UI hangs > 2s on a reasonable dataset = fix-before-ship. Suboptimal but usable = nice-to-have.

---

## Pre-flight spot-check (before Phase A)

Not a dimension — a 5-minute grep pass that catches the cheap stuff so the real audit focuses on workflow:

- Shared components used? (`<Button>` not `<button>`, `<Input>` not `<input>`, etc.)
- Size prop `sm` in data views, `md` in auth/setup?
- CSS variables not hex colors?
- No `localStorage` for settings that should roam across devices?
- Registered in both `client/apps/index.ts` and `server/apps/index.ts`?
- Query keys namespaced in `config/query-keys.ts`?

---

## Process — phases A through G

### Phase A — Map

An Explore agent walks the module and produces the workflow graph:
- Every user action (create/read/update/delete/archive/export/import/link/share)
- The files involved (page, components, hooks, service, controller, routes)
- The API endpoints
- The DB tables

Deliverable: `Workflow map` section in `modules/{module}.md`.

### Phase B — Audit

Run all 12 dimensions against the rubric. Each finding is logged in the module's findings table with:

`id | dimension | severity | file:line | evidence | proposed fix | status`

Deliverable: `Findings` table in `modules/{module}.md`.

### Phase C — Triage

Present findings in batches:
- fix-before-ship blockers shown first
- nice-to-have findings shown second

User approves/defers each batch. Batched approval by default; item-by-item on request.

Deliverable: each finding marked `approved-fix`, `deferred`, or `won't-fix` with reason.

### Phase D — Fix

One commit per finding (or tight group of findings). Each fix must:
- Type-check clean (`npx tsc --noEmit`)
- Build clean (`npm run build` in client and server)
- Keep tests green

### Phase E — Verify

Manual golden-path walk in a real browser after fixes. I drive Chrome via automation and record pass/fail for each dimension; user spot-checks before sign-off.

Deliverable: `Verification` section in `modules/{module}.md` with pass/fail per dimension.

### Phase F — Sign-off

Module report marked `SIGNED OFF: YYYY-MM-DD` at the top. All `fix-before-ship` findings closed. Nice-to-haves remain in the findings table with status `deferred`.

### Phase G — Propagate

After sign-off, review every finding and classify:

- **Local** — specific to this module only. Stays in the module report.
- **Pattern** — hypothesis that it affects other modules. Promote to `platform-findings.md` with a grep pattern or repro rule. Retro-scan already-audited modules.
- **Platform** — needs a shared component/hook/middleware. Create a task and fix once, centrally.

**Promotion rule**: do not promote a finding to `best-practices.md` until it is confirmed in at least 2 modules. One module = hypothesis. Two = pattern. Three = rule for `CLAUDE.md`.

If a platform-level fix is identified, build it now — don't wait for all 11 audits to finish.

---

## Module order

1. CRM (pilot — see below)
2. HRM
3. Sign
4. Invoices
5. Work (Projects + Tasks)
6. Calendar
7. Drive
8. Write
9. Draw
10. System

---

## Pilot — CRM

The playbook is untested. Running all 12 dimensions on the first module risks finding out later that the process is wrong.

**Pilot scope for CRM**: dimensions **1, 2, 5, 8** only.
- 1: Golden-path workflow
- 2: Empty / loading / error states
- 5: Optimistic concurrency
- 8: Destructive action safety

After CRM pilot, revise this playbook based on what went wrong. Then run the full 12 on HRM onward.

---

## Operating defaults

- **Browser verification**: I drive Chrome automation; user spot-checks before sign-off.
- **Triage style**: batched approval; item-by-item on request.
- **Done criteria**: pragmatic — blockers fixed, patterns logged (fix deferrable), golden path green.
- **Report location**: in-repo (`docs/audits/`), public. If sensitive findings surface, escalate immediately rather than hiding them by default.
- **Rhythm**: one module per audit session.
- **Report authorship**: agent-written, user-reviewed.

---

## Module report template

See `modules/_template.md` — copy into `modules/{module}.md` at the start of each audit.
