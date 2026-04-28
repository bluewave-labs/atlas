import { useTranslation } from 'react-i18next';
import { Button } from '../../ui/button';
import type { OdooImportSummary } from '@atlas-platform/shared';

export function OdooImportSummaryView({
  summary,
  onDone,
}: {
  summary: OdooImportSummary;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      <h3 style={{ margin: 0, fontSize: 'var(--font-size-md)', fontWeight: 600 }}>
        {t('import.odoo.summaryTitle')}
      </h3>
      <ul style={{ margin: 0, paddingLeft: 'var(--spacing-lg)', color: 'var(--color-text-secondary)' }}>
        <li>{t('import.odoo.summaryCompanies', { count: summary.imported.companies })}</li>
        <li>{t('import.odoo.summaryContacts', { count: summary.imported.contacts })}</li>
        <li>{t('import.odoo.summaryLeads', { count: summary.imported.leads })}</li>
        <li>{t('import.odoo.summaryDeals', { count: summary.imported.deals })}</li>
        <li>{t('import.odoo.summaryActivities', { count: summary.imported.activities })}</li>
        {summary.customFieldsSkipped > 0 && (
          <li>{t('import.odoo.summaryCustomFieldsSkipped', { count: summary.customFieldsSkipped })}</li>
        )}
      </ul>
      {summary.dropped.length > 0 && (
        <section>
          <h4 style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
            {t('import.odoo.summaryDroppedTitle')}
          </h4>
          <ul style={{ margin: 0, paddingLeft: 'var(--spacing-lg)', color: 'var(--color-text-secondary)' }}>
            {summary.dropped.map((d, i) => (
              <li key={i}>{`[${d.file}] ${d.reason} — ${d.count}`}</li>
            ))}
          </ul>
        </section>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="primary" onClick={onDone}>
          {t('import.odoo.done')}
        </Button>
      </div>
    </div>
  );
}
