import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  Search, Inbox, Star, Calendar, Coffee,
  CircleDot, Moon, X, Trash2,
  LayoutList, LayoutGrid, Table2, User,
  Eye, Users,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  useTaskList, useUpdateTask, useDeleteTask, useBulkDeleteTasks,
  useTaskProjectList, useReorderTasks,
  useBlockedTaskIds, useTaskCounts,
} from '../hooks';
import { queryKeys } from '../../../config/query-keys';
import type { Task, TaskWhen } from '@atlas-platform/shared';
import { isDoneStatus } from '@atlas-platform/shared';
import { ContentArea } from '../../../components/ui/content-area';
import { useTasksSettingsStore } from '../settings-store';
import { useAuthStore } from '../../../stores/auth-store';
import { useAppActions } from '../../../hooks/use-app-permissions';
import { useTenantUsers } from '../../../hooks/use-platform';
import { Button } from '../../../components/ui/button';
import { IconButton } from '../../../components/ui/icon-button';
import { ConfirmDialog } from '../../../components/ui/confirm-dialog';
import { QueryErrorState } from '../../../components/ui/query-error-state';
import { getTodayStr, isInputFocused } from '../lib/helpers';
import { TaskItem } from './task-item';
import { CalendarView } from './calendar-view';
import { TaskDetailPanel } from './task-detail-panel';
import { KanbanBoard } from './kanban-board';
import { TaskListView } from './task-list-view';
import { TaskTableView } from './task-table-view';
import '../../../styles/tasks.css';

export type WorkView = 'my' | 'assigned' | 'created' | 'all' | `project:${string}`;

interface Props {
  view: WorkView;
  title: string;
}

