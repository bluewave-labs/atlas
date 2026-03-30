import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Download } from 'lucide-react';
import {
  useClients, useCreateInvoice, useUpdateInvoice, usePopulateFromTimeEntries,
  type Invoice, type ProjectClient,
} from '../hooks';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Select } from '../../../components/ui/select';
import { Textarea } from '../../../components/ui/textarea';
import { Modal } from '../../../components/ui/modal';
import { IconButton } from '../../../components/ui/icon-button';
import { formatCurrency } from '../../../lib/format';

// ─── Types ────────────────────────────────────────────────────────

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

interface InvoiceBuilderProps {
  open: boolean;
  onClose: () => void;
  invoice?: Invoice | null;
}

// ─── Component ────────────────────────────────────────────────────

export function InvoiceBuilder({ open, onClose, invoice }: InvoiceBuilderProps) {
  const { t } = useTranslation();
  const { data: clientsData } = useClients();
  const clients = clientsData?.clients ?? [];

  const createInvoice = useCreateInvoice();
  const updateInvoice = useUpdateInvoice();
  const populateFromTime = usePopulateFromTimeEntries();

  const [clientId, setClientId] = useState('');
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: crypto.randomUUID(), description: '', quantity: 1, unitPrice: 0 },
  ]);
  const [taxPercent, setTaxPercent] = useState(0);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [notes, setNotes] = useState('');

  // Populate date range for time entries
  const [populateStart, setPopulateStart] = useState('');
  const [populateEnd, setPopulateEnd] = useState('');

  // Load existing invoice data
  useEffect(() => {
    if (invoice) {
      setClientId(invoice.clientId);
      setIssueDate(invoice.issueDate);
      setDueDate(invoice.dueDate);
      setLineItems(
        invoice.lineItems.map((li) => ({
          id: li.id || crypto.randomUUID(),
          description: li.description,
          quantity: li.quantity,
          unitPrice: li.unitPrice,
        })),
      );
      setTaxPercent(invoice.taxPercent);
      setDiscountPercent(invoice.discountPercent);
      setNotes(invoice.notes || '');
    } else {
      setClientId('');
      setIssueDate(new Date().toISOString().slice(0, 10));
      const d = new Date();
      d.setDate(d.getDate() + 30);
      setDueDate(d.toISOString().slice(0, 10));
      setLineItems([{ id: crypto.randomUUID(), description: '', quantity: 1, unitPrice: 0 }]);
      setTaxPercent(0);
      setDiscountPercent(0);
      setNotes('');
    }
  }, [invoice, open]);

  // Calculations
  const subtotal = useMemo(
    () => lineItems.reduce((sum, li) => sum + li.quantity * li.unitPrice, 0),
    [lineItems],
  );
  const taxAmount = subtotal * (taxPercent / 100);
  const discountAmount = subtotal * (discountPercent / 100);
  const total = subtotal + taxAmount - discountAmount;

  const handleAddLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      { id: crypto.randomUUID(), description: '', quantity: 1, unitPrice: 0 },
    ]);
  };

  const handleRemoveLineItem = (id: string) => {
    setLineItems((prev) => prev.filter((li) => li.id !== id));
  };

  const handleLineItemChange = (id: string, field: keyof LineItem, value: string | number) => {
    setLineItems((prev) =>
      prev.map((li) => (li.id === id ? { ...li, [field]: value } : li)),
    );
  };

  const handlePopulateFromTime = () => {
    if (!clientId || !populateStart || !populateEnd) return;
    populateFromTime.mutate(
      { clientId, startDate: populateStart, endDate: populateEnd },
      {
        onSuccess: (data) => {
          const newItems = data.lineItems.map((li) => ({
            id: crypto.randomUUID(),
            description: li.description,
            quantity: li.quantity,
            unitPrice: li.unitPrice,
          }));
          setLineItems((prev) => [...prev.filter((li) => li.description.trim()), ...newItems]);
        },
      },
    );
  };

  const handleSave = (status?: string) => {
    const payload = {
      clientId,
      issueDate,
      dueDate,
      lineItems: lineItems
        .filter((li) => li.description.trim())
        .map((li) => ({
          description: li.description,
          quantity: li.quantity,
          unitPrice: li.unitPrice,
        })),
      taxPercent,
      discountPercent,
      notes: notes || null,
    };

    if (invoice) {
      updateInvoice.mutate(
        { id: invoice.id, ...payload, ...(status ? { status } : {}) },
        { onSuccess: () => onClose() },
      );
    } else {
      createInvoice.mutate(payload, { onSuccess: () => onClose() });
    }
  };

  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} width={680} title={invoice ? t('projects.invoices.editInvoice') : t('projects.invoices.newInvoice')}>
      <Modal.Header
        title={invoice ? t('projects.invoices.editInvoice') : t('projects.invoices.newInvoice')}
        subtitle={t('projects.invoices.invoiceBuilderSubtitle')}
      />
      <Modal.Body>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
          {/* Client + Dates */}
          <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
            <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
              <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-family)' }}>
                {t('projects.invoices.client')}
              </label>
              <Select
                value={clientId}
                onChange={setClientId}
                options={[
                  { value: '', label: t('projects.invoices.selectClient') },
                  ...clients.map((c) => ({ value: c.id, label: c.name })),
                ]}
              />
            </div>
            <Input label={t('projects.invoices.issueDate')} type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} style={{ flex: 1 }} />
            <Input label={t('projects.invoices.dueDate')} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={{ flex: 1 }} />
          </div>

          {/* Populate from time entries */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--spacing-sm)', padding: 'var(--spacing-sm)', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)' }}>
            <Input label={t('projects.invoices.from')} type="date" value={populateStart} onChange={(e) => setPopulateStart(e.target.value)} size="sm" style={{ flex: 1 }} />
            <Input label={t('projects.invoices.to')} type="date" value={populateEnd} onChange={(e) => setPopulateEnd(e.target.value)} size="sm" style={{ flex: 1 }} />
            <Button
              variant="secondary"
              size="sm"
              icon={<Download size={13} />}
              onClick={handlePopulateFromTime}
              disabled={!clientId || !populateStart || !populateEnd || populateFromTime.isPending}
            >
              {t('projects.invoices.populateFromTime')}
            </Button>
          </div>

          {/* Line items */}
          <div>
            <table className="projects-invoice-line-items">
              <thead>
                <tr>
                  <th style={{ width: '50%' }}>{t('projects.invoices.description')}</th>
                  <th style={{ width: '15%' }}>{t('projects.invoices.quantity')}</th>
                  <th style={{ width: '20%' }}>{t('projects.invoices.unitPrice')}</th>
                  <th style={{ width: '15%', textAlign: 'right' }}>{t('projects.invoices.amount')}</th>
                  <th style={{ width: 32 }} />
                </tr>
              </thead>
              <tbody>
                {lineItems.map((li) => (
                  <tr key={li.id}>
                    <td>
                      <Input
                        value={li.description}
                        onChange={(e) => handleLineItemChange(li.id, 'description', e.target.value)}
                        placeholder={t('projects.invoices.lineItemPlaceholder')}
                        size="sm"
                      />
                    </td>
                    <td>
                      <Input
                        type="number"
                        step="0.01"
                        value={String(li.quantity)}
                        onChange={(e) => handleLineItemChange(li.id, 'quantity', parseFloat(e.target.value) || 0)}
                        size="sm"
                      />
                    </td>
                    <td>
                      <Input
                        type="number"
                        step="0.01"
                        value={String(li.unitPrice)}
                        onChange={(e) => handleLineItemChange(li.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                        size="sm"
                      />
                    </td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family)' }}>
                      {formatCurrency(li.quantity * li.unitPrice)}
                    </td>
                    <td>
                      <IconButton
                        icon={<Trash2 size={12} />}
                        label={t('projects.actions.delete')}
                        size={22}
                        destructive
                        onClick={() => handleRemoveLineItem(li.id)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Button variant="ghost" size="sm" icon={<Plus size={13} />} onClick={handleAddLineItem} style={{ marginTop: 'var(--spacing-sm)' }}>
              {t('projects.invoices.addLineItem')}
            </Button>
          </div>

          {/* Tax, Discount, Totals */}
          <div style={{ display: 'flex', gap: 'var(--spacing-lg)' }}>
            <div style={{ flex: 1 }}>
              <Textarea
                label={t('projects.invoices.notes')}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder={t('projects.invoices.notesPlaceholder')}
              />
            </div>
            <div style={{ width: 240 }}>
              <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-sm)' }}>
                <Input
                  label={t('projects.invoices.taxPercent')}
                  type="number"
                  step="0.1"
                  value={String(taxPercent)}
                  onChange={(e) => setTaxPercent(parseFloat(e.target.value) || 0)}
                  size="sm"
                />
                <Input
                  label={t('projects.invoices.discountPercent')}
                  type="number"
                  step="0.1"
                  value={String(discountPercent)}
                  onChange={(e) => setDiscountPercent(parseFloat(e.target.value) || 0)}
                  size="sm"
                />
              </div>
              <div className="projects-invoice-totals">
                <div className="projects-invoice-totals-row">
                  <span className="projects-invoice-totals-label">{t('projects.invoices.subtotal')}</span>
                  <span className="projects-invoice-totals-value">{formatCurrency(subtotal)}</span>
                </div>
                {taxPercent > 0 && (
                  <div className="projects-invoice-totals-row">
                    <span className="projects-invoice-totals-label">{t('projects.invoices.tax')} ({taxPercent}%)</span>
                    <span className="projects-invoice-totals-value">{formatCurrency(taxAmount)}</span>
                  </div>
                )}
                {discountPercent > 0 && (
                  <div className="projects-invoice-totals-row">
                    <span className="projects-invoice-totals-label">{t('projects.invoices.discount')} ({discountPercent}%)</span>
                    <span className="projects-invoice-totals-value">-{formatCurrency(discountAmount)}</span>
                  </div>
                )}
                <div className="projects-invoice-totals-row" style={{ borderTop: '1px solid var(--color-border-secondary)', paddingTop: 'var(--spacing-sm)', marginTop: 'var(--spacing-xs)' }}>
                  <span className="projects-invoice-totals-label" style={{ fontWeight: 'var(--font-weight-semibold)' as React.CSSProperties['fontWeight'] }}>{t('projects.invoices.total')}</span>
                  <span className="projects-invoice-totals-total">{formatCurrency(total)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" onClick={onClose}>{t('projects.actions.cancel')}</Button>
        <Button variant="secondary" onClick={() => handleSave()} disabled={!clientId || lineItems.length === 0}>
          {t('projects.invoices.saveDraft')}
        </Button>
        <Button variant="primary" onClick={() => handleSave('sent')} disabled={!clientId || lineItems.length === 0}>
          {t('projects.invoices.send')}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
