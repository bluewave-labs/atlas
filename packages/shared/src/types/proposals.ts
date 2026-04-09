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
