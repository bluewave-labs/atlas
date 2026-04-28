import { useCallback, useRef, useState, type CSSProperties, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, FileText, X, Check } from 'lucide-react';
import { Button } from '../../ui/button';

interface Props {
  busy: boolean;
  onSubmit: (input: { partners: File; leads?: File; activities?: File }) => void;
}

export function OdooImportUploader({ busy, onSubmit }: Props) {
  const { t } = useTranslation();
  const [partners, setPartners] = useState<File | null>(null);
  const [leads, setLeads] = useState<File | null>(null);
  const [activities, setActivities] = useState<File | null>(null);

  const canSubmit = !busy && partners !== null;

  const handleSubmit = () => {
    if (!partners) return;
    onSubmit({ partners, leads: leads ?? undefined, activities: activities ?? undefined });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)' }}>
      <Instructions t={t} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 'var(--spacing-md)' }}>
        <DropSlot
          label={t('import.odoo.partnersLabel')}
          required
          file={partners}
          onChange={setPartners}
        />
        <DropSlot
          label={t('import.odoo.leadsLabel')}
          file={leads}
          onChange={setLeads}
        />
        <DropSlot
          label={t('import.odoo.activitiesLabel')}
          file={activities}
          onChange={setActivities}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="primary" disabled={!canSubmit} onClick={handleSubmit}>
          {busy ? t('import.odoo.parsing') : t('import.odoo.preview')}
        </Button>
      </div>
    </div>
  );
}

// ─── Instructions panel ──────────────────────────────────────────

function Instructions({ t }: { t: (k: string) => string }) {
  return (
    <div
      style={{
        background: 'var(--color-bg-secondary)',
        border: '1px solid var(--color-border-secondary)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--spacing-lg)',
      }}
    >
      <h4
        style={{
          margin: 0,
          marginBottom: 'var(--spacing-sm)',
          fontSize: 'var(--font-size-sm)',
          fontWeight: 600,
          color: 'var(--color-text-primary)',
        }}
      >
        {t('import.odoo.instructionsHeading')}
      </h4>
      <ol
        style={{
          margin: 0,
          paddingLeft: 'var(--spacing-lg)',
          color: 'var(--color-text-secondary)',
          fontSize: 'var(--font-size-sm)',
          lineHeight: 1.6,
        }}
      >
        <li>{t('import.odoo.instructionsStep1')}</li>
        <li>
          {t('import.odoo.instructionsStep2Prefix')}{' '}
          <code
            style={{
              background: 'var(--color-bg-tertiary)',
              padding: '1px 6px',
              borderRadius: 'var(--radius-sm)',
              fontSize: 'var(--font-size-xs)',
            }}
          >
            {t('import.odoo.instructionsStep2Toggle')}
          </code>{' '}
          {t('import.odoo.instructionsStep2Suffix')}
        </li>
        <li>{t('import.odoo.instructionsStep3')}</li>
      </ol>
    </div>
  );
}

// ─── Drop slot ───────────────────────────────────────────────────

const dropzoneBase: CSSProperties = {
  border: '2px dashed var(--color-border-primary)',
  borderRadius: 'var(--radius-md)',
  padding: 'var(--spacing-lg)',
  cursor: 'pointer',
  transition: 'border-color 150ms, background 150ms',
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--spacing-md)',
};

const dropzoneActive: CSSProperties = {
  ...dropzoneBase,
  borderColor: 'var(--color-accent-primary)',
  background: 'var(--color-surface-selected)',
};

const dropzoneFilled: CSSProperties = {
  ...dropzoneBase,
  border: '1px solid var(--color-border-primary)',
  background: 'var(--color-bg-secondary)',
  cursor: 'default',
};

interface DropSlotProps {
  label: string;
  required?: boolean;
  file: File | null;
  onChange: (f: File | null) => void;
}

function DropSlot({ label, required, file, onChange }: DropSlotProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);
  const handleDragLeave = useCallback(() => setDragging(false), []);
  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const f = e.dataTransfer.files[0];
      if (f && f.name.toLowerCase().endsWith('.csv')) onChange(f);
    },
    [onChange],
  );
  const handleClick = () => {
    if (file) return;
    inputRef.current?.click();
  };
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    onChange(f);
  };
  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const style = file ? dropzoneFilled : dragging ? dropzoneActive : dropzoneBase;

  return (
    <div
      style={style}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      role="button"
      tabIndex={0}
    >
      {file ? (
        <Check size={20} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
      ) : (
        <Upload size={20} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 'var(--font-size-sm)',
            fontWeight: 500,
            color: 'var(--color-text-primary)',
          }}
        >
          {label} {required ? <span style={{ color: 'var(--color-error)' }}>*</span> : null}
        </div>
        {file ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-xs)',
              marginTop: 2,
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-text-tertiary)',
            }}
          >
            <FileText size={12} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {file.name}
            </span>
            <span style={{ flexShrink: 0 }}>· {Math.round(file.size / 1024)} KB</span>
          </div>
        ) : (
          <div
            style={{
              marginTop: 2,
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-text-tertiary)',
            }}
          >
            {t('import.odoo.dropHint')}
          </div>
        )}
      </div>

      {file && (
        <button
          type="button"
          onClick={handleClear}
          aria-label={t('import.odoo.removeFile')}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--color-text-tertiary)',
            padding: 4,
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            flexShrink: 0,
          }}
        >
          <X size={16} />
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        onChange={handleFileInput}
        style={{ display: 'none' }}
      />
    </div>
  );
}
