# Odoo CRM Importer — Design Spec

**Date:** 2026-04-27
**Status:** Approved, awaiting implementation plan
**Scope:** v1 — one-shot CSV import of Odoo `res.partner`, `crm.lead`, and `mail.activity` into Atlas CRM.

---

## Goal

Atlas users coming from Odoo upload up to three CSVs from Odoo's UI, preview a stage-mapping decision, and commit. After import, their Odoo address book + active deal pipeline + pending activities are usable inside Atlas without manual cleanup.

## Non-goals

- **Live JSON-RPC integration.** Out of scope for v1. CSV-only because it works for every Odoo customer regardless of plan or self-hosted/cloud status, requires no credentials in Atlas, and ships fast. Live sync via JSON-RPC is a v2 candidate.
- **Salesforce / HubSpot / Pipedrive importers.** The Settings → Data → Import surface is designed to host them later, but only Odoo lands in v1.
- **Two-way sync.** Strictly one-way Odoo → Atlas, one-shot per import session.
- **Message history (`mail.message`)**, done activities, sales-team management, multi-address (invoice/delivery), salesperson re-assignment, custom-field schema creation, attachments / `ir.attachment`, image binaries, lead-source UTM tracking, tag colors/hierarchy.
- **Stage-name automation.** No fuzzy ML matching; a deterministic name-equality pre-fill plus a user-driven mapping UI.

## Decisions (all locked)

