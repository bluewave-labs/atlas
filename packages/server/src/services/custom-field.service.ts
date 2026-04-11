import { eq, and } from 'drizzle-orm';
import { db } from '../config/database';
import { customFieldDefinitions } from '../db/schema';

export async function listFieldDefinitions(tenantId: string, appId: string, recordType: string) {
  return db.select().from(customFieldDefinitions)
    .where(and(
      eq(customFieldDefinitions.tenantId, tenantId),
      eq(customFieldDefinitions.appId, appId),
      eq(customFieldDefinitions.recordType, recordType),
    ))
    .orderBy(customFieldDefinitions.sortOrder);
}

export async function createFieldDefinition(data: {
  tenantId: string;
  appId: string;
  recordType: string;
  name: string;
  slug: string;
  fieldType: string;
  options?: Record<string, unknown>;
  isRequired?: boolean;
  sortOrder?: number;
  createdBy: string;
}) {
  const [field] = await db.insert(customFieldDefinitions).values({
    tenantId: data.tenantId,
    appId: data.appId,
    recordType: data.recordType,
    name: data.name,
    slug: data.slug,
    fieldType: data.fieldType,
    options: data.options ?? {},
    isRequired: data.isRequired ?? false,
    sortOrder: data.sortOrder ?? 0,
    createdBy: data.createdBy,
  }).returning();
  return field;
}

export async function getFieldDefinitionById(id: string) {
  const [field] = await db.select().from(customFieldDefinitions)
    .where(eq(customFieldDefinitions.id, id))
    .limit(1);
  return field ?? null;
}

export async function updateFieldDefinition(id: string, data: Partial<{
  name: string;
  options: Record<string, unknown>;
  isRequired: boolean;
  sortOrder: number;
}>) {
  const [updated] = await db.update(customFieldDefinitions)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(customFieldDefinitions.id, id))
    .returning();
  return updated ?? null;
}

export async function deleteFieldDefinition(id: string) {
  const [deleted] = await db.delete(customFieldDefinitions)
    .where(eq(customFieldDefinitions.id, id))
    .returning();
  return deleted ?? null;
}
