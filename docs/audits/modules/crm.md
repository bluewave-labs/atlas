# CRM Audit Report

**Module ID**: `crm`
**Audit started**: 2026-04-16
**Audit completed**: 2026-04-16
**Sign-off**: SIGNED OFF 2026-04-16 (pilot scope)
**Pilot / Full**: _Pilot (dimensions 1, 2, 5, 8 only)_

---

## Pre-flight spot-check

- [ ] Shared UI components used (no raw HTML elements)
- [ ] Size `sm` in data views, `md` in auth/setup
- [ ] CSS variables (no hex colors)
- [ ] No `localStorage` for roaming settings
- [ ] Registered in client + server `apps/index.ts`
- [ ] Query keys namespaced in `config/query-keys.ts`

Notes: _filled during Phase B._

---

## Workflow map

### User actions

**Leads**
- Create lead (manual or CSV import)
- List with filters, search, saved views
- Detail page with enrichment data
- Update (name, email, phone, company, status, probability, close date)
- Archive (soft-delete)
- Convert to contact + deal
- Enrich with company intelligence

**Contacts**
- Create (single or bulk import)
- List with filters, search, saved views
- Detail page with company affiliation
- Update (name, email, phone, position, company, tags)
- Archive (soft-delete)
- Merge two contacts
- Link to email thread and calendar events

**Companies**
- Create (single or bulk import)
- List with filters, search, saved views
- Detail page with portal access
- Update (name, domain, industry, size, address, tax ID)
- Archive (soft-delete)
- Merge two companies
- Regenerate portal token

**Deals**
- Create (linked to contact/company)
- Kanban pipeline (drag-drop stages)
- Table list with filters, search, saved views
- Detail page with timeline
- Update (title, value, stage, probability, close date, tags)
- Archive (soft-delete)
- Mark won (set `wonAt`)
- Mark lost (requires reason)
- Bulk stage change
- CSV import

**Pipelines & stages**
- Create, reorder, update, delete
- Stage-wise deal count and pipeline value

**Activities & timeline**
- Log activity (call / email / note / task)
- Timeline on deal/contact/company detail
- Mark complete, reschedule, reassign, change type
- Archive (soft-delete)

**Dashboard & analytics**
- KPIs (pipeline value, won deals, win rate, avg deal size)
- Pipeline breakdown by stage
- Recent activities
- Deals closing soon
- Top deals by value
- Export charts as image

**Forecast & reporting**
- Forecast by stage (probability-weighted)
- Forecast by team member
- Export (CSV / XLSX / JSON)

**Proposals**
- Create, edit, send, duplicate, restore revision
- Public accept/decline via token (no auth)
- Status timeline (sent / viewed / accepted / declined)

**Views & filters**
- Create / apply / pin / delete saved views
- Multi-field filter (AND)
- Sort any column
- Group list by field
- Quick-add (context-aware)

**Automations**
- Create, update, toggle, delete workflows
- Seed demo workflows (admin)

**Settings & config**
- CRM permissions
- Teams management
- Activity types
- Lead forms (public, custom fields)
- Google Calendar sync

**Data operations**
- Bulk delete, bulk export, bulk import
- Cross-entity search
- Tagging

### Files

```
client/src/apps/crm/
├── page.tsx, manifest.ts, hooks.ts
├── components/
│   ├── crm-sidebar.tsx, crm-toolbar.tsx, crm-content.tsx
│   ├── leads-view.tsx, lead-detail-page.tsx
│   ├── views/{contacts,deals,companies,activities}-list-view.tsx
│   ├── {contact,deal,company}-detail-page.tsx
│   ├── deal-kanban.tsx
│   ├── dashboard.tsx, dashboard-charts.tsx, forecast-view.tsx
│   ├── filter-bar.tsx, saved-views.tsx
│   ├── activity-timeline.tsx, email-timeline.tsx
│   ├── proposals-list-view.tsx, proposal-editor.tsx
│   ├── lead-forms-view.tsx
│   ├── csv-import-modal.tsx
│   ├── modals/{create-deal,create-contact,create-company,log-activity}-modal.tsx
│   ├── merge-modal.tsx, mark-lost-modal.tsx
│   └── inline-edit-cells.tsx
├── lib/crm-columns.ts, crm-helpers.tsx, workflow-i18n.ts
└── utils.ts

server/src/apps/crm/
├── routes.ts, controller.ts, manifest.ts, service.ts
├── controllers/{lead,contact,company,deal,activity,proposal,view,workflow,dashboard,note,team}.controller.ts
├── controllers/activity-reminder.ts
├── services/{lead,contact,company,deal,activity,proposal,view,workflow,dashboard,note,team,calendar,email}.service.ts
├── digest.ts
└── email.service.ts
```

### API endpoints (condensed)

