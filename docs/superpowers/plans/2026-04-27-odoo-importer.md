# Odoo CRM Importer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Atlas users coming from Odoo upload up to 3 CSVs (`res.partner.csv`, `crm.lead.csv`, `mail.activity.csv`) from a Settings panel, preview a stage-mapping decision, and commit. After import their address book + active deal pipeline + pending activities are usable in Atlas without manual cleanup.

**Architecture:** A new `data-import` Settings panel (owner-only) drives an in-memory two-step flow: POST `/system/importers/odoo/preview` returns counts and a stage-mapping table; POST `/system/importers/odoo/commit` runs a three-pass insert (partners → leads/deals → activities) inside a single Drizzle transaction. The importer bypasses the per-entity `createX` service helpers because they hardcode `now()` and we need to preserve Odoo's `create_date`/`write_date`. Cross-file FK resolution uses Odoo's `id` column built into an in-session `Map<number, atlasId>`.

**Tech Stack:** Node 18+, Express, Drizzle ORM, PostgreSQL, multer (memoryStorage), `csv-parse` (new dep), React + Vite + TanStack Query + i18next, Atlas's existing UI primitives (`<Button>`, `<Modal>`, `<Select>`).

**Spec:** `docs/superpowers/specs/2026-04-27-odoo-importer-design.md`

---

## Notes for the implementing engineer

- **Atlas project rules** (from CLAUDE.md and persistent memory):
  - Never create a branch. Commit directly to `main` and push to `origin main`.
  - Never use `--no-verify`.
  - The product is **Atlas**, never "AtlasMail."
  - All UI strings go through `t()`. Add keys to all 5 locale files (`en/tr/de/fr/it.json`) in the same commit. English copy in non-English locales is acceptable for v1; human translation lands later.
  - All git commands run from `/Users/gorkemcetin/atlasmail` (the repo root). After `cd packages/<x>` for a build, return to the repo root before `git`.
- **DB schema changes via `bootstrap.ts`**, not `db:push`. (`db:push` was removed.) — Not needed for this plan; no schema changes.
- **No automated client tests**. Mappers in `csv-parser.ts` and the three `map-X.ts` files SHOULD have unit tests — adding `vitest` for them is part of Task 2 below.
- **Atlas dev server ports**: client 5180, server 3001. Before `npm run dev`, kill stale procs: `lsof -ti:5180,3001 | xargs kill -9 2>/dev/null || true`.
- **Where the importer lives in the UI**: `globalSettingsCategory.panels` array in `packages/client/src/config/settings-registry.ts`. New panel id `'data-import'`, sibling of existing `'data-model'`. `ownerOnly: true`. The Settings page renders the registered component when the panel is active.

---

## File structure

### New files (server)

```
packages/server/src/apps/system/importers/odoo/
  types.ts                — OdooPartnerRow, OdooLeadRow, OdooActivityRow, ImportSession, ImportPreview, ImportSummary, StageMappingInput
  csv-parser.ts           — Parses one Buffer of CSV using csv-parse, normalizes column names (strips /id and /.id), returns typed rows + list of unrecognized columns
  map-partner.ts          — Pure: row → CompanyInsert | ContactInsert (with parentOdooId for in-pass-2 resolution)
  map-lead.ts             — Pure: row → LeadInsert | DealInsert (deal needs resolved stageId from user mapping)
  map-activity.ts         — Pure: row → ActivityInsert | { skipped: true; reason: string }
  odoo-id-map.ts          — Map<number, { kind: 'company'|'contact'|'deal', atlasId: string }>, plus lookup + register helpers
  session-store.ts        — In-memory Map<sessionId, ImportSession> with 30-min TTL, eviction on commit, eviction on TTL via setInterval
  preview.service.ts      — Builds ImportPreview from raw row buffers (no DB writes). Counts records by kind, distinct stages from leads, custom-field detection, drop-row reasons.
  commit.service.ts       — Three-pass commit in a single db.transaction(). Pass 1: companies + contacts. Pass 2: leads + deals (consults map, applies user stage mapping). Pass 3: activities (consults map; drops rows that point to leads, since crmActivities has no leadId column).
  controller.ts           — handlers: previewOdoo, commitOdoo
  routes.ts               — Wires POST /preview (multer.upload.fields) and POST /commit (json body) under requireTenantOwner

packages/server/src/apps/system/importers/odoo/__tests__/
  csv-parser.test.ts      — Round-trip parsing including BOM, /id suffix normalization, unknown column collection
  map-partner.test.ts     — Companies vs contacts routing, parent_id capture, dropped types
  map-lead.test.ts        — Lead vs opportunity routing, status heuristics
  map-activity.test.ts    — Drop reasons (lead-attached, unknown res_model)
  preview.service.test.ts — End-to-end fixture: 3 buffers in, ImportPreview out
  commit.service.test.ts  — 3-pass commit with mocked tx — verifies FK resolution and stage mapping
```

### New files (client)

```
packages/client/src/components/settings/data-import/
  data-import-panel.tsx     — Top-level Settings panel. Lists importers (only Odoo for v1). Click → opens odoo-import-wizard.
  odoo-import-wizard.tsx    — Wizard with three states: 'upload' | 'preview' | 'committing' | 'done'. Drives the API calls.
  odoo-import-uploader.tsx  — File-input row × 3 (partners required, leads optional, activities optional). Emits a FormData on Submit.
  odoo-import-preview.tsx   — Renders ImportPreview JSON: count summary, dropped breakdown, custom fields list, stage mapping table.
  odoo-import-summary.tsx   — Post-commit ImportSummary: counts + dropped reasons + Done button.
  hooks.ts                  — useOdooImportPreview (mutation), useOdooImportCommit (mutation)
  types.ts                  — Re-exports shared types from @atlas-platform/shared
```

### New files (shared)

```
packages/shared/src/types/odoo-import.ts  — ImportPreview, ImportSummary, StageMappingInput re-exported across client/server
```

### Modified files

```
packages/server/package.json                          — Add `"csv-parse": "^5.5.6"` to dependencies
packages/server/src/apps/system/routes.ts             — Mount importer router at /importers/odoo
packages/shared/src/types/index.ts                    — Re-export odoo-import types
packages/client/src/config/settings-registry.ts       — Register 'data-import' panel under globalSettingsCategory, ownerOnly: true, between 'data-model' and 'home-background'
packages/client/src/components/settings/index.ts (if exists, else direct import in registry) — Wire up DataImportPanel
packages/client/src/i18n/locales/{en,tr,de,fr,it}.json — Add 'import.odoo.*' namespace
```

---

## Task 1: Add `csv-parse` dependency

**Files:**
- Modify: `packages/server/package.json`

- [ ] **Step 1: Install `csv-parse`**

```bash
cd /Users/gorkemcetin/atlasmail/packages/server
npm install csv-parse@^5.5.6
```

- [ ] **Step 2: Verify it's in package.json**

Read `packages/server/package.json` and confirm `"csv-parse"` is in the `dependencies` block.

- [ ] **Step 3: Commit**

```bash
cd /Users/gorkemcetin/atlasmail
git add packages/server/package.json packages/server/package-lock.json
git commit -m "chore(odoo-importer): add csv-parse dependency"
git push origin main
```

---

## Task 2: Add `vitest` test runner to the server

We don't need vitest for the whole server, but we want unit tests on the pure mapper functions to catch regressions. The server has no existing test runner.

**Files:**
- Modify: `packages/server/package.json`

- [ ] **Step 1: Install vitest as a dev dependency**

```bash
cd /Users/gorkemcetin/atlasmail/packages/server
npm install --save-dev vitest@^1.6.0
```

- [ ] **Step 2: Add a test script**

Read `packages/server/package.json`. In `"scripts"`, add:

```json
"test": "vitest run",
"test:watch": "vitest"
```

