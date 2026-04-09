# Invoicing & Proposals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract invoicing from Projects into a standalone app, add billing fields to CRM companies, build proposals inside CRM, and rewire Projects to use CRM companies instead of its own client entity.

**Architecture:** CRM owns all client data (contacts + companies with billing fields). Invoices is a new standalone app with its own sidebar icon. Proposals live inside CRM linked to deals. Projects references CRM companies and writes to the shared Invoices tables for time-entry billing. Shared components (LineItemsEditor, TotalsBlock, InvoiceBuilderModal, LinkedInvoicesList) live in `components/shared/`.

**Tech Stack:** React + TypeScript + TipTap (rich text) on client, Express + Drizzle ORM + PostgreSQL on server, shared types package.

**Spec:** `docs/superpowers/specs/2026-04-09-invoicing-proposals-design.md`

---

## Phase 1: Schema & Shared Types

### Task 1: Add billing fields to `crmCompanies`

**Files:**
- Modify: `packages/server/src/db/schema.ts:1348-1367`
- Modify: `packages/server/src/db/migrate.ts` (add ALTER TABLE statements)

- [ ] **Step 1: Add columns to crmCompanies schema**

In `packages/server/src/db/schema.ts`, add these columns to the `crmCompanies` table after the existing `taxId` field (line 1359):

```typescript
  taxOffice: varchar('tax_office', { length: 100 }),
  currency: varchar('currency', { length: 10 }).notNull().default('USD'),
  postalCode: varchar('postal_code', { length: 20 }),
  state: varchar('state', { length: 100 }),
  country: varchar('country', { length: 100 }),
  logo: text('logo'),
  portalToken: uuid('portal_token').unique(),
```

- [ ] **Step 2: Add migration statements**

In `packages/server/src/db/migrate.ts`, add `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` statements for each new column in the CRM companies migration section:

```sql
ALTER TABLE crm_companies ADD COLUMN IF NOT EXISTS tax_office VARCHAR(100);
ALTER TABLE crm_companies ADD COLUMN IF NOT EXISTS currency VARCHAR(10) NOT NULL DEFAULT 'USD';
ALTER TABLE crm_companies ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20);
ALTER TABLE crm_companies ADD COLUMN IF NOT EXISTS state VARCHAR(100);
ALTER TABLE crm_companies ADD COLUMN IF NOT EXISTS country VARCHAR(100);
ALTER TABLE crm_companies ADD COLUMN IF NOT EXISTS logo TEXT;
ALTER TABLE crm_companies ADD COLUMN IF NOT EXISTS portal_token UUID UNIQUE;
```

- [ ] **Step 3: Update CRM shared types**

In `packages/shared/src/types/crm.ts`, add the new fields to the `CrmCompany` interface:

```typescript
taxOffice?: string;
currency: string;
postalCode?: string;
state?: string;
country?: string;
logo?: string;
portalToken?: string;
```

Also add them to `CreateCrmCompanyInput` (all optional except currency which has a default) and `UpdateCrmCompanyInput`.

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/db/schema.ts packages/server/src/db/migrate.ts packages/shared/src/types/crm.ts
git commit -m "$(cat <<'EOF'
feat: add billing fields to crmCompanies

Add taxOffice, currency, postalCode, state, country, logo, and
portalToken columns to crm_companies table. These fields support
the upcoming standalone Invoices app which will use CRM companies
as the unified client entity.
EOF
)"
```

---

### Task 2: Create `invoices` and `invoiceLineItems` schema tables

**Files:**
- Modify: `packages/server/src/db/schema.ts` (add new tables after the CRM section)
- Modify: `packages/server/src/db/migrate.ts`

- [ ] **Step 1: Add invoices table to schema.ts**

Add after the CRM tables section (after `crmLeadForms`), before the Projects section. Add a section comment:

```typescript
// ─── Invoices ──────────────────────────────────────────────────────
export const invoices = pgTable('invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  userId: uuid('user_id').notNull(),
  companyId: uuid('company_id').notNull().references(() => crmCompanies.id, { onDelete: 'cascade' }),
  contactId: uuid('contact_id').references(() => crmContacts.id, { onDelete: 'set null' }),
  dealId: uuid('deal_id').references(() => crmDeals.id, { onDelete: 'set null' }),
  proposalId: uuid('proposal_id'),  // FK added after crmProposals table is defined
  invoiceNumber: varchar('invoice_number', { length: 50 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('draft'),
  currency: varchar('currency', { length: 10 }).notNull().default('USD'),
  subtotal: real('subtotal').notNull().default(0),
  taxPercent: real('tax_percent').notNull().default(0),
  taxAmount: real('tax_amount').notNull().default(0),
  discountPercent: real('discount_percent').notNull().default(0),
  discountAmount: real('discount_amount').notNull().default(0),
  total: real('total').notNull().default(0),
  notes: text('notes'),
  issueDate: timestamp('issue_date', { withTimezone: true }).notNull(),
  dueDate: timestamp('due_date', { withTimezone: true }).notNull(),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  viewedAt: timestamp('viewed_at', { withTimezone: true }),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  eFaturaType: varchar('e_fatura_type', { length: 20 }),
  eFaturaUuid: varchar('e_fatura_uuid', { length: 50 }),
  eFaturaStatus: varchar('e_fatura_status', { length: 20 }),
  eFaturaXml: text('e_fatura_xml'),
  isArchived: boolean('is_archived').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('idx_invoices_tenant').on(table.tenantId),
  companyIdx: index('idx_invoices_company').on(table.companyId),
  statusIdx: index('idx_invoices_status').on(table.status),
  uniqueNumber: uniqueIndex('idx_invoices_number').on(table.tenantId, table.invoiceNumber),
}));
```

- [ ] **Step 2: Add invoiceLineItems table to schema.ts**

```typescript
export const invoiceLineItems = pgTable('invoice_line_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  invoiceId: uuid('invoice_id').notNull().references(() => invoices.id, { onDelete: 'cascade' }),
  timeEntryId: uuid('time_entry_id').references(() => projectTimeEntries.id, { onDelete: 'set null' }),
  description: text('description').notNull(),
  quantity: real('quantity').notNull().default(1),
  unitPrice: real('unit_price').notNull().default(0),
  amount: real('amount').notNull().default(0),
  taxRate: real('tax_rate').notNull().default(20),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  invoiceIdx: index('idx_invoice_line_items_invoice').on(table.invoiceId),
}));
```

- [ ] **Step 3: Add invoiceSettings table to schema.ts**

```typescript
export const invoiceSettings = pgTable('invoice_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id).unique(),
  invoicePrefix: varchar('invoice_prefix', { length: 20 }).notNull().default('INV'),
  nextInvoiceNumber: integer('next_invoice_number').notNull().default(1),
  defaultCurrency: varchar('default_currency', { length: 10 }).notNull().default('USD'),
  defaultTaxRate: real('default_tax_rate').notNull().default(0),
  eFaturaEnabled: boolean('e_fatura_enabled').notNull().default(false),
  eFaturaCompanyName: varchar('e_fatura_company_name', { length: 255 }),
  eFaturaCompanyTaxId: varchar('e_fatura_company_tax_id', { length: 20 }),
  eFaturaCompanyTaxOffice: varchar('e_fatura_company_tax_office', { length: 100 }),
  eFaturaCompanyAddress: text('e_fatura_company_address'),
  eFaturaCompanyCity: varchar('e_fatura_company_city', { length: 100 }),
  eFaturaCompanyCountry: varchar('e_fatura_company_country', { length: 100 }),
  eFaturaCompanyPhone: varchar('e_fatura_company_phone', { length: 50 }),
  eFaturaCompanyEmail: varchar('e_fatura_company_email', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
```

- [ ] **Step 4: Add CREATE TABLE statements to migrate.ts**

Add `CREATE TABLE IF NOT EXISTS` statements for `invoices`, `invoice_line_items`, and `invoice_settings` following the existing pattern in migrate.ts. Include all columns and constraints.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/db/schema.ts packages/server/src/db/migrate.ts
git commit -m "$(cat <<'EOF'
feat: add invoices, invoiceLineItems, and invoiceSettings tables

New standalone invoice tables decoupled from the Projects app.
invoices.companyId references crmCompanies. invoiceLineItems.timeEntryId
optionally references projectTimeEntries for time-entry billing.
EOF
)"
```

---

### Task 3: Create `crmProposals` schema table

**Files:**
- Modify: `packages/server/src/db/schema.ts` (add after CRM tables, before Invoices)
- Modify: `packages/server/src/db/migrate.ts`

- [ ] **Step 1: Add crmProposals table to schema.ts**

Add after `crmLeadForms` and before the Invoices section:

```typescript
// ─── CRM: Proposals ────────────────────────────────────────────────
export const crmProposals = pgTable('crm_proposals', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  userId: uuid('user_id').notNull(),
  dealId: uuid('deal_id').references(() => crmDeals.id, { onDelete: 'set null' }),
  contactId: uuid('contact_id').references(() => crmContacts.id, { onDelete: 'set null' }),
  companyId: uuid('company_id').references(() => crmCompanies.id, { onDelete: 'set null' }),
  title: varchar('title', { length: 500 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('draft'),
  content: jsonb('content'),
  lineItems: jsonb('line_items').$type<Array<{ description: string; quantity: number; unitPrice: number; taxRate: number }>>().notNull().default([]),
  subtotal: real('subtotal').notNull().default(0),
  taxPercent: real('tax_percent').notNull().default(0),
  taxAmount: real('tax_amount').notNull().default(0),
  discountPercent: real('discount_percent').notNull().default(0),
  discountAmount: real('discount_amount').notNull().default(0),
  total: real('total').notNull().default(0),
  currency: varchar('currency', { length: 10 }).notNull().default('USD'),
  validUntil: timestamp('valid_until', { withTimezone: true }),
  publicToken: uuid('public_token').notNull().defaultRandom().unique(),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  viewedAt: timestamp('viewed_at', { withTimezone: true }),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  declinedAt: timestamp('declined_at', { withTimezone: true }),
  notes: text('notes'),
  isArchived: boolean('is_archived').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('idx_crm_proposals_tenant').on(table.tenantId),
  dealIdx: index('idx_crm_proposals_deal').on(table.dealId),
  companyIdx: index('idx_crm_proposals_company').on(table.companyId),
  statusIdx: index('idx_crm_proposals_status').on(table.status),
  publicTokenIdx: uniqueIndex('idx_crm_proposals_token').on(table.publicToken),
}));
```

- [ ] **Step 2: Now add the proposalId FK on invoices**

After `crmProposals` is defined, go back to the `invoices` table and update the `proposalId` line from the plain uuid to a proper FK:

```typescript
  proposalId: uuid('proposal_id').references(() => crmProposals.id, { onDelete: 'set null' }),
```

This requires `crmProposals` to be defined before `invoices` in the file. Ensure the table ordering is: CRM tables → crmProposals → invoices → invoiceLineItems → invoiceSettings → Projects tables.

- [ ] **Step 3: Add CREATE TABLE to migrate.ts**

Add `CREATE TABLE IF NOT EXISTS crm_proposals` with all columns.

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/db/schema.ts packages/server/src/db/migrate.ts
git commit -m "$(cat <<'EOF'
feat: add crmProposals table and link invoices.proposalId

Proposals live in CRM, optionally linked to deals. They have JSONB
lineItems, TipTap content for scope/terms, and a publicToken for
client-facing access. invoices.proposalId now references crmProposals.
EOF
)"
```

---

### Task 4: Create shared types for Invoices and Proposals

**Files:**
- Create: `packages/shared/src/types/invoices.ts`
- Create: `packages/shared/src/types/proposals.ts`
- Modify: `packages/shared/src/types/index.ts`

- [ ] **Step 1: Create invoices.ts**

```typescript
export type InvoiceStatus = 'draft' | 'sent' | 'viewed' | 'paid' | 'overdue' | 'waived';

export interface InvoiceLineItem {
  id: string;
  invoiceId: string;
  timeEntryId?: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  taxRate: number;
  sortOrder: number;
  createdAt: string;
}

export interface Invoice {
  id: string;
  tenantId: string;
  userId: string;
  companyId: string;
  contactId?: string | null;
  dealId?: string | null;
  proposalId?: string | null;
  invoiceNumber: string;
  status: InvoiceStatus;
  currency: string;
  subtotal: number;
  taxPercent: number;
  taxAmount: number;
  discountPercent: number;
  discountAmount: number;
  total: number;
  notes?: string | null;
  issueDate: string;
  dueDate: string;
  sentAt?: string | null;
  viewedAt?: string | null;
  paidAt?: string | null;
  eFaturaType?: string | null;
  eFaturaUuid?: string | null;
  eFaturaStatus?: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  // Joined fields
  companyName?: string;
  contactName?: string;
  dealTitle?: string;
  lineItems?: InvoiceLineItem[];
  lineItemCount?: number;
}

export interface CreateInvoiceInput {
  companyId: string;
  contactId?: string;
  dealId?: string;
  proposalId?: string;
  currency?: string;
  subtotal?: number;
  taxPercent?: number;
  taxAmount?: number;
  discountPercent?: number;
  discountAmount?: number;
  total?: number;
  notes?: string;
  issueDate: string;
  dueDate: string;
  eFaturaType?: string;
  lineItems?: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    taxRate?: number;
  }>;
  timeEntryIds?: string[];
}