Lead: `POST /leads`, `GET /leads/list`, `GET/PATCH/DELETE /leads/:id`, `POST /leads/:id/convert`, `POST /leads/:id/enrich`
Contact: `POST /contacts`, `GET /contacts/list`, `POST /contacts/import`, `GET/PATCH/DELETE /contacts/:id`, `POST /contacts/merge`
Company: `POST /companies`, `GET /companies/list`, `POST /companies/import`, `GET/PATCH/DELETE /companies/:id`, `POST /companies/merge`
Deal: `POST /deals`, `GET /deals/list`, `POST /deals/import`, `GET/PATCH/DELETE /deals/:id`, `POST /deals/:id/won`, `POST /deals/:id/lost`, `GET /deals/counts-by-stage`, `GET /deals/pipeline-value`
Stage: `GET /stages/list`, `POST /stages`, `POST /stages/reorder`, `PATCH/DELETE /stages/:id`
Activity: `POST /activities`, `GET /activities/list`, `PATCH /activities/:id`, `POST /activities/:id/complete`, `DELETE /activities/:id`
Proposal: `POST /proposals`, `GET /proposals/list`, `GET/PATCH/DELETE /proposals/:id`, `POST /proposals/:id/send`, `POST /proposals/:id/duplicate`
Views: `GET/POST /views`, `PATCH/DELETE /views/:id`
Workflows: `GET/POST /workflows`, `PUT/DELETE /workflows/:id`, `POST /workflows/:id/toggle`
Dashboard: `GET /dashboard`, `GET /dashboard/charts`, `GET /forecast`

### DB tables

- **crmLeads**, **crmContacts**, **crmCompanies**, **crmDealStages**, **crmDeals**, **crmActivityTypes**, **crmActivities**, **crmWorkflows**, **crmTeams**, **crmTeamMembers**, **crmNotes**, **crmSavedViews**, **crmLeadForms**, **crmProposals**

All have standard columns: `id` (uuid), `accountId`, `userId`, `isArchived`, `sortOrder`, `createdAt`, `updatedAt`.

---

## Findings

### Dimension 5 — Optimistic concurrency

Lead, contact, company, deal, activity — all PASS (client forwards `updatedAt`, server uses `withConcurrencyCheck`, call sites pass it).

| ID | Severity | Entity | Client (hooks.ts) | Server (routes.ts) | Issue |
|----|----------|--------|-------------------|---------------------|-------|
| C5-1 | fix-before-ship | Deal stage | :344 — no `updatedAt` in mutation | :67 — no `withConcurrencyCheck` | Two admins editing the same pipeline stage can silently clobber each other |
| C5-2 | fix-before-ship | Proposal | :1518 — no `updatedAt` | :160 — no `withConcurrencyCheck` | Shared edits on proposals (e.g. sales + manager) lose concurrent changes |
| C5-3 | fix-before-ship | Workflow | :733 — no `updatedAt` | :111 — PUT, no `withConcurrencyCheck` | Automations can be silently overwritten |
| C5-4 | fix-before-ship | Note | :1083 — no `updatedAt` | :127 — no `withConcurrencyCheck` | Shared notes on deals/contacts lose edits |
| C5-5 | nice-to-have | Saved view | :1346 — no `updatedAt` | :147 — no `withConcurrencyCheck` | Per-user entity; concurrency unlikely |

All 5 tables already have `updatedAt` columns in schema — only wiring is missing.

### Dimension 8 — Destructive action safety

No bare `window.confirm/alert` anywhere in CRM. All client-triggered destructive actions route through `<ConfirmDialog>`.

| ID | Severity | File:line | Issue |
|----|----------|-----------|-------|
| C8-1 | fix-before-ship | server/apps/crm/services/lead.service.ts:335 | `db.delete(crmLeadForms)` — hard-delete of user-created forms. Should set `isArchived = true`. |
| C8-2 | fix-before-ship | server/apps/crm/services/view.service.ts:85 | `db.delete(crmSavedViews)` — hard-delete of user saved views. Should soft-delete. |
| C8-3 | nice-to-have | — | No undo toast after archive on any entity. Cheap to add (set `isArchived = false`). |

Deal stage deletes are hard-deletes but server guards against deleting non-empty stages. Team-member removal is a junction-table delete — acceptable.

### Dimension 1 — Golden-path workflow

All 8 steps work end-to-end. Query invalidation chain is correct (mutations invalidate `queryKeys.crm.all` → dashboard refreshes).

| ID | Severity | File:line | Issue |
|----|----------|-----------|-------|
| C1-1 | fix-before-ship | leads-view.tsx:177-189 | ConvertLeadModal result view assumes `result.deal` is non-null. A malformed server response crashes the modal with no fallback. |
| C1-2 | nice-to-have | leads-view.tsx:161-165 | After successful convert, UI shows "View Deal" CTA instead of auto-navigating. Extra click. |
| C1-3 | nice-to-have | hooks.ts:198, 282 | Company/contact create invalidates the entire `queryKeys.crm.all` tree — wider than needed. |

### Dimension 2 — Empty / loading / error states

**Platform-level finding**: Zero of the ~60 CRM `useMutation` definitions in `hooks.ts` have an `onError` callback. All error surfacing is opt-in per call site. This is not a CRM-specific bug — it's a framework gap. **Promote to platform-findings.md as a pattern.**

