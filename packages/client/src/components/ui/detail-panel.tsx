import { type ReactNode, type CSSProperties } from 'react';
import { X } from 'lucide-react';
import { IconButton } from './icon-button';

interface DetailPanelProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  width?: number;
  children: ReactNode;
  headerActions?: ReactNode;
}

export function DetailPanel({ title, subtitle, onClose, width = 380, children, headerActions }: DetailPanelProps) {
  return (
    <div
      style={{
        width,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        borderLeft: '1px solid var(--color-border-primary)',
        background: 'var(--color-bg-primary)',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--spacing-md) var(--spacing-lg)',
          borderBottom: '1px solid var(--color-border-secondary)',
          flexShrink: 0,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 'var(--font-size-md)',
            fontWeight: 'var(--font-weight-medium)' as CSSProperties['fontWeight'],
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-family)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {title}
          </div>
          {subtitle && (
            <div style={{
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-text-tertiary)',
              fontFamily: 'var(--font-family)',
              marginTop: 2,
            }}>
              {subtitle}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', flexShrink: 0 }}>
          {headerActions}
          <IconButton icon={<X size={14} />} label="Close" size={26} onClick={onClose} />
        </div>
      </div>

      {/* Body — scrollable */}
      <div style={{ flex: 1, overflow: 'auto', padding: 'var(--spacing-lg)' }}>
        {children}
      </div>
    </div>
  );
}

DetailPanel.Section = function Section({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 'var(--spacing-xl)' }}>
      {title && (
        <div style={{
          fontSize: 'var(--font-size-xs)',
          fontWeight: 'var(--font-weight-medium)' as CSSProperties['fontWeight'],
          color: 'var(--color-text-tertiary)',
          fontFamily: 'var(--font-family)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: 'var(--spacing-sm)',
        }}>
          {title}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
        {children}
      </div>
    </div>
  );
};

DetailPanel.Field = function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--spacing-md)' }}>
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
};
