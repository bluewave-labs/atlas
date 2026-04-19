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
  projectId?: string | null;
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
  lastReminderStage?: number;
  lastReminderAt?: Date | string | null;
  excludeFromAutoReminders?: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  companyName?: string;
  contactName?: string;
  contactEmail?: string;
  dealTitle?: string;
  lineItems?: InvoiceLineItem[];
  lineItemCount?: number;
  // Computed at read time from invoice_payments (not stored on the invoice row)
  amountPaid?: number;   // sum of payments minus sum of refunds
  balanceDue?: number;   // total - amountPaid, rounded to 2 decimals
}

export interface CreateInvoiceInput {
  companyId: string;
  contactId?: string;
  dealId?: string;
  projectId?: string | null;
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
  projectId?: string | null;
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
  excludeFromAutoReminders?: boolean;
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
  reminderEnabled?: boolean;
  reminder1Days?: number;
  reminder2Days?: number;
  reminder3Days?: number;
  endlessReminderDays?: number;
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
  reminderEnabled?: boolean;
  reminder1Days?: number;
  reminder2Days?: number;
  reminder3Days?: number;
  endlessReminderDays?: number;
}

export type InvoicePaymentMethod = 'cash' | 'check' | 'bank_transfer' | 'card' | 'other';
export type PaymentType = 'payment' | 'refund';

export interface InvoicePayment {
  id: string;
  tenantId: string;
  invoiceId: string;
  userId: string;
  type: PaymentType;
  amount: number;
  currency: string;
  paymentDate: Date | string;
  method: string | null;
  reference: string | null;
  notes: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface RecordPaymentInput {
  invoiceId: string;
  type?: PaymentType;
  amount: number;
  currency?: string;
  paymentDate: Date | string;
  method?: InvoicePaymentMethod | string | null;
  reference?: string | null;
  notes?: string | null;
  sendConfirmation?: boolean;
}

export interface UpdatePaymentInput {
  amount?: number;
  paymentDate?: Date | string;
  method?: InvoicePaymentMethod | string | null;
  reference?: string | null;
  notes?: string | null;
}

export type RecurrenceFrequency = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export interface RecurringInvoiceLineItem {
  id: string;
  recurringInvoiceId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  sortOrder: number;
}

export interface RecurringInvoice {
  id: string;
  tenantId: string;
  userId: string;
  companyId: string;
  title: string;
  description: string | null;
  currency: string;
  taxPercent: number;
  discountPercent: number;
  notes: string | null;
  paymentInstructions: string | null;
  frequency: RecurrenceFrequency;
  startDate: Date | string;
  endDate: Date | string | null;
  nextRunAt: Date | string;
  lastRunAt: Date | string | null;
  runCount: number;
  maxRuns: number | null;
  autoSend: boolean;
  paymentTermsDays: number;
  isActive: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
  lineItems?: RecurringInvoiceLineItem[];
}

export interface CreateRecurringInvoiceInput {
  companyId: string;
  title: string;
  description?: string;
  currency?: string;
  taxPercent?: number;
  discountPercent?: number;
  notes?: string;
  paymentInstructions?: string;
  frequency: RecurrenceFrequency;
  startDate: Date | string;
  endDate?: Date | string;
  maxRuns?: number;
  autoSend?: boolean;
  paymentTermsDays?: number;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    taxRate?: number;
  }>;
}

export interface UpdateRecurringInvoiceInput {
  title?: string;
  description?: string | null;
  currency?: string;
  taxPercent?: number;
  discountPercent?: number;
  notes?: string | null;
  paymentInstructions?: string | null;
  frequency?: RecurrenceFrequency;
  startDate?: Date | string;
  endDate?: Date | string | null;
  maxRuns?: number | null;
  autoSend?: boolean;
  paymentTermsDays?: number;
  isActive?: boolean;
  lineItems?: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    taxRate?: number;
  }>;
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