export function WorkTasksView({ view, title }: Props) {
  const { t } = useTranslation();

  const { canCreate, canDelete } = useAppActions('work');

  const { account, tenantId } = useAuthStore();
  const currentUserId = account?.userId;
  const { data: tenantMembers } = useTenantUsers(tenantId ?? undefined);

  const tasksSettings = useTasksSettingsStore();

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'mine' | 'team'>('all');
  const [viewMode, setViewMode] = useState<'list' | 'board' | 'table'>(tasksSettings.viewMode || 'list');
  const canShowBoard = view === 'my';

  useEffect(() => {
    if (!canShowBoard && viewMode === 'board') setViewMode('list');
  }, [canShowBoard, viewMode]);

  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const deleteTaskMutation = useDeleteTask();
  const bulkDeleteMutation = useBulkDeleteTasks();

  useEffect(() => { setSelectedIds(new Set()); }, [view]);

  const { data: counts } = useTaskCounts();
  const { data: projectsData } = useTaskProjectList();
  const { data: blockedTaskIds = [] } = useBlockedTaskIds();
  const projects = projectsData?.projects ?? [];

  // Map work view to API filter params
  const taskFilters = useMemo(() => {
    const base: Parameters<typeof useTaskList>[0] = { status: 'todo' };
    if (view === 'my') {
      return { ...base };
    }
    if (view === 'assigned' && currentUserId) {
      return { ...base, assigneeId: currentUserId };
    }
    if (view === 'created') {
      // No extra filter; tasks are scoped to the user by default on the server
      return { ...base };
    }
    if (view === 'all') {
      return {}; // all tasks regardless of status
    }
    if (view.startsWith('project:')) {
      return { projectId: view.replace('project:', ''), status: 'todo' };
    }
    return base;
  }, [view, currentUserId]);

  const { data: tasksData, isLoading, isError, refetch } = useTaskList(taskFilters);
  const allTasks = tasksData?.tasks ?? [];

  const completedFilters = useMemo(() => {
    if (view === 'all') return null;
    if (view.startsWith('project:')) {
      return { projectId: view.replace('project:', ''), status: 'completed' };
    }
    return { status: 'completed' };
  }, [view]);

  const { data: completedData } = useTaskList(
    completedFilters ?? { status: 'completed' },
    { enabled: completedFilters !== null },
  );
  const completedTasks = completedFilters ? (completedData?.tasks ?? []) : [];

  const displayTasks = useMemo(() => {
    let tasks = allTasks;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      tasks = tasks.filter(t => t.title.toLowerCase().includes(q));
    }
    if (visibilityFilter === 'mine') {
      tasks = tasks.filter(t => t.userId === currentUserId);
    } else if (visibilityFilter === 'team') {
      tasks = tasks.filter(t => t.visibility === 'team' && t.userId !== currentUserId);
    }
    return tasks;
  }, [allTasks, searchQuery, visibilityFilter, currentUserId]);

  const projectTaskGroups = useMemo(() => {
    if (!view.startsWith('project:')) return null;
    const headings = displayTasks.filter(t => t.type === 'heading');
    const regularTasks = displayTasks.filter(t => t.type !== 'heading');
    const ungrouped = regularTasks.filter(t => !t.headingId);
    const groups: { heading: Task | null; tasks: Task[] }[] = [];
    if (ungrouped.length > 0) groups.push({ heading: null, tasks: ungrouped });
    for (const h of headings) {
      groups.push({ heading: h, tasks: regularTasks.filter(t => t.headingId === h.id) });
    }
    return groups;
  }, [view, displayTasks]);

  const inboxGroups = useMemo(() => {
    if (view !== 'my') return null;
    const tasks = displayTasks.filter(t => t.type !== 'heading');
    const todayStr = getTodayStr();
    const overdue: Task[] = [], inbox: Task[] = [], today: Task[] = [];
    const evening: Task[] = [], anytime: Task[] = [], someday: Task[] = [];
    for (const task of tasks) {
      if (task.dueDate && task.dueDate.slice(0, 10) < todayStr) overdue.push(task);
      else if (task.when === 'today') today.push(task);
      else if (task.when === 'evening') evening.push(task);
      else if (task.when === 'anytime') anytime.push(task);
      else if (task.when === 'someday') someday.push(task);
      else inbox.push(task);
    }
    const groups: { label: string; icon: typeof Inbox; color: string; tasks: Task[]; noHeader?: boolean }[] = [];
    overdue.sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));
    if (overdue.length > 0) groups.push({ label: t('tasks.overdue'), icon: Calendar, color: '#ef4444', tasks: overdue });
    if (inbox.length > 0) groups.push({ label: t('tasks.unscheduled'), icon: Inbox, color: '#3b82f6', tasks: inbox, noHeader: true });
    if (today.length > 0) groups.push({ label: t('tasks.todayLabel'), icon: Star, color: '#f59e0b', tasks: today });
    if (evening.length > 0) groups.push({ label: t('tasks.thisEvening'), icon: Moon, color: '#6366f1', tasks: evening });
    if (anytime.length > 0) groups.push({ label: t('tasks.whenOptions.anytime'), icon: CircleDot, color: '#06b6d4', tasks: anytime });
    if (someday.length > 0) groups.push({ label: t('tasks.whenOptions.someday'), icon: Coffee, color: '#a78bfa', tasks: someday });
    return groups;
  }, [view, displayTasks, t]);

  const showWhenBadges = useMemo(() => {
    return view.startsWith('project:') || view === 'all' || view === 'assigned' || view === 'created';
  }, [view]);

  const showProjectInList = tasksSettings.showProjectInList;

  const showDueDateInList = view !== 'my';

  const selectedTask = useMemo(
    () => displayTasks.find(t => t.id === selectedTaskId) ?? null,
    [displayTasks, selectedTaskId],
  );
  const updateTask = useUpdateTask();
  const reorderTasks = useReorderTasks();
  const queryClient = useQueryClient();

  const defaultWhen: TaskWhen = 'inbox';
  const projectIdForNew = view.startsWith('project:') ? view.replace('project:', '') : null;
  const activeProject = projectIdForNew ? projects.find(p => p.id === projectIdForNew) ?? null : null;

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (showSearch) { setShowSearch(false); setSearchQuery(''); }
        else if (selectedTaskId) setSelectedTaskId(null);
      }
      if (e.key === '/' && !isInputFocused()) {
        e.preventDefault();
        setShowSearch(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedTaskId, showSearch]);

  const toggleSelectOne = useCallback((taskId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId); else next.add(taskId);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    const visibleTasks = displayTasks.filter(t => t.type !== 'heading');
    const allSelected = visibleTasks.length > 0 && visibleTasks.every(t => selectedIds.has(t.id));
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(visibleTasks.map(t => t.id)));
  }, [displayTasks, selectedIds]);

  const handleBulkDelete = useCallback(async () => {
    await bulkDeleteMutation.mutateAsync(Array.from(selectedIds));
    setSelectedIds(new Set());
    setShowDeleteConfirm(false);
    setSelectedTaskId(null);
  }, [selectedIds, bulkDeleteMutation]);

  const handleComplete = useCallback((taskId: string) => {
    const task = allTasks.find(t => t.id === taskId) ?? completedTasks.find(t => t.id === taskId);
    updateTask.mutate({ id: taskId, status: task && isDoneStatus(task.status) ? 'todo' : 'completed' });
  }, [updateTask, allTasks, completedTasks]);

  const handleDragStart = useCallback((e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', taskId);
    const taskEl = document.querySelector(`[data-task-id="${taskId}"]`) as HTMLElement | null;
    if (taskEl) {
      const ghost = taskEl.cloneNode(true) as HTMLElement;
      ghost.style.cssText = 'position:absolute;top:-9999px;left:-9999px;border-radius:var(--radius-lg);box-shadow:0 4px 16px rgba(0,0,0,0.15);opacity:0.92;padding:10px 16px;background:var(--color-bg-elevated)';
      ghost.style.width = `${taskEl.offsetWidth}px`;
      document.body.appendChild(ghost);
      const rect = taskEl.getBoundingClientRect();
      e.dataTransfer.setDragImage(ghost, e.clientX - rect.left, e.clientY - rect.top);
      requestAnimationFrame(() => document.body.removeChild(ghost));
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (targetId !== dropTargetId) setDropTargetId(targetId);
  }, [dropTargetId]);

  const handleDrop = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedTaskId || draggedTaskId === targetId) { setDraggedTaskId(null); setDropTargetId(null); return; }
    const currentOrder = displayTasks.filter(t => t.type !== 'heading').map(t => t.id);
    const sourceIdx = currentOrder.indexOf(draggedTaskId);
    const targetIdx = currentOrder.indexOf(targetId);
    if (sourceIdx === -1 || targetIdx === -1) return;
    currentOrder.splice(sourceIdx, 1);
    currentOrder.splice(targetIdx, 0, draggedTaskId);
    reorderTasks.mutate(currentOrder);
    setDraggedTaskId(null);
    setDropTargetId(null);
  }, [draggedTaskId, displayTasks, reorderTasks]);

  const handleDragEnd = useCallback(() => { setDraggedTaskId(null); setDropTargetId(null); }, []);

  const handleDeleteHeading = useCallback((headingId: string) => {
    for (const child of allTasks.filter(t => t.headingId === headingId)) {
      updateTask.mutate({ id: child.id, headingId: null });
    }
    updateTask.mutate({ id: headingId, isArchived: true });
  }, [allTasks, updateTask]);

  const visibleNonHeadingTasks = useMemo(() => displayTasks.filter(t => t.type !== 'heading'), [displayTasks]);
  const allVisibleSelected = visibleNonHeadingTasks.length > 0 && visibleNonHeadingTasks.every(t => selectedIds.has(t.id));
  const someVisibleSelected = selectedIds.size > 0 && !allVisibleSelected;
  const blockedTaskIdSet = useMemo(() => new Set(blockedTaskIds), [blockedTaskIds]);

  const renderTaskItem = useCallback((task: Task) => (
    <TaskItem
      key={task.id}
      task={task}
      isSelected={selectedTaskId === task.id}
      onClick={() => setSelectedTaskId(task.id)}
      onComplete={() => handleComplete(task.id)}
      onTitleSave={(newTitle) => updateTask.mutate({ id: task.id, updatedAt: task.updatedAt, title: newTitle })}
      projects={projects}
      members={tenantMembers}
      showWhenBadge={showWhenBadges}
      showProject={showProjectInList}
      showDueDate={showDueDateInList}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onDragEnd={handleDragEnd}
      isDragging={draggedTaskId === task.id}
      isDropTarget={dropTargetId === task.id && draggedTaskId !== task.id}
      showCheckbox={selectedIds.size > 0}
      isChecked={selectedIds.has(task.id)}
      onCheckToggle={toggleSelectOne}
      isBlocked={blockedTaskIdSet.has(task.id)}
    />
  ), [selectedTaskId, handleComplete, updateTask, projects, tenantMembers, showWhenBadges, showProjectInList, showDueDateInList, handleDragStart, handleDragOver, handleDrop, handleDragEnd, draggedTaskId, dropTargetId, selectedIds, toggleSelectOne, blockedTaskIdSet]);

  // Derive nav-section equivalent for TaskListView
  const activeSection = view === 'my' ? 'inbox' as const
    : view.startsWith('project:') ? view as `project:${string}`
    : 'inbox' as const;

  const _ = counts; // suppress unused warning — counts used for future badge display
  void queryClient;

  if (isError) {
    return (
      <div className="tasks-page">
        <ContentArea title={title}>
          <QueryErrorState onRetry={() => refetch()} />
        </ContentArea>
      </div>
    );
  }

  return (
    <div className="tasks-page">
      <ContentArea
        title={title}
        actions={
          <>
            {displayTasks.length > 0 && <span className="tasks-toolbar-count">{displayTasks.length}</span>}
            <div className="tasks-view-toggle">
              {(['all', 'mine', 'team'] as const).map((f) => (
                <button key={f} className={`tasks-view-toggle-btn${visibilityFilter === f ? ' active' : ''}`}
                  onClick={() => setVisibilityFilter(f)}
                  title={f === 'all' ? t('tasks.filterAll') : f === 'mine' ? t('tasks.filterMine') : t('tasks.filterTeam')}
                >
                  {f === 'all' ? <Eye size={14} /> : f === 'mine' ? <User size={14} /> : <Users size={14} />}
                </button>
              ))}
            </div>
            {visibleNonHeadingTasks.length > 0 && (
              <IconButton
                icon={<span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 14, height: 14 }}>
                  <input type="checkbox" checked={allVisibleSelected}
                    ref={(el) => { if (el) el.indeterminate = someVisibleSelected; }}
                    onChange={() => {}} style={{ cursor: 'pointer', accentColor: 'var(--color-accent-primary)', margin: 0 }} />
                </span>}
                label={allVisibleSelected ? t('tasks.deselectAll') : t('tasks.selectAll')} size={28} onClick={toggleSelectAll}
              />
            )}
            <div className="tasks-view-toggle">
              <button className={`tasks-view-toggle-btn${viewMode === 'list' ? ' active' : ''}`}
                onClick={() => { setViewMode('list'); tasksSettings.setViewMode('list'); }} title={t('tasks.listView')}>
                <LayoutList size={14} />
              </button>
              {canShowBoard && (
                <button className={`tasks-view-toggle-btn${viewMode === 'board' ? ' active' : ''}`}
                  onClick={() => { setViewMode('board'); tasksSettings.setViewMode('board'); }} title={t('tasks.boardView')}>
                  <LayoutGrid size={14} />
                </button>
              )}
              <button className={`tasks-view-toggle-btn${viewMode === 'table' ? ' active' : ''}`}
                onClick={() => { setViewMode('table'); tasksSettings.setViewMode('table'); }} title={t('tasks.tableView')}>
                <Table2 size={14} />
              </button>
            </div>
            {showSearch ? (
              <div className="tasks-search-bar">
                <Search size={13} color="var(--color-text-tertiary)" />
                <input ref={searchInputRef} className="tasks-search-input" value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Escape') { setShowSearch(false); setSearchQuery(''); } }}
                  placeholder={t('tasks.searchPlaceholder')} />
                <IconButton icon={<X size={12} />} label={t('tasks.closeSearch')} size={24} tooltip={false}
                  onClick={() => { setShowSearch(false); setSearchQuery(''); }} />
              </div>
            ) : (
              <IconButton icon={<Search size={15} />} label={t('tasks.searchShortcut')} size={28}
                onClick={() => { setShowSearch(true); setTimeout(() => searchInputRef.current?.focus(), 50); }} />
            )}
          </>
        }
      >
        {selectedIds.size > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', padding: '6px var(--spacing-lg)',
            background: 'var(--color-bg-secondary)', borderBottom: '1px solid var(--color-border-secondary)', flexShrink: 0 }}>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-family)' }}>
              {t('tasks.selected', { count: selectedIds.size })}
            </span>
            {canDelete && <Button variant="danger" size="sm" icon={<Trash2 size={13} />}
              onClick={() => setShowDeleteConfirm(true)}>{t('tasks.bulkDelete')}</Button>}
            <Button variant="ghost" size="sm" icon={<X size={13} />}
              onClick={() => setSelectedIds(new Set())}>{t('common.cancel')}</Button>
          </div>
        )}

        <div className="tasks-content">
          {viewMode === 'table' ? (
            <>
              <TaskTableView
                tasks={displayTasks.filter(task => task.type !== 'heading')}
                projects={projects}
                members={tenantMembers}
                selectedTaskId={selectedTaskId}
                selectedIds={selectedIds}
                onSelectTask={setSelectedTaskId}
                onComplete={handleComplete}
                onCheckToggle={toggleSelectOne}
              />
              {selectedTask && selectedTask.type !== 'heading' && (
                <TaskDetailPanel task={selectedTask} projects={projects} members={tenantMembers} allTasks={allTasks} onClose={() => setSelectedTaskId(null)} />
              )}
            </>
          ) : viewMode === 'board' && canShowBoard ? (
            <>
              <KanbanBoard tasks={displayTasks} projects={projects} onComplete={handleComplete} onSelectTask={(id) => setSelectedTaskId(id)} />
              {selectedTask && selectedTask.type !== 'heading' && (
                <TaskDetailPanel task={selectedTask} projects={projects} members={tenantMembers} allTasks={allTasks} onClose={() => setSelectedTaskId(null)} />
              )}
            </>
          ) : (
            <>
              <TaskListView
                activeSection={activeSection}
                displayTasks={displayTasks}
                completedTasks={completedTasks}
                todayTasks={null}
                projectTaskGroups={projectTaskGroups}
                inboxGroups={view === 'my' ? inboxGroups : null}
                activeProject={activeProject}
                projects={projects}
                tenantMembers={tenantMembers}
                defaultWhen={defaultWhen}
                projectIdForNew={projectIdForNew}
                isLoading={isLoading}
                seeding={false}
                canCreate={canCreate}
                selectedTaskId={selectedTaskId}
                showWhenBadges={showWhenBadges}
                showProjectInList={showProjectInList}
                showDueDateInList={showDueDateInList}
                draggedTaskId={draggedTaskId}
                dropTargetId={dropTargetId}
                selectedIds={selectedIds}
                blockedTaskIdSet={blockedTaskIdSet}
                onSelectTask={setSelectedTaskId}
                onComplete={handleComplete}
                onTitleSave={(id, newTitle) => updateTask.mutate({ id, title: newTitle })}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onDragEnd={handleDragEnd}
                onToggleSelectOne={toggleSelectOne}
                onDeleteHeading={handleDeleteHeading}
                onSeed={() => {}}
                renderTaskItem={renderTaskItem}
              />
              {selectedTask && selectedTask.type !== 'heading' && (
                <TaskDetailPanel task={selectedTask} projects={projects} members={tenantMembers} allTasks={allTasks} onClose={() => setSelectedTaskId(null)} />
              )}
            </>
          )}
        </div>
      </ContentArea>

      <ConfirmDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}
        title={t('tasks.bulkDelete')} description={t('tasks.bulkDeleteConfirm', { count: selectedIds.size })}
        confirmLabel={t('common.delete')} onConfirm={handleBulkDelete} destructive />
    </div>
  );
}
