import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Textarea } from '../../../components/ui/textarea';
import { Select } from '../../../components/ui/select';
import { Modal } from '../../../components/ui/modal';
import { Badge } from '../../../components/ui/badge';

type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'error';
import { ContentArea } from '../../../components/ui/content-area';
import { DataTable, type DataTableColumn } from '../../../components/ui/data-table';
import { FeatureEmptyState } from '../../../components/ui/feature-empty-state';
import { useProjects, useCreateProject, type WorkProject } from '../hooks';
import { useCompanies } from '../../crm/hooks';
import { useAppActions } from '../../../hooks/use-app-permissions';

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  active: 'success',
  paused: 'warning',
  completed: 'default',
  archived: 'default',
};

function CreateProjectModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [companyId, setCompanyId] = useState('');
  const createProject = useCreateProject();
  const { data: companiesData } = useCompanies();
  const companies = companiesData?.companies ?? [];

  const reset = () => {
    setName('');
    setDescription('');
    setCompanyId('');
  };

  const submit = () => {
    if (!name.trim()) return;
    createProject.mutate(
      {
        name: name.trim(),
        description: description.trim() || null,
        companyId: companyId || undefined,
      },
      {
        onSuccess: (project) => {
          onOpenChange(false);
          reset();
          navigate(`/work?projectId=${project.id}`);
        },
      },
    );
  };

  const close = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  return (
    <Modal open={open} onOpenChange={close} width={460} title={t('work.createProject.title')}>
      <Modal.Header title={t('work.createProject.title')} />
      <Modal.Body>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          <Input
            label={t('work.createProject.namePlaceholder')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('work.createProject.namePlaceholder')}
            size="md"
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          />
          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-xs)' }}>
              {t('work.createProject.company')}
            </label>
            <Select
              size="md"
              value={companyId}
              onChange={setCompanyId}
              options={[{ value: '', label: t('work.createProject.noCompany') }, ...companies.map((c) => ({ value: c.id, label: c.name }))]}
            />
          </div>
          <Textarea
            label={t('work.createProject.description')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>
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

  // Auto-open create modal from quick action URL param
  const [sp, setSp] = useSearchParams();
  useEffect(() => {
    if (sp.get('action') === 'create') {
      setCreateOpen(true);
      sp.delete('action');
      setSp(sp, { replace: true });
    }
  }, []);

  const columns: DataTableColumn<WorkProject>[] = [
    {
      key: 'name',
      label: t('work.projectsList.colName'),
      render: (p) => (
        <div>
          <div style={{ color: 'var(--color-text-primary)', fontWeight: 'var(--font-weight-medium)' }}>{p.name}</div>
          {p.description && (
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {p.description}
            </div>
          )}
        </div>
      ),
      searchValue: (p) => `${p.name} ${p.description ?? ''}`,
      sortable: true,
      compare: (a, b) => a.name.localeCompare(b.name),
    },
    {
      key: 'status',
      label: t('work.projectsList.colStatus'),
      render: (p) => p.status ? (
        <Badge variant={STATUS_VARIANT[p.status] ?? 'default'}>
          {t(`projects.status.${p.status}`, { defaultValue: p.status })}
        </Badge>
      ) : <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>,
      searchValue: (p) => p.status ?? '',
      sortable: true,
    },
    {
      key: 'updatedAt',
      label: t('work.projectsList.colUpdated'),
      render: (p) => (
        <span style={{ color: 'var(--color-text-tertiary)' }}>
          {p.updatedAt ? String(p.updatedAt).slice(0, 10) : '—'}
        </span>
      ),
      sortable: true,
      compare: (a, b) => (a.updatedAt ?? '').localeCompare(b.updatedAt ?? ''),
    },
  ];

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
      {isLoading ? (
        <div style={{ padding: 'var(--spacing-lg)', color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-sm)' }}>
          {t('work.loading')}
        </div>
      ) : projects.length === 0 ? (
        <FeatureEmptyState
          illustration="tasks"
          title={t('work.empty.projects')}
          actionLabel={canCreate ? t('work.sidebar.newProject') : undefined}
          actionIcon={canCreate ? <Plus size={13} /> : undefined}
          onAction={canCreate ? () => setCreateOpen(true) : undefined}
        />
      ) : (
        <DataTable
          persistSortKey="projects_list"
          data={projects}
          columns={columns}
          onRowClick={(p) => navigate(`/work?projectId=${p.id}`)}
          searchable
          searchPlaceholder={t('work.projectsList.search', { defaultValue: 'Search projects' })}
        />
      )}
    </ContentArea>
  );
}
