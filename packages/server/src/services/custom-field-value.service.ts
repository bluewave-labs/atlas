import { eq, and, inArray, sql } from 'drizzle-orm';
import { db } from '../config/database';
import { customFieldDefinitions, customFieldValues } from '../db/schema';

/**
 * Get all custom field definitions + values for a specific record.
 * Returns definitions with their current value (or null if not set).
 */
export async function getFieldsWithValues(
  tenantId: string,
  appId: string,
  recordType: string,
  recordId: string,
) {
  const rows = await db
    .select({
      // Definition fields
      id: customFieldDefinitions.id,
      tenantId: customFieldDefinitions.tenantId,
      appId: customFieldDefinitions.appId,
      recordType: customFieldDefinitions.recordType,
      name: customFieldDefinitions.name,
      slug: customFieldDefinitions.slug,
      fieldType: customFieldDefinitions.fieldType,
      options: customFieldDefinitions.options,
      isRequired: customFieldDefinitions.isRequired,
      sortOrder: customFieldDefinitions.sortOrder,
      createdBy: customFieldDefinitions.createdBy,
      createdAt: customFieldDefinitions.createdAt,
      updatedAt: customFieldDefinitions.updatedAt,
      // Value fields (nullable from LEFT JOIN)
      valueId: customFieldValues.id,
      value: customFieldValues.value,
    })
    .from(customFieldDefinitions)
    .leftJoin(
      customFieldValues,
      and(
        eq(customFieldValues.fieldDefinitionId, customFieldDefinitions.id),
        eq(customFieldValues.recordId, recordId),
      ),
    )
    .where(
      and(
        eq(customFieldDefinitions.tenantId, tenantId),
        eq(customFieldDefinitions.appId, appId),
        eq(customFieldDefinitions.recordType, recordType),
      ),
    )
    .orderBy(customFieldDefinitions.sortOrder);

  return rows.map((row) => ({
    id: row.id,
    tenantId: row.tenantId,
    appId: row.appId,
    recordType: row.recordType,
    name: row.name,
    slug: row.slug,
    fieldType: row.fieldType,
    options: row.options,
    isRequired: row.isRequired,
    sortOrder: row.sortOrder,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    valueId: row.valueId ?? null,
    value: row.value ?? null,
  }));
}

/**
 * Bulk upsert custom field values for a record.
 * Uses INSERT ... ON CONFLICT UPDATE.
 */
export async function upsertValues(
  tenantId: string,
  recordId: string,
  values: Array<{ fieldDefinitionId: string; value: unknown }>,
) {
  if (values.length === 0) return;

  const now = new Date();
  for (const { fieldDefinitionId, value } of values) {
    await db
      .insert(customFieldValues)
      .values({ tenantId, fieldDefinitionId, recordId, value })
      .onConflictDoUpdate({
        target: [customFieldValues.recordId, customFieldValues.fieldDefinitionId],
        set: { value, updatedAt: now },
      });
  }
}

/**
 * Delete all custom field values for a record (cleanup on hard delete).
 */
export async function deleteValuesForRecord(recordId: string) {
  await db
    .delete(customFieldValues)
    .where(eq(customFieldValues.recordId, recordId));
}
