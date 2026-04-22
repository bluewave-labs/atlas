import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { ContentArea } from '../../../components/ui/content-area';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Select } from '../../../components/ui/select';
import { ConfirmDialog } from '../../../components/ui/confirm-dialog';
import { useToastStore } from '../../../stores/toast-store';
import {
  useWorkflow,
  useUpdateWorkflow,
  useAddStep,
  useUpdateStep,
  useDeleteStep,
  useReorderSteps,
  useDeleteWorkflow,
  useToggleWorkflow,
  useStages,
  type CrmWorkflowStep,
  type StepCondition,
} from '../hooks';
import { StepCard } from './step-card';
import { TRIGGER_AVAILABLE_FIELDS, type WorkflowTrigger } from '@atlas-platform/shared';
import { getTriggerOptions } from '../lib/workflow-options';

const SAVE_DEBOUNCE_MS = 500;

interface AutomationEditorProps {
  id: string;
  onBack: () => void;
}

export function AutomationEditor({ id, onBack }: AutomationEditorProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const addToast = useToastStore((s) => s.addToast);

  const { data: workflow, isLoading } = useWorkflow(id);
  const { data: stagesData } = useStages();
  const stages = stagesData?.stages ?? [];

  const updateWorkflow = useUpdateWorkflow();
  const addStep = useAddStep(id);
  const updateStep = useUpdateStep(id);
  const deleteStep = useDeleteStep(id);
  const reorderSteps = useReorderSteps(id);
  const deleteWorkflow = useDeleteWorkflow();
  const toggleWorkflow = useToggleWorkflow();

  const [name, setName] = useState('');
  const [trigger, setTrigger] = useState<WorkflowTrigger>('deal_stage_changed');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const nameTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [draggedStepId, setDraggedStepId] = useState<string | null>(null);

  useEffect(() => {
    if (workflow) {
      setName(workflow.name);
      setTrigger(workflow.trigger as WorkflowTrigger);
    }
    // Only re-initialise local edit buffers when switching to a different workflow.
    // Intentionally ignore name/trigger changes so an in-flight server refetch
    // can't clobber in-progress user edits mid-type.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflow?.id]);

  useEffect(() => {
    return () => {
      if (nameTimer.current) clearTimeout(nameTimer.current);
      if (triggerTimer.current) clearTimeout(triggerTimer.current);
    };
  }, []);

  const saveWorkflow = useCallback((patch: { name?: string; trigger?: WorkflowTrigger }) => {
    if (!workflow) return;
    setSaveStatus('saving');
    updateWorkflow.mutate(
      { id: workflow.id, ...patch, updatedAt: workflow.updatedAt },
      {
        onSuccess: () => setSaveStatus('saved'),
        onError: () => {
          setSaveStatus('error');
          addToast({ type: 'error', message: t('crm.automations.editor.saveFailed') });
        },
      },
    );
  }, [workflow, updateWorkflow, addToast, t]);

  const onNameChange = (v: string) => {
    setName(v);
    setSaveStatus('saving');
    if (nameTimer.current) clearTimeout(nameTimer.current);
    nameTimer.current = setTimeout(() => saveWorkflow({ name: v }), SAVE_DEBOUNCE_MS);
  };

  const onTriggerChange = (v: string) => {
    const next = v as WorkflowTrigger;
    setTrigger(next);
    setSaveStatus('saving');
    // Clear conditions that reference fields no longer available under the new trigger.
    if (workflow) {
      const allowed = new Set(TRIGGER_AVAILABLE_FIELDS[next]);
      let cleared = 0;
      for (const step of workflow.steps) {
        if (step.condition && !allowed.has(step.condition.field)) {
          updateStep.mutate({ stepId: step.id, patch: { condition: null } });
          cleared++;
        }
      }
      if (cleared > 0) addToast({ type: 'info', message: t('crm.automations.editor.conditionsCleared', { count: cleared }) });
    }
    if (triggerTimer.current) clearTimeout(triggerTimer.current);
    triggerTimer.current = setTimeout(() => saveWorkflow({ trigger: next }), SAVE_DEBOUNCE_MS);
  };

  const handleAddStep = () => {
    addStep.mutate({ action: 'create_task', actionConfig: { taskTitle: '' } });
  };

  const handleStepChange = (stepId: string, patch: Partial<{ action: string; actionConfig: Record<string, unknown>; condition: StepCondition | null }>) => {
    setSaveStatus('saving');
    updateStep.mutate({ stepId, patch }, {
      onSuccess: () => setSaveStatus('saved'),
      onError: () => {
        setSaveStatus('error');
        addToast({ type: 'error', message: t('crm.automations.editor.saveFailed') });
      },
    });
  };

  const handleDuplicateStep = (step: CrmWorkflowStep) => {
    addStep.mutate({ action: step.action, actionConfig: { ...step.actionConfig }, condition: step.condition });
  };

  const handleDeleteStep = (stepId: string) => {
    if (!workflow || workflow.steps.length <= 1) return;
    deleteStep.mutate(stepId);
  };

  const handleDrop = (targetStepId: string) => {
    if (!workflow || !draggedStepId || draggedStepId === targetStepId) return;
    const ids = workflow.steps.map((s) => s.id);
    const from = ids.indexOf(draggedStepId);
    const to = ids.indexOf(targetStepId);
    if (from < 0 || to < 0) return;
    ids.splice(from, 1);
    ids.splice(to, 0, draggedStepId);
    reorderSteps.mutate(ids);
    setDraggedStepId(null);
  };

  const triggerOptions = useMemo(() => getTriggerOptions(t), [t]);

  if (isLoading || !workflow) {
    return <div style={{ padding: 'var(--spacing-2xl)', color: 'var(--color-text-tertiary)' }}>{t('common.loading')}</div>;
  }

  const header = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', height: 44, padding: '0 var(--spacing-lg)' }}>
      <Button variant="ghost" size="sm" icon={<ArrowLeft size={14} />} onClick={onBack}>{t('common.back')}</Button>
      <Input size="sm" value={name} onChange={(e) => onNameChange(e.target.value)} style={{ maxWidth: 320 }} />
      <div style={{ flex: 1 }} />
      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
        {saveStatus === 'saving' ? t('crm.automations.editor.saving') :
         saveStatus === 'saved' ? t('crm.automations.editor.saved') :
         saveStatus === 'error' ? t('crm.automations.editor.saveFailed') : ''}
      </span>
      <Button variant={workflow.isActive ? 'primary' : 'secondary'} size="sm" onClick={() => toggleWorkflow.mutate(workflow.id)}>
        {workflow.isActive ? t('crm.automations.disable') : t('crm.automations.enable')}
      </Button>
      <Button variant="ghost" size="sm" icon={<Trash2 size={14} />} onClick={() => setDeleteConfirm(true)} />
    </div>
  );

  return (
    <ContentArea headerSlot={header}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: 'var(--spacing-2xl)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)' }}>
        <section>
          <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-sm)' }}>
            {t('crm.automations.editor.triggerSection')}
          </div>
          <div style={{ border: '1px solid var(--color-border-primary)', borderRadius: 'var(--radius-md)', padding: 'var(--spacing-md)' }}>
            <Select size="sm" value={trigger} onChange={onTriggerChange} options={triggerOptions} />
          </div>
        </section>

        <section>
          <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-sm)' }}>
            {t('crm.automations.editor.stepsSection')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
            {workflow.steps.map((step, idx) => (
              <StepCard
                key={step.id}
                step={step}
                position={idx + 1}
                trigger={trigger}
                stages={stages}
                canDelete={workflow.steps.length > 1}
                onChange={(patch) => handleStepChange(step.id, patch)}
                onDuplicate={() => handleDuplicateStep(step)}
                onDelete={() => handleDeleteStep(step.id)}
                onDragStart={() => setDraggedStepId(step.id)}
                onDragEnd={() => setDraggedStepId(null)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); handleDrop(step.id); }}
              />
            ))}
          </div>
          <div style={{ marginTop: 'var(--spacing-sm)' }}>
            <Button variant="ghost" size="sm" icon={<Plus size={14} />} onClick={handleAddStep}>
              {t('crm.automations.editor.addStep')}
            </Button>
          </div>
        </section>
      </div>

      <ConfirmDialog
        open={deleteConfirm}
        onOpenChange={setDeleteConfirm}
        title={t('crm.automations.editor.deleteWorkflow')}
        description={t('crm.automations.editor.deleteWorkflowDesc')}
        confirmLabel={t('crm.actions.delete')}
        destructive
        onConfirm={() => {
          deleteWorkflow.mutate(workflow.id, { onSuccess: () => navigate(-1) });
          setDeleteConfirm(false);
        }}
      />
    </ContentArea>
  );
}
