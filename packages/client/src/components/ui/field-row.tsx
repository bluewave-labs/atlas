import { type ReactNode } from 'react';

interface FieldRowProps {
  label: string;
  children: ReactNode;
  direction?: 'horizontal' | 'vertical';
}

export function FieldRow({ label, children, direction = 'horizontal' }: FieldRowProps) {
  if (direction === 'vertical') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{
          fontSize: 'var(--font-size-xs)',
          color: 'var(--color-text-tertiary)',
          fontFamily: 'var(--font-family)',
        }}>
          {label}
        </span>
        <span style={{
          fontSize: 'var(--font-size-sm)',
          color: 'var(--color-text-primary)',
          fontFamily: 'var(--font-family)',
        }}>
          {children}
        </span>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 'var(--spacing-md)',
      padding: 'var(--spacing-xs) 0',
    }}>
      <span style={{
        fontSize: 'var(--font-size-sm)',
        color: 'var(--color-text-tertiary)',
        fontFamily: 'var(--font-family)',
        flexShrink: 0,
      }}>
        {label}
      </span>
      <span style={{
        fontSize: 'var(--font-size-sm)',
        color: 'var(--color-text-primary)',
        fontFamily: 'var(--font-family)',
        textAlign: 'right',
        minWidth: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {children}
      </span>
    </div>
  );
}
