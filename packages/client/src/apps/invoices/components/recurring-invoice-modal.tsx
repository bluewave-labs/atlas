import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Repeat } from 'lucide-react';
import { Modal } from '../../../components/ui/modal';
import { Input } from '../../../components/ui/input';
import { Textarea } from '../../../components/ui/textarea';
import { Select } from '../../../components/ui/select';
import { Button } from '../../../components/ui/button';
import { IconButton } from '../../../components/ui/icon-button';
import { useCompanies } from '../../crm/hooks';
import { useCreateRecurringInvoice, useUpdateRecurringInvoice } from '../hooks';
import { useToastStore } from '../../../stores/toast-store';
import { formatCurrency } from '../../../lib/format';
import type {
  RecurringInvoice,
  RecurrenceFrequency,
  CreateRecurringInvoiceInput,
  UpdateRecurringInvoiceInput,
} from '@atlas-platform/shared';

interface LineItemDraft {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
}

interface RecurringInvoiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recurringInvoice?: RecurringInvoice | null;
}

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function toDateInput(value: Date | string | null | undefined): string {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

function newLineItem(): LineItemDraft {
  return {
    id: crypto.randomUUID(),
    description: '',
    quantity: '1',
    unitPrice: '0',
  };
}

const labelStyle: CSSProperties = {
  fontSize: 'var(--font-size-sm)',
  fontWeight: 'var(--font-weight-medium)',
  color: 'var(--color-text-secondary)',
  fontFamily: 'var(--font-family)',
};

const fieldStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--spacing-xs)',
};

