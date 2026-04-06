import { db } from '../../../config/database';
import { hrLeavePolicyAssignments } from '../../../db/schema';
import { eq } from 'drizzle-orm';
import { allocateBalancesForYear } from './leave-config.service';
import { logger } from '../../../utils/logger';

const LEAVE_BALANCE_CHECK_INTERVAL = 24 * 60 * 60 * 1000; // daily
const INITIAL_DELAY = 60_000; // 60s

let timer: ReturnType<typeof setInterval> | null = null;
let delayTimer: ReturnType<typeof setTimeout> | null = null;
let running = false;

/**
 * Checks all accounts with active policy assignments and allocates
 * leave balances for the current year if they don't already exist.
 */
export async function checkLeaveBalances() {
  if (running) {
    logger.warn('Leave balance check already in progress, skipping');
    return;
  }

  running = true;
  try {
    const currentYear = new Date().getFullYear();

    // Get all distinct account IDs that have active policy assignments
    const rows = await db.selectDistinct({ accountId: hrLeavePolicyAssignments.accountId })
      .from(hrLeavePolicyAssignments)
      .where(eq(hrLeavePolicyAssignments.isArchived, false));

    await Promise.all(
      rows.map((row) =>
        allocateBalancesForYear(row.accountId, currentYear).catch((err) =>
          logger.error({ err, accountId: row.accountId }, 'Leave balance allocation failed for account'),
        ),
      ),
    );

    logger.info({ accountCount: rows.length, year: currentYear }, 'Leave balance check completed');
  } catch (err) {
    logger.error({ err }, 'Leave balance check failed');
  } finally {
    running = false;
  }
}

export function startLeaveBalanceScheduler() {
  // Run after initial delay to allow DB to settle, then daily
  delayTimer = setTimeout(() => {
    checkLeaveBalances().catch((err) => logger.error({ err }, 'Initial leave balance check failed'));
  }, INITIAL_DELAY);

  timer = setInterval(() => {
    checkLeaveBalances().catch((err) => logger.error({ err }, 'Scheduled leave balance check failed'));
  }, LEAVE_BALANCE_CHECK_INTERVAL);

  logger.info('Leave balance daily scheduler enabled');
}

export function stopLeaveBalanceScheduler() {
  if (delayTimer) { clearTimeout(delayTimer); delayTimer = null; }
  if (timer) { clearInterval(timer); timer = null; }
}