| # | Decision |
|---|----------|
| Source format | CSV uploaded by user from Odoo UI export (with "import-compatible export" toggle ON) |
| Files accepted | `res.partner.csv` (required), `crm.lead.csv` (optional), `mail.activity.csv` (optional). Multi-file upload in one session. |
| Entry point | New `data-import` panel in the global Settings sidebar, sibling of `data-model`, `ownerOnly: true`. (Settings UI is currently flat panels, not nested sub-categories — "Settings → Data → Import" in earlier drafts was aspirational.) |
| FK resolution between files | Odoo `id` column (integer, present in import-compatible exports) is the join key. We build an in-session map `odooPartnerId → atlasContactId\|atlasCompanyId`, consulted by lead/deal/activity passes. |
| Lead vs Deal split | `crm.lead.csv` rows with `type='lead'` → `crmLeads`. Rows with `type='opportunity'` → `crmDeals`. |
| Stage mapping | Distinct Odoo `stage_id` labels surfaced in preview; user maps each to an existing Atlas `crmDealStages` entry via dropdown. Pre-filled with case-insensitive name-equality matches. |
| Custom fields | Detected, counted, listed in preview, **skipped** on import. User who wants them must define them in Atlas first and re-import. |
| Activities filter | All rows from `mail.activity.csv` imported (Odoo's `mail.activity` table only contains pending activities by definition; done ones move to `mail.message`). |
| Permission gate | `requireTenantOwner` on all importer endpoints. |
| Timestamp preservation | Use Odoo's `create_date` → `createdAt`, `write_date` → `updatedAt` when present and parseable; fall back to `now()` otherwise. Implementation note: existing `createX` service helpers hardcode `now()` and have no override; the importer bypasses those helpers and writes via raw `tx.insert(...)` inside a transaction (see Architecture). |

---

## Field mapping

### `res.partner.csv` → Atlas

Each row in `res.partner.csv` is processed twice (logically):
- If `is_company = True` → row creates a `crmCompanies` row.
- If `is_company = False` → row creates a `crmContacts` row.

Rows that are children of a company (`parent_id` set) AND are individuals also link the contact to the parent company via the in-session map.

Rows with `type` in `{'invoice', 'delivery', 'other'}` are **dropped** in v1 (Atlas has one address per company).

| Odoo column | Atlas target | Notes |
|-------------|-------------|-------|
| `id` | (in-session map key) | Not stored; used to resolve cross-file FKs |
| `name` | `name` | Direct |
| `is_company` | (routing) | Routes to companies vs contacts table |
| `parent_id/.id` | (in-session map lookup) | Resolves `crmContacts.companyId` |
| `email` | `email` | Direct |
| `phone` | `phone` | Direct |
| `mobile` | `phone` | Used only when `phone` is empty |
| `function` | `crmContacts.position` | Companies don't have it |
| `street`, `street2`, `city`, `zip`, `state_id`, `country_id` | `crmCompanies.address` | Concatenated single-line: `"{street}, {street2}, {city} {state} {zip}, {country}"`, omitting empty parts |
| `zip` | `crmCompanies.postalCode` | Direct, in addition to address concat |
| `state_id` | `crmCompanies.state` | Label only |
| `country_id` | `crmCompanies.country` | Label only |
| `vat` | `crmCompanies.taxId` | Truncated to 11 chars (Atlas column limit) |
| `website` | `crmCompanies.domain` | Strip `https?://` and trailing `/`; lowercase |
| `comment` | (creates a `crmNotes` row) | HTML stripped to plain text. Skipped if empty. |
| `industry_id` | `crmCompanies.industry` | Label only |
| `category_id` | `tags` (jsonb) | Split on `,`, trim, dedupe, drop empties |
| `image_1920` | `crmCompanies.logo` | Only if column present and non-empty; data URI prefix added if base64 |
| `active` | `isArchived` | `False` → `true` |
| `create_date` | `createdAt` | Parse ISO; fallback `now()` |
| `write_date` | `updatedAt` | Parse ISO; fallback `now()` |

Dropped: `display_name`, `complete_name`, `commercial_partner_id`, `customer_rank`, `supplier_rank`, `lang`, `tz`, `title`, `ref`, `team_id`, `user_id`, `employee`, `company_registry`, all UTM fields.

### `crm.lead.csv` → Atlas

Routing by `type`:
- `type='lead'` → `crmLeads` row.
- `type='opportunity'` → `crmDeals` row.

#### Leads (`type='lead'`)

| Odoo column | Atlas target | Notes |
|-------------|-------------|-------|
| `id` | (in-session map key) | |
| `name` | `name` | Direct |
| `partner_name` | `companyName` | Direct |
| `contact_name` | `name` (override) | If `contact_name` is set and different from `name`, use it as the lead's name; original `name` appended to `notes` |
| `email_from` | `email` | Direct |
| `phone` | `phone` | Direct (mobile dropped if both present) |
| `expected_revenue` | `expectedRevenue` | Direct |
| `probability` | `probability` | Direct |
| `date_deadline` | `expectedCloseDate` | Direct |
| `description` | `notes` | HTML stripped to plain text |
| `tag_ids` | `tags` | Split on `,`, trim, dedupe |
| `active=False` AND `lost_reason_id` set | `status='lost'` | Heuristic |
| `stage_id.is_won` (label match "won"/"qualified" if present) | `status='qualified'` | Mapped via stage-mapping UI; defaults to 'new' |
| (default) | `status='new'` | When no other rule matches |
| `create_date` | `createdAt` | |
| `write_date` | `updatedAt` | |

`partner_id` link is preserved in `notes` as `Odoo partner: {partner_id}` for human reference but not used for FK on leads (leads don't have a `contactId` in Atlas; they have free-text `companyName`).

#### Deals (`type='opportunity'`)

| Odoo column | Atlas target | Notes |
|-------------|-------------|-------|
| `id` | (in-session map key) | |
| `name` | `title` | Direct |
| `partner_id` | `contactId` or `companyId` | If parent partner is `is_company=True` → `companyId`; else `contactId` (and `companyId` from contact's parent company) |
| `expected_revenue` | `value` | Direct |
| `probability` | `probability` | Direct |
| `date_deadline` | `expectedCloseDate` | Direct |
| `description` | (create `crmNotes` row) | HTML stripped |
| `tag_ids` | `tags` | Split on `,` |
| `stage_id` | `stageId` | Resolved via stage-mapping UI (mandatory) |
| `lost_reason_id` (label) | `lostReason` | Free text; only if set |
| `active=False` AND `lost_reason_id` set | `lostAt = write_date` | |
| `stage_id.is_won` | `wonAt = write_date` | When stage maps to a "won" Atlas stage |
| `currency_id` (currency code) | `currency` | Default `USD` if missing |
| `create_date` | `createdAt` | |
| `write_date` | `updatedAt` | |
| `stage_id` last-update timestamp | `stageEnteredAt` | Use `write_date` if no better signal |

### `mail.activity.csv` → Atlas

Only rows where `res_model in ('res.partner', 'crm.lead')` are imported. Other models (e.g. `sale.order`, `account.move`) are dropped silently with a count in the summary.

**Atlas's `crmActivities` has FK columns for `dealId`, `contactId`, `companyId` — but NOT for leads.** An imported activity tied to an Odoo `crm.lead` row that became an Atlas `crmLead` (not a `crmDeal`) has nowhere to attach. Such rows are dropped with a counted reason in the summary: "K activities couldn't be imported because they were attached to leads, which Atlas activities can't reference." Activities tied to opportunities (which became deals) attach via `dealId`; activities tied to partners attach via `companyId` or `contactId` per the partner's kind.

| Odoo column | Atlas target | Notes |
|-------------|-------------|-------|
| `id` | (not stored) | |
| `res_model` + `res_id` | `contactId` / `companyId` / `dealId` | Resolved via in-session map. If unresolvable → row dropped, counted in summary. |
| `activity_type_id` | `crmActivities.type` | Label-only; if no matching `crmActivityTypes` row exists for this tenant, falls back to `'note'` |
| `summary` | (prepended to `body`) | `summary` becomes the first line of `body` |
| `note` | `body` | HTML stripped |
| `date_deadline` | `scheduledAt` | Required column in Odoo; always present |
| `create_date` | `createdAt` | |
| `write_date` | `updatedAt` | |

Dropped: `user_id` (cannot match Odoo users to Atlas users), `previous_activity_type_id`, `recommended_activity_type_id`, `chaining_type`.

### Custom fields detected, not imported

Any column not in the recognized list above (typically prefixed `x_studio_` or `x_`) is:
- Counted per file
- Listed in preview by name + sample value from the first non-empty row
- **Skipped on import**, with the count surfaced in the post-import summary

**Column-name normalization:** Odoo's "import-compatible export" toggle suffixes Many2one fields with `/id` (e.g. `state_id` → `state_id/id`, `country_id/.id`). The CSV parser strips `/id` and `/.id` suffixes before matching column names against the recognized list, so both export styles work.

---

## Architecture

### File layout (server)

```
packages/server/src/apps/system/importers/
  odoo/
    types.ts          — Shared TS types: OdooPartnerRow, OdooLeadRow, OdooActivityRow, ImportSession, ImportPreview, ImportSummary
    csv-parser.ts     — Wraps a CSV parsing lib (papaparse server-side or csv-parse). Auto-detects encoding (UTF-8 with/without BOM). Returns typed rows + unrecognized columns.
    map-partner.ts    — Pure mappers: row → CrmCompanyInsert | CrmContactInsert
    map-lead.ts       — Pure mappers: row → CrmLeadInsert | CrmDealInsert (deal mapper requires resolved stageId)
    map-activity.ts   — Pure mapper: row → CrmActivityInsert
    odoo-id-map.ts    — In-session Map<number, { kind: 'company'|'contact', atlasId: string }> + lookup helpers
    preview.service.ts — Builds an ImportPreview from raw rows: counts, distinct stages, distinct unrecognized columns, sample rows. Pure (no DB writes).
    commit.service.ts  — Three-pass commit: partners → leads/deals → activities. Inserts go via raw `tx.insert(...)` inside a single `db.transaction()` block. We deliberately bypass the per-entity `createX` service helpers because (a) those helpers hardcode `now()` for timestamps with no override, and we need to preserve Odoo's `create_date`/`write_date`, and (b) atomicity matters more than reusing the helpers' validation — importer mappers already validate row shape upstream. Cost: ~5 lines of duplicated insert shape per entity. On failure the transaction rolls back fully.
    controller.ts     — POST /system/importers/odoo/preview, POST /system/importers/odoo/commit
    routes.ts         — Wires the two endpoints with authMiddleware + requireTenantOwner
```

### File layout (client)

```
packages/client/src/components/settings/import/
  odoo-import-panel.tsx       — Settings panel: file upload → preview → stage mapping → commit
  odoo-import-preview.tsx     — Renders ImportPreview: counts, dropped row reasons, custom fields, stage mapping table
  odoo-import-progress.tsx    — In-flight + post-commit summary view
  hooks.ts                    — useOdooImportPreview, useOdooImportCommit (TanStack Query mutations)
  types.ts                    — Mirrors server types via @atlas-platform/shared
```

### File layout (shared)

```
packages/shared/src/types/odoo-import.ts   — Shared types reused by client and server
```

### Modified files

```
packages/server/src/db/schema.ts                    — No changes needed (no new tables in v1)
packages/server/src/apps/system/routes.ts           — Mount importer routes under /system/importers
packages/server/package.json                        — Add csv-parse dependency
packages/client/src/config/settings-registry.ts     — Register 'data-import' panel in globalSettingsCategory, ownerOnly: true, placed alongside 'data-model'
packages/client/src/i18n/locales/{en,tr,de,fr,it}.json — Add 'import.odoo.*' namespace (titles, instructions, error messages, summary labels)
```

**Note on existing CRM service helpers**: the importer does NOT modify `contact.service.ts`, `company.service.ts`, etc. Their `createX` helpers can't preserve Odoo timestamps (no override). The importer writes directly via `tx.insert(...)` instead — see Architecture. This is the deliberate tradeoff to keep the helpers untouched at the cost of duplicating ~5 lines of insert shape per entity.

### LOC budget (rough)

- Server new: ~900 LOC (parsers + 3 mappers + preview service + commit service + 2 controllers + types). Most lines are deterministic mapping code.
- Client new: ~500 LOC (3 components + hooks).
- Shared types: ~100 LOC.
- Modified files: ~100 LOC.

---

## Data flow

### Upload flow

1. User opens **Settings → Data → Import**.
2. Picks "Odoo" from a list of available importers (only Odoo in v1).
3. Sees a 3-slot uploader: Contacts (required), Leads/Opportunities (optional), Pending Activities (optional). Each slot accepts one CSV; no drag-reorder needed.
4. Clicks **Preview**. Files POST to `/system/importers/odoo/preview` as `multipart/form-data`.
5. Server parses each file in-memory (no temp files), runs preview service, returns `ImportPreview` JSON.
6. Client renders the preview screen.

### Preview flow

The preview shows:
- Summary counts: "X companies, Y contacts, Z leads, W deals, V activities to be imported."
- Dropped-row breakdown: "N rows skipped because <reason>" for each reason.
- Custom field detection: "These columns aren't recognized: `x_score`, `x_segment`. They will be skipped on import."
- **Stage mapping table** (only when `crm.lead.csv` has `type='opportunity'` rows): two columns — Odoo stage label on the left, dropdown of existing Atlas stages on the right. Pre-filled with case-insensitive name-equality matches; unmatched rows pre-fill with the user's tenant default stage. User can override any row.
- A **Commit** button at the bottom that's disabled until every distinct Odoo stage has a mapping.

### Commit flow

1. User clicks **Commit**. Client POSTs to `/system/importers/odoo/commit` with the preview-session id (a short opaque token returned by `/preview`) plus the user's stage-mapping selections.
2. Server retrieves the in-memory preview session (cached for 30 minutes after preview), runs the three-pass commit inside a single Drizzle transaction:
   - **Pass 1**: insert companies and contacts from `res.partner`. Build `odooPartnerId → { kind, atlasId }` map.
   - **Pass 2**: insert leads (no FK resolution needed for leads' Atlas shape) and deals (resolves `partner_id` via map; uses the user's stage mapping for `stageId`).
   - **Pass 3**: insert activities (resolves `res_model`+`res_id` via map; rows that resolve to nothing are dropped, counted).
3. On success: returns `ImportSummary` JSON. Transaction commits.
4. On any error: transaction rolls back; client sees an error message with the failing row's CSV line number.
5. Client renders the summary: "Imported: X companies, Y contacts, ... Skipped: N (reasons listed)." Plus a "Done" button that navigates to CRM.

### Preview-session storage

In-memory `Map<sessionId, { rows, preview, createdAt }>` on the server with a 30-minute TTL. Eviction on commit, on TTL, or on tenant logout. **No persistence to DB or disk** — uploaded CSVs never touch storage.

Multer is configured with `multer.memoryStorage()` (not the default disk storage used elsewhere in the codebase) and `limits: { fileSize: 20 * 1024 * 1024, files: 3 }`. Uploaded buffers are parsed in-process and the rows live only in the preview-session map.

**Single-process by design.** The map is local to one Node process. With multi-instance deployment behind a load balancer, preview and commit must hit the same instance — Atlas runs as a single instance today, so this is fine. v2 migrates session storage to Redis if/when we go multi-instance.

Closing the browser tab and reopening 31 minutes later forces a re-upload. Acceptable v1 tradeoff.

### Stage validation at commit

Between preview and commit, a tenant admin could rename or delete a `crmDealStages` row. The commit handler re-queries the tenant's stages by id; if any user-supplied stage mapping references a stage that's no longer present, the commit aborts with: "The stage you mapped to has been changed. Please re-run preview."

---

## Edge cases & error handling

### Encoding

Odoo's CSV is UTF-8, sometimes with a BOM. The parser strips BOM and treats input as UTF-8. If the file fails to decode as UTF-8, return error: "File appears to use a different encoding. Re-export from Odoo with UTF-8 selected."

### Quote / delimiter handling

Standard RFC 4180 CSV with `,` delimiter and `"` quoting. Odoo uses these defaults. We do not support `;` (some European Excel variants) in v1 — surface a clear error.

### Required columns

Each file must include certain Odoo columns to be parseable. If missing, the preview returns an error listing what's needed:
- `res.partner.csv`: `id`, `name`, `is_company`
- `crm.lead.csv`: `id`, `name`, `type`
- `mail.activity.csv`: `id`, `res_model`, `res_id`, `date_deadline`

### Empty files

A 0-row file passes parsing but contributes 0 rows to the preview. Surfaced as "Contacts file has no data — was Export run on an empty list?"

### Duplicate Odoo IDs in a single file

Treat as user error; abort preview with: "Row N has duplicate Odoo ID X (also row M). Re-export." Exporting from Odoo's UI shouldn't produce duplicates.

### `partner_id` references a partner not in `res.partner.csv`

The user uploaded `crm.lead.csv` referencing a partner ID that doesn't exist in the partner file (e.g., they exported leads but not partners; or the partner is archived and was filtered out of the export). The lead/deal still imports, but `companyId`/`contactId` are left null. Counted in the summary as "Q deals couldn't be linked to a company/contact."

### Stage mapping incomplete

The preview screen disables Commit until every distinct Odoo stage has a target Atlas stage. There's a "Map all unmatched to: [first stage]" shortcut button.

### Tenant has no `crmDealStages` defined

Rare but possible if the tenant just enabled CRM and never opened it. Preview detects this and asks the user to either (a) cancel and create at least one stage in CRM Settings, or (b) auto-create a single stage named "Imported" with `sequence=0`, `isDefault=true`. Choice (b) is one click in the preview.

### `activity_type_id` doesn't match any `crmActivityTypes` for the tenant

Fall back to the literal string `'note'` (which is the Atlas default activity type). Counted in summary: "K activities defaulted to 'note' because their Odoo type wasn't found."

### File too large

Per-file cap: **20 MB**. CSV with 50,000 rows of contacts is ~10–15 MB at full Odoo width. Above 20 MB → reject before parsing with: "File exceeds 20 MB. Split your Odoo export by date range and import in batches."

### Commit takes too long

Preview should be near-instant (in-memory). Commit on 10k rows with a single transaction may take 30–60 seconds. Client shows a spinner with text "Importing... please don't close this tab." No streaming progress in v1 — the request just blocks until done or errors. If the connection drops mid-commit, the transaction rolls back fully (Postgres handles this) and the user re-runs from preview. SSE streaming is a v2 nicety.

### Permissions

Importer endpoints require `requireTenantOwner`. Members and admins see the panel but the buttons are disabled with a tooltip: "Only the workspace owner can import data." This matches Atlas's existing pattern for tenant-level operations (matches `data-model` panel's `ownerOnly: true`).

### What if the user re-runs the importer with the same file?

We don't deduplicate against existing Atlas data in v1. A second import of the same file creates duplicate Atlas records. The user is expected to know this; the preview surfaces the message: "This will create new records, not update existing ones. To replace data, archive existing CRM records first."

---

## Testing & rollout

### Manual checklist (mandatory before merge)

1. **Smallest happy path** — single contact in `res.partner.csv`, no other files. Imports as one company (or one contact if not `is_company`).
2. **Mixed partners** — 5 companies + 10 individual contacts where individuals reference companies via `parent_id`. Verify `crmContacts.companyId` is set correctly on all 10.
3. **Leads + opportunities** — one each. Verify lead lands in `crmLeads`, opportunity lands in `crmDeals` with correct stage mapping.
4. **Stage mapping UI** — opportunity references 3 distinct Odoo stages. Preview shows 3 dropdown rows pre-filled. Override one. Commit reflects the override.
5. **Activities** — `mail.activity.csv` with rows referencing both `res.partner` and `crm.lead`. All resolve correctly.
6. **Activity to dropped FK** — activity referencing a partner not in the partners CSV. Activity is dropped, counted in summary.
7. **Custom fields** — file with 2 `x_*` columns. Preview lists them. Commit doesn't error; summary shows "2 custom columns skipped."
8. **Encoding** — file saved by Excel as Windows-1252 with Turkish characters. Either we accept it, or we error with a useful message.
9. **Empty file** — 0-row CSV. Useful error.
10. **Missing required column** — `res.partner.csv` without `is_company`. Useful error.
11. **Permissions** — log in as a tenant member (not owner). Settings panel renders, buttons disabled, tooltip shown.
12. **Large file** — 5,000-row partner CSV. Imports under 30 seconds. Progress bar updates.
13. **All 5 locales** — switch language, verify import.odoo.* keys all rendered.
14. **Build / format gates** — both packages clean.

### Build gates

```
cd packages/server && npm run build
cd packages/client && npm run build
```

### No automated tests

No client-side test infra for visual + integration flows in this repo; mappers in `map-partner.ts` / `map-lead.ts` / `map-activity.ts` could have unit tests but adding test infra is out of scope. Type system + manual checklist carry the load.

### Rollout

- No feature flag — additive, low-risk, gated behind `requireTenantOwner` so the surface is small.
- No schema changes; deploys via standard build and ship.
- The "Odoo" item in the Settings → Data → Import list ships ungated. Future importers (HubSpot etc.) will appear in the same list.

---

## Open questions (none blocking implementation)

- Whether to ship a deduplication option in v1 ("don't create record if email already exists in Atlas"). My recommendation: **no** in v1. Power users will archive existing data first; casual users typically import into a fresh tenant. Adding dedup invites questions about merge strategy that we don't want to answer yet.
- Whether to surface a permanent log of past imports anywhere. **No** in v1; the import is one-shot and the post-commit summary is the only record.
