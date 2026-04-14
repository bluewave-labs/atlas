import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Briefcase, FileSignature, Receipt, Link as LinkIcon } from 'lucide-react';
import { appRegistry } from '../../../apps';

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
  const appColors = useMemo(() => {
    const map: Record<string, string> = {};
    for (const app of appRegistry.getAll()) map[app.id] = app.color;
    return map;
  }, []);
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
          const color = appColors[link.appId] ?? 'var(--color-text-tertiary)';
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
                border: `1px solid color-mix(in srgb, ${color} 20%, transparent)`,
                background: `color-mix(in srgb, ${color} 8%, transparent)`,
                color,
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
