import { useRef } from 'react';
import { Plus, Paperclip, Download, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatBytes } from '../../../lib/format';
import { useAuthStore } from '../../../stores/auth-store';
import { useAppActions } from '../../../hooks/use-app-permissions';
import { useTaskAttachments, useAddAttachment, useDeleteAttachment } from '../hooks';
import { IconButton } from '../../../components/ui/icon-button';
import { api } from '../../../lib/api-client';

export function AttachmentSection({ taskId }: { taskId: string }) {
  const { t } = useTranslation();
  const { account } = useAuthStore();
  const { canCreate } = useAppActions('work');
  const { data: attachments = [] } = useTaskAttachments(taskId);
  const addAttachment = useAddAttachment();
  const deleteAttachment = useDeleteAttachment();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      addAttachment.mutate({ taskId, file: files[i] });
    }
    // Reset input so same file can be re-uploaded
    e.target.value = '';
  };

  return (
    <div style={{
      padding: 'var(--spacing-lg)',
      borderTop: '1px solid var(--color-border-secondary)',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 'var(--spacing-md)',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-xs)',
        }}>
          <Paperclip size={13} color="var(--color-text-tertiary)" />
          <span style={{
            fontSize: 'var(--font-size-xs)',
            fontWeight: 'var(--font-weight-medium)' as any,
            color: 'var(--color-text-tertiary)',
            textTransform: 'uppercase' as const,
            letterSpacing: '0.05em',
          }}>
            {t('tasks.attachments.title')} {attachments.length > 0 && `(${attachments.length})`}
          </span>
        </div>
        {canCreate && (
          <IconButton
            icon={<Plus size={14} />}
            label={t('tasks.attachments.upload')}
            size={24}
            onClick={() => fileInputRef.current?.click()}
          />
        )}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          style={{ display: 'none' }}
          onChange={handleUpload}
        />
      </div>

      {attachments.length === 0 && (
        <div style={{
          fontSize: 'var(--font-size-sm)',
          color: 'var(--color-text-tertiary)',
          padding: 'var(--spacing-sm) 0',
        }}>
          {t('tasks.attachments.empty')}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
        {attachments.map((att) => (
          <div key={att.id} className="group" style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-sm)',
            padding: 'var(--spacing-xs) var(--spacing-sm)',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--color-bg-secondary)',
          }}>
            <Paperclip size={13} color="var(--color-text-tertiary)" style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {att.fileName}
              </div>
              <div style={{
                fontSize: 'var(--font-size-xs)',
                color: 'var(--color-text-tertiary)',
              }}>
                {formatBytes(att.size)}
              </div>
            </div>
            <IconButton
              icon={<Download size={12} />}
              label={t('tasks.download')}
              size={22}
              tooltip={false}
              onClick={() => {
                window.open(`${api.defaults.baseURL}/tasks/attachments/${att.id}/download`, '_blank');
              }}
            />
            {account && att.userId === account.userId && (
              <IconButton
                icon={<Trash2 size={12} />}
                label={t('tasks.attachments.delete')}
                size={22}
                destructive
                tooltip={false}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => deleteAttachment.mutate({ attachmentId: att.id, taskId })}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
