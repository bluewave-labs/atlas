import { useRef, useEffect, useState, useMemo } from 'react';
import {
  Plus, Hash, MoreHorizontal, Trash2, User, CalendarDays, ChevronDown,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TaskProject } from '@atlas-platform/shared';
import { AppSidebar, SidebarItem, SidebarSection } from '../../../components/layout/app-sidebar';
import { IconButton } from '../../../components/ui/icon-button';
import { Button } from '../../../components/ui/button';
import { NAV_ITEMS, type NavSection } from '../lib/constants';

export function TasksSidebar({
  activeSection,
  onSectionChange,
  navCounts,
  projects,
  allTags,
  canCreate,
  canDelete,
  onNewProject,
  onDeleteProject,
}: {
  activeSection: NavSection;
  onSectionChange: (section: NavSection) => void;
  navCounts: Record<string, number>;
  projects: TaskProject[];
  allTags: string[];
  canCreate: boolean;
  canDelete: boolean;
  onNewProject: () => void;
  onDeleteProject: (projectId: string) => void;
}) {
  const { t } = useTranslation();
  const [projectMenuId, setProjectMenuId] = useState<string | null>(null);
  const projectMenuRef = useRef<HTMLDivElement>(null);
  const [showAllProjects, setShowAllProjects] = useState(false);
  const [showAllTags, setShowAllTags] = useState(false);

  const MAX_VISIBLE = 5;
  const visibleProjects = useMemo(() => {
    if (showAllProjects || projects.length <= MAX_VISIBLE + 1) return projects;
    return projects.slice(0, MAX_VISIBLE);
  }, [projects, showAllProjects]);
  const hiddenProjectCount = projects.length - visibleProjects.length;

  const visibleTags = useMemo(() => {
    if (showAllTags || allTags.length <= MAX_VISIBLE + 1) return allTags;
    return allTags.slice(0, MAX_VISIBLE);
  }, [allTags, showAllTags]);
  const hiddenTagCount = allTags.length - visibleTags.length;

  // Close project menu on click outside
  useEffect(() => {
    if (!projectMenuId) return;
    const close = (e: MouseEvent) => {
      if (projectMenuRef.current && !projectMenuRef.current.contains(e.target as Node)) {
        setProjectMenuId(null);
      }
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [projectMenuId]);

  const handleDeleteProject = (projectId: string) => {
    onDeleteProject(projectId);
    setProjectMenuId(null);
  };

  return (
    <AppSidebar storageKey="atlas_tasks_sidebar" title={t('tasks.title')}>
      {/* Nav items */}
      <SidebarSection>
        {NAV_ITEMS.map(item => (
          <SidebarItem
            key={item.id}
            label={t(item.labelKey)}
            icon={<item.icon size={15} />}
            isActive={activeSection === item.id}
            count={navCounts[item.id as keyof typeof navCounts] > 0 ? navCounts[item.id as keyof typeof navCounts] : undefined}
            onClick={() => onSectionChange(item.id)}
          />
        ))}
        <SidebarItem
          label={t('tasks.assignedToMe')}
          icon={<User size={15} />}
          isActive={activeSection === 'assignedToMe'}
          count={navCounts.assignedToMe > 0 ? navCounts.assignedToMe : undefined}
          onClick={() => onSectionChange('assignedToMe')}
        />
        <SidebarItem
          label={t('tasks.sidebar.calendar')}
          icon={<CalendarDays size={15} />}
          isActive={activeSection === 'calendar'}
          onClick={() => onSectionChange('calendar')}
        />
      </SidebarSection>

      {/* Projects section */}
      <div style={{ marginTop: 16, padding: '0 8px' }}>
        <div className="tasks-projects-header">
          <span className="tasks-projects-label">{t('tasks.projectsLabel')}</span>
          {canCreate && (
            <IconButton
              icon={<Plus size={14} />}
              label={t('tasks.newProject')}
              size={24}
              onClick={onNewProject}
            />
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {visibleProjects.map(proj => (
            <div key={proj.id} className="tasks-project-row" style={{ position: 'relative' }}>
              <button
                className={`task-nav-item${activeSection === `project:${proj.id}` ? ' active' : ''}`}
                onClick={() => onSectionChange(`project:${proj.id}`)}
              >
                {proj.icon ? (
                  <span className="tasks-project-emoji">{proj.icon}</span>
                ) : (
                  <div className="tasks-project-indicator" style={{ background: proj.color }} />
                )}
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {proj.title}
                </span>
              </button>
              <IconButton
                icon={<MoreHorizontal size={14} />}
                label={t('tasks.projectOptions')}
                size={24}
                tooltip={false}
                className="tasks-project-more-btn"
                onClick={e => {
                  e.stopPropagation();
                  setProjectMenuId(projectMenuId === proj.id ? null : proj.id);
                }}
              />
              {projectMenuId === proj.id && (
                <div className="tasks-project-popover" ref={projectMenuRef}>
                  {canDelete && (
                    <Button
                      variant="danger"
                      size="sm"
                      icon={<Trash2 size={13} />}
                      onClick={() => handleDeleteProject(proj.id)}
                      style={{ width: '100%', justifyContent: 'flex-start' }}
                    >
                      {t('tasks.deleteProject')}
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
          {hiddenProjectCount > 0 && (
            <button
              className="task-nav-item"
              onClick={() => setShowAllProjects(true)}
              style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-xs)' }}
            >
              <ChevronDown size={13} />
              <span>{t('tasks.moreCount', { count: hiddenProjectCount })}</span>
            </button>
          )}
          {showAllProjects && projects.length > MAX_VISIBLE + 1 && (
            <button
              className="task-nav-item"
              onClick={() => setShowAllProjects(false)}
              style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-xs)' }}
            >
              <ChevronDown size={13} style={{ transform: 'rotate(180deg)' }} />
              <span>{t('common.showLess', 'Show less')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Tags section */}
      {allTags.length > 0 && (
        <div style={{ marginTop: 16, padding: '0 8px' }}>
          <div className="tasks-projects-header">
            <span className="tasks-projects-label">{t('tasks.tagsLabel')}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {visibleTags.map(tag => (
              <button
                key={tag}
                className={`task-nav-item${activeSection === `tag:${tag}` as any ? ' active' : ''}`}
                onClick={() => onSectionChange(`tag:${tag}` as NavSection)}
              >
                <Hash size={14} color="var(--color-text-tertiary)" />
                <span style={{ flex: 1 }}>{tag}</span>
              </button>
            ))}
            {hiddenTagCount > 0 && (
              <button
                className="task-nav-item"
                onClick={() => setShowAllTags(true)}
                style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-xs)' }}
              >
                <ChevronDown size={13} />
                <span>{t('tasks.moreCount', { count: hiddenTagCount })}</span>
              </button>
            )}
            {showAllTags && allTags.length > MAX_VISIBLE + 1 && (
              <button
                className="task-nav-item"
                onClick={() => setShowAllTags(false)}
                style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-xs)' }}
              >
                <ChevronDown size={13} style={{ transform: 'rotate(180deg)' }} />
                <span>{t('common.showLess', 'Show less')}</span>
              </button>
            )}
          </div>
        </div>
      )}

      <div style={{ flex: 1 }} />
    </AppSidebar>
  );
}
