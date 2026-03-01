import React from 'react';
import { Bell } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '../ui/popover';
import {
  useNotifications,
  useUnreadNotificationCount,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from '../../hooks/use-notifications';
import { useNavigate } from 'react-router-dom';
import type { Notification } from '@atlasmail/shared';

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
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function getNotificationPath(n: Notification): string | null {
  if (!n.sourceType || !n.sourceId) return null;
  const paths: Record<string, string> = {
    event: '/calendar',
    task: '/tasks',
    document: `/docs/${n.sourceId}`,
  };
  return paths[n.sourceType] || null;
}

export function NotificationCenter() {
  const { data: notifications = [] } = useNotifications();
  const { data: unreadData } = useUnreadNotificationCount();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const navigate = useNavigate();
  const unreadCount = unreadData?.count ?? 0;

  const handleClick = (n: Notification) => {
    if (!n.isRead) {
      markRead.mutate(n.id);
    }
    const path = getNotificationPath(n);
    if (path) navigate(path);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="relative p-1.5 rounded-md hover:bg-gray-100 transition-colors cursor-pointer">
          <Bell className="w-4 h-4 text-gray-500" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 max-h-[400px] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
          <span className="text-sm font-semibold text-gray-900">Notifications</span>
          {unreadCount > 0 && (
            <button
              onClick={() => markAllRead.mutate()}
              className="text-xs text-blue-600 hover:text-blue-700 cursor-pointer"
            >
              Mark all as read
            </button>
          )}
        </div>
        <div className="overflow-y-auto flex-1">
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-400">
              No notifications yet
            </div>
          ) : (
            notifications.map((n: Notification) => (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className={`w-full text-left px-3 py-2.5 border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer ${
                  !n.isRead ? 'bg-blue-50/50' : ''
                }`}
              >
                <div className="flex items-start gap-2">
                  {!n.isRead && (
                    <span className="mt-1.5 w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                  )}
                  <div className={`min-w-0 flex-1 ${n.isRead ? 'ml-4' : ''}`}>
                    <div className="text-sm text-gray-900 font-medium truncate">{n.title}</div>
                    {n.body && (
                      <div className="text-xs text-gray-500 truncate mt-0.5">{n.body}</div>
                    )}
                    <div className="text-[10px] text-gray-400 mt-1">{getRelativeTime(n.createdAt)}</div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
