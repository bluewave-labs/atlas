# Agreements rename plan — Phase 1

> Execute this plan using superpowers:subagent-driven-development.
> The user has a standing rule to commit directly to `main` — NEVER create
> a branch. See `.claude/projects/-Users-gorkemcetin-atlasmail/memory/` for
> full rules.

## Goal

Rename the **Sign** app to **Agreements** at the surface layer (labels,
icon, page title, manifest name in all 5 locales). Add `documentType` and
`counterpartyName` metadata to `signatureDocuments`. Seed 5 starter
contract templates. Fix `getRecordUrl` so linked Sign documents navigate
correctly from the generic SmartButtonBar. Leave DB table names, route
paths, URL (`/sign-app`), and internal `sign.*` i18n keys unchanged — pure
surface rename.

## Guiding principles

- Pure surface-level rename. DB tables stay `signature_*`, routes stay
  `/sign-app`, internal code keeps `sign` identifiers. Rationale: renaming
  the internals is days of work for no user value.
- Additive migrations only (`ALTER TABLE ADD COLUMN IF NOT EXISTS`).
- Seed templates are admin-triggered (a button in the templates empty
  state), **not** auto-run on tenant creation.
- All 5 locales updated in the same commit as English. No "translate later"
  debt (project rule).
- Template bodies are US English v1. Localizing the legal text is deferred
  and tracked in `docs/agreements-roadmap.md`.
- Use shared UI components (`Input`, `Select`, `Button`, `Modal`, etc.).
  No raw HTML form elements.
- Run `cd packages/server && npx tsc --noEmit` and
  `cd packages/client && npx tsc --noEmit` after every task that changes
  TypeScript.

## Key finding from the audit

Atlas already has a generic cross-app linking system:
- **`recordLinks`** table (`source_app_id + source_record_id ↔ target_app_id + target_record_id`)
- **`SmartButtonBar`** component (`packages/client/src/components/shared/SmartButtonBar.tsx`)
- **`LinkPicker`** component (`packages/client/src/components/shared/LinkPicker.tsx`)
- Sign documents already render the SmartButtonBar in
  `sign-editor-view.tsx` at line ~392: `<SmartButtonBar appId="sign" recordId={selectedDoc.id} />`
- CRM companies, contacts, deals, tasks, projects all render SmartButtonBar too

**Implication:** don't add a `counterpartyCompanyId` FK or build a
dedicated cross-app section. The generic linking graph already works both
ways. Just:

1. Add a free-text `counterpartyName` as a fallback label (for counterparties
   not in CRM)
2. Fix `getRecordUrl` in SmartButtonBar so navigation to a linked Sign doc
   resolves to `/sign-app/:id` (currently defaults to `/sign`, which is wrong)

## Decisions already made

- **Template language**: US English v1. Localized bodies tracked in
  `docs/agreements-roadmap.md`.
- **Counterparty fallback**: free-text `counterpartyName` only. No separate
  email field (signer email is already captured elsewhere).
- **Seed idempotency key**: match on `title` (simple). No new column.
- **Permission for seed endpoint**: `create` permission on the sign app
  (via `getAppPermission` + `canAccess`). Not `isSuperAdmin`.
- **Auto-seed on new tenant**: NO. Manual button only.

## Scope boundaries

### In Phase 1

1. Label rename in manifest + translations (5 locales)
2. New columns: `documentType`, `counterpartyName`
3. Document type filter chips in list view
4. Counterparty column in list view
5. Document type dropdown + counterparty text input in send/create flow
6. Seed-starter-templates endpoint + 5 PDF templates
7. "Load starter templates" button in templates view
8. Fix `getRecordUrl('sign', id)` in SmartButtonBar
9. Verify LinkPicker can target 'sign' app

### Deferred to Phase 2+

See `docs/agreements-roadmap.md` for the full list. Highlights:
- Localized template bodies (TR, DE, FR, IT)
- URL rename `/sign-app` → `/agreements`
- DB table renames (`signature_*` → `agreement_*`)
- CLM features: effective/expiration dates, renewal alerts, obligations
- Contract value tracking
- Auto-linking counterparty from send flow to `recordLinks`
- Cross-links to HR employees, Projects for SOWs
- Smart field auto-population
- Rich-text contract editor
- Reporting dashboard
- Auto-seed for new tenants
- Bulk send

## Important file paths (pre-researched)