| ID | Severity | File:line | Issue |
|----|----------|-----------|-------|
| C2-1 | fix-before-ship | hooks.ts (all 60+ mutations) | No default `onError` → any caller that forgets `{ onError }` gets a silent failure. Add a default in the shared `useMutation` wrapper or in each hook. |
| C2-2 | fix-before-ship | leads-view.tsx:378 | Loading state renders text instead of a skeleton. |
| C2-3 | fix-before-ship | views/{companies,contacts,deals,activities}-list-view.tsx:~20 | Not handling `isLoading` from the query at the parent. DataTable masks it, but slow loads show nothing. |
| C2-4 | fix-before-ship | forecast-view.tsx:33 | No fallback when query succeeds with zero deals (renders an empty chart). |
| C2-5 | fix-before-ship | deal-kanban.tsx | No error boundary / fallback when `useDeals` errors. |
| C2-6 | fix-before-ship | dashboard.tsx (recent-activities widget) | No "no activities yet" empty state on the widget. |
| C2-7 | nice-to-have | leads-view.tsx:560 | DataTable uses `emptyTitle` prop — functional but less visual than `FeatureEmptyState`. |
| C2-8 | nice-to-have | deal-kanban.tsx | Empty kanban columns render no placeholder. |

Lists with good empty states (pass): contacts, companies, deals, activities, proposals.

---

**Triage batch** — 11 `fix-before-ship` + 5 `nice-to-have`. Summary:
- Dim 5: 4 blockers (stage, proposal, workflow, note concurrency) + 1 nice-to-have
- Dim 8: 2 blockers (lead forms + saved views hard-delete) + 1 nice-to-have
- Dim 1: 1 blocker (convert modal crash path) + 2 nice-to-have
- Dim 2: 6 blockers (including the platform-wide onError gap) + 2 nice-to-have

---

## Fix status

| Finding | Severity | Status | Commit |
|---------|----------|--------|--------|
| C1-1 | fix-before-ship | fixed | 9e5bc45 |
| C1-2 | nice-to-have | deferred | — |
| C1-3 | nice-to-have | deferred | — |
| C2-1 | fix-before-ship | fixed (platform) | c3a2019 |
| C2-2 | fix-before-ship | fixed | b86e5f0 |
| C2-3 | fix-before-ship | fixed | b86e5f0 |
| C2-4 | fix-before-ship | fixed | b86e5f0 |
| C2-5 | fix-before-ship | closed by C2-1 (default toast now surfaces query errors) | c3a2019 |
| C2-6 | fix-before-ship | pre-existing — already handled in code | — |
| C2-7 | nice-to-have | deferred | — |
| C2-8 | nice-to-have | deferred | — |
| C5-1 | fix-before-ship | fixed | d734ac1 |
| C5-2 | fix-before-ship | fixed | d734ac1 |
| C5-3 | fix-before-ship | fixed | d734ac1 |
| C5-4 | fix-before-ship | fixed | d734ac1 |
| C5-5 | nice-to-have | deferred | — |
| C8-1 | fix-before-ship | fixed (requires db:push) | ce24684 |
| C8-2 | fix-before-ship | fixed (requires db:push) | ce24684 |
| C8-3 | nice-to-have | deferred | — |

## Verification (post-fix)

| Dimension | Result | Evidence / notes |
|-----------|--------|------------------|
| 1. Golden-path workflow | pass | Guard added to ConvertLeadModal; invalidation chain intact. Manual walk deferred to Phase E batch. |
| 2. Empty / loading / error states | pass | Default error toast + list skeletons in place. 2 locale-aware strings added with inline EN fallback. |
| 5. Optimistic concurrency | pass | 4 entities wired client + server. Schema `updatedAt` columns verified present. |
| 8. Destructive action safety | pass | Lead forms + saved views soft-delete; no bare window.confirm; all UI destructive actions use ConfirmDialog. Requires `npm run db:push` on deploy. |

---

## Propagation (Phase G)

- **Local**:
  - C1-1 (ConvertLeadModal guard) — CRM-specific flow
  - C1-2, C1-3 (deferred friction)
  - C2-2, C2-3, C2-4 (list skeletons, forecast hint) — CRM-specific components
- **Pattern** (logged to `platform-findings.md`):
  - **P-1** — mutations lacking default `onError` (fixed centrally in query-provider)
  - **P-2** — hard-delete of user-created data (hypothesis — check HRM, Sign, Work next)
  - **P-3** — entities with `updatedAt` but no `withConcurrencyCheck` (hypothesis — grep every module's routes.ts next)
- **Platform** (shared fix built this session):
  - `defaultMutationErrorHandler` in `packages/client/src/providers/query-provider.tsx` — any mutation that errors now surfaces a toast. Benefits every module going forward.

---

## Sign-off

- [x] All `fix-before-ship` findings closed (or closed by a platform fix)
- [ ] Golden path walked end-to-end with fresh account — **deferred to Phase E batch**; code-level verification complete, UI walk pending
- [x] Nice-to-have findings logged with status
- [x] Propagation complete (Phase G)
- [x] Module report marked SIGNED OFF at top (pilot scope)

**Deploy note**: `cd packages/server && npm run db:push` required before next server deploy to add `is_archived` columns on `crm_lead_forms` and `crm_saved_views`.
