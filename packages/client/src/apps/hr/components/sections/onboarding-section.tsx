import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Check, Trash2 } from 'lucide-react';
import {
  useOnboardingTasks, useCreateOnboardingTask, useUpdateOnboardingTask, useDeleteOnboardingTask,
  useApplyOnboardingTemplate, useOnboardingTemplates,
  type OnboardingTask,
} from '../../hooks';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Select } from '../../../../components/ui/select';
import { IconButton } from '../../../../components/ui/icon-button';
import { useAppActions } from '../../../../hooks/use-app-permissions';
import { getCategoryBadge } from '../../lib/hr-utils';

export function OnboardingSection({ employeeId }: { employeeId: string }) {
  const { t } = useTranslation();
  const { canCreate, canDelete } = useAppActions('hr');
  const { data: tasks } = useOnboardingTasks(employeeId);
  const { data: templates } = useOnboardingTemplates();
  const createTask = useCreateOnboardingTask();
  const updateTask = useUpdateOnboardingTask();
  const deleteTask = useDeleteOnboardingTask();
  const applyTemplate = useApplyOnboardingTemplate();
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('general');

  const completedCount = tasks?.filter((t) => t.completedAt).length ?? 0;
  const totalCount = tasks?.length ?? 0;
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const handleAddTask = () => {
    if (!newTitle.trim()) return;
    createTask.mutate(
      { employeeId, title: newTitle.trim(), category: newCategory },
      { onSuccess: () => { setNewTitle(''); setShowAddTask(false); } },
    );
  };

  const handleToggleComplete = (task: OnboardingTask) => {
    updateTask.mutate({ taskId: task.id, completed: !task.completedAt });
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-sm)' }}>
        <span className="hr-section-title">{t('hr.onboarding.title')}</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {templates && templates.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => applyTemplate.mutate({ employeeId, templateId: templates[0].id })}
            >
              {t('hr.onboarding.applyTemplate')}
            </Button>
          )}
          <IconButton icon={<Plus size={12} />} label={t('hr.onboarding.addTask')} size={24} onClick={() => setShowAddTask(!showAddTask)} />
        </div>
      </div>

      {/* Progress bar */}
      {totalCount > 0 && (
        <div style={{ marginBottom: 'var(--spacing-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginBottom: 4, fontFamily: 'var(--font-family)' }}>
            <span>{completedCount} / {totalCount} {t('hr.onboarding.completed')}</span>
            <span>{progress}%</span>
          </div>
          <div style={{ height: 4, background: 'var(--color-bg-tertiary)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: 'var(--color-success)', borderRadius: 2, transition: 'width 0.3s' }} />
          </div>
        </div>
      )}

      {showAddTask && (
        <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-sm)', alignItems: 'flex-end' }}>
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder={t('hr.onboarding.taskTitle')}
            size="sm"
            style={{ flex: 1 }}
            onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
          />
          <Select
            value={newCategory}
            onChange={setNewCategory}
            options={[
              { value: 'general', label: t('hr.onboardingCategory.general') },
              { value: 'IT', label: t('hr.onboardingCategory.it') },
              { value: 'HR', label: t('hr.onboardingCategory.hr') },
              { value: 'Team', label: t('hr.onboardingCategory.team') },
              { value: 'Admin', label: t('hr.onboardingCategory.admin') },
            ]}
            size="sm"
          />
          <Button variant="primary" size="sm" onClick={handleAddTask} disabled={!newTitle.trim()}>
            {t('common.save')}
          </Button>
        </div>
      )}

      {(!tasks || tasks.length === 0) ? (
        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>
          {t('hr.onboarding.noTasks')}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {tasks.map((task) => (
            <div key={task.id} style={{
              display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)',
              padding: '6px var(--spacing-sm)', borderRadius: 'var(--radius-sm)',
              background: task.completedAt ? 'var(--color-bg-secondary)' : 'transparent',
              fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family)',
            }}>
              <button
                onClick={() => handleToggleComplete(task)}
                style={{
                  width: 18, height: 18, borderRadius: 'var(--radius-sm)', flexShrink: 0,
                  border: task.completedAt ? 'none' : '2px solid var(--color-border-primary)',
                  background: task.completedAt ? 'var(--color-success)' : 'transparent',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                {task.completedAt && <Check size={12} style={{ color: 'white' }} />}
              </button>
              <span style={{
                flex: 1, color: task.completedAt ? 'var(--color-text-tertiary)' : 'var(--color-text-primary)',
                textDecoration: task.completedAt ? 'line-through' : 'none',
              }}>
                {task.title}
              </span>
              {getCategoryBadge(task.category, t)}
              {canDelete && <IconButton icon={<Trash2 size={12} />} label={t('common.delete')} size={20} destructive onClick={() => deleteTask.mutate(task.id)} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
