# Sign (Agreements) Audit Report

**SIGNED OFF: 2026-04-16**

**Module ID**: `sign`
**Audit started**: 2026-04-16
**Audit completed**: 2026-04-16
**Sign-off**: 2026-04-16
**Pilot / Full**: _Full_ (12 dimensions)

---

## Pre-flight spot-check

- [x] Shared UI components used (no raw `<button>`, `<input>`, `<select>`, `<textarea>` inside `apps/sign/`)
- [x] Size alignment — list view uses `sm` controls, modals use `md` (spot-checked)
- [x] CSS variables — no hex colors inside component markup; hex values in `page.tsx` are icon color props (sidebar decoration), acceptable
- [x] No `localStorage` usage inside `apps/sign/`
- [x] Registered in both `client/apps/index.ts` and `server/apps/index.ts`
- [x] Query keys namespaced under `queryKeys.sign.*`
- [x] Global search UNION includes `signature_documents` (`global-search.service.ts:128–137`)

---

## Workflow map

### User actions
- Upload PDF → create draft agreement (`sign-list-view.tsx`)
- Add/edit signature fields on PDF pages (`sign-editor-view.tsx`)
- Add signers (email + role), choose sign-in-order, set expiry (`sign-send-modal.tsx`)
- Send for signing → issues unique `signing_tokens`, emails signer (`reminder.ts`, `email.ts`)
- Public sign flow (no auth) — `GET/POST /public/:token` (sign, decline, view PDF)
- Send reminder per token
- Void document
- View audit log timeline
- Create / delete / use template
- Save draft as template
- Update document metadata (title, tags, documentType, counterparty)

### Files
- **Client**: `packages/client/src/apps/sign/`
  - `page.tsx`, `manifest.ts`, `hooks.ts`
  - `lib/use-sign-page-state.ts` — centralised view/filters/mutations state
  - `lib/helpers.ts`
  - `components/` — sign-list-view, sign-editor-view, sign-send-modal, sign-signers-modal, sign-templates-view, sign-audit-view, signature-modal, pdf-viewer, signer-panel, field-overlay, sign-field-toolbar, field-properties-panel, settings/general-panel
  - `widgets/sign-widget.tsx`
- **Server**: `packages/server/src/apps/sign/`
  - `routes.ts`, `controller.ts` (barrel), `service.ts` (barrel), `manifest.ts`, `email.ts`, `reminder.ts`
  - `controllers/documents.controller.ts`, `controllers/fields-public.controller.ts`, `controllers/settings.controller.ts`
  - `services/documents.service.ts`, `services/fields-tokens.service.ts`, `services/templates.service.ts`, `services/settings.service.ts`

### API endpoints
33 routes. Public (4): `/public/:token` GET/sign/decline/view. Authenticated (29): widget, settings GET/PATCH, seed, reminders/send, templates CRUD, documents CRUD + upload + view/download/void/audit/save-as-template, fields CRUD, tokens create/list/remind.

### DB tables
| Table | `updatedAt` | `isArchived` | Concurrency wired |
|-------|-------------|--------------|-------------------|
| `signature_documents` | yes | yes | yes (PUT `/:id`) |
| `signature_fields` | yes | no | **no** (PUT `/fields/:fieldId`) |
| `signing_tokens` | yes | no | no (remind mutates `lastReminderAt`) |
| `sign_audit_log` | no (createdAt only) | no | n/a (append-only) |
| `sign_templates` | yes | yes | n/a (no update route) |
| `sign_settings` | yes | no | no (PATCH `/settings`) |

---

## Retro-scan against platform patterns (before dimension audit)

| Pattern | Result | Evidence |
|---------|--------|----------|
| **P-2** hard-delete of user data | **Clean** | `deleteDocument` soft-deletes (`documents.service.ts:230`). `deleteTemplate` soft-deletes (`templates.service.ts:294`). Only hard-delete is `signatureFields` on explicit field removal (configuration, not content) — acceptable. |
| **P-3** missing `withConcurrencyCheck` | **1 hit + 2 minor** | `routes.ts:94` PUT `/fields/:fieldId` unwrapped; table has `updatedAt`. Also `/settings` PATCH and remind endpoint — see S5-2/S5-3. |
| **P-4** queries without `isError` fallback | **Confirmed** | `lib/use-sign-page-state.ts:68–73` destructures `isLoading` from 2 queries; zero `isError` or `QueryErrorState` imports in `apps/sign/`. |

---

## Findings

