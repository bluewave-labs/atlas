import type { Request, Response } from 'express';
import * as hrService from './service';
import * as leaveService from './leave.service';
import * as attendanceService from './attendance.service';
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
    const {
      name, email, role, departmentId, startDate, phone, avatarUrl, status, linkedUserId, tags, sortOrder, isArchived,
      dateOfBirth, gender, emergencyContactName, emergencyContactPhone, emergencyContactRelation,
      employmentType, managerId, jobTitle, workLocation, salary, salaryCurrency, salaryPeriod,
    } = req.body;

    const employee = await hrService.updateEmployee(userId, id, {
      name, email, role, departmentId, startDate, phone, avatarUrl, status, linkedUserId, tags, sortOrder, isArchived,
      dateOfBirth, gender, emergencyContactName, emergencyContactPhone, emergencyContactRelation,
      employmentType, managerId, jobTitle, workLocation, salary, salaryCurrency, salaryPeriod,
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

// ─── Leave Balances ────────────────────────────────────────────────

export async function getLeaveBalances(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;
    const employeeId = req.params.id as string;
    const year = parseInt(req.query.year as string) || new Date().getFullYear();

    const balances = await hrService.getLeaveBalances(accountId, employeeId, year);
    res.json({ success: true, data: balances });
  } catch (error) {
    logger.error({ error }, 'Failed to get leave balances');
    res.status(500).json({ success: false, error: 'Failed to get leave balances' });
  }
}

export async function allocateLeave(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;
    const employeeId = req.params.id as string;
    const { leaveType, year, days } = req.body;

    if (!leaveType || !year || days == null) {
      res.status(400).json({ success: false, error: 'leaveType, year, and days are required' });
      return;
    }

    const balance = await hrService.allocateLeave(accountId, employeeId, leaveType, year, days);
    res.json({ success: true, data: balance });
  } catch (error) {
    logger.error({ error }, 'Failed to allocate leave');
    res.status(500).json({ success: false, error: 'Failed to allocate leave' });
  }
}

export async function getLeaveBalancesSummary(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;
    const balances = await hrService.getLeaveBalancesSummary(accountId);
    res.json({ success: true, data: balances });
  } catch (error) {
    logger.error({ error }, 'Failed to get leave balances summary');
    res.status(500).json({ success: false, error: 'Failed to get leave balances summary' });
  }
}

// ─── Dashboard ─────────────────────────────────────────────────────

export async function getDashboard(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const data = await hrService.getDashboardData(userId, accountId);
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to get HR dashboard');
    res.status(500).json({ success: false, error: 'Failed to get HR dashboard' });
  }
}

// ─── Onboarding Tasks ──────────────────────────────────────────────

export async function listOnboardingTasks(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;
    const employeeId = req.params.id as string;

    const tasks = await hrService.listOnboardingTasks(accountId, employeeId);
    res.json({ success: true, data: tasks });
  } catch (error) {
    logger.error({ error }, 'Failed to list onboarding tasks');
    res.status(500).json({ success: false, error: 'Failed to list onboarding tasks' });
  }
}

export async function createOnboardingTask(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;
    const employeeId = req.params.id as string;
    const { title, description, category, dueDate } = req.body;

    if (!title?.trim()) {
      res.status(400).json({ success: false, error: 'Title is required' });
      return;
    }

    const task = await hrService.createOnboardingTask(accountId, employeeId, {
      title: title.trim(), description, category, dueDate,
    });
    res.json({ success: true, data: task });
  } catch (error) {
    logger.error({ error }, 'Failed to create onboarding task');
    res.status(500).json({ success: false, error: 'Failed to create onboarding task' });
  }
}

