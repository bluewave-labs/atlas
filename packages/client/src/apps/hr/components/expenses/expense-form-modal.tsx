import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Upload, UserPlus } from 'lucide-react';
import { type HrExpense, type PaymentMethod } from '@atlas-platform/shared';
import {
  useCreateExpense,
  useUpdateExpense,
  useSubmitExpense,
  useExpenseCategories,
  useEmployeeList,
} from '../../hooks';
import { Modal } from '../../../../components/ui/modal';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Select } from '../../../../components/ui/select';
import { Textarea } from '../../../../components/ui/textarea';
import { useToastStore } from '../../../../stores/toast-store';
import { useAuthStore } from '../../../../stores/auth-store';
import { api } from '../../../../lib/api-client';

interface ExpenseFormModalProps {
  open: boolean;
  onClose: () => void;
  expense?: HrExpense | null;
}

const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD' },
  { value: 'EUR', label: 'EUR' },
  { value: 'GBP', label: 'GBP' },
  { value: 'TRY', label: 'TRY' },
];

const PAYMENT_METHOD_OPTIONS: Array<{ value: PaymentMethod; label: string }> = [
  { value: 'personal_card', label: 'Personal card' },
  { value: 'company_card', label: 'Company card' },
  { value: 'cash', label: 'Cash' },
];

