import { db } from '../../../config/database';
import { messageBlocklist } from '../../../db/schema';

export const DEFAULT_BLOCKLIST_PATTERNS = [
  '*@noreply.*',
  '*@mailer-daemon.*',
  '*@no-reply.*',
  'notifications@github.com',
] as const;

/**
 * Seed the default blocklist patterns for one or more tenants in a single
 * INSERT. Idempotent — the unique `(tenantId, pattern)` index plus
 * `onConflictDoNothing` makes it safe to call on every boot.
 */
export async function seedBlocklistForTenants(tenantIds: readonly string[]): Promise<void> {
  if (tenantIds.length === 0) return;
  const rows = tenantIds.flatMap((tenantId) =>
    DEFAULT_BLOCKLIST_PATTERNS.map((pattern) => ({
      tenantId,
      pattern,
      createdByUserId: null,
    })),
  );
  await db.insert(messageBlocklist).values(rows).onConflictDoNothing();
}

/** Single-tenant convenience wrapper. */
export async function seedBlocklistForTenant(tenantId: string): Promise<void> {
  await seedBlocklistForTenants([tenantId]);
}