export interface UpdateInvoiceInput {
  companyId?: string;
  contactId?: string | null;
  dealId?: string | null;
  currency?: string;
  subtotal?: number;
  taxPercent?: number;
  taxAmount?: number;
  discountPercent?: number;
  discountAmount?: number;
  total?: number;
  notes?: string | null;
  issueDate?: string;
  dueDate?: string;
  eFaturaType?: string;
}

export interface InvoiceSettings {
  id: string;
  tenantId: string;
  invoicePrefix: string;
  nextInvoiceNumber: number;
  defaultCurrency: string;
  defaultTaxRate: number;
  eFaturaEnabled: boolean;
  eFaturaCompanyName?: string | null;
  eFaturaCompanyTaxId?: string | null;
  eFaturaCompanyTaxOffice?: string | null;
  eFaturaCompanyAddress?: string | null;
  eFaturaCompanyCity?: string | null;
  eFaturaCompanyCountry?: string | null;
  eFaturaCompanyPhone?: string | null;
  eFaturaCompanyEmail?: string | null;
}

export interface UpdateInvoiceSettingsInput {
  invoicePrefix?: string;
  defaultCurrency?: string;
  defaultTaxRate?: number;
  eFaturaEnabled?: boolean;
  eFaturaCompanyName?: string | null;
  eFaturaCompanyTaxId?: string | null;
  eFaturaCompanyTaxOffice?: string | null;
  eFaturaCompanyAddress?: string | null;
  eFaturaCompanyCity?: string | null;
  eFaturaCompanyCountry?: string | null;
  eFaturaCompanyPhone?: string | null;
  eFaturaCompanyEmail?: string | null;
}

export function getInvoiceStatusVariant(status: InvoiceStatus): 'default' | 'primary' | 'success' | 'warning' | 'error' {
  switch (status) {
    case 'draft': return 'default';
    case 'sent': return 'primary';
    case 'viewed': return 'primary';
    case 'paid': return 'success';
    case 'overdue': return 'error';
    case 'waived': return 'warning';
    default: return 'default';
  }
}
```

- [ ] **Step 2: Create proposals.ts**

```typescript
export type ProposalStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'declined' | 'expired';

export interface ProposalLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
}

export interface Proposal {
  id: string;
  tenantId: string;
  userId: string;
  dealId?: string | null;
  contactId?: string | null;
  companyId?: string | null;
  title: string;
  status: ProposalStatus;
  content?: unknown | null;
  lineItems: ProposalLineItem[];
  subtotal: number;
  taxPercent: number;
  taxAmount: number;
  discountPercent: number;
  discountAmount: number;
  total: number;
  currency: string;
  validUntil?: string | null;
  publicToken: string;
  sentAt?: string | null;
  viewedAt?: string | null;
  acceptedAt?: string | null;
  declinedAt?: string | null;
  notes?: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  // Joined fields
  companyName?: string;
  contactName?: string;
  dealTitle?: string;
}

export interface CreateProposalInput {
  dealId?: string;
  contactId?: string;
  companyId?: string;
  title: string;
  content?: unknown;
  lineItems?: ProposalLineItem[];
  subtotal?: number;
  taxPercent?: number;
  taxAmount?: number;
  discountPercent?: number;
  discountAmount?: number;
  total?: number;
  currency?: string;
  validUntil?: string;
  notes?: string;
}

export interface UpdateProposalInput {
  dealId?: string | null;
  contactId?: string | null;
  companyId?: string | null;
  title?: string;
  content?: unknown | null;
  lineItems?: ProposalLineItem[];
  subtotal?: number;
  taxPercent?: number;
  taxAmount?: number;
  discountPercent?: number;
  discountAmount?: number;
  total?: number;
  currency?: string;
  validUntil?: string | null;
  notes?: string | null;
}

export function getProposalStatusVariant(status: ProposalStatus): 'default' | 'primary' | 'success' | 'warning' | 'error' {
  switch (status) {
    case 'draft': return 'default';
    case 'sent': return 'primary';
    case 'viewed': return 'primary';
    case 'accepted': return 'success';
    case 'declined': return 'error';
    case 'expired': return 'warning';
    default: return 'default';
  }
}
```

- [ ] **Step 3: Add exports to index.ts**

In `packages/shared/src/types/index.ts`, add:

```typescript
export * from './invoices';
export * from './proposals';
```

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/types/invoices.ts packages/shared/src/types/proposals.ts packages/shared/src/types/index.ts
git commit -m "$(cat <<'EOF'
feat: add shared types for Invoices and Proposals

Invoice types include status, line items, settings, and CRUD inputs.
Proposal types include status, line items, content (TipTap), and CRUD inputs.
Both include status variant helpers for badge rendering.
EOF
)"
```

---

### Task 5: Add query keys for Invoices and Proposals

**Files:**
- Modify: `packages/client/src/config/query-keys.ts`