| What | Path |
|---|---|
| Client sign manifest | `packages/client/src/apps/sign/manifest.ts` |
| Server sign manifest | `packages/server/src/apps/sign/manifest.ts` |
| Schema file | `packages/server/src/db/schema.ts` (signatureDocuments at line ~920) |
| Migration file | `packages/server/src/db/migrate.ts` |
| Shared sign types | `packages/shared/src/types/` — find the sign file |
| Templates service | `packages/server/src/apps/sign/services/templates.service.ts` |
| Documents service | `packages/server/src/apps/sign/services/documents.service.ts` |
| Sign routes | `packages/server/src/apps/sign/routes.ts` |
| Sign list view | `packages/client/src/apps/sign/components/sign-list-view.tsx` |
| Sign send modal | `packages/client/src/apps/sign/components/sign-send-modal.tsx` |
| Sign templates view | `packages/client/src/apps/sign/components/sign-templates-view.tsx` |
| Sign editor view (has SmartButtonBar) | `packages/client/src/apps/sign/components/sign-editor-view.tsx` |
| SmartButtonBar | `packages/client/src/components/shared/SmartButtonBar.tsx` |
| LinkPicker | `packages/client/src/components/shared/LinkPicker.tsx` |
| Sign hooks | `packages/client/src/apps/sign/hooks.ts` |
| Locales | `packages/client/src/i18n/locales/{en,tr,de,fr,it}.json` |
| Starter roadmap | `docs/agreements-roadmap.md` |

## Current schema context (verified)

```ts
// packages/server/src/db/schema.ts ~line 920
export const signatureDocuments = pgTable('signature_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  userId: uuid('user_id').notNull(),
  title: varchar('title', { length: 500 }).notNull(),
  fileName: varchar('file_name', { length: 500 }).notNull(),
  storagePath: text('storage_path').notNull(),
  pageCount: integer('page_count').notNull().default(1),
  status: varchar('status', { length: 50 }).notNull().default('draft'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  tags: jsonb('tags').$type<string[]>().notNull().default([]),
  redirectUrl: text('redirect_url'),
  isArchived: boolean('is_archived').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('idx_sig_docs_tenant').on(table.tenantId),
  statusIdx: index('idx_sig_docs_status').on(table.status),
}));
```

## Current manifest context (verified)

```ts
// packages/client/src/apps/sign/manifest.ts
import { PenTool } from 'lucide-react';
export const signManifest: ClientAppManifest = {
  id: 'sign',
  name: 'Sign',
  labelKey: 'sidebar.sign',
  iconName: 'PenTool',
  icon: PenTool,
  color: '#8b5cf6',
  minPlan: 'starter',
  category: 'productivity',
  dependencies: [],
  defaultEnabled: true,
  version: '1.0.0',
  sidebarOrder: 30,
  routes: [
    { path: '/sign-app', component: SignPage },
    { path: '/sign-app/:id', component: SignPage },
  ],
};
```

## SmartButtonBar bug (verified at lines 10-19)

```ts
function getRecordUrl(appId: string, recordId: string): string {
  switch (appId) {
    case 'docs': return `/docs/${recordId}`;
    case 'draw': return `/draw/${recordId}`;
    case 'tables': return `/tables/${recordId}`;
    case 'tasks': return `/tasks`;
    case 'drive': return `/drive`;
    default: return `/${appId}`;  // 'sign' falls here → /sign (broken)
  }
}
```

Fix: add `case 'sign': return \`/sign-app/${recordId}\`;`.

---

## The 10 tasks

### Task 1 — Add `documentType` + `counterpartyName` columns

**Files:**
- `packages/server/src/db/schema.ts` (invoiceSettings-style additions to `signatureDocuments`)
- `packages/server/src/db/migrate.ts`
- `packages/server/src/apps/sign/manifest.ts` (add to `standardFields`)

**Schema additions (after `tags` field, before `redirectUrl`):**
```ts
  documentType: varchar('document_type', { length: 50 }).notNull().default('contract'),
  counterpartyName: varchar('counterparty_name', { length: 255 }),
```

**Migrate.ts — find the `CREATE TABLE IF NOT EXISTS signature_documents`
block and add after it:**
```sql
ALTER TABLE signature_documents ADD COLUMN IF NOT EXISTS document_type VARCHAR(50) NOT NULL DEFAULT 'contract';
ALTER TABLE signature_documents ADD COLUMN IF NOT EXISTS counterparty_name VARCHAR(255);
```

