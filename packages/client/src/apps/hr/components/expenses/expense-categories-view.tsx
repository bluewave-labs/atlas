import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Check, XCircle, Download } from 'lucide-react';
import {
  useExpenseCategories, useCreateExpenseCategory, useUpdateExpenseCategory,
  useDeleteExpenseCategory, useSeedExpenseCategories,
} from '../../hooks';
import { useAppActions } from '../../../../hooks/use-app-permissions';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Badge } from '../../../../components/ui/badge';
import { IconButton } from '../../../../components/ui/icon-button';
import { Skeleton } from '../../../../components/ui/skeleton';
import { StatusDot } from '../../../../components/ui/status-dot';
import { FeatureEmptyState } from '../../../../components/ui/feature-empty-state';
import { formatCurrency } from '../../../../lib/format';

export function ExpenseCategoriesView() {
  const { t } = useTranslation();
  const { canDelete } = useAppActions('hr');
  const { data: categories, isLoading } = useExpenseCategories();
  const createCategory = useCreateExpenseCategory();
  const updateCategory = useUpdateExpenseCategory();
  const deleteCategory = useDeleteExpenseCategory();
  const seedCategories = useSeedExpenseCategories();

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('receipt');
  const [color, setColor] = useState('#3b82f6');
  const [maxAmount, setMaxAmount] = useState('');
  const [receiptRequired, setReceiptRequired] = useState(false);

  // Auto-seed on first visit when empty
  const hasSeeded = useRef(false);
  useEffect(() => {
    if (!isLoading && (!categories || categories.length === 0) && !hasSeeded.current) {
      hasSeeded.current = true;
      seedCategories.mutate();
    }
  }, [isLoading, categories, seedCategories]);

  const handleCreate = () => {
    if (!name.trim()) return;
    createCategory.mutate({
      name: name.trim(),
      icon: icon.trim() || 'receipt',
      color,
      maxAmount: maxAmount ? Number(maxAmount) : null,
      receiptRequired,
    }, {
      onSuccess: () => {
        setShowCreate(false);
        setName('');
        setIcon('receipt');
        setMaxAmount('');
        setReceiptRequired(false);
      },
    });
  };

  if (isLoading) {
    return (
      <div style={{ padding: 'var(--spacing-xl)' }}>
        <Skeleton height={200} />
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 'var(--spacing-xl)' }}>
      {(!categories || categories.length === 0) && !showCreate && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <FeatureEmptyState
            illustration="generic"
            title={t('hr.expenses.categories.empty')}
            description={t('hr.expenses.categories.emptyDesc')}
            actionLabel={t('hr.expenses.categories.add')}
            actionIcon={<Plus size={14} />}
            onAction={() => setShowCreate(true)}
          />
          <Button
            variant="secondary"
            size="sm"
            icon={<Download size={14} />}
            onClick={() => seedCategories.mutate()}
            disabled={seedCategories.isPending}
            style={{ marginTop: 'var(--spacing-md)' }}
          >
            {t('hr.expenses.categories.loadDefaults')}
          </Button>
        </div>
      )}

      {/* Categories table */}
      {categories && categories.length > 0 && (
        <div style={{
          border: '1px solid var(--color-border-secondary)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          background: 'var(--color-bg-primary)',
        }}>
          {/* Table header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-md)',
            padding: 'var(--spacing-sm) var(--spacing-lg)',
            background: 'var(--color-bg-secondary)',
            borderBottom: '1px solid var(--color-border-secondary)',
          }}>
            <span style={{ width: 12 }} />
            <span style={{
              width: 40, fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)',
              color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)',
              textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              {t('hr.expenses.categories.icon')}
            </span>
            <span style={{
              flex: 1, fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)',
              color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)',
              textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              {t('hr.fields.name')}
            </span>
            <span style={{
              width: 100, fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)',
              color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)',
              textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              {t('hr.expenses.categories.maxAmount')}
            </span>
            <span style={{
              width: 80, fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)',
              color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)',
              textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              {t('hr.expenses.categories.receipt')}
            </span>
            <span style={{
              width: 64, fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)',
              color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)',
              textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              {t('hr.fields.status')}
            </span>
            <span style={{ width: canDelete ? 60 : 30 }} />
          </div>

          {/* Rows */}
          {categories.map((cat, idx) => (
            <div
              key={cat.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-md)',
                padding: 'var(--spacing-md) var(--spacing-lg)',
                borderBottom: idx < categories.length - 1 ? '1px solid var(--color-border-secondary)' : 'none',
                transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-hover)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <StatusDot color={cat.color} size={12} />

              <span style={{
                width: 40,
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-tertiary)',
                fontFamily: 'var(--font-family)',
              }}>
                {cat.icon}
              </span>

              <span style={{
                flex: 1,
                fontSize: 'var(--font-size-sm)',
                fontWeight: 'var(--font-weight-medium)',
                color: 'var(--color-text-primary)',
                fontFamily: 'var(--font-family)',
              }}>
                {cat.name}
              </span>

              <span style={{
                width: 100,
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-secondary)',
                fontFamily: 'var(--font-family)',
              }}>
                {cat.maxAmount ? formatCurrency(cat.maxAmount) : '\u2014'}
              </span>

              <span style={{ width: 80 }}>
                {cat.receiptRequired ? (
                  <Badge variant="warning">{t('hr.expenses.categories.required')}</Badge>
                ) : (
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>\u2014</span>
                )}
              </span>

              <span style={{ width: 64 }}>
                <Badge variant={cat.isActive ? 'primary' : 'default'}>
                  {cat.isActive ? t('hr.status.active') : t('hr.leaveTypes.inactive')}
                </Badge>
              </span>

              <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
                <IconButton
                  icon={cat.isActive ? <XCircle size={14} /> : <Check size={14} />}
                  label={cat.isActive ? t('hr.leaveTypes.deactivate') : t('hr.leaveTypes.activate')}
                  size={26}
                  onClick={() => updateCategory.mutate({ id: cat.id, isActive: !cat.isActive })}
                />
                {canDelete && (
                  <IconButton
                    icon={<Trash2 size={14} />}
                    label={t('common.delete')}
                    size={26}
                    destructive
                    onClick={() => deleteCategory.mutate(cat.id)}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div style={{
          marginTop: 'var(--spacing-lg)',
          padding: 'var(--spacing-lg)',
          border: '1px solid var(--color-border-primary)',
          borderRadius: 'var(--radius-lg)',
          background: 'var(--color-bg-primary)',
        }}>
          <div style={{
            fontSize: 'var(--font-size-sm)',
            fontWeight: 'var(--font-weight-semibold)',
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-family)',
            marginBottom: 'var(--spacing-lg)',
          }}>
            {t('hr.expenses.categories.add')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
            <div style={{ display: 'flex', gap: 'var(--spacing-md)', alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
                <label className="hr-field-label">{t('hr.fields.color')}</label>
                <div style={{
                  width: 34, height: 34, borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border-secondary)', overflow: 'hidden', position: 'relative',
                }}>
                  <div style={{ position: 'absolute', inset: 0, background: color, borderRadius: 'var(--radius-sm)' }} />
                  <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} />
                </div>
              </div>
              <Input label={t('hr.fields.name')} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('hr.expenses.categories.namePlaceholder')} style={{ flex: 2 }} autoFocus />
              <Input label={t('hr.expenses.categories.icon')} value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="receipt" style={{ flex: 1 }} />
            </div>
            <div style={{ display: 'flex', gap: 'var(--spacing-md)', alignItems: 'flex-end' }}>
              <Input label={t('hr.expenses.categories.maxAmount')} type="number" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} placeholder={t('hr.expenses.categories.maxAmountPlaceholder')} style={{ flex: 1 }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', paddingBottom: 4 }}>
                <input
                  type="checkbox"
                  id="receiptRequired"
                  checked={receiptRequired}
                  onChange={(e) => setReceiptRequired(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <label htmlFor="receiptRequired" style={{
                  fontSize: 'var(--font-size-sm)',
                  color: 'var(--color-text-secondary)',
                  fontFamily: 'var(--font-family)',
                  cursor: 'pointer',
                }}>
                  {t('hr.expenses.categories.requireReceipt')}
                </label>
              </div>
            </div>
            <div style={{
              display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'flex-end',
              paddingTop: 'var(--spacing-sm)', borderTop: '1px solid var(--color-border-secondary)',
            }}>
              <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>{t('common.cancel')}</Button>
              <Button variant="primary" size="sm" onClick={handleCreate} disabled={!name.trim()}>{t('common.save')}</Button>
            </div>
          </div>
        </div>
      )}

      {!showCreate && categories && categories.length > 0 && (
        <div style={{ marginTop: 'var(--spacing-lg)' }}>
          <Button variant="secondary" size="sm" icon={<Plus size={14} />} onClick={() => setShowCreate(true)}>
            {t('hr.expenses.categories.add')}
          </Button>
        </div>
      )}
    </div>
  );
}
