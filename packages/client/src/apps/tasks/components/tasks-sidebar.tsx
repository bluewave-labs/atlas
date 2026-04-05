import { useRef, useEffect, useState, useMemo } from 'react';
import {
  Plus, Hash, MoreHorizontal, Trash2, User, CalendarDays, ChevronDown,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TaskProject } from '@atlasmail/shared';
import { AppSidebar } from '../../../components/layout/app-sidebar';
import { IconButton } from '../../../components/ui/icon-button';
import { Button } from '../../../components/ui/button';
import { NAV_ITEMS, type NavSection } from '../lib/constants';

export function TasksSidebar({
  activeSection,
  onSectionChange,
  navCounts,
  projects,
  allTags,
  canDelete,
  onNewProject,
  onDeleteProject,
}: {
  activeSection: NavSection;
  onSectionChange: (section: NavSection) => void;
  navCounts: Record<string, number>;
  projects: TaskProject[];
  allTags: string[];
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
    <AppSidebar storageKey="atlas_tasks_sidebar" title="Tasks">
      {/* Nav items */}
      <div className="tasks-nav-section">
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            className={`task-nav-item${activeSection === item.id ? ' active' : ''}`}
            onClick={() => onSectionChange(item.id)}
          >
            <item.icon size={16} color={item.color} strokeWidth={1.8} />
            <span style={{ flex: 1 }}>{t(item.labelKey)}</span>
            {navCounts[item.id as keyof typeof navCounts] > 0 && (
              <span className="task-nav-count">
                {navCounts[item.id as keyof typeof navCounts]}
              </span>
            )}
          </button>
        ))}
        {/* Assigned to me */}
        <button
          className={`task-nav-item${activeSection === 'assignedToMe' ? ' active' : ''}`}
          onClick={() => onSectionChange('assignedToMe')}
        >
          <User size={16} color="#8b5cf6" strokeWidth={1.8} />
          <span style={{ flex: 1 }}>{t('tasks.assignedToMe')}</span>
          {navCounts.assignedToMe > 0 && (
            <span className="task-nav-count">
              {navCounts.assignedToMe}
            </span>
          )}
        </button>
        {/* Calendar */}
        <button
          className={`task-nav-item${activeSection === 'calendar' ? ' active' : ''}`}
          onClick={() => onSectionChange('calendar')}
        >
          <CalendarDays size={16} color="#10b981" strokeWidth={1.8} />
          <span style={{ flex: 1 }}>{t('tasks.sidebar.calendar')}</span>
        </button>
      </div>

      {/* Projects section */}
      <div style={{ marginTop: 16, padding: '0 8px' }}>
        <div className="tasks-projects-header">
          <span className="tasks-projects-label">Projects</span>
          <IconButton
            icon={<Plus size={14} />}
            label="New project"
            size={24}
            onClick={onNewProject}
          />
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
                label="Project options"
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
                      Delete project
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
              <span>{hiddenProjectCount} more</span>
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
            <span className="tasks-projects-label">Tags</span>
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
                <span>{hiddenTagCount} more</span>
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
