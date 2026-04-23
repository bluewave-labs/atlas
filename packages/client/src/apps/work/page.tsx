import { useSearchParams } from 'react-router-dom';
import { WorkSidebar } from './components/work-sidebar';
import { MyTasksView } from './components/task-views/my-tasks-view';
import { ProjectDetailPage } from './components/project-detail-page';
import { WorkDashboard } from './components/work-dashboard';
import { ProjectsListView } from './components/projects-list-view';
import { ProjectsBoardView } from './components/projects-board-view';

export type WorkPageView = 'dashboard' | 'projects' | 'my-tasks' | 'board';

const VALID_VIEWS: readonly WorkPageView[] = ['dashboard', 'projects', 'my-tasks', 'board'];

function parseView(raw: string | null): WorkPageView {
  return (raw && (VALID_VIEWS as readonly string[]).includes(raw)) ? (raw as WorkPageView) : 'dashboard';
}

export function WorkPage() {
  const [sp] = useSearchParams();
  const projectId = sp.get('projectId');
  const view = parseView(sp.get('view'));

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 48px)', overflow: 'hidden', marginLeft: 56, marginTop: 48 }}>
      <WorkSidebar />
      {projectId ? (
        <ProjectDetailPage projectId={projectId} />
      ) : view === 'board' ? (
        <ProjectsBoardView />
      ) : view === 'projects' ? (
        <ProjectsListView />
      ) : view === 'my-tasks' ? (
        <MyTasksView />
      ) : (
        <WorkDashboard />
      )}
    </div>
  );
}
