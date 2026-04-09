# Unified Invoicing & Proposals System — Design Spec

**Date:** 2026-04-09
**Status:** Draft

---

## 1. Core Principle

CRM owns all client data. `crmContacts` and `crmCompanies` are the single source of truth for customer information across Atlas. Invoices is a standalone app for billing. Proposals live inside CRM as part of the deal lifecycle. Projects consumes CRM data and writes to the shared Invoices tables for time-entry billing.

CRM, Invoices, and Projects are core apps that cannot be disabled.

---

## 2. Architecture

```
CRM (core, non-disableable)
├── Contacts & Companies (+ billing fields)
├── Deals & Pipeline
├── Proposals (new) — standalone or deal-linked
└── Leads, Activities, Notes, etc.

Invoices (new standalone app, non-disableable)
├── invoices & invoiceLineItems tables
├── Invoice settings & numbering (single global sequence per tenant)
├── Portal tokens (on crmCompanies)
├── e-Fatura support (carried over from Projects)
└── Single tenant-level default currency, per-invoice override

Projects (core, non-disableable, depends on CRM + Invoices)
├── Projects, Tasks, Time Entries (unchanged)
├── References crmCompanies instead of projectClients
└── "Populate from time entries" writes to shared Invoices tables
```

---

## 3. Schema Changes

### 3.1 Drop `projectClients`

Drop entirely. All references migrate to `crmCompanies`.

### 3.2 Add billing fields to `crmCompanies`

New columns (all nullable except currency):

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `taxId` | text | null | Tax identification number |
| `taxOffice` | text | null | Tax office name |
| `currency` | text | `'USD'` | Default currency for this company |
| `postalCode` | text | null | |
| `state` | text | null | |
| `country` | text | null | |
| `logo` | text | null | URL/path to company logo |
| `portalToken` | uuid | null | Unique, for client portal access |

### 3.3 New `invoices` table (replaces `projectInvoices`)

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK, defaultRandom |
| `tenantId` | uuid | FK → tenants, NOT NULL |
| `userId` | uuid | FK → users, NOT NULL (creator) |
| `companyId` | uuid | FK → crmCompanies, NOT NULL |
| `contactId` | uuid | FK → crmContacts, nullable (billing contact) |
| `dealId` | uuid | FK → crmDeals, nullable |
| `proposalId` | uuid | FK → crmProposals, nullable |
| `invoiceNumber` | text | NOT NULL, unique per tenant |
| `status` | text | NOT NULL, default `'draft'`. Values: draft, sent, viewed, paid, overdue, waived |
| `currency` | text | NOT NULL, default `'USD'` |
| `subtotal` | real | NOT NULL, default 0 |
| `taxPercent` | real | NOT NULL, default 0 |
| `taxAmount` | real | NOT NULL, default 0 |
| `discountPercent` | real | NOT NULL, default 0 |
| `discountAmount` | real | NOT NULL, default 0 |
| `total` | real | NOT NULL, default 0 |
| `notes` | text | nullable |
| `issueDate` | date | NOT NULL |
| `dueDate` | date | NOT NULL |
| `sentAt` | timestamp | nullable |
| `viewedAt` | timestamp | nullable |
| `paidAt` | timestamp | nullable |
| `eFaturaType` | text | nullable |
| `eFaturaUuid` | text | nullable |
| `eFaturaStatus` | text | nullable |
| `eFaturaXml` | text | nullable |
| `isArchived` | boolean | NOT NULL, default false |
| `createdAt` | timestamp | NOT NULL, defaultNow |
| `updatedAt` | timestamp | NOT NULL, defaultNow |

Indexes: `tenantId`, `companyId`, `status`, unique on `(tenantId, invoiceNumber)`.

### 3.4 New `invoiceLineItems` table (replaces `projectInvoiceLineItems`)

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK, defaultRandom |
| `invoiceId` | uuid | FK → invoices, NOT NULL, cascade delete |
| `timeEntryId` | uuid | FK → projectTimeEntries, nullable, set null on delete |
| `description` | text | NOT NULL |
| `quantity` | real | NOT NULL, default 1 |
| `unitPrice` | real | NOT NULL, default 0 |
| `amount` | real | NOT NULL, default 0 |
| `taxRate` | real | NOT NULL, default 20 |
| `sortOrder` | integer | NOT NULL, default 0 |
| `createdAt` | timestamp | NOT NULL, defaultNow |

