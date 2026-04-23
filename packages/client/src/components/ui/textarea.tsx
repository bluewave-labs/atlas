import { forwardRef, type TextareaHTMLAttributes } from 'react';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, style, id, ...props }, ref) => {
    const textareaId = id || (label ? `textarea-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)', width: '100%' }}>
        {label && (
          <label
            htmlFor={textareaId}
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
        <textarea
          ref={ref}
          id={textareaId}
          style={{
            width: '100%',
            padding: 'var(--spacing-sm)',
            background: 'var(--color-bg-tertiary)',
            border: `1px solid ${error ? 'var(--color-error)' : 'var(--color-border-primary)'}`,
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-text-primary)',
            fontSize: 'var(--font-size-md)',
            fontFamily: 'var(--font-family)',
            transition: 'border-color var(--transition-normal)',
            boxSizing: 'border-box',
            resize: 'vertical',
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

Textarea.displayName = 'Textarea';
