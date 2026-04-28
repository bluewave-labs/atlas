import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { OdooImportWizard } from './odoo-import-wizard';

export function DataImportPanel() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      <h2 style={{ margin: 0, fontSize: 'var(--font-size-xl)', fontWeight: 600 }}>
        {t('import.odoo.title')}
      </h2>
      <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
        {t('import.odoo.subtitle')}
      </p>
      <OdooImportWizard onClose={() => navigate('/crm')} />
    </div>
  );
}