| ID | Dimension | Severity | File:line | Evidence | Proposed fix | Status |
|----|-----------|----------|-----------|----------|--------------|--------|
| S2-1 | 2. Empty/loading/error | fix-before-ship | `apps/sign/lib/use-sign-page-state.ts:68–73`; `apps/sign/page.tsx` | 6 query hooks feed the page; none exposed `isError`. Silent-empty on GET failure (P-4). | Forwarded `isError`/`refetch` from `useSignDocuments`, `useSignFields`, `useTemplates` via `use-sign-page-state`. Rendered `<QueryErrorState>` branch in `page.tsx` for list / editor-fields / templates views. Pattern from HRM retro-fix. | fixed |
| S3-1 | 3. Input & data correctness | nice-to-have | `sign-send-modal.tsx` | Signer email not validated client-side before submit; server is the only gate. Users can fire a send with a typo and get a generic failure. | Add minimal regex check on signer rows before enabling Send. | open |
| S5-1 | 5. Optimistic concurrency | nice-to-have | `routes.ts:94` + `services/fields-tokens.service.ts:updateField` | PUT `/fields/:fieldId` missing `withConcurrencyCheck(signatureFields)`. Table has `updatedAt`. Low real-world collision risk (single-sender pre-send workflow). | Wrap route with `withConcurrencyCheck(signatureFields)`; forward `updatedAt` from client `useUpdateField`. | open |
| S5-2 | 5. Optimistic concurrency | nice-to-have | `routes.ts:63` PATCH `/settings` | `sign_settings` has `updatedAt`; PATCH unwrapped. Tenant settings are admin-edited so collisions are rare. | Add `withConcurrencyCheck(signSettings)` + client `If-Unmodified-Since`. | open |
| S5-3 | 5. Optimistic concurrency | nice-to-have | `routes.ts:100` POST `/:id/tokens/:tokenId/remind` | Mutates `lastReminderAt` without concurrency check. Action is idempotent by nature. | Document as intentionally idempotent, or add concurrency if tokens gain more editable fields. | open |
| S7-1 | 7. Cross-app linking | nice-to-have | `sign-list-view.tsx` | SmartButtonBar present on editor detail view (good). List rows lack linked-record badges. | Defer; consider in Phase G once other modules have list-level badges. | open |
| S10-1 | 10. Navigation & deep linking | nice-to-have (deferred epic) | `lib/use-sign-page-state.ts:31–36` | `view` (list/editor/templates/audit), `filterStatus`, `sortField`, `sortDir`, `searchQuery` held in local `useState`. Refresh of `/sign-app` loses sort/filter/view. Editor is URL-routed via `:id`. | Same pattern as HRM H10-1. Defer as routing-refactor epic across CRM + HRM + Sign + Invoices. | open |

### Rejected / verified-false findings (from initial subagent sweep)

| Claim | Verdict | Why |
|-------|---------|-----|
| S4-1 public routes missing tenant scope | **False positive** | Public routes correctly scope by unguessable token UUID (`fields-public.controller.ts:191` `getSigningToken`). There is no auth context on `/public/:token` by design — signers are external. Adding tenant filter would be nonsensical. |
| Original "mutations missing `onError`" | **Covered by P-1** | `query-provider.tsx:49` sets `defaultMutationErrorHandler` on the QueryClient `mutationCache`. All 15 Sign mutations inherit it. The real gap is **query** error handling → S2-1 (P-4). |

### Deferred / n/a

| Dimension | Reason |
|-----------|--------|
| 9. Keyboard & focus | Deferred to browser spot-check. All modals built on shared `<Modal>` which wraps Radix Dialog (Esc + focus trap built-in). |
| 12. Performance | Deferred per operating defaults. No obvious N+1 in `listDocuments`. Virtualisation not wired; acceptable until a tenant has >500 agreements. |

---

## Verification (post-fix)

| Dimension | Result | Evidence / notes |
|-----------|--------|------------------|
| 1. Golden-path workflow | pending | |
| 2. Empty/loading/error states | pass (code-read) | S2-1 fixed via `QueryErrorState` branches in `page.tsx`; browser spot-check deferred |
| 3. Input & data correctness | pending | |
| 4. Auth & permission scoping | pass (code-read) | Public by token; authenticated routes scoped by `req.auth.tenantId` |
| 5. Optimistic concurrency | partial | S5-1/S5-2/S5-3 deferred as nice-to-have |
| 6. i18n completeness | pass | All 5 locales have 225 leaf keys under `sign.*` — parity clean |
| 7. Cross-app linking | pass | SmartButtonBar on editor view |
| 8. Destructive action safety | pass | No `window.confirm`/`alert`; `ConfirmDialog` used in `page.tsx` |
| 9. Keyboard & focus | deferred | Browser spot-check |
| 10. Navigation & deep linking | partial | Editor URL-routed; list view state not URL-driven (S10-1 deferred epic) |
| 11. Search & filters | pass | Global search UNION includes Sign |
| 12. Performance smoke test | deferred | Per operating defaults |

---

## Propagation (Phase G)

- **Local** (stay in this report): S3-1 (signer email client-side validation), S7-1 (list-row SmartButtons).
- **Pattern** (already in `platform-findings.md`):
  - P-4 (query `isError` branch missing) — **promoted hypothesis → pattern** this session. Confirmed in HRM + Sign. CRM retro-scan still pending.
  - P-3 (concurrency gaps) — Sign adds 3 minor hits (S5-1/S5-2/S5-3). All nice-to-have; updatedAt exists, collision risk low for these specific surfaces.
- **Platform** (shared fix built): none new. `QueryErrorState` + `defaultMutationErrorHandler` already exist and were the primitives used to close S2-1.
- **Deferred epic**: S10-1 URL-driven list state — same routing-refactor as HRM H10-1. Track as one cross-module epic.

---

## Sign-off

- [x] All `fix-before-ship` findings closed (S2-1 fixed)
- [ ] Golden path walked end-to-end with fresh account (browser spot-check deferred to batch pass later)
- [x] Nice-to-have findings logged with status
- [x] Propagation complete (Phase G)
- [x] Module report marked SIGNED OFF at top

Signed off by: gorkem.cetin@gmail.com
Date: 2026-04-16
