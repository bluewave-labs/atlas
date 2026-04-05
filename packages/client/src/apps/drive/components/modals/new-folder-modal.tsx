import { useTranslation } from 'react-i18next';
import { Modal } from '../../../../components/ui/modal';
import { Button } from '../../../../components/ui/button';

interface NewFolderModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  folderName: string;
  setFolderName: (v: string) => void;
  onSubmit: () => void;
}

export function NewFolderModal({
  open,
  onOpenChange,
  folderName,
  setFolderName,
  onSubmit,
}: NewFolderModalProps) {
  const { t } = useTranslation();
  return (
    <Modal open={open} onOpenChange={onOpenChange} width={400} title={t('drive.modals.newFolder')}>
      <div style={{ padding: 'var(--spacing-xl)' }}>
        <input
          value={folderName}
          onChange={(e) => setFolderName(e.target.value)}
          placeholder={t('drive.modals.folderName')}
          autoFocus
          onKeyDown={(e) => { if (e.key === 'Enter') onSubmit(); }}
          style={{
            width: '100%',
            padding: '8px 12px',
            border: '1px solid var(--color-border-primary)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-bg-primary)',
            color: 'var(--color-text-primary)',
            fontSize: 'var(--font-size-md)',
            fontFamily: 'var(--font-family)',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t('drive.modals.cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={onSubmit}
            disabled={!folderName.trim()}
            style={{
              opacity: folderName.trim() ? 1 : 0.5,
              cursor: folderName.trim() ? 'pointer' : 'not-allowed',
            }}
          >
            {t('drive.modals.create')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
