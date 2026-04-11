import type { Request, Response } from 'express';
import * as leaveService from '../leave.service';
import { logger } from '../../../utils/logger';
import { emitAppEvent } from '../../../services/event.service';
import { getAppPermission, canAccess } from '../../../services/app-permissions.service';
import { findEmployeeIdByLinkedUser, getLinkedUserIdForEmployee, getManagerLinkedUserId } from '../services/employee.service';

// ─── Leave Applications ───────────────────────────────────────────
//
// Self-service pattern (mirrors expense.controller.ts):
//   - 'view' permission is the baseline gate — every HR user has it.
//   - Privileged roles (editor/manager/admin with 'update' or 'create')
//     can see and act on every leave application in the tenant.
//   - Viewers (portal users) can only see + mutate their OWN leave
//     applications. The controller forces an employeeId filter on
//     list, and ownership-checks the single-row mutations against
//     the caller's linked employee.

export async function listLeaveApplications(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;
    const userId = req.auth!.userId;

    const perm = await getAppPermission(req.auth?.tenantId, userId, 'hr');
    const { employeeId, status, startDate, endDate } = req.query;

    // For non-privileged roles (viewers who only have 'view' perm),
    // force-scope the list to the caller's own employee record. Even
    // if the client passes a different employeeId in the query, we
    // override it — no way to peek at another employee's leave.
    let effectiveEmployeeId = employeeId as string | undefined;
    if (!canAccess(perm.role, 'update')) {
      const callerEmployeeId = await findEmployeeIdByLinkedUser(userId, tenantId);
      if (!callerEmployeeId) {
        // Viewer with no linked employee — return empty list (matches
        // the "you don't have an employee record yet" state).
        res.json({ success: true, data: [] });
        return;
      }
      effectiveEmployeeId = callerEmployeeId;
    }

    const data = await leaveService.listLeaveApplications(tenantId, {
      employeeId: effectiveEmployeeId,
      status: status as string | undefined,
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
    });
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to list leave applications');
    res.status(500).json({ success: false, error: 'Failed to list leave applications' });
  }
}

export async function createLeaveApplication(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;
    const userId = req.auth!.userId;

    const perm = await getAppPermission(req.auth?.tenantId, userId, 'hr');
    const { leaveTypeId, startDate, endDate, halfDay, halfDayDate, reason } = req.body;
    let { employeeId } = req.body;

    // For non-privileged roles, always force employeeId to the caller's
    // own linked employee — a viewer cannot create a leave application
    // on behalf of anyone else, even if they pass a different id.
    if (!canAccess(perm.role, 'create')) {
      const callerEmployeeId = await findEmployeeIdByLinkedUser(userId, tenantId);
      if (!callerEmployeeId) {
        res.status(400).json({ success: false, error: 'No employee record found for current user' });
        return;
      }
      employeeId = callerEmployeeId;
    }

    if (!employeeId || !leaveTypeId || !startDate || !endDate) {
      res.status(400).json({ success: false, error: 'employeeId, leaveTypeId, startDate, endDate are required' });
      return;
    }
    const data = await leaveService.createLeaveApplication(tenantId, {
      employeeId, leaveTypeId, startDate, endDate, halfDay, halfDayDate, reason,
    });

    if (req.auth!.tenantId) {
      const managerUserId = await getManagerLinkedUserId(employeeId);
      emitAppEvent({
        tenantId: req.auth!.tenantId,
        userId: req.auth!.userId,
        appId: 'hr',
        eventType: 'leave.requested',
        title: `requested leave from ${startDate} to ${endDate}`,
        metadata: { leaveApplicationId: data.id, employeeId, startDate, endDate },
        ...(managerUserId ? { notifyUserIds: [managerUserId] } : {}),
      }).catch(() => {});
    }

    res.json({ success: true, data });
  } catch (error: any) {
    logger.error({ error }, 'Failed to create leave application');
    res.status(400).json({ success: false, error: error.message || 'Failed to create leave application' });
  }
}

export async function updateLeaveApplication(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;
    const userId = req.auth!.userId;

    const perm = await getAppPermission(req.auth?.tenantId, userId, 'hr');
    // Ownership check for non-privileged roles.
    if (!canAccess(perm.role, 'update')) {
      const callerEmployeeId = await findEmployeeIdByLinkedUser(userId, tenantId);
      if (!callerEmployeeId) {
        res.status(400).json({ success: false, error: 'No employee record found for current user' });
        return;
      }
      const existing = await leaveService.getLeaveApplication(tenantId, req.params.id as string);
      if (!existing || existing.employeeId !== callerEmployeeId) {
        res.status(403).json({ success: false, error: 'No permission to update this leave application' });
        return;
      }
    }

    const data = await leaveService.updateLeaveApplication(tenantId, req.params.id as string, req.body);
    if (!data) { res.status(404).json({ success: false, error: 'Leave application not found or not in draft' }); return; }
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to update leave application');
    res.status(500).json({ success: false, error: 'Failed to update leave application' });
  }
}

