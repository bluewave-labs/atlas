import { useRef, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import * as Dialog from '@radix-ui/react-dialog';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import { X, Paperclip, FileIcon, ChevronUp, ChevronDown, Plus } from 'lucide-react';
import type { TableColumn, TableRow, TableAttachment, TableFieldType } from '@atlasmail/shared';
import { FIELD_TYPE_ICONS } from '../../lib/field-type-icons';
import { api } from '../../lib/api-client';

const FIELD_TYPES: { value: TableFieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'singleSelect', label: 'Single select' },
  { value: 'multiSelect', label: 'Multi select' },
  { value: 'date', label: 'Date' },
  { value: 'url', label: 'URL' },
  { value: 'email', label: 'Email' },
  { value: 'currency', label: 'Currency' },
  { value: 'phone', label: 'Phone' },
  { value: 'rating', label: 'Rating' },
  { value: 'percent', label: 'Percent' },
  { value: 'longText', label: 'Long text' },
  { value: 'attachment', label: 'Attachment' },
];

interface ExpandRowModalProps {
  row: TableRow;
  columns: TableColumn[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateField: (rowId: string, colId: string, value: unknown) => void;
  onNavigateRow?: (direction: 'prev' | 'next') => void;
  onAddColumn?: (name: string, type: TableFieldType, options?: string[]) => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}

export function ExpandRowModal({
  row,
  columns,
  open,
  onOpenChange,
  onUpdateField,
  onNavigateRow,
  onAddColumn,
  hasPrev = false,
  hasNext = false,
}: ExpandRowModalProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingColRef = useRef<string | null>(null);
  const [showAddField, setShowAddField] = useState(false);

  // Keyboard navigation: arrow up/down when not focused on an input
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'ArrowUp' && onNavigateRow && hasPrev) {
        e.preventDefault();
        onNavigateRow('prev');
      } else if (e.key === 'ArrowDown' && onNavigateRow && hasNext) {
        e.preventDefault();
        onNavigateRow('next');
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onNavigateRow, hasPrev, hasNext]);

  const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const colId = pendingColRef.current;
    if (!file || !colId) return;

    const formData = new FormData();
    formData.append('file', file);
    try {
      const { data: resp } = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const attachment: TableAttachment = resp.data;
      const existing: TableAttachment[] = Array.isArray(row[colId]) ? (row[colId] as TableAttachment[]) : [];
      onUpdateField(row._id, colId, [...existing, attachment]);
    } catch {
      // upload failed
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
    pendingColRef.current = null;
  };

  const handleRemoveAttachment = (colId: string, index: number) => {
    const existing: TableAttachment[] = Array.isArray(row[colId]) ? (row[colId] as TableAttachment[]) : [];
    onUpdateField(row._id, colId, existing.filter((_, i) => i !== index));
  };

  // Extract primary field (first column) vs remaining fields
  const primaryCol = columns[0];
  const bodyColumns = columns.slice(1);
  const primaryValue = primaryCol ? (row[primaryCol.id] != null ? String(row[primaryCol.id]) : '') : '';

  const renderField = (col: TableColumn) => {
    const value = row[col.id];

    switch (col.type) {
      case 'text':
        return (
          <input
            type="text"
            className="tables-expand-input"
            value={value != null ? String(value) : ''}
            onChange={(e) => onUpdateField(row._id, col.id, e.target.value)}
          />
        );
      case 'email':
        return (
          <input
            type="email"
            className="tables-expand-input"
            value={value != null ? String(value) : ''}
            onChange={(e) => onUpdateField(row._id, col.id, e.target.value)}
          />
        );
      case 'url':
        return (
          <input
            type="url"
            className="tables-expand-input"
            value={value != null ? String(value) : ''}
            onChange={(e) => onUpdateField(row._id, col.id, e.target.value)}
          />
        );
      case 'phone':
        return (
          <input
            type="tel"
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
            onChange={(e) => onUpdateField(row._id, col.id, e.target.value ? Number(e.target.value) : null)}
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
            value={value != null ? String(value).slice(0, 10) : ''}
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
      case 'attachment': {
        const attachments: TableAttachment[] = Array.isArray(value) ? (value as TableAttachment[]) : [];
        const token = localStorage.getItem('atlasmail_token') || '';
        const isImage = (type: string) => type.startsWith('image/');
        return (
          <div className="tables-expand-attachment">
            {attachments.length > 0 && (
              <div className="tables-expand-attachment-list">
                {attachments.map((att, i) => (
                  <div key={`${att.name}-${att.url}`} className="tables-expand-attachment-chip">
                    {isImage(att.type) ? (
                      <img className="tables-expand-attachment-thumb" src={`${att.url}?token=${token}`} alt={att.name} />
                    ) : (
                      <FileIcon size={14} />
                    )}
                    <a
                      href={`${att.url}?token=${token}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="tables-expand-attachment-name"
                    >
                      {att.name}
                    </a>
                    <button
                      className="tables-expand-attachment-remove"
                      onClick={() => handleRemoveAttachment(col.id, i)}
                      title="Remove"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button
              className="tables-expand-attachment-add"
              onClick={() => {
                pendingColRef.current = col.id;
                fileInputRef.current?.click();
              }}
            >
              <Paperclip size={14} />
              <span>Add file</span>
            </button>
          </div>
        );
      }
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

          {/* Top bar: nav arrows + close */}
          <div className="tables-expand-topbar">
            <div className="tables-expand-topbar-left">
              {onNavigateRow && (
                <>
                  <button
                    className="tables-expand-nav-btn"
                    disabled={!hasPrev}
                    onClick={() => onNavigateRow('prev')}
                    title="Previous row"
                  >
                    <ChevronUp size={16} />
                  </button>
                  <button
                    className="tables-expand-nav-btn"
                    disabled={!hasNext}
                    onClick={() => onNavigateRow('next')}
                    title="Next row"
                  >
                    <ChevronDown size={16} />
                  </button>
                </>
              )}
            </div>
            <Dialog.Close asChild>
              <button className="tables-expand-close">
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          {/* Primary field as big header */}
          {primaryCol && (
            <div className="tables-expand-primary">
              <div className="tables-expand-primary-label">
                {(() => { const Icon = FIELD_TYPE_ICONS[primaryCol.type]; return Icon ? <Icon size={12} /> : null; })()}
                {primaryCol.name}
              </div>
              <input
                className="tables-expand-primary-value"
                value={primaryValue}
                onChange={(e) => onUpdateField(row._id, primaryCol.id, e.target.value)}
                placeholder="Untitled"
              />
            </div>
          )}

          <hr className="tables-expand-divider" />

          {/* Field rows */}
          <div className="tables-expand-body">
            {bodyColumns.map((col) => {
              const Icon = FIELD_TYPE_ICONS[col.type];
              return (
                <div key={col.id} className="tables-expand-field">
                  <label className="tables-expand-label">
                    {Icon && <Icon size={14} />}
                    {col.name}
                  </label>
                  <div className="tables-expand-value">
                    {renderField(col)}
                  </div>
                </div>
              );
            })}

            {/* Add a field button */}
            {onAddColumn && (
              <div className="tables-expand-add-field-wrapper">
                {!showAddField ? (
                  <button
                    className="tables-expand-add-field-btn"
                    onClick={() => setShowAddField(true)}
                  >
                    <Plus size={14} />
                    <span>{t('tables.addFieldToTable', 'Add a field to this table')}</span>
                  </button>
                ) : (
                  <InlineAddField
                    onAdd={(name, type, options) => {
                      onAddColumn(name, type, options);
                      setShowAddField(false);
                    }}
                    onClose={() => setShowAddField(false)}
                  />
                )}
              </div>
            )}
          </div>

          {/* Hidden file input for attachment uploads */}
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleAttachmentUpload}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/* ─── Inline add-field form ──────────────────────────────────────── */

function InlineAddField({
  onAdd,
  onClose,
}: {
  onAdd: (name: string, type: TableFieldType, options?: string[]) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [type, setType] = useState<TableFieldType>('text');
  const [options, setOptions] = useState('');
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const typeDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // Close type dropdown on Escape
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (showTypeDropdown) {
        e.stopPropagation();
        setShowTypeDropdown(false);
      } else {
        onClose();
      }
    }
  }, [showTypeDropdown, onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const needsOptions = type === 'singleSelect' || type === 'multiSelect';
  const selectedFieldType = FIELD_TYPES.find((ft) => ft.value === type);
  const TypeIcon = FIELD_TYPE_ICONS[type];

  const handleSubmit = () => {
    if (!name.trim()) return;
    const opts = needsOptions
      ? options.split(',').map((o) => o.trim()).filter(Boolean)
      : undefined;
    onAdd(name.trim(), type, opts);
  };

  return (
    <div ref={wrapperRef} className="tables-expand-add-field-form" onClick={(e) => e.stopPropagation()}>
      <div className="tables-expand-add-field-row">
        <input
          ref={nameRef}
          className="tables-expand-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('tables.columnNamePlaceholder', 'Field name')}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        />
      </div>
      <div className="tables-expand-add-field-row" style={{ position: 'relative' }} ref={typeDropdownRef}>
        <button
          className="tables-field-type-trigger"
          onClick={() => setShowTypeDropdown(!showTypeDropdown)}
          type="button"
        >
          <TypeIcon size={14} />
          <span>{selectedFieldType?.label}</span>
          <ChevronDown size={14} />
        </button>
        {showTypeDropdown && (
          <div className="tables-field-type-dropdown" style={{ bottom: '100%', top: 'auto', marginBottom: 4 }}>
            {FIELD_TYPES.map((ft) => {
              const Icon = FIELD_TYPE_ICONS[ft.value];
              return (
                <button
                  key={ft.value}
                  className={`tables-field-type-option${ft.value === type ? ' selected' : ''}`}
                  onClick={() => { setType(ft.value); setShowTypeDropdown(false); }}
                  type="button"
                >
                  <Icon size={14} />
                  <span>{ft.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
      {needsOptions && (
        <div className="tables-expand-add-field-row">
          <input
            className="tables-expand-input"
            value={options}
            onChange={(e) => setOptions(e.target.value)}
            placeholder={t('tables.optionsPlaceholder', 'Option 1, Option 2, ...')}
          />
        </div>
      )}
      <div className="tables-expand-add-field-actions">
        <button className="tables-expand-add-field-cancel" onClick={onClose}>{t('tables.cancel', 'Cancel')}</button>
        <button className="tables-expand-add-field-submit" onClick={handleSubmit}>{t('tables.addColumn', 'Add field')}</button>
      </div>
    </div>
  );
}