- [ ] **Step 1: Add invoices namespace**

Read the existing file structure and add a new top-level `invoices` namespace after the existing namespaces:

```typescript
invoices: {
  all: ['invoices'] as const,
  list: (filters?: Record<string, unknown>) => ['invoices', 'list', filters] as const,
  detail: (id: string) => ['invoices', id] as const,
  settings: ['invoices', 'settings'] as const,
  nextNumber: ['invoices', 'next-number'] as const,
},
```

- [ ] **Step 2: Add proposals to the existing crm namespace**

Inside the existing `crm` object, add:

```typescript
proposals: {
  all: ['crm', 'proposals'] as const,
  list: (filters?: Record<string, unknown>) => ['crm', 'proposals', 'list', filters] as const,
  detail: (id: string) => ['crm', 'proposals', id] as const,
},
```

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/config/query-keys.ts
git commit -m "feat: add query keys for invoices and CRM proposals"
```

---

## Phase 2: Invoices App (Server)

### Task 6: Create Invoices server app — service layer

**Files:**
- Create: `packages/server/src/apps/invoices/services/invoice.service.ts`
- Create: `packages/server/src/apps/invoices/services/line-item.service.ts`
- Create: `packages/server/src/apps/invoices/services/settings.service.ts`

- [ ] **Step 1: Create invoice.service.ts**

Port from `packages/server/src/apps/projects/services/invoice.service.ts` with these changes:
- Replace all `projectInvoices` → `invoices` (the new table)
- Replace all `projectInvoiceLineItems` → `invoiceLineItems`
- Replace all `projectClients` → `crmCompanies`
- Replace `projectSettings` → `invoiceSettings`
- Replace `projectTimeEntries` references in `deleteInvoice` → keep referencing `projectTimeEntries` (cross-app dependency, acceptable since both are core)
- In `listInvoices`: join `crmCompanies` for `companyName` instead of `projectClients` for `clientName`. Add optional `dealId` filter.
- In `getInvoice`: join `crmCompanies` for company name, optionally join `crmContacts` for contact name, optionally join `crmDeals` for deal title.
- In `createInvoice`: accept optional `timeEntryIds: string[]` param. When present, within the same `db.transaction()`, insert the invoice, insert line items, AND mark the time entries as `billed=true, locked=true`.
- In `getNextInvoiceNumber`: read from `invoiceSettings` instead of `projectSettings`.
- Keep all other functions (sendInvoice, markInvoiceViewed, markInvoicePaid, duplicateInvoice, waiveInvoice) with the same logic, just pointing to new tables.

- [ ] **Step 2: Create line-item.service.ts**

Port from `packages/server/src/apps/projects/services/line-item.service.ts` with changes:
- Replace `projectInvoiceLineItems` → `invoiceLineItems`
- Replace `projectInvoices` → `invoices`
- Replace `projectTimeEntries` → keep as-is (cross-app reference)
- **Remove** `populateFromTimeEntries` and `previewTimeEntryLineItems` — these stay in the Projects app since they traverse project-specific tables.
- Keep: `getLineItemById`, `listInvoiceLineItems`, `createLineItem`, `updateLineItem`, `deleteLineItem`.

- [ ] **Step 3: Create settings.service.ts**

Port the settings functions from `packages/server/src/apps/projects/services/settings.service.ts` that relate to invoice settings:
- `getInvoiceSettings(tenantId)` — read from `invoiceSettings` table, upsert if not exists
- `updateInvoiceSettings(tenantId, input)` — update `invoiceSettings`

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/apps/invoices/
git commit -m "$(cat <<'EOF'
feat: create Invoices app service layer

Ported from Projects invoice services with key changes:
- References crmCompanies instead of projectClients
- Uses new invoices/invoiceLineItems/invoiceSettings tables
- createInvoice supports atomic time entry billing via timeEntryIds param
- populateFromTimeEntries stays in Projects (not ported here)
EOF
)"
```

---

### Task 7: Create Invoices server app — e-Fatura service

**Files:**
- Create: `packages/server/src/apps/invoices/services/efatura.service.ts`

- [ ] **Step 1: Port e-Fatura service**

Copy from `packages/server/src/apps/projects/services/efatura.service.ts` with changes:
- Replace all `projectInvoices` → `invoices`
- Replace all `projectInvoiceLineItems` → `invoiceLineItems`
- Replace all `projectClients` → `crmCompanies` (for company name/address in XML)
- Replace `projectSettings` → `invoiceSettings` (for eFatura company info)
- Keep all UBL-TR XML generation logic as-is

- [ ] **Step 2: Commit**

```bash
git add packages/server/src/apps/invoices/services/efatura.service.ts
git commit -m "feat: port e-Fatura service to Invoices app"
```

---

### Task 8: Create Invoices server app — controllers and routes

**Files:**
- Create: `packages/server/src/apps/invoices/controllers/invoice.controller.ts`
- Create: `packages/server/src/apps/invoices/controllers/line-item.controller.ts`
- Create: `packages/server/src/apps/invoices/controllers/efatura.controller.ts`
- Create: `packages/server/src/apps/invoices/controllers/settings.controller.ts`
- Create: `packages/server/src/apps/invoices/controllers/portal.controller.ts`
- Create: `packages/server/src/apps/invoices/controller.ts` (barrel re-export)
- Create: `packages/server/src/apps/invoices/routes.ts`

- [ ] **Step 1: Create invoice.controller.ts**

Port from `packages/server/src/apps/projects/controllers/invoice.controller.ts`. Use `req.auth!.tenantId` instead of separate tenantId extraction if that's the pattern. Each handler calls the new invoice service. Functions: `listInvoices`, `getInvoice`, `createInvoice`, `updateInvoice`, `deleteInvoice`, `sendInvoice`, `markInvoicePaid`, `waiveInvoice`, `duplicateInvoice`.

- [ ] **Step 2: Create line-item.controller.ts**

Functions: `listLineItems`, `createLineItem`, `updateLineItem`, `deleteLineItem`.

- [ ] **Step 3: Create efatura.controller.ts**

Port from Projects' efatura controller. Functions: `generateEFatura`, `getEFaturaXml`, `getEFaturaPreview`, `getEFaturaPdf`.

- [ ] **Step 4: Create settings.controller.ts**

Functions: `getSettings`, `updateSettings`.

- [ ] **Step 5: Create portal.controller.ts**

Port portal routes from Projects. Functions: `getPortalInvoices`, `getPortalInvoice`. These are public (no auth) — they look up the company by `portalToken` on `crmCompanies`, then return invoices for that company.

- [ ] **Step 6: Create controller.ts barrel file**

```typescript
export * from './controllers/invoice.controller';
export * from './controllers/line-item.controller';
export * from './controllers/efatura.controller';
export * from './controllers/settings.controller';
export * from './controllers/portal.controller';
```

- [ ] **Step 7: Create routes.ts**

```typescript
import { Router } from 'express';
import * as invoiceController from './controller';
import { authMiddleware } from '../../middleware/auth';

const router = Router();

// ─── Public routes (no auth) ────────────────────────────────────
router.get('/portal/:token/list', invoiceController.getPortalInvoices);
router.get('/portal/:token/:invoiceId', invoiceController.getPortalInvoice);

// ─── Auth middleware ────────────────────────────────────────────
router.use(authMiddleware);

// Settings
router.get('/settings', invoiceController.getSettings);
router.patch('/settings', invoiceController.updateSettings);

// Invoices
router.get('/list', invoiceController.listInvoices);
router.get('/next-number', invoiceController.getNextInvoiceNumber);
router.post('/', invoiceController.createInvoice);
router.get('/:id', invoiceController.getInvoice);
router.patch('/:id', invoiceController.updateInvoice);
router.delete('/:id', invoiceController.deleteInvoice);
router.post('/:id/send', invoiceController.sendInvoice);
router.post('/:id/paid', invoiceController.markInvoicePaid);
router.post('/:id/waive', invoiceController.waiveInvoice);
router.post('/:id/duplicate', invoiceController.duplicateInvoice);

// Line Items
router.get('/:invoiceId/line-items', invoiceController.listLineItems);
router.post('/:invoiceId/line-items', invoiceController.createLineItem);
router.patch('/:id/line-items/:itemId', invoiceController.updateLineItem);
router.delete('/:id/line-items/:itemId', invoiceController.deleteLineItem);

// e-Fatura
router.post('/:id/efatura/generate', invoiceController.generateEFatura);
router.get('/:id/efatura/xml', invoiceController.getEFaturaXml);
router.get('/:id/efatura/preview', invoiceController.getEFaturaPreview);
router.get('/:id/efatura/pdf', invoiceController.getEFaturaPdf);

export default router;
```

- [ ] **Step 8: Commit**

```bash
git add packages/server/src/apps/invoices/
git commit -m "$(cat <<'EOF'
feat: create Invoices app controllers and routes

Full REST API for invoices under /api/invoices. Includes CRUD,
lifecycle actions (send/paid/waive/duplicate), line items, e-Fatura,
settings, and public portal endpoints.
EOF
)"
```

---

### Task 9: Create Invoices server app — manifest and registration

