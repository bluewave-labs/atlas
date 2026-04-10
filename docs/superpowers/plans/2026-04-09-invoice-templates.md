# Invoice Template System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the manual pdf-lib invoice PDF with a template system using `@react-pdf/renderer`. Three starting templates (Classic, Modern, Compact) with tenant-configurable branding (logo, color, payment info). Server renders PDFs, client displays via iframe.

**Architecture:** Templates are React components on the server accepting standardized `InvoiceTemplateProps`. The registry maps templateId → component. The PDF endpoint fetches invoice data + tenant branding, resolves the template, and renders to PDF bytes via `renderToBuffer()`. The client preview loads the PDF in an iframe. Adding a new template = one new file + one registry entry.

**Tech Stack:** `@react-pdf/renderer` + React on server for PDF generation. Existing Express + Drizzle for API. Existing React client for settings UI.

**Spec:** `docs/superpowers/specs/2026-04-09-invoice-templates-design.md`

---

## Phase 1: Foundation — Dependencies, Schema, Types

### Task 1: Install dependencies and configure server for JSX

**Files:**
- Modify: `packages/server/package.json`
- Modify: `packages/server/tsconfig.json`

- [ ] **Step 1: Install @react-pdf/renderer and react on server**

```bash
cd /Users/gorkemcetin/atlasmail/packages/server
npm install @react-pdf/renderer react react-dom
```

Note: `@react-pdf/renderer` requires `react` as a peer dependency.

- [ ] **Step 2: Enable JSX in server tsconfig**

In `packages/server/tsconfig.json`, add `"jsx": "react-jsx"` to the `compilerOptions`:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    ...existing options...
  }
}
```

- [ ] **Step 3: Verify server still compiles**

```bash
cd /Users/gorkemcetin/atlasmail/packages/server && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add packages/server/package.json packages/server/package-lock.json packages/server/tsconfig.json
git commit -m "chore: install @react-pdf/renderer and enable JSX on server"
```

---

### Task 2: Add branding fields to invoiceSettings schema

**Files:**
- Modify: `packages/server/src/db/schema.ts` (invoiceSettings table at ~line 1905)
- Modify: `packages/server/src/db/migrate.ts`

- [ ] **Step 1: Add columns to invoiceSettings in schema.ts**

After the existing `eFaturaCompanyEmail` field and before `createdAt`, add:

```typescript
  // Invoice template branding (separate from e-Fatura)
  templateId: varchar('template_id', { length: 50 }).notNull().default('classic'),
  logoPath: text('logo_path'),
  accentColor: varchar('accent_color', { length: 20 }).notNull().default('#13715B'),
  companyName: varchar('company_name', { length: 255 }),
  companyAddress: text('company_address'),
  companyCity: varchar('company_city', { length: 100 }),
  companyCountry: varchar('company_country', { length: 100 }),
  companyPhone: varchar('company_phone', { length: 50 }),
  companyEmail: varchar('company_email', { length: 255 }),
  companyWebsite: varchar('company_website', { length: 255 }),
  companyTaxId: varchar('company_tax_id', { length: 50 }),
  paymentInstructions: text('payment_instructions'),
  bankDetails: text('bank_details'),
  footerText: text('footer_text'),
