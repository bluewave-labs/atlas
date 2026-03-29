import { useState, useRef, useEffect, useCallback } from 'react';
import { FunctionSquare } from 'lucide-react';

interface FormulaBarProps {
  cellRef: string; // e.g., "A1"
  rawValue: string;
  computedValue: unknown;
  isFormula: boolean;
  onEdit: (value: string) => void;
}

export function FormulaBar({ cellRef, rawValue, computedValue, isFormula, onEdit }: FormulaBarProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(rawValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) {
      setEditValue(rawValue);
    }
  }, [rawValue, editing]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
    }
  }, [editing]);

  const handleSubmit = useCallback(() => {
    setEditing(false);
    if (editValue !== rawValue) {
      onEdit(editValue);
    }
  }, [editValue, rawValue, onEdit]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setEditing(false);
      setEditValue(rawValue);
    }
  }, [handleSubmit, rawValue]);

  const displayValue = isFormula
    ? (editing ? editValue : rawValue)
    : (rawValue ?? '');

  return (
    <div className="formula-bar">
      <span className="formula-bar-ref">{cellRef || '--'}</span>
      <span className="formula-bar-divider" />
      {isFormula && (
        <span className="formula-bar-fx">
          <FunctionSquare size={13} />
        </span>
      )}
      <input
        ref={inputRef}
        className="formula-bar-input"
        type="text"
        value={editing ? editValue : displayValue}
        onChange={(e) => setEditValue(e.target.value)}
        onFocus={() => setEditing(true)}
        onBlur={handleSubmit}
        onKeyDown={handleKeyDown}
        readOnly={!cellRef}
        placeholder={cellRef ? 'Enter value or formula (=SUM(A1:A5))' : ''}
      />
      {isFormula && !editing && computedValue != null && (
        <span className="formula-bar-result">
          = {String(computedValue)}
        </span>
      )}
    </div>
  );
}
