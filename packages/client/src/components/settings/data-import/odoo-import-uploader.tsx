import { useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
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

  const handleFile = (setter: (f: File | null) => void) => (e: ChangeEvent<HTMLInputElement>) => {
    setter(e.target.files?.[0] ?? null);
  };

  const handleSubmit = () => {
    if (!partners) return;
    onSubmit({ partners, leads: leads ?? undefined, activities: activities ?? undefined });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', margin: 0 }}>
        {t('import.odoo.instructions')}
      </p>

      <FileSlot
        label={t('import.odoo.partnersLabel')}
        required
        file={partners}
        onChange={handleFile(setPartners)}
      />
      <FileSlot
        label={t('import.odoo.leadsLabel')}
        file={leads}
        onChange={handleFile(setLeads)}
      />
      <FileSlot
        label={t('import.odoo.activitiesLabel')}
        file={activities}
        onChange={handleFile(setActivities)}
      />

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="primary" disabled={!canSubmit} onClick={handleSubmit}>
          {busy ? t('import.odoo.parsing') : t('import.odoo.preview')}
        </Button>
      </div>
    </div>
  );
}

function FileSlot({
  label,
  required,
  file,
  onChange,
}: {
  label: string;
  required?: boolean;
  file: File | null;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
      <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--color-text-primary)' }}>
        {label} {required ? '*' : null}
      </span>
      <input
        type="file"
        accept=".csv,text/csv"
        onChange={onChange}
        style={{ fontSize: 'var(--font-size-sm)' }}
      />
      {file && (
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
          {file.name} · {Math.round(file.size / 1024)} KB
        </span>
      )}
    </label>
  );
}