**Manifest `standardFields` — add two entries:**
```ts
{ name: 'Document type', slug: 'document_type', fieldType: 'select', isRequired: true },
{ name: 'Counterparty name', slug: 'counterparty_name', fieldType: 'text', isRequired: false },
```

**Allowed documentType values (enforced at app layer, not DB):**
`contract | nda | offer_letter | acknowledgment | waiver | other`

**Commit message:** `feat: add documentType and counterpartyName to signatureDocuments`

### Task 2 — Update shared types

**File:** find the sign types file (probably
`packages/shared/src/types/sign.ts` — verify by reading
`packages/shared/src/types/index.ts`)

**Additions:**
- `DocumentType` string union type
- Add `documentType: DocumentType` and `counterpartyName?: string | null` to
  `SignatureDocument` interface
- Same additions on any create/update input types

**Commit message:** `feat: add documentType and counterpartyName to shared types`

### Task 3 — Starter PDF template renderer

**New file:** `packages/server/src/apps/sign/templates/starter-pdfs.tsx`

**Exports:**
```ts
export interface StarterFieldSpec {
  type: 'signature' | 'date' | 'text';
  pageNumber: number;
  x: number;    // in PDF points (72 per inch)
  y: number;
  width: number;
  height: number;
  label: string;
  signerRole: 'party_a' | 'party_b';  // or similar — whatever sign uses
  required: boolean;
}

export interface StarterTemplate {
  key: string;                    // 'nda_mutual', 'nda_oneway', etc.
  title: string;                  // 'Mutual NDA', etc.
  documentType: 'contract' | 'nda' | 'offer_letter';
  render: () => Promise<Buffer>;  // returns the PDF bytes
  fields: StarterFieldSpec[];     // hardcoded positions for signature blocks
}

export const STARTER_TEMPLATES: StarterTemplate[];
```

**5 templates to build:**
1. **Mutual NDA** — 2 pages, mutual confidentiality, field positions for
   two signature blocks on page 2
2. **One-way NDA** — 2 pages, disclosing vs receiving party, two sig blocks
3. **Consulting Agreement** — 2 pages, scope/rate/term placeholders, two
   sig blocks
4. **Simple SOW** — 1-2 pages, deliverables/timeline/payment, two sig
   blocks
5. **Offer Letter** — 1 page, position/start date/salary placeholders, one
   sig block (candidate) + one acknowledgment block

Each template uses `@react-pdf/renderer` (`Document`, `Page`, `View`,
`Text`, `StyleSheet`) to render to a Buffer. Legal text should be short
boilerplate with clear `[Your company name]`, `[Counterparty name]`,
`[Scope of work]`, `[Compensation]` placeholders the user replaces.

**IMPORTANT legal disclaimer text** at the top of each template body:
`"This is a template starting point and not legal advice. Consult a
lawyer before using in production."`

**Field positions** should roughly place signature blocks at bottom of last
page, two columns (left for Party A, right for Party B), ~150pt wide,
~40pt tall. Date fields below the signature blocks.

**Commit message:** `feat: add 5 starter PDF templates for Agreements`

### Task 4 — Seed service + endpoint

**Files:**
- Modify: `packages/server/src/apps/sign/services/templates.service.ts` —
  add `seedStarterTemplates(userId, tenantId)` function
