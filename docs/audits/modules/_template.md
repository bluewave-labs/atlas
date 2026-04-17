# {Module} Audit Report

**Module ID**: `{id}`
**Audit started**: YYYY-MM-DD
**Audit completed**: _in progress_
**Sign-off**: _pending_
**Pilot / Full**: _Full_ (or _Pilot (dimensions 1, 2, 5, 8 only)_)

---

## Pre-flight spot-check

- [ ] Shared UI components used (no raw HTML elements)
- [ ] Size `sm` in data views, `md` in auth/setup
- [ ] CSS variables (no hex colors)
- [ ] No `localStorage` for roaming settings
- [ ] Registered in client + server `apps/index.ts`
- [ ] Query keys namespaced in `config/query-keys.ts`

Notes: _…_

---

## Workflow map

### User actions
- …

### Files
- **Client**: `packages/client/src/apps/{id}/`
  - `page.tsx`
  - `manifest.ts`
  - `hooks.ts`
  - `components/…`
- **Server**: `packages/server/src/apps/{id}/`
  - `service.ts`
  - `controller.ts`
  - `routes.ts`
  - `manifest.ts`

### API endpoints
| Method | Path | Handler |
|--------|------|---------|
| | | |

### DB tables
- …

---

## Findings

| ID | Dimension | Severity | File:line | Evidence | Proposed fix | Status |
|----|-----------|----------|-----------|----------|--------------|--------|
| | | | | | | |

Severity: `fix-before-ship` | `nice-to-have`
Status: `open` | `approved-fix` | `fixed` | `deferred` | `won't-fix`

---

## Verification (post-fix)

| Dimension | Result | Evidence / notes |
|-----------|--------|------------------|
| 1. Golden-path workflow | | |
| 2. Empty/loading/error states | | |
| 3. Input & data correctness | | |
| 4. Auth & permission scoping | | |
| 5. Optimistic concurrency | | |
| 6. i18n completeness | | |
| 7. Cross-app linking | | |
| 8. Destructive action safety | | |
| 9. Keyboard & focus | | |
| 10. Navigation & deep linking | | |
| 11. Search & filters | | |
| 12. Performance smoke test | | |

Result values: `pass` | `fail` | `n/a` | `deferred`

---

## Propagation (Phase G)

Findings classified:
- **Local** (stay here): _…_
- **Pattern** (promoted to `platform-findings.md`): _…_
- **Platform** (shared fix built): _…_

---

## Sign-off

- [ ] All `fix-before-ship` findings closed
- [ ] Golden path walked end-to-end with fresh account
- [ ] Nice-to-have findings logged with status
- [ ] Propagation complete (Phase G)
- [ ] Module report marked SIGNED OFF at top

Signed off by: _…_
Date: YYYY-MM-DD
