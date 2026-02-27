import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Type, Hash, CheckSquare, ChevronDown, List, Calendar, Link2,
  AtSign, DollarSign, Phone, Star, Percent, AlignLeft, Paperclip,
  Trash2, Copy, ArrowUpAZ, ArrowDownAZ, Pencil, EyeOff,
  Lock, Unlock, ArrowLeftToLine, ArrowRightToLine, FileText,
  Group, Ungroup,
} from 'lucide-react';
import type { TableFieldType } from '@atlasmail/shared';

const FIELD_TYPE_OPTIONS: { value: TableFieldType; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { value: 'text', label: 'Text', icon: Type },
  { value: 'number', label: 'Number', icon: Hash },
  { value: 'checkbox', label: 'Checkbox', icon: CheckSquare },
  { value: 'singleSelect', label: 'Single select', icon: ChevronDown },
  { value: 'multiSelect', label: 'Multi select', icon: List },
  { value: 'date', label: 'Date', icon: Calendar },
  { value: 'url', label: 'URL', icon: Link2 },
  { value: 'email', label: 'Email', icon: AtSign },
  { value: 'currency', label: 'Currency', icon: DollarSign },
  { value: 'phone', label: 'Phone', icon: Phone },
  { value: 'rating', label: 'Rating', icon: Star },
  { value: 'percent', label: 'Percent', icon: Percent },
  { value: 'longText', label: 'Long text', icon: AlignLeft },
  { value: 'attachment', label: 'Attachment', icon: Paperclip },
];

interface ColumnHeaderMenuProps {
  columnId: string;
  columnName: string;
  columnType: TableFieldType;
  columnDescription?: string;
  columnIndex: number;
  frozenCount: number;
  x: number;
  y: number;
  onClose: () => void;
  onRename: (colId: string, newName: string) => void;
  onDelete: (colId: string) => void;
  onDuplicate: (colId: string) => void;
  onChangeType: (colId: string, newType: TableFieldType) => void;
  onSortAsc: (colId: string) => void;
  onSortDesc: (colId: string) => void;
  onHide: (colId: string) => void;
  onFreeze: (colId: string) => void;
  onUnfreeze: () => void;
  onInsertLeft: (colId: string) => void;
  onInsertRight: (colId: string) => void;
  onEditDescription: (colId: string, desc: string) => void;
  onGroupBy?: (colId: string) => void;
  onUngroup?: () => void;
  isGroupedBy?: boolean;
}