### 3.5 New `invoiceSettings` table (replaces invoice portion of `projectSettings`)

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK, defaultRandom |
| `tenantId` | uuid | FK → tenants, NOT NULL, unique |
| `invoicePrefix` | text | NOT NULL, default `'INV'` |
| `nextInvoiceNumber` | integer | NOT NULL, default 1 |
| `defaultCurrency` | text | NOT NULL, default `'USD'` |
| `defaultTaxRate` | real | NOT NULL, default 0 |
| `eFaturaEnabled` | boolean | NOT NULL, default false |
| `eFaturaCompanyName` | text | nullable |
| `eFaturaCompanyTaxId` | text | nullable |
| `eFaturaCompanyTaxOffice` | text | nullable |
| `eFaturaCompanyAddress` | text | nullable |
| `eFaturaCompanyCity` | text | nullable |
| `eFaturaCompanyCountry` | text | nullable |
| `eFaturaCompanyPhone` | text | nullable |
| `eFaturaCompanyEmail` | text | nullable |
| `createdAt` | timestamp | NOT NULL, defaultNow |
| `updatedAt` | timestamp | NOT NULL, defaultNow |

### 3.6 New `crmProposals` table

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK, defaultRandom |
| `tenantId` | uuid | FK → tenants, NOT NULL |
| `userId` | uuid | FK → users, NOT NULL (creator) |
| `dealId` | uuid | FK → crmDeals, nullable |
| `contactId` | uuid | FK → crmContacts, nullable |
| `companyId` | uuid | FK → crmCompanies, nullable |
| `title` | text | NOT NULL |
| `status` | text | NOT NULL, default `'draft'`. Values: draft, sent, viewed, accepted, declined, expired |
| `content` | jsonb | nullable. TipTap rich text for scope/terms |
| `lineItems` | jsonb | NOT NULL, default `'[]'`. Array of `{description, quantity, unitPrice, taxRate}` |
| `subtotal` | real | NOT NULL, default 0 |
| `taxPercent` | real | NOT NULL, default 0 |
| `taxAmount` | real | NOT NULL, default 0 |
| `discountPercent` | real | NOT NULL, default 0 |
| `discountAmount` | real | NOT NULL, default 0 |
| `total` | real | NOT NULL, default 0 |
| `currency` | text | NOT NULL, default `'USD'` |
| `validUntil` | date | nullable |
| `publicToken` | uuid | NOT NULL, unique, defaultRandom |
| `sentAt` | timestamp | nullable |
| `viewedAt` | timestamp | nullable |
| `acceptedAt` | timestamp | nullable |
| `declinedAt` | timestamp | nullable |
| `notes` | text | nullable (internal notes, not shown to client) |
| `isArchived` | boolean | NOT NULL, default false |
| `createdAt` | timestamp | NOT NULL, defaultNow |
| `updatedAt` | timestamp | NOT NULL, defaultNow |

Indexes: `tenantId`, `dealId`, `companyId`, `status`, unique on `publicToken`.

### 3.7 Modify `projectProjects`

Replace `clientId` (FK → projectClients) with `companyId` (FK → crmCompanies).

### 3.8 Modify `projectTimeEntries`

The `invoiceLineItemId` FK changes from `projectInvoiceLineItems` to `invoiceLineItems`.

### 3.9 Drop tables

- `projectClients` — dropped entirely
- `projectInvoices` — replaced by `invoices`
- `projectInvoiceLineItems` — replaced by `invoiceLineItems`
- Invoice-related columns removed from `projectSettings` (`invoicePrefix`, `nextInvoiceNumber`, e-Fatura fields)
- `defaultHourlyRate` stays in `projectSettings` — it's a project billing setting used by `populateFromTimeEntries` as a fallback rate

### 3.10 Cross-app schema dependency note

`invoiceLineItems.timeEntryId` has a FK to `projectTimeEntries`. This creates a schema-level dependency from Invoices → Projects. Acceptable because both are non-disableable core apps, but worth noting: the Invoices table definition must be ordered after Projects tables in `schema.ts`.

---

## 4. Invoices App

### 4.1 App manifest

