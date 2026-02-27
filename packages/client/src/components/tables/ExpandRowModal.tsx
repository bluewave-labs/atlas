import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import * as Dialog from '@radix-ui/react-dialog';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import { X, Paperclip, FileIcon } from 'lucide-react';
import type { TableColumn, TableRow, TableAttachment } from '@atlasmail/shared';
import { FIELD_TYPE_ICONS } from '../../lib/field-type-icons';
import { api } from '../../lib/api-client';

interface ExpandRowModalProps {
  row: TableRow;
  columns: TableColumn[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateField: (rowId: string, colId: string, value: unknown) => void;
}

export function ExpandRowModal({ row, columns, open, onOpenChange, onUpdateField }: ExpandRowModalProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingColRef = useRef<string | null>(null);

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
      case 'attachment': {
        const attachments: TableAttachment[] = Array.isArray(value) ? (value as TableAttachment[]) : [];
        const token = localStorage.getItem('atlasmail_token') || '';
        const isImage = (type: string) => type.startsWith('image/');
        return (
          <div className="tables-expand-attachment">
            {attachments.length > 0 && (
              <div className="tables-expand-attachment-list">
                {attachments.map((att, i) => (
                  <div key={i} className="tables-expand-attachment-chip">
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

          <div className="tables-expand-header">
            <span className="tables-expand-title">{t('tables.expandRow')}</span>
            <Dialog.Close asChild>
              <button className="tables-expand-close">
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          <div className="tables-expand-body">
            {columns.map((col) => {
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