```

- [ ] **Step 2: Add migration statements**

In `packages/server/src/db/migrate.ts`, add ALTER TABLE statements:

```sql
ALTER TABLE invoice_settings ADD COLUMN IF NOT EXISTS template_id VARCHAR(50) NOT NULL DEFAULT 'classic';
ALTER TABLE invoice_settings ADD COLUMN IF NOT EXISTS logo_path TEXT;
ALTER TABLE invoice_settings ADD COLUMN IF NOT EXISTS accent_color VARCHAR(20) NOT NULL DEFAULT '#13715B';
ALTER TABLE invoice_settings ADD COLUMN IF NOT EXISTS company_name VARCHAR(255);
ALTER TABLE invoice_settings ADD COLUMN IF NOT EXISTS company_address TEXT;
ALTER TABLE invoice_settings ADD COLUMN IF NOT EXISTS company_city VARCHAR(100);
ALTER TABLE invoice_settings ADD COLUMN IF NOT EXISTS company_country VARCHAR(100);
ALTER TABLE invoice_settings ADD COLUMN IF NOT EXISTS company_phone VARCHAR(50);
ALTER TABLE invoice_settings ADD COLUMN IF NOT EXISTS company_email VARCHAR(255);
ALTER TABLE invoice_settings ADD COLUMN IF NOT EXISTS company_website VARCHAR(255);
ALTER TABLE invoice_settings ADD COLUMN IF NOT EXISTS company_tax_id VARCHAR(50);
ALTER TABLE invoice_settings ADD COLUMN IF NOT EXISTS payment_instructions TEXT;
ALTER TABLE invoice_settings ADD COLUMN IF NOT EXISTS bank_details TEXT;
ALTER TABLE invoice_settings ADD COLUMN IF NOT EXISTS footer_text TEXT;
```

- [ ] **Step 3: Commit**

```bash
git add packages/server/src/db/schema.ts packages/server/src/db/migrate.ts
git commit -m "feat: add branding fields to invoiceSettings schema"
```

---

### Task 3: Update shared types

**Files:**
- Modify: `packages/shared/src/types/invoices.ts`

- [ ] **Step 1: Add new fields to InvoiceSettings interface**

In the `InvoiceSettings` interface (around line 95), add after the existing eFatura fields:

```typescript
  // Template branding
  templateId: string;
  logoPath?: string | null;
  accentColor: string;
  companyName?: string | null;
  companyAddress?: string | null;
  companyCity?: string | null;
  companyCountry?: string | null;
  companyPhone?: string | null;
  companyEmail?: string | null;
  companyWebsite?: string | null;
  companyTaxId?: string | null;
  paymentInstructions?: string | null;
  bankDetails?: string | null;
  footerText?: string | null;
```

- [ ] **Step 2: Add to UpdateInvoiceSettingsInput**

```typescript
  templateId?: string;
  logoPath?: string | null;
  accentColor?: string;
  companyName?: string | null;
  companyAddress?: string | null;
  companyCity?: string | null;
  companyCountry?: string | null;
  companyPhone?: string | null;
  companyEmail?: string | null;
  companyWebsite?: string | null;
  companyTaxId?: string | null;
  paymentInstructions?: string | null;
  bankDetails?: string | null;
  footerText?: string | null;
```

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/types/invoices.ts
git commit -m "feat: add template branding fields to shared InvoiceSettings type"
```

---

## Phase 2: Template Components

### Task 4: Create template types and registry

**Files:**
- Create: `packages/server/src/apps/invoices/templates/types.ts`
- Create: `packages/server/src/apps/invoices/templates/index.ts`

- [ ] **Step 1: Create types.ts**

```typescript
export interface InvoiceTemplateProps {
  invoice: {
    invoiceNumber: string;
    status: string;
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
  };

  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
    taxRate: number;
  }>;

  branding: {
    logoBase64?: string;
    accentColor: string;
    companyName?: string;
    companyAddress?: string;
    companyCity?: string;
    companyCountry?: string;
    companyPhone?: string;
    companyEmail?: string;
    companyWebsite?: string;
    companyTaxId?: string;
    paymentInstructions?: string;
    bankDetails?: string;
    footerText?: string;
  };

  client: {
    name: string;
    address?: string;
    postalCode?: string;
    city?: string;
    state?: string;
    country?: string;
    taxId?: string;
    contactName?: string;
    contactEmail?: string;
  };
}
```

- [ ] **Step 2: Create index.ts (registry)**

```typescript
import type { InvoiceTemplateProps } from './types';

// Templates will be registered here as they are created
const templateRegistry: Record<string, React.ComponentType<InvoiceTemplateProps>> = {};

export function registerTemplate(id: string, component: React.ComponentType<InvoiceTemplateProps>) {
  templateRegistry[id] = component;
}

export function getTemplate(templateId: string): React.ComponentType<InvoiceTemplateProps> {
  return templateRegistry[templateId] || templateRegistry.classic;
}

export function getAvailableTemplates(): Array<{ id: string; name: string }> {
  return Object.keys(templateRegistry).map(id => ({ id, name: id.charAt(0).toUpperCase() + id.slice(1) }));
}

export type { InvoiceTemplateProps };
```

- [ ] **Step 3: Commit**

```bash
git add packages/server/src/apps/invoices/templates/
git commit -m "feat: create invoice template types and registry"
```

