/**
 * ColorPickerPopover
 *
 * Usage:
 *   <ColorPickerPopover mode="text" editor={editor}>
 *     <button aria-label="Text color">...</button>
 *   </ColorPickerPopover>
 *
 *   <ColorPickerPopover mode="highlight" editor={editor}>
 *     <button aria-label="Highlight">...</button>
 *   </ColorPickerPopover>
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Editor } from '@tiptap/react';
import { Popover, PopoverTrigger, PopoverContent } from '../ui/popover';

// ─── Constants ────────────────────────────────────────────────────────────────

const COLORS = [
  '#000000', '#374151', '#dc2626', '#ea580c',
  '#d97706', '#65a30d', '#16a34a', '#0891b2',
  '#2563eb', '#7c3aed', '#c026d3', '#db2777',
  '#6b7280', '#9ca3af', '#a16207', '#0d9488',
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface ColorPickerPopoverProps {
  mode: 'text' | 'highlight';
  editor: Editor;
  children: React.ReactNode;
}

// ─── Swatch button ────────────────────────────────────────────────────────────

function ColorSwatch({
  color,
  onClick,
}: {
  color: string;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      aria-label={color}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 24,
        height: 24,
        borderRadius: '50%',
        background: color,
        border: hovered
          ? '2px solid var(--color-border-focus)'
          : '2px solid transparent',
        cursor: 'pointer',
        padding: 0,
        outline: 'none',
        transition: 'border-color var(--transition-normal)',
        boxSizing: 'border-box',
      }}
    />
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ColorPickerPopover({ mode, editor, children }: ColorPickerPopoverProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  function handleColorSelect(color: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chain = editor.chain().focus() as any;
    if (mode === 'text') {
      chain.setColor(color).run();
    } else {
      chain.toggleHighlight({ color }).run();
    }
    setOpen(false);
  }

  function handleReset() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chain = editor.chain().focus() as any;
    if (mode === 'text') {
      chain.unsetColor().run();
    } else {
      chain.unsetHighlight().run();
    }
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>

      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={6}
        width={200}
        style={{ padding: 'var(--spacing-sm)' }}
      >
          {/* Color swatch grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 6,
              marginBottom: 'var(--spacing-sm)',
            }}
          >
            {COLORS.map((color) => (
              <ColorSwatch
                key={color}
                color={color}
                onClick={() => handleColorSelect(color)}
              />
            ))}
          </div>

          {/* Separator */}
          <div
            role="separator"
            aria-orientation="horizontal"
            style={{
              height: 1,
              background: 'var(--color-border-primary)',
              marginBottom: 'var(--spacing-sm)',
            }}
          />

          {/* Reset button */}
          <button
            type="button"
            onClick={handleReset}
            style={{
              display: 'block',
              width: '100%',
              padding: '4px var(--spacing-sm)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              background: 'transparent',
              color: 'var(--color-text-secondary)',
              fontSize: 'var(--font-size-sm)',
              fontFamily: 'var(--font-family)',
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'background var(--transition-normal)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--color-surface-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            {t('compose.resetColor')}
          </button>
      </PopoverContent>
    </Popover>
  );
}
