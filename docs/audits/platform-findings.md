# Platform Findings Ledger

Cross-cutting patterns surfaced during module audits. Entries here are hypotheses or confirmed patterns that affect 2+ modules.

**Promotion rule**: a finding only lives here if it's a *pattern* (likely to recur). Local findings stay in the module report. Rules confirmed in 2+ modules graduate to `best-practices.md`.

---

## Ledger

| ID | Source module | Dimension | Pattern / check | Modules affected | Fix location | Status |
|----|---------------|-----------|-----------------|------------------|--------------|--------|
| P-1 | CRM | 2 | useMutation definitions lack a default `onError`; error surfacing is opt-in per call site. Grep: `useMutation({` in `**/hooks.ts` — if no `onError` key, any forgetful caller gets a silent failure. | CRM (60+) | Fixed centrally: `packages/client/src/providers/query-provider.tsx` now has a `defaultMutationErrorHandler` that shows a toast. | fixed-centrally |
| P-2 | CRM | 8 | Hard-delete (`db.delete(...)`) on user-created data that should soft-delete. Grep: `db\.delete\(` in every `services/*.service.ts` — every hit is a candidate. | CRM (lead forms, saved views); HRM (expense categories, expense policies) | Per-entity fix (add `isArchived` column + switch delete to update). | pattern |
| P-3 | CRM | 5 | Entities with `updatedAt` column but no `withConcurrencyCheck` on PATCH/PUT route. Grep: every `routes.ts` — find `router.patch\|router.put` lines without `withConcurrencyCheck`. Cross-reference the table in DB — if it has `updatedAt`, concurrency should be wired. | CRM (stage, proposal, workflow, note); HRM (departments, leave types, leave policies, leave applications, expenses, expense reports, expense categories, expense policies) | Per-entity fix (client hook forwards `updatedAt`, server route wraps with `withConcurrencyCheck`). | pattern |
| P-4 | HRM | 2 | Query hooks handle `isLoading` with a skeleton but no `isError` fallback. On a GET failure the view silently renders empty. Grep: list/dashboard components with `const { data, isLoading } = useX()` and no `isError` branch. | HRM (15 views wired); Sign (list + templates + editor-fields) | Fixed centrally: `packages/client/src/components/ui/query-error-state.tsx`. Retro-apply to every already-audited module. | pattern (CRM retro-scan pending) |

---

## How to add an entry

1. After a module sign-off, review its findings.
2. For each finding ask: "Would I expect this in other Atlas modules?"
3. If yes → copy it here with a grep pattern or repro rule precise enough that another auditor can find it mechanically.
4. Retro-scan every already-audited module for the pattern; append confirmed hits to the "Modules affected" column.

## Status values

- `hypothesis` — found in 1 module, not yet confirmed elsewhere.
- `pattern` — confirmed in 2+ modules.
- `rule` — confirmed in 3+ modules; belongs in `best-practices.md` (and eventually `CLAUDE.md`).
- `fixed-centrally` — a shared component/hook/middleware now enforces the rule; retro-fix tasks tracked per-module.
