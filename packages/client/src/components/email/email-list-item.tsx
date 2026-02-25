import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Star, Reply, Archive, Trash2, Clock, Check, Paperclip } from 'lucide-react';
import { Avatar } from '../ui/avatar';
import { IconButton } from '../ui/icon-button';
import { Tooltip } from '../ui/tooltip';
import { LabelChip } from './label-chip';
import { SnoozePopover } from './snooze-popover';
import { getLabelById } from '../../lib/labels';
import { useValueChangeAnimation, injectStarPop, injectNewEmailArrival } from '../../lib/animations';
import { useSettingsStore } from '../../stores/settings-store';
import { formatRelativeTime } from '@atlasmail/shared';
import type { Thread } from '@atlasmail/shared';
import type { CSSProperties } from 'react';

// Inject keyframes once
injectStarPop();
injectNewEmailArrival();

interface EmailListItemProps {
  thread: Thread;
  isSelected: boolean;
  isCursor: boolean;
  isMultiSelected: boolean;
  /** When true, plays slide-in entrance animation (for newly arrived emails) */
  isNew?: boolean;
  onClick: () => void;
  onStarClick?: (e: React.MouseEvent) => void;
  onCheckboxClick?: (e: React.MouseEvent) => void;
  onReplyClick?: () => void;
  onArchiveClick?: () => void;
  onTrashClick?: () => void;
  onSnooze?: (threadId: string, snoozeUntil: Date) => void;
}

