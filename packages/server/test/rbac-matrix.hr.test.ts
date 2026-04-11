import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/apps/hr/services/employee.service', () => ({
  listEmployees: vi.fn().mockResolvedValue([]),
  getEmployee: vi.fn().mockResolvedValue({ id: 'e1', email: 'self@test.com' }),
  createEmployee: vi.fn().mockResolvedValue({ id: 'e1', name: 'Alice' }),
  updateEmployee: vi.fn().mockResolvedValue({ id: 'e1', name: 'Alice' }),
  deleteEmployee: vi.fn().mockResolvedValue(undefined),
  searchEmployees: vi.fn().mockResolvedValue([]),
  getEmployeeCounts: vi.fn().mockResolvedValue({}),
}));

vi.mock('../src/apps/hr/services/dashboard.service', () => ({
  getWidgetData: vi.fn().mockResolvedValue({}),
  getDashboardData: vi.fn().mockResolvedValue({}),
  seedSampleData: vi.fn().mockResolvedValue({}),
}));

vi.mock('../src/services/event.service', () => ({
  emitAppEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import * as employeeController from '../src/apps/hr/controllers/employee.controller';
import * as employeeService from '../src/apps/hr/services/employee.service';
import { makeReqWithPerm, makeRes, expectForbidden, expectSuccess } from './helpers/rbac-harness';

function req(role: 'admin' | 'editor' | 'viewer', recordAccess: 'all' | 'own' = 'all', extra: any = {}) {
  return makeReqWithPerm('hr', role, recordAccess, extra);
}

describe('RBAC matrix — HR employees', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // default: the target employee row has a matching email (self)
    vi.mocked(employeeService.getEmployee).mockResolvedValue({
      id: 'e1',
      email: 'self@test.com',
      name: 'Alice',
    } as any);
  });

  it('viewer can list', async () => {
    const res = makeRes();
    await employeeController.listEmployees(req('viewer'), res);
    expectSuccess(res);
  });

  it('viewer can get own employee row (email match)', async () => {
    const res = makeRes();
    await employeeController.getEmployee(req('viewer', 'all', { params: { id: 'e1' } }), res);
    expectSuccess(res);
  });

  it("viewer cannot get another user's employee row", async () => {
    vi.mocked(employeeService.getEmployee).mockResolvedValue({
      id: 'e2',
      email: 'other@test.com',
    } as any);
    const res = makeRes();
    await employeeController.getEmployee(req('viewer', 'all', { params: { id: 'e2' } }), res);
    expectForbidden(res);
  });

  it('viewer cannot create', async () => {
    const res = makeRes();
    await employeeController.createEmployee(
      req('viewer', 'all', { body: { name: 'A', email: 'a@test.com' } }),
      res,
    );
    expectForbidden(res);
  });

  it('viewer cannot update another user', async () => {
    vi.mocked(employeeService.getEmployee).mockResolvedValue({
      id: 'e2',
      email: 'other@test.com',
    } as any);
    const res = makeRes();
    await employeeController.updateEmployee(
      req('viewer', 'all', { params: { id: 'e2' }, body: { name: 'X' } }),
      res,
    );
    expectForbidden(res);
  });

  it('viewer can update their own employee row (self-service fields)', async () => {
    vi.mocked(employeeService.getEmployee).mockResolvedValue({
      id: 'e1',
      email: 'self@test.com',
    } as any);
    const res = makeRes();
    await employeeController.updateEmployee(
      req('viewer', 'all', { params: { id: 'e1' }, body: { phone: '123' } }),
      res,
    );
    expectSuccess(res);
  });

  it('viewer cannot delete', async () => {
    const res = makeRes();
    await employeeController.deleteEmployee(req('viewer', 'all', { params: { id: 'e1' } }), res);
    expectForbidden(res);
  });

  it('editor can create', async () => {
    const res = makeRes();
    await employeeController.createEmployee(
      req('editor', 'all', { body: { name: 'A', email: 'a@test.com' } }),
      res,
    );
    expectSuccess(res);
  });

  it('editor can update any employee', async () => {
    const res = makeRes();
    await employeeController.updateEmployee(
      req('editor', 'all', { params: { id: 'e1' }, body: { name: 'B' } }),
      res,
    );
    expectSuccess(res);
  });

  // NOTE: hr deleteEmployee currently has no real ownership check — it
  // only tests canAccess(delete) || canAccess(delete_own). Editors pass
  // the gate and the service deletes any id. This documents the current
  // behaviour; follow-up may want to add an ownership assertion.
  it('editor passes delete gate (no real ownership enforcement today)', async () => {
    const res = makeRes();
    await employeeController.deleteEmployee(req('editor', 'all', { params: { id: 'e1' } }), res);
    expectSuccess(res);
  });

  it('admin can delete any employee', async () => {
    const res = makeRes();
    await employeeController.deleteEmployee(req('admin', 'all', { params: { id: 'e1' } }), res);
    expectSuccess(res);
  });
});
