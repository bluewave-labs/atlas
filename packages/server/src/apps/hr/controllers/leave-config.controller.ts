import type { Request, Response } from 'express';
import * as hrService from '../services/leave-config.service';
import { logger } from '../../../utils/logger';
import { getAppPermission, canAccess } from '../../../services/app-permissions.service';

// ─── Leave Types ──────────────────────────────────────────────────

export async function listLeaveTypes(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;

    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'hr');
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'No permission to view HR data' });
      return;
    }

    const includeInactive = req.query.includeInactive === 'true';
    const data = await hrService.listLeaveTypes(accountId, includeInactive);
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to list leave types');
    res.status(500).json({ success: false, error: 'Failed to list leave types' });
  }
}

export async function createLeaveType(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;

    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'hr');
    if (!canAccess(perm.role, 'create')) {
      res.status(403).json({ success: false, error: 'No permission to create HR records' });
      return;
    }

    const { name, slug, color, defaultDaysPerYear, maxCarryForward, requiresApproval, isPaid } = req.body;
    if (!name?.trim() || !slug?.trim()) {
      res.status(400).json({ success: false, error: 'Name and slug are required' });
      return;
    }
    const data = await hrService.createLeaveType(accountId, {
      name: name.trim(), slug: slug.trim(), color, defaultDaysPerYear, maxCarryForward, requiresApproval, isPaid,
    });
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to create leave type');
    res.status(500).json({ success: false, error: 'Failed to create leave type' });
  }
}

export async function updateLeaveType(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;

    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'hr');
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'No permission to update HR records' });
      return;
    }

    const id = req.params.id as string;
    const data = await hrService.updateLeaveType(accountId, id, req.body);
    if (!data) { res.status(404).json({ success: false, error: 'Leave type not found' }); return; }
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to update leave type');
    res.status(500).json({ success: false, error: 'Failed to update leave type' });
  }
}

export async function deleteLeaveType(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;

    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'hr');
    if (!canAccess(perm.role, 'delete') && !canAccess(perm.role, 'delete_own')) {
      res.status(403).json({ success: false, error: 'No permission to delete' });
      return;
    }

    await hrService.deleteLeaveType(accountId, req.params.id as string);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to delete leave type');
    res.status(500).json({ success: false, error: 'Failed to delete leave type' });
  }
}

// ─── Leave Policies ───────────────────────────────────────────────

export async function listLeavePolicies(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;

    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'hr');
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'No permission to view HR data' });
      return;
    }

    const data = await hrService.listLeavePolicies(accountId);
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to list leave policies');
    res.status(500).json({ success: false, error: 'Failed to list leave policies' });
  }
}

export async function createLeavePolicy(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;

    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'hr');
    if (!canAccess(perm.role, 'create')) {
      res.status(403).json({ success: false, error: 'No permission to create HR records' });
      return;
    }

    const { name, description, isDefault, allocations } = req.body;
    if (!name?.trim()) { res.status(400).json({ success: false, error: 'Name is required' }); return; }
    const data = await hrService.createLeavePolicy(accountId, {
      name: name.trim(), description, isDefault, allocations: allocations || [],
    });
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to create leave policy');
    res.status(500).json({ success: false, error: 'Failed to create leave policy' });
  }
}

export async function updateLeavePolicy(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;

    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'hr');
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'No permission to update HR records' });
      return;
    }

    const data = await hrService.updateLeavePolicy(accountId, req.params.id as string, req.body);
    if (!data) { res.status(404).json({ success: false, error: 'Leave policy not found' }); return; }
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to update leave policy');
    res.status(500).json({ success: false, error: 'Failed to update leave policy' });
  }
}

export async function deleteLeavePolicy(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;

    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'hr');
    if (!canAccess(perm.role, 'delete') && !canAccess(perm.role, 'delete_own')) {
      res.status(403).json({ success: false, error: 'No permission to delete' });
      return;
    }

    await hrService.deleteLeavePolicy(accountId, req.params.id as string);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to delete leave policy');
    res.status(500).json({ success: false, error: 'Failed to delete leave policy' });
  }
}

export async function assignPolicyToEmployee(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;

    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'hr');
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'No permission to update HR records' });
      return;
    }

    const employeeId = req.params.id as string;
    const { policyId, effectiveFrom } = req.body;
    if (!policyId) { res.status(400).json({ success: false, error: 'policyId is required' }); return; }
    const data = await hrService.assignPolicy(accountId, employeeId, policyId, effectiveFrom);
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to assign policy');
    res.status(500).json({ success: false, error: 'Failed to assign policy' });
  }
}

export async function getEmployeePolicy(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;

    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'hr');
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'No permission to view HR data' });
      return;
    }

    const data = await hrService.getEmployeePolicy(accountId, req.params.id as string);
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to get employee policy');
    res.status(500).json({ success: false, error: 'Failed to get employee policy' });
  }
}

// ─── Seed Defaults ───────────────────────────────────────────────

export async function seedLeaveTypes(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;

    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'hr');
    if (!canAccess(perm.role, 'create')) {
      res.status(403).json({ success: false, error: 'No permission to create HR records' });
      return;
    }

    const result = await hrService.seedDefaultLeaveTypes(accountId);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ error }, 'Failed to seed leave types');
    res.status(500).json({ success: false, error: 'Failed to seed leave types' });
  }
}

export async function seedLeavePolicies(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;

    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'hr');
    if (!canAccess(perm.role, 'create')) {
      res.status(403).json({ success: false, error: 'No permission to create HR records' });
      return;
    }

    const result = await hrService.seedDefaultPolicies(accountId);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ error }, 'Failed to seed leave policies');
    res.status(500).json({ success: false, error: 'Failed to seed leave policies' });
  }
}

