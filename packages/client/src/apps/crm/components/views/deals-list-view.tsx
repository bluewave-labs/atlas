import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDate, formatCurrency } from '../../../../lib/format';
import {
  Briefcase, Building2, Users, Plus, LayoutGrid, BarChart3, Target,
  DollarSign, Calendar,
} from 'lucide-react';
import {
  useUpdateDeal,
  type CrmDeal, type CrmDealStage, type CrmCompany,
} from '../../hooks';
import type { EditingCell, SortState } from '../../lib/crm-helpers';
import { NameAvatar, CompanyLogo } from '../../lib/crm-helpers';
import { InlineEditInput, InlineSelectCell } from '../inline-edit-cells';
import { Badge } from '../../../../components/ui/badge';
import { DataTable, type DataTableColumn } from '../../../../components/ui/data-table';
import { FeatureEmptyState } from '../../../../components/ui/feature-empty-state';
import { StatusDot } from '../../../../components/ui/status-dot';

export function DealsListView({
  deals, stages, selectedId, onSelect,
  selectedIds, onSelectionChange, focusedIndex, onFocusedIndexChange,
  editingCell, onEditingCellChange, sort, onSortChange,
  companies, onAdd, canEdit = true, groupBy = null,
}: {
  deals: CrmDeal[];
  stages: CrmDealStage[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  focusedIndex: number | null;
  onFocusedIndexChange: (idx: number | null) => void;
  editingCell: EditingCell | null;
  onEditingCellChange: (cell: EditingCell | null) => void;
  sort: SortState | null;
  onSortChange: (sort: SortState | null) => void;
  companies: CrmCompany[];
  onAdd: () => void;
  canEdit?: boolean;
  groupBy?: string | null;
}) {
  const { t } = useTranslation();
  const updateDeal = useUpdateDeal();

  const companyDomainMap = useMemo(() => {
    const map = new Map<string, string>();
    companies.forEach((c) => { if (c.domain) map.set(c.id, c.domain); });
    return map;
  }, [companies]);

  const handleCellClick = (rowId: string, column: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canEdit) return;
    onEditingCellChange({ rowId, column });
  };

  const handleSave = (dealId: string, column: string, value: string) => {
    const updates: Record<string, unknown> = { id: dealId };
    switch (column) {
      case 'title': updates.title = value; break;
      case 'value': updates.value = Number(value) || 0; break;
      case 'stage': updates.stageId = value; break;
      case 'closeDate': updates.expectedCloseDate = value || null; break;
    }
    updateDeal.mutate(updates as Parameters<typeof updateDeal.mutate>[0]);
    onEditingCellChange(null);
  };

  if (deals.length === 0) {
    return (
      <FeatureEmptyState
        illustration="pipeline"
        title={t('crm.empty.pipelineTitle')}
        description={t('crm.empty.pipelineDesc')}
        highlights={[
          { icon: <LayoutGrid size={14} />, title: t('crm.empty.pipelineH1Title'), description: t('crm.empty.pipelineH1Desc') },
          { icon: <BarChart3 size={14} />, title: t('crm.empty.pipelineH2Title'), description: t('crm.empty.pipelineH2Desc') },
          { icon: <Target size={14} />, title: t('crm.empty.pipelineH3Title'), description: t('crm.empty.pipelineH3Desc') },
        ]}
        actionLabel={canEdit ? t('crm.empty.createDeal') : undefined}
        actionIcon={canEdit ? <Plus size={14} /> : undefined}
        onAction={canEdit ? onAdd : undefined}
      />
    );
  }

  const isEd = (dealId: string, col: string) => editingCell?.rowId === dealId && editingCell?.column === col;

  const dealColumns: DataTableColumn<CrmDeal>[] = [
    {
      key: 'title', label: t('crm.deals.title'), icon: <Briefcase size={12} />, width: 180, sortable: true,
      render: (deal) => isEd(deal.id, 'title') ? (
        <InlineEditInput value={deal.title} type="text" onSave={(v) => handleSave(deal.id, 'title', v)} onCancel={() => onEditingCellChange(null)} />
      ) : (
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)', fontSize: 'var(--font-size-sm)', cursor: 'text' }} onClick={(e) => handleCellClick(deal.id, 'title', e)}>
          <NameAvatar name={deal.title} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{deal.title}</span>
        </span>
      ),
      searchValue: (deal) => deal.title,
      compare: (a, b) => a.title.toLowerCase().localeCompare(b.title.toLowerCase()),
    },
    {
      key: 'company', label: t('crm.deals.company'), icon: <Building2 size={12} />, width: 130, sortable: true,
      render: (deal) => (
        <span className="dt-cell-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {deal.companyId && <CompanyLogo domain={companyDomainMap.get(deal.companyId)} />}
          {deal.companyName || '-'}
        </span>
      ),
      searchValue: (deal) => deal.companyName || '',
      compare: (a, b) => (a.companyName || '').localeCompare(b.companyName || ''),
    },
    {
      key: 'contact', label: t('crm.deals.contact'), icon: <Users size={12} />, width: 110, sortable: true,
      render: (deal) => <span className="dt-cell-secondary">{deal.contactName || '-'}</span>,
      searchValue: (deal) => deal.contactName || '',
      compare: (a, b) => (a.contactName || '').localeCompare(b.contactName || ''),
    },
    {
      key: 'value', label: t('crm.deals.value'), icon: <DollarSign size={12} />, width: 100, sortable: true, align: 'right',
      render: (deal) => isEd(deal.id, 'value') ? (
        <InlineEditInput value={String(deal.value)} type="number" onSave={(v) => handleSave(deal.id, 'value', v)} onCancel={() => onEditingCellChange(null)} />
      ) : (
        <span style={{ fontWeight: 'var(--font-weight-medium)', fontSize: 'var(--font-size-sm)', fontVariantNumeric: 'tabular-nums', cursor: 'text' }} onClick={(e) => handleCellClick(deal.id, 'value', e)}>
          {formatCurrency(deal.value, deal.currency)}
        </span>
      ),
      searchValue: (deal) => String(deal.value),
    },
    {
      key: 'stage', label: t('crm.deals.stage'), icon: <LayoutGrid size={12} />, width: 100, sortable: true,
      render: (deal) => isEd(deal.id, 'stage') ? (
        <InlineSelectCell value={deal.stageId} options={stages.map((s) => ({ value: s.id, label: s.name }))} onSave={(v) => handleSave(deal.id, 'stage', v)} onCancel={() => onEditingCellChange(null)} />
      ) : (
        <span style={{ cursor: 'pointer' }} onClick={(e) => handleCellClick(deal.id, 'stage', e)}>
          {deal.stageName && <Badge variant="default"><span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><StatusDot color={deal.stageColor || 'var(--color-text-tertiary)'} size={6} />{deal.stageName}</span></Badge>}
        </span>
      ),
      searchValue: (deal) => deal.stageName || '',
      compare: (a, b) => (a.stageName || '').localeCompare(b.stageName || ''),
    },
    {
      key: 'closeDate', label: t('crm.deals.closeDate'), icon: <Calendar size={12} />, width: 100, sortable: true,
      render: (deal) => isEd(deal.id, 'closeDate') ? (
        <InlineEditInput value={deal.expectedCloseDate || ''} type="date" onSave={(v) => handleSave(deal.id, 'closeDate', v)} onCancel={() => onEditingCellChange(null)} />
      ) : (
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', cursor: 'text' }} onClick={(e) => handleCellClick(deal.id, 'closeDate', e)}>
          {deal.expectedCloseDate ? formatDate(deal.expectedCloseDate) : '-'}
        </span>
      ),
      searchValue: (deal) => deal.expectedCloseDate ? formatDate(deal.expectedCloseDate) : '',
    },
  ];

  return (
    <DataTable
      persistSortKey="crm_deals"
      data={deals}
      columns={dealColumns}
      searchable
      exportable
      columnSelector
      resizableColumns
      storageKey="crm-deals"
      selectable
      selectedIds={selectedIds}
      onSelectionChange={onSelectionChange}
      sort={sort}
      onSortChange={onSortChange}
      activeRowId={selectedId}
      onRowClick={(deal) => { if (!editingCell) onSelect(deal.id); }}
      onAddRow={canEdit ? onAdd : undefined}
      addRowLabel={t('crm.actions.addNew')}
      aggregations={[
        { label: t('crm.deals.total'), compute: (rows) => formatCurrency(rows.reduce((s, d) => s + d.value, 0)) },
        { label: t('crm.deals.avg'), compute: (rows) => formatCurrency(Math.round(rows.reduce((s, d) => s + d.value, 0) / (rows.length || 1))), style: { color: 'var(--color-text-tertiary)', fontWeight: 'var(--font-weight-normal)' } },
        { label: t('crm.deals.avgProbability'), compute: (rows) => `${rows.length ? Math.round(rows.reduce((s, d) => s + (d.probability ?? 0), 0) / rows.length) : 0}%`, style: { color: 'var(--color-text-tertiary)', fontWeight: 'var(--font-weight-normal)' } },
      ]}
      groupBy={groupBy ? (deal) => {
        switch (groupBy) {
          case 'stage': return deal.stageName || 'No stage';
          case 'contact': return deal.contactName || 'No contact';
          case 'company': return deal.companyName || 'No company';
          default: return 'Other';
        }
      } : undefined}
      emptyTitle={t('crm.empty.noMatchingDeals')}
    />
  );
}
