import { useTranslation } from 'react-i18next';
import { Trash2, FolderInput, Copy, Download, X } from 'lucide-react';
import { Button } from '../../../components/ui/button';

interface DriveBulkBarProps {
  selectedCount: number;
  onMove: () => void;
  onCopy: () => void;
  onTrash: () => void;
  onDownload: () => void;
  onClear: () => void;
  canDelete: boolean;
  canEdit: boolean;
}

export function DriveBulkBar({
  selectedCount, onMove, onCopy, onTrash, onDownload, onClear, canDelete, canEdit,
}: DriveBulkBarProps) {
  const { t } = useTranslation();
  if (selectedCount < 1) return null;
  return (
    <div
      className="drive-bulk-bar"
      role="toolbar"
      aria-label={t('drive.bulk.toolbar')}
      style={{
        position: 'fixed',
        bottom: 96,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--spacing-sm)',
        padding: 'var(--spacing-sm) var(--spacing-md)',
        background: 'var(--color-bg-elevated)',
        border: '1px solid var(--color-border-primary)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-lg)',
        zIndex: 90,
      }}
    >
      <span style={{
        fontSize: 'var(--font-size-sm)',
        fontWeight: 'var(--font-weight-medium)',
        color: 'var(--color-text-primary)',
        paddingInline: 'var(--spacing-xs)',
      }}>
        {t('drive.bulk.selected', { count: selectedCount })}
      </span>
      <div style={{ width: 1, height: 20, background: 'var(--color-border-primary)' }} />
      {canEdit && (
        <Button variant="ghost" size="sm" icon={<FolderInput size={13} />} onClick={onMove}>
          {t('drive.bulk.move')}
        </Button>
      )}
      {canEdit && (
        <Button variant="ghost" size="sm" icon={<Copy size={13} />} onClick={onCopy}>
          {t('drive.bulk.copy')}
        </Button>
      )}
      <Button variant="ghost" size="sm" icon={<Download size={13} />} onClick={onDownload}>
        {t('drive.bulk.download')}
      </Button>
      {canDelete && (
        <Button variant="danger" size="sm" icon={<Trash2 size={13} />} onClick={onTrash}>
          {t('drive.bulk.trash')}
        </Button>
      )}
      <div style={{ width: 1, height: 20, background: 'var(--color-border-primary)' }} />
      <Button variant="ghost" size="sm" icon={<X size={13} />} onClick={onClear} aria-label={t('drive.bulk.clear')} />
    </div>
  );
}
