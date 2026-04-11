import type { Request, Response } from 'express';
import * as hrService from '../services/employee.service';
import * as dashboardService from '../services/dashboard.service';
import { logger } from '../../../utils/logger';
import { emitAppEvent } from '../../../services/event.service';
import { getAppPermission, canAccess } from '../../../services/app-permissions.service';

// ─── Widget ─────────────────────────────────────────────────────────

export async function getWidgetData(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;

    const data = await dashboardService.getWidgetData(userId, tenantId);
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to get HR widget data');
    res.status(500).json({ success: false, error: 'Failed to get HR widget data' });
  }
}

// ─── Employees ──────────────────────────────────────────────────────

export async function listEmployees(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;

    const perm = await getAppPermission(req.auth?.tenantId, userId, 'hr');
    const { status, departmentId, includeArchived } = req.query;

    const isAdmin = perm.role === 'admin' || perm.role === 'editor';
    const employees = await hrService.listEmployees(userId, tenantId, {
      status: status as string | undefined,
      departmentId: departmentId as string | undefined,
      includeArchived: includeArchived === 'true',
      isAdmin,
      userEmail: req.auth!.email,
    });

    // Strip sensitive salary fields for non-admins — matches the
    // single-row getEmployee endpoint's stripping behaviour. A non-admin
    // viewer is typically scoped to just their own row, but we defend
    // here anyway so any leaked row from the service doesn't expose pay.
    const sanitised = isAdmin
      ? employees
      : employees.map((e) => ({
          ...e,
          salary: undefined,
          salaryCurrency: undefined,
          salaryPeriod: undefined,
        }));

    res.json({ success: true, data: { employees: sanitised } });
  } catch (error) {
    logger.error({ error }, 'Failed to list employees');
    res.status(500).json({ success: false, error: 'Failed to list employees' });
  }
}

export async function getEmployee(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;

    const perm = await getAppPermission(req.auth?.tenantId, userId, 'hr');
    const id = req.params.id as string;

    const employee = await hrService.getEmployee(userId, tenantId, id);
    if (!employee) {
      res.status(404).json({ success: false, error: 'Employee not found' });
      return;
    }

    // Non-admin users can only see their own record and shouldn't see salary data
    const isAdmin = perm.role === 'admin' || perm.role === 'editor';
    const isSelf = employee.email?.toLowerCase() === req.auth!.email?.toLowerCase();

    if (!isAdmin && !isSelf) {
      res.status(403).json({ success: false, error: 'You can only view your own employee record' });
      return;
    }

    // Strip sensitive fields for non-admins
    const data = isAdmin ? employee : { ...employee, salary: undefined, salaryCurrency: undefined, salaryPeriod: undefined };

    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to get employee');
    res.status(500).json({ success: false, error: 'Failed to get employee' });
  }
}

export async function createEmployee(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;

    const perm = await getAppPermission(req.auth?.tenantId, userId, 'hr');
    if (!canAccess(perm.role, 'create')) {
      res.status(403).json({ success: false, error: 'No permission to create HR records' });
      return;
    }

    const { name, email, role, departmentId, startDate, phone, avatarUrl, status, linkedUserId, tags } = req.body;

    if (!name?.trim()) {
      res.status(400).json({ success: false, error: 'Name is required' });
      return;
    }
    if (!email?.trim()) {
      res.status(400).json({ success: false, error: 'Email is required' });
      return;
    }

    const employee = await hrService.createEmployee(userId, tenantId, {
      name: name.trim(), email: email.trim(), role, departmentId, startDate, phone, avatarUrl, status, linkedUserId, tags,
    });

    if (req.auth!.tenantId) {
      emitAppEvent({
        tenantId: req.auth!.tenantId,
        userId,
        appId: 'hr',
        eventType: 'employee.created',
        title: `added new employee: ${employee.name}`,
        metadata: { employeeId: employee.id },
      }).catch(() => {});
    }

    res.json({ success: true, data: employee });
  } catch (error) {
    logger.error({ error }, 'Failed to create employee');
    res.status(500).json({ success: false, error: 'Failed to create employee' });
  }
}

