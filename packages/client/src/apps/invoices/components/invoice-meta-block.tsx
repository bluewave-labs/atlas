import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { Invoice } from '@atlas-platform/shared';
import { Input } from '../../../components/ui/input';
import { Select } from '../../../components/ui/select';
import { useCompanies } from '../../crm/hooks';

interface Props {
  invoice: Invoice;
  onPatch: (patch: Partial<{
    invoiceNumber: string;
    issueDate: string;
    dueDate: string;
    companyId: string;
    contactId: string | null;
    currency: string;
    dealId: string | null;
  }>) => void;
}

export function InvoiceMetaBlock({ invoice, onPatch }: Props) {
  const { t } = useTranslation();
  const { data: companiesData } = useCompanies();
  const companies = companiesData?.companies ?? [];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '140px 1fr',
        columnGap: 'var(--spacing-md)',
        rowGap: 'var(--spacing-sm)',
        padding: 'var(--spacing-md)',
        borderBottom: '1px solid var(--color-border-secondary)',
      }}
    >
      <Label>{t('invoices.detail.metaInvoiceNumber')}</Label>
      <Input
        size="sm"
        defaultValue={invoice.invoiceNumber}
        onBlur={(e) => {
          const next = e.currentTarget.value.trim();
          if (next && next !== invoice.invoiceNumber) onPatch({ invoiceNumber: next });
        }}
      />

      <Label>{t('invoices.detail.metaIssueDate')}</Label>
      <Input
        size="sm"
        type="date"
        defaultValue={invoice.issueDate.slice(0, 10)}
        onBlur={(e) => {
          const next = e.currentTarget.value;
          if (next && next !== invoice.issueDate.slice(0, 10)) onPatch({ issueDate: next });
        }}
      />

      <Label>{t('invoices.detail.metaDueDate')}</Label>
      <Input
        size="sm"
        type="date"
        defaultValue={invoice.dueDate.slice(0, 10)}
        onBlur={(e) => {
          const next = e.currentTarget.value;
          if (next && next !== invoice.dueDate.slice(0, 10)) onPatch({ dueDate: next });
        }}
      />

      <Label>{t('invoices.detail.metaCompany')}</Label>
      <Select
        size="sm"
        value={invoice.companyId}
        onChange={(v) => { if (v && v !== invoice.companyId) onPatch({ companyId: v }); }}
        options={companies.map((c) => ({ value: c.id, label: c.name }))}
      />

      <Label>{t('invoices.detail.metaCurrency')}</Label>
      <Select
        size="sm"
        value={invoice.currency}
        onChange={(v) => { if (v && v !== invoice.currency) onPatch({ currency: v }); }}
        options={[
          { value: 'USD', label: 'USD' }, { value: 'EUR', label: 'EUR' },
          { value: 'GBP', label: 'GBP' }, { value: 'TRY', label: 'TRY' },
        ]}
      />
    </div>
  );
}

function Label({ children }: { children: ReactNode }) {
  return (
    <span style={{
      fontSize: 'var(--font-size-sm)',
      color: 'var(--color-text-secondary)',
      alignSelf: 'center',
      fontFamily: 'var(--font-family)',
    }}>
      {children}
    </span>
  );
}
