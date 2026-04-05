import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { History, X } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { IconButton } from '../../../components/ui/icon-button';
import { useDocumentVersions, useCreateVersion } from '../hooks';

// ─── Version history panel ──────────────────────────────────────────────

export function VersionHistoryPanel({
  documentId,
  onClose,
  onRestore,
}: {
  documentId: string;
  onClose: () => void;
  onRestore: (versionId: string) => void;
}) {
  const { t } = useTranslation();
  const { data: versions, isLoading } = useDocumentVersions(documentId);
  const createVersion = useCreateVersion();

  return (
    <div
      style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 320,
        background: 'var(--color-bg-elevated)',
        borderLeft: '1px solid var(--color-border-primary)',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.08)',
        zIndex: 150,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'var(--font-family)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid var(--color-border-primary)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <History size={16} style={{ color: 'var(--color-text-secondary)' }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>
            {t('docs.versionHistory')}
          </span>
        </div>
        <IconButton
          icon={<X size={14} />}
          label={t('common.close')}
          size={24}
          onClick={onClose}
        />
      </div>

      {/* Save snapshot button */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--color-border-primary)' }}>
        <Button
          variant="primary"
          size="sm"
          onClick={() => createVersion.mutate(documentId)}
          disabled={createVersion.isPending}
          style={{ width: '100%', opacity: createVersion.isPending ? 0.6 : 1 }}
        >
          {createVersion.isPending ? t('docs.saving') : t('docs.saveSnapshot')}
        </Button>
      </div>

      {/* Version list */}
      <div style={{ flex: 1, overflow: 'auto', padding: '4px 0' }}>
        {isLoading ? (
          <div style={{ padding: 16, textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 12 }}>
            {t('common.loading')}
          </div>
        ) : !versions || versions.length === 0 ? (
          <div style={{ padding: 16, textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 12 }}>
            {t('docs.noVersionsYet')}
          </div>
        ) : (
          versions.map((v) => (
            <VersionRow
              key={v.id}
              version={v}
              onRestore={() => onRestore(v.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function VersionRow({
  version,
  onRestore,
}: {
  version: { id: string; title: string; createdAt: string };
  onRestore: () => void;
}) {
  const { t } = useTranslation();
  const [hovered, setHovered] = useState(false);
  const date = new Date(version.createdAt);
  const timeStr = date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        background: hovered ? 'var(--color-surface-hover)' : 'transparent',
        transition: 'background 0.1s ease',
      }}
    >
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>
          {version.title}
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 2 }}>
          {timeStr}
        </div>
      </div>
      {hovered && (
        <Button
          variant="secondary"
          size="sm"
          onClick={onRestore}
          style={{ fontSize: 11, height: 24, padding: '0 8px' }}
        >
          {t('docs.restore')}
        </Button>
      )}
    </div>
  );
}