- Modify: `packages/server/src/apps/sign/controllers/` — add a controller
  method for the seed endpoint (check if there's a templates.controller.ts
  or if it's in the main controller.ts)
- Modify: `packages/server/src/apps/sign/routes.ts` — register the route
  `POST /sign/templates/seed-starter`

**Behavior:**
1. Permission check via `getAppPermission(tenantId, userId, 'sign')` +
   `canAccess(perm.role, 'create')`
2. Import `STARTER_TEMPLATES` from the new file
3. For each template:
   - Query `sign_templates` for existing row with same `title` + `tenantId`
   - If exists → add to `skipped`, continue
   - Else: call `template.render()` → get Buffer
   - Write buffer to `uploads/{tenantId}/{filename}` (matching the
     tenant-isolated layout from the previous work). Filename format:
     `{userId}_{Date.now()}_{safeKey}.pdf`. Create tenant dir if missing.
   - Insert `sign_templates` row with:
     - `tenantId`, `userId`, `title`, `fileName`
     - `storagePath = \`${tenantId}/${filename}\`` (relative path, matches
       the per-tenant layout)
     - `pageCount = 2` (or whatever the template uses)
     - `fields = template.fields` (as JSONB)
   - Add to `created`
4. Return `{ success: true, data: { created: string[], skipped: string[] } }`

**Note on field shape**: look at the existing `sign_templates.fields`
JSONB definition in `schema.ts` to match the field shape. If the existing
shape doesn't match my `StarterFieldSpec`, adjust `StarterFieldSpec` to
match — don't change the existing schema.

**Route:** `POST /sign/templates/seed-starter` (under the existing auth
middleware)

**Commit message:** `feat: add seed-starter-templates endpoint`

### Task 5 — Fix `getRecordUrl` for sign in SmartButtonBar

**File:** `packages/client/src/components/shared/SmartButtonBar.tsx`

**Change:** add `case 'sign': return \`/sign-app/${recordId}\`;` to the
switch in `getRecordUrl` (around line 10-19).

**Also verify:** open `LinkPicker.tsx` and confirm that 'sign' is a valid
target app (it probably reads from `appRegistry` which includes sign
automatically). If it doesn't appear, figure out why and fix it in the
same commit.

**Commit message:** `fix: resolve linked Sign documents to /sign-app/:id in SmartButtonBar`

### Task 6 — Document type filter + counterparty column in list view

**File:** `packages/client/src/apps/sign/components/sign-list-view.tsx`

**Changes:**
1. Read existing filter chip pattern (status filter). Mimic it for document
   type.
2. Add state: `const [typeFilter, setTypeFilter] = useState<DocumentType | 'all'>('all');`
3. Filter chips: All / Contracts / NDAs / Offer letters / Acknowledgments
   / Waivers / Other
4. Apply the filter in the memoized list alongside the status filter
5. Add a "Counterparty" column to the DataTable columns. Use
   `minWidth: 160` (same pattern as the invoice list fix from earlier).
   Render `doc.counterpartyName ?? '—'`.
6. Use `t()` for all labels from the translations added in Task 9.

**Commit message:** `feat: add document type filter and counterparty column to Agreements list`

### Task 7 — Document type + counterparty in send flow

**File:** `packages/client/src/apps/sign/components/sign-send-modal.tsx`
(verify exact file name by reading the directory)

**Changes:**
1. Add form state for `documentType` (default `'contract'`) and
   `counterpartyName` (default empty string)
2. Add a `<Select>` for document type (6 options, same list as above)
3. Add an `<Input>` for counterparty name with label "Counterparty (optional)"
4. Add a small hint text below: `t('sign.send.counterpartyHint')` — "Link
   to a CRM company, deal, or contact from the document view after sending."
5. Include both fields in the update/create payload
6. Verify the update flows through to the API (the service layer may need
   a pass-through; if so, update `documents.service.ts` similarly)

**Commit message:** `feat: add document type and counterparty fields to send flow`

### Task 8 — "Load starter templates" CTA

**File:** `packages/client/src/apps/sign/components/sign-templates-view.tsx`

**New hook** in `packages/client/src/apps/sign/hooks.ts`:
```ts
export function useSeedStarterTemplates() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/sign/templates/seed-starter');
      return data.data as { created: string[]; skipped: string[] };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sign.templates });
    },
  });
}
```

**UI changes in sign-templates-view.tsx:**
- If templates list is empty → show EmptyState with "Load starter templates"
  button calling the new mutation
- Always expose a "Load starter templates" menu item (for tenants that
  deleted them)
- On success toast: `t('sign.templates.starterLoaded', { count: created.length })`
- Use `useToastStore` for feedback
- If skipped.length > 0, include that in the toast

**Commit message:** `feat: add Load starter templates action to templates view`

### Task 9 — Surface label rename in manifests + translations

**Files:**
- `packages/client/src/apps/sign/manifest.ts`
- `packages/server/src/apps/sign/manifest.ts`
- All 5 locale files

**Manifest changes (both client + server):**
- `name: 'Agreements'` (was `'Sign'`)
- `iconName: 'FileSignature'` (was `'PenTool'`)
- In the client manifest, also update the `icon` import:
  `import { FileSignature } from 'lucide-react'`
- Leave `id: 'sign'`, `labelKey: 'sidebar.sign'`, routes, tables, all
  other fields unchanged

**Translation changes in all 5 locale files:**

Find the `sign.title` key value and change it:
- en: `"Agreements"`
- tr: `"Sözleşmeler"`
- de: `"Vereinbarungen"`
- fr: `"Accords"`
- it: `"Accordi"`

Find the `sidebar.sign` key value (or wherever the sidebar label is; it
may actually read from `sign.title`). If `sidebar.sign` exists as a
separate string, change it to the same values as above.

**Add new strings to the `sign` subtree in each locale** (English shown,
translate to each locale):
```json
"documentType": "Document type",
"counterparty": "Counterparty",
"counterpartyOptional": "Counterparty (optional)",
"counterpartyHint": "Link to a CRM company, deal, or contact from the document view after sending.",
"types": {
  "contract": "Contract",
  "nda": "NDA",
  "offer_letter": "Offer letter",
  "acknowledgment": "Acknowledgment",
  "waiver": "Waiver",
  "other": "Other"
},
"filters": {
  "all": "All",
  "contracts": "Contracts",
  "ndas": "NDAs",
  "offerLetters": "Offer letters",
  "acknowledgments": "Acknowledgments",
  "waivers": "Waivers",
  "other": "Other"
},
"templates": {
  "loadStarter": "Load starter templates",
  "starterLoaded": "{{count}} starter templates loaded",
  "starterLoadedSkipped": "{{count}} added, {{skipped}} already existed",
  "starterNames": {
    "mutualNda": "Mutual NDA",
    "onewayNda": "One-way NDA",
    "consulting": "Consulting Agreement",
    "sow": "Simple SOW",
    "offerLetter": "Offer Letter"
  }
}
```

Turkish translations (sample):
- "Document type" → "Belge türü"
- "Counterparty" → "Karşı taraf"
- "Contract" → "Sözleşme"
- "NDA" → "Gizlilik sözleşmesi"
- "Offer letter" → "Teklif mektubu"
- "Acknowledgment" → "Onay"
- "Waiver" → "Feragat"
- "Other" → "Diğer"
- "Load starter templates" → "Başlangıç şablonlarını yükle"
- "Mutual NDA" → "Karşılıklı gizlilik sözleşmesi"
- "Consulting Agreement" → "Danışmanlık sözleşmesi"

**IMPORTANT:** do not rename the `sign.*` i18n tree itself. Only change the
*values*. Keeping keys as `sign.*` avoids touching every `t('sign.x')`
call site.

**Commit message:** `feat: rename Sign to Agreements in labels and translations`

### Task 10 — Build verification + push

**Commands:**
```bash
cd /Users/gorkemcetin/atlasmail/packages/shared && npm run build
cd /Users/gorkemcetin/atlasmail/packages/server && npm run build
cd /Users/gorkemcetin/atlasmail/packages/client && npm run build
```

Fix any errors. If anything fails, commit the fix separately with a
descriptive message.

Push to main at the end:
```bash
git push origin main
```

## Summary of files touched

### New files
- `packages/server/src/apps/sign/templates/starter-pdfs.tsx`
- `docs/agreements-roadmap.md` (already created)

### Modified files
- `packages/server/src/db/schema.ts` (signatureDocuments columns)
- `packages/server/src/db/migrate.ts` (ALTER TABLE)
- `packages/server/src/apps/sign/manifest.ts` (standardFields + label)
- `packages/server/src/apps/sign/services/templates.service.ts` (seed fn)
- `packages/server/src/apps/sign/controllers/...` (seed controller)
- `packages/server/src/apps/sign/routes.ts` (seed route)
- `packages/shared/src/types/sign.ts` (documentType + counterpartyName)
- `packages/client/src/apps/sign/manifest.ts` (name, icon)
- `packages/client/src/apps/sign/hooks.ts` (useSeedStarterTemplates)
- `packages/client/src/apps/sign/components/sign-list-view.tsx` (filter + column)
- `packages/client/src/apps/sign/components/sign-send-modal.tsx` (new fields)
- `packages/client/src/apps/sign/components/sign-templates-view.tsx` (seed CTA)
- `packages/client/src/components/shared/SmartButtonBar.tsx` (getRecordUrl)
- `packages/client/src/i18n/locales/{en,tr,de,fr,it}.json` (labels + new strings)

## After /clear instructions

If resuming after /clear, start by:

1. Reading this plan file: `docs/superpowers/plans/2026-04-10-agreements-rename.md`
2. Reading the roadmap: `docs/agreements-roadmap.md`
3. Invoking `Skill` tool with `superpowers:subagent-driven-development`
4. Executing tasks 1-10 in order via subagents

The plan is self-contained — every task has enough detail for a fresh
subagent to implement without needing external context beyond file paths.
