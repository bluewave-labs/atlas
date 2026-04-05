import { useCallback, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Plus, ChevronUp, Users } from 'lucide-react';
import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';
import { IconButton } from '../../../components/ui/icon-button';

const SIGNER_COLORS = ['#8b5cf6', '#3b82f6', '#ef4444', '#f59e0b', '#10b981'];

export interface Signer {
  email: string;
  name: string;
  role: 'signer' | 'viewer' | 'approver' | 'cc';
  expiryDate?: string;
}

interface SignerPanelProps {
  signers: Signer[];
  onSignersChange: (signers: Signer[]) => void;
  activeSignerIndex: number | null;
  onActiveSignerChange: (index: number | null) => void;
}

export function SignerPanel({
  signers,
  onSignersChange,
  activeSignerIndex,
  onActiveSignerChange,
}: SignerPanelProps) {
  const { t } = useTranslation();

  const handleAddSigner = useCallback(() => {
    onSignersChange([...signers, { email: '', name: '', role: 'signer', expiryDate: undefined }]);
  }, [signers, onSignersChange]);

  const handleRemoveSigner = useCallback(
    (index: number) => {
      const updated = signers.filter((_, i) => i !== index);
      onSignersChange(updated);
      if (activeSignerIndex === index) {
        onActiveSignerChange(null);
      } else if (activeSignerIndex !== null && activeSignerIndex > index) {
        onActiveSignerChange(activeSignerIndex - 1);
      }
    },
    [signers, onSignersChange, activeSignerIndex, onActiveSignerChange],
  );

  const handleUpdateSigner = useCallback(
    (index: number, field: keyof Signer, value: string) => {
      const updated = [...signers];
      updated[index] = { ...updated[index], [field]: value };
      onSignersChange(updated);
    },
    [signers, onSignersChange],
  );

  const handleReorder = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (toIndex < 0 || toIndex >= signers.length) return;
      const updated = [...signers];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      onSignersChange(updated);
      if (activeSignerIndex === fromIndex) {
        onActiveSignerChange(toIndex);
      } else if (activeSignerIndex === toIndex) {
        onActiveSignerChange(fromIndex);
      }
    },
    [signers, onSignersChange, activeSignerIndex, onActiveSignerChange],
  );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--spacing-sm)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-sm)',
          padding: '0 var(--spacing-xs)',
        }}
      >
        <Users size={13} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
        <span
          style={{
            fontSize: 'var(--font-size-xs)',
            fontWeight: 'var(--font-weight-semibold)' as CSSProperties['fontWeight'],
            color: 'var(--color-text-tertiary)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {t('sign.signerPanel.signers')}
        </span>
      </div>

      {/* Signer list */}
      {signers.map((signer, idx) => {
        const color = SIGNER_COLORS[idx % SIGNER_COLORS.length];
        const isActive = activeSignerIndex === idx;

        return (
          <div
            key={idx}
            onClick={() => onActiveSignerChange(isActive ? null : idx)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--spacing-xs)',
              padding: 'var(--spacing-sm)',
              borderRadius: 'var(--radius-md)',
              border: `1px solid ${isActive ? color : 'var(--color-border-secondary)'}`,
              background: isActive ? `${color}08` : 'transparent',
              cursor: 'pointer',
              transition: 'border-color 0.15s, background 0.15s',
            }}
          >
            {/* Top row: order number, color dot, drag handle, remove */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  background: color,
                  color: '#fff',
                  fontSize: 10,
                  fontWeight: 'var(--font-weight-semibold)' as CSSProperties['fontWeight'],
                  flexShrink: 0,
                }}
              >
                {idx + 1}
              </span>
              <span
                style={{
                  flex: 1,
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 'var(--font-weight-medium)' as CSSProperties['fontWeight'],
                  color: 'var(--color-text-primary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {signer.email || t('sign.signerPanel.newSigner')}
              </span>
              <div style={{ display: 'flex', gap: 0, alignItems: 'center' }}>
                {idx > 0 && (
                  <IconButton
                    icon={<ChevronUp size={12} />}
                    label={t('sign.signerPanel.moveUp')}
                    size={20}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleReorder(idx, idx - 1);
                    }}
                  />
                )}
                {signers.length > 1 && (
                  <IconButton
                    icon={<X size={12} />}
                    label={t('sign.send.removeSigner')}
                    size={20}
                    destructive
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveSigner(idx);
                    }}
                  />
                )}
              </div>
            </div>
            {/* Email + name inputs */}
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <Input
                placeholder={t('sign.send.emailPlaceholder')}
                value={signer.email}
                onChange={(e) => handleUpdateSigner(idx, 'email', e.target.value)}
                size="sm"
              />
              <Input
                placeholder={t('sign.send.signerName')}
                value={signer.name}
                onChange={(e) => handleUpdateSigner(idx, 'name', e.target.value)}
                size="sm"
              />
            </div>
          </div>
        );
      })}

      {/* Add signer button */}
      <Button
        variant="ghost"
        size="sm"
        icon={<Plus size={13} />}
        onClick={handleAddSigner}
        style={{ alignSelf: 'flex-start' }}
      >
        {t('sign.send.addSigner')}
      </Button>

      {/* Hint */}
      {activeSignerIndex !== null && (
        <div
          style={{
            fontSize: 'var(--font-size-xs)',
            color: SIGNER_COLORS[activeSignerIndex % SIGNER_COLORS.length],
            padding: 'var(--spacing-xs)',
            background: `${SIGNER_COLORS[activeSignerIndex % SIGNER_COLORS.length]}08`,
            borderRadius: 'var(--radius-sm)',
            textAlign: 'center',
          }}
        >
          {t('sign.signerPanel.assignHint')}
        </div>
      )}
    </div>
  );
}

export { SIGNER_COLORS };