export async function updateOnboardingTask(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;
    const taskId = req.params.taskId as string;
    const { title, description, category, dueDate, completed, completedBy, sortOrder, isArchived } = req.body;

    const updates: Record<string, unknown> = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (category !== undefined) updates.category = category;
    if (dueDate !== undefined) updates.dueDate = dueDate;
    if (completed !== undefined) {
      updates.completedAt = completed ? new Date() : null;
      updates.completedBy = completed ? completedBy || null : null;
    }
    if (sortOrder !== undefined) updates.sortOrder = sortOrder;
    if (isArchived !== undefined) updates.isArchived = isArchived;

    const task = await hrService.updateOnboardingTask(accountId, taskId, updates as any);
    if (!task) {
      res.status(404).json({ success: false, error: 'Task not found' });
      return;
    }
    res.json({ success: true, data: task });
  } catch (error) {
    logger.error({ error }, 'Failed to update onboarding task');
    res.status(500).json({ success: false, error: 'Failed to update onboarding task' });
  }
}

export async function deleteOnboardingTask(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;
    const taskId = req.params.taskId as string;

    await hrService.deleteOnboardingTask(accountId, taskId);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to delete onboarding task');
    res.status(500).json({ success: false, error: 'Failed to delete onboarding task' });
  }
}

export async function createTasksFromTemplate(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;
    const employeeId = req.params.id as string;
    const { templateId } = req.body;

    if (!templateId) {
      res.status(400).json({ success: false, error: 'templateId is required' });
      return;
    }

    const tasks = await hrService.createTasksFromTemplate(accountId, employeeId, templateId);
    res.json({ success: true, data: tasks });
  } catch (error) {
    logger.error({ error }, 'Failed to create tasks from template');
    res.status(500).json({ success: false, error: 'Failed to create tasks from template' });
  }
}

// ─── Onboarding Templates ──────────────────────────────────────────

export async function listOnboardingTemplates(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;
    const templates = await hrService.listOnboardingTemplates(accountId);
    res.json({ success: true, data: templates });
  } catch (error) {
    logger.error({ error }, 'Failed to list onboarding templates');
    res.status(500).json({ success: false, error: 'Failed to list onboarding templates' });
  }
}

export async function createOnboardingTemplate(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;
    const { name, tasks } = req.body;

    if (!name?.trim()) {
      res.status(400).json({ success: false, error: 'Name is required' });
      return;
    }

    const template = await hrService.createOnboardingTemplate(accountId, {
      name: name.trim(), tasks: tasks || [],
    });
    res.json({ success: true, data: template });
  } catch (error) {
    logger.error({ error }, 'Failed to create onboarding template');
    res.status(500).json({ success: false, error: 'Failed to create onboarding template' });
  }
}

// ─── Employee Documents ────────────────────────────────────────────

export async function listEmployeeDocuments(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;
    const employeeId = req.params.id as string;

    const docs = await hrService.listEmployeeDocuments(accountId, employeeId);
    res.json({ success: true, data: docs });
  } catch (error) {
    logger.error({ error }, 'Failed to list employee documents');
    res.status(500).json({ success: false, error: 'Failed to list employee documents' });
  }
}

export async function uploadEmployeeDocument(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;
    const userId = req.auth!.userId;
    const employeeId = req.params.id as string;
    const file = req.file;
    const { type, expiresAt, notes } = req.body;

    if (!file) {
      res.status(400).json({ success: false, error: 'No file uploaded' });
      return;
    }

    const doc = await hrService.createEmployeeDocument(accountId, {
      employeeId,
      name: file.originalname,
      type: type || 'other',
      storagePath: file.path,
      mimeType: file.mimetype,
      size: file.size,
      expiresAt: expiresAt || null,
      notes: notes || null,
      uploadedBy: userId,
    });

    res.json({ success: true, data: doc });
  } catch (error) {
    logger.error({ error }, 'Failed to upload employee document');
    res.status(500).json({ success: false, error: 'Failed to upload employee document' });
  }
}

export async function deleteEmployeeDocument(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;
    const docId = req.params.docId as string;

    await hrService.deleteEmployeeDocument(accountId, docId);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to delete employee document');
    res.status(500).json({ success: false, error: 'Failed to delete employee document' });
  }
}

export async function downloadEmployeeDocument(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;
    const docId = req.params.docId as string;

    const doc = await hrService.getEmployeeDocument(accountId, docId);
    if (!doc) {
      res.status(404).json({ success: false, error: 'Document not found' });
      return;
    }

    res.download(doc.storagePath, doc.name);
  } catch (error) {
    logger.error({ error }, 'Failed to download employee document');
    res.status(500).json({ success: false, error: 'Failed to download employee document' });
  }
}