---

### Task 5: Create Classic template

**Files:**
- Create: `packages/server/src/apps/invoices/templates/classic.tsx`
- Modify: `packages/server/src/apps/invoices/templates/index.ts`

- [ ] **Step 1: Create classic.tsx**

A `@react-pdf/renderer` React component. Use:
```typescript
import React from 'react';
import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import type { InvoiceTemplateProps } from './types';
```

Layout (A4):
- **Header:** Logo image (left, if logoBase64 exists) OR company name text. "INVOICE" title on right.
- **Company info block:** Address, city/country, phone, email, website, tax ID — below the logo/name.
- **Divider:** Thin line in accentColor.
- **Two-column section:** Left = "Bill To" with client name (bold), address, city/state/country, tax ID, contact name/email. Right = Invoice #, Issue date, Due date, Status.
- **Line items table:** Header row with accentColor background (white text): Description, Qty, Unit Price, Amount. Data rows with alternating light gray background. Right-aligned numbers.
- **Totals:** Right-aligned block: Subtotal, Tax (if > 0), Discount (if > 0), Total (bold, larger font).
- **Payment info:** If paymentInstructions or bankDetails exist, show "Payment Information" section.
- **Notes:** If notes exist, show "Notes" section.
- **Footer:** footerText if set, or "Generated by Atlas" centered at bottom.

Use `StyleSheet.create({})` for all styles. Font sizes: 8pt body, 10pt headings, 18pt INVOICE title, 14pt company name. Colors: use `accentColor` from branding for headers and accents.

Format amounts: `(value).toFixed(2)` with currency symbol prefix. Format dates as readable strings.

- [ ] **Step 2: Register in index.ts**

```typescript
import { ClassicTemplate } from './classic';
registerTemplate('classic', ClassicTemplate);
```

Add this at the bottom of index.ts.

- [ ] **Step 3: Commit**

```bash
git add packages/server/src/apps/invoices/templates/
git commit -m "feat: create Classic invoice template"
```

---

### Task 6: Create Modern template

**Files:**
- Create: `packages/server/src/apps/invoices/templates/modern.tsx`
- Modify: `packages/server/src/apps/invoices/templates/index.ts`

- [ ] **Step 1: Create modern.tsx**

Same `InvoiceTemplateProps`, different layout:

