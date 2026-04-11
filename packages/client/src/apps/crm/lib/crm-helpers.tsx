import {
  StickyNote, PhoneCall, Mail, CalendarDays, Target, Trophy, XCircle,
} from 'lucide-react';
import type { CrmActivity, CrmDeal } from '../hooks';

// ─── Activity type icon mapping ──────────────────────────────────
export const ACTIVITY_TYPE_ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  'sticky-note': StickyNote,
  'phone-call': PhoneCall,
  'mail': Mail,
  'calendar-days': CalendarDays,
  'target': Target,
  'trophy': Trophy,
  'x-circle': XCircle,
};

// ─── Table interaction types ──────────────────────────────────

export interface EditingCell {
  rowId: string;
  column: string;
}

export type SortDirection = 'asc' | 'desc';

export interface SortState {
  column: string;
  direction: SortDirection;
}

// ─── Types ─────────────────────────────────────────────────────────

export type ActiveView = 'dashboard' | 'leads' | 'lead-detail' | 'pipeline' | 'deals' | 'deal-detail' | 'contacts' | 'companies' | 'activities' | 'automations' | 'forecast' | 'leadForms' | 'proposals' | 'proposal-detail';

// ─── Avatar colors ────────────────────────────────────────────────

const AVATAR_COLORS = ['#ef4444','#f97316','#f59e0b','#10b981','#06b6d4','#3b82f6','#6366f1','#8b5cf6','#ec4899','#14b8a6'];
export function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function NameAvatar({ name }: { name: string }) {
  return (
    <span style={{ width: 24, height: 24, borderRadius: '50%', background: getAvatarColor(name), color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, flexShrink: 0 }}>
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

export function CompanyLogo({ domain }: { domain: string | null | undefined }) {
  if (!domain) return null;
  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=16`}
      width={16} height={16}
      style={{ borderRadius: 2, flexShrink: 0 }}
      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
      alt=""
    />
  );
}

// formatDate and formatCurrency are imported from ../../lib/format

export function getActivityIcon(type: string) {
  switch (type) {
    case 'call': return <PhoneCall size={14} />;
    case 'email': return <Mail size={14} />;
    case 'meeting': return <CalendarDays size={14} />;
    case 'stage_change': return <Target size={14} />;
    case 'deal_won': return <Trophy size={14} />;
    case 'deal_lost': return <XCircle size={14} />;
    default: return <StickyNote size={14} />;
  }
}

export function getActivityLabel(type: string, t: (key: string) => string): string {
  switch (type) {
    case 'call': return t('crm.activities.call');
    case 'email': return t('crm.activities.email');
    case 'meeting': return t('crm.activities.meeting');
    case 'stage_change': return t('crm.activities.stageChange');
    case 'deal_won': return t('crm.activities.dealWon');
    case 'deal_lost': return t('crm.activities.dealLost');
    default: return t('crm.activities.note');
  }
}

export type ActivityDueStatus = 'overdue' | 'due-today' | 'due-future' | 'no-date' | 'completed';

export function getActivityDueStatus(activity: CrmActivity): ActivityDueStatus {
  if (activity.completedAt) return 'completed';
  if (!activity.scheduledAt) return 'no-date';
  const now = new Date();
  const due = new Date(activity.scheduledAt);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday.getTime() + 86400000);
  if (due < startOfToday) return 'overdue';
  if (due < endOfToday) return 'due-today';
  return 'due-future';
}

export const DUE_STATUS_COLORS: Record<ActivityDueStatus, string> = {
  'overdue': '#ef4444',
  'due-today': '#f59e0b',
  'due-future': '#10b981',
  'no-date': '#6b7280',
  'completed': '#6b7280',
};

export function getActivityDueLabel(activity: CrmActivity, t: (key: string, opts?: Record<string, unknown>) => string): string | null {
  const status = getActivityDueStatus(activity);
  if (status === 'completed') return null;
  if (status === 'no-date') return null;
  if (status === 'overdue') {
    const days = Math.ceil((Date.now() - new Date(activity.scheduledAt!).getTime()) / 86400000);
    return t('crm.activities.overdueBy', { days });
  }
  if (status === 'due-today') return t('crm.activities.dueToday');
  const due = new Date(activity.scheduledAt!);
  return t('crm.activities.dueDate') + ': ' + due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function getDealRottingInfo(deal: CrmDeal): { isRotting: boolean; daysInStage: number; rottingDays: number | null } {
  const rottingDays = deal.stageRottingDays ?? null;
  if (!rottingDays || !deal.stageEnteredAt) return { isRotting: false, daysInStage: 0, rottingDays };
  const daysInStage = Math.floor((Date.now() - new Date(deal.stageEnteredAt).getTime()) / 86400000);
  return { isRotting: daysInStage > rottingDays, daysInStage, rottingDays };
}
