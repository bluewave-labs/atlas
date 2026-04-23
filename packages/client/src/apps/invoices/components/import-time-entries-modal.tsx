import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw } from 'lucide-react';
import { Modal } from '../../../components/ui/modal';
import { Input } from '../../../components/ui/input';
import { Select } from '../../../components/ui/select';
import { Button } from '../../../components/ui/button';
import { DataTable, type DataTableColumn } from '../../../components/ui/data-table';
import { useToastStore } from '../../../stores/toast-store';
import {
  usePreviewTimeEntries,
  usePopulateFromTimeEntries,
  type TimeEntryLineItemPreview,
} from '../../work/hooks';

interface ImportTimeEntriesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  companyId: string;
  currency?: string;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function defaultRange(): { from: string; to: string } {
  const today = new Date();
  const past = new Date();
  past.setDate(today.getDate() - 90);
  return { from: isoDate(past), to: isoDate(today) };
}

export function ImportTimeEntriesModal({
  open,
  onOpenChange,
  invoiceId,
  companyId,
  currency,
}: ImportTimeEntriesModalProps) {
  const { t } = useTranslation();
  const addToast = useToastStore((s) => s.addToast);
  const preview = usePreviewTimeEntries();
  const populate = usePopulateFromTimeEntries();

  const [range, setRange] = useState(defaultRange);
  const [projectFilter, setProjectFilter] = useState<string>('');
  const [rows, setRows] = useState<TimeEntryLineItemPreview[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const refresh = (from: string, to: string) => {
    preview.mutate(
      { companyId, startDate: from, endDate: to },
      {
        onSuccess: (data) => {
          setRows(data);
          setSelected(new Set(data.map((r) => r.id)));
        },
        onError: () => {
          addToast({ type: 'error', message: t('common.error') });
        },
      },
    );
  };

  useEffect(() => {
    if (open && companyId) {
      const r = defaultRange();
      setRange(r);
      setProjectFilter('');
      setRows([]);
      setSelected(new Set());
      refresh(r.from, r.to);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, companyId]);

  const filteredRows = useMemo(
    () => (projectFilter ? rows.filter((r) => r.projectId === projectFilter) : rows),
    [rows, projectFilter],
  );

  const projectOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) map.set(r.projectId, r.projectName || r.projectId);
    return [
      { value: '', label: t('invoices.importTime.allProjects') },
      ...Array.from(map.entries()).map(([value, label]) => ({ value, label })),
    ];
  }, [rows, t]);

  const selectedRows = filteredRows.filter((r) => selected.has(r.id));
  const totalAmount = selectedRows.reduce((sum, r) => sum + r.quantity * r.unitPrice, 0);
  const currencyLabel = currency || '';

  const handleSubmit = () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    populate.mutate(
      {
        invoiceId,
        companyId,
        startDate: range.from,
        endDate: range.to,
        timeEntryIds: ids,
      },
      {
        onSuccess: () => {
          addToast({
            type: 'success',
            message: t('invoices.importTime.importSuccess', { count: ids.length }),
          });
          onOpenChange(false);
        },
        onError: (err: unknown) => {
          const reason =
            (err as { message?: string })?.message ?? t('common.error');
          addToast({
            type: 'error',
            message: t('invoices.importTime.importFailed', { reason }),
          });
        },
      },
    );
  };

  const isLoading = preview.isPending;
  const isSubmitting = populate.isPending;

  const columns: DataTableColumn<TimeEntryLineItemPreview>[] = [
    {
      key: 'projectName',
      label: t('invoices.importTime.tableHeaderProject'),
      minWidth: 100,
      render: (row) => <span>{row.projectName}</span>,
      searchValue: (row) => row.projectName,
      compare: (a, b) => a.projectName.localeCompare(b.projectName),
    },
    {
      key: 'workDate',
      label: t('invoices.importTime.tableHeaderDate'),
      width: 100,
      render: (row) => <span>{row.workDate}</span>,
      searchValue: (row) => row.workDate,
      compare: (a, b) => a.workDate.localeCompare(b.workDate),
    },
    {
      key: 'description',
      label: t('invoices.importTime.tableHeaderDescription'),
      minWidth: 120,
      render: (row) => <span>{row.description}</span>,
      searchValue: (row) => row.description,
    },
    {
      key: 'quantity',
      label: t('invoices.importTime.tableHeaderHours'),
      width: 80,
      align: 'right',
      render: (row) => (
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{row.quantity.toFixed(2)}</span>
      ),
      compare: (a, b) => a.quantity - b.quantity,
    },
    {
      key: 'unitPrice',
      label: t('invoices.importTime.tableHeaderRate'),
      width: 80,
      align: 'right',
      render: (row) => (
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{row.unitPrice.toFixed(2)}</span>
      ),
      compare: (a, b) => a.unitPrice - b.unitPrice,
    },
    {
      key: 'amount',
      label: t('invoices.importTime.tableHeaderAmount'),
      width: 90,
      align: 'right',
      render: (row) => (
        <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 'var(--font-weight-semibold)' as CSSProperties['fontWeight'] }}>
          {(row.quantity * row.unitPrice).toFixed(2)}
        </span>
      ),
      compare: (a, b) => (a.quantity * a.unitPrice) - (b.quantity * b.unitPrice),
    },
  ];

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      width={680}
      title={t('invoices.importTime.importTimeEntries')}
    >
      <Modal.Header title={t('invoices.importTime.importTimeEntries')} />
      <Modal.Body>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          <div
            style={{
              display: 'flex',
              gap: 'var(--spacing-sm)',
              alignItems: 'flex-end',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
              <label
                style={{
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 'var(--font-weight-semibold)' as CSSProperties['fontWeight'],
                  color: 'var(--color-text-tertiary)',
                  fontFamily: 'var(--font-family)',
                }}
              >
                {t('invoices.importTime.from')}
              </label>
              <Input
                type="date"
                size="sm"
                value={range.from}
                onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
              <label
                style={{
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 'var(--font-weight-semibold)' as CSSProperties['fontWeight'],
                  color: 'var(--color-text-tertiary)',
                  fontFamily: 'var(--font-family)',
                }}
              >
                {t('invoices.importTime.to')}
              </label>
              <Input
                type="date"
                size="sm"
                value={range.to}
                onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)', minWidth: 180 }}>
              <label
                style={{
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 'var(--font-weight-semibold)' as CSSProperties['fontWeight'],
                  color: 'var(--color-text-tertiary)',
                  fontFamily: 'var(--font-family)',
                }}
              >
                {t('invoices.importTime.projectFilter')}
              </label>
              <Select
                size="sm"
                value={projectFilter}
                onChange={setProjectFilter}
                options={projectOptions}
              />
            </div>
            <Button
              variant="secondary"
              size="sm"
              icon={<RefreshCw size={13} />}
              onClick={() => refresh(range.from, range.to)}
              disabled={isLoading}
            >
              {t('invoices.importTime.refresh')}
            </Button>
          </div>

          <div
            style={{
              border: '1px solid var(--color-border-secondary)',
              borderRadius: 'var(--radius-md)',
              overflow: 'auto',
              maxHeight: 360,
            }}
          >
            <DataTable
              data={filteredRows}
              columns={columns}
              storageKey="invoices_time_entries_import"
              paginated={false}
              searchable={false}
              selectable
              selectedIds={selected}
              onSelectionChange={setSelected}
              emptyTitle={t('invoices.importTime.noUnbilledEntries')}
              hideFooter
            />
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-family)',
            }}
          >
            <span>
              {t('invoices.importTime.selectedSummary', {
                selected: selectedRows.length,
                total: filteredRows.length,
              })}
            </span>
            <span
              style={{
                fontWeight: 'var(--font-weight-semibold)' as CSSProperties['fontWeight'],
                color: 'var(--color-text-primary)',
              }}
            >
              {t('invoices.importTime.totalLabel')}:{' '}
              {totalAmount.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{' '}
              {currencyLabel}
            </span>
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
          {t('invoices.importTime.cancel')}
        </Button>
        <Button
          variant="primary"
          onClick={handleSubmit}
          disabled={isSubmitting || selectedRows.length === 0}
        >
          {t('invoices.importTime.addToInvoice')}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
