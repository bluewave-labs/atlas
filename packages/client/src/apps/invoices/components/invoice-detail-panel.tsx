import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { formatDate } from '../../../lib/format';
import {
  X, Trash2, DollarSign, FileCode, FileDown, Link, Mail, Download, Eye, Clock,
} from 'lucide-react';
import type { Invoice } from '@atlas-platform/shared';
import { getInvoiceStatusVariant } from '@atlas-platform/shared';
import {
  useDeleteInvoice, useMarkInvoicePaid, useWaiveInvoice, useDuplicateInvoice,
  useInvoiceSettings,
} from '../hooks';
import { SendInvoiceModal } from './send-invoice-modal';
import { ImportTimeEntriesModal } from './import-time-entries-modal';
import { RecordPaymentModal } from './record-payment-modal';
import { InvoicePaymentsList } from './invoice-payments-list';
import { api } from '../../../lib/api-client';
import { useCompanies } from '../../crm/hooks';
import { Button } from '../../../components/ui/button';
import { IconButton } from '../../../components/ui/icon-button';
import { Badge } from '../../../components/ui/badge';
import { StatusTimeline } from '../../../components/shared/status-timeline';
import { TotalsBlock } from '../../../components/shared/totals-block';
import { ConfirmDialog } from '../../../components/ui/confirm-dialog';
import { useToastStore } from '../../../stores/toast-store';
import { useAppActions } from '../../../hooks/use-app-permissions';
import { useAuthStore } from '../../../stores/auth-store';

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

