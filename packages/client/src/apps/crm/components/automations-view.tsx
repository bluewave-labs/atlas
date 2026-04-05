import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Zap, Sparkles } from 'lucide-react';
import {
  useWorkflows, useCreateWorkflow, useDeleteWorkflow, useToggleWorkflow,
  useSeedExampleWorkflows,
  type CrmWorkflow, type CrmDealStage,
} from '../hooks';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Select } from '../../../components/ui/select';
import { Modal } from '../../../components/ui/modal';
import { Badge } from '../../../components/ui/badge';
import { ConfirmDialog } from '../../../components/ui/confirm-dialog';
import { AlertBanner } from '../../../components/ui/alert-banner';

// ─── Constants ────────────────────────────────────────────────────

function getTriggerOptions(t: (key: string) => string) {
  return [
    { value: 'deal_stage_changed', label: t('crm.automations.triggerDealStageChanged') },
    { value: 'deal_created', label: t('crm.automations.triggerDealCreated') },
    { value: 'deal_won', label: t('crm.automations.triggerDealWon') },
    { value: 'deal_lost', label: t('crm.automations.triggerDealLost') },
    { value: 'contact_created', label: t('crm.automations.triggerContactCreated') },
    { value: 'activity_logged', label: t('crm.automations.triggerActivityLogged') },
  ];
}

function getActionOptions(t: (key: string) => string) {
  return [
    { value: 'create_task', label: t('crm.automations.actionCreateTask') },
    { value: 'update_field', label: t('crm.automations.actionUpdateField') },
    { value: 'change_deal_stage', label: t('crm.automations.actionChangeDealStage') },
    { value: 'add_tag', label: t('crm.automations.actionAddTag') },
    { value: 'assign_user', label: t('crm.automations.actionAssignUser') },
    { value: 'log_activity', label: t('crm.automations.actionLogActivity') },
    { value: 'send_notification', label: t('crm.automations.actionSendNotification') },
  ];
}

function getActivityTypeOptions(t: (key: string) => string) {
  return [
    { value: '', label: t('crm.automations.anyType') },
    { value: 'note', label: t('crm.activities.note') },
    { value: 'call', label: t('crm.activities.call') },
    { value: 'meeting', label: t('crm.activities.meeting') },
    { value: 'email', label: t('crm.activities.email') },
  ];
}

function getFieldOptions(t: (key: string) => string) {
  return [
    { value: 'probability', label: t('crm.deals.probability') },
    { value: 'value', label: t('crm.deals.value') },
    { value: 'title', label: t('crm.deals.title') },
  ];
}

// ─── Helpers ──────────────────────────────────────────────────────

function getTriggerLabel(trigger: string, t: (key: string) => string): string {
  return getTriggerOptions(t).find((o) => o.value === trigger)?.label ?? trigger;
}

function getActionLabel(action: string, t: (key: string) => string): string {
  return getActionOptions(t).find((a) => a.value === action)?.label ?? action;
}

function describeTrigger(workflow: CrmWorkflow, stages: CrmDealStage[], t: (key: string) => string): string {
  const base = getTriggerLabel(workflow.trigger, t);
  const config = workflow.triggerConfig;

  if (workflow.trigger === 'deal_stage_changed') {
    const fromName = config.fromStage ? stages.find((s) => s.id === config.fromStage)?.name : null;
    const toName = config.toStage ? stages.find((s) => s.id === config.toStage)?.name : null;
    if (fromName && toName) return `${base}: "${fromName}" → "${toName}"`;
    if (toName) return `${base}: → "${toName}"`;
    if (fromName) return `${base}: "${fromName}" →`;
    return base;
  }

  if (workflow.trigger === 'activity_logged' && config.activityType) {
    return `${config.activityType} ${t('crm.automations.triggerActivityLogged').toLowerCase()}`;
  }

  return base;
}

function describeAction(workflow: CrmWorkflow, stages: CrmDealStage[], t: (key: string) => string): string {
  const config = workflow.actionConfig;

  switch (workflow.action) {
    case 'create_task':
      return `${t('crm.automations.actionCreateTask')}: "${config.taskTitle || ''}"`;
    case 'update_field':
      return `${t('crm.automations.actionUpdateField')}: ${config.fieldName || ''} = "${config.fieldValue || ''}"`;
    case 'change_deal_stage': {
      const stageName = stages.find((s) => s.id === config.newStageId)?.name ?? '';
      return `${t('crm.automations.actionChangeDealStage')}: "${stageName}"`;
    }
    case 'add_tag':
      return `${t('crm.automations.actionAddTag')}: "${config.tag || ''}"`;
    case 'assign_user':
      return `${t('crm.automations.actionAssignUser')}: ${config.assignedUserId || ''}`;
    case 'log_activity':
      return `${t('crm.automations.actionLogActivity')}: "${config.body || ''}"`;
    case 'send_notification':
      return `${t('crm.automations.actionSendNotification')}: "${config.message || ''}"`;
    default:
      return getActionLabel(workflow.action, t);
  }
}

