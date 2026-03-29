import { forwardRef, useImperativeHandle, useState, useRef, useEffect, useCallback } from 'react';
import type { ICellEditorParams } from 'ag-grid-community';
import { getTagColor } from '../../../lib/tag-colors';

interface RichSelectCellEditorParams extends ICellEditorParams {
  options?: string[];
}

export const RichSelectCellEditor = forwardRef(
  (props: RichSelectCellEditorParams, ref) => {
    const options = props.options || props.colDef?.cellEditorParams?.values || [];
    const [selected, setSelected] = useState<string>(props.value != null ? String(props.value) : '');
    const [search, setSearch] = useState('');
    const [highlightIndex, setHighlightIndex] = useState(-1);
    const containerRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const committed = useRef(false);
    // Use a ref so getValue() always returns the latest value,
    // even if called before React re-renders after setSelected
    const selectedRef = useRef(selected);

    const filteredOptions = options.filter((opt: string) =>
      opt.toLowerCase().includes(search.toLowerCase()),
    );

    useImperativeHandle(ref, () => ({
      getValue: () => selectedRef.current,
      isPopup: () => true,
    }));

    useEffect(() => {
      searchRef.current?.focus();
    }, []);

    // Scroll highlighted item into view
    useEffect(() => {
      if (highlightIndex >= 0 && listRef.current) {
        const items = listRef.current.querySelectorAll('.rich-select-option');
        items[highlightIndex]?.scrollIntoView({ block: 'nearest' });
      }
    }, [highlightIndex]);

    const selectAndClose = useCallback((value: string) => {
      if (committed.current) return;
      committed.current = true;
      selectedRef.current = value;
      setSelected(value);
      setTimeout(() => {
        props.api.stopEditing();
      }, 0);
    }, [props.api]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightIndex((prev) => Math.min(prev + 1, filteredOptions.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (highlightIndex >= 0 && highlightIndex < filteredOptions.length) {
            selectAndClose(filteredOptions[highlightIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          props.api.stopEditing(true);
          break;
      }
    }, [filteredOptions, highlightIndex, selectAndClose, props.api]);

    return (
      <div
        ref={containerRef}
        className="rich-select-editor"
        onKeyDown={handleKeyDown}
      >
        <input
          ref={searchRef}
          className="rich-select-search"
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setHighlightIndex(-1); }}
          placeholder="Search..."
        />
        <div ref={listRef} className="rich-select-list">
          {filteredOptions.length === 0 && (
            <div className="rich-select-empty">No options</div>
          )}
          {filteredOptions.map((opt: string, idx: number) => {
            const color = getTagColor(opt);
            const isHighlighted = idx === highlightIndex;
            const isSelected = opt === selected;
            return (
              <button
                key={opt}
                className={`rich-select-option${isHighlighted ? ' highlighted' : ''}${isSelected ? ' selected' : ''}`}
                onClick={() => selectAndClose(opt)}
                onMouseEnter={() => setHighlightIndex(idx)}
              >
                <span
                  className="tables-cell-tag"
                  style={{ background: color.bg, color: color.text }}
                >
                  {opt}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  },
);

RichSelectCellEditor.displayName = 'RichSelectCellEditor';
