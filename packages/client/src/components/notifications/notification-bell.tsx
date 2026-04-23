import { useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bell, X } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '../ui/popover';
import { IconButton } from '../ui/icon-button';
import {
  useNotifications,
  useUnreadCount,
  useMarkRead,
  useMarkAllRead,
  useDismissNotification,
} from '../../hooks/use-notifications';
import { formatRelativeDate } from '../../lib/format';
import { appRegistry } from '../../config/app-registry';

function getRouteForSource(sourceType: string | null): string | null {
  if (!sourceType) return null;
  const app = appRegistry.getAll().find((a) => a.id === sourceType);
  return app?.routes[0]?.path ?? null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NotificationBell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const { data: unreadData } = useUnreadCount();
  const { data: notifData } = useNotifications();
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();
  const dismiss = useDismissNotification();

  const unreadCount = unreadData?.count ?? 0;
  const notifications = notifData?.items ?? [];

  const handleNotificationClick = (notification: (typeof notifications)[0]) => {
    if (!notification.isRead) {
      markRead.mutate(notification.id);
    }
    const route = getRouteForSource(notification.sourceType);
    if (route) {
      setOpen(false);
      navigate(route);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          aria-label={t('notifications.title')}
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            background: 'transparent',
            color: 'var(--color-text-tertiary)',
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'background 0.15s, color 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--color-surface-hover)';
            e.currentTarget.style.color = 'var(--color-text-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--color-text-tertiary)';
          }}
        >
          <Bell size={14} />
          {unreadCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: 2,
                right: 2,
                width: unreadCount > 9 ? 16 : 12,
                height: 12,
                borderRadius: 6,
                background: 'var(--color-error)',
                color: 'var(--color-text-inverse)',
                fontSize: 9,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: 1,
                fontFamily: 'var(--font-family)',
              }}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        width={360}
        align="start"
        sideOffset={8}
        style={{ padding: 0, overflow: 'hidden' }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: '1px solid var(--color-border-primary)',
          }}
        >
          <span
            style={{
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-semibold)' as CSSProperties['fontWeight'],
              color: 'var(--color-text-primary)',
              fontFamily: 'var(--font-family)',
            }}
          >
            {t('notifications.title')}
          </span>
          {unreadCount > 0 && (
            <button
              onClick={() => markAllRead.mutate()}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--color-accent-primary)',
                fontSize: 'var(--font-size-xs)',
                fontFamily: 'var(--font-family)',
                fontWeight: 'var(--font-weight-medium)' as CSSProperties['fontWeight'],
                padding: 0,
              }}
            >
              {t('notifications.markAllRead')}
            </button>
          )}
        </div>

        {/* Notification list */}
        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          {notifications.length === 0 ? (
            <div
              style={{
                padding: '32px 16px',
                textAlign: 'center',
                color: 'var(--color-text-tertiary)',
                fontSize: 'var(--font-size-sm)',
                fontFamily: 'var(--font-family)',
              }}
            >
              {t('notifications.noNotifications')}
            </div>
          ) : (
            <div style={{ padding: '4px 0' }}>
              {notifications.map((n) => {
                const isHovered = hoveredId === n.id;
                const appColor = 'var(--color-accent-primary)';

                return (
                  <div
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    onMouseEnter={() => setHoveredId(n.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      padding: '10px 16px',
                      cursor: 'pointer',
                      transition: 'background 0.1s',
                      background: isHovered
                        ? 'var(--color-surface-hover)'
                        : !n.isRead
                          ? 'color-mix(in srgb, var(--color-accent-primary) 4%, transparent)'
                          : 'transparent',
                    }}
                  >
                    {/* App color dot */}
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: appColor,
                        flexShrink: 0,
                        marginTop: 5,
                      }}
                    />

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 'var(--font-size-sm)',
                          fontFamily: 'var(--font-family)',
                          fontWeight: (n.isRead
                            ? 'var(--font-weight-normal)'
                            : 'var(--font-weight-semibold)') as CSSProperties['fontWeight'],
                          color: 'var(--color-text-primary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {n.title}
                      </div>
                      {n.body && (
                        <div
                          style={{
                            fontSize: 'var(--font-size-xs)',
                            color: 'var(--color-text-secondary)',
                            fontFamily: 'var(--font-family)',
                            marginTop: 2,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {n.body}
                        </div>
                      )}
                      <div
                        style={{
                          fontSize: 'var(--font-size-xs)',
                          color: 'var(--color-text-tertiary)',
                          fontFamily: 'var(--font-family)',
                          marginTop: 2,
                        }}
                      >
                        {formatRelativeDate(n.createdAt)}
                      </div>
                    </div>

                    {/* Dismiss button — visible on hover */}
                    <div
                      style={{
                        flexShrink: 0,
                        opacity: isHovered ? 1 : 0,
                        transition: 'opacity 0.15s',
                      }}
                    >
                      <IconButton
                        icon={<X size={12} />}
                        label="Dismiss"
                        size={22}
                        tooltip={false}
                        onClick={(e) => {
                          e.stopPropagation();
                          dismiss.mutate(n.id);
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
