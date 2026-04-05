import { useTranslation } from 'react-i18next';
import { Modal } from '../../../../components/ui/modal';
import { Button } from '../../../../components/ui/button';
import { TAG_COLORS } from '../../lib/helpers';
import type { DriveItem } from '@atlasmail/shared';

interface TagModalProps {
  tagModalItem: DriveItem | null;
  setTagModalItem: (item: DriveItem | null) => void;
  tagLabel: string;
  setTagLabel: (v: string) => void;
  tagColor: string;
  setTagColor: (v: string) => void;
  handleTagSubmit: () => void;
}

export function TagModal({
  tagModalItem,
  setTagModalItem,
  tagLabel,
  setTagLabel,
  tagColor,
  setTagColor,
  handleTagSubmit,
}: TagModalProps) {
  const { t } = useTranslation();
  return (
    <Modal open={!!tagModalItem} onOpenChange={() => setTagModalItem(null)} width={360} title={t('drive.modals.addTag')}>
      <div style={{ padding: 'var(--spacing-xl)' }}>
        <input
          value={tagLabel}
          onChange={(e) => setTagLabel(e.target.value)}
          placeholder={t('drive.modals.tagName')}
          autoFocus
          onKeyDown={(e) => { if (e.key === 'Enter') handleTagSubmit(); }}
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
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          {TAG_COLORS.map((c) => (
            <button
              key={c.name}
              onClick={() => setTagColor(c.hex)}
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                border: tagColor === c.hex ? `2px solid ${c.hex}` : '2px solid transparent',
                background: c.hex,
                cursor: 'pointer',
                outline: tagColor === c.hex ? `2px solid var(--color-bg-primary)` : 'none',
                outlineOffset: -4,
              }}
            />
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <Button variant="secondary" onClick={() => setTagModalItem(null)}>
            {t('drive.modals.cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={handleTagSubmit}
            disabled={!tagLabel.trim()}
            style={{
              opacity: tagLabel.trim() ? 1 : 0.5,
              cursor: tagLabel.trim() ? 'pointer' : 'not-allowed',
            }}
          >
            {t('drive.modals.add')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
