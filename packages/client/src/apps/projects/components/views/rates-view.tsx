import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil, Trash2, Plus, X, Check } from 'lucide-react';
import { useRates, useCreateRate, useUpdateRate, useDeleteRate } from '../../hooks';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { IconButton } from '../../../../components/ui/icon-button';
import { Badge } from '../../../../components/ui/badge';
import { ConfirmDialog } from '../../../../components/ui/confirm-dialog';
import type { ProjectRate, CreateRateInput } from '@atlas-platform/shared';

// ─── Inline edit row ─────────────────────────────────────────────

interface RateFormValues {
  title: string;
  factor: string;
  extraPerHour: string;
}

const EMPTY_FORM: RateFormValues = { title: '', factor: '1', extraPerHour: '0' };

function RateFormRow({
  initial,
  onSave,
  onCancel,
  isSaving,
}: {
  initial: RateFormValues;
  onSave: (v: RateFormValues) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState<RateFormValues>(initial);

  return (
    <div className="projects-rate-row projects-rate-row--editing">
      <Input
        value={form.title}
        onChange={(e) => setForm({ ...form, title: e.target.value })}
        placeholder={t('projects.rates.rateTitle')}
        size="sm"
        style={{ width: 180 }}
        autoFocus
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
        <Input
          type="number"
          step="0.1"
          min="0"
          value={form.factor}
          onChange={(e) => setForm({ ...form, factor: e.target.value })}
          size="sm"
          style={{ width: 70 }}
        />
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>x</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>+</span>
        <Input
          type="number"
          step="1"
          min="0"
          value={form.extraPerHour}
          onChange={(e) => setForm({ ...form, extraPerHour: e.target.value })}
          size="sm"
          style={{ width: 80 }}
        />
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>/h</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', marginLeft: 'auto' }}>
        <IconButton
          icon={<Check size={14} />}
          label={t('common.save')}
          size={28}
          onClick={() => onSave(form)}
          disabled={!form.title.trim() || isSaving}
        />
        <IconButton
          icon={<X size={14} />}
          label={t('common.cancel')}
          size={28}
          onClick={onCancel}
        />
      </div>
    </div>
  );
}

// ─── Rate row (read mode) ────────────────────────────────────────

function RateRow({
  rate,
  onEdit,
  onDelete,
}: {
  rate: ProjectRate;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const factorLabel = `${rate.factor}x`;
  const extraLabel = rate.extraPerHour > 0 ? `+$${rate.extraPerHour}/h` : '';

  return (
    <div className="projects-rate-row">
      <span style={{ fontWeight: 'var(--font-weight-medium)' as React.CSSProperties['fontWeight'], fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', minWidth: 180 }}>
        {rate.title}
      </span>
      <Badge>{factorLabel}</Badge>
      {extraLabel && <Badge variant="primary">{extraLabel}</Badge>}
      <span style={{ flex: 1 }} />
      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginRight: 'var(--spacing-sm)' }}>
        {t('projects.rates.formula', { factor: rate.factor, extra: rate.extraPerHour })}
      </span>
      <IconButton icon={<Pencil size={13} />} label={t('common.edit')} size={26} onClick={onEdit} />
      <IconButton icon={<Trash2 size={13} />} label={t('common.delete')} size={26} destructive onClick={onDelete} />
    </div>
  );
}

// ─── Main view ───────────────────────────────────────────────────

export function RatesView() {
  const { t } = useTranslation();
  const { data: ratesData } = useRates();
  const rates = ratesData ?? [];
  const createRate = useCreateRate();
  const updateRate = useUpdateRate();
  const deleteRate = useDeleteRate();

  const [showNewForm, setShowNewForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectRate | null>(null);

  const handleCreate = useCallback(
    (values: RateFormValues) => {
      const input: CreateRateInput = {
        title: values.title.trim(),
        factor: parseFloat(values.factor) || 1,
        extraPerHour: parseFloat(values.extraPerHour) || 0,
      };
      createRate.mutate(input, { onSuccess: () => setShowNewForm(false) });
    },
    [createRate],
  );

  const handleUpdate = useCallback(
    (id: string, values: RateFormValues) => {
      updateRate.mutate(
        {
          id,
          title: values.title.trim(),
          factor: parseFloat(values.factor) || 1,
          extraPerHour: parseFloat(values.extraPerHour) || 0,
        },
        { onSuccess: () => setEditingId(null) },
      );
    },
    [updateRate],
  );

  const handleDelete = useCallback(() => {
    if (!deleteTarget) return;
    deleteRate.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
  }, [deleteRate, deleteTarget]);

  return (
    <div style={{ padding: 'var(--spacing-lg) var(--spacing-xl)', overflow: 'auto', flex: 1, maxWidth: 720 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-lg)' }}>
        <div>
          <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)' as React.CSSProperties['fontWeight'], color: 'var(--color-text-primary)', margin: 0 }}>
            {t('projects.rates.title')}
          </h3>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', margin: '4px 0 0' }}>
            {t('projects.rates.noRatesDesc')}
          </p>
        </div>
        {!showNewForm && (
          <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => setShowNewForm(true)}>
            {t('projects.rates.newRate')}
          </Button>
        )}
      </div>

      {/* New rate form */}
      {showNewForm && (
        <RateFormRow
          initial={EMPTY_FORM}
          onSave={handleCreate}
          onCancel={() => setShowNewForm(false)}
          isSaving={createRate.isPending}
        />
      )}

      {/* Rates list */}
      {rates.length === 0 && !showNewForm && (
        <div style={{ textAlign: 'center', padding: 'var(--spacing-2xl)', color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-sm)' }}>
          {t('projects.rates.noRates')}
        </div>
      )}

      {rates.map((rate) =>
        editingId === rate.id ? (
          <RateFormRow
            key={rate.id}
            initial={{
              title: rate.title,
              factor: String(rate.factor),
              extraPerHour: String(rate.extraPerHour),
            }}
            onSave={(v) => handleUpdate(rate.id, v)}
            onCancel={() => setEditingId(null)}
            isSaving={updateRate.isPending}
          />
        ) : (
          <RateRow
            key={rate.id}
            rate={rate}
            onEdit={() => setEditingId(rate.id)}
            onDelete={() => setDeleteTarget(rate)}
          />
        ),
      )}

      {/* Formula explanation */}
      <div style={{ marginTop: 'var(--spacing-xl)', padding: 'var(--spacing-md)', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-secondary)' }}>
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
          {t('projects.rates.formula')}
        </span>
      </div>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title={t('projects.rates.deleteRate')}
        description={t('projects.rates.confirmDelete')}
        confirmLabel={t('common.delete')}
        onConfirm={handleDelete}
        destructive
      />
    </div>
  );
}