export async function submitLeaveApplication(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;
    const userId = req.auth!.userId;

    const perm = await getAppPermission(req.auth?.tenantId, userId, 'hr');
    // Ownership check for non-privileged roles — a viewer may submit
    // their own draft leave application but not anyone else's.
    if (!canAccess(perm.role, 'update')) {
      const callerEmployeeId = await findEmployeeIdByLinkedUser(userId, tenantId);
      if (!callerEmployeeId) {
        res.status(400).json({ success: false, error: 'No employee record found for current user' });
        return;
      }
      const existing = await leaveService.getLeaveApplication(tenantId, req.params.id as string);
      if (!existing || existing.employeeId !== callerEmployeeId) {
        res.status(403).json({ success: false, error: 'No permission to submit this leave application' });
        return;
      }
    }

    const data = await leaveService.submitLeaveApplication(tenantId, req.params.id as string);
    if (!data) { res.status(400).json({ success: false, error: 'Cannot submit this application' }); return; }

    if (req.auth!.tenantId && data.employeeId) {
      const managerUserId = await getManagerLinkedUserId(data.employeeId);
      emitAppEvent({
        tenantId: req.auth!.tenantId,
        userId: req.auth!.userId,
        appId: 'hr',
        eventType: 'leave.submitted',
        title: `submitted leave application for approval`,
        metadata: { leaveApplicationId: data.id, employeeId: data.employeeId },
        ...(managerUserId ? { notifyUserIds: [managerUserId] } : {}),
      }).catch(() => {});
    }

    res.json({ success: true, data });
  } catch (error: any) {
    logger.error({ error }, 'Failed to submit leave application');
    res.status(400).json({ success: false, error: error.message || 'Failed to submit leave application' });
  }
}

export async function approveLeaveApplication(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;
    const userId = req.auth!.userId;

    const perm = await getAppPermission(req.auth?.tenantId, userId, 'hr');
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'No permission to update HR records' });
      return;
    }

    const { comment } = req.body;
    const data = await leaveService.approveLeaveApplication(tenantId, req.params.id as string, userId, comment);
    if (!data) { res.status(400).json({ success: false, error: 'Cannot approve this application' }); return; }

    if (req.auth!.tenantId) {
      const employeeUserId = data.employeeId ? await getLinkedUserIdForEmployee(data.employeeId) : null;
      emitAppEvent({
        tenantId: req.auth!.tenantId,
        userId,
        appId: 'hr',
        eventType: 'leave.approved',
        title: `approved leave application`,
        metadata: { leaveApplicationId: data.id },
        ...(employeeUserId ? { notifyUserIds: [employeeUserId] } : {}),
      }).catch(() => {});
    }

    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to approve leave application');
    res.status(500).json({ success: false, error: 'Failed to approve leave application' });
  }
}

export async function rejectLeaveApplication(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;
    const userId = req.auth!.userId;

    const perm = await getAppPermission(req.auth?.tenantId, userId, 'hr');
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'No permission to update HR records' });
      return;
    }

    const { comment } = req.body;
    const data = await leaveService.rejectLeaveApplication(tenantId, req.params.id as string, userId, comment);
    if (!data) { res.status(400).json({ success: false, error: 'Cannot reject this application' }); return; }

    if (req.auth!.tenantId) {
      const employeeUserId = data.employeeId ? await getLinkedUserIdForEmployee(data.employeeId) : null;
      emitAppEvent({
        tenantId: req.auth!.tenantId,
        userId,
        appId: 'hr',
        eventType: 'leave.rejected',
        title: `rejected leave application`,
        metadata: { leaveApplicationId: data.id },
        ...(employeeUserId ? { notifyUserIds: [employeeUserId] } : {}),
      }).catch(() => {});
    }

    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to reject leave application');
    res.status(500).json({ success: false, error: 'Failed to reject leave application' });
  }
}

export async function cancelLeaveApplication(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;
    const userId = req.auth!.userId;

    const perm = await getAppPermission(req.auth?.tenantId, userId, 'hr');
    // Ownership check for non-privileged roles.
    if (!canAccess(perm.role, 'update')) {
      const callerEmployeeId = await findEmployeeIdByLinkedUser(userId, tenantId);
      if (!callerEmployeeId) {
        res.status(400).json({ success: false, error: 'No employee record found for current user' });
        return;
      }
      const existing = await leaveService.getLeaveApplication(tenantId, req.params.id as string);
      if (!existing || existing.employeeId !== callerEmployeeId) {
        res.status(403).json({ success: false, error: 'No permission to cancel this leave application' });
        return;
      }
    }

    const data = await leaveService.cancelLeaveApplication(tenantId, req.params.id as string);
    if (!data) { res.status(400).json({ success: false, error: 'Cannot cancel this application' }); return; }
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to cancel leave application');
    res.status(500).json({ success: false, error: 'Failed to cancel leave application' });
  }
}

export async function getPendingApprovals(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;
    const userId = req.auth!.userId;

    const data = await leaveService.getPendingApprovals(tenantId, userId);
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to get pending approvals');
    res.status(500).json({ success: false, error: 'Failed to get pending approvals' });
  }
}

export async function getLeaveCalendar(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;

    const month = (req.query.month as string) || new Date().toISOString().slice(0, 7);
    const data = await leaveService.getLeaveCalendar(tenantId, month);
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to get leave calendar');
    res.status(500).json({ success: false, error: 'Failed to get leave calendar' });
  }
}
