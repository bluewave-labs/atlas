import { type ReactNode, type CSSProperties } from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';

export interface ColumnHeaderProps {
  label: string;
  icon?: ReactNode;
  sortable?: boolean;
  sortColumn?: string | null;
  columnKey?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (columnKey: string) => void;
  style?: CSSProperties;
}

export function ColumnHeader({
  label,
  icon,
  sortable = false,
  sortColumn,
  columnKey,
  sortDirection,
  onSort,
  style,
}: ColumnHeaderProps) {
  const isActive = sortable && sortColumn === columnKey;
  const handleClick = () => {
    if (sortable && columnKey && onSort) {
      onSort(columnKey);
    }
  };

  return (
    <span
      role={sortable ? 'button' : undefined}
      tabIndex={sortable ? 0 : undefined}
      aria-sort={isActive ? (sortDirection === 'asc' ? 'ascending' : 'descending') : undefined}
      aria-label={sortable ? `Sort by ${label}` : undefined}
      onClick={sortable ? handleClick : undefined}
      onKeyDown={sortable ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      } : undefined}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 'var(--font-size-xs)',
        fontWeight: 'var(--font-weight-medium)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
        fontFamily: 'var(--font-family)',
        cursor: sortable ? 'pointer' : 'default',
        userSelect: 'none',
        whiteSpace: 'nowrap',
        transition: 'color var(--transition-fast)',
        ...style,
      }}
      onMouseEnter={(e) => {
        if (sortable) e.currentTarget.style.color = 'var(--color-text-primary)';
      }}
      onMouseLeave={(e) => {
        if (sortable && !isActive) e.currentTarget.style.color = 'var(--color-text-tertiary)';
      }}
    >
      {icon && (
        <span style={{ display: 'inline-flex', alignItems: 'center', opacity: 0.6, flexShrink: 0 }}>
          {icon}
        </span>
      )}
      {label}
      {isActive && (
        <span style={{ display: 'inline-flex', alignItems: 'center', marginLeft: 2 }}>
          {sortDirection === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
        </span>
      )}
    </span>
  );
}
