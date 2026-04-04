import { createElement } from 'react';
import { PhoneCall, Mail, CalendarDays, StickyNote, Target, Trophy, XCircle } from 'lucide-react';

// ─── Activity icon mapping ──────────────────────────────────────

export function getActivityIcon(type: string, size = 14) {
  switch (type) {
    case 'call': return createElement(PhoneCall, { size });
    case 'email': return createElement(Mail, { size });
    case 'meeting': return createElement(CalendarDays, { size });
    case 'stage_change': return createElement(Target, { size });
    case 'deal_won': return createElement(Trophy, { size });
    case 'deal_lost': return createElement(XCircle, { size });
    default: return createElement(StickyNote, { size });
  }
}

// ─── Time ago (compact) ─────────────────────────────────────────

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w`;
}

// ─── Avatar color ───────────────────────────────────────────────

const AVATAR_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#10b981', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#14b8a6'];

export function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
