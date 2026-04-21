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
  response: envelope(z.record(z.string(), z.unknown())) });
register({ method: 'get', path: '/sign/settings', tags: [TAG], summary: 'Get Sign settings',
  response: envelope(z.record(z.string(), z.unknown())) });
register({ method: 'patch', path: '/sign/settings', tags: [TAG], summary: 'Update Sign settings',
  body: z.record(z.string(), z.unknown()) });

// Documents
register({ method: 'get', path: '/sign', tags: [TAG], summary: 'List signature documents',
  query: z.object({ status: SignDocument.shape.status.optional(), archived: z.coerce.boolean().optional() }),
  response: envelope(z.array(SignDocument)) });
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

// Send / recipients
register({ method: 'post', path: '/sign/:id/send', tags: [TAG], summary: 'Send a signature document for signing',
  params: z.object({ id: Uuid }),
  body: z.object({ recipients: z.array(z.object({ email: z.string().email(), name: z.string().optional() })), message: z.string().optional() }) });

// Fields
register({ method: 'get', path: '/sign/:id/fields', tags: [TAG], summary: 'List fields on a signature document',
  params: z.object({ id: Uuid }), response: envelope(z.array(SignField)) });
register({ method: 'post', path: '/sign/:id/fields', tags: [TAG], summary: 'Add a field to a signature document',
  params: z.object({ id: Uuid }),
  body: SignField.omit({ id: true, documentId: true, signedAt: true, signatureData: true }).partial().extend({
    type: SignField.shape.type, pageNumber: z.number().int(), x: z.number(), y: z.number(), width: z.number(), height: z.number(),
  }),
  response: envelope(SignField) });
register({ method: 'patch', path: '/sign/fields/:fieldId', tags: [TAG], summary: 'Update a signature field',
  params: z.object({ fieldId: Uuid }), body: SignField.partial(), response: envelope(SignField) });
register({ method: 'delete', path: '/sign/fields/:fieldId', tags: [TAG], summary: 'Delete a signature field',
  params: z.object({ fieldId: Uuid }) });

// Templates
register({ method: 'get', path: '/sign/templates', tags: [TAG], summary: 'List signature templates',
  response: envelope(z.array(Template)) });
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
