import { useState, type CSSProperties, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ArrowRight } from 'lucide-react';
import { OdooImportWizard } from './odoo-import-wizard';

type ActiveImporter = 'odoo' | null;

interface ImporterDef {
  id: 'odoo' | 'hubspot';
  i18nKey: string;
  logo: ReactNode;
  /** When true, the card renders but isn't clickable yet */
  comingSoon?: boolean;
}

const IMPORTERS: ImporterDef[] = [
  {
    id: 'odoo',
    i18nKey: 'odoo',
    logo: (
      <img
        src="/importers/odoo-logo.svg"
        alt=""
        style={{ maxHeight: 28, maxWidth: '100%', width: 'auto', display: 'block' }}
      />
    ),
  },
  {
    id: 'hubspot',
    i18nKey: 'hubspot',
    logo: (
      <img
        src="/importers/hubspot-logo.svg"
        alt=""
        style={{ maxHeight: 28, maxWidth: '100%', width: 'auto', display: 'block' }}
      />
    ),
    comingSoon: true,
  },
];

export function DataImportPanel() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [active, setActive] = useState<ActiveImporter>(null);

  if (active === 'odoo') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
        <BackHeader
          label={t('import.backToImporters')}
          onClick={() => setActive(null)}
        />
        <SectionHeader
          title={t('import.odoo.title')}
          subtitle={t('import.odoo.subtitle')}
        />
        <OdooImportWizard onClose={() => navigate('/crm')} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      <SectionHeader
        title={t('import.indexTitle')}
        subtitle={t('import.indexSubtitle')}
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 'var(--spacing-md)',
        }}
      >
        {IMPORTERS.map((imp) => (
          <ImporterCard
            key={imp.id}
            logo={imp.logo}
            title={t(`import.${imp.i18nKey}.title`)}
            description={t(`import.${imp.i18nKey}.subtitle`)}
            cta={imp.comingSoon ? t('import.comingSoon') : t('import.startImport')}
            disabled={imp.comingSoon}
            onClick={() => {
              if (imp.comingSoon) return;
              if (imp.id === 'odoo') setActive('odoo');
            }}
          />
        ))}
      </div>
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <h3
        style={{
          margin: 0,
          fontSize: 'var(--font-size-md)',
          fontWeight: 600,
          color: 'var(--color-text-primary)',
        }}
      >
        {title}
      </h3>
      <p
        style={{
          margin: 0,
          color: 'var(--color-text-secondary)',
          fontSize: 'var(--font-size-sm)',
        }}
      >
        {subtitle}
      </p>
    </div>
  );
}

function BackHeader({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        background: 'transparent',
        border: 'none',
        padding: 0,
        color: 'var(--color-text-secondary)',
        fontSize: 'var(--font-size-sm)',
        fontFamily: 'inherit',
        cursor: 'pointer',
        alignSelf: 'flex-start',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-text-primary)')}
      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-secondary)')}
    >
      <ChevronLeft size={14} />
      {label}
    </button>
  );
}

interface CardProps {
  logo: ReactNode;
  title: string;
  description: string;
  cta: string;
  onClick: () => void;
  disabled?: boolean;
}

const cardBase: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--spacing-md)',
  padding: 'var(--spacing-lg)',
  background: 'var(--color-bg-primary)',
  border: '1px solid var(--color-border-primary)',
  borderRadius: 'var(--radius-md)',
  cursor: 'pointer',
  transition: 'border-color 150ms, box-shadow 150ms, opacity 150ms',
  fontFamily: 'inherit',
  textAlign: 'left',
  width: '100%',
};

function ImporterCard({ logo, title, description, cta, onClick, disabled }: CardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        ...cardBase,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        e.currentTarget.style.borderColor = 'var(--color-accent-primary)';
        e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
      }}
      onMouseLeave={(e) => {
        if (disabled) return;
        e.currentTarget.style.borderColor = 'var(--color-border-primary)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
        <div
          style={{
            width: 96,
            height: 56,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border-secondary)',
            borderRadius: 'var(--radius-md)',
            flexShrink: 0,
            padding: '8px 12px',
          }}
        >
          {logo}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 'var(--font-size-md)',
              fontWeight: 600,
              color: 'var(--color-text-primary)',
              marginBottom: 2,
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-secondary)',
              lineHeight: 1.5,
            }}
          >
            {description}
          </div>
        </div>
      </div>
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          color: disabled ? 'var(--color-text-tertiary)' : 'var(--color-accent-primary)',
          fontSize: 'var(--font-size-sm)',
          fontWeight: 500,
          marginTop: 'auto',
        }}
      >
        {cta}
        {!disabled && <ArrowRight size={14} />}
      </div>
    </button>
  );
}
