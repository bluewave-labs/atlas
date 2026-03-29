// ─── Digital Signature Types ────────────────────────────────────────

export type SignatureDocStatus = 'draft' | 'pending' | 'signed' | 'expired' | 'voided';
export type SignatureFieldType = 'signature' | 'initials' | 'date' | 'text';
export type SigningTokenStatus = 'pending' | 'signed' | 'expired' | 'declined';

export interface SignatureDocument {
  id: string;
  accountId: string;
  userId: string;
  title: string;
  fileName: string;
  storagePath: string;
  pageCount: number;
  status: SignatureDocStatus;
  expiresAt: string | null;
  completedAt: string | null;
  tags: string[];
  isArchived: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
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
  signedAt: string | null;
  declineReason: string | null;
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
}
