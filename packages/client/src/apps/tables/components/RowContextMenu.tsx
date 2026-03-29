import { useTranslation } from 'react-i18next';
import { ArrowUp, ArrowDown, Copy, Maximize2, Trash2 } from 'lucide-react';
import { ContextMenu, ContextMenuItem, ContextMenuSeparator } from '../../../components/ui/context-menu';

interface RowContextMenuProps {
  rowId: string;
  x: number;
  y: number;
  onClose: () => void;
  onInsertAbove: (rowId: string) => void;
  onInsertBelow: (rowId: string) => void;
  onDuplicate: (rowId: string) => void;
  onExpand: (rowId: string) => void;
  onDelete: (rowId: string) => void;
}

export function RowContextMenu({
  rowId, x, y, onClose,
  onInsertAbove, onInsertBelow, onDuplicate, onExpand, onDelete,
}: RowContextMenuProps) {
  const { t } = useTranslation();

  return (
    <ContextMenu x={x} y={y} onClose={onClose}>
      <ContextMenuItem icon={<ArrowUp size={14} />} label={t('tables.insertAbove')} onClick={() => { onInsertAbove(rowId); onClose(); }} />
      <ContextMenuItem icon={<ArrowDown size={14} />} label={t('tables.insertBelow')} onClick={() => { onInsertBelow(rowId); onClose(); }} />
      <ContextMenuItem icon={<Copy size={14} />} label={t('tables.duplicateRow')} onClick={() => { onDuplicate(rowId); onClose(); }} />
      <ContextMenuItem icon={<Maximize2 size={14} />} label={t('tables.expandRow')} onClick={() => { onExpand(rowId); onClose(); }} />
      <ContextMenuSeparator />
      <ContextMenuItem icon={<Trash2 size={14} />} label={t('tables.deleteRow')} onClick={() => { onDelete(rowId); onClose(); }} destructive />
    </ContextMenu>
  );
}