- **Accent bar:** Full-width rectangle at top of page in accentColor (height ~60pt). Company name in white text inside the bar. Logo (small, ~30pt height) inside the bar on the left.
- **Below bar:** Two-column card-like sections with subtle gray background (#f9fafb). Left card = "Bill To" details. Right card = Invoice meta.
- **Line items table:** Header row with accentColor background. Clean borders between rows. No alternating backgrounds — use bottom borders instead.
- **Totals:** Right-aligned, accent color on the total amount text.
- **Payment/Notes/Footer:** Same content as Classic but with modern styling (more whitespace, subtle borders).

- [ ] **Step 2: Register**

```typescript
import { ModernTemplate } from './modern';
registerTemplate('modern', ModernTemplate);
```

- [ ] **Step 3: Commit**

```bash
git add packages/server/src/apps/invoices/templates/
git commit -m "feat: create Modern invoice template"
```

---

### Task 7: Create Compact template

**Files:**
- Create: `packages/server/src/apps/invoices/templates/compact.tsx`
- Modify: `packages/server/src/apps/invoices/templates/index.ts`

- [ ] **Step 1: Create compact.tsx**

Dense layout:

- **Header row:** Logo (small) + company name on left, "INVOICE" + invoice # on right. All in one horizontal row.
- **Info row:** Company details and bill-to in a single row (3 columns: company info, bill-to, invoice meta). Smaller fonts (7-8pt).
- **Line items table:** Tight spacing (2pt row padding). Smaller fonts. No alternating backgrounds. Thin 0.5pt borders.
- **Totals:** Compact, right-aligned, minimal spacing.
- **Payment/Notes:** Only shown if data exists. Compact.
- **No footer decoration** — just footerText if set.

- [ ] **Step 2: Register**

```typescript
import { CompactTemplate } from './compact';
registerTemplate('compact', CompactTemplate);
```

- [ ] **Step 3: Commit**

```bash
git add packages/server/src/apps/invoices/templates/
git commit -m "feat: create Compact invoice template"
```

---

## Phase 3: Server PDF Rendering

### Task 8: Rewrite pdf.service.ts to use template system

**Files:**
- Modify: `packages/server/src/apps/invoices/services/pdf.service.ts`

- [ ] **Step 1: Rewrite the file**

Replace the entire pdf-lib implementation with:

```typescript
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { db } from '../../../config/database';
import { invoices, invoiceLineItems, invoiceSettings, crmCompanies, crmContacts } from '../../../db/schema';
import { eq } from 'drizzle-orm';
import { getTemplate } from '../templates';
import type { InvoiceTemplateProps } from '../templates/types';
import { getInvoiceSettings } from './settings.service';
import { getInvoice } from './invoice.service';
import { logger } from '../../../utils/logger';
import * as fs from 'fs';
import * as path from 'path';

export async function generateInvoicePdf(tenantId: string, invoiceId: string, inline = false): Promise<Buffer> {
  // 1. Fetch invoice with line items
  const invoice = await getInvoice('system', tenantId, invoiceId);
  if (!invoice) throw new Error('Invoice not found');

  // 2. Fetch settings (branding + templateId)
  const settings = await getInvoiceSettings(tenantId);

  // 3. Fetch company (client) info
  const [company] = await db.select().from(crmCompanies).where(eq(crmCompanies.id, invoice.companyId));

  // 4. Fetch contact if set
  let contact: any = null;
  if (invoice.contactId) {
    const [c] = await db.select().from(crmContacts).where(eq(crmContacts.id, invoice.contactId));
    contact = c;
  }

  // 5. Read logo file if exists, convert to base64
  let logoBase64: string | undefined;
  if (settings?.logoPath) {
    try {
      const logoFullPath = path.resolve(settings.logoPath);
      const logoBuffer = fs.readFileSync(logoFullPath);
      const ext = path.extname(settings.logoPath).toLowerCase();
      const mime = ext === '.png' ? 'image/png' : ext === '.svg' ? 'image/svg+xml' : 'image/jpeg';
      logoBase64 = `data:${mime};base64,${logoBuffer.toString('base64')}`;
    } catch (err) {
      logger.warn({ err, logoPath: settings.logoPath }, 'Failed to read logo file');
    }
  }

  // 6. Build template props
  const templateProps: InvoiceTemplateProps = {
    invoice: {
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      currency: invoice.currency,
      subtotal: invoice.subtotal,
      taxPercent: invoice.taxPercent,
      taxAmount: invoice.taxAmount,
      discountPercent: invoice.discountPercent,
      discountAmount: invoice.discountAmount,
      total: invoice.total,
      notes: invoice.notes,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
    },
    lineItems: (invoice.lineItems || []).map((li: any) => ({
      description: li.description,
      quantity: li.quantity,
      unitPrice: li.unitPrice,
      amount: li.amount,
      taxRate: li.taxRate,
    })),
    branding: {
      logoBase64,
      accentColor: settings?.accentColor || '#13715B',
      companyName: settings?.companyName || undefined,
      companyAddress: settings?.companyAddress || undefined,
      companyCity: settings?.companyCity || undefined,
      companyCountry: settings?.companyCountry || undefined,
      companyPhone: settings?.companyPhone || undefined,
      companyEmail: settings?.companyEmail || undefined,
      companyWebsite: settings?.companyWebsite || undefined,
      companyTaxId: settings?.companyTaxId || undefined,
      paymentInstructions: settings?.paymentInstructions || undefined,
      bankDetails: settings?.bankDetails || undefined,
      footerText: settings?.footerText || undefined,
    },
    client: {
      name: company?.name || 'Unknown',
      address: company?.address || undefined,
      postalCode: company?.postalCode || undefined,
      city: company?.city || undefined,
      state: company?.state || undefined,
      country: company?.country || undefined,
      taxId: company?.taxId || undefined,
      contactName: contact?.name || invoice.contactName || undefined,
      contactEmail: contact?.email || invoice.contactEmail || undefined,
    },
  };

  // 7. Get template component
  const templateId = settings?.templateId || 'classic';
  const Template = getTemplate(templateId);

  // 8. Render to PDF buffer
  const pdfBuffer = await renderToBuffer(React.createElement(Template, templateProps));
  return Buffer.from(pdfBuffer);
}
```

- [ ] **Step 2: Update pdf.controller.ts for inline param**

In `packages/server/src/apps/invoices/controllers/pdf.controller.ts`, update the handler to check for `?inline=true`:

```typescript
const inline = req.query.inline === 'true';
res.setHeader('Content-Type', 'application/pdf');
res.setHeader('Content-Disposition', inline ? 'inline' : `attachment; filename="invoice-${id}.pdf"`);
```

- [ ] **Step 3: Verify server compiles**

```bash
cd /Users/gorkemcetin/atlasmail/packages/server && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/apps/invoices/
git commit -m "$(cat <<'EOF'
feat: rewrite PDF service to use @react-pdf/renderer template system

Replaces pdf-lib manual drawing with React component templates.
Reads tenant branding from invoiceSettings, resolves template from
registry, renders to PDF buffer via renderToBuffer().
EOF
)"
```

---

## Phase 4: Client Updates

### Task 9: Rewrite invoice preview to use iframe

**Files:**
- Modify: `packages/client/src/apps/invoices/components/invoice-preview.tsx`

- [ ] **Step 1: Rewrite the preview component**

Replace the entire HTML-based preview with an iframe that loads the PDF from the server:

```tsx
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Download, Printer } from 'lucide-react';
import { Button } from '../../../../components/ui/button';
import { Skeleton } from '../../../../components/ui/skeleton';
import { api } from '../../../../lib/api-client';

interface InvoicePreviewProps {
  invoiceId: string;
  onClose: () => void;
}

export function InvoicePreview({ invoiceId, onClose }: InvoicePreviewProps) {
  const { t } = useTranslation();
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let url: string | null = null;
    async function loadPdf() {
      try {
        const response = await api.get(`/invoices/${invoiceId}/pdf?inline=true`, { responseType: 'blob' });
        url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
        setPdfUrl(url);
      } catch (err) {
        console.error('Failed to load invoice PDF', err);
      } finally {
        setLoading(false);
      }
    }
    loadPdf();
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [invoiceId]);

  const handleDownload = async () => {
    try {
      const response = await api.get(`/invoices/${invoiceId}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `invoice-${invoiceId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download PDF', err);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', flexDirection: 'column', background: 'var(--color-bg-secondary)' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: 'var(--color-bg-primary)', borderBottom: '1px solid var(--color-border-primary)' }}>
        <Button variant="ghost" size="sm" icon={<ArrowLeft size={14} />} onClick={onClose}>
          {t('common.back')}
        </Button>
        <div style={{ flex: 1 }} />
        <Button variant="secondary" size="sm" icon={<Download size={14} />} onClick={handleDownload}>
          {t('invoices.downloadPdf')}
        </Button>
        <Button variant="secondary" size="sm" icon={<Printer size={14} />} onClick={() => {
          if (pdfUrl) {
            const printWindow = window.open(pdfUrl);
            printWindow?.addEventListener('load', () => printWindow.print());
          }
        }}>
          {t('invoices.print')}
        </Button>
      </div>

      {/* PDF viewer */}
      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Skeleton style={{ width: 600, height: 800 }} />
        </div>
      ) : pdfUrl ? (
        <iframe
          src={pdfUrl}
          style={{ flex: 1, border: 'none' }}
          title={t('invoices.invoicePreview')}
        />
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-tertiary)' }}>
          Failed to load invoice preview
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/client/src/apps/invoices/components/invoice-preview.tsx
git commit -m "feat: rewrite invoice preview to use iframe PDF viewer"
```

---

### Task 10: Expand invoice settings panel

**Files:**
- Modify: `packages/client/src/apps/invoices/components/invoice-settings-panel.tsx`

- [ ] **Step 1: Add template selector and branding fields**

Read the existing file. Add these new sections BEFORE the existing e-Fatura section:

**Template selector section:**
Three cards in a row, each showing template name and brief description. Active card has accent border. Click to select.

```tsx
// Template options
const templates = [
  { id: 'classic', name: t('invoices.settings.classic'), description: t('invoices.settings.classicDescription') },
  { id: 'modern', name: t('invoices.settings.modern'), description: t('invoices.settings.modernDescription') },
  { id: 'compact', name: t('invoices.settings.compact'), description: t('invoices.settings.compactDescription') },
];
```

**Logo upload section:**
File input that uploads via `api.post('/upload', formData)`. Show current logo preview if `settings.logoPath` exists. "Remove" button to clear.

**Accent color section:**
`<input type="color">` bound to `form.accentColor`.

**Company details section:**
Inputs for: companyName, companyAddress, companyCity, companyCountry, companyPhone, companyEmail, companyWebsite, companyTaxId.

**Payment section:**
Textareas for: paymentInstructions, bankDetails.

**Footer section:**
Textarea for: footerText.

All fields update the existing `form` state and are saved via the existing `useUpdateInvoiceSettings()` mutation.

- [ ] **Step 2: Commit**

```bash
git add packages/client/src/apps/invoices/components/invoice-settings-panel.tsx
git commit -m "feat: expand invoice settings with template selector, branding, and payment info"
```

---

### Task 11: Add translations

**Files:**
- Modify all 5 locale files

- [ ] **Step 1: Add template settings translations**

Add to `invoices.settings` in all 5 locale files:

```json
"template": "Invoice template",
"selectTemplate": "Select a template",
"classic": "Classic",
"classicDescription": "Clean and minimal",
"modern": "Modern",
"modernDescription": "Contemporary with accent bar",
"compact": "Compact",
"compactDescription": "Dense layout for many items",
"branding": "Branding",
"logo": "Company logo",
"uploadLogo": "Upload logo",
"removeLogo": "Remove logo",
"accentColor": "Accent color",
"companyDetails": "Company details",
"companyName": "Company name",
"companyAddress": "Address",
"companyCity": "City",
"companyCountry": "Country",
"companyPhone": "Phone",
"companyEmail": "Email",
"companyWebsite": "Website",
"companyTaxId": "Tax ID",
"paymentInfo": "Payment information",
"paymentInstructions": "Payment instructions",
"paymentInstructionsPlaceholder": "e.g. Payment due within 30 days",
"bankDetails": "Bank details",
"bankDetailsPlaceholder": "e.g. Bank name, IBAN, SWIFT",
"footer": "Footer",
"footerText": "Footer text",
"footerTextPlaceholder": "e.g. Thank you for your business!"
```

Translate for TR, DE, FR, IT.

- [ ] **Step 2: Commit**

```bash
git add packages/client/src/i18n/locales/
git commit -m "feat: add invoice template settings translations for all 5 locales"
```

---

## Phase 5: Build Verification

### Task 12: Full build verification

- [ ] **Step 1: Build shared**

```bash
cd /Users/gorkemcetin/atlasmail/packages/shared && npm run build
```

- [ ] **Step 2: Build server**

```bash
cd /Users/gorkemcetin/atlasmail/packages/server && npm run build
```

- [ ] **Step 3: Build client**

```bash
cd /Users/gorkemcetin/atlasmail/packages/client && npm run build
```

- [ ] **Step 4: Fix any errors and commit**

```bash
git add -A
git commit -m "fix: resolve build errors from invoice template system"
```

---

## Summary of files

### New files (create)
- `packages/server/src/apps/invoices/templates/types.ts`
- `packages/server/src/apps/invoices/templates/index.ts`
- `packages/server/src/apps/invoices/templates/classic.tsx`
- `packages/server/src/apps/invoices/templates/modern.tsx`
- `packages/server/src/apps/invoices/templates/compact.tsx`

### Modified files
- `packages/server/package.json` (add dependencies)
- `packages/server/tsconfig.json` (enable JSX)
- `packages/server/src/db/schema.ts` (invoiceSettings columns)
- `packages/server/src/db/migrate.ts` (ALTER TABLE)
- `packages/server/src/apps/invoices/services/pdf.service.ts` (full rewrite)
- `packages/server/src/apps/invoices/controllers/pdf.controller.ts` (inline param)
- `packages/shared/src/types/invoices.ts` (InvoiceSettings fields)
- `packages/client/src/apps/invoices/components/invoice-preview.tsx` (rewrite to iframe)
- `packages/client/src/apps/invoices/components/invoice-settings-panel.tsx` (expand)
- `packages/client/src/i18n/locales/{en,tr,de,fr,it}.json` (translations)