export function ExpenseFormModal({ open, onClose, expense }: ExpenseFormModalProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: categories } = useExpenseCategories();
  const createExpense = useCreateExpense();
  const updateExpense = useUpdateExpense();
  const submitExpense = useSubmitExpense();
  const addToast = useToastStore((s) => s.addToast);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Detect whether the current logged-in user has an HR employee record
  // linked to them. The server's /hr/expenses POST returns 400
  // ('No employee record found for current user') when this row is
  // missing — so we want to warn before the user even fills the form
  // out, instead of letting them hit a confusing error.
  const authAccount = useAuthStore((s) => s.account);
  const { data: employeeList } = useEmployeeList({});
  const linkedEmployee = employeeList?.employees.find(
    (e) => e.email?.toLowerCase() === authAccount?.email?.toLowerCase(),
  );
  const noLinkedEmployee = open && !!authAccount && employeeList !== undefined && !linkedEmployee;

  const isEditing = !!expense;

  const [categoryId, setCategoryId] = useState('');
  const [expenseDate, setExpenseDate] = useState('');
  const [description, setDescription] = useState('');
  const [merchantName, setMerchantName] = useState('');
  const [amount, setAmount] = useState('');
  const [taxAmount, setTaxAmount] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [currency, setCurrency] = useState('USD');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('personal_card');
  const [receiptPath, setReceiptPath] = useState('');
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (open) {
      if (expense) {
        setCategoryId(expense.categoryId || '');
        setExpenseDate(expense.expenseDate?.split('T')[0] || '');
        setDescription(expense.description || '');
        setMerchantName(expense.merchantName || '');
        setAmount(String(expense.amount || ''));
        setTaxAmount(String(expense.taxAmount || '0'));
        setQuantity(String(expense.quantity || '1'));
        setCurrency(expense.currency || 'USD');
        setPaymentMethod(expense.paymentMethod || 'personal_card');
        setReceiptPath(expense.receiptPath || '');
        setNotes(expense.notes || '');
      } else {
        setCategoryId('');
        setExpenseDate(new Date().toISOString().split('T')[0]);
        setDescription('');
        setMerchantName('');
        setAmount('');
        setTaxAmount('0');
        setQuantity('1');
        setCurrency('USD');
        setPaymentMethod('personal_card');
        setReceiptPath('');
        setNotes('');
      }
    }
  }, [open, expense]);

  const selectedCategory = categories?.find((c) => c.id === categoryId);
  const amountNum = parseFloat(amount) || 0;
  const exceedsMax = selectedCategory?.maxAmount && amountNum > selectedCategory.maxAmount;

  const buildInput = () => ({
    categoryId: categoryId || undefined,
    description,
    notes: notes.trim() || undefined,
    amount: amountNum,
    taxAmount: parseFloat(taxAmount) || 0,
    currency,
    quantity: parseInt(quantity) || 1,
    expenseDate,
    merchantName: merchantName.trim() || undefined,
    paymentMethod,
    receiptPath: receiptPath || undefined,
  });

  // Surface the actual server error message in the toast so the user
  // knows WHY a save failed (e.g. "No employee record found for current
  // user"), not just a generic "Failed to save".
  const showSaveError = (err: unknown) => {
    const serverMsg =
      (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
    addToast({
      type: 'error',
      message: serverMsg || t('hr.expenses.saveFailed'),
    });
  };

  const handleSave = (andSubmit: boolean) => {
    if (!description.trim() || !amountNum) return;

    const input = buildInput();

    if (isEditing) {
      updateExpense.mutate({ id: expense.id, ...input }, {
        onSuccess: (data) => {
          if (andSubmit && data?.id) {
            submitExpense.mutate(data.id, {
              onSuccess: () => {
                addToast({ type: 'success', message: t('hr.expenses.submitted') });
                onClose();
              },
              onError: showSaveError,
            });
          } else {
            addToast({ type: 'success', message: t('hr.expenses.saved') });
            onClose();
          }
        },
        onError: showSaveError,
      });
    } else {
      createExpense.mutate(input, {
        onSuccess: (data) => {
          if (andSubmit && data?.id) {
            submitExpense.mutate(data.id, {
              onSuccess: () => {
                addToast({ type: 'success', message: t('hr.expenses.submitted') });
                onClose();
              },
              onError: showSaveError,
            });
          } else {
            addToast({ type: 'success', message: t('hr.expenses.saved') });
            onClose();
          }
        },
        onError: showSaveError,
      });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setReceiptPath(data.data?.path || data.path || '');
      addToast({ type: 'success', message: t('hr.expenses.receiptUploaded') });
    } catch {
      addToast({ type: 'error', message: t('hr.expenses.receiptUploadFailed') });
    } finally {
      setUploading(false);
    }
  };

  const isSaving = createExpense.isPending || updateExpense.isPending || submitExpense.isPending;
  // Block save when the user has no linked employee record — the server
  // would 400 anyway, and we now show an in-modal banner pointing them
  // at HR → Employees to fix it.
  const canSave = description.trim() && amountNum > 0 && !noLinkedEmployee;

  // Translate payment method options
  const translatedPaymentMethods = PAYMENT_METHOD_OPTIONS.map((o) => ({
    value: o.value,
    label: t(`hr.expenses.paymentMethods.${o.value}`),
  }));

  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      width={520}
      title={isEditing ? t('hr.expenses.editExpense') : t('hr.expenses.newExpense')}
    >
      <Modal.Header title={isEditing ? t('hr.expenses.editExpense') : t('hr.expenses.newExpense')} />
      <Modal.Body>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          {/* Missing-employee-link banner */}
          {noLinkedEmployee && (
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 'var(--spacing-sm)',
                padding: 'var(--spacing-md)',
                background: 'color-mix(in srgb, var(--color-warning) 10%, transparent)',
                border: '1px solid color-mix(in srgb, var(--color-warning) 30%, transparent)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <AlertTriangle
                size={16}
                style={{ color: 'var(--color-warning)', flexShrink: 0, marginTop: 2 }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)', flex: 1 }}>
                <div
                  style={{
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 'var(--font-weight-semibold)',
                    color: 'var(--color-text-primary)',
                    fontFamily: 'var(--font-family)',
                  }}
                >
                  {t('hr.expenses.noEmployeeRecord.title', 'No employee record linked to your account')}
                </div>
                <div
                  style={{
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--color-text-secondary)',
                    fontFamily: 'var(--font-family)',
                    lineHeight: 1.5,
                  }}
                >
                  {t(
                    'hr.expenses.noEmployeeRecord.description',
                    'To track expenses you need an HR employee record. Create one in Employees using the same email as your login ({{email}}) and the server will auto-link it.',
                    { email: authAccount?.email ?? '' },
                  )}
                </div>
                <div>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<UserPlus size={14} />}
                    onClick={() => {
                      onClose();
                      navigate('/hr?view=employees');
                    }}
                  >
                    {t('hr.expenses.noEmployeeRecord.action', 'Go to Employees')}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Category */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
            <label style={{
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-medium)',
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-family)',
            }}>
              {t('hr.expenses.fields.category')}
            </label>
            <Select
              value={categoryId}
              onChange={setCategoryId}
              options={[
                { value: '', label: t('hr.expenses.selectCategory') },
                ...(categories?.filter((c) => c.isActive).map((c) => ({
                  value: c.id,
                  label: c.name,
                })) || []),
              ]}
              size="sm"
            />
          </div>

          {/* Date + Amount row */}
          <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
            <Input
              label={t('hr.expenses.fields.date')}
              type="date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              size="sm"
              style={{ flex: 1 }}
            />
            <Input
              label={t('hr.expenses.fields.amount')}
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              size="sm"
              style={{ flex: 1 }}
              placeholder="0.00"
            />
          </div>

          {/* Max amount warning */}
          {exceedsMax && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-sm)',
              padding: 'var(--spacing-sm) var(--spacing-md)',
              background: 'color-mix(in srgb, var(--color-warning) 10%, transparent)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid color-mix(in srgb, var(--color-warning) 30%, transparent)',
            }}>
              <AlertTriangle size={14} style={{ color: 'var(--color-warning)', flexShrink: 0 }} />
              <span style={{
                fontSize: 'var(--font-size-xs)',
                color: 'var(--color-warning)',
                fontFamily: 'var(--font-family)',
              }}>
                {t('hr.expenses.exceedsMax', { max: selectedCategory?.maxAmount })}
              </span>
            </div>
          )}

          {/* Description */}
          <Input
            label={t('hr.expenses.fields.description')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            size="sm"
            placeholder={t('hr.expenses.descriptionPlaceholder')}
          />

          {/* Merchant */}
          <Input
            label={t('hr.expenses.fields.merchant')}
            value={merchantName}
            onChange={(e) => setMerchantName(e.target.value)}
            size="sm"
            placeholder={t('hr.expenses.merchantPlaceholder')}
          />

          {/* Tax + Quantity row */}
          <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
            <Input
              label={t('hr.expenses.fields.taxAmount')}
              type="number"
              value={taxAmount}
              onChange={(e) => setTaxAmount(e.target.value)}
              size="sm"
              style={{ flex: 1 }}
              placeholder="0.00"
            />
            <Input
              label={t('hr.expenses.fields.quantity')}
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              size="sm"
              style={{ flex: 1 }}
              placeholder="1"
            />
          </div>

          {/* Currency + Payment method row */}
          <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
              <label style={{
                fontSize: 'var(--font-size-sm)',
                fontWeight: 'var(--font-weight-medium)',
                color: 'var(--color-text-secondary)',
                fontFamily: 'var(--font-family)',
              }}>
                {t('hr.expenses.fields.currency')}
              </label>
              <Select
                value={currency}
                onChange={setCurrency}
                options={CURRENCY_OPTIONS}
                size="sm"
              />
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
              <label style={{
                fontSize: 'var(--font-size-sm)',
                fontWeight: 'var(--font-weight-medium)',
                color: 'var(--color-text-secondary)',
                fontFamily: 'var(--font-family)',
              }}>
                {t('hr.expenses.fields.paymentMethod')}
              </label>
              <Select
                value={paymentMethod}
                onChange={(v) => setPaymentMethod(v as PaymentMethod)}
                options={translatedPaymentMethods}
                size="sm"
              />
            </div>
          </div>

          {/* Receipt upload */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
            <label style={{
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-medium)',
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-family)',
            }}>
              {t('hr.expenses.fields.receipt')}
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
              <Button
                variant="secondary"
                size="sm"
                icon={<Upload size={14} />}
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? t('hr.expenses.uploading') : t('hr.expenses.uploadReceipt')}
              </Button>
              {receiptPath && (
                <span style={{
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-text-tertiary)',
                  fontFamily: 'var(--font-family)',
                }}>
                  {t('hr.expenses.receiptAttached')}
                </span>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf"
                style={{ display: 'none' }}
                onChange={handleFileUpload}
              />
            </div>
          </div>

          {/* Notes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
            <label style={{
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-medium)',
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-family)',
            }}>
              {t('hr.expenses.fields.notes')}
            </label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('hr.expenses.notesPlaceholder')}
              rows={3}
            />
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" size="sm" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => handleSave(false)}
          disabled={!canSave || isSaving}
        >
          {t('hr.expenses.saveDraft')}
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => handleSave(true)}
          disabled={!canSave || isSaving}
        >
          {t('hr.expenses.saveAndSubmit')}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
