import { z } from 'zod';
import { register, envelope, Uuid, IsoDateTime } from '../_helpers';

const TAG = 'Invoices';

const LineItem = z.object({
  id: Uuid,
  invoiceId: Uuid,
  timeEntryId: Uuid.nullable(),
  description: z.string(),
  quantity: z.number(),
  unitPrice: z.number(),
  amount: z.number(),
  taxRate: z.number(),
  sortOrder: z.number().int(),
  createdAt: IsoDateTime,
});

const Invoice = z.object({
  id: Uuid,
  tenantId: Uuid,
  userId: Uuid,
  companyId: Uuid,
  contactId: Uuid.nullable(),
  dealId: Uuid.nullable(),
  projectId: Uuid.nullable(),
  proposalId: Uuid.nullable(),
  invoiceNumber: z.string().openapi({ example: 'INV-2026-008' }),
  status: z.enum(['draft', 'unpaid', 'paid', 'overdue', 'waived']),
  currency: z.string(),
  subtotal: z.number(),
  taxPercent: z.number(),
  taxAmount: z.number(),
  discountPercent: z.number(),
  discountAmount: z.number(),
  total: z.number(),
  notes: z.string().nullable(),
  issueDate: IsoDateTime,
  dueDate: IsoDateTime,
  sentAt: IsoDateTime.nullable(),
  viewedAt: IsoDateTime.nullable(),
  paidAt: IsoDateTime.nullable(),
  lastEmailedAt: IsoDateTime.nullable(),
  emailSentCount: z.number().int(),
  lastReminderStage: z.number().int(),
  lastReminderAt: IsoDateTime.nullable(),
  excludeFromAutoReminders: z.boolean(),
  isArchived: z.boolean(),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
  lineItems: z.array(LineItem).optional(),
});

const Payment = z.object({
  id: Uuid,
  invoiceId: Uuid,
  type: z.enum(['payment', 'refund']),
  amount: z.number(),
  currency: z.string(),
  paymentDate: IsoDateTime,
  method: z.string().nullable(),
  reference: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: IsoDateTime,
});

const Recurring = z.object({
  id: Uuid,
  companyId: Uuid,
  name: z.string(),
  frequency: z.enum(['weekly', 'monthly', 'quarterly', 'yearly']),
  nextRunDate: IsoDateTime.nullable(),
  isPaused: z.boolean(),
  currency: z.string(),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});

// Settings
register({ method: 'get', path: '/invoices/settings', tags: [TAG], summary: 'Get invoice settings',
  response: envelope(z.record(z.string(), z.unknown())) });
register({ method: 'patch', path: '/invoices/settings', tags: [TAG], summary: 'Update invoice settings',
  body: z.record(z.string(), z.unknown()) });

// Dashboard
register({ method: 'get', path: '/invoices/dashboard', tags: [TAG], summary: 'Get invoices dashboard (receivables, aging, KPIs)',
  response: envelope(z.object({
    receivables: z.object({
      total: z.number(),
      current: z.number(),
      '1to15': z.number().optional(),
      '16to30': z.number().optional(),
      '31to45': z.number().optional(),
      over45: z.number().optional(),
    }).passthrough(),
    monthlyActivity: z.array(z.object({
      month: z.string(),
      invoiced: z.number(),
      received: z.number(),
    })),
    periodSummary: z.record(z.string(), z.unknown()),
  })) });

// List / create / get / update / delete
register({ method: 'get', path: '/invoices/list', tags: [TAG], summary: 'List invoices',
  query: z.object({
    status: Invoice.shape.status.optional(),
    companyId: Uuid.optional(),
    archived: z.coerce.boolean().optional(),
  }),
  response: envelope(z.object({ invoices: z.array(Invoice) })) });
register({ method: 'get', path: '/invoices/next-number', tags: [TAG], summary: 'Get the next invoice number for the tenant',
  response: envelope(z.object({ invoiceNumber: z.string() })) });
