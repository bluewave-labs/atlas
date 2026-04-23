import { useState, useEffect, useRef } from 'react';

// ─── Cover presets ──────────────────────────────────────────────────

export const COVER_GRADIENTS = [
  // Warm
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
  // Cool
  'linear-gradient(135deg, #fccb90 0%, #d57eeb 100%)',
  'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)',
  'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
  'linear-gradient(135deg, #667eea 0%, #43e97b 100%)',
  'linear-gradient(135deg, #0c3483 0%, #a2b6df 100%)',
  'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
  // Vibrant
  'linear-gradient(135deg, #ff0844 0%, #ffb199 100%)',
  'linear-gradient(135deg, #96fbc4 0%, #f9f586 100%)',
  'linear-gradient(135deg, #2af598 0%, #009efd 100%)',
  'linear-gradient(135deg, #cd9cf2 0%, #f6f3ff 100%)',
  'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
  'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)',
];

export const COVER_IMAGES = [
  '/wallpapers/01-forest-sunlight.jpg',
  '/wallpapers/02-misty-pines.jpg',
  '/wallpapers/03-tropical-bridge.jpg',
  '/wallpapers/04-mountain-golden.jpg',
  '/wallpapers/05-dark-forest.jpg',
  '/wallpapers/06-autumn-forest.jpg',
  '/wallpapers/07-night-sky.jpg',
  '/wallpapers/08-northern-lights.jpg',
  '/wallpapers/09-mountain-sunset.jpg',
  '/wallpapers/10-waterfall.jpg',
];

/** Returns true if the cover value is a CSS gradient rather than an image URL */
export function isCoverGradient(cover: string): boolean {
  return cover.startsWith('linear-gradient') || cover.startsWith('radial-gradient');
}

// ─── CoverPicker component ──────────────────────────────────────────

type CoverTab = 'gradient' | 'gallery' | 'link';

interface CoverPickerProps {
  onSelect: (url: string) => void;
  onClose: () => void;
}

export function CoverPicker({ onSelect, onClose }: CoverPickerProps) {
  const [activeTab, setActiveTab] = useState<CoverTab>('gradient');
  const [customUrl, setCustomUrl] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const tabs: { id: CoverTab; label: string }[] = [
    { id: 'gradient', label: 'Gradient' },
    { id: 'gallery', label: 'Gallery' },
    { id: 'link', label: 'Link' },
  ];

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.3)',
      }}
      onClick={onClose}
    >
      <div
        ref={ref}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--color-bg-elevated)',
          border: '1px solid var(--color-border-primary)',
          borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)',
          padding: 16, width: 520, maxHeight: '80vh', overflow: 'hidden',
          fontFamily: 'var(--font-family)', display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--color-text-primary)' }}>
          Choose a cover
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--color-border-secondary)', marginBottom: 12 }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '6px 14px',
                fontSize: 13,
                fontFamily: 'var(--font-family)',
                fontWeight: activeTab === tab.id ? 600 : 400,
                color: activeTab === tab.id ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === tab.id ? '2px solid var(--color-accent-primary)' : '2px solid transparent',
                cursor: 'pointer',
                transition: 'color 0.15s ease, border-color 0.15s ease',
                marginBottom: -1,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ overflow: 'auto', maxHeight: 340 }}>
          {activeTab === 'gradient' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {COVER_GRADIENTS.map((gradient) => (
                <button
                  key={gradient}
                  onClick={() => onSelect(gradient)}
                  style={{
                    width: '100%', height: 64, borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border-primary)',
                    overflow: 'hidden', cursor: 'pointer', padding: 0,
                    background: gradient,
                    transition: 'transform 0.1s ease, box-shadow 0.1s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.03)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
                />
              ))}
            </div>
          )}

          {activeTab === 'gallery' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {COVER_IMAGES.map((url) => (
                <button
                  key={url}
                  onClick={() => onSelect(url)}
                  style={{
                    width: '100%', height: 64, borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border-primary)',
                    overflow: 'hidden', cursor: 'pointer', padding: 0,
                    background: 'var(--color-bg-secondary)',
                    transition: 'transform 0.1s ease, box-shadow 0.1s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.03)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </button>
              ))}
            </div>
          )}

          {activeTab === 'link' && (
            <div>
              <p style={{ fontSize: 13, color: 'var(--color-text-tertiary)', margin: '0 0 12px' }}>
                Paste a URL to an image and press Enter or click Add.
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  autoFocus
                  style={{
                    flex: 1, padding: '8px 10px',
                    border: '1px solid var(--color-border-primary)', borderRadius: 4,
                    background: 'var(--color-bg-primary)', fontSize: 13,
                    fontFamily: 'var(--font-family)', color: 'var(--color-text-primary)', outline: 'none',
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-accent-primary)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-border-primary)'; }}
                  onKeyDown={(e) => { if (e.key === 'Enter' && customUrl.trim()) onSelect(customUrl.trim()); }}
                />
                <button
                  onClick={() => { if (customUrl.trim()) onSelect(customUrl.trim()); }}
                  disabled={!customUrl.trim()}
                  style={{
                    padding: '8px 16px', background: customUrl.trim() ? 'var(--color-accent-primary, #13715B)' : 'var(--color-border-primary)',
                    color: 'var(--color-text-inverse)', border: 'none', borderRadius: 4, fontSize: 13,
                    fontFamily: 'var(--font-family)', cursor: customUrl.trim() ? 'pointer' : 'not-allowed',
                    fontWeight: 500, transition: 'background 0.15s ease',
                  }}
                >
                  Add
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
