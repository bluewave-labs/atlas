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
  companyName?: string;
  contactName?: string;
  contactEmail?: string;
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