**Files:**
- Create: `packages/server/src/apps/invoices/manifest.ts`
- Modify: `packages/server/src/apps/index.ts`

- [ ] **Step 1: Create manifest.ts**

Follow the pattern from `packages/server/src/apps/projects/manifest.ts`:

```typescript
import type { ServerAppManifest } from '../../config/app-manifest.server';
import router from './routes';

export const invoicesServerManifest: ServerAppManifest = {
  id: 'invoices',
  name: 'Invoices',
  version: '1.0.0',
  minPlan: 'starter',
  defaultEnabled: true,
  routePrefix: '/invoices',
  router,
  tables: ['invoices', 'invoice_line_items', 'invoice_settings'],
  objects: [
    {
      name: 'invoices',
      table: 'invoices',
      labelField: 'invoice_number',
      standardFields: ['id', 'tenant_id', 'user_id', 'created_at', 'updated_at', 'is_archived'],
      relations: [
        { field: 'company_id', target: 'crm_companies', type: 'many-to-one' },
        { field: 'contact_id', target: 'crm_contacts', type: 'many-to-one' },
        { field: 'deal_id', target: 'crm_deals', type: 'many-to-one' },
      ],
    },
    {
      name: 'invoice_line_items',
      table: 'invoice_line_items',
      labelField: 'description',
      standardFields: ['id', 'created_at'],
      relations: [
        { field: 'invoice_id', target: 'invoices', type: 'many-to-one' },
      ],
    },
    {
      name: 'invoice_settings',
      table: 'invoice_settings',
      labelField: 'invoice_prefix',
      standardFields: ['id', 'tenant_id', 'created_at', 'updated_at'],
      relations: [],
    },
  ],
};
```

- [ ] **Step 2: Register in server apps/index.ts**

Add import and registration:

```typescript
import { invoicesServerManifest } from './invoices/manifest';
serverAppRegistry.register(invoicesServerManifest);
```

- [ ] **Step 3: Verify server compiles**

Run: `cd /Users/gorkemcetin/atlasmail/packages/server && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/apps/invoices/manifest.ts packages/server/src/apps/index.ts
git commit -m "feat: register Invoices server app with manifest"
```

---

## Phase 3: Shared Client Components

### Task 10: Create `LineItemsEditor` shared component

**Files:**
- Create: `packages/client/src/components/shared/line-items-editor.tsx`

- [ ] **Step 1: Create the component**

Extract the line items table from `packages/client/src/apps/projects/components/invoice-builder.tsx`. The component should be self-contained:

```tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { IconButton } from '../ui/icon-button';

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
}

interface LineItemsEditorProps {
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
  readOnly?: boolean;
  currency?: string;
}

export function LineItemsEditor({ items, onChange, readOnly = false, currency = 'USD' }: LineItemsEditorProps) {
  // ... implementation:
  // - Table with columns: description, quantity, unit price, tax rate, amount (computed), delete button
  // - Add row button at bottom
  // - Each field is an inline Input when not readOnly
  // - amount = quantity * unitPrice
  // - Generate unique id for new rows via crypto.randomUUID()
}
```

Port the exact line items table rendering logic from invoice-builder.tsx, extracting it into this standalone component. Include the add/remove row logic, inline editing, and amount computation.

- [ ] **Step 2: Commit**

```bash
git add packages/client/src/components/shared/line-items-editor.tsx
git commit -m "feat: create shared LineItemsEditor component"
```

---

### Task 11: Create `TotalsBlock` shared component

**Files:**
- Create: `packages/client/src/components/shared/totals-block.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { useTranslation } from 'react-i18next';
import { Input } from '../ui/input';

interface TotalsBlockProps {
  subtotal: number;
  taxPercent: number;
  discountPercent: number;
  currency?: string;
  editable?: boolean;
  onTaxChange?: (val: number) => void;
  onDiscountChange?: (val: number) => void;
}

export function TotalsBlock({
  subtotal,
  taxPercent,
  discountPercent,
  currency = 'USD',
  editable = false,
  onTaxChange,
  onDiscountChange,
}: TotalsBlockProps) {
  const { t } = useTranslation();
  const taxAmount = subtotal * (taxPercent / 100);
  const discountAmount = subtotal * (discountPercent / 100);
  const total = subtotal + taxAmount - discountAmount;

  // Render rows: Subtotal, Tax % (editable input or display), Discount % (editable input or display), Total
  // Use formatCurrency helper for amounts
  // Right-aligned amounts
}
```

Port the totals rendering logic from invoice-builder.tsx.

- [ ] **Step 2: Commit**

```bash
git add packages/client/src/components/shared/totals-block.tsx
git commit -m "feat: create shared TotalsBlock component"
```

---

### Task 12: Create `StatusTimeline` shared component

**Files:**
- Create: `packages/client/src/components/shared/status-timeline.tsx`

- [ ] **Step 1: Create the component**

Extract the status timeline from `packages/client/src/apps/projects/components/views/invoice-detail-panel.tsx`:

```tsx
interface StatusTimelineProps {
  steps: Array<{ label: string; timestamp?: string | null }>;
  currentIndex: number;
}

export function StatusTimeline({ steps, currentIndex }: StatusTimelineProps) {
  // Render horizontal step indicators
  // Each step: circle (filled if <= currentIndex, empty if not) + label + timestamp if present
  // Lines connecting steps
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/client/src/components/shared/status-timeline.tsx
git commit -m "feat: create shared StatusTimeline component"
```

---

### Task 13: Create `InvoiceBuilderModal` shared component

**Files:**
- Create: `packages/client/src/components/shared/invoice-builder-modal.tsx`

- [ ] **Step 1: Create the component**

This is the main invoice creation/editing modal. Port from `packages/client/src/apps/projects/components/invoice-builder.tsx` with these changes:

```tsx
import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '../ui/modal';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select } from '../ui/select';
import { Textarea } from '../ui/textarea';
import { LineItemsEditor, type LineItem } from './line-items-editor';
import { TotalsBlock } from './totals-block';
import { useCompanies } from '../../apps/crm/hooks'; // Search CRM companies
import type { Invoice, CreateInvoiceInput } from '@atlas/shared';

interface InvoiceBuilderModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (invoice: Invoice) => void;
  invoice?: Invoice | null; // For editing
  prefill?: {
    companyId?: string;
    contactId?: string;
    dealId?: string;
    proposalId?: string;
    lineItems?: LineItem[];
    currency?: string;
  };
}
```

Key changes from the Projects version:
- Uses `useCompanies()` from CRM hooks instead of `useClients()` from Projects hooks
- Company selector searches `crmCompanies`
- Creates invoices via the Invoices app API (`/api/invoices`) not Projects API
- Uses `useCreateInvoice` and `useUpdateInvoice` from a new `packages/client/src/apps/invoices/hooks.ts`
- Reads e-Fatura settings from invoice settings instead of project settings
- Accepts `prefill` prop for pre-populating from CRM deals or Projects time entries
- Uses shared `LineItemsEditor` and `TotalsBlock` components

- [ ] **Step 2: Commit**

```bash
git add packages/client/src/components/shared/invoice-builder-modal.tsx
git commit -m "$(cat <<'EOF'
feat: create shared InvoiceBuilderModal component

Reusable invoice creation modal that can be opened from CRM, Projects,
or the Invoices app. Uses CRM companies as the client selector.
Accepts prefill props for pre-populating from deals or time entries.
EOF
)"
```

---

### Task 14: Create `LinkedInvoicesList` shared component

**Files:**
- Create: `packages/client/src/components/shared/linked-invoices-list.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Plus, ExternalLink } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import type { Invoice } from '@atlas/shared';
import { getInvoiceStatusVariant } from '@atlas/shared';

interface LinkedInvoicesListProps {
  invoices: Invoice[];
  isLoading?: boolean;
  limit?: number;
  showCreateButton?: boolean;
  onCreateClick?: () => void;
}

export function LinkedInvoicesList({
  invoices,
  isLoading = false,
  limit = 5,
  showCreateButton = true,
  onCreateClick,
}: LinkedInvoicesListProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const displayed = invoices.slice(0, limit);

  // Compact table: invoice number, amount, status badge, issue date
  // Click row → navigate to /invoices?id={invoiceId}
  // "Create invoice" button if showCreateButton
  // "View all" link if invoices.length > limit
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/client/src/components/shared/linked-invoices-list.tsx
git commit -m "feat: create shared LinkedInvoicesList component"
```

---

## Phase 4: Invoices App (Client)

### Task 15: Create Invoices client app — hooks

**Files:**
- Create: `packages/client/src/apps/invoices/hooks.ts`

- [ ] **Step 1: Create hooks.ts**

Port from `packages/client/src/apps/projects/hooks.ts`, extracting only the invoice-related hooks. Change all API paths from `/projects/invoices/...` to `/invoices/...`. Change query keys from `queryKeys.projects.invoices.*` to `queryKeys.invoices.*`.