// ─── Leave Balance Allocation ────────────────────────────────────

export async function triggerBalanceAllocation(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;

    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'hr');
    if (!canAccess(perm.role, 'create')) {
      res.status(403).json({ success: false, error: 'No permission to manage HR records' });
      return;
    }

    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const result = await hrService.allocateBalancesForYear(accountId, year);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ error }, 'Failed to trigger balance allocation');
    res.status(500).json({ success: false, error: 'Failed to trigger balance allocation' });
  }
}

export async function resyncPolicyBalances(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;
    const policyId = req.params.id as string;

    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'hr');
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'No permission to manage HR records' });
      return;
    }

    const result = await hrService.resyncPolicyBalances(accountId, policyId);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ error }, 'Failed to resync policy balances');
    res.status(500).json({ success: false, error: 'Failed to resync policy balances' });
  }
}

// ─── Holiday Calendars ────────────────────────────────────────────

export async function listHolidayCalendars(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;

    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'hr');
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'No permission to view HR data' });
      return;
    }

    const data = await hrService.listHolidayCalendars(accountId);
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to list holiday calendars');
    res.status(500).json({ success: false, error: 'Failed to list holiday calendars' });
  }
}

export async function createHolidayCalendar(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;

    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'hr');
    if (!canAccess(perm.role, 'create')) {
      res.status(403).json({ success: false, error: 'No permission to create HR records' });
      return;
    }

    const { name, year, description, isDefault } = req.body;
    if (!name?.trim() || !year) { res.status(400).json({ success: false, error: 'Name and year are required' }); return; }
    const data = await hrService.createHolidayCalendar(accountId, { name: name.trim(), year, description, isDefault });
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to create holiday calendar');
    res.status(500).json({ success: false, error: 'Failed to create holiday calendar' });
  }
}

export async function updateHolidayCalendar(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;

    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'hr');
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'No permission to update HR records' });
      return;
    }

    const data = await hrService.updateHolidayCalendar(accountId, req.params.id as string, req.body);
    if (!data) { res.status(404).json({ success: false, error: 'Holiday calendar not found' }); return; }
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to update holiday calendar');
    res.status(500).json({ success: false, error: 'Failed to update holiday calendar' });
  }
}

export async function deleteHolidayCalendar(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;

    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'hr');
    if (!canAccess(perm.role, 'delete') && !canAccess(perm.role, 'delete_own')) {
      res.status(403).json({ success: false, error: 'No permission to delete' });
      return;
    }

    await hrService.deleteHolidayCalendar(accountId, req.params.id as string);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to delete holiday calendar');
    res.status(500).json({ success: false, error: 'Failed to delete holiday calendar' });
  }
}

export async function listHolidays(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;

    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'hr');
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'No permission to view HR data' });
      return;
    }

    const data = await hrService.listHolidays(accountId, req.params.id as string);
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to list holidays');
    res.status(500).json({ success: false, error: 'Failed to list holidays' });
  }
}

export async function createHoliday(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;

    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'hr');
    if (!canAccess(perm.role, 'create')) {
      res.status(403).json({ success: false, error: 'No permission to create HR records' });
      return;
    }

    const { calendarId, name, date, description, type, isRecurring } = req.body;
    if (!calendarId || !name?.trim() || !date) {
      res.status(400).json({ success: false, error: 'calendarId, name, and date are required' });
      return;
    }
    const data = await hrService.createHoliday(accountId, { calendarId, name: name.trim(), date, description, type, isRecurring });
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to create holiday');
    res.status(500).json({ success: false, error: 'Failed to create holiday' });
  }
}

export async function updateHoliday(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;

    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'hr');
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'No permission to update HR records' });
      return;
    }

    const data = await hrService.updateHoliday(accountId, req.params.id as string, req.body);
    if (!data) { res.status(404).json({ success: false, error: 'Holiday not found' }); return; }
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to update holiday');
    res.status(500).json({ success: false, error: 'Failed to update holiday' });
  }
}

export async function deleteHoliday(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;

    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'hr');
    if (!canAccess(perm.role, 'delete') && !canAccess(perm.role, 'delete_own')) {
      res.status(403).json({ success: false, error: 'No permission to delete' });
      return;
    }

    await hrService.deleteHoliday(accountId, req.params.id as string);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to delete holiday');
    res.status(500).json({ success: false, error: 'Failed to delete holiday' });
  }
}

export async function bulkImportHolidays(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;

    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'hr');
    if (!canAccess(perm.role, 'create')) {
      res.status(403).json({ success: false, error: 'No permission to create HR records' });
      return;
    }

    const { calendarId, holidays } = req.body;
    if (!calendarId || !Array.isArray(holidays) || holidays.length === 0) {
      res.status(400).json({ success: false, error: 'calendarId and a non-empty holidays array are required' });
      return;
    }
    const data = await hrService.bulkCreateHolidays(accountId, calendarId, holidays);
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to bulk import holidays');
    res.status(500).json({ success: false, error: 'Failed to bulk import holidays' });
  }
}

export async function getWorkingDays(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;

    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'hr');
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'No permission to view HR data' });
      return;
    }

    const { start, end, calendarId } = req.query;
    if (!start || !end) { res.status(400).json({ success: false, error: 'start and end are required' }); return; }
    const days = await hrService.calculateWorkingDays(accountId, start as string, end as string, calendarId as string | undefined);
    res.json({ success: true, data: { workingDays: days } });
  } catch (error) {
    logger.error({ error }, 'Failed to calculate working days');
    res.status(500).json({ success: false, error: 'Failed to calculate working days' });
  }
}