// ─── Create Modal ─────────────────────────────────────────────────

function CreateWorkflowModal({
  open,
  onClose,
  stages,
}: {
  open: boolean;
  onClose: () => void;
  stages: CrmDealStage[];
}) {
  const { t } = useTranslation();
  const createWorkflow = useCreateWorkflow();

  const [name, setName] = useState('');
  const [trigger, setTrigger] = useState('deal_stage_changed');
  const [action, setAction] = useState('create_task');

  // Trigger config
  const [fromStage, setFromStage] = useState('');
  const [toStage, setToStage] = useState('');
  const [activityType, setActivityType] = useState('');

  // Action config
  const [taskTitle, setTaskTitle] = useState('');
  const [fieldName, setFieldName] = useState('probability');
  const [fieldValue, setFieldValue] = useState('');
  const [newStageId, setNewStageId] = useState('');
  const [tagValue, setTagValue] = useState('');
  const [assignedUserId, setAssignedUserId] = useState('');
  const [logActivityType, setLogActivityType] = useState('note');
  const [logActivityBody, setLogActivityBody] = useState('');
  const [notificationMessage, setNotificationMessage] = useState('');

  const stageOptions = [
    { value: '', label: t('crm.automations.anyStage') },
    ...stages.map((s) => ({ value: s.id, label: s.name })),
  ];

  const stageOptionsRequired = stages.map((s) => ({ value: s.id, label: s.name }));

  const handleSubmit = () => {
    if (!name.trim()) return;

    const triggerConfig: Record<string, unknown> = {};
    if (trigger === 'deal_stage_changed') {
      if (fromStage) triggerConfig.fromStage = fromStage;
      if (toStage) triggerConfig.toStage = toStage;
    }
    if (trigger === 'activity_logged' && activityType) {
      triggerConfig.activityType = activityType;
    }

    const actionConfig: Record<string, unknown> = {};
    if (action === 'create_task') {
      actionConfig.taskTitle = taskTitle || 'Automated task';
    }
    if (action === 'update_field') {
      actionConfig.fieldName = fieldName;
      actionConfig.fieldValue = fieldValue;
    }
    if (action === 'change_deal_stage') {
      actionConfig.newStageId = newStageId;
    }
    if (action === 'add_tag') {
      actionConfig.tag = tagValue || 'tag';
    }
    if (action === 'assign_user') {
      actionConfig.assignedUserId = assignedUserId;
    }
    if (action === 'log_activity') {
      actionConfig.activityType = logActivityType;
      actionConfig.body = logActivityBody;
    }
    if (action === 'send_notification') {
      actionConfig.message = notificationMessage;
    }

    createWorkflow.mutate(
      { name: name.trim(), trigger, triggerConfig, action, actionConfig },
      {
        onSuccess: () => {
          onClose();
          resetForm();
        },
      },
    );
  };

  const resetForm = () => {
    setName('');
    setTrigger('deal_stage_changed');
    setAction('create_task');
    setFromStage('');
    setToStage('');
    setActivityType('');
    setTaskTitle('');
    setFieldName('probability');
    setFieldValue('');
    setNewStageId('');
    setTagValue('');
    setAssignedUserId('');
    setLogActivityType('note');
    setLogActivityBody('');
    setNotificationMessage('');
  };

  return (
    <Modal open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <Modal.Header title={t('crm.automations.newAutomation')} />
      <Modal.Body>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
          <Input
            label={t('crm.automations.name')}
            placeholder={t('crm.automations.namePlaceholder')}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <div>
            <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-xs)' }}>{t('crm.automations.whenThisHappens')}</div>
            <Select
              value={trigger}
              onChange={(val) => setTrigger(val)}
              options={getTriggerOptions(t)}
            />
          </div>

          {/* Trigger config */}
          {trigger === 'deal_stage_changed' && (
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-xs)' }}>{t('crm.automations.fromStage')}</div>
                <Select
                  value={fromStage}
                  onChange={(val) => setFromStage(val)}
                  options={stageOptions}
                />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-xs)' }}>{t('crm.automations.toStage')}</div>
                <Select
                  value={toStage}
                  onChange={(val) => setToStage(val)}
                  options={stageOptions}
                />
              </div>
            </div>
          )}

          {trigger === 'activity_logged' && (
            <div>
              <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-xs)' }}>{t('crm.automations.activityType')}</div>
              <Select
                value={activityType}
                onChange={(val) => setActivityType(val)}
                options={getActivityTypeOptions(t)}
              />
            </div>
          )}

          <div style={{ borderTop: '1px solid var(--color-border-primary)', margin: 'var(--spacing-xs) 0' }} />

          <div>
            <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-xs)' }}>{t('crm.automations.thenDoThis')}</div>
            <Select
              value={action}
              onChange={(val) => setAction(val)}
              options={getActionOptions(t)}
            />
          </div>

          {/* Action config */}
          {action === 'create_task' && (
            <Input
              label={t('crm.automations.taskTitle')}
              placeholder={t('crm.automations.taskTitlePlaceholder')}
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
            />
          )}

          {action === 'update_field' && (
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-xs)' }}>{t('crm.automations.field')}</div>
                <Select
                  value={fieldName}
                  onChange={(val) => setFieldName(val)}
                  options={getFieldOptions(t)}
                />
              </div>
              <div style={{ flex: 1 }}>
                <Input
                  label={t('crm.automations.newValue')}
                  placeholder={t('crm.automations.newValuePlaceholder')}
                  value={fieldValue}
                  onChange={(e) => setFieldValue(e.target.value)}
                />
              </div>
            </div>
          )}

          {action === 'change_deal_stage' && (
            <div>
              <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-xs)' }}>{t('crm.automations.newStage')}</div>
              <Select
                value={newStageId}
                onChange={(val) => setNewStageId(val)}
                options={stageOptionsRequired}
              />
            </div>
          )}

          {action === 'add_tag' && (
            <Input
              label={t('crm.automations.tagToAdd')}
              placeholder={t('crm.automations.tagPlaceholder')}
              value={tagValue}
              onChange={(e) => setTagValue(e.target.value)}
            />
          )}

          {action === 'assign_user' && (
            <Input
              label={t('crm.automations.userId')}
              placeholder={t('crm.automations.userIdPlaceholder')}
              value={assignedUserId}
              onChange={(e) => setAssignedUserId(e.target.value)}
            />
          )}

          {action === 'log_activity' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
              <div>
                <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-xs)' }}>{t('crm.automations.activityType')}</div>
                <Select
                  value={logActivityType}
                  onChange={(val) => setLogActivityType(val)}
                  options={[
                    { value: 'note', label: t('crm.activities.note') },
                    { value: 'call', label: t('crm.activities.call') },
                    { value: 'meeting', label: t('crm.activities.meeting') },
                    { value: 'email', label: t('crm.activities.email') },
                  ]}
                />
              </div>
              <Input
                label={t('crm.automations.activityBody')}
                placeholder={t('crm.automations.activityBodyPlaceholder')}
                value={logActivityBody}
                onChange={(e) => setLogActivityBody(e.target.value)}
              />
            </div>
          )}

          {action === 'send_notification' && (
            <Input
              label={t('crm.automations.notificationMessage')}
              placeholder={t('crm.automations.notificationPlaceholder')}
              value={notificationMessage}
              onChange={(e) => setNotificationMessage(e.target.value)}
            />
          )}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" size="sm" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={handleSubmit}
          disabled={!name.trim() || createWorkflow.isPending}
        >
          {createWorkflow.isPending ? t('common.loading') : t('crm.automations.newAutomation')}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

