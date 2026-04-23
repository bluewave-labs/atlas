import { useSearchParams } from 'react-router-dom';
import { TopBar } from '../../components/layout/top-bar';
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
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', marginLeft: 56 }}>
      <WorkSidebar />
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
        <TopBar />
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
    </div>
  );
}