Hooks to create:
- `useInvoices(filters?)` — GET `/invoices/list`
- `useInvoice(id)` — GET `/invoices/:id`
- `useCreateInvoice()` — POST `/invoices`
- `useUpdateInvoice()` — PATCH `/invoices/:id`
- `useDeleteInvoice()` — DELETE `/invoices/:id`
- `useSendInvoice()` — POST `/invoices/:id/send`
- `useMarkInvoicePaid()` — POST `/invoices/:id/paid`
- `useWaiveInvoice()` — POST `/invoices/:id/waive`
- `useDuplicateInvoice()` — POST `/invoices/:id/duplicate`
- `useInvoiceSettings()` — GET `/invoices/settings`
- `useUpdateInvoiceSettings()` — PATCH `/invoices/settings`
- `useNextInvoiceNumber()` — GET `/invoices/next-number`
- `useGenerateEFatura()` — POST `/invoices/:id/efatura/generate`

All hooks use types from `@atlas/shared` (Invoice, InvoiceSettings, etc.) instead of locally defined interfaces.

- [ ] **Step 2: Commit**

```bash
git add packages/client/src/apps/invoices/hooks.ts
git commit -m "feat: create Invoices client hooks"
```

---

### Task 16: Create Invoices client app — page and components

**Files:**
- Create: `packages/client/src/apps/invoices/page.tsx`
- Create: `packages/client/src/apps/invoices/components/invoices-sidebar.tsx`
- Create: `packages/client/src/apps/invoices/components/invoices-list-view.tsx`
- Create: `packages/client/src/apps/invoices/components/invoice-detail-panel.tsx`
- Create: `packages/client/src/apps/invoices/components/invoice-settings-panel.tsx`

- [ ] **Step 1: Create invoices-sidebar.tsx**

Follow `crm-sidebar.tsx` pattern. Sections:
- All invoices (default)
- Draft, Sent, Overdue, Paid, Waived (filter by status)

```tsx
import { useTranslation } from 'react-i18next';
import { Receipt, FileText, Send, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { AppSidebar } from '../../../components/layout/app-sidebar';
import { SidebarSection, SidebarItem } from '../../../components/layout/app-sidebar';

interface InvoicesSidebarProps {
  activeView: string;
  setActiveView: (view: string) => void;
  counts?: { draft: number; sent: number; overdue: number; paid: number; waived: number };
}
```

- [ ] **Step 2: Create invoices-list-view.tsx**

Port from `packages/client/src/apps/projects/components/views/invoices-list-view.tsx` with changes:
- Column `clientName` → `companyName`
- Add `source` column showing deal/project link icon if `dealId` is set
- Uses types from `@atlas/shared`

- [ ] **Step 3: Create invoice-detail-panel.tsx**

Port from `packages/client/src/apps/projects/components/views/invoice-detail-panel.tsx` with changes:
- Company info from `crmCompanies` instead of `projectClients`
- Show source links: "From deal: {dealTitle}" / "From proposal: {proposalTitle}" as clickable links to CRM
- Uses shared `StatusTimeline` component
- Uses shared `TotalsBlock` component (readOnly)
- e-Fatura section reads from invoice settings instead of project settings

- [ ] **Step 4: Create invoice-settings-panel.tsx**

Port the invoice-related settings from the Projects settings view. Shows:
- Invoice prefix, default currency, default tax rate
- e-Fatura toggle + company details (when enabled)

- [ ] **Step 5: Create page.tsx**

Follow the Projects page pattern — sidebar + content area:

```tsx
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useInvoices } from './hooks';
import { InvoicesSidebar } from './components/invoices-sidebar';
import { InvoicesListView } from './components/invoices-list-view';
import { InvoiceDetailPanel } from './components/invoice-detail-panel';
import { InvoiceBuilderModal } from '../../components/shared/invoice-builder-modal';

export function InvoicesPage() {
  const [searchParams] = useSearchParams();
  const [activeView, setActiveView] = useState('all');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(
    searchParams.get('id')
  );
  const [showBuilder, setShowBuilder] = useState(
    searchParams.get('new') === 'true'
  );
  // ... prefill from URL params (companyId, dealId from searchParams)
}
```

- [ ] **Step 6: Commit**

```bash
git add packages/client/src/apps/invoices/
git commit -m "$(cat <<'EOF'
feat: create Invoices client app — page, sidebar, list, detail, settings

Full Invoices app UI with sidebar filtering by status, list view with
search, detail panel with status timeline and e-Fatura, and settings
panel for invoice configuration.
EOF
)"
```

---

### Task 17: Create Invoices client manifest and register

**Files:**
- Create: `packages/client/src/apps/invoices/manifest.ts`
- Modify: `packages/client/src/apps/index.ts`

- [ ] **Step 1: Create manifest.ts**

```typescript
import { Receipt, Settings } from 'lucide-react';
import type { ClientAppManifest } from '../../config/app-manifest.client';
import { InvoicesPage } from './page';
import { InvoiceSettingsPanel } from './components/invoice-settings-panel';

export const invoicesManifest: ClientAppManifest = {
  id: 'invoices',
  name: 'Invoices',
  labelKey: 'sidebar.invoices',
  iconName: 'Receipt',
  icon: Receipt,
  color: '#0ea5e9',
  minPlan: 'starter',
  category: 'data',
  dependencies: ['crm'],
  defaultEnabled: true,
  version: '1.0.0',
  sidebarOrder: 35,
  routes: [{ path: '/invoices', component: InvoicesPage }],
  settingsCategory: {
    id: 'invoices',
    label: 'Invoices',
    icon: Receipt,
    color: '#0ea5e9',
    panels: [
      { id: 'general', label: 'General', icon: Settings, component: InvoiceSettingsPanel, adminOnly: true },
    ],
  },
};
```

- [ ] **Step 2: Register in client apps/index.ts**

```typescript
import { invoicesManifest } from './invoices/manifest';
appRegistry.register(invoicesManifest);
```

- [ ] **Step 3: Verify client compiles**

Run: `cd /Users/gorkemcetin/atlasmail/packages/client && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/apps/invoices/manifest.ts packages/client/src/apps/index.ts
git commit -m "feat: register Invoices client app with manifest"
```

---

### Task 18: Add translations for Invoices

**Files:**
- Modify: `packages/client/src/i18n/locales/en.json`
- Modify: `packages/client/src/i18n/locales/tr.json`
- Modify: `packages/client/src/i18n/locales/de.json`
- Modify: `packages/client/src/i18n/locales/fr.json`
- Modify: `packages/client/src/i18n/locales/it.json`

- [ ] **Step 1: Add English translations**

Add `"sidebar": { "invoices": "Invoices" }` entry (or add to existing sidebar section).

Add `"invoices"` section with keys for:
- Sidebar items: `all`, `draft`, `sent`, `overdue`, `paid`, `waived`
- List headers: `invoiceNumber`, `company`, `amount`, `status`, `issueDate`, `dueDate`
- Builder: `createInvoice`, `editInvoice`, `company`, `contact`, `issueDate`, `dueDate`, `notes`, `saveDraft`, `send`, `addLineItem`, `description`, `quantity`, `unitPrice`, `taxRate`, `amount`
- Detail: `markPaid`, `waive`, `duplicate`, `delete`, `fromDeal`, `fromProposal`
- Settings: `invoicePrefix`, `defaultCurrency`, `defaultTaxRate`, `eFatura`, `companyDetails`
- Status labels: `statusDraft`, `statusSent`, `statusViewed`, `statusPaid`, `statusOverdue`, `statusWaived`
- Empty state: `noInvoices`, `noInvoicesDescription`
- Totals: `subtotal`, `tax`, `discount`, `total`

- [ ] **Step 2: Add translations for TR, DE, FR, IT**

