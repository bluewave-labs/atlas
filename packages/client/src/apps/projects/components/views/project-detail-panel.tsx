import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDate, formatCurrency, formatNumber } from '../../../../lib/format';
import {
  Clock, Users, X, Trash2, Pencil, Check,
} from 'lucide-react';
import {
  useDeleteProject, useUpdateProject, useTimeEntries, useUpdateTimeEntry, useDeleteTimeEntry,
  type Project, type TimeEntry,
} from '../../hooks';
import { IconButton } from '../../../../components/ui/icon-button';
import { Badge } from '../../../../components/ui/badge';
import { StatusDot } from '../../../../components/ui/status-dot';
import { Input } from '../../../../components/ui/input';
import { Select } from '../../../../components/ui/select';
import { SmartButtonBar } from '../../../../components/shared/SmartButtonBar';
import { CustomFieldsRenderer } from '../../../../components/shared/custom-fields-renderer';
import { ConfirmDialog } from '../../../../components/ui/confirm-dialog';
import { useToastStore } from '../../../../stores/toast-store';
import { useAppActions } from '../../../../hooks/use-app-permissions';
import { useAuthStore } from '../../../../stores/auth-store';

export function ProjectDetailPanel({ project, onClose }: { project: Project; onClose: () => void }) {
  const { t } = useTranslation();
  const { canDelete: isAdmin, canEdit } = useAppActions('projects');
  const currentUserId = useAuthStore((s) => s.account?.userId ?? null);
  const deleteProject = useDeleteProject();
  const updateProject = useUpdateProject();
  const updateTimeEntry = useUpdateTimeEntry();
  const deleteTimeEntry = useDeleteTimeEntry();
  const { addToast } = useToastStore();
  const { data: timeData } = useTimeEntries({ projectId: project.id });
  const recentEntries = (timeData?.entries ?? []).slice(0, 5);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editHours, setEditHours] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [confirmDeleteEntryId, setConfirmDeleteEntryId] = useState<string | null>(null);

  const handleStartEdit = (entry: TimeEntry) => {
    setEditingEntryId(entry.id);
    setEditHours(String(entry.hours));
    setEditDescription(entry.description || '');
  };

  const handleSaveEdit = (entryId: string) => {
    updateTimeEntry.mutate({ id: entryId, hours: parseFloat(editHours) || 0, description: editDescription.trim() || null }, {
      onSuccess: () => { setEditingEntryId(null); addToast({ type: 'success', message: t('projects.timeTracking.saved') }); },
    });
  };

  const handleDeleteEntry = (entryId: string) => {
    deleteTimeEntry.mutate(entryId, {
      onSuccess: () => { setConfirmDeleteEntryId(null); addToast({ type: 'success', message: t('projects.timeTracking.deleteEntry') }); },
    });
  };

  const hoursPct = project.budgetHours ? Math.min((project.totalHours / project.budgetHours) * 100, 100) : 0;
  const amountPct = project.budgetAmount ? Math.min((project.totalAmount / project.budgetAmount) * 100, 100) : 0;

  return (
    <div className="projects-detail-panel">
      <div style={{ padding: '12px var(--spacing-lg)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-secondary)', flexShrink: 0 }}>
        <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'var(--font-family)' }}>
          {t('projects.projects.projectDetail')}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {isAdmin && (
            <IconButton icon={<Trash2 size={14} />} label={t('projects.actions.delete')} size={28} destructive onClick={() => { deleteProject.mutate(project.id); onClose(); }} />
          )}
          <IconButton icon={<X size={14} />} label={t('common.close')} size={28} onClick={onClose} />
        </div>
      </div>
      <SmartButtonBar appId="projects" recordId={project.id} />
      <div className="projects-detail-body">
        <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
          <StatusDot color={project.color} size={10} />
          {project.name}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
          {/* Status + company */}
          <div style={{ display: 'flex', gap: 'var(--spacing-md)', alignItems: 'center' }}>
            <Badge variant={project.status === 'active' ? 'success' : project.status === 'paused' ? 'warning' : project.status === 'completed' ? 'primary' : 'default'}>
              {t(`projects.status.${project.status}`)}
            </Badge>
            {project.companyName && (
              <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
                <Users size={13} style={{ color: 'var(--color-text-tertiary)' }} />
                {project.companyName}
              </span>
            )}
          </div>

          {/* Status selector */}
          {canEdit && (
            <div className="projects-detail-field">
              <span className="projects-detail-field-label">{t('projects.projects.status')}</span>
              <Select
                value={project.status}
                onChange={(v) => updateProject.mutate({ id: project.id, status: v })}
                options={[
                  { value: 'active', label: t('projects.status.active') },
                  { value: 'paused', label: t('projects.status.paused') },
                  { value: 'completed', label: t('projects.status.completed') },
                  { value: 'archived', label: t('projects.status.archived') },
                ]}
                size="sm"
              />
            </div>
          )}

          {/* Budget section - hours */}
          <div className="projects-detail-field">
            <span className="projects-detail-field-label">{t('projects.dashboard.budgetHours')}</span>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)', fontVariantNumeric: 'tabular-nums' }}>
              {formatNumber(project.totalHours, 1)}h{project.budgetHours ? ` / ${formatNumber(project.budgetHours, 0)}h` : ''}
            </div>
            {project.budgetHours && (
              <div style={{ height: 6, background: 'var(--color-bg-tertiary)', borderRadius: 3, overflow: 'hidden', marginTop: 'var(--spacing-xs)' }}>
                <div style={{ height: '100%', width: `${hoursPct}%`, background: hoursPct > 90 ? 'var(--color-error)' : hoursPct > 70 ? 'var(--color-warning)' : 'var(--color-success)', borderRadius: 3, transition: 'width 0.3s' }} />
              </div>
            )}
          </div>

          {/* Budget section - amount */}
          {project.budgetAmount != null && (
            <div className="projects-detail-field">
              <span className="projects-detail-field-label">{t('projects.dashboard.budgetAmount')}</span>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)', fontVariantNumeric: 'tabular-nums' }}>
                {formatCurrency(project.totalAmount)} / {formatCurrency(project.budgetAmount)}
              </div>
              <div style={{ height: 6, background: 'var(--color-bg-tertiary)', borderRadius: 3, overflow: 'hidden', marginTop: 'var(--spacing-xs)' }}>
                <div style={{ height: '100%', width: `${amountPct}%`, background: amountPct > 90 ? 'var(--color-error)' : amountPct > 70 ? 'var(--color-warning)' : 'var(--color-success)', borderRadius: 3, transition: 'width 0.3s' }} />
              </div>
            </div>
          )}

          {project.description && (
            <div className="projects-detail-field">
              <span className="projects-detail-field-label">{t('projects.projects.description')}</span>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-family)', lineHeight: 'var(--line-height-normal)' }}>
                {project.description}
              </div>
            </div>
          )}

          <div className="projects-detail-field">
            <span className="projects-detail-field-label">{t('projects.projects.billable')}</span>
            <Badge variant={project.isBillable ? 'success' : 'default'}>
              {project.isBillable ? t('projects.common.yes') : t('projects.common.no')}
            </Badge>
          </div>

          <CustomFieldsRenderer appId="projects" recordType="projects" recordId={project.id} />

          {/* Recent time entries */}
          <div className="projects-detail-field">
            <span className="projects-detail-field-label">{t('projects.dashboard.recentTimeEntries')}</span>
            {recentEntries.length === 0 ? (
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>
                {t('projects.reports.noData')}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 'var(--spacing-xs)' }}>
                {recentEntries.map((entry) => (
                  <div key={entry.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid var(--color-border-secondary)', gap: 'var(--spacing-xs)' }}>
                    {editingEntryId === entry.id ? (
                      <>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
                          <Input
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            placeholder={t('projects.dashboard.noDescription')}
                            size="sm"
                          />
                          <Input
                            type="number"
                            step="0.25"
                            value={editHours}
                            onChange={(e) => setEditHours(e.target.value)}
                            placeholder="0"
                            size="sm"
                            style={{ width: 70 }}
                          />
                        </div>
                        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                          <IconButton icon={<Check size={12} />} label={t('projects.timeTracking.saveEntry')} size={22} onClick={() => handleSaveEdit(entry.id)} />
                          <IconButton icon={<X size={12} />} label={t('projects.actions.cancel')} size={22} onClick={() => setEditingEntryId(null)} />
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {entry.description || t('projects.dashboard.noDescription')}
                          </div>
                          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>
                            {formatDate(entry.date)}
                          </div>
                        </div>
                        <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                          {formatNumber(entry.hours, 1)}h
                        </span>
                        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                          {(isAdmin || (canEdit && entry.userId === currentUserId)) && (
                            <>
                              <IconButton icon={<Pencil size={11} />} label={t('projects.timeTracking.editEntry')} size={20} onClick={() => handleStartEdit(entry)} />
                              <IconButton icon={<Trash2 size={11} />} label={t('projects.timeTracking.deleteEntry')} size={20} destructive onClick={() => setConfirmDeleteEntryId(entry.id)} />
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <ConfirmDialog
            open={!!confirmDeleteEntryId}
            onOpenChange={(open) => { if (!open) setConfirmDeleteEntryId(null); }}
            title={t('projects.timeTracking.deleteEntry')}
            description={t('projects.timeTracking.deleteEntry') + '?'}
            confirmLabel={t('projects.actions.delete')}
            destructive
            onConfirm={() => confirmDeleteEntryId && handleDeleteEntry(confirmDeleteEntryId)}
          />

        </div>
      </div>
    </div>
  );
}
