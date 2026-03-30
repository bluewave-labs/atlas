import { isMac } from '../../lib/platform';

const KEY_SYMBOLS: Record<string, string> = {
  mod: isMac() ? '\u2318' : 'Ctrl',
  shift: '\u21E7',
  alt: isMac() ? '\u2325' : 'Alt',
  Enter: '\u21B5',
  Backspace: '\u232B',
  Escape: 'Esc',
  Space: '\u2423',
  ArrowUp: '\u2191',
  ArrowDown: '\u2193',
  ArrowLeft: '\u2190',
  ArrowRight: '\u2192',
};

interface KbdProps {
  shortcut: string;
  /**
   * Display variant — 'default' shows styled key caps,
   * 'inline' is smaller and fits inside text flows.
   */
  variant?: 'default' | 'inline';
}

export function Kbd({ shortcut, variant = 'default' }: KbdProps) {
  const parts = shortcut.split('+').map((key) => KEY_SYMBOLS[key] ?? key.toUpperCase());

  const partStyle =
    variant === 'inline'
      ? {
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: '18px',
          height: '18px',
          padding: '0 3px',
          background: 'var(--color-bg-tertiary)',
          border: '1px solid var(--color-border-primary)',
          borderRadius: 'var(--radius-sm)',
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--font-size-xs)',
          color: 'var(--color-text-tertiary)',
        }
      : undefined;

  return (
    <kbd className={variant === 'inline' ? undefined : 'shortcut-key'} style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
      {parts.map((part, i) => (
        <span key={i} className={variant === 'inline' ? undefined : 'shortcut-key-part'} style={partStyle}>
          {part}
        </span>
      ))}
    </kbd>
  );
}
