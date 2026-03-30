import { type ReactNode } from 'react';

interface ListToolbarProps {
  /** Left side content (search, filters) */
  children?: ReactNode;
  /** Right side actions */
  actions?: ReactNode;
}

export function ListToolbar({ children, actions }: ListToolbarProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 'var(--spacing-md)',
      padding: 'var(--spacing-sm) var(--spacing-lg)',
      borderBottom: '1px solid var(--color-border-secondary)',
      flexShrink: 0,
      minHeight: 40,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', flex: 1, minWidth: 0 }}>
        {children}
      </div>
      {actions && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', flexShrink: 0 }}>
          {actions}
        </div>
      )}
    </div>
  );
}

ListToolbar.Separator = function Separator() {
  return <div style={{ width: 1, height: 20, background: 'var(--color-border-secondary)', flexShrink: 0 }} />;
};
