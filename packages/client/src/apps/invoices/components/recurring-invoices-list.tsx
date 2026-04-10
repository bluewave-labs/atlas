import { useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Play, Pause, Edit2, Trash2, Send, Mail, Repeat } from 'lucide-react';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { IconButton } from '../../../components/ui/icon-button';
import { ConfirmDialog } from '../../../components/ui/confirm-dialog';
import { Tooltip } from '../../../components/ui/tooltip';
import { RecurringInvoiceModal } from './recurring-invoice-modal';
import {
  useRecurringInvoicesList,
  usePauseRecurringInvoice,
  useResumeRecurringInvoice,
  useRunRecurringInvoiceNow,
  useDeleteRecurringInvoice,
} from '../hooks';
import { useToastStore } from '../../../stores/toast-store';
import type { RecurringInvoice, RecurrenceFrequency } from '@atlas-platform/shared';

function formatDate(value: Date | string | null | undefined): string {
  if (!value) return '-';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: 'var(--spacing-lg)',
  borderBottom: '1px solid var(--color-border-secondary)',
  flexShrink: 0,
};

const pageTitleStyle: CSSProperties = {
  fontSize: 'var(--font-size-lg)',
  fontWeight: 'var(--font-weight-semibold)',
  color: 'var(--color-text-primary)',
  fontFamily: 'var(--font-family)',
};

const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontFamily: 'var(--font-family)',
  fontSize: 'var(--font-size-sm)',
};

const thStyle: CSSProperties = {
  textAlign: 'left',
  padding: 'var(--spacing-sm) var(--spacing-md)',
  borderBottom: '1px solid var(--color-border-secondary)',
  fontSize: 'var(--font-size-xs)',
  fontWeight: 'var(--font-weight-semibold)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: 'var(--color-text-tertiary)',
  background: 'var(--color-bg-secondary)',
};

const tdStyle: CSSProperties = {
  padding: 'var(--spacing-sm) var(--spacing-md)',
  borderBottom: '1px solid var(--color-border-secondary)',
  color: 'var(--color-text-primary)',
  verticalAlign: 'middle',
};