Translate all keys above into each language. Use the existing locale files as reference for translation style and terminology.

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/i18n/locales/
git commit -m "feat: add Invoices translations for all 5 locales"
```

---

## Phase 5: Projects App Rewiring

### Task 19: Replace `projectClients` with `crmCompanies` in Projects server

**Files:**
- Modify: `packages/server/src/apps/projects/services/project.service.ts`
- Modify: `packages/server/src/apps/projects/services/time-entry.service.ts`
- Modify: `packages/server/src/apps/projects/services/report.service.ts`
- Modify: `packages/server/src/apps/projects/services/dashboard.service.ts`
- Delete: `packages/server/src/apps/projects/services/client.service.ts`
- Delete: `packages/server/src/apps/projects/controllers/client.controller.ts`
- Modify: `packages/server/src/apps/projects/controller.ts` (remove client re-export)
- Modify: `packages/server/src/apps/projects/routes.ts` (remove client routes)
- Modify: `packages/server/src/apps/projects/manifest.ts` (remove client from tables/objects)

- [ ] **Step 1: Update project.service.ts**

Replace all `projectClients` references with `crmCompanies`. Change `clientId` to `companyId` in queries. Update joins that read client name to join `crmCompanies` instead.

- [ ] **Step 2: Update time-entry.service.ts and report.service.ts**

Replace any `projectClients` joins with `crmCompanies`. Update `clientId` → `companyId` in any filters.

- [ ] **Step 3: Update dashboard.service.ts**

Replace `projectClients` references with `crmCompanies` for any dashboard stats that show client info.

- [ ] **Step 4: Delete client.service.ts and client.controller.ts**

These are no longer needed — Projects doesn't own client data.

- [ ] **Step 5: Update controller.ts barrel**

Remove `export * from './controllers/client.controller'`.

- [ ] **Step 6: Update routes.ts**

Remove all client routes:
- `GET /clients/list`
- `POST /clients`
- `GET/PATCH/DELETE /clients/:id`
- `POST /clients/:id/regenerate-token`

Remove all invoice routes (moved to Invoices app):
- All `/invoices/*` routes
- All `/invoices/:id/efatura/*` routes
- All `/invoices/:invoiceId/line-items/*` routes
- `GET/PATCH /settings` (invoice settings portion)

Remove portal routes (moved to Invoices app):
- `GET /portal/:token`
- `GET /portal/:token/invoices`
- `GET /portal/:token/invoices/:invoiceId`

Keep: project CRUD, time entry CRUD, member CRUD, report routes, project settings (minus invoice fields).

- [ ] **Step 7: Update manifest.ts**

Remove `project_clients`, `project_invoices`, `project_invoice_line_items` from the `tables` array. Remove the corresponding `objects` entries. Keep `project_settings` but remove invoice-related fields from its standardFields.

- [ ] **Step 8: Update populateFromTimeEntries**

In the Projects service that handles time-entry billing, change the imports to write to the new `invoices` and `invoiceLineItems` tables instead of `projectInvoices` and `projectInvoiceLineItems`. The function stays in Projects but writes to Invoices tables.

- [ ] **Step 9: Verify server compiles**

Run: `cd /Users/gorkemcetin/atlasmail/packages/server && npx tsc --noEmit`

- [ ] **Step 10: Commit**

```bash
git add packages/server/src/apps/projects/
git commit -m "$(cat <<'EOF'
feat: rewire Projects server to use crmCompanies and shared Invoices tables

- Remove projectClients service/controller/routes
- Remove invoice routes (moved to Invoices app)
- Replace clientId with companyId referencing crmCompanies
- populateFromTimeEntries now writes to shared invoices/invoiceLineItems tables
EOF
)"
```

---

### Task 20: Replace `projectClients` with `crmCompanies` in Projects client

**Files:**
- Modify: `packages/client/src/apps/projects/hooks.ts`
- Modify: `packages/client/src/apps/projects/page.tsx`
- Delete: `packages/client/src/apps/projects/components/views/invoices-list-view.tsx`
- Delete: `packages/client/src/apps/projects/components/views/invoice-detail-panel.tsx`
- Delete: `packages/client/src/apps/projects/components/invoice-builder.tsx`
- Delete: `packages/client/src/apps/projects/components/views/clients-list-view.tsx` (if exists)
- Delete: `packages/client/src/apps/projects/components/views/client-detail-panel.tsx` (if exists)
- Modify: `packages/client/src/apps/projects/manifest.ts`

- [ ] **Step 1: Remove client and invoice hooks from hooks.ts**

Remove: `useClients`, `useClient`, `useCreateClient`, `useUpdateClient`, `useDeleteClient`, `useRegeneratePortalToken`, `useInvoices`, `useInvoice`, `useCreateInvoice`, `useUpdateInvoice`, `useDeleteInvoice`, `useSendInvoice`, `useMarkInvoicePaid`, `useWaiveInvoice`, `usePopulateFromTimeEntries`, `useDuplicateInvoice`, `useGenerateEFatura`, `getInvoiceStatusVariant`, `usePortalData`.

Add a new hook `useProjectCompanies()` that fetches CRM companies via `/api/crm/companies/list` for use in the project company selector. Or import `useCompanies` directly from the CRM hooks.

Keep: `useProjects`, project CRUD hooks, time entry hooks, report hooks, settings hooks (minus invoice settings).

- [ ] **Step 2: Update page.tsx**

Remove all invoice and client view imports and state. Replace with:
- Import `LinkedInvoicesList` from shared components for showing invoices on project pages
- Import `InvoiceBuilderModal` from shared components for the "Bill time entries" flow
- Import `useCompanies` from CRM hooks for the company selector
- Remove `ClientsListView`, `ClientDetailPanel`, `InvoicesListView`, `InvoiceDetailPanel` imports
- Remove sidebar items for "Clients" and "Invoices" — replace with project-focused sidebar
- Add a `LinkedInvoicesList` section on the project detail view

- [ ] **Step 3: Delete removed component files**

Delete the Projects invoice and client component files that are no longer used.

- [ ] **Step 4: Verify client compiles**

Run: `cd /Users/gorkemcetin/atlasmail/packages/client && npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/apps/projects/
git commit -m "$(cat <<'EOF'
feat: rewire Projects client to use CRM companies and shared invoice components

- Remove client and invoice views/hooks from Projects
- Use CRM companies hook for company selection
- Use shared InvoiceBuilderModal and LinkedInvoicesList components
- Projects sidebar no longer shows Clients or Invoices sections
EOF
)"
```

---

### Task 21: Drop old tables from schema and migration

**Files:**
- Modify: `packages/server/src/db/schema.ts`
- Modify: `packages/server/src/db/migrate.ts`
- Modify: `packages/shared/src/types/projects.ts`

- [ ] **Step 1: Remove old tables from schema.ts**

Remove the following table definitions:
- `projectClients`
- `projectInvoices`
- `projectInvoiceLineItems`

Remove invoice-related columns from `projectSettings`: `invoicePrefix`, `nextInvoiceNumber`, e-Fatura fields. Keep `defaultHourlyRate`, `companyName`, `companyAddress`, `companyLogo`.

Change `projectProjects.clientId` to `projectProjects.companyId` with FK to `crmCompanies`.

- [ ] **Step 2: Update migrate.ts**

Remove `CREATE TABLE IF NOT EXISTS` for `project_clients`, `project_invoices`, `project_invoice_line_items`. Remove `ALTER TABLE` statements that add columns to these tables.

Add migration to rename `project_projects.client_id` → `project_projects.company_id` (or drop and recreate since it's not live).

- [ ] **Step 3: Update shared types**

In `packages/shared/src/types/projects.ts`:
- Remove `ProjectClient`, `CreateProjectClientInput`, `UpdateProjectClientInput`
- Remove `Invoice`, `InvoiceLineItem`, `CreateInvoiceInput`, `UpdateInvoiceInput` (these now live in `invoices.ts`)
- Remove `InvoiceStatus`, `getInvoiceStatusVariant` (now in `invoices.ts`)
- Update `Project` interface: `clientId` → `companyId`, `clientName` → `companyName`
- Update `ProjectSettings`: remove invoice fields

- [ ] **Step 4: Verify both packages compile**

Run: `cd /Users/gorkemcetin/atlasmail/packages/server && npx tsc --noEmit`
Run: `cd /Users/gorkemcetin/atlasmail/packages/client && npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/db/ packages/shared/src/types/projects.ts
git commit -m "$(cat <<'EOF'
chore: drop projectClients, projectInvoices, projectInvoiceLineItems tables

These are replaced by crmCompanies (with billing fields) and the
standalone invoices/invoiceLineItems tables. projectProjects now
uses companyId referencing crmCompanies.
EOF
)"
```

---

## Phase 6: CRM Proposals

### Task 22: Create Proposals server — service and controller

**Files:**
- Create: `packages/server/src/apps/crm/services/proposal.service.ts`
- Create: `packages/server/src/apps/crm/controllers/proposal.controller.ts`
- Modify: `packages/server/src/apps/crm/service.ts` (add re-export)
- Modify: `packages/server/src/apps/crm/controller.ts` (add re-export)

- [ ] **Step 1: Create proposal.service.ts**

```typescript
import { db } from '../../../config/database';
import { crmProposals, crmCompanies, crmContacts, crmDeals, invoices, invoiceLineItems } from '../../../db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { logger } from '../../../utils/logger';

export async function listProposals(tenantId: string, filters?: { dealId?: string; companyId?: string; status?: string; search?: string }) {
  // Query crmProposals with LEFT JOIN on crmCompanies, crmContacts, crmDeals for display names
  // Apply filters
  // Order by createdAt desc
}

export async function getProposal(tenantId: string, id: string) {
  // Fetch proposal + join company/contact/deal names
}

export async function createProposal(userId: string, tenantId: string, input: CreateProposalInput) {
  // Insert into crmProposals
  // Compute subtotal/taxAmount/discountAmount/total from lineItems
}

export async function updateProposal(tenantId: string, id: string, input: UpdateProposalInput) {
  // Partial update, recompute totals if lineItems changed
}

export async function deleteProposal(tenantId: string, id: string) {
  // Soft delete (isArchived = true)
}

export async function sendProposal(tenantId: string, id: string) {
  // Set status = 'sent', sentAt = now()
}

export async function duplicateProposal(userId: string, tenantId: string, id: string) {
  // Clone proposal as new draft
}

export async function getProposalByPublicToken(token: string) {
  // Fetch proposal by publicToken + join company name
  // Used by public routes
}

export async function acceptProposal(token: string) {
  // Set status = 'accepted', acceptedAt = now()
  // If proposal has line items, create a draft invoice:
  //   - Insert into invoices table with proposalId, companyId, contactId, dealId
  //   - Insert line items into invoiceLineItems
  //   - Auto-generate invoice number from invoiceSettings
  // Return the proposal
}

export async function declineProposal(token: string) {
  // Set status = 'declined', declinedAt = now()
}
```

- [ ] **Step 2: Create proposal.controller.ts**

```typescript
import { Request, Response } from 'express';
import * as proposalService from '../services/proposal.service';
import { logger } from '../../../utils/logger';

// Auth routes
export async function listProposals(req: Request, res: Response) { ... }
export async function getProposal(req: Request, res: Response) { ... }
export async function createProposal(req: Request, res: Response) { ... }
export async function updateProposal(req: Request, res: Response) { ... }
export async function deleteProposal(req: Request, res: Response) { ... }
export async function sendProposal(req: Request, res: Response) { ... }
export async function duplicateProposal(req: Request, res: Response) { ... }

// Public routes (no auth)
export async function getPublicProposal(req: Request, res: Response) { ... }
export async function acceptPublicProposal(req: Request, res: Response) { ... }
export async function declinePublicProposal(req: Request, res: Response) { ... }
```

- [ ] **Step 3: Add re-exports to barrel files**

In `packages/server/src/apps/crm/service.ts`, add:
```typescript
export * as proposalService from './services/proposal.service';
```

In `packages/server/src/apps/crm/controller.ts`, add:
```typescript
export * from './controllers/proposal.controller';
```

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/apps/crm/
git commit -m "$(cat <<'EOF'
feat: add Proposals service and controller to CRM

CRUD for proposals, send, duplicate, plus public endpoints for
accept/decline. Accepting a proposal auto-creates a draft invoice
in the shared Invoices tables.
EOF
)"
```

---

### Task 23: Add Proposal routes to CRM

**Files:**
- Modify: `packages/server/src/apps/crm/routes.ts`

- [ ] **Step 1: Add proposal routes**

Add to the CRM routes file, following the existing pattern. Place public routes before the authMiddleware, auth routes after:

```typescript
// Public proposal routes (before authMiddleware)
router.get('/proposals/public/:token', crmController.getPublicProposal);
router.post('/proposals/public/:token/accept', crmController.acceptPublicProposal);
router.post('/proposals/public/:token/decline', crmController.declinePublicProposal);

// ... existing authMiddleware ...

// Proposals (after auth)
router.get('/proposals/list', crmController.listProposals);
router.post('/proposals', crmController.createProposal);
router.get('/proposals/:id', crmController.getProposal);
router.patch('/proposals/:id', crmController.updateProposal);
router.delete('/proposals/:id', crmController.deleteProposal);
router.post('/proposals/:id/send', crmController.sendProposal);
router.post('/proposals/:id/duplicate', crmController.duplicateProposal);
```

- [ ] **Step 2: Verify server compiles**

Run: `cd /Users/gorkemcetin/atlasmail/packages/server && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add packages/server/src/apps/crm/routes.ts
git commit -m "feat: add proposal routes to CRM API"
```

---

### Task 24: Create Proposals client — hooks

**Files:**
- Modify: `packages/client/src/apps/crm/hooks.ts`

- [ ] **Step 1: Add proposal hooks**

Add to the existing CRM hooks file:

```typescript
// ─── Proposals ──────────────────────────────────────────────────
export function useProposals(filters?: { dealId?: string; companyId?: string; status?: string; search?: string }) {
  return useQuery({
    queryKey: queryKeys.crm.proposals.list(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.dealId) params.set('dealId', filters.dealId);
      if (filters?.companyId) params.set('companyId', filters.companyId);
      if (filters?.status) params.set('status', filters.status);
      if (filters?.search) params.set('search', filters.search);
      const { data } = await api.get(`/crm/proposals/list?${params}`);
      return data.data as Proposal[];
    },
  });
}

export function useProposal(id: string | undefined) { ... }
export function useCreateProposal() { ... }
export function useUpdateProposal() { ... }
export function useDeleteProposal() { ... }
export function useSendProposal() { ... }
export function useDuplicateProposal() { ... }
```

Import `Proposal` type from `@atlas/shared`.

- [ ] **Step 2: Commit**

```bash
git add packages/client/src/apps/crm/hooks.ts
git commit -m "feat: add CRM proposal hooks"
```

---

### Task 25: Create Proposals client — components

**Files:**
- Create: `packages/client/src/apps/crm/components/proposals-list-view.tsx`
- Create: `packages/client/src/apps/crm/components/proposal-editor.tsx`
- Create: `packages/client/src/apps/crm/components/proposal-detail-panel.tsx`

- [ ] **Step 1: Create proposals-list-view.tsx**

Table view of all proposals. Columns: title, company, deal, status badge, total, sent date. Search filter. Uses `DataTable` component following the pattern in the existing CRM views.

- [ ] **Step 2: Create proposal-editor.tsx**

Large modal or full-width component with:
- Header: title input, company selector (useCompanies from CRM), contact selector, valid-until date, currency
- Body section 1: TipTap rich text editor for scope/terms. Import TipTap the same way the Write app does (`@tiptap/react`, `@tiptap/starter-kit`).
- Body section 2: `<LineItemsEditor>` from shared components
- Footer: `<TotalsBlock>` with editable tax%/discount%, then Save Draft / Send buttons
- Accepts optional `prefill` prop: `{ dealId, companyId, contactId, title }`

- [ ] **Step 3: Create proposal-detail-panel.tsx**

Read-only detail view with:
- `StatusTimeline` (draft → sent → viewed → accepted)
- Company/contact info
- Scope/terms rendered as HTML
- Line items table (readOnly)
- `TotalsBlock` (readOnly)
- Actions: Edit, Send, Duplicate, Delete
- Public link display (copy to clipboard)

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/apps/crm/components/proposals-list-view.tsx packages/client/src/apps/crm/components/proposal-editor.tsx packages/client/src/apps/crm/components/proposal-detail-panel.tsx
git commit -m "$(cat <<'EOF'
feat: create CRM Proposal components — list, editor, detail panel

Proposal editor has TipTap rich text for scope/terms, shared
LineItemsEditor for pricing, and TotalsBlock for calculations.
Detail panel shows status timeline and public link.
EOF
)"
```

---

### Task 26: Add Proposals to CRM sidebar and deal detail page

**Files:**
- Modify: `packages/client/src/apps/crm/components/crm-sidebar.tsx`
- Modify: `packages/client/src/apps/crm/components/crm-content.tsx` (or equivalent content router)
- Modify: `packages/client/src/apps/crm/components/deal-detail-page.tsx`
- Modify: `packages/client/src/apps/crm/page.tsx`

- [ ] **Step 1: Add "Proposals" sidebar item**

In `crm-sidebar.tsx`, add a new `SidebarItem` for "Proposals" after the Deals section. Icon: `FileSignature` from lucide.

- [ ] **Step 2: Add proposals view to CRM content**

In the CRM content router (the component that switches between Dashboard, Pipeline, Deals, Contacts, Companies, etc. based on `activeView`), add a case for `'proposals'` that renders `<ProposalsListView>`.

- [ ] **Step 3: Add Proposals and Invoices sections to deal detail page**

In `deal-detail-page.tsx`, after the `NotesSection` and before the Delete button in the left column:

```tsx
{/* Proposals section */}
<div>
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
    <h3>{t('crm.deal.proposals')}</h3>
    <Button size="sm" variant="ghost" onClick={() => setShowProposalEditor(true)}>
      <Plus size={14} /> {t('crm.proposals.create')}
    </Button>
  </div>
  <LinkedProposalsList proposals={dealProposals} />
