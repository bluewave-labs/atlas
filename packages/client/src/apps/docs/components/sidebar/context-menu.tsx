import { Star, Copy, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../../components/ui/button';

// ─── ContextMenu ────────────────────────────────────────────────────────

export function DocContextMenu({
  onDelete,
  onDuplicate,
  onToggleFavorite,
  isFavorite,
}: {
  onDelete: () => void;
  onDuplicate: () => void;
  onToggleFavorite: () => void;
  isFavorite: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div
      style={{
        position: 'absolute',
        top: '100%',
        right: 0,
        marginTop: 2,
        zIndex: 100,
        minWidth: 180,
        background: 'var(--color-bg-elevated)',
        border: '1px solid var(--color-border-primary)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-lg)',
        padding: 4,
        fontFamily: 'var(--font-family)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <MenuButton
        icon={<Star size={14} />}
        label={isFavorite ? t('docs.removeFromFavorites') : t('docs.addToFavorites')}
        onClick={onToggleFavorite}
      />
      <MenuButton icon={<Copy size={14} />} label={t('docs.duplicate')} onClick={onDuplicate} />
      <div style={{ height: 1, background: 'var(--color-border-primary)', margin: '4px 0' }} />
      <MenuButton icon={<Trash2 size={14} />} label={t('common.delete')} onClick={onDelete} danger />
    </div>
  );
}

function MenuButton({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <Button
      variant={danger ? 'danger' : 'ghost'}
      size="sm"
      icon={icon}
      onClick={onClick}
      style={{
        width: '100%',
        justifyContent: 'flex-start',
        color: danger ? 'var(--color-status-error)' : 'var(--color-text-secondary)',
        border: 'none',
      }}
    >
      {label}
    </Button>
  );
}