export function RecurringInvoicesList() {
  const { t } = useTranslation();
  const addToast = useToastStore((s) => s.addToast);
  const { data: recurringList = [], isLoading } = useRecurringInvoicesList();
  const pauseMutation = usePauseRecurringInvoice();
  const resumeMutation = useResumeRecurringInvoice();
  const runNowMutation = useRunRecurringInvoiceNow();
  const deleteMutation = useDeleteRecurringInvoice();

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<RecurringInvoice | null>(null);
  const [deleting, setDeleting] = useState<RecurringInvoice | null>(null);

  const handleFrequencyLabel = (freq: RecurrenceFrequency): string => {
    switch (freq) {
      case 'weekly':
        return t('invoices.recurring.frequencyWeekly');
      case 'monthly':
        return t('invoices.recurring.frequencyMonthly');
      case 'quarterly':
        return t('invoices.recurring.frequencyQuarterly');
      case 'yearly':
        return t('invoices.recurring.frequencyYearly');
      default:
        return freq;
    }
  };

  const handleTogglePause = (item: RecurringInvoice) => {
    const onError = () => addToast({ type: 'error', message: t('common.error') });
    if (item.isActive) {
      pauseMutation.mutate(item.id, {
        onSuccess: () => addToast({ type: 'success', message: t('invoices.recurring.pauseSuccess') }),
        onError,
      });
    } else {
      resumeMutation.mutate(item.id, {
        onSuccess: () => addToast({ type: 'success', message: t('invoices.recurring.resumeSuccess') }),
        onError,
      });
    }
  };

  const handleRunNow = (item: RecurringInvoice) => {
    runNowMutation.mutate(item.id, {
      onSuccess: (result) => {
        addToast({
          type: 'success',
          message: result.emailed
            ? t('invoices.recurring.runNowEmailed')
            : t('invoices.recurring.runNowSuccess'),
        });
      },
      onError: () => addToast({ type: 'error', message: t('common.error') }),
    });
  };

  const handleConfirmDelete = () => {
    if (!deleting) return;
    deleteMutation.mutate(deleting.id, {
      onSuccess: () => {
        addToast({ type: 'success', message: t('invoices.recurring.deleteSuccess') });
        setDeleting(null);
      },
      onError: () => addToast({ type: 'error', message: t('common.error') }),
    });
  };

  const handleOpenCreate = () => {
    setEditing(null);
    setShowModal(true);
  };

  const handleOpenEdit = (item: RecurringInvoice) => {
    setEditing(item);
    setShowModal(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={headerStyle}>
        <div style={pageTitleStyle}>{t('invoices.recurring.pageTitle')}</div>
        <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={handleOpenCreate}>
          {t('invoices.recurring.createButton')}
        </Button>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {isLoading ? null : recurringList.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--spacing-md)',
              padding: 'var(--spacing-2xl)',
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-family)',
              textAlign: 'center',
              minHeight: 240,
            }}
          >
            <Repeat size={32} style={{ color: 'var(--color-text-tertiary)' }} />
            <div
              style={{
                fontSize: 'var(--font-size-lg)',
                fontWeight: 'var(--font-weight-semibold)',
                color: 'var(--color-text-primary)',
              }}
            >
              {t('invoices.recurring.emptyTitle')}
            </div>
            <div
              style={{
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-secondary)',
                maxWidth: 420,
              }}
            >
              {t('invoices.recurring.emptyDescription')}
            </div>
          </div>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>{t('invoices.recurring.columnTitle')}</th>
                <th style={thStyle}>{t('invoices.recurring.columnFrequency')}</th>
                <th style={thStyle}>{t('invoices.recurring.columnNextRun')}</th>
                <th style={thStyle}>{t('invoices.recurring.columnStatus')}</th>
                <th style={thStyle}>{t('invoices.recurring.columnRunCount')}</th>
                <th style={{ ...thStyle, width: 40 }}></th>
                <th style={{ ...thStyle, width: 160, textAlign: 'right' }}></th>
              </tr>
            </thead>
            <tbody>
              {recurringList.map((item) => (
                <tr key={item.id}>
                  <td style={tdStyle}>
                    <div
                      style={{
                        fontWeight: 'var(--font-weight-medium)',
                        color: 'var(--color-text-primary)',
                      }}
                    >
                      {item.title}
                    </div>
                    {item.description && (
                      <div
                        style={{
                          fontSize: 'var(--font-size-xs)',
                          color: 'var(--color-text-tertiary)',
                        }}
                      >
                        {item.description}
                      </div>
                    )}
                  </td>
                  <td style={tdStyle}>{handleFrequencyLabel(item.frequency)}</td>
                  <td style={tdStyle}>{formatDate(item.nextRunAt)}</td>
                  <td style={tdStyle}>
                    <Badge variant={item.isActive ? 'success' : 'default'}>
                      {item.isActive
                        ? t('invoices.recurring.statusActive')
                        : t('invoices.recurring.statusPaused')}
                    </Badge>
                  </td>
                  <td style={tdStyle}>
                    {t('invoices.recurring.runCountDisplay', { count: item.runCount })}
                  </td>
                  <td style={tdStyle}>
                    {item.autoSend ? (
                      <Tooltip content={t('invoices.recurring.autoSendOn')}>
                        <Mail size={14} style={{ color: 'var(--color-accent-primary)' }} />
                      </Tooltip>
                    ) : null}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: 'var(--spacing-xs)' }}>
                      <IconButton
                        icon={item.isActive ? <Pause size={14} /> : <Play size={14} />}
                        label={
                          item.isActive
                            ? t('invoices.recurring.actionPause')
                            : t('invoices.recurring.actionResume')
                        }
                        size={28}
                        onClick={() => handleTogglePause(item)}
                      />
                      <IconButton
                        icon={<Send size={14} />}
                        label={t('invoices.recurring.actionRunNow')}
                        size={28}
                        onClick={() => handleRunNow(item)}
                      />
                      <IconButton
                        icon={<Edit2 size={14} />}
                        label={t('invoices.recurring.actionEdit')}
                        size={28}
                        onClick={() => handleOpenEdit(item)}
                      />
                      <IconButton
                        icon={<Trash2 size={14} />}
                        label={t('invoices.recurring.actionDelete')}
                        size={28}
                        destructive
                        onClick={() => setDeleting(item)}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <RecurringInvoiceModal
        open={showModal}
        onOpenChange={(open) => {
          setShowModal(open);
          if (!open) setEditing(null);
        }}
        recurringInvoice={editing}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title={t('invoices.recurring.deleteConfirmTitle')}
        description={t('invoices.recurring.deleteConfirmMessage')}
        confirmLabel={t('invoices.recurring.actionDelete')}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
