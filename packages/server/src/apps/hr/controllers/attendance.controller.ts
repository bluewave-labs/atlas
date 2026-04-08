import type { Request, Response } from 'express';
import * as attendanceService from '../attendance.service';
import { logger } from '../../../utils/logger';
import { getAppPermission, canAccess } from '../../../services/app-permissions.service';

// ─── Attendance ───────────────────────────────────────────────────

export async function listAttendance(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;

    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'hr');
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'No permission to view HR data' });
      return;
    }

    const { employeeId, date, startDate, endDate, status } = req.query;
    const data = await attendanceService.listAttendance(tenantId, {
      employeeId: employeeId as string | undefined,
      date: date as string | undefined,
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
      status: status as string | undefined,
    });
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to list attendance');
    res.status(500).json({ success: false, error: 'Failed to list attendance' });
  }
}

export async function markAttendance(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;
    const userId = req.auth!.userId;

    const perm = await getAppPermission(req.auth?.tenantId, userId, 'hr');
    if (!canAccess(perm.role, 'create')) {
      res.status(403).json({ success: false, error: 'No permission to create HR records' });
      return;
    }

    const { employeeId, date, status, checkInTime, checkOutTime, notes } = req.body;
    if (!employeeId || !date || !status) {
      res.status(400).json({ success: false, error: 'employeeId, date, and status are required' });
      return;
    }
    const data = await attendanceService.markAttendance(tenantId, {
      employeeId, date, status, checkInTime, checkOutTime, notes, markedBy: userId,
    });
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to mark attendance');
    res.status(500).json({ success: false, error: 'Failed to mark attendance' });
  }
}

export async function bulkMarkAttendance(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;
    const userId = req.auth!.userId;

    const perm = await getAppPermission(req.auth?.tenantId, userId, 'hr');
    if (!canAccess(perm.role, 'create')) {
      res.status(403).json({ success: false, error: 'No permission to create HR records' });
      return;
    }

    const { employeeIds, date, status } = req.body;
    if (!employeeIds?.length || !date || !status) {
      res.status(400).json({ success: false, error: 'employeeIds, date, and status are required' });
      return;
    }
    const data = await attendanceService.bulkMarkAttendance(tenantId, {
      employeeIds, date, status, markedBy: userId,
    });
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to bulk mark attendance');
    res.status(500).json({ success: false, error: 'Failed to bulk mark attendance' });
  }
}

export async function updateAttendanceRecord(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;

    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'hr');
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'No permission to update HR records' });
      return;
    }

    const data = await attendanceService.updateAttendance(tenantId, req.params.id as string, req.body);
    if (!data) { res.status(404).json({ success: false, error: 'Attendance record not found' }); return; }
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to update attendance');
    res.status(500).json({ success: false, error: 'Failed to update attendance' });
  }
}

export async function getAttendanceToday(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;

    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'hr');
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'No permission to view HR data' });
      return;
    }

    const data = await attendanceService.getTodaySummary(tenantId);
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to get today attendance');
    res.status(500).json({ success: false, error: 'Failed to get today attendance' });
  }
}

export async function getAttendanceReport(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;

    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'hr');
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'No permission to view HR data' });
      return;
    }

    const month = (req.query.month as string) || new Date().toISOString().slice(0, 7);
    const data = await attendanceService.getMonthlyReport(tenantId, month);
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to get attendance report');
    res.status(500).json({ success: false, error: 'Failed to get attendance report' });
  }
}

export async function getEmployeeAttendance(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;

    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'hr');
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'No permission to view HR data' });
      return;
    }

    const month = (req.query.month as string) || undefined;
    const data = await attendanceService.getEmployeeAttendance(tenantId, req.params.id as string, month);
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to get employee attendance');
    res.status(500).json({ success: false, error: 'Failed to get employee attendance' });
  }
}
