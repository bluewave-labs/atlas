import { and, eq, sql } from 'drizzle-orm';
import { db } from '../../../config/database';
import { crmContacts, messageBlocklist, messageParticipants } from '../../../db/schema';

export type ContactAutoCreationPolicy = 'none' | 'send-only' | 'send-and-receive';
export type ParticipantRole = 'from' | 'to' | 'cc' | 'bcc';
export type MessageDirection = 'inbound' | 'outbound';

/**
 * Whether to auto-create a CRM contact for an unmatched participant on this
 * channel. Pure function; the caller looks up policy + direction.
 *
 * Semantics:
 * - `none`: never auto-create
 * - `send-only`: auto-create only when we sent this message AND the participant
 *   is a recipient (to/cc/bcc on an outbound message). The implicit assumption
 *   "I emailed them, they're a real lead" is the strongest weak signal.
 * - `send-and-receive`: auto-create from any participant on any direction.
 */
export function shouldAutoCreate(
  policy: ContactAutoCreationPolicy,
  role: ParticipantRole,
  direction: MessageDirection,
): boolean {
  if (policy === 'none') return false;
  if (policy === 'send-and-receive') return true;
  return direction === 'outbound' && role !== 'from';
}

/**
 * Check if a handle matches any blocklist pattern for the tenant. Patterns
 * may be exact (`alice@x.com`) or wildcard-domain (`*@noreply.example.com`).
 */
export async function isHandleBlocked(handle: string, tenantId: string): Promise<boolean> {
  const lower = handle.toLowerCase();
  const rows = await db
    .select({ pattern: messageBlocklist.pattern })
    .from(messageBlocklist)
    .where(eq(messageBlocklist.tenantId, tenantId));

  const localAt = lower.indexOf('@');
  const handleDomain = localAt >= 0 ? lower.slice(localAt + 1) : null;

  for (const row of rows) {
    const pattern = row.pattern.toLowerCase();
    if (pattern === lower) return true;
    if (pattern.startsWith('*@') && handleDomain !== null) {
      const blockDomain = pattern.slice(2);
      if (handleDomain === blockDomain) return true;
    }
  }
  return false;
}

/**
 * Load all blocklist patterns for a tenant once and return a closure that
 * tests handles against the same matching rules as `isHandleBlocked`. Use
 * this in batch loops (e.g., per-message participant iteration) to avoid
 * one DB read per participant.
 *
 * Example:
 * ```
 * const blocked = await loadBlocklist(tenantId);
 * for (const p of participants) {
 *   if (blocked(p.handle)) { ... }
 * }
 * ```
 */
export async function loadBlocklist(tenantId: string): Promise<(handle: string) => boolean> {
  const rows = await db
    .select({ pattern: messageBlocklist.pattern })
    .from(messageBlocklist)
    .where(eq(messageBlocklist.tenantId, tenantId));

  const exactSet = new Set<string>();
  const domainSet = new Set<string>();
  for (const row of rows) {
    const p = row.pattern.toLowerCase();
    if (p.startsWith('*@')) {
      domainSet.add(p.slice(2));
    } else {
      exactSet.add(p);
    }
  }

  return (handle: string) => {
    const lower = handle.toLowerCase();
    if (exactSet.has(lower)) return true;
    const at = lower.indexOf('@');
    if (at >= 0 && domainSet.has(lower.slice(at + 1))) return true;
    return false;
  };
}

/**
 * Find a CRM contact by exact-match (case-insensitive) on the email column
 * within the tenant. Returns the contact id or null.
 */
export async function matchHandleToContact(handle: string, tenantId: string): Promise<string | null> {
  const lower = handle.toLowerCase();
  const [row] = await db
    .select({ id: crmContacts.id })
    .from(crmContacts)
    .where(
      and(
        eq(crmContacts.tenantId, tenantId),
        sql`LOWER(${crmContacts.email}) = ${lower}`,
      ),
    )
    .limit(1);
  return row?.id ?? null;
}

/**
 * Batch variant of `matchHandleToContact`: given a list of handles, returns
 * a Map from lowercased handle → contact id for those handles that have
 * a CRM contact. Handles not in the map have no match. Uses a single SQL
 * query that selects all candidate contacts in the tenant and filters in JS,
 * because Postgres can't use the LOWER() index for an `IN` predicate without
 * a functional index that doesn't exist yet (see follow-up).
 */
export async function matchHandlesToContacts(
  handles: string[],
  tenantId: string,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (handles.length === 0) return out;

  const wantedSet = new Set(handles.map((h) => h.toLowerCase()));
  const rows = await db
    .select({ id: crmContacts.id, email: crmContacts.email })
    .from(crmContacts)
    .where(eq(crmContacts.tenantId, tenantId));

  for (const row of rows) {
    if (!row.email) continue;
    const lower = row.email.toLowerCase();
    if (wantedSet.has(lower)) {
      out.set(lower, row.id);
    }
  }
  return out;
}

export interface ResolvedParticipant {
  role: ParticipantRole;
  handle: string;
  displayName: string | null;
  personId: string | null;
}

/**
 * Bulk-insert message_participants rows. Caller has already resolved
 * `personId` for known contacts; rows for unknown handles get `personId=null`.
 * No-op if `participants` is empty.
 */
export async function insertParticipants(args: {
  messageId: string;
  tenantId: string;
  participants: ResolvedParticipant[];
}): Promise<void> {
  if (args.participants.length === 0) return;

  const rows = args.participants.map((p) => ({
    messageId: args.messageId,
    tenantId: args.tenantId,
    role: p.role,
    handle: p.handle,
    displayName: p.displayName,
    personId: p.personId,
  }));

  await db.insert(messageParticipants).values(rows);
}