register({ method: 'post', path: '/invoices', tags: [TAG], summary: 'Create an invoice',
  body: z.object({
    companyId: Uuid,
    contactId: Uuid.optional(),
    dealId: Uuid.optional(),
    projectId: Uuid.optional(),
    currency: z.string().length(3),
    issueDate: IsoDateTime,
    dueDate: IsoDateTime,
    notes: z.string().optional(),
    lineItems: z.array(z.object({
      description: z.string(),
      quantity: z.number(),
      unitPrice: z.number(),
      taxRate: z.number().optional(),
    })),
  }),
  response: envelope(Invoice) });
register({ method: 'get', path: '/invoices/:id', tags: [TAG], summary: 'Get an invoice with line items and derived totals',
  params: z.object({ id: Uuid }),
  response: envelope(Invoice.extend({
    companyName: z.string(),
    contactName: z.string().nullable(),
    contactEmail: z.string().email().nullable(),
    dealTitle: z.string().nullable(),
    amountPaid: z.number(),
    balanceDue: z.number(),
    eFaturaType: z.string().nullable(),
    eFaturaUuid: z.string().nullable(),
    eFaturaStatus: z.string().nullable(),
    lineItems: z.array(LineItem),
  })) });
register({ method: 'patch', path: '/invoices/:id', tags: [TAG], summary: 'Update an invoice',
  params: z.object({ id: Uuid }), body: Invoice.partial(), concurrency: true, response: envelope(Invoice) });
register({ method: 'delete', path: '/invoices/:id', tags: [TAG], summary: 'Delete an invoice',
  params: z.object({ id: Uuid }) });

// PDF + email actions
register({ method: 'get', path: '/invoices/:id/pdf', tags: [TAG], summary: 'Download an invoice as PDF',
  params: z.object({ id: Uuid }),
  extraResponses: { 200: { description: 'PDF binary', schema: z.string().openapi({ format: 'binary' }) } } });
register({ method: 'post', path: '/invoices/:id/send', tags: [TAG], summary: 'Send a payment reminder email',
  params: z.object({ id: Uuid }), body: z.object({ message: z.string().optional() }) });
register({ method: 'post', path: '/invoices/:id/email', tags: [TAG], summary: 'Email an invoice to a custom recipient',
  params: z.object({ id: Uuid }),
  body: z.object({ to: z.string().email(), subject: z.string().optional(), message: z.string().optional() }) });
register({ method: 'post', path: '/invoices/:id/paid', tags: [TAG], summary: 'Mark an invoice as paid',
  params: z.object({ id: Uuid }), response: envelope(Invoice) });
register({ method: 'post', path: '/invoices/:id/waive', tags: [TAG], summary: 'Waive an invoice',
  params: z.object({ id: Uuid }), response: envelope(Invoice) });
register({ method: 'post', path: '/invoices/:id/duplicate', tags: [TAG], summary: 'Duplicate an invoice as a new draft',
  params: z.object({ id: Uuid }), response: envelope(Invoice) });

// Line items
const LineItemInput = z.object({
  description: z.string(),
  quantity: z.number(),
  unitPrice: z.number(),
  taxRate: z.number().optional(),
});
register({ method: 'get', path: '/invoices/:invoiceId/line-items', tags: [TAG], summary: 'List line items on an invoice',
  params: z.object({ invoiceId: Uuid }), response: envelope(z.array(LineItem)) });
register({ method: 'post', path: '/invoices/:invoiceId/line-items', tags: [TAG], summary: 'Add a line item to an invoice',
  params: z.object({ invoiceId: Uuid }), body: LineItemInput, response: envelope(LineItem) });
register({ method: 'patch', path: '/invoices/:id/line-items/:itemId', tags: [TAG], summary: 'Update a line item',
  params: z.object({ id: Uuid, itemId: Uuid }), body: LineItemInput.partial(),
  response: envelope(LineItem) });
register({ method: 'delete', path: '/invoices/:id/line-items/:itemId', tags: [TAG], summary: 'Delete a line item',
  params: z.object({ id: Uuid, itemId: Uuid }) });

// Payments
register({ method: 'get', path: '/invoices/:invoiceId/payments', tags: [TAG], summary: 'List payments on an invoice',
  params: z.object({ invoiceId: Uuid }), response: envelope(z.array(Payment)) });
