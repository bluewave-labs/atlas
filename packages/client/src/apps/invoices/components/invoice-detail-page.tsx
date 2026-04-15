import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/ui/button';
import { ContentArea } from '../../../components/ui/content-area';
import { useToastStore } from '../../../stores/toast-store';
import {
  useInvoice, useUpdateInvoice, useDeleteInvoice,
  useMarkInvoicePaid, useWaiveInvoice, useDuplicateInvoice,
} from '../hooks';
import { useInvoiceDetailSplit } from '../hooks/use-invoice-detail-split';
import { InvoiceDetailHeader } from './invoice-detail-header';
import { InvoicePdfViewer } from './invoice-pdf-viewer';
import { InvoiceMetaBlock } from './invoice-meta-block';
import { InvoiceLineItemsTable, type LineItem } from './invoice-line-items-table';
import { InvoicePaymentsList } from './invoice-payments-list';
import { StatusTimeline } from '../../../components/shared/status-timeline';
import { TotalsBlock } from '../../../components/shared/totals-block';
import { SendInvoiceModal } from './send-invoice-modal';
import { RecordPaymentModal } from './record-payment-modal';
import { ConfirmDialog } from '../../../components/ui/confirm-dialog';
import { useCompanies } from '../../crm/hooks';
import type { Invoice } from '@atlas-platform/shared';

interface Props {
  invoiceId: string;
  onBack: () => void;
}

/** Maps an invoice status to its 0-based step index in the status timeline. */
function statusToIndex(status: Invoice['status']): number {
  switch (status) {
    case 'draft':   return 0;
    case 'sent':    return 1;
    case 'viewed':  return 2;
    case 'paid':    return 3;
    case 'waived':  return 3;
    case 'overdue': return 1;
    default:        return 0;
  }
}

