import { type ReactNode, type CSSProperties } from 'react';
import { ChevronRight } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
}

interface ContentAreaProps {
  /**
   * Page/app title displayed in the default header.
   * Required when `headerSlot` is not provided.
   */
  title?: string;
  /** Optional subtitle shown on the left of the default header when title is omitted. */
  subtitle?: string;
  /** Optional breadcrumb trail (replaces title when provided). Ignored when `headerSlot` is set. */
  breadcrumbs?: BreadcrumbItem[];
  /** Right-side header actions (buttons, etc.). Ignored when `headerSlot` is set. */
  actions?: ReactNode;
  /**
   * When provided, replaces the default title/breadcrumbs/actions layout inside the 44px
   * header frame. Use this for apps with custom toolbars (Drive, Docs, Calendar).
   * The header frame (minHeight, border, flex-shrink) is still owned by ContentArea.
   */
  headerSlot?: ReactNode;
  /** Content below the header */
  children: ReactNode;
}

export function ContentArea({ title, subtitle, breadcrumbs, actions, headerSlot, children }: ContentAreaProps) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        minWidth: 0,
      }}
    >
      {/* Header frame — owned by ContentArea; contents are either default or headerSlot */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-sm)',
          padding: headerSlot ? 0 : 'var(--spacing-sm) var(--spacing-lg)',
          borderBottom: '1px solid var(--color-border-secondary)',
          flexShrink: 0,
          minHeight: 44,
        }}
      >
        {headerSlot ? (
          headerSlot
        ) : breadcrumbs ? (
          <>
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
            <div style={{ flex: 1 }} />
            {actions}
          </>
        ) : (
          <>
            {subtitle ? (
              <span
                style={{
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 'var(--font-weight-normal)' as CSSProperties['fontWeight'],
                  color: 'var(--color-text-tertiary)',
                  fontFamily: 'var(--font-family)',
                }}
              >
                {subtitle}
              </span>
            ) : null}
            <div style={{ flex: 1 }} />
            {actions}
          </>
        )}
      </div>

      {/* Content — owns dock-bottom reserve */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
          paddingBottom: 'var(--global-dock-offset, 0px)',
        }}
      >
        {children}
      </div>
    </div>
  );
}
