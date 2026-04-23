import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDate, formatCurrency } from '../../../lib/format';
import {
  FileText, Building2, Plus, DollarSign, Hash, Calendar, Link2,
} from 'lucide-react';
import type { Invoice } from '@atlas-platform/shared';
import { getInvoiceStatusVariant } from '@atlas-platform/shared';
import { Badge } from '../../../components/ui/badge';
import { DataTable, type DataTableColumn } from '../../../components/ui/data-table';
import { FeatureEmptyState } from '../../../components/ui/feature-empty-state';
import { Tooltip } from '../../../components/ui/tooltip';

type StatusFilter = 'all' | 'draft' | 'unpaid' | 'overdue' | 'paid' | 'waived';

function filterByStatus(invoices: Invoice[], filter: StatusFilter): Invoice[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  switch (filter) {
    case 'all':
      return invoices;
    case 'draft':
      return invoices.filter((inv) => inv.status === 'draft');
    case 'unpaid':
      return invoices.filter((inv) => {
        if (inv.status !== 'sent' && inv.status !== 'viewed') return false;
        if (!inv.dueDate) return true;
        return new Date(inv.dueDate) >= today;
      });
    case 'overdue':
      return invoices.filter((inv) => {
        if (inv.status !== 'sent' && inv.status !== 'viewed') return false;
        if (!inv.dueDate) return false;
        return new Date(inv.dueDate) < today;
      });
    case 'paid':
      return invoices.filter((inv) => inv.status === 'paid');
    case 'waived':
      return invoices.filter((inv) => inv.status === 'waived');
    default:
      return invoices;
  }
}

function countByStatus(invoices: Invoice[]): Record<StatusFilter, number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const counts: Record<StatusFilter, number> = {
    all: invoices.length,
    draft: 0,
    unpaid: 0,
    overdue: 0,
    paid: 0,
    waived: 0,
  };

  for (const inv of invoices) {
    if (inv.status === 'draft') {
      counts.draft++;
    } else if (inv.status === 'sent' || inv.status === 'viewed') {
      if (inv.dueDate && new Date(inv.dueDate) < today) {
        counts.overdue++;
      } else {
        counts.unpaid++;
      }
    } else if (inv.status === 'paid') {
      counts.paid++;
    } else if (inv.status === 'waived') {
      counts.waived++;
    }
  }

  return counts;
}

const FILTER_OPTIONS: StatusFilter[] = ['all', 'draft', 'unpaid', 'overdue', 'paid', 'waived'];