| Field | Value |
|-------|-------|
| id | `invoices` |
| name | `Invoices` |
| labelKey | `sidebar.invoices` |
| icon | `Receipt` (lucide) |
| color | `#0ea5e9` |
| sidebarOrder | 35 |
| canDisable | false |
| routes | `/invoices` |

### 4.2 Server structure

```
packages/server/src/apps/invoices/
├── manifest.ts
├── routes.ts
├── controller.ts
├── services/
│   ├── invoice.service.ts      — CRUD, send, paid, waive, duplicate
│   ├── line-item.service.ts    — CRUD for line items
│   └── efatura.service.ts      — e-Fatura XML/PDF generation
```

### 4.3 API routes

All under `/api/invoices`, auth required:

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/list` | List invoices (filters: companyId, dealId, status, search, includeArchived) |
| GET | `/next-number` | Get next auto-generated invoice number |
| POST | `/` | Create invoice |
| GET | `/:id` | Get invoice + line items |
| PATCH | `/:id` | Update invoice |
| DELETE | `/:id` | Soft-delete |
| POST | `/:id/send` | Mark as sent |
| POST | `/:id/paid` | Mark as paid |
| POST | `/:id/waive` | Mark as waived |
| POST | `/:id/duplicate` | Clone as new draft |
| POST | `/:id/line-items` | Create line item |
| PATCH | `/:id/line-items/:itemId` | Update line item |
| DELETE | `/:id/line-items/:itemId` | Delete line item |
| POST | `/:id/efatura/generate` | Generate e-Fatura XML |
| GET | `/:id/efatura/xml` | Download e-Fatura XML |
| GET | `/:id/efatura/preview` | HTML preview |
| GET | `/:id/efatura/pdf` | PDF download |
| GET | `/settings` | Get invoice settings |
| PATCH | `/settings` | Update invoice settings |

Public routes (no auth):

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/portal/:token/list` | List invoices for a company by portal token |
| GET | `/portal/:token/:invoiceId` | View single invoice by portal token |

### 4.4 Client structure

```
packages/client/src/apps/invoices/
├── manifest.ts
├── page.tsx              — Main page with sidebar + content
├── hooks.ts              — React Query hooks
├── settings-store.ts
├── components/
│   ├── invoices-sidebar.tsx
│   ├── invoices-list-view.tsx
│   ├── invoice-detail-panel.tsx
│   └── invoice-settings-panel.tsx
```

### 4.5 Sidebar sections

- All invoices (default view)
- Draft
- Sent
- Overdue
- Paid
- Waived

### 4.6 List view

Table columns: invoice number, company name, amount, status badge, issue date, due date, source (deal/project icon if linked).

Features: search, filter by status, running total in footer.

### 4.7 Detail panel

- Status timeline (draft → sent → viewed → paid) with timestamps
- Company info block (name, address, tax ID)
- Line items table (description, qty, unit price, amount)
- Totals block (subtotal, tax, discount, total)
- Source links: "From deal: {deal title}" / "From proposal: {proposal title}" (clickable, navigates to CRM)
- Actions: Send, Mark Paid, Waive, Duplicate, Edit, Delete
- e-Fatura section (when enabled): status, UUID, XML/PDF download

---

## 5. Proposals (inside CRM)

### 5.1 Server additions to CRM routes

All under `/api/crm`, auth required:

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/proposals/list` | List proposals (filters: dealId, companyId, status, search) |
| POST | `/proposals` | Create proposal |
| GET | `/proposals/:id` | Get proposal |
| PATCH | `/proposals/:id` | Update proposal |
| DELETE | `/proposals/:id` | Soft-delete |
| POST | `/proposals/:id/send` | Mark as sent, records sentAt |
| POST | `/proposals/:id/duplicate` | Clone as new draft |

Public routes (no auth):

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/proposals/public/:token` | View proposal by public token |
| POST | `/proposals/public/:token/accept` | Accept proposal |
| POST | `/proposals/public/:token/decline` | Decline proposal |

### 5.2 Accept flow

When a client accepts a proposal via the public page:

1. Proposal status → `accepted`, `acceptedAt` set
2. If proposal has line items → create a draft invoice in the `invoices` table with `proposalId` set, line items copied over
3. If proposal is linked to a deal → optionally advance deal stage (configurable, not automatic in v1 — just leave the deal as-is)
4. Client sees: "Thank you — your proposal has been accepted" confirmation page with a summary (title, total)

