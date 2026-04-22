import { z } from 'zod';
import {
  WORKFLOW_ACTIONS,
  WORKFLOW_TRIGGERS,
  WORKFLOW_CONDITION_OPERATORS,
  CONDITION_FIELD_TYPES,
} from '@atlas-platform/shared';

const operatorSchema = z.enum(WORKFLOW_CONDITION_OPERATORS);

const NUMERIC_OPS = new Set(['gt', 'gte', 'lt', 'lte']);

export const conditionSchema = z
  .object({
    field: z.string().refine((f) => f in CONDITION_FIELD_TYPES, 'Unknown condition field'),
    operator: operatorSchema,
    value: z.union([z.string(), z.number(), z.null()]),
  })
  .refine((c) => {
    if (c.operator === 'is_empty' || c.operator === 'is_not_empty') return true;
    const type = CONDITION_FIELD_TYPES[c.field];
    if (NUMERIC_OPS.has(c.operator)) return type === 'number' && typeof c.value === 'number';
    if (type === 'number') return typeof c.value === 'number' || c.value === null;
    return typeof c.value === 'string' || c.value === null;
  }, 'Operator/value type does not match field type')
  .nullable();

export const stepInputSchema = z.object({
  action: z.enum(WORKFLOW_ACTIONS),
  actionConfig: z.record(z.unknown()).default({}),
  condition: conditionSchema.optional(),
});

export const stepPatchSchema = z.object({
  action: z.enum(WORKFLOW_ACTIONS).optional(),
  actionConfig: z.record(z.unknown()).optional(),
  condition: conditionSchema.optional(),
});

export const workflowCreateSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  trigger: z.enum(WORKFLOW_TRIGGERS),
  triggerConfig: z.record(z.unknown()).optional(),
  steps: z.array(stepInputSchema).min(1, 'At least one step is required'),
});

export const workflowUpdateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  trigger: z.enum(WORKFLOW_TRIGGERS).optional(),
  triggerConfig: z.record(z.unknown()).optional(),
  isActive: z.boolean().optional(),
});

export const reorderSchema = z.object({
  stepIds: z.array(z.string().uuid()).min(1),
});
