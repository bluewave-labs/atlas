import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Skeleton } from '../../../components/ui/skeleton';
import { FeatureEmptyState } from '../../../components/ui/feature-empty-state';
import { DataTable, type DataTableColumn } from '../../../components/ui/data-table';
import { useProposals, useMyCrmPermission, canAccess, type Proposal } from '../hooks';
import { getProposalStatusVariant } from '@atlas-platform/shared';
import { formatCurrency, formatDate } from '../../../lib/format';

interface ProposalsListViewProps {
  onSelect: (id: string) => void;
  onCreateNew: (prefill?: { dealId?: string; companyId?: string; contactId?: string }) => void;
}

export function ProposalsListView({ onSelect, onCreateNew }: ProposalsListViewProps) {
  const { t } = useTranslation();
  const { data: perm } = useMyCrmPermission();
  const canCreate = canAccess(perm?.role, 'proposals', 'create');
  const { data, isLoading } = useProposals();
  const proposals = data?.proposals ?? [];

  const columns: DataTableColumn<Proposal>[] = [
    {
      key: 'title',
      label: t('crm.proposals.titleLabel'),
      minWidth: 180,
      hideable: false,
      render: (p) => (
        <span style={{ fontWeight: 'var(--font-weight-medium)' as never, color: 'var(--color-text-primary)' }}>
          {p.title}
        </span>
      ),
      searchValue: (p) => p.title,
      compare: (a, b) => a.title.localeCompare(b.title),
    },
    {
      key: 'companyName',
      label: t('crm.sidebar.companies'),
      minWidth: 140,
      render: (p) => (
        <span style={{ color: 'var(--color-text-secondary)' }}>{p.companyName || '—'}</span>
      ),
      searchValue: (p) => p.companyName ?? '',
      compare: (a, b) => (a.companyName ?? '').localeCompare(b.companyName ?? ''),
    },
    {
      key: 'dealTitle',
      label: t('crm.sidebar.deals'),
      minWidth: 140,
      render: (p) => (
        <span style={{ color: 'var(--color-text-secondary)' }}>{p.dealTitle || '—'}</span>
      ),
      searchValue: (p) => p.dealTitle ?? '',
      compare: (a, b) => (a.dealTitle ?? '').localeCompare(b.dealTitle ?? ''),
    },
    {
      key: 'status',
      label: t('crm.proposals.statusLabel'),
      width: 110,
      render: (p) => (
        <Badge variant={getProposalStatusVariant(p.status)}>
          {t(`crm.proposals.status.${p.status}`)}
        </Badge>
      ),
      searchValue: (p) => p.status,
    },
    {
      key: 'total',
      label: t('common.totals.total'),
      width: 110,
      render: (p) => (
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(p.total)}</span>
      ),
      compare: (a, b) => a.total - b.total,
    },
    {
      key: 'sentAt',
      label: t('crm.proposals.sentDate'),
      width: 120,
      render: (p) => (
        <span style={{ color: 'var(--color-text-tertiary)' }}>
          {p.sentAt ? formatDate(p.sentAt) : '—'}
        </span>
      ),
      searchValue: (p) => p.sentAt ? formatDate(p.sentAt) : '',
      compare: (a, b) => (a.sentAt ?? '').localeCompare(b.sentAt ?? ''),
    },
  ];

  if (isLoading) {
    return (
      <div style={{ padding: 'var(--spacing-xl)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} style={{ height: 40, borderRadius: 'var(--radius-sm)' }} />
        ))}
      </div>
    );
  }

  if (proposals.length === 0) {
    return (
      <FeatureEmptyState
        illustration="documents"
        title={t('crm.proposals.emptyTitle')}
        description={t('crm.proposals.emptyDesc')}
        actionLabel={canCreate ? t('crm.proposals.create') : undefined}
        onAction={canCreate ? () => onCreateNew() : undefined}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <DataTable
        data={proposals}
        columns={columns}
        storageKey="crm_proposals"
        searchable
        paginated={false}
        onRowClick={(p) => onSelect(p.id)}
        toolbar={{
          right: canCreate ? (
            <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => onCreateNew()}>
              {t('crm.proposals.create')}
            </Button>
          ) : undefined,
        }}
        emptyTitle={t('crm.proposals.emptyTitle')}
        emptyDescription={t('crm.proposals.emptyDesc')}
      />
    </div>
  );
}
