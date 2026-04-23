import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string;
  iconLeft?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const sizeStyles: Record<NonNullable<InputProps['size']>, { height: string; fontSize: string }> = {
  sm: { height: '28px', fontSize: 'var(--font-size-sm)' },
  md: { height: '34px', fontSize: 'var(--font-size-md)' },
  lg: { height: '40px', fontSize: 'var(--font-size-lg)' },
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, iconLeft, size = 'md', style, id, ...props }, ref) => {
    const inputId = id || (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);
    const { height, fontSize } = sizeStyles[size];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)', width: '100%' }}>
        {label && (
          <label
            htmlFor={inputId}
            style={{
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-medium)',
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-family)',
            }}
          >
            {label}
          </label>
        )}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          {iconLeft && (
            <span
              style={{
                position: 'absolute',
                left: 'var(--spacing-sm)',
                display: 'inline-flex',
                alignItems: 'center',
                color: 'var(--color-text-tertiary)',
                pointerEvents: 'none',
                zIndex: 1,
              }}
            >
              {iconLeft}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            style={{
              width: '100%',
              height,
              padding: iconLeft ? '0 var(--spacing-sm) 0 calc(var(--spacing-sm) * 3 + 16px)' : '0 var(--spacing-sm)',
              background: 'var(--color-bg-tertiary)',
              border: `1px solid ${error ? 'var(--color-error)' : 'var(--color-border-primary)'}`,
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-text-primary)',
              fontSize,
              fontFamily: 'var(--font-family)',
              transition: 'border-color var(--transition-normal)',
              boxSizing: 'border-box',
              ...style,
            }}
            onFocus={(e) => {
              e.target.style.borderColor = 'var(--color-border-focus)';
              props.onFocus?.(e);
            }}
            onBlur={(e) => {
              e.target.style.borderColor = error ? 'var(--color-error)' : 'var(--color-border-primary)';
              props.onBlur?.(e);
            }}
            {...props}
          />
        </div>
        {error && (
          <span
            style={{
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-error)',
              fontFamily: 'var(--font-family)',
            }}
          >
            {error}
          </span>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';
