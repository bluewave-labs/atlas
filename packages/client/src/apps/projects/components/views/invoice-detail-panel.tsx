import { useTranslation } from 'react-i18next';
import { formatDate, formatCurrency } from '../../../../lib/format';
import {
  X, Trash2, DollarSign, Send, CheckCircle2, FileCode, FileDown,
} from 'lucide-react';
import {
  useDeleteInvoice, useSendInvoice, useMarkInvoicePaid, useWaiveInvoice, useDuplicateInvoice,
  useProjectSettings,
  type Invoice,
  getInvoiceStatusVariant,
} from '../../hooks';
import { api } from '../../../../lib/api-client';
import { Button } from '../../../../components/ui/button';
import { IconButton } from '../../../../components/ui/icon-button';
import { Badge } from '../../../../components/ui/badge';

function getEFaturaStatusVariant(status: string): 'default' | 'primary' | 'success' | 'warning' | 'error' {
  switch (status) {
    case 'draft': return 'default';
    case 'generated': return 'primary';
    case 'submitted': return 'warning';
    case 'accepted': return 'success';
    case 'rejected': return 'error';
    default: return 'default';
  }
}

export function InvoiceDetailPanel({ invoice, onClose, onEdit }: { invoice: Invoice; onClose: () => void; onEdit: () => void }) {
  const { t } = useTranslation();
  const deleteInvoice = useDeleteInvoice();
  const sendInvoice = useSendInvoice();
  const markPaid = useMarkInvoicePaid();
  const waive = useWaiveInvoice();
  const duplicate = useDuplicateInvoice();
  const { data: settings } = useProjectSettings();
  const eFaturaEnabled = settings?.eFaturaEnabled ?? false;

  const handleDownloadXml = () => {
    window.open(`${api.defaults.baseURL}/projects/invoices/${invoice.id}/efatura/xml`, '_blank');
  };

  const handleDownloadPdf = () => {
    window.open(`${api.defaults.baseURL}/projects/invoices/${invoice.id}/efatura/pdf`, '_blank');
  };

  return (
    <div className="projects-detail-panel">
      <div style={{ padding: '12px var(--spacing-lg)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-secondary)', flexShrink: 0 }}>
        <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'var(--font-family)' }}>
          {t('projects.invoices.invoiceDetail')}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <IconButton icon={<Trash2 size={14} />} label={t('projects.actions.delete')} size={28} destructive onClick={() => { deleteInvoice.mutate(invoice.id); onClose(); }} />
          <IconButton icon={<X size={14} />} label={t('common.close')} size={28} onClick={onClose} />
        </div>
      </div>
      <div className="projects-detail-body">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
            {invoice.invoiceNumber}
          </div>
          <Badge variant={getInvoiceStatusVariant(invoice.status)}>
            {t(`projects.status.${invoice.status}`)}
          </Badge>
        </div>

        {/* Status timeline */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, padding: 'var(--spacing-sm) 0' }}>
          {(['draft', 'sent', 'viewed', 'paid'] as const).map((step, i) => {
            const statusOrder = { draft: 0, sent: 1, viewed: 2, paid: 3, overdue: 1, waived: 3 } as const;
            const currentOrder = statusOrder[invoice.status as keyof typeof statusOrder] ?? 0;
            const stepOrder = statusOrder[step];
            const isActive = stepOrder <= currentOrder;
            const isCurrent = (invoice.status === 'overdue' && step === 'sent') || (invoice.status === 'waived' && step === 'paid') || step === invoice.status;
            return (
              <div key={step} style={{ display: 'flex', alignItems: 'center', flex: i < 3 ? 1 : undefined }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  backgroundColor: isActive ? (invoice.status === 'overdue' && step === 'sent' ? 'var(--color-error)' : 'var(--color-accent-primary)') : 'var(--color-bg-tertiary)',
                  color: isActive ? '#fff' : 'var(--color-text-tertiary)',
                  fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', fontFamily: 'var(--font-family)',
                  border: isCurrent ? '2px solid var(--color-accent-primary)' : 'none',
                }}>
                  {isActive ? <CheckCircle2 size={12} /> : (i + 1)}
                </div>
                <span style={{ fontSize: 'var(--font-size-xs)', color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)', marginLeft: 'var(--spacing-xs)', whiteSpace: 'nowrap' }}>
                  {t(`projects.status.${step}`)}
                </span>
                {i < 3 && (
                  <div style={{ flex: 1, height: 2, backgroundColor: isActive ? 'var(--color-accent-primary)' : 'var(--color-bg-tertiary)', margin: '0 var(--spacing-xs)' }} />
                )}
              </div>
            );
          })}
        </div>

        {/* Next action prompt */}
        <div style={{ padding: 'var(--spacing-sm) 0' }}>
          <span className="projects-detail-field-label">{t('projects.invoices.nextAction')}</span>
          <div style={{ marginTop: 'var(--spacing-xs)' }}>
            {invoice.status === 'draft' && (
              <Button variant="primary" size="sm" icon={<Send size={13} />} onClick={() => sendInvoice.mutate(invoice.id)}>
                {t('projects.invoices.sendInvoice')}
              </Button>
            )}
            {(invoice.status === 'sent' || invoice.status === 'viewed') && (
              <Button variant="primary" size="sm" icon={<DollarSign size={13} />} onClick={() => markPaid.mutate(invoice.id)}>
                {t('projects.invoices.markPaid')}
              </Button>
            )}
            {invoice.status === 'overdue' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                <Badge variant="error">{t('projects.dashboard.overdue')}</Badge>
                <Button variant="primary" size="sm" icon={<DollarSign size={13} />} onClick={() => markPaid.mutate(invoice.id)}>
                  {t('projects.invoices.markPaid')}
                </Button>
              </div>
            )}
            {invoice.status === 'paid' && (
              <Badge variant="success">{t('projects.status.paid')}</Badge>
            )}
            {invoice.status === 'waived' && (
              <Badge variant="default">{t('projects.status.waived')}</Badge>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
          <div className="projects-detail-field">
            <span className="projects-detail-field-label">{t('projects.invoices.client')}</span>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
              {invoice.clientName || '-'}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 'var(--spacing-lg)' }}>
            <div className="projects-detail-field" style={{ flex: 1 }}>
              <span className="projects-detail-field-label">{t('projects.invoices.issueDate')}</span>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
                {formatDate(invoice.issueDate)}
              </div>
            </div>
            <div className="projects-detail-field" style={{ flex: 1 }}>
              <span className="projects-detail-field-label">{t('projects.invoices.dueDate')}</span>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
                {formatDate(invoice.dueDate)}
              </div>
            </div>
          </div>

          {/* Line items */}
          <div>
            <span className="projects-detail-field-label">{t('projects.invoices.lineItems')}</span>
            <div style={{ marginTop: 'var(--spacing-sm)' }}>
              {(invoice.lineItems || []).map((li, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--spacing-xs) 0', borderBottom: '1px solid var(--color-border-secondary)', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family)' }}>
                  <span style={{ color: 'var(--color-text-primary)', flex: 1 }}>{li.description}</span>
                  <span style={{ color: 'var(--color-text-tertiary)', width: 60, textAlign: 'right' }}>{li.quantity}h</span>
                  <span style={{ color: 'var(--color-text-tertiary)', width: 80, textAlign: 'right' }}>{formatCurrency(li.unitPrice)}</span>
                  <span style={{ color: 'var(--color-text-primary)', fontWeight: 'var(--font-weight-semibold)', width: 80, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(li.amount)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="projects-invoice-totals">
            <div className="projects-invoice-totals-row">
              <span className="projects-invoice-totals-label">{t('projects.invoices.subtotal')}</span>
              <span className="projects-invoice-totals-value">{formatCurrency(invoice.subtotal)}</span>
            </div>
            {invoice.taxPercent > 0 && (
              <div className="projects-invoice-totals-row">
                <span className="projects-invoice-totals-label">{t('projects.invoices.tax')} ({invoice.taxPercent}%)</span>
                <span className="projects-invoice-totals-value">{formatCurrency(invoice.taxAmount)}</span>
              </div>
            )}
            {invoice.discountPercent > 0 && (
              <div className="projects-invoice-totals-row">
                <span className="projects-invoice-totals-label">{t('projects.invoices.discount')} ({invoice.discountPercent}%)</span>
                <span className="projects-invoice-totals-value">-{formatCurrency(invoice.discountAmount)}</span>
              </div>
            )}
            <div className="projects-invoice-totals-row" style={{ borderTop: '1px solid var(--color-border-secondary)', paddingTop: 'var(--spacing-sm)' }}>
              <span className="projects-invoice-totals-label">{t('projects.invoices.total')}</span>
              <span className="projects-invoice-totals-total">{formatCurrency(invoice.total)}</span>
            </div>
          </div>

          {/* E-fatura info */}
          {eFaturaEnabled && invoice.eFaturaStatus && (
            <div style={{ padding: 'var(--spacing-sm)', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: 'var(--font-family)' }}>
                  {t('projects.efatura.title')}
                </span>
                <Badge variant={getEFaturaStatusVariant(invoice.eFaturaStatus)}>
                  {t(`projects.efatura.status.${invoice.eFaturaStatus}`)}
                </Badge>
              </div>
              {invoice.eFaturaUuid && (
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>
                  UUID: {invoice.eFaturaUuid}
                </div>
              )}
              {(invoice.eFaturaStatus === 'generated' || invoice.eFaturaStatus === 'submitted' || invoice.eFaturaStatus === 'accepted') && (
                <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
                  <IconButton icon={<FileCode size={14} />} label={t('projects.efatura.downloadXml')} size={28} onClick={handleDownloadXml} />
                  <IconButton icon={<FileDown size={14} />} label={t('projects.efatura.downloadPdf')} size={28} onClick={handleDownloadPdf} />
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 'var(--spacing-sm)', flexWrap: 'wrap' }}>
            {invoice.status === 'draft' && (
              <>
                <Button variant="secondary" size="sm" onClick={onEdit}>{t('projects.actions.edit')}</Button>
                <Button variant="primary" size="sm" onClick={() => sendInvoice.mutate(invoice.id)}>{t('projects.invoices.send')}</Button>
              </>
            )}
            {(invoice.status === 'sent' || invoice.status === 'viewed' || invoice.status === 'overdue') && (
              <>
                <Button variant="primary" size="sm" onClick={() => markPaid.mutate(invoice.id)}>{t('projects.invoices.markPaid')}</Button>
                <Button variant="ghost" size="sm" onClick={() => waive.mutate(invoice.id)}>{t('projects.invoices.waive')}</Button>
              </>
            )}
            <Button variant="ghost" size="sm" onClick={() => duplicate.mutate(invoice.id)}>{t('projects.invoices.duplicate')}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
