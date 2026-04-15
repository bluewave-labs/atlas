import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Send, Download, DollarSign, Copy as CopyIcon, Trash2, MoreHorizontal,
  Mail, Check, XCircle, Link as LinkIcon, Clock, FileCode,
} from 'lucide-react';
import type { Invoice } from '@atlas-platform/shared';
import { getInvoiceStatusVariant } from '@atlas-platform/shared';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { IconButton } from '../../../components/ui/icon-button';
import { Popover, PopoverTrigger, PopoverContent } from '../../../components/ui/popover';

type ActionId =
  | 'send' | 'resend' | 'sendReminder' | 'recordPayment' | 'downloadPdf'
  | 'duplicate' | 'markPaid' | 'waive' | 'delete' | 'shareLink' | 'importTime';

interface ActionHandlers {
  onSend: () => void;
  onRecordPayment: () => void;
  onDownloadPdf: () => void;
  onDuplicate: () => void;
  onMarkPaid: () => void;
  onWaive: () => void;
  onDelete: () => void;
  onShareLink: () => void;
  onImportTime: () => void;
}

interface Props extends ActionHandlers {
  invoice: Invoice;
  onBack: () => void;
}

function primaryActionsFor(status: string): ActionId[] {
  switch (status) {
    case 'draft':   return ['send', 'downloadPdf'];
    case 'sent':
    case 'viewed':  return ['recordPayment', 'resend', 'downloadPdf'];
    case 'partial':
    case 'overdue': return ['recordPayment', 'sendReminder', 'downloadPdf'];
    case 'paid':
    case 'waived':  return ['downloadPdf'];
    default:        return ['downloadPdf'];
  }
}

export function InvoiceDetailHeader({ invoice, onBack, ...handlers }: Props) {
  const { t } = useTranslation();
  const [moreOpen, setMoreOpen] = useState(false);

  const primary = primaryActionsFor(invoice.status);
  const actionMap: Record<ActionId, { label: string; icon: ReactNode; onClick: () => void }> = {
    send:           { label: t('invoices.detail.actionSend'),          icon: <Send size={13} />,       onClick: handlers.onSend },
    resend:         { label: t('invoices.detail.actionResend'),        icon: <Mail size={13} />,       onClick: handlers.onSend },
    sendReminder:   { label: t('invoices.detail.actionSendReminder'),  icon: <Clock size={13} />,      onClick: handlers.onSend },
    recordPayment:  { label: t('invoices.detail.actionRecordPayment'), icon: <DollarSign size={13} />, onClick: handlers.onRecordPayment },
    downloadPdf:    { label: t('invoices.detail.actionDownloadPdf'),   icon: <Download size={13} />,   onClick: handlers.onDownloadPdf },
    duplicate:      { label: t('invoices.detail.actionDuplicate'),     icon: <CopyIcon size={13} />,   onClick: handlers.onDuplicate },
    markPaid:       { label: t('invoices.detail.actionMarkPaid'),      icon: <Check size={13} />,      onClick: handlers.onMarkPaid },
    waive:          { label: t('invoices.detail.actionWaive'),         icon: <XCircle size={13} />,    onClick: handlers.onWaive },
    delete:         { label: t('invoices.detail.actionDelete'),        icon: <Trash2 size={13} />,     onClick: handlers.onDelete },
    shareLink:      { label: t('invoices.detail.actionShareLink'),     icon: <LinkIcon size={13} />,   onClick: handlers.onShareLink },
    importTime:     { label: t('invoices.detail.actionImportTime'),    icon: <FileCode size={13} />,   onClick: handlers.onImportTime },
  };

  const moreActions: ActionId[] = (Object.keys(actionMap) as ActionId[]).filter(id => !primary.includes(id));

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--spacing-sm)',
        padding: 'var(--spacing-sm) var(--spacing-lg)',
        width: '100%',
      }}
    >
      <button
        onClick={onBack}
        style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)',
          fontFamily: 'var(--font-family)',
        }}
      >
        {t('invoices.detail.breadcrumbInvoices')}
      </button>
      <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)' }}>/</span>
      <span style={{
        fontSize: 'var(--font-size-sm)',
        fontWeight: 'var(--font-weight-medium)',
        color: 'var(--color-text-primary)',
        fontFamily: 'var(--font-family)',
      }}>
        {invoice.invoiceNumber}
      </span>
      <Badge variant={getInvoiceStatusVariant(invoice.status)}>
        {invoice.status}
      </Badge>

      <div style={{ flex: 1 }} />

      {primary.map((id, i) => {
        const a = actionMap[id];
        return (
          <Button
            key={id}
            variant={i === 0 ? 'primary' : 'secondary'}
            size="sm"
            icon={a.icon}
            onClick={a.onClick}
          >
            {a.label}
          </Button>
        );
      })}

      <Popover open={moreOpen} onOpenChange={setMoreOpen}>
        <PopoverTrigger asChild>
          <IconButton
            icon={<MoreHorizontal size={15} />}
            label={t('invoices.detail.moreActions')}
            size={28}
          />
        </PopoverTrigger>
        <PopoverContent align="end" style={{ minWidth: 200, padding: 'var(--spacing-xs)' }}>
          {moreActions.map((id) => {
            const a = actionMap[id];
            return (
              <button
                key={id}
                onClick={() => { a.onClick(); setMoreOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)',
                  width: '100%', padding: '6px 10px',
                  background: 'transparent', border: 'none',
                  borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                  fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)',
                  fontFamily: 'var(--font-family)', textAlign: 'left',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-hover)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                {a.icon}
                {a.label}
              </button>
            );
          })}
        </PopoverContent>
      </Popover>
    </div>
  );
}
