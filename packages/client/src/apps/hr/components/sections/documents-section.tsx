import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, Download, FileText, Trash2 } from 'lucide-react';
import {
  useEmployeeDocuments, useUploadEmployeeDocument, useDeleteEmployeeDocument,
  type EmployeeDocument,
} from '../../hooks';
import { Button } from '../../../../components/ui/button';
import { Select } from '../../../../components/ui/select';
import { IconButton } from '../../../../components/ui/icon-button';
import { useAppActions } from '../../../../hooks/use-app-permissions';
import { getDocTypeBadge } from '../../lib/hr-utils';
import { formatDate } from '../../../../lib/format';

export function DocumentsSection({ employeeId }: { employeeId: string }) {
  const { t } = useTranslation();
  const { canDelete } = useAppActions('hr');
  const { data: docs } = useEmployeeDocuments(employeeId);
  const uploadDoc = useUploadEmployeeDocument();
  const deleteDoc = useDeleteEmployeeDocument();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState('other');

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadDoc.mutate({ employeeId, file, type: docType });
    e.target.value = '';
  };

  const handleDownload = (doc: EmployeeDocument) => {
    window.open(`/api/hr/documents/${doc.id}/download`, '_blank');
  };

  const formatSize = (size: number | null) => {
    if (!size) return '';
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-sm)' }}>
        <span className="hr-section-title">{t('hr.documents.title')}</span>
        <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center' }}>
          <Select
            value={docType}
            onChange={setDocType}
            options={[
              { value: 'contract', label: t('hr.documents.types.contract') },
              { value: 'certificate', label: t('hr.documents.types.certificate') },
              { value: 'ID', label: t('hr.documents.types.id') },
              { value: 'resume', label: t('hr.documents.types.resume') },
              { value: 'policy-acknowledgment', label: t('hr.documents.types.policy') },
              { value: 'other', label: t('hr.documents.types.other') },
            ]}
            size="sm"
          />
          <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleUpload} />
          <Button variant="primary" size="sm" icon={<Upload size={14} />} onClick={() => fileInputRef.current?.click()}>
            {t('hr.documents.upload')}
          </Button>
        </div>
      </div>

      {(!docs || docs.length === 0) ? (
        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>
          {t('hr.documents.noDocuments')}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
          {docs.map((doc) => (
            <div key={doc.id} style={{
              display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)',
              padding: '8px var(--spacing-sm)', borderRadius: 'var(--radius-md)',
              background: 'var(--color-bg-secondary)', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family)',
            }}>
              <FileText size={14} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
              <span style={{ flex: 1, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {doc.name}
              </span>
              {getDocTypeBadge(doc.type, t)}
              <span style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-xs)' }}>
                {formatSize(doc.size)}
              </span>
              <span style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-xs)' }}>
                {formatDate(doc.createdAt)}
              </span>
              <IconButton icon={<Download size={12} />} label={t('hr.documents.download')} size={20} onClick={() => handleDownload(doc)} />
              {canDelete && <IconButton icon={<Trash2 size={12} />} label={t('common.delete')} size={20} destructive onClick={() => deleteDoc.mutate(doc.id)} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
