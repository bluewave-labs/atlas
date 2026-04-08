// ─── Digital Signature Types ────────────────────────────────────────

export type SignatureDocStatus = 'draft' | 'pending' | 'signed' | 'expired' | 'voided';
export type SignatureFieldType = 'signature' | 'initials' | 'date' | 'text' | 'checkbox' | 'dropdown' | 'name' | 'email';
export type SigningTokenRole = 'signer' | 'viewer' | 'approver' | 'cc';
export type SigningTokenStatus = 'pending' | 'signed' | 'expired' | 'declined';

export interface SignatureDocument {
  id: string;
  tenantId: string;
  userId: string;
  title: string;
  fileName: string;
  storagePath: string;
  pageCount: number;
  status: SignatureDocStatus;
  expiresAt: string | null;
  completedAt: string | null;
  tags: string[];
  redirectUrl: string | null;
  isArchived: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface FieldOptions {
  readOnly?: boolean;
  placeholder?: string;
  fontSize?: number;
  textAlign?: 'left' | 'center' | 'right';
}

export interface SignatureField {
  id: string;
  documentId: string;
  type: SignatureFieldType;
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  signerEmail: string | null;
  label: string | null;
  required: boolean;
  options?: FieldOptions;
  signedAt: string | null;
  signatureData: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface SigningToken {
  id: string;
  documentId: string;
  signerEmail: string;
  signerName: string | null;
  token: string;
  status: SigningTokenStatus;
  role: SigningTokenRole;
  signedAt: string | null;
  declineReason: string | null;
  signingOrder: number;
  lastReminderAt: string | null;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSignatureDocInput {
  title: string;
}

export interface CreateSignatureFieldInput {
  documentId: string;
  type: SignatureFieldType;
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  signerEmail?: string;
  label?: string;
  required?: boolean;
}

export interface CreateSigningTokenInput {
  documentId: string;
  signerEmail: string;
  signerName?: string;
  expiresInDays?: number;
  signingOrder?: number;
  role?: SigningTokenRole;
}

// ─── Audit Log ─────────────────────────────────────────────────────

export interface SignAuditLogEntry {
  id: string;
  documentId: string;
  action: string;
  actorEmail: string | null;
  actorName: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

// ─── Templates ─────────────────────────────────────────────────────

export interface SignTemplate {
  id: string;
  tenantId: string;
  userId: string;
  title: string;
  fileName: string;
  storagePath: string;
  pageCount: number;
  fields: Array<{
    type: string;
    pageNumber: number;
    x: number;
    y: number;
    width: number;
    height: number;
    signerEmail: string | null;
    label: string | null;
    required: boolean;
  }>;
  isArchived: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}
