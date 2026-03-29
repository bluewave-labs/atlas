import { useState, useRef } from 'react';
import type { IHeaderParams } from 'ag-grid-community';
import { ChevronDown, Info } from 'lucide-react';
import type { TableFieldType } from '@atlasmail/shared';

interface TableCustomHeaderParams extends IHeaderParams {
  fieldType?: TableFieldType;
  fieldTypeIcon?: React.ComponentType<{ size?: number }>;
  fieldDescription?: string;
  onMenuOpen?: (columnId: string, x: number, y: number) => void;
  onHeaderClicked?: (colId: string) => void;
}

export function TableCustomHeader(props: TableCustomHeaderParams) {
  const { displayName, fieldTypeIcon: Icon, fieldDescription, column, onMenuOpen, onHeaderClicked } = props;
  const btnRef = useRef<HTMLButtonElement>(null);
  const [hovered, setHovered] = useState(false);

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const colId = column.getColId();
    if (!colId || !onMenuOpen) return;
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) {
      onMenuOpen(colId, rect.left, rect.bottom + 4);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    // Don't interfere with the dropdown menu button
    if ((e.target as HTMLElement).closest('.tables-custom-header-menu')) return;
    onHeaderClicked?.(column.getColId());
  };

  return (
    <div
      className="tables-custom-header"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={handleClick}
    >
      {Icon && (
        <span className="tables-custom-header-icon">
          <Icon size={13} />
        </span>
      )}
      <span className="tables-custom-header-name">{displayName}</span>
      {fieldDescription && (
        <span className="tables-custom-header-desc-icon" title={fieldDescription}>
          <Info size={10} />
        </span>
      )}
      {onMenuOpen && (
        <button
          ref={btnRef}
          className="tables-custom-header-menu"
          style={{ opacity: hovered ? 1 : 0 }}
          onClick={handleMenuClick}
          tabIndex={-1}
        >
          <ChevronDown size={12} />
        </button>
      )}
    </div>
  );
}
