import { db } from '../../config/database';
import { signingTokens, signatureDocuments, users } from '../../db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { logger } from '../../utils/logger';
import { env } from '../../config/env';
import { sendSigningInviteEmail } from './email';
import { isSignerTurn } from './service';
import { getSettings } from './services/settings.service';

const DEFAULT_CADENCE_DAYS = 3;

/**
 * Send automated reminders for pending signing tokens.
 *
 * Criteria:
 * - Token status is 'pending'
 * - Token has not expired (expiresAt > NOW())
 * - Either:
 *   - No reminder has been sent AND the token was created more than N days ago
 *   - OR the last reminder was sent more than N days ago
 *   where N = tenant's `reminderCadenceDays` setting (default 3)
 * - For sequential signing: only remind the signer if it's their turn
 */
export async function sendPendingReminders(): Promise<number> {
  const now = new Date();
  let reminderCount = 0;

  try {
    // Fetch all pending, non-expired candidates (interval check applied per-tenant below)
    const candidates = await db
      .select({
        id: signingTokens.id,
        documentId: signingTokens.documentId,
        signerEmail: signingTokens.signerEmail,
        signerName: signingTokens.signerName,
        token: signingTokens.token,
        signingOrder: signingTokens.signingOrder,
        expiresAt: signingTokens.expiresAt,
        lastReminderAt: signingTokens.lastReminderAt,
        createdAt: signingTokens.createdAt,
        tenantId: signatureDocuments.tenantId,
      })
      .from(signingTokens)
      .innerJoin(signatureDocuments, eq(signingTokens.documentId, signatureDocuments.id))
      .where(
        and(
          eq(signingTokens.status, 'pending'),
          sql`${signingTokens.expiresAt} > NOW()`,
        ),
      );

    if (candidates.length === 0) {
      logger.debug('No pending signing tokens eligible for reminders');
      return 0;
    }

    // Cache settings per tenant to avoid redundant DB hits
    const settingsCache = new Map<string, number>();

    const getCadence = async (tenantId: string): Promise<number> => {
      if (settingsCache.has(tenantId)) return settingsCache.get(tenantId)!;
      try {
        const settings = await getSettings(tenantId);
        const cadence = settings?.reminderCadenceDays;
        // Guard: must be a positive integer
        const valid = typeof cadence === 'number' && Number.isInteger(cadence) && cadence > 0;
        const resolved = valid ? cadence : DEFAULT_CADENCE_DAYS;
        settingsCache.set(tenantId, resolved);
        return resolved;
      } catch {
        settingsCache.set(tenantId, DEFAULT_CADENCE_DAYS);
        return DEFAULT_CADENCE_DAYS;
      }
    };

    logger.info({ count: candidates.length }, 'Checking signing tokens against per-tenant reminder cadence');

    for (const tokenRow of candidates) {
      try {
        const cadenceDays = await getCadence(tokenRow.tenantId);
        const cadenceMs = cadenceDays * 24 * 60 * 60 * 1000;

        // Apply per-tenant cadence check
        const referenceTime = tokenRow.lastReminderAt ?? tokenRow.createdAt;
        if (now.getTime() - new Date(referenceTime).getTime() < cadenceMs) {
          continue; // Not yet time to remind for this tenant's cadence
        }

        // For sequential signing, only remind if it's the signer's turn
        if (tokenRow.signingOrder > 0) {
          const isTurn = await isSignerTurn(tokenRow.documentId, tokenRow.signingOrder);
          if (!isTurn) {
            continue; // Skip — not their turn yet
          }
        }

        // Get the document info
        const [doc] = await db
          .select({ title: signatureDocuments.title, userId: signatureDocuments.userId })
          .from(signatureDocuments)
          .where(eq(signatureDocuments.id, tokenRow.documentId))
          .limit(1);

        if (!doc) continue;

        // Get the sender name
        const [user] = await db
          .select({ name: users.name, email: users.email })
          .from(users)
          .where(eq(users.id, doc.userId))
          .limit(1);

        const senderName = user?.name || user?.email || 'Unknown';
        const clientUrl = env.CLIENT_PUBLIC_URL || 'http://localhost:5180';

        // Re-send the signing invite email
        await sendSigningInviteEmail({
          to: tokenRow.signerEmail,
          signerName: tokenRow.signerName ?? undefined,
          documentTitle: doc.title,
          senderName,
          signingLink: `${clientUrl}/sign/${tokenRow.token}`,
          expiresAt: tokenRow.expiresAt,
        });

        // Update lastReminderAt
        await db
          .update(signingTokens)
          .set({ lastReminderAt: now, updatedAt: now })
          .where(eq(signingTokens.id, tokenRow.id));

        reminderCount++;
        logger.info({ tokenId: tokenRow.id, signerEmail: tokenRow.signerEmail, cadenceDays }, 'Signing reminder sent');
      } catch (err) {
        logger.warn({ err, tokenId: tokenRow.id }, 'Failed to send reminder for signing token');
      }
    }

    logger.info({ reminderCount }, 'Signing reminder batch complete');
    return reminderCount;
  } catch (error) {
    logger.error({ error }, 'Failed to run pending signing reminders');
    return 0;
  }
}

// ─── Reminder scheduler ─────────────────────────────────────────────

const REMINDER_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
let reminderTimer: ReturnType<typeof setInterval> | null = null;

export function startReminderScheduler() {
  if (reminderTimer) return;

  reminderTimer = setInterval(async () => {
    try {
      await sendPendingReminders();
    } catch (err) {
      logger.error({ err }, 'Signing reminder scheduler failed');
    }
  }, REMINDER_INTERVAL_MS);

  // Also run once after a short delay on startup
  setTimeout(() => sendPendingReminders().catch(() => {}), 60_000);

  logger.info('Signing reminder scheduler started (hourly)');
}

export function stopReminderScheduler() {
  if (reminderTimer) {
    clearInterval(reminderTimer);
    reminderTimer = null;
    logger.info('Signing reminder scheduler stopped');
  }
}
