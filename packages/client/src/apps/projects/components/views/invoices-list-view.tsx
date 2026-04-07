import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDate, formatCurrency } from '../../../../lib/format';
import {
  FileText, Users, Plus, DollarSign, Hash, Calendar,
} from 'lucide-react';
import { type Invoice, getInvoiceStatusVariant } from '../../hooks';
import { Badge } from '../../../../components/ui/badge';
import { DataTable, type DataTableColumn } from '../../../../components/ui/data-table';
import { FeatureEmptyState } from '../../../../components/ui/feature-empty-state';

export function InvoicesListView({ invoices, searchQuery, onSelect, selectedId, onAdd }: {
  invoices: Invoice[];
  searchQuery: string;
  onSelect: (id: string) => void;
  selectedId: string | null;
  onAdd: () => void;
}) {
  const { t } = useTranslation();

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return invoices;
    const q = searchQuery.toLowerCase();
    return invoices.filter((inv) =>
      inv.invoiceNumber.toLowerCase().includes(q) ||
      (inv.clientName?.toLowerCase().includes(q)),
    );
  }, [invoices, searchQuery]);

  if (filtered.length === 0 && !searchQuery) {
    return (
      <FeatureEmptyState
        illustration="documents"
        title={t('projects.empty.invoicesTitle')}
        description={t('projects.empty.invoicesDesc')}
        highlights={[
          { icon: <FileText size={14} />, title: t('projects.empty.invoicesH1Title'), description: t('projects.empty.invoicesH1Desc') },
          { icon: <DollarSign size={14} />, title: t('projects.empty.invoicesH2Title'), description: t('projects.empty.invoicesH2Desc') },
          { icon: <Users size={14} />, title: t('projects.empty.invoicesH3Title'), description: t('projects.empty.invoicesH3Desc') },
        ]}
        actionLabel={t('projects.invoices.newInvoice')}
        actionIcon={<Plus size={14} />}
        onAction={onAdd}
      />
    );
  }

  const totalAmount = filtered.reduce((sum, inv) => sum + inv.total, 0);

  const columns: DataTableColumn<Invoice>[] = [
    {
      key: 'invoiceNumber',
      label: t('projects.invoices.number'),
      icon: <Hash size={12} />,
      width: 120,
      sortable: true,
      render: (invoice) => (
        <span style={{ fontWeight: 'var(--font-weight-medium)' }}>{invoice.invoiceNumber}</span>
      ),
    },
    {
      key: 'clientName',
      label: t('projects.invoices.client'),
      icon: <Users size={12} />,
      width: 160,
      sortable: true,
      render: (invoice) => (
        <span className="dt-cell-secondary" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {invoice.clientName || '-'}
        </span>
      ),
    },
    {
      key: 'total',
      label: t('projects.invoices.amount'),
      icon: <DollarSign size={12} />,
      width: 110,
      sortable: true,
      align: 'right',
      render: (invoice) => (
        <span style={{ fontWeight: 'var(--font-weight-semibold)', fontVariantNumeric: 'tabular-nums' }}>
          {formatCurrency(invoice.total)}
        </span>
      ),
    },
    {
      key: 'lineItemCount',
      label: t('projects.invoices.items'),
      icon: <Hash size={12} />,
      width: 70,
      sortable: true,
      align: 'right',
      render: (invoice) => (
        <span className="dt-cell-secondary" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {invoice.lineItemCount ?? invoice.lineItems?.length ?? 0}
        </span>
      ),
    },
    {
      key: 'status',
      label: t('projects.projects.status'),
      width: 100,
      sortable: true,
      render: (invoice) => (
        <Badge variant={getInvoiceStatusVariant(invoice.status)}>
          {t(`projects.status.${invoice.status}`)}
        </Badge>
      ),
    },
    {
      key: 'issueDate',
      label: t('projects.invoices.issueDate'),
      icon: <Calendar size={12} />,
      sortable: true,
      render: (invoice) => (
        <span className="dt-cell-secondary">{formatDate(invoice.issueDate)}</span>
      ),
    },
  ];

  return (
    <DataTable
      data={filtered}
      columns={columns}
      activeRowId={selectedId}
      onRowClick={(invoice) => onSelect(invoice.id)}
      onAddRow={onAdd}
      addRowLabel={t('projects.actions.addNew')}
      emptyTitle={t('projects.empty.noMatchingInvoices')}
      emptyDescription={t('projects.empty.tryDifferentSearch')}
      emptyIcon={<FileText size={48} />}
      aggregations={[
        {
          label: t('projects.invoices.total'),
          compute: () => formatCurrency(totalAmount),
        },
      ]}
    />
  );
}
