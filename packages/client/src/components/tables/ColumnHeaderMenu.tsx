import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Type, Hash, CheckSquare, ChevronDown, List, Calendar, Link2,
  AtSign, DollarSign, Phone, Star, Percent, AlignLeft, Paperclip,
  Trash2, Copy, ArrowUpAZ, ArrowDownAZ, Pencil, EyeOff,
  Lock, Unlock, ArrowLeftToLine, ArrowRightToLine, FileText,
  Group, Ungroup,
} from 'lucide-react';
import type { TableFieldType } from '@atlasmail/shared';
import { ContextMenu, ContextMenuItem, ContextMenuSeparator } from '../ui/context-menu';

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
  const [showTypeSubmenu, setShowTypeSubmenu] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(columnName);
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [descValue, setDescValue] = useState(columnDescription || '');
  const renameRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);

  const isFrozen = columnIndex < frozenCount;

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
    <ContextMenu x={x} y={y} onClose={onClose}>
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
          <ContextMenuItem icon={<Pencil size={14} />} label={t('tables.rename')} onClick={() => setIsRenaming(true)} />
          <ContextMenuItem icon={<FileText size={14} />} label={t('tables.editDescription')} onClick={() => setIsEditingDesc(true)} />

          <div
            className="context-menu-item has-submenu"
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
                      className={`context-menu-item${ft.value === columnType ? ' active' : ''}`}
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

          <ContextMenuItem icon={<ArrowLeftToLine size={14} />} label={t('tables.insertLeft')} onClick={() => { onInsertLeft(columnId); onClose(); }} />
          <ContextMenuItem icon={<ArrowRightToLine size={14} />} label={t('tables.insertRight')} onClick={() => { onInsertRight(columnId); onClose(); }} />
          <ContextMenuItem icon={<Copy size={14} />} label={t('tables.duplicateColumn')} onClick={() => { onDuplicate(columnId); onClose(); }} />
          <ContextMenuItem icon={<ArrowUpAZ size={14} />} label={t('tables.sortAsc')} onClick={() => { onSortAsc(columnId); onClose(); }} />
          <ContextMenuItem icon={<ArrowDownAZ size={14} />} label={t('tables.sortDesc')} onClick={() => { onSortDesc(columnId); onClose(); }} />

          <ContextMenuSeparator />

          <ContextMenuItem icon={<EyeOff size={14} />} label={t('tables.hideField')} onClick={() => { onHide(columnId); onClose(); }} />

          {isFrozen ? (
            <ContextMenuItem icon={<Unlock size={14} />} label={t('tables.unfreezeColumns')} onClick={() => { onUnfreeze(); onClose(); }} />
          ) : (
            <ContextMenuItem
              icon={<Lock size={14} />}
              label={t('tables.freezeUpTo')}
              onClick={() => { onFreeze(columnId); onClose(); }}
              disabled={columnIndex >= 3}
            />
          )}

          {/* Group by */}
          {onGroupBy && (columnType === 'singleSelect' || columnType === 'multiSelect' || columnType === 'text') && (
            <>
              <ContextMenuSeparator />
              {isGroupedBy ? (
                <ContextMenuItem icon={<Ungroup size={14} />} label={t('tables.ungroup', 'Ungroup')} onClick={() => { onUngroup?.(); onClose(); }} />
              ) : (
                <ContextMenuItem icon={<Group size={14} />} label={t('tables.groupByField', 'Group by this field')} onClick={() => { onGroupBy(columnId); onClose(); }} />
              )}
            </>
          )}

          <ContextMenuSeparator />

          <ContextMenuItem icon={<Trash2 size={14} />} label={t('tables.deleteColumn')} onClick={() => { onDelete(columnId); onClose(); }} destructive />
        </>
      )}
    </ContextMenu>
  );
}
