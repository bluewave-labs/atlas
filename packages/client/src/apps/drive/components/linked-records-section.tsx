import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Briefcase, FileSignature, Receipt, Link as LinkIcon } from 'lucide-react';

const APP_ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  crm: Briefcase,
  sign: FileSignature,
  invoices: Receipt,
};

export interface LinkedRecord {
  appId: 'crm' | 'sign' | 'invoices';
  recordType: string;
  recordId: string;
  recordTitle: string;
  recordUrl: string;
}

interface Props {
  linkedFrom?: LinkedRecord[];
}

export function LinkedRecordsSection({ linkedFrom }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  if (!linkedFrom || linkedFrom.length === 0) return null;
  return (
    <div style={{
      padding: 'var(--spacing-md)',
      borderBottom: '1px solid var(--color-border-secondary)',
    }}>
      <div style={{
        fontSize: 'var(--font-size-xs)',
        fontWeight: 'var(--font-weight-semibold)',
        color: 'var(--color-text-tertiary)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginBottom: 'var(--spacing-sm)',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}>
        <LinkIcon size={11} />
        {t('drive.linkedFrom.title')}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-xs)' }}>
        {linkedFrom.map((link) => {
          const Icon = APP_ICONS[link.appId] ?? LinkIcon;
          return (
            <button
              key={`${link.appId}-${link.recordId}`}
              onClick={() => navigate(link.recordUrl)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border-primary)',
                background: 'var(--color-bg-secondary)',
                color: 'var(--color-text-secondary)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 'var(--font-weight-medium)',
                cursor: 'pointer',
                fontFamily: 'var(--font-family)',
              }}
            >
              <Icon size={12} />
              {link.recordTitle}
            </button>
          );
        })}
      </div>
    </div>
  );
}