export async function updateEmployee(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const userEmail = req.auth!.email;
    const id = req.params.id as string;

    const perm = await getAppPermission(req.auth?.tenantId, userId, 'hr');
    const hasUpdatePerm = canAccess(perm.role, 'update');

    // If user doesn't have HR update permission, check if they're editing their own record
    if (!hasUpdatePerm) {
      const existing = await hrService.getEmployee(userId, req.auth!.tenantId, id);
      if (!existing || existing.email?.toLowerCase() !== userEmail?.toLowerCase()) {
        res.status(403).json({ success: false, error: 'You can only edit your own employee record' });
        return;
      }
    }

    const {
      name, email, role, departmentId, startDate, phone, avatarUrl, status, linkedUserId, tags, sortOrder, isArchived,
      dateOfBirth, gender, emergencyContactName, emergencyContactPhone, emergencyContactRelation,
      employmentType, managerId, jobTitle, workLocation, salary, salaryCurrency, salaryPeriod,
    } = req.body;

    // Non-admin users can't change sensitive fields on their own record
    const updates = hasUpdatePerm
      ? { name, email, role, departmentId, startDate, phone, avatarUrl, status, linkedUserId, tags, sortOrder, isArchived, dateOfBirth, gender, emergencyContactName, emergencyContactPhone, emergencyContactRelation, employmentType, managerId, jobTitle, workLocation, salary, salaryCurrency, salaryPeriod }
      : { name, phone, dateOfBirth, gender, emergencyContactName, emergencyContactPhone, emergencyContactRelation, workLocation };

    const employee = await hrService.updateEmployee(userId, id, updates, req.auth!.tenantId);

    if (!employee) {
      res.status(404).json({ success: false, error: 'Employee not found' });
      return;
    }

    res.json({ success: true, data: employee });
  } catch (error) {
    logger.error({ error }, 'Failed to update employee');
    res.status(500).json({ success: false, error: 'Failed to update employee' });
  }
}

export async function deleteEmployee(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;

    const perm = await getAppPermission(req.auth?.tenantId, userId, 'hr');
    if (!canAccess(perm.role, 'delete') && !canAccess(perm.role, 'delete_own')) {
      res.status(403).json({ success: false, error: 'No permission to delete' });
      return;
    }

    const id = req.params.id as string;

    await hrService.deleteEmployee(userId, id);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to delete employee');
    res.status(500).json({ success: false, error: 'Failed to delete employee' });
  }
}

export async function searchEmployees(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;

    const query = (req.query.q as string) || '';

    if (!query.trim()) {
      res.json({ success: true, data: [] });
      return;
    }

    const results = await hrService.searchEmployees(userId, tenantId, query.trim());
    res.json({ success: true, data: results });
  } catch (error) {
    logger.error({ error }, 'Failed to search employees');
    res.status(500).json({ success: false, error: 'Failed to search employees' });
  }
}

export async function getEmployeeCounts(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;

    const counts = await hrService.getEmployeeCounts(userId, tenantId);
    res.json({ success: true, data: counts });
  } catch (error) {
    logger.error({ error }, 'Failed to get employee counts');
    res.status(500).json({ success: false, error: 'Failed to get employee counts' });
  }
}

// ─── Dashboard ─────────────────────────────────────────────────────

export async function getDashboard(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;

    const data = await dashboardService.getDashboardData(userId, tenantId);
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to get HR dashboard');
    res.status(500).json({ success: false, error: 'Failed to get HR dashboard' });
  }
}

// ─── Seed Sample Data ───────────────────────────────────────────────

export async function seedSampleData(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;

    const result = await dashboardService.seedSampleData(userId, tenantId);
    res.json({ success: true, data: { message: 'Seeded HR sample data', ...result } });
  } catch (error) {
    logger.error({ error }, 'Failed to seed HR sample data');
    res.status(500).json({ success: false, error: 'Failed to seed HR sample data' });
  }
}
