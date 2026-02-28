import { useState, type CSSProperties } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Modal } from './modal';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive = true,
  onConfirm,
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  const resolvedConfirmLabel = confirmLabel ?? t('common.confirm');
  const resolvedCancelLabel = cancelLabel ?? t('common.cancel');
  const [confirmHovered, setConfirmHovered] = useState(false);
  const [cancelHovered, setCancelHovered] = useState(false);

  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} width={400} zIndex={300} title={title}>
      <div style={{ padding: 'var(--spacing-xl)' }}>
        <div style={{ display: 'flex', gap: 'var(--spacing-lg)' }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 'var(--radius-lg)',
              background: destructive
                ? 'color-mix(in srgb, var(--color-error) 10%, transparent)'
                : 'color-mix(in srgb, var(--color-warning) 10%, transparent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <AlertTriangle
              size={20}
              style={{
                color: destructive ? 'var(--color-error)' : 'var(--color-warning)',
              }}
            />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 'var(--font-size-lg)',
                fontWeight: 'var(--font-weight-semibold)' as CSSProperties['fontWeight'],
                color: 'var(--color-text-primary)',
                fontFamily: 'var(--font-family)',
                marginBottom: 'var(--spacing-xs)',
              }}
            >
              {title}
            </div>
            <div
              style={{
                fontSize: 'var(--font-size-md)',
                color: 'var(--color-text-secondary)',
                fontFamily: 'var(--font-family)',
                lineHeight: 'var(--line-height-normal)',
              }}
            >
              {description}
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 'var(--spacing-sm)',
            marginTop: 'var(--spacing-xl)',
          }}
        >
          <button
            onClick={() => onOpenChange(false)}
            onMouseEnter={() => setCancelHovered(true)}
            onMouseLeave={() => setCancelHovered(false)}
            style={{
              height: 34,
              padding: '0 var(--spacing-lg)',
              background: cancelHovered ? 'var(--color-surface-hover)' : 'transparent',
              border: '1px solid var(--color-border-primary)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-text-secondary)',
              fontSize: 'var(--font-size-md)',
              fontFamily: 'var(--font-family)',
              cursor: 'pointer',
              transition: 'background var(--transition-fast), color var(--transition-fast)',
            }}
          >
            {resolvedCancelLabel}
          </button>

          <button
            onClick={handleConfirm}
            onMouseEnter={() => setConfirmHovered(true)}
            onMouseLeave={() => setConfirmHovered(false)}
            style={{
              height: 34,
              padding: '0 var(--spacing-lg)',
              background: destructive
                ? confirmHovered
                  ? '#c53030'
                  : 'var(--color-error)'
                : confirmHovered
                  ? 'var(--color-accent-primary-hover)'
                  : 'var(--color-accent-primary)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              color: '#ffffff',
              fontSize: 'var(--font-size-md)',
              fontWeight: 'var(--font-weight-medium)' as CSSProperties['fontWeight'],
              fontFamily: 'var(--font-family)',
              cursor: 'pointer',
              transition: 'background var(--transition-fast)',
            }}
          >
            {resolvedConfirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
