import { useState, useRef, useEffect, useMemo } from 'react';
import { Filter, X, Check } from 'lucide-react';
import type { TableRow } from '@atlasmail/shared';

interface SetFilterPopoverProps {
  columnId: string;
  columnName: string;
  rows: TableRow[];
  activeValues: string[] | undefined; // undefined = no filter (all shown)
  onApply: (columnId: string, values: string[] | undefined) => void;
}

export function SetFilterPopover({
  columnId,
  columnName,
  rows,
  activeValues,
  onApply,
}: SetFilterPopoverProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  // Extract unique values for this column
  const uniqueValues = useMemo(() => {
    const set = new Set<string>();
    for (const row of rows) {
      const val = row[columnId];
      if (val != null && val !== '') {
        if (Array.isArray(val)) {
          for (const v of val) set.add(String(v));
        } else {
          set.add(String(val));
        }
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows, columnId]);

  // Local checked state (undefined = all checked)
  const [checked, setChecked] = useState<Set<string>>(() =>
    activeValues ? new Set(activeValues) : new Set(uniqueValues),
  );

  // Reset checked when opening
  useEffect(() => {
    if (open) {
      setChecked(activeValues ? new Set(activeValues) : new Set(uniqueValues));
      setSearch('');
    }
  }, [open, activeValues, uniqueValues]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        !btnRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const filteredValues = useMemo(
    () => uniqueValues.filter((v) => v.toLowerCase().includes(search.toLowerCase())),
    [uniqueValues, search],
  );

  const allFilteredChecked = filteredValues.length > 0 && filteredValues.every((v) => checked.has(v));

  const toggleAll = () => {
    const next = new Set(checked);
    if (allFilteredChecked) {
      for (const v of filteredValues) next.delete(v);
    } else {
      for (const v of filteredValues) next.add(v);
    }
    setChecked(next);
  };

  const toggle = (val: string) => {
    const next = new Set(checked);
    if (next.has(val)) next.delete(val);
    else next.add(val);
    setChecked(next);
  };

  const handleApply = () => {
    // If all values are checked, clear the filter
    if (uniqueValues.length > 0 && uniqueValues.every((v) => checked.has(v))) {
      onApply(columnId, undefined);
    } else {
      onApply(columnId, Array.from(checked));
    }
    setOpen(false);
  };

  const handleClear = () => {
    onApply(columnId, undefined);
    setOpen(false);
  };

  const isActive = activeValues != null;

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        ref={btnRef}
        className={`tables-toolbar-btn${isActive ? ' active' : ''}`}
        onClick={() => setOpen(!open)}
        title={`Filter by ${columnName}`}
      >
        <Filter size={14} />
        {isActive && (
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--color-accent-primary)',
              position: 'absolute',
              top: 3,
              right: 3,
            }}
          />
        )}
      </button>
      {open && (
        <div
          ref={popoverRef}
          className="set-filter-popover"
        >
          <div className="set-filter-header">
            <span className="set-filter-title">Filter: {columnName}</span>
            <button className="set-filter-close" onClick={() => setOpen(false)}>
              <X size={14} />
            </button>
          </div>
          <input
            className="set-filter-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search values..."
            autoFocus
          />
          <div className="set-filter-select-all">
            <label>
              <input
                type="checkbox"
                checked={allFilteredChecked}
                onChange={toggleAll}
              />
              <span>Select all</span>
            </label>
          </div>
          <div className="set-filter-list">
            {filteredValues.map((val) => (
              <label key={val} className="set-filter-option">
                <input
                  type="checkbox"
                  checked={checked.has(val)}
                  onChange={() => toggle(val)}
                />
                <span>{val}</span>
                {checked.has(val) && <Check size={12} style={{ marginLeft: 'auto', color: 'var(--color-accent-primary)' }} />}
              </label>
            ))}
            {filteredValues.length === 0 && (
              <div className="set-filter-empty">No values found</div>
            )}
          </div>
          <div className="set-filter-actions">
            <button className="set-filter-clear" onClick={handleClear}>Clear</button>
            <button className="set-filter-apply" onClick={handleApply}>Apply</button>
          </div>
        </div>
      )}
    </div>
  );
}
