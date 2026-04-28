import { useTranslation } from 'react-i18next';
import { OdooImportWizard } from './odoo-import-wizard';

export function DataImportPanel() {
  const { t } = useTranslation();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      <h2 style={{ margin: 0, fontSize: 'var(--font-size-xl)', fontWeight: 600 }}>
        {t('import.odoo.title')}
      </h2>
      <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
        {t('import.odoo.subtitle')}
      </p>
      <OdooImportWizard onClose={() => window.location.reload()} />
    </div>
  );
}
