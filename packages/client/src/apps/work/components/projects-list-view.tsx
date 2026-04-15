import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, FolderKanban } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Modal } from '../../../components/ui/modal';
import { ContentArea } from '../../../components/ui/content-area';
import { useProjects, useCreateProject } from '../hooks';
import { useAppActions } from '../../../hooks/use-app-permissions';

function CreateProjectModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const createProject = useCreateProject();

  const submit = () => {
    if (!name.trim()) return;
    createProject.mutate({ name: name.trim() }, {
      onSuccess: (project) => {
        onOpenChange(false);
        setName('');
        navigate(`/work?projectId=${project.id}`);
      },
    });
  };

  const close = (next: boolean) => {
    if (!next) setName('');
    onOpenChange(next);
  };

  return (
    <Modal open={open} onOpenChange={close} width={400} title={t('work.createProject.title')}>
      <Modal.Header title={t('work.createProject.title')} />
      <Modal.Body>
        <Input
          label={t('work.createProject.namePlaceholder')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('work.createProject.namePlaceholder')}
          size="md"
          autoFocus
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
        />
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" size="md" onClick={() => close(false)}>
          {t('work.createProject.cancel')}
        </Button>
        <Button
          variant="primary"
          size="md"
          onClick={submit}
          disabled={!name.trim() || createProject.isPending}
        >
          {t('work.createProject.submit')}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export function ProjectsListView() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading } = useProjects();
  const projects = data?.projects ?? [];
  const { canCreate } = useAppActions('work');
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <ContentArea
      title={t('work.sidebar.projects')}
      actions={canCreate ? (
        <Button variant="primary" size="sm" icon={<Plus size={13} />} onClick={() => setCreateOpen(true)}>
          {t('work.sidebar.newProject')}
        </Button>
      ) : null}
    >
      <CreateProjectModal open={createOpen} onOpenChange={setCreateOpen} />
      <div style={{ padding: 'var(--spacing-lg)' }}>
        {isLoading ? (
          <div style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-sm)' }}>{t('work.loading')}</div>
        ) : projects.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--spacing-md)', padding: 'var(--spacing-2xl)', color: 'var(--color-text-tertiary)' }}>
            <FolderKanban size={32} />
            <span style={{ fontSize: 'var(--font-size-sm)' }}>{t('work.empty.projects')}</span>
            {canCreate && (
              <Button variant="primary" size="sm" icon={<Plus size={13} />} onClick={() => setCreateOpen(true)}>
                {t('work.sidebar.newProject')}
              </Button>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--spacing-md)' }}>
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => navigate(`/work?projectId=${p.id}`)}
                style={{
                  textAlign: 'left',
                  background: 'var(--color-bg-secondary)',
                  border: '1px solid var(--color-border-secondary)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--spacing-md)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-family)',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--color-border-primary)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-border-secondary)'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-xs)' }}>
                  <FolderKanban size={16} style={{ color: 'var(--color-text-tertiary)' }} />
                  <span style={{ fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.name}
                  </span>
                </div>
                {p.description && (
                  <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {p.description}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </ContentArea>
  );
}
