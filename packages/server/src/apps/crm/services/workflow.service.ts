import { db } from '../../../config/database';
import {
  crmWorkflows,
  crmWorkflowSteps,
  crmDeals,
  crmContacts,
  crmCompanies,
  crmActivities,
  userSettings,
  notifications,
} from '../../../db/schema';
import { tasks as tasksTable } from '../../../db/schema';
import { eq, and, asc, desc, sql, inArray } from 'drizzle-orm';
import { logger } from '../../../utils/logger';
import { resolveMaybeKey, i18nKey, I18N_KEY_PREFIX } from '../../../utils/i18n';
import { getAccountIdForUser } from '../../../utils/account-lookup';
import type {
  StepCondition,
  StepConditionOperator,
  WorkflowAction,
  WorkflowTrigger,
} from '@atlas-platform/shared';
import { CONDITION_FIELD_TYPES } from '@atlas-platform/shared';

// ─── Seed i18n key catalog ──────────────────────────────────────────
// Every seeded workflow below uses `__i18n:` prefixed keys instead of literal
// English strings. Translations live in packages/client/src/i18n/locales/*.json
// under crm.workflows.seeds.{names|taskTitles|bodies|tags}.
//
//   name key                                            | taskTitle / body / tag key
//   ----------------------------------------------------|----------------------------------------------------
//   crm.workflows.seeds.names.qualifiedScheduleDemo     | crm.workflows.seeds.taskTitles.scheduleDiscoveryCall
//   crm.workflows.seeds.names.proposalPrepareDocument   | crm.workflows.seeds.taskTitles.prepareAndSendProposal
//   crm.workflows.seeds.names.wonWelcomeTask            | crm.workflows.seeds.taskTitles.sendWelcomePackage
//   crm.workflows.seeds.names.wonSetProbability         | (update_field, no translatable string)
//   crm.workflows.seeds.names.wonTagCustomer            | crm.workflows.seeds.tags.customer
//   crm.workflows.seeds.names.lostReviewTask            | crm.workflows.seeds.taskTitles.scheduleDealLossReview
//   crm.workflows.seeds.names.lostLogActivity           | crm.workflows.seeds.bodies.dealWasLost
//   crm.workflows.seeds.names.newContactIntroEmail      | crm.workflows.seeds.taskTitles.sendIntroductionEmail
//   crm.workflows.seeds.names.callLoggedFollowUp        | crm.workflows.seeds.taskTitles.sendFollowUpAfterCall
//   crm.workflows.seeds.names.meetingLoggedNotes        | crm.workflows.seeds.taskTitles.writeMeetingNotes

// ─── Input types ────────────────────────────────────────────────────

interface StepInput {
  action: WorkflowAction;
  actionConfig: Record<string, unknown>;
  condition?: StepCondition | null;
}

interface CreateWorkflowInput {
  name: string;
  trigger: WorkflowTrigger;
  triggerConfig?: Record<string, unknown>;
  steps: StepInput[];
}

interface UpdateWorkflowInput {
  name?: string;
  trigger?: WorkflowTrigger;
  triggerConfig?: Record<string, unknown>;
  isActive?: boolean;
}

