import { db } from '../../../config/database';
import { crmWorkflows, crmDeals, crmContacts, crmCompanies, crmActivities } from '../../../db/schema';
import { tasks as tasksTable } from '../../../db/schema';
import { eq, and, asc, desc, sql } from 'drizzle-orm';
import { logger } from '../../../utils/logger';

// ─── Input types ────────────────────────────────────────────────────

interface CreateWorkflowInput {
  name: string;
  trigger: string;
  triggerConfig?: Record<string, unknown>;
  action: string;
  actionConfig: Record<string, unknown>;
}

interface UpdateWorkflowInput {
  name?: string;
  trigger?: string;
  triggerConfig?: Record<string, unknown>;
  action?: string;
  actionConfig?: Record<string, unknown>;
  isActive?: boolean;
}

// ─── Workflow CRUD ──────────────────────────────────────────────────

export async function listWorkflows(userId: string, tenantId: string) {
  return db
    .select()
    .from(crmWorkflows)
    .where(and(eq(crmWorkflows.userId, userId), eq(crmWorkflows.tenantId, tenantId)))
    .orderBy(desc(crmWorkflows.createdAt));
}

export async function createWorkflow(userId: string, tenantId: string, input: CreateWorkflowInput) {
  const now = new Date();

  const [created] = await db
    .insert(crmWorkflows)
    .values({
      tenantId,
      userId,
      name: input.name,
      trigger: input.trigger,
      triggerConfig: input.triggerConfig ?? {},
      action: input.action,
      actionConfig: input.actionConfig,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  logger.info({ userId, workflowId: created.id }, 'CRM workflow created');
  return created;
}

export async function updateWorkflow(userId: string, workflowId: string, input: UpdateWorkflowInput) {
  const now = new Date();
  const updates: Record<string, unknown> = { updatedAt: now };

  if (input.name !== undefined) updates.name = input.name;
  if (input.trigger !== undefined) updates.trigger = input.trigger;
  if (input.triggerConfig !== undefined) updates.triggerConfig = input.triggerConfig;
  if (input.action !== undefined) updates.action = input.action;
  if (input.actionConfig !== undefined) updates.actionConfig = input.actionConfig;
  if (input.isActive !== undefined) updates.isActive = input.isActive;

  await db
    .update(crmWorkflows)
    .set(updates)
    .where(and(eq(crmWorkflows.id, workflowId), eq(crmWorkflows.userId, userId)));

  const [updated] = await db
    .select()
    .from(crmWorkflows)
    .where(and(eq(crmWorkflows.id, workflowId), eq(crmWorkflows.userId, userId)))
    .limit(1);

  return updated || null;
}

export async function deleteWorkflow(userId: string, workflowId: string) {
  await db
    .delete(crmWorkflows)
    .where(and(eq(crmWorkflows.id, workflowId), eq(crmWorkflows.userId, userId)));
}

export async function toggleWorkflow(userId: string, workflowId: string) {
  const [existing] = await db
    .select()
    .from(crmWorkflows)
    .where(and(eq(crmWorkflows.id, workflowId), eq(crmWorkflows.userId, userId)))
    .limit(1);

  if (!existing) return null;

  const now = new Date();
  await db
    .update(crmWorkflows)
    .set({ isActive: !existing.isActive, updatedAt: now })
    .where(eq(crmWorkflows.id, workflowId));

  const [updated] = await db
    .select()
    .from(crmWorkflows)
    .where(eq(crmWorkflows.id, workflowId))
    .limit(1);

  return updated || null;
}

// ─── Workflow Execution ─────────────────────────────────────────────

export async function executeWorkflows(
  tenantId: string,
  userId: string,
  trigger: string,
  context: Record<string, unknown>,
) {
  // Find all active workflows matching this trigger for the account
  const workflows = await db
    .select()
    .from(crmWorkflows)
    .where(and(
      eq(crmWorkflows.tenantId, tenantId),
      eq(crmWorkflows.trigger, trigger),
      eq(crmWorkflows.isActive, true),
    ));

  for (const workflow of workflows) {
    try {
      // Check trigger config matches context
      if (!matchesTriggerConfig(workflow.triggerConfig, trigger, context)) {
        continue;
      }

      // Execute the action
      await executeAction(userId, tenantId, workflow.action, workflow.actionConfig, context);

      // Update execution stats
      const now = new Date();
      await db
        .update(crmWorkflows)
        .set({
          executionCount: sql`${crmWorkflows.executionCount} + 1`,
          lastExecutedAt: now,
          updatedAt: now,
        })
        .where(eq(crmWorkflows.id, workflow.id));

      logger.info({ workflowId: workflow.id, trigger, action: workflow.action }, 'CRM workflow executed');
    } catch (error) {
      logger.error({ error, workflowId: workflow.id, trigger }, 'CRM workflow execution failed');
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

async function executeAction(
  userId: string,
  tenantId: string,
  action: string,
  actionConfig: Record<string, unknown>,
  context: Record<string, unknown>,
) {
  switch (action) {
    case 'create_task': {
      const title = (actionConfig.taskTitle as string) || 'Automated task';
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
      const tag = (actionConfig.tag as string)?.trim();
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
      const body = (actionConfig.body as string) || '';
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
      const message = (actionConfig.message as string) || '';
      logger.info({ message, context }, 'Workflow notification');
      break;
    }
  }
}

// ─── Seed Example Workflows ──────────────────────────────────────────

export async function seedExampleWorkflows(userId: string, tenantId: string) {
  // Idempotency guard — skip if workflows already exist for this account
  const existing = await db.select({ id: crmWorkflows.id }).from(crmWorkflows)
    .where(and(eq(crmWorkflows.userId, userId), eq(crmWorkflows.tenantId, tenantId))).limit(1);
  if (existing.length > 0) return { skipped: true };

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
    trigger: string;
    triggerConfig: Record<string, unknown>;
    action: string;
    actionConfig: Record<string, unknown>;
  }> = [
    {
      name: 'Qualified → Schedule demo',
      trigger: 'deal_stage_changed',
      triggerConfig: qualifiedId ? { toStage: qualifiedId } : {},
      action: 'create_task',
      actionConfig: { taskTitle: 'Schedule discovery call with contact' },
    },
    {
      name: 'Proposal → Prepare document',
      trigger: 'deal_stage_changed',
      triggerConfig: proposalId ? { toStage: proposalId } : {},
      action: 'create_task',
      actionConfig: { taskTitle: 'Prepare and send proposal' },
    },
    {
      name: 'Won → Welcome task',
      trigger: 'deal_won',
      triggerConfig: {},
      action: 'create_task',
      actionConfig: { taskTitle: 'Send welcome package to new customer' },
    },
    {
      name: 'Won → Set probability',
      trigger: 'deal_won',
      triggerConfig: {},
      action: 'update_field',
      actionConfig: { fieldName: 'probability', fieldValue: '100' },
    },
    {
      name: 'Won → Tag customer',
      trigger: 'deal_won',
      triggerConfig: {},
      action: 'add_tag',
      actionConfig: { tag: 'customer' },
    },
    {
      name: 'Lost → Review task',
      trigger: 'deal_lost',
      triggerConfig: {},
      action: 'create_task',
      actionConfig: { taskTitle: 'Schedule deal loss review' },
    },
    {
      name: 'Lost → Log activity',
      trigger: 'deal_lost',
      triggerConfig: {},
      action: 'log_activity',
      actionConfig: { activityType: 'note', body: 'Deal was lost. Review and follow up.' },
    },
    {
      name: 'New contact → Intro email task',
      trigger: 'contact_created',
      triggerConfig: {},
      action: 'create_task',
      actionConfig: { taskTitle: 'Send introduction email' },
    },
    {
      name: 'Call logged → Follow up',
      trigger: 'activity_logged',
      triggerConfig: { activityType: 'call' },
      action: 'create_task',
      actionConfig: { taskTitle: 'Send follow-up email after call' },
    },
    {
      name: 'Meeting logged → Notes',
      trigger: 'activity_logged',
      triggerConfig: { activityType: 'meeting' },
      action: 'create_task',
      actionConfig: { taskTitle: 'Write meeting notes and share with team' },
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
