import { useTranslation } from 'react-i18next';
import { HardDrive, FolderPlus } from 'lucide-react';
import { Modal } from '../../../../components/ui/modal';
import { Button } from '../../../../components/ui/button';

interface FolderTreeItem {
  id: string;
  name: string;
  depth: number;
}

interface MoveModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  folderTree: FolderTreeItem[];
  targetId: string | null;
  setTargetId: (id: string | null) => void;
  onSubmit: () => void;
}

export function MoveModal({
  open,
  onOpenChange,
  title,
  folderTree,
  targetId,
  setTargetId,
  onSubmit,
}: MoveModalProps) {
  const { t } = useTranslation();
  return (
    <Modal open={open} onOpenChange={onOpenChange} width={400} title={title}>
      <div style={{ padding: 'var(--spacing-xl)', maxHeight: 400, overflowY: 'auto' }}>
        <button
          onClick={() => setTargetId(null)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            width: '100%',
            padding: '8px 10px',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            background: targetId === null ? 'var(--color-surface-active)' : 'transparent',
            color: 'var(--color-text-primary)',
            fontSize: 'var(--font-size-sm)',
            fontFamily: 'var(--font-family)',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <HardDrive size={16} />
          {t('drive.modals.myDriveRoot')}
        </button>

        {folderTree.map((folder) => (
          <button
            key={folder.id}
            onClick={() => setTargetId(folder.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: '8px 10px',
              paddingLeft: 10 + folder.depth * 20,
              border: 'none',
              borderRadius: 'var(--radius-md)',
              background: targetId === folder.id ? 'var(--color-surface-active)' : 'transparent',
              color: 'var(--color-text-primary)',
              fontSize: 'var(--font-size-sm)',
              fontFamily: 'var(--font-family)',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <FolderPlus size={16} color="#64748b" />
            {folder.name}
          </button>
        ))}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16, borderTop: '1px solid var(--color-border-secondary)', paddingTop: 16 }}>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t('drive.modals.cancel')}
          </Button>
          <Button variant="primary" onClick={onSubmit}>
            {t('drive.modals.moveHere')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
