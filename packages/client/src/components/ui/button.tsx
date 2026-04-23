import { forwardRef, type ButtonHTMLAttributes, type ReactNode, type CSSProperties } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
  children?: ReactNode;
}

const variantStyles: Record<NonNullable<ButtonProps['variant']>, CSSProperties> = {
  primary: {
    background: 'var(--color-accent-primary)',
    color: 'var(--color-text-inverse)',
    border: '1px solid transparent',
    boxShadow: '0 1px 2px color-mix(in srgb, var(--color-accent-primary) 25%, transparent)',
  },
  secondary: {
    background: 'var(--color-bg-elevated)',
    color: 'var(--color-text-primary)',
    border: '1px solid var(--color-border-primary)',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--color-text-secondary)',
    border: '1px solid transparent',
  },
  danger: {
    background: 'transparent',
    color: 'var(--color-error)',
    border: '1px solid var(--color-error)',
  },
};

const sizeStyles: Record<NonNullable<ButtonProps['size']>, CSSProperties> = {
  sm: {
    height: '28px',
    padding: '0 var(--spacing-sm)',
    fontSize: 'var(--font-size-sm)',
    gap: 'var(--spacing-xs)',
  },
  md: {
    height: '34px',
    padding: '0 var(--spacing-md)',
    fontSize: 'var(--font-size-md)',
    gap: 'var(--spacing-xs)',
  },
  lg: {
    height: '40px',
    padding: '0 var(--spacing-lg)',
    fontSize: 'var(--font-size-lg)',
    gap: 'var(--spacing-sm)',
  },
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'secondary', size = 'md', icon, children, style, ...props }, ref) => {
    const baseStyle: CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 'var(--radius-md)',
      fontFamily: 'var(--font-family)',
      fontWeight: 'var(--font-weight-normal)' as CSSProperties['fontWeight'],
      cursor: 'pointer',
      transition: 'background var(--transition-normal), color var(--transition-normal), opacity var(--transition-normal)',
      outline: 'none',
      whiteSpace: 'nowrap',
      flexShrink: 0,
      ...variantStyles[variant],
      ...sizeStyles[size],
      ...style,
    };

    return (
      <button
        ref={ref}
        style={baseStyle}
        onMouseEnter={(e) => {
          const target = e.currentTarget;
          if (variant === 'primary') {
            target.style.background = 'var(--color-accent-primary-hover)';
          } else if (variant === 'secondary') {
            target.style.background = 'var(--color-surface-hover)';
          } else if (variant === 'ghost') {
            target.style.background = 'var(--color-surface-hover)';
            target.style.color = 'var(--color-text-primary)';
          } else if (variant === 'danger') {
            target.style.background = 'var(--color-error)';
            target.style.color = '#ffffff';
          }
        }}
        onMouseLeave={(e) => {
          const target = e.currentTarget;
          Object.assign(target.style, variantStyles[variant], style);
        }}
        {...props}
      >
        {icon && (
          <span style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
            {icon}
          </span>
        )}
        {children}
      </button>
    );
  },
);

Button.displayName = 'Button';