### 5.3 Client components

```
packages/client/src/apps/crm/components/
├── proposals-list-view.tsx       — table view of all proposals
├── proposal-editor.tsx           — full editor (rich text + line items)
├── proposal-detail-panel.tsx     — read-only detail view
└── proposal-public-page.tsx      — public acceptance page
```

### 5.4 CRM sidebar addition

New sidebar item: "Proposals" (icon: `FileText` or `FileSignature`), placed after "Deals".

### 5.5 Deal detail page addition

New "Proposals" section on the deal detail page:
- Compact list of proposals linked to this deal (title, status badge, total, date)
- "Create proposal" button → opens proposal editor with deal data pre-filled (company, contact, deal title as proposal title)

### 5.6 Proposal editor

Full-page or large modal with two main sections:

**Header:** title, company selector (from crmCompanies), contact selector (from crmContacts), valid-until date, currency

**Body — two sections:**
1. **Scope / Terms** — embedded TipTap rich text editor (reuse `@tiptap/react` already in the project from Write app). For describing the work, deliverables, terms and conditions.
2. **Pricing** — `<LineItemsEditor>` shared component. Add/remove line items with description, quantity, unit price, tax rate. Totals block below.

**Footer:** Save Draft, Send (generates public link, copies to clipboard)

### 5.7 Public proposal page