export function RecurringInvoiceModal({
  open,
  onOpenChange,
  recurringInvoice,
}: RecurringInvoiceModalProps) {
  const { t } = useTranslation();
  const addToast = useToastStore((s) => s.addToast);
  const createMutation = useCreateRecurringInvoice();
  const updateMutation = useUpdateRecurringInvoice();
  const { data: companiesData } = useCompanies();
  const isEdit = !!recurringInvoice;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [frequency, setFrequency] = useState<RecurrenceFrequency>('monthly');
  const [startDate, setStartDate] = useState<string>(todayIso());
  const [endDate, setEndDate] = useState<string>('');
  const [maxRuns, setMaxRuns] = useState<string>('');
  const [paymentTermsDays, setPaymentTermsDays] = useState<string>('30');
  const [autoSend, setAutoSend] = useState(false);
  const [notes, setNotes] = useState('');
  const [paymentInstructions, setPaymentInstructions] = useState('');
  const [lineItems, setLineItems] = useState<LineItemDraft[]>([newLineItem()]);

  useEffect(() => {
    if (!open) return;
    if (recurringInvoice) {
      setTitle(recurringInvoice.title);
      setDescription(recurringInvoice.description ?? '');
      setCompanyId(recurringInvoice.companyId);
      setFrequency(recurringInvoice.frequency);
      setStartDate(toDateInput(recurringInvoice.startDate));
      setEndDate(toDateInput(recurringInvoice.endDate));
      setMaxRuns(recurringInvoice.maxRuns != null ? String(recurringInvoice.maxRuns) : '');
      setPaymentTermsDays(String(recurringInvoice.paymentTermsDays ?? 30));
      setAutoSend(recurringInvoice.autoSend);
      setNotes(recurringInvoice.notes ?? '');
      setPaymentInstructions(recurringInvoice.paymentInstructions ?? '');
      setLineItems(
        (recurringInvoice.lineItems ?? []).length > 0
          ? (recurringInvoice.lineItems ?? []).map((li) => ({
              id: li.id,
              description: li.description,
              quantity: String(li.quantity),
              unitPrice: String(li.unitPrice),
            }))
          : [newLineItem()],
      );
    } else {
      setTitle('');
      setDescription('');
      setCompanyId('');
      setFrequency('monthly');
      setStartDate(todayIso());
      setEndDate('');
      setMaxRuns('');
      setPaymentTermsDays('30');
      setAutoSend(false);
      setNotes('');
      setPaymentInstructions('');
      setLineItems([newLineItem()]);
    }
  }, [open, recurringInvoice]);

  const companyOptions = useMemo(
    () =>
      (companiesData?.companies ?? []).map((c) => ({
        value: c.id,
        label: c.name,
      })),
    [companiesData],
  );

  const frequencyOptions = useMemo(
    () => [
      { value: 'weekly', label: t('invoices.recurring.frequencyWeekly') },
      { value: 'monthly', label: t('invoices.recurring.frequencyMonthly') },
      { value: 'quarterly', label: t('invoices.recurring.frequencyQuarterly') },
      { value: 'yearly', label: t('invoices.recurring.frequencyYearly') },
    ],
    [t],
  );

  const subtotal = useMemo(
    () =>
      lineItems.reduce((sum, li) => {
        const q = Number(li.quantity) || 0;
        const p = Number(li.unitPrice) || 0;
        return sum + q * p;
      }, 0),
    [lineItems],
  );

  const handleLineChange = (id: string, patch: Partial<LineItemDraft>) => {
    setLineItems((items) => items.map((li) => (li.id === id ? { ...li, ...patch } : li)));
  };

  const handleAddLine = () => {
    setLineItems((items) => [...items, newLineItem()]);
  };

  const handleRemoveLine = (id: string) => {
    setLineItems((items) => (items.length > 1 ? items.filter((li) => li.id !== id) : items));
  };

  const canSubmit =
    !!title.trim() &&
    !!companyId &&
    !!startDate &&
    lineItems.some((li) => li.description.trim());

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = () => {
    if (!canSubmit) return;

    const cleanedItems = lineItems
      .filter((li) => li.description.trim())
      .map((li) => ({
        description: li.description.trim(),
        quantity: Number(li.quantity) || 0,
        unitPrice: Number(li.unitPrice) || 0,
      }));

    if (isEdit && recurringInvoice) {
      const body: UpdateRecurringInvoiceInput = {
        title: title.trim(),
        description: description.trim() || null,
        frequency,
        startDate,
        endDate: endDate || null,
        maxRuns: maxRuns ? Number(maxRuns) : null,
        autoSend,
        paymentTermsDays: Number(paymentTermsDays) || 30,
        notes: notes.trim() || null,
        paymentInstructions: paymentInstructions.trim() || null,
        lineItems: cleanedItems,
      };
      updateMutation.mutate(
        { id: recurringInvoice.id, body },
        {
          onSuccess: () => {
            addToast({ type: 'success', message: t('invoices.recurring.updateSuccess') });
            onOpenChange(false);
          },
          onError: () => addToast({ type: 'error', message: t('common.error') }),
        },
      );
      return;
    }

    const input: CreateRecurringInvoiceInput = {
      companyId,
      title: title.trim(),
      description: description.trim() || undefined,
      frequency,
      startDate,
      endDate: endDate || undefined,
      maxRuns: maxRuns ? Number(maxRuns) : undefined,
      autoSend,
      paymentTermsDays: Number(paymentTermsDays) || 30,
      notes: notes.trim() || undefined,
      paymentInstructions: paymentInstructions.trim() || undefined,
      lineItems: cleanedItems,
    };
    createMutation.mutate(input, {
      onSuccess: () => {
        addToast({ type: 'success', message: t('invoices.recurring.createSuccess') });
        onOpenChange(false);
      },
      onError: () => addToast({ type: 'error', message: t('common.error') }),
    });
  };

  const modalTitle = isEdit
    ? t('invoices.recurring.modalEditTitle')
    : t('invoices.recurring.modalCreateTitle');

  return (
    <Modal open={open} onOpenChange={onOpenChange} width={720} title={modalTitle}>
      <Modal.Header title={modalTitle} />
      <Modal.Body>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
          <Input
            label={t('invoices.recurring.fieldTitle')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            size="md"
          />

          <Textarea
            label={t('invoices.recurring.fieldDescription')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />

          <div style={fieldStyle}>
            <label style={labelStyle}>{t('invoices.recurring.fieldCompany')}</label>
            <Select
              value={companyId}
              onChange={setCompanyId}
              options={companyOptions}
              placeholder={t('invoices.selectCompany')}
              size="md"
              disabled={isEdit}
            />
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 'var(--spacing-md)',
            }}
          >
            <div style={fieldStyle}>
              <label style={labelStyle}>{t('invoices.recurring.fieldFrequency')}</label>
              <Select
                value={frequency}
                onChange={(v) => setFrequency(v as RecurrenceFrequency)}
                options={frequencyOptions}
                size="md"
              />
            </div>

            <Input
              label={t('invoices.recurring.fieldPaymentTerms')}
              type="number"
              min="0"
              value={paymentTermsDays}
              onChange={(e) => setPaymentTermsDays(e.target.value)}
              size="md"
            />

            <Input
              label={t('invoices.recurring.fieldStartDate')}
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              size="md"
            />

            <Input
              label={t('invoices.recurring.fieldEndDate')}
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              size="md"
            />

            <Input
              label={t('invoices.recurring.fieldMaxRuns')}
              type="number"
              min="1"
              value={maxRuns}
              onChange={(e) => setMaxRuns(e.target.value)}
              placeholder={t('invoices.recurring.fieldMaxRunsPlaceholder')}
              size="md"
            />
          </div>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-sm)',
              cursor: 'pointer',
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-primary)',
              fontFamily: 'var(--font-family)',
              padding: 'var(--spacing-sm)',
              background: 'var(--color-bg-secondary)',
              border: '1px solid var(--color-border-secondary)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <input
              type="checkbox"
              checked={autoSend}
              onChange={(e) => setAutoSend(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            {t('invoices.recurring.fieldAutoSend')}
          </label>

          {/* Line items */}
          <div style={fieldStyle}>
            <label style={labelStyle}>{t('invoices.recurring.lineItemsTitle')}</label>
            <div
              style={{
                border: '1px solid var(--color-border-secondary)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--spacing-sm)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--spacing-sm)',
              }}
            >
              {lineItems.map((li) => (
                <div
                  key={li.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 80px 100px 28px',
                    gap: 'var(--spacing-sm)',
                    alignItems: 'center',
                  }}
                >
                  <Input
                    placeholder={t('invoices.recurring.lineItemDescription')}
                    value={li.description}
                    onChange={(e) => handleLineChange(li.id, { description: e.target.value })}
                    size="md"
                  />
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder={t('invoices.recurring.lineItemQty')}
                    value={li.quantity}
                    onChange={(e) => handleLineChange(li.id, { quantity: e.target.value })}
                    size="md"
                  />
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder={t('invoices.recurring.lineItemPrice')}
                    value={li.unitPrice}
                    onChange={(e) => handleLineChange(li.id, { unitPrice: e.target.value })}
                    size="md"
                  />
                  <IconButton
                    icon={<Trash2 size={14} />}
                    label={t('invoices.recurring.lineItemRemove')}
                    size={28}
                    onClick={() => handleRemoveLine(li.id)}
                    disabled={lineItems.length <= 1}
                  />
                </div>
              ))}
              <div>
                <Button variant="ghost" size="sm" icon={<Plus size={14} />} onClick={handleAddLine}>
                  {t('invoices.recurring.lineItemAdd')}
                </Button>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  paddingTop: 'var(--spacing-sm)',
                  borderTop: '1px solid var(--color-border-secondary)',
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 'var(--font-weight-semibold)',
                  color: 'var(--color-text-primary)',
                  fontFamily: 'var(--font-family)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {formatCurrency(subtotal)}
              </div>
            </div>
          </div>

          <Textarea
            label={t('invoices.recurring.fieldNotes')}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />

          <Textarea
            label={t('invoices.recurring.fieldPaymentInstructions')}
            value={paymentInstructions}
            onChange={(e) => setPaymentInstructions(e.target.value)}
            rows={2}
          />
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
          {t('invoices.recurring.cancel')}
        </Button>
        <Button
          variant="primary"
          icon={<Repeat size={13} />}
          onClick={handleSubmit}
          disabled={!canSubmit || isSubmitting}
        >
          {isEdit ? t('invoices.recurring.saveUpdate') : t('invoices.recurring.saveCreate')}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
