import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../ui/button';
import { Select } from '../../ui/select';
import type { OdooImportPreview } from '@atlas-platform/shared';
import { humanizeDropReason } from './humanize';

interface Props {
  preview: OdooImportPreview;
  busy: boolean;
  onCommit: (stageMapping: Record<string, string>) => void;
  onCancel: () => void;
}

function defaultMapping(preview: OdooImportPreview): Record<string, string> {
  const result: Record<string, string> = {};
  const stages = preview.atlasStages.slice().sort((a, b) => a.sequence - b.sequence);
  const fallbackId = stages[0]?.id ?? '';
  for (const odoo of preview.stages) {
    const match = stages.find((s) => s.name.toLowerCase() === odoo.odooStage.toLowerCase());
    result[odoo.odooStage] = match ? match.id : fallbackId;
  }
  return result;
}

export function OdooImportPreviewView({ preview, busy, onCommit, onCancel }: Props) {
  const { t } = useTranslation();
  const [mapping, setMapping] = useState<Record<string, string>>(() => defaultMapping(preview));

  const stageOptions = preview.atlasStages
    .slice()
    .sort((a, b) => a.sequence - b.sequence)
    .map((s) => ({ value: s.id, label: s.name }));

  const allMapped = preview.stages.every((s) => mapping[s.odooStage]);
  const canCommit = !busy && (preview.stages.length === 0 || allMapped);

  // Hide stage mapping section when every Odoo stage exactly matched an Atlas stage
  // by name — the auto-matched dropdowns add no decision value, just noise.
  const stageMappingNeedsAttention = preview.stages.some((s) => {
    const mapped = mapping[s.odooStage];
    if (!mapped) return true;
    const target = preview.atlasStages.find((a) => a.id === mapped);
    return !target || target.name.toLowerCase() !== s.odooStage.toLowerCase();
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      <Section title={t('import.odoo.previewSummaryTitle')}>
        <ul style={{ margin: 0, paddingLeft: 'var(--spacing-lg)', color: 'var(--color-text-secondary)' }}>
          <li>{t('import.odoo.companies', { count: preview.counts.companies })}</li>
          <li>{t('import.odoo.contacts', { count: preview.counts.contacts })}</li>
          <li>{t('import.odoo.leads', { count: preview.counts.leads })}</li>
          <li>{t('import.odoo.deals', { count: preview.counts.deals })}</li>
          <li>{t('import.odoo.activities', { count: preview.counts.activities })}</li>
        </ul>
      </Section>

      {preview.dropped.length > 0 && (
        <Section title={t('import.odoo.droppedTitle')}>
          <ul style={{ margin: 0, paddingLeft: 'var(--spacing-lg)', color: 'var(--color-text-secondary)' }}>
            {preview.dropped.map((d, i) => (
              <li key={i}>
                {humanizeDropReason(d.reason, t)} <span style={{ color: 'var(--color-text-tertiary)' }}>({d.count})</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {preview.customFields.length > 0 && (
        <Section title={t('import.odoo.customFieldsTitle')}>
          <p style={{ margin: 0, color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-xs)' }}>
            {t('import.odoo.customFieldsHelp')}
          </p>
          <ul style={{ margin: 0, paddingLeft: 'var(--spacing-lg)', color: 'var(--color-text-secondary)' }}>
            {preview.customFields.map((c, i) => (
              <li key={i}>{`[${c.file}] ${c.column}${c.sampleValue ? ` (e.g. "${c.sampleValue}")` : ''}`}</li>
            ))}
          </ul>
        </Section>
      )}

      {preview.stages.length > 0 && stageMappingNeedsAttention && (
        <Section title={t('import.odoo.stageMappingTitle')}>
          <p style={{ margin: 0, color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-xs)' }}>
            {t('import.odoo.stageMappingHelp')}
          </p>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 'var(--spacing-sm)' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: 'var(--spacing-xs)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
                  {t('import.odoo.odooStage')}
                </th>
                <th style={{ textAlign: 'left', padding: 'var(--spacing-xs)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
                  {t('import.odoo.atlasStage')}
                </th>
              </tr>
            </thead>
            <tbody>
              {preview.stages.map((s) => (
                <tr key={s.odooStage} style={{ borderTop: '1px solid var(--color-border-secondary)' }}>
                  <td style={{ padding: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)' }}>
                    {s.odooStage} <span style={{ color: 'var(--color-text-tertiary)' }}>({s.rowCount})</span>
                  </td>
                  <td style={{ padding: 'var(--spacing-xs)' }}>
                    <Select
                      size="sm"
                      value={mapping[s.odooStage] ?? ''}
                      onChange={(v: string) => setMapping((m) => ({ ...m, [s.odooStage]: v }))}
                      options={stageOptions}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-sm)' }}>
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          {t('import.odoo.cancel')}
        </Button>
        <Button variant="primary" disabled={!canCommit} onClick={() => onCommit(mapping)}>
          {busy ? t('import.odoo.committing') : t('import.odoo.commit')}
        </Button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
      <h3 style={{ margin: 0, fontSize: 'var(--font-size-md)', fontWeight: 600 }}>
        {title}
      </h3>
      {children}
    </section>
  );
}