(Place alongside the existing `"build"` and `"dev"` scripts. Don't reorder existing keys.)

- [ ] **Step 3: Add minimal vitest config**

Create `packages/server/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/__tests__/**/*.test.ts'],
    globals: false,
    environment: 'node',
  },
});
```

- [ ] **Step 4: Verify the runner works**

```bash
cd /Users/gorkemcetin/atlasmail/packages/server
npm test
```

Expected: vitest runs, finds 0 tests (no test files yet), exits 0 with `No test files found`.

- [ ] **Step 5: Commit**

```bash
cd /Users/gorkemcetin/atlasmail
git add packages/server/package.json packages/server/package-lock.json packages/server/vitest.config.ts
git commit -m "chore(odoo-importer): add vitest for mapper unit tests"
git push origin main
```

---

## Task 3: Shared types

**Files:**
- Create: `packages/shared/src/types/odoo-import.ts`
- Modify: `packages/shared/src/types/index.ts`

- [ ] **Step 1: Create the types file**

Write `packages/shared/src/types/odoo-import.ts`:

```typescript
export type OdooImportFileKind = 'partners' | 'leads' | 'activities';

export interface OdooStagePreview {
  /** Distinct Odoo stage label seen in crm.lead.csv */
  odooStage: string;
  /** Number of opportunity rows in this stage */
  rowCount: number;
}

export interface OdooCustomFieldPreview {
  /** Column name as seen in the CSV */
  column: string;
  /** Sample non-empty value from the first row that had it */
  sampleValue: string | null;
  /** Which file the column came from */
  file: OdooImportFileKind;
}

export interface OdooImportPreview {
  sessionId: string;
  counts: {
    companies: number;
    contacts: number;
    leads: number;
    deals: number;
    activities: number;
  };
  /** Per-file row counts dropped + reason */
  dropped: Array<{ file: OdooImportFileKind; reason: string; count: number }>;
  /** Distinct stages from crm.lead.csv opportunities. Empty when no leads file uploaded. */
  stages: OdooStagePreview[];
  /** Custom fields detected in any uploaded file */
  customFields: OdooCustomFieldPreview[];
  /** Existing Atlas crmDealStages for this tenant. Used to populate the mapping dropdown. */
  atlasStages: Array<{ id: string; name: string; sequence: number }>;
}

export interface OdooImportStageMapping {
  /** Maps an Odoo stage label → Atlas crmDealStages.id */
  [odooStage: string]: string;
}

export interface OdooImportCommitInput {
  sessionId: string;
  stageMapping: OdooImportStageMapping;
}

export interface OdooImportSummary {
  imported: {
    companies: number;
    contacts: number;
    leads: number;
    deals: number;
    activities: number;
  };
  dropped: Array<{ file: OdooImportFileKind; reason: string; count: number }>;
  customFieldsSkipped: number;
}
```

- [ ] **Step 2: Re-export from the index**

Read `packages/shared/src/types/index.ts`. Add at the bottom:

```typescript
export * from './odoo-import';
```

- [ ] **Step 3: Build the shared package**

```bash
cd /Users/gorkemcetin/atlasmail/packages/shared && npm run build
```

Expected: shared package builds clean.

- [ ] **Step 4: Commit**

```bash
cd /Users/gorkemcetin/atlasmail
git add packages/shared/
git commit -m "feat(odoo-importer): shared types for preview, commit, summary"
git push origin main
```

---

## Task 4: Server-side row types

**Files:**
- Create: `packages/server/src/apps/system/importers/odoo/types.ts`

- [ ] **Step 1: Create the directory**

```bash
mkdir -p /Users/gorkemcetin/atlasmail/packages/server/src/apps/system/importers/odoo/__tests__
```

- [ ] **Step 2: Create the types file**

Write `packages/server/src/apps/system/importers/odoo/types.ts`:

```typescript
import type { OdooImportPreview, OdooImportSummary, OdooImportFileKind } from '@atlas-platform/shared';

export type { OdooImportPreview, OdooImportSummary, OdooImportFileKind };

/** Parsed row from res.partner.csv. All fields optional except id + name. */
export interface OdooPartnerRow {
  id: number;
  name: string;
  is_company: boolean;
  parent_id?: number | null;
  type?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  function?: string;
  street?: string;
  street2?: string;
  city?: string;
  zip?: string;
  state_id?: string;
  country_id?: string;
  vat?: string;
  website?: string;
  comment?: string;
  industry_id?: string;
  category_id?: string;
  image_1920?: string;
  active?: boolean;
  create_date?: string;
  write_date?: string;
}

/** Parsed row from crm.lead.csv. All fields optional except id + name + type. */
export interface OdooLeadRow {
  id: number;
  name: string;
  type: 'lead' | 'opportunity';
  partner_name?: string;
  contact_name?: string;
  email_from?: string;
  phone?: string;
  mobile?: string;
  partner_id?: number | null;
  stage_id?: string;
  expected_revenue?: number;
  probability?: number;
  date_deadline?: string;
  description?: string;
  tag_ids?: string;
  active?: boolean;
  lost_reason_id?: string;
  currency_id?: string;
  create_date?: string;
  write_date?: string;
}

/** Parsed row from mail.activity.csv. */
export interface OdooActivityRow {
  id: number;
  res_model: string;
  res_id: number;
  activity_type_id?: string;
  summary?: string;
  note?: string;
  date_deadline: string;
  create_date?: string;
  write_date?: string;
}

/** A row that the parser couldn't map to one of the three row types. */
export interface DroppedRow {
  file: OdooImportFileKind;
  reason: string;
  rowNumber: number;
}

/** In-memory session held between preview and commit. */
export interface ImportSession {
  sessionId: string;
  tenantId: string;
  userId: string;
  createdAt: number;
  partners: OdooPartnerRow[];
  leads: OdooLeadRow[];
  activities: OdooActivityRow[];
  dropped: DroppedRow[];
  customFields: Array<{ column: string; sampleValue: string | null; file: OdooImportFileKind }>;
}
```

- [ ] **Step 3: Build the server**

```bash
cd /Users/gorkemcetin/atlasmail/packages/server && npm run build
```

Expected: clean build.

- [ ] **Step 4: Commit**

```bash
cd /Users/gorkemcetin/atlasmail
git add packages/server/src/apps/system/importers/
git commit -m "feat(odoo-importer): row types for partners, leads, activities, sessions"
git push origin main
```

---

## Task 5: CSV parser with column normalization (TDD)

**Files:**
- Create: `packages/server/src/apps/system/importers/odoo/csv-parser.ts`
- Create: `packages/server/src/apps/system/importers/odoo/__tests__/csv-parser.test.ts`

- [ ] **Step 1: Write the failing test**

Write `packages/server/src/apps/system/importers/odoo/__tests__/csv-parser.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { parsePartnerCsv, parseLeadCsv, parseActivityCsv, normalizeColumnName } from '../csv-parser';

describe('normalizeColumnName', () => {
  it('strips /id suffix', () => {
    expect(normalizeColumnName('state_id/id')).toBe('state_id');
  });
  it('strips /.id suffix', () => {
    expect(normalizeColumnName('country_id/.id')).toBe('country_id');
  });
  it('leaves plain names alone', () => {
    expect(normalizeColumnName('email')).toBe('email');
  });
});

describe('parsePartnerCsv', () => {
  it('parses minimal valid input', () => {
    const csv = 'id,name,is_company\n1,Acme Inc,True\n2,Bob,False\n';
    const result = parsePartnerCsv(Buffer.from(csv));
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({ id: 1, name: 'Acme Inc', is_company: true });
    expect(result.rows[1]).toMatchObject({ id: 2, name: 'Bob', is_company: false });
    expect(result.unrecognizedColumns).toEqual([]);
  });

  it('strips UTF-8 BOM', () => {
    const csv = '﻿id,name,is_company\n1,Acme,True\n';
    const result = parsePartnerCsv(Buffer.from(csv, 'utf-8'));
    expect(result.rows).toHaveLength(1);
  });

  it('reports missing required columns', () => {
    const csv = 'id,name\n1,Acme\n';
    expect(() => parsePartnerCsv(Buffer.from(csv))).toThrow(/is_company/);
  });

  it('collects unrecognized custom fields', () => {
    const csv = 'id,name,is_company,x_score\n1,Acme,True,42\n';
    const result = parsePartnerCsv(Buffer.from(csv));
    expect(result.unrecognizedColumns).toEqual(['x_score']);
  });

  it('normalizes /id suffix on Many2one columns', () => {
    const csv = 'id,name,is_company,state_id/id,country_id/.id\n1,Acme,True,California,USA\n';
    const result = parsePartnerCsv(Buffer.from(csv));
    expect(result.rows[0].state_id).toBe('California');
    expect(result.rows[0].country_id).toBe('USA');
    expect(result.unrecognizedColumns).toEqual([]);
  });
});

describe('parseLeadCsv', () => {
  it('parses lead vs opportunity', () => {
    const csv = 'id,name,type\n1,Hot lead,lead\n2,Big deal,opportunity\n';
    const result = parseLeadCsv(Buffer.from(csv));
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].type).toBe('lead');
    expect(result.rows[1].type).toBe('opportunity');
  });

  it('rejects rows missing type', () => {
    const csv = 'id,name\n1,Hot lead\n';
    expect(() => parseLeadCsv(Buffer.from(csv))).toThrow(/type/);
  });
});

describe('parseActivityCsv', () => {
  it('parses minimal activity row', () => {
    const csv = 'id,res_model,res_id,date_deadline\n1,res.partner,42,2026-05-01\n';
    const result = parseActivityCsv(Buffer.from(csv));
    expect(result.rows[0]).toMatchObject({ id: 1, res_model: 'res.partner', res_id: 42 });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd /Users/gorkemcetin/atlasmail/packages/server
npm test
```

Expected: `Cannot find module '../csv-parser'` or similar.

- [ ] **Step 3: Implement the parser**

Write `packages/server/src/apps/system/importers/odoo/csv-parser.ts`:

```typescript
import { parse } from 'csv-parse/sync';
import type { OdooPartnerRow, OdooLeadRow, OdooActivityRow } from './types';

const PARTNER_COLUMNS = new Set([
  'id', 'name', 'is_company', 'parent_id', 'type',
  'email', 'phone', 'mobile', 'function',
  'street', 'street2', 'city', 'zip', 'state_id', 'country_id',
  'vat', 'website', 'comment', 'industry_id', 'category_id',
  'image_1920', 'active', 'create_date', 'write_date',
  'display_name', 'complete_name', 'commercial_partner_id',
  'customer_rank', 'supplier_rank', 'lang', 'tz', 'title', 'ref',
  'team_id', 'user_id', 'employee', 'company_registry',
]);

const LEAD_COLUMNS = new Set([
  'id', 'name', 'type', 'partner_name', 'contact_name',
  'email_from', 'phone', 'mobile', 'partner_id', 'stage_id',
  'expected_revenue', 'probability', 'date_deadline',
  'description', 'tag_ids', 'active', 'lost_reason_id', 'currency_id',
  'create_date', 'write_date',
  'team_id', 'user_id', 'source_id', 'medium_id', 'campaign_id',
  'priority', 'function', 'title', 'website', 'company_id',
  'recurring_revenue', 'recurring_plan', 'date_closed', 'date_open',
  'date_last_stage_update', 'kanban_state', 'color',
]);

const ACTIVITY_COLUMNS = new Set([
  'id', 'res_model', 'res_id', 'activity_type_id',
  'summary', 'note', 'date_deadline',
  'create_date', 'write_date',
  'res_model_id', 'user_id', 'previous_activity_type_id',
  'recommended_activity_type_id', 'chaining_type', 'date_done',
]);

export function normalizeColumnName(col: string): string {
  return col.replace(/\/\.?id$/, '');
}

function stripBom(buf: Buffer): string {
  const text = buf.toString('utf-8');
  return text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
}

function parseBool(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v !== 'string') return false;
  const t = v.trim().toLowerCase();
  return t === 'true' || t === '1' || t === 'yes';
}

function parseNumber(v: unknown): number | undefined {
  if (v === '' || v === null || v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

interface ParseResult<T> {
  rows: T[];
  unrecognizedColumns: string[];
}

function parseCsv(buf: Buffer, requiredColumns: string[], knownColumns: Set<string>): {
  records: Record<string, string>[];
  normalizedHeaders: string[];
  unrecognized: string[];
} {
  const text = stripBom(buf);
  const records = parse(text, {
    columns: (header: string[]) => header.map(normalizeColumnName),
    skip_empty_lines: true,
    relax_column_count: true,
    bom: false,
    trim: true,
  }) as Record<string, string>[];

  const normalizedHeaders = records.length > 0 ? Object.keys(records[0]) : [];
  const missing = requiredColumns.filter((col) => !normalizedHeaders.includes(col));
  if (missing.length > 0) {
    throw new Error(`Required column(s) missing: ${missing.join(', ')}`);
  }

  const unrecognized = normalizedHeaders.filter((h) => !knownColumns.has(h));

  return { records, normalizedHeaders, unrecognized };
}

export function parsePartnerCsv(buf: Buffer): ParseResult<OdooPartnerRow> {
  const { records, unrecognized } = parseCsv(buf, ['id', 'name', 'is_company'], PARTNER_COLUMNS);
  const rows: OdooPartnerRow[] = records.map((r) => ({
    id: Number(r.id),
    name: r.name,
    is_company: parseBool(r.is_company),
    parent_id: parseNumber(r.parent_id) ?? null,
    type: r.type || undefined,
    email: r.email || undefined,
    phone: r.phone || undefined,
    mobile: r.mobile || undefined,
    function: r.function || undefined,
    street: r.street || undefined,
    street2: r.street2 || undefined,
    city: r.city || undefined,
    zip: r.zip || undefined,
    state_id: r.state_id || undefined,
    country_id: r.country_id || undefined,
    vat: r.vat || undefined,
    website: r.website || undefined,
    comment: r.comment || undefined,
    industry_id: r.industry_id || undefined,
    category_id: r.category_id || undefined,
    image_1920: r.image_1920 || undefined,
    active: r.active === undefined ? true : parseBool(r.active),
    create_date: r.create_date || undefined,
    write_date: r.write_date || undefined,
  }));
  return { rows, unrecognizedColumns: unrecognized };
}

export function parseLeadCsv(buf: Buffer): ParseResult<OdooLeadRow> {
  const { records, unrecognized } = parseCsv(buf, ['id', 'name', 'type'], LEAD_COLUMNS);
  const rows: OdooLeadRow[] = records.map((r) => ({
    id: Number(r.id),
    name: r.name,
    type: r.type === 'opportunity' ? 'opportunity' : 'lead',
    partner_name: r.partner_name || undefined,
    contact_name: r.contact_name || undefined,
    email_from: r.email_from || undefined,
    phone: r.phone || undefined,
    mobile: r.mobile || undefined,
    partner_id: parseNumber(r.partner_id) ?? null,
    stage_id: r.stage_id || undefined,
    expected_revenue: parseNumber(r.expected_revenue),
    probability: parseNumber(r.probability),
    date_deadline: r.date_deadline || undefined,
    description: r.description || undefined,
    tag_ids: r.tag_ids || undefined,
    active: r.active === undefined ? true : parseBool(r.active),
    lost_reason_id: r.lost_reason_id || undefined,
    currency_id: r.currency_id || undefined,
    create_date: r.create_date || undefined,
    write_date: r.write_date || undefined,
  }));
  return { rows, unrecognizedColumns: unrecognized };
}

export function parseActivityCsv(buf: Buffer): ParseResult<OdooActivityRow> {
  const { records, unrecognized } = parseCsv(
    buf,
    ['id', 'res_model', 'res_id', 'date_deadline'],
    ACTIVITY_COLUMNS,
  );
  const rows: OdooActivityRow[] = records.map((r) => ({
    id: Number(r.id),
    res_model: r.res_model,
    res_id: Number(r.res_id),
    activity_type_id: r.activity_type_id || undefined,
    summary: r.summary || undefined,
    note: r.note || undefined,
    date_deadline: r.date_deadline,
    create_date: r.create_date || undefined,
    write_date: r.write_date || undefined,
  }));
  return { rows, unrecognizedColumns: unrecognized };
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd /Users/gorkemcetin/atlasmail/packages/server
npm test
```

Expected: all CSV-parser tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/gorkemcetin/atlasmail
git add packages/server/src/apps/system/importers/
git commit -m "feat(odoo-importer): CSV parser with column normalization"
git push origin main
```

---

## Task 6: Odoo-id-map helper

**Files:**
- Create: `packages/server/src/apps/system/importers/odoo/odoo-id-map.ts`

- [ ] **Step 1: Create the helper**

Write `packages/server/src/apps/system/importers/odoo/odoo-id-map.ts`:

```typescript
export type OdooIdEntry =
  | { kind: 'company'; atlasId: string }
  | { kind: 'contact'; atlasId: string; companyId: string | null }
  | { kind: 'deal'; atlasId: string };

export class OdooIdMap {
  private map = new Map<number, OdooIdEntry>();

  registerCompany(odooId: number, atlasId: string): void {
    this.map.set(odooId, { kind: 'company', atlasId });
  }

  registerContact(odooId: number, atlasId: string, companyId: string | null): void {
    this.map.set(odooId, { kind: 'contact', atlasId, companyId });
  }

  registerDeal(odooId: number, atlasId: string): void {
    this.map.set(odooId, { kind: 'deal', atlasId });
  }

  get(odooId: number): OdooIdEntry | undefined {
    return this.map.get(odooId);
  }

  /** True iff the partner exists and is a company. */
  isCompany(odooId: number): boolean {
    return this.map.get(odooId)?.kind === 'company';
  }

  /** True iff the partner exists and is a contact. */
  isContact(odooId: number): boolean {
    return this.map.get(odooId)?.kind === 'contact';
  }
}
```

- [ ] **Step 2: Build**

```bash
cd /Users/gorkemcetin/atlasmail/packages/server && npm run build
```

- [ ] **Step 3: Commit**

```bash
cd /Users/gorkemcetin/atlasmail
git add packages/server/src/apps/system/importers/odoo/odoo-id-map.ts
git commit -m "feat(odoo-importer): OdooIdMap for cross-file FK resolution"
git push origin main
```

---

## Task 7: Partner mapper (TDD)

**Files:**
- Create: `packages/server/src/apps/system/importers/odoo/map-partner.ts`
- Create: `packages/server/src/apps/system/importers/odoo/__tests__/map-partner.test.ts`

- [ ] **Step 1: Write the failing test**

Write `packages/server/src/apps/system/importers/odoo/__tests__/map-partner.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { mapPartner, type CompanyInsert, type ContactInsert } from '../map-partner';
import type { OdooPartnerRow } from '../types';

const baseRow: OdooPartnerRow = {
  id: 1,
  name: 'Acme Inc',
  is_company: true,
  active: true,
};

describe('mapPartner — companies', () => {
  it('routes is_company=true to a CompanyInsert', () => {
    const result = mapPartner({ ...baseRow });
    expect(result.kind).toBe('company');
    if (result.kind !== 'company') return;
    expect(result.insert.name).toBe('Acme Inc');
  });

  it('concatenates address parts', () => {
    const result = mapPartner({
      ...baseRow,
      street: '1 Market St',
      street2: 'Suite 100',
      city: 'San Francisco',
      state_id: 'CA',
      zip: '94105',
      country_id: 'USA',
    });
    if (result.kind !== 'company') throw new Error('expected company');
    expect(result.insert.address).toBe('1 Market St, Suite 100, San Francisco CA 94105, USA');
    expect(result.insert.postalCode).toBe('94105');
  });

  it('strips http(s) and trailing slash from website → domain', () => {
    const result = mapPartner({ ...baseRow, website: 'https://acme.com/' });
    if (result.kind !== 'company') throw new Error('expected company');
    expect(result.insert.domain).toBe('acme.com');
  });

  it('truncates vat to 11 chars', () => {
    const result = mapPartner({ ...baseRow, vat: 'GB123456789012345' });
    if (result.kind !== 'company') throw new Error('expected company');
    expect(result.insert.taxId).toBe('GB123456789');
  });

  it('splits category_id into trimmed deduped tags', () => {
    const result = mapPartner({ ...baseRow, category_id: ' Important , VIP, Important ' });
    if (result.kind !== 'company') throw new Error('expected company');
    expect(result.insert.tags).toEqual(['Important', 'VIP']);
  });

  it('marks archived', () => {
    const result = mapPartner({ ...baseRow, active: false });
    if (result.kind !== 'company') throw new Error('expected company');
    expect(result.insert.isArchived).toBe(true);
  });
});

describe('mapPartner — contacts', () => {
  const contactBase: OdooPartnerRow = {
    id: 2,
    name: 'Jane Doe',
    is_company: false,
    parent_id: 1,
    email: 'jane@acme.com',
    function: 'CTO',
    active: true,
  };

  it('routes is_company=false to a ContactInsert', () => {
    const result = mapPartner(contactBase);
    expect(result.kind).toBe('contact');
    if (result.kind !== 'contact') return;
    expect(result.insert.name).toBe('Jane Doe');
    expect(result.insert.email).toBe('jane@acme.com');
    expect(result.insert.position).toBe('CTO');
    expect(result.parentOdooId).toBe(1);
  });

  it('uses mobile when phone is missing', () => {
    const result = mapPartner({ ...contactBase, phone: undefined, mobile: '+1-555-1234' });
    if (result.kind !== 'contact') throw new Error('expected contact');
    expect(result.insert.phone).toBe('+1-555-1234');
  });

  it('drops invoice/delivery/other types', () => {
    const result = mapPartner({ ...contactBase, type: 'invoice' });
    expect(result.kind).toBe('drop');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/gorkemcetin/atlasmail/packages/server
npm test
```

- [ ] **Step 3: Implement the mapper**

Write `packages/server/src/apps/system/importers/odoo/map-partner.ts`:

```typescript
import type { OdooPartnerRow } from './types';

export interface CompanyInsert {
  name: string;
  domain: string | null;
  industry: string | null;
  size: string | null;
  address: string | null;
  phone: string | null;
  taxId: string | null;
  postalCode: string | null;
  state: string | null;
  country: string | null;
  logo: string | null;
  tags: string[];
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
  /** comment column, used to seed a crmNote post-insert */
  comment: string | null;
}

export interface ContactInsert {
  name: string;
  email: string | null;
  phone: string | null;
  position: string | null;
  tags: string[];
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type MapPartnerResult =
  | { kind: 'company'; odooId: number; insert: CompanyInsert }
  | { kind: 'contact'; odooId: number; parentOdooId: number | null; insert: ContactInsert }
  | { kind: 'drop'; reason: string };

function parseDate(s: string | undefined): Date {
  if (!s) return new Date();
  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date() : d;
}

function stripHtml(html: string | undefined): string | null {
  if (!html) return null;
  const text = html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
  return text || null;
}

function splitTags(raw: string | undefined): string[] {
  if (!raw) return [];
  const parts = raw.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
  return Array.from(new Set(parts));
}

function buildAddress(row: OdooPartnerRow): string | null {
  const parts: string[] = [];
  if (row.street) parts.push(row.street);
  if (row.street2) parts.push(row.street2);
  const cityLine = [row.city, row.state_id, row.zip].filter(Boolean).join(' ').trim();
  if (cityLine) parts.push(cityLine);
  if (row.country_id) parts.push(row.country_id);
  return parts.length > 0 ? parts.join(', ') : null;
}

function normalizeWebsite(w: string | undefined): string | null {
  if (!w) return null;
  return w.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase();
}

export function mapPartner(row: OdooPartnerRow): MapPartnerResult {
  if (row.type && row.type !== 'contact') {
    return { kind: 'drop', reason: `partner type='${row.type}' (only 'contact' or unset is imported)` };
  }
  const created = parseDate(row.create_date);
  const updated = parseDate(row.write_date);

  if (row.is_company) {
    const insert: CompanyInsert = {
      name: row.name,
      domain: normalizeWebsite(row.website),
      industry: row.industry_id || null,
      size: null,
      address: buildAddress(row),
      phone: row.phone || null,
      taxId: row.vat ? row.vat.slice(0, 11) : null,
      postalCode: row.zip || null,
      state: row.state_id || null,
      country: row.country_id || null,
      logo: row.image_1920 ? `data:image/png;base64,${row.image_1920}` : null,
      tags: splitTags(row.category_id),
      isArchived: !row.active,
      createdAt: created,
      updatedAt: updated,
      comment: stripHtml(row.comment),
    };
    return { kind: 'company', odooId: row.id, insert };
  }

  const insert: ContactInsert = {
    name: row.name,
    email: row.email || null,
    phone: row.phone || row.mobile || null,
    position: row.function || null,
    tags: splitTags(row.category_id),
    isArchived: !row.active,
    createdAt: created,
    updatedAt: updated,
  };
  return { kind: 'contact', odooId: row.id, parentOdooId: row.parent_id ?? null, insert };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/gorkemcetin/atlasmail/packages/server && npm test
```

Expected: all map-partner tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/gorkemcetin/atlasmail
git add packages/server/src/apps/system/importers/odoo/map-partner.ts packages/server/src/apps/system/importers/odoo/__tests__/map-partner.test.ts
git commit -m "feat(odoo-importer): partner mapper (companies + contacts)"
git push origin main
```

---

## Task 8: Lead mapper (TDD)

**Files:**
- Create: `packages/server/src/apps/system/importers/odoo/map-lead.ts`
- Create: `packages/server/src/apps/system/importers/odoo/__tests__/map-lead.test.ts`

- [ ] **Step 1: Write the failing test**

Write `packages/server/src/apps/system/importers/odoo/__tests__/map-lead.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { mapLead } from '../map-lead';
import type { OdooLeadRow } from '../types';

const baseLead: OdooLeadRow = {
  id: 10,
  name: 'Q4 deal',
  type: 'lead',
  active: true,
};

describe('mapLead — leads', () => {
  it('routes type=lead to LeadInsert with status=new', () => {
    const result = mapLead({ ...baseLead });
    expect(result.kind).toBe('lead');
    if (result.kind !== 'lead') return;
    expect(result.insert.status).toBe('new');
  });

  it('marks status=lost when active=false and lost_reason_id set', () => {
    const result = mapLead({ ...baseLead, active: false, lost_reason_id: 'No budget' });
    if (result.kind !== 'lead') throw new Error('expected lead');
    expect(result.insert.status).toBe('lost');
  });

  it('uses contact_name as name when provided', () => {
    const result = mapLead({ ...baseLead, contact_name: 'John Smith' });
    if (result.kind !== 'lead') throw new Error('expected lead');
    expect(result.insert.name).toBe('John Smith');
  });
});

describe('mapLead — opportunities', () => {
  const baseOpp: OdooLeadRow = {
    id: 20,
    name: 'Big SaaS deal',
    type: 'opportunity',
    expected_revenue: 50000,
    probability: 60,
    stage_id: 'Negotiation',
    active: true,
  };

  it('routes type=opportunity to DealInsert', () => {
    const result = mapLead(baseOpp);
    expect(result.kind).toBe('deal');
    if (result.kind !== 'deal') return;
    expect(result.insert.title).toBe('Big SaaS deal');
    expect(result.insert.value).toBe(50000);
    expect(result.insert.probability).toBe(60);
    expect(result.odooStage).toBe('Negotiation');
  });

  it('sets currency from currency_id, defaults to USD', () => {
    const a = mapLead({ ...baseOpp, currency_id: 'EUR' });
    if (a.kind !== 'deal') throw new Error('expected deal');
    expect(a.insert.currency).toBe('EUR');

    const b = mapLead({ ...baseOpp, currency_id: undefined });
    if (b.kind !== 'deal') throw new Error('expected deal');
    expect(b.insert.currency).toBe('USD');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/gorkemcetin/atlasmail/packages/server && npm test
```

- [ ] **Step 3: Implement the mapper**

Write `packages/server/src/apps/system/importers/odoo/map-lead.ts`:

```typescript
import type { OdooLeadRow } from './types';

export interface LeadInsert {
  name: string;
  email: string | null;
  phone: string | null;
  companyName: string | null;
  source: string;
  status: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';
  notes: string | null;
  expectedRevenue: number;
  probability: number;
  expectedCloseDate: Date | null;
  tags: string[];
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DealInsert {
  title: string;
  value: number;
  currency: string;
  probability: number;
  expectedCloseDate: Date | null;
  lostReason: string | null;
  wonAt: Date | null;
  lostAt: Date | null;
  tags: string[];
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
  /** Used to attach a crmNote with the description after insert */
  description: string | null;
}

export type MapLeadResult =
  | { kind: 'lead'; odooId: number; partnerOdooId: number | null; insert: LeadInsert }
  | {
      kind: 'deal';
      odooId: number;
      partnerOdooId: number | null;
      odooStage: string | null;
      insert: DealInsert;
    };

function parseDate(s: string | undefined): Date {
  if (!s) return new Date();
  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date() : d;
}

function parseDateOrNull(s: string | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function stripHtml(html: string | undefined): string | null {
  if (!html) return null;
  const text = html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
  return text || null;
}

function splitTags(raw: string | undefined): string[] {
  if (!raw) return [];
  const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
  return Array.from(new Set(parts));
}

export function mapLead(row: OdooLeadRow): MapLeadResult {
  const created = parseDate(row.create_date);
  const updated = parseDate(row.write_date);

  if (row.type === 'opportunity') {
    const insert: DealInsert = {
      title: row.name,
      value: row.expected_revenue ?? 0,
      currency: row.currency_id || 'USD',
      probability: row.probability ?? 0,
      expectedCloseDate: parseDateOrNull(row.date_deadline),
      lostReason: row.lost_reason_id || null,
      wonAt: null,
      lostAt: row.active === false && row.lost_reason_id ? updated : null,
      tags: splitTags(row.tag_ids),
      isArchived: row.active === false && !row.lost_reason_id,
      createdAt: created,
      updatedAt: updated,
      description: stripHtml(row.description),
    };
    return {
      kind: 'deal',
      odooId: row.id,
      partnerOdooId: row.partner_id ?? null,
      odooStage: row.stage_id || null,
      insert,
    };
  }

  let status: LeadInsert['status'] = 'new';
  if (row.active === false && row.lost_reason_id) status = 'lost';

  const name = row.contact_name && row.contact_name !== row.name ? row.contact_name : row.name;
  const noteParts: string[] = [];
  if (row.contact_name && row.contact_name !== row.name) noteParts.push(`Original name: ${row.name}`);
  const desc = stripHtml(row.description);
  if (desc) noteParts.push(desc);

  const insert: LeadInsert = {
    name,
    email: row.email_from || null,
    phone: row.phone || row.mobile || null,
    companyName: row.partner_name || null,
    source: 'other',
    status,
    notes: noteParts.length > 0 ? noteParts.join('\n\n') : null,
    expectedRevenue: row.expected_revenue ?? 0,
    probability: row.probability ?? 0,
    expectedCloseDate: parseDateOrNull(row.date_deadline),
    tags: splitTags(row.tag_ids),
    isArchived: row.active === false && !row.lost_reason_id,
    createdAt: created,
    updatedAt: updated,
  };
  return { kind: 'lead', odooId: row.id, partnerOdooId: row.partner_id ?? null, insert };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/gorkemcetin/atlasmail/packages/server && npm test
```

- [ ] **Step 5: Commit**

```bash
cd /Users/gorkemcetin/atlasmail
git add packages/server/src/apps/system/importers/odoo/map-lead.ts packages/server/src/apps/system/importers/odoo/__tests__/map-lead.test.ts
git commit -m "feat(odoo-importer): lead mapper (leads + opportunities)"
git push origin main
```

---

## Task 9: Activity mapper (TDD)

**Files:**
- Create: `packages/server/src/apps/system/importers/odoo/map-activity.ts`
- Create: `packages/server/src/apps/system/importers/odoo/__tests__/map-activity.test.ts`

- [ ] **Step 1: Write the failing test**

Write `packages/server/src/apps/system/importers/odoo/__tests__/map-activity.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { mapActivity } from '../map-activity';
import { OdooIdMap } from '../odoo-id-map';
import type { OdooActivityRow } from '../types';

const baseActivity: OdooActivityRow = {
  id: 1,
  res_model: 'res.partner',
  res_id: 100,
  date_deadline: '2026-05-01',
  summary: 'Follow up',
  note: 'Call about pricing',
};

describe('mapActivity', () => {
  it('drops rows with unsupported res_model', () => {
    const idMap = new OdooIdMap();
    const result = mapActivity({ ...baseActivity, res_model: 'sale.order' }, idMap);
    expect(result.kind).toBe('drop');
    if (result.kind !== 'drop') return;
    expect(result.reason).toMatch(/sale.order/);
  });

  it('attaches to a company', () => {
    const idMap = new OdooIdMap();
    idMap.registerCompany(100, 'company-uuid');
    const result = mapActivity(baseActivity, idMap);
    if (result.kind !== 'activity') throw new Error('expected activity');
    expect(result.insert.companyId).toBe('company-uuid');
    expect(result.insert.contactId).toBeNull();
    expect(result.insert.dealId).toBeNull();
  });

  it('attaches to a contact', () => {
    const idMap = new OdooIdMap();
    idMap.registerContact(100, 'contact-uuid', 'company-uuid');
    const result = mapActivity(baseActivity, idMap);
    if (result.kind !== 'activity') throw new Error('expected activity');
    expect(result.insert.contactId).toBe('contact-uuid');
    expect(result.insert.companyId).toBeNull();
  });

  it('attaches to a deal when res_model=crm.lead and odoo lead became deal', () => {
    const idMap = new OdooIdMap();
    idMap.registerDeal(50, 'deal-uuid');
    const result = mapActivity({ ...baseActivity, res_model: 'crm.lead', res_id: 50 }, idMap);
    if (result.kind !== 'activity') throw new Error('expected activity');
    expect(result.insert.dealId).toBe('deal-uuid');
  });

  it('drops activities tied to imported leads (not deals)', () => {
    const idMap = new OdooIdMap();
    // odoo lead 60 was imported as a crmLead, not deal — not in idMap
    const result = mapActivity({ ...baseActivity, res_model: 'crm.lead', res_id: 60 }, idMap);
    expect(result.kind).toBe('drop');
    if (result.kind !== 'drop') return;
    expect(result.reason).toMatch(/lead/i);
  });

  it('drops activities pointing to unknown partner', () => {
    const idMap = new OdooIdMap();
    const result = mapActivity({ ...baseActivity, res_id: 999 }, idMap);
    expect(result.kind).toBe('drop');
    if (result.kind !== 'drop') return;
    expect(result.reason).toMatch(/not found/i);
  });

  it('prepends summary to body', () => {
    const idMap = new OdooIdMap();
    idMap.registerCompany(100, 'company-uuid');
    const result = mapActivity(baseActivity, idMap);
    if (result.kind !== 'activity') throw new Error('expected activity');
    expect(result.insert.body).toBe('Follow up\n\nCall about pricing');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/gorkemcetin/atlasmail/packages/server && npm test
```

- [ ] **Step 3: Implement the mapper**

Write `packages/server/src/apps/system/importers/odoo/map-activity.ts`:

```typescript
import type { OdooActivityRow } from './types';
import type { OdooIdMap } from './odoo-id-map';

export interface ActivityInsert {
  type: string;
  body: string;
  dealId: string | null;
  contactId: string | null;
  companyId: string | null;
  scheduledAt: Date | null;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type MapActivityResult =
  | { kind: 'activity'; insert: ActivityInsert }
  | { kind: 'drop'; reason: string };

function parseDate(s: string | undefined): Date {
  if (!s) return new Date();
  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date() : d;
}

function parseDateOrNull(s: string | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function stripHtml(html: string | undefined): string {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
}

export function mapActivity(row: OdooActivityRow, idMap: OdooIdMap): MapActivityResult {
  if (row.res_model !== 'res.partner' && row.res_model !== 'crm.lead') {
    return { kind: 'drop', reason: `unsupported res_model='${row.res_model}'` };
  }

  let dealId: string | null = null;
  let contactId: string | null = null;
  let companyId: string | null = null;

  if (row.res_model === 'crm.lead') {
    const entry = idMap.get(row.res_id);
    if (!entry || entry.kind !== 'deal') {
      return {
        kind: 'drop',
        reason:
          'attached to a lead, which Atlas activities cannot reference (only deals/contacts/companies)',
      };
    }
    dealId = entry.atlasId;
  } else {
    const entry = idMap.get(row.res_id);
    if (!entry) {
      return { kind: 'drop', reason: `partner id=${row.res_id} not found in uploaded partners file` };
    }
    if (entry.kind === 'company') {
      companyId = entry.atlasId;
    } else if (entry.kind === 'contact') {
      contactId = entry.atlasId;
    } else {
      return { kind: 'drop', reason: 'partner mapped to unexpected kind' };
    }
  }

  const summary = stripHtml(row.summary);
  const note = stripHtml(row.note);
  const body = [summary, note].filter(Boolean).join('\n\n');

  const insert: ActivityInsert = {
    type: row.activity_type_id || 'note',
    body,
    dealId,
    contactId,
    companyId,
    scheduledAt: parseDateOrNull(row.date_deadline),
    isArchived: false,
    createdAt: parseDate(row.create_date),
    updatedAt: parseDate(row.write_date),
  };
  return { kind: 'activity', insert };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/gorkemcetin/atlasmail/packages/server && npm test
```

- [ ] **Step 5: Commit**

```bash
cd /Users/gorkemcetin/atlasmail
git add packages/server/src/apps/system/importers/odoo/map-activity.ts packages/server/src/apps/system/importers/odoo/__tests__/map-activity.test.ts
git commit -m "feat(odoo-importer): activity mapper with FK resolution"
git push origin main
```

---

## Task 10: Session store

**Files:**
- Create: `packages/server/src/apps/system/importers/odoo/session-store.ts`

- [ ] **Step 1: Create the store**

Write `packages/server/src/apps/system/importers/odoo/session-store.ts`:

```typescript
import { randomUUID } from 'crypto';
import type { ImportSession } from './types';

const SESSION_TTL_MS = 30 * 60 * 1000;

class SessionStore {
  private sessions = new Map<string, ImportSession>();
  private sweepTimer: NodeJS.Timeout | null = null;

  constructor() {
    // Sweep stale sessions every minute
    this.sweepTimer = setInterval(() => this.sweep(), 60 * 1000);
    if (this.sweepTimer.unref) this.sweepTimer.unref();
  }

  create(tenantId: string, userId: string): ImportSession {
    const session: ImportSession = {
      sessionId: randomUUID(),
      tenantId,
      userId,
      createdAt: Date.now(),
      partners: [],
      leads: [],
      activities: [],
      dropped: [],
      customFields: [],
    };
    this.sessions.set(session.sessionId, session);
    return session;
  }

  get(sessionId: string): ImportSession | undefined {
    const s = this.sessions.get(sessionId);
    if (!s) return undefined;
    if (Date.now() - s.createdAt > SESSION_TTL_MS) {
      this.sessions.delete(sessionId);
      return undefined;
    }
    return s;
  }

  delete(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  private sweep(): void {
    const now = Date.now();
    for (const [id, session] of this.sessions.entries()) {
      if (now - session.createdAt > SESSION_TTL_MS) {
        this.sessions.delete(id);
      }
    }
  }
}

export const sessionStore = new SessionStore();
```

- [ ] **Step 2: Build**

```bash
cd /Users/gorkemcetin/atlasmail/packages/server && npm run build
```

- [ ] **Step 3: Commit**

```bash
cd /Users/gorkemcetin/atlasmail
git add packages/server/src/apps/system/importers/odoo/session-store.ts
git commit -m "feat(odoo-importer): in-memory session store with 30-min TTL"
git push origin main
```

---

## Task 11: Preview service (TDD)

**Files:**
- Create: `packages/server/src/apps/system/importers/odoo/preview.service.ts`
- Create: `packages/server/src/apps/system/importers/odoo/__tests__/preview.service.test.ts`

- [ ] **Step 1: Write the failing test**

Write `packages/server/src/apps/system/importers/odoo/__tests__/preview.service.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildPreview } from '../preview.service';

describe('buildPreview', () => {
  it('returns counts and unrecognized fields for partners only', () => {
    const partners = Buffer.from(
      'id,name,is_company,x_score\n1,Acme,True,42\n2,Bob,False,\n',
    );
    const result = buildPreview(
      { partners, leads: undefined, activities: undefined },
      [{ id: 'stage-1', name: 'New', sequence: 0 }],
    );
    expect(result.counts.companies).toBe(1);
    expect(result.counts.contacts).toBe(1);
    expect(result.counts.leads).toBe(0);
    expect(result.counts.deals).toBe(0);
    expect(result.customFields).toContainEqual({
      column: 'x_score',
      sampleValue: '42',
      file: 'partners',
    });
  });

  it('returns distinct opportunity stages for stage-mapping UI', () => {
    const partners = Buffer.from('id,name,is_company\n1,Acme,True\n');
    const leads = Buffer.from(
      'id,name,type,stage_id\n1,Big deal,opportunity,Negotiation\n2,Other deal,opportunity,Negotiation\n3,Lead,lead,\n',
    );
    const result = buildPreview(
      { partners, leads, activities: undefined },
      [{ id: 'stage-1', name: 'New', sequence: 0 }],
    );
    expect(result.stages).toHaveLength(1);
    expect(result.stages[0]).toEqual({ odooStage: 'Negotiation', rowCount: 2 });
    expect(result.counts.deals).toBe(2);
    expect(result.counts.leads).toBe(1);
  });

  it('reports parser errors as a thrown error', () => {
    const bad = Buffer.from('id,name\n1,NoCompanyColumn\n');
    expect(() =>
      buildPreview({ partners: bad, leads: undefined, activities: undefined }, []),
    ).toThrow(/is_company/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/gorkemcetin/atlasmail/packages/server && npm test
```

- [ ] **Step 3: Implement the preview service**

Write `packages/server/src/apps/system/importers/odoo/preview.service.ts`:

```typescript
import { parsePartnerCsv, parseLeadCsv, parseActivityCsv } from './csv-parser';
import { mapPartner } from './map-partner';
import { mapLead } from './map-lead';
import type {
  OdooPartnerRow,
  OdooLeadRow,
  OdooActivityRow,
  OdooImportPreview,
  OdooImportFileKind,
} from './types';

interface PreviewBuffers {
  partners: Buffer | undefined;
  leads: Buffer | undefined;
  activities: Buffer | undefined;
}

interface AtlasStage {
  id: string;
  name: string;
  sequence: number;
}

export interface PreviewResult {
  preview: Omit<OdooImportPreview, 'sessionId' | 'atlasStages'> & {
    atlasStages: AtlasStage[];
  };
  partners: OdooPartnerRow[];
  leads: OdooLeadRow[];
  activities: OdooActivityRow[];
  customFields: Array<{ column: string; sampleValue: string | null; file: OdooImportFileKind }>;
  dropped: Array<{ file: OdooImportFileKind; reason: string; count: number }>;
}

function findSampleValue(buf: Buffer, column: string): string | null {
  // We re-parse only to grab the first non-empty cell; preview is rare so cheap is fine.
  const text = buf.toString('utf-8');
  const lines = text.split(/\r?\n/);
  if (lines.length < 2) return null;
  const header = lines[0].split(',').map((s) => s.replace(/^"|"$/g, '').trim());
  const idx = header.indexOf(column);
  if (idx === -1) {
    // try suffix-stripped match
    const altIdx = header.findIndex((h) => h.replace(/\/\.?id$/, '') === column);
    if (altIdx === -1) return null;
    return findInColumn(lines, altIdx);
  }
  return findInColumn(lines, idx);
}

function findInColumn(lines: string[], idx: number): string | null {
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(',');
    const cell = cells[idx]?.replace(/^"|"$/g, '').trim();
    if (cell) return cell;
  }
  return null;
}

export function buildPreview(buffers: PreviewBuffers, atlasStages: AtlasStage[]): PreviewResult {
  const customFields: Array<{ column: string; sampleValue: string | null; file: OdooImportFileKind }> = [];
  const dropped: Array<{ file: OdooImportFileKind; reason: string; count: number }> = [];

  let partnerRows: OdooPartnerRow[] = [];
  let leadRows: OdooLeadRow[] = [];
  let activityRows: OdooActivityRow[] = [];

  let companyCount = 0;
  let contactCount = 0;
  let leadCount = 0;
  let dealCount = 0;
  const stageBuckets = new Map<string, number>();
  const droppedReasons = new Map<string, number>(); // key: file|reason

  if (buffers.partners) {
    const parsed = parsePartnerCsv(buffers.partners);
    partnerRows = parsed.rows;
    for (const col of parsed.unrecognizedColumns) {
      customFields.push({ column: col, sampleValue: findSampleValue(buffers.partners, col), file: 'partners' });
    }
    for (const row of partnerRows) {
      const result = mapPartner(row);
      if (result.kind === 'company') companyCount++;
      else if (result.kind === 'contact') contactCount++;
      else if (result.kind === 'drop') {
        const key = `partners|${result.reason}`;
        droppedReasons.set(key, (droppedReasons.get(key) ?? 0) + 1);
      }
    }
  }

  if (buffers.leads) {
    const parsed = parseLeadCsv(buffers.leads);
    leadRows = parsed.rows;
    for (const col of parsed.unrecognizedColumns) {
      customFields.push({ column: col, sampleValue: findSampleValue(buffers.leads, col), file: 'leads' });
    }
    for (const row of leadRows) {
      const result = mapLead(row);
      if (result.kind === 'lead') leadCount++;
      else if (result.kind === 'deal') {
        dealCount++;
        const stage = result.odooStage ?? '(no stage)';
        stageBuckets.set(stage, (stageBuckets.get(stage) ?? 0) + 1);
      }
    }
  }

  if (buffers.activities) {
    const parsed = parseActivityCsv(buffers.activities);
    activityRows = parsed.rows;
    for (const col of parsed.unrecognizedColumns) {
      customFields.push({ column: col, sampleValue: findSampleValue(buffers.activities, col), file: 'activities' });
    }
  }

  for (const [key, count] of droppedReasons.entries()) {
    const [file, reason] = key.split('|');
    dropped.push({ file: file as OdooImportFileKind, reason, count });
  }

  const stages = Array.from(stageBuckets.entries())
    .map(([odooStage, rowCount]) => ({ odooStage, rowCount }))
    .sort((a, b) => b.rowCount - a.rowCount);

  return {
    preview: {
      counts: {
        companies: companyCount,
        contacts: contactCount,
        leads: leadCount,
        deals: dealCount,
        activities: activityRows.length,
      },
      dropped,
      stages,
      customFields,
      atlasStages,
    },
    partners: partnerRows,
    leads: leadRows,
    activities: activityRows,
    customFields,
    dropped,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/gorkemcetin/atlasmail/packages/server && npm test
```

- [ ] **Step 5: Commit**

```bash
cd /Users/gorkemcetin/atlasmail
git add packages/server/src/apps/system/importers/odoo/preview.service.ts packages/server/src/apps/system/importers/odoo/__tests__/preview.service.test.ts
git commit -m "feat(odoo-importer): preview service builds counts/stages/custom-fields"
git push origin main
```

---

## Task 12: Commit service (three-pass insert)

This task is the largest. The commit service writes via raw `tx.insert(...)` calls inside a Drizzle transaction. We deliberately bypass the per-entity `createX` helpers to (a) preserve Odoo timestamps, (b) keep atomicity, (c) avoid refactoring the helpers.

**Files:**
- Create: `packages/server/src/apps/system/importers/odoo/commit.service.ts`

- [ ] **Step 1: Read the schema to confirm column names**

Read these blocks in `packages/server/src/db/schema.ts`:
- `crmCompanies` (line ~1380)
- `crmContacts` (line ~1408)
- `crmLeads` (line ~1570)
- `crmDeals` (line ~1445)
- `crmActivities` (line ~1490)
- `crmNotes` (line ~1601)

Confirm the column names match what's used in this task's SQL.

- [ ] **Step 2: Implement the commit service**

Write `packages/server/src/apps/system/importers/odoo/commit.service.ts`:

```typescript
import { db } from '../../../../config/database';
import {
  crmCompanies, crmContacts, crmLeads, crmDeals, crmActivities, crmNotes, crmDealStages,
} from '../../../../db/schema';
import { eq, inArray } from 'drizzle-orm';
import { mapPartner } from './map-partner';
import { mapLead } from './map-lead';
import { mapActivity } from './map-activity';
import { OdooIdMap } from './odoo-id-map';
import type { ImportSession, OdooImportSummary, OdooImportFileKind } from './types';

export interface CommitInput {
  session: ImportSession;
  /** odoo stage label → atlas stage id */
  stageMapping: Record<string, string>;
}

export async function commitImport(input: CommitInput): Promise<OdooImportSummary> {
  const { session, stageMapping } = input;
  const { tenantId, userId } = session;

  // Validate stage mapping references stages that still exist for this tenant
  const mappedStageIds = Array.from(new Set(Object.values(stageMapping)));
  if (mappedStageIds.length > 0) {
    const existing = await db
      .select({ id: crmDealStages.id })
      .from(crmDealStages)
      .where(inArray(crmDealStages.id, mappedStageIds));
    const existingIds = new Set(existing.map((s) => s.id));
    for (const id of mappedStageIds) {
      if (!existingIds.has(id)) {
        throw new Error('STAGE_MAPPING_STALE');
      }
    }
  }

  const idMap = new OdooIdMap();
  let companyCount = 0;
  let contactCount = 0;
  let leadCount = 0;
  let dealCount = 0;
  let activityCount = 0;
  const droppedDuringCommit: Array<{ file: OdooImportFileKind; reason: string; count: number }> = [];

  await db.transaction(async (tx) => {
    // Pass 1a: companies first (so contacts can reference parent company)
    const companyByOdooId: Map<number, string> = new Map();
    for (const row of session.partners) {
      const result = mapPartner(row);
      if (result.kind !== 'company') continue;

      const [inserted] = await tx
        .insert(crmCompanies)
        .values({
          tenantId,
          userId,
          name: result.insert.name,
          domain: result.insert.domain,
          industry: result.insert.industry,
          size: result.insert.size,
          address: result.insert.address,
          phone: result.insert.phone,
          taxId: result.insert.taxId,
          postalCode: result.insert.postalCode,
          state: result.insert.state,
          country: result.insert.country,
          logo: result.insert.logo,
          tags: result.insert.tags,
          isArchived: result.insert.isArchived,
          createdAt: result.insert.createdAt,
          updatedAt: result.insert.updatedAt,
        })
        .returning({ id: crmCompanies.id });

      idMap.registerCompany(row.id, inserted.id);
      companyByOdooId.set(row.id, inserted.id);
      companyCount++;

      if (result.insert.comment) {
        await tx.insert(crmNotes).values({
          tenantId,
          userId,
          title: '',
          content: { plain: result.insert.comment },
          companyId: inserted.id,
          isPinned: false,
          isArchived: false,
          createdAt: result.insert.createdAt,
          updatedAt: result.insert.updatedAt,
        });
      }
    }

    // Pass 1b: contacts, resolving parent_id via the map
    for (const row of session.partners) {
      const result = mapPartner(row);
      if (result.kind !== 'contact') continue;

      const companyId = result.parentOdooId ? (companyByOdooId.get(result.parentOdooId) ?? null) : null;

      const [inserted] = await tx
        .insert(crmContacts)
        .values({
          tenantId,
          userId,
          name: result.insert.name,
          email: result.insert.email,
          phone: result.insert.phone,
          companyId,
          position: result.insert.position,
          tags: result.insert.tags,
          isArchived: result.insert.isArchived,
          createdAt: result.insert.createdAt,
          updatedAt: result.insert.updatedAt,
        })
        .returning({ id: crmContacts.id });

      idMap.registerContact(row.id, inserted.id, companyId);
      contactCount++;
    }

    // Pass 2: leads + deals
    for (const row of session.leads) {
      const result = mapLead(row);

      if (result.kind === 'lead') {
        await tx.insert(crmLeads).values({
          tenantId,
          userId,
          name: result.insert.name,
          email: result.insert.email,
          phone: result.insert.phone,
          companyName: result.insert.companyName,
          source: result.insert.source,
          status: result.insert.status,
          notes: result.insert.notes,
          expectedRevenue: result.insert.expectedRevenue,
          probability: result.insert.probability,
          expectedCloseDate: result.insert.expectedCloseDate,
          tags: result.insert.tags,
          isArchived: result.insert.isArchived,
          createdAt: result.insert.createdAt,
          updatedAt: result.insert.updatedAt,
        });
        leadCount++;
        continue;
      }

      // Deal: resolve stage + partner
      const stageKey = result.odooStage ?? '(no stage)';
      const stageId = stageMapping[stageKey];
      if (!stageId) {
        droppedDuringCommit.push({
          file: 'leads',
          reason: `opportunity stage '${stageKey}' has no mapping`,
          count: 1,
        });
        continue;
      }

      let contactId: string | null = null;
      let companyId: string | null = null;
      if (result.partnerOdooId) {
        const entry = idMap.get(result.partnerOdooId);
        if (entry?.kind === 'company') {
          companyId = entry.atlasId;
        } else if (entry?.kind === 'contact') {
          contactId = entry.atlasId;
          companyId = entry.companyId;
        }
      }

      const [inserted] = await tx
        .insert(crmDeals)
        .values({
          tenantId,
          userId,
          title: result.insert.title,
          value: result.insert.value,
          currency: result.insert.currency,
          stageId,
          contactId,
          companyId,
          probability: result.insert.probability,
          expectedCloseDate: result.insert.expectedCloseDate,
          wonAt: result.insert.wonAt,
          lostAt: result.insert.lostAt,
          lostReason: result.insert.lostReason,
          tags: result.insert.tags,
          isArchived: result.insert.isArchived,
          stageEnteredAt: result.insert.updatedAt,
          createdAt: result.insert.createdAt,
          updatedAt: result.insert.updatedAt,
        })
        .returning({ id: crmDeals.id });

      idMap.registerDeal(row.id, inserted.id);
      dealCount++;

      if (result.insert.description) {
        await tx.insert(crmNotes).values({
          tenantId,
          userId,
          title: '',
          content: { plain: result.insert.description },
          dealId: inserted.id,
          isPinned: false,
          isArchived: false,
          createdAt: result.insert.createdAt,
          updatedAt: result.insert.updatedAt,
        });
      }
    }

    // Pass 3: activities
    const activityDropReasons = new Map<string, number>();
    for (const row of session.activities) {
      const result = mapActivity(row, idMap);
      if (result.kind === 'drop') {
        activityDropReasons.set(result.reason, (activityDropReasons.get(result.reason) ?? 0) + 1);
        continue;
      }
      await tx.insert(crmActivities).values({
        tenantId,
        userId,
        type: result.insert.type,
        body: result.insert.body,
        dealId: result.insert.dealId,
        contactId: result.insert.contactId,
        companyId: result.insert.companyId,
        scheduledAt: result.insert.scheduledAt,
        isArchived: result.insert.isArchived,
        createdAt: result.insert.createdAt,
        updatedAt: result.insert.updatedAt,
      });
      activityCount++;
    }
    for (const [reason, count] of activityDropReasons.entries()) {
      droppedDuringCommit.push({ file: 'activities', reason, count });
    }
  });

  return {
    imported: {
      companies: companyCount,
      contacts: contactCount,
      leads: leadCount,
      deals: dealCount,
      activities: activityCount,
    },
    dropped: [...session.dropped.reduce(coalesceReasons, [] as typeof session.dropped extends Array<infer T> ? T[] : never), ...droppedDuringCommit].map((d) => ({
      file: d.file,
      reason: d.reason,
      count: 'count' in d ? (d as { count: number }).count : 1,
    })) as OdooImportSummary['dropped'],
    customFieldsSkipped: session.customFields.length,
  };
}

function coalesceReasons<T extends { file: string; reason: string }>(acc: T[], cur: T): T[] {
  return [...acc, cur];
}
```

> **Note for the engineer**: that final `dropped` array shape is deliberately simple. If the type assertion looks ugly, you can simplify by tracking dropped as a `Map<string, { file; reason; count }>` from the start. Keep the function shape as exported.

- [ ] **Step 3: Build**

```bash
cd /Users/gorkemcetin/atlasmail/packages/server && npm run build
```

Expected: clean build. If TypeScript complains about the final `dropped` array assertion, refactor to a cleaner Map-based aggregation rather than fighting the type system.

- [ ] **Step 4: Commit**

```bash
cd /Users/gorkemcetin/atlasmail
git add packages/server/src/apps/system/importers/odoo/commit.service.ts
git commit -m "feat(odoo-importer): three-pass commit service in single transaction"
git push origin main
```

---

## Task 13: Routes + controller (with multer memoryStorage)

**Files:**
- Create: `packages/server/src/apps/system/importers/odoo/controller.ts`
- Create: `packages/server/src/apps/system/importers/odoo/routes.ts`
- Modify: `packages/server/src/apps/system/routes.ts`

- [ ] **Step 1: Create the controller**

Write `packages/server/src/apps/system/importers/odoo/controller.ts`:

```typescript
import type { Request, Response } from 'express';
import { db } from '../../../../config/database';
import { crmDealStages } from '../../../../db/schema';
import { and, eq } from 'drizzle-orm';
import { logger } from '../../../../utils/logger';
import { sessionStore } from './session-store';
import { buildPreview } from './preview.service';
import { commitImport } from './commit.service';
import { parsePartnerCsv, parseLeadCsv, parseActivityCsv } from './csv-parser';

export async function previewOdoo(req: Request, res: Response) {
  const tenantId = req.auth?.tenantId;
  const userId = req.auth?.userId;
  if (!tenantId || !userId) {
    res.status(400).json({ success: false, error: 'No active tenant' });
    return;
  }

  const files = req.files as Record<string, Express.Multer.File[]> | undefined;
  const partnerBuf = files?.partners?.[0]?.buffer;
  const leadBuf = files?.leads?.[0]?.buffer;
  const activityBuf = files?.activities?.[0]?.buffer;

  if (!partnerBuf) {
    res.status(400).json({ success: false, error: 'res.partner.csv is required' });
    return;
  }

  try {
    const stages = await db
      .select({ id: crmDealStages.id, name: crmDealStages.name, sequence: crmDealStages.sequence })
      .from(crmDealStages)
      .where(eq(crmDealStages.tenantId, tenantId));

    const result = buildPreview(
      { partners: partnerBuf, leads: leadBuf, activities: activityBuf },
      stages.map((s) => ({ id: s.id, name: s.name, sequence: s.sequence })),
    );

    const session = sessionStore.create(tenantId, userId);
    session.partners = result.partners;
    session.leads = result.leads;
    session.activities = result.activities;
    session.dropped = []; // populated only post-commit
    session.customFields = result.customFields;

    res.json({
      success: true,
      data: {
        sessionId: session.sessionId,
        ...result.preview,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to parse files';
    logger.error({ error }, 'Odoo importer preview failed');
    res.status(400).json({ success: false, error: msg });
  }
}

export async function commitOdoo(req: Request, res: Response) {
  const tenantId = req.auth?.tenantId;
  if (!tenantId) {
    res.status(400).json({ success: false, error: 'No active tenant' });
    return;
  }
  const { sessionId, stageMapping } = req.body as { sessionId?: string; stageMapping?: Record<string, string> };
  if (!sessionId || !stageMapping) {
    res.status(400).json({ success: false, error: 'sessionId and stageMapping are required' });
    return;
  }

  const session = sessionStore.get(sessionId);
  if (!session) {
    res.status(404).json({ success: false, error: 'Session not found or expired' });
    return;
  }
  if (session.tenantId !== tenantId) {
    res.status(403).json({ success: false, error: 'Session belongs to a different tenant' });
    return;
  }

  try {
    const summary = await commitImport({ session, stageMapping });
    sessionStore.delete(sessionId);
    res.json({ success: true, data: summary });
  } catch (error) {
    if (error instanceof Error && error.message === 'STAGE_MAPPING_STALE') {
      res.status(409).json({
        success: false,
        error: 'The stage you mapped to has been changed. Please re-run preview.',
      });
      return;
    }
    logger.error({ error }, 'Odoo importer commit failed');
    res.status(500).json({ success: false, error: 'Import failed' });
  }
}
```

- [ ] **Step 2: Create the router**

Write `packages/server/src/apps/system/importers/odoo/routes.ts`:

```typescript
import { Router } from 'express';
import multer from 'multer';
import type { Request, Response, NextFunction } from 'express';
import { isTenantOwner } from '@atlas-platform/shared';
import { authMiddleware } from '../../../../middleware/auth';
import * as controller from './controller';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 3 },
});

function requireTenantOwner(req: Request, res: Response, next: NextFunction) {
  if (!isTenantOwner(req.auth?.tenantRole)) {
    res.status(403).json({ success: false, error: 'Owner access required' });
    return;
  }
  next();
}

const router = Router();
router.use(authMiddleware);
router.use(requireTenantOwner);

router.post(
  '/preview',
  upload.fields([
    { name: 'partners', maxCount: 1 },
    { name: 'leads', maxCount: 1 },
    { name: 'activities', maxCount: 1 },
  ]),
  controller.previewOdoo,
);
router.post('/commit', controller.commitOdoo);

export default router;
```

- [ ] **Step 3: Mount under system routes**

Read `packages/server/src/apps/system/routes.ts`. Add at the top:

```typescript
import odooImporterRouter from './importers/odoo/routes';
```

After the existing `router.use(authMiddleware);` block and before any of the registered routes, mount the importer:

```typescript
router.use('/importers/odoo', odooImporterRouter);
```

- [ ] **Step 4: Build**

```bash
cd /Users/gorkemcetin/atlasmail/packages/server && npm run build
```

- [ ] **Step 5: Smoke-test the routes exist (no auth needed for 401 check)**

```bash
lsof -ti:3001 | xargs kill -9 2>/dev/null || true
cd /Users/gorkemcetin/atlasmail/packages/server && npm run dev > /tmp/atlas-server.log 2>&1 &
sleep 5
curl -s -o /dev/null -w "POST /preview: HTTP %{http_code}\n" -X POST http://localhost:3001/api/v1/system/importers/odoo/preview
curl -s -o /dev/null -w "POST /commit:  HTTP %{http_code}\n" -X POST http://localhost:3001/api/v1/system/importers/odoo/commit
```

Expected: both return `HTTP 401` (auth required → endpoints exist).

- [ ] **Step 6: Commit**

```bash
cd /Users/gorkemcetin/atlasmail
git add packages/server/src/apps/system/importers/odoo/controller.ts packages/server/src/apps/system/importers/odoo/routes.ts packages/server/src/apps/system/routes.ts
git commit -m "feat(odoo-importer): wire preview and commit endpoints"
git push origin main
```

---

## Task 14: Client hooks

**Files:**
- Create: `packages/client/src/components/settings/data-import/hooks.ts`

- [ ] **Step 1: Create the hooks file**

Write `packages/client/src/components/settings/data-import/hooks.ts`:

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api-client';
import type { OdooImportPreview, OdooImportSummary } from '@atlas-platform/shared';

export interface OdooImportPreviewInput {
  partners: File;
  leads?: File;
  activities?: File;
}

export function useOdooImportPreview() {
  return useMutation({
    mutationFn: async (input: OdooImportPreviewInput): Promise<OdooImportPreview> => {
      const form = new FormData();
      form.append('partners', input.partners);
      if (input.leads) form.append('leads', input.leads);
      if (input.activities) form.append('activities', input.activities);
      const { data } = await api.post('/system/importers/odoo/preview', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data.data as OdooImportPreview;
    },
  });
}

export interface OdooImportCommitInput {
  sessionId: string;
  stageMapping: Record<string, string>;
}

export function useOdooImportCommit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: OdooImportCommitInput): Promise<OdooImportSummary> => {
      const { data } = await api.post('/system/importers/odoo/commit', input);
      return data.data as OdooImportSummary;
    },
    onSuccess: () => {
      // After commit, all CRM caches are stale.
      qc.invalidateQueries({ queryKey: ['crm'] });
    },
  });
}
```

- [ ] **Step 2: Build**

```bash
cd /Users/gorkemcetin/atlasmail/packages/client && npm run build
```

- [ ] **Step 3: Commit**

```bash
cd /Users/gorkemcetin/atlasmail
git add packages/client/src/components/settings/data-import/
git commit -m "feat(odoo-importer): client hooks for preview and commit"
git push origin main
```

---

## Task 15: Uploader component

**Files:**
- Create: `packages/client/src/components/settings/data-import/odoo-import-uploader.tsx`

- [ ] **Step 1: Create the component**

Write `packages/client/src/components/settings/data-import/odoo-import-uploader.tsx`:

```typescript
import { useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../ui/button';

interface Props {
  busy: boolean;
  onSubmit: (input: { partners: File; leads?: File; activities?: File }) => void;
}

export function OdooImportUploader({ busy, onSubmit }: Props) {
  const { t } = useTranslation();
  const [partners, setPartners] = useState<File | null>(null);
  const [leads, setLeads] = useState<File | null>(null);
  const [activities, setActivities] = useState<File | null>(null);

  const canSubmit = !busy && partners !== null;

  const handleFile = (setter: (f: File | null) => void) => (e: ChangeEvent<HTMLInputElement>) => {
    setter(e.target.files?.[0] ?? null);
  };

  const handleSubmit = () => {
    if (!partners) return;
    onSubmit({ partners, leads: leads ?? undefined, activities: activities ?? undefined });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', margin: 0 }}>
        {t('import.odoo.instructions')}
      </p>

      <FileSlot
        label={t('import.odoo.partnersLabel')}
        required
        file={partners}
        onChange={handleFile(setPartners)}
      />
      <FileSlot
        label={t('import.odoo.leadsLabel')}
        file={leads}
        onChange={handleFile(setLeads)}
      />
      <FileSlot
        label={t('import.odoo.activitiesLabel')}
        file={activities}
        onChange={handleFile(setActivities)}
      />

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="primary" disabled={!canSubmit} onClick={handleSubmit}>
          {busy ? t('import.odoo.parsing') : t('import.odoo.preview')}
        </Button>
      </div>
    </div>
  );
}

function FileSlot({
  label,
  required,
  file,
  onChange,
}: {
  label: string;
  required?: boolean;
  file: File | null;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
      <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)' }}>
        {label} {required ? '*' : null}
      </span>
      <input
        type="file"
        accept=".csv,text/csv"
        onChange={onChange}
        style={{ fontSize: 'var(--font-size-sm)' }}
      />
      {file && (
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
          {file.name} · {Math.round(file.size / 1024)} KB
        </span>
      )}
    </label>
  );
}
```

- [ ] **Step 2: Build**

```bash
cd /Users/gorkemcetin/atlasmail/packages/client && npm run build
```

- [ ] **Step 3: Commit**

```bash
cd /Users/gorkemcetin/atlasmail
git add packages/client/src/components/settings/data-import/odoo-import-uploader.tsx
git commit -m "feat(odoo-importer): file uploader component"
git push origin main
```

---

## Task 16: Preview component

**Files:**
- Create: `packages/client/src/components/settings/data-import/odoo-import-preview.tsx`

- [ ] **Step 1: Create the component**

Write `packages/client/src/components/settings/data-import/odoo-import-preview.tsx`:

```typescript
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../ui/button';
import { Select } from '../../ui/select';
import type { OdooImportPreview } from '@atlas-platform/shared';

interface Props {
  preview: OdooImportPreview;
  busy: boolean;
  onCommit: (stageMapping: Record<string, string>) => void;
  onCancel: () => void;
}

function defaultMapping(preview: OdooImportPreview): Record<string, string> {
  const result: Record<string, string> = {};
  const stages = preview.atlasStages.slice().sort((a, b) => a.sequence - b.sequence);
  const fallbackId = stages[0]?.id ?? '';
  for (const odoo of preview.stages) {
    const match = stages.find((s) => s.name.toLowerCase() === odoo.odooStage.toLowerCase());
    result[odoo.odooStage] = match ? match.id : fallbackId;
  }
  return result;
}

export function OdooImportPreviewView({ preview, busy, onCommit, onCancel }: Props) {
  const { t } = useTranslation();
  const [mapping, setMapping] = useState<Record<string, string>>(() => defaultMapping(preview));

  const stageOptions = preview.atlasStages
    .slice()
    .sort((a, b) => a.sequence - b.sequence)
    .map((s) => ({ value: s.id, label: s.name }));

  const allMapped = preview.stages.every((s) => mapping[s.odooStage]);
  const canCommit = !busy && (preview.stages.length === 0 || allMapped);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      <Section title={t('import.odoo.previewSummaryTitle')}>
        <ul style={{ margin: 0, paddingLeft: 'var(--spacing-lg)', color: 'var(--color-text-secondary)' }}>
          <li>{t('import.odoo.companies', { count: preview.counts.companies })}</li>
          <li>{t('import.odoo.contacts', { count: preview.counts.contacts })}</li>
          <li>{t('import.odoo.leads', { count: preview.counts.leads })}</li>
          <li>{t('import.odoo.deals', { count: preview.counts.deals })}</li>
          <li>{t('import.odoo.activities', { count: preview.counts.activities })}</li>
        </ul>
      </Section>

      {preview.dropped.length > 0 && (
        <Section title={t('import.odoo.droppedTitle')}>
          <ul style={{ margin: 0, paddingLeft: 'var(--spacing-lg)', color: 'var(--color-text-secondary)' }}>
            {preview.dropped.map((d, i) => (
              <li key={i}>{`[${d.file}] ${d.reason} — ${d.count}`}</li>
            ))}
          </ul>
        </Section>
      )}

      {preview.customFields.length > 0 && (
        <Section title={t('import.odoo.customFieldsTitle')}>
          <p style={{ margin: 0, color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-xs)' }}>
            {t('import.odoo.customFieldsHelp')}
          </p>
          <ul style={{ margin: 0, paddingLeft: 'var(--spacing-lg)', color: 'var(--color-text-secondary)' }}>
            {preview.customFields.map((c, i) => (
              <li key={i}>{`[${c.file}] ${c.column}${c.sampleValue ? ` (e.g. "${c.sampleValue}")` : ''}`}</li>
            ))}
          </ul>
        </Section>
      )}

      {preview.stages.length > 0 && (
        <Section title={t('import.odoo.stageMappingTitle')}>
          <p style={{ margin: 0, color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-xs)' }}>
            {t('import.odoo.stageMappingHelp')}
          </p>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 'var(--spacing-sm)' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: 'var(--spacing-xs)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
                  {t('import.odoo.odooStage')}
                </th>
                <th style={{ textAlign: 'left', padding: 'var(--spacing-xs)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
                  {t('import.odoo.atlasStage')}
                </th>
              </tr>
            </thead>
            <tbody>
              {preview.stages.map((s) => (
                <tr key={s.odooStage} style={{ borderTop: '1px solid var(--color-border-secondary)' }}>
                  <td style={{ padding: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)' }}>
                    {s.odooStage} <span style={{ color: 'var(--color-text-tertiary)' }}>({s.rowCount})</span>
                  </td>
                  <td style={{ padding: 'var(--spacing-xs)' }}>
                    <Select
                      size="sm"
                      value={mapping[s.odooStage] ?? ''}
                      onChange={(v: string) => setMapping((m) => ({ ...m, [s.odooStage]: v }))}
                      options={stageOptions}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-sm)' }}>
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          {t('import.odoo.cancel')}
        </Button>
        <Button variant="primary" disabled={!canCommit} onClick={() => onCommit(mapping)}>
          {busy ? t('import.odoo.committing') : t('import.odoo.commit')}
        </Button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
      <h3 style={{ margin: 0, fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-semibold)' }}>
        {title}
      </h3>
      {children}
    </section>
  );
}
```

- [ ] **Step 2: Build**

```bash
cd /Users/gorkemcetin/atlasmail/packages/client && npm run build
```

- [ ] **Step 3: Commit**

```bash
cd /Users/gorkemcetin/atlasmail
git add packages/client/src/components/settings/data-import/odoo-import-preview.tsx
git commit -m "feat(odoo-importer): preview component with stage mapping table"
git push origin main
```

---

## Task 17: Summary + Wizard + Panel

**Files:**
- Create: `packages/client/src/components/settings/data-import/odoo-import-summary.tsx`
- Create: `packages/client/src/components/settings/data-import/odoo-import-wizard.tsx`
- Create: `packages/client/src/components/settings/data-import/data-import-panel.tsx`

- [ ] **Step 1: Create the summary component**

Write `packages/client/src/components/settings/data-import/odoo-import-summary.tsx`:

```typescript
import { useTranslation } from 'react-i18next';
import { Button } from '../../ui/button';
import type { OdooImportSummary } from '@atlas-platform/shared';

export function OdooImportSummaryView({
  summary,
  onDone,
}: {
  summary: OdooImportSummary;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      <h3 style={{ margin: 0, fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-semibold)' }}>
        {t('import.odoo.summaryTitle')}
      </h3>
      <ul style={{ margin: 0, paddingLeft: 'var(--spacing-lg)', color: 'var(--color-text-secondary)' }}>
        <li>{t('import.odoo.summaryCompanies', { count: summary.imported.companies })}</li>
        <li>{t('import.odoo.summaryContacts', { count: summary.imported.contacts })}</li>
        <li>{t('import.odoo.summaryLeads', { count: summary.imported.leads })}</li>
        <li>{t('import.odoo.summaryDeals', { count: summary.imported.deals })}</li>
        <li>{t('import.odoo.summaryActivities', { count: summary.imported.activities })}</li>
        {summary.customFieldsSkipped > 0 && (
          <li>{t('import.odoo.summaryCustomFieldsSkipped', { count: summary.customFieldsSkipped })}</li>
        )}
      </ul>
      {summary.dropped.length > 0 && (
        <section>
          <h4 style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)' }}>
            {t('import.odoo.summaryDroppedTitle')}
          </h4>
          <ul style={{ margin: 0, paddingLeft: 'var(--spacing-lg)', color: 'var(--color-text-secondary)' }}>
            {summary.dropped.map((d, i) => (
              <li key={i}>{`[${d.file}] ${d.reason} — ${d.count}`}</li>
            ))}
          </ul>
        </section>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="primary" onClick={onDone}>
          {t('import.odoo.done')}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the wizard**

Write `packages/client/src/components/settings/data-import/odoo-import-wizard.tsx`:

```typescript
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToastStore } from '../../../stores/toast-store';
import { OdooImportUploader } from './odoo-import-uploader';
import { OdooImportPreviewView } from './odoo-import-preview';
import { OdooImportSummaryView } from './odoo-import-summary';
import { useOdooImportPreview, useOdooImportCommit } from './hooks';
import type { OdooImportPreview, OdooImportSummary } from '@atlas-platform/shared';

export function OdooImportWizard({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const addToast = useToastStore((s) => s.addToast);
  const [preview, setPreview] = useState<OdooImportPreview | null>(null);
  const [summary, setSummary] = useState<OdooImportSummary | null>(null);

  const previewMutation = useOdooImportPreview();
  const commitMutation = useOdooImportCommit();

  const handleUpload = (input: { partners: File; leads?: File; activities?: File }) => {
    previewMutation.mutate(input, {
      onSuccess: (data) => setPreview(data),
      onError: (err) => {
        addToast({ type: 'error', message: err instanceof Error ? err.message : t('import.odoo.previewFailed') });
      },
    });
  };

  const handleCommit = (stageMapping: Record<string, string>) => {
    if (!preview) return;
    commitMutation.mutate(
      { sessionId: preview.sessionId, stageMapping },
      {
        onSuccess: (data) => {
          setSummary(data);
          addToast({ type: 'success', message: t('import.odoo.commitSucceeded') });
        },
        onError: (err) => {
          addToast({ type: 'error', message: err instanceof Error ? err.message : t('import.odoo.commitFailed') });
        },
      },
    );
  };

  if (summary) {
    return <OdooImportSummaryView summary={summary} onDone={onClose} />;
  }
  if (preview) {
    return (
      <OdooImportPreviewView
        preview={preview}
        busy={commitMutation.isPending}
        onCommit={handleCommit}
        onCancel={() => setPreview(null)}
      />
    );
  }
  return <OdooImportUploader busy={previewMutation.isPending} onSubmit={handleUpload} />;
}
```

- [ ] **Step 3: Create the settings panel**

Write `packages/client/src/components/settings/data-import/data-import-panel.tsx`:

```typescript
import { useTranslation } from 'react-i18next';
import { OdooImportWizard } from './odoo-import-wizard';

export function DataImportPanel() {
  const { t } = useTranslation();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      <h2 style={{ margin: 0, fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-semibold)' }}>
        {t('import.odoo.title')}
      </h2>
      <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
        {t('import.odoo.subtitle')}
      </p>
      <OdooImportWizard onClose={() => window.location.reload()} />
    </div>
  );
}
```

- [ ] **Step 4: Build**

```bash
cd /Users/gorkemcetin/atlasmail/packages/client && npm run build
```

- [ ] **Step 5: Commit**

```bash
cd /Users/gorkemcetin/atlasmail
git add packages/client/src/components/settings/data-import/
git commit -m "feat(odoo-importer): wizard + summary + panel components"
git push origin main
```

---

## Task 18: Register the Settings panel

**Files:**
- Modify: `packages/client/src/config/settings-registry.ts`

- [ ] **Step 1: Add the import + panel entry**

Read `packages/client/src/config/settings-registry.ts`. After the existing imports of settings panels, add:

```typescript
import { DataImportPanel } from '../components/settings/data-import/data-import-panel';
```

In `globalSettingsCategory.panels` (around line 65), insert a new entry between `data-model` and `home-background`:

```typescript
    { id: 'data-import', label: 'Data import', icon: Database, component: DataImportPanel, ownerOnly: true },
```

(Reuse the existing `Database` icon import from `lucide-react`.)

In the `PANEL_I18N_KEYS` map below, add:

```typescript
'data-import': 'settingsPanel.panels.dataImport',
```

- [ ] **Step 2: Build**

```bash
cd /Users/gorkemcetin/atlasmail/packages/client && npm run build
```

- [ ] **Step 3: Commit**

```bash
cd /Users/gorkemcetin/atlasmail
git add packages/client/src/config/settings-registry.ts
git commit -m "feat(odoo-importer): register Data import settings panel"
git push origin main
```

---

## Task 19: i18n keys (5 locales)

**Files:**
- Modify: `packages/client/src/i18n/locales/en.json`
- Modify: `packages/client/src/i18n/locales/tr.json`
- Modify: `packages/client/src/i18n/locales/de.json`
- Modify: `packages/client/src/i18n/locales/fr.json`
- Modify: `packages/client/src/i18n/locales/it.json`

- [ ] **Step 1: Add keys to `en.json`**

Read `packages/client/src/i18n/locales/en.json`. Find the existing top-level `tour` block (added during the tour feature). After it, add:

```json
"import": {
  "odoo": {
    "title": "Import from Odoo",
    "subtitle": "Upload CSV files exported from Odoo to migrate contacts, deals, and activities into Atlas.",
    "instructions": "From your Odoo instance, go to Contacts → list view → Action → Export. Toggle 'I want to update data (import-compatible export)' before exporting. Repeat for CRM Pipeline and (optionally) Activities.",
    "partnersLabel": "Contacts (res.partner.csv)",
    "leadsLabel": "Leads & opportunities (crm.lead.csv)",
    "activitiesLabel": "Pending activities (mail.activity.csv)",
    "preview": "Preview",
    "parsing": "Parsing...",
    "previewSummaryTitle": "Records to import",
    "companies": "{{count}} companies",
    "contacts": "{{count}} contacts",
    "leads": "{{count}} leads",
    "deals": "{{count}} deals",
    "activities": "{{count}} activities",
    "droppedTitle": "Rows that will be skipped",
    "customFieldsTitle": "Custom fields detected",
    "customFieldsHelp": "Atlas does not auto-create custom field schemas. These columns will be skipped on import. Define them in Atlas first if you need them.",
    "stageMappingTitle": "Stage mapping",
    "stageMappingHelp": "Map each Odoo stage to an Atlas deal stage. Pre-filled with name matches.",
    "odooStage": "Odoo stage",
    "atlasStage": "Atlas stage",
    "cancel": "Back",
    "commit": "Import",
    "committing": "Importing...",
    "previewFailed": "Couldn't read your files. Check that they are CSV exports from Odoo.",
    "commitFailed": "Import failed. No data was changed.",
    "commitSucceeded": "Import complete.",
    "summaryTitle": "Import complete",
    "summaryCompanies": "Imported {{count}} companies",
    "summaryContacts": "Imported {{count}} contacts",
    "summaryLeads": "Imported {{count}} leads",
    "summaryDeals": "Imported {{count}} deals",
    "summaryActivities": "Imported {{count}} activities",
    "summaryCustomFieldsSkipped": "Skipped {{count}} custom field columns",
    "summaryDroppedTitle": "Skipped rows",
    "done": "Done"
  }
},
"settingsPanel": {
  "panels": {
    "dataImport": "Data import"
  }
}
```

If `settingsPanel.panels` already exists, **add only** `"dataImport": "Data import"` inside it (don't re-create the parent block).

- [ ] **Step 2: Add the same keys to `tr.json`, `de.json`, `fr.json`, `it.json`**

Per Atlas convention (matching the tour feature): use the same English copy in all 5 locale files for v1. Human translations land in a follow-up.

- [ ] **Step 3: Validate JSON**

```bash
for f in en tr de fr it; do
  python3 -c "import json,sys;json.load(open('/Users/gorkemcetin/atlasmail/packages/client/src/i18n/locales/$f.json'))" && echo "$f.json OK" || echo "INVALID: $f.json"
done
```

Expected: 5 lines, all `OK`.

- [ ] **Step 4: Build**

```bash
cd /Users/gorkemcetin/atlasmail/packages/client && npm run build
```

- [ ] **Step 5: Commit**

```bash
cd /Users/gorkemcetin/atlasmail
git add packages/client/src/i18n/locales/
git commit -m "feat(odoo-importer): i18n keys for all 5 locales"
git push origin main
```

---

## Task 20: Manual end-to-end smoke test

This task is the integration check. The implementer runs through the entire flow with a real Odoo CSV.

- [ ] **Step 1: Restart server + client**

```bash
lsof -ti:5180,3001 | xargs kill -9 2>/dev/null || true
cd /Users/gorkemcetin/atlasmail/packages/server && npm run dev > /tmp/atlas-server.log 2>&1 &
sleep 5
cd /Users/gorkemcetin/atlasmail/packages/client && npm run dev &
sleep 5
```

- [ ] **Step 2: Prepare a tiny test CSV**

Create `/tmp/res.partner.csv`:

```csv
id,name,is_company,parent_id,email,phone,function,active,create_date,write_date
1,Acme Inc,True,,,,,True,2024-01-15 10:00:00,2024-06-20 14:30:00
2,Jane Doe,False,1,jane@acme.com,+1-555-1234,CTO,True,2024-02-01 09:00:00,2024-06-20 14:30:00
3,Bob Smith,False,1,bob@acme.com,,Engineer,True,2024-03-10 11:30:00,2024-06-20 14:30:00
```

Create `/tmp/crm.lead.csv`:

```csv
id,name,type,partner_id,email_from,phone,stage_id,expected_revenue,probability,date_deadline,active,create_date,write_date,currency_id,tag_ids
10,Q4 SaaS deal,opportunity,1,jane@acme.com,+1-555-1234,Negotiation,50000,60,2026-12-31,True,2024-04-15 10:00:00,2024-07-01 10:00:00,USD,Hot;Q4
11,Cold prospect,lead,,info@example.com,,New,0,0,,True,2024-05-20 14:00:00,2024-05-20 14:00:00,,
```

Create `/tmp/mail.activity.csv`:

```csv
id,res_model,res_id,activity_type_id,summary,note,date_deadline,create_date,write_date
100,res.partner,1,Phone Call,Follow up on Q4,Schedule next call,2026-05-15,2024-06-15 10:00:00,2024-06-15 10:00:00
101,crm.lead,10,Email,Send proposal,Final pricing,2026-05-10,2024-06-20 11:00:00,2024-06-20 11:00:00
102,sale.order,99,Note,,,,2024-06-10 09:00:00,2024-06-10 09:00:00
```

- [ ] **Step 3: Open Settings → Data import**

Log in to Atlas. Open Settings (gear icon). Find the "Data import" panel in the sidebar. Click it.

Expected: page title "Import from Odoo", instructions text, three file inputs (partners required marked with `*`, leads + activities optional).

- [ ] **Step 4: Upload all 3 files and click Preview**

Expected:
- Counts: 1 company, 2 contacts, 1 lead, 1 deal, 3 activities (1 of which will be dropped at commit because it points to `sale.order`).
- Stages section: shows "Negotiation (1)" with a dropdown pre-filled to a name match (or fallback first stage if no exact match).
- No custom fields listed.

- [ ] **Step 5: Confirm stage mapping and click Import**

Click "Import". Expected:
- Spinner shows during commit.
- Summary appears: "Imported 1 company, 2 contacts, 1 lead, 1 deal, 1 activity. Skipped 1 (sale.order unsupported), 1 (crm.lead 11 attached to lead — Atlas activities can't reference leads). Skipped 0 custom fields."

Wait — re-check: activity 101 references crm.lead 10, which became a deal, so it should attach to the deal (not be dropped). Activity 102 references sale.order, dropped. So summary should be **2 activities imported, 1 dropped**.

- [ ] **Step 6: Verify in CRM**

Navigate to CRM → Companies. Expected: "Acme Inc" exists with the imported timestamp visible in the metadata.
Navigate to CRM → Contacts. Expected: "Jane Doe" and "Bob Smith" both linked to Acme Inc.
Navigate to CRM → Deals. Expected: "Q4 SaaS deal" with $50,000 value, USD currency, mapped stage, linked to Jane Doe.
Open the Acme Inc company detail. Expected: 2 contacts, 1 deal, and at least 1 activity in the activity feed.

- [ ] **Step 7: Test session expiry**

Run another preview, but instead of clicking Import within 30 minutes, wait 31 minutes (or restart the server to clear the in-memory store), then click Import. Expected: error toast "Session not found or expired."

- [ ] **Step 8: Test stage validation**

Run another preview. Before clicking Import, in another browser tab open CRM Settings and **delete** the stage that was selected for mapping. Then click Import. Expected: error toast "The stage you mapped to has been changed. Please re-run preview."

- [ ] **Step 9: Test member access**

Log in as a tenant member (not the owner). Navigate to Settings. Expected: the "Data import" panel either doesn't appear OR appears but shows that members can't access (depends on existing settings UI behavior — Atlas's `ownerOnly: true` panels are hidden by default for members).

- [ ] **Step 10: Final build + push**

```bash
cd /Users/gorkemcetin/atlasmail/packages/server && npm run build
cd /Users/gorkemcetin/atlasmail/packages/client && npm run build
```

If either fails, fix and re-commit.

---

## Self-review checklist (run before declaring complete)

Re-read `docs/superpowers/specs/2026-04-27-odoo-importer-design.md` and confirm each requirement has a task:

1. CSV-only, 3 file slots, partners required — Task 15 ✓
2. Settings → Data import, owner-only — Task 18 ✓
3. In-session `Map<odooPartnerId, atlasId>` — Task 6 ✓
4. Lead vs Deal split by `type` — Task 8 ✓
5. Stage-mapping UI with name-match pre-fill — Task 16 ✓
6. Custom fields detected, listed, skipped — Tasks 5, 11, 16 ✓
7. Activities filter by `res_model` and resolved via map — Task 9 ✓
8. Activities tied to leads (not deals) dropped with reason — Task 9 ✓
9. Free wins: `create_date`/`write_date` preserved, currency on deals, lost reason — Tasks 7, 8 ✓
10. Multer memoryStorage, 20 MB cap, 3 files — Task 13 ✓
11. Stage validation at commit — Task 12 ✓
12. Single transaction, full rollback on error — Task 12 ✓
13. 30-minute in-memory session, no disk persistence — Task 10 ✓
14. All 5 locales — Task 19 ✓
15. Build/format gates — Task 20 ✓

If any spec item is missing, add a task before declaring complete.
