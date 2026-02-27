import { useState, useRef } from 'react';
import type { IHeaderParams } from 'ag-grid-community';
import { MoreHorizontal } from 'lucide-react';
import type { TableFieldType } from '@atlasmail/shared';

interface TableCustomHeaderParams extends IHeaderParams {
  fieldType?: TableFieldType;
  fieldTypeIcon?: React.ComponentType<{ size?: number }>;
  onMenuOpen?: (columnId: string, x: number, y: number) => void;
}

export function TableCustomHeader(props: TableCustomHeaderParams) {
  const { displayName, fieldTypeIcon: Icon, column, onMenuOpen } = props;
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

  return (
    <div
      className="tables-custom-header"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {Icon && (
        <span className="tables-custom-header-icon">
          <Icon size={13} />
        </span>
      )}
      <span className="tables-custom-header-name">{displayName}</span>
      {onMenuOpen && (
        <button
          ref={btnRef}
          className="tables-custom-header-menu"
          style={{ opacity: hovered ? 1 : 0 }}
          onClick={handleMenuClick}
          tabIndex={-1}
        >
          <MoreHorizontal size={14} />
        </button>
      )}
    </div>
  );
}
