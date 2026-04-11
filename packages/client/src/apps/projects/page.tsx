import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard, Clock, FolderKanban, BarChart3, Settings2,
  Plus, Search, X,
} from 'lucide-react';
import { useProjects } from './hooks';
import { useAppActions } from '../../hooks/use-app-permissions';
import { TimeTracker } from './components/time-tracker';
import { ReportsView } from './components/reports-view';
import { AppSidebar, SidebarSection, SidebarItem } from '../../components/layout/app-sidebar';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { IconButton } from '../../components/ui/icon-button';
import { ContentArea } from '../../components/ui/content-area';
import '../../styles/projects.css';

import type { ActiveView } from './lib/types';
import {
  DashboardView, ProjectsListView, ProjectDetailPanel,
  SettingsView,
} from './components/views';
import { CreateProjectModal } from './components/modals';

// ─── Main Page ────────────────────────────────────────────────────

export function ProjectsPage() {
  const { t } = useTranslation();

  // Navigation
  const [searchParams, setSearchParams] = useSearchParams();
  const viewParam = (searchParams.get('view') || 'dashboard') as ActiveView;
  const activeView = viewParam;
  const setActiveView = useCallback((view: ActiveView) => {
    setSearchParams({ view }, { replace: true });
  }, [setSearchParams]);

  // Selection state
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Modals
  const [showCreateProject, setShowCreateProject] = useState(false);

  // Data
  const { data: projectsData } = useProjects();
  const projects = projectsData?.projects ?? [];

  // Permissions
  const { canCreate } = useAppActions('projects');

  // Selected entities
  const selectedProject = selectedProjectId ? projects.find((p) => p.id === selectedProjectId) : null;

  // Close selection on view change
  useEffect(() => {
    setSelectedProjectId(null);
    setSearchQuery('');
    setShowSearch(false);
  }, [activeView]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (showSearch) {
          setShowSearch(false);
          setSearchQuery('');
        } else {
          setSelectedProjectId(null);
        }
      }
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      if (e.key === '/' && !isInput) {
        e.preventDefault();
        setShowSearch(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSearch]);

  // Section title
  const sectionTitle = useMemo(() => {
    switch (activeView) {
      case 'dashboard': return t('projects.sidebar.dashboard');
      case 'timeTracking': return t('projects.sidebar.timeTracking');
      case 'projects': return t('projects.sidebar.allProjects');
      case 'reports': return t('projects.sidebar.reports');
      case 'settings': return t('projects.sidebar.settings');
    }
  }, [activeView, t]);

  // Add handler
  const handleAdd = () => {
    if (activeView === 'projects') {
      setShowCreateProject(true);
    }
  };

  const addButtonLabel = useMemo(() => {
    switch (activeView) {
      case 'dashboard': return t('projects.projects.newProject');
      case 'projects': return t('projects.projects.newProject');
      default: return '';
    }
  }, [activeView, t]);

  const hasDetailPanel = !!(activeView === 'projects' && selectedProject);

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar */}
      <AppSidebar
        storageKey="atlas_projects_sidebar"
        title={t('projects.title')}
        footer={
          <SidebarItem
            label={t('projects.sidebar.settings')}
            icon={<Settings2 size={14} />}
            onClick={() => setActiveView('settings')}
          />
        }
      >
        <SidebarSection>
          <SidebarItem
            label={t('projects.sidebar.dashboard')}
            icon={<LayoutDashboard size={14} />}
            iconColor="#0ea5e9"
            isActive={activeView === 'dashboard'}
            onClick={() => setActiveView('dashboard')}
          />
          <SidebarItem
            label={t('projects.sidebar.timeTracking')}
            icon={<Clock size={14} />}
            iconColor="#f59e0b"
            isActive={activeView === 'timeTracking'}
            onClick={() => setActiveView('timeTracking')}
          />
          <SidebarItem
            label={t('projects.sidebar.allProjects')}
            icon={<FolderKanban size={14} />}
            iconColor="#8b5cf6"
            isActive={activeView === 'projects'}
            count={projects.length}
            onClick={() => setActiveView('projects')}
          />
          <SidebarItem
            label={t('projects.sidebar.reports')}
            icon={<BarChart3 size={14} />}
            iconColor="#6366f1"
            isActive={activeView === 'reports'}
            onClick={() => setActiveView('reports')}
          />
        </SidebarSection>
      </AppSidebar>

      {/* Main content */}
      <ContentArea
        title={sectionTitle ?? ''}
        actions={
          activeView === 'projects' ? (
            <>
              <IconButton
                icon={<Search size={14} />}
                label={t('projects.actions.search')}
                size={28}
                active={showSearch}
                onClick={() => {
                  setShowSearch(!showSearch);
                  if (!showSearch) setTimeout(() => searchInputRef.current?.focus(), 50);
                }}
              />
              {addButtonLabel && canCreate && (
                <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={handleAdd}>
                  {addButtonLabel}
                </Button>
              )}
            </>
          ) : activeView === 'dashboard' && canCreate ? (
            <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => { setActiveView('projects'); setShowCreateProject(true); }}>
              {t('projects.projects.newProject')}
            </Button>
          ) : undefined
        }
      >
        {/* Search bar */}
        {showSearch && (
          <div className="projects-search-bar">
            <Input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('projects.actions.search')}
              iconLeft={<Search size={14} />}
              size="sm"
              style={{ border: 'none', background: 'transparent' }}
            />
            <IconButton
              icon={<X size={14} />}
              label={t('common.close')}
              size={24}
              onClick={() => { setShowSearch(false); setSearchQuery(''); }}
            />
          </div>
        )}

        {/* Content area */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {activeView === 'dashboard' && <DashboardView />}

            {activeView === 'timeTracking' && <TimeTracker />}

            {activeView === 'projects' && (
              <ProjectsListView
                projects={projects}
                searchQuery={searchQuery}
                selectedId={selectedProjectId}
                onSelect={(id) => { setSelectedProjectId(id); }}
                onAdd={canCreate ? () => setShowCreateProject(true) : undefined}
              />
            )}

            {activeView === 'reports' && <ReportsView />}

            {activeView === 'settings' && <SettingsView />}
          </div>

          {/* Detail panels */}
          {hasDetailPanel && (
            <div style={{ width: 360, borderLeft: '1px solid var(--color-border-secondary)', flexShrink: 0, overflow: 'hidden' }}>
              {activeView === 'projects' && selectedProject && (
                <ProjectDetailPanel project={selectedProject} onClose={() => setSelectedProjectId(null)} />
              )}
            </div>
          )}
        </div>
      </ContentArea>

      {/* Modals */}
      <CreateProjectModal open={showCreateProject} onClose={() => setShowCreateProject(false)} />
    </div>
  );
}