export function EmailListItem({
  thread,
  isSelected,
  isCursor,
  isMultiSelected,
  isNew = false,
  onClick,
  onStarClick,
  onCheckboxClick,
  onReplyClick,
  onArchiveClick,
  onTrashClick,
  onSnooze,
}: EmailListItemProps) {
  const { t, i18n } = useTranslation();
  const [isHovered, setIsHovered] = useState(false);
  const starAnimating = useValueChangeAnimation(thread.isStarred, true, 500);
  const readingPane = useSettingsStore((s) => s.readingPane);

  const isUnread = thread.unreadCount > 0;
  const senderName = (thread as any).senderName || (thread as any).senderEmail || thread.emails?.[0]?.fromName || thread.emails?.[0]?.fromAddress || 'Unknown';
  const senderEmail = (thread as any).senderEmail || thread.emails?.[0]?.fromAddress || '';

  // Resolve label IDs to Label objects (skip system labels like INBOX)
  const threadLabels = (thread.labels ?? [])
    .map((id) => getLabelById(id))
    .filter((l): l is NonNullable<typeof l> => l !== undefined);

  let background = 'transparent';
  if (isMultiSelected) background = 'var(--color-surface-selected)';
  else if (isSelected) background = 'var(--color-surface-selected)';
  else if (isCursor) background = 'var(--color-surface-hover)';
  else if (isHovered) background = 'var(--color-surface-hover)';

  // Show checkbox when hovering OR when this thread is multi-selected
  const showCheckbox = isHovered || isMultiSelected;

  const isBottomPane = readingPane === 'bottom';

  // ---- Bottom pane: single horizontal row layout (Outlook-style) ----
  if (isBottomPane) {
    return (
      <div
        role="option"
        aria-selected={isSelected || isMultiSelected}
        onClick={onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-sm)',
          padding: 'var(--email-row-padding, 0 16px)',
          height: 'var(--email-row-height, 36px)',
          background,
          cursor: 'pointer',
          borderBottom: '1px solid var(--color-border-secondary)',
          animation: isNew ? 'atlasmail-new-email-enter 400ms ease both' : undefined,
          boxSizing: 'border-box',
          transition: 'background var(--transition-normal)',
          userSelect: 'none',
        }}
      >
        {/* Unread indicator / Checkbox */}
        <UnreadOrCheckbox
          isUnread={isUnread}
          isMultiSelected={isMultiSelected}
          showCheckbox={showCheckbox}
          onCheckboxClick={onCheckboxClick}
          t={t}
        />

        {/* Avatar — smaller in horizontal mode */}
        <Avatar name={senderName} email={senderEmail} size={22} />

        {/* Sender — fixed width, bold */}
        <span
          style={{
            width: 180,
            flexShrink: 0,
            fontSize: 'var(--font-size-sm)',
            fontWeight: isUnread
              ? ('var(--font-weight-semibold)' as CSSProperties['fontWeight'])
              : ('var(--font-weight-normal)' as CSSProperties['fontWeight']),
            color: isUnread ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {senderName}
          {thread.messageCount > 1 && (
            <span
              style={{
                marginLeft: 4,
                fontSize: '10px',
                color: 'var(--color-text-secondary)',
                fontWeight: 500,
                background: 'var(--color-bg-tertiary)',
                borderRadius: 'var(--radius-sm)',
                padding: '0 4px',
                lineHeight: '16px',
                display: 'inline-block',
                verticalAlign: 'middle',
              }}
            >
              {thread.messageCount}
            </span>
          )}
        </span>

        {/* Subject */}
        <span
          style={{
            flexShrink: 0,
            maxWidth: 240,
            fontSize: 'var(--font-size-sm)',
            fontWeight: isUnread
              ? ('var(--font-weight-medium)' as CSSProperties['fontWeight'])
              : ('var(--font-weight-normal)' as CSSProperties['fontWeight']),
            color: isUnread ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {thread.subject || t('common.noSubject')}
        </span>

        {/* Separator dash */}
        <span
          style={{
            color: 'var(--color-text-quaternary, var(--color-text-tertiary))',
            fontSize: 'var(--font-size-xs)',
            flexShrink: 0,
            opacity: 0.5,
          }}
        >
          —
        </span>

        {/* Snippet — fills remaining space */}
        <span
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-tertiary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontWeight: 'var(--font-weight-normal)' as CSSProperties['fontWeight'],
          }}
        >
          {thread.snippet || ''}
        </span>

        {/* Labels */}
        {threadLabels.length > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              flexShrink: 0,
            }}
          >
            {threadLabels.slice(0, 1).map((label) => (
              <LabelChip key={label.id} label={label} />
            ))}
          </div>
        )}

        {/* Attachment indicator */}
        {thread.hasAttachments && (
          <Paperclip
            size={12}
            style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }}
          />
        )}

        {/* Date / Quick actions */}
        <div style={{ position: 'relative', flexShrink: 0, height: 22, display: 'flex', alignItems: 'center' }}>
          <span
            style={{
              fontSize: '11px',
              color: isUnread ? 'var(--color-accent-primary)' : 'var(--color-text-tertiary)',
              whiteSpace: 'nowrap',
              opacity: isHovered ? 0 : 1,
              transition: 'opacity var(--transition-normal)',
            }}
          >
            {formatRelativeTime(thread.lastMessageAt, i18n.language)}
          </span>
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '1px',
              opacity: isHovered ? 1 : 0,
              pointerEvents: isHovered ? 'auto' : 'none',
              transition: 'opacity var(--transition-normal)',
            }}
          >
            <IconButton
              icon={<Reply size={13} />}
              label={t('compose.reply')}
              tooltipSide="top"
              size={22}
              pressEffect
              onClick={(e) => { e.stopPropagation(); onReplyClick?.(); }}
            />
            <IconButton
              icon={<Archive size={13} />}
              label={t('email.archive')}
              tooltipSide="top"
              size={22}
              pressEffect
              onClick={(e) => { e.stopPropagation(); onArchiveClick?.(); }}
            />
            <IconButton
              icon={<Trash2 size={13} />}
              label={t('email.trash')}
              tooltipSide="top"
              size={22}
              destructive
              pressEffect
              onClick={(e) => { e.stopPropagation(); onTrashClick?.(); }}
            />
          </div>
        </div>

        {/* Star */}
        <StarButton
          isStarred={thread.isStarred}
          isHovered={isHovered}
          starAnimating={starAnimating}
          onStarClick={onStarClick}
          t={t}
          size={13}
        />
      </div>
    );
  }

  // ---- Default: vertical card layout (right pane / hidden) ----
  return (
    <div
      role="option"
      aria-selected={isSelected || isMultiSelected}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--spacing-sm)',
        padding: 'var(--email-list-padding, 10px 16px)',
        height: 'var(--email-list-item-height, 84px)',
        background,
        cursor: 'pointer',
        borderBottom: '1px solid var(--color-border-secondary)',
        animation: isNew ? 'atlasmail-new-email-enter 400ms ease both' : undefined,
        boxSizing: 'border-box',
        transition: 'background var(--transition-normal)',
        userSelect: 'none',
      }}
    >
      {/* Unread indicator / Checkbox */}
      <UnreadOrCheckbox
        isUnread={isUnread}
        isMultiSelected={isMultiSelected}
        showCheckbox={showCheckbox}
        onCheckboxClick={onCheckboxClick}
        t={t}
      />

      {/* Avatar */}
      <Avatar name={senderName} email={senderEmail} size={32} />

      {/* Content */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
          overflow: 'hidden',
        }}
      >
        {/* Top row: sender + timestamp/actions */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--spacing-sm)',
          }}
        >
          <span
            style={{
              fontSize: 'var(--font-size-md)',
              fontWeight: isUnread
                ? ('var(--font-weight-semibold)' as CSSProperties['fontWeight'])
                : ('var(--font-weight-normal)' as CSSProperties['fontWeight']),
              color: isUnread ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
              minWidth: 0,
            }}
          >
            {senderName}
            {thread.messageCount > 1 && (
              <span
                style={{
                  marginLeft: 'var(--spacing-xs)',
                  fontSize: 'var(--font-size-sm)',
                  color: 'var(--color-text-tertiary)',
                  fontWeight: 'var(--font-weight-normal)' as CSSProperties['fontWeight'],
                }}
              >
                {thread.messageCount}
              </span>
            )}
          </span>

          {/* Right side of top row: quick actions + timestamp stacked, swap visibility on hover */}
          <div style={{ position: 'relative', flexShrink: 0, height: 28, display: 'flex', alignItems: 'center' }}>
            {/* Timestamp — hidden on hover */}
            <span
              style={{
                fontSize: 'var(--font-size-xs)',
                color: isUnread ? 'var(--color-accent-primary)' : 'var(--color-text-tertiary)',
                whiteSpace: 'nowrap',
                opacity: isHovered ? 0 : 1,
                transition: 'opacity var(--transition-normal)',
              }}
            >
              {formatRelativeTime(thread.lastMessageAt, i18n.language)}
            </span>
            {/* Quick actions — shown on hover, positioned on top of timestamp */}
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '2px',
                opacity: isHovered ? 1 : 0,
                pointerEvents: isHovered ? 'auto' : 'none',
                transition: 'opacity var(--transition-normal)',
              }}
            >
              <IconButton
                icon={<Reply size={14} />}
                label={t('compose.reply')}
                tooltipSide="top"
                pressEffect
                onClick={(e) => { e.stopPropagation(); onReplyClick?.(); }}
              />
              <IconButton
                icon={<Archive size={14} />}
                label={t('email.archive')}
                tooltipSide="top"
                pressEffect
                onClick={(e) => { e.stopPropagation(); onArchiveClick?.(); }}
              />
              <IconButton
                icon={<Trash2 size={14} />}
                label={t('email.trash')}
                tooltipSide="top"
                destructive
                pressEffect
                onClick={(e) => { e.stopPropagation(); onTrashClick?.(); }}
              />
              <SnoozePopover
                threadId={thread.id}
                onSnooze={(threadId, snoozeUntil) => onSnooze?.(threadId, snoozeUntil)}
              >
                <IconButton
                  icon={<Clock size={14} />}
                  label={t('email.snooze')}
                  tooltip={false}
                  onClick={(e) => e.stopPropagation()}
                />
              </SnoozePopover>
            </div>
          </div>
        </div>

        {/* Subject + labels */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-sm)',
            overflow: 'hidden',
          }}
        >
          <span
            style={{
              fontSize: 'var(--font-size-md)',
              color: isUnread ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              fontWeight: isUnread
                ? ('var(--font-weight-medium)' as CSSProperties['fontWeight'])
                : ('var(--font-weight-normal)' as CSSProperties['fontWeight']),
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
              minWidth: 0,
            }}
          >
            {thread.subject || t('common.noSubject')}
          </span>
          {threadLabels.length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                flexShrink: 0,
              }}
            >
              {threadLabels.slice(0, 2).map((label) => (
                <LabelChip key={label.id} label={label} />
              ))}
            </div>
          )}
        </div>

        {/* Snippet */}
        <span
          style={{
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-tertiary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {thread.snippet || ''}
        </span>
      </div>

      {/* Star — always visible on the right edge */}
      <StarButton
        isStarred={thread.isStarred}
        isHovered={isHovered}
        starAnimating={starAnimating}
        onStarClick={onStarClick}
        t={t}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

function UnreadOrCheckbox({
  isUnread,
  isMultiSelected,
  showCheckbox,
  onCheckboxClick,
  t,
}: {
  isUnread: boolean;
  isMultiSelected: boolean;
  showCheckbox: boolean;
  onCheckboxClick?: (e: React.MouseEvent) => void;
  t: (key: string) => string;
}) {
  return (
    <div
      style={{
        width: 16,
        height: 16,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {showCheckbox ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCheckboxClick?.(e);
          }}
          aria-label={isMultiSelected ? t('email.deselectConversation') : t('email.selectConversation')}
          aria-pressed={isMultiSelected}
          style={{
            width: 16,
            height: 16,
            border: isMultiSelected
              ? 'none'
              : '1.5px solid var(--color-border-primary)',
            borderRadius: 4,
            background: isMultiSelected ? 'var(--color-accent-primary)' : 'transparent',
            cursor: 'pointer',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'background var(--transition-normal), border-color var(--transition-normal)',
          }}
          onMouseEnter={(e) => {
            if (!isMultiSelected) {
              e.currentTarget.style.borderColor = 'var(--color-accent-primary)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isMultiSelected) {
              e.currentTarget.style.borderColor = 'var(--color-border-primary)';
            }
          }}
        >
          {isMultiSelected && <Check size={10} color="#ffffff" strokeWidth={3} />}
        </button>
      ) : (
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: isUnread ? 'var(--color-unread-indicator)' : 'transparent',
            transition: 'background var(--transition-normal)',
          }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

function StarButton({
  isStarred,
  isHovered,
  starAnimating,
  onStarClick,
  t,
  size = 15,
}: {
  isStarred: boolean;
  isHovered: boolean;
  starAnimating: boolean;
  onStarClick?: (e: React.MouseEvent) => void;
  t: (key: string) => string;
  size?: number;
}) {
  return (
    <Tooltip content={isStarred ? t('email.unstar') : t('email.star')} side="left">
      <button
        onClick={(e) => {
          e.stopPropagation();
          onStarClick?.(e);
        }}
        aria-label={isStarred ? t('email.unstar') : t('email.star')}
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: 'var(--spacing-xs)',
          borderRadius: 'var(--radius-sm)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          color: isStarred ? 'var(--color-star)' : 'var(--color-text-tertiary)',
          opacity: isStarred ? 1 : isHovered ? 0.6 : 0,
          transition: 'color var(--transition-normal), opacity var(--transition-normal)',
          animation: starAnimating ? 'atlasmail-star-pop 500ms ease' : undefined,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = '1';
          if (!isStarred) {
            e.currentTarget.style.color = 'var(--color-star)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isStarred) {
            e.currentTarget.style.opacity = isHovered ? '0.6' : '0';
            e.currentTarget.style.color = 'var(--color-text-tertiary)';
          }
        }}
      >
        <Star
          size={size}
          fill={isStarred ? 'var(--color-star)' : 'none'}
        />
      </button>
    </Tooltip>
  );
}