// ─── Main View ────────────────────────────────────────────────────

export function AutomationsView({ stages }: { stages: CrmDealStage[] }) {
  const { t } = useTranslation();
  const { data: workflowsData, isLoading } = useWorkflows();
  const workflows = workflowsData?.workflows ?? [];
  const toggleWorkflow = useToggleWorkflow();
  const deleteWorkflow = useDeleteWorkflow();
  const seedWorkflows = useSeedExampleWorkflows();

  const [showCreate, setShowCreate] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Auto-seed example workflows on first visit if none exist
  const hasSeeded = useRef(false);
  useEffect(() => {
    if (!isLoading && workflows.length === 0 && !hasSeeded.current && !seedWorkflows.isPending) {
      hasSeeded.current = true;
      seedWorkflows.mutate();
    }
  }, [isLoading, workflows.length, seedWorkflows]);

  if (isLoading) {
    return (
      <div style={{ padding: 'var(--spacing-2xl)', color: 'var(--color-text-tertiary)' }}>
        {t('common.loading')}
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 'var(--spacing-2xl)' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 'var(--spacing-xl)',
      }}>
        <div>
          <div style={{
            fontSize: 'var(--font-size-md)',
            fontWeight: 'var(--font-weight-medium)',
            color: 'var(--color-text-primary)',
          }}>
            {t('crm.automations.title')}
          </div>
          <div style={{
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-tertiary)',
            marginTop: 2,
          }}>
            {t('crm.automations.subtitle')}
          </div>
        </div>
        <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => setShowCreate(true)}>
          {t('crm.automations.newAutomation')}
        </Button>
      </div>

      {/* Automation status info */}
      {workflows.length > 0 && (
        <AlertBanner variant="info" style={{ marginBottom: 'var(--spacing-md)' }}>
          {t('crm.automations.executionNote')}
        </AlertBanner>
      )}

      {/* Workflow list */}
      {workflows.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: 'var(--spacing-2xl) 0',
          color: 'var(--color-text-tertiary)',
        }}>
          <Zap size={40} style={{ opacity: 0.3, marginBottom: 'var(--spacing-sm)' }} />
          <div style={{ fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-secondary)' }}>
            {t('crm.automations.noAutomations')}
          </div>
          <div style={{ fontSize: 'var(--font-size-sm)', marginTop: 4, color: 'var(--color-text-tertiary)' }}>
            {t('crm.automations.noAutomationsDesc')}
          </div>
          <div style={{ marginTop: 'var(--spacing-md)' }}>
            <Button
              variant="secondary"
              size="sm"
              icon={<Sparkles size={14} />}
              onClick={() => seedWorkflows.mutate()}
              disabled={seedWorkflows.isPending}
            >
              {seedWorkflows.isPending ? t('common.loading') : t('crm.automations.seedExamples')}
            </Button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
          {workflows.map((workflow) => (
            <div
              key={workflow.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-md)',
                padding: 'var(--spacing-md) var(--spacing-lg)',
                border: '1px solid var(--color-border-primary)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: workflow.isActive ? 'var(--color-bg-primary)' : 'var(--color-bg-secondary)',
                opacity: workflow.isActive ? 1 : 0.7,
              }}
            >
              {/* Icon */}
              <div style={{
                width: 32,
                height: 32,
                borderRadius: 'var(--radius-md)',
                backgroundColor: workflow.isActive ? 'var(--color-accent-primary)' : 'var(--color-bg-tertiary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Zap size={14} color={workflow.isActive ? '#fff' : 'var(--color-text-tertiary)'} />
              </div>

              {/* Description */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 'var(--font-weight-medium)',
                  color: 'var(--color-text-primary)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {workflow.name}
                </div>
                <div style={{
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-text-tertiary)',
                  marginTop: 2,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {describeTrigger(workflow, stages, t)} &rarr; {describeAction(workflow, stages, t)}
                </div>
              </div>

              {/* Execution count */}
              <span style={{ flexShrink: 0 }}>
                <Badge variant="default">
                  {workflow.executionCount} {t('crm.automations.runs')}
                </Badge>
              </span>

              {/* Toggle */}
              <button
                onClick={() => toggleWorkflow.mutate(workflow.id)}
                style={{
                  position: 'relative',
                  width: 36,
                  height: 20,
                  borderRadius: 10,
                  border: 'none',
                  backgroundColor: workflow.isActive ? 'var(--color-accent-primary)' : 'var(--color-bg-tertiary)',
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition: 'background-color 0.2s',
                }}
                title={workflow.isActive ? t('crm.automations.disable') : t('crm.automations.enable')}
              >
                <span style={{
                  position: 'absolute',
                  top: 2,
                  left: workflow.isActive ? 18 : 2,
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  backgroundColor: '#fff',
                  transition: 'left 0.2s',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                }} />
              </button>

              {/* Delete */}
              <button
                onClick={() => setDeleteId(workflow.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 4,
                  color: 'var(--color-text-tertiary)',
                  flexShrink: 0,
                  borderRadius: 'var(--radius-sm)',
                }}
                title={t('crm.actions.delete')}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Create modal */}
      <CreateWorkflowModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        stages={stages}
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => { if (!open) setDeleteId(null); }}
        title={t('crm.actions.delete')}
        description={t('crm.bulk.deleteDescription')}
        confirmLabel={t('crm.actions.delete')}
        destructive
        onConfirm={() => {
          if (deleteId) deleteWorkflow.mutate(deleteId);
          setDeleteId(null);
        }}
      />
    </div>
  );
}
