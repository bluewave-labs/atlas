import { useState } from 'react';
import { ChevronDown, CheckCircle2, Moon, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Task, TaskProject, TaskWhen, TenantUser } from '@atlasmail/shared';
import type { NavSection } from '../lib/constants';
import { TaskItem } from './task-item';
import { CollapsibleSection } from './collapsible-section';
import { HeadingRow } from './heading-row';
import { NewTaskCreator } from './new-task-creator';
import { QuickCaptureInput } from './quick-capture-input';
import { NewHeadingCreator } from './new-heading-creator';
import { ProjectHeader } from './project-header';
import { TasksEmptyState } from './empty-state';
import { useTasksSettingsStore } from '../settings-store';
import type { Inbox } from 'lucide-react';

export function TaskListView({
  activeSection,
  displayTasks,
  completedTasks,
  todayTasks,
  projectTaskGroups,
  inboxGroups,
  activeProject,
  projects,
  tenantMembers,
  defaultWhen,
  projectIdForNew,
  isLoading,
  seeding,
  canCreate,
  selectedTaskId,
  showWhenBadges,
  showProjectInList,
  showDueDateInList,
  draggedTaskId,
  dropTargetId,
  selectedIds,
  blockedTaskIdSet,
  onSelectTask,
  onComplete,
  onTitleSave,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onToggleSelectOne,
  onDeleteHeading,
  onSeed,
  renderTaskItem,
}: {
  activeSection: NavSection;
  displayTasks: Task[];
  completedTasks: Task[];
  todayTasks: { daytime: Task[]; evening: Task[] } | null;
  projectTaskGroups: { heading: Task | null; tasks: Task[] }[] | null;
  inboxGroups: { label: string; icon: typeof Inbox; color: string; tasks: Task[]; noHeader?: boolean }[] | null;
  activeProject: TaskProject | null;
  projects: TaskProject[];
  tenantMembers?: TenantUser[];
  defaultWhen: TaskWhen;
  projectIdForNew: string | null;
  isLoading: boolean;
  seeding: boolean;
  canCreate: boolean;
  selectedTaskId: string | null;
  showWhenBadges: boolean;
  showProjectInList: boolean;
  showDueDateInList: boolean;
  draggedTaskId: string | null;
  dropTargetId: string | null;
  selectedIds: Set<string>;
  blockedTaskIdSet: Set<string>;
  onSelectTask: (id: string) => void;
  onComplete: (id: string) => void;
  onTitleSave: (id: string, title: string) => void;
  onDragStart: (e: React.DragEvent, taskId: string) => void;
  onDragOver: (e: React.DragEvent, taskId: string) => void;
  onDrop: (e: React.DragEvent, taskId: string) => void;
  onDragEnd: () => void;
  onToggleSelectOne: (taskId: string) => void;
  onDeleteHeading: (headingId: string) => void;
  onSeed: () => void;
  renderTaskItem: (task: Task) => React.ReactNode;
}) {
  const { t } = useTranslation();
  const tasksSettings = useTasksSettingsStore();
  const [collapsedHeadings, setCollapsedHeadings] = useState<Set<string>>(new Set());
  const [completedCollapsed, setCompletedCollapsed] = useState(true);

  return (
    <div className={`tasks-list-container task-list-scroll${tasksSettings.compactMode ? ' compact' : ''}`}>
      {activeProject && <ProjectHeader project={activeProject} />}

      {todayTasks ? (
        <>
          {canCreate && <NewTaskCreator defaultWhen="today" projectId={projectIdForNew} />}
          {todayTasks.daytime.length > 0 && (
            <CollapsibleSection label={t('tasks.todayLabel')} icon={Sun} color="#d97706" count={todayTasks.daytime.length}>
              {todayTasks.daytime.map(renderTaskItem)}
              {canCreate && <QuickCaptureInput defaultWhen="today" projectId={projectIdForNew} />}
            </CollapsibleSection>
          )}
          {todayTasks.evening.length > 0 && (
            <CollapsibleSection label={t('tasks.thisEvening')} icon={Moon} color="#6366f1" count={todayTasks.evening.length}>
              {todayTasks.evening.map(renderTaskItem)}
              {canCreate && <QuickCaptureInput defaultWhen="evening" projectId={projectIdForNew} />}
            </CollapsibleSection>
          )}
          {todayTasks.daytime.length === 0 && todayTasks.evening.length === 0 && !isLoading && (
            <TasksEmptyState section={activeSection} seeding={seeding} onSeed={onSeed} />
          )}
        </>
      ) : projectTaskGroups ? (
        <>
          {canCreate && <NewTaskCreator defaultWhen={defaultWhen} projectId={projectIdForNew} />}
          {projectTaskGroups.map((group, idx) => (
            <div key={group.heading?.id || `ungrouped-${idx}`}>
              {group.heading && (
                <HeadingRow
                  task={group.heading}
                  childCount={group.tasks.length}
                  isCollapsed={collapsedHeadings.has(group.heading.id)}
                  onToggle={() => {
                    setCollapsedHeadings(prev => {
                      const next = new Set(prev);
                      if (next.has(group.heading!.id)) next.delete(group.heading!.id);
                      else next.add(group.heading!.id);
                      return next;
                    });
                  }}
                  onDelete={() => onDeleteHeading(group.heading!.id)}
                />
              )}
              {(!group.heading || !collapsedHeadings.has(group.heading.id)) && (
                <>
                  {group.tasks.map(renderTaskItem)}
                  {canCreate && (
                    <QuickCaptureInput
                      defaultWhen={defaultWhen}
                      projectId={projectIdForNew}
                      headingId={group.heading?.id ?? null}
                    />
                  )}
                </>
              )}
            </div>
          ))}
          {canCreate && projectIdForNew && <NewHeadingCreator projectId={projectIdForNew} />}
          {displayTasks.filter(t => t.type !== 'heading').length === 0 && !isLoading && (
            <TasksEmptyState section={activeSection} seeding={seeding} onSeed={onSeed} />
          )}
        </>
      ) : inboxGroups ? (
        <>
          {canCreate && <NewTaskCreator defaultWhen={defaultWhen} projectId={projectIdForNew} />}
          {inboxGroups.map((group) => (
            group.noHeader ? (
              <div key={group.label}>
                {group.tasks.map(renderTaskItem)}
                {canCreate && <QuickCaptureInput defaultWhen="inbox" projectId={projectIdForNew} />}
              </div>
            ) : (
              <CollapsibleSection
                key={group.label}
                label={group.label}
                icon={group.icon}
                color={group.color}
                count={group.tasks.length}
              >
                {group.tasks.map(renderTaskItem)}
              </CollapsibleSection>
            )
          ))}
          {displayTasks.length === 0 && !isLoading && (
            <TasksEmptyState section={activeSection} seeding={seeding} onSeed={onSeed} />
          )}
        </>
      ) : (
        <>
          {canCreate && activeSection !== 'logbook' && activeSection !== 'upcoming' && (
            <NewTaskCreator defaultWhen={defaultWhen} projectId={projectIdForNew} />
          )}
          {displayTasks.map(renderTaskItem)}
          {canCreate && activeSection !== 'logbook' && activeSection !== 'upcoming' && displayTasks.length > 0 && (
            <QuickCaptureInput defaultWhen={defaultWhen} projectId={projectIdForNew} />
          )}
          {displayTasks.length === 0 && !isLoading && (
            <TasksEmptyState section={activeSection} seeding={seeding} onSeed={onSeed} />
          )}
        </>
      )}

      {/* Completed section at bottom */}
      {completedTasks.length > 0 && activeSection !== 'logbook' && (
        <div className="task-completed-section">
          <button
            className="task-completed-section-header"
            onClick={() => setCompletedCollapsed(!completedCollapsed)}
          >
            <ChevronDown size={13} className={`task-section-chevron${completedCollapsed ? ' collapsed' : ''}`} />
            <CheckCircle2 size={13} />
            <span>{t('tasks.completed')}</span>
            <span className="task-section-count">{completedTasks.length}</span>
          </button>
          {!completedCollapsed && completedTasks.map(renderTaskItem)}
        </div>
      )}
    </div>
  );
}
