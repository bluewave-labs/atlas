import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  Search, Inbox, Star, Calendar, Coffee,
  CircleDot, Moon, X, Trash2,
  LayoutList, LayoutGrid, User,
  Eye, Users, Settings2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  useTaskList, useCreateProject, useUpdateTask, useDeleteTask,
  useProjectList, useDeleteProject, useTaskCounts,
  useReorderTasks,
  useBlockedTaskIds,
} from './hooks';
import { queryKeys } from '../../config/query-keys';
import { api } from '../../lib/api-client';
import type { Task, TaskWhen } from '@atlas-platform/shared';
import { ContentArea } from '../../components/ui/content-area';
import { useTasksSettingsStore } from './settings-store';
import { useUIStore } from '../../stores/ui-store';
import { useAuthStore } from '../../stores/auth-store';
import { useAppActions } from '../../hooks/use-app-permissions';
import { useTenantUsers } from '../../hooks/use-platform';
import { Button } from '../../components/ui/button';
import { IconButton } from '../../components/ui/icon-button';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { NAV_ITEMS, type NavSection } from './lib/constants';
import { getTodayStr, isInputFocused } from './lib/helpers';
import {
  TaskItem,
  CalendarView,
  TaskDetailPanel,
  KanbanBoard,
  TasksSidebar,
  TaskListView,
} from './components';
import '../../styles/tasks.css';

