import { useState } from 'react';
import { MessageSquare, Trash2, Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../../stores/auth-store';
import { useTaskComments, useCreateComment, useDeleteComment } from '../hooks';
import { Avatar } from '../../../components/ui/avatar';
import { IconButton } from '../../../components/ui/icon-button';
import { MentionInput } from '../../../components/shared/mention-input';

export function CommentSection({ taskId }: { taskId: string }) {
  const { t } = useTranslation();
  const { account } = useAuthStore();
  const { data: comments = [] } = useTaskComments(taskId);
  const createComment = useCreateComment();
  const deleteComment = useDeleteComment();
  const [newComment, setNewComment] = useState('');

  const handleSubmit = () => {
    const body = newComment.trim();
    if (!body) return;
    createComment.mutate({ taskId, body });
    setNewComment('');
  };

  function getRelativeTime(dateStr: string): string {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diff = now - then;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t('tasks.activity.justNow');
    if (mins < 60) return t('tasks.activity.minutesAgo', { count: mins });
    const hours = Math.floor(mins / 60);
    if (hours < 24) return t('tasks.activity.hoursAgo', { count: hours });
    const days = Math.floor(hours / 24);
    return t('tasks.activity.daysAgo', { count: days });
  }

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
                  {getRelativeTime(comment.createdAt)}
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
    </div>
  );
}
