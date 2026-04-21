import { z } from 'zod';
import { register, envelope, Uuid, IsoDateTime } from '../_helpers';

const TAG = 'Sign';

const SignDocument = z.object({
  id: Uuid,
  tenantId: Uuid,
  userId: Uuid,
  title: z.string(),
  fileName: z.string(),
  storagePath: z.string(),
  pageCount: z.number().int(),
  status: z.enum(['draft', 'sent', 'viewed', 'signed', 'completed', 'declined', 'expired']),
  expiresAt: IsoDateTime.nullable(),
  completedAt: IsoDateTime.nullable(),
  tags: z.array(z.string()),
  documentType: z.string(),
  counterpartyName: z.string().nullable(),
  redirectUrl: z.string().url().nullable(),
  isArchived: z.boolean(),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});

const SignField = z.object({
  id: Uuid,
  documentId: Uuid,
  type: z.enum(['signature', 'initial', 'text', 'date', 'checkbox']),
  pageNumber: z.number().int(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  signerEmail: z.string().email().nullable(),
  label: z.string().nullable(),
  required: z.boolean(),
  options: z.record(z.string(), z.unknown()),
  signedAt: IsoDateTime.nullable(),
  signatureData: z.string().nullable(),
  sortOrder: z.number().int(),
});

const Template = z.object({
  id: Uuid,
  name: z.string(),
  description: z.string().nullable(),
  storagePath: z.string(),
  pageCount: z.number().int(),
  createdAt: IsoDateTime,
});

// Widget / settings
register({ method: 'get', path: '/sign/widget', tags: [TAG], summary: 'Get Sign widget data for home',
  response: envelope(z.object({
    pending: z.number().int(),
    signed: z.number().int(),
    draft: z.number().int(),
    total: z.number().int(),
  })) });
register({ method: 'get', path: '/sign/settings', tags: [TAG], summary: 'Get Sign settings',
  response: envelope(z.record(z.string(), z.unknown())) });
register({ method: 'patch', path: '/sign/settings', tags: [TAG], summary: 'Update Sign settings',
  body: z.record(z.string(), z.unknown()) });

// Documents
register({ method: 'get', path: '/sign', tags: [TAG], summary: 'List signature documents',
  query: z.object({ status: SignDocument.shape.status.optional(), archived: z.coerce.boolean().optional() }),
  response: envelope(z.object({ documents: z.array(SignDocument) })) });
register({ method: 'post', path: '/sign', tags: [TAG], summary: 'Create a signature document',
  body: z.object({ title: z.string(), documentType: z.string().optional() }),
  response: envelope(SignDocument) });
register({ method: 'post', path: '/sign/upload', tags: [TAG], summary: 'Upload a PDF for a signature document (multipart/form-data)',
  response: envelope(SignDocument) });
register({ method: 'get', path: '/sign/:id', tags: [TAG], summary: 'Get a signature document (with fields)',
  params: z.object({ id: Uuid }),
  response: envelope(SignDocument.extend({ fields: z.array(SignField) })) });
register({ method: 'put', path: '/sign/:id', tags: [TAG], summary: 'Update a signature document',
  params: z.object({ id: Uuid }), body: SignDocument.partial(), concurrency: true, response: envelope(SignDocument) });
register({ method: 'delete', path: '/sign/:id', tags: [TAG], summary: 'Delete a signature document',
  params: z.object({ id: Uuid }) });

// Document-level actions
register({ method: 'get', path: '/sign/:id/view', tags: [TAG], summary: 'Stream the signed PDF for inline viewing',
  params: z.object({ id: Uuid }),
  extraResponses: { 200: { description: 'PDF binary', schema: z.string().openapi({ format: 'binary' }) } } });
register({ method: 'get', path: '/sign/:id/download', tags: [TAG], summary: 'Download the signed PDF',
  params: z.object({ id: Uuid }),
  extraResponses: { 200: { description: 'PDF binary', schema: z.string().openapi({ format: 'binary' }) } } });
register({ method: 'post', path: '/sign/:id/void', tags: [TAG], summary: 'Void a signature document',
  params: z.object({ id: Uuid }), body: z.object({ reason: z.string().optional() }) });
register({ method: 'get', path: '/sign/:id/audit', tags: [TAG], summary: 'Get the audit log for a signature document',
  params: z.object({ id: Uuid }),
  response: envelope(z.array(z.record(z.string(), z.unknown()))) });
register({ method: 'post', path: '/sign/:id/save-as-template', tags: [TAG], summary: 'Save an existing document as a reusable template',
  params: z.object({ id: Uuid }),
  body: z.object({ name: z.string() }),
  response: envelope(Template) });

// Fields
register({ method: 'get', path: '/sign/:id/fields', tags: [TAG], summary: 'List fields on a signature document',
  params: z.object({ id: Uuid }), response: envelope(z.array(SignField)) });
register({ method: 'post', path: '/sign/:id/fields', tags: [TAG], summary: 'Add a field to a signature document',
  params: z.object({ id: Uuid }),
  body: SignField.omit({ id: true, documentId: true, signedAt: true, signatureData: true }).partial().extend({
    type: SignField.shape.type, pageNumber: z.number().int(), x: z.number(), y: z.number(), width: z.number(), height: z.number(),
  }),
  response: envelope(SignField) });
register({ method: 'put', path: '/sign/fields/:fieldId', tags: [TAG], summary: 'Update a signature field',
  params: z.object({ fieldId: Uuid }), body: SignField.partial(), response: envelope(SignField) });
register({ method: 'delete', path: '/sign/fields/:fieldId', tags: [TAG], summary: 'Delete a signature field',
  params: z.object({ fieldId: Uuid }) });

// Signing tokens (per-recipient links)
register({ method: 'get', path: '/sign/:id/tokens', tags: [TAG], summary: 'List signing tokens issued for a document',
  params: z.object({ id: Uuid }),
  response: envelope(z.array(z.record(z.string(), z.unknown()))) });
register({ method: 'post', path: '/sign/:id/tokens', tags: [TAG], summary: 'Create a signing token for a recipient',
  params: z.object({ id: Uuid }),
  body: z.object({ signerEmail: z.string().email(), signerName: z.string().optional() }),
  response: envelope(z.record(z.string(), z.unknown())) });
register({ method: 'post', path: '/sign/:id/tokens/:tokenId/remind', tags: [TAG], summary: 'Send a single reminder to one signer',
  params: z.object({ id: Uuid, tokenId: Uuid }) });

// Starter templates
register({ method: 'post', path: '/sign/templates/seed-starter', tags: [TAG], summary: 'Seed starter templates (admin)' });

// Seed
register({ method: 'post', path: '/sign/seed', tags: [TAG], summary: 'Seed sample sign documents (admin only)' });

// Templates
register({ method: 'get', path: '/sign/templates', tags: [TAG], summary: 'List signature templates',
  response: envelope(z.object({ templates: z.array(Template) })) });
register({ method: 'post', path: '/sign/templates', tags: [TAG], summary: 'Create a signature template',
  body: z.object({ name: z.string(), description: z.string().optional() }), response: envelope(Template) });
register({ method: 'post', path: '/sign/templates/:id/use', tags: [TAG], summary: 'Create a new document from a template',
  params: z.object({ id: Uuid }), body: z.object({ title: z.string().optional() }), response: envelope(SignDocument) });
register({ method: 'delete', path: '/sign/templates/:id', tags: [TAG], summary: 'Delete a signature template',
  params: z.object({ id: Uuid }) });

// Reminders
register({ method: 'post', path: '/sign/reminders/send', tags: [TAG], summary: 'Send reminders for all pending documents (admin)',
  response: envelope(z.object({ sent: z.number().int() })) });

// Public signing endpoints
register({ method: 'get', path: '/sign/public/:token', tags: [TAG], summary: 'Public — fetch document by signing token',
  public: true, params: z.object({ token: z.string() }), response: envelope(SignDocument.extend({ fields: z.array(SignField) })) });
register({ method: 'post', path: '/sign/public/:token/sign', tags: [TAG], summary: 'Public — submit signatures for a document',
  public: true, params: z.object({ token: z.string() }),
  body: z.object({ fields: z.array(z.object({ fieldId: Uuid, value: z.string() })) }) });
register({ method: 'post', path: '/sign/public/:token/decline', tags: [TAG], summary: 'Public — decline signing',
  public: true, params: z.object({ token: z.string() }), body: z.object({ reason: z.string().optional() }) });
register({ method: 'get', path: '/sign/public/:token/view', tags: [TAG], summary: 'Public — stream the PDF for signing',
  public: true, params: z.object({ token: z.string() }),
  extraResponses: { 200: { description: 'PDF binary', schema: z.string().openapi({ format: 'binary' }) } } });
