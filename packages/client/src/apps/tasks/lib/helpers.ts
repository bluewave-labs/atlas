import { formatDate as formatDateGlobal } from '../../../lib/format';

export function getTodayStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function isToday(dateStr: string): boolean {
  return dateStr.slice(0, 10) === getTodayStr();
}

export function isOverdue(dateStr: string): boolean {
  return dateStr.slice(0, 10) < getTodayStr();
}

export function formatDueDate(dateStr: string, t?: (key: string, opts?: Record<string, unknown>) => string): string {
  const dd = dateStr.slice(0, 10);
  const todayStr = getTodayStr();
  if (dd === todayStr) return t ? t('tasks.todayLabel') : 'Today';

  // Use local date parts to avoid timezone issues
  const [y, m, d] = dd.split('-').map(Number);
  const dueLocal = new Date(y, m - 1, d);
  const now = new Date();
  const todayLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((dueLocal.getTime() - todayLocal.getTime()) / (1000 * 60 * 60 * 24));

  if (diff === 1) return t ? t('tasks.tomorrowLabel') : 'Tomorrow';
  if (diff === -1) return t ? t('tasks.yesterdayLabel') : 'Yesterday';
  if (diff < -1) return t ? t('tasks.daysOverdue', { count: Math.abs(diff) }) : `${Math.abs(diff)}d overdue`;
  if (diff <= 7) return dueLocal.toLocaleDateString([], { weekday: 'short' });
  return formatDateGlobal(dueLocal);
}

export function getDueBadgeClass(dateStr: string): string {
  if (isOverdue(dateStr)) return 'task-due-badge overdue';
  if (isToday(dateStr)) return 'task-due-badge today';
  return 'task-due-badge upcoming';
}

export function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || (el as HTMLElement).isContentEditable;
}
