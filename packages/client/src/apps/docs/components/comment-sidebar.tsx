import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSquare, Check, Trash2, X } from 'lucide-react';
import {
  useDocComments,
  useCreateDocComment,
  useResolveDocComment,
  useDeleteDocComment,
} from '../hooks/use-doc-comments';
import type { DocumentComment } from '@atlasmail/shared';
import { Button } from '../../../components/ui/button';
import { IconButton } from '../../../components/ui/icon-button';
import { Textarea } from '../../../components/ui/textarea';

interface CommentSidebarProps {
  docId: string;
  isOpen: boolean;
  onClose: () => void;
}

function getRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function CommentSidebar({ docId, isOpen, onClose }: CommentSidebarProps) {
  const { data: comments = [] } = useDocComments(docId);
  const createComment = useCreateDocComment();
  const resolveComment = useResolveDocComment();
  const deleteComment = useDeleteDocComment();
  const [newComment, setNewComment] = useState('');
  const { t } = useTranslation();
  const [showResolved, setShowResolved] = useState(false);

  const activeComments = comments.filter((c: DocumentComment) => !c.isResolved && !c.parentId);
  const resolvedComments = comments.filter((c: DocumentComment) => c.isResolved && !c.parentId);
  const displayComments = showResolved ? [...activeComments, ...resolvedComments] : activeComments;

  const handleSubmit = () => {
    if (!newComment.trim()) return;
    createComment.mutate({ docId, content: newComment.trim() });
    setNewComment('');
  };

  if (!isOpen) return null;

  return (
    <div style={{
      width: 288,
      borderLeft: '1px solid var(--color-border-primary)',
      background: 'var(--color-bg-primary)',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
      fontFamily: 'var(--font-family)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 'var(--spacing-md) var(--spacing-lg)',
        borderBottom: '1px solid var(--color-border-secondary)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
          <MessageSquare size={16} style={{ color: 'var(--color-text-tertiary)' }} />
          <span style={{
            fontSize: 'var(--font-size-sm)',
            fontWeight: 'var(--font-weight-semibold)',
            color: 'var(--color-text-primary)',
          }}>
            {t('docs.comments')}
          </span>
          {activeComments.length > 0 && (
            <span style={{
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-text-tertiary)',
            }}>
              ({activeComments.length})
            </span>
          )}
        </div>
        <IconButton icon={<X size={16} />} label={t('common.close')} size={24} onClick={onClose} />
      </div>

      {/* New comment input */}
      <div style={{
        padding: 'var(--spacing-md) var(--spacing-lg)',
        borderBottom: '1px solid var(--color-border-secondary)',
        flexShrink: 0,
      }}>
        <Textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder={t('docs.addComment')}
          rows={2}
          style={{ resize: 'none', fontSize: 'var(--font-size-sm)' }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit();
          }}
        />
        {newComment.trim() && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--spacing-sm)' }}>
            <Button variant="primary" size="sm" onClick={handleSubmit}>
              {t('docs.comment')}
            </Button>
          </div>
        )}
      </div>

      {/* Comment list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {displayComments.length === 0 ? (
          <div style={{
            padding: 'var(--spacing-2xl) var(--spacing-lg)',
            textAlign: 'center',
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-tertiary)',
          }}>
            {t('docs.noComments')}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
            {displayComments.map((comment: DocumentComment) => (
              <div
                key={comment.id}
                style={{
                  padding: 'var(--spacing-md) var(--spacing-lg)',
                  borderBottom: '1px solid var(--color-border-secondary)',
                  opacity: comment.isResolved ? 0.5 : 1,
                  transition: 'opacity var(--transition-fast)',
                }}
              >
                {comment.selectionText && (
                  <div style={{
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--color-text-tertiary)',
                    background: 'color-mix(in srgb, var(--color-warning) 10%, var(--color-bg-secondary))',
                    padding: 'var(--spacing-xs) var(--spacing-sm)',
                    borderRadius: 'var(--radius-sm)',
                    marginBottom: 'var(--spacing-sm)',
                    fontStyle: 'italic',
                    borderLeft: '2px solid var(--color-warning)',
                  }}>
                    &ldquo;{comment.selectionText}&rdquo;
                  </div>
                )}
                <p style={{
                  fontSize: 'var(--font-size-sm)',
                  color: 'var(--color-text-secondary)',
                  margin: 0,
                  lineHeight: 'var(--line-height-normal)',
                }}>
                  {comment.content}
                </p>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: 'var(--spacing-sm)',
                }}>
                  <span style={{
                    fontSize: 10,
                    color: 'var(--color-text-tertiary)',
                  }}>
                    {getRelativeTime(comment.createdAt)}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
                    {!comment.isResolved && (
                      <IconButton
                        icon={<Check size={14} />}
                        label={t('docs.resolve')}
                        size={22}
                        onClick={() => resolveComment.mutate({ commentId: comment.id, docId })}
                      />
                    )}
                    <IconButton
                      icon={<Trash2 size={14} />}
                      label={t('common.delete')}
                      size={22}
                      destructive
                      onClick={() => deleteComment.mutate({ commentId: comment.id, docId })}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Show resolved toggle */}
      {resolvedComments.length > 0 && (
        <div style={{
          padding: 'var(--spacing-sm) var(--spacing-lg)',
          borderTop: '1px solid var(--color-border-secondary)',
          flexShrink: 0,
        }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowResolved(!showResolved)}
            style={{ fontSize: 12 }}
          >
            {showResolved ? t('docs.hideResolved', { count: resolvedComments.length }) : t('docs.showResolved', { count: resolvedComments.length })}
          </Button>
        </div>
      )}
    </div>
  );
}
