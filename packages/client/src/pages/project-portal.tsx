import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight, FileText, DollarSign } from 'lucide-react';
import { usePortalData, type PortalData } from '../apps/projects/hooks';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { formatCurrency, formatDate } from '../lib/format';

// ─── Status badge variant ─────────────────────────────────────────

function getInvoiceStatusVariant(status: string): 'default' | 'primary' | 'success' | 'warning' | 'error' {
  switch (status) {
    case 'draft': return 'default';
    case 'sent': return 'primary';
    case 'viewed': return 'warning';
    case 'paid': return 'success';
    case 'overdue': return 'error';
    case 'waived': return 'default';
    default: return 'default';
  }
}

// ─── Invoice Row ──────────────────────────────────────────────────

function InvoiceRow({ invoice }: { invoice: PortalData['invoices'][0] }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{ borderBottom: '1px solid var(--color-border-secondary)' }}>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-md)',
          padding: 'var(--spacing-md) var(--spacing-lg)',
          cursor: 'pointer',
          transition: 'background 0.1s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-hover)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = ''; }}
      >
        <span style={{ color: 'var(--color-text-tertiary)', display: 'flex', alignItems: 'center' }}>
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
        <span style={{ width: 100, flexShrink: 0, fontWeight: 'var(--font-weight-medium)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
          {invoice.invoiceNumber}
        </span>
        <span style={{ width: 120, flexShrink: 0, textAlign: 'right', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)', fontFamily: 'var(--font-family)', fontVariantNumeric: 'tabular-nums', color: 'var(--color-text-primary)' }}>
          {formatCurrency(invoice.total)}
        </span>
        <span style={{ width: 80, flexShrink: 0 }}>
          <Badge variant={getInvoiceStatusVariant(invoice.status)}>
            {t(`projects.status.${invoice.status}`)}
          </Badge>
        </span>
        <span style={{ flex: 1, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>
          {formatDate(invoice.issueDate)}
        </span>
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>
          {t('projects.invoices.dueDate')}: {formatDate(invoice.dueDate)}
        </span>
      </div>

      {/* Expanded line items */}
      {expanded && invoice.lineItems.length > 0 && (
        <div style={{ padding: '0 var(--spacing-lg) var(--spacing-md)', paddingLeft: 'calc(var(--spacing-lg) + 14px + var(--spacing-md))' }}>
          <div style={{ background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)', padding: 'var(--spacing-sm)' }}>
            {invoice.lineItems.map((li, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--spacing-xs) var(--spacing-sm)', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family)', borderBottom: i < invoice.lineItems.length - 1 ? '1px solid var(--color-border-secondary)' : 'none' }}>
                <span style={{ color: 'var(--color-text-primary)', flex: 1 }}>{li.description}</span>
                <span style={{ color: 'var(--color-text-tertiary)', width: 60, textAlign: 'right' }}>{li.quantity}h</span>
                <span style={{ color: 'var(--color-text-tertiary)', width: 80, textAlign: 'right' }}>{formatCurrency(li.unitPrice)}</span>
                <span style={{ color: 'var(--color-text-primary)', fontWeight: 'var(--font-weight-semibold)', width: 80, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(li.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Portal Page ──────────────────────────────────────────────────

export function ProjectPortalPage() {
  const { t } = useTranslation();
  const { token } = useParams<{ token: string }>();
  const { data, isLoading, error } = usePortalData(token);

  if (isLoading) {
    return (
      <div style={{ maxWidth: 800, margin: '0 auto', padding: 'var(--spacing-2xl)' }}>
        <Skeleton width="200px" height="24px" style={{ marginBottom: 'var(--spacing-lg)' }} />
        <Skeleton width="100%" height="80px" style={{ marginBottom: 'var(--spacing-lg)' }} />
        <Skeleton width="100%" height="300px" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh',
        fontFamily: 'var(--font-family)', color: 'var(--color-text-secondary)',
        fontSize: 'var(--font-size-md)', background: 'var(--color-bg-primary)',
      }}>
        {t('projects.portal.invalidLink')}
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg-primary)', fontFamily: 'var(--font-family)' }}>
      {/* Header */}
      <div style={{
        borderBottom: '1px solid var(--color-border-secondary)',
        padding: 'var(--spacing-lg) var(--spacing-2xl)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)' }}>
            {data.clientName}
          </div>
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', marginTop: 2 }}>
            {t('projects.portal.clientPortal')}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 800, margin: '0 auto', padding: 'var(--spacing-2xl)' }}>
        {/* Outstanding amount card */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-lg)',
          padding: 'var(--spacing-xl)',
          background: 'var(--color-bg-secondary)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border-secondary)',
          marginBottom: 'var(--spacing-2xl)',
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: 'var(--radius-md)',
            background: 'var(--color-bg-tertiary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--color-text-tertiary)',
          }}>
            <DollarSign size={24} />
          </div>
          <div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 'var(--font-weight-medium)' }}>
              {t('projects.portal.outstandingAmount')}
            </div>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: data.outstandingAmount > 0 ? 'var(--color-warning)' : 'var(--color-success)', fontVariantNumeric: 'tabular-nums' }}>
              {formatCurrency(data.outstandingAmount)}
            </div>
          </div>
        </div>

        {/* Invoices */}
        <div>
          <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)', marginBottom: 'var(--spacing-md)' }}>
            {t('projects.sidebar.invoices')}
          </h2>

          {data.invoices.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 'var(--spacing-2xl)', color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-sm)' }}>
              {t('projects.portal.noInvoices')}
            </div>
          ) : (
            <div style={{ border: '1px solid var(--color-border-secondary)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
              {/* Header */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)',
                padding: 'var(--spacing-sm) var(--spacing-lg)',
                background: 'var(--color-bg-secondary)',
                fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)',
                color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em',
              }}>
                <span style={{ width: 14 }} />
                <span style={{ width: 100, flexShrink: 0 }}>{t('projects.invoices.number')}</span>
                <span style={{ width: 120, flexShrink: 0, textAlign: 'right' }}>{t('projects.invoices.amount')}</span>
                <span style={{ width: 80, flexShrink: 0 }}>{t('projects.projects.status')}</span>
                <span style={{ flex: 1 }}>{t('projects.invoices.issueDate')}</span>
                <span>{t('projects.invoices.dueDate')}</span>
              </div>

              {/* Invoice rows */}
              {data.invoices.map((invoice) => (
                <InvoiceRow key={invoice.id} invoice={invoice} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
