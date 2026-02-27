import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowUp, ArrowDown, Copy, Maximize2, Trash2 } from 'lucide-react';

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
  const menuRef = useRef<HTMLDivElement>(null);

  // Adjust position to stay in viewport
  const [pos, setPos] = useState({ x, y });
  useEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let newX = x;
    let newY = y;
    if (rect.right > window.innerWidth) newX = window.innerWidth - rect.width - 8;
    if (rect.bottom > window.innerHeight) newY = window.innerHeight - rect.height - 8;
    if (newX < 0) newX = 8;
    if (newY < 0) newY = 8;
    setPos({ x: newX, y: newY });
  }, [x, y]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="tables-context-menu"
      style={{ left: pos.x, top: pos.y }}
    >
      <button className="tables-context-menu-item" onClick={() => { onInsertAbove(rowId); onClose(); }}>
        <ArrowUp size={14} />
        <span>{t('tables.insertAbove')}</span>
      </button>
      <button className="tables-context-menu-item" onClick={() => { onInsertBelow(rowId); onClose(); }}>
        <ArrowDown size={14} />
        <span>{t('tables.insertBelow')}</span>
      </button>
      <button className="tables-context-menu-item" onClick={() => { onDuplicate(rowId); onClose(); }}>
        <Copy size={14} />
        <span>{t('tables.duplicateRow')}</span>
      </button>
      <button className="tables-context-menu-item" onClick={() => { onExpand(rowId); onClose(); }}>
        <Maximize2 size={14} />
        <span>{t('tables.expandRow')}</span>
      </button>

      <div className="tables-context-menu-divider" />

      <button className="tables-context-menu-item destructive" onClick={() => { onDelete(rowId); onClose(); }}>
        <Trash2 size={14} />
        <span>{t('tables.deleteRow')}</span>
      </button>
    </div>
  );
}
