import { type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Settings, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';
import { IconButton } from '../../../components/ui/icon-button';
import { Select } from '../../../components/ui/select';
import type { SignatureField, SignatureFieldType, FieldOptions } from '@atlas-platform/shared';
import type { Signer } from './signer-panel';

const SIGNER_COLORS = ['#8b5cf6', '#3b82f6', '#ef4444', '#f59e0b', '#10b981'];

const FIELD_TYPE_OPTIONS: { value: SignatureFieldType; label: string }[] = [
  { value: 'signature', label: 'Signature' },
  { value: 'initials', label: 'Initials' },
  { value: 'date', label: 'Date' },
  { value: 'text', label: 'Text' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'dropdown', label: 'Dropdown' },
];

interface FieldPropertiesPanelProps {
  field: SignatureField;
  signers: Signer[];
  onUpdateField: (data: Partial<SignatureField>) => void;
  onDeleteField: () => void;
}

function DropdownOptionsEditor({
  field,
  onUpdateField,
}: {
  field: SignatureField;
  onUpdateField: (data: Partial<SignatureField>) => void;
}) {
  const { t } = useTranslation();
  const [newOption, setNewOption] = useState('');

  const options = field.options?.dropdownOptions ?? [];

  const addOption = () => {
    const trimmed = newOption.trim();
    if (!trimmed) return;
    const opts: FieldOptions = {
      ...(field.options || {}),
      dropdownOptions: [...options, trimmed],
    };
    onUpdateField({ options: opts } as Partial<SignatureField>);
    setNewOption('');
  };

  const removeOption = (index: number) => {
    const opts: FieldOptions = {
      ...(field.options || {}),
      dropdownOptions: options.filter((_, i) => i !== index),
    };
    onUpdateField({ options: opts } as Partial<SignatureField>);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
      <label
        style={{
          fontSize: 'var(--font-size-xs)',
          color: 'var(--color-text-secondary)',
          fontWeight: 'var(--font-weight-medium)' as CSSProperties['fontWeight'],
        }}
      >
        {t('sign.fields.dropdownOptions')}
      </label>

      {options.length === 0 && (
        <span
          style={{
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-text-tertiary)',
            fontStyle: 'italic',
          }}
        >
          {t('sign.fields.noOptions')}
        </span>
      )}

      {options.map((opt, idx) => (
        <div
          key={idx}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-xs)',
          }}
        >
          <span
            style={{
              flex: 1,
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {opt}
          </span>
          <IconButton
            icon={<X size={12} />}
            label={t('common.delete')}
            size={24}
            onClick={() => removeOption(idx)}
          />
        </div>
      ))}

      <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
        <Input
          value={newOption}
          onChange={(e) => setNewOption(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addOption();
            }
          }}
          placeholder={t('sign.fields.addOption')}
          size="sm"
          style={{ flex: 1 }}
        />
        <Button
          variant="secondary"
          size="sm"
          icon={<Plus size={13} />}
          onClick={addOption}
        >
          {t('sign.fields.addOption')}
        </Button>
      </div>
    </div>
  );
}