export function InvoiceDetailPanel({ invoice, onClose, onEdit, onPreview }: { invoice: Invoice; onClose: () => void; onEdit: () => void; onPreview?: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { canDelete: isAdmin, canEdit } = useAppActions('invoices');
  const currentUserId = useAuthStore((s) => s.account?.userId ?? null);
  const canDelete = isAdmin || (canEdit && invoice.userId === currentUserId);
  const deleteInvoice = useDeleteInvoice();
  const markPaid = useMarkInvoicePaid();
  const waive = useWaiveInvoice();
  const duplicate = useDuplicateInvoice();
  const { data: settings } = useInvoiceSettings();
  const eFaturaEnabled = settings?.eFaturaEnabled ?? false;
  const { data: companiesData } = useCompanies();
  const companies = companiesData?.companies ?? [];
  const company = companies.find((c) => c.id === invoice.companyId);
  const [linkCopied, setLinkCopied] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [importTimeModalOpen, setImportTimeModalOpen] = useState(false);
  const [recordPaymentOpen, setRecordPaymentOpen] = useState(false);
  const addToast = useToastStore((s) => s.addToast);

  const handleConfirmDelete = () => {
    deleteInvoice.mutate(invoice.id);
    onClose();
  };

  const handleDownloadStandardPdf = async () => {
    try {
      const response = await api.get(`/invoices/${invoice.id}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `${invoice.invoiceNumber || 'invoice'}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      addToast({ type: 'error', message: t('common.error') });
    }
  };

  const statusOrder: Record<string, number> = { draft: 0, sent: 1, viewed: 2, paid: 3, overdue: 1, waived: 3 };
  const currentOrder = statusOrder[invoice.status] ?? 0;

  const timelineSteps = (['draft', 'sent', 'viewed', 'paid'] as const).map((step) => ({
    label: t(`invoices.status.${step}`),
  }));

  const handleDownloadXml = async () => {
    const { data } = await api.get(`/invoices/${invoice.id}/efatura/xml`, { responseType: 'blob' });
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${invoice.invoiceNumber}-efatura.xml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadPdf = async () => {
    const { data } = await api.get(`/invoices/${invoice.id}/efatura/preview`, { responseType: 'blob' });
    const url = URL.createObjectURL(data);
    window.open(url, '_blank');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ padding: '12px var(--spacing-lg)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-secondary)', flexShrink: 0 }}>
        <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'var(--font-family)' }}>
          {t('invoices.detail.invoiceDetail')}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {canDelete && (
            <IconButton icon={<Trash2 size={14} />} label={t('invoices.detail.delete')} size={28} destructive onClick={() => setConfirmDeleteOpen(true)} />
          )}
          <IconButton icon={<X size={14} />} label={t('common.close')} size={28} onClick={onClose} />
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 'var(--spacing-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
            {invoice.invoiceNumber}
          </div>
          <Badge variant={getInvoiceStatusVariant(invoice.status)}>
            {t(`invoices.status.${invoice.status}`)}
          </Badge>
        </div>

        {/* Status timeline */}
        <StatusTimeline steps={timelineSteps} currentIndex={currentOrder} />

        {/* Next action prompt */}
        <div>
          <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: 'var(--font-family)' }}>
            {t('invoices.detail.nextAction')}
          </span>
          <div style={{ marginTop: 'var(--spacing-xs)' }}>
            {invoice.status === 'draft' && (
              <Badge variant="default">{t('invoices.status.draft')}</Badge>
            )}
            {(invoice.status === 'sent' || invoice.status === 'viewed') && canEdit && (
              <Button variant="primary" size="sm" icon={<DollarSign size={13} />} onClick={() => markPaid.mutate(invoice.id)}>
                {t('invoices.detail.markPaid')}
              </Button>
            )}
            {invoice.status === 'overdue' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                <Badge variant="error">{t('invoices.status.overdue')}</Badge>
                {canEdit && (
                  <Button variant="primary" size="sm" icon={<DollarSign size={13} />} onClick={() => markPaid.mutate(invoice.id)}>
                    {t('invoices.detail.markPaid')}
                  </Button>
                )}
              </div>
            )}
            {invoice.status === 'paid' && (
              <Badge variant="success">{t('invoices.status.paid')}</Badge>
            )}
            {invoice.status === 'waived' && (
              <Badge variant="default">{t('invoices.status.waived')}</Badge>
            )}
          </div>
        </div>

        {/* Company info */}
        <div>
          <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: 'var(--font-family)' }}>
            {t('invoices.list.company')}
          </span>
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)', marginTop: 'var(--spacing-xs)' }}>
            {invoice.companyName || '-'}
          </div>
        </div>

        {/* Contact info */}
        {invoice.contactName && (
          <div>
            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: 'var(--font-family)' }}>
              {t('invoices.contact')}
            </span>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)', marginTop: 'var(--spacing-xs)' }}>
              {invoice.contactName}
              {invoice.contactEmail && (
                <span style={{ color: 'var(--color-text-tertiary)', marginLeft: 'var(--spacing-xs)' }}>
                  ({invoice.contactEmail})
                </span>
              )}
            </div>
          </div>
        )}

        {/* Source link */}
        {invoice.dealId && invoice.dealTitle && (
          <div>
            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: 'var(--font-family)' }}>
              {t('invoices.detail.source')}
            </span>
            <div style={{ marginTop: 'var(--spacing-xs)' }}>
              <button
                onClick={() => navigate('/crm?view=deal-detail&dealId=' + invoice.dealId)}
                style={{
                  fontSize: 'var(--font-size-sm)', color: 'var(--color-accent-primary)',
                  fontFamily: 'var(--font-family)', background: 'none', border: 'none',
                  cursor: 'pointer', padding: 0, textDecoration: 'underline',
                }}
              >
                {t('invoices.detail.fromDeal')}: {invoice.dealTitle}
              </button>
            </div>
          </div>
        )}

        {/* Dates */}
        <div style={{ display: 'flex', gap: 'var(--spacing-lg)' }}>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: 'var(--font-family)' }}>
              {t('invoices.list.issueDate')}
            </span>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)', marginTop: 'var(--spacing-xs)' }}>
              {formatDate(invoice.issueDate)}
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: 'var(--font-family)' }}>
              {t('invoices.list.dueDate')}
            </span>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)', marginTop: 'var(--spacing-xs)' }}>
              {formatDate(invoice.dueDate)}
            </div>
          </div>
        </div>

        {/* Line items */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: 'var(--font-family)' }}>
              {t('invoices.detail.lineItems')}
            </span>
            {invoice.status === 'draft' && invoice.companyId && canEdit && (
              <Button
                variant="secondary"
                size="sm"
                icon={<Clock size={13} />}
                onClick={() => setImportTimeModalOpen(true)}
              >
                {t('invoices.importTime.importTimeEntries')}
              </Button>
            )}
          </div>
          <div style={{ marginTop: 'var(--spacing-sm)' }}>
            {(invoice.lineItems || []).map((li, i) => (
              <div key={li.id || i} style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--spacing-xs) 0', borderBottom: '1px solid var(--color-border-secondary)', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family)' }}>
                <span style={{ color: 'var(--color-text-primary)', flex: 1 }}>{li.description}</span>
                <span style={{ color: 'var(--color-text-tertiary)', width: 60, textAlign: 'right' }}>{li.quantity}</span>
                <span style={{ color: 'var(--color-text-primary)', fontWeight: 'var(--font-weight-semibold)', width: 80, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {((li.quantity ?? 0) * (li.unitPrice ?? 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Totals */}
        <TotalsBlock
          subtotal={invoice.subtotal}
          taxPercent={invoice.taxPercent}
          discountPercent={invoice.discountPercent}
        />

        {/* Payments list */}
        {invoice.status !== 'draft' && (
          <InvoicePaymentsList
            invoiceId={invoice.id}
            currency={invoice.currency}
            total={invoice.total}
            balanceDue={invoice.balanceDue ?? invoice.total}
            isDraft={false}
          />
        )}

        {/* E-fatura info */}
        {eFaturaEnabled && invoice.eFaturaStatus && (
          <div style={{ padding: 'var(--spacing-sm)', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: 'var(--font-family)' }}>
                {t('invoices.settings.eFatura')}
              </span>
              <Badge variant={getEFaturaStatusVariant(invoice.eFaturaStatus)}>
                {invoice.eFaturaStatus}
              </Badge>
            </div>
            {invoice.eFaturaUuid && (
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>
                UUID: {invoice.eFaturaUuid}
              </div>
            )}
            {(invoice.eFaturaStatus === 'generated' || invoice.eFaturaStatus === 'submitted' || invoice.eFaturaStatus === 'accepted') && (
              <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
                <IconButton icon={<FileCode size={14} />} label="XML" size={28} onClick={handleDownloadXml} />
                <IconButton icon={<FileDown size={14} />} label="PDF" size={28} onClick={handleDownloadPdf} />
              </div>
            )}
          </div>
        )}

        {/* Share section */}
        {(invoice.status === 'draft' || invoice.status === 'sent') && company?.portalToken && canEdit && (
          <div>
            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: 'var(--font-family)' }}>
              {t('invoices.share')}
            </span>
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginTop: 'var(--spacing-xs)' }}>
              <Button
                variant="secondary"
                size="sm"
                icon={<Link size={13} />}
                onClick={() => {
                  const portalUrl = `${window.location.origin}/api/invoices/portal/${company.portalToken}/${invoice.id}`;
                  navigator.clipboard.writeText(portalUrl);
                  setLinkCopied(true);
                  setTimeout(() => setLinkCopied(false), 2000);
                }}
              >
                {linkCopied ? t('invoices.linkCopied') : t('invoices.copyLink')}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={<Mail size={13} />}
                onClick={() => setSendModalOpen(true)}
              >
                {t('invoices.sendByEmail')}
              </Button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 'var(--spacing-sm)', flexWrap: 'wrap' }}>
          {invoice.status === 'draft' && canEdit && (
            <>
              <Button variant="secondary" size="sm" onClick={onEdit}>{t('common.edit')}</Button>
              <Button variant="primary" size="sm" icon={<Mail size={13} />} onClick={() => setSendModalOpen(true)}>{t('invoices.send.sendInvoice')}</Button>
            </>
          )}
          {(invoice.status === 'sent' || invoice.status === 'viewed' || invoice.status === 'overdue') && canEdit && (
            <>
              <Button variant="primary" size="sm" onClick={() => markPaid.mutate(invoice.id)}>{t('invoices.detail.markPaid')}</Button>
              <Button variant="ghost" size="sm" onClick={() => waive.mutate(invoice.id)}>{t('invoices.detail.waive')}</Button>
            </>
          )}
          {invoice.status !== 'draft' && canEdit && (
            <Button
              variant="secondary"
              size="sm"
              icon={<DollarSign size={13} />}
              onClick={() => setRecordPaymentOpen(true)}
            >
              {t('invoices.payments.recordPayment')}
            </Button>
          )}
          {canEdit && (
            <Button variant="ghost" size="sm" onClick={() => duplicate.mutate(invoice.id)}>{t('invoices.detail.duplicate')}</Button>
          )}
          {onPreview && (
            <Button variant="secondary" size="sm" icon={<Eye size={13} />} onClick={onPreview}>{t('invoices.preview')}</Button>
          )}
          <Button variant="secondary" size="sm" icon={<Download size={13} />} onClick={handleDownloadStandardPdf}>{t('invoices.downloadPdf')}</Button>
        </div>
      </div>

      <RecordPaymentModal
        open={recordPaymentOpen}
        onOpenChange={setRecordPaymentOpen}
        invoiceId={invoice.id}
        currency={invoice.currency}
        total={invoice.total}
        balanceDue={invoice.balanceDue ?? invoice.total}
      />

      <SendInvoiceModal
        open={sendModalOpen}
        onOpenChange={setSendModalOpen}
        invoiceId={invoice.id}
        invoiceNumber={invoice.invoiceNumber}
        defaultRecipient={invoice.contactEmail ?? undefined}
        companyName={invoice.companyName ?? undefined}
      />

      {invoice.companyId && (
        <ImportTimeEntriesModal
          open={importTimeModalOpen}
          onOpenChange={setImportTimeModalOpen}
          invoiceId={invoice.id}
          companyId={invoice.companyId}
          currency={invoice.currency}
        />
      )}

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title={t('invoices.detail.deleteConfirmTitle')}
        description={t('invoices.detail.deleteConfirmDescription', { invoiceNumber: invoice.invoiceNumber })}
        confirmLabel={t('invoices.detail.delete')}
        destructive
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