export function ColumnHeaderMenu({
  columnId, columnName, columnType, columnDescription, columnIndex, frozenCount,
  x, y, onClose,
  onRename, onDelete, onDuplicate, onChangeType, onSortAsc, onSortDesc,
  onHide, onFreeze, onUnfreeze, onInsertLeft, onInsertRight, onEditDescription,
  onGroupBy, onUngroup, isGroupedBy,
}: ColumnHeaderMenuProps) {
  const { t } = useTranslation();
  const menuRef = useRef<HTMLDivElement>(null);
  const [showTypeSubmenu, setShowTypeSubmenu] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(columnName);
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [descValue, setDescValue] = useState(columnDescription || '');
  const renameRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);

  const isFrozen = columnIndex < frozenCount;

  // Adjust position to stay in viewport
  const [pos, setPos] = useState({ x, y });
  useLayoutEffect(() => {
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

  // Focus rename input when renaming
  useEffect(() => {
    if (isRenaming) renameRef.current?.focus();
  }, [isRenaming]);

  useEffect(() => {
    if (isEditingDesc) descRef.current?.focus();
  }, [isEditingDesc]);

  const handleRenameSubmit = () => {
    if (renameValue.trim() && renameValue.trim() !== columnName) {
      onRename(columnId, renameValue.trim());
    }
    onClose();
  };

  const handleDescSubmit = () => {
    onEditDescription(columnId, descValue.trim());
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="tables-context-menu"
      style={{ left: pos.x, top: pos.y }}
    >
      {isRenaming ? (
        <div className="tables-context-menu-rename">
          <input
            ref={renameRef}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRenameSubmit();
              if (e.key === 'Escape') onClose();
            }}
            onBlur={handleRenameSubmit}
          />
        </div>
      ) : isEditingDesc ? (
        <div className="tables-context-menu-rename">
          <textarea
            ref={descRef}
            value={descValue}
            onChange={(e) => setDescValue(e.target.value)}
            placeholder={t('tables.descriptionPlaceholder')}
            rows={3}
            style={{
              width: '100%',
              padding: '5px 8px',
              border: '1px solid var(--color-border-focus)',
              borderRadius: 'var(--radius-md, 4px)',
              background: 'var(--color-bg-primary)',
              color: 'var(--color-text-primary)',
              fontSize: 'var(--font-size-sm)',
              fontFamily: 'var(--font-family)',
              outline: 'none',
              resize: 'vertical',
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleDescSubmit(); }
              if (e.key === 'Escape') onClose();
            }}
            onBlur={handleDescSubmit}
          />
        </div>
      ) : (
        <>
          <button className="tables-context-menu-item" onClick={() => setIsRenaming(true)}>
            <Pencil size={14} />
            <span>{t('tables.rename')}</span>
          </button>

          <button className="tables-context-menu-item" onClick={() => setIsEditingDesc(true)}>
            <FileText size={14} />
            <span>{t('tables.editDescription')}</span>
          </button>

          <div
            className="tables-context-menu-item has-submenu"
            onMouseEnter={() => setShowTypeSubmenu(true)}
            onMouseLeave={() => setShowTypeSubmenu(false)}
          >
            <Type size={14} />
            <span>{t('tables.changeType')}</span>
            <ChevronDown size={12} style={{ marginLeft: 'auto', transform: 'rotate(-90deg)' }} />
            {showTypeSubmenu && (
              <div className="tables-context-submenu">
                {FIELD_TYPE_OPTIONS.map((ft) => {
                  const FtIcon = ft.icon;
                  return (
                    <button
                      key={ft.value}
                      className={`tables-context-menu-item${ft.value === columnType ? ' active' : ''}`}
                      onClick={() => { onChangeType(columnId, ft.value); onClose(); }}
                    >
                      <FtIcon size={13} />
                      <span>{ft.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <button className="tables-context-menu-item" onClick={() => { onInsertLeft(columnId); onClose(); }}>
            <ArrowLeftToLine size={14} />
            <span>{t('tables.insertLeft')}</span>
          </button>

          <button className="tables-context-menu-item" onClick={() => { onInsertRight(columnId); onClose(); }}>
            <ArrowRightToLine size={14} />
            <span>{t('tables.insertRight')}</span>
          </button>

          <button className="tables-context-menu-item" onClick={() => { onDuplicate(columnId); onClose(); }}>
            <Copy size={14} />
            <span>{t('tables.duplicateColumn')}</span>
          </button>

          <button className="tables-context-menu-item" onClick={() => { onSortAsc(columnId); onClose(); }}>
            <ArrowUpAZ size={14} />
            <span>{t('tables.sortAsc')}</span>
          </button>

          <button className="tables-context-menu-item" onClick={() => { onSortDesc(columnId); onClose(); }}>
            <ArrowDownAZ size={14} />
            <span>{t('tables.sortDesc')}</span>
          </button>

          <div className="tables-context-menu-divider" />

          <button className="tables-context-menu-item" onClick={() => { onHide(columnId); onClose(); }}>
            <EyeOff size={14} />
            <span>{t('tables.hideField')}</span>
          </button>

          {isFrozen ? (
            <button className="tables-context-menu-item" onClick={() => { onUnfreeze(); onClose(); }}>
              <Unlock size={14} />
              <span>{t('tables.unfreezeColumns')}</span>
            </button>
          ) : (
            <button
              className="tables-context-menu-item"
              onClick={() => { onFreeze(columnId); onClose(); }}
              disabled={columnIndex >= 3}
            >
              <Lock size={14} />
              <span>{t('tables.freezeUpTo')}</span>
            </button>
          )}

          {/* Group by */}
          {onGroupBy && (columnType === 'singleSelect' || columnType === 'multiSelect' || columnType === 'text') && (
            <>
              <div className="tables-context-menu-divider" />
              {isGroupedBy ? (
                <button className="tables-context-menu-item" onClick={() => { onUngroup?.(); onClose(); }}>
                  <Ungroup size={14} />
                  <span>{t('tables.ungroup', 'Ungroup')}</span>
                </button>
              ) : (
                <button className="tables-context-menu-item" onClick={() => { onGroupBy(columnId); onClose(); }}>
                  <Group size={14} />
                  <span>{t('tables.groupByField', 'Group by this field')}</span>
                </button>
              )}
            </>
          )}

          <div className="tables-context-menu-divider" />

          <button className="tables-context-menu-item destructive" onClick={() => { onDelete(columnId); onClose(); }}>
            <Trash2 size={14} />
            <span>{t('tables.deleteColumn')}</span>
          </button>
        </>
      )}
    </div>
  );
}
