import { useState, useRef, useCallback, useEffect } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Modal } from '../../../components/ui/modal';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import type { SignatureFieldType } from '@atlasmail/shared';

// ─── Types ──────────────────────────────────────────────────────────

interface SignatureModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (signatureData: string) => void;
  fieldType: SignatureFieldType;
}

type TabId = 'draw' | 'type';

const FONTS = [
  { label: 'Caveat', family: 'Caveat, cursive' },
  { label: 'Dancing Script', family: '"Dancing Script", cursive' },
  { label: 'Pacifico', family: 'Pacifico, cursive' },
];

// ─── Component ──────────────────────────────────────────────────────

export function SignatureModal({ open, onOpenChange, onApply, fieldType }: SignatureModalProps) {
  const [activeTab, setActiveTab] = useState<TabId>('draw');
  const [typedName, setTypedName] = useState('');
  const [selectedFont, setSelectedFont] = useState(0);
  const sigCanvasRef = useRef<SignatureCanvas | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setActiveTab('draw');
      setTypedName('');
      setSelectedFont(0);
    }
  }, [open]);

  const labelMap: Record<SignatureFieldType, string> = {
    signature: 'Add signature',
    initials: 'Add initials',
    date: 'Add date',
    text: 'Add text',
  };

  const handleApplyDraw = useCallback(() => {
    if (!sigCanvasRef.current || sigCanvasRef.current.isEmpty()) return;
    const dataUrl = sigCanvasRef.current.toDataURL('image/png');
    onApply(dataUrl);
    onOpenChange(false);
  }, [onApply, onOpenChange]);

  const handleApplyType = useCallback(() => {
    if (!typedName.trim()) return;
    // Render text to canvas
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 100;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = `40px ${FONTS[selectedFont].family}`;
    ctx.fillStyle = '#000000';
    ctx.textBaseline = 'middle';
    ctx.fillText(typedName, 10, 50);

    const dataUrl = canvas.toDataURL('image/png');
    onApply(dataUrl);
    onOpenChange(false);
  }, [typedName, selectedFont, onApply, onOpenChange]);

  const handleClear = useCallback(() => {
    sigCanvasRef.current?.clear();
  }, []);

  return (
    <Modal open={open} onOpenChange={onOpenChange} width={480} title={labelMap[fieldType]}>
      <Modal.Header title={labelMap[fieldType]} />
      <Modal.Body>
        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            gap: 0,
            borderBottom: '1px solid var(--color-border-primary)',
            marginBottom: 16,
          }}
        >
          {(['draw', 'type'] as TabId[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1,
                padding: '8px 0',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === tab ? '2px solid var(--color-accent-primary)' : '2px solid transparent',
                color: activeTab === tab ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                fontFamily: 'var(--font-family)',
                fontSize: 'var(--font-size-sm)',
                fontWeight: activeTab === tab ? 600 : 400,
                cursor: 'pointer',
                transition: 'color 0.15s, border-color 0.15s',
                textTransform: 'capitalize',
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Draw tab */}
        {activeTab === 'draw' && (
          <div>
            <div
              style={{
                border: '1px solid var(--color-border-primary)',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                background: '#fff',
              }}
            >
              <SignatureCanvas
                ref={(ref) => { sigCanvasRef.current = ref; }}
                canvasProps={{
                  width: 430,
                  height: 150,
                  style: { width: '100%', height: 150, display: 'block' },
                }}
                backgroundColor="rgba(0,0,0,0)"
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <Button variant="ghost" size="sm" onClick={handleClear}>
                Clear
              </Button>
            </div>
          </div>
        )}

        {/* Type tab */}
        {activeTab === 'type' && (
          <div>
            <Input
              placeholder="Type your name"
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              size="md"
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              {FONTS.map((font, idx) => (
                <button
                  key={font.label}
                  onClick={() => setSelectedFont(idx)}
                  style={{
                    flex: 1,
                    padding: '8px 4px',
                    background: selectedFont === idx ? 'var(--color-surface-selected)' : 'var(--color-bg-tertiary)',
                    border: selectedFont === idx ? '2px solid var(--color-accent-primary)' : '1px solid var(--color-border-primary)',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    fontFamily: font.family,
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--color-text-primary)',
                    textAlign: 'center',
                    transition: 'border-color 0.15s, background 0.15s',
                  }}
                >
                  {font.label}
                </button>
              ))}
            </div>
            {/* Preview */}
            {typedName && (
              <div
                style={{
                  marginTop: 16,
                  padding: '16px 12px',
                  border: '1px solid var(--color-border-primary)',
                  borderRadius: 'var(--radius-md)',
                  background: '#fff',
                  fontFamily: FONTS[selectedFont].family,
                  fontSize: 32,
                  color: '#000',
                  textAlign: 'center',
                  minHeight: 60,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {typedName}
              </div>
            )}
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={activeTab === 'draw' ? handleApplyDraw : handleApplyType}
        >
          Apply
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
