import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDate } from '../../../lib/format';
import { Check, Pencil, Trash2 } from 'lucide-react';
import {
  useUpdateActivity, useDeleteActivity, useCompleteActivity,
  type CrmActivity,
} from '../hooks';
import {
  getActivityIcon, getActivityLabel,
  getActivityDueStatus, getActivityDueLabel,
  DUE_STATUS_COLORS,
} from '../lib/crm-helpers';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Select } from '../../../components/ui/select';
import { IconButton } from '../../../components/ui/icon-button';
import { Popover, PopoverTrigger, PopoverContent } from '../../../components/ui/popover';
import { translateActivityBody } from '../lib/workflow-i18n';

export function ActivityTimeline({ activities }: { activities: CrmActivity[] }) {
  const { t } = useTranslation();
  const updateActivity = useUpdateActivity();
  const deleteActivity = useDeleteActivity();
  const completeActivity = useCompleteActivity();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editType, setEditType] = useState('');
  const [editBody, setEditBody] = useState('');
  const [scheduleNextId, setScheduleNextId] = useState<string | null>(null);
  const [nextType, setNextType] = useState('call');
  const [nextDate, setNextDate] = useState('');
  const [nextNote, setNextNote] = useState('');

  const startEdit = (activity: CrmActivity) => {
    setEditingId(activity.id);
    setEditType(activity.type);
    setEditBody(translateActivityBody(activity.body, t));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditType('');
    setEditBody('');
  };

  const saveEdit = () => {
    if (!editingId || !editBody.trim()) return;
    updateActivity.mutate({ id: editingId, type: editType, body: editBody.trim() }, {
      onSuccess: () => cancelEdit(),
    });
  };

  const handleMarkDone = (activityId: string) => {
    setScheduleNextId(activityId);
    setNextType('call');
    setNextDate('');
    setNextNote('');
  };

  const handleScheduleNext = () => {
    if (!scheduleNextId || !nextDate) return;
    completeActivity.mutate({
      id: scheduleNextId,
      scheduleNext: { type: nextType, body: nextNote.trim() || undefined, scheduledAt: new Date(nextDate).toISOString() },
    }, { onSuccess: () => setScheduleNextId(null) });
  };

  const handleSkipSchedule = () => {
    if (!scheduleNextId) return;
    completeActivity.mutate({ id: scheduleNextId }, { onSuccess: () => setScheduleNextId(null) });
  };

  const setQuickDate = (daysFromNow: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysFromNow);
    setNextDate(d.toISOString().split('T')[0]);
  };

  if (activities.length === 0) {
    return (
      <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)', padding: 'var(--spacing-sm) 0' }}>
        {t('crm.activities.noActivities')}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {activities.slice(0, 10).map((activity) => (
        <div key={activity.id} className="crm-activity-item" style={{ position: 'relative' }}>
          <div className="crm-activity-icon">
            {getActivityIcon(activity.type)}
          </div>
          {editingId === activity.id ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
              <Select
                value={editType}
                onChange={setEditType}
                options={[
                  { value: 'note', label: t('crm.activities.note') },
                  { value: 'call', label: t('crm.activities.call') },
                  { value: 'email', label: t('crm.activities.email') },
                  { value: 'meeting', label: t('crm.activities.meeting') },
                ]}
                size="sm"
              />
              <Input value={editBody} onChange={(e) => setEditBody(e.target.value)} size="sm" autoFocus />
              <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
                <Button variant="primary" size="sm" onClick={saveEdit} disabled={!editBody.trim()}>{t('crm.actions.save')}</Button>
                <Button variant="ghost" size="sm" onClick={cancelEdit}>{t('crm.actions.cancel')}</Button>
              </div>
            </div>
          ) : (
            <div className="crm-activity-body" style={{ flex: 1 }}>
              <div className="crm-activity-text" style={activity.completedAt ? { textDecoration: 'line-through', opacity: 0.6 } : undefined}>{translateActivityBody(activity.body, t)}</div>
              <div className="crm-activity-meta" style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', flexWrap: 'wrap' }}>
                <span>{getActivityLabel(activity.type, t)} &middot; {formatDate(activity.createdAt)}{activity.assignedUserName ? ` · ${activity.assignedUserName}` : ''}</span>
                {(() => {
                  const dueStatus = getActivityDueStatus(activity);
                  const dueLabel = getActivityDueLabel(activity, t);
                  if (!dueLabel) return null;
                  return (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 'var(--font-size-xs)', color: DUE_STATUS_COLORS[dueStatus], fontWeight: 'var(--font-weight-medium)' }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: DUE_STATUS_COLORS[dueStatus], flexShrink: 0 }} />
                      {dueLabel}
                    </span>
                  );
                })()}
                {activity.completedAt && (
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
                    &middot; {t('crm.activities.completedOn', { date: formatDate(activity.completedAt) })}
                  </span>
                )}
              </div>
            </div>
          )}
          {editingId !== activity.id && (
            <div style={{ display: 'flex', gap: 2, flexShrink: 0, alignItems: 'center' }}>
              {!activity.completedAt && (
                <Popover open={scheduleNextId === activity.id} onOpenChange={(o) => { if (!o) setScheduleNextId(null); }}>
                  <PopoverTrigger asChild>
                    <span><IconButton icon={<Check size={12} />} label={t('crm.activities.markDone')} size={24} onClick={() => handleMarkDone(activity.id)} /></span>
                  </PopoverTrigger>
                  <PopoverContent align="end" style={{ width: 280, padding: 'var(--spacing-md)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                    <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
                      {t('crm.activities.scheduleNext')}
                    </div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>
                      {t('crm.activities.scheduleNextSubtitle')}
                    </div>
                    <Select value={nextType} onChange={setNextType} options={[
                      { value: 'call', label: t('crm.activities.call') },
                      { value: 'email', label: t('crm.activities.email') },
                      { value: 'meeting', label: t('crm.activities.meeting') },
                      { value: 'note', label: t('crm.activities.note') },
                    ]} size="sm" />
                    <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
                      <Button variant={nextDate === new Date(Date.now() + 86400000).toISOString().split('T')[0] ? 'primary' : 'secondary'} size="sm" onClick={() => setQuickDate(1)} style={{ flex: 1 }}>{t('crm.activities.tomorrow')}</Button>
                      <Button variant={nextDate === new Date(Date.now() + 604800000).toISOString().split('T')[0] ? 'primary' : 'secondary'} size="sm" onClick={() => setQuickDate(7)} style={{ flex: 1 }}>{t('crm.activities.nextWeek')}</Button>
                    </div>
                    <Input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} size="sm" />
                    <Input value={nextNote} onChange={(e) => setNextNote(e.target.value)} placeholder={t('crm.activities.optionalNote')} size="sm" />
                    <div style={{ display: 'flex', gap: 'var(--spacing-xs)', justifyContent: 'flex-end' }}>
                      <Button variant="ghost" size="sm" onClick={handleSkipSchedule}>{t('crm.activities.skip')}</Button>
                      <Button variant="primary" size="sm" onClick={handleScheduleNext} disabled={!nextDate}>{t('crm.activities.schedule')}</Button>
                    </div>
                  </PopoverContent>
                </Popover>
              )}
              <IconButton icon={<Pencil size={12} />} label={t('crm.activities.editActivity')} size={24} onClick={() => startEdit(activity)} />
              <IconButton icon={<Trash2 size={12} />} label={t('crm.activities.deleteActivity')} size={24} destructive onClick={() => deleteActivity.mutate(activity.id)} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
