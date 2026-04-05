import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

// ─── Drawing embed picker ─────────────────────────────────────────────────

export function DrawingPicker({
  drawings,
  onSelect,
  onClose,
}: {
  drawings: Array<{ id: string; title: string }>;
  onSelect: (drawing: { id: string; title: string }) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);

  const filtered = useMemo(() => {
    if (!query.trim()) return drawings;
    const q = query.toLowerCase();
    return drawings.filter((d) => d.title.toLowerCase().includes(q));
  }, [drawings, query]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 380,
          maxHeight: 400,
          background: 'var(--color-bg-elevated)',
          border: '1px solid var(--color-border-primary)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-elevated)',
          overflow: 'hidden',
          fontFamily: 'var(--font-family)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: '12px 12px 8px', borderBottom: '1px solid var(--color-border-primary)' }}>
          <input
            autoFocus
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIdx(0); }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIdx((i) => Math.max(i - 1, 0));
              } else if (e.key === 'Enter' && filtered[selectedIdx]) {
                e.preventDefault();
                onSelect(filtered[selectedIdx]);
              } else if (e.key === 'Escape') {
                onClose();
              }
            }}
            placeholder={t('docs.searchDrawings')}
            style={{
              width: '100%',
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: 13,
              fontFamily: 'var(--font-family)',
              color: 'var(--color-text-primary)',
              padding: 0,
            }}
          />
        </div>
        <div style={{ overflowY: 'auto', maxHeight: 300, padding: 4 }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '16px 12px', textAlign: 'center', fontSize: 12, color: 'var(--color-text-tertiary)' }}>
              {t('docs.noDrawingsFound')}
            </div>
          ) : (
            filtered.map((d, i) => (
              <button
                key={d.id}
                onClick={() => onSelect(d)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '6px 8px',
                  background: i === selectedIdx ? 'var(--color-surface-selected)' : 'transparent',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-family)',
                  fontSize: 13,
                  color: 'var(--color-text-primary)',
                  textAlign: 'left',
                }}
                onMouseEnter={() => setSelectedIdx(i)}
              >
                <span style={{ color: 'var(--color-text-tertiary)', fontSize: 14 }}>{'\u270F'}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {d.title || t('docs.untitledDrawing')}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Table embed picker ─────────────────────────────────────────────────

export function TablePicker({
  tables,
  onSelect,
  onClose,
}: {
  tables: Array<{ id: string; title: string }>;
  onSelect: (table: { id: string; title: string }) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);

  const filtered = useMemo(() => {
    if (!query.trim()) return tables;
    const q = query.toLowerCase();
    return tables.filter((tbl) => tbl.title.toLowerCase().includes(q));
  }, [tables, query]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 380,
          maxHeight: 400,
          background: 'var(--color-bg-elevated)',
          border: '1px solid var(--color-border-primary)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-elevated)',
          overflow: 'hidden',
          fontFamily: 'var(--font-family)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: '12px 12px 8px', borderBottom: '1px solid var(--color-border-primary)' }}>
          <input
            autoFocus
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIdx(0); }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIdx((i) => Math.max(i - 1, 0));
              } else if (e.key === 'Enter' && filtered[selectedIdx]) {
                e.preventDefault();
                onSelect(filtered[selectedIdx]);
              } else if (e.key === 'Escape') {
                onClose();
              }
            }}
            placeholder={t('docs.searchTables')}
            style={{
              width: '100%',
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: 13,
              fontFamily: 'var(--font-family)',
              color: 'var(--color-text-primary)',
              padding: 0,
            }}
          />
        </div>
        <div style={{ overflowY: 'auto', maxHeight: 300, padding: 4 }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '16px 12px', textAlign: 'center', fontSize: 12, color: 'var(--color-text-tertiary)' }}>
              {t('docs.noTablesFound')}
            </div>
          ) : (
            filtered.map((tbl, i) => (
              <button
                key={tbl.id}
                onClick={() => onSelect(tbl)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '6px 8px',
                  background: i === selectedIdx ? 'var(--color-surface-selected)' : 'transparent',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-family)',
                  fontSize: 13,
                  color: 'var(--color-text-primary)',
                  textAlign: 'left',
                }}
                onMouseEnter={() => setSelectedIdx(i)}
              >
                <span style={{ color: 'var(--color-text-tertiary)', fontSize: 14 }}>{'\u2637'}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {tbl.title || t('docs.untitledTable')}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
