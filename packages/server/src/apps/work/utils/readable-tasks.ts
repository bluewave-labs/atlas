import { eq, or, SQL } from 'drizzle-orm';
import { tasks } from '../../../db/schema';

/**
 * Returns a WHERE fragment that restricts task rows to those the current user
 * can read: either public (isPrivate=false) or owned by the user.
 *
 * Every task-reading query MUST go through this helper.
 */
export function readableTasksFilter(currentUserId: string): SQL {
  return or(eq(tasks.isPrivate, false), eq(tasks.userId, currentUserId))!;
}
