import { useState, useRef, useEffect, useCallback } from 'react';

interface BatchEditOverlayProps {
  cellCount: number;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

export function BatchEditOverlay({ cellCount, onConfirm, onCancel }: BatchEditOverlayProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onConfirm(value);
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
    // Stop propagation to prevent AG Grid from handling keys
    e.stopPropagation();
  }, [value, onConfirm, onCancel]);

  return (
    <div className="batch-edit-overlay">
      <div className="batch-edit-content">
        <input
          ref={inputRef}
          className="batch-edit-input"
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Edit ${cellCount} cells...`}
        />
        <div className="batch-edit-hint">
          Enter to apply · Escape to cancel · {cellCount} cells
        </div>
      </div>
    </div>
  );
}
