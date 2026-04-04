import { type ReactNode, type CSSProperties } from 'react';
import { ChevronRight } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
}

interface ContentAreaProps {
  /** Page/app title displayed in the header */
  title: string;
  /** Optional breadcrumb trail (replaces title when provided) */
  breadcrumbs?: BreadcrumbItem[];
  /** Right-side header actions (buttons, etc.) */
  actions?: ReactNode;
  /** Content below the header */
  children: ReactNode;
}

export function ContentArea({ title, breadcrumbs, actions, children }: ContentAreaProps) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-sm)',
          padding: 'var(--spacing-sm) var(--spacing-lg)',
          borderBottom: '1px solid var(--color-border-secondary)',
          flexShrink: 0,
          height: 44,
        }}
      >
        {breadcrumbs ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', minWidth: 0 }}>
            {breadcrumbs.map((item, index) => {
              const isLast = index === breadcrumbs.length - 1;
              return (
                <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', minWidth: 0 }}>
                  {index > 0 && (
                    <ChevronRight
                      size={12}
                      style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }}
                    />
                  )}
                  {isLast ? (
                    <span
                      style={{
                        fontSize: 'var(--font-size-sm)',
                        fontWeight: 'var(--font-weight-medium)' as CSSProperties['fontWeight'],
                        color: 'var(--color-text-primary)',
                        fontFamily: 'var(--font-family)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.label}
                    </span>
                  ) : (
                    <button
                      onClick={item.onClick}
                      style={{
                        fontSize: 'var(--font-size-sm)',
                        color: 'var(--color-text-tertiary)',
                        fontFamily: 'var(--font-family)',
                        background: 'none',
                        border: 'none',
                        cursor: item.onClick ? 'pointer' : 'default',
                        padding: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.label}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <span
            style={{
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-normal)' as CSSProperties['fontWeight'],
              color: 'var(--color-text-primary)',
              fontFamily: 'var(--font-family)',
            }}
          >
            {title}
          </span>
        )}
        <div style={{ flex: 1 }} />
        {actions}
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
        {children}
      </div>
    </div>
  );
}
