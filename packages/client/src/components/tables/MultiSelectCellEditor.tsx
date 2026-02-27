import { forwardRef, useImperativeHandle, useState, useRef, useEffect } from 'react';
import type { ICellEditorParams } from 'ag-grid-community';

interface MultiSelectCellEditorParams extends ICellEditorParams {
  options?: string[];
}

export const MultiSelectCellEditor = forwardRef(
  (props: MultiSelectCellEditorParams, ref) => {
    const options = props.options || props.colDef?.cellEditorParams?.options || [];
    const initial = Array.isArray(props.value) ? (props.value as string[]) : [];
    const [selected, setSelected] = useState<string[]>(initial);
    const containerRef = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => ({
      getValue: () => selected,
      isPopup: () => true,
    }));

    useEffect(() => {
      containerRef.current?.focus();
    }, []);

    const toggle = (opt: string) => {
      setSelected((prev) =>
        prev.includes(opt) ? prev.filter((s) => s !== opt) : [...prev, opt],
      );
    };

    return (
      <div
        ref={containerRef}
        className="tables-multiselect-editor"
        tabIndex={0}
      >
        {options.map((opt: string) => (
          <label key={opt} className="tables-multiselect-option">
            <input
              type="checkbox"
              checked={selected.includes(opt)}
              onChange={() => toggle(opt)}
            />
            <span>{opt}</span>
          </label>
        ))}
      </div>
    );
  },
);

MultiSelectCellEditor.displayName = 'MultiSelectCellEditor';
