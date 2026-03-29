import type { Request, Response } from 'express';
import * as hrService from './service';
import { logger } from '../../utils/logger';

// ─── Employees ──────────────────────────────────────────────────────

export async function listEmployees(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const { status, departmentId, includeArchived } = req.query;

    const employees = await hrService.listEmployees(userId, accountId, {
      status: status as string | undefined,
      departmentId: departmentId as string | undefined,
      includeArchived: includeArchived === 'true',
    });

    res.json({ success: true, data: { employees } });
  } catch (error) {
    logger.error({ error }, 'Failed to list employees');
    res.status(500).json({ success: false, error: 'Failed to list employees' });
  }
}

export async function getEmployee(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const id = req.params.id as string;

    const employee = await hrService.getEmployee(userId, id);
    if (!employee) {
      res.status(404).json({ success: false, error: 'Employee not found' });
      return;
    }

    res.json({ success: true, data: employee });
  } catch (error) {
    logger.error({ error }, 'Failed to get employee');
    res.status(500).json({ success: false, error: 'Failed to get employee' });
  }
}

export async function createEmployee(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const { name, email, role, departmentId, startDate, phone, avatarUrl, status, linkedUserId, tags } = req.body;

    if (!name?.trim()) {
      res.status(400).json({ success: false, error: 'Name is required' });
      return;
    }
    if (!email?.trim()) {
      res.status(400).json({ success: false, error: 'Email is required' });
      return;
    }

    const employee = await hrService.createEmployee(userId, accountId, {
      name: name.trim(), email: email.trim(), role, departmentId, startDate, phone, avatarUrl, status, linkedUserId, tags,
    });

    res.json({ success: true, data: employee });
  } catch (error) {
    logger.error({ error }, 'Failed to create employee');
    res.status(500).json({ success: false, error: 'Failed to create employee' });
  }
}

export async function updateEmployee(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const id = req.params.id as string;
    const { name, email, role, departmentId, startDate, phone, avatarUrl, status, linkedUserId, tags, sortOrder, isArchived } = req.body;

    const employee = await hrService.updateEmployee(userId, id, {
      name, email, role, departmentId, startDate, phone, avatarUrl, status, linkedUserId, tags, sortOrder, isArchived,
    });

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
    const accountId = req.auth!.accountId;
    const query = (req.query.q as string) || '';

    if (!query.trim()) {
      res.json({ success: true, data: [] });
      return;
    }

    const results = await hrService.searchEmployees(userId, accountId, query.trim());
    res.json({ success: true, data: results });
  } catch (error) {
    logger.error({ error }, 'Failed to search employees');
    res.status(500).json({ success: false, error: 'Failed to search employees' });
  }
}

export async function getEmployeeCounts(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const counts = await hrService.getEmployeeCounts(userId, accountId);
    res.json({ success: true, data: counts });
  } catch (error) {
    logger.error({ error }, 'Failed to get employee counts');
    res.status(500).json({ success: false, error: 'Failed to get employee counts' });
  }
}

// ─── Departments ────────────────────────────────────────────────────

export async function listDepartments(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const includeArchived = req.query.includeArchived === 'true';

    const depts = await hrService.listDepartments(userId, accountId, includeArchived);
    res.json({ success: true, data: { departments: depts } });
  } catch (error) {
    logger.error({ error }, 'Failed to list departments');
    res.status(500).json({ success: false, error: 'Failed to list departments' });
  }
}

export async function createDepartment(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const { name, headEmployeeId, color, description } = req.body;

    const department = await hrService.createDepartment(userId, accountId, {
      name, headEmployeeId, color, description,
    });

    res.json({ success: true, data: department });
  } catch (error) {
    logger.error({ error }, 'Failed to create department');
    res.status(500).json({ success: false, error: 'Failed to create department' });
  }
}

export async function updateDepartment(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const id = req.params.id as string;
    const { name, headEmployeeId, color, description, sortOrder, isArchived } = req.body;

    const department = await hrService.updateDepartment(userId, accountId, id, {
      name, headEmployeeId, color, description, sortOrder, isArchived,
    });

    if (!department) {
      res.status(404).json({ success: false, error: 'Department not found' });
      return;
    }

    res.json({ success: true, data: department });
  } catch (error) {
    logger.error({ error }, 'Failed to update department');
    res.status(500).json({ success: false, error: 'Failed to update department' });
  }
}

export async function deleteDepartment(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const id = req.params.id as string;

    await hrService.deleteDepartment(userId, accountId, id);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to delete department');
    res.status(500).json({ success: false, error: 'Failed to delete department' });
  }
}

// ─── Time Off Requests ──────────────────────────────────────────────

export async function listTimeOffRequests(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const { employeeId, status, type, includeArchived } = req.query;

    const requests = await hrService.listTimeOffRequests(userId, accountId, {
      employeeId: employeeId as string | undefined,
      status: status as string | undefined,
      type: type as string | undefined,
      includeArchived: includeArchived === 'true',
    });

    res.json({ success: true, data: { timeOffRequests: requests } });
  } catch (error) {
    logger.error({ error }, 'Failed to list time-off requests');
    res.status(500).json({ success: false, error: 'Failed to list time-off requests' });
  }
}

export async function createTimeOffRequest(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const { employeeId, type, startDate, endDate, approverId, notes } = req.body;

    const request = await hrService.createTimeOffRequest(userId, accountId, {
      employeeId, type, startDate, endDate, approverId, notes,
    });

    res.json({ success: true, data: request });
  } catch (error) {
    logger.error({ error }, 'Failed to create time-off request');
    res.status(500).json({ success: false, error: 'Failed to create time-off request' });
  }
}

export async function updateTimeOffRequest(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const id = req.params.id as string;
    const { type, startDate, endDate, status, approverId, notes, sortOrder, isArchived } = req.body;

    const request = await hrService.updateTimeOffRequest(userId, accountId, id, {
      type, startDate, endDate, status, approverId, notes, sortOrder, isArchived,
    });

    if (!request) {
      res.status(404).json({ success: false, error: 'Time-off request not found' });
      return;
    }

    res.json({ success: true, data: request });
  } catch (error) {
    logger.error({ error }, 'Failed to update time-off request');
    res.status(500).json({ success: false, error: 'Failed to update time-off request' });
  }
}

export async function deleteTimeOffRequest(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const id = req.params.id as string;

    await hrService.deleteTimeOffRequest(userId, accountId, id);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to delete time-off request');
    res.status(500).json({ success: false, error: 'Failed to delete time-off request' });
  }
}

// ─── Seed Sample Data ───────────────────────────────────────────────

export async function seedSampleData(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;

    const result = await hrService.seedSampleData(userId, accountId);
    res.json({ success: true, data: { message: 'Seeded HR sample data', ...result } });
  } catch (error) {
    logger.error({ error }, 'Failed to seed HR sample data');
    res.status(500).json({ success: false, error: 'Failed to seed HR sample data' });
  }
}
