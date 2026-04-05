import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';

// ─── Keyboard shortcuts help modal ───────────────────────────────────────

const SHORTCUT_SECTIONS = [
  {
    title: 'Essentials',
    shortcuts: [
      { keys: ['Mod', 'Z'], label: 'Undo' },
      { keys: ['Mod', 'Shift', 'Z'], label: 'Redo' },
      { keys: ['Mod', 'B'], label: 'Bold' },
      { keys: ['Mod', 'I'], label: 'Italic' },
      { keys: ['Mod', 'U'], label: 'Underline' },
      { keys: ['Mod', 'Shift', 'S'], label: 'Strikethrough' },
      { keys: ['Mod', 'E'], label: 'Inline code' },
      { keys: ['Mod', 'K'], label: 'Insert link' },
    ],
  },
  {
    title: 'Text formatting',
    shortcuts: [
      { keys: ['Mod', 'Shift', 'H'], label: 'Highlight' },
      { keys: ['/'], label: 'Open slash commands' },
      { keys: ['@'], label: 'Mention a page' },
    ],
  },
  {
    title: 'Blocks',
    shortcuts: [
      { keys: ['Mod', 'Alt', '1'], label: 'Heading 1' },
      { keys: ['Mod', 'Alt', '2'], label: 'Heading 2' },
      { keys: ['Mod', 'Alt', '3'], label: 'Heading 3' },
      { keys: ['Mod', 'Shift', '7'], label: 'Numbered list' },
      { keys: ['Mod', 'Shift', '8'], label: 'Bullet list' },
      { keys: ['Mod', 'Shift', '9'], label: 'Task list' },
      { keys: ['Mod', 'Shift', 'B'], label: 'Blockquote' },
      { keys: ['---'], label: 'Horizontal rule' },
    ],
  },
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['Mod', 'F'], label: 'Find in document' },
      { keys: ['Tab'], label: 'Indent list item' },
      { keys: ['Shift', 'Tab'], label: 'Outdent list item' },
      { keys: ['Enter'], label: 'New line / split block' },
      { keys: ['Shift', 'Enter'], label: 'Line break' },
    ],
  },
];

export function KeyboardShortcutsHelp({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const modKey = isMac ? '\u2318' : 'Ctrl';

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  function renderKey(key: string) {
    if (key === 'Mod') return modKey;
    if (key === 'Shift') return isMac ? '\u21E7' : 'Shift';
    if (key === 'Alt') return isMac ? '\u2325' : 'Alt';
    if (key === 'Enter') return '\u21B5';
    if (key === 'Tab') return '\u21E5';
    return key;
  }

  return (
    <div className="shortcuts-modal-backdrop" onClick={onClose}>
      <div className="shortcuts-modal" onClick={(e) => e.stopPropagation()}>
        <div className="shortcuts-modal-header">
          <span className="shortcuts-modal-title">{t('docs.keyboardShortcuts')}</span>
          <button className="search-replace-btn" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="shortcuts-modal-body">
          {SHORTCUT_SECTIONS.map((section) => (
            <div key={section.title} className="shortcuts-section">
              <div className="shortcuts-section-title">{section.title}</div>
              {section.shortcuts.map((s) => (
                <div key={s.label} className="shortcut-row">
                  <span className="shortcut-label">{s.label}</span>
                  <span className="shortcut-keys">
                    {s.keys.map((k, i) => (
                      <span key={i}>
                        <kbd className="shortcut-kbd">{renderKey(k)}</kbd>
                        {i < s.keys.length - 1 && <span className="shortcut-plus">+</span>}
                      </span>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