</div>

{/* Invoices section */}
<div>
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
    <h3>{t('crm.deal.invoices')}</h3>
    <Button size="sm" variant="ghost" onClick={() => setShowInvoiceBuilder(true)}>
      <Plus size={14} /> {t('invoices.createInvoice')}
    </Button>
  </div>
  <LinkedInvoicesList invoices={dealInvoices} />
</div>
```

Add the necessary hooks: `useProposals({ dealId })`, `useInvoices({ dealId })` (from Invoices hooks). Add state for `showProposalEditor` and `showInvoiceBuilder` modals.

- [ ] **Step 4: Verify client compiles**

Run: `cd /Users/gorkemcetin/atlasmail/packages/client && npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/apps/crm/
git commit -m "$(cat <<'EOF'
feat: integrate Proposals and Invoices into CRM sidebar and deal page

CRM sidebar gets a new Proposals section. Deal detail page shows
inline Proposals and Invoices lists with create buttons that open
the proposal editor and invoice builder modals.
EOF
)"
```

---

### Task 27: Create public proposal page

**Files:**
- Create: `packages/client/src/apps/crm/components/proposal-public-page.tsx`
- Modify: `packages/client/src/App.tsx` (or equivalent root router) to add `/proposal/:token` route

- [ ] **Step 1: Create proposal-public-page.tsx**

Unauthenticated page that displays a proposal for client review:

```tsx
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircle, XCircle } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { TotalsBlock } from '../../../components/shared/totals-block';
import { LineItemsEditor } from '../../../components/shared/line-items-editor';
import { api } from '../../../lib/api-client';

