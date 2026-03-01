import { useEffect, useRef } from 'react';
import '../../styles/shared-pickers.css';

// ─── Emoji categories (shared across Docs, Tasks, etc.) ─────────────

export const EMOJI_CATEGORIES: { label: string; emojis: string[] }[] = [
  {
    label: 'Smileys',
    emojis: ['😀','😃','😄','😁','😅','😂','🤣','😊','😇','🙂','😉','😌','😍','🥰','😘','😗','😙','😚','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','🤥','😬'],
  },
  {
    label: 'Objects',
    emojis: ['📄','📝','📖','📚','📁','📂','📌','📎','📐','📏','✂️','🗂️','🗃️','🗄️','📮','📯','📰','🗞️','📜','🏷️','💼','🎒','👜','📦','🔑','🗝️','🔒','🔓','🛠️','⚙️','🔧','🔨','⚡','💡','🔬','🔭','📡'],
  },
  {
    label: 'Symbols',
    emojis: ['🚀','⭐','🌟','💫','✨','🔥','💎','🎯','🏆','🎨','🎭','🎪','🎬','🎮','🎲','🧩','🔮','🧪','🧬','💻','🖥️','📱','⌨️','🖱️','💾','💿','📀','🎵','🎶','🔔','📣','💬','💭','🗯️','❤️','💙','💚','💛','🧡','💜'],
  },
  {
    label: 'Nature',
    emojis: ['🌸','🌺','🌻','🌹','🌷','🌱','🌲','🌳','🌴','🍀','🍁','🍂','🍃','🌿','☘️','🌾','🌵','🌈','☀️','🌤️','⛅','🌥️','☁️','🌦️','🌧️','⛈️','🌩️','🌨️','❄️','🌊','🏔️','⛰️','🗻','🌋'],
  },
  {
    label: 'Food',
    emojis: ['🍎','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🥑','🥦','🥬','🌽','🥕','🧄','🧅','🥔','🍠','🥯','🍞','🥖','🥐','🧇','🥞','🧀','🍳','🥚','🥓','🥩'],
  },
];

// ─── EmojiPicker component ──────────────────────────────────────────

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onRemove?: () => void;
  onClose: () => void;
  /** Render as a static block instead of an absolutely positioned popover */
  inline?: boolean;
}

export function EmojiPicker({ onSelect, onRemove, onClose, inline }: EmojiPickerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (inline) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    // Delay listener to avoid catching the click that opened the picker
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handler);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handler);
    };
  }, [onClose, inline]);

  return (
    <div
      ref={ref}
      className={inline ? undefined : 'emoji-picker-popover'}
      style={inline
        ? { padding: 8, width: '100%', boxSizing: 'border-box' as const }
        : { top: '100%', left: 0, marginTop: 4 }
      }
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
        <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)' }}>
          Pick an icon
        </span>
        {onRemove && (
          <button
            onClick={onRemove}
            style={{
              padding: '4px 8px',
              background: 'transparent',
              border: '1px solid var(--color-border-primary)',
              borderRadius: 4,
              fontSize: 11,
              color: 'var(--color-text-tertiary)',
              cursor: 'pointer',
              fontFamily: 'var(--font-family)',
              whiteSpace: 'nowrap',
            }}
          >
            Remove
          </button>
        )}
      </div>
      <div style={{ maxHeight: 240, overflowY: 'auto' }}>
        {EMOJI_CATEGORIES.map((cat) => (
          <div key={cat.label}>
            <div className="emoji-picker-category">{cat.label}</div>
            <div className="emoji-picker-grid">
              {cat.emojis.map((emoji, i) => (
                <button key={`${emoji}-${i}`} className="emoji-picker-btn" onClick={() => onSelect(emoji)}>
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