export function FieldPropertiesPanel({
  field,
  signers,
  onUpdateField,
  onDeleteField,
}: FieldPropertiesPanelProps) {
  const { t } = useTranslation();

  const signerOptions = [
    { value: '', label: t('sign.fieldProps.unassigned') },
    ...signers
      .filter((s) => s.email.trim())
      .map((s, idx) => ({
        value: s.email,
        label: s.name || s.email,
        color: SIGNER_COLORS[idx % SIGNER_COLORS.length],
      })),
  ];

  const fieldTypeOptions = FIELD_TYPE_OPTIONS.map((opt) => ({
    value: opt.value,
    label: t(`sign.fields.${opt.value}`),
  }));

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--spacing-md)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-sm)',
          padding: '0 var(--spacing-xs)',
        }}
      >
        <Settings size={13} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
        <span
          style={{
            fontSize: 'var(--font-size-xs)',
            fontWeight: 'var(--font-weight-semibold)' as CSSProperties['fontWeight'],
            color: 'var(--color-text-tertiary)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {t('sign.fieldProps.title')}
        </span>
      </div>

      {/* Field type */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
        <label
          style={{
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-text-secondary)',
            fontWeight: 'var(--font-weight-medium)' as CSSProperties['fontWeight'],
          }}
        >
          {t('sign.fieldProps.fieldType')}
        </label>
        <Select
          value={field.type}
          onChange={(value) => onUpdateField({ type: value as SignatureFieldType })}
          options={fieldTypeOptions}
          size="sm"
        />
      </div>

      {/* Signer assignment */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
        <label
          style={{
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-text-secondary)',
            fontWeight: 'var(--font-weight-medium)' as CSSProperties['fontWeight'],
          }}
        >
          {t('sign.fieldProps.assignedTo')}
        </label>
        <Select
          value={field.signerEmail ?? ''}
          onChange={(value) => onUpdateField({ signerEmail: value || null })}
          options={signerOptions}
          size="sm"
        />
      </div>

      {/* Label / placeholder */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
        <label
          style={{
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-text-secondary)',
            fontWeight: 'var(--font-weight-medium)' as CSSProperties['fontWeight'],
          }}
        >
          {t('sign.fieldProps.label')}
        </label>
        <Input
          value={field.label ?? ''}
          onChange={(e) => onUpdateField({ label: e.target.value || null })}
          placeholder={t('sign.fieldProps.labelPlaceholder')}
          size="sm"
        />
      </div>

      {/* Required toggle */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--spacing-xs) 0',
        }}
      >
        <label
          style={{
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-text-secondary)',
            fontWeight: 'var(--font-weight-medium)' as CSSProperties['fontWeight'],
          }}
        >
          {t('sign.fieldProps.required')}
        </label>
        <button
          onClick={() => onUpdateField({ required: !field.required })}
          style={{
            width: 32,
            height: 18,
            borderRadius: 9,
            border: 'none',
            background: field.required ? 'var(--color-accent-primary)' : 'var(--color-bg-tertiary)',
            cursor: 'pointer',
            position: 'relative',
            transition: 'background 0.15s',
            padding: 0,
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: 2,
              left: field.required ? 16 : 2,
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: '#fff',
              boxShadow: 'var(--shadow-sm)',
              transition: 'left 0.15s',
            }}
          />
        </button>
      </div>

      {/* Read only toggle */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--spacing-xs) 0',
        }}
      >
        <label
          style={{
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-text-secondary)',
            fontWeight: 'var(--font-weight-medium)' as CSSProperties['fontWeight'],
          }}
        >
          {t('sign.fields.readOnly')}
        </label>
        <button
          onClick={() => {
            const opts: FieldOptions = { ...(field.options || {}), readOnly: !(field.options?.readOnly) };
            onUpdateField({ options: opts } as Partial<SignatureField>);
          }}
          style={{
            width: 32,
            height: 18,
            borderRadius: 9,
            border: 'none',
            background: field.options?.readOnly ? 'var(--color-accent-primary)' : 'var(--color-bg-tertiary)',
            cursor: 'pointer',
            position: 'relative',
            transition: 'background 0.15s',
            padding: 0,
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: 2,
              left: field.options?.readOnly ? 16 : 2,
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: '#fff',
              boxShadow: 'var(--shadow-sm)',
              transition: 'left 0.15s',
            }}
          />
        </button>
      </div>

      {/* Placeholder (for text/name/email fields) */}
      {['text', 'name', 'email'].includes(field.type) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
          <label
            style={{
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-text-secondary)',
              fontWeight: 'var(--font-weight-medium)' as CSSProperties['fontWeight'],
            }}
          >
            {t('sign.fields.placeholder')}
          </label>
          <Input
            value={field.options?.placeholder ?? ''}
            onChange={(e) => {
              const opts: FieldOptions = { ...(field.options || {}), placeholder: e.target.value || undefined };
              onUpdateField({ options: opts } as Partial<SignatureField>);
            }}
            placeholder={t('sign.fields.placeholder')}
            size="sm"
          />
        </div>
      )}

      {/* Font size (for text/name/email fields) */}
      {['text', 'name', 'email'].includes(field.type) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
          <label
            style={{
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-text-secondary)',
              fontWeight: 'var(--font-weight-medium)' as CSSProperties['fontWeight'],
            }}
          >
            {t('sign.fields.fontSize')}
          </label>
          <Input
            type="number"
            value={String(field.options?.fontSize ?? '')}
            onChange={(e) => {
              const val = e.target.value ? parseInt(e.target.value, 10) : undefined;
              const opts: FieldOptions = { ...(field.options || {}), fontSize: val };
              onUpdateField({ options: opts } as Partial<SignatureField>);
            }}
            placeholder="14"
            size="sm"
          />
        </div>
      )}

      {/* Text align (for text/name/email fields) */}
      {['text', 'name', 'email'].includes(field.type) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
          <label
            style={{
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-text-secondary)',
              fontWeight: 'var(--font-weight-medium)' as CSSProperties['fontWeight'],
            }}
          >
            {t('sign.fields.textAlign')}
          </label>
          <Select
            value={field.options?.textAlign ?? 'left'}
            onChange={(value) => {
              const opts: FieldOptions = { ...(field.options || {}), textAlign: value as FieldOptions['textAlign'] };
              onUpdateField({ options: opts } as Partial<SignatureField>);
            }}
            options={[
              { value: 'left', label: t('sign.fields.alignLeft') },
              { value: 'center', label: t('sign.fields.alignCenter') },
              { value: 'right', label: t('sign.fields.alignRight') },
            ]}
            size="sm"
          />
        </div>
      )}

      {/* Dropdown options */}
      {field.type === 'dropdown' && (
        <DropdownOptionsEditor field={field} onUpdateField={onUpdateField} />
      )}

      {/* Size controls */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
        <label
          style={{
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-text-secondary)',
            fontWeight: 'var(--font-weight-medium)' as CSSProperties['fontWeight'],
          }}
        >
          {t('sign.fieldProps.size')}
        </label>
        <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
          <Input
            value={String(Math.round(field.width * 10) / 10)}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              if (!isNaN(val) && val > 0) onUpdateField({ width: val });
            }}
            size="sm"
            style={{ flex: 1 }}
          />
          <span
            style={{
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-text-tertiary)',
              alignSelf: 'center',
            }}
          >
            x
          </span>
          <Input
            value={String(Math.round(field.height * 10) / 10)}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              if (!isNaN(val) && val > 0) onUpdateField({ height: val });
            }}
            size="sm"
            style={{ flex: 1 }}
          />
        </div>
      </div>

      {/* Delete button */}
      <Button
        variant="danger"
        size="sm"
        icon={<Trash2 size={13} />}
        onClick={onDeleteField}
        style={{ marginTop: 'var(--spacing-xs)' }}
      >
        {t('sign.fieldProps.deleteField')}
      </Button>
    </div>
  );
}