export function TasksPage() {
  const { t } = useTranslation();
  const isDesktop = !!('atlasDesktop' in window);

  const { canCreate, canDelete } = useAppActions('tasks');

  const { account, tenantId } = useAuthStore();
  const currentUserId = account?.userId;
  const { data: tenantMembers } = useTenantUsers(tenantId ?? undefined);

  const { openSettings } = useUIStore();
  const tasksSettings = useTasksSettingsStore();

  const [activeSection, setActiveSection] = useState<NavSection>(tasksSettings.defaultView);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'mine' | 'team'>('all');
  const [viewMode, setViewMode] = useState<'list' | 'board'>(tasksSettings.viewMode || 'list');
  const canShowBoard = activeSection === 'inbox';

  useEffect(() => {
    if (!canShowBoard && viewMode === 'board') setViewMode('list');
  }, [canShowBoard, viewMode]);

  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const deleteTaskMutation = useDeleteTask();
  useEffect(() => { setSelectedIds(new Set()); }, [activeSection]);

  const { data: counts } = useTaskCounts();
  const { data: projectsData } = useProjectList();
  const { data: blockedTaskIds = [] } = useBlockedTaskIds();
  const projects = projectsData?.projects ?? [];

  const taskFilters = useMemo(() => {
    if (activeSection === 'inbox') return { status: 'todo' };
    if (activeSection === 'today') return { when: 'today', status: 'todo' };
    if (activeSection === 'anytime') return { when: 'anytime', status: 'todo' };
    if (activeSection === 'someday') return { when: 'someday', status: 'todo' };
    if (activeSection === 'logbook') return { status: 'completed' };
    if (activeSection === 'upcoming') return { status: 'todo' };
    if (activeSection === 'calendar') return { status: 'todo' };
    if (activeSection === 'team') return { status: 'todo', visibility: 'team' as const };
    if (activeSection === 'assignedToMe' && currentUserId) {
      return { status: 'todo', assigneeId: currentUserId };
    }
    if (activeSection.startsWith('project:')) {
      return { projectId: activeSection.replace('project:', ''), status: 'todo' };
    }
    if (activeSection.startsWith('tag:')) return { status: 'todo' };
    return {};
  }, [activeSection, currentUserId]);

  const { data: tasksData, isLoading } = useTaskList(taskFilters);
  const allTasks = tasksData?.tasks ?? [];

  const completedFilters = useMemo(() => {
    if (activeSection === 'logbook') return null;
    if (activeSection.startsWith('project:')) {
      return { projectId: activeSection.replace('project:', ''), status: 'completed' };
    }
    if (['inbox', 'today', 'anytime', 'someday'].includes(activeSection)) {
      return { when: activeSection === 'today' ? 'today' : activeSection, status: 'completed' };
    }
    return null;
  }, [activeSection]);

  const { data: completedData } = useTaskList(completedFilters ?? { status: 'completed' }, { enabled: completedFilters !== null });
  const completedTasks = completedFilters ? (completedData?.tasks ?? []) : [];

  const displayTasks = useMemo(() => {
    let tasks = allTasks;
    if (activeSection === 'upcoming') {
      tasks = tasks.filter(t => t.dueDate).sort((a, b) => (a.dueDate! > b.dueDate! ? 1 : -1));
    }
    if (activeSection.startsWith('tag:')) {
      const tag = activeSection.replace('tag:', '');
      tasks = tasks.filter(t => t.tags.includes(tag));
    }
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
  }, [allTasks, activeSection, searchQuery, visibilityFilter, currentUserId]);

  const todayTasks = useMemo(() => {
    if (activeSection !== 'today') return null;
    if (!tasksSettings.showEveningSection) {
      return { daytime: displayTasks.filter(t => t.type !== 'heading'), evening: [] };
    }
    return {
      daytime: displayTasks.filter(t => t.when === 'today' && t.type !== 'heading'),
      evening: displayTasks.filter(t => t.when === 'evening' && t.type !== 'heading'),
    };
  }, [activeSection, displayTasks, tasksSettings.showEveningSection]);

  const projectTaskGroups = useMemo(() => {
    if (!activeSection.startsWith('project:')) return null;
    const headings = displayTasks.filter(t => t.type === 'heading');
    const regularTasks = displayTasks.filter(t => t.type !== 'heading');
    const ungrouped = regularTasks.filter(t => !t.headingId);
    const groups: { heading: Task | null; tasks: Task[] }[] = [];
    if (ungrouped.length > 0) groups.push({ heading: null, tasks: ungrouped });
    for (const h of headings) {
      groups.push({ heading: h, tasks: regularTasks.filter(t => t.headingId === h.id) });
    }
    return groups;
  }, [activeSection, displayTasks]);

  const inboxGroups = useMemo(() => {
    if (activeSection !== 'inbox') return null;
    const tasks = displayTasks.filter(t => t.type !== 'heading');
    const todayStr = getTodayStr();
    const overdue: Task[] = [], inbox: Task[] = [], today: Task[] = [];
    const evening: Task[] = [], anytime: Task[] = [], someday: Task[] = [];
    for (const t of tasks) {
      if (t.dueDate && t.dueDate.slice(0, 10) < todayStr) overdue.push(t);
      else if (t.when === 'today') today.push(t);
      else if (t.when === 'evening') evening.push(t);
      else if (t.when === 'anytime') anytime.push(t);
      else if (t.when === 'someday') someday.push(t);
      else inbox.push(t);
    }
    const groups: { label: string; icon: typeof Inbox; color: string; tasks: Task[]; noHeader?: boolean }[] = [];
    if (overdue.length > 0) groups.push({ label: t('tasks.overdue'), icon: Calendar, color: '#ef4444', tasks: overdue });
    if (inbox.length > 0) groups.push({ label: t('tasks.unscheduled'), icon: Inbox, color: '#3b82f6', tasks: inbox, noHeader: true });
    if (today.length > 0) groups.push({ label: t('tasks.todayLabel'), icon: Star, color: '#f59e0b', tasks: today });
    if (evening.length > 0) groups.push({ label: t('tasks.thisEvening'), icon: Moon, color: '#6366f1', tasks: evening });
    if (anytime.length > 0) groups.push({ label: t('tasks.whenOptions.anytime'), icon: CircleDot, color: '#06b6d4', tasks: anytime });
    if (someday.length > 0) groups.push({ label: t('tasks.whenOptions.someday'), icon: Coffee, color: '#a78bfa', tasks: someday });
    return groups;
  }, [activeSection, displayTasks]);

  const showWhenBadges = useMemo(() => {
    if (!tasksSettings.showWhenBadges) return false;
    return activeSection.startsWith('project:') || activeSection.startsWith('tag:') || activeSection === 'upcoming' || activeSection === 'logbook';
  }, [activeSection, tasksSettings.showWhenBadges]);

  const showProjectInList = useMemo(() => {
    return activeSection.startsWith('project:') || activeSection.startsWith('tag:') || activeSection === 'upcoming' || activeSection === 'logbook';
  }, [activeSection]);

  const showDueDateInList = useMemo(() => {
    return activeSection !== 'inbox' && activeSection !== 'today';
  }, [activeSection]);

  const selectedTask = displayTasks.find(t => t.id === selectedTaskId) ?? null;
  const updateTask = useUpdateTask();
  const createProject = useCreateProject();
  const deleteProject = useDeleteProject();
  const reorderTasks = useReorderTasks();
  const queryClient = useQueryClient();
  const [seeding, setSeeding] = useState(false);

  const handleSeedSampleData = useCallback(async () => {
    setSeeding(true);
    try {
      await api.post('/tasks/seed');
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
    } catch { /* ignore */ }
    setSeeding(false);
  }, [queryClient]);

  const hasSeeded = useRef(false);
  useEffect(() => {
    if (!isLoading && allTasks.length === 0 && !seeding && !hasSeeded.current && counts !== undefined && counts.total === 0 && counts.logbook === 0) {
      hasSeeded.current = true;
      handleSeedSampleData();
    }
  }, [isLoading, allTasks.length, seeding, counts, handleSeedSampleData]);

  const defaultWhen: TaskWhen = useMemo(() => {
    if (activeSection === 'today') return 'today';
    if (activeSection === 'anytime') return 'anytime';
    if (activeSection === 'someday') return 'someday';
    if (activeSection.startsWith('tag:')) return 'inbox';
    return 'inbox';
  }, [activeSection]);

  const projectIdForNew = activeSection.startsWith('project:') ? activeSection.replace('project:', '') : null;
  const activeProject = projectIdForNew ? projects.find(p => p.id === projectIdForNew) : null;

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

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const t of allTasks) for (const tag of t.tags) tagSet.add(tag);
    return Array.from(tagSet).sort();
  }, [allTasks]);

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
    for (const id of Array.from(selectedIds)) await deleteTaskMutation.mutateAsync(id);
    setSelectedIds(new Set());
    setShowDeleteConfirm(false);
    setSelectedTaskId(null);
  }, [selectedIds, deleteTaskMutation]);

  const handleComplete = useCallback((taskId: string) => {
    const task = allTasks.find(t => t.id === taskId) ?? completedTasks.find(t => t.id === taskId);
    updateTask.mutate({ id: taskId, status: task?.status === 'completed' ? 'todo' : 'completed' });
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
    setDropTargetId(targetId);
  }, []);

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

  const sectionTitle = useMemo(() => {
    if (activeSection.startsWith('project:')) return null;
    if (activeSection.startsWith('tag:')) return `#${activeSection.replace('tag:', '')}`;
    if (activeSection === 'assignedToMe') return t('tasks.assignedToMe');
    if (activeSection === 'calendar') return t('tasks.calendar.title');
    const nav = NAV_ITEMS.find(n => n.id === activeSection);
    return nav ? t(nav.labelKey) : '';
  }, [activeSection, t]);

  const navCounts = useMemo(() => ({
    inbox: counts?.inbox ?? 0, today: counts?.today ?? 0, upcoming: counts?.upcoming ?? 0,
    anytime: counts?.anytime ?? 0, someday: counts?.someday ?? 0, logbook: counts?.logbook ?? 0,
    assignedToMe: (counts as any)?.assignedToMe ?? 0, team: counts?.team ?? 0,
  }), [counts]);

  const handleNewProject = () => {
    createProject.mutate({ title: t('tasks.newProject') }, {
      onSuccess: (proj) => setActiveSection(`project:${proj.id}`),
    });
  };

  const handleDeleteProject = (projectId: string) => {
    if (activeSection === `project:${projectId}`) { setActiveSection('inbox'); setSelectedTaskId(null); }
    deleteProject.mutate(projectId);
  };

  const handleSectionChange = useCallback((section: NavSection) => {
    setActiveSection(section);
    setSelectedTaskId(null);
  }, []);

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
      onTitleSave={(title) => updateTask.mutate({ id: task.id, title })}
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

  return (
    <div className="tasks-page">
      {isDesktop && <div className="desktop-drag-region tasks-drag-region" />}

      <TasksSidebar
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
        navCounts={navCounts}
        projects={projects}
        allTags={allTags}
        canDelete={canDelete}
        onNewProject={handleNewProject}
        onDeleteProject={handleDeleteProject}
      />

      <ContentArea
        title={sectionTitle ?? t('tasks.title')}
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
            {canShowBoard && (
              <div className="tasks-view-toggle">
                <button className={`tasks-view-toggle-btn${viewMode === 'list' ? ' active' : ''}`}
                  onClick={() => { setViewMode('list'); tasksSettings.setViewMode('list'); }} title={t('tasks.listView')}>
                  <LayoutList size={14} />
                </button>
                <button className={`tasks-view-toggle-btn${viewMode === 'board' ? ' active' : ''}`}
                  onClick={() => { setViewMode('board'); tasksSettings.setViewMode('board'); }} title={t('tasks.boardView')}>
                  <LayoutGrid size={14} />
                </button>
              </div>
            )}
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
            <IconButton icon={<Settings2 size={15} strokeWidth={1.8} />} label={t('tasks.tasksSettings')} size={28}
              onClick={() => openSettings('tasks')} />
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
          {activeSection === 'calendar' ? (
            <>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <CalendarView tasks={allTasks} onSelectTask={(id) => setSelectedTaskId(id)} />
              </div>
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
                activeSection={activeSection} displayTasks={displayTasks} completedTasks={completedTasks}
                todayTasks={todayTasks} projectTaskGroups={projectTaskGroups} inboxGroups={inboxGroups}
                activeProject={activeProject ?? null} projects={projects} tenantMembers={tenantMembers}
                defaultWhen={defaultWhen} projectIdForNew={projectIdForNew} isLoading={isLoading} seeding={seeding}
                canCreate={canCreate} selectedTaskId={selectedTaskId} showWhenBadges={showWhenBadges}
                showProjectInList={showProjectInList} showDueDateInList={showDueDateInList}
                draggedTaskId={draggedTaskId} dropTargetId={dropTargetId} selectedIds={selectedIds}
                blockedTaskIdSet={blockedTaskIdSet} onSelectTask={setSelectedTaskId} onComplete={handleComplete}
                onTitleSave={(id, title) => updateTask.mutate({ id, title })} onDragStart={handleDragStart}
                onDragOver={handleDragOver} onDrop={handleDrop} onDragEnd={handleDragEnd}
                onToggleSelectOne={toggleSelectOne} onDeleteHeading={handleDeleteHeading} onSeed={handleSeedSampleData}
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