Route: `/proposal/:token` (explicit, consistent with Sign app's `/sign/:token` pattern)

Layout:
- Company logo (if set on crmCompanies)
- Proposal title
- Scope/terms rendered as read-only HTML
- Line items table (read-only)
- Totals block
- Valid-until date
- "Accept" button (green) / "Decline" button (ghost)
- After accept: confirmation message with summary
- After decline: confirmation message

---

## 6. Shared Components

Extracted to `packages/client/src/components/shared/`:

### 6.1 `LineItemsEditor`

Reusable line items table component.

**Props:**
- `items: LineItem[]`
- `onChange: (items: LineItem[]) => void`
- `readOnly?: boolean`
- `currency?: string`

**LineItem shape:** `{ id: string, description: string, quantity: number, unitPrice: number, taxRate: number }`

Features: add row, remove row, inline editing, quantity × unitPrice calculation, drag-to-reorder.

Used by: invoice builder modal, proposal editor.

### 6.2 `TotalsBlock`

Displays subtotal, tax %, tax amount, discount %, discount amount, total.

**Props:**
- `subtotal: number`
- `taxPercent: number`
- `discountPercent: number`
- `currency?: string`
- `editable?: boolean` (when true, tax% and discount% are inputs)
- `onTaxChange?: (val: number) => void`
- `onDiscountChange?: (val: number) => void`

Used by: invoice builder modal, invoice detail panel, proposal editor, public proposal page.

### 6.3 `StatusTimeline`

Step indicator showing progression through statuses.

**Props:**
- `steps: { label: string, timestamp?: string }[]`
- `currentIndex: number`

Used by: invoice detail panel, proposal detail panel.

### 6.4 `InvoiceBuilderModal`

The full invoice creation/editing modal. Shared component so it can be opened from CRM, Projects, or the Invoices app.

**Props:**
- `open: boolean`
- `onClose: () => void`
- `onCreated?: (invoice: Invoice) => void`
- `prefill?: { companyId?, contactId?, dealId?, proposalId?, lineItems?, currency? }`

Features: company selector (searches crmCompanies), contact selector, dates, line items editor, tax/discount, notes, e-Fatura type (when enabled), Save Draft / Send buttons.

Used by: CRM deal page ("Create invoice"), Projects page ("Bill time entries"), Invoices app ("New invoice").

### 6.5 `LinkedInvoicesList`

Compact read-only list of invoices for embedding in other apps.

**Props:**
- `companyId?: string`
- `dealId?: string`
- `proposalId?: string`
- `limit?: number` (default 5)
- `showCreateButton?: boolean`
- `onCreateClick?: () => void`

Displays: invoice number, amount, status badge, issue date. Clicking a row navigates to `/invoices?id={invoiceId}`.

Used by: CRM deal detail page, CRM company detail page, Projects project page.

---

## 7. Projects App Changes

### 7.1 Replace `projectClients` with `crmCompanies`

- `projectProjects.clientId` → `projectProjects.companyId` (FK → crmCompanies)
- All client selectors in Projects UI now search `crmCompanies` via CRM API (or a shared endpoint)
- Client display on project pages reads from `crmCompanies` join

### 7.2 Invoicing changes

- Drop `projectInvoices`, `projectInvoiceLineItems` tables
- Remove invoice CRUD routes from Projects
- Remove `invoice-builder.tsx`, `invoice-detail-panel.tsx`, `invoices-list-view.tsx` from Projects components
- Remove invoice-related settings from `projectSettings`

### 7.3 Time-entry billing

`populateFromTimeEntries` stays in Projects service layer but writes to the shared `invoices` + `invoiceLineItems` tables.

The Projects UI "Bill time entries" button:
1. Projects calls its own service to compute line items from unbilled time entries (traversing projectProjects → projectTimeEntries → projectMembers for hourly rates)
2. Opens `<InvoiceBuilderModal>` with `prefill.lineItems` set to the computed items and `prefill.companyId` set from the project
3. The modal creates the invoice via the Invoices app API, passing `timeEntryIds` in the create request
4. The Invoices API create endpoint accepts an optional `timeEntryIds: string[]` param — when present, it marks those time entries as `billed=true, locked=true` in the **same database transaction** as the invoice insert, preventing inconsistency if either operation fails

### 7.4 Inline invoices section

Projects project page gets a `<LinkedInvoicesList companyId={project.companyId}>` section showing invoices for this company.

---

## 8. Non-Disableable Apps

CRM, Invoices, and Projects manifests set `canDisable: false` (or equivalent). The tenant apps toggle UI hides or grays out these apps.

---

## 9. Shared Types

Add to `packages/shared/src/types/`:

### `invoices.ts` (new file)

```typescript
export type InvoiceStatus = 'draft' | 'sent' | 'viewed' | 'paid' | 'overdue' | 'waived';

export interface Invoice { ... }
export interface InvoiceLineItem { ... }
export interface CreateInvoiceInput { ... }
export interface UpdateInvoiceInput { ... }
export interface InvoiceSettings { ... }
```

### `proposals.ts` (new file, or added to `crm.ts`)

```typescript
export type ProposalStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'declined' | 'expired';

export interface Proposal { ... }
export interface CreateProposalInput { ... }
export interface UpdateProposalInput { ... }
export interface ProposalLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
}
```

---

## 10. Translations

New keys required in all 5 locale files (EN, TR, DE, FR, IT):

- `sidebar.invoices` — "Invoices"
- `invoices.*` — all invoice UI strings (list headers, statuses, builder labels, settings)
- `crm.proposals.*` — all proposal UI strings (list, editor, detail, public page)
- `crm.deal.proposals` — "Proposals" section on deal page
- `crm.deal.invoices` — "Invoices" section on deal page

---

## 11. Query Keys

Add to `packages/client/src/config/query-keys.ts`:

```typescript
invoices: {
  all: ['invoices'],
  list: ['invoices', 'list'],
  detail: (id: string) => ['invoices', id],
  settings: ['invoices', 'settings'],
  nextNumber: ['invoices', 'next-number'],
},
// Add to existing crm namespace:
crm: {
  ...existing,
  proposals: {
    all: ['crm', 'proposals'],
    list: ['crm', 'proposals', 'list'],
    detail: (id: string) => ['crm', 'proposals', id],
  },
},
```

---

## 12. Migration Path

Since this is not a live project, the migration is destructive:

1. Drop `projectClients`, `projectInvoices`, `projectInvoiceLineItems` tables
2. Remove invoice columns from `projectSettings`
3. Add billing columns to `crmCompanies`
4. Create `invoices`, `invoiceLineItems`, `invoiceSettings`, `crmProposals` tables
5. Change `projectProjects.clientId` → `projectProjects.companyId`
6. Update `projectTimeEntries.invoiceLineItemId` FK target

All in `migrate.ts` as `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE ADD COLUMN IF NOT EXISTS`.

---

## 13. Out of Scope (Future)

- Payment gateway integration (Stripe, etc.)
- Automated overdue detection cron job
- Standard invoice PDF generation (non-e-Fatura)
- Sign app integration on proposals (require e-signature to accept)
- Deal stage auto-advance on proposal acceptance
- Email notification when proposal is accepted/declined
- Recurring invoices
- Multi-currency support beyond per-invoice override
