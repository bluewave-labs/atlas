import { useSearchParams } from 'react-router-dom';
import { WorkSidebar } from './components/work-sidebar';
import { MyTasksView } from './components/task-views/my-tasks-view';
import { AssignedView } from './components/task-views/assigned-view';
import { CreatedView } from './components/task-views/created-view';
import { AllTasksView } from './components/task-views/all-tasks-view';
import { ProjectDetailPage } from './components/project-detail-page';
import { WorkDashboard } from './components/work-dashboard';
import { ProjectsListView } from './components/projects-list-view';

export function WorkPage() {
  const [sp] = useSearchParams();
  const projectId = sp.get('projectId');
  const view = sp.get('view') ?? 'my';

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <WorkSidebar />
      {projectId ? (
        <ProjectDetailPage projectId={projectId} />
      ) : view === 'dashboard' ? (
        <WorkDashboard />
      ) : view === 'projects' ? (
        <ProjectsListView />
      ) : view === 'assigned' ? (
        <AssignedView />
      ) : view === 'created' ? (
        <CreatedView />
      ) : view === 'all' ? (
        <AllTasksView />
      ) : (
        <MyTasksView />
      )}
    </div>
  );
}