register({ method: 'post', path: '/invoices/:invoiceId/payments', tags: [TAG], summary: 'Record a payment on an invoice',
  params: z.object({ invoiceId: Uuid }),
  body: Payment.omit({ id: true, invoiceId: true, createdAt: true }).partial().extend({
    amount: z.number(), paymentDate: IsoDateTime,
  }),
  response: envelope(Payment) });
register({ method: 'patch', path: '/invoices/payments/:paymentId', tags: [TAG], summary: 'Update a payment',
  params: z.object({ paymentId: Uuid }), body: Payment.partial(),
  response: envelope(Payment) });
register({ method: 'delete', path: '/invoices/payments/:paymentId', tags: [TAG], summary: 'Delete a payment',
  params: z.object({ paymentId: Uuid }) });

// Turkish e-Fatura
register({ method: 'post', path: '/invoices/:id/efatura/generate', tags: [TAG], summary: 'Generate an e-Fatura for this invoice (Turkish tax integration)',
  params: z.object({ id: Uuid }), response: envelope(Invoice) });
register({ method: 'get', path: '/invoices/:id/efatura/xml', tags: [TAG], summary: 'Download the e-Fatura XML',
  params: z.object({ id: Uuid }),
  extraResponses: { 200: { description: 'XML document', schema: z.string().openapi({ format: 'binary' }) } } });
register({ method: 'get', path: '/invoices/:id/efatura/preview', tags: [TAG], summary: 'Preview the e-Fatura',
  params: z.object({ id: Uuid }),
  response: envelope(z.record(z.string(), z.unknown())) });
register({ method: 'get', path: '/invoices/:id/efatura/pdf', tags: [TAG], summary: 'Download the e-Fatura as PDF',
  params: z.object({ id: Uuid }),
  extraResponses: { 200: { description: 'PDF binary', schema: z.string().openapi({ format: 'binary' }) } } });

// Recurring
register({ method: 'get', path: '/invoices/recurring', tags: [TAG], summary: 'List recurring invoice schedules',
  response: envelope(z.array(Recurring)) });
register({ method: 'post', path: '/invoices/recurring', tags: [TAG], summary: 'Create a recurring invoice schedule',
  body: Recurring.omit({ id: true, createdAt: true, updatedAt: true, nextRunDate: true, isPaused: true }).partial()
    .extend({ companyId: Uuid, name: z.string(), frequency: Recurring.shape.frequency, currency: z.string().length(3) }),
  response: envelope(Recurring) });
register({ method: 'get', path: '/invoices/recurring/:id', tags: [TAG], summary: 'Get a recurring invoice',
  params: z.object({ id: Uuid }), response: envelope(Recurring) });
register({ method: 'patch', path: '/invoices/recurring/:id', tags: [TAG], summary: 'Update a recurring invoice',
  params: z.object({ id: Uuid }), body: Recurring.partial(), concurrency: true, response: envelope(Recurring) });
register({ method: 'delete', path: '/invoices/recurring/:id', tags: [TAG], summary: 'Delete a recurring invoice',
  params: z.object({ id: Uuid }) });
register({ method: 'post', path: '/invoices/recurring/:id/pause', tags: [TAG], summary: 'Pause a recurring invoice',
  params: z.object({ id: Uuid }) });
register({ method: 'post', path: '/invoices/recurring/:id/resume', tags: [TAG], summary: 'Resume a recurring invoice',
  params: z.object({ id: Uuid }) });
register({ method: 'post', path: '/invoices/recurring/:id/run-now', tags: [TAG], summary: 'Manually run a recurring invoice now',
  params: z.object({ id: Uuid }), response: envelope(Invoice) });

// Seed
register({ method: 'post', path: '/invoices/seed', tags: [TAG], summary: 'Seed sample invoices (admin only)' });

// Public client portal
register({ method: 'get', path: '/invoices/portal/:token/list', tags: [TAG], summary: 'Public — list invoices for a client portal token',
  public: true, params: z.object({ token: z.string() }), response: envelope(z.array(Invoice)) });
register({ method: 'get', path: '/invoices/portal/:token/:invoiceId', tags: [TAG], summary: 'Public — get a single invoice via client portal',
  public: true, params: z.object({ token: z.string(), invoiceId: Uuid }), response: envelope(Invoice) });
