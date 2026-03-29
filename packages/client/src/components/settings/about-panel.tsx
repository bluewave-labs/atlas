import { type CSSProperties } from 'react';
import { Mail, Keyboard, ChevronRight } from 'lucide-react';
import {
  SettingsSection,
  SettingsRow,
} from './settings-primitives';

// ---------------------------------------------------------------------------
// AboutPanel
// ---------------------------------------------------------------------------

export function AboutPanel() {
  return (
    <div>
      <SettingsSection title="About Atlas">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-xl)',
            padding: 'var(--spacing-xl)',
            background: 'var(--color-bg-tertiary)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-border-secondary)',
            marginBottom: 'var(--spacing-xl)',
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 'var(--radius-lg)',
              background: 'var(--color-accent-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Mail size={28} color="#ffffff" />
          </div>
          <div>
            <div
              style={{
                fontSize: 'var(--font-size-2xl)',
                fontWeight: 'var(--font-weight-semibold)' as CSSProperties['fontWeight'],
                color: 'var(--color-text-primary)',
                fontFamily: 'var(--font-family)',
              }}
            >
              Atlas
            </div>
            <div
              style={{
                marginTop: 4,
                fontSize: 'var(--font-size-md)',
                color: 'var(--color-text-tertiary)',
                fontFamily: 'var(--font-family)',
              }}
            >
              Fast, keyboard-first email client
            </div>
          </div>
        </div>

        <SettingsRow label="Version" description="Current application version">
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-secondary)',
              background: 'var(--color-bg-tertiary)',
              padding: '4px 10px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border-secondary)',
            }}
          >
            0.1.0
          </span>
        </SettingsRow>

        <SettingsRow label="Built with" description="Core technologies">
          <div style={{ display: 'flex', gap: 'var(--spacing-xs)', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {['React', 'TypeScript', 'Vite', 'Zustand'].map((name) => (
              <span
                key={name}
                style={{
                  fontFamily: 'var(--font-family)',
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-text-secondary)',
                  background: 'var(--color-bg-tertiary)',
                  padding: '3px 10px',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--color-border-secondary)',
                }}
              >
                {name}
              </span>
            ))}
          </div>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Quick links">
        <button
          onClick={() => {
            document.dispatchEvent(new CustomEvent('atlasmail:settings_navigate', { detail: { panel: 'shortcuts' } }));
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'var(--spacing-md) var(--spacing-lg)',
            marginBottom: 'var(--spacing-xs)',
            background: 'var(--color-bg-tertiary)',
            border: '1px solid var(--color-border-secondary)',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
            transition: 'background var(--transition-normal)',
            width: '100%',
            fontFamily: 'var(--font-family)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-surface-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--color-bg-tertiary)')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-bg-secondary)',
              }}
            >
              <Keyboard size={16} style={{ color: 'var(--color-text-secondary)' }} />
            </span>
            <div style={{ textAlign: 'left' }}>
              <div
                style={{
                  fontSize: 'var(--font-size-md)',
                  color: 'var(--color-text-primary)',
                  fontWeight: 'var(--font-weight-medium)' as CSSProperties['fontWeight'],
                }}
              >
                Keyboard shortcuts
              </div>
              <div
                style={{
                  marginTop: 1,
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-text-tertiary)',
                }}
              >
                View all available shortcuts
              </div>
            </div>
          </div>
          <ChevronRight size={16} style={{ color: 'var(--color-text-tertiary)' }} />
        </button>
      </SettingsSection>
    </div>
  );
}
