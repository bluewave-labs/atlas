import { useTranslation } from 'react-i18next';
import * as Dialog from '@radix-ui/react-dialog';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import { X } from 'lucide-react';
import type { TableColumn, TableRow } from '@atlasmail/shared';

interface ExpandRowModalProps {
  row: TableRow;
  columns: TableColumn[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateField: (rowId: string, colId: string, value: unknown) => void;
}

export function ExpandRowModal({ row, columns, open, onOpenChange, onUpdateField }: ExpandRowModalProps) {
  const { t } = useTranslation();

  const renderField = (col: TableColumn) => {
    const value = row[col.id];

    switch (col.type) {
      case 'text':
      case 'email':
      case 'url':
      case 'phone':
        return (
          <input
            type="text"
            className="tables-expand-input"
            value={value != null ? String(value) : ''}
            onChange={(e) => onUpdateField(row._id, col.id, e.target.value)}
          />
        );
      case 'number':
      case 'currency':
      case 'percent':
      case 'rating':
        return (
          <input
            type="number"
            className="tables-expand-input"
            value={value != null ? String(value) : ''}
            onChange={(e) => onUpdateField(row._id, col.id, e.target.value ? Number(e.target.value) : '')}
          />
        );
      case 'checkbox':
        return (
          <input
            type="checkbox"
            checked={value === true}
            onChange={(e) => onUpdateField(row._id, col.id, e.target.checked)}
            style={{ width: 18, height: 18 }}
          />
        );
      case 'singleSelect':
        return (
          <select
            className="tables-expand-input"
            value={value != null ? String(value) : ''}
            onChange={(e) => onUpdateField(row._id, col.id, e.target.value)}
          >
            <option value="">—</option>
            {(col.options || []).map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        );
      case 'multiSelect': {
        const selected = Array.isArray(value) ? value as string[] : [];
        return (
          <div className="tables-expand-multi">
            {(col.options || []).map((opt) => (
              <label key={opt} className="tables-expand-multi-option">
                <input
                  type="checkbox"
                  checked={selected.includes(opt)}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...selected, opt]
                      : selected.filter((s) => s !== opt);
                    onUpdateField(row._id, col.id, next);
                  }}
                />
                <span>{opt}</span>
              </label>
            ))}
          </div>
        );
      }
      case 'date':
        return (
          <input
            type="date"
            className="tables-expand-input"
            value={value != null ? String(value) : ''}
            onChange={(e) => onUpdateField(row._id, col.id, e.target.value)}
          />
        );
      case 'longText':
        return (
          <textarea
            className="tables-expand-textarea"
            rows={4}
            value={value != null ? String(value) : ''}
            onChange={(e) => onUpdateField(row._id, col.id, e.target.value)}
          />
        );
      default:
        return (
          <input
            type="text"
            className="tables-expand-input"
            value={value != null ? String(value) : ''}
            onChange={(e) => onUpdateField(row._id, col.id, e.target.value)}
          />
        );
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="tables-expand-overlay" />
        <Dialog.Content className="tables-expand-content">
          <VisuallyHidden.Root>
            <Dialog.Title>{t('tables.expandRow')}</Dialog.Title>
          </VisuallyHidden.Root>

          <div className="tables-expand-header">
            <span className="tables-expand-title">{t('tables.expandRow')}</span>
            <Dialog.Close asChild>
              <button className="tables-expand-close">
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          <div className="tables-expand-body">
            {columns.map((col) => (
              <div key={col.id} className="tables-expand-field">
                <label className="tables-expand-label">{col.name}</label>
                <div className="tables-expand-value">
                  {renderField(col)}
                </div>
              </div>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
