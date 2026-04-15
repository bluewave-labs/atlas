import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Inbox, UserCheck, Edit, Layers, FolderKanban, BarChart3, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AppSidebar, SidebarItem, SidebarSection } from '../../../components/layout/app-sidebar';
import { useTaskProjectList, useCreateProject } from '../hooks';
import { Modal } from '../../../components/ui/modal';
import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';

function CreateProjectModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const createProject = useCreateProject();

  const handleSubmit = () => {
    if (!name.trim()) return;
    createProject.mutate({ name: name.trim() }, {
      onSuccess: (project) => {
        onOpenChange(false);
        setName('');
        navigate(`/work?projectId=${project.id}`);
      },
    });
  };

  const handleClose = (open: boolean) => {
    if (!open) setName('');
    onOpenChange(open);
  };

  return (
    <Modal open={open} onOpenChange={handleClose} width={400} title={t('work.createProject.title')}>
      <Modal.Header title={t('work.createProject.title')} />
      <Modal.Body>
        <Input
          label={t('work.createProject.namePlaceholder')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('work.createProject.namePlaceholder')}
          size="md"
          autoFocus
          onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
        />
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" size="md" onClick={() => handleClose(false)}>
          {t('work.createProject.cancel')}
        </Button>
        <Button
          variant="primary"
          size="md"
          onClick={handleSubmit}
          disabled={!name.trim() || createProject.isPending}
        >
          {t('work.createProject.submit')}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export function WorkSidebar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const activeProjectId = sp.get('projectId');
  const activeView = sp.get('view') ?? 'my';
  const { data: projectsData } = useTaskProjectList();
  const projects = projectsData?.projects ?? [];
  const [createOpen, setCreateOpen] = useState(false);

  const go = (qs: string) => navigate(`/work${qs}`);

  return (
    <>
      <AppSidebar storageKey="atlas_work_sidebar" title="Work">
        <SidebarSection>
          <SidebarItem
            label={t('work.sidebar.dashboard')}
            icon={<BarChart3 size={15} />}
            isActive={activeView === 'dashboard' && !activeProjectId}
            onClick={() => go('?view=dashboard')}
          />
          <SidebarItem
            label={t('work.sidebar.myTasks')}
            icon={<Inbox size={15} />}
            isActive={activeView === 'my' && !activeProjectId}
            onClick={() => go('')}
          />
          <SidebarItem
            label={t('work.sidebar.assignedToMe')}
            icon={<UserCheck size={15} />}
            isActive={activeView === 'assigned' && !activeProjectId}
            onClick={() => go('?view=assigned')}
          />
          <SidebarItem
            label={t('work.sidebar.createdByMe')}
            icon={<Edit size={15} />}
            isActive={activeView === 'created' && !activeProjectId}
            onClick={() => go('?view=created')}
          />
          <SidebarItem
            label={t('work.sidebar.allTasks')}
            icon={<Layers size={15} />}
            isActive={activeView === 'all' && !activeProjectId}
            onClick={() => go('?view=all')}
          />
        </SidebarSection>
        <SidebarSection
          title={t('work.sidebar.projects')}
          action={
            <button
              onClick={(e) => { e.stopPropagation(); setCreateOpen(true); }}
              title={t('work.sidebar.newProject')}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
                alignItems: 'center',
                color: 'var(--color-text-tertiary)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <Plus size={13} />
            </button>
          }
        >
          {projects.map((p) => (
            <SidebarItem
              key={p.id}
              label={p.title}
              icon={<FolderKanban size={15} />}
              isActive={activeProjectId === p.id}
              onClick={() => go(`?projectId=${p.id}`)}
            />
          ))}
        </SidebarSection>
      </AppSidebar>
      <CreateProjectModal open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}
