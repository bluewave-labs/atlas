import { db } from '../../../config/database';
import { messageBlocklist } from '../../../db/schema';

export const DEFAULT_BLOCKLIST_PATTERNS = [
  '*@noreply.*',
  '*@mailer-daemon.*',
  '*@no-reply.*',
  'notifications@github.com',
] as const;

/**
 * Seed the per-tenant blocklist with the four default patterns from the
 * Phase 2 spec. Idempotent — the unique `(tenantId, pattern)` index plus
 * `onConflictDoNothing` makes safe to call on every boot.
 */
export async function seedBlocklistForTenant(tenantId: string): Promise<void> {
  await db
    .insert(messageBlocklist)
    .values(
      DEFAULT_BLOCKLIST_PATTERNS.map((pattern) => ({
        tenantId,
        pattern,
        createdByUserId: null,
      })),
    )
    .onConflictDoNothing();
}
