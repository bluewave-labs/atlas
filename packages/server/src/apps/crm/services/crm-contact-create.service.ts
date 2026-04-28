import { createContact } from './contact.service';
import {
  shouldAutoCreate,
  type ContactAutoCreationPolicy,
  type ParticipantRole,
  type MessageDirection,
} from './participant-match.service';

export interface AutoCreateInput {
  handle: string;
  displayName: string | null;
  role: ParticipantRole;
  direction: MessageDirection;
  policy: ContactAutoCreationPolicy;
  tenantId: string;
  userId: string;
  /** Pre-resolved blocklist match — caller passes the result of `loadBlocklist(tenantId)(handle)`. */
  isBlocked: boolean;
}

/**
 * Apply the contact-auto-creation policy and create a new `crm_contacts` row
 * if all three conditions hold:
 *   1. `policy` permits creation for this `(role, direction)` pair
 *   2. `isBlocked` is false
 *   3. (caller verified) no existing contact matched this handle
 *
 * Returns the new contact's `id` on creation, or `null` when no contact was
 * created. Delegates to `contact.service.createContact` so auto-created
 * contacts share the same `sortOrder` allocation as user-created ones.
 */
export async function autoCreateContactIfNeeded(input: AutoCreateInput): Promise<string | null> {
  if (input.isBlocked) return null;
  if (!shouldAutoCreate(input.policy, input.role, input.direction)) return null;

  const created = await createContact(input.userId, input.tenantId, {
    name: pickName(input.displayName, input.handle),
    email: input.handle.toLowerCase(),
    source: 'email-auto',
  });

  return created.id;
}

function pickName(displayName: string | null, handle: string): string {
  if (displayName && displayName.trim()) {
    return displayName.trim();
  }
  return handle.split('@')[0];
}