export function InvoiceDetailPage({ invoiceId, onBack }: Props) {
  const { t } = useTranslation();
  const { data: invoice, isLoading } = useInvoice(invoiceId);
  const { data: companiesData } = useCompanies();
  const updateInvoice = useUpdateInvoice();
  const deleteInvoice = useDeleteInvoice();
  const markPaid = useMarkInvoicePaid();
  const waive = useWaiveInvoice();
  const duplicate = useDuplicateInvoice();
  const addToast = useToastStore((s) => s.addToast);

  const { pdfPercent, setPdfPercent, MIN_PDF_PERCENT, MAX_PDF_PERCENT } = useInvoiceDetailSplit();
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const patch = useCallback((body: Record<string, unknown>) => {
    if (!invoice) return;
    updateInvoice.mutate(
      { id: invoice.id, updatedAt: invoice.updatedAt, ...body } as Parameters<typeof updateInvoice.mutate>[0],
      {
        onError: () => addToast({ type: 'error', message: t('invoices.detail.saveFailed') }),
      },
    );
  }, [invoice, updateInvoice, addToast, t]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging) return;
    const container = splitContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const pct = ((e.clientX - rect.left) / rect.width) * 100;
    setPdfPercent(pct);
  }, [dragging, setPdfPercent]);

  const handleMouseUp = useCallback(() => {
    setDragging(false);
  }, []);

  useEffect(() => {
    if (!dragging) return;
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, handleMouseMove, handleMouseUp]);

  const downloadPdf = () => {
    const token = localStorage.getItem('atlasmail_token');
    window.open(
      `/api/v1/invoices/${invoiceId}/pdf${token ? `?token=${encodeURIComponent(token)}` : ''}`,
      '_blank',
    );
  };

  if (isLoading) {
    return (
      <ContentArea title="">
        <div style={{ padding: 32 }}>{t('common.loading')}</div>
      </ContentArea>
    );
  }

  if (!invoice) {
    return (
      <ContentArea title="">
        <div style={{ padding: 32, textAlign: 'center' }}>
          <p style={{ marginBottom: 16 }}>{t('invoices.detail.notFound')}</p>
          <Button variant="secondary" onClick={onBack}>{t('invoices.detail.backToList')}</Button>
        </div>
      </ContentArea>
    );
  }

  const lineItems = (invoice.lineItems ?? []) as LineItem[];
  const balanceDue = invoice.balanceDue ?? 0;

  // Build StatusTimeline steps
  const timelineSteps = [
    { label: t('invoices.status.draft'), timestamp: invoice.createdAt ? new Date(invoice.createdAt).toLocaleDateString() : undefined },
    { label: t('invoices.status.sent'), timestamp: invoice.sentAt ? new Date(invoice.sentAt).toLocaleDateString() : undefined },
    { label: t('invoices.status.viewed'), timestamp: invoice.viewedAt ? new Date(invoice.viewedAt).toLocaleDateString() : undefined },
    { label: invoice.status === 'waived' ? t('invoices.status.waived') : t('invoices.status.paid'), timestamp: invoice.paidAt ? new Date(invoice.paidAt).toLocaleDateString() : undefined },
  ];

  return (
    <>
      <ContentArea
        headerSlot={
          <InvoiceDetailHeader
            invoice={invoice}
            onBack={onBack}
            onSend={() => setShowSendModal(true)}
            onRecordPayment={() => setShowPaymentModal(true)}
            onDownloadPdf={downloadPdf}
            onDuplicate={() => duplicate.mutate(invoice.id)}
            onMarkPaid={() => markPaid.mutate(invoice.id)}
            onWaive={() => waive.mutate(invoice.id)}
            onDelete={() => setConfirmDelete(true)}
            onShareLink={() => {
              const companies = companiesData?.companies ?? [];
              const company = companies.find((c) => c.id === invoice.companyId);
              if (!company?.portalToken) {
                addToast({ type: 'error', message: t('invoices.detail.shareNoCompany') });
                return;
              }
              const portalUrl = `${window.location.origin}/api/invoices/portal/${company.portalToken}/${invoice.id}`;
              navigator.clipboard.writeText(portalUrl);
              addToast({ type: 'success', message: t('invoices.linkCopied') });
            }}
            onImportTime={() => {}}
          />
        }
      >
        <div
          ref={splitContainerRef}
          style={{ display: 'flex', flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}
        >
          {/* PDF pane */}
          <div style={{ width: `${pdfPercent}%`, display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>
            <InvoicePdfViewer invoiceId={invoice.id} updatedAt={invoice.updatedAt} />
          </div>

          {/* Drag handle */}
          <div
            role="separator"
            aria-orientation="vertical"
            aria-valuemin={MIN_PDF_PERCENT}
            aria-valuemax={MAX_PDF_PERCENT}
            aria-valuenow={Math.round(pdfPercent)}
            onMouseDown={handleMouseDown}
            style={{ width: 4, cursor: 'col-resize', background: 'var(--color-border-secondary)', flexShrink: 0 }}
          />

          {/* Drag overlay — captures mouse when dragging outside the handle */}
          {dragging && (
            <div style={{ position: 'absolute', inset: 0, cursor: 'col-resize', zIndex: 10 }} />
          )}

          {/* Details pane */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto', minWidth: 0 }}>
            <InvoiceMetaBlock invoice={invoice} onPatch={patch} />

            <InvoiceLineItemsTable
              lineItems={lineItems}
              onReplaceLineItems={(next) => patch({ lineItems: next })}
            />

            <div style={{ padding: 'var(--spacing-md)', borderBottom: '1px solid var(--color-border-secondary)' }}>
              <TotalsBlock
                subtotal={Number(invoice.subtotal) || 0}
                taxPercent={Number(invoice.taxPercent) || 0}
                discountPercent={Number(invoice.discountPercent) || 0}
                currency={invoice.currency}
                editable={invoice.status === 'draft'}
                onTaxChange={(val) => patch({ taxPercent: val })}
                onDiscountChange={(val) => patch({ discountPercent: val })}
              />
            </div>

            <div style={{ padding: 'var(--spacing-md)', borderBottom: '1px solid var(--color-border-secondary)' }}>
              <div style={{
                fontSize: 'var(--font-size-xs)',
                color: 'var(--color-text-tertiary)',
                textTransform: 'uppercase',
                fontWeight: 'var(--font-weight-semibold)' as React.CSSProperties['fontWeight'],
                letterSpacing: '0.05em',
                marginBottom: 'var(--spacing-sm)',
              }}>
                {t('invoices.detail.sectionNotes')}
              </div>
              <textarea
                defaultValue={invoice.notes ?? ''}
                onBlur={(e) => {
                  const next = e.currentTarget.value;
                  if (next !== (invoice.notes ?? '')) patch({ notes: next });
                }}
                style={{
                  width: '100%',
                  minHeight: 80,
                  padding: 'var(--spacing-sm)',
                  border: '1px solid var(--color-border-primary)',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--color-bg-primary)',
                  color: 'var(--color-text-primary)',
                  fontFamily: 'var(--font-family)',
                  fontSize: 'var(--font-size-sm)',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ padding: 'var(--spacing-md)', borderBottom: '1px solid var(--color-border-secondary)' }}>
              <InvoicePaymentsList
                invoiceId={invoice.id}
                currency={invoice.currency}
                total={Number(invoice.total) || 0}
                balanceDue={balanceDue}
                isDraft={invoice.status === 'draft'}
              />
            </div>

            <div style={{ padding: 'var(--spacing-md)' }}>
              <StatusTimeline
                steps={timelineSteps}
                currentIndex={statusToIndex(invoice.status)}
              />
            </div>
          </div>
        </div>
      </ContentArea>

      <SendInvoiceModal
        open={showSendModal}
        onOpenChange={setShowSendModal}
        invoiceId={invoice.id}
        invoiceNumber={invoice.invoiceNumber}
        defaultRecipient={invoice.contactEmail ?? undefined}
        companyName={invoice.companyName}
      />

      <RecordPaymentModal
        open={showPaymentModal}
        onOpenChange={setShowPaymentModal}
        invoiceId={invoice.id}
        currency={invoice.currency}
        total={Number(invoice.total) || 0}
        balanceDue={balanceDue}
      />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t('invoices.detail.actionDelete')}
        description={t('invoices.detail.deleteConfirmMessage')}
        destructive
        onConfirm={() => {
          deleteInvoice.mutate(invoice.id, { onSuccess: onBack });
        }}
      />
    </>
  );
}