// ─── Leave Types ──────────────────────────────────────────────────

export async function listLeaveTypes(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;
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
    const data = await hrService.getEmployeePolicy(accountId, req.params.id as string);
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to get employee policy');
    res.status(500).json({ success: false, error: 'Failed to get employee policy' });
  }
}

// ─── Holiday Calendars ────────────────────────────────────────────

export async function listHolidayCalendars(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;
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
    await hrService.deleteHoliday(accountId, req.params.id as string);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to delete holiday');
    res.status(500).json({ success: false, error: 'Failed to delete holiday' });
  }
}

export async function getWorkingDays(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;
    const { start, end, calendarId } = req.query;
    if (!start || !end) { res.status(400).json({ success: false, error: 'start and end are required' }); return; }
    const days = await hrService.calculateWorkingDays(accountId, start as string, end as string, calendarId as string | undefined);
    res.json({ success: true, data: { workingDays: days } });
  } catch (error) {
    logger.error({ error }, 'Failed to calculate working days');
    res.status(500).json({ success: false, error: 'Failed to calculate working days' });
  }
}

// ─── Leave Applications ───────────────────────────────────────────

export async function listLeaveApplications(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;
    const { employeeId, status, startDate, endDate } = req.query;
    const data = await leaveService.listLeaveApplications(accountId, {
      employeeId: employeeId as string | undefined,
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
    const accountId = req.auth!.accountId;
    const { employeeId, leaveTypeId, startDate, endDate, halfDay, halfDayDate, reason } = req.body;
    if (!employeeId || !leaveTypeId || !startDate || !endDate) {
      res.status(400).json({ success: false, error: 'employeeId, leaveTypeId, startDate, endDate are required' });
      return;
    }
    const data = await leaveService.createLeaveApplication(accountId, {
      employeeId, leaveTypeId, startDate, endDate, halfDay, halfDayDate, reason,
    });
    res.json({ success: true, data });
  } catch (error: any) {
    logger.error({ error }, 'Failed to create leave application');
    res.status(400).json({ success: false, error: error.message || 'Failed to create leave application' });
  }
}

export async function updateLeaveApplication(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;
    const data = await leaveService.updateLeaveApplication(accountId, req.params.id as string, req.body);
    if (!data) { res.status(404).json({ success: false, error: 'Leave application not found or not in draft' }); return; }
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to update leave application');
    res.status(500).json({ success: false, error: 'Failed to update leave application' });
  }
}

export async function submitLeaveApplication(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;
    const data = await leaveService.submitLeaveApplication(accountId, req.params.id as string);
    if (!data) { res.status(400).json({ success: false, error: 'Cannot submit this application' }); return; }
    res.json({ success: true, data });
  } catch (error: any) {
    logger.error({ error }, 'Failed to submit leave application');
    res.status(400).json({ success: false, error: error.message || 'Failed to submit leave application' });
  }
}

export async function approveLeaveApplication(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;
    const userId = req.auth!.userId;
    const { comment } = req.body;
    const data = await leaveService.approveLeaveApplication(accountId, req.params.id as string, userId, comment);
    if (!data) { res.status(400).json({ success: false, error: 'Cannot approve this application' }); return; }
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to approve leave application');
    res.status(500).json({ success: false, error: 'Failed to approve leave application' });
  }
}

export async function rejectLeaveApplication(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;
    const userId = req.auth!.userId;
    const { comment } = req.body;
    const data = await leaveService.rejectLeaveApplication(accountId, req.params.id as string, userId, comment);
    if (!data) { res.status(400).json({ success: false, error: 'Cannot reject this application' }); return; }
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to reject leave application');
    res.status(500).json({ success: false, error: 'Failed to reject leave application' });
  }
}

export async function cancelLeaveApplication(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;
    const data = await leaveService.cancelLeaveApplication(accountId, req.params.id as string);
    if (!data) { res.status(400).json({ success: false, error: 'Cannot cancel this application' }); return; }
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to cancel leave application');
    res.status(500).json({ success: false, error: 'Failed to cancel leave application' });
  }
}

