import { useState } from 'react';
import { MessageSquare, Trash2, Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatRelativeDate } from '../../../lib/format';
import { useAuthStore } from '../../../stores/auth-store';
import { useAppActions } from '../../../hooks/use-app-permissions';
import { useTaskComments, useCreateComment, useDeleteComment } from '../hooks';
import { Avatar } from '../../../components/ui/avatar';
import { IconButton } from '../../../components/ui/icon-button';
import { MentionInput } from '../../../components/shared/mention-input';

export function CommentSection({ taskId }: { taskId: string }) {
  const { t } = useTranslation();
  const { account } = useAuthStore();
  const { canCreate } = useAppActions('work');
  const { data: comments = [] } = useTaskComments(taskId);
  const createComment = useCreateComment();
  const deleteComment = useDeleteComment();
  const [newComment, setNewComment] = useState('');

  const handleSubmit = () => {
    if (!canCreate) return;
    const body = newComment.trim();
    if (!body) return;
    createComment.mutate({ taskId, body });
    setNewComment('');
  };

  return (
    <div style={{
      padding: 'var(--spacing-lg)',
      borderTop: '1px solid var(--color-border-secondary)',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--spacing-xs)',
        marginBottom: 'var(--spacing-md)',
      }}>
        <MessageSquare size={13} color="var(--color-text-tertiary)" />
        <span style={{
          fontSize: 'var(--font-size-xs)',
          fontWeight: 'var(--font-weight-medium)' as any,
          color: 'var(--color-text-tertiary)',
          textTransform: 'uppercase' as const,
          letterSpacing: '0.05em',
        }}>
          {t('tasks.comments.title')} {comments.length > 0 && `(${comments.length})`}
        </span>
      </div>

      {/* Comment list */}
      {comments.length === 0 && (
        <div style={{
          fontSize: 'var(--font-size-sm)',
          color: 'var(--color-text-tertiary)',
          padding: 'var(--spacing-sm) 0',
        }}>
          {t('tasks.comments.empty')}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
        {comments.map((comment) => (
          <div key={comment.id} className="group" style={{
            display: 'flex',
            gap: 'var(--spacing-sm)',
            alignItems: 'flex-start',
          }}>
            <Avatar
              name={comment.userName}
              email={comment.userEmail ?? undefined}
              size={24}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-sm)',
              }}>
                <span style={{
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 'var(--font-weight-medium)' as any,
                  color: 'var(--color-text-primary)',
                }}>
                  {comment.userName || comment.userEmail || t('tasks.comments.unknown')}
                </span>
                <span style={{
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-text-tertiary)',
                }}>
                  {formatRelativeDate(comment.createdAt)}
                </span>
                {account && comment.userId === account.userId && (
                  <IconButton
                    icon={<Trash2 size={11} />}
                    label={t('tasks.comments.delete')}
                    size={20}
                    destructive
                    tooltip={false}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => deleteComment.mutate({ commentId: comment.id, taskId })}
                  />
                )}
              </div>
              <div style={{
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-secondary)',
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}>
                {comment.body}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add comment input */}
      {canCreate && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-sm)',
          marginTop: 'var(--spacing-md)',
        }}>
          <MentionInput
            value={newComment}
            onChange={setNewComment}
            onSubmit={handleSubmit}
            placeholder={t('tasks.comments.placeholder')}
          />
          <IconButton
            icon={<Send size={14} />}
            label={t('tasks.comments.add')}
            size={28}
            onClick={handleSubmit}
          />
        </div>
      )}
    </div>
  );
}