export function InvoicesListView({ invoices, searchQuery, onOpenDetail, selectedId, onAdd, onImportPdf }: {
  invoices: Invoice[];
  searchQuery: string;
  onOpenDetail: (id: string) => void;
  selectedId: string | null;
  onAdd?: () => void;
  onImportPdf?: () => void;
}) {
  const { t } = useTranslation();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const counts = useMemo(() => countByStatus(invoices), [invoices]);

  const filtered = useMemo(() => {
    let result = filterByStatus(invoices, statusFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((inv) =>
        inv.invoiceNumber.toLowerCase().includes(q) ||
        (inv.companyName?.toLowerCase().includes(q)),
      );
    }
    return result;
  }, [invoices, statusFilter, searchQuery]);

  if (invoices.length === 0 && !searchQuery) {
    return (
      <FeatureEmptyState
        illustration="documents"
        title={t('invoices.empty.noInvoices')}
        description={t('invoices.empty.noInvoicesDescription')}
        highlights={[
          { icon: <FileText size={14} />, title: t('invoices.empty.createTitle'), description: t('invoices.empty.createDesc') },
          { icon: <DollarSign size={14} />, title: t('invoices.empty.trackTitle'), description: t('invoices.empty.trackDesc') },
          { icon: <Building2 size={14} />, title: t('invoices.empty.companyTitle'), description: t('invoices.empty.companyDesc') },
        ]}
        actionLabel={onAdd ? t('invoices.builder.createInvoice') : undefined}
        actionIcon={onAdd ? <Plus size={14} /> : undefined}
        onAction={onAdd}
      />
    );
  }

  const totalAmount = filtered.reduce((sum, inv) => sum + inv.total, 0);

  const columns: DataTableColumn<Invoice>[] = [
    {
      key: 'invoiceNumber',
      label: t('invoices.list.invoiceNumber'),
      icon: <Hash size={12} />,
      minWidth: 160,
      sortable: true,
      render: (invoice) => (
        <span style={{ fontWeight: 'var(--font-weight-medium)' }}>{invoice.invoiceNumber}</span>
      ),
      searchValue: (invoice) => invoice.invoiceNumber,
    },
    {
      key: 'companyName',
      label: t('invoices.list.company'),
      icon: <Building2 size={12} />,
      minWidth: 160,
      sortable: true,
      render: (invoice) => (
        <span className="dt-cell-secondary" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {invoice.companyName || '-'}
        </span>
      ),
      searchValue: (invoice) => invoice.companyName || '',
    },
    {
      key: 'source',
      label: '',
      width: 32,
      render: (invoice) =>
        invoice.dealId ? (
          <Tooltip content={invoice.dealTitle || t('invoices.detail.fromDeal')}>
            <Link2 size={12} style={{ color: 'var(--color-text-tertiary)' }} />
          </Tooltip>
        ) : null,
      searchValue: () => '',
    },
    {
      key: 'total',
      label: t('invoices.list.amount'),
      icon: <DollarSign size={12} />,
      minWidth: 110,
      sortable: true,
      align: 'right',
      render: (invoice) => (
        <span style={{ fontWeight: 'var(--font-weight-semibold)', fontVariantNumeric: 'tabular-nums' }}>
          {formatCurrency(invoice.total)}
        </span>
      ),
      searchValue: (invoice) => formatCurrency(invoice.total),
    },
    {
      key: 'lineItemCount',
      label: t('invoices.list.items'),
      icon: <Hash size={12} />,
      minWidth: 90,
      sortable: true,
      align: 'right',
      render: (invoice) => (
        <span className="dt-cell-secondary" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {invoice.lineItemCount ?? invoice.lineItems?.length ?? 0}
        </span>
      ),
      searchValue: (invoice) => String(invoice.lineItemCount ?? invoice.lineItems?.length ?? 0),
    },
    {
      key: 'status',
      label: t('invoices.list.status'),
      minWidth: 110,
      sortable: true,
      render: (invoice) => (
        <Badge variant={getInvoiceStatusVariant(invoice.status)}>
          {t(`invoices.status.${invoice.status}`)}
        </Badge>
      ),
      searchValue: (invoice) => t(`invoices.status.${invoice.status}`),
    },
    {
      key: 'issueDate',
      label: t('invoices.list.issueDate'),
      icon: <Calendar size={12} />,
      minWidth: 150,
      sortable: true,
      render: (invoice) => (
        <span className="dt-cell-secondary">{formatDate(invoice.issueDate)}</span>
      ),
      searchValue: (invoice) => formatDate(invoice.issueDate),
    },
    {
      key: 'dueDate',
      label: t('invoices.list.dueDate'),
      icon: <Calendar size={12} />,
      minWidth: 140,
      sortable: true,
      render: (invoice) => (
        <span className="dt-cell-secondary">{formatDate(invoice.dueDate)}</span>
      ),
      searchValue: (invoice) => formatDate(invoice.dueDate),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Filter chips */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--spacing-sm)',
        padding: 'var(--spacing-md) var(--spacing-lg)',
        borderBottom: '1px solid var(--color-border-secondary)',
        flexShrink: 0,
      }}>
        {FILTER_OPTIONS.map((filter) => (
          <button
            key={filter}
            onClick={() => setStatusFilter(filter)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 12px',
              fontSize: 'var(--font-size-sm)',
              fontWeight: statusFilter === filter ? 'var(--font-weight-medium)' : 'var(--font-weight-normal)',
              fontFamily: 'var(--font-family)',
              color: statusFilter === filter ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)',
              backgroundColor: statusFilter === filter ? 'var(--color-accent-primary)' : 'var(--color-bg-tertiary)',
              border: 'none',
              borderRadius: '999px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'background-color 0.15s, color 0.15s',
              lineHeight: '1.4',
            }}
          >
            {t(`invoices.filters.${filter}`)} ({counts[filter]})
          </button>
        ))}
      </div>

      {/* Data table */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <DataTable
          persistSortKey="invoices_list"
          data={filtered}
          columns={columns}
          searchable
          exportable
          columnSelector
          resizableColumns
          storageKey="invoices"
          activeRowId={selectedId}
          onRowClick={(invoice) => onOpenDetail(invoice.id)}
          onAddRow={onAdd}
          addRowLabel={onAdd ? t('invoices.builder.createInvoice') : undefined}
          emptyTitle={t('invoices.empty.noMatchingInvoices')}
          emptyDescription={t('invoices.empty.tryDifferentSearch')}
          emptyIcon={<FileText size={48} />}
          aggregations={[
            {
              label: t('invoices.list.totalAmount'),
              compute: () => formatCurrency(totalAmount),
            },
          ]}
        />
      </div>
    </div>
  );
}