export async function getPendingApprovals(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;
    const userId = req.auth!.userId;
    const data = await leaveService.getPendingApprovals(accountId, userId);
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to get pending approvals');
    res.status(500).json({ success: false, error: 'Failed to get pending approvals' });
  }
}

export async function getLeaveCalendar(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;
    const month = (req.query.month as string) || new Date().toISOString().slice(0, 7);
    const data = await leaveService.getLeaveCalendar(accountId, month);
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to get leave calendar');
    res.status(500).json({ success: false, error: 'Failed to get leave calendar' });
  }
}

// ─── Attendance ───────────────────────────────────────────────────

export async function listAttendance(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;
    const { employeeId, date, startDate, endDate, status } = req.query;
    const data = await attendanceService.listAttendance(accountId, {
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
    const accountId = req.auth!.accountId;
    const userId = req.auth!.userId;
    const { employeeId, date, status, checkInTime, checkOutTime, notes } = req.body;
    if (!employeeId || !date || !status) {
      res.status(400).json({ success: false, error: 'employeeId, date, and status are required' });
      return;
    }
    const data = await attendanceService.markAttendance(accountId, {
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
    const accountId = req.auth!.accountId;
    const userId = req.auth!.userId;
    const { employeeIds, date, status } = req.body;
    if (!employeeIds?.length || !date || !status) {
      res.status(400).json({ success: false, error: 'employeeIds, date, and status are required' });
      return;
    }
    const data = await attendanceService.bulkMarkAttendance(accountId, {
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
    const accountId = req.auth!.accountId;
    const data = await attendanceService.updateAttendance(accountId, req.params.id as string, req.body);
    if (!data) { res.status(404).json({ success: false, error: 'Attendance record not found' }); return; }
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to update attendance');
    res.status(500).json({ success: false, error: 'Failed to update attendance' });
  }
}

export async function getAttendanceToday(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;
    const data = await attendanceService.getTodaySummary(accountId);
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to get today attendance');
    res.status(500).json({ success: false, error: 'Failed to get today attendance' });
  }
}

export async function getAttendanceReport(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;
    const month = (req.query.month as string) || new Date().toISOString().slice(0, 7);
    const data = await attendanceService.getMonthlyReport(accountId, month);
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to get attendance report');
    res.status(500).json({ success: false, error: 'Failed to get attendance report' });
  }
}

export async function getEmployeeAttendance(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;
    const month = (req.query.month as string) || undefined;
    const data = await attendanceService.getEmployeeAttendance(accountId, req.params.id as string, month);
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to get employee attendance');
    res.status(500).json({ success: false, error: 'Failed to get employee attendance' });
  }
}

// ─── Lifecycle Events ─────────────────────────────────────────────

export async function getLifecycleTimeline(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;
    const data = await hrService.getLifecycleTimeline(accountId, req.params.id as string);
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to get lifecycle timeline');
    res.status(500).json({ success: false, error: 'Failed to get lifecycle timeline' });
  }
}

export async function createLifecycleEventHandler(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;
    const userId = req.auth!.userId;
    const employeeId = req.params.id as string;
    const { eventType, eventDate, effectiveDate, fromValue, toValue, fromDepartmentId, toDepartmentId, notes } = req.body;
    if (!eventType || !eventDate) {
      res.status(400).json({ success: false, error: 'eventType and eventDate are required' });
      return;
    }
    const data = await hrService.createLifecycleEvent(accountId, {
      employeeId, eventType, eventDate, effectiveDate, fromValue, toValue,
      fromDepartmentId, toDepartmentId, notes, createdBy: userId,
    });
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to create lifecycle event');
    res.status(500).json({ success: false, error: 'Failed to create lifecycle event' });
  }
}

export async function deleteLifecycleEvent(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;
    await hrService.deleteLifecycleEvent(accountId, req.params.id as string);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to delete lifecycle event');
    res.status(500).json({ success: false, error: 'Failed to delete lifecycle event' });
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