export function ProposalPublicPage() {
  const { token } = useParams<{ token: string }>();
  const { t } = useTranslation();
  const [proposal, setProposal] = useState(null);
  const [accepted, setAccepted] = useState(false);
  const [declined, setDeclined] = useState(false);

  // Fetch proposal via GET /crm/proposals/public/:token
  // Render: company logo, title, scope/terms (HTML), line items (readOnly), totals
  // Accept button → POST /crm/proposals/public/:token/accept
  // Decline button → POST /crm/proposals/public/:token/decline
  // After action: show confirmation message
}
```

- [ ] **Step 2: Add route to root router**

Find the root router (likely `App.tsx` or a routes config file) and add:

```tsx
<Route path="/proposal/:token" element={<ProposalPublicPage />} />
```

This route should be outside the authenticated layout, alongside the existing Sign public route.

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/apps/crm/components/proposal-public-page.tsx packages/client/src/App.tsx
git commit -m "$(cat <<'EOF'
feat: create public proposal page at /proposal/:token

Unauthenticated page for clients to view, accept, or decline proposals.
Shows scope/terms, line items, and totals. Accept auto-creates a draft
invoice.
EOF
)"
```

---

### Task 28: Add Proposals translations

**Files:**
- Modify: `packages/client/src/i18n/locales/en.json`
- Modify: `packages/client/src/i18n/locales/tr.json`
- Modify: `packages/client/src/i18n/locales/de.json`
- Modify: `packages/client/src/i18n/locales/fr.json`
- Modify: `packages/client/src/i18n/locales/it.json`

- [ ] **Step 1: Add proposal translation keys to all 5 locales**

Add to the existing `crm` section:

```json
"proposals": {
  "title": "Proposals",
  "create": "Create proposal",
  "edit": "Edit proposal",
  "send": "Send proposal",
  "duplicate": "Duplicate",
  "delete": "Delete",
  "scopeAndTerms": "Scope & terms",
  "pricing": "Pricing",
  "validUntil": "Valid until",
  "publicLink": "Public link",
  "copyLink": "Copy link",
  "saveDraft": "Save draft",
  "statusDraft": "Draft",
  "statusSent": "Sent",
  "statusViewed": "Viewed",
  "statusAccepted": "Accepted",
  "statusDeclined": "Declined",
  "statusExpired": "Expired",
  "noProposals": "No proposals yet",
  "noProposalsDescription": "Create a proposal to send to your client",
  "acceptConfirmation": "Proposal accepted — thank you!",
  "declineConfirmation": "Proposal declined"
},
"deal": {
  "proposals": "Proposals",
  "invoices": "Invoices"
}
```

Translate for TR, DE, FR, IT.

- [ ] **Step 2: Commit**

```bash
git add packages/client/src/i18n/locales/
git commit -m "feat: add CRM Proposals translations for all 5 locales"
```

---

## Phase 7: Final Integration & Verification

### Task 29: Update CRM company views with billing fields

**Files:**
- Modify: `packages/client/src/apps/crm/components/` (company detail/edit components)
- Modify: `packages/server/src/apps/crm/services/company.service.ts`
- Modify: `packages/server/src/apps/crm/controllers/company.controller.ts`

- [ ] **Step 1: Update company service to handle new fields**

Ensure the CRM company service reads and writes the new billing fields (taxOffice, currency, postalCode, state, country, logo, portalToken) in create/update operations.

- [ ] **Step 2: Update company UI**

Add the new billing fields to the company detail/edit view. Group them under a "Billing" section: tax ID, tax office, currency, address fields (postalCode, state, country), logo upload.

- [ ] **Step 3: Add portal token regeneration**

Add a "Regenerate portal token" button on the company detail page (port from the old projectClients pattern).

- [ ] **Step 4: Add billing field translations to all 5 locales**

Add keys to the `crm.company` section in all locale files:

```json
"billing": "Billing",
"taxOffice": "Tax office",
"currency": "Currency",
"postalCode": "Postal code",
"state": "State / Province",
"country": "Country",
"logo": "Company logo",
"portalToken": "Client portal token",
"regenerateToken": "Regenerate token"
```

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/apps/crm/ packages/client/src/apps/crm/ packages/client/src/i18n/locales/
git commit -m "feat: add billing fields to CRM company views with translations"
```

---

### Task 30: Full build verification

- [ ] **Step 1: Build server**

```bash
cd /Users/gorkemcetin/atlasmail/packages/server && npm run build
```

Expected: success with no errors.

- [ ] **Step 2: Build client**

```bash
cd /Users/gorkemcetin/atlasmail/packages/client && npm run build
```

Expected: success with no errors.

- [ ] **Step 3: Build shared**

```bash
cd /Users/gorkemcetin/atlasmail/packages/shared && npm run build
```

Expected: success with no errors.

- [ ] **Step 4: Fix any compilation errors**

If any errors, fix them and re-run the build.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "fix: resolve any remaining build errors from invoicing/proposals migration"
```

---

## Summary of files

### New files (create)
- `packages/shared/src/types/invoices.ts`
- `packages/shared/src/types/proposals.ts`
- `packages/server/src/apps/invoices/manifest.ts`
- `packages/server/src/apps/invoices/routes.ts`
- `packages/server/src/apps/invoices/controller.ts`
- `packages/server/src/apps/invoices/controllers/invoice.controller.ts`
- `packages/server/src/apps/invoices/controllers/line-item.controller.ts`
- `packages/server/src/apps/invoices/controllers/efatura.controller.ts`
- `packages/server/src/apps/invoices/controllers/settings.controller.ts`
- `packages/server/src/apps/invoices/controllers/portal.controller.ts`
- `packages/server/src/apps/invoices/services/invoice.service.ts`
- `packages/server/src/apps/invoices/services/line-item.service.ts`
- `packages/server/src/apps/invoices/services/settings.service.ts`
- `packages/server/src/apps/invoices/services/efatura.service.ts`
- `packages/client/src/apps/invoices/manifest.ts`
- `packages/client/src/apps/invoices/page.tsx`
- `packages/client/src/apps/invoices/hooks.ts`
- `packages/client/src/apps/invoices/components/invoices-sidebar.tsx`
- `packages/client/src/apps/invoices/components/invoices-list-view.tsx`
- `packages/client/src/apps/invoices/components/invoice-detail-panel.tsx`
- `packages/client/src/apps/invoices/components/invoice-settings-panel.tsx`
- `packages/client/src/components/shared/line-items-editor.tsx`
- `packages/client/src/components/shared/totals-block.tsx`
- `packages/client/src/components/shared/status-timeline.tsx`
- `packages/client/src/components/shared/invoice-builder-modal.tsx`
- `packages/client/src/components/shared/linked-invoices-list.tsx`
- `packages/server/src/apps/crm/services/proposal.service.ts`
- `packages/server/src/apps/crm/controllers/proposal.controller.ts`
- `packages/client/src/apps/crm/components/proposals-list-view.tsx`
- `packages/client/src/apps/crm/components/proposal-editor.tsx`
- `packages/client/src/apps/crm/components/proposal-detail-panel.tsx`
- `packages/client/src/apps/crm/components/proposal-public-page.tsx`

### Modified files
- `packages/server/src/db/schema.ts`
- `packages/server/src/db/migrate.ts`
- `packages/shared/src/types/index.ts`
- `packages/shared/src/types/crm.ts`
- `packages/shared/src/types/projects.ts`
- `packages/client/src/config/query-keys.ts`
- `packages/client/src/apps/index.ts`
- `packages/server/src/apps/index.ts`
- `packages/server/src/apps/projects/routes.ts`
- `packages/server/src/apps/projects/manifest.ts`
- `packages/server/src/apps/projects/controller.ts`
- `packages/server/src/apps/projects/services/*.ts` (multiple)
- `packages/client/src/apps/projects/hooks.ts`
- `packages/client/src/apps/projects/page.tsx`
- `packages/client/src/apps/projects/manifest.ts`
- `packages/server/src/apps/crm/routes.ts`
- `packages/server/src/apps/crm/service.ts`
- `packages/server/src/apps/crm/controller.ts`
- `packages/client/src/apps/crm/hooks.ts`
- `packages/client/src/apps/crm/components/crm-sidebar.tsx`
- `packages/client/src/apps/crm/components/deal-detail-page.tsx`
- `packages/client/src/apps/crm/page.tsx`
- `packages/client/src/i18n/locales/*.json` (5 files)
- `packages/client/src/App.tsx` (root router)

### Deleted files
- `packages/server/src/apps/projects/services/client.service.ts`
- `packages/server/src/apps/projects/controllers/client.controller.ts`
- `packages/client/src/apps/projects/components/invoice-builder.tsx`
- `packages/client/src/apps/projects/components/views/invoices-list-view.tsx`
- `packages/client/src/apps/projects/components/views/invoice-detail-panel.tsx`
- `packages/client/src/apps/projects/components/views/clients-list-view.tsx` (if exists)
- `packages/client/src/apps/projects/components/views/client-detail-panel.tsx` (if exists)
