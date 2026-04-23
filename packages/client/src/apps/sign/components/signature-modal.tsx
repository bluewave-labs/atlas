import { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import SignatureCanvas from 'react-signature-canvas';
import { Upload } from 'lucide-react';
import { Modal } from '../../../components/ui/modal';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import type { SignatureFieldType } from '@atlas-platform/shared';

// ─── Types ──────────────────────────────────────────────────────────

interface SignatureModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (signatureData: string) => void;
  fieldType: SignatureFieldType;
}

type TabId = 'draw' | 'type' | 'upload';

const FONTS = [
  { label: 'Caveat', family: 'Caveat, cursive' },
  { label: 'Dancing Script', family: '"Dancing Script", cursive' },
  { label: 'Pacifico', family: 'Pacifico, cursive' },
];

// ─── Component ──────────────────────────────────────────────────────

export function SignatureModal({ open, onOpenChange, onApply, fieldType }: SignatureModalProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabId>('draw');
  const [typedName, setTypedName] = useState('');
  const [selectedFont, setSelectedFont] = useState(0);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const sigCanvasRef = useRef<SignatureCanvas | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setActiveTab('draw');
      setTypedName('');
      setSelectedFont(0);
      setUploadedImage(null);
    }
  }, [open]);

  const labelMap: Record<SignatureFieldType, string> = {
    signature: t('sign.modal.addSignature'),
    initials: t('sign.modal.addInitials'),
    date: t('sign.modal.addDate'),
    text: t('sign.modal.addText'),
    checkbox: t('sign.modal.toggleCheckbox'),
    dropdown: t('sign.modal.selectOption'),
    email: t('sign.fields.email'),
    name: t('sign.fields.name'),
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

  const handleUploadFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setUploadedImage(reader.result as string);
    };
    reader.readAsDataURL(file);
    // Reset input so re-selecting the same file triggers change
    e.target.value = '';
  }, []);

  const handleApplyUpload = useCallback(() => {
    if (!uploadedImage) return;
    // Resize uploaded image to max 400x100 using offscreen canvas
    const img = new Image();
    img.onload = () => {
      const maxW = 400;
      const maxH = 100;
      let w = img.width;
      let h = img.height;
      if (w > maxW) { h = h * (maxW / w); w = maxW; }
      if (h > maxH) { w = w * (maxH / h); h = maxH; }
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(w);
      canvas.height = Math.round(h);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/png');
      onApply(dataUrl);
      onOpenChange(false);
    };
    img.src = uploadedImage;
  }, [uploadedImage, onApply, onOpenChange]);

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
          {(['draw', 'type', 'upload'] as TabId[]).map((tab) => (
            <Button
              key={tab}
              variant="ghost"
              onClick={() => setActiveTab(tab)}
              aria-label={`${tab} tab`}
              style={{
                flex: 1,
                padding: '8px 0',
                background: 'none',
                border: 'none',
                borderRadius: 0,
                borderBottom: activeTab === tab ? '2px solid var(--color-accent-primary)' : '2px solid transparent',
                color: activeTab === tab ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                fontFamily: 'var(--font-family)',
                fontSize: 'var(--font-size-sm)',
                fontWeight: activeTab === tab ? 600 : 400,
                cursor: 'pointer',
                transition: 'color 0.15s, border-color 0.15s',
              }}
            >
              {tab === 'upload' ? t('sign.modal.uploadSignature') : tab === 'draw' ? t('sign.modal.draw') : t('sign.modal.type')}
            </Button>
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
                background: 'var(--color-bg-elevated)',
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
                {t('sign.modal.clear')}
              </Button>
            </div>
          </div>
        )}

        {/* Type tab */}
        {activeTab === 'type' && (
          <div>
            <Input
              placeholder={t('sign.modal.typeYourName')}
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              size="md"
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              {FONTS.map((font, idx) => (
                <Button
                  key={font.label}
                  variant="ghost"
                  aria-label={`Select ${font.label} font`}
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
                </Button>
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
                  background: 'var(--color-bg-elevated)',
                  fontFamily: FONTS[selectedFont].family,
                  fontSize: 'var(--font-size-2xl)',
                  color: 'var(--color-text-primary)',
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
          {t('sign.modal.cancel')}
        </Button>
        <Button
          variant="primary"
          onClick={activeTab === 'draw' ? handleApplyDraw : handleApplyType}
        >
          {t('sign.modal.apply')}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