export interface WorkflowWithSteps {
  id: string;
  tenantId: string;
  userId: string;
  name: string;
  trigger: string;
  triggerConfig: Record<string, unknown>;
  isActive: boolean;
  executionCount: number;
  lastExecutedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  steps: Array<{
    id: string;
    workflowId: string;
    position: number;
    action: string;
    actionConfig: Record<string, unknown>;
    condition: StepCondition | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
}

// ─── Workflow CRUD ──────────────────────────────────────────────────

export async function listWorkflows(userId: string, tenantId: string): Promise<WorkflowWithSteps[]> {
  const workflows = await db
    .select()
    .from(crmWorkflows)
    .where(and(eq(crmWorkflows.userId, userId), eq(crmWorkflows.tenantId, tenantId)))
    .orderBy(desc(crmWorkflows.createdAt));

  if (workflows.length === 0) return [];

  const steps = await db
    .select()
    .from(crmWorkflowSteps)
    .where(inArray(crmWorkflowSteps.workflowId, workflows.map((w) => w.id)))
    .orderBy(asc(crmWorkflowSteps.position));

  const stepsByWorkflow = new Map<string, WorkflowWithSteps['steps']>();
  for (const s of steps) {
    const arr = stepsByWorkflow.get(s.workflowId) ?? [];
    arr.push(s as WorkflowWithSteps['steps'][number]);
    stepsByWorkflow.set(s.workflowId, arr);
  }

  return workflows.map((w) => ({
    ...w,
    steps: stepsByWorkflow.get(w.id) ?? [],
  }));
}

export async function getWorkflow(userId: string, workflowId: string): Promise<WorkflowWithSteps | null> {
  const [workflow] = await db
    .select()
    .from(crmWorkflows)
    .where(and(eq(crmWorkflows.id, workflowId), eq(crmWorkflows.userId, userId)))
    .limit(1);
  if (!workflow) return null;

  const steps = await db
    .select()
    .from(crmWorkflowSteps)
    .where(eq(crmWorkflowSteps.workflowId, workflowId))
    .orderBy(asc(crmWorkflowSteps.position));

  return { ...workflow, steps: steps as WorkflowWithSteps['steps'] };
}

export async function createWorkflow(
  userId: string,
  tenantId: string,
  input: CreateWorkflowInput,
): Promise<WorkflowWithSteps> {
  if (!input.steps || input.steps.length === 0) {
    throw new Error('Workflow must have at least one step');
  }
  const now = new Date();

  const [created] = await db
    .insert(crmWorkflows)
    .values({
      tenantId,
      userId,
      name: input.name,
      trigger: input.trigger,
      triggerConfig: input.triggerConfig ?? {},
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  const stepRows = input.steps.map((s, i) => ({
    workflowId: created.id,
    position: i,
    action: s.action,
    actionConfig: s.actionConfig,
    condition: s.condition ?? null,
    createdAt: now,
    updatedAt: now,
  }));
  await db.insert(crmWorkflowSteps).values(stepRows);

  logger.info({ userId, workflowId: created.id, stepCount: stepRows.length }, 'CRM workflow created');
  return (await getWorkflow(userId, created.id))!;
}

export async function updateWorkflow(
  userId: string,
  workflowId: string,
  input: UpdateWorkflowInput,
): Promise<WorkflowWithSteps | null> {
  const now = new Date();
  const updates: Record<string, unknown> = { updatedAt: now };

  if (input.name !== undefined) updates.name = input.name;
  if (input.trigger !== undefined) updates.trigger = input.trigger;
  if (input.triggerConfig !== undefined) updates.triggerConfig = input.triggerConfig;
  if (input.isActive !== undefined) updates.isActive = input.isActive;

  const [updated] = await db
    .update(crmWorkflows)
    .set(updates)
    .where(and(eq(crmWorkflows.id, workflowId), eq(crmWorkflows.userId, userId)))
    .returning();

  if (!updated) return null;

  const steps = await db
    .select()
    .from(crmWorkflowSteps)
    .where(eq(crmWorkflowSteps.workflowId, workflowId))
    .orderBy(asc(crmWorkflowSteps.position));

  return { ...updated, steps: steps as WorkflowWithSteps['steps'] };
}

export async function deleteWorkflow(userId: string, workflowId: string): Promise<void> {
  await db
    .delete(crmWorkflows)
    .where(and(eq(crmWorkflows.id, workflowId), eq(crmWorkflows.userId, userId)));
}

export async function toggleWorkflow(userId: string, workflowId: string): Promise<WorkflowWithSteps | null> {
  const [existing] = await db
    .select()
    .from(crmWorkflows)
    .where(and(eq(crmWorkflows.id, workflowId), eq(crmWorkflows.userId, userId)))
    .limit(1);
  if (!existing) return null;

  const [updated] = await db
    .update(crmWorkflows)
    .set({ isActive: !existing.isActive, updatedAt: new Date() })
    .where(eq(crmWorkflows.id, workflowId))
    .returning();

  if (!updated) return null;

  const steps = await db
    .select()
    .from(crmWorkflowSteps)
    .where(eq(crmWorkflowSteps.workflowId, workflowId))
    .orderBy(asc(crmWorkflowSteps.position));

  return { ...updated, steps: steps as WorkflowWithSteps['steps'] };
}

// ─── Step CRUD ──────────────────────────────────────────────────────

export async function appendStep(
  userId: string,
  workflowId: string,
  step: StepInput,
): Promise<WorkflowWithSteps['steps'][number] | null> {
  // Verify the workflow belongs to this user.
  const [workflow] = await db
    .select({ id: crmWorkflows.id })
    .from(crmWorkflows)
    .where(and(eq(crmWorkflows.id, workflowId), eq(crmWorkflows.userId, userId)))
    .limit(1);
  if (!workflow) return null;

  const [maxRow] = await db
    .select({ max: sql<number | null>`MAX(${crmWorkflowSteps.position})` })
    .from(crmWorkflowSteps)
    .where(eq(crmWorkflowSteps.workflowId, workflowId));
  const nextPosition = (maxRow?.max ?? -1) + 1;

  const now = new Date();
  const [inserted] = await db
    .insert(crmWorkflowSteps)
    .values({
      workflowId,
      position: nextPosition,
      action: step.action,
      actionConfig: step.actionConfig,
      condition: step.condition ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  // Bump the workflow's updatedAt for concurrency tracking.
  await db.update(crmWorkflows)
    .set({ updatedAt: now })
    .where(eq(crmWorkflows.id, workflowId));

  return inserted as WorkflowWithSteps['steps'][number];
}

export async function updateStep(
  userId: string,
  workflowId: string,
  stepId: string,
  patch: Partial<StepInput>,
): Promise<WorkflowWithSteps['steps'][number] | null> {
  // Ownership check via workflow.
  const [workflow] = await db
    .select({ id: crmWorkflows.id })
    .from(crmWorkflows)
    .where(and(eq(crmWorkflows.id, workflowId), eq(crmWorkflows.userId, userId)))
    .limit(1);
  if (!workflow) return null;

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.action !== undefined) updates.action = patch.action;
  if (patch.actionConfig !== undefined) updates.actionConfig = patch.actionConfig;
  if (patch.condition !== undefined) updates.condition = patch.condition;

  const [row] = await db.update(crmWorkflowSteps)
    .set(updates)
    .where(and(eq(crmWorkflowSteps.id, stepId), eq(crmWorkflowSteps.workflowId, workflowId)))
    .returning();

  await db.update(crmWorkflows)
    .set({ updatedAt: new Date() })
    .where(eq(crmWorkflows.id, workflowId));

  return (row ?? null) as WorkflowWithSteps['steps'][number] | null;
}

export async function deleteStep(
  userId: string,
  workflowId: string,
  stepId: string,
): Promise<{ deleted: boolean; error?: 'LAST_STEP' | 'NOT_FOUND' }> {
  const [workflow] = await db
    .select({ id: crmWorkflows.id })
    .from(crmWorkflows)
    .where(and(eq(crmWorkflows.id, workflowId), eq(crmWorkflows.userId, userId)))
    .limit(1);
  if (!workflow) return { deleted: false, error: 'NOT_FOUND' };

  const steps = await db.select({ id: crmWorkflowSteps.id, position: crmWorkflowSteps.position })
    .from(crmWorkflowSteps)
    .where(eq(crmWorkflowSteps.workflowId, workflowId))
    .orderBy(asc(crmWorkflowSteps.position));

  if (steps.length <= 1) return { deleted: false, error: 'LAST_STEP' };

  const target = steps.find((s) => s.id === stepId);
  if (!target) return { deleted: false, error: 'NOT_FOUND' };

  await db.delete(crmWorkflowSteps).where(eq(crmWorkflowSteps.id, stepId));

  // Close up position gaps.
  await db.execute(sql`
    UPDATE crm_workflow_steps
    SET position = position - 1, updated_at = now()
    WHERE workflow_id = ${workflowId} AND position > ${target.position}
  `);

  await db.update(crmWorkflows)
    .set({ updatedAt: new Date() })
    .where(eq(crmWorkflows.id, workflowId));

  return { deleted: true };
}

export async function reorderSteps(
  userId: string,
  workflowId: string,
  stepIds: string[],
): Promise<{ ok: boolean; error?: 'MISMATCH' | 'NOT_FOUND' }> {
  const [workflow] = await db
    .select({ id: crmWorkflows.id })
    .from(crmWorkflows)
    .where(and(eq(crmWorkflows.id, workflowId), eq(crmWorkflows.userId, userId)))
    .limit(1);
  if (!workflow) return { ok: false, error: 'NOT_FOUND' };

  const existing = await db.select({ id: crmWorkflowSteps.id })
    .from(crmWorkflowSteps)
    .where(eq(crmWorkflowSteps.workflowId, workflowId));

  if (existing.length !== stepIds.length) return { ok: false, error: 'MISMATCH' };
  const existingSet = new Set(existing.map((e) => e.id));
  for (const id of stepIds) if (!existingSet.has(id)) return { ok: false, error: 'MISMATCH' };

  // Two-phase update to avoid colliding with the unique (workflowId, position) index.
  // Transaction wraps both phases so a failure between them can't leave rows stranded
  // at the +1000 sentinel positions, which would break executor ordering.
  await db.transaction(async (tx) => {
    await tx.execute(sql`
      UPDATE crm_workflow_steps SET position = position + 1000, updated_at = now()
      WHERE workflow_id = ${workflowId}
    `);
    for (let i = 0; i < stepIds.length; i++) {
      await tx.update(crmWorkflowSteps)
        .set({ position: i, updatedAt: new Date() })
        .where(eq(crmWorkflowSteps.id, stepIds[i]));
    }
    await tx.update(crmWorkflows)
      .set({ updatedAt: new Date() })
      .where(eq(crmWorkflows.id, workflowId));
  });

  return { ok: true };
}

// ─── Executor ───────────────────────────────────────────────────────

type TriggerContext = Omit<Record<string, unknown>, '__resolved'>;

type RunContext = TriggerContext & {
  __resolved: {
    deal?: Record<string, unknown> | null;
    contact?: Record<string, unknown> | null;
    company?: Record<string, unknown> | null;
  };
};

export async function executeWorkflows(
  tenantId: string,
  userId: string,
  trigger: string,
  context: TriggerContext,
) {
  const workflows = await db
    .select()
    .from(crmWorkflows)
    .where(and(
      eq(crmWorkflows.tenantId, tenantId),
      eq(crmWorkflows.trigger, trigger),
      eq(crmWorkflows.isActive, true),
    ));

  if (workflows.length === 0) return;

  // Resolve the user's language once per run — it doesn't change between steps.
  const lang = await getUserLanguage(userId);

  for (const workflow of workflows) {
    try {
      if (!matchesTriggerConfig(workflow.triggerConfig, trigger, context)) continue;

      const steps = await db
        .select()
        .from(crmWorkflowSteps)
        .where(eq(crmWorkflowSteps.workflowId, workflow.id))
        .orderBy(asc(crmWorkflowSteps.position));

      const runCtx: RunContext = { ...context, __resolved: {} };

      for (const step of steps) {
        try {
          if (step.condition) {
            const pass = await evaluateCondition(step.condition, runCtx);
            if (!pass) {
              logger.debug({ workflowId: workflow.id, stepId: step.id, field: step.condition.field }, 'CRM workflow step skipped by condition');
              continue;
            }
          }
          await executeAction(userId, tenantId, step.action, step.actionConfig, runCtx, lang);
        } catch (err) {
          logger.error({ err, workflowId: workflow.id, stepId: step.id }, 'CRM workflow step failed');
        }
      }

      const now = new Date();
      await db
        .update(crmWorkflows)
        .set({
          executionCount: sql`${crmWorkflows.executionCount} + 1`,
          lastExecutedAt: now,
          updatedAt: now,
        })
        .where(eq(crmWorkflows.id, workflow.id));

      logger.info({ workflowId: workflow.id, trigger, stepCount: steps.length }, 'CRM workflow executed');
    } catch (err) {
      logger.error({ err, workflowId: workflow.id, trigger }, 'CRM workflow execution failed');
    }
  }
}

function matchesTriggerConfig(
  config: Record<string, unknown>,
  trigger: string,
  context: Record<string, unknown>,
): boolean {
  if (!config || Object.keys(config).length === 0) return true;
  if (trigger === 'deal_stage_changed') {
    if (config.fromStage && config.fromStage !== context.fromStage) return false;
    if (config.toStage && config.toStage !== context.toStage) return false;
  }
  if (trigger === 'activity_logged') {
    if (config.activityType && config.activityType !== context.activityType) return false;
  }
  return true;
}

// ─── Condition evaluation ──────────────────────────────────────────

async function resolveFieldPath(field: string, ctx: RunContext): Promise<unknown> {
  const [scope, prop] = field.split('.');
  if (!scope || !prop) return undefined;

  if (scope === 'trigger') {
    // Map allow-listed trigger.* fields back to the raw context keys.
    if (prop === 'fromStage') return ctx.fromStage;
    if (prop === 'toStage') return ctx.toStage;
    if (prop === 'activityType') return ctx.activityType;
    return undefined;
  }

  const resolved = ctx.__resolved;

  if (scope === 'deal') {
    if (!('deal' in resolved)) {
      const id = ctx.dealId as string | undefined;
      resolved.deal = id ? (await db.select().from(crmDeals).where(eq(crmDeals.id, id)).limit(1))[0] ?? null : null;
    }
    return resolved.deal ? (resolved.deal as Record<string, unknown>)[prop] : undefined;
  }

  if (scope === 'contact') {
    if (!('contact' in resolved)) {
      const id = ctx.contactId as string | undefined;
      resolved.contact = id ? (await db.select().from(crmContacts).where(eq(crmContacts.id, id)).limit(1))[0] ?? null : null;
    }
    return resolved.contact ? (resolved.contact as Record<string, unknown>)[prop] : undefined;
  }

  if (scope === 'company') {
    if (!('company' in resolved)) {
      const id = ctx.companyId as string | undefined;
      resolved.company = id ? (await db.select().from(crmCompanies).where(eq(crmCompanies.id, id)).limit(1))[0] ?? null : null;
    }
    return resolved.company ? (resolved.company as Record<string, unknown>)[prop] : undefined;
  }

  return undefined;
}

async function evaluateCondition(cond: StepCondition, ctx: RunContext): Promise<boolean> {
  // Reject unknown fields at runtime as a defense-in-depth: API validation
  // already rejects them, but a DB row written before a future change might slip through.
  if (!(cond.field in CONDITION_FIELD_TYPES)) {
    logger.warn({ field: cond.field }, 'CRM workflow condition references unknown field');
    return false;
  }

  const actual = await resolveFieldPath(cond.field, ctx);
  return compare(actual, cond.operator, cond.value);
}

export function compare(actual: unknown, op: StepConditionOperator, expected: unknown): boolean {
  const isEmpty = (v: unknown) =>
    v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);

  switch (op) {
    case 'is_empty': return isEmpty(actual);
    case 'is_not_empty': return !isEmpty(actual);
    case 'eq': return actual === expected;
    case 'neq': return actual !== expected;
    case 'gt': case 'gte': case 'lt': case 'lte': {
      if (typeof actual !== 'number' || typeof expected !== 'number') return false;
      if (op === 'gt') return actual > expected;
      if (op === 'gte') return actual >= expected;
      if (op === 'lt') return actual < expected;
      return actual <= expected;
    }
    case 'contains': {
      if (Array.isArray(actual)) return actual.includes(expected as never);
      if (typeof actual === 'string' && typeof expected === 'string') return actual.includes(expected);
      return false;
    }
    case 'not_contains': {
      if (Array.isArray(actual)) return !actual.includes(expected as never);
      if (typeof actual === 'string' && typeof expected === 'string') return !actual.includes(expected);
      return false;
    }
    default:
      return false;
  }
}

async function getUserLanguage(userId: string): Promise<string> {
  try {
    const accountId = await getAccountIdForUser(userId);
    if (!accountId) return 'en';
    const [row] = await db
      .select({ language: userSettings.language })
      .from(userSettings)
      .where(eq(userSettings.accountId, accountId))
      .limit(1);
    return row?.language || 'en';
  } catch {
    return 'en';
  }
}

async function executeAction(
  userId: string,
  tenantId: string,
  action: string,
  actionConfig: Record<string, unknown>,
  context: Record<string, unknown>,
  lang: string,
) {
  switch (action) {
    case 'create_task': {
      const rawTitle = (actionConfig.taskTitle as string) || 'Automated task';
      const title = resolveMaybeKey(rawTitle, lang) || 'Automated task';
      const now = new Date();
      await db.insert(tasksTable).values({
        tenantId,
        userId,
        title,
        status: 'todo',
        when: 'inbox',
        priority: 'none',
        type: 'task',
        tags: [],
        sortOrder: 0,
        createdAt: now,
        updatedAt: now,
      });
      break;
    }
    case 'update_field': {
      const fieldName = actionConfig.fieldName as string;
      const fieldValue = actionConfig.fieldValue as string;
      const dealId = context.dealId as string | undefined;
      if (dealId && fieldName) {
        const now = new Date();
        const updates: Record<string, unknown> = { updatedAt: now };
        // Support common deal fields
        if (fieldName === 'probability') updates.probability = Number(fieldValue) || 0;
        else if (fieldName === 'value') updates.value = Number(fieldValue) || 0;
        else if (fieldName === 'title') updates.title = fieldValue;

        if (Object.keys(updates).length > 1) {
          await db.update(crmDeals).set(updates).where(eq(crmDeals.id, dealId));
        }
      }
      break;
    }
    case 'change_deal_stage': {
      const newStageId = actionConfig.newStageId as string;
      const dealId = context.dealId as string | undefined;
      if (dealId && newStageId) {
        const now = new Date();
        await db.update(crmDeals).set({ stageId: newStageId, updatedAt: now }).where(eq(crmDeals.id, dealId));
      }
      break;
    }
    case 'add_tag': {
      const rawTag = (actionConfig.tag as string) ?? '';
      const tag = resolveMaybeKey(rawTag, lang).trim();
      const dealId = context.dealId as string | undefined;
      const contactId = context.contactId as string | undefined;
      const companyId = context.companyId as string | undefined;
      if (tag) {
        const now = new Date();
        if (dealId) {
          const [deal] = await db.select().from(crmDeals).where(eq(crmDeals.id, dealId)).limit(1);
          if (deal) {
            const tags = Array.isArray(deal.tags) ? [...deal.tags] : [];
            if (!tags.includes(tag)) {
              tags.push(tag);
              await db.update(crmDeals).set({ tags, updatedAt: now }).where(eq(crmDeals.id, dealId));
            }
          }
        } else if (contactId) {
          const [contact] = await db.select().from(crmContacts).where(eq(crmContacts.id, contactId)).limit(1);
          if (contact) {
            const tags = Array.isArray(contact.tags) ? [...contact.tags] : [];
            if (!tags.includes(tag)) {
              tags.push(tag);
              await db.update(crmContacts).set({ tags, updatedAt: now }).where(eq(crmContacts.id, contactId));
            }
          }
        } else if (companyId) {
          const [company] = await db.select().from(crmCompanies).where(eq(crmCompanies.id, companyId)).limit(1);
          if (company) {
            const tags = Array.isArray(company.tags) ? [...company.tags] : [];
            if (!tags.includes(tag)) {
              tags.push(tag);
              await db.update(crmCompanies).set({ tags, updatedAt: now }).where(eq(crmCompanies.id, companyId));
            }
          }
        }
      }
      break;
    }
    case 'assign_user': {
      const assignedUserId = actionConfig.assignedUserId as string | undefined;
      const dealId = context.dealId as string | undefined;
      if (dealId && assignedUserId) {
        const now = new Date();
        await db.update(crmDeals).set({ assignedUserId, updatedAt: now }).where(eq(crmDeals.id, dealId));
      }
      break;
    }
    case 'log_activity': {
      const activityType = (actionConfig.activityType as string) || 'note';
      const rawBody = (actionConfig.body as string) || '';
      const body = resolveMaybeKey(rawBody, lang);
      const dealId = context.dealId as string | undefined;
      const contactId = context.contactId as string | undefined;
      const companyId = context.companyId as string | undefined;
      const now = new Date();
      await db.insert(crmActivities).values({
        tenantId,
        userId,
        type: activityType,
        body,
        dealId: dealId ?? null,
        contactId: contactId ?? null,
        companyId: companyId ?? null,
        createdAt: now,
        updatedAt: now,
      });
      break;
    }
    case 'send_notification': {
      const message = resolveMaybeKey((actionConfig.message as string) || '', lang);
      const title = resolveMaybeKey(
        (actionConfig.title as string) || i18nKey('crm.workflows.notificationTitle'),
        lang,
      );
      if (message) {
        const now = new Date();
        const dealId = context.dealId as string | undefined;
        const contactId = context.contactId as string | undefined;
        const companyId = context.companyId as string | undefined;
        await db.insert(notifications).values({
          tenantId,
          userId,
          type: 'workflow',
          title,
          body: message,
          sourceType: dealId ? 'crm_deal' : contactId ? 'crm_contact' : companyId ? 'crm_company' : 'crm_workflow',
          sourceId: dealId || contactId || companyId || null,
          createdAt: now,
        });
      }
      break;
    }
  }
}

// ─── Seed Example Workflows ──────────────────────────────────────────

// ─── One-shot migration for existing English-literal seeded workflows ──

/**
 * Map of legacy English seed literals → `__i18n:` key replacements.
 * Idempotent: rows already using keys are skipped. Only exact string
 * matches are migrated; user-edited workflow names/strings are preserved.
 */
const SEED_NAME_MIGRATIONS: Record<string, string> = {
  'Qualified → Schedule demo': i18nKey('crm.workflows.seeds.names.qualifiedScheduleDemo'),
  'Proposal → Prepare document': i18nKey('crm.workflows.seeds.names.proposalPrepareDocument'),
  'Won → Welcome task': i18nKey('crm.workflows.seeds.names.wonWelcomeTask'),
  'Won → Set probability': i18nKey('crm.workflows.seeds.names.wonSetProbability'),
  'Won → Tag customer': i18nKey('crm.workflows.seeds.names.wonTagCustomer'),
  'Lost → Review task': i18nKey('crm.workflows.seeds.names.lostReviewTask'),
  'Lost → Log activity': i18nKey('crm.workflows.seeds.names.lostLogActivity'),
  'New contact → Intro email task': i18nKey('crm.workflows.seeds.names.newContactIntroEmail'),
  'Call logged → Follow up': i18nKey('crm.workflows.seeds.names.callLoggedFollowUp'),
  'Meeting logged → Notes': i18nKey('crm.workflows.seeds.names.meetingLoggedNotes'),
};

const SEED_TASK_TITLE_MIGRATIONS: Record<string, string> = {
  'Schedule discovery call with contact': i18nKey('crm.workflows.seeds.taskTitles.scheduleDiscoveryCall'),
  'Prepare and send proposal': i18nKey('crm.workflows.seeds.taskTitles.prepareAndSendProposal'),
  'Send welcome package to new customer': i18nKey('crm.workflows.seeds.taskTitles.sendWelcomePackage'),
  'Schedule deal loss review': i18nKey('crm.workflows.seeds.taskTitles.scheduleDealLossReview'),
  'Send introduction email': i18nKey('crm.workflows.seeds.taskTitles.sendIntroductionEmail'),
  'Send follow-up email after call': i18nKey('crm.workflows.seeds.taskTitles.sendFollowUpAfterCall'),
  'Write meeting notes and share with team': i18nKey('crm.workflows.seeds.taskTitles.writeMeetingNotes'),
};

const SEED_BODY_MIGRATIONS: Record<string, string> = {
  'Deal was lost. Review and follow up.': i18nKey('crm.workflows.seeds.bodies.dealWasLost'),
};

const SEED_TAG_MIGRATIONS: Record<string, string> = {
  customer: i18nKey('crm.workflows.seeds.tags.customer'),
};

export async function migrateSeedWorkflowsToKeys(tenantId: string): Promise<{ migrated: number }> {
  const workflowRows = await db
    .select()
    .from(crmWorkflows)
    .where(eq(crmWorkflows.tenantId, tenantId));

  if (workflowRows.length === 0) return { migrated: 0 };

  const allSteps = await db
    .select()
    .from(crmWorkflowSteps)
    .where(inArray(crmWorkflowSteps.workflowId, workflowRows.map((w) => w.id)));

  let migrated = 0;

  for (const row of workflowRows) {
    if (typeof row.name === 'string' && !row.name.startsWith(I18N_KEY_PREFIX)) {
      const replacement = SEED_NAME_MIGRATIONS[row.name];
      if (replacement) {
        await db.update(crmWorkflows)
          .set({ name: replacement, updatedAt: new Date() })
          .where(eq(crmWorkflows.id, row.id));
        migrated++;
      }
    }
  }

  for (const step of allSteps) {
    const config = (step.actionConfig ?? {}) as Record<string, unknown>;
    const nextConfig: Record<string, unknown> = { ...config };
    let changed = false;

    if (typeof config.taskTitle === 'string' && !config.taskTitle.startsWith(I18N_KEY_PREFIX)) {
      const r = SEED_TASK_TITLE_MIGRATIONS[config.taskTitle];
      if (r) { nextConfig.taskTitle = r; changed = true; }
    }
    if (typeof config.body === 'string' && !config.body.startsWith(I18N_KEY_PREFIX)) {
      const r = SEED_BODY_MIGRATIONS[config.body];
      if (r) { nextConfig.body = r; changed = true; }
    }
    if (typeof config.tag === 'string' && !config.tag.startsWith(I18N_KEY_PREFIX)) {
      const r = SEED_TAG_MIGRATIONS[config.tag];
      if (r) { nextConfig.tag = r; changed = true; }
    }

    if (changed) {
      await db.update(crmWorkflowSteps)
        .set({ actionConfig: nextConfig, updatedAt: new Date() })
        .where(eq(crmWorkflowSteps.id, step.id));
      migrated++;
    }
  }

  if (migrated > 0) {
    logger.info({ tenantId, migrated }, 'Migrated legacy seed workflows to i18n keys');
  }
  return { migrated };
}

export async function seedExampleWorkflows(userId: string, tenantId: string) {
  // Idempotency guard — skip if workflows already exist for this account.
  // If they do exist, opportunistically migrate any English-literal seed rows
  // to translation keys (idempotent — user-edited names are left alone).
  const existing = await db.select({ id: crmWorkflows.id }).from(crmWorkflows)
    .where(and(eq(crmWorkflows.userId, userId), eq(crmWorkflows.tenantId, tenantId))).limit(1);
  if (existing.length > 0) {
    const migrationResult = await migrateSeedWorkflowsToKeys(tenantId);
    return { skipped: true, ...migrationResult };
  }

  // Look up stages by name for this account
  const { crmDealStages } = await import('../../../db/schema');
  const stages = await db.select().from(crmDealStages)
    .where(eq(crmDealStages.tenantId, tenantId))
    .orderBy(asc(crmDealStages.sequence));

  const stageByName: Record<string, string> = {};
  for (const s of stages) {
    stageByName[s.name.toLowerCase()] = s.id;
  }

  const qualifiedId = stageByName['qualified'] ?? '';
  const proposalId = stageByName['proposal'] ?? '';

  const workflows: Array<{
    name: string;
    trigger: WorkflowTrigger;
    triggerConfig: Record<string, unknown>;
    steps: Array<{ action: WorkflowAction; actionConfig: Record<string, unknown> }>;
  }> = [
    {
      name: i18nKey('crm.workflows.seeds.names.qualifiedScheduleDemo'),
      trigger: 'deal_stage_changed',
      triggerConfig: qualifiedId ? { toStage: qualifiedId } : {},
      steps: [{
        action: 'create_task',
        actionConfig: { taskTitle: i18nKey('crm.workflows.seeds.taskTitles.scheduleDiscoveryCall') },
      }],
    },
    {
      name: i18nKey('crm.workflows.seeds.names.proposalPrepareDocument'),
      trigger: 'deal_stage_changed',
      triggerConfig: proposalId ? { toStage: proposalId } : {},
      steps: [{
        action: 'create_task',
        actionConfig: { taskTitle: i18nKey('crm.workflows.seeds.taskTitles.prepareAndSendProposal') },
      }],
    },
    {
      name: i18nKey('crm.workflows.seeds.names.wonWelcomeTask'),
      trigger: 'deal_won',
      triggerConfig: {},
      steps: [{
        action: 'create_task',
        actionConfig: { taskTitle: i18nKey('crm.workflows.seeds.taskTitles.sendWelcomePackage') },
      }],
    },
    {
      name: i18nKey('crm.workflows.seeds.names.wonSetProbability'),
      trigger: 'deal_won',
      triggerConfig: {},
      steps: [{
        action: 'update_field',
        actionConfig: { fieldName: 'probability', fieldValue: '100' },
      }],
    },
    {
      name: i18nKey('crm.workflows.seeds.names.wonTagCustomer'),
      trigger: 'deal_won',
      triggerConfig: {},
      steps: [{
        action: 'add_tag',
        actionConfig: { tag: i18nKey('crm.workflows.seeds.tags.customer') },
      }],
    },
    {
      name: i18nKey('crm.workflows.seeds.names.lostReviewTask'),
      trigger: 'deal_lost',
      triggerConfig: {},
      steps: [{
        action: 'create_task',
        actionConfig: { taskTitle: i18nKey('crm.workflows.seeds.taskTitles.scheduleDealLossReview') },
      }],
    },
    {
      name: i18nKey('crm.workflows.seeds.names.lostLogActivity'),
      trigger: 'deal_lost',
      triggerConfig: {},
      steps: [{
        action: 'log_activity',
        actionConfig: { activityType: 'note', body: i18nKey('crm.workflows.seeds.bodies.dealWasLost') },
      }],
    },
    {
      name: i18nKey('crm.workflows.seeds.names.newContactIntroEmail'),
      trigger: 'contact_created',
      triggerConfig: {},
      steps: [{
        action: 'create_task',
        actionConfig: { taskTitle: i18nKey('crm.workflows.seeds.taskTitles.sendIntroductionEmail') },
      }],
    },
    {
      name: i18nKey('crm.workflows.seeds.names.callLoggedFollowUp'),
      trigger: 'activity_logged',
      triggerConfig: { activityType: 'call' },
      steps: [{
        action: 'create_task',
        actionConfig: { taskTitle: i18nKey('crm.workflows.seeds.taskTitles.sendFollowUpAfterCall') },
      }],
    },
    {
      name: i18nKey('crm.workflows.seeds.names.meetingLoggedNotes'),
      trigger: 'activity_logged',
      triggerConfig: { activityType: 'meeting' },
      steps: [{
        action: 'create_task',
        actionConfig: { taskTitle: i18nKey('crm.workflows.seeds.taskTitles.writeMeetingNotes') },
      }],
    },
  ];

  let created = 0;
  for (const wf of workflows) {
    await createWorkflow(userId, tenantId, wf);
    created++;
  }

  logger.info({ userId, tenantId, created }, 'Seeded CRM example workflows');
  return { created };
}
